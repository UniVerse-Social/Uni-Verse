import React, { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import { API_BASE_URL } from "../config";

/** ----- constants ----- */
const W = 456, H = 456, HEADER = 24, HALF = H / 2, LANE_H = HALF - HEADER, GROUND_Y = LANE_H - 12;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const seeded = (a) => () => { let t = (a += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rngFrom = (seed) => { const r = seeded(seed || 1); return { next: () => r(), pick: (arr) => arr[Math.floor(r() * arr.length)], range: (a, b) => a + (b - a) * r() }; };
const overlap = (a, b) => !(
  a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y
);

/** ----- sprites ----- */
const SPRITES = {
  player: [
    "00111100","01111110","11111111","11101111",
    "11111111","01111110","01111110","01101110",
    "01001010","11001011","10000001","10000001",
  ],
  playerDuck: [
    "001111111100","011111111110","111111111111","111111111111",
    "011111111110","001111111100","000111111000","000111111000",
  ],
  cactus: [
    "00011000","00011000","00011000","01111110","01111110","00111100",
    "00111100","00111100","00111100","00111100","00111100","00111100",
    "00111100","00111100",
  ],
  bird1: [
    "000011100000","000111110000","011111111100","111111111110",
    "001111111000","000111110000","111100000000","111000000000",
  ],
  bird2: [
    "000011100000","000111110000","011111111100","111111111110",
    "001111111000","000111110000","000000111100","000000011110",
  ],
};

function drawSprite(ctx, sprite, xCenter, yBottom, scale, body = "#111", accent = "#fff") {
  const rows = sprite.length, cols = sprite[0].length, w = cols * scale, h = rows * scale;
  const left = Math.round(xCenter - w / 2), top = Math.round(yBottom - h);
  for (let r = 0; r < rows; r++) {
    const row = sprite[r];
    for (let c = 0; c < cols; c++) {
      const px = row[c];
      if (px === "0") continue;
      ctx.fillStyle = px === "1" ? body : accent;
      ctx.fillRect(left + c * scale, top + r * scale, scale, scale);
    }
  }
  return { x: left, y: top, w, h };
}

function drawIdleBoard(ctx) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#e2e8f0"; ctx.fillRect(0, HALF - 1, W, 2);
  ctx.fillStyle = "#334155"; ctx.font = "bold 14px system-ui,-apple-system,Segoe UI,Roboto"; ctx.textAlign = "center";
  ctx.fillText("Opponent Lane", W / 2, 16); ctx.fillText("Your Lane", W / 2, HALF + 16);
  const topG = HEADER + GROUND_Y, botG = HEADER + GROUND_Y + HALF;
  ctx.fillStyle = "#cbd5e1"; ctx.fillRect(0, topG, W, 2); ctx.fillRect(0, botG, W, 2);
  drawSprite(ctx, SPRITES.player, 74, topG, 2.5, "#4b5563"); ctx.fillStyle = "#111"; ctx.font = "bold 10px system-ui"; ctx.fillText("RIVAL", 74, topG - 4);
  drawSprite(ctx, SPRITES.player, 74, botG, 2.5, "#111"); ctx.fillText("YOU", 74, botG - 4);
  ctx.fillStyle = "#6b7280"; ctx.font = "bold 16px system-ui,-apple-system,Segoe UI,Roboto"; ctx.fillText("Pick a mode to start.", W / 2, H / 2);
}

function drawResult(ctx, text) {
  ctx.fillStyle = "rgba(17,17,17,.55)"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff"; ctx.font = "bold 28px system-ui,-apple-system,Segoe UI,Roboto"; ctx.textAlign = "center";
  ctx.fillText(text, W / 2, H / 2);
}

/** ----- engine ----- */
function createEngine(ctx, hooks = {}) {
  let HOOKS = { online: false, getLives: () => ({ top: 3, bottom: 3 }), onInput: null, onHit: null, ...hooks };

  const lanes = [{ top: 0, color: "#4b5563" }, { top: HALF, color: "#111" }];

  const state = {
    running: false, last: 0, elapsed: 0,
    baseSpeed: 260,
    // online deterministic spawner
    online: false, startAt: 0, tickMs: 380, seed: 1, rng: rngFrom(1),
    lastTick: -1, cooldownTop: 0, cooldownBottom: 0,
    startPerf: 0, // perf.now()-aligned start time (computed from server epoch)
  };

  function speed(t) {
    // deterministic speed as a function of absolute elapsed time t
    const mult = 1 + Math.min(1.4, t * 0.025);
    return state.baseSpeed * mult;
  }

  function mkRunner() { return { x: 74, y: 0, vy: 0, duck: false, duckUntil: 0, blinkUntil: 0, jumpVel: -880, gravity: 2400 }; }
  const runners = [mkRunner(), mkRunner()];

  const lanesState = [{ obs: [], dist: 0, gap: 340 }, { obs: [], dist: 0, gap: 340 }];

  function reset() {
    state.running = true; state.last = performance.now(); state.elapsed = 0;
    runners[0] = mkRunner(); runners[1] = mkRunner();
    lanesState[0] = { obs: [], dist: 0, gap: 340 };
    lanesState[1] = { obs: [], dist: 0, gap: 340 };
    state.lastTick = -1; state.cooldownTop = 0; state.cooldownBottom = 0;
  }

  function spawn(laneIdx, kind, yOverride) {
    const L = lanes[laneIdx];
    if (kind === "cactus") {
      lanesState[laneIdx].obs.push({ type: "cactus", x: W + 20, y: HEADER + GROUND_Y + L.top, scale: 2 });
    } else if (kind === "bird") {
      const y = yOverride ?? (HEADER + GROUND_Y - 26 + L.top);
      lanesState[laneIdx].obs.push({ type: "bird", x: W + 20, y, scale: 2, flap: 0 });
    }
  }

  // online deterministic spawner: same ticks, same PRNG -> same obstacles
  function onlineSpawn(now) {
    // Convert to online timeline via startPerf (both in performance.now() domain)
    const tMs = now - state.startPerf;
    if (tMs < 0) return; // not started yet
    const tick = Math.floor(tMs / state.tickMs);
    if (tick <= state.lastTick) return;

    for (let i = state.lastTick + 1; i <= tick; i++) {
      // each tick update cooldowns
      if (state.cooldownTop > 0) state.cooldownTop--;
      if (state.cooldownBottom > 0) state.cooldownBottom--;

      // decide per lane
      for (const lane of ["top", "bottom"]) {
        const cdKey = lane === "top" ? "cooldownTop" : "cooldownBottom";
        if (state[cdKey] > 0) continue;

        const r = state.rng.next(); // [0,1)
        if (r < 0.58) { // spawn
          const cactus = state.rng.next() < 0.75;
          if (lane === "top") spawn(0, cactus ? "cactus" : "bird", cactus ? undefined : (HEADER + GROUND_Y - 26 + lanes[0].top));
          else spawn(1, cactus ? "cactus" : "bird", cactus ? undefined : (HEADER + GROUND_Y - 26 + lanes[1].top));

          // set cooldown in ticks (shorter as time goes)
          const t = Math.max(0, (i * state.tickMs) / 1000);
          const spd = speed(t);
          const minGap = clamp(6 - Math.floor((spd - 260) / 80), 3, 6); // 3..6 ticks
          state[cdKey] = minGap;

          // small chance of double cactus (tight)
          if (cactus && state.rng.next() < 0.18) {
            if (lane === "top") lanesState[0].obs.push({ type: "cactus", x: W + 46, y: HEADER + GROUND_Y + lanes[0].top, scale: 2 });
            else lanesState[1].obs.push({ type: "cactus", x: W + 46, y: HEADER + GROUND_Y + lanes[1].top, scale: 2 });
          }
        }
      }
    }
    state.lastTick = tick;
  }

  function setOnline(startAt, seed) {
    state.online = true;
    state.startAt = startAt;
    state.seed = seed || 1;
    state.rng = rngFrom(state.seed);
    state.lastTick = -1;
    state.cooldownTop = 0; state.cooldownBottom = 0;
    // Align server epoch (Date.now) to performance clock locally
    state.startPerf = performance.now() + (startAt - Date.now());
  }

  function opponentAct(action, atMs) {
    const r = runners[0]; const now = performance.now(); const when = atMs ? (atMs - Date.now() + now) : now;
    if (action === "jump" && r.y === 0) r.vy = r.jumpVel;
    if (action === "roll") r.duckUntil = when + 320;
  }

  let lastHitAt = 0;

  function step() {
    if (!state.running) return;
    const now = performance.now();
    const dt = clamp((now - state.last) / 1000, 0, 0.05);
    state.last = now;
    state.elapsed += dt;

    const spd = speed(state.elapsed);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#e2e8f0"; ctx.fillRect(0, HALF - 1, W, 2);
    ctx.fillStyle = "#334155"; ctx.font = "bold 14px system-ui,-apple-system,Segoe UI,Roboto"; ctx.textAlign = "center";
    ctx.fillText("Opponent Lane", W / 2, 16); ctx.fillText("Your Lane", W / 2, HALF + 16);

    const live = HOOKS.getLives?.() || { top: 3, bottom: 3 };
    ctx.fillStyle = "#ef4444"; ctx.font = "bold 14px system-ui"; ctx.textAlign = "right";
    ctx.fillText("♥".repeat(live.top) + "♡".repeat(3 - live.top), W - 8, 36);
    ctx.fillText("♥".repeat(live.bottom) + "♡".repeat(3 - live.bottom), W - 8, HALF + 36);

    // spawn
    if (state.online) onlineSpawn(now);
    else {
      // practice distance-based spawn (kept)
      for (let i = 0; i < 2; i++) {
        const st = lanesState[i]; st.dist += spd * dt;
        if (st.dist >= st.gap) {
          const cactus = Math.random() < 0.75;
          spawn(i, cactus ? "cactus" : "bird");
          st.gap = cactus ? clamp(360 - spd * 0.10, 260, 360) + 200 * Math.random()
                          : clamp(420 - spd * 0.08, 300, 420) + 220 * Math.random();
          st.dist = 0;
        }
      }
    }

    for (let i = 0; i < 2; i++) {
      const L = lanes[i]; const st = lanesState[i]; const baseGround = HEADER + GROUND_Y + L.top;
      ctx.fillStyle = "#cbd5e1"; ctx.fillRect(0, baseGround, W, 2);

      // move/draw
      for (const o of st.obs) {
        o.x -= spd * dt;
        if (o.type === "cactus") drawSprite(ctx, SPRITES.cactus, o.x, o.y, o.scale, "#111");
        else { o.flap = (o.flap || 0) + dt; const frame = Math.sin(o.flap * 10) > 0 ? SPRITES.bird1 : SPRITES.bird2; drawSprite(ctx, frame, o.x, o.y, o.scale, "#111"); }
      }
      while (st.obs.length && st.obs[0].x < -40) st.obs.shift();

      // simple rival AI for practice only
      if (i === 0 && !state.online) {
        const r = runners[0];
        const first = st.obs.find(o => o.x > r.x && o.x < r.x + 160);
        if (first) {
          const dist = first.x - r.x;
          const g = HEADER + GROUND_Y + L.top;
          if (first.type === "cactus") { if (dist < clamp(120 - spd * 0.03, 70, 110) && r.y === 0) r.vy = r.jumpVel; }
          else {
            const low = first.y >= g - 14;
            if (low && dist < 120) r.duckUntil = now + 240;
            else if (first.y < g - 28 && dist < 90 && r.y === 0) r.vy = r.jumpVel;
          }
        } else r.duck = false;
      }

      const r = runners[i];
      if (r.duckUntil) r.duck = now < r.duckUntil;
      if (r.y < 0 || r.vy < 0) { r.vy += 2400 * dt; r.y += r.vy * dt; if (r.y > 0) { r.y = 0; r.vy = 0; } } else r.y = 0;

      const blinking = now < r.blinkUntil && Math.floor(now / 60) % 2 === 0;
      if (!blinking) {
        const hb = drawSprite(ctx, r.duck ? SPRITES.playerDuck : SPRITES.player, r.x, baseGround + r.y, 2.5, L.color, "#fff");
        ctx.fillStyle = "#111"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "center"; ctx.fillText(i === 0 ? "RIVAL" : "YOU", r.x, hb.y + hb.h - 4);

        for (const o of st.obs) {
          const oBox = (o.type === "cactus")
            ? (() => { const S = SPRITES.cactus, s = o.scale; return { x: o.x - (S[0].length * s) / 2, y: o.y - (S.length * s), w: S[0].length * s, h: S.length * s }; })()
            : (() => { const S = SPRITES.bird1, s = o.scale; return { x: o.x - (S[0].length * s) / 2, y: o.y - (S.length * s), w: S[0].length * s, h: S.length * s }; })();
          const rBox = { x: hb.x + 2, y: hb.y + 2, w: hb.w - 4, h: hb.h - 4 };
          if (overlap(rBox, oBox)) {
            r.blinkUntil = now + 450;
            if (now - lastHitAt > 420) { lastHitAt = now; HOOKS.onHit?.(i); }
            break;
          }
        }
      }
    }
  }

  let raf = 0; const loop = () => { step(); raf = requestAnimationFrame(loop); };
  return {
    setHooks(h) { HOOKS = { ...HOOKS, ...h }; },
    setOnline,
    opponentAct,
    start() { reset(); cancelAnimationFrame(raf); loop(); },
    stop(draw) { cancelAnimationFrame(raf); draw ? draw(ctx) : drawIdleBoard(ctx); },
    keyDown(e) {
      const me = runners[1]; if (!state.running) return;
      if ((e.key === "ArrowUp" || e.key === " ") && me.y === 0) { me.vy = me.jumpVel; me.duck = false; HOOKS.online && HOOKS.onInput?.("jump"); }
      if (e.key === "ArrowDown" && me.y === 0) { me.duck = true; HOOKS.online && HOOKS.onInput?.("roll"); }
    },
    keyUp(e) { const me = runners[1]; if (e.key === "ArrowDown") me.duck = false; },
  };
}

/** ----- helpers ----- */
const nameOf = (u) => u?.username || u?.displayName || u?.name || u?.handle || "Opponent";

/** ----- React wrapper ----- */
export default function JumpArena() {
  const canvasRef = useRef(null), engineRef = useRef(null);
  const [status, setStatus] = useState("Pick a mode to start.");
  const [mode, setMode] = useState(null);

  const [lives, setLives] = useState({ top: 3, bottom: 3 });
  const livesRef = useRef(lives); useEffect(() => { livesRef.current = lives; }, [lives]);

  const socketRef = useRef(null); const roomIdRef = useRef(null); const mySideRef = useRef("bottom");
  const [names, setNames] = useState({ top: "Opponent", bottom: "Opponent" });
  const awardedRef = useRef(false);

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    drawIdleBoard(ctx);
    engineRef.current = createEngine(ctx, {
      online: false,
      getLives: () => livesRef.current,
      onHit: (lane) => { // practice default
        setLives(prev => {
          const n = { ...prev };
          if (lane === 0) n.top = Math.max(0, n.top - 1);
          else n.bottom = Math.max(0, n.bottom - 1);
          return n;
        });
      },
    });
    const kd = (e) => engineRef.current?.keyDown(e);
    const ku = (e) => engineRef.current?.keyUp(e);
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); engineRef.current?.stop(); };
  }, []);

  // Finish practice when a side reaches 0
  useEffect(() => {
    if (mode !== "bot") return;
    if (lives.top <= 0) { engineRef.current?.stop((ctx) => drawResult(ctx, "YOU WIN")); setMode(null); setStatus("You win!"); }
    if (lives.bottom <= 0) { engineRef.current?.stop((ctx) => drawResult(ctx, "YOU LOSE")); setMode(null); setStatus("You lose."); }
  }, [lives, mode]);

  const practice = () => {
    setLives({ top: 3, bottom: 3 });
    engineRef.current?.setHooks({ online: false, getLives: () => livesRef.current });
    engineRef.current?.start();
    setMode("bot");
    setStatus("Practice vs Bot — Up/Space jump · Down duck.");
  };

  const award = useCallback(async (didWin) => {
    if (awardedRef.current) return;
    try {
      await axios.post(`${API_BASE_URL}/api/games/result`, {
        userId: window.__USER__?._id, gameKey: "jump", delta: didWin ? 4 : -3, didWin,
      });
      awardedRef.current = true;
    } catch {}
  }, []);

  const connectSocket = useCallback(() => {
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
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    socketRef.current = s;

    s.on("connect", () => {
      setStatus("Connected. Queueing…");
      s.emit("jump:queue", { userId: window.__USER__?._id, username: window.__USER__?.username });
    });
    s.on("jump:queued", () => setStatus("Looking for an opponent…"));

    s.on("jump:start", ({ roomId, startAt, seed, you, top, bottom, lives }) => {
      roomIdRef.current = roomId; mySideRef.current = you; setMode("online");
      setNames({ top: nameOf(top), bottom: nameOf(bottom) });
      setLives(lives || { top: 3, bottom: 3 });
      awardedRef.current = false;

      engineRef.current?.setHooks({
        online: true,
        getLives: () => livesRef.current,
        onInput: (action) => s.emit("jump:input", { roomId, action, at: Date.now() }),
        onHit: (lane) => { if (lane === 1) {
          setLives(prev => ({ ...prev, bottom: Math.max(0, prev.bottom - 1) }));
          s.emit("jump:hit", { roomId });
        } },
      });
      engineRef.current?.setOnline(startAt, seed);

      const delay = Math.max(0, startAt - Date.now());
      setStatus(`Match found: ${nameOf(top)} vs ${nameOf(bottom)} — You are ${you.toUpperCase()}.`);
      setTimeout(() => engineRef.current?.start(), delay);
    });

    s.on("jump:input", ({ side, action, at }) => { engineRef.current?.opponentAct(action, at); });
    s.on("jump:lives", ({ lives }) => { setLives(lives); });

    s.on("jump:gameover", async ({ winner }) => {
      const meWin = winner && winner === mySideRef.current;
      engineRef.current?.stop((ctx) => drawResult(ctx, meWin ? "YOU WIN" : "YOU LOSE"));
      setMode(null);
      setStatus(meWin ? "You win! (+4 trophies)" : "You lose. (-3 trophies)");
      await award(!!meWin);
    });

    s.on("disconnect", () => setStatus("Disconnected."));
    return s;
  }, [award]);

  const rightTouches = useRef(new Set());

  const onTouchStart = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const x = t.clientX - rect.left;
      const isLeft = x < rect.width / 2;
      if (isLeft) {
        // jump
        engineRef.current?.keyDown({ key: "ArrowUp" });
      } else {
        // duck while held
        rightTouches.current.add(t.identifier);
        engineRef.current?.keyDown({ key: "ArrowDown" });
      }
    }
    e.preventDefault();
  };

  const endRightIfNeeded = () => {
    if (rightTouches.current.size === 0) return;
    // release duck when no right touches remain
    engineRef.current?.keyUp({ key: "ArrowDown" });
  };

  const onTouchEnd = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (rightTouches.current.has(t.identifier)) {
        rightTouches.current.delete(t.identifier);
      }
    }
    endRightIfNeeded();
    e.preventDefault();
  };

  const onTouchCancel = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (rightTouches.current.has(t.identifier)) {
        rightTouches.current.delete(t.identifier);
      }
    }
    endRightIfNeeded();
    e.preventDefault();
  };

  const online = () => {
    setStatus("Connecting…");
    const s = connectSocket();
    if (s?.connected) {
      s.emit("jump:queue", { userId: window.__USER__?._id, username: window.__USER__?.username });
    }
  };

  const resign = () => {
    if (mode === "online" && socketRef.current && roomIdRef.current)
      socketRef.current.emit("jump:resign", { roomId: roomIdRef.current });
    engineRef.current?.stop();
    setMode(null); setStatus("Stopped.");
  };

  return (
    <div
      className="jump-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 480px) 1fr",
        gap: 16,
      }}
    >
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          background: "linear-gradient(#f8fafc,#eef2f7)",
          width: "100%",
          maxWidth: W,
          height: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,.08)",
          overflow: "hidden",
          justifySelf: "center",
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ display: "block", width: "100%", height: "auto" }}
        />
        <div
          style={{
            padding: 8,
            textAlign: "center",
            fontSize: 12,
            color: "#6b7280",
            borderTop: "1px solid #e5e7eb",
            background: "#fff",
          }}
        >
          Mobile: tap <b>left</b> to jump · tap/hold <b>right</b> to duck
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--border-color)",
          background: "var(--container-white)",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={practice} style={btn()}>Practice vs Bot</button>
          <button onClick={online} style={btn(true)}>Play Online</button>
          <button onClick={resign} style={btn()}>Resign</button>
        </div>

        <div style={{ marginTop: 10, color: "#555" }}>{status}</div>

        {mode === "online" && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
            <div><b>Match:</b> {names.top} (top) vs {names.bottom} (bottom)</div>
            <div><b>Hearts:</b> Top {lives.top}/3 · Bottom {lives.bottom}/3</div>
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
          Keyboard: <b>Up</b>/<b>Space</b> jump · <b>Down</b> duck.
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .jump-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function btn(primary = false) {
  return { padding: "8px 12px", borderRadius: 10, border: "1px solid #111", cursor: "pointer", background: primary ? "#111" : "#fff", color: primary ? "#fff" : "#111" };
}
