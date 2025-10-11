// server/realtime/oddeven.js
module.exports = function attachOddEven(io) {
  const waiting = [];
  const rooms = new Map();
  const mkRoom = () => 'oddeven_' + Math.random().toString(36).slice(2, 10);

  // state shape:
  // {
  //   marbles: { A:10, B:10 },
  //   turn: { chooser:'A'|'B', guesser:'A'|'B' },
  //   hidden: { wager:null },    // stored but never broadcast
  //   last: { chooser, wager, guess, winner } | null
  // }
  const initialState = () => ({
    marbles: { A: 10, B: 10 },
    turn: { chooser: 'A', guesser: 'B' },
    hidden: { wager: null },
    last: null,
  });

  const packState = (s) => ({
    marbles: { ...s.marbles },
    turn: { ...s.turn },
    last: s.last ? { ...s.last } : null,
  });

  function resolveRound(state, guess) {
    const { chooser, guesser } = state.turn;
    const wager = state.hidden.wager|0;
    if (!(wager >= 1)) return { ok:false, reason:'missing wager' };
    if (guess !== 'odd' && guess !== 'even') return { ok:false, reason:'bad guess' };

    const isOdd = wager % 2 !== 0;
    const guessOdd = guess === 'odd';
    const guessCorrect = (isOdd && guessOdd) || (!isOdd && !guessOdd);

    if (guessCorrect) {
      state.marbles[guesser] += wager;
      state.marbles[chooser] -= wager;
      state.last = { chooser, wager, guess, winner: guesser };
    } else {
      state.marbles[chooser] += wager;
      state.marbles[guesser] -= wager;
      state.last = { chooser, wager, guess, winner: chooser };
    }

    // clear hidden & flip roles
    state.hidden.wager = null;
    state.turn = { chooser: guesser, guesser: chooser };

    // winner?
    let winner = null;
    if (state.marbles.A <= 0) winner = 'B';
    else if (state.marbles.B <= 0) winner = 'A';

    return { ok:true, winner };
  }

  io.on('connection', (socket) => {
    // queue
    socket.on('oddeven:queue', ({ userId, username }) => {
      waiting.push({ socketId: socket.id, user: { userId, username } });
      socket.emit('oddeven:queued');

      if (waiting.length >= 2) {
        const a = waiting.shift();
        const b = waiting.shift();
        const roomId = mkRoom();

        const A = Math.random() < 0.5 ? a : b;
        const B = A === a ? b : a;

        const state = initialState();
        const room = { id: roomId, state, players: { A:{ sid:A.socketId, user:A.user }, B:{ sid:B.socketId, user:B.user } } };
        rooms.set(roomId, room);

        io.in(A.socketId).socketsJoin(roomId);
        io.in(B.socketId).socketsJoin(roomId);

        const payload = { roomId, state: packState(state), A: room.players.A.user, B: room.players.B.user };
        io.to(A.socketId).emit('oddeven:start', { ...payload, you: 'A' });
        io.to(B.socketId).emit('oddeven:start', { ...payload, you: 'B' });
      }
    });

    // chooser secretly sets wager
    socket.on('oddeven:wager', ({ roomId, amount }) => {
      const room = rooms.get(roomId); if (!room) return;
      const { state, players } = room;
      const who = (players.A.sid === socket.id) ? 'A' : (players.B.sid === socket.id ? 'B' : null);
      if (!who) return;
      if (state.turn.chooser !== who) return;

      const n = amount|0;
      if (!(n >= 1 && n <= state.marbles[who])) return;
      state.hidden.wager = n;

      // Notify both that wager is locked (but do not reveal amount)
      io.to(room.id).emit('oddeven:state', { state: packState(state) });
    });

    // guesser submits guess
    socket.on('oddeven:guess', ({ roomId, choice }) => {
      const room = rooms.get(roomId); if (!room) return;
      const { state, players } = room;
      const who = (players.A.sid === socket.id) ? 'A' : (players.B.sid === socket.id ? 'B' : null);
      if (!who) return;
      if (state.turn.guesser !== who) return;

      const { ok, winner } = resolveRound(state, choice);
      if (!ok) return;

      if (winner) {
        const result = winner === 'A' ? 'A wins' : 'B wins';
        io.to(room.id).emit('oddeven:gameover', { result, reason: 'marbles', winner });
        rooms.delete(room.id);
        return;
      }
      io.to(room.id).emit('oddeven:state', { state: packState(state) });
    });

    // resign / leave
    socket.on('oddeven:resign', ({ roomId }) => {
      const room = rooms.get(roomId); if (!room) return;
      const loser = (room.players.A.sid === socket.id) ? 'A' : 'B';
      const winner = loser === 'A' ? 'B' : 'A';
      io.to(room.id).emit('oddeven:gameover', { result: `${winner} wins`, reason: 'resign', winner });
      rooms.delete(room.id);
    });

    socket.on('oddeven:leave', ({ roomId }) => {
      const room = rooms.get(roomId); if (!room) return;
      const loser = (room.players.A.sid === socket.id) ? 'A' : 'B';
      const winner = loser === 'A' ? 'B' : 'A';
      io.to(room.id).emit('oddeven:gameover', { result: `${winner} wins`, reason: 'leave', winner });
      rooms.delete(room.id);
    });

    // disconnect cleanup
    socket.on('disconnect', () => {
      const qi = waiting.findIndex(w => w.socketId === socket.id);
      if (qi >= 0) waiting.splice(qi, 1);

      for (const [rid, room] of rooms.entries()) {
        if (room.players.A.sid === socket.id || room.players.B.sid === socket.id) {
          const loser = (room.players.A.sid === socket.id) ? 'A' : 'B';
          const winner = loser === 'A' ? 'B' : 'A';
          io.to(rid).emit('oddeven:gameover', { result: `${winner} wins`, reason: 'disconnect', winner });
          rooms.delete(rid);
        }
      }
    });
  });
};
