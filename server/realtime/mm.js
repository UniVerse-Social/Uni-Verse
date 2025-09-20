// server/realtime/mm.js
const { randomUUID } = require('crypto');

module.exports = function attachGenericMatchmaker(io) {
  // one FIFO queue per game key
  const queues = new Map(); // game -> [{ socketId, user }]
  const rooms  = new Map(); // roomId -> { game, a, b }

  function enqueue(game, socket, user) {
    if (!queues.has(game)) queues.set(game, []);
    const q = queues.get(game);
    q.push({ socketId: socket.id, user });
    tryMatch(game);
  }

  function tryMatch(game) {
    const q = queues.get(game) || [];
    while (q.length >= 2) {
      const A = q.shift();
      const B = q.shift();
      const roomId = randomUUID();
      rooms.set(roomId, { game, a: A.socketId, b: B.socketId });

      const seed = Math.floor(Math.random() * 1e9) >>> 0;

      io.sockets.sockets.get(A.socketId)?.join(roomId);
      io.sockets.sockets.get(B.socketId)?.join(roomId);

      io.to(A.socketId).emit('mm:start', { game, roomId, role: 'A', seed });
      io.to(B.socketId).emit('mm:start', { game, roomId, role: 'B', seed });
    }
  }

  function leaveQueueOrRoom(socket, roomId) {
    // remove from any queues
    for (const q of queues.values()) {
      const i = q.findIndex(x => x.socketId === socket.id);
      if (i >= 0) q.splice(i, 1);
    }
    // leave room
    if (roomId && rooms.has(roomId)) {
      const r = rooms.get(roomId);
      io.to(roomId).emit('mm:ended', { reason: 'opponent_left' });
      io.socketsLeave(roomId);
      rooms.delete(roomId);
    }
  }

  io.on('connection', (socket) => {
    socket.on('mm:queue', ({ game, userId, username }) => {
      if (!game) return;
      enqueue(game, socket, { userId, username });
      socket.emit('mm:queued');
    });

    socket.on('mm:leave', ({ roomId }) => {
      leaveQueueOrRoom(socket, roomId);
      socket.emit('mm:left');
    });

    // simple relay: client -> server -> both players
    socket.on('mm:relay', ({ roomId, type, payload }) => {
      if (!roomId) return;
      io.to(roomId).emit('mm:msg', { from: socket.id, type, payload });
    });

    socket.on('disconnect', () => {
      leaveQueueOrRoom(socket);
    });
  });
};
