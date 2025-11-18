import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import styled from 'styled-components';
import { io } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';
import GameSidebar from '../components/GameSidebar';

/* ---------- shared look & feel ---------- */
const Wrap = styled.div`
  display:grid; grid-template-columns: 460px 1fr; gap:16px; align-items:start;
  @media (max-width: 860px) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
`;
const Panel = styled.div`
  border:1px solid var(--border-color);
  background:var(--container-white);
  color: var(--text-color);
  border-radius:12px;
  padding:12px;
  max-width:100%;
  overflow:hidden;
  display:flex; flex-direction:column; align-items:center;
  box-shadow: 0 14px 32px rgba(0,0,0,.35);
`;
const Button = styled.button`
  padding: 8px 12px; border-radius: 10px; cursor: pointer;
  border: 1px solid ${p=>p.$primary ? 'transparent' : 'var(--border-color)'};
  background: ${p=>p.$primary ? 'var(--primary-orange)' : 'rgba(255,255,255,0.06)'};
  color: ${p=>p.$primary ? '#000' : 'var(--text-color)'};
  font-weight: 700; font-size: 14px;
  transition: background .15s ease, box-shadow .15s ease, transform .08s ease, color .15s ease;
  box-shadow: ${p=>p.$primary ? '0 8px 22px rgba(0,0,0,.35)' : 'none'};
  &:hover { background: ${p=>p.$primary ? 'linear-gradient(90deg,var(--primary-orange),#59D0FF)' : 'rgba(255,255,255,0.10)'}; transform: translateY(-1px); }
  &:active { transform: translateY(0); }
`;
const Alert = styled.div`
  margin-top:12px; padding:10px 12px; border-radius:10px; font-size:13px;
  border:1px solid rgba(239,68,68,.35);
  background: rgba(239,68,68,.12);
  color:#fca5a5;
`;
const MobileOnly = styled.div`
  display: none;
  @media (max-width: 860px) { display: block; }
`;

const MobileDropdown = styled.details`
  background: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 8px 10px;
  box-shadow: 0 14px 32px rgba(0,0,0,.35);
  summary { list-style: none; cursor: pointer; font-weight: 800; }
  summary::-webkit-details-marker { display: none; }

  @media (max-width: 860px) {
    &[open] { position: fixed; inset: 0; margin: 0; padding: 0; border-radius: 0; z-index: 1000; background: rgba(0,0,0,.35); }
    &[open] > summary {
      position: fixed; top: calc(env(safe-area-inset-top, 0px) + 8px);
      left: 8px; right: 8px; padding: 12px 14px;
      background: var(--container-white); color: var(--text-color);
      border:1px solid var(--border-color);
      border-radius:10px; z-index:1001;
    }
    &[open] .content {
      position: absolute; top: calc(env(safe-area-inset-top, 0px) + 56px); left:0; right:0; bottom:0;
      background: var(--container-white); color: var(--text-color);
      border-radius:12px 12px 0 0; padding:10px; overflow:auto;
      -webkit-overflow-scrolling: touch;
    }
    &[open] .x {
      position: fixed; top: calc(env(safe-area-inset-top, 0px) + 10px);
      right: calc(env(safe-area-inset-right, 0px) + 10px);
      z-index: 1002; width:36px; height:36px; border:1px solid var(--border-color);
      background:var(--container-white); color: var(--text-color);
      border-radius:999px; box-shadow:0 14px 32px rgba(0,0,0,.35);
      display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:900; line-height:1;
    }
    &[open] .close {
      position: fixed; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      z-index: 1002; border:1px solid var(--border-color);
      background:var(--container-white); color: var(--text-color);
      border-radius:999px; padding:10px 14px;
      box-shadow:0 14px 32px rgba(0,0,0,.35); font-weight:800;
    }
  }
`;

