// server/realtime/poker.js
const GameProfile = require('../models/GameProfile');

/* ----------------- Shared stores (Redis OR Postgres) ----------------- */
let redis = null; // node-redis client or false if not usable
async function getRedis() {
  if (redis !== null) return redis || null;
  const url = process.env.REDIS_URL || process.env.REDIS_URI || process.env.UPSTASH_REDIS_URL || null;
  // Socket.IO redis adapter requires Redis TCP (redis:// or rediss://). Upstash HTTP endpoints start with http(s) and won't work.
  if (!url || /^https?:\/\//i.test(url)) {
    if (url) console.warn('[Poker] Skipping Redis adapter: URL looks HTTP (Upstash REST), pub/sub not supported for Socket.IO:', url);
    else console.log('[Poker] Redis not configured.');
    redis = false;
    return null;
  }
  try {
    const { createClient } = require('redis');
    const client = createClient({ url });
    client.on('error', (e) => console.error('[Poker] Redis error', e));
    await client.connect();
    redis = client;
    console.log('[Poker] Redis connected');
    return redis;
  } catch (err) {
    console.warn('[Poker] Redis unavailable, using in-memory tables only:', err?.message || err);
    redis = false;
    return null;
  }
}

const K = {
  stakeSet: (stake) => `poker:stake:${stake}`,
  table:    (id)    => `poker:table:${id}`,
};

