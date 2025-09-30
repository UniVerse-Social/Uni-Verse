// server/realtime/fishing.js
module.exports = function attachFishing(io) {
  const waiting = [];
  const rooms = new Map();
  const mkRoom = () => 'fishing_' + Math.random().toString(36).slice(2,10);
  const SIZES = [
    { name:'Big', trophy:6,  struggle:6000, chunks:8 },
    { name:'Huge', trophy:7, struggle:8000, chunks:9 },
    { name:'Massive', trophy:8, struggle:10000, chunks:10 },
    { name:'Ginormous', trophy:9, struggle:12000, chunks:11 },
  ];
  const ARROWS = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];

  // anchors: x positions directly above the fisher hands (SVG viewBox is 600 wide)
  const ANCHOR_L = 62;     // matches fisher hand used in client (34 + 28)
  const ANCHOR_R = 600-62;
  const FISH_HALF = 36;    // half width of fish svg (72/2)

  const pack = (r)=> ({
    phase:r.phase, sizeIdx:r.sizeIdx,
    fishL:{ x:r.fishL.x, y:r.fishL.y, dir:r.fishL.dir },
    fishR:{ x:r.fishR.x, y:r.fishR.y, dir:r.fishR.dir },
    progress:{L:r.progress.L, R:r.progress.R},
    qteL:r.qteL, qIdxL:r.qIdxL,
    qteR:r.qteR, qIdxR:r.qIdxR
  });

  function baseState() {
    return {
      phase:'waiting',
      sizeIdx:(Math.random()*SIZES.length)|0,
      // start directly above each fisher
      fishL:{ x:ANCHOR_L - FISH_HALF, y:170, dir: Math.random()<0.5?-1:1 },
      fishR:{ x:ANCHOR_R - FISH_HALF, y:170, dir: Math.random()<0.5?-1:1 },
      // small horizontal offsets for subtle wiggle
      offL:0, offR:0,
      progress:{ L:0, R:0 },
      holds:{ L:null, R:null },
      qteL:[], qIdxL:0, qteR:[], qIdxR:0,
      bot:false, timer:null, players:null
    };
  }

  function startLoop(id) {
    const r = rooms.get(id); if (!r) return;
    const size = SIZES[r.sizeIdx];
    let phaseEnd = Date.now() + size.struggle;
    r.phase = 'struggle';

    r.timer = setInterval(() => {
      if (!rooms.has(id)) return clearInterval(r.timer);
      const now = Date.now();

      // move & progress only during struggle (subtle)
      if (r.phase === 'struggle') {
        const needL = r.fishL.dir === 1 ? 'ArrowLeft' : 'ArrowRight';
        const needR = r.fishR.dir === 1 ? 'ArrowLeft' : 'ArrowRight';
        const ok = (side, need) => r.holds[side] === need;
        const decay = 0.0025, gain = 0.0038;
        r.progress.L = Math.max(0, Math.min(size.chunks, r.progress.L + (ok('L',needL)?gain:-decay)));
        r.progress.R = Math.max(0, Math.min(size.chunks, r.progress.R + (ok('R',needR)?gain:-decay)));

        // subtle wiggle around anchor (±10px)
        const SPD = 0.9, AMP = 10;
        r.offL += r.fishL.dir * SPD;
        r.offR += r.fishR.dir * SPD;
        if (r.offL > AMP)  { r.offL = AMP;  r.fishL.dir = -1; }
        if (r.offL < -AMP) { r.offL = -AMP; r.fishL.dir = 1; }
        if (r.offR > AMP)  { r.offR = AMP;  r.fishR.dir = -1; }
        if (r.offR < -AMP) { r.offR = -AMP; r.fishR.dir = 1; }
      } else {
        // reel: bot hits some keys, but fish stay still horizontally
        if (r.bot && r.qIdxR < r.qteR.length) {
          if (Math.random() < 0.68) { r.qIdxR++; r.progress.R = Math.min(size.chunks, r.progress.R + 1); }
          else r.progress.R = Math.max(0, r.progress.R - 1);
        }
      }

      // fish Y gets closer to dock as progress increases
      const yBase = 160, yDockish = 260;
      r.fishL.y = yBase + (r.progress.L / size.chunks) * (yDockish - yBase);
      r.fishR.y = yBase + (r.progress.R / size.chunks) * (yDockish - yBase);

      // keep fish directly above fisherman (anchor + subtle offset)
      r.fishL.x = (ANCHOR_L - FISH_HALF) + r.offL;
      r.fishR.x = (ANCHOR_R - FISH_HALF) + r.offR;

      // phase timing (linked)
      if (now >= phaseEnd) {
        if (r.phase === 'struggle') {
          const len = 4 + (Math.random()*3|0);
          r.qteL = Array.from({length:len}, () => ARROWS[(Math.random()*4)|0]);
          r.qteR = Array.from({length:len}, () => ARROWS[(Math.random()*4)|0]);
          r.qIdxL = 0; r.qIdxR = 0;
          r.phase = 'reel'; phaseEnd = now + 4200;
        } else {
          r.phase = 'struggle'; phaseEnd = now + size.struggle;
        }
      }

      // win?
      const wonL = r.progress.L >= size.chunks;
      const wonR = r.progress.R >= size.chunks;
      if (wonL || wonR) {
        clearInterval(r.timer);
        let winner = null;
        if (wonL && !wonR) winner = r.players.L.user.userId;
        else if (wonR && !wonL) winner = r.players.R.user.userId;
        else winner = Math.random()<0.5 ? r.players.L.user.userId : r.players.R.user.userId;
        io.to(id).emit('fishing:gameover', { winnerUserId: winner, sizeIdx: r.sizeIdx, ranked: !r.bot });
        rooms.delete(id);
      } else {
        io.to(id).emit('fishing:state', pack(r));
      }
    }, 100);
  }

  io.on('connection', (socket) => {
    // practice vs bot
    socket.on('fishing:practice', ({ userId, username }={}) => {
      const roomId = mkRoom();
      const st = baseState();
      const L = { socketId: socket.id, user:{ userId, username } };
      const R = { socketId: 'BOT_'+roomId, user:{ userId:'bot', username:'FisherBot' } };
      rooms.set(roomId, { ...st, players:{L,R}, bot:true });
      socket.join(roomId);
      socket.emit('fishing:start', { roomId, side:'L', you:L.user, opp:R.user, state: pack(rooms.get(roomId)), ranked:false });
      startLoop(roomId);
    });

    // ranked queue (human; fallback to bot)
    socket.on('fishing:queue', ({ userId, username }={}) => {
      if (waiting.find(w=>w.socketId===socket.id)) return;
      waiting.push({ socketId: socket.id, user:{ userId, username } });
      socket.emit('fishing:queued');
      let started=false;

      const tryPair = () => {
        if (started) return;
        const i = waiting.findIndex(w=>w.socketId===socket.id);
        if (i===-1) return;
        const j = waiting.findIndex((w,k)=>k!==i);
        if (j!==-1) {
          const a = waiting[i], b = waiting[j];
          if (j>i){ waiting.splice(j,1); waiting.splice(i,1); } else { waiting.splice(i,1); waiting.splice(j,1); }
          const roomId = mkRoom();
          const st = baseState();
          const L = Math.random()<0.5 ? a : b; const R = L===a ? b : a;
          rooms.set(roomId, { ...st, players:{L,R}, bot:false });
          io.in(L.socketId).socketsJoin(roomId);
          io.in(R.socketId).socketsJoin(roomId);
          io.to(L.socketId).emit('fishing:start', { roomId, side:'L', you:L.user, opp:R.user, state: pack(rooms.get(roomId)), ranked:true });
          io.to(R.socketId).emit('fishing:start', { roomId, side:'R', you:R.user, opp:L.user, state: pack(rooms.get(roomId)), ranked:true });
          startLoop(roomId); started=true;
        }
      };

      setTimeout(tryPair, 600);
      setTimeout(() => {
        if (!started) {
          const idx = waiting.findIndex(w=>w.socketId===socket.id);
          if (idx!==-1) waiting.splice(idx,1);
          const roomId = mkRoom();
          const st = baseState();
          const L = { socketId: socket.id, user:{ userId, username } };
          const R = { socketId: 'BOT_'+roomId, user:{ userId:'bot', username:'FisherBot' } };
          rooms.set(roomId, { ...st, players:{L,R}, bot:true });
          socket.join(roomId);
          socket.emit('fishing:start', { roomId, side:'L', you:L.user, opp:R.user, state: pack(rooms.get(roomId)), ranked:false });
          startLoop(roomId); started=true;
        }
      }, 4000);
    });

    socket.on('fishing:input', ({ roomId, type, key }={}) => {
      const r = rooms.get(roomId); if (!r) return;
      const side = r.players.L.socketId === socket.id ? 'L' : (r.players.R.socketId === socket.id ? 'R' : null);
      if (!side) return;

      if (type==='down' && (key==='ArrowLeft'||key==='ArrowRight')) r.holds[side] = key;
      if (type==='up'   && (key==='ArrowLeft'||key==='ArrowRight') && r.holds[side]===key) r.holds[side] = null;

      if (r.phase==='reel') {
        if (side==='L') {
          if (type==='tap' && r.qteL[r.qIdxL]===key) { r.qIdxL++; r.progress.L = Math.min(SIZES[r.sizeIdx].chunks, r.progress.L + 1); }
          if (type==='tap-wrong')                         r.progress.L = Math.max(0, r.progress.L - 1);
        } else {
          if (type==='tap' && r.qteR[r.qIdxR]===key) { r.qIdxR++; r.progress.R = Math.min(SIZES[r.sizeIdx].chunks, r.progress.R + 1); }
          if (type==='tap-wrong')                         r.progress.R = Math.max(0, r.progress.R - 1);
        }
      }
    });

    socket.on('fishing:leave', ({ roomId }={}) => {
      const r = rooms.get(roomId); if (!r) return;
      const winner = (r.players.L.socketId === socket.id) ? r.players.R.user.userId : r.players.L.user.userId;
      clearInterval(r.timer);
      io.to(roomId).emit('fishing:gameover', { winnerUserId: winner, sizeIdx: r.sizeIdx, ranked: !r.bot });
      rooms.delete(roomId);
    });

    socket.on('disconnect', () => {
      const idx = waiting.findIndex(w=>w.socketId===socket.id);
      if (idx!==-1) waiting.splice(idx,1);
      for (const [id, r] of rooms.entries()) {
        if (r.players.L.socketId===socket.id || r.players.R.socketId===socket.id) {
          clearInterval(r.timer);
          const winner = r.players.L.socketId===socket.id ? r.players.R.user.userId : r.players.L.user.userId;
          io.to(id).emit('fishing:gameover', { winnerUserId: winner, sizeIdx: r.sizeIdx, ranked: !r.bot });
          rooms.delete(id);
        }
      }
    });
  });
};