/* ---------- clock helpers (match Checkers style) ---------- */
const START_MS = 4 * 60 * 1000; // 4 minutes
const fmtClock = (ms) => {
  ms = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(ms / 60);
  const s = ms % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/* ---------- Arena ---------- */
export default function ReversiArena() {
  const { user } = useContext(AuthContext);
  const SIZE = 8;

  const newBoard = () => {
    const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    b[3][3] = -1; b[4][4] = -1; // white
    b[3][4] = 1;  b[4][3] = 1;  // black
    return b;
  };

  // use a lazy initializer to build the starting board
  const [board, setBoard]   = useState(() => newBoard());
  const [player, setPlayer] = useState(1);       // 1 = black (you), -1 = white (bot/opponent)
  const [status, setStatus] = useState('Pick a mode to start.');
  const [live, setLive]     = useState(false);
  const [mode, setMode]     = useState(null);    // null | 'bot' | 'online'
  const [notice] = useState('');

  // online bits
  const [roomId, setRoomId] = useState(null);
  const [myColor, setMyColor] = useState(1); // 1=black, -1=white
  const myColorRef = useRef(1);              // avoid stale closures
  const [oppName, setOppName] = useState('');
  const socketRef = useRef(null);

  // responsive board size to match Checkers' page proportions
  const [boardSize, setBoardSize] = useState(360);
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth  || 375;
      const vh = window.innerHeight || 667;

      // Reserve some space for header/controls on small screens
      const HEIGHT_RESERVE = 310; // header + mode buttons + paddings
      const WIDTH_RESERVE  = 28;  // panel padding + borders

      const maxByWidth  = Math.floor(vw - WIDTH_RESERVE);
      const maxByHeight = Math.floor(vh - HEIGHT_RESERVE);

      // Clamp so it never gets tiny or too large
      const side = Math.max(260, Math.min(520, Math.min(maxByWidth, maxByHeight)));
      setBoardSize(side);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  /* ---------- clocks ---------- */
  const [bMs, setBms] = useState(START_MS);
  const [wMs, setWms] = useState(START_MS);
  const [clockSince, setClockSince] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  const viewLeft = useCallback((side /* 1=Black, -1=White */) => {
    const base = side === 1 ? bMs : wMs;
    if (clockSince && player === side && live && (mode === 'bot' || mode === 'online')) {
      const elapsed = nowTs - clockSince;
      return Math.max(0, base - elapsed);
    }
    return base;
  }, [bMs, wMs, clockSince, player, live, mode, nowTs]);
  const chargeElapsedToCurrent = useCallback(() => {
    if (!clockSince) return;
    const elapsed = Date.now() - clockSince;
    if (player === 1) setBms(ms => Math.max(0, ms - elapsed));
    else setWms(ms => Math.max(0, ms - elapsed));
    setClockSince(Date.now());
  }, [clockSince, player]);

  /* ---------- rules / move generation ---------- */
  const dirs = useMemo(() => (
    [-1,0,1].flatMap(dx=>[-1,0,1].map(dy=>[dx,dy])).filter(([dx,dy])=>dx||dy)
  ), []);
  const inBounds = (x,y) => x>=0 && x<SIZE && y>=0 && y<SIZE;

  const flipsFrom = useCallback((b, x, y, turn) => {
    if (b[y][x] !== 0) return [];
    const flips = [];
    for (const [dx,dy] of dirs) {
      let nx=x+dx, ny=y+dy; const line=[];
      while (inBounds(nx,ny) && b[ny][nx] === -turn) { line.push([nx,ny]); nx+=dx; ny+=dy; }
      if (line.length && inBounds(nx,ny) && b[ny][nx] === turn) flips.push(...line);
    }
    return flips;
  }, [dirs]);

  const allMoves = useCallback((b, turn) => {
    const mv=[];
    for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) {
      const f = flipsFrom(b, x, y, turn);
      if (f.length) mv.push({x,y,flips:f});
    }
    return mv;
  }, [flipsFrom]);

  const score = (b) => b.flat().reduce((s,v)=>s+v,0);

  const applyMove = (b, mv, turn) => {
    const nb = b.map(r=>r.slice());
    nb[mv.y][mv.x] = turn;
    for (const [fx,fy] of mv.flips) nb[fy][fx] = turn;
    return nb;
  };

  const endGame = useCallback((b) => {
    setLive(false);
    setClockSince(null);
    const s = score(b);
    if (s > 0) setStatus('Black wins!');
    else if (s < 0) setStatus('White wins!');
    else setStatus('Draw!');
  }, []);

  const passIfNeeded = useCallback((b, turn) => {
    const myMoves = allMoves(b, turn);
    if (myMoves.length) return;
    const oppMoves = allMoves(b, -turn);
    if (oppMoves.length) {
      setPlayer(-turn);
      setStatus('No legal move — pass.');
      setClockSince(Date.now());
    } else {
      endGame(b);
    }
  }, [allMoves, endGame]);

  const [resultModal, setResultModal] = useState(null); // { didWin, resultText, trophies, rank, place }
  const awardedRef = useRef(false);

  const perGameRank = (n) => {
    if (n >= 1500) return 'Champion';
    if (n >= 900)  return 'Diamond';
    if (n >= 600)  return 'Platinum';
    if (n >= 400)  return 'Gold';
    if (n >= 250)  return 'Silver';
    if (n >= 100)  return 'Bronze';
    return 'Wood';
  };

  const fetchMyReversiTrophies = useCallback(async () => {
    if (!user?._id) return 0;
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/games/stats/${user._id}`);
      return (data?.trophiesByGame?.reversi) || 0;
    } catch {
      return 0;
    }
  }, [user?._id]);

  const fetchMyOverallPlace = useCallback(async () => {
    if (!user?._id) return null;
    try {
      const q = new URLSearchParams({ limit: '100', userId: user._id });
      const { data } = await axios.get(`${API_BASE_URL}/api/games/leaderboard/overall?${q.toString()}`);
      return data?.me?.rank ?? null;
    } catch {
      return null;
    }
  }, [user?._id]);

  const awardOutcome = useCallback(async (kind) => {
    if (!user?._id || awardedRef.current) return null;
    try {
      const delta = kind === 'win' ? 6 : (kind === 'loss' ? -6 : 0);
      await axios.post(`${API_BASE_URL}/api/games/result`, {
        userId: user._id, gameKey: 'reversi', delta, didWin: kind === 'win',
      });
      awardedRef.current = true;
      try { window.dispatchEvent(new CustomEvent('games:statsUpdated', { detail: { gameKey: 'reversi' } })); } catch {}
      const t = await fetchMyReversiTrophies();
      return t;
    } catch {
      return null;
    }
  }, [user?._id, fetchMyReversiTrophies]);

  const openResultModal = useCallback(async (resultText, trophiesOverride = null, didWinOverride = null) => {
    const didWin = (typeof didWinOverride === 'boolean')
      ? didWinOverride
      : false; // default to loss unless explicitly told draw/win upstream

    const trophies = trophiesOverride ?? (await fetchMyReversiTrophies());
    const place = await fetchMyOverallPlace();
    setResultModal({ didWin, resultText, trophies, rank: perGameRank(trophies), place });
  }, [fetchMyReversiTrophies, fetchMyOverallPlace]);

  /* ---------- derived state ---------- */
  const moves = useMemo(() => allMoves(board, player), [board, player, allMoves]);
  const legalMask = useMemo(() => new Set(moves.map(m=>`${m.x},${m.y}`)), [moves]);

  /* ---------- actions ---------- */
  const startBot = () => {
    setBoard(newBoard());
    setPlayer(1);
    setLive(true);
    setMode('bot');
    setStatus('Practice vs Bot: you are Black. Highest flips wins.');
    setMyColor(1);
    setOppName('Bot');
    // reset clocks and start my clock
    setBms(START_MS); setWms(START_MS); setClockSince(Date.now());
  };

  // simple online stubs (socket wiring retained for compatibility)
  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;

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

    // Prefer SAME tunnel host if the page is on Cloudflare (avoids cross-host WS issues)
    try {
      const po = new URL(window.location.origin);
      const wb = new URL(WS_BASE);
      if (/trycloudflare\.com$/i.test(po.hostname) && po.hostname !== wb.hostname) {
        WS_BASE = po.origin;
      }
    } catch {}

    const s = io(WS_BASE, {
      path: '/api/socket.io',                 // mount under /api (rides existing ingress)
      transports: ['polling', 'websocket'],   // start with polling, upgrade to WS when allowed
      upgrade: true,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 750,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
    });
    socketRef.current = s;

    s.on('connect', () => {
      setStatus('Connected. Queueing…');
      const payload = { userId: user?._id, username: user?.username };
      s.emit('reversi:queue', payload);
    });

    s.on('connect_error', (e) => setStatus(`Socket connect error: ${e?.message || e}`));
    s.on('error', (e) => setStatus(`Socket error: ${e?.message || e}`));
    s.on('reversi:queued', () => setStatus('Looking for an opponent…'));

    s.on('reversi:start', ({ roomId, color, state, black, white }) => {
      setRoomId(roomId);
      const mine = (color === 'b') ? 1 : -1;
      setMyColor(mine);
      myColorRef.current = mine; // NEW
      setOppName(mine === 1 ? (white?.username || 'White') : (black?.username || 'Black'));
      setBoard(state?.board || newBoard());
      setPlayer(state?.turn ?? 1);
      setLive(true);
      awardedRef.current = false;

      setBms(START_MS);
      setWms(START_MS);
      setClockSince(Date.now());

      setMode('online');
      setStatus('Live match started.');
    });

    s.on('reversi:state', (payload) => {
      const state = payload?.state || payload; // tolerate both shapes
      if (!state) return;
      // charge elapsed for side who just moved
      chargeElapsedToCurrent();
      setBoard(state.board);
      setPlayer(state.turn);
      setClockSince(Date.now());
    });

    s.on('reversi:gameover', async ({ roomId: rid, result, reason, winner }) => {
      if (rid && roomId && rid !== roomId) return;
      setClockSince(null);
      setLive(false);
      setMode(null);
      setStatus(`Game over: ${result} (${reason})`);

      // winner is 'b' | 'w' | null (draw)
      const myLetter = myColorRef.current === 1 ? 'b' : 'w';
      const isDraw = winner == null;
      const didWin = !isDraw && (winner === myLetter);

      const trophiesOverride = await awardOutcome(isDraw ? 'draw' : (didWin ? 'win' : 'loss'));
      await openResultModal(result, trophiesOverride, didWin);
      setRoomId(null);
    });

    s.on('reversi:queue-cancelled', () => setStatus('Queue cancelled.'));
    s.on('disconnect', () => setStatus('Disconnected.'));

    return s;
  }, [user?._id, user?.username, awardOutcome, openResultModal, chargeElapsedToCurrent, roomId]);

  useEffect(() => {
  if (mode !== 'online') return;
  const s = socketRef.current;
  if (!s) return;

  // Already matched? Do nothing.
  if (roomId) return;

  let satisfied = false;
  const onQueued = () => { satisfied = true; };
  const onStart  = () => { satisfied = true; };

  s.on('reversi:queued', onQueued);
  s.on('reversi:start',  onStart);

  const t = setTimeout(() => {
    if (!satisfied && s.connected) {
      s.emit('reversi:queue', { userId: user?._id, username: user?.username });
    }
  }, 1500);

  return () => {
    clearTimeout(t);
    s.off('reversi:queued', onQueued);
    s.off('reversi:start',  onStart);
  };
}, [mode, roomId, user?._id, user?.username]);

  const startOnline = () => {
    setBoard(newBoard());
    setLive(false);
    setMode('online');
    setStatus('Connecting…');
    setRoomId(null);
    setBms(START_MS); setWms(START_MS); setClockSince(null);
    const s = connectSocket();
    if (s?.connected) {
      s.emit('reversi:queue', { userId: user?._id, username: user?.username });
    }
  };

  const leaveOnline = () => {
    const s = socketRef.current;

    if (mode === 'online' && s && roomId) {
      s.emit('reversi:resign', { roomId });
      setStatus('You resigned.');
      return;
    }

    if (s) {
      s.emit('reversi:leave', { roomId });
      s.disconnect();
      socketRef.current = null;
    }
    setLive(false);
    setMode(null);
    setRoomId(null);
    setClockSince(null);
  };

  const resign = () => {
    if (mode === 'online') socketRef.current?.emit('reversi:resign', { roomId });
    setClockSince(null);
    setLive(false);
    setStatus('You resigned.');
  };

  const clickCell = (x,y) => {
    if (!live) return;
    // only allow when it's our turn
    if (mode==='bot') {
      if (player!==1) return;
      const mv = moves.find(m=>m.x===x&&m.y===y); if (!mv) return;
      chargeElapsedToCurrent();
      const nb = applyMove(board, mv, 1);
      setBoard(nb);
      setPlayer(-1);
      setClockSince(Date.now()); // start bot clock
      passIfNeeded(nb, -1);
      return;
    }
    if (mode==='online') {
      if (player !== myColor) return;
      const mv = moves.find(m=>m.x===x&&m.y===y); if (!mv) return;
      chargeElapsedToCurrent();
      socketRef.current?.emit('reversi:move', { roomId, x, y });
      setClockSince(Date.now());
    }
  };

  /* ---------- bot move ---------- */
  useEffect(() => {
    if (player === -1 && live && mode === 'bot') {
      const mv = allMoves(board, -1);
      if (!mv.length) { passIfNeeded(board, -1); return; }
      const best = mv.reduce((a,m)=>{
        if (!a || m.flips.length > a.flips.length) return m;
        if (m.flips.length === a.flips.length && Math.random() < 0.5) return m;
        return a;
      }, null);
      const t = setTimeout(()=>{
        // bot is about to move — charge its elapsed first
        chargeElapsedToCurrent();
        const nb = applyMove(board, best, -1);
        setBoard(nb);
        setPlayer(1);
        setClockSince(Date.now()); // start my clock again
        passIfNeeded(nb, 1);
      }, 380);
      return () => clearTimeout(t);
    }
  }, [player, live, mode, board, allMoves, passIfNeeded, chargeElapsedToCurrent]);

  useEffect(() => () => {
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
  }, []);

  /* ---------- rendering helpers ---------- */
  const cellSize = boardSize / SIZE;

  return (
    <Wrap>
      <MobileOnly>
        <MobileDropdown>
          <summary>📊 Reversi stats &amp; leaderboard</summary>
          <button
            type="button"
            className="x"
            onClick={(e) => {
              const details = e.currentTarget.closest('details');
              if (details) details.open = false;
            }}
            aria-label="Close stats"
          >
            ×
          </button>
          <div className="content">
            <GameSidebar gameKey="reversi" title="Reversi" showOnMobile />
          </div>
          <button
            type="button"
            className="close"
            onClick={(e) => {
              const details = e.currentTarget.closest('details');
              if (details) details.open = false;
            }}
            aria-label="Close stats"
          >
            ✕ Close
          </button>
        </MobileDropdown>
      </MobileOnly>
      {/* Left: board */}
      <Panel>
        {/* Opponent name + clock (top) */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 8px', fontWeight:700, fontSize:13, width:'100%', maxWidth:boardSize, boxSizing:'border-box', margin:'0 auto'}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <span>{mode==='bot' ? 'Bot' : (oppName || (myColor===1 ? 'White' : 'Black'))}</span>
          </div>
          <div style={{fontVariantNumeric:'tabular-nums'}}>
            {fmtClock(viewLeft(myColor===1 ? -1 : 1))}
          </div>
        </div>

        {/* Board */}
        <div style={{
          width:boardSize, height:boardSize, maxWidth:'100%', maxHeight:boardSize, borderRadius:12, border:'1px solid #ddd',
          background:'#0f5132', padding:8, boxShadow:'0 8px 24px rgba(0,0,0,.08)', margin:'0 auto', boxSizing:'border-box'
        }}>
          <div style={{
            display:'grid',
            gridTemplateColumns:`repeat(${SIZE}, 1fr)`,
            gridTemplateRows:`repeat(${SIZE}, 1fr)`,
            gap:2, width:'100%', height:'100%'
          }}>
            {board.map((row,y)=>row.map((v,x)=>{
              const isLegal = live && legalMask.has(`${x},${y}`) && (mode==='bot' ? player===1 : myColor===player);
              return (
                <div key={`${x}-${y}`}
                     onClick={()=>isLegal && clickCell(x,y)}
                     style={{
                       background:'#136f43',
                       borderRadius:6,
                       display:'flex', alignItems:'center', justifyContent:'center',
                       cursor:isLegal ? 'pointer' : 'default',
                       position:'relative',
                       boxShadow:'inset 0 1px 0 rgba(255,255,255,.06), inset 0 -1px 0 rgba(0,0,0,.08)'
                     }}>
                  {/* legal move dot */}
                  {isLegal && v===0 && (
                    <div style={{width:cellSize*0.22, height:cellSize*0.22, borderRadius:'50%', background:'rgba(255,255,255,.8)'}} />
                  )}
                  {/* discs */}
                  {v !== 0 && (
                    <div style={{
                      width:cellSize*0.72, height:cellSize*0.72, borderRadius:'50%',
                      background: v===1 ? '#111' : '#f9fafb',
                      boxShadow: v===1
                        ? 'inset 0 3px 8px rgba(255,255,255,.15), inset 0 -4px 8px rgba(0,0,0,.5)'
                        : 'inset 0 3px 8px rgba(0,0,0,.15), inset 0 -4px 8px rgba(0,0,0,.25), 0 1px 0 rgba(0,0,0,.05)'
                    }} />
                  )}
                </div>
              );
            }))}
          </div>
        </div>

        {/* My name + clock (bottom) */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 8px', fontWeight:700, fontSize:13, width:'100%', maxWidth:boardSize, boxSizing:'border-box', margin:'0 auto'}}>
          <span>{user?.username || 'You'}</span>
          <div style={{fontVariantNumeric:'tabular-nums'}}>
            {fmtClock(viewLeft(myColor))}
          </div>
        </div>
      </Panel>

      {/* Right: controls */}
      <Panel>
        <div style={{display:'flex', gap:8}}>
          {!live ? (
            <>
              <Button onClick={startBot}>Practice vs Bot</Button>
              <Button $primary onClick={startOnline}>Play Online</Button>
            </>
          ) : mode==='bot' ? (
            <>
              <Button onClick={()=>startBot()}>Restart Bot</Button>
              <Button onClick={()=>{ setLive(false); setMode(null); setClockSince(null); }}>End</Button>
            </>
          ) : (
            <Button onClick={leaveOnline}>Leave Online</Button>
          )}
          <Button onClick={resign}>Resign</Button>
        </div>
        <div style={{marginTop:10, color:'rgba(230,233,255,0.75)'}}>{status}</div>
        {!!notice && <Alert>{notice}</Alert>}
        <div style={{marginTop:12, fontSize:12, color:'rgba(230,233,255,0.65)'}}>
          Wins vs real players grant <b>+6 trophies</b>. Bot games are unranked.
        </div>
        {resultModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.28)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:30
        }} onClick={()=>setResultModal(null)}>
          <div
            onClick={(e)=>e.stopPropagation()}
            style={{ width:540, maxWidth:'94vw', background:'var(--container-white)', color:'var(--text-color)', borderRadius:14, boxShadow:'0 24px 64px rgba(0,0,0,.45)', border:'1px solid var(--border-color)', padding:16 }}
          >
            <div style={{fontSize:18, fontWeight:800, marginBottom:6}}>
              {resultModal.didWin ? 'You win! 🎉' : (/draw/i.test(resultModal.resultText) ? 'Draw' : 'You lose')}
            </div>
            <div style={{fontSize:13, color:'rgba(230,233,255,0.65)'}}>{resultModal.resultText}</div>
            <div style={{display:'flex', gap:10, alignItems:'center', marginTop:10, padding:'8px 10px', border:'1px solid var(--border-color)', borderRadius:10}}>
              <span style={{fontWeight:800}}>🏆 {resultModal.trophies}</span>
              <span style={{padding:'3px 10px', borderRadius:999, fontSize:12, fontWeight:800, background:'var(--primary-orange)', color:'#000'}}>
                {resultModal.rank}
              </span>
            </div>
            <div style={{marginTop:6, fontSize:12, color:'rgba(230,233,255,0.65)'}}>
              Overall leaderboard place: <b>#{resultModal.place ?? '—'}</b>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:12}}>
              <button onClick={()=>{ setMode(null); setRoomId(null); setResultModal(null); setStatus('Pick a mode to start.'); }} style={{padding:'8px 12px', borderRadius:10, border:'1px solid var(--border-color)', background:'rgba(255,255,255,0.06)', color:'var(--text-color)'}}>Back</button>
              <button onClick={()=>{ setResultModal(null); startBot(); }} style={{padding:'8px 12px', borderRadius:10, border:'1px solid var(--border-color)', background:'rgba(255,255,255,0.06)', color:'var(--text-color)'}}>Play Bot Again</button>
              <button onClick={()=>{ setResultModal(null); startOnline(); }} style={{padding:'8px 12px', borderRadius:10, border:'0', background:'var(--primary-orange)', color:'#000', fontWeight:800}}>Matchmake Online</button>
            </div>
          </div>
        </div>
      )}
      </Panel>
    </Wrap>

  );
}
