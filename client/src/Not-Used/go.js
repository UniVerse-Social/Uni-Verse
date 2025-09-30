// server/realtime/go.js
module.exports = function attachGo(io) {
  const waiting = []; // [{ socketId, user }]
  const rooms = new Map(); // roomId -> { state, players:{b:{socketId,user}, w:{socketId,user}} }
  const mkRoom = () => 'go_' + Math.random().toString(36).slice(2, 10);

  const SIZE = 9;
  const clone = (b) => b.map(r => r.slice());
  const inB = (x,y)=>x>=0&&x<SIZE&&y>=0&&y<SIZE;
  const neigh = (x,y)=>[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[x+dx,y+dy]).filter(([nx,ny])=>inB(nx,ny));

  function initialBoard() {
    return Array.from({length:SIZE},()=>Array(SIZE).fill(0)); // 0 empty, 1 black, -1 white
  }
  function groupAndLibs(b, x, y) {
    const color = b[y][x];
    if (!color) return { stones:[], libs:0 };
    const stack=[[x,y]]; const seen=new Set([`${x},${y}`]);
    const stones=[]; let libs=0;
    while(stack.length){
      const [cx,cy]=stack.pop();
      stones.push([cx,cy]);
      for(const [nx,ny] of neigh(cx,cy)){
        if(b[ny][nx]===0) libs++;
        else if(b[ny][nx]===color){
          const k=`${nx},${ny}`; if(!seen.has(k)){ seen.add(k); stack.push([nx,ny]); }
        }
      }
    }
    return {stones, libs};
  }
  function applyPlace(b, x, y, who) {
    if (b[y][x] !== 0) return null;
    const nb = clone(b);
    nb[y][x] = who;
    let captured = 0;
    for (const [nx,ny] of neigh(x,y)) {
      if (nb[ny][nx] === -who) {
        const g = groupAndLibs(nb, nx, ny);
        if (g.libs === 0) { for (const [sx,sy] of g.stones) { nb[sy][sx] = 0; captured++; } }
      }
    }
    const mine = groupAndLibs(nb, x, y);
    if (mine.libs === 0 && captured === 0) return null; // suicide
    return { board: nb, captured };
  }
  const packState = (state) => ({
    board: state.board,
    turn: state.turn, // 1 black, -1 white
    passes: state.passes,
    captures: state.captures,
  });

  io.on('connection', (socket) => {
    /* queue */
    socket.on('go:queue', ({ userId, username }) => {
      waiting.push({ socketId: socket.id, user: { userId, username } });
      socket.emit('go:queued');

      if (waiting.length >= 2) {
        const a = waiting.shift();
        const b = waiting.shift();
        const roomId = mkRoom();

        const black = Math.random() < 0.5 ? a : b;
        const white = black === a ? b : a;

        const state = { board: initialBoard(), turn: 1, passes: 0, captures: { black:0, white:0 } };
        const room = { id: roomId, state, players: { b: { socketId: black.socketId, user: black.user }, w: { socketId: white.socketId, user: white.user } } };
        rooms.set(roomId, room);

        io.in(black.socketId).socketsJoin(roomId);
        io.in(white.socketId).socketsJoin(roomId);

        const payload = { roomId, state: packState(state), black: room.players.b.user, white: room.players.w.user };
        io.to(black.socketId).emit('go:start', { ...payload, color: 'b' });
        io.to(white.socketId).emit('go:start', { ...payload, color: 'w' });
      }
    });

    /* moves */
    socket.on('go:move', ({ roomId, x, y }) => {
      const room = rooms.get(roomId); if (!room) return;
      const { state, players } = room;
      const who = (players.b.socketId === socket.id) ? 1 : (players.w.socketId === socket.id ? -1 : null);
      if (!who || state.turn !== who) return;

      const res = applyPlace(state.board, x, y, who);
      if (!res) return;
      state.board = res.board;
      state.turn = -who;
      state.passes = 0;
      if (who === 1) state.captures.black += res.captured;
      else state.captures.white += res.captured;

      io.to(roomId).emit('go:state', { state: packState(state) });
    });

    socket.on('go:pass', ({ roomId }) => {
      const room = rooms.get(roomId); if (!room) return;
      const { state, players } = room;
      const who = (players.b.socketId === socket.id) ? 1 : (players.w.socketId === socket.id ? -1 : null);
      if (!who || state.turn !== who) return;

      state.passes += 1;
      state.turn = -who;
      io.to(roomId).emit('go:state', { state: packState(state) });

      if (state.passes >= 2) {
        // score: stones + captures
        const flat = state.board.flat();
        const s = flat.reduce((acc,v)=>acc+v,0);
        const total = flat.length;
        const blackStones = ((s+total)/2)|0;
        const whiteStones = total - blackStones;
        const blackScore = blackStones + state.captures.black;
        const whiteScore = whiteStones + state.captures.white;
        let result = 'Draw';
        if (blackScore > whiteScore) result = 'Black wins';
        else if (whiteScore > blackScore) result = 'White wins';
        io.to(roomId).emit('go:gameover', { result, reason: 'passes' });
        rooms.delete(roomId);
      }
    });

    /* resign/leave */
    socket.on('go:resign', ({ roomId }) => {
      const room = rooms.get(roomId); if (!room) return;
      const loser = (room.players.b.socketId === socket.id) ? 'Black' : 'White';
      const winner = loser === 'Black' ? 'White' : 'Black';
      io.to(roomId).emit('go:gameover', { result: `${winner} wins`, reason: 'resign' });
      rooms.delete(roomId);
    });

    socket.on('go:leave', ({ roomId }) => {
      const room = rooms.get(roomId); if (!room) return;
      const loser = (room.players.b.socketId === socket.id) ? 'Black' : 'White';
      const winner = loser === 'Black' ? 'White' : 'Black';
      io.to(roomId).emit('go:gameover', { result: `${winner} wins`, reason: 'leave' });
      rooms.delete(roomId);
    });

    socket.on('disconnect', () => {
      const qi = waiting.findIndex(w => w.socketId === socket.id);
      if (qi >= 0) waiting.splice(qi, 1);

      for (const [rid, room] of rooms.entries()) {
        if (room.players.b.socketId === socket.id || room.players.w.socketId === socket.id) {
          const loser = (room.players.b.socketId === socket.id) ? 'Black' : 'White';
          const winner = loser === 'Black' ? 'White' : 'Black';
          io.to(rid).emit('go:gameover', { result: `${winner} wins`, reason: 'disconnect' });
          rooms.delete(rid);
        }
      }
    });
  });
};
