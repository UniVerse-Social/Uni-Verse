// server/realtime/jump.js
// High-quality multiplayer “Jump Game” backend:
// - Queue two players, assign top/bottom fairly
// - Build a deterministic course (90s) with jump/roll/bait obstacles
// - Start both clients at a shared startAt epoch so visuals sync
// - Relay lightweight input events for opponent animation
// - Decide winner on crash/finish/leave/resign/disconnect

module.exports = function attachJump(io) {
  const waiting = []; // { socketId, user }
  const rooms = new Map(); // roomId -> { players, seed, startAt, obstacles, results }
  const mkRoom = () => 'jump_' + Math.random().toString(36).slice(2, 10);

  // --- RNG & Course ---
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Build ~90s course: [{t:ms, kind:'jump'|'roll'|'bait'}]
  function buildCourse(seed, durationMs = 90000) {
    const r = mulberry32(seed >>> 0);
    const items = [];
    let t = 2000; // pre-roll buffer
    while (t < durationMs) {
      const p = r();
      const kind = p < 0.45 ? 'jump' : (p < 0.85 ? 'roll' : 'bait'); // ~15% bait
      items.push({ t, kind });
      // base spacing 1.1–2.0s
      t += 1100 + Math.floor(r() * 900);
      // occasional burst (second quick obstacle)
      if (r() < 0.18 && t + 450 < durationMs) {
        items.push({ t: t + 350 + Math.floor(r() * 140), kind: r() < 0.5 ? 'jump' : 'roll' });
        t += 550;
      }
    }
    return items;
  }

  function packStart(room, you) {
    return {
      roomId: room.id,
      startAt: room.startAt,
      seed: room.seed,
      obstacles: room.obstacles,
      top: room.players.top.user,
      bottom: room.players.bottom.user,
      you, // 'top' | 'bottom'
    };
  }

  function conclude(room, winner, reason) {
    // winner: 'top' | 'bottom' | 'draw'
    const result =
      winner === 'top' ? 'Top wins'
      : winner === 'bottom' ? 'Bottom wins'
      : 'Draw';
    io.to(room.id).emit('jump:gameover', { result, reason, winner });
    rooms.delete(room.id);
  }

  io.on('connection', (socket) => {
    // --- Queue two players into a room ---
    socket.on('jump:queue', ({ userId, username }) => {
      waiting.push({ socketId: socket.id, user: { userId, username } });
      socket.emit('jump:queued');

      if (waiting.length >= 2) {
        const a = waiting.shift();
        const b = waiting.shift();
        const roomId = mkRoom();

        // Randomize top/bottom
        const topPick = Math.random() < 0.5 ? a : b;
        const bottomPick = topPick === a ? b : a;

        const seed = Math.floor(Math.random() * 0x7fffffff);
        const obstacles = buildCourse(seed);
        const startAt = Date.now() + 1200; // small countdown

        const room = {
          id: roomId,
          seed,
          startAt,
          obstacles,
          players: {
            top:    { sid: topPick.socketId,    user: topPick.user },
            bottom: { sid: bottomPick.socketId, user: bottomPick.user },
          },
          results: {
            top:    { crashedAt: null, finishedAt: null },
            bottom: { crashedAt: null, finishedAt: null },
          },
        };
        rooms.set(roomId, room);

        // Join private room
        io.in(topPick.socketId).socketsJoin(roomId);
        io.in(bottomPick.socketId).socketsJoin(roomId);

        // Start payloads
        io.to(topPick.socketId).emit('jump:start', packStart(room, 'top'));
        io.to(bottomPick.socketId).emit('jump:start', packStart(room, 'bottom'));
      }
    });

    // --- Relay inputs (for visual sync only) ---
    socket.on('jump:input', ({ roomId, action, at }) => {
      const room = rooms.get(roomId); if (!room) return;
      const side =
        room.players.top.sid === socket.id ? 'top' :
        room.players.bottom.sid === socket.id ? 'bottom' : null;
      if (!side) return;
      socket.to(roomId).emit('jump:input', { side, action, at: at || Date.now() });
    });

    // --- Outcome reports ---
    socket.on('jump:crash', ({ roomId, t }) => {
      const room = rooms.get(roomId); if (!room) return;
      const side =
        room.players.top.sid === socket.id ? 'top' :
        room.players.bottom.sid === socket.id ? 'bottom' : null;
      if (!side) return;

      const r = room.results[side];
      if (r.crashedAt != null || r.finishedAt != null) return;
      r.crashedAt = typeof t === 'number' ? t : (Date.now() - room.startAt);

      const ot = side === 'top' ? 'bottom' : 'top';
      const oRes = room.results[ot];

      // If opponent already ended, decide winner
      if (oRes.crashedAt != null || oRes.finishedAt != null) {
        if (oRes.finishedAt != null) { conclude(room, ot, 'opponent finished'); return; }
        // both crashed -> later crash survives longer
        const dt = r.crashedAt - oRes.crashedAt;
        if (Math.abs(dt) <= 150) conclude(room, 'draw', 'simultaneous crash');
        else conclude(room, dt > 0 ? side : ot, 'longer survival');
      }
    });

    socket.on('jump:finish', ({ roomId, t }) => {
      const room = rooms.get(roomId); if (!room) return;
      const side =
        room.players.top.sid === socket.id ? 'top' :
        room.players.bottom.sid === socket.id ? 'bottom' : null;
      if (!side) return;

      const r = room.results[side];
      if (r.crashedAt != null || r.finishedAt != null) return;
      r.finishedAt = typeof t === 'number' ? t : (Date.now() - room.startAt);

      const ot = side === 'top' ? 'bottom' : 'top';
      const oRes = room.results[ot];

      if (oRes.finishedAt != null) {
        conclude(room, r.finishedAt <= oRes.finishedAt ? side : ot, 'both finished');
      } else if (oRes.crashedAt != null) {
        conclude(room, side, 'opponent crashed');
      } else {
        // Timeout safeguard if opponent becomes unresponsive
        setTimeout(() => {
          const still = rooms.get(room.id);
          if (!still) return;
          const o2 = still.results[ot];
          if (o2.finishedAt == null && o2.crashedAt == null) {
            conclude(still, side, 'opponent timeout');
          }
        }, 3000);
      }
    });

    // --- Leave / Resign ---
    socket.on('jump:leave', ({ roomId }) => {
      const room = rooms.get(roomId); if (!room) return;
      const loser = (room.players.top.sid === socket.id) ? 'top' : 'bottom';
      const winner = loser === 'top' ? 'bottom' : 'top';
      conclude(room, winner, 'leave');
    });

    socket.on('jump:resign', ({ roomId }) => {
      const room = rooms.get(roomId); if (!room) return;
      const loser = (room.players.top.sid === socket.id) ? 'top' : 'bottom';
      const winner = loser === 'top' ? 'bottom' : 'top';
      conclude(room, winner, 'resign');
    });

    // --- Disconnect cleanup ---
    socket.on('disconnect', () => {
      // Remove from queue if waiting
      const qi = waiting.findIndex((w) => w.socketId === socket.id);
      if (qi >= 0) waiting.splice(qi, 1);

      // If in a room, the other wins
      for (const [rid, room] of rooms.entries()) {
        if (room.players.top.sid === socket.id || room.players.bottom.sid === socket.id) {
          const loser = (room.players.top.sid === socket.id) ? 'top' : 'bottom';
          const winner = loser === 'top' ? 'bottom' : 'top';
          conclude(room, winner, 'disconnect');
        }
      }
    });
  });
};
