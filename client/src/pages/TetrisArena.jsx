// client/src/pages/TetrisArena.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import { API_BASE_URL } from "../config";

/** ===== constants ===== */
const COLS = 10, ROWS = 20, SIZE = 18;
const ORDER = ["I","O","T","L","J","S","Z"];
const SHAPES = {
  I:[[1,1,1,1]],
  O:[[1,1],[1,1]],
  T:[[0,1,0],[1,1,1]],
  L:[[1,0,0],[1,1,1]],
  J:[[0,0,1],[1,1,1]],
  S:[[0,1,1],[1,1,0]],
  Z:[[1,1,0],[0,1,1]],
};
const SCORES = { 1:100, 2:300, 3:500, 4:800 };
const INPUT_DELAY_TICKS = 2; // must match server

// piece colors (main, light edge, dark edge)
const COLORS = {
  I: ["#00BCD4", "#4DD0E1", "#0097A7"],
  O: ["#FBC02D", "#FFD54F", "#F57F17"],
  T: ["#7E57C2", "#9575CD", "#5E35B1"],
  L: ["#FF9800", "#FFB74D", "#EF6C00"],
  J: ["#2196F3", "#64B5F6", "#1565C0"],
  S: ["#43A047", "#66BB6A", "#2E7D32"],
  Z: ["#E53935", "#EF5350", "#B71C1C"],
};

const BG_GRID = "#e5e7eb";
const BG_NEXT = "#cbd5e1";

