// server/realtime/fishing.js

module.exports = function attachFishing(io) {
  // --- Global state ---
  const waiting = [];                 // [{ socketId, user: { userId, username } }]
  const rooms = new Map();            // roomId -> room
  const socketRoom = new Map();       // socketId -> active roomId
  const socketQueued = new Set();     // socketIds currently queued
  const socketIntent = new Map();     // socketId -> "idle" | "queued" | "playing" | "starting"

  const mkRoom = () => 'fishing_' + Math.random().toString(36).slice(2, 10);

  // Fish sizes & required presses
  const SIZES = [
    { name: 'Big',       trophy: 6, chunks: 8 },
    { name: 'Huge',      trophy: 7, chunks: 9 },
    { name: 'Massive',   trophy: 8, chunks: 10 },
    { name: 'Ginormous', trophy: 9, chunks: 11 },
  ];
  const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

  // Anchor constants (600px logical scene width)
  const ANCHOR_L = 62;
  const ANCHOR_R = 600 - 62;
  const FISH_HALF = 36;

  const randIdx = (n) => (Math.random() * n) | 0;
  const nextArrow = (prev) => {
    if (prev && Math.random() < 0.2) return prev;
    let k = ARROWS[(Math.random() * ARROWS.length) | 0];
    if (k === prev) k = ARROWS[(ARROWS.indexOf(prev) + 1) % ARROWS.length];
    return k;
  };

  const pack = (r) => ({
    roomId: r.id,
    match: r.match,           // 'countdown' | 'live' | 'over'
    countdown: r.countdown,   // 3..0
    timeLeft: r.timeLeft,     // 60..0
    score: { L: r.score.L, R: r.score.R },
    sizeIdxL: r.sizeIdxL,
    sizeIdxR: r.sizeIdxR,
    fishL: { x: r.fishL.x, y: r.fishL.y, dir: r.fishL.dir },
    fishR: { x: r.fishR.x, y: r.fishR.y, dir: r.fishR.dir },
    progress: { L: r.progress.L, R: r.progress.R },
    needL: r.needL,
    needR: r.needR,
  });

  function baseState(id) {
    const dirL = Math.random() < 0.5 ? -1 : 1;
    const dirR = Math.random() < 0.5 ? -1 : 1;
    const sizeIdxL = (Math.random() * SIZES.length) | 0;
    const sizeIdxR = (Math.random() * SIZES.length) | 0;
    return {
      id,
      match: 'countdown',
      countdown: 3,
      timeLeft: 60,
      sessionEnd: null,

      sizeIdxL,
      sizeIdxR,

      fishL: { x: ANCHOR_L - FISH_HALF, y: 170, dir: dirL },
      fishR: { x: ANCHOR_R - FISH_HALF, y: 170, dir: dirR },

      offL: 0, offR: 0,
      progress: { L: 0, R: 0 },

      needL: nextArrow(null),
      needR: nextArrow(null),

      score: { L: 0, R: 0 },
      bot: false,
      timer: null,
      players: null,

      // handshake
      ready: { L: false, R: false },
      readyTimer: null,

      // bot timing
      nextBotTap: Date.now() + 350,
    };
  }

  function endRoom(roomId, opts = {}) {
    const r = rooms.get(roomId);
    if (!r) return;
    clearInterval(r.timer);
    clearTimeout(r.readyTimer);

    // Clear active-room pointers and intents
    socketRoom.delete(r.players.L.socketId);
    socketRoom.delete(r.players.R.socketId);
    if (socketIntent.get(r.players.L.socketId) !== 'queued') socketIntent.set(r.players.L.socketId, 'idle');
    if (socketIntent.get(r.players.R.socketId) !== 'queued') socketIntent.set(r.players.R.socketId, 'idle');

    if (!opts.silent) {
      if (opts.cancelled) {
        io.to(roomId).emit('fishing:cancelled', { roomId });
      } else {
        let winner = opts.winnerUserId || null;
        if (!winner) {
          if (r.score.L !== r.score.R) {
            winner = r.score.L > r.score.R ? r.players.L.user.userId : r.players.R.user.userId;
          } else {
            winner = Math.random() < 0.5 ? r.players.L.user.userId : r.players.R.user.userId;
          }
        }
        io.to(roomId).emit('fishing:gameover', { roomId, winnerUserId: winner, ranked: !r.bot, score: r.score });
      }
    }

    rooms.delete(roomId);
  }

  function startCountdown(id) {
    const r = rooms.get(id); if (!r) return;
    r.match = 'countdown';
    r.countdown = 3;

    r.timer = setInterval(() => {
      if (!rooms.has(id)) return clearInterval(r.timer);
      r.countdown--;
      io.to(id).emit('fishing:state', pack(r));
      if (r.countdown <= 0) {
        clearInterval(r.timer);
        r.match = 'live';
        r.sessionEnd = Date.now() + 60000;
        startLoop(id);
      }
    }, 1000);

    io.to(id).emit('fishing:state', pack(r));
  }

  function rerollSide(r, side) {
    const isL = side === 'L';
    const idx = (Math.random() * SIZES.length) | 0;
    if (isL) {
      r.sizeIdxL = idx;
      r.progress.L = 0;
      r.needL = nextArrow(null);
      r.offL = 0;
      r.fishL.dir = Math.random() < 0.5 ? -1 : 1;
    } else {
      r.sizeIdxR = idx;
      r.progress.R = 0;
      r.needR = nextArrow(null);
      r.offR = 0;
      r.fishR.dir = Math.random() < 0.5 ? -1 : 1;
    }
  }

  function startLoop(id) {
    const r = rooms.get(id); if (!r) return;

    r.timer = setInterval(() => {
      if (!rooms.has(id)) return clearInterval(r.timer);
      if (r.match !== 'live') return;

      const now = Date.now();
      r.timeLeft = Math.max(0, Math.ceil((r.sessionEnd - now) / 1000));

      const sizeL = SIZES[r.sizeIdxL];
      const sizeR = SIZES[r.sizeIdxR];

      // wiggle
      const SPD = 0.9, AMP = 10;
      r.offL += r.fishL.dir * SPD;
      r.offR += r.fishR.dir * SPD;
      if (r.offL > AMP)  { r.offL = AMP;  r.fishL.dir = -1; }
      if (r.offL < -AMP) { r.offL = -AMP; r.fishL.dir =  1; }
      if (r.offR > AMP)  { r.offR = AMP;  r.fishR.dir = -1; }
      if (r.offR < -AMP) { r.offR = -AMP; r.fishR.dir =  1; }

      // approach shore as progress increases
      const yBase = 160, yDockish = 260;
      r.fishL.y = yBase + (r.progress.L / sizeL.chunks) * (yDockish - yBase);
      r.fishR.y = yBase + (r.progress.R / sizeR.chunks) * (yDockish - yBase);
      r.fishL.x = (ANCHOR_L - FISH_HALF) + r.offL;
      r.fishR.x = (ANCHOR_R - FISH_HALF) + r.offR;

      // bot sim
      if (r.bot && now >= r.nextBotTap) {
        const right = Math.random() < 0.7;
        if (right) {
          r.progress.R = Math.min(sizeR.chunks, r.progress.R + 1);
          if (r.progress.R < sizeR.chunks) r.needR = nextArrow(r.needR);
        } else {
          r.progress.R = Math.max(0, r.progress.R - 1);
        }
        r.nextBotTap = now + 250 + (Math.random() * 220 | 0);
      }

      // catches
      const gotL = r.progress.L >= sizeL.chunks;
      const gotR = r.progress.R >= sizeR.chunks;
      if (gotL) { r.score.L++; rerollSide(r, 'L'); }
      if (gotR) { r.score.R++; rerollSide(r, 'R'); }

      if (r.timeLeft <= 0) { endRoom(id); return; }

      io.to(id).emit('fishing:state', pack(r));
    }, 100);
  }

  // --- Matchmaking helpers ---
  function dequeue(socketId) {
    const i = waiting.findIndex(w => w.socketId === socketId);
    if (i !== -1) waiting.splice(i, 1);
    socketQueued.delete(socketId);
    if (socketIntent.get(socketId) === 'queued') socketIntent.set(socketId, 'idle');
  }

  function teardownActiveIfAny(socket, silent = true) {
    // Leave queue if present
    dequeue(socket.id);

    // End room if present
    const active = socketRoom.get(socket.id);
    if (!active) return;
    const r = rooms.get(active);
    if (r) {
      const opp = (r.players.L.socketId === socket.id) ? r.players.R : r.players.L;
      endRoom(active, { silent, winnerUserId: opp.user.userId });
    } else {
      socketRoom.delete(socket.id);
    }
  }

  function pairIfPossible() {
    while (waiting.length >= 2) {
      const a = waiting.shift();
      const b = waiting.shift();
      if (!socketQueued.has(a.socketId) || !socketQueued.has(b.socketId)) {
        if (socketQueued.has(a.socketId)) waiting.unshift(a);
        if (socketQueued.has(b.socketId)) waiting.unshift(b);
        break;
      }
      socketQueued.delete(a.socketId);
      socketQueued.delete(b.socketId);

      const roomId = mkRoom();
      const st = baseState(roomId);
      const L = Math.random() < 0.5 ? a : b;
      const R = L === a ? b : a;

      rooms.set(roomId, { ...st, players: { L, R }, bot: false });
      socketRoom.set(L.socketId, roomId);
      socketRoom.set(R.socketId, roomId);
      socketIntent.set(L.socketId, 'starting');
      socketIntent.set(R.socketId, 'starting');

      const Lsock = io.sockets.sockets.get(L.socketId);
      const Rsock = io.sockets.sockets.get(R.socketId);
      if (!Lsock || !Rsock) {
        if (Lsock) { socketRoom.delete(L.socketId); socketIntent.set(L.socketId, 'queued'); waiting.unshift(a); socketQueued.add(L.socketId); }
        if (Rsock) { socketRoom.delete(R.socketId); socketIntent.set(R.socketId, 'queued'); waiting.unshift(b); socketQueued.add(R.socketId); }
        rooms.delete(roomId);
        continue;
      }

      Lsock.join(roomId);
      Rsock.join(roomId);

      // Send initial state but don't start countdown yet; wait for both to say "ready"
      Lsock.emit('fishing:start', { roomId, side: 'L', you: L.user, opp: R.user, state: pack(rooms.get(roomId)), ranked: true });
      Rsock.emit('fishing:start', { roomId, side: 'R', you: R.user, opp: L.user, state: pack(rooms.get(roomId)), ranked: true });

      const r = rooms.get(roomId);
      r.ready = { L: false, R: false };
      r.readyTimer = setTimeout(() => {
        const room = rooms.get(roomId);
        if (!room) return;
        const Lready = room.ready.L, Rready = room.ready.R;
        if (Lready && !Rready) {
          const Lsock2 = io.sockets.sockets.get(room.players.L.socketId);
          if (Lsock2) {
            socketIntent.set(room.players.L.socketId, 'queued');
            waiting.unshift(room.players.L);
            socketQueued.add(room.players.L.socketId);
            Lsock2.emit('fishing:queued');
          }
          endRoom(roomId, { cancelled: true });
          pairIfPossible();
        } else if (!Lready && Rready) {
          const Rsock2 = io.sockets.sockets.get(room.players.R.socketId);
          if (Rsock2) {
            socketIntent.set(room.players.R.socketId, 'queued');
            waiting.unshift(room.players.R);
            socketQueued.add(room.players.R.socketId);
            Rsock2.emit('fishing:queued');
          }
          endRoom(roomId, { cancelled: true });
          pairIfPossible();
        } else if (!Lready && !Rready) {
          endRoom(roomId, { silent: true, cancelled: true });
        }
      }, 6000);
    }
  }

  // --- Socket wiring ---
  io.on('connection', (socket) => {
    socketIntent.set(socket.id, 'idle');

    // PRACTICE (never changes trophies)
    socket.on('fishing:practice', ({ userId, username } = {}) => {
      teardownActiveIfAny(socket, true); // cancel queue & end old room silently

      const roomId = mkRoom();
      const st = baseState(roomId);
      const L = { socketId: socket.id, user: { userId, username } };
      const R = { socketId: 'BOT_' + roomId, user: { userId: 'bot', username: 'FisherBot' } };

      rooms.set(roomId, { ...st, players: { L, R }, bot: true, ready: { L: true, R: true } });
      socketRoom.set(socket.id, roomId);
      socketIntent.set(socket.id, 'playing');

      socket.join(roomId);
      socket.emit('fishing:start', { roomId, side: 'L', you: L.user, opp: R.user, state: pack(rooms.get(roomId)), ranked: false });
      startCountdown(roomId);
    });

    // QUEUE (ranked)
    socket.on('fishing:queue', ({ userId, username } = {}) => {
      teardownActiveIfAny(socket, true);
      if (socketQueued.has(socket.id)) {
        socket.emit('fishing:queued');
        return;
      }
      waiting.push({ socketId: socket.id, user: { userId, username } });
      socketQueued.add(socket.id);
      socketIntent.set(socket.id, 'queued');
      socket.emit('fishing:queued');
      pairIfPossible();
    });

    // Client is ready after receiving "start"
    socket.on('fishing:ready', ({ roomId } = {}) => {
      const r = rooms.get(roomId); if (!r) return;
      if (r.players.L.socketId === socket.id) r.ready.L = true;
      if (r.players.R.socketId === socket.id) r.ready.R = true;
      socketIntent.set(socket.id, 'playing');

      if (r.ready.L && r.ready.R && r.match === 'countdown' && !r.timer) {
        clearTimeout(r.readyTimer);
        startCountdown(roomId);
      }
    });

    // Cancel queue explicitly
    socket.on('fishing:leaveQueue', () => {
      dequeue(socket.id);
      socket.emit('fishing:queueLeft');
    });

    // INPUTS
    socket.on('fishing:input', ({ roomId, type, key } = {}) => {
      const r = rooms.get(roomId); if (!r) return;
      const side = r.players.L.socketId === socket.id ? 'L' :
                   (r.players.R.socketId === socket.id ? 'R' : null);
      if (!side || r.match !== 'live') return;

      const size = SIZES[side === 'L' ? r.sizeIdxL : r.sizeIdxR];
      const need = side === 'L' ? r.needL : r.needR;

      if (type === 'tap') {
        if (key === need) {
          if (side === 'L') {
            r.progress.L = Math.min(size.chunks, r.progress.L + 1);
            if (r.progress.L < size.chunks) r.needL = nextArrow(need);
          } else {
            r.progress.R = Math.min(size.chunks, r.progress.R + 1);
            if (r.progress.R < size.chunks) r.needR = nextArrow(need);
          }
        } else {
          if (side === 'L') r.progress.L = Math.max(0, r.progress.L - 1);
          else r.progress.R = Math.max(0, r.progress.R - 1);
        }
      } else if (type === 'tap-wrong') {
        if (side === 'L') r.progress.L = Math.max(0, r.progress.L - 1);
        else r.progress.R = Math.max(0, r.progress.R - 1);
      }
    });

    // LEAVE / RESIGN
    socket.on('fishing:leave', ({ roomId } = {}) => {
      // If queued but not yet in room, just leave queue
      if (!roomId) {
        if (socketQueued.has(socket.id)) {
          dequeue(socket.id);
          socket.emit('fishing:queueLeft');
          return;
        }
        roomId = socketRoom.get(socket.id);
      }
      const r = rooms.get(roomId); if (!r) return;

      if (r.match === 'countdown' && !(r.ready.L && r.ready.R)) {
        // cancel pre-start; requeue the other if still here
        const other = r.players.L.socketId === socket.id ? r.players.R : r.players.L;
        const osock = io.sockets.sockets.get(other.socketId);
        if (osock) {
          socketIntent.set(other.socketId, 'queued');
          waiting.unshift(other);
          socketQueued.add(other.socketId);
          osock.emit('fishing:queued');
          endRoom(roomId, { cancelled: true });
          pairIfPossible();
          return;
        }
      }

      const winner = r.players.L.socketId === socket.id ? r.players.R.user.userId : r.players.L.user.userId;
      endRoom(roomId, { winnerUserId: winner });
    });

    socket.on('disconnect', () => {
      // Drop from queue if needed
      dequeue(socket.id);

      const roomId = socketRoom.get(socket.id);
      if (!roomId) return;
      const r = rooms.get(roomId);
      if (!r) { socketRoom.delete(socket.id); return; }

      if (r.match === 'countdown' && !(r.ready.L && r.ready.R)) {
        const other = r.players.L.socketId === socket.id ? r.players.R : r.players.L;
        const osock = io.sockets.sockets.get(other.socketId);
        if (osock) {
          socketIntent.set(other.socketId, 'queued');
          waiting.unshift(other);
          socketQueued.add(other.socketId);
          osock.emit('fishing:queued');
          endRoom(roomId, { cancelled: true });
          pairIfPossible();
          return;
        }
      }

      const winner = r.players.L.socketId === socket.id ? r.players.R.user.userId : r.players.L.user.userId;
      endRoom(roomId, { winnerUserId: winner });
    });
  });
};
