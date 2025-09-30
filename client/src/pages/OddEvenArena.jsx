import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

const Box = styled.div`
  border:1px solid #e5e7eb; border-radius:12px; padding:10px; background:#f9fafb;
`;

/** Odd/Even marbles game – start at 10 each. Chooser secretly wagers; Guesser calls Odd/Even. */
export default function OddEvenArena() {
  const { user } = useContext(AuthContext);

  const [mode, setMode] = useState(null); // null | 'bot' | 'online'
  const [status, setStatus] = useState('Pick a mode to start.');
  const [notice, setNotice] = useState('');

  // state
  const [me, setMe] = useState(10);
  const [op, setOp] = useState(10);
  const [turn, setTurn] = useState('me'); // whose turn to choose (chooser)
  const [pending, setPending] = useState(null); // if I’m chooser: my hidden wager; if opponent is chooser, server keeps it
  const [lastRound, setLastRound] = useState(null); // { chooser:'me'|'op', wager, guess:'odd'|'even', result:+/-/0 }

  // Online
  const [roomId, setRoomId] = useState(null);
  const socketRef = useRef(null);
  const awardedRef = useRef(false);
  const [setMyRole] = useState('p1'); // for ordering only

  const flash = useCallback((msg, ms=1600) => {
    setNotice(msg);
    setTimeout(()=>setNotice(''), ms);
  }, []);

  /* ---------------- BOT ---------------- */
  const resetLocal = useCallback(() => {
    setMe(10); setOp(10);
    setTurn('me'); setPending(null); setLastRound(null);
  }, []);

  const startBot = () => {
    setMode('bot');
    setStatus('Practice vs Bot — you start as Chooser.');
    resetLocal();
  };

  const botAct = useCallback(() => {
    if (mode!=='bot') return;
    if (turn==='op') {
      // Opponent (bot) chooses a wager secretly
      const wager = Math.max(1, Math.min(op, Math.ceil(Math.random()*Math.max(1, Math.min(3, op)))));
      setTimeout(()=> {
        // you guess odd/even (UI click)
        setPending({ chooser:'op', wager }); // store for resolution when I guess
      }, 300);
    } else {
      // I chose; bot guesses with a simple rule: if I have <=3, guess parity to maximize chance near 1..3
      // But we only resolve after my wager is set -> this branch used when I’m guesser after swap
    }
  }, [mode, turn, op]);

  // When pending belongs to 'op' and I press a guess, resolve
  const doGuess = (guess) => {
    if (mode==='bot') {
      if (!pending || pending.chooser!=='op') return;
      const wager = pending.wager;
      const isOdd = (wager % 2) !== 0;
      const win = (guess==='odd' ? isOdd : !isOdd);
      if (win) { setMe(m=>m+wager); setOp(o=>o-wager); setLastRound({ chooser:'op', wager, guess, result:+wager }); }
      else { setMe(m=>m-wager); setOp(o=>o+wager); setLastRound({ chooser:'op', wager, guess, result:-wager }); }
      setPending(null);
      setTurn('me'); // roles swap each round
      return;
    }
    // ONLINE: send guess to server
    socketRef.current?.emit('oddeven:guess', { roomId, guess });
  };

  const submitWager = (w) => {
    if (w<=0 || w>me) { flash('Invalid wager'); return; }
    if (mode==='bot') {
      setPending({ chooser:'me', wager:w });
      // bot guesses
      const guess = Math.random()<0.5 ? 'odd' : 'even';
      const isOdd = (w % 2) !== 0;
      const win = (guess==='odd' ? isOdd : !isOdd);
      if (win) { setOp(o=>o+w); setMe(m=>m-w); setLastRound({ chooser:'me', wager:w, guess, result:-w }); }
      else { setOp(o=>o-w); setMe(m=>m+w); setLastRound({ chooser:'me', wager:w, guess, result:+w }); }
      setPending(null);
      setTurn('op');
      return;
    }
    // ONLINE: chooser sends wager to server, hidden to opponent until guessed
    socketRef.current?.emit('oddeven:choose', { roomId, wager: w });
    setPending({ chooser:'me', wager: w });
  };

  useEffect(() => {
    if (mode==='bot') botAct();
  }, [mode, turn, botAct]);

  useEffect(() => {
    if (me<=0 || op<=0) {
      const msg = me<=0 ? 'Bot wins' : 'You win';
      setStatus(`Game over · ${msg}`);
      setMode(null);
    }
  }, [me, op]);

  /* ---------------- ONLINE ---------------- */
  const awardWin = useCallback(async () => {
    if (!user?._id || awardedRef.current) return;
    try {
      await axios.post(`${API_BASE_URL}/api/games/result`, {
        userId: user._id, gameKey: 'oddeven', delta: 6, didWin: true,
      });
      awardedRef.current = true;
    } catch {}
  }, [user?._id]);

  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const s = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => setStatus('Connected. Queueing…'));
    s.on('oddeven:queued', () => setStatus('Looking for an opponent…'));

    s.on('oddeven:start', ({ roomId, role, state, p1, p2 }) => {
      setRoomId(roomId); setMode('online'); awardedRef.current = false;
      setMyRole(role);
      setMe(state?.me || 10); setOp(state?.op || 10);
      setTurn(state?.turn || (role==='p1' ? 'me' : 'op'));
      setStatus(`Match found: ${p1?.username || 'P1'} vs ${p2?.username || 'P2'} — You are ${role==='p1'?'Player 1':'Player 2'}.`);
      setPending(null); setLastRound(null);
    });

    s.on('oddeven:state', ({ state, reveal }) => {
      setMe(state.me); setOp(state.op); setTurn(state.turn);
      if (reveal) setLastRound(reveal); // show resolved round (chooser, wager, guess, result)
      setPending(null);
    });

    s.on('oddeven:gameover', ({ result, reason }) => {
      setStatus(`Game over: ${result}${reason ? ` (${reason})` : ''}`);
      setMode(null);
      if (/you win/i.test(result)) awardWin();
    });

    s.on('oddeven:queue-cancelled', () => setStatus('Queue cancelled.'));
    s.on('disconnect', () => setStatus('Disconnected.'));
    return s;
  }, [awardWin]);

  const startOnline = () => {
    setMode('online');
    setStatus('Queueing…');
    const s = connectSocket();
    s.emit('oddeven:queue', { userId: user?._id, username: user?.username });
  };

  const leaveOnline = () => {
    const s = socketRef.current;
    if (s) {
      s.emit('oddeven:leave', { roomId });
      s.disconnect();
      socketRef.current = null;
    }
    setMode(null);
    setRoomId(null);
    setStatus('Left online mode.');
  };

  const resign = () => {
    if (mode === 'online' && socketRef.current && roomId) socketRef.current.emit('oddeven:resign', { roomId });
    else if (mode === 'bot') setStatus('You resigned.');
  };

  useEffect(() => () => {
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
  }, []);

  /* ---------------- UI ---------------- */
  const canChoose = mode && (turn==='me') && (me>0) && (mode!=='online' || true);
  const canGuess  = mode && (turn==='op') && (op>0);

  const [wagerInput, setWagerInput] = useState('');

  return (
    <Wrap>
      {/* Left: board/info */}
      <Panel>
        <div style={{
          width:456, borderRadius:12, border:'1px solid #ddd',
          background:'#f8fafc', padding:10, boxShadow:'0 8px 24px rgba(0,0,0,.08)'
        }}>
          <Box>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              <div>
                <div style={{fontWeight:900, fontSize:16}}>You</div>
                <div>Marbles: <b>{me}</b></div>
                <div>Role: {turn==='me' ? <b>Chooser</b> : 'Guesser'}</div>
              </div>
              <div>
                <div style={{fontWeight:900, fontSize:16}}>Opponent</div>
                <div>Marbles: <b>{op}</b></div>
                <div>Role: {turn==='op' ? <b>Chooser</b> : 'Guesser'}</div>
              </div>
            </div>
          </Box>

          <div style={{height:8}}/>

          <Box>
            <div style={{fontWeight:900, marginBottom:6}}>This Round</div>
            {turn==='me' ? (
              <div>
                <div style={{fontSize:12, color:'#6b7280', marginBottom:6}}>You are the <b>Chooser</b>. Secretly pick a wager.</div>
                <div style={{display:'flex', gap:8}}>
                  <input type="number" min="1" max={me} value={wagerInput}
                         onChange={e=>setWagerInput(e.target.value)}
                         style={{flex:'0 0 120px', padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:8}} />
                  <Button onClick={()=>submitWager(Number(wagerInput)||0)} disabled={!canChoose}>Wager</Button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{fontSize:12, color:'#6b7280', marginBottom:6}}>Opponent is the <b>Chooser</b>. Guess their parity.</div>
                <div style={{display:'flex', gap:8}}>
                  <Button onClick={()=>doGuess('odd')}  disabled={!canGuess}>Guess Odd</Button>
                  <Button onClick={()=>doGuess('even')} disabled={!canGuess}>Guess Even</Button>
                </div>
              </div>
            )}
            {pending && pending.chooser==='me' && (
              <div style={{marginTop:8, fontSize:12, color:'#6b7280'}}>Your wager is locked in. Waiting for opponent’s guess…</div>
            )}
          </Box>

          <div style={{height:8}}/>

          <Box>
            <div style={{fontWeight:900, marginBottom:6}}>Last Result</div>
            {!lastRound ? (
              <div style={{color:'#6b7280'}}>No rounds yet.</div>
            ) : (
              <div>
                <div>Chooser: <b>{lastRound.chooser==='me'?'You':'Opponent'}</b></div>
                <div>Wager: <b>{lastRound.wager}</b> • Guess: <b>{lastRound.guess}</b></div>
                <div>Outcome: <b style={{color:lastRound.result>0?'#059669':'#b91c1c'}}>
                  {lastRound.result>0? `+${lastRound.result}` : lastRound.result}
                </b></div>
              </div>
            )}
          </Box>
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