// deterministic PRNG + 7-bag
const seeded = (a) => () => { let t=(a+=0x6d2b79f5); t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
const rngFrom=(seed)=>{ const r=seeded(seed||1); return { next:()=>r() }; };
const makeBag=(rng)=>{
  const bag = ORDER.slice();
  for (let i=bag.length-1;i>0;i--){
    const j = Math.floor(rng.next()*(i+1));
    [bag[i],bag[j]] = [bag[j],bag[i]];
  }
  return bag;
};
const clone = m => m.map(r=>r.slice());
const rotCW = m => { const h=m.length,w=m[0].length; const r=[...Array(w)].map(()=>Array(h).fill(0)); for(let y=0;y<h;y++)for(let x=0;x<w;x++) r[x][h-1-y]=m[y][x]; return r; };

// glossy tile
function drawTile(ctx, x, y, cMain, cLight, cDark){
  ctx.fillStyle = cMain;
  ctx.fillRect(x+1, y+1, SIZE-2, SIZE-2);
  // top/left highlight
  ctx.fillStyle = cLight;
  ctx.fillRect(x+1, y+1, SIZE-2, 3);
  ctx.fillRect(x+1, y+1, 3, SIZE-2);
  // bottom/right shade
  ctx.fillStyle = cDark;
  ctx.fillRect(x+1, y+SIZE-4, SIZE-2, 3);
  ctx.fillRect(x+SIZE-4, y+1, 3, SIZE-2);
}

/** ===== pure deterministic engine (integer ticks) ===== */
function createTetris(ctx, baseX, seed, hooks={}){
  const H = { onScore:()=>{} , ...hooks };
  const rng = rngFrom(seed||1);
  let bag = makeBag(rng);
  const nextQ = []; // queue of piece letters

  const G = {
    grid: [...Array(ROWS)].map(()=>Array(COLS).fill(0)), // cells hold 0 or piece letter
    piece: null, // {t, m}, t=letter, m=matrix
    px: 3, py: 0,
    over:false, score:0,
    fallInterval: 48,   // ticks per cell (48/60s ≈ 0.8s)
    fallCount: 48,
  };

  // prime queue
  while (nextQ.length < 5){
    if (!bag.length) bag = makeBag(rng);
    nextQ.push(bag.pop());
  }

  function spawn(){
    if (!bag.length) bag = makeBag(rng);
    const t = nextQ.shift();
    nextQ.push((bag.length ? bag : (bag=makeBag(rng))).pop());
    G.piece = { t, m: clone(SHAPES[t]) };
    G.px = Math.floor((COLS - G.piece.m[0].length)/2);
    G.py = -1;
    if (collide(G.px,G.py,G.piece.m)) G.over = true;
    G.fallCount = G.fallInterval;
  }

  function collide(px,py,p){
    for (let y=0;y<p.length;y++){
      for (let x=0;x<p[0].length;x++){
        if (!p[y][x]) continue;
        const gx = px+x, gy = py+y;
        if (gx<0 || gx>=COLS || gy>=ROWS) return true;
        if (gy>=0 && G.grid[gy][gx]) return true;
      }
    }
    return false;
  }

  function merge(){
    for (let y=0;y<G.piece.m.length;y++)
      for (let x=0;x<G.piece.m[0].length;x++)
        if (G.piece.m[y][x] && G.py+y>=0) G.grid[G.py+y][G.px+x] = G.piece.t;
  }

  function clearLines(){
    let cleared=0;
    for (let y=ROWS-1;y>=0;y--){
      if (G.grid[y].every(v=>v)){
        G.grid.splice(y,1);
        G.grid.unshift(Array(COLS).fill(0));
        cleared++; y++;
      }
    }
    if (cleared){
      G.score += SCORES[cleared] || 0; // ✅ score only for line clears
      H.onScore?.(G.score);
    }
  }

  function speedUp(){ G.fallInterval = Math.max(4, Math.floor(G.fallInterval*0.985)); }

  function lock(){ merge(); clearLines(); speedUp(); spawn(); }

  // actions (order-deterministic)
  function left(){ if (!collide(G.px-1,G.py,G.piece.m)) G.px--; }
  function right(){ if (!collide(G.px+1,G.py,G.piece.m)) G.px++; }
  function rot(){ const r=rotCW(G.piece.m); if (!collide(G.px,G.py,r)) G.piece.m=r; }
  function soft(){ // move down one; no points for forcing down
    if (!collide(G.px,G.py+1,G.piece.m)) { G.py++; G.fallCount = G.fallInterval; }
    else lock();
  }
  function hardDrop(){ // drop to floor; no points for forcing down
    while(!collide(G.px,G.py+1,G.piece.m)){ G.py++; }
    lock();
  }

  function drawBoard(){
    ctx.save();
    ctx.clearRect(baseX, 0, COLS*SIZE, ROWS*SIZE);
    ctx.strokeStyle=BG_GRID;
    for(let y=0;y<ROWS;y++)
      for(let x=0;x<COLS;x++){
        ctx.strokeRect(baseX+x*SIZE, y*SIZE, SIZE, SIZE);
        const cell = G.grid[y][x];
        if (cell){
          const [c,cl,cd] = COLORS[cell];
          drawTile(ctx, baseX+x*SIZE, y*SIZE, c, cl, cd);
        }
      }
    if (G.piece && !G.over){
      const [c,cl,cd] = COLORS[G.piece.t];
      for(let y=0;y<G.piece.m.length;y++)
        for(let x=0;x<G.piece.m[0].length;x++)
          if (G.piece.m[y][x])
            drawTile(ctx, baseX+(G.px+x)*SIZE, (G.py+y)*SIZE, c, cl, cd);
    }
    // HUD
    ctx.fillStyle="#111"; ctx.font="12px system-ui"; ctx.textAlign="left";
    ctx.fillText(`Score: ${G.score}`, baseX+4, 14);
    ctx.textAlign="right";
    ctx.fillText("Next", baseX+COLS*SIZE-4, 14);
    const nextT = nextQ[0];
    const pv = SHAPES[nextT];
    const bw = pv[0].length, bh = pv.length;
    const boxW = 4*SIZE, boxH = 4*SIZE;
    const bx = baseX + COLS*SIZE - boxW - 6, by = 20;
    ctx.strokeStyle=BG_NEXT; ctx.strokeRect(bx,by,boxW,boxH);
    const ox = bx + Math.floor((boxW - bw*SIZE)/2);
    const oy = by + Math.floor((boxH - bh*SIZE)/2);
    const [c,cl,cd] = COLORS[nextT];
    for (let y=0;y<bh;y++) for (let x=0;x<bw;x++){
      if (!pv[y][x]) continue;
      drawTile(ctx, ox+x*SIZE, oy+y*SIZE, c, cl, cd);
    }
    ctx.restore();
  }

  // one deterministic simulation tick
  function tick(){
    if (G.over) { drawBoard(); return; }
    G.fallCount--;
    if (G.fallCount <= 0){
      if (!collide(G.px,G.py+1,G.piece.m)) { G.py++; G.fallCount = G.fallInterval; }
      else { lock(); }
    }
    drawBoard();
  }

  function start(){ spawn(); drawBoard(); }

  return { g:G, start, tick, left, right, rot, soft, hardDrop, drawBoard };
}

/** ===== React wrapper ===== */
export default function TetrisArena(){
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  const meRef = useRef(null);
  const opRef = useRef(null);

  const [mode, setMode] = useState(null); // null | "bot" | "online"
  const [status, setStatus] = useState("Pick a mode to start.");
  const [result, setResult] = useState(null);

  const socketRef = useRef(null);
  const roomIdRef = useRef(null);
  const sideRef = useRef("left");
  const tickHzRef = useRef(60);
  const serverTickRef = useRef(0);
  const lastSimTickRef = useRef(0);

  // tick->actions maps (authoritative)
  const myQRef = useRef(new Map());
  const opQRef = useRef(new Map());

  const awardedRef = useRef(false);

  // local sim for Practice mode
  const simIntRef = useRef(null);
  const clearSim = useCallback(()=>{
    if (simIntRef.current){ clearInterval(simIntRef.current); simIntRef.current=null; }
  },[]);

  useEffect(()=>{
    // attract screen
    const c = canvasRef.current; const ctx = c.getContext("2d");
    ctx.clearRect(0,0,c.width,c.height);
    ctx.fillStyle="#f8fafc"; ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle="rgba(0,0,0,.6)"; ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle="#fff"; ctx.font="bold 18px system-ui"; ctx.textAlign="center";
    ctx.fillText("Tetris VS", c.width/2, c.height/2 - 20);
    ctx.font="13px system-ui";
    ctx.fillText("Pick a mode to start — Practice or Play Online", c.width/2, c.height/2 + 4);
    ctx.font="12px system-ui";
    ctx.fillText("Controls: ←/→ move · ↑ rotate · ↓ soft drop · space hard drop", c.width/2, c.height/2 + 22);
    return ()=>{ clearSim(); cancelAnimationFrame(rafRef.current); };
  },[clearSim]);

  // render loop (draws; simulation advances in simInt (practice) or server ticks (online))
  const loop = useCallback(() => {
    meRef.current?.drawBoard();
    opRef.current?.drawBoard();
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const clearLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  const finish = useCallback((didWin) => {
    clearSim();
    clearLoop();
    setMode(null);
    setResult(didWin ? "YOU WIN!" : "YOU LOSE");
    setStatus(didWin ? "You win! (+6 trophies)" : "You lose. (-5 trophies)");
    if (!awardedRef.current) {
      awardedRef.current = true;
      axios
        .post(`${API_BASE_URL}/api/games/result`, {
          userId: window.__USER__?._id,
          gameKey: "tetris",
          delta: didWin ? 6 : -5,
          didWin: !!didWin,
        })
        .catch(() => {});
    }
  }, [clearLoop, clearSim, setMode, setResult, setStatus]);

  // keyboard: in ONLINE we do NOT apply immediately; we send to server with desiredTick
  useEffect(()=>{
    if (!mode) return;
    const s = socketRef.current;
    const kd = (e)=>{
      const key = e.key;
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," ","Spacebar"].includes(key)) e.preventDefault();
      if (mode==="bot"){
        // local practice plays instantly (client-authoritative)
        if (key==="ArrowLeft")  meRef.current.left();
        if (key==="ArrowRight") meRef.current.right();
        if (key==="ArrowUp")    meRef.current.rot();
        if (key==="ArrowDown")  meRef.current.soft();
        if (key===" " || key==="Spacebar") meRef.current.hardDrop();
        return;
      }
      // online: enqueue via server
      const action =
          key==="ArrowLeft"  ? "L" :
          key==="ArrowRight" ? "R" :
          key==="ArrowUp"    ? "U" :
          key==="ArrowDown"  ? "D" :
          (key===" " || key==="Spacebar") ? "H" : null;
      if (!action) return;
      const desiredTick = serverTickRef.current + INPUT_DELAY_TICKS;
      s?.emit("tetris:input", { roomId: roomIdRef.current, action, desiredTick });
    };
    window.addEventListener("keydown", kd, true);
    return ()=> window.removeEventListener("keydown", kd, true);
  },[mode]);

  // ==== Mobile detection & action helper ====
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

  const sendAction = useCallback((action) => {
    if (mode === "bot") {
      if      (action==="L") meRef.current?.left();
      else if (action==="R") meRef.current?.right();
      else if (action==="U") meRef.current?.rot();
      else if (action==="D") meRef.current?.soft();
      else if (action==="H") meRef.current?.hardDrop();
      return;
    }
    const desiredTick = serverTickRef.current + INPUT_DELAY_TICKS;
    socketRef.current?.emit("tetris:input", { roomId: roomIdRef.current, action, desiredTick });
  }, [mode]);

    // ==== Slide pad (drag to move left/right with repeat) + Rotate button ====
  const padRef = useRef({ active:false, lastX:0, acc:0 });
  const STEP_PX = 20; // movement repeat every 20px of drag

  const onPadPointerDown = (e) => {
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    const x = e.clientX;
    padRef.current = { active:true, lastX:x, acc:0 };
    // while interacting with the pad, prevent vertical scrolling entirely
    e.preventDefault();
  };
  const onPadPointerMove = (e) => {
    if (!padRef.current.active) return;
    const x = e.clientX;
    let dx = x - padRef.current.lastX;
    padRef.current.lastX = x;
    padRef.current.acc += dx;
    while (padRef.current.acc <= -STEP_PX) { sendAction("L"); padRef.current.acc += STEP_PX; }
    while (padRef.current.acc >=  STEP_PX) { sendAction("R"); padRef.current.acc -= STEP_PX; }
    // keep page from scrolling while sliding
    e.preventDefault();
  };
  const endPad = (e) => {
    padRef.current.active = false; padRef.current.acc = 0;
    e.preventDefault();
  };

  const rotateTap = (e) => { e.preventDefault(); sendAction("U"); };
  const dropTap =   (e) => { e.preventDefault(); sendAction("H"); };

  const btnStyle = (w=48,h=48)=>({
    width:w, height:h,
    borderRadius:"9999px",
    border:"1px solid rgba(255,255,255,.35)",
    background:"rgba(17,17,17,.24)",
    backdropFilter:"blur(6px)",
    color:"#fff",
    display:"flex", alignItems:"center", justifyContent:"center",
    boxShadow:"0 2px 10px rgba(0,0,0,.28)",
    opacity:.85,
    userSelect:"none", WebkitUserSelect:"none", MozUserSelect:"none", msUserSelect:"none",
    WebkitTouchCallout:"none", WebkitTapHighlightColor:"transparent",
    touchAction:"none", outline:"none"
  });

  function startPractice(){
    const ctx = canvasRef.current.getContext("2d");
    const W = (COLS*2+1)*SIZE, H = ROWS*SIZE;
    ctx.clearRect(0,0,W,H);

    meRef.current = createTetris(ctx, 0, 12345, { onScore:(s)=>{} });
    opRef.current = createTetris(ctx, (COLS+1)*SIZE, 12345, { onScore:(s)=>{} });

    meRef.current.start(); opRef.current.start();
    setResult(null); setMode("bot");
    setStatus("Practice — ←/→ move · ↑ rotate · ↓ soft drop · space hard drop.");
    clearLoop(); rafRef.current = requestAnimationFrame(loop);

    clearSim();
    // ✅ local simulation ticks (60 Hz) so pieces fall properly in practice mode
    simIntRef.current = setInterval(()=>{
      meRef.current?.tick();
      opRef.current?.tick();
      // finish if someone topped out
      if (meRef.current?.g.over || opRef.current?.g.over){
        clearInterval(simIntRef.current);
        simIntRef.current = null;
        const win =
          !meRef.current?.g.over &&
          (meRef.current?.g.score || 0) >= (opRef.current?.g.score || 0);
        finish(!!win);
      }
    }, 1000/60);

    // dumb bot presses (still needs gravity from the sim above)
    const bot = setInterval(()=>{
      if (!opRef.current || opRef.current.g.over){ clearInterval(bot); return; }
      const r=Math.random();
      if (r<0.4) opRef.current.left(); else if (r<0.8) opRef.current.right(); else opRef.current.rot();
      if (Math.random()<0.35) opRef.current.soft();
    }, 120);
  }

  const ensureSocket = useCallback(()=>{
    if (socketRef.current) return socketRef.current;

    // Derive a tunnel-safe base (works for localhost too)
    let WS_BASE = (API_BASE_URL && API_BASE_URL.trim()) || '';
    WS_BASE = WS_BASE.replace(/\/+$/, '').replace(/\/api\/?$/, '');

    // If the page is on a Cloudflare Tunnel, force sockets to use the SAME host
    try {
      const po = new URL(window.location.origin);
      const wb = new URL(WS_BASE || po.origin);
      if (/trycloudflare\.com$/i.test(po.hostname) && po.hostname !== wb.hostname) {
        WS_BASE = po.origin;
      }
    } catch {}

    // If the page is on a Cloudflare Tunnel, force sockets to use the SAME host
    try {
      const po = new URL(window.location.origin);
      const wb = new URL(WS_BASE || po.origin);
      if (/trycloudflare\.com$/i.test(po.hostname) && po.hostname !== wb.hostname) {
        WS_BASE = po.origin;
      }
    } catch {}

    const s = io(WS_BASE || undefined, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'], // start with polling, then upgrade
      upgrade: true,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 750,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
    });

    socketRef.current = s;

    s.on("connect", ()=>setStatus("Connected. Queueing…"));
    s.on("tetris:queued", ()=>setStatus("Looking for an opponent…"));

    s.on("tetris:start", ({ roomId, seed, tickHz, you })=>{
      clearSim(); // ensure local sim is off in online mode
      roomIdRef.current = roomId; sideRef.current = you; tickHzRef.current = tickHz||60;
      serverTickRef.current = 0; lastSimTickRef.current = 0;
      myQRef.current.clear?.(); opQRef.current.clear?.();
      myQRef.current = new Map(); opQRef.current = new Map();
      awardedRef.current=false;

      const ctx = canvasRef.current.getContext("2d");
      meRef.current = createTetris(ctx, you==="left"?0:(COLS+1)*SIZE, seed, {
        onScore:(sc)=> s.emit("tetris:score", { roomId: roomIdRef.current, score: sc })
      });
      opRef.current = createTetris(ctx, you==="left"?(COLS+1)*SIZE:0, seed);
      meRef.current.start(); opRef.current.start();
      clearLoop(); rafRef.current = requestAnimationFrame(loop);
      setMode("online");
      setStatus("Match found — synced lockstep. Controls: ←/→, ↑, ↓, space.");
    });

    // Authoritative tick: advance sim to this tick (catch up if needed)
    s.on("tetris:tick", ({ tick })=>{
      serverTickRef.current = tick;
      while (lastSimTickRef.current < tick){
        const t = ++lastSimTickRef.current;

        const apply = (inst, Qmap)=>{
          const list = Qmap.get(t);
          if (list && list.length){
            for (const a of list){
              if      (a==="L") inst.left();
              else if (a==="R") inst.right();
              else if (a==="U") inst.rot();
              else if (a==="D") inst.soft();
              else if (a==="H") inst.hardDrop();
            }
            Qmap.delete(t);
          }
          inst.tick(); // physics/gravity once per tick
        };
        meRef.current && apply(meRef.current, myQRef.current);
        opRef.current && apply(opRef.current, opQRef.current);

        // if I topped out, tell server once
        if (meRef.current?.g.over) s.emit("tetris:topout", { roomId: roomIdRef.current });
      }
    });

    // Inputs arrive stamped with the tick they must be applied and who sent them
    s.on("tetris:input", ({ from, action, tick })=>{
      const Q = from===sideRef.current ? myQRef.current : opQRef.current;
      if (!Q.has(tick)) Q.set(tick, []);
      Q.get(tick).push(action);
    });

    s.on("tetris:opscore", ({ score })=>{ /* optional opponent HUD */ });

    s.on("tetris:topout", ({ winner })=>{
      const didWin = winner===sideRef.current;
      finish(didWin);
    });

    return s;
  },[loop, finish, clearLoop, clearSim]);

  function online(){
    const s=ensureSocket();
    setResult(null); setStatus("Connecting…");
    s.emit("tetris:queue", { userId: window.__USER__?._id, username: window.__USER__?.username });
  }

  function resign(){
    if (mode==="online" && socketRef.current && roomIdRef.current){
      socketRef.current.emit("tetris:resign", { roomId: roomIdRef.current });
    }
    clearSim();
    clearLoop(); setMode(null); setStatus("Stopped.");
  }

  const W = (COLS*2+1)*SIZE, H = ROWS*SIZE;
  return (
    <div
      className="tetris-grid"
      style={{ display:"grid", gridTemplateColumns:`minmax(0, ${W}px) 1fr`, gap:16 }}
    >
      {/* LEFT COLUMN: Game card + controls BELOW the board */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
        {/* Game board card WITH an in-card controls row */}
        <div
          style={{
            position:"relative",
            width:"100%", maxWidth:W,
            border:"1px solid var(--border-color)", borderRadius:12,
            background:"#f8fafc", overflow:"hidden"
          }}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            style={{ display:"block", width:"100%", height:"auto", background:"linear-gradient(#f8fafc,#eef2f7)" }}
          />

          {/* In-card mobile controls row (fits the white strip you marked) */}
          {isTouch && (
            <div
              style={{
                height:62, padding:"8px 10px",
                display:"flex", alignItems:"center", justifyContent:"space-between",
                borderTop:"1px solid #e5e7eb", background:"#fff"
              }}
            >
              {/* Left: small vertical cluster (Rotate, Quick Drop) */}
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div
                  style={btnStyle(44,44)}
                  onPointerDown={rotateTap}
                  onDragStart={(e)=>e.preventDefault()}
                  tabIndex={-1}
                  aria-label="Rotate"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" style={{ pointerEvents:"none" }} aria-hidden="true">
                    <path d="M12 5v3l4-4-4-4v3A8 8 0 1 0 20 12h-2a6 6 0 1 1-6-7z" fill="currentColor"/>
                  </svg>
                </div>
                <div
                  style={btnStyle(44,44)}
                  onPointerDown={dropTap}
                  onDragStart={(e)=>e.preventDefault()}
                  tabIndex={-1}
                  aria-label="Quick Drop"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" style={{ pointerEvents:"none" }} aria-hidden="true">
                    <path d="M12 3v12M12 15l-4-4m4 4 4-4M5 21h14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* Right: compact slide pad */}
              <div
                style={{
                  flex:"1 1 auto", marginLeft:12,
                  minWidth:140, maxWidth:260, height:46,
                  background:"rgba(17,17,17,.18)", border:"1px solid rgba(0,0,0,.10)",
                  borderRadius:12, backdropFilter:"blur(6px)",
                  boxShadow:"inset 0 1px 0 rgba(255,255,255,.35)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  touchAction:"none", overscrollBehavior:"contain"
                }}
                onPointerDown={onPadPointerDown}
                onPointerMove={onPadPointerMove}
                onPointerUp={endPad}
                onPointerCancel={endPad}
                onTouchMove={(e)=>e.preventDefault()}
                onWheel={(e)=>e.preventDefault()}
                onContextMenu={(e)=>e.preventDefault()}
              >
                <div style={{ display:"flex", gap:16, opacity:.95 }}>
                  <svg width="18" height="18" viewBox="0 0 22 22" style={{ pointerEvents:"none" }} aria-hidden="true">
                    <path d="M6 11 L18 4 V18 Z" fill="#fff" />
                  </svg>
                  <svg width="18" height="18" viewBox="0 0 22 22" style={{ pointerEvents:"none" }} aria-hidden="true">
                    <path d="M16 11 L4 4 V18 Z" fill="#fff" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div
              style={{
                position:"absolute", inset:0, display:"flex",
                alignItems:"center", justifyContent:"center",
                background:"rgba(0,0,0,.55)", color:"#fff", textAlign:"center",
                pointerEvents:"none"
              }}
            >
              <div>
                <div style={{ fontSize:36, fontWeight:800, letterSpacing:1 }}>{result}</div>
                <div style={{ marginTop:8, fontSize:12, opacity:0.85 }}>
                  Winner decided by higher score when a player tops out.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Sidebar */}
      <div style={{ border:"1px solid var(--border-color)", background:"var(--container-white)", borderRadius:12, padding:12 }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={startPractice} style={btn()}>Practice vs Bot</button>
          <button onClick={online}         style={btn(true)}>Play Online</button>
          <button onClick={resign}         style={btn()}>Resign</button>
        </div>
        <div style={{ marginTop:10, color:"#555" }}>{status}</div>
        <div style={{ marginTop:10, fontSize:12, color:"#6b7280" }}>
          Controls: <b>←/→</b> move · <b>↑</b> rotate · <b>↓</b> soft drop · <b>space</b> hard drop.
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .tetris-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function btn(primary=false){
  return { padding:"8px 12px", borderRadius:10, border:"1px solid #111", cursor:"pointer",
           background: primary ? "#111" : "#fff", color: primary ? "#fff" : "#111" };
}
