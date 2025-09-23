// client/src/pages/ArmArena.jsx
import React, { useEffect, useRef, useState, useContext } from 'react';
import styled from 'styled-components';
import { useMatchmaking } from '../games/useMatchmaking';
import { AuthContext } from '../App';

const Panel = styled.div`border:1px solid var(--border-color);background:var(--container-white);border-radius:12px;padding:12px;`;
const Button = styled.button`
  padding:8px 12px;border-radius:10px;border:1px solid #111;cursor:pointer;
  background:${p=>p.$primary?'#111':'#fff'};color:${p=>p.$primary?'#fff':'#111'};
`;

export default function ArmArena({ onResult }) {
  const { user } = useContext(AuthContext);
  const mm = useMatchmaking('arm', user);
  const [mode, setMode] = useState(null);
  const [meter, setMeter] = useState(0);
  const [running, setRunning] = useState(false);
  const goTimer = useRef(null);

  useEffect(()=>{
    if (mode!=='online') return;
    const off = mm.on((type, payload)=>{
      if (type==='go') startGo(payload.delay);
      if (type==='state') setMeter(payload.meter);
      if (type==='over') { setRunning(false); onResult('arm', payload.delta, payload.didWin); }
    });
    return off;
  }, [mode]); // eslint-disable-line

  const startGo = (delay) => {
    setRunning(true);
    clearTimeout(goTimer.current);
    goTimer.current = setTimeout(()=>{ window.__arm_go = Date.now(); }, delay);
  };

  const hit = () => {
    if (!running) return;
    const now = Date.now();
    const diff = window.__arm_go ? (now - window.__arm_go) : 9999;
    const zone = diff >= 120 && diff <= 260;
    const delta = zone ? +20 : -10;
    const m = Math.max(-100, Math.min(100, meter + delta));
    setMeter(m);
    if (mode==='online') {
      mm.send('state', { meter: m });
      if (mm.role==='A') {
        if (m>=100) { mm.send('over', { delta:+10, didWin:true }); setRunning(false); }
        else if (m<=-100) { mm.send('over', { delta:-5, didWin:false }); setRunning(false); }
        else {
          // schedule next GO for both
          mm.send('go', { delay: Math.floor(Math.random()*800)+800 });
        }
      }
    } else {
      // bot: random reaction
      if (m>=100) { setRunning(false); onResult('arm', +10, true); }
      else if (m<=-100) { setRunning(false); onResult('arm', -5, false); }
      else setTimeout(()=>startGo(Math.floor(Math.random()*800)+800), 300);
    }
  };

  const startBot = () => {
    setMode('bot'); setMeter(0); startGo(800);
  };
  const startOnline = () => {
    setMode('online'); setMeter(0); mm.queue();
    if (mm.role==='A') mm.send('go', { delay: Math.floor(Math.random()*800)+800 });
  };

  useEffect(()=>{ const onKey=e=>{ if(e.code==='Space') hit(); }; window.addEventListener('keydown', onKey); return ()=>window.removeEventListener('keydown', onKey);});

  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
      <Panel>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <Button onClick={startBot}>Practice vs Bot</Button>
          {mode!=='online' ? <Button $primary onClick={startOnline}>Play Online</Button> : <Button onClick={mm.leave}>Leave</Button>}
        </div>
        <div style={{marginTop:8}}>Press <b>Space</b> when “GO” fires (120–260ms window).</div>
      </Panel>
      <Panel>
        <div style={{position:'relative', width:260, height:24, background:'#eee', borderRadius:999}}>
          <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${meter+100}%`, background:'#111', borderRadius:999 }} />
        </div>
        <div style={{marginTop:8, fontSize:12, color:'#6b7280'}}>Meter: {meter}</div>
        <Button onClick={hit}>Tap (Space)</Button>
      </Panel>
    </div>
  );
}
