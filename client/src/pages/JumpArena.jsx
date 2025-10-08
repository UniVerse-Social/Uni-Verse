import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

/** Seeded RNG */
const seeded = (a)=>()=>{ let t=(a+=0x6d2b79f5); t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };

export default function JumpArena() {
  const { user } = useContext(AuthContext);

  // game area fixed like others
  const W = 456, H = 456;
  const LANE_H = H/2 - 12;   // padding between halves
  const GROUND_Y = (lane)=> (lane===0 ? (LANE_H-56) : (H-56)); // character baseline (top/bot lanes)

  const [mode, setMode] = useState(null);   // null | 'bot' | 'online'
  const [status, setStatus] = useState('Pick a mode to start.');
  const [notice, setNotice] = useState('');
  const [live, setLive] = useState(false);

  // Online
  const [roomId, setRoomId] = useState(null);
  const socketRef = useRef(null);
  const awardedRef = useRef(false);
  const [seed, setSeed] = useState(0);
  const [startAt, setStartAt] = useState(0);  // epoch ms
  const [myRole, setMyRole] = useState('p1'); // 'p1' bottom (you), 'p2' top (opponent)

  // Local loop state
  const rafRef = useRef(0);
  const fieldRef = useRef(null);
  const tRef = useRef({ last: 0, elapsed: 0 });
  const rngRef = useRef(()=>Math.random());

  // per-player runtime state
  const meRef = useRef({ x: 52, y: 0, vy:0, action:'idle', until:0, alive:true, score:0 });
  const oppRef= useRef({ x: 52, y: 0, vy:0, action:'idle', until:0, alive:true, score:0 });

  // obstacles shared lanes: each obstacle applies to both lanes
  const obsRef = useRef([]); // {x, type:'low'|'high'|'ghost'}
  const speedRef = useRef(220); // px/s

  const flash = useCallback((msg, ms=1600) => {
    setNotice(msg);
    window.setTimeout(()=>setNotice(''), ms);
  }, []);

  /* ---------------- Helpers ---------------- */
  const resetRuntime = useCallback(() => {
    meRef.current = { x: 52, y: 0, vy:0, action:'idle', until:0, alive:true, score:0 };
    oppRef.current = { x: 52, y: 0, vy:0, action:'idle', until:0, alive:true, score:0 };
    obsRef.current = [];
    tRef.current = { last: 0, elapsed: 0 };
    speedRef.current = 220;
  }, []);

  const genObstacles = useCallback((rng, elapsed) => {
    // spawn every ~1100-1600ms, faster over time; ensure we don't spam
    const arr = obsRef.current;
    const lastX = arr.length ? arr[arr.length-1].x : 0;
    if (lastX > 0 && lastX > W * 2) return;
    // convert elapsed to “should spawn?” using RNG window
    const need = arr.length < 6;
    if (!need) return;
    const pick = rng();
    const type = pick < 0.45 ? 'low' : (pick < 0.85 ? 'high' : 'ghost');
    arr.push({ x: W + (rng()*220 + 260), type });
  }, [W]);

  const applyAction = (p, action, nowMs) => {
    if (!p.alive) return;
    if (action === 'jump' && p.action!=='jump') {
      p.action = 'jump';
      p.vy = -360; // upward impulse
      p.until = nowMs + 520;
    } else if (action === 'roll' && p.action!=='roll') {
      p.action = 'roll';
      p.until = nowMs + 420;
    } else if (action === 'idle') {
      // do nothing bait (explicit), just mark
      p.action = p.action === 'jump' || p.action === 'roll' ? p.action : 'idle';
    }
  };

  const updatePlayer = (p, lane, dt, nowMs) => {
    // physics for jump
    if (p.action === 'jump') {
      p.vy += 980 * dt;       // gravity
      p.y += p.vy * dt;
      const base = 0;
      if (p.y > base) { p.y = base; p.vy = 0; p.action = 'idle'; }
      if (nowMs > p.until) p.action = 'idle';
    } else if (p.action === 'roll') {
      if (nowMs > p.until) p.action = 'idle';
    }
    // scoring
    p.score += dt * 10;
  };

  const collides = (p, lane, o) => {
    // Character rectangle approximations
    const charX = p.x, charW = 28;
    const charH = p.action==='roll' ? 22 : 38;
    const baseY = GROUND_Y(lane);
    const charY = baseY - (p.action==='roll' ? 14 : 28) + p.y;

    const ox = o.x, ow = 24;
    const oh = o.type==='low' ? 22 : 42;  // low obstacle (need jump), high obstacle (need roll)
    const oy = baseY - (o.type==='low' ? 18 : 36); // sit on ground
    // ghost never hits
    if (o.type==='ghost') return false;

    const overlap = !(charX+charW < ox || ox+ow < charX || charY+charH < oy || oy+oh < charY);
    if (!overlap) return false;

    // Require correct action
    if (o.type === 'low') {
      // low obstacle requires jump (character center above top of low)
      return !(p.action==='jump' && (p.y < -8)); // jumping enough clears it
    }
    if (o.type === 'high') {
      // high obstacle requires roll (character height reduced)
      return !(p.action==='roll');
    }
    return false;
  };

  /* ---------------- Controls ---------------- */
  useEffect(() => {
    const kd = (e) => {
      if (!live) return;
      const nowMs = performance.now();
      if (e.key === 'ArrowUp') {
        applyAction(meRef.current, 'jump', nowMs);
        if (mode==='online') socketRef.current?.emit('jump:input', { roomId, action:'jump', at: nowMs });
      } else if (e.key === 'ArrowDown') {
        applyAction(meRef.current, 'roll', nowMs);
        if (mode==='online') socketRef.current?.emit('jump:input', { roomId, action:'roll', at: nowMs });
      } else if (e.key === ' ') {
        // explicit idle/bait
        if (mode==='online') socketRef.current?.emit('jump:input', { roomId, action:'idle', at: nowMs });
      }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [live, mode, roomId]);

  /* ---------------- Bot ---------------- */
  const startBot = () => {
    setMode('bot');
    setStatus('Practice vs Bot — Up: Jump, Down: Roll, Space: Bait (do nothing). One hit KOs.');
    setLive(true);
    setRoomId(null);
    setSeed((Math.random()*1e9)|0);
    setStartAt(performance.now()+600);
    awardedRef.current = false;
    resetRuntime();
    rngRef.current = seeded(seed || 1);
    loopStart();
  };

  const botThink = (nowMs) => {
    // Simple heuristic: look at nearest obstacle and act accordingly with small delay;
    const obs = obsRef.current.find(o => o.x > 70 && o.x < 140);
    if (!obs || !oppRef.current.alive) return;
    if (obs.type==='low') applyAction(oppRef.current, 'jump', nowMs);
    else if (obs.type==='high') applyAction(oppRef.current, 'roll', nowMs);
    else if (obs.type==='ghost') { /* bait: do nothing */ }
  };

  /* ---------------- Online (Checkers-like) ---------------- */
  const awardWin = useCallback(async () => {
    if (!user?._id || awardedRef.current) return;
    try {
      await axios.post(`${API_BASE_URL}/api/games/result`, {
        userId: user._id, gameKey: 'jump', delta: 6, didWin: true,
      });
      awardedRef.current = true;
    } catch {}
  }, [user?._id]);

  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const s = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => setStatus('Connected. Queueing…'));
    s.on('jump:queued', () => setStatus('Looking for an opponent…'));

    s.on('jump:start', ({ roomId, role, seed, startAt, p1, p2 }) => {
      setRoomId(roomId);
      setMode('online');
      setLive(true);
      setMyRole(role); // 'p1' bottom, 'p2' top
      setSeed(seed);
      setStartAt(startAt);
      resetRuntime();
      rngRef.current = seeded(seed||1);
      setStatus(`Match found: ${p1?.username || 'Player 1'} vs ${p2?.username || 'Player 2'} — You are ${role==='p1'?'BOTTOM':'TOP'}.`);
      loopStart();
    });

    s.on('jump:input', ({ role, action, at }) => {
      const who = role==='p1' ? (myRole==='p1' ? meRef.current : oppRef.current) : (myRole==='p2' ? meRef.current : oppRef.current);
      if (who === meRef.current) return; // ignore echoes
      applyAction(oppRef.current, action, at || performance.now());
    });

    s.on('jump:gameover', ({ result, reason }) => {
      setStatus(`Game over: ${result}${reason ? ` (${reason})` : ''}`);
      setLive(false);
      setMode(null);
      if (/you win/i.test(result)) awardWin();
    });

    s.on('jump:queue-cancelled', () => setStatus('Queue cancelled.'));
    s.on('disconnect', () => setStatus('Disconnected.'));
    return s;
  }, [myRole, awardWin, resetRuntime]);

  const startOnline = () => {
    setMode('online');
    setStatus('Queueing…');
    const s = connectSocket();
    s.emit('jump:queue', { userId: user?._id, username: user?.username });
  };

  const leaveOnline = () => {
    const s = socketRef.current;
    if (s) {
      s.emit('jump:leave', { roomId });
      s.disconnect();
      socketRef.current = null;
    }
    setMode(null);
    setRoomId(null);
    setLive(false);
    setStatus('Left online mode.');
  };

  const resign = () => {
    if (mode === 'online' && socketRef.current && roomId) socketRef.current.emit('jump:resign', { roomId });
    else if (mode === 'bot') { setStatus('You resigned.'); setLive(false); setMode(null); }
  };

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
  }, []);

  /* ---------------- Loop & Render ---------------- */
  const loopStart = () => {
    cancelAnimationFrame(rafRef.current);
    tRef.current.last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(50, now - tRef.current.last) / 1000;
      tRef.current.last = now;
      if (live) step(dt, now);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const step = (dt, nowMs) => {
    // Generate obstacles
    genObstacles(rngRef.current, tRef.current.elapsed);
    tRef.current.elapsed += dt;

    // move obstacles
    const spd = speedRef.current * (1 + Math.min(1.0, tRef.current.elapsed / 60)*0.3);
    obsRef.current.forEach(o => { o.x -= spd * dt; });
    obsRef.current = { current: obsRef.current.filter(o => o.x > -40) }.current;

    // bot AI
    if (mode==='bot') botThink(nowMs);

    // update players
    updatePlayer(meRef.current, 1, dt, nowMs);
    updatePlayer(oppRef.current, 0, dt, nowMs);

    // collisions
    for (const o of obsRef.current) {
      if (o.x < 52+20 && o.x+24 > 52) {
        if (meRef.current.alive && collides(meRef.current, 1, o)) {
          meRef.current.alive = false;
          if (mode==='bot') {
            setStatus('Game over · Bot wins'); setLive(false); setMode(null);
          } else {
            socketRef.current?.emit('jump:over', { roomId, loser: myRole });
          }
        }
        if (oppRef.current.alive && collides(oppRef.current, 0, o)) {
          oppRef.current.alive = false;
          if (mode==='bot') {
            setStatus('Game over · You win'); setLive(false); setMode(null);
          } // in online, the other client will report their own over
        }
      }
    }
  };

  // paint DOM
  const renderLane = useCallback((lane) => {
    const me = lane===1 ? meRef.current : oppRef.current;
    const laneTop = lane===0 ? 6 : H/2 + 6;
    const baseY = GROUND_Y(lane);
    const charH = me.action==='roll' ? 22 : 38;
    const charY = baseY - (me.action==='roll' ? 14 : 28) + me.y;

    return (
      <div key={lane} style={{position:'absolute', left:0, top:laneTop, width:'100%', height:LANE_H-12}}>
        {/* ground */}
        <div style={{position:'absolute', left:0, right:0, top:baseY-2, height:2, background:'#cbd5e1'}}/>
        {/* obstacles */}
        {obsRef.current.map((o, i)=>(
          <div key={lane+'-'+i}
               style={{
                 position:'absolute', left:o.x, top: baseY - (o.type==='low'? 18 : 36),
                 width:24, height:(o.type==='low'?22:42),
                 background: o.type==='ghost' ? 'rgba(99,102,241,.35)' : '#111',
                 borderRadius:6, boxShadow:'0 1px 4px rgba(0,0,0,.2)'
               }}/>
        ))}
        {/* character */}
        <div style={{
          position:'absolute', left:me.x, top:charY, width:28, height:charH,
          background: lane===1 ? '#111' : '#4b5563', color:'#fff',
          borderRadius: me.action==='roll' ? '12px' : '8px',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900,
          boxShadow:'0 2px 6px rgba(0,0,0,.25)'
        }}>
          {lane===1 ? 'YOU' : 'RIVAL'}
        </div>
      </div>
    );
  }, [H, LANE_H]);

  return (
    <Wrap>
      {/* Left: double lane field */}
      <Panel>
        <div ref={fieldRef} style={{
          width:W, height:H, borderRadius:12, border:'1px solid #ddd',
          background:'linear-gradient(#f8fafc,#eef2f7)', position:'relative',
          boxShadow:'0 8px 24px rgba(0,0,0,.08)'
        }}>
          {/* Split label bars */}
          <div style={{position:'absolute', left:0, right:0, top:0, height:24, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#334155'}}>
            Opponent Lane
          </div>
          <div style={{position:'absolute', left:0, right:0, top:H/2-1, height:2, background:'#e2e8f0'}}/>
          <div style={{position:'absolute', left:0, right:0, top:H/2, height:24, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#334155'}}>
            Your Lane
          </div>
          {renderLane(0)}
          {renderLane(1)}
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
          Controls: <b>Up</b> jump · <b>Down</b> roll · <b>Space</b> bait. One hit KOs. Wins vs real players grant <b>+6 trophies</b>.
        </div>
      </Panel>
    </Wrap>
  );
}