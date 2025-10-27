// server/realtime/meteor.js
module.exports = function attachMeteor(io){
  const waiting=[]; const rooms=new Map();
  const mk=()=> 'meteor_'+Math.random().toString(36).slice(2,10);
  function finish(room,winner,reason){ io.to(room.id).emit('meteor:gameover',{winner,reason}); rooms.delete(room.id); }

  function tryPair() {
    while (waiting.length >= 2) {
      const a = waiting.shift();
      const b = waiting.shift();

      const aSock = io.sockets.sockets.get(a?.socketId);
      const bSock = io.sockets.sockets.get(b?.socketId);

      if (!aSock && !bSock) continue;
      if (!aSock) { if (b) waiting.unshift(b); continue; }
      if (!bSock) { waiting.unshift(a); continue; }

      const roomId = mk();
      const seed = Math.floor(Math.random() * 0x7fffffff);
      const startAt = Date.now() + 1200;
      const room = {
        id: roomId, seed, startAt,
        players: { p1: { sid: a.socketId, user: a.user }, p2: { sid: b.socketId, user: b.user } },
        lives: { p1: 3, p2: 3 }
      };
      rooms.set(roomId, room);

      aSock.join(roomId); bSock.join(roomId);
      io.to(a.socketId).emit('meteor:start', { roomId, seed, startAt, you: 'p1' });
      io.to(b.socketId).emit('meteor:start', { roomId, seed, startAt, you: 'p2' });
      break;
    }
  }

  io.on('connection', (socket)=>{
    socket.on('meteor:queue', ({ userId, username })=>{
      waiting.push({ socketId: socket.id, user:{userId,username} });
      socket.emit('meteor:queued');
      tryPair();

      if (waiting.length>=2){
        const a=waiting.shift(), b=waiting.shift();
        const roomId=mk(); const seed=Math.floor(Math.random()*0x7fffffff); const startAt=Date.now()+1200;
        const room={ id:roomId, seed, startAt, players:{ p1:{sid:a.socketId,user:a.user}, p2:{sid:b.socketId,user:b.user} }, lives:{ p1:3, p2:3 } };
        rooms.set(roomId, room);
        io.in(a.socketId).socketsJoin(roomId);
        io.in(b.socketId).socketsJoin(roomId);
        io.to(a.socketId).emit('meteor:start',{ roomId, seed, startAt, you:'p1' });
        io.to(b.socketId).emit('meteor:start',{ roomId, seed, startAt, you:'p2' });
      }
    });

    socket.on('meteor:input', ({ roomId, action, at })=>{
      const room=rooms.get(roomId); if(!room) return;
      socket.to(roomId).emit('meteor:input', { action, at: at||Date.now() });
    });

    socket.on('meteor:hit', ({ roomId })=>{
      const room=rooms.get(roomId); if(!room) return;
      const side = (room.players.p1.sid===socket.id) ? 'p1' : (room.players.p2.sid===socket.id) ? 'p2' : null;
      if (!side) return;
      if (room.lives[side]<=0) return;
      room.lives[side]-=1;
      io.to(room.id).emit('meteor:lives', { lives: room.lives });
      if (room.lives[side]<=0){ const winner = side==='p1' ? 'p2' : 'p1'; finish(room,winner,'hearts'); }
    });

    function leaveLike(ev){ socket.on(ev, ({ roomId })=>{ const room=rooms.get(roomId); if(!room) return; const loser=(room.players.p1.sid===socket.id)?'p1':'p2'; const winner=loser==='p1'?'p2':'p1'; finish(room,winner,ev); }); }
    leaveLike('meteor:leave'); leaveLike('meteor:resign');

    socket.on('disconnect', ()=>{
      const widx = waiting.findIndex(w=>w.socketId===socket.id); if (widx>=0) waiting.splice(widx,1);
      for(const [rid,room] of rooms.entries()){
        if(room.players.p1.sid===socket.id || room.players.p2.sid===socket.id){
          const loser=(room.players.p1.sid===socket.id)?'p1':'p2'; const winner=loser==='p1'?'p2':'p1'; finish(room,winner,'disconnect');
        }
      }
    });
  });
};
