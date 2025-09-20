// client/src/pages/JumpArena.jsx
import React, { useEffect, useRef, useState, useContext } from 'react';
import styled from 'styled-components';
import { useMatchmaking } from '../games/useMatchmaking';
import { AuthContext } from '../App';

const Panel = styled.div`border:1px solid var(--border-color);background:var(--container-white);border-radius:12px;padding:12px;`;
const Button = styled.button`
  padding:8px 12px;border-radius:10px;border:1px solid #111;cursor:pointer;
  background:${p=>p.$primary?'#111':'#fff'};color:${p=>p.$primary?'#fff':'#111'};
`;
function mulberry32(a){return function(){var t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}

export default function JumpArena({ onResult }) {
  const { user } = useContext(AuthContext);
  const mm = useMatchmaking('jump', user);
  const [mode, setMode] = useState(null);
  const cvsRef = useRef(null);

  useEffect(()=>{
    if (mode!=='online') return;
    const off = mm.on((type, payload)=>{
      if (type==='seed') start(payload.seed);
      if (type==='over') onResult('jump', payload.delta, payload.didWin);
    }); return off;
  }, [mode]); // eslint-disable-line

  const start = (seed = Math.floor(Math.random()*1e9)>>>0) => {
    const rnd = mulberry32(seed);
    const cvs = cvsRef.current, ctx = cvs.getContext('2d');
    const W=440,H=168; let t=0;
    const p = {x:60,y:H-20,vy:0,track:0,alive:true};
    const obs=[]; window.addEventListener('keydown', e=>{ if(e.key==='w'||e.key==='ArrowUp') if(p.y>=H-(p.track?80:20)) p.vy=-9; });
    const loop=()=>{
      t++; if (t%60===0) obs.push({x:W,y:[H-20,H-80][Math.floor(rnd()*2)]-10});
      ctx.fillStyle='#f8fafc'; ctx.fillRect(0,0,W,H);
      p.vy += 0.5; p.y = Math.min(p.y+p.vy, (p.track?H-80:H-20));
      ctx.fillStyle = '#111'; ctx.fillRect(p.x, p.y-10, 12, 12);
      for(const o of obs){ o.x -= 3; ctx.fillStyle='#ef4444'; ctx.fillRect(o.x,o.y,10,10); }
      while(obs[0] && obs[0].x<-10) obs.shift();
      for(const o of obs){
        if (Math.abs((p.x+6)-(o.x+5))<10 && Math.abs((p.y-5)-(o.y+5))<10){ p.alive=false; break; }
      }
      if (!p.alive){
        if (mode==='online'){ mm.send('over', { delta:-4, didWin:false }); }
        else { onResult('jump', +10, true); }
        return;
      }
      requestAnimationFrame(loop);
    }; loop();
  };

  const startBot = () => { setMode('bot'); start(); };
  const startOnline = () => { setMode('online'); mm.queue(); if (mm.role==='A') mm.send('seed', { seed: mm.seed || (Math.random()*1e9>>>0) }); };

  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
      <Panel>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <Button onClick={startBot}>Practice vs Bot</Button>
          {mode!=='online' ? <Button $primary onClick={startOnline}>Play Online</Button> : <Button onClick={mm.leave}>Leave</Button>}
        </div>
        <div style={{marginTop:8}}>P1: W, P2: ↑. First to crash loses.</div>
      </Panel>
      <Panel>
        <canvas ref={cvsRef} width={440} height={168} style={{border:'1px solid #ddd', borderRadius:12}}/>
      </Panel>
    </div>
  );
}
