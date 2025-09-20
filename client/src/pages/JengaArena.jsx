// client/src/pages/JengaArena.jsx
import React, { useEffect, useMemo, useState, useContext } from 'react';
import styled from 'styled-components';
import { useMatchmaking } from '../games/useMatchmaking';
import { AuthContext } from '../App';

const Panel = styled.div`border:1px solid var(--border-color);background:var(--container-white);border-radius:12px;padding:12px;`;
const Button = styled.button`
  padding:8px 12px;border-radius:10px;border:1px solid #111;cursor:pointer;
  background:${p=>p.$primary?'#111':'#fff'};color:${p=>p.$primary?'#fff':'#111'};
`;
function initLayers(H=12){ return Array.from({length:H},()=>({holes:0})) }

export default function JengaArena({ onResult }) {
  const { user } = useContext(AuthContext);
  const mm = useMatchmaking('jenga', user);
  const [mode, setMode] = useState(null);
  const [layers, setLayers] = useState(initLayers);
  const [alive, setAlive] = useState(true);
  const [turn, setTurn] = useState('A'); // online: A,B
  const myTurn = useMemo(()=> mode==='online' ? mm.role===turn : true, [mode, mm.role, turn]);

  useEffect(()=>{
    if (mode!=='online') return;
    const off = mm.on((type, payload)=>{
      if (type==='state'){ setLayers(payload.layers); setTurn(payload.turn); setAlive(true); }
      if (type==='over'){ onResult('jenga', payload.delta, payload.didWin); setAlive(false); }
    }); return off;
  }, [mode]); // eslint-disable-line

  const risk = (idx) => {
    const H=layers.length; const topFactor = (H-idx)/H;
    const holesBelow = layers.slice(idx+1).reduce((s,l)=>s+l.holes,0);
    const weight = (topFactor*0.6) + (holesBelow/(H*3))*0.4;
    return Math.min(0.85, 0.15 + weight);
  };

  const pull = (idx) => {
    if (!alive) return;
    if (!myTurn) return;
    if (layers[idx].holes>=3) return;
    const collapse = (mode==='bot') ? Math.random()<risk(idx) : (mm.role==='A' ? Math.random()<risk(idx) : null);

    if (mode==='online') {
      // role A decides and broadcasts state
      if (mm.role==='A') {
        if (collapse) {
          mm.send('over', { delta: +15, didWin: turn==='A' }); // winner is opponent turn
        } else {
          const next = layers.map((l,i)=> i===idx?{holes:l.holes+1}:l);
          const nt = turn==='A'?'B':'A';
          mm.send('state', { layers: next, turn: nt });
        }
      }
      return;
    }

    // bot mode local
    if (collapse) { setAlive(false); onResult('jenga', +12, true); }
    else {
      const next = layers.map((l,i)=> i===idx?{holes:l.holes+1}:l);
      setLayers(next);
      // bot turn: bot randomly pulls a safer block
      setTimeout(()=>{
        const candidates = next.map((l,i)=>({i, p:risk(i)})).filter(x=>x.p<0.65 && next[x.i].holes<3);
        const pick = (candidates.length? candidates : next.map((_,i)=>({i,p:risk(i)}))).sort((a,b)=>a.p-b.p)[0];
        if (!pick) { onResult('jenga', +20, true); return; }
        const col = Math.random()<risk(pick.i);
        if (col) onResult('jenga', -6, false);
        else setLayers(n=> n.map((l,i)=> i===pick.i?{holes:l.holes+1}:l));
      }, 400);
    }
  };

  const startBot = () => { setMode('bot'); setLayers(initLayers()); setAlive(true); setTurn('A'); };
  const startOnline = () => { setMode('online'); setLayers(initLayers()); setAlive(true); setTurn('A'); mm.queue(); };

  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
      <Panel>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <Button onClick={startBot}>Practice vs Bot</Button>
          {mode!=='online' ? <Button $primary onClick={startOnline}>Play Online</Button> : <Button onClick={mm.leave}>Leave</Button>}
        </div>
        <div style={{marginTop:8}}>Turn: <b>{turn}</b> {myTurn?'(Your turn)':''}</div>
      </Panel>
      <Panel>
        <div style={{display:'grid', gap:4}}>
          {layers.map((l,idx)=>(
            <div key={idx} style={{display:'grid', gridTemplateColumns:'repeat(3,80px)', gap:4}}>
              {Array.from({length:3}).map((_,i)=>(
                <button key={i} disabled={!alive || !myTurn || l.holes>=(3-i)} onClick={()=>pull(idx)}
                        title={`Risk ≈ ${(risk(idx)*100|0)}%`}
                        style={{height:18, background:'#e2e8f0', border:'1px solid #cbd5e1', borderRadius:6}}/>
              ))}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
