// server/realtime/jump.js
module.exports = function attachJump(io) {
  const waiting = [];
  const rooms = new Map(); // roomId -> { id, players:{top,bottom}, startAt, seed, lives:{top,bottom} }
  const mkRoom = () => 'jump_' + Math.random().toString(36).slice(2, 10);

  function conclude(room, winner, reason) {
    io.to(room.id).emit('jump:gameover', { winner, reason });
    rooms.delete(room.id);
  }

  io.on('connection', (socket) => {
    socket.on('jump:queue', ({ userId, username }) => {
      waiting.push({ socketId: socket.id, user: { userId, username } });
      socket.emit('jump:queued');

      if (waiting.length >= 2) {
        const a = waiting.shift(), b = waiting.shift();
        const roomId = mkRoom();
        const topPick = Math.random() < 0.5 ? a : b;
        const bottomPick = topPick === a ? b : a;

        const seed = Math.floor(Math.random() * 0x7fffffff);
        const startAt = Date.now() + 1200;

        const room = {
          id: roomId,
          seed,
          startAt,
          players: {
            top:    { sid: topPick.socketId,    user: topPick.user },
            bottom: { sid: bottomPick.socketId, user: bottomPick.user },
          },
          lives: { top: 3, bottom: 3 },
        };
        rooms.set(roomId, room);

        io.in(topPick.socketId).socketsJoin(roomId);
        io.in(bottomPick.socketId).socketsJoin(roomId);

        const payloadTop = { roomId, seed, startAt, you: 'top',    top: room.players.top.user, bottom: room.players.bottom.user, lives: room.lives };
        const payloadBot = { roomId, seed, startAt, you: 'bottom', top: room.players.top.user, bottom: room.players.bottom.user, lives: room.lives };
        io.to(topPick.socketId).emit('jump:start', payloadTop);
        io.to(bottomPick.socketId).emit('jump:start', payloadBot);
      }
    });

    // relay inputs for animation sync only
    socket.on('jump:input', ({ roomId, action, at }) => {
      const room = rooms.get(roomId); if (!room) return;
      const side =
        room.players.top.sid === socket.id ? 'top' :
        room.players.bottom.sid === socket.id ? 'bottom' : null;
      if (!side) return;
      socket.to(roomId).emit('jump:input', { side, action, at: at || Date.now() });
    });

    // life lost
    socket.on('jump:hit', ({ roomId }) => {
      const room = rooms.get(roomId); if (!room) return;
      const side =
        room.players.top.sid === socket.id ? 'top' :
        room.players.bottom.sid === socket.id ? 'bottom' : null;
      if (!side) return;

      if (room.lives[side] <= 0) return;
      room.lives[side] -= 1;
      io.to(room.id).emit('jump:lives', { lives: room.lives });

      if (room.lives[side] <= 0) {
        const winner = side === 'top' ? 'bottom' : 'top';
        conclude(room, winner, 'hearts depleted');
      }
    });

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

    socket.on('disconnect', () => {
      const qi = waiting.findIndex(w => w.socketId === socket.id);
      if (qi >= 0) waiting.splice(qi, 1);

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
