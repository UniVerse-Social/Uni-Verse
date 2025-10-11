// server/realtime/tetris.js
module.exports = function attachTetris(io){
  const TICK_HZ = 60;
  const STEP_MS = Math.round(1000 / TICK_HZ);
  const INPUT_DELAY_TICKS = 2; // small, consistent input delay so both sides apply at same tick

  const waiting = [];
  const rooms = new Map();
  const mk = () => 'tetris_' + Math.random().toString(36).slice(2,10);

  function sideOf(room, socketId){
    if (!room) return null;
    return room.players.left.sid===socketId ? 'left'
         : room.players.right.sid===socketId ? 'right' : null;
  }

  function finish(room, winner, reason){
    clearInterval(room.tickInt);
    io.to(room.id).emit('tetris:topout', { winner, reason, scores: room.scores });
    rooms.delete(room.id);
  }

  io.on('connection', (socket)=>{
    socket.on('tetris:queue', ({ userId, username })=>{
      waiting.push({ socketId: socket.id, user:{ userId, username } });
      socket.emit('tetris:queued');

      if (waiting.length >= 2){
        const a = waiting.shift(), b = waiting.shift();
        const roomId = mk();
        const seed   = Math.floor(Math.random()*0x7fffffff);

        const room = {
          id: roomId,
          seed,
          players: { left:{ sid:a.socketId, user:a.user }, right:{ sid:b.socketId, user:b.user } },
          scores:  { left:0, right:0 },
          tick: 0,
          tickInt: null,
        };
        rooms.set(roomId, room);
        io.in(a.socketId).socketsJoin(roomId);
        io.in(b.socketId).socketsJoin(roomId);

        // start broadcasting authoritative ticks for this room
        room.tickInt = setInterval(()=>{
          room.tick++;
          io.to(roomId).emit('tetris:tick', { roomId, tick: room.tick });
        }, STEP_MS);

        // tell each player their side + seed + tick rate
        io.to(a.socketId).emit('tetris:start', { roomId, seed, tickHz:TICK_HZ, you:'left'  });
        io.to(b.socketId).emit('tetris:start', { roomId, seed, tickHz:TICK_HZ, you:'right' });
      }
    });

    socket.on('tetris:score', ({ roomId, score })=>{
      const room = rooms.get(roomId); if (!room) return;
      const side = sideOf(room, socket.id); if (!side) return;
      room.scores[side] = Math.max(room.scores[side], +score|0);
      socket.to(roomId).emit('tetris:opscore', { score: room.scores[side] });
    });

    // Inputs are stamped with a tick so both boards apply them at the exact same time.
    socket.on('tetris:input', ({ roomId, action, desiredTick })=>{
      const room = rooms.get(roomId); if (!room) return;
      const from = sideOf(room, socket.id); if (!from) return;
      const applyTick = Math.max(room.tick + INPUT_DELAY_TICKS, desiredTick|0);
      io.to(roomId).emit('tetris:input', { from, action, tick: applyTick });
    });

    socket.on('tetris:topout', ({ roomId })=>{
      const room = rooms.get(roomId); if (!room) return;
      const loser  = sideOf(room, socket.id);
      const winner = loser==='left' ? 'right' : 'left';
      const ls = room.scores.left|0, rs = room.scores.right|0;
      const byScoreWinner = (ls===rs) ? winner : (ls>rs ? 'left' : 'right');
      finish(room, byScoreWinner, 'topout');
    });

    function resignLike(ev){
      socket.on(ev, ({ roomId })=>{
        const room = rooms.get(roomId); if (!room) return;
        const loser  = sideOf(room, socket.id);
        const winner = loser==='left' ? 'right' : 'left';
        const ls = room.scores.left|0, rs = room.scores.right|0;
        const byScoreWinner = (ls===rs) ? winner : (ls>rs ? 'left' : 'right');
        finish(room, byScoreWinner, ev);
      });
    }
    resignLike('tetris:leave'); resignLike('tetris:resign');

    socket.on('disconnect', ()=>{
      const widx = waiting.findIndex(w=>w.socketId===socket.id);
      if (widx>=0) waiting.splice(widx,1);
      for (const [rid,room] of rooms.entries()){
        const s = sideOf(room, socket.id);
        if (s){
          const loser  = s;
          const winner = s==='left' ? 'right' : 'left';
          const ls = room.scores.left|0, rs = room.scores.right|0;
          const byScoreWinner = (ls===rs) ? winner : (ls>rs ? 'left' : 'right');
          finish(room, byScoreWinner, 'disconnect');
        }
      }
    });
  });
};
