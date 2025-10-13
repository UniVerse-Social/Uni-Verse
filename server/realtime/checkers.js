// server/realtime/checkers.js
module.exports = function attachCheckers(io) {
  const waiting = []; // [{ socketId, user }]
  const rooms = new Map(); // roomId -> { state, players:{w:{socketId,user}, b:{socketId,user}} }
  const mkRoom = () => 'checkers_' + Math.random().toString(36).slice(2, 10);

  const EMPTY = null;
  const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const isKing = (p) => p === 'W' || p === 'B';
  const colorOf = (p) => (p === 'w' || p === 'W') ? 'w' : (p === 'b' || p === 'B') ? 'b' : null;
  const clone = (B) => B.map(row => row.slice());

  function initialBoard() {
    const B = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) B[r][c] = 'b';
    for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) B[r][c] = 'w';
    return B;
  }

  function packState(state) {
    return {
      board: state.board,
      turn: state.turn,
      lockFrom: state.lockFrom,
    };
  }

  function legalMovesFor(B, r, c) {
    const p = B[r][c];
    if (!p) return [];
    const col = colorOf(p);
    const king = (p === 'W' || p === 'B');

    const dirs = [];
    if (king || col === 'w') dirs.push([-1, -1], [-1, 1]);
    if (king || col === 'b') dirs.push([1, -1], [1, 1]);

    const moves = [];
    for (const [dr, dc] of dirs) {
      const r2 = r + dr, c2 = c + dc;
      if (!inBounds(r2, c2)) continue;
      if ((r2 + c2) % 2 !== 1) continue;
      if (B[r2][c2] === EMPTY) moves.push({ from:[r,c], to:[r2,c2] });
    }
    for (const [dr, dc] of dirs) {
      const mr = r + dr, mc = c + dc;
      const lr = r + 2*dr, lc = c + 2*dc;
      if (!inBounds(mr,mc) || !inBounds(lr,lc)) continue;
      if ((lr + lc) % 2 !== 1) continue;
      const mid = B[mr][mc];
      if (mid && colorOf(mid) !== col && B[lr][lc] === EMPTY) {
        moves.push({ from:[r,c], to:[lr,lc], capture:[mr,mc] });
      }
    }
    return moves;
  }
  const captureMovesFor = (B,r,c)=>legalMovesFor(B,r,c).filter(m=>!!m.capture);
  function allMoves(B, color) {
    const mm = [];
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      const p=B[r][c]; if (!p || colorOf(p)!==color) continue;
      mm.push(...legalMovesFor(B,r,c));
    }
    return mm;
  }
  function applyMove(B, move) {
    const b=clone(B);
    const [r1,c1]=move.from; const [r2,c2]=move.to;
    const piece=b[r1][c1]; b[r1][c1]=EMPTY;
    if (move.capture) { const [mr,mc]=move.capture; b[mr][mc]=EMPTY; }
    const promo = (piece==='w'&&r2===0)?'W':(piece==='b'&&r2===7)?'B':null;
    b[r2][c2]=promo||piece;
    return { board:b, to:[r2,c2], justPromoted:!!promo };
  }
  function noMovesOrPieces(B,color){
    let any=false; for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=B[r][c]; if(p&&colorOf(p)===color){any=true;break;}}
    if (!any) return true;
    return allMoves(B,color).length===0;
  }

  io.on('connection', (socket) => {
    let roomJoined = null;

    // ---------- Matchmaking ----------
    socket.on('checkers:queue', ({ userId, username }) => {
      if (waiting.find(w => w.socketId === socket.id)) {
        socket.emit('checkers:queued');
        return;
      }
      waiting.push({ socketId: socket.id, user: { _id: userId, username } });
      socket.emit('checkers:queued');

      if (waiting.length >= 2) {
        const a = waiting.shift();
        const b = waiting.shift();
        const roomId = mkRoom();

        const white = Math.random() < 0.5 ? a : b;
        const black = white === a ? b : a;

        const state = { board: initialBoard(), turn: 'w', lockFrom: null };
        const room = {
          id: roomId,
          state,
          players: { w: { socketId: white.socketId, user: white.user }, b: { socketId: black.socketId, user: black.user } },
        };
        rooms.set(roomId, room);

        const whiteSock = io.sockets.sockets.get(white.socketId);
        const blackSock = io.sockets.sockets.get(black.socketId);
        if (!whiteSock || !blackSock) { rooms.delete(roomId); return; }
        whiteSock.join(roomId);
        blackSock.join(roomId);

        if (whiteSock.id === socket.id) roomJoined = roomId;
        if (blackSock.id === socket.id) roomJoined = roomId;

        const payload = {
          roomId,
          state: packState(state),
          white: room.players.w.user,
          black: room.players.b.user,
        };

        whiteSock.emit('checkers:start', { ...payload, color: 'w' });
        blackSock.emit('checkers:start', { ...payload, color: 'b' });
      }
    });

    // ---------- Moves ----------
    socket.on('checkers:move', ({ roomId, move }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const { state, players } = room;

      const moverColor =
        players.w.socketId === socket.id ? 'w' :
        players.b.socketId === socket.id ? 'b' : null;
      if (!moverColor || moverColor !== state.turn) return;

      const all = allMoves(state.board, state.turn);
      const anyCapture = all.some(m => !!m.capture);

      let legals = all;
      if (state.lockFrom) {
        legals = legals.filter(m => !!m.capture && m.from[0]===state.lockFrom[0] && m.from[1]===state.lockFrom[1]);
      } else if (anyCapture) {
        legals = legals.filter(m => !!m.capture);
      }

      const ok = legals.find(m =>
        m.from[0]===move.from[0] && m.from[1]===move.from[1] &&
        m.to[0]===move.to[0] && m.to[1]===move.to[1] &&
        (!!m.capture)===!!(move.capture) &&
        (!m.capture || (m.capture[0]===move.capture[0] && m.capture[1]===move.capture[1]))
      );
      if (!ok) return;

      const res = applyMove(state.board, move);
      state.board = res.board;

      let keepTurn = !!move.capture && !res.justPromoted;
      if (keepTurn) {
        const fut = captureMovesFor(state.board, res.to[0], res.to[1]);
        if (fut.length) {
          state.turn = moverColor;
          state.lockFrom = res.to;
        } else {
          keepTurn = false;
        }
      }
      if (!keepTurn) {
        state.turn = (state.turn === 'w') ? 'b' : 'w';
        state.lockFrom = null;
      }

      io.to(roomId).emit('checkers:state', { roomId, state: packState(state) });

      const opp = state.turn;
      if (noMovesOrPieces(state.board, opp)) {
        const winner = opp === 'w' ? 'Black' : 'White';
        io.to(roomId).emit('checkers:gameover', { roomId, result: `${winner} wins`, reason: 'no moves' });
        rooms.delete(roomId);
      }
    });

    // ---------- Resign / Leave ----------
    socket.on('checkers:resign', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const loser = (room.players.w.socketId === socket.id) ? 'White' : 'Black';
      const winner = loser === 'White' ? 'Black' : 'White';
      io.to(roomId).emit('checkers:gameover', { roomId, result: `${winner} wins`, reason: 'resign' });
      rooms.delete(roomId);
    });

    socket.on('checkers:leave', ({ roomId }) => {
      const qi = waiting.findIndex(w => w.socketId === socket.id);
      if (qi >= 0) {
        waiting.splice(qi, 1);
        socket.emit('checkers:queue-cancelled');
      }
      const room = roomId && rooms.get(roomId);
      if (room) {
        const loser = (room.players.w.socketId === socket.id) ? 'White' : 'Black';
        const winner = loser === 'White' ? 'Black' : 'White';
        io.to(roomId).emit('checkers:gameover', { roomId, result: `${winner} wins`, reason: 'leave' });
        rooms.delete(roomId);
      }
    });

    // ---------- Disconnect ----------
    socket.on('disconnect', () => {
      const qi = waiting.findIndex(w => w.socketId === socket.id);
      if (qi >= 0) waiting.splice(qi, 1);

      if (roomJoined && rooms.has(roomJoined)) {
        io.to(roomJoined).emit('checkers:gameover', { roomId: roomJoined, result: 'Opponent wins', reason: 'disconnect' });
        rooms.delete(roomJoined);
      } else {
        for (const [rid, room] of rooms.entries()) {
          if (room.players.w.socketId === socket.id || room.players.b.socketId === socket.id) {
            const loser = (room.players.w.socketId === socket.id) ? 'White' : 'Black';
            const winner = loser === 'White' ? 'Black' : 'White';
            io.to(rid).emit('checkers:gameover', { roomId: rid, result: `${winner} wins`, reason: 'disconnect' });
            rooms.delete(rid);
          }
        }
      }
    });
  });
};
