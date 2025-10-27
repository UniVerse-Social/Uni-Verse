// client/src/pages/PokerArena.jsx
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

/* ---------- Animations ---------- */
const fadeIn = keyframes`from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:translateY(0)}`;
const flipIn = keyframes`from{opacity:0; transform:rotateY(90deg) scale(.9)} to{opacity:1; transform:rotateY(0) scale(1)}`;
const pop = keyframes`0%{transform:scale(1)}40%{transform:scale(1.06)}100%{transform:scale(1)}`;
const pulseGlow = keyframes`0%{box-shadow:0 0 0 rgba(255,255,255,0)}50%{box-shadow:0 0 24px rgba(255,255,255,.35)}100%{box-shadow:0 0 0 rgba(255,255,255,0)}`;

const Container = styled.div`display:block;`;
const Card = styled.div`
  background: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 16px; padding: 14px;
  box-shadow: 0 10px 24px rgba(0,0,0,.06);
`;

/* ---------- Lobby ---------- */
const Top = styled.div`display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;`;
const Pill = styled.button`
  border:1px solid var(--border-color); background:#f9fafb; border-radius:999px; padding:8px 12px;
  cursor:pointer; font-weight:700; ${(p)=>p.$on && 'background:#111827;color:#fff;'}
`;
const Grid = styled.div`display:grid; grid-template-columns: repeat(auto-fill, minmax(180px,1fr)); gap:8px;`;
const TableCard = styled.div`border:1px solid var(--border-color); border-radius:12px; padding:10px;`;
const TableHeader = styled.div`display:flex; justify-content:space-between; font-weight:800; margin-bottom:6px;`;

/* ---------- Table ---------- */
const TableWrap = styled(Card)`min-height:520px; position:relative; margin-top:16px;`;
const Felt = styled.div`
  position:absolute; inset:10px; border-radius:24px;
  background: radial-gradient(circle at 50% 20%, #065f46, #064e3b);
  border:4px solid #064e3b; color:#fff; overflow:hidden;
`;
const Pot = styled.div`
  position:absolute; top: 46%; left:50%; transform:translate(-50%,-50%);
  font-weight:800; animation:${p=>p.$pulse?pop:'none'} .4s ease;
`;
const Comm = styled.div`
  position:absolute; top: 52%; left:50%; transform:translateX(-50%); display:flex; gap:6px;
  animation:${fadeIn} .25s ease;
`;
const PlayingCard = styled.div`
  width:36px; height:52px; background:#fff; border-radius:6px; border:1px solid #111827;
  color:#111827; display:flex; align-items:center; justify-content:center; font-weight:800;
  animation:${flipIn} .22s ease;
`;

/* Seat layout with fixed regions so names never move when cards show */
const Seat = styled.div`
  position:absolute; width:140px; text-align:center; transform:translate(-50%,-50%);
`;
const SeatName = styled.div`font-weight:800; min-height:22px; padding-top:6px;`;
const SeatStack = styled.div`min-height:18px;`;
const SeatCards = styled.div`display:flex; justify-content:center; gap:4px; margin-top:6px; min-height:56px;`;

const BlindChip = styled.div`
  position:absolute; transform:translate(-50%,-50%);
  width:22px; height:22px; border-radius:50%;
  background:#fbbf24; color:#111; font-weight:900; font-size:12px;
  display:flex; align-items:center; justify-content:center;
  border:2px solid rgba(0,0,0,.25);
  animation:${fadeIn} .2s ease;
`;

const NameWrap = styled.span`
  display:inline-block; padding:0 6px; border-radius:12px; background:transparent;
`;
const NamePulse = styled.span`
  display:inline-block;
  ${(p)=>p.$on && css`animation: ${pulseGlow} 1.2s ease infinite;`}
`;

// NEW: subtle halo under the active player
const TurnHalo = styled.div`
  position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  width:128px; height:128px; border-radius:999px;
  pointer-events:none;
  background: radial-gradient(closest-side, rgba(255,255,255,.25), rgba(255,255,255,0));
  animation:${fadeIn} .18s ease;
`;

// NEW: winner pill animation
const winPop = keyframes`0%{transform:translateY(8px) scale(.85);opacity:0}40%{opacity:1}100%{transform:translateY(0) scale(1);opacity:1}`;
const WinPill = styled.div`
  position:absolute; left:50%; top:calc(100% + 4px); transform:translateX(-50%);
  background:#16a34a; color:#fff; padding:4px 8px; border-radius:999px; font-weight:900; font-size:12px;
  animation:${winPop} .35s ease;
  box-shadow:0 6px 20px rgba(22,163,74,.35);
`;

