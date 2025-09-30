import React, { useMemo, useState, useCallback, useContext, useRef, useEffect } from 'react';
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

/* ---------- pure helpers ---------- */
const colorOf = (pc) => (pc ? pc[0] : null);
const typeOf  = (pc) => (pc ? pc[1] : null);
const inB     = (x, y, W, H) => x >= 0 && x < W && y >= 0 && y < H;

export default function ShogiArena() {
  const { user } = useContext(AuthContext);
  const H = 9, W = 9;

  const start = () => {
    const e = Array.from({ length: H }, () => Array(W).fill(''));
    const top = ['wL','wN','wS','wG','wK','wG','wS','wN','wL'];
    const bot = ['bL','bN','bS','bG','bK','bG','bS','bN','bL'];
    e[0] = top.slice();
    e[1][1] = 'wR'; e[1][7] = 'wB';
    for (let i = 0; i < 9; i++) e[2][i] = 'wP';

    for (let i = 0; i < 9; i++) e[6][i] = 'bP';
    e[7][1] = 'bB'; e[7][7] = 'bR';
    e[8] = bot.slice();
    return e;
  };

  const [board, setBoard] = useState(start);
  const [turn, setTurn]   = useState('b');          // 'b' = you
  const [sel, setSel]     = useState(null);
  const [live, setLive]   = useState(false);
  const [mode, setMode]   = useState(null);         // null | 'bot' | 'online'
  const [status, setStatus] = useState('Pick a mode to start.');
  const [notice, setNotice] = useState('');

  // online bits
  const [roomId, setRoomId] = useState(null);
  const [myColor, setMyColor] = useState('b');
  const socketRef = useRef(null);
  const awardedRef = useRef(false);

  const flash = useCallback((msg, ms=1600) => {
    setNotice(msg);
    setTimeout(()=>setNotice(''), ms);
  }, []);

  /* -------- move generation (stable) -------- */
  const rays = useCallback((b, x, y, side, dirs) => {
    const mv = [];
    for (const [dx, dy] of dirs) {
      let nx = x + dx, ny = y + dy;
      while (inB(nx, ny, W, H)) {
        const p = b[ny][nx];
        if (!p) mv.push([nx, ny]);
        else { if (colorOf(p) !== side) mv.push([nx, ny]); break; }
        nx += dx; ny += dy;
      }
    }
    return mv;
  }, []);
  const steps = useCallback((b, x, y, side, dirs) => {
    const mv = [];
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (!inB(nx, ny, W, H)) continue;
      const p = b[ny][nx];
      if (!p || colorOf(p) !== side) mv.push([nx, ny]);
    }
    return mv;
  }, []);
  const genMoves = useCallback((b, x, y) => {
    const pc = b[y][x]; if (!pc) return [];
    const side = colorOf(pc), t = typeOf(pc);
    const f = side === 'b' ? -1 : 1;
    switch (t) {
      case 'K': return steps(b, x, y, side, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]);
      case 'R': return rays(b, x, y, side, [[1,0],[-1,0],[0,1],[0,-1]]);
      case 'B': return rays(b, x, y, side, [[1,1],[-1,1],[1,-1],[-1,-1]]);
      case 'G': return steps(b, x, y, side, [[1,0],[-1,0],[0,1],[0,-1],[1,f],[-1,f]]);
      case 'S': return steps(b, x, y, side, [[0,f],[1,f],[-1,f],[1,-f],[-1,-f]]);
      case 'N': return steps(b, x, y, side, [[1,2*f],[-1,2*f]]);
      case 'L': return rays(b, x, y, side, [[0,f]]);
      case 'P': return steps(b, x, y, side, [[0,f]]);
      default:  return [];
    }
  }, [rays, steps]);

  const allMoves = (b, side) => {
    const out = [];
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
      const p=b[y][x]; if (!p || colorOf(p)!==side) continue;
      for (const [nx,ny] of genMoves(b,x,y)) out.push({x,y,nx,ny});
    }
    return out;
  };

  // ---- pure apply (returns new board + mark if king captured) ----
  const applyMove = (b, m) => {
    const nb = b.map(r=>r.slice());
    const from = nb[m.y][m.x];
    const to   = nb[m.ny][m.nx];
    nb[m.ny][m.nx] = from; nb[m.y][m.x] = '';
    const ended = typeOf(to) === 'K' ? (colorOf(from) === 'b' ? 'You win.' : 'Bot wins.') : null;
    return { board: nb, ended };
  };

  /* ---------------- BOT ---------------- */
  const startBot = () => {
    setBoard(start());
    setTurn('b');
    setSel(null);
    setLive(true);
    setMode('bot');
    setStatus('Practice vs Bot (simplified shogi: no drops/promotions).');
  };

  const clickSquare = (x,y) => {
    if (!live) return;
    const pc = board[y][x];

    // select own piece
    if (!sel) { if (pc && colorOf(pc)===turn) setSel({x,y}); return; }

    // reselect
    if (pc && colorOf(pc)===turn) { setSel({x,y}); return; }

    // attempt move
    const legal = genMoves(board, sel.x, sel.y).some(([nx,ny]) => nx===x && ny===y);
    if (!legal) { setSel(null); return; }

    if (mode==='bot') {
      const { board: nb, ended } = applyMove(board, {x:sel.x,y:sel.y,nx:x,ny:y});
      setBoard(nb); setSel(null);
      if (ended) { setLive(false); setMode(null); setStatus(`Game over · ${ended}`); return; }
      setTurn('w');
      setTimeout(()=>{
        const moves = allMoves(nb, 'w');
        if (!moves.length) { setStatus('Game over · You win (bot has no moves).'); setLive(false); setMode(null); return; }
        const m = moves[Math.floor(Math.random()*moves.length)];
        const res = applyMove(nb, m);
        setBoard(res.board);
        if (res.ended) { setLive(false); setMode(null); setStatus(`Game over · ${res.ended}`); }
        else { setTurn('b'); }
      }, 380);
      return;
    }

    // online
    if (mode==='online') {
      if (turn !== myColor) { flash('Not your turn.'); return; }
      socketRef.current?.emit('shogi:move', { roomId, move: {x:sel.x, y:sel.y, nx:x, ny:y} });
      setSel(null);
    }
  };

  /* ---------------- ONLINE (mirrors Checkers) ---------------- */
  const awardWin = useCallback(async () => {
    if (!user?._id || awardedRef.current) return;
    try {
      await axios.post(`${API_BASE_URL}/api/games/result`, {
        userId: user._id, gameKey: 'shogi', delta: 6, didWin: true,
      });
      awardedRef.current = true;
    } catch {}
  }, [user?._id]);

  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const s = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => setStatus('Connected. Queueing…'));
    s.on('shogi:queued', () => setStatus('Looking for an opponent…'));

    s.on('shogi:start', ({ roomId, color, state, black, white }) => {
      setBoard(state?.board || start());
      setTurn(state?.turn || 'b');
      setRoomId(roomId);
      setMode('online');
      setLive(true);
      setMyColor(color); // 'b' or 'w'
      awardedRef.current = false;
      setStatus(`Match found: ${black?.username || 'Black'} vs ${white?.username || 'White'}. You are ${color==='b'?'Black':'White'}.`);
    });

    s.on('shogi:state', ({ state }) => {
      if (!state) return;
      setBoard(state.board);
      setTurn(state.turn);
    });

    s.on('shogi:gameover', ({ result, reason }) => {
      setStatus(`Game over: ${result}${reason ? ` (${reason})` : ''}`);
      if (mode === 'online') {
        const winColor = /black wins/i.test(result) ? 'b' : (/white wins/i.test(result) ? 'w' : null);
        if (winColor && myColor === winColor) awardWin();
      }
      setLive(false);
      setMode(null);
    });

    s.on('shogi:queue-cancelled', () => setStatus('Queue cancelled.'));
    s.on('disconnect', () => setStatus('Disconnected.'));
    return s;
  }, [mode, myColor, awardWin]);

  const startOnline = () => {
    setMode('online');
    setStatus('Queueing…');
    const s = connectSocket();
    s.emit('shogi:queue', { userId: user?._id, username: user?.username });
  };

  const leaveOnline = () => {
    const s = socketRef.current;
    if (s) {
      s.emit('shogi:leave', { roomId });
      s.disconnect();
      socketRef.current = null;
    }
    setMode(null);
    setRoomId(null);
    setLive(false);
    setStatus('Left online mode.');
  };

  const resign = () => {
    if (mode === 'online' && socketRef.current && roomId) socketRef.current.emit('shogi:resign', { roomId });
    else if (mode === 'bot') setStatus('You resigned.');
  };

  useEffect(() => () => {
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
  }, []);

  const legalSet = useMemo(()=>{
    if (!sel) return new Set();
    return new Set(genMoves(board, sel.x, sel.y).map(([nx,ny])=>`${nx},${ny}`));
  }, [sel, board, genMoves]);

  return (
    <Wrap>
      {/* Left: board */}
      <Panel>
        <div style={{
          width:456, height:456, borderRadius:12, border:'1px solid #ddd',
          background:'#f1d6a3', padding:6, boxShadow:'0 8px 24px rgba(0,0,0,.08)'
        }}>
          <div style={{
            display:'grid',
            gridTemplateColumns:`repeat(${W}, 1fr)`,
            gridTemplateRows:`repeat(${H}, 1fr)`,
            width:'100%', height:'100%'
          }}>
            {board.map((row,y)=>row.map((pc,x)=>{
              const k=`${x}-${y}`;
              const isSel = sel && sel.x===x && sel.y===y;
              const can = legalSet.has(`${x},${y}`);
              return (
                <div key={k} onClick={()=>clickSquare(x,y)}
                  style={{
                    position:'relative', border:'1px solid rgba(0,0,0,.25)',
                    background: (x+y)%2? '#f7e7bf' : '#f3deae',
                    cursor: live ? 'pointer':'default',
                    boxShadow: isSel ? 'inset 0 0 0 3px #111' : (can ? 'inset 0 0 0 2px #1f2937' : 'none')
                  }}>
                  {!!pc && (
                    <div style={{
                      position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
                      width:'90%', height:'70%', background: colorOf(pc)==='b'?'#222':'#fff',
                      color: colorOf(pc)==='b'?'#fff':'#111',
                      borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:900, fontSize:18, letterSpacing:1
                    }}>
                      {pieceGlyph(pc)}
                    </div>
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

function pieceGlyph(pc){
  const t = pc[1];
  const map = { K:'王', R:'飛', B:'角', G:'金', S:'銀', N:'桂', L:'香', P:'歩' };
  return map[t] || t;
}
