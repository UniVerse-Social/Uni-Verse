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

  function legalMovesFor(B, r, c) {
    const p = B[r][c];
    if (!p) return [];
    const col = colorOf(p);
    const dirs = isKing(p) ? [[-1,-1],[-1,1],[1,-1],[1,1]] : (col === 'w' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]);
    const moves = [];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr,nc)) continue;
      if ((nr + nc) % 2 !== 1) continue;
      if (B[nr][nc] === EMPTY) moves.push({ from:[r,c], to:[nr,nc], capture:null });
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
    if(!any) return true;
    return allMoves(B,color).length===0;
  }
  const packState = (state, room) => ({
    board: state.board,
    turn: state.turn,
    lockFrom: state.lockFrom||null,
    lastMove: state.lastMove||null,
    white: room.players.w.user,
    black: room.players.b.user,
  });

  io.on('connection', (socket) => {
    let roomJoined = null;
    // small server-side log helps verify both clients hit the same backend
    // console.log('[checkers] socket connected', socket.id);

    socket.on('checkers:queue', ({ userId, username }) => {
      if (!userId) userId = socket.id;
      // prevent duplicates
      if (waiting.find(w => w.socketId === socket.id)) {
        socket.emit('checkers:queued');
        return;
      }
      waiting.push({ socketId: socket.id, user: { userId, username } });
      socket.emit('checkers:queued');

      // Pair if we have two or more
      if (waiting.length >= 2) {
        const a = waiting.shift();
        const b = waiting.shift();
        const roomId = mkRoom();

        const white = Math.random() < 0.5 ? a : b;
        const black = white === a ? b : a;

        const state = { board: initialBoard(), turn: 'w', lockFrom: null, lastMove: null };
        const room = {
          id: roomId,
          state,
          players: { w: { socketId: white.socketId, user: white.user }, b: { socketId: black.socketId, user: black.user } },
        };
        rooms.set(roomId, room);

        // This line works even if we can't access the Socket instance directly.
        io.in(white.socketId).socketsJoin(roomId);
        io.in(black.socketId).socketsJoin(roomId);
        roomJoined = roomId;

        const payload = {
          roomId,
          state: packState(state, room),
          white: room.players.w.user,
          black: room.players.b.user,
        };

        io.to(white.socketId).emit('checkers:start', { ...payload, color: 'w' });
        io.to(black.socketId).emit('checkers:start', { ...payload, color: 'b' });
        // console.log('[checkers] match started', roomId, payload.white.username, 'vs', payload.black.username);
      }
    });

    socket.on('checkers:move', ({ roomId, move, chain }) => {
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

      const same = (a,b)=>a&&b&&a[0]===b[0]&&a[1]===b[1];
      const legal = legals.find(m =>
        same(m.from, move.from) && same(m.to, move.to) &&
        ((m.capture && move.capture && same(m.capture, move.capture)) || (!m.capture && !move.capture))
      );
      if (!legal) return;

      const res = applyMove(state.board, legal);
      state.board = res.board;
      state.lastMove = legal;

      let keepTurn = !!chain && !!legal.capture && !res.justPromoted;
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

      io.to(roomId).emit('checkers:state', { state: packState(state, room) });

      const opp = state.turn;
      if (noMovesOrPieces(state.board, opp)) {
        const winner = opp === 'w' ? 'Black' : 'White';
        io.to(roomId).emit('checkers:gameover', { result: `${winner} wins`, reason: 'no moves' });
        rooms.delete(roomId);
      }
    });

    socket.on('checkers:resign', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const loser = (room.players.w.socketId === socket.id) ? 'White' : 'Black';
      const winner = loser === 'White' ? 'Black' : 'White';
      io.to(roomId).emit('checkers:gameover', { result: `${winner} wins`, reason: 'resign' });
      rooms.delete(roomId);
    });

    socket.on('checkers:leave', ({ roomId }) => {
      const qi = waiting.findIndex(w => w.socketId === socket.id);
      if (qi >= 0) {
        waiting.splice(qi, 1);
        socket.emit('checkers:queue-cancelled');
      }
      const room = rooms.get(roomId);
      if (room) {
        const loser = (room.players.w.socketId === socket.id) ? 'White' : 'Black';
        const winner = loser === 'White' ? 'Black' : 'White';
        io.to(roomId).emit('checkers:gameover', { result: `${winner} wins`, reason: 'leave' });
        rooms.delete(roomId);
      }
    });

    socket.on('disconnect', () => {
      const qi = waiting.findIndex(w => w.socketId === socket.id);
      if (qi >= 0) waiting.splice(qi, 1);

      for (const [rid, room] of rooms.entries()) {
        if (room.players.w.socketId === socket.id || room.players.b.socketId === socket.id) {
          const loser = (room.players.w.socketId === socket.id) ? 'White' : 'Black';
          const winner = loser === 'White' ? 'Black' : 'White';
          io.to(rid).emit('checkers:gameover', { result: `${winner} wins`, reason: 'disconnect' });
          rooms.delete(rid);
        }
      }
    });
  });
};
