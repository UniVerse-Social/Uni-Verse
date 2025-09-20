// client/src/pages/OddEvenArena.jsx
import React, { useEffect, useState, useContext } from 'react';
import styled from 'styled-components';
import { useMatchmaking } from '../games/useMatchmaking';
import { AuthContext } from '../App';

const Panel = styled.div`border:1px solid var(--border-color);background:var(--container-white);border-radius:12px;padding:12px;`;
const Button = styled.button`
  padding:8px 12px;border-radius:10px;border:1px solid #111;cursor:pointer;
  background:${p=>p.$primary?'#111':'#fff'};color:${p=>p.$primary?'#fff':'#111'};
`;

export default function OddEvenArena({ onResult }) {
  const { user } = useContext(AuthContext);
  const [mode, setMode] = useState(null);
  const mm = useMatchmaking('oddeven', user);
  const [role, setRole] = useState('odd'); // online: A=odd, B=even
  const [round, setRound] = useState(1);
  const [my, setMy] = useState(null);
  const [opp, setOpp] = useState(null);
  const [score, setScore] = useState({ me:0, opp:0 });
  const [status, setStatus] = useState('Pick a mode.');

  useEffect(()=> {
    if (mode!=='online') return;
    setRole(mm.role==='A' ? 'odd' : 'even');
  }, [mode, mm.role]);

  useEffect(()=>{
    if (mode!=='online') return;
    const off = mm.on((type, payload)=>{
      if (type==='throw') setOpp(payload.value);
      if (type==='reset') { setOpp(null); setMy(null); }
    });
    return off;
  }, [mode]); // eslint-disable-line

  useEffect(()=>{
    if (my==null || opp==null) return;
    const sum = my + opp;
    const parity = sum%2===0 ? 'even' : 'odd';
    const meWins = (parity === role);
    setScore(s => ({ me: s.me + (meWins?1:0), opp: s.opp + (meWins?0:1) }));
    setStatus(`Round ${round}: You picked ${my}, Opponent ${opp}. ${parity.toUpperCase()} → ${meWins?'You win':'You lose'}.`);
    const next = round+1;
    if (next>3 || (score.me+(meWins?1:0))===2 || (score.opp+(meWins?0:1))===2) {
      const didWin = (score.me+(meWins?1:0)) > (score.opp+(meWins?0:1));
      onResult('oddeven', didWin?+6:-3, didWin);
      setStatus(`Match over — ${didWin?'You win +6':'You lose -3'}.`);
      if (mode==='online') mm.send('reset', {});
    } else {
      setTimeout(()=>{ setRound(next); setMy(null); setOpp(null); if (mode==='online') mm.send('reset', {}); }, 800);
    }
  }, [my, opp]); // eslint-disable-line

  const throwNum = (v) => {
    if (my!=null) return;
    setMy(v);
    if (mode==='online') mm.send('throw', { value: v });
    if (mode==='bot') {
      const botV = Math.floor(Math.random()*5)+1;
      setOpp(botV);
    }
  };

  const startBot = () => { setMode('bot'); setRole('odd'); setRound(1); setScore({me:0,opp:0}); setStatus('Practice vs Bot. You are ODD. Best of 3.'); };
  const startOnline = () => { setMode('online'); setRound(1); setScore({me:0,opp:0}); mm.queue(); setStatus('Queueing… A=ODD, B=EVEN.'); };

  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
      <Panel>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <Button onClick={startBot}>Practice vs Bot</Button>
          {mode!=='online' ? <Button $primary onClick={startOnline}>Play Online</Button> : <Button onClick={mm.leave}>Leave</Button>}
        </div>
        <div style={{marginTop:8}}>Role: <b>{role.toUpperCase()}</b> • Round {round} • Score {score.me}-{score.opp}</div>
        <div style={{marginTop:8, color:'#555'}}>{status}</div>
      </Panel>
      <Panel>
        <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
          {[1,2,3,4,5].map(n=>(
            <Button key={n} onClick={()=>throwNum(n)} disabled={my!=null}>{n}</Button>
          ))}
        </div>
        <div style={{marginTop:8, fontSize:12, color:'#6b7280'}}>Pick a number 1–5. ODD wins if sum is odd; EVEN wins if sum is even.</div>
      </Panel>
    </div>
  );
}
