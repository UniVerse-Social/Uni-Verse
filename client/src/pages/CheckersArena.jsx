// client/src/pages/CheckersArena.jsx
import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useMatchmaking } from '../games/useMatchmaking';
import { AuthContext } from '../App';
import { useContext } from 'react';

const Panel = styled.div`border:1px solid var(--border-color);background:var(--container-white);border-radius:12px;padding:12px;`;
const Button = styled.button`
  padding:8px 12px;border-radius:10px;border:1px solid #111;cursor:pointer;
  background:${p=>p.$primary?'#111':'#fff'};color:${p=>p.$primary?'#fff':'#111'};
`;
const BoardWrap = styled.div`display:grid;grid-template-columns:repeat(8,42px);gap:2px;`;

function initBoard(){
  const b = Array.from({length:8},()=>Array(8).fill(null));
  for (let r=0;r<3;r++) for (let c=0;c<8;c++) if ((r+c)%2===1) b[r][c]='b';
  for (let r=5;r<8;r++) for (let c=0;c<8;c++) if ((r+c)%2===1) b[r][c]='w';
  return b;
}
const dark = (r,c)=> (r+c)%2===1;

export default function CheckersArena({ onResult }) {
  const { user } = useContext(AuthContext);
  const [mode, setMode] = useState(null); // 'bot' | 'online'
  const mm = useMatchmaking('checkers', user);
  const myColor = useMemo(() => mode==='online' ? (mm.role==='A' ? 'w' : 'b') : 'w', [mm.role, mode]);

  const [board, setBoard] = useState(initBoard);
  const [turn, setTurn] = useState('w');
  const [sel, setSel] = useState(null);
  const [status, setStatus] = useState('Pick a mode.');

  const reset = (as='w') => { setBoard(initBoard()); setTurn('w'); setSel(null); setStatus(`You are ${as==='w'?'White':'Black'}.`); };

  // --- ONLINE ---
  useEffect(()=>{
    if (mode!=='online') return;
    const off = mm.on((type, payload)=>{
      if (type==='state') {
        setBoard(payload.board); setTurn(payload.turn);
      }
      if (type==='over') {
        setStatus(payload.result || 'Game over.');
        onResult('checkers', payload.delta, payload.didWin);
      }
    });
    return off;
  }, [mode]); // eslint-disable-line

  const legal = (b, sr, sc, r, c) => {
    const me = b[sr][sc]; if (!me) return false;
    const dr = r - sr, dc = c - sc; const dir = me==='w' ? -1 : 1;
    const step = (dr===dir && Math.abs(dc)===1 && !b[r][c]);
    const jump = (dr===2*dir && Math.abs(dc)===2 && b[sr+dir]?.[sc+(dc/2)] && b[sr+dir][sc+(dc/2)]!==me && !b[r][c]);
    return step || jump;
  };

  const apply = (b, sr, sc, r, c) => {
    const me = b[sr][sc]; const nb = b.map(row=>row.slice());
    const dr = r - sr, dc = c - sc;
    nb[r][c]=me; nb[sr][sc]=null;
    const dir = me==='w' ? -1 : 1;
    if (Math.abs(dr)===2) nb[sr+dir][sc+(dc/2)]=null;
    return nb;
  };

  const winnerDelta = (b) => {
    const flat = b.flat();
    const hasW = flat.includes('w'), hasB = flat.includes('b');
    if (!hasB) return { res:'White wins', delta:+12, didWin: myColor==='w' };
    if (!hasW) return { res:'Black wins', delta:+12, didWin: myColor==='b' };
    return null;
  };

  const move = (sr,sc,r,c) => {
    if (!dark(r,c) || !legal(board, sr, sc, r, c)) { setSel(null); return; }
    if (mode==='online' && turn!==myColor) return; // not your turn
    const nb = apply(board, sr, sc, r, c);
    setBoard(nb); setSel(null); const nt = turn==='w'?'b':'w'; setTurn(nt);

    if (mode==='online') {
      mm.send('state', { board: nb, turn: nt });
      const w = winnerDelta(nb); if (w) { mm.send('over', w); setStatus(w.res); onResult('checkers', w.delta, w.didWin); }
    } else {
      // bot reply
      const w = winnerDelta(nb); if (w) { setStatus(w.res); onResult('checkers', w.delta, w.didWin); return; }
      setTimeout(botReply, 400);
    }
  };

  const botReply = () => {
    // random legal
    const moves=[];
    for(let sr=0;sr<8;sr++) for(let sc=0;sc<8;sc++) if (board[sr][sc]==='b')
      for(let r=0;r<8;r++) for(let c=0;c<8;c++) if (dark(r,c) && legal(board, sr, sc, r, c)) moves.push([sr,sc,r,c]);
    if (!moves.length) { setStatus('You win!'); onResult('checkers', +12, true); return; }
    const [sr,sc,r,c] = moves[Math.floor(Math.random()*moves.length)];
    const nb = apply(board, sr, sc, r, c);
    setBoard(nb); setTurn('w');
  };

  const click = (r,c) => {
    if (sel) return move(sel[0], sel[1], r, c);
    if (!dark(r,c)) return;
    const piece = board[r][c];
    if (mode==='online' && piece!==myColor) return;
    if (mode==='bot' && piece!=='w') return;
    if (piece) setSel([r,c]);
  };

  const startBot = () => { setMode('bot'); reset('w'); setStatus('Practice vs Bot. You are White.'); };
  const startOnline = () => { setMode('online'); reset(); mm.queue(); setStatus('Queueing…'); };

  return (
    <div style={{display:'grid', gridTemplateColumns:'336px 1fr', gap:16}}>
      <Panel>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <Button onClick={startBot}>Practice vs Bot</Button>
          {mode!=='online' ? <Button $primary onClick={startOnline}>Play Online</Button> : <Button onClick={mm.leave}>Leave</Button>}
        </div>
        <div style={{marginTop:8, color:'#555'}}>{status}</div>
      </Panel>
      <Panel>
        <BoardWrap>
          {Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>{
            const d = dark(r,c); const piece = board[r][c];
            const selected = sel && sel[0]===r && sel[1]===c;
            return (
              <div key={`${r}-${c}`} onClick={()=>d && click(r,c)}
                style={{width:42,height:42, background:d?'#b58963':'#f0d9b5', border:selected?'2px solid #22c55e':'1px solid #e5e7eb', display:'grid', placeItems:'center', cursor:d?'pointer':'default'}}>
                {piece && <div style={{width:24,height:24,borderRadius:'50%', background:piece==='w'?'#fff':'#111'}}/>}
              </div>
            );
          }))}
        </BoardWrap>
      </Panel>
    </div>
  );
}