/* Action bar */
const ActionBar = styled.div`position:absolute; bottom:10px; left:10px; right:10px; display:flex; gap:8px; justify-content:center;`;
const Btn = styled.button`background:#111827;color:#fff;border:0;border-radius:12px;padding:10px 12px;font-weight:800;cursor:pointer; &:disabled{opacity:.5;cursor:not-allowed;}`;

/* Chat */
const Chat = styled(Card)`display:flex; flex-direction:column; height:240px; margin-top:16px;`;
const ChatList = styled.div`flex:1; overflow:auto; font-size:13px;`;
const ChatInput = styled.input`border:1px solid var(--border-color); border-radius:8px; padding:8px;`;

/* Ready-up overlay */
const ReadyOverlay = styled.div`
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  background: radial-gradient(ellipse at center, rgba(0,0,0,.15), rgba(0,0,0,0));
  pointer-events:auto;
`;
const ReadyBox = styled.div`
  background:#043d31; border:1px solid rgba(255,255,255,.08); color:#fff;
  padding:16px; border-radius:12px; min-width:260px; text-align:center; animation:${fadeIn} .2s ease;
`;

const STAKES = ['100','1000','5000','10000','VIP'];

function CardGlyph({c}) {
  const r = c?.[0]; const s = c?.[1];
  const suit = s==='S'?'♠':s==='H'?'♥':s==='D'?'♦':'♣';
  return <PlayingCard aria-label={c}>{r}{suit}</PlayingCard>;
}

/* Seat anchor coords (%) — top seat moved down from 6% -> 10% */
const SEAT_POS = [
  {left:50,top:10}, {left:82,top:18}, {left:90,top:44},
  {left:82,top:70},{left:50,top:82},{left:18,top:70},
  {left:10,top:44},{left:18,top:18},
];

function towardCenter(pos, ratio=0.65){
  const cx=50, cy=50;
  return { left: cx + (pos.left - cx) * ratio, top: cy + (pos.top - cy) * ratio };
}

