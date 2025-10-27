// client/src/pages/MeteorArena.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import { API_BASE_URL } from "../config";

/** ====== Constants ====== */
const W = 456, H = 456;
const TAU = Math.PI * 2;
const BLUE = "#3b82f6", RED = "#ef4444", ORANGE = "#f59e0b", WHITE = "#ffffff";

const MATCH_MS = 3 * 60 * 1000;   // 3 minutes
const SIM_HZ = 120;               // lockstep simulation rate
const TICK_MS = Math.round(1000 / SIM_HZ); // 8.333...ms
const FIXED_DT = 1 / SIM_HZ;      // 0.008333.. s per tick

// gameplay (in seconds)
const SHOT_LIFE_S = 0.9;
const FIRE_CD_S   = 0.16;
const INV_SPAWN_S = 1.2;
const ROT_SPEED   = 3.2;   // rad/s
const ACCEL       = 120;   // px/s^2
const SPIN_SPEED  = 0.2;   // rad/s
const BULLET_SPEED = 260;  // px/s
const FRICTION_PER_TICK = 0.995; // keep same feel, but applied per tick

// convert to ticks
const SHOT_LIFE_TICKS = Math.round(SHOT_LIFE_S * SIM_HZ);
const FIRE_CD_TICKS   = Math.max(1, Math.round(FIRE_CD_S * SIM_HZ));
const INV_SPAWN_TICKS = Math.round(INV_SPAWN_S * SIM_HZ);
const ROT_PER_TICK    = ROT_SPEED * FIXED_DT;
const ACCEL_PER_TICK  = ACCEL * FIXED_DT;
const SPIN_PER_TICK   = SPIN_SPEED * FIXED_DT;

// deterministic PRNG
const seeded = (a) => () => { let t=(a+=0x6d2b79f5); t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
const rngFrom=(seed)=>{ const r=seeded(seed||1); return { next:()=>r(), sign:()=>r()<.5?-1:1, range:(a,b)=>a+(b-a)*r() }; };

// helpers
function wrap(p){ if(p.x<0)p.x+=W; else if(p.x>W)p.x-=W; if(p.y<0)p.y+=H; else if(p.y>H)p.y-=H; }
function dist2(a,b){ const dx=((a.x-b.x+W+W)%W)-W, dy=((a.y-b.y+H+H)%H)-H; return dx*dx+dy*dy; }
function unwrapSegment(ax, ay, bx, by){
  let ux0 = ax, uy0 = ay, ux1 = bx, uy1 = by;
  if (ux1 - ux0 >  W/2) ux1 -= W;
  if (ux1 - ux0 < -W/2) ux1 += W;
  if (uy1 - uy0 >  H/2) uy1 -= H;
  if (uy1 - uy0 < -H/2) uy1 += H;
  return { ax: ux0, ay: uy0, bx: ux1, by: uy1, mx: (ux0+ux1)/2, my: (uy0+uy1)/2 };
}
function near(rx, ry, mx, my){
  let x = rx, y = ry;
  while (x - mx >  W/2) x -= W;
  while (x - mx < -W/2) x += W;
  while (y - my >  H/2) y -= H;
  while (y - my < -H/2) y += H;
  return { x, y };
}
function distPointSeg2(px, py, ax, ay, bx, by){
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const vv = vx*vx + vy*vy || 1e-6;
  let t = (wx*vx + wy*vy) / vv; t = Math.max(0, Math.min(1, t));
  const dx = ax + t*vx - px, dy = ay + t*vy - py;
  return dx*dx + dy*dy;
}

/** ====== Ship Sprite (8-bit) ====== */
const SHIP_PIX = [
  "00000100000",
  "00001110000",
  "00011111000",
  "00111111100",
  "01110111010",
  "11111111111",
  "00111111100",
  "00010101000",
  "00010101000",
  "00001010000",
  "00000100000",
].map(row => row.split("").map(Number));

function drawPixelShip(ctx, s, color, thrustOn, alphaBlink){
  const scale = 2;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.a);
  ctx.globalAlpha = alphaBlink ? 0.45 : 1;

  if (thrustOn && !alphaBlink){
    ctx.fillStyle = ORANGE;
    for (let y=0; y<3; y++){
      ctx.fillRect(-12 - y*2, -2 + y, 3, 4 - y);
    }
  }
  for (let y=0; y<SHIP_PIX.length; y++){
    for (let x=0; x<SHIP_PIX[0].length; x++){
      if (!SHIP_PIX[y][x]) continue;
      ctx.fillStyle = color;
      ctx.fillRect((x-5)*scale, (y-5)*scale, scale, scale);
    }
  }
  ctx.restore();
}

