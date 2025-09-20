// server/realtime/chess.js
const { Chess } = require('chess.js');

module.exports = function attachChess(io) {
  const waiting = []; // [{socketId, user}]
  const games = new Map(); // roomId -> { chess, whiteId, blackId, whiteUser, blackUser }

  const mkRoom = () => 'chess_' + Math.random().toString(36).slice(2, 10);

  io.on('connection', (socket) => {
    let roomJoined = null;

    socket.on('chess:queue', ({ userId, username }) => {
      // already queued?
      if (waiting.find(w => w.socketId === socket.id)) return;
      waiting.push({ socketId: socket.id, user: { userId, username } });
      socket.emit('chess:queued');

      // pair if someone else is waiting
      if (waiting.length >= 2) {
        const a = waiting.shift();
        const b = waiting.shift();
        const roomId = mkRoom();
        const chess = new Chess();

        // randomize colors
        const white = Math.random() < 0.5 ? a : b;
        const black = white === a ? b : a;

        const game = {
          chess,
          whiteId: white.socketId,
          blackId: black.socketId,
          whiteUser: white.user,
          blackUser: black.user,
        };
        games.set(roomId, game);

        io.sockets.sockets.get(white.socketId)?.join(roomId);
        io.sockets.sockets.get(black.socketId)?.join(roomId);

        io.to(white.socketId).emit('chess:start', { roomId, color: 'w', fen: chess.fen(), white: white.user, black: black.user });
        io.to(black.socketId).emit('chess:start', { roomId, color: 'b', fen: chess.fen(), white: white.user, black: black.user });

        roomJoined = roomId;
      }
    });

    socket.on('chess:move', ({ roomId, from, to, promotion }) => {
      const game = games.get(roomId);
      if (!game) return;

      const isWhite = socket.id === game.whiteId;
      const myTurn = (game.chess.turn() === 'w' && isWhite) || (game.chess.turn() === 'b' && !isWhite);
      if (!myTurn) return;

      const move = game.chess.move({ from, to, promotion: promotion || 'q' });
      if (!move) return;

      io.to(roomId).emit('chess:state', { fen: game.chess.fen() });

      if (game.chess.game_over()) {
        const result = game.chess.isCheckmate()
          ? (game.chess.turn() === 'w' ? 'Black wins' : 'White wins')
          : 'Draw';
        io.to(roomId).emit('chess:gameover', {
          result,
          reason: game.chess.isCheckmate() ? 'checkmate' :
                  game.chess.isStalemate() ? 'stalemate' :
                  game.chess.isThreefoldRepetition() ? 'threefold repetition' :
                  game.chess.isInsufficientMaterial() ? 'insufficient material' : 'draw',
        });
        games.delete(roomId);
      }
    });

    socket.on('chess:resign', ({ roomId }) => {
      const game = games.get(roomId);
      if (!game) return;
      const resigningWhite = socket.id === game.whiteId;
      const result = resigningWhite ? 'Black wins' : 'White wins';
      io.to(roomId).emit('chess:gameover', { result, reason: 'resignation' });
      games.delete(roomId);
    });

    socket.on('chess:leave', ({ roomId }) => {
      const idx = waiting.findIndex(w => w.socketId === socket.id);
      if (idx >= 0) {
        waiting.splice(idx, 1);
        socket.emit('chess:queue-cancelled');
      }
      if (roomId && games.has(roomId)) {
        const game = games.get(roomId);
        const result = socket.id === game.whiteId ? 'Black wins' : 'White wins';
        io.to(roomId).emit('chess:gameover', { result, reason: 'opponent left' });
        games.delete(roomId);
      }
    });

    socket.on('disconnect', () => {
      // remove from queue
      const qi = waiting.findIndex(w => w.socketId === socket.id);
      if (qi >= 0) waiting.splice(qi, 1);

      // if in a game, end it
      if (roomJoined && games.has(roomJoined)) {
        const game = games.get(roomJoined);
        const result = socket.id === game.whiteId ? 'Black wins' : 'White wins';
        io.to(roomJoined).emit('chess:gameover', { result, reason: 'opponent disconnected' });
        games.delete(roomJoined);
      }
    });
  });
};
