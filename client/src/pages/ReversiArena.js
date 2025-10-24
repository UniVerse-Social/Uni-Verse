import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import styled from 'styled-components';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

/* ---------- shared look & feel ---------- */
const Wrap = styled.div`display:grid; grid-template-columns: 460px 1fr; gap:16px; align-items:start;`;
const Panel = styled.div`
  border:1px solid var(--border-color); background:var(--container-white);
  border-radius:12px; padding:12px;
`;
const Button = styled.button`
  padding: 8px 12px; border-radius: 10px; border: 1px solid #111; cursor: pointer;
  background: ${p=>p.$primary ? '#111' : '#fff'}; color: ${p=>p.$primary ? '#fff' : '#111'};
  font-weight: 700; font-size: 14px;
`;
const Alert = styled.div`
  margin-top:12px; background:#fff7ed; border:1px solid #fed7aa; color:#9a3412;
  padding:10px 12px; border-radius:10px; font-size:13px;
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
  const [oppName, setOppName] = useState('');
  const socketRef = useRef(null);

  // responsive board size to match Checkers' page proportions
  const [boardSize, setBoardSize] = useState(432);
  useEffect(() => {
    const calc = () => {
      const vh = window.innerHeight || 900;
      // closely matches the Checkers arena sizing
      const fit = Math.min(444, Math.floor(vh - 320));
      setBoardSize(Math.max(380, fit));
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
  const ensureSocket = () => {
    if (!socketRef.current) {
      socketRef.current = io(API_BASE_URL, { path: '/socket.io', transports: ['websocket'] });
    }
    return socketRef.current;
  };

  const startOnline = async () => {
    try {
      ensureSocket();
      setBoard(newBoard());
      setLive(true);
      setMode('online');
      setMyColor(1);
      setOppName('Opponent');
      setStatus('Online match: waiting for move…');
      setBms(START_MS); setWms(START_MS); setClockSince(Date.now());
      // Attach minimal listeners if server broadcasts state (optional)
      const s = ensureSocket();
      s.off('reversi:state').on('reversi:state', (state) => {
        // charge the side who just moved
        chargeElapsedToCurrent();
        setBoard(state.board);
        setPlayer(state.turn);
        setClockSince(Date.now());
      });
      s.off('reversi:start').on('reversi:start', ({ roomId, black, white, state, color }) => {
        const mine = (color==='b') ? 1 : -1;
        setRoomId(roomId);
        setMyColor(mine);
        setOppName(mine === 1 ? (white?.username || 'White') : (black?.username || 'Black'));
        setBoard(state?.board || newBoard());
        setPlayer(state?.turn ?? 1);
        setStatus(`Match found: ${black?.username || 'Black'} vs ${white?.username || 'White'}. You are ${mine===1?'Black':'White'}.`);
        setBms(START_MS); setWms(START_MS); setClockSince(Date.now());
      });
    } catch (e) {
      console.error(e);
      // could not start online match
    }
  };

  const leaveOnline = () => {
    setLive(false);
    setMode(null);
    setClockSince(null);
    if (socketRef.current) socketRef.current.emit?.('reversi:leave', { roomId });
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
      {/* Left: board */}
      <Panel>
        {/* Opponent name + clock (top) */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 8px', fontWeight:700, fontSize:13, width:boardSize, boxSizing:'border-box'}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <span>{mode==='bot' ? 'Bot' : (oppName || (myColor===1 ? 'White' : 'Black'))}</span>
          </div>
          <div style={{fontVariantNumeric:'tabular-nums'}}>
            {fmtClock(viewLeft(myColor===1 ? -1 : 1))}
          </div>
        </div>

        {/* Board */}
        <div style={{
          width:boardSize, height:boardSize, borderRadius:12, border:'1px solid #ddd',
          background:'#0f5132', padding:8, boxShadow:'0 8px 24px rgba(0,0,0,.08)'
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
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 8px', fontWeight:700, fontSize:13, width:boardSize, boxSizing:'border-box'}}>
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
        <div style={{marginTop:10, color:'#555'}}>{status}</div>
        {!!notice && <Alert>{notice}</Alert>}
        <div style={{marginTop:12, fontSize:12, color:'#6b7280'}}>
          Wins vs real players grant <b>+6 trophies</b>. Bot games are unranked.
        </div>
      </Panel>
    </Wrap>
  );
}
