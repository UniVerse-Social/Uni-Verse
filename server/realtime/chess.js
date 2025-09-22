// server/realtime/chess.js
const { Chess } = require('chess.js');

module.exports = function attachChess(io) {
  const waiting = []; // [{ socketId, user }]
  const games = new Map(); // roomId -> { chess, whiteId, blackId, whiteUser, blackUser }
  const mkRoom = () => 'chess_' + Math.random().toString(36).slice(2, 10);

  // ---- helpers to tolerate old/new chess.js method names
  const call = (obj, modern, legacy) =>
    (typeof obj[modern] === 'function') ? obj[modern]() :
    (typeof obj[legacy] === 'function') ? obj[legacy]() : false;

  const isOver   = ch => call(ch, 'isGameOver', 'game_over');
  const isMate   = ch => call(ch, 'isCheckmate', 'in_checkmate');
  const isStale  = ch => call(ch, 'isStalemate', 'in_stalemate');
  const is3x     = ch => call(ch, 'isThreefoldRepetition', 'in_threefold_repetition');
  const isInsuf  = ch => call(ch, 'isInsufficientMaterial', 'insufficient_material');
  const isDraw   = ch => call(ch, 'isDraw', 'in_draw');

  io.on('connection', (socket) => {
    let roomJoined = null;

    // ---------------- Queue / Match ----------------
    socket.on('chess:queue', ({ userId, username }) => {
      if (!userId) userId = socket.id;

      if (waiting.find(w => w.socketId === socket.id)) {
        socket.emit('chess:queued');
        return;
      }
      waiting.push({ socketId: socket.id, user: { userId, username } });
      socket.emit('chess:queued');

      if (waiting.length >= 2) {
        const a = waiting.shift();
        const b = waiting.shift();
        const roomId = mkRoom();
        const chess = new Chess();

        // randomize colors (like checkers)
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

        const whiteSock = io.sockets.sockets.get(white.socketId);
        const blackSock = io.sockets.sockets.get(black.socketId);
        if (!whiteSock || !blackSock) { games.delete(roomId); return; }

        whiteSock.join(roomId);
        blackSock.join(roomId);

        // remember for fast cleanup on THIS socket; other socket will handle itself
        if (whiteSock.id === socket.id) roomJoined = roomId;
        if (blackSock.id === socket.id) roomJoined = roomId;

        const payload = {
          roomId,
          fen: chess.fen(),
          white: white.user,
          black: black.user,
        };
        whiteSock.emit('chess:start', { ...payload, color: 'w' });
        blackSock.emit('chess:start', { ...payload, color: 'b' });
      }
    });

    // ---------------- Moves ----------------
    socket.on('chess:move', ({ roomId, from, to, promotion }) => {
      try {
        const game = games.get(roomId);
        if (!game) return;

        const isWhite = socket.id === game.whiteId;
        const myTurn =
          (game.chess.turn() === 'w' && isWhite) ||
          (game.chess.turn() === 'b' && !isWhite);
        if (!myTurn) return;

        const mv = game.chess.move({ from, to, promotion: promotion || 'q' });
        if (!mv) return;

        io.to(roomId).emit('chess:state', { fen: game.chess.fen() });

        if (isOver(game.chess)) {
          const result = isMate(game.chess)
            ? (game.chess.turn() === 'w' ? 'Black wins' : 'White wins')
            : 'Draw';
          const reason = isMate(game.chess) ? 'checkmate'
            : isStale(game.chess) ? 'stalemate'
            : is3x(game.chess) ? 'threefold repetition'
            : isInsuf(game.chess) ? 'insufficient material'
            : isDraw(game.chess) ? 'draw'
            : 'game over';

          io.to(roomId).emit('chess:gameover', { result, reason });
          games.delete(roomId);
        }
      } catch (err) {
        // never crash the process; report and end the game gracefully
        console.warn('chess:move error', err?.message || err);
        if (roomId && games.has(roomId)) {
          io.to(roomId).emit('chess:gameover', { result: 'Draw', reason: 'server error' });
          games.delete(roomId);
        }
      }
    });

    // ---------------- Resign / Leave ----------------
    socket.on('chess:resign', ({ roomId }) => {
      const game = games.get(roomId);
      if (!game) return;
      const resigningWhite = socket.id === game.whiteId;
      io.to(roomId).emit('chess:gameover', {
        result: resigningWhite ? 'Black wins' : 'White wins',
        reason: 'resignation',
      });
      games.delete(roomId);
    });

    socket.on('chess:leave', ({ roomId }) => {
      const qi = waiting.findIndex(w => w.socketId === socket.id);
      if (qi >= 0) {
        waiting.splice(qi, 1);
        socket.emit('chess:queue-cancelled');
      }
      if (roomId && games.has(roomId)) {
        const g = games.get(roomId);
        const result = socket.id === g.whiteId ? 'Black wins' : 'White wins';
        io.to(roomId).emit('chess:gameover', { result, reason: 'opponent left' });
        games.delete(roomId);
      }
    });

    // ---------------- Disconnect cleanup ----------------
    socket.on('disconnect', () => {
      const qi = waiting.findIndex(w => w.socketId === socket.id);
      if (qi >= 0) waiting.splice(qi, 1);

      if (roomJoined && games.has(roomJoined)) {
        const g = games.get(roomJoined);
        const result = socket.id === g.whiteId ? 'Black wins' : 'White wins';
        io.to(roomJoined).emit('chess:gameover', { result, reason: 'opponent disconnected' });
        games.delete(roomJoined);
      } else {
        for (const [rid, g] of games.entries()) {
          if (g.whiteId === socket.id || g.blackId === socket.id) {
            const result = socket.id === g.whiteId ? 'Black wins' : 'White wins';
            io.to(rid).emit('chess:gameover', { result, reason: 'opponent disconnected' });
            games.delete(rid);
          }
        }
      }
    });
  });
};
