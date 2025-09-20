// client/src/pages/IceRacerArena.jsx
import React, { useEffect, useRef, useState, useContext } from 'react';
import styled from 'styled-components';
import { useMatchmaking } from '../games/useMatchmaking';
import { AuthContext } from '../App';

const Panel = styled.div`border:1px solid var(--border-color);background:var(--container-white);border-radius:12px;padding:12px;`;
const Button = styled.button`
  padding:8px 12px;border-radius:10px;border:1px solid #111;cursor:pointer;
  background:${p=>p.$primary?'#111':'#fff'};color:${p=>p.$primary?'#fff':'#111'};
`;

// tiny seeded rng
function mulberry32(a){return function(){var t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}

export default function IceRacerArena({ onResult }) {
  const { user } = useContext(AuthContext);
  const mm = useMatchmaking('iceracer', user);
  const [mode, setMode] = useState(null);
  const cvsRef = useRef(null);
  const [status, setStatus] = useState('Pick a mode.');
  const myScore = useRef(null); const oppScore = useRef(null);

  useEffect(()=>{
    if (mode!=='online') return;
    const off = mm.on((type, payload)=>{
      if (type==='score'){ 
        if (payload.who==='opp') oppScore.current = payload.value;
        settle();
      }
      if (type==='start') run(payload.seed);
    });
    return off;
  }, [mode]); // eslint-disable-line

  const settle = ()=>{
    if (myScore.current!=null && oppScore.current!=null){
      const win = myScore.current >= oppScore.current;
      onResult('iceracer', win?+8:+2, win);
      setStatus(`You ${win?'win':'lose'} — ${myScore.current} vs ${oppScore.current}`);
      myScore.current = null; oppScore.current = null;
    }
  };

  const run = (seed = Math.floor(Math.random()*1e9)>>>0) => {
    const rnd = mulberry32(seed);
    const cvs = cvsRef.current, ctx = cvs.getContext('2d');
    let x=150, t=0, alive=true, speed=2; const obstacles=[];
    const onKey=(e)=>{ if(e.key==='ArrowLeft') x=Math.max(0,x-20); if(e.key==='ArrowRight') x=Math.min(280,x+20); };
    window.addEventListener('keydown', onKey);
    const loop=()=>{
      if(!alive){ 
        window.removeEventListener('keydown', onKey);
        const score = Math.max(1, Math.floor(t/200));
        myScore.current = score;
        if (mode==='online') mm.send('score', { who:'opp', value: score }); // from opponent POV, I'm "opp"
        else { // bot score
          const botScore = Math.max(1, score - (3 + Math.floor(rnd()*6)));
          oppScore.current = botScore;
        }
        settle();
        return; 
      }
      t++; if(t%60===0) obstacles.push({x:Math.floor(rnd()*6)*50,y:-20});
      ctx.fillStyle='#e2e8f0'; ctx.fillRect(0,0,300,200);
      ctx.fillStyle='#3b82f6'; ctx.fillRect(x,170,20,20);
      for(const o of obstacles){ o.y+=speed; ctx.fillStyle='#64748b'; ctx.fillRect(o.x,o.y,40,10); if(o.y>200) obstacles.shift(); }
      for(const o of obstacles){ if(Math.abs((x+10)-(o.x+20))<25 && Math.abs((170+10)-(o.y+5))<15) alive=false; }
      speed = 2 + t/600; requestAnimationFrame(loop);
    }; loop();
  };

  const startBot = () => { setMode('bot'); setStatus('Survive as long as you can.'); run(); };
  const startOnline = () => { setMode('online'); setStatus('Queueing…'); mm.queue(); if (mm.role==='A') mm.send('start', { seed: mm.seed || (Math.random()*1e9>>>0) }); };

  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
      <Panel>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <Button onClick={startBot}>Practice vs Bot</Button>
          {mode!=='online' ? <Button $primary onClick={startOnline}>Play Online</Button> : <Button onClick={mm.leave}>Leave</Button>}
        </div>
        <div style={{marginTop:8, color:'#555'}}>{status}</div>
      </Panel>
      <Panel>
        <canvas ref={cvsRef} width={300} height={200} style={{border:'1px solid #ddd', borderRadius:12, background:'#f8fafc'}}/>
      </Panel>
    </div>
  );
}
