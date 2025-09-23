// server/realtime/shogi.js
module.exports = function attachShogi(io) {
  const waiting = [];
  const rooms = new Map();
  const mkRoom = () => 'shogi_' + Math.random().toString(36).slice(2, 10);

  const H=9,W=9;
  const inB = (x,y)=>x>=0&&x<W&&y>=0&&y<H;
  const colorOf = (pc)=> pc ? pc[0] : null;
  const typeOf  = (pc)=> pc ? pc[1] : null;

  function startBoard() {
    const e = Array.from({ length: H }, () => Array(W).fill(''));
    const top = ['wL','wN','wS','wG','wK','wG','wS','wN','wL'];
    const bot = ['bL','bN','bS','bG','bK','bG','bS','bN','bL'];
    e[0] = top.slice(); e[1][1]='wR'; e[1][7]='wB'; for(let i=0;i<9;i++) e[2][i]='wP';
    for(let i=0;i<9;i++) e[6][i]='bP'; e[7][1]='bB'; e[7][7]='bR'; e[8] = bot.slice();
    return e;
  }
  const rays = (b,x,y,side,dirs)=>{
    const mv=[];
    for (const [dx,dy] of dirs) {
      let nx=x+dx, ny=y+dy;
      while(inB(nx,ny)) {
        const p=b[ny][nx];
        if(!p) mv.push([nx,ny]);
        else { if (colorOf(p)!==side) mv.push([nx,ny]); break; }
        nx+=dx; ny+=dy;
      }
    }
    return mv;
  };
  const steps = (b,x,y,side,dirs)=>{
    const mv=[];
    for (const [dx,dy] of dirs) {
      const nx=x+dx, ny=y+dy;
      if(!inB(nx,ny)) continue;
      const p=b[ny][nx];
      if(!p || colorOf(p)!==side) mv.push([nx,ny]);
    }
    return mv;
  };
  const genMoves = (b,x,y)=>{
    const pc=b[y][x]; if(!pc) return [];
    const side=colorOf(pc), t=typeOf(pc);
    const f = side==='b' ? -1 : 1;
    switch(t){
      case 'K': return steps(b,x,y,side, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]);
      case 'R': return rays (b,x,y,side, [[1,0],[-1,0],[0,1],[0,-1]]);
      case 'B': return rays (b,x,y,side, [[1,1],[-1,1],[1,-1],[-1,-1]]);
      case 'G': return steps(b,x,y,side, [[1,0],[-1,0],[0,1],[0,-1],[1,f],[-1,f]]);
      case 'S': return steps(b,x,y,side, [[0,f],[1,f],[-1,f],[1,-f],[-1,-f]]);
      case 'N': return steps(b,x,y,side, [[1,2*f],[-1,2*f]]);
      case 'L': return rays (b,x,y,side, [[0,f]]);
      case 'P': return steps(b,x,y,side, [[0,f]]);
      default: return [];
    }
  };
  const packState = (state)=>({ board: state.board, turn: state.turn });

  io.on('connection', (socket) => {
    socket.on('shogi:queue', ({ userId, username }) => {
      waiting.push({ socketId: socket.id, user: { userId, username } });
      socket.emit('shogi:queued');

      if (waiting.length >= 2) {
        const a = waiting.shift(), b = waiting.shift();
        const roomId = mkRoom();

        const black = Math.random() < 0.5 ? a : b;
        const white = black === a ? b : a;

        const state = { board: startBoard(), turn: 'b' };
        const room = { id: roomId, state, players: { b:{ socketId:black.socketId, user:black.user }, w:{ socketId:white.socketId, user:white.user } } };
        rooms.set(roomId, room);

        io.in(black.socketId).socketsJoin(roomId);
        io.in(white.socketId).socketsJoin(roomId);

        const payload = { roomId, state: packState(state), black: room.players.b.user, white: room.players.w.user };
        io.to(black.socketId).emit('shogi:start', { ...payload, color:'b' });
        io.to(white.socketId).emit('shogi:start', { ...payload, color:'w' });
      }
    });

    socket.on('shogi:move', ({ roomId, move }) => {
      const room = rooms.get(roomId); if (!room) return;
      const { state, players } = room;
      const side = (players.b.socketId === socket.id) ? 'b' : (players.w.socketId === socket.id ? 'w' : null);
      if (!side || state.turn !== side) return;

      const { x,y,nx,ny } = move || {};
      if (!inB(x,y)||!inB(nx,ny)) return;
      const pc = state.board[y][x];
      if (!pc || colorOf(pc)!==side) return;
      const legal = genMoves(state.board, x, y).some(([tx,ty])=>tx===nx&&ty===ny);
      if (!legal) return;

      const to = state.board[ny][nx];
      state.board[ny][nx] = pc;
      state.board[y][x] = '';
      if (typeOf(to) === 'K') {
        const winner = side==='b' ? 'Black' : 'White';
        io.to(roomId).emit('shogi:gameover', { result: `${winner} wins`, reason: 'king captured' });
        rooms.delete(roomId);
        return;
      }
      state.turn = side==='b' ? 'w' : 'b';
      io.to(roomId).emit('shogi:state', { state: packState(state) });
    });

    socket.on('shogi:resign', ({ roomId }) => {
      const room = rooms.get(roomId); if (!room) return;
      const loser = (room.players.b.socketId === socket.id) ? 'Black' : 'White';
      const winner = loser === 'Black' ? 'White' : 'Black';
      io.to(roomId).emit('shogi:gameover', { result: `${winner} wins`, reason: 'resign' });
      rooms.delete(roomId);
    });

    socket.on('shogi:leave', ({ roomId }) => {
      const room = rooms.get(roomId); if (!room) return;
      const loser = (room.players.b.socketId === socket.id) ? 'Black' : 'White';
      const winner = loser === 'Black' ? 'White' : 'Black';
      io.to(roomId).emit('shogi:gameover', { result: `${winner} wins`, reason: 'leave' });
      rooms.delete(roomId);
    });

    socket.on('disconnect', () => {
      const qi = waiting.findIndex(w => w.socketId === socket.id);
      if (qi >= 0) waiting.splice(qi, 1);

      for (const [rid, room] of rooms.entries()) {
        if (room.players.b.socketId === socket.id || room.players.w.socketId === socket.id) {
          const loser = (room.players.b.socketId === socket.id) ? 'Black' : 'White';
          const winner = loser === 'Black' ? 'White' : 'Black';
          io.to(rid).emit('shogi:gameover', { result: `${winner} wins`, reason: 'disconnect' });
          rooms.delete(rid);
        }
      }
    });
  });
};
