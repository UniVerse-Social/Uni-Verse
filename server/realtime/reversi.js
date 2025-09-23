// server/realtime/reversi.js
module.exports = function attachReversi(io) {
  const waiting = [];
  const rooms = new Map();
  const mkRoom = () => 'reversi_' + Math.random().toString(36).slice(2, 10);

  const SIZE=8;
  const inB = (x,y)=>x>=0&&x<SIZE&&y>=0&&y<SIZE;
  const dirs = [-1,0,1].flatMap(dx=>[-1,0,1].map(dy=>[dx,dy])).filter(([dx,dy])=>dx||dy);

  function initialBoard(){
    const b = Array.from({length:SIZE},()=>Array(SIZE).fill(0));
    b[3][3]=-1; b[4][4]=-1; b[3][4]=1; b[4][3]=1;
    return b;
  }
  const flipsFrom = (b,x,y,turn)=>{
    if (b[y][x]!==0) return [];
    const flips=[];
    for (const [dx,dy] of dirs){
      let nx=x+dx, ny=y+dy; const line=[];
      while (inB(nx,ny) && b[ny][nx]===-turn) { line.push([nx,ny]); nx+=dx; ny+=dy; }
      if (line.length && inB(nx,ny) && b[ny][nx]===turn) flips.push(...line);
    }
    return flips;
  };
  const allMoves = (b,turn)=>{
    const mv=[]; for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++){ const f=flipsFrom(b,x,y,turn); if(f.length) mv.push({x,y,flips:f}); }
    return mv;
  };
  const applyMove = (b,mv,turn)=>{
    const nb = b.map(r=>r.slice());
    nb[mv.y][mv.x]=turn;
    for (const [fx,fy] of mv.flips) nb[fy][fx]=turn;
    return nb;
  };
  const score = (b)=> b.flat().reduce((s,v)=>s+v,0);
  const packState = (state)=>({ board: state.board, turn: state.turn });

  io.on('connection', (socket)=>{
    socket.on('reversi:queue', ({ userId, username })=>{
      waiting.push({ socketId: socket.id, user: { userId, username } });
      socket.emit('reversi:queued');

      if (waiting.length >= 2) {
        const a = waiting.shift(), b = waiting.shift();
        const roomId = mkRoom();
        const black = Math.random() < 0.5 ? a : b;
        const white = black === a ? b : a;

        const state = { board: initialBoard(), turn: 1 };
        const room = { id: roomId, state, players: { b:{socketId:black.socketId, user:black.user}, w:{socketId:white.socketId, user:white.user} } };
        rooms.set(roomId, room);

        io.in(black.socketId).socketsJoin(roomId);
        io.in(white.socketId).socketsJoin(roomId);

        const payload = { roomId, state: packState(state), black: room.players.b.user, white: room.players.w.user };
        io.to(black.socketId).emit('reversi:start', { ...payload, color:'b' });
        io.to(white.socketId).emit('reversi:start', { ...payload, color:'w' });
      }
    });

    socket.on('reversi:move', ({ roomId, x, y })=>{
      const room = rooms.get(roomId); if (!room) return;
      const { state, players } = room;
      const side = (players.b.socketId === socket.id) ? 1 : (players.w.socketId === socket.id ? -1 : null);
      if (!side || state.turn !== side) return;

      const mvs = allMoves(state.board, side);
      const mv = mvs.find(m=>m.x===x && m.y===y);
      if (!mv) return;

      state.board = applyMove(state.board, mv, side);
      state.turn = -side;

      // pass logic: if opponent has no moves but you do, keep turn at you
      const opp = allMoves(state.board, -side);
      const mine = allMoves(state.board, side);
      if (!opp.length && mine.length) state.turn = side;

      io.to(roomId).emit('reversi:state', { state: packState(state) });

      // end?
      if (!opp.length && !mine.length) {
        const s = score(state.board);
        const result = s===0 ? 'Draw' : (s>0 ? 'Black wins' : 'White wins');
        io.to(roomId).emit('reversi:gameover', { result, reason:'no moves' });
        rooms.delete(roomId);
      }
    });

    socket.on('reversi:resign', ({ roomId })=>{
      const room = rooms.get(roomId); if (!room) return;
      const loser = (room.players.b.socketId === socket.id) ? 'Black' : 'White';
      const winner = loser === 'Black' ? 'White' : 'Black';
      io.to(roomId).emit('reversi:gameover', { result: `${winner} wins`, reason: 'resign' });
      rooms.delete(roomId);
    });

    socket.on('reversi:leave', ({ roomId })=>{
      const room = rooms.get(roomId); if (!room) return;
      const loser = (room.players.b.socketId === socket.id) ? 'Black' : 'White';
      const winner = loser === 'Black' ? 'White' : 'Black';
      io.to(roomId).emit('reversi:gameover', { result: `${winner} wins`, reason: 'leave' });
      rooms.delete(roomId);
    });

    socket.on('disconnect', ()=>{
      const qi = waiting.findIndex(w => w.socketId === socket.id);
      if (qi >= 0) waiting.splice(qi, 1);

      for (const [rid, room] of rooms.entries()) {
        if (room.players.b.socketId === socket.id || room.players.w.socketId === socket.id) {
          const loser = (room.players.b.socketId === socket.id) ? 'Black' : 'White';
          const winner = loser === 'Black' ? 'White' : 'Black';
          io.to(rid).emit('reversi:gameover', { result: `${winner} wins`, reason: 'disconnect' });
          rooms.delete(rid);
        }
      }
    });
  });
};
