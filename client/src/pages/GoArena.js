import React, { useMemo, useState, useContext, useRef, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { io } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

/* ---------- shared look & feel (matches Chess/Checkers) ---------- */
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

/** Go (9x9) – simple liberties/capture; no ko; two passes end the game. */
export default function GoArena() {
  const { user } = useContext(AuthContext);
  const SIZE = 9;

  // 0 empty, 1 black, -1 white
  const [board, setBoard] = useState(Array.from({length:SIZE},()=>Array(SIZE).fill(0)));
  const [live, setLive] = useState(false);
  const [mode, setMode] = useState(null); // null | 'bot' | 'online'
  const [turn, setTurn] = useState(1); // 1 = black, -1 = white
  const [status, setStatus] = useState('Pick a mode to start.');
  const [notice, setNotice] = useState('');
  const [passes, setPasses] = useState(0);
  const [captures, setCaptures] = useState({ black:0, white:0 });

  // online bits
  const [roomId, setRoomId] = useState(null);
  const [myColor, setMyColor] = useState(1); // 1 (black) or -1 (white) in Go terms
  const socketRef = useRef(null);
  const awardedRef = useRef(false);

  const flash = useCallback((msg, ms=1600) => {
    setNotice(msg);
    setTimeout(()=>setNotice(''), ms);
  }, []);

  const inB = (x,y)=>x>=0&&x<SIZE&&y>=0&&y<SIZE;
  const neigh = (x,y)=>[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[x+dx,y+dy]).filter(([nx,ny])=>inB(nx,ny));
  const clone = (b)=>b.map(r=>r.slice());

  const groupAndLibs = (b, x, y) => {
    const color = b[y][x];
    if (!color) return { stones:[], libs:0 };
    const stack=[[x,y]]; const seen=new Set([`${x},${y}`]);
    const stones=[]; let libs=0;
    while(stack.length){
      const [cx,cy]=stack.pop();
      stones.push([cx,cy]);
      for(const [nx,ny] of neigh(cx,cy)){
        if(b[ny][nx]===0) libs++;
        else if(b[ny][nx]===color){
          const k=`${nx},${ny}`; if(!seen.has(k)){ seen.add(k); stack.push([nx,ny]); }
        }
      }
    }
    return {stones, libs};
  };

  // ---- pure apply (returns new board, capture count) ----
  const applyPlace = (b, x, y, who) => {
    if (b[y][x] !== 0) return null;
    const nb = clone(b);
    nb[y][x] = who;

    // capture opponent groups without liberties
    let captured = 0;
    for(const [nx,ny] of neigh(x,y)){
      if(nb[ny][nx] === -who){
        const g = groupAndLibs(nb,nx,ny);
        if(g.libs === 0){ for(const [sx,sy] of g.stones){ nb[sy][sx]=0; captured++; } }
      }
    }
    // suicide prevention
    const gMe = groupAndLibs(nb,x,y);
    if (gMe.libs === 0 && captured === 0) return null;

    return { board: nb, captured };
  };

  const startBot = () => {
    setBoard(Array.from({length:SIZE},()=>Array(SIZE).fill(0)));
    setLive(true);
    setMode('bot');
    setTurn(1);
    setStatus('Practice vs Bot (9×9). Two consecutive passes end the game.');
    setPasses(0);
    setCaptures({black:0, white:0});
  };

  const humanPlace = (x,y) => {
    if (!live || (mode==='online' && myColor!==turn) || board[y][x]!==0) return;
    const res = applyPlace(board, x, y, mode==='online' ? myColor : 1);
    if (!res) return;
    const nb = res.board;
    setBoard(nb);
    if (mode==='bot') setCaptures(c=>({ ...c, black: c.black + res.captured }));
    setPasses(0);

    if (mode==='bot') {
      setTurn(-1);
      setTimeout(()=>botTurn(nb), 350);
    } else {
      socketRef.current?.emit('go:move', { roomId, x, y });
    }
  };

  const botTurn = (bCur) => {
    if (!live || mode!=='bot') return;
    // try random legal up to N attempts, else pass
    const empties=[];
    for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++) if(bCur[y][x]===0) empties.push([x,y]);
    for(let k=0;k<300;k++){
      const pick = empties[Math.floor(Math.random()*empties.length)];
      if (!pick) break;
      const [x,y]=pick;
      const res = applyPlace(bCur, x, y, -1);
      if (!res) continue; // suicide
      const nb = res.board;
      setBoard(nb);
      setCaptures(c=>({ ...c, white: c.white + res.captured }));
      setTurn(1);
      setPasses(0);
      return;
    }
    // pass
    handlePass(-1, bCur);
  };

  const handlePass = (who, bCur) => {
    const next = passes + 1;
    setPasses(next);
    if (mode==='online') {
      if (who === myColor) socketRef.current?.emit('go:pass', { roomId });
      return;
    }
    if (who === 1) { setTurn(-1); setTimeout(()=>botTurn(bCur || board), 300); return; }
    if (next >= 2) {
      // naive scoring: stones + captures
      const flat = (bCur||board).flat();
      const s = flat.reduce((acc,v)=>acc+v, 0);
      const total = flat.length;
      const blackStones = ((s+total)/2)|0;
      const whiteStones = total - blackStones;
      const blackScore = blackStones + captures.black;
      const whiteScore = whiteStones + captures.white;
      const msg = blackScore===whiteScore ? 'Draw.' : (blackScore>whiteScore ? 'You win.' : 'Bot wins.');
      setStatus(`Game over · ${msg}  (B ${blackScore} – W ${whiteScore})`);
      setLive(false);
      setMode(null);
    }
  };

  /* ---------------- ONLINE MODE (mirrors Checkers) ---------------- */
  const awardWin = useCallback(async () => {
    if (!user?._id || awardedRef.current) return;
    try {
      await axios.post(`${API_BASE_URL}/api/games/result`, {
        userId: user._id, gameKey: 'go', delta: 6, didWin: true,
      });
      awardedRef.current = true;
    } catch {}
  }, [user?._id]);

  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const s = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => setStatus('Connected. Queueing…'));
    s.on('go:queued', () => setStatus('Looking for an opponent…'));

    s.on('go:start', ({ roomId, color, state, black, white }) => {
      setBoard(state?.board || Array.from({length:SIZE},()=>Array(SIZE).fill(0)));
      setTurn(state?.turn ?? 1);
      setRoomId(roomId);
      setMode('online');
      setLive(true);
      setPasses(state?.passes || 0);
      setCaptures({ black: state?.captures?.black || 0, white: state?.captures?.white || 0 });
      setMyColor(color === 'b' ? 1 : -1);
      awardedRef.current = false;
      setStatus(`Match found: ${black?.username || 'Black'} vs ${white?.username || 'White'}. You are ${color==='b'?'Black':'White'}.`);
    });

    s.on('go:state', ({ state }) => {
      if (!state) return;
      setBoard(state.board);
      setTurn(state.turn);
      setPasses(state.passes || 0);
      setCaptures({ black: state.captures?.black || 0, white: state.captures?.white || 0 });
    });

    s.on('go:gameover', ({ result, reason }) => {
      setStatus(`Game over: ${result}${reason ? ` (${reason})` : ''}`);
      if (mode === 'online') {
        const winColor = /black wins/i.test(result) ? 1 : (/white wins/i.test(result) ? -1 : null);
        if (winColor && myColor === winColor) awardWin();
      }
      setLive(false);
      setMode(null);
    });

    s.on('go:queue-cancelled', () => setStatus('Queue cancelled.'));
    s.on('disconnect', () => setStatus('Disconnected.'));
    return s;
  }, [mode, myColor, awardWin]);

  const startOnline = () => {
    setMode('online');
    setStatus('Queueing…');
    const s = connectSocket();
    s.emit('go:queue', { userId: user?._id, username: user?.username });
  };

  const leaveOnline = () => {
    const s = socketRef.current;
    if (s) {
      s.emit('go:leave', { roomId });
      s.disconnect();
      socketRef.current = null;
    }
    setMode(null);
    setRoomId(null);
    setLive(false);
    setStatus('Left online mode.');
  };

  const resign = () => {
    if (mode === 'online' && socketRef.current && roomId) socketRef.current.emit('go:resign', { roomId });
    else if (mode === 'bot') setStatus('You resigned.');
  };

  useEffect(() => () => {
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
  }, []);

  /* ---------------- UI ---------------- */
  const grid = useMemo(()=>Array.from({length:SIZE},(_,y)=>Array.from({length:SIZE},(_,x)=>({x,y}))),[SIZE]);

  return (
    <Wrap>
      {/* Left: board */}
      <Panel>
        <div style={{
          width:456, height:456, borderRadius:12, border:'1px solid #ddd',
          background:'#f7e6b5', position:'relative', boxShadow:'0 8px 24px rgba(0,0,0,.08)'
        }}>
          {/* grid lines */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none"
               style={{position:'absolute', inset:8}}>
            {[...Array(SIZE)].map((_,i)=>(
              <line key={'v'+i} x1={(i/(SIZE-1))*100} y1="0" x2={(i/(SIZE-1))*100} y2="100" stroke="#333" strokeWidth="0.6" />
            ))}
            {[...Array(SIZE)].map((_,i)=>(
              <line key={'h'+i} x1="0" y1={(i/(SIZE-1))*100} x2="100" y2={(i/(SIZE-1))*100} stroke="#333" strokeWidth="0.6" />
            ))}
          </svg>
          {/* stones + input */}
          <div style={{position:'absolute', inset:8, display:'grid',
            gridTemplateColumns:`repeat(${SIZE}, 1fr)`,
            gridTemplateRows:`repeat(${SIZE}, 1fr)`}}>
            {grid.flat().map(({x,y})=>{
              const v = board[y][x];
              const canPlay = live && (mode==='bot' ? (turn===1 && v===0) : (myColor===turn && v===0));
              return (
                <div key={`${x}-${y}`} onClick={()=>canPlay && humanPlace(x,y)}
                     style={{position:'relative', cursor: canPlay?'pointer':'default'}}>
                  {v!==0 && (
                    <div style={{
                      position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
                      width:28, height:28, borderRadius:'50%',
                      background: v===1?'#111':'#fff', boxShadow:'0 1px 2px rgba(0,0,0,.25)'
                    }}/>
                  )}
                </div>
              );
            })}
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
          <Button onClick={() => (mode==='bot' ? handlePass(1, board) : (myColor===turn && socketRef.current?.emit('go:pass', {roomId})))}
                  disabled={!live}>
            Pass
          </Button>
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