export default function PokerArena({ onResult }) {
  const { user } = useContext(AuthContext);
  const buyInRef = useRef(0);
  const lastStackRef = useRef(0);
  const lastPotRef = useRef(0);
  const [stake, setStake] = useState('100');
  const [tables, setTables] = useState([]);
  const [tableId, setTableId] = useState(null);
  const [state, setState] = useState(null);
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState('');
  const [myCards, setMyCards] = useState([]);
  const [potPulse, setPotPulse] = useState(false);
  const socketRef = useRef(null);

  const mySeat = useMemo(() => {
    if (!state?.seats) return -1;
    return state.seats.findIndex(s => s && String(s.userId) === String(user?._id));
  }, [state, user?._id]);

  const iAmSpectating = mySeat >= 0 ? !!state?.seats?.[mySeat]?.waiting : false;
  const activeCount = useMemo(() => {
    return (state?.seats || []).filter(s => s && !s.waiting).length;
  }, [state?.seats]);

  // Only allow acting when it's my turn, I'm not spectating, round is live AND there are 2+ players
  const liveRound = state?.round && !['idle','ready'].includes(state.round);
  const canAct = (mySeat >= 0) && (state?.turn === mySeat) && !iAmSpectating && liveRound && activeCount >= 2;

  // can leave while IDLE, READY, or spectators anytime
  const canLeave = (state?.round === 'idle') || (state?.round === 'ready') || iAmSpectating;

  const [timeLeft, setTimeLeft] = useState(0);
  const iAmReady = useMemo(() => {
    const acc = new Set(state?.ready?.accepted || []);
    return acc.has(mySeat);
  }, [state?.ready, mySeat]);

useEffect(() => {
  // Derive a robust WS base like Chess/Checkers: trim trailing slashes and any /api
  const envBase = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE)
    ? String(process.env.REACT_APP_API_BASE)
    : '';
  let WS_BASE =
    (API_BASE_URL && API_BASE_URL.trim()) ||
    (envBase && envBase.trim()) ||
    '';

  if (!WS_BASE) {
    const { protocol, hostname, host } = window.location;
    const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(hostname);
    if (isLocal) {
      const srvPort = '5000';
      WS_BASE = `${protocol}//${hostname}:${srvPort}`;
    } else {
      WS_BASE = `${protocol}//${host}`;
    }
  }
  WS_BASE = WS_BASE.replace(/\/+$/, '').replace(/\/api\/?$/, '');

  const socket = io(WS_BASE, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 10000,
  });
  socketRef.current = socket;

  const list = () => socket.emit('poker:list', { stake, stakes: stake });

  socket.on('connect', list);
  socket.on('connect_error', (e) => {
    // surface connection issues in dev consoles; UI still stays clean
    try { console.warn('[Poker] socket connect error:', e?.message || e); } catch {}
  });

  list();                            // first fetch
  const poll = setInterval(list, 4000);

  socket.on('poker:lobbies', (arr) => setTables(Array.isArray(arr) ? arr : []));
  socket.on('poker:lobbies:update', (u) => {
    if (!u || !u.id) return;
    setTables(prev => prev.map(t => (t.id === u.id ? { ...t, players: u.players } : t)));
  });
  socket.on('poker:joined', (payload) => {
    setTableId(payload.id);
    setState(payload);
    setChat((payload.chat || []).slice(-20));
    setMyCards([]);

    // initialize previous pot so first state diff is correct and linter stays happy
    lastPotRef.current = Number(payload?.pot || 0);
    setPotPulse(false);

    const meIdx = (payload.seats || []).findIndex(
      s => s && String(s.userId) === String(user?._id)
    );
    const start = meIdx >= 0 ? Number(payload.seats[meIdx].stack || 0) : 0;
    buyInRef.current = start;
    lastStackRef.current = start;
  });

  socket.on('poker:state', (s) => {
    const nextPot = Number(s?.pot || 0);
    const prevPot = Number(lastPotRef.current || 0);

    // Pulse only when the pot actually changes, then reset the flag
    if (nextPot !== prevPot) {
      setPotPulse(true);
      setTimeout(() => setPotPulse(false), 420); // slightly > CSS .4s for a clean reset
    }
    lastPotRef.current = nextPot;

    setState(s);
    if (s?.round === 'idle') setMyCards([]);

    const meIdx = (s?.seats || []).findIndex(
      x => x && String(x.userId) === String(user?._id)
    );
    if (meIdx >= 0) {
      lastStackRef.current = Number(s.seats[meIdx]?.stack || 0);
    }
  });

  socket.on('poker:hole', (cards) => setMyCards(Array.isArray(cards) ? cards : []));
  socket.on('poker:chat', (m) => setChat(x => [...x, m].slice(-20)));
  socket.on('poker:error', (e) => alert(e.message || 'Poker error'));

  return () => { clearInterval(poll); socket.disconnect(); };
}, [stake, user?._id]);

  useEffect(() => {
    let tId;
    const tick = () => {
      const deadline = state?.ready?.deadline;
      if (!deadline) { setTimeLeft(0); return; }
      const sec = Math.max(0, Math.ceil((deadline - Date.now())/1000));
      setTimeLeft(sec);
      if (sec <= 0) return;
      tId = setTimeout(tick, 250);
    };
    tick();
    return () => clearTimeout(tId);
  }, [state?.ready?.deadline]);

  useEffect(() => {
    if (state?.round === 'ready' && !iAmReady) {
      const deadline = state?.ready?.deadline || 0;
      const ms = Math.max(0, deadline - Date.now() - 900);
      const id = setTimeout(() => socketRef.current.emit('poker:ready'), ms);
      return () => clearTimeout(id);
    }
  }, [state?.round, state?.ready?.deadline, iAmReady]);
  
  useEffect(() => {
    if (!tableId) return;
    const s = socketRef.current;
    if (!s) return;

    let stopped = false;
    const ping = () => {
      if (stopped) return;
      s.emit('poker:heartbeat');
      t = setTimeout(ping, 2000); // must match HEARTBEAT_MS on server
    };
    let t = setTimeout(ping, 200);

    // also refresh on tab focus to recover faster
    const onVis = () => { if (!document.hidden) s.emit('poker:heartbeat'); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stopped = true;
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [tableId]);

  const join = (id) => {
    if (tableId) return; // already in a table; avoid duplicate join
    socketRef.current.emit('poker:join', {
      tableId: id,
      userId: user._id,
      username: user.username
    });
  };
  const leave = () => {
    // compute net coins before leaving
    const delta = Number(lastStackRef.current || 0) - Number(buyInRef.current || 0);
    try {
      if (typeof onResult === 'function') {
        onResult('poker', delta, delta > 0); // store history row
      }
    } catch {}

    socketRef.current.emit('poker:leave', {});
    setTableId(null);
    setState(null);
    setChat([]);
    setMyCards([]);
    buyInRef.current = 0;
    lastStackRef.current = 0;
  };
  const act = (type, amount) => socketRef.current.emit('poker:action', { type, amount });
  const readyUp = () => socketRef.current.emit('poker:ready');
  const send = () => {
    const t = msg.trim(); if (!t) return;
    socketRef.current.emit('poker:chat', { text: t }); setMsg('');
  };

  return (
    <Container>
      {!tableId && (
        <Card>
          <Top>
            {STAKES.map(s => (
              <Pill key={s} $on={s===stake} onClick={()=>setStake(s)}>
                {s==='VIP'?'VIP Table':`${Number(s).toLocaleString()} stakes`}
              </Pill>
            ))}
          </Top>

          <Grid>
            {tables.map(t => (
              <TableCard key={t.id}>
                <TableHeader>
                  <span>{t.name}</span>
                  <span>{t.players}/{t.max}</span>
                </TableHeader>
                <Btn onClick={()=>join(t.id)}>Join</Btn>
              </TableCard>
            ))}
          </Grid>
        </Card>
      )}

      {tableId && (
        <>
          <TableWrap>
            <Felt>
              <Pot $pulse={potPulse}>
                {activeCount >= 2 ? `Pot: ${state?.pot ?? 0}` : 'Waiting for opponent…'}
              </Pot>
              <Comm>{(state?.board||[]).map((c,i)=><CardGlyph key={i} c={c}/>)}</Comm>

              {['sb','bb'].map(kind => {
                const seatIdx = state?.[kind];
                if (seatIdx == null || seatIdx < 0) return null;
                const pos = towardCenter(SEAT_POS[seatIdx], 0.65);
                return (
                  <BlindChip key={kind} style={{left:`${pos.left}%`, top:`${pos.top}%`}} title={kind==='sb'?'Small Blind':'Big Blind'}>
                    {kind==='sb'?'SB':'BB'}
                  </BlindChip>
                );
              })}

              {(state?.seats||Array(8).fill(null)).map((seat,idx)=>{
                const pos = SEAT_POS[idx];
                const isMe = mySeat === idx;
                const waiting = !!seat?.waiting;
                const turn = state?.turn===idx;
                const isWinner = state?.lastWin && state.lastWin.seat === idx;
                return (
                  <Seat key={idx} style={{left:`${pos.left}%`, top:`${pos.top}%`}}>
                    {turn && <TurnHalo />} {/* NEW: whose turn halo */}
                    <SeatName>
                      <NameWrap>
                        <NamePulse $on={turn}>
                          {seat ? seat.username : 'Empty'}{waiting ? ' (waiting to be dealt in)' : ''}
                        </NamePulse>
                      </NameWrap>
                    </SeatName>
                    <SeatStack>💰 {seat?.stack ?? 0}</SeatStack>
                    <SeatCards aria-label={isMe?'Your cards':''}>
                      {isMe && myCards.map((c,i)=><CardGlyph key={i} c={c}/>)}
                    </SeatCards>
                    {isWinner && <WinPill>+{Number(state.lastWin.amount||0)}</WinPill>} {/* NEW: winnings burst */}
                  </Seat>
                );
              })}

              {state?.round === 'ready' && (
                <ReadyOverlay>
                  <ReadyBox>
                    <div style={{fontWeight:900, marginBottom:6}}>Ready for the next hand?</div>
                    <div style={{opacity:.85, marginBottom:10}}>Starting in <b>{timeLeft}s</b>…</div>
                    <Btn onClick={readyUp} disabled={iAmReady}>{iAmReady ? 'Ready ✔' : 'I’m Ready'}</Btn>
                  </ReadyBox>
                </ReadyOverlay>
              )}
              {iAmSpectating && state?.round !== 'idle' && (
                <ReadyOverlay>
                  <ReadyBox>
                    <div style={{fontWeight:900, marginBottom:6}}>You joined mid-hand</div>
                    <div style={{opacity:.85}}>You’re <b>waiting to be dealt in</b>. You’ll join automatically next hand.</div>
                  </ReadyBox>
                </ReadyOverlay>
              )}
              <ActionBar>
                <Btn
                  disabled={!canLeave}
                  onClick={canLeave ? leave : undefined}
                  title={!canLeave ? 'You can leave between hands (during Ready) or when idle.' : ''}
                >
                  Leave / Cash Out
                </Btn>
                <Btn disabled={!canAct} onClick={()=>act('fold')}>Fold</Btn>
                <Btn disabled={!canAct} onClick={()=>act(state?.toCall ? 'call' : 'check')}>
                  {state?.toCall ? `Call ${state.toCall}` : 'Check'}
                </Btn>
                <Btn disabled={!canAct} onClick={()=>{
                  const a = prompt('Raise amount');
                  if (a) act('raise', Number(a));
                }}>Raise</Btn>
              </ActionBar>
            </Felt>
          </TableWrap>

          <Chat>
            <div style={{fontWeight:800, marginBottom:6}}>Table Chat</div>
            <ChatList>
              {chat.map((m,i)=><div key={i}><b>{m.u||'System'}:</b> {m.t}</div>)}
            </ChatList>
            <div style={{display:'flex', gap:6}}>
              <ChatInput value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Say something…"/>
              <Btn onClick={send}>Send</Btn>
            </div>
          </Chat>
        </>
      )}
    </Container>
  );
}