module.exports = function attachPoker(io) {

  /* ----------------- Enable a cross-node adapter ----------------- */
  (async () => {
    let adapterEnabled = false;

    // Option A: Redis
    try {
      const r = await getRedis();
      if (r) {
        const { createAdapter } = require('@socket.io/redis-adapter');
        const sub = r.duplicate();
        await sub.connect();
        io.adapter(createAdapter(r, sub));
        adapterEnabled = true;
        console.log('[Poker] Socket.IO Redis adapter enabled');
      }
    } catch (e) {
      console.warn('[Poker] Redis adapter not enabled:', e?.message || e);
    }

    // Option B: Postgres (fallback if no usable Redis)
    if (!adapterEnabled && process.env.PG_CONNECTION_STRING) {
      try {
        const { createAdapter } = require('@socket.io/postgres-adapter');
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
        io.adapter(createAdapter(pool));
        adapterEnabled = true;
        console.log('[Poker] Socket.IO Postgres adapter enabled');
      } catch (e) {
        console.warn('[Poker] Postgres adapter not enabled:', e?.message || e);
      }
    }

    if (!adapterEnabled) {
      console.warn('[Poker] No cross-node adapter enabled. Multiplayer will only work for users on the same process. Configure REDIS_URL (redis://) or PG_CONNECTION_STRING.');
    }

    // Heal all tables once the adapter decision is made
    try { await healAllTables(); } catch (e) { console.warn('[Poker] Heal on boot failed:', e?.message || e); }
  })();

  /* ----------------- Game constants & cache ----------------- */
  const STAKES = {
    '100':   { min:100,   sb:1,  bb:2 },
    '1000':  { min:1000,  sb:10, bb:20 },
    '5000':  { min:5000,  sb:50, bb:100 },
    '10000': { min:10000, sb:100,bb:200 },
    'VIP':   { min:100000,sb:500,bb:1000 },
  };
  const MAX = 8;
  const CHAT_MAX = 20;
  const DEFAULT_PUBLIC_TABLES = 12;
  const READY_MS = 10_000;

  const JOIN_GRACE_MS = 1800;
  const HEARTBEAT_MS = 2000;
  const STALE_SEAT_MS = 12000;

  const GLB = (globalThis.__POKER__ ||= { cache: new Map() });
  const cache = GLB.cache;

  const detId = (stakeKey, idx) => `tbl:${stakeKey}:${idx}`;
  function newTable(id, stakeKey, name, isPrivate=false, pass='') {
    return {
      id, name, stakeKey, isPrivate, pass,
      min: STAKES[stakeKey].min, sb: STAKES[stakeKey].sb, bb: STAKES[stakeKey].bb,
      seats: Array(MAX).fill(null), // { id, userId, username, stack, seat, folded, allin, acted, waiting, cards, leaving?, disconnected? }
      deck: [], board: [], pot:0,
      dealer:0, turn:null, toCall:0, bet:0, betPaid:{}, round:'idle', lastActionAt:0,
      sbSeat:null, bbSeat:null,
      ready:null, // { deadline:number, accepted:Set<number>, timer:any }
      lastWin:null, // { seat:number, amount:number } for client win animation
      chat:[]
    };
  }

  /* ----------------- Persistence helpers ----------------- */
  async function loadTable(id) {
    const r = await getRedis();
    if (r) {
      const raw = await r.get(K.table(id));
      if (raw) {
        const t = revive(JSON.parse(raw));
        cache.set(id, t);
        return t;
      }
      return null;
    }
    return cache.get(id) || null;
  }
  async function saveTable(t) {
    const r = await getRedis();
    cache.set(t.id, t);
    if (r) await r.set(K.table(t.id), JSON.stringify(serialize(t)));
  }
  async function ensurePublicTables(stakeKey, howMany = DEFAULT_PUBLIC_TABLES) {
    const r = await getRedis();
    for (let i = 1; i <= howMany; i++) {
      const id = detId(stakeKey, i);
      let t = await loadTable(id);
      if (!t) {
        t = newTable(id, stakeKey, `Table ${i}`);
        await saveTable(t);
      }
      if (r) await r.sAdd(K.stakeSet(stakeKey), id);
    }
  }
  async function listTables(stakeKey) {
    const r = await getRedis();
    await ensurePublicTables(stakeKey);

    // Helper: count only seats that are truly present (not queued leavers) and still in the room
    async function visiblePlayers(t) {
      const now = Date.now();
      return t.seats.reduce((n, s) => {
        if (!s) return n;
        if (s.leaving) return n;
        const withinGrace = (now - (Number(s.joinedAt)||0)) < JOIN_GRACE_MS;
        const fresh = (now - (Number(s.lastSeen)||0)) < STALE_SEAT_MS;
        if (!withinGrace && !fresh) return n;
        return n + 1;
      }, 0);
    }

    if (r) {
      const ids = await r.sMembers(K.stakeSet(stakeKey));
      const out = [];
      for (const id of ids) {
        const t = await loadTable(id);
        if (t && !t.isPrivate) out.push({ id: t.id, name: t.name, players: await visiblePlayers(t), max: MAX, min: t.min });
      }
      return out;
    }

    const out = [];
    for (const t of cache.values()) {
      if (t.stakeKey === stakeKey && !t.isPrivate) {
        out.push({ id: t.id, name: t.name, players: await visiblePlayers(t), max: MAX, min: t.min });
      }
    }
    return out;
  }
  function serialize(t) {
    return { ...t, ready: t.ready ? { deadline: t.ready.deadline, accepted: Array.from(t.ready.accepted || []) } : null };
  }
  function revive(obj) {
    if (!obj) return obj;
    if (obj.ready) obj.ready = { deadline: obj.ready.deadline, accepted: new Set(obj.ready.accepted || []), timer: null };
    return obj;
  }
  async function broadcastLobbyCount(t) {
    const now = Date.now();
    const players = t.seats.reduce((n, s) => {
      if (!s) return n;
      if (s.leaving) return n;
      const withinGrace = (now - (Number(s.joinedAt)||0)) < JOIN_GRACE_MS;
      const fresh = (now - (Number(s.lastSeen)||0)) < STALE_SEAT_MS;
      if (!withinGrace && !fresh) return n;
      return n + 1;
    }, 0);
    io.emit('poker:lobbies:update', { id: t.id, players });
  }

  /* ----------------- Cards & helpers ----------------- */
  const RANKS = '23456789TJQKA';
  const SUITS = 'CDHS';
  const mkDeck = () => {
    const d=[]; for (const s of SUITS) for (const r of RANKS) d.push(r+s);
    for (let i=d.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [d[i],d[j]]=[d[j],d[i]]; }
    return d;
  };
  const take = (t,n)=> t.deck.splice(0,n);

  function handStrength(seven){
    const rv = seven.map(c=>RANKS.indexOf(c[0])).sort((a,b)=>b-a);
    const byRank = new Map(), bySuit = new Map();
    for (const c of seven) {
      const r=c[0], s=c[1];
      (byRank.get(r) || byRank.set(r,[]).get(r)).push(c);
      (bySuit.get(s) || bySuit.set(s,[]).get(s)).push(c);
    }
    const uniques = [...new Set(rv)];
    const bestStraight = (vals)=>{
      const a=[...new Set(vals)].sort((x,y)=>y-x);
      if (a.includes(12)&&a.includes(3)&&a.includes(2)&&a.includes(1)&&a.includes(0)) return 3;
      for (let i=0;i+4<a.length;i++) if (a[i]-a[i+4]===4) return a[i];
      return -1;
    };
    for (const [,cards] of bySuit){ if (cards.length>=5){ const v=cards.map(c=>RANKS.indexOf(c[0])); const hi=bestStraight(v); if (hi>=0) return 9e6+hi; } }
    const counts=[...byRank.entries()].map(([r,a])=>({r:RANKS.indexOf(r),n:a.length})).sort((a,b)=>b.n-a.n||b.r-a.r);
    const kick = (ex=[])=> uniques.filter(x=>!ex.includes(x)).slice(0,5-ex.length);
    if (counts[0]?.n===4) return 8e6 + counts[0].r*1e4 + kick([counts[0].r])[0];
    if (counts[0]?.n===3 && counts[1]?.n>=2) return 7e6 + counts[0].r*1e4 + counts[1].r;
    for (const [,cards] of bySuit){ if (cards.length>=5){ const v=cards.map(c=>RANKS.indexOf(c[0])).sort((a,b)=>b-a).slice(0,5); return 6e6 + v[0]*1e4+v[1]*1e3+v[2]*1e2+v[3]*10+v[4]; } }
    { const hi=bestStraight(rv); if (hi>=0) return 5e6+hi; }
    if (counts[0]?.n===3) return 4e6+counts[0].r*1e4+(kick([counts[0].r])[0]||0)*1e2+(kick([counts[0].r])[1]||0);
    if (counts[0]?.n===2) return 2e6 + counts[0].r*1e4 + kick([counts[0].r])[0]*1e2 + kick([counts[0].r])[1];
    const v=rv.slice(0,5); return 1e6 + v[0]*1e4+v[1]*1e3+v[2]*1e2+v[3]*10+v[4];
  }

  const participantIndices = (t)=> t.seats.map((s,i)=> s && !s.waiting ? i : -1).filter(i=>i>=0);
  const canStart = (t)=> participantIndices(t).length >= 2;

  function toReadyPayload(t){
    if (!t.ready) return null;
    return { deadline: t.ready.deadline, accepted: Array.from(t.ready.accepted) };
  }

  async function broadcastState(t){
    // NEW: persist the authoritative table snapshot before telling clients
    await saveTable(t);
    io.to(t.id).emit('poker:state', {
      id:t.id, name:t.name, stake:t.stakeKey, min:t.min, max:MAX,
      seats:t.seats.map(s=> s? { id:s.id, userId:s.userId, username:s.username, stack:s.stack, seat:s.seat, waiting:!!s.waiting } : null),
      board:t.board, pot:t.pot, turn:t.turn, toCall:t.toCall, bet:t.bet, round:t.round,
      dealer:t.dealer, sb:t.sbSeat, bb:t.bbSeat,
      lastWin: t.lastWin || null,
      ready: toReadyPayload(t)
    });
  }
  async function processPendingLeaves(t){
    if (t.round !== 'idle') return;
    let changed = false;
    for (let i = 0; i < t.seats.length; i++){
      const s = t.seats[i];
      if (s && s.leaving){
        await adjustCoins(s.userId, s.stack);
        t.seats[i] = null;
        changed = true;
      }
    }
    if (changed){ await broadcastState(t); await enforceMinimumPlayers(t); await broadcastLobbyCount(t); }
  }

  async function stepTurnExternal(t){
    if (t.round === 'idle') return;
    const order = participantIndices(t);
    // If betting is settled for everyone, advance the round
    const need = t.toCall;
    const needers = order.filter(si=>{
      const s = t.seats[si];
      if (!s || s.folded || s.allin) return false;
      const paid = t.betPaid?.[si]||0;
      return paid < need || !s.acted;
    });
    if (needers.length === 0) return advanceRound(t);

    // Otherwise move to next eligible seat
    const cur = t.turn;
    let i = order.indexOf(cur);
    for (let k=1;k<=order.length;k++){
      const nxt = order[(i+k)%order.length];
      const s = t.seats[nxt];
      if (s && !s.folded && !s.allin){
        t.turn = nxt; t.lastActionAt = Date.now(); await broadcastState(t); return;
      }
    }
    await advanceRound(t);
  }

  async function adjustCoins(userId, delta){
    const gp = await GameProfile.findOne({ userId });
    if (!gp) return false;
    if (delta < 0 && (gp.coins||0) + delta < 0) return false;
    gp.coins = (gp.coins||0) + delta;
    await gp.save();
    return true;
  }

  /* ----------------- Multiplayer guards ----------------- */
  async function socketsAlive(ids) {
    try { return (await io.in(ids).fetchSockets()).map(s=>s.id); }
    catch { return []; }
  }
  async function isSocketAlive(id) {
    const alive = await socketsAlive([id]);
    return alive.includes(id);
  }

  async function enforceMinimumPlayers(t) {
    const aliveIdxs = participantIndices(t);
    if (aliveIdxs.length >= 2) return false;

    if (t.round !== 'idle') {
      if (aliveIdxs.length === 1 && t.pot > 0) {
        const p = t.seats[aliveIdxs[0]];
        if (p) p.stack += t.pot;
      }
      t.pot = 0; t.round = 'idle';
      t.sbSeat = null; t.bbSeat = null;
      t.bet = 0; t.toCall = 0; t.betPaid = {};
      t.board = []; t.turn = null; t.ready = null;
      await broadcastState(t);
      await broadcastLobbyCount(t); // NEW
    }
    return true;
  }

  // joinInfo is either null or { userId: string|number, socketId: string }
  async function pruneStaleSeats(t, joinInfo = null) {
    let changed = false;

    let presentIds = new Set();
    try {
      const sockets = await io.in(t.id).fetchSockets();
      presentIds = new Set(sockets.map(s => s.id));
    } catch {}

    const liveHand = (t.round !== 'idle' && t.round !== 'ready');
    const now = Date.now();

    for (let i = 0; i < t.seats.length; i++) {
      const s = t.seats[i];
      if (!s) continue;

      // On (re)join, evict older seats for the same user — never disconnect the current socket
      if (joinInfo && String(s.userId) === String(joinInfo.userId)) {
        const isSameSocket = String(s.id) === String(joinInfo.socketId);
        if (!isSameSocket) {
          if (!liveHand || s.waiting) {
            if (s.stack > 0) await adjustCoins(s.userId, s.stack);
            t.seats[i] = null; changed = true; continue;
          } else {
            s.leaving = true;
            if (!s.folded) s.folded = true;
            changed = true; continue;
          }
        }
      }

      // Seats whose sockets vanished — but honor a short grace after join
      const withinGrace = (now - (Number(s.joinedAt)||0)) < JOIN_GRACE_MS;
      const fresh = (now - (Number(s.lastSeen)||0)) < STALE_SEAT_MS;
      if (!withinGrace && !fresh) {
        if (liveHand && !s.waiting) {
          if (!s.folded) s.folded = true;
          s.disconnected = true;
          changed = true;
        } else {
          if (s.stack > 0) await adjustCoins(s.userId, s.stack);
          t.seats[i] = null;
          if (t.ready && t.ready.accepted && t.ready.accepted.delete) t.ready.accepted.delete(i);
          changed = true;
        }
      }
    }

    if (changed) {
      await saveTable(t);
      await broadcastState(t);
      await enforceMinimumPlayers(t);
      await broadcastLobbyCount(t);
    }
    return changed;
  }

  async function healAllTables() {
    const r = await getRedis();
    const stakeKeys = Object.keys(STAKES);
    for (const sk of stakeKeys) {
      await ensurePublicTables(sk);
      const ids = r ? await r.sMembers(K.stakeSet(sk))
                    : Array.from({length:DEFAULT_PUBLIC_TABLES},(_,i)=>detId(sk, i+1));
      for (const id of ids) {
        const t = await loadTable(id);
        if (t) { await pruneStaleSeats(t, null); await enforceMinimumPlayers(t); }
      }
    }
  }

  // If someone folds/leaves mid-hand, move action or finish the hand
  async function stepTurnExternal(t){
    if (t.round === 'idle') return;

    // Count live contenders
    const order = participantIndices(t);
    const contenders = order.filter(si => {
      const p = t.seats[si];
      return p && !p.folded && !p.allin;
    });

    // If <=1 contender remains, finish immediately
    if (contenders.length <= 1){
      await advanceRound(t); // this will fold through remaining streets or jump to showdown as in your engine
      return;
    }

    // Normal progression: if everyone has acted/paid, advance round, else move turn
    const need = t.toCall;
    const needers = order.filter(si=>{
      const s = t.seats[si];
      if (!s || s.folded || s.allin) return false;
      const paid = t.betPaid?.[si]||0;
      return (paid < need) || !s.acted;
    });

    if (needers.length === 0){
      await advanceRound(t);
      return;
    }

    // Find next eligible seat
    const cur = t.turn;
    let i = order.indexOf(cur);
    for (let k=1;k<=order.length;k++){
      const nxt = order[(i+k)%order.length];
      const s = t.seats[nxt];
      if (s && !s.folded && !s.allin){
        t.turn = nxt; t.lastActionAt = Date.now();
        await broadcastState(t);
        return;
      }
    }
    await advanceRound(t);
  }

  // Apply queued leaves once the table is idle
  async function processPendingLeaves(t){
    if (t.round !== 'idle') return;
    let changed = false;
    for (let i = 0; i < t.seats.length; i++){
      const s = t.seats[i];
      if (s && s.leaving){
        await adjustCoins(s.userId, s.stack);
        t.seats[i] = null;
        changed = true;
      }
    }
    if (changed){
      await broadcastState(t);
      await enforceMinimumPlayers(t);
    }
  }

  // Background sweeper every 20s
  setInterval(() => { healAllTables().catch(e=>console.warn('[Poker] sweeper error', e?.message||e)); }, 20000);

  function clearReadyTimer(t){ if (t.ready?.timer){ clearInterval(t.ready.timer); t.ready.timer=null; } }

  async function beginReadyPhase(t){
    clearReadyTimer(t);
    await processPendingLeaves(t);
    await pruneStaleSeats(t, null);

    // NEW: everyone seated should be eligible for the next hand
    let changed = false;
    for (let i = 0; i < t.seats.length; i++) {
      const s = t.seats[i];
      if (s && s.waiting) { s.waiting = false; changed = true; }
    }
    if (changed) await saveTable(t);

    const order = participantIndices(t);
    if (order.length < 2) { t.round='idle'; t.ready=null; t.sbSeat=null; t.bbSeat=null; await broadcastState(t); return; }

    t.round = 'ready'; t.sbSeat = null; t.bbSeat = null;
    t.ready = { deadline: Date.now() + READY_MS, accepted: new Set(), timer: null };
    await broadcastState(t);

    t.ready.timer = setInterval(async () => {
      await pruneStaleSeats(t, null);
      if (participantIndices(t).length < 2) {
        clearReadyTimer(t); t.round='idle'; t.ready=null; await broadcastState(t); return;
      }
      if (Date.now() >= t.ready.deadline) {
        for (const i of participantIndices(t)) t.ready.accepted.add(i);
        clearReadyTimer(t); await startHand(t);
      } else {
        await broadcastState(t);
      }
    }, 1000);
  }

  async function markReady(t, seatIdx){
    if (!t.ready) return;
    if (!participantIndices(t).includes(seatIdx)) return;
    t.ready.accepted.add(seatIdx);
    await broadcastState(t);
    const order = participantIndices(t);
    if (order.every(i => t.ready.accepted.has(i))) {
      clearReadyTimer(t); await startHand(t);
    }
  }

  async function startHand(t){
    if (!canStart(t)) { t.round='idle'; t.ready=null; await broadcastState(t); return; }

    // NEW: remove any stale/disconnected seats BEFORE we deal
    await pruneStaleSeats(t);
    if (!canStart(t)) { t.round='idle'; t.ready=null; await broadcastState(t); return; }

    for (const s of t.seats) if (s) s.waiting = false;
    const order = participantIndices(t); if (order.length < 2) { t.round='idle'; t.ready=null; await broadcastState(t); return; }

    if (!order.includes(t.dealer)) t.dealer = order[0]; else { const di = order.indexOf(t.dealer); t.dealer = order[(di+1)%order.length]; }

    t.ready = null; t.deck = mkDeck(); t.board = []; t.pot = 0; t.bet = 0; t.toCall = 0; t.betPaid = {}; t.round = 'pre';

    for (const i of order) {
      const s = t.seats[i];
      s.folded=false; s.allin=false; s.acted=false; s.cards=take(t,2);
      io.to(s.id).emit('poker:hole', s.cards);
    }

    const di = order.indexOf(t.dealer);
    let sbSeat, bbSeat, nextToAct;

    if (order.length === 2) {
      // Heads-up: dealer is SB and acts first preflop
      sbSeat = t.dealer;
      bbSeat = order[(di+1) % order.length];
      nextToAct = sbSeat; // SB goes first preflop in heads-up
    } else {
      // 3+ players: standard blind order, action starts left of BB
      sbSeat = order[(di+1) % order.length];
      bbSeat = order[(di+2) % order.length];
      nextToAct = order[(di+3) % order.length];
    }

    t.sbSeat = sbSeat; t.bbSeat = bbSeat;
    const sb = t.seats[sbSeat], bb = t.seats[bbSeat];
    const post = (p,amt, seatIdx)=>{ const pay = Math.min(p.stack, amt); p.stack -= pay; t.pot += pay; if (p.stack===0) p.allin=true; t.betPaid[seatIdx] = (t.betPaid[seatIdx]||0) + pay; };
    post(sb, t.sb, sbSeat); post(bb, t.bb, bbSeat);

    t.bet = t.bb; t.toCall = t.bb; t.turn = nextToAct; t.lastActionAt = Date.now();

    await broadcastState(t);
  }

  async function advanceRound(t){
    const order = participantIndices(t);
    const alive = order.map(i=>t.seats[i]).filter(s=>s && !s.folded);
    if (alive.length<=1){ return showdown(t); }

    if (t.round==='pre')      { t.round='flop';  t.board.push(...take(t,3)); }
    else if (t.round==='flop'){ t.round='turn';  t.board.push(...take(t,1)); }
    else if (t.round==='turn'){ t.round='river'; t.board.push(...take(t,1)); }
    else return showdown(t);

    t.bet = 0; t.toCall=0; t.betPaid = {}; for (const i of order){ const s=t.seats[i]; if (s) s.acted=false; }
    const di = order.indexOf(t.dealer); t.turn = order[(di+1)%order.length]; t.lastActionAt = Date.now();
    await broadcastState(t);
  }

  async function showdown(t){
    const order = participantIndices(t);
    const contenders = order.map(i=>t.seats[i]).filter(s=>s && !s.folded);
    if (contenders.length===1){
      const prize = t.pot;
      contenders[0].stack += prize;
      t.lastWin = { seat: contenders[0].seat, amount: prize }; // NEW
      t.pot=0; t.round='idle'; t.sbSeat=null; t.bbSeat=null; await broadcastState(t);
      setTimeout(async ()=>{ t.lastWin=null; await broadcastState(t); await processPendingLeaves(t); await beginReadyPhase(t); }, 900);
      return;
    }
    let best=-1, win=null;
    for (const p of contenders){ const sc=handStrength([...p.cards, ...t.board]); if (sc>best){ best=sc; win=p; } }
    if (win){
      const prize = t.pot;
      win.stack += prize;
      t.lastWin = { seat: win.seat, amount: prize }; // NEW
    }
    t.pot=0; t.round='idle'; t.sbSeat=null; t.bbSeat=null; await broadcastState(t);
    setTimeout(async ()=>{ t.lastWin=null; await broadcastState(t); await processPendingLeaves(t); await beginReadyPhase(t); }, 900);
  }

  async function act(t, seatIdx, type, amount){
    const p = t.seats[seatIdx]; if (!p || seatIdx!==t.turn) return;
    if (p.folded || p.allin || p.waiting) return;

    const order = participantIndices(t);
    const minRaise = Math.max(t.bb, t.bet === 0 ? t.bb : (t.bet * 2));

    if (type==='fold'){
      p.folded = true;
      await saveTable(t);                  // persist before moving the turn
      return stepTurn(false);
    }

    if (type==='check'){
      if (t.toCall === 0){
        p.acted = true;
        await saveTable(t);          
        return stepTurn(false);
      }
      return;
    }

    if (type==='call'){
      const need = Math.max(0, t.toCall - (t.betPaid?.[seatIdx]||0));
      const pay = Math.min(need, p.stack);
      p.stack -= pay; t.pot += pay; if (p.stack===0) p.allin=true;
      t.betPaid[seatIdx] = (t.betPaid?.[seatIdx]||0) + pay; p.acted = true;
      await saveTable(t);           
      return stepTurn(false);
    }

    if (type==='raise'){
      const r = Math.max(minRaise, Number(amount||0));
      const need = Math.max(0, r - (t.betPaid?.[seatIdx]||0));
      const pay = Math.min(need, p.stack);
      p.stack -= pay; t.pot += pay; if (p.stack===0) p.allin=true;
      t.bet = r; t.toCall = r; t.betPaid[seatIdx] = (t.betPaid?.[seatIdx]||0) + pay; p.acted = true;
      await saveTable(t);         
      return stepTurn(true);
    }

    async function stepTurn(reset){
      const order = participantIndices(t);
      let i = order.indexOf(seatIdx);

      const need = t.toCall;
      const needers = order.filter(si=>{
        const s = t.seats[si];
        if (!s || s.folded || s.allin) return false;
        const paid = t.betPaid?.[si]||0;
        return paid < need || !s.acted;
      });
      if (needers.length===0) return advanceRound(t);

      for (let k=1;k<=order.length;k++){
        const nxt = order[(i+k)%order.length];
        const s = t.seats[nxt];
        if (s && !s.folded && !s.allin){
          if (reset){ for (const si of order){ const ss=t.seats[si]; if (ss) ss.acted=false; } s.acted=false; }
          t.turn = nxt; t.lastActionAt = Date.now();
          await broadcastState(t);         // broadcastState now persists too
          return;
        }
      }
      await advanceRound(t);
    }
  }

  /* ----------------- Sockets ----------------- */
  io.on('connection', (socket)=>{
    let tableId = null, seat = -1;

    socket.on('poker:list', async (data = {}) => {
      const stakes = data.stakes || '100';
      await ensurePublicTables(stakes);
      const arr = await listTables(stakes);
      socket.emit('poker:lobbies', arr);
    });
    socket.on('poker:heartbeat', async () => {
      try {
        if (!tableId) return;
        const t = await loadTable(tableId); if (!t) return;
        if (seat == null || seat < 0) return;
        const s = t.seats[seat]; if (!s) return;
        s.lastSeen = Date.now();
        await saveTable(t);
      } catch {}
    });
    socket.on('poker:createPrivate', async (data = {}) => {
      const { stakeKey = '100', name, pass } = data;
      const id = 'priv_' + Math.random().toString(36).slice(2,9);
      const t = newTable(id, stakeKey, name || `${stakeKey} Private`, true, pass||'');
      await saveTable(t);
      socket.emit('poker:lobbies', [{ id:t.id, name:t.name, players:0, max:MAX, min:t.min }]);
    });

    socket.on('poker:join', async (data = {}) => {
      const { tableId: tid, userId, username, pass } = data;
      let t = await loadTable(tid);
      if (!t) return socket.emit('poker:error', { message:'Table not found' });
      if (t.isPrivate && t.pass && t.pass!==pass) return socket.emit('poker:error', { message:'Wrong passcode' });

      // De-dupe safely: evict any old seat for this user without killing our current socket
      await pruneStaleSeats(t, { userId, socketId: socket.id });

      const sIdx = t.seats.findIndex(x=>!x);
      if (sIdx < 0) return socket.emit('poker:error', { message:'Table full' });

      const ok = await adjustCoins(userId, -t.min);
      if (!ok) return socket.emit('poker:error', { message:'Not enough coins' });

      // Only mark as "waiting to be dealt in" if a hand is actively in progress (not idle, not ready)
      const waiting = (t.round !== 'idle' && t.round !== 'ready');
      t.seats[sIdx] = {
        id: socket.id,
        userId,
        username,
        stack: t.min,
        seat: sIdx,
        folded: false,
        allin: false,
        acted: false,
        waiting,
        cards: [],
        joinedAt: Date.now(),
        lastSeen: Date.now()
      };
      await saveTable(t);

      tableId = tid; seat = sIdx;
      await socket.join(t.id);

      socket.emit('poker:joined', {
        id:t.id, name:t.name, round:t.round,
        seats:t.seats.map(x=>x?({id:x.id, userId:x.userId, username:x.username, stack:x.stack, seat:x.seat, waiting:!!x.waiting}):null),
        board:t.board, pot:t.pot, turn:t.turn, toCall:t.toCall, bet:t.bet,
        dealer:t.dealer, sb:t.sbSeat, bb:t.bbSeat,
        ready: toReadyPayload(t),
        chat: t.chat.slice(-CHAT_MAX)
      });

      await broadcastState(t);
      await enforceMinimumPlayers(t);
      await broadcastLobbyCount(t);

      if (t.round==='idle' && !t.ready && canStart(t)) await beginReadyPhase(t);
    });

    socket.on('poker:leave', async ()=>{
      const t = await loadTable(tableId); if (!t) return;
      if (seat>=0 && t.seats[seat]){
        const p = t.seats[seat];

        const liveHand = (t.round !== 'idle' && t.round !== 'ready');
        if (liveHand && !p.waiting){
          // Queue cash-out and fold now so the table progresses immediately
          p.leaving = true;
          if (!p.folded){
            if (t.turn === seat){
              await act(t, seat, 'fold');
            } else {
              p.folded = true;
              await stepTurnExternal(t);
            }
          } else {
            await stepTurnExternal(t);
          }
          socket.emit('poker:error', { message: 'You will leave after the current hand.' });
        } else {
          await adjustCoins(p.userId, p.stack);
          t.seats[seat] = null;
          if (t.ready){ t.ready.accepted.delete(seat); }
          await broadcastState(t);
          await enforceMinimumPlayers(t);
          await broadcastLobbyCount(t); // NEW: update lobby tiles immediately
        }
      }
      socket.leave(tableId); tableId=null; seat=-1;
    });

    socket.on('poker:ready', async ()=>{
      const t = await loadTable(tableId); if (!t || !t.ready) return;
      await markReady(t, seat);
    });

    socket.on('poker:action', async (data = {})=>{
      const t = await loadTable(tableId); if (!t) return;
      const { type, amount } = data;
      await act(t, seat, type, amount);
      await enforceMinimumPlayers(t);
    });

    socket.on('poker:chat', async (data = {})=>{
      const t = await loadTable(tableId); if (!t) return;
      if (seat < 0) return;
      const text = String(data.text||'').trim().slice(0,200);
      if (!text) return;
      const username = t.seats[seat]?.username || 'Player';
      const msg = { u: username, t: text, ts: Date.now() };
      t.chat.push(msg);
      if (t.chat.length > CHAT_MAX) t.chat = t.chat.slice(-CHAT_MAX);
      await broadcastState(t);
      io.to(t.id).emit('poker:chat', msg);
    });

    socket.on('disconnect', async ()=>{
      const t = await loadTable(tableId); if (!t) return;
      if (seat>=0 && t.seats[seat]){
        const p = t.seats[seat];

        const liveHand = (t.round !== 'idle' && t.round !== 'ready');
        if (liveHand && !p.waiting){
          p.disconnected = true;
          if (!p.folded) p.folded = true;

          if (t.turn === seat) {
            await act(t, seat, 'fold');
          } else {
            await stepTurnExternal(t);
          }
        } else {
          await adjustCoins(p.userId, p.stack);
          t.seats[seat]=null;
          await broadcastState(t);
          await enforceMinimumPlayers(t);
          await broadcastLobbyCount(t); // NEW: update lobby tiles immediately
        }
      }
    });
  });
};
