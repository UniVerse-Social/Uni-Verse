import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import styled from 'styled-components';
import { io } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

/* ---------- shared look & feel ---------- */
const Wrap = styled.div`display:grid; grid-template-columns: 480px 1fr; gap:16px; align-items:start;`;
const Panel = styled.div`
  border:1px solid var(--border-color); background:var(--container-white);
  border-radius:12px; padding:12px;
`;
const Button = styled.button`
  padding: 8px 12px; border-radius: 10px; border: 1px solid #111; cursor: pointer;
  background: ${p=>p.$primary ? '#111' : '#fff'}; color: ${p=>p.$primary ? '#fff' : '#111'};
`;
const Alert = styled.div`
  margin-top: 10px; padding: 8px 10px; border-radius: 10px;
  border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; font-size: 13px;
`;

/** Reversi/Othello – 8x8, bot = greedy flips */
export default function ReversiArena() {
  const { user } = useContext(AuthContext);
  const SIZE = 8;

  const newBoard = () => {
    const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    b[3][3] = -1; b[4][4] = -1; // white
    b[3][4] = 1;  b[4][3] = 1;  // black
    return b;
  };

  const [board, setBoard]   = useState(newBoard);
  const [player, setPlayer] = useState(1);       // 1 = black (you), -1 = white (bot)
  const [status, setStatus] = useState('Pick a mode to start.');
  const [live, setLive]     = useState(false);
  const [mode, setMode]     = useState(null);    // null | 'bot' | 'online'
  const [notice] = useState('');

  // online bits
  const [roomId, setRoomId] = useState(null);
  const [myColor, setMyColor] = useState(1); // 1=black, -1=white
  const socketRef = useRef(null);
  const awardedRef = useRef(false);

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

  /* ---------------- BOT ---------------- */
  const startBot = () => {
    setBoard(newBoard());
    setPlayer(1);
    setLive(true);
    setMode('bot');
    setStatus('Practice vs Bot: you are Black. Highest flips wins.');
  };

  const passIfNeeded = useCallback((b, turn) => {
    const myMoves  = allMoves(b, turn);
    const oppMoves = allMoves(b, -turn);
    if (!myMoves.length && !oppMoves.length) {
      const s = score(b);
      const msg = s===0 ? 'Draw.' : (s>0 ? 'You win.' : 'Bot wins.');
      setStatus(`Game over · ${msg}  (B ${((s+64)/2)|0} – W ${((64-s)/2)|0})`);
      setLive(false);
      setMode(null);
      return true;
    }
    if (!myMoves.length) {
      if (mode==='bot') setPlayer(-turn);
      else setStatus('No legal move. Passing…');
      return true;
    }
    return false;
  }, [allMoves, mode]);

  useEffect(() => {
    if (!live || mode!=='bot') return;
    if (player === -1) {
      const mv = allMoves(board, -1);
      if (!mv.length) { passIfNeeded(board, -1); return; }
      const best = mv.reduce((a,m)=>{
        if (!a || m.flips.length > a.flips.length) return m;
        if (m.flips.length === a.flips.length && Math.random() < 0.5) return m;
        return a;
      }, null);
      const t = setTimeout(()=>{
        const nb = applyMove(board, best, -1);
        setBoard(nb);
        setPlayer(1);
        passIfNeeded(nb, 1);
      }, 380);
      return () => clearTimeout(t);
    }
  }, [player, live, mode, board, allMoves, passIfNeeded]);

  const moves = live ? allMoves(board, mode==='bot' ? player : myColor) : [];
  const legalMask = new Set(moves.map(m=>`${m.x},${m.y}`));

  const clickCell = (x,y) => {
    if (!live) return;
    if (mode==='bot') {
      if (player!==1) return;
      const mv = moves.find(m=>m.x===x&&m.y===y); if (!mv) return;
      const nb = applyMove(board, mv, 1);
      setBoard(nb);
      setPlayer(-1);
      passIfNeeded(nb, -1);
      return;
    }
    // online
    if (mode==='online') {
      if (myColor !== (Number.isInteger(board[0][0]) ? (myColor) : myColor)) {} // noop – keep types happy
      if (myColor !== (board && myColor)) {} // no-op
      if (myColor !== 1 && myColor !== -1) return;
      if (myColor !== (moves.length ? (moves[0] && (myColor)) : myColor)) {} // noop

      const mv = moves.find(m=>m.x===x&&m.y===y); if (!mv) return;
      socketRef.current?.emit('reversi:move', { roomId, x, y });
    }
  };

  /* ---------------- ONLINE (mirrors Checkers) ---------------- */
  const awardWin = useCallback(async () => {
    if (!user?._id || awardedRef.current) return;
    try {
      await axios.post(`${API_BASE_URL}/api/games/result`, {
        userId: user._id, gameKey: 'reversi', delta: 6, didWin: true,
      });
      awardedRef.current = true;
    } catch {}
  }, [user?._id]);

  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const s = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => setStatus('Connected. Queueing…'));
    s.on('reversi:queued', () => setStatus('Looking for an opponent…'));

    s.on('reversi:start', ({ roomId, color, state, black, white }) => {
      setBoard(state?.board || newBoard());
      setPlayer(color==='b' ? 1 : -1);
      setRoomId(roomId);
      setMode('online');
      setLive(true);
      setMyColor(color==='b' ? 1 : -1);
      awardedRef.current = false;
      setStatus(`Match found: ${black?.username || 'Black'} vs ${white?.username || 'White'}. You are ${color==='b'?'Black':'White'}.`);
    });

    s.on('reversi:state', ({ state }) => {
      if (!state) return;
      setBoard(state.board);
      // compute who to move from state.turn (1/-1)
      setPlayer(state.turn);
    });

    s.on('reversi:gameover', ({ result, reason }) => {
      setStatus(`Game over: ${result}${reason ? ` (${reason})` : ''}`);
      if (mode === 'online') {
        const winColor = /black wins/i.test(result) ? 1 : (/white wins/i.test(result) ? -1 : null);
        if (winColor && myColor === winColor) awardWin();
      }
      setLive(false);
      setMode(null);
    });

    s.on('reversi:queue-cancelled', () => setStatus('Queue cancelled.'));
    s.on('disconnect', () => setStatus('Disconnected.'));
    return s;
  }, [mode, myColor, awardWin]);

  const startOnline = () => {
    setMode('online');
    setStatus('Queueing…');
    const s = connectSocket();
    s.emit('reversi:queue', { userId: user?._id, username: user?.username });
  };

  const leaveOnline = () => {
    const s = socketRef.current;
    if (s) {
      s.emit('reversi:leave', { roomId });
      s.disconnect();
      socketRef.current = null;
    }
    setMode(null);
    setRoomId(null);
    setLive(false);
    setStatus('Left online mode.');
  };

  const resign = () => {
    if (mode === 'online' && socketRef.current && roomId) socketRef.current.emit('reversi:resign', { roomId });
    else if (mode === 'bot') setStatus('You resigned.');
  };

  useEffect(() => () => {
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
  }, []);

  return (
    <Wrap>
      {/* Left: board */}
      <Panel>
        <div style={{
          width:456, height:456, borderRadius:12, border:'1px solid #ddd',
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
                       position:'relative', cursor: isLegal ? 'pointer':'default',
                       border:'1px solid rgba(0,0,0,.2)', borderRadius:6
                     }}>
                  {v!==0 && (
                    <div style={{
                      position:'absolute', inset:6, borderRadius:'50%',
                      background: v===1 ? '#111' : '#f8fafc',
                      boxShadow: v===1? 'inset 0 1px 0 rgba(255,255,255,.15)':'inset 0 1px 0 rgba(0,0,0,.15)'
                    }}/>
                  )}
                  {v===0 && live && legalMask.has(`${x},${y}`) && (
                    <div style={{
                      position:'absolute', inset:'calc(50% - 6px)',
                      width:12, height:12, borderRadius:'50%',
                      background:'rgba(255,255,255,.6)'
                    }}/>
                  )}
                </div>
              );
            }))}
          </div>
        </div>
      </Panel>

      {/* Right: controls */}
      <Panel>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <Button onClick={startBot}>Practice vs Bot</Button>
          {mode !== 'online' ? (
            <Button $primary onClick={startOnline}>Play Online</Button>
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