function drawRock(ctx, r){
  ctx.save(); ctx.translate(r.x, r.y);
  ctx.strokeStyle=WHITE; ctx.lineWidth=1;
  const rad = r.size*8+6;
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const ang = (i/8)*TAU + r.spin;
    const rr = rad * (0.75+((i*97+r.seed)%53)/200);
    ctx.lineTo(Math.cos(ang)*rr, Math.sin(ang)*rr);
  }
  ctx.closePath(); ctx.stroke();
  // smiley
  ctx.fillStyle = WHITE;
  const eyeOff = rad*0.35, eyeR = Math.max(1, rad*0.08);
  ctx.beginPath(); ctx.arc(-eyeOff, -eyeOff*0.5, eyeR, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc( eyeOff, -eyeOff*0.5, eyeR, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(0,0, rad*0.45, TAU*0.08, TAU*0.42); ctx.stroke();
  ctx.restore();
}

/** ====== Core Engine (fixed-step lockstep) ====== */
function createEngine(ctx, hooks={}){
  let HOOKS = { online:false, onInput:null, onExplode:null, getLives:()=>({p1:3,p2:3}), getTimerText:()=>"", attract:true, ...hooks };

  // internal deterministic clock
  const state = {
    running:false,
    renderLast:0,
    seed:1,
    rng:rngFrom(1),
    simStartPerf:0,        // performance.now() aligned to shared start
    lastSimTick:-1,        // last simulated tick
    spawnPeriodTicks: Math.round(0.5 * SIM_HZ), // 500ms
    shotsMax:4
  };

  let localIdx = 0;                          // which player we control (0=P1 blue, 1=P2 red)
  const idxRemote = () => (localIdx===0?1:0);

  const players = [
    { x:W*0.25, y:H*0.5, px:W*0.25, py:H*0.5, a:0,       vx:0, vy:0, thrust:false, left:false, right:false, fireCd:0, alive:true, inv:0, score:0, color:BLUE },
    { x:W*0.75, y:H*0.5, px:W*0.75, py:H*0.5, a:Math.PI, vx:0, vy:0, thrust:false, left:false, right:false, fireCd:0, alive:true, inv:0, score:0, color:RED },
  ];
  const rocks=[]; // {x,y,vx,vy,size,spin,seed}
  const shots=[]; // {x,y,px,py,vx,vy,lifeTicks,owner}

  // input/shot scheduling by tick
  const fireQueue = { 0:new Set(), 1:new Set() };

  ctx.imageSmoothingEnabled = false;

  const currentTick = () => Math.floor((performance.now() - state.simStartPerf) / TICK_MS);

  function resetWorld(seed){
    state.seed = seed||1; state.rng=rngFrom(state.seed);
    players[0] = { ...players[0], x:W*0.25, y:H*0.5, px:W*0.25, py:H*0.5, a:0, vx:0, vy:0, thrust:false,left:false,right:false,fireCd:0,alive:true,inv:INV_SPAWN_TICKS, score:0, color:BLUE };
    players[1] = { ...players[1], x:W*0.75, y:H*0.5, px:W*0.75, py:H*0.5, a:Math.PI, vx:0, vy:0, thrust:false,left:false,right:false,fireCd:0,alive:true,inv:INV_SPAWN_TICKS, score:0, color:RED };
    rocks.length=0; shots.length=0; fireQueue[0].clear(); fireQueue[1].clear();
    state.lastSimTick = -1;
    // initial deterministic rocks in online; random in attract/practice
    const spawn = (det)=>spawnRock(3, undefined, undefined, det);
    if (HOOKS.online){ for(let i=0;i<4;i++) spawn(true); }
    else             { for(let i=0;i<4;i++) spawn(false); }
  }

  function setLocalIndex(i){ localIdx = i===1 ? 1 : 0; }

  function setOnline(startAtMs, seed){
    resetWorld(seed);
    // align sim clock on all peers
    state.simStartPerf = performance.now() + (startAtMs - Date.now());
  }

  function spawnRock(size, x, y, deterministic=false){
    const r = deterministic || HOOKS.online ? state.rng : { range:(a,b)=>a+(b-a)*Math.random(), sign:()=>Math.random()<.5?-1:1, next:()=>Math.random() };
    const rock = {
      x: x ?? r.range(0,W), y: y ?? r.range(0,H),
      vx: r.range(-40,40), vy: r.range(-40,40),
      size, spin: 0, seed: Math.floor(r.range(0,1000))
    };
    rocks.push(rock);
  }

  function splitRock(i){
    const r = rocks[i];
    if (r.size>1){
      for(let k=0;k<2;k++){
        spawnRock(r.size-1, r.x, r.y, /*deterministic*/ true);
        const nr = rocks[rocks.length-1];
        if (HOOKS.online){
          nr.vx += (state.rng.next()<0.5?-1:1)*25;
          nr.vy += (state.rng.next()<0.5?-1:1)*25;
        } else {
          nr.vx += (Math.random()<.5?-1:1)*25;
          nr.vy += (Math.random()<.5?-1:1)*25;
        }
      }
    }
    rocks.splice(i,1);
  }

  function scheduleFire(pIdx, t){ fireQueue[pIdx].add(t); }
  function immediateFire(pIdx){
    const p = players[pIdx];
    if (!p.alive || p.fireCd>0) return;
    // limit own bullets
    if (shots.filter(s=>s.owner===pIdx).length >= 4) return;
    const sx = p.x + Math.cos(p.a)*12;
    const sy = p.y + Math.sin(p.a)*12;
    shots.push({
      x:sx, y:sy, px:sx, py:sy,
      vx: p.vx + Math.cos(p.a)*BULLET_SPEED,
      vy: p.vy + Math.sin(p.a)*BULLET_SPEED,
      lifeTicks: SHOT_LIFE_TICKS,
      owner: pIdx
    });
    p.fireCd = FIRE_CD_TICKS;
  }

  function drawHud(){
    ctx.fillStyle=WHITE; ctx.font="bold 12px system-ui"; ctx.textAlign="left";
    const lives = HOOKS.getLives?.() || {p1:3,p2:3};
    ctx.fillText(`P1 ♥${lives.p1}  ${players[0].score}`, 8, 14);
    ctx.textAlign="center";
    ctx.fillText(HOOKS.getTimerText?.() || "", W/2, 14);
    ctx.textAlign="right";
    ctx.fillText(`${players[1].score}  ♥${lives.p2} P2`, W-8, 14);
  }

  // deterministic spawner (bounded + ramp). Always consumes RNG even if skipping spawn.
  function deterministicSpawnForTick(tick){
    const chance = state.rng.next();     // consumed every spawn tick
    const sizePick = state.rng.next();   // consumed every spawn tick

    const elapsedSec = (tick * TICK_MS) / 1000;
    const maxRocks = Math.min(14, 6 + Math.floor(elapsedSec / 45) * 2);
    const spawnProb = 0.22 + Math.min(0.10, (elapsedSec / 180) * 0.10);

    if (rocks.length < maxRocks && chance < spawnProb){
      const size = (sizePick < 0.55) ? 3 : 2;
      spawnRock(size, undefined, undefined, true);
    }
  }

  /** one simulation tick (deterministic) */
  function simTick(){
    const tick = state.lastSimTick + 1;

    // schedule firings due this tick
    if (fireQueue[0].has(tick)){ immediateFire(0); fireQueue[0].delete(tick); }
    if (fireQueue[1].has(tick)){ immediateFire(1); fireQueue[1].delete(tick); }

    // periodic deterministic spawns in online; light random in practice/attract
    if (HOOKS.online){
      if (tick % state.spawnPeriodTicks === 0) deterministicSpawnForTick(tick);
    } else {
      if (tick % 15 === 0 && rocks.length < 6 && Math.random()<0.3) spawnRock(3);
    }

    // integrate players
    for (let p of players){
      if (!p.alive) continue;
      p.px = p.x; p.py = p.y;
      if (p.left)  p.a -= ROT_PER_TICK;
      if (p.right) p.a += ROT_PER_TICK;
      if (p.thrust){
        p.vx += Math.cos(p.a)*ACCEL_PER_TICK;
        p.vy += Math.sin(p.a)*ACCEL_PER_TICK;
      }
      p.vx *= FRICTION_PER_TICK; p.vy *= FRICTION_PER_TICK;
      p.x += p.vx*FIXED_DT; p.y += p.vy*FIXED_DT; wrap(p);
      if (p.fireCd>0) p.fireCd--;
      if (p.inv>0) p.inv--;
    }

    // shots
    for (let i=shots.length-1;i>=0;i--){
      const s = shots[i];
      s.px = s.x; s.py = s.y;
      s.x += s.vx*FIXED_DT; s.y += s.vy*FIXED_DT; wrap(s);
      s.lifeTicks--;
      if (s.lifeTicks<=0){ shots.splice(i,1); continue; }
    }

    // rocks
    for (const r of rocks){ r.x+=r.vx*FIXED_DT; r.y+=r.vy*FIXED_DT; wrap(r); r.spin += SPIN_PER_TICK; }

    // shot vs rock (swept)
    for (let i=rocks.length-1;i>=0;i--){
      const r = rocks[i]; const rad = r.size*8+6;
      let hitBy = -1, shotIdx = -1;
      for (let j=shots.length-1;j>=0;j--){
        const s = shots[j];
        const { ax, ay, bx, by, mx, my } = unwrapSegment(s.px, s.py, s.x, s.y);
        const rr = near(r.x, r.y, mx, my);
        const d2 = distPointSeg2(rr.x, rr.y, ax, ay, bx, by);
        if (d2 <= (rad+1.5)*(rad+1.5)){ hitBy = shots[j].owner; shotIdx=j; break; }
      }
      if (hitBy !== -1){
        players[hitBy].score += (r.size===3?20:r.size===2?50:100);
        shots.splice(shotIdx,1);
        splitRock(i);
      }
    }

    // ship vs rock
    for (let k=0;k<2;k++){
      const p = players[k];
      if (!p.alive || p.inv>0) continue;
      const shipR = 10;
      for (const r of rocks){
        const rad = r.size*8+8;
        if (dist2(r,p) < (rad+shipR)*(rad+shipR)){
          p.alive = false; p.vx=p.vy=0; HOOKS.onExplode?.(k);
          // respawn (keep deterministic offsets by using fixed tick delays)
          setTimeout(()=>{ p.alive=true; p.x=W*0.5; p.y=H*0.5; p.a=(k?Math.PI:0); p.inv=INV_SPAWN_TICKS; }, 0);
          break;
        }
        const { ax, ay, bx, by, mx, my } = unwrapSegment(p.px, p.py, p.x, p.y);
        const rr = near(r.x, r.y, mx, my);
        const d2 = distPointSeg2(rr.x, rr.y, ax, ay, bx, by);
        if (d2 <= (rad+shipR)*(rad+shipR)){
          p.alive = false; p.vx=p.vy=0; HOOKS.onExplode?.(k);
          setTimeout(()=>{ p.alive=true; p.x=W*0.5; p.y=H*0.5; p.a=(k?Math.PI:0); p.inv=INV_SPAWN_TICKS; }, 0);
          break;
        }
      }
    }

    state.lastSimTick = tick;
  }

  /** render frame (runs as often as the browser wants; advances sim in fixed ticks) */
  function renderFrame(){
    if (!state.running) return;
    const now = performance.now();

    // advance sim up to current target tick
    const targetTick = Math.floor((now - state.simStartPerf) / TICK_MS);
    let steps = 0;
    while (state.lastSimTick < targetTick && steps < 900) { // hard cap to avoid spiral
      simTick(); steps++;
    }

    // draw
    ctx.fillStyle="#000"; ctx.fillRect(0,0,W,H);
    for (const r of rocks) drawRock(ctx, r);
    const blink0 = (players[0].inv>0) && ((state.lastSimTick>>3)&1)===0;
    const blink1 = (players[1].inv>0) && ((state.lastSimTick>>3)&1)===0;
    drawPixelShip(ctx, players[0], players[0].color, players[0].thrust, blink0);
    drawPixelShip(ctx, players[1], players[1].color, players[1].thrust, blink1);
    ctx.fillStyle=WHITE; for (const s of shots) ctx.fillRect(s.x-1, s.y-1, 2, 2);
    drawHud();

    if (HOOKS.attract){
      ctx.fillStyle="rgba(0,0,0,.35)"; ctx.fillRect(0,0,W,H);
      ctx.fillStyle=WHITE; ctx.font="bold 18px system-ui"; ctx.textAlign="center";
      ctx.fillText("Meteor VS", W/2, H/2 - 20);
      ctx.font="13px system-ui";
      ctx.fillText("Pick a mode to start — Practice or Play Online", W/2, H/2 + 4);
      ctx.font="12px system-ui";
      ctx.fillText("Controls: ←/→ rotate · ↑ thrust · space shoot", W/2, H/2 + 22);
    }

    state.renderLast = now;
    requestAnimationFrame(renderFrame);
  }

  function start(seed){ resetWorld(seed); state.running=true; state.simStartPerf = performance.now(); state.lastSimTick=-1; requestAnimationFrame(renderFrame); }
  function stop(){ state.running=false; ctx.clearRect(0,0,W,H); }
  function setAttract(v){ HOOKS.attract = v; }
  function resetP1Inputs(){ const p=players[localIdx]; p.left=false; p.right=false; p.thrust=false; }

  // local input
  function setKey(which, down){
    const p = players[localIdx];
    if (which==="left")   p.left = down;
    if (which==="right")  p.right = down;
    if (which==="thrust") p.thrust = down;
    if (which==="fire" && down){
      if (HOOKS.online){
        const t = currentTick();
        scheduleFire(localIdx, t);
        HOOKS.onInput?.("F", t);
      } else {
        immediateFire(localIdx);
      }
    }
    if (HOOKS.online){
      const code = ({ left:down?"L1":"L0", right:down?"R1":"R0", thrust:down?"T1":"T0" }[which]);
      if (code) HOOKS.onInput?.(code, currentTick());
    }
  }

  // opponent input
  function opponentInput(code, t){
    const i = idxRemote();
    const op = players[i];
    if (code==="L1") op.left=true;
    if (code==="L0") op.left=false;
    if (code==="R1") op.right=true;
    if (code==="R0") op.right=false;
    if (code==="T1") op.thrust=true;
    if (code==="T0") op.thrust=false;
    if (code==="F"){ scheduleFire(i, (typeof t==="number")?t:currentTick()); }
  }

  function getScores(){ return [players[0].score, players[1].score]; }

  return {
    start, stop, setOnline, setLocalIndex, setAttract,
    setHooks:(h)=>{ HOOKS={...HOOKS,...h}; },
    key:setKey, opponentInput, resetP1Inputs, getScores,
  };
}

/** ====== React wrapper (UI + sockets + timer + overlay) ====== */
export default function MeteorArena(){
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const [mode, setMode] = useState(null);        // null | "bot" | "online"
  const [status, setStatus] = useState("Pick a mode to start.");
  const [lives, setLives] = useState({ p1:3, p2:3 });
  const livesRef = useRef(lives); useEffect(()=>{ livesRef.current = lives; },[lives]);

  const [timeLeftMs, setTimeLeftMs] = useState(MATCH_MS);
  const timeLeftRef = useRef(timeLeftMs); useEffect(()=>{ timeLeftRef.current = timeLeftMs; },[timeLeftMs]);
  const timerRef = useRef(null); const deadlineRef = useRef(null);

  const socketRef = useRef(null); const roomIdRef = useRef(null); const sideRef = useRef("p1");
  const awardedRef = useRef(false);

  const aiRef = useRef(null); const botRef = useRef(null); const epochRef = useRef(0);
  const [result, setResult] = useState(null);

  const fmtTime = (ms)=>{ const s=Math.max(0,Math.floor(ms/1000)); const m=Math.floor(s/60), r=s%60; return `${m}:${r.toString().padStart(2,"0")}`; };

  const startAttractAI = useCallback(()=>{
    clearInterval(aiRef.current);
    const epoch=++epochRef.current;
    aiRef.current = setInterval(()=>{
      if (mode) return;
      const ok = () => epoch===epochRef.current && !mode;
      if (!ok()) return;
      const rnd=Math.random();
      engineRef.current?.key("left", rnd<0.33);
      engineRef.current?.key("right", rnd>0.66);
      engineRef.current?.key("thrust", Math.random()<0.4);
      if (Math.random()<0.20) engineRef.current?.key("fire", true);
      setTimeout(()=>{ if(ok()){ engineRef.current?.key("left",false); engineRef.current?.key("right",false); engineRef.current?.key("thrust",false);} }, 140);
      engineRef.current?.opponentInput(Math.random()<0.5?"L1":"R1");
      engineRef.current?.opponentInput(Math.random()<0.5?"T1":"T0");
      if (Math.random()<0.20) engineRef.current?.opponentInput("F");
    },220);
  },[mode]);

  const stopAttractAI = useCallback(()=>{ clearInterval(aiRef.current); ++epochRef.current; engineRef.current?.resetP1Inputs(); },[]);

  const startTimer = useCallback(()=>{
    clearInterval(timerRef.current);
    deadlineRef.current = Date.now() + MATCH_MS;
    setTimeLeftMs(MATCH_MS);
    timerRef.current = setInterval(()=>{
      const left = deadlineRef.current - Date.now();
      setTimeLeftMs(Math.max(0,left));
      if (left<=0) clearInterval(timerRef.current);
    },200);
  },[]);
  const stopTimer = useCallback(()=>{ clearInterval(timerRef.current); },[]);

  const finish = useCallback((win, reason="lives")=>{
    stopTimer(); clearInterval(botRef.current);
    engineRef.current?.setAttract(true);

    const [s1,s2] = engineRef.current?.getScores?.() || [0,0];
    const t1 = s1 + (reason==="time" ? livesRef.current.p1*1000 : 0);
    const t2 = s2 + (reason==="time" ? livesRef.current.p2*1000 : 0);
    setResult({ outcome: win ? "win" : "lose", reason, totals:{p1:t1,p2:t2} });

    setMode(null);
    setStatus(win ? "You win!" : "You lose.");

    if (!awardedRef.current && mode==="online"){
      awardedRef.current = true;
      axios.post(`${API_BASE_URL}/api/games/result`, {
        userId: window.__USER__?._id, gameKey:"meteor", delta: win?4:-3, didWin: !!win
      }).catch(()=>{});
    }
    startAttractAI();
  },[mode, startAttractAI, stopTimer]);

  // init
  useEffect(()=>{
    const ctx = canvasRef.current.getContext("2d");
    engineRef.current = createEngine(ctx, {
      attract:true,
      getLives:()=>livesRef.current,
      getTimerText:()=> (mode ? fmtTime(timeLeftRef.current) : ""),
      onExplode:(idx)=>{
        if (mode==="online"){
          const mine = ((sideRef.current==="p1" && idx===0) || (sideRef.current==="p2" && idx===1));
          if (mine) socketRef.current?.emit("meteor:hit", { roomId: roomIdRef.current });
        }
      }
    });
    engineRef.current.start(12345); // default attract seed
    engineRef.current.setAttract(true);
    startAttractAI();
    return ()=>{ clearInterval(aiRef.current); clearInterval(botRef.current); clearInterval(timerRef.current); engineRef.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // practice end condition
  useEffect(()=>{
    if (mode!=="bot") return;
    if (lives.p2<=0) finish(true,"lives");
    if (lives.p1<=0) finish(false,"lives");
  },[lives,mode,finish]);

  // time end condition
  useEffect(()=>{
    if (!mode) return;
    if (timeLeftMs>0) return;
    if (livesRef.current.p1>0 && livesRef.current.p2>0){
      const [s1,s2] = engineRef.current?.getScores?.() || [0,0];
      const t1 = s1 + livesRef.current.p1*1000;
      const t2 = s2 + livesRef.current.p2*1000;
      finish(t1>=t2,"time");
    }
  },[timeLeftMs, mode, finish]);

  function practice(){
    stopAttractAI();
    setResult(null); awardedRef.current=false; setLives({p1:3,p2:3});
    setMode("bot");
    setStatus("Practice — 3:00 · ←/→ rotate · ↑ thrust · space shoot.");
    engineRef.current?.setHooks({
      online:false, attract:false,
      getLives:()=>livesRef.current,
      getTimerText:()=>fmtTime(timeLeftRef.current),
      onInput:null,
      onExplode:(idx)=>{ setLives(prev=>({ ...prev, [idx===0?"p1":"p2"]: Math.max(0, prev[idx===0?"p1":"p2"]-1) })); }
    });
    engineRef.current?.setAttract(false);
    engineRef.current?.start(777);

    clearInterval(botRef.current);
    botRef.current = setInterval(()=>{
      engineRef.current?.opponentInput(Math.random()<0.5?"L1":"R1");
      setTimeout(()=>engineRef.current?.opponentInput("L0"),120);
      setTimeout(()=>engineRef.current?.opponentInput("R0"),120);
      engineRef.current?.opponentInput(Math.random()<0.5?"T1":"T0");
      if (Math.random()<0.25) engineRef.current?.opponentInput("F");
    },220);

    startTimer();
  }

  const connectSocket = useCallback(()=>{
    if (socketRef.current) return socketRef.current;

    const envBase = (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE)
      ? String(process.env.REACT_APP_API_BASE) : "";
    let WS_BASE =
      (API_BASE_URL && API_BASE_URL.trim()) ||
      (envBase && envBase.trim()) ||
      "";

    if (!WS_BASE) {
      const { protocol, hostname, host } = window.location;
      const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(hostname);
      WS_BASE = isLocal ? `${protocol}//${hostname}:5000` : `${protocol}//${host}`;
    }
    WS_BASE = WS_BASE.replace(/\/+$/, "").replace(/\/api\/?$/, "");

    const s = io(WS_BASE, {
      path: "/socket.io",
      transports: ["websocket","polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    socketRef.current = s;

    s.on("connect", ()=>setStatus("Connected. Queueing…"));
    s.on("meteor:queued", ()=>setStatus("Looking for an opponent…"));
    s.on("meteor:start", ({ roomId, seed, startAt, you })=>{
      stopAttractAI(); setResult(null);
      roomIdRef.current=roomId; sideRef.current=you; setMode("online"); awardedRef.current=false; setLives({p1:3,p2:3});
      engineRef.current?.setHooks({
        online:true, attract:false,
        getLives:()=>livesRef.current,
        getTimerText:()=>fmtTime(timeLeftRef.current),
        onInput:(code,t)=>s.emit("meteor:input",{ roomId, action:code, t }),
        onExplode:(idx)=>{ const mine=(you==="p1"&&idx===0)||(you==="p2"&&idx===1); if (mine) s.emit("meteor:hit",{ roomId }); }
      });
      engineRef.current?.setLocalIndex(you==="p1"?0:1);
      engineRef.current?.setOnline(startAt, seed);
      engineRef.current?.setAttract(false);
      engineRef.current?.start(seed);
      setStatus("Match found — 3:00 · ←/→ rotate · ↑ thrust · space shoot.");
      startTimer();
    });
    s.on("meteor:input", (msg)=>{ engineRef.current?.opponentInput(msg.action, msg.t); });
    s.on("meteor:lives", ({ lives })=> setLives(lives));
    s.on("meteor:gameover", ({ winner })=>{ finish(winner===sideRef.current, "lives"); });

    return s;
  },[stopAttractAI, finish, startTimer]);

  function online(){
    clearInterval(botRef.current);
    const s = connectSocket();
    engineRef.current?.setAttract(true);
    setMode(null); setStatus("Connecting…"); setResult(null);
    if (s?.connected) {
      s.emit("meteor:queue", { userId: window.__USER__?._id, username: window.__USER__?.username });
    }
  }

  function resign(){
    clearInterval(botRef.current); stopTimer();
    if (mode==="online" && socketRef.current && roomIdRef.current){
      socketRef.current.emit("meteor:resign", { roomId: roomIdRef.current });
    }
    engineRef.current?.setAttract(true);
    setMode(null); setStatus("Stopped."); startAttractAI();
  }
  // ==== Mobile controls (virtual buttons) ====
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(!!mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

  const pressRef = useRef({ left:false, right:false, up:false });

  const makePress = (which, down) => {
    if (which==="left")   engineRef.current?.key("left", down);
    if (which==="right")  engineRef.current?.key("right", down);
    if (which==="up")     engineRef.current?.key("thrust", down);
    if (which==="fire" && down) engineRef.current?.key("fire", true);
    pressRef.current = { ...pressRef.current, [which]: down };
  };

  const btnStyle = (w=52,h=52)=>({
    width:w, height:h,
    borderRadius:"9999px",
    border:"1px solid rgba(255,255,255,.30)",
    background:"rgba(255,255,255,.10)",
    color:"#fff",
    display:"flex", alignItems:"center", justifyContent:"center",
    fontWeight:900, fontSize:18,
    boxShadow:"0 2px 8px rgba(0,0,0,.25)",
    // non-selectable / no callout / no highlight
    userSelect:"none", WebkitUserSelect:"none", MozUserSelect:"none", msUserSelect:"none",
    WebkitTouchCallout:"none",
    touchAction:"none",
    outline:"none", WebkitTapHighlightColor:"transparent",
  });

  // key listeners
  useEffect(()=>{
    const kd=(e)=>{ if(!mode) return;
      if (["ArrowLeft","ArrowRight","ArrowUp"," ","Spacebar"].includes(e.key)) e.preventDefault();
      if (e.key==="ArrowLeft")  engineRef.current?.key("left",true);
      if (e.key==="ArrowRight") engineRef.current?.key("right",true);
      if (e.key==="ArrowUp")    engineRef.current?.key("thrust",true);
      if (e.key===" " || e.key==="Spacebar") engineRef.current?.key("fire",true);
    };
    const ku=(e)=>{ if(!mode) return;
      if (["ArrowLeft","ArrowRight","ArrowUp"].includes(e.key)) e.preventDefault();
      if (e.key==="ArrowLeft")  engineRef.current?.key("left",false);
      if (e.key==="ArrowRight") engineRef.current?.key("right",false);
      if (e.key==="ArrowUp")    engineRef.current?.key("thrust",false);
    };
    window.addEventListener("keydown", kd, true);
    window.addEventListener("keyup", ku, true);
    return ()=>{ window.removeEventListener("keydown", kd, true); window.removeEventListener("keyup", ku, true); };
  },[mode]);

  const Overlay = ({ result })=>{
    if (!result) return null;
    const title = result.outcome==="win" ? "YOU WIN!" : "YOU LOSE";
    const reason = result.reason==="time" ? "Time expired — lives converted to points." : "All lives lost.";
    return (
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
        background:"rgba(0,0,0,.6)", color:"#fff", textAlign:"center", pointerEvents:"none", borderRadius:12 }}>
        <div>
          <div style={{ fontSize:36, fontWeight:800, letterSpacing:1 }}>{title}</div>
          <div style={{ marginTop:6, opacity:0.85 }}>{reason}</div>
          <div style={{ marginTop:12, fontSize:14, opacity:0.9 }}>
            P1 Total: <b>{result.totals.p1}</b> • P2 Total: <b>{result.totals.p2}</b>
          </div>
          {mode!=="online" && <div style={{ marginTop:8, fontSize:12, opacity:0.8 }}>Practice match — no trophies awarded.</div>}
        </div>
      </div>
    );
  };

  return (
    <div
      className="meteor-grid"
      style={{ display:"grid", gridTemplateColumns:"minmax(0, 480px) 1fr", gap:16 }}
    >
      <div
        style={{
          position:"relative",
          width:"100%", maxWidth:W,
          border:"1px solid var(--border-color)", borderRadius:12,
          background:"#000", overflow:"hidden", justifySelf:"center"
        }}
      >
        <canvas
          ref={canvasRef}
          width={W} height={H}
          style={{ display:"block", width:"100%", height:"auto", background:"#000", outline:"none" }}
          tabIndex={0}
        />
        <Overlay result={result}/>

        {/* Mobile control overlay (transparent) */}
        {isTouch && (
          <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
            {/* Left: shoot */}
            <div
              style={{ position:"absolute", left:10, bottom:12, pointerEvents:"auto" }}
              onContextMenu={(e)=>e.preventDefault()}
            >
              <div
                style={btnStyle(58,58)}
                onPointerDown={(e)=>{ e.preventDefault(); makePress("fire", true); }}
                onPointerUp={(e)=>{ e.preventDefault(); }}
                onPointerCancel={(e)=>{ e.preventDefault(); }}
                onDragStart={(e)=>e.preventDefault()}
                tabIndex={-1}
                aria-label="Shoot"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" style={{ pointerEvents:"none" }}>
                  <circle cx="12" cy="12" r="7" fill="currentColor" />
                </svg>
              </div>
            </div>

            {/* Right: D-pad (Up above Left/Right) */}
            <div
              style={{
                position:"absolute",
                right:12,
                bottom:12,
                pointerEvents:"auto",
                width:150,
              }}
              onContextMenu={(e)=>e.preventDefault()}
            >
              <div
                style={{
                  display:"grid",
                  gridTemplateColumns:"1fr 1fr",
                  gridTemplateRows:"auto auto",
                  alignItems:"center",
                  justifyItems:"center",
                  gap:10,
                }}
              >
                {/* Up row (centered; spans 2 columns) */}
                <div style={{ gridColumn:"1 / span 2" }}>
                  <div
                    style={btnStyle(52,52)}
                    onPointerDown={(e)=>{ e.preventDefault(); makePress("up", true); }}
                    onPointerUp={(e)=>{ e.preventDefault(); makePress("up", false); }}
                    onPointerLeave={(e)=>{ e.preventDefault(); makePress("up", false); }}
                    onPointerCancel={(e)=>{ e.preventDefault(); makePress("up", false); }}
                    onDragStart={(e)=>e.preventDefault()}
                    tabIndex={-1}
                    aria-label="Thrust"
                  >
                    <svg width="20" height="20" viewBox="0 0 22 22" style={{ pointerEvents:"none" }}>
                      <path d="M11 4 L18 16 H4 Z" fill="currentColor" />
                    </svg>
                  </div>
                </div>

                {/* Left */}
                <div style={{ justifySelf:"end" }}>
                  <div
                    style={btnStyle(52,52)}
                    onPointerDown={(e)=>{ e.preventDefault(); makePress("left", true); }}
                    onPointerUp={(e)=>{ e.preventDefault(); makePress("left", false); }}
                    onPointerLeave={(e)=>{ e.preventDefault(); makePress("left", false); }}
                    onPointerCancel={(e)=>{ e.preventDefault(); makePress("left", false); }}
                    onDragStart={(e)=>e.preventDefault()}
                    tabIndex={-1}
                    aria-label="Rotate Left"
                  >
                    <svg width="20" height="20" viewBox="0 0 22 22" style={{ pointerEvents:"none" }}>
                      <path d="M6 11 L18 4 V18 Z" fill="currentColor" />
                    </svg>
                  </div>
                </div>

                {/* Right */}
                <div style={{ justifySelf:"start" }}>
                  <div
                    style={btnStyle(52,52)}
                    onPointerDown={(e)=>{ e.preventDefault(); makePress("right", true); }}
                    onPointerUp={(e)=>{ e.preventDefault(); makePress("right", false); }}
                    onPointerLeave={(e)=>{ e.preventDefault(); makePress("right", false); }}
                    onPointerCancel={(e)=>{ e.preventDefault(); makePress("right", false); }}
                    onDragStart={(e)=>e.preventDefault()}
                    tabIndex={-1}
                    aria-label="Rotate Right"
                  >
                    <svg width="20" height="20" viewBox="0 0 22 22" style={{ pointerEvents:"none" }}>
                      <path d="M16 11 L4 4 V18 Z" fill="currentColor" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ border:"1px solid var(--border-color)", background:"var(--container-white)", borderRadius:12, padding:12 }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={practice} style={btn()}>Practice vs Bot</button>
          <button onClick={online}   style={btn(true)}>Play Online</button>
          <button onClick={resign}   style={btn()}>Resign</button>
        </div>
        <div style={{ marginTop:10, color:"#555" }}>{status}</div>
        <div style={{ marginTop:10, fontSize:12, color:"#6b7280" }}>
          Controls: <b>←/→</b> rotate · <b>↑</b> thrust · <b>space</b> shoot.
          {mode && <span style={{ marginLeft:8 }}>Time: <b>{fmtTime(timeLeftMs)}</b></span>}
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .meteor-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function btn(primary=false){
  return { padding:"8px 12px", borderRadius:10, border:"1px solid #111", cursor:"pointer",
           background: primary ? "#111" : "#fff", color: primary ? "#fff" : "#111" };
}
