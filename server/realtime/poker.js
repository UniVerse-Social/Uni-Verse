// server/realtime/poker.js
const GameProfile = require('../models/GameProfile');

module.exports = function attachPoker(io) {
  const STAKES = {
    '100':   { min:100,   sb:1,  bb:2 },
    '1000':  { min:1000,  sb:10, bb:20 },
    '5000':  { min:5000,  sb:50, bb:100 },
    '10000': { min:10000, sb:100,bb:200 },
    'VIP':   { min:100000,sb:500,bb:1000 },
  };
  const MAX = 8;

  const tables = new Map(); // id -> table
  function newTable(id, stakeKey, name, isPrivate=false, pass='') {
    return {
      id, name, stakeKey, isPrivate, pass,
      min: STAKES[stakeKey].min, sb: STAKES[stakeKey].sb, bb: STAKES[stakeKey].bb,
      seats: Array(MAX).fill(null), // { id:socketId, userId, username, stack, seat, folded, allin }
      deck: [], board: [], pot:0, dealer:0, turn:null, toCall:0, bet:0, round:'idle', lastActionAt:0,
      chat:[]
    };
  }
  function id(prefix='tbl'){ return prefix+'_'+Math.random().toString(36).slice(2,9); }

  // init 10 tables per stake
  for (const k of Object.keys(STAKES)) {
    for (let i=1;i<=10;i++) {
      const t = newTable(id(k), k, `${k} Lobby ${i}`);
      tables.set(t.id, t);
    }
  }

  // --- helpers ---
  const ranks='23456789TJQKA';
  function mkDeck(){
    const s='CDHS';
    const d=[]; for(const ss of s) for(const r of ranks) d.push(r+ss);
    for (let i=d.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [d[i],d[j]]=[d[j],d[i]]; }
    return d;
  }
  function take(t,n){ return t.deck.splice(0,n); }

  function handStrength(cards){ // 7 cards -> {score:number, desc:string}
    // compact evaluator (pairs→straight flush). Score encodes category + kickers.
    const vals = (cs)=>cs.map(c=>ranks.indexOf(c[0])).sort((a,b)=>b-a);
    const byRank = new Map(); const bySuit = new Map();
    for (const c of cards){ const r=c[0], s=c[1]; (byRank.get(r)||byRank.set(r,[]).get(r)).push(c); (bySuit.get(s)||bySuit.set(s,[]).get(s)).push(c); }
    const v = [...cards].map(c=>ranks.indexOf(c[0])).sort((a,b)=>b-a);

    // straight
    const rv=[...new Set(v)];
    let straightHi=-1;
    for (let i=0;i+4<rv.length;i++){ if (rv[i]-rv[i+4]===4){ straightHi=rv[i]; break; } }
    if (rv.includes(12) && rv.includes(3) && rv.includes(2) && rv.includes(1) && rv.includes(0)) straightHi=Math.max(straightHi,3); // wheel

    // flush
    let flushSuit=null; for (const [s,arr] of bySuit) if (arr.length>=5){ flushSuit=s; break; }
    let straightFlushHi=-1;
    if (flushSuit){
      const fv=[...bySuit.get(flushSuit)].map(c=>ranks.indexOf(c[0])).sort((a,b)=>b-a);
      const frv=[...new Set(fv)];
      for (let i=0;i+4<frv.length;i++){ if (frv[i]-frv[i+4]===4){ straightFlushHi=frv[i]; break; } }
      if (frv.includes(12) && frv.includes(3) && frv.includes(2) && frv.includes(1) && frv.includes(0)) straightFlushHi=Math.max(straightFlushHi,3);
    }

    // groups
    const groups=[...byRank.entries()].map(([r,arr])=>({r:ranks.indexOf(r), n:arr.length})).sort((a,b)=>b.n-a.n || b.r-a.r);
    const kickers = (excludeRanks=[])=> v.filter(x=>!excludeRanks.includes(x)).slice(0,5);

    const score = (cat, ranksArr)=> (cat*1e10) + ranksArr.reduce((p,c,i)=> p + c*Math.pow(100,4-i), 0);

    if (straightFlushHi>=0) return { score:score(8, [straightFlushHi]), desc:'straight flush' };
    if (groups[0]?.n===4)  return { score:score(7, [groups[0].r, ...kickers([groups[0].r])]), desc:'four of a kind' };
    if (groups[0]?.n===3 && groups[1]?.n>=2) return { score:score(6, [groups[0].r, groups[1].r]), desc:'full house' };
    if (flushSuit)         return { score:score(5, kickers([])), desc:'flush' };
    if (straightHi>=0)     return { score:score(4, [straightHi]), desc:'straight' };
    if (groups[0]?.n===3)  return { score:score(3, [groups[0].r, ...kickers([groups[0].r])]), desc:'three of a kind' };
    if (groups[0]?.n===2 && groups[1]?.n===2) return { score:score(2, [groups[0].r, groups[1].r, ...kickers([groups[0].r,groups[1].r])]), desc:'two pair' };
    if (groups[0]?.n===2)  return { score:score(1, [groups[0].r, ...kickers([groups[0].r])]), desc:'one pair' };
    return { score:score(0, v.slice(0,5)), desc:'high card' };
  }

  function broadcastState(t){
    io.to(t.id).emit('poker:state', {
      id:t.id, name:t.name, stake:t.stakeKey, min:t.min, max:MAX,
      seats:t.seats.map(s=> s? { id:s.id, userId:s.userId, username:s.username, stack:s.stack } : null),
      board:t.board, pot:t.pot, turn:t.turn, toCall:t.toCall, bet:t.bet
    });
  }

  async function adjustCoins(userId, delta){
    const gp = await GameProfile.findOne({ userId });
    if (!gp) return false;
    if (delta < 0 && gp.coins + delta < 0) return false;
    gp.coins += delta; await gp.save(); return true;
  }

  function nextSeat(t){ for(let i=0;i<MAX;i++) if (!t.seats[i]) return i; return -1; }
  function seatedIndices(t){ return t.seats.map((s,i)=> s?i:-1).filter(i=>i>=0); }
  function activePlayers(t){ return t.seats.filter(s=>s && !s.folded && !s.allin); }

  function startHand(t){
    if (activePlayers(t).length < 2 && t.seats.filter(Boolean).length < 2) { t.round='idle'; return; }
    t.deck=mkDeck(); t.board=[]; t.pot=0; t.bet=0; t.toCall=0; t.round='pre';
    t.dealer = (t.dealer + 1) % MAX; if (!t.seats[t.dealer]) t.dealer=seatedIndices(t)[0] ?? 0;
    for (const s of t.seats) if (s){ s.folded=false; s.allin=false; s.cards=take(t,2); }
    // blinds
    const order = seatedIndices(t);
    const di = order.indexOf(t.dealer);
    const sbSeat = order[(di+1)%order.length];
    const bbSeat = order[(di+2)%order.length];
    const sb = t.seats[sbSeat], bb = t.seats[bbSeat];
    const post = (p,amt)=>{ const a=Math.min(p.stack,amt); p.stack-=a; t.pot+=a; if (p.stack===0) p.allin=true; };
    post(sb, t.sb); post(bb, t.bb);
    t.bet = t.bb; t.toCall = t.bb; t.turn = order[(di+3)%order.length];
    t.lastActionAt = Date.now();
    broadcastState(t);
  }
  function advanceRound(t){
    const alive = t.seats.filter(s=>s && !s.folded);
    if (alive.length<=1){ showdown(t); return; }
    if (t.round==='pre'){ t.round='flop'; t.board.push(...take(t,3)); }
    else if (t.round==='flop'){ t.round='turn'; t.board.push(...take(t,1)); }
    else if (t.round==='turn'){ t.round='river'; t.board.push(...take(t,1)); }
    else { showdown(t); return; }
    t.bet=0; t.toCall=0;
    const order=seatedIndices(t); const di=order.indexOf(t.dealer);
    t.turn = order[(di+1)%order.length]; // first to act postflop
    for (const s of t.seats) if (s){ s.acted=false; }
    broadcastState(t);
  }
  function showdown(t){
    const contenders = t.seats.filter(s=>s && !s.folded);
    if (contenders.length===1){ contenders[0].stack += t.pot; t.pot=0; t.round='idle'; broadcastState(t); setTimeout(()=>startHand(t), 1200); return; }
    let best=null, winner=null;
    for (const p of contenders){
      const h = handStrength([...p.cards, ...t.board]);
      if (!best || h.score>best){ best=h.score; winner=p; }
    }
    if (winner){ winner.stack += t.pot; }
    t.pot=0; t.round='idle'; broadcastState(t); setTimeout(()=>startHand(t), 1200);
  }

  function act(t, seatIdx, type, amount){
    const p = t.seats[seatIdx]; if (!p || seatIdx!==t.turn) return;
    const minRaise = Math.max(t.bb, t.bet*2);
    if (type==='fold'){ p.folded=true; stepTurn(); return; }
    if (type==='check'){ if (t.toCall===0){ stepTurn(); } return; }
    if (type==='call'){
      const need = Math.max(0, t.toCall - (t.betPaid?.[seatIdx]||0));
      const pay = Math.min(need, p.stack); p.stack-=pay; t.pot+=pay; if (p.stack===0) p.allin=true;
      p.acted=true; stepTurn(); return;
    }
    if (type==='raise'){
      const r = Math.max(minRaise, Number(amount||0));
      const need = Math.max(0, r - (t.betPaid?.[seatIdx]||0));
      const pay = Math.min(need, p.stack); p.stack-=pay; t.pot+=pay; if (p.stack===0) p.allin=true;
      t.bet = r; t.toCall = r; p.acted=true; stepTurn(true); return;
    }

    function stepTurn(reset=false){
      const order = seatedIndices(t);
      let i = order.indexOf(seatIdx);
      for (let k=1;k<=order.length;k++){
        const nxt = order[(i+k)%order.length];
        const s = t.seats[nxt];
        if (s && !s.folded && !s.allin){
          t.turn = nxt; t.lastActionAt=Date.now();
          if (reset){ for (const ss of t.seats) if (ss) ss.acted=false; }
          broadcastState(t);
          return;
        }
      }
      // everyone acted -> next street
      advanceRound(t);
    }
  }

  io.on('connection', (socket)=>{
    let tableId = null; let seat = -1;

    socket.on('poker:list', (data = {}) => {
      const stakes = data.stakes || '100';
      const arr = [...tables.values()].filter(t=> t.stakeKey===stakes && !t.isPrivate)
        .map(t=>({ id:t.id, name:t.name, players:t.seats.filter(Boolean).length, max:MAX, min:t.min }));
      socket.emit('poker:lobbies', arr);
    });

    socket.on('poker:createPrivate', (data = {}) => {
      const { stakeKey = '100', name, pass } = data;
      const t = newTable(id('priv'), stakeKey, name || `${stakeKey} Private`, true, pass||'');
      tables.set(t.id, t);
      socket.emit('poker:lobbies', [{ id:t.id, name:t.name, players:0, max:MAX, min:t.min }]);
    });

    socket.on('poker:join', async (data = {}) => {
      const { tableId: tid, userId, username, pass } = data;
      const t = tables.get(tid); if (!t) return socket.emit('poker:error', { message:'Table not found' });
      if (t.isPrivate && t.pass && t.pass!==pass) return socket.emit('poker:error', { message:'Wrong passcode' });
      const s = nextSeat(t); if (s<0) return socket.emit('poker:error', { message:'Table full' });

      // buy-in = min stake
      const ok = await adjustCoins(userId, -t.min);
      if (!ok) return socket.emit('poker:error', { message:'Not enough coins' });

      t.seats[s] = { id:socket.id, userId, username, stack:t.min, seat:s, folded:false, allin:false, acted:false, cards:[] };
      tableId = tid; seat = s;
      socket.join(t.id);
      socket.emit('poker:joined', { id:t.id, name:t.name, seats:t.seats.map(x=>x?({id:x.id, userId:x.userId, username:x.username, stack:x.stack}):null), board:t.board, pot:t.pot, turn:t.turn, toCall:t.toCall, bet:t.bet });
      broadcastState(t);
      if (t.round==='idle' && t.seats.filter(Boolean).length>=2) startHand(t);
    });

    socket.on('poker:leave', async ()=>{
      const t = tables.get(tableId); if (!t) return;
      if (seat>=0 && t.seats[seat]){
        const p = t.seats[seat];
        await adjustCoins(p.userId, p.stack); // cash out
        t.seats[seat] = null;
        if (t.turn===seat) advanceRound(t);
        broadcastState(t);
      }
      socket.leave(tableId); tableId=null; seat=-1;
    });

    socket.on('poker:action', (data = {})=>{
      const { type, amount } = data;
      const t = tables.get(tableId); if (!t) return;
      act(t, seat, type, amount);
    });

    socket.on('poker:chat', (data = {})=>{
      const text = data.text;
      const t = tables.get(tableId); if (!t || !text) return;
      const m = { u: (t.seats[seat]?.username || 'Player'), t: String(text).slice(0,200) };
      io.to(t.id).emit('poker:chat', m);
    });

    socket.on('disconnect', async ()=>{
      const t = tables.get(tableId); if (!t) return;
      if (seat>=0 && t.seats[seat]){
        const p = t.seats[seat];
        await adjustCoins(p.userId, p.stack);
        t.seats[seat]=null; broadcastState(t);
      }
    });
  });
};
