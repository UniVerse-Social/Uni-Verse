// server/realtime/mm.js
const { randomUUID } = require('crypto');

module.exports = function attachGenericMatchmaker(io) {
  // ---- Game configs ----
  const CONFIG = {
    default: { size: 2, minHumansToStart: 2, fillAfterMs: 0 },
    iceracer: { size: 5, minHumansToStart: 2, fillAfterMs: 60_000, laps: 2, mapCount: 4, botSkill: 4 },
  };

  const lobbies = new Map(); // game -> [{ id, game, createdAt, players:[{socketId,user}], timer, started, bots:[] }]
  const rooms   = new Map(); // roomId -> { game, sockets:Set<string> }

  const cfg = (g) => CONFIG[g] || CONFIG.default;
  const getLobbies = (g) => (lobbies.has(g) ? lobbies.get(g) : (lobbies.set(g, []), lobbies.get(g)));

  function broadcastLobbyState(lobby) {
    const { players, id, game } = lobby;
    for (const p of players) {
      const sock = io.sockets.sockets.get(p.socketId);
      if (sock) sock.emit('mm:lobby', { game, lobbyId: id, count: players.length, size: cfg(game).size });
    }
  }

  function startLobby(lobby) {
    if (lobby.started) return;
    lobby.started = true;
    if (lobby.timer) clearTimeout(lobby.timer);

    const roomId = randomUUID();
    const { game } = lobby;
    const C = cfg(game);

    // Humanz
    const roster = [];
    for (const p of lobby.players) {
      roster.push({ id: p.socketId, isBot: false, username: p.user?.username, userId: p.user?.userId });
    }
    // Bots (already computed during fill or empty if full of people)
    for (const b of (lobby.bots || [])) roster.push(b);

    for (const p of lobby.players) {
      const sock = io.sockets.sockets.get(p.socketId);
      if (sock) sock.join(roomId);
    }
    rooms.set(roomId, { game, sockets: new Set(lobby.players.map(p => p.socketId)) });

    const seed  = Math.floor(Math.random() * 1e9) >>> 0;
    const mapId = Math.floor(Math.random() * C.mapCount);

    const payload = {
      game, roomId, seed, mapId, laps: C.laps,
      roster, size: C.size, startAt: Date.now() + 1500
    };
    for (const p of lobby.players) {
      const sock = io.sockets.sockets.get(p.socketId);
      if (sock) sock.emit('mm:start', payload);
    }
  }

  function maybeFillAndStart(lobby) {
    const C = cfg(lobby.game);
    if (lobby.started) return;
    const humans = lobby.players.length;

    if (humans >= C.minHumansToStart) {
      const need = Math.max(0, C.size - humans);
      // Create level-4 bots to fill
      lobby.bots = Array.from({ length: need }).map((_, i) => ({
        id: `bot-${i + 1}`,
        isBot: true,
        username: `BOT-${i + 1}`,
        skill: C.botSkill
      }));
      startLobby(lobby);
    } else {
      // Not enough humans: dissolve lobby
      for (const p of lobby.players) {
        const sock = io.sockets.sockets.get(p.socketId);
        if (sock) sock.emit('mm:ended', { reason: 'not_enough_players' });
      }
    }
  }

  function findOrCreateLobby(game) {
    const C = cfg(game);
    const list = getLobbies(game);
    let lob = list.find(l => !l.started && (l.players.length + (l.bots?.length || 0)) < C.size);
    if (!lob) {
      lob = {
        id: randomUUID(),
        game,
        createdAt: Date.now(),
        players: [],
        bots: [],
        started: false,
        timer: C.fillAfterMs > 0 ? setTimeout(() => maybeFillAndStart(lob), C.fillAfterMs) : null,
      };
      list.push(lob);
    }
    return lob;
  }

  function removeFromWaiting(socketId) {
    for (const [, list] of lobbies) {
      for (let i = list.length - 1; i >= 0; i--) {
        const lob = list[i];
        const idx = lob.players.findIndex(p => p.socketId === socketId);
        if (idx >= 0) {
          lob.players.splice(idx, 1);
          broadcastLobbyState(lob);
        }
        if (!lob.started && lob.players.length === 0) {
          if (lob.timer) clearTimeout(lob.timer);
          list.splice(i, 1);
        }
      }
    }
  }

  io.on('connection', (socket) => {
    socket.on('mm:queue', ({ game, userId, username }) => {
      if (!game) return;
      const lob = findOrCreateLobby(game);
      if (!lob.players.find(p => p.socketId === socket.id)) {
        lob.players.push({ socketId: socket.id, user: { userId, username } });
      }
      broadcastLobbyState(lob);

      const C = cfg(game);
      if (lob.players.length >= C.size) startLobby(lob);
      else socket.emit('mm:queued');
    });

    socket.on('mm:leave', ({ roomId }) => {
      removeFromWaiting(socket.id);
      if (roomId && rooms.has(roomId)) {
        const r = rooms.get(roomId);
        if (r.sockets.has(socket.id)) {
          io.to(roomId).emit('mm:ended', { reason: 'opponent_left' });
          io.socketsLeave(roomId);
          rooms.delete(roomId);
        }
      }
      socket.emit('mm:left');
    });

    socket.on('mm:relay', ({ roomId, type, payload }) => {
      if (!roomId) return;
      io.to(roomId).emit('mm:msg', { from: socket.id, type, payload });
    });

    socket.on('disconnect', () => {
      removeFromWaiting(socket.id);
      for (const [rid, r] of rooms.entries()) {
        if (r.sockets.has(socket.id)) {
          io.to(rid).emit('mm:msg', { from: socket.id, type: 'player:dc', payload: {} });
          r.sockets.delete(socket.id);
          if (r.sockets.size === 0) rooms.delete(rid);
        }
      }
    });
  });
};
