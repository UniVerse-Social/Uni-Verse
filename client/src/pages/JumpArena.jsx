// client/src/pages/JumpArena.jsx
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
} from "react";
import styled from "styled-components";
import { io } from "socket.io-client";
import axios from "axios";
import { API_BASE_URL } from "../config";
import GameSidebar from "../components/GameSidebar";

/** ----- layout constants to mirror ChessArena ----- */
const SIDE_W = 360;
const HEADER_H = 76;
const BOTTOM_GAP = 40;
const MOBILE_NAV_H = 64;
const RAIL_PAD = 12;

/** ----- game constants (unchanged) ----- */
const W = 456,
  H = 456,
  HEADER = 24,
  HALF = H / 2,
  LANE_H = HALF - HEADER,
  GROUND_Y = LANE_H - 12;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const seeded = (a) => () => {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rngFrom = (seed) => {
  const r = seeded(seed || 1);
  return {
    next: () => r(),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    range: (a, b) => a + (b - a) * r(),
  };
};
const overlap = (a, b) =>
  !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );

// ---- theme colors (overridable via CSS vars) ----
const cssVar = (name, fallback) => {
  try {
    const v = getComputedStyle(
      document.documentElement
    )
      .getPropertyValue(name)
      .trim();
    return v || fallback;
  } catch {
    return fallback;
  }
};

const JUMP_COLORS = {
  top: cssVar("--jump-player-top", "#60A5FA"), // blue-400
  bottom: cssVar(
    "--jump-player-bottom",
    "#A78BFA"
  ), // violet-400
  obstacle: cssVar(
    "--jump-obstacle",
    "#9CA3AF"
  ), // slate-400
  label: cssVar(
    "--jump-label",
    "rgba(230,233,255,.95)"
  ),
};

/** ----- sprites ----- */
const SPRITES = {
  player: [
    "00111100",
    "01111110",
    "11111111",
    "11101111",
    "11111111",
    "01111110",
    "01111110",
    "01101110",
    "01001010",
    "11001011",
    "10000001",
    "10000001",
  ],
  playerDuck: [
    "001111111100",
    "011111111110",
    "111111111111",
    "111111111111",
    "011111111110",
    "001111111100",
    "000111111000",
    "000111111000",
  ],
  cactus: [
    "00011000",
    "00011000",
    "00011000",
    "01111110",
    "01111110",
    "00111100",
    "00111100",
    "00111100",
    "00111100",
    "00111100",
    "00111100",
    "00111100",
    "00111100",
    "00111100",
  ],
  bird1: [
    "000011100000",
    "000111110000",
    "011111111100",
    "111111111110",
    "001111111000",
    "000111110000",
    "111100000000",
    "111000000000",
  ],
  bird2: [
    "000011100000",
    "000111110000",
    "011111111100",
    "111111111110",
    "001111111000",
    "000111110000",
    "000000111100",
    "000000011110",
  ],
};

function drawSprite(
  ctx,
  sprite,
  xCenter,
  yBottom,
  scale,
  body = "#111",
  accent = "#fff"
) {
  const rows = sprite.length,
    cols = sprite[0].length,
    w = cols * scale,
    h = rows * scale;
  const left = Math.round(xCenter - w / 2),
    top = Math.round(yBottom - h);
  for (let r = 0; r < rows; r++) {
    const row = sprite[r];
    for (let c = 0; c < cols; c++) {
      const px = row[c];
      if (px === "0") continue;
      ctx.fillStyle = px === "1" ? body : accent;
      ctx.fillRect(
        left + c * scale,
        top + r * scale,
        scale,
        scale
      );
    }
  }
  return { x: left, y: top, w, h };
}

function drawIdleBoard(ctx) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(0, HALF - 1, W, 2);
  ctx.fillStyle = "#334155";
  ctx.font =
    "bold 14px system-ui,-apple-system,Segoe UI,Roboto";
  ctx.textAlign = "center";
  ctx.fillText("Opponent Lane", W / 2, 16);
  ctx.fillText("Your Lane", W / 2, HALF + 16);
  const topG = HEADER + GROUND_Y,
    botG = HEADER + GROUND_Y + HALF;
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(0, topG, W, 2);
  ctx.fillRect(0, botG, W, 2);
  drawSprite(
    ctx,
    SPRITES.player,
    74,
    topG,
    2.5,
    JUMP_COLORS.top
  );
  ctx.fillStyle = JUMP_COLORS.label;
  ctx.font = "bold 10px system-ui";
  ctx.fillText("RIVAL", 74, topG - 4);
  drawSprite(
    ctx,
    SPRITES.player,
    74,
    botG,
    2.5,
    JUMP_COLORS.bottom
  );
  ctx.fillText("YOU", 74, botG - 4);
  ctx.fillStyle = "#6b7280";
  ctx.font =
    "bold 16px system-ui,-apple-system,Segoe UI,Roboto";
  ctx.fillText(
    "Pick a mode to start.",
    W / 2,
    H / 2
  );
}

function drawResult(ctx, text) {
  ctx.fillStyle = "rgba(17,17,17,.55)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.font =
    "bold 28px system-ui,-apple-system,Segoe UI,Roboto";
  ctx.textAlign = "center";
  ctx.fillText(text, W / 2, H / 2);
}

/** ----- engine ----- */
function createEngine(ctx, hooks = {}) {
  let HOOKS = {
    online: false,
    getLives: () => ({ top: 3, bottom: 3 }),
    onInput: null,
    onHit: null,
    ...hooks,
  };

  const lanes = [
    { top: 0, color: JUMP_COLORS.top },
    { top: HALF, color: JUMP_COLORS.bottom },
  ];

  const state = {
    running: false,
    last: 0,
    elapsed: 0,
    baseSpeed: 260,
    // online deterministic spawner
    online: false,
    startAt: 0,
    tickMs: 380,
    seed: 1,
    rng: rngFrom(1),
    lastTick: -1,
    cooldownTop: 0,
    cooldownBottom: 0,
    startPerf: 0, // perf.now()-aligned start time (computed from server epoch)
  };

  function speed(t) {
    // deterministic speed as a function of absolute elapsed time t
    const mult = 1 + Math.min(1.4, t * 0.025);
    return state.baseSpeed * mult;
  }

  function mkRunner() {
    return {
      x: 74,
      y: 0,
      vy: 0,
      duck: false,
      duckUntil: 0,
      blinkUntil: 0,
      jumpVel: -880,
      gravity: 2400,
    };
  }
  const runners = [mkRunner(), mkRunner()];

  const lanesState = [
    { obs: [], dist: 0, gap: 340 },
    { obs: [], dist: 0, gap: 340 },
  ];

  function reset() {
    state.running = true;
    state.last = performance.now();
    state.elapsed = 0;
    runners[0] = mkRunner();
    runners[1] = mkRunner();
    lanesState[0] = { obs: [], dist: 0, gap: 340 };
    lanesState[1] = { obs: [], dist: 0, gap: 340 };
    state.lastTick = -1;
    state.cooldownTop = 0;
    state.cooldownBottom = 0;
  }

  function spawn(laneIdx, kind, yOverride) {
    const L = lanes[laneIdx];
    if (kind === "cactus") {
      lanesState[laneIdx].obs.push({
        type: "cactus",
        x: W + 20,
        y: HEADER + GROUND_Y + L.top,
        scale: 2,
      });
    } else if (kind === "bird") {
      const y =
        yOverride ??
        HEADER + GROUND_Y - 26 + L.top;
      lanesState[laneIdx].obs.push({
        type: "bird",
        x: W + 20,
        y,
        scale: 2,
        flap: 0,
      });
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
      if (state.cooldownTop > 0)
        state.cooldownTop--;
      if (state.cooldownBottom > 0)
        state.cooldownBottom--;

      // decide per lane
      for (const lane of ["top", "bottom"]) {
        const cdKey =
          lane === "top"
            ? "cooldownTop"
            : "cooldownBottom";
        if (state[cdKey] > 0) continue;

        const r = state.rng.next(); // [0,1)
        if (r < 0.58) {
          // spawn
          const cactus = state.rng.next() < 0.75;
          if (lane === "top")
            spawn(
              0,
              cactus ? "cactus" : "bird",
              cactus
                ? undefined
                : HEADER +
                    GROUND_Y -
                    26 +
                    lanes[0].top
            );
          else
            spawn(
              1,
              cactus ? "cactus" : "bird",
              cactus
                ? undefined
                : HEADER +
                    GROUND_Y -
                    26 +
                    lanes[1].top
            );

          // set cooldown in ticks (shorter as time goes)
          const t = Math.max(
            0,
            (i * state.tickMs) / 1000
          );
          const spd = speed(t);
          const minGap = clamp(
            6 -
              Math.floor((spd - 260) / 80),
            3,
            6
          ); // 3..6 ticks
          state[cdKey] = minGap;

          // small chance of double cactus (tight)
          if (
            cactus &&
            state.rng.next() < 0.18
          ) {
            if (lane === "top")
              lanesState[0].obs.push({
                type: "cactus",
                x: W + 46,
                y:
                  HEADER +
                  GROUND_Y +
                  lanes[0].top,
                scale: 2,
              });
            else
              lanesState[1].obs.push({
                type: "cactus",
                x: W + 46,
                y:
                  HEADER +
                  GROUND_Y +
                  lanes[1].top,
                scale: 2,
              });
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
    state.cooldownTop = 0;
    state.cooldownBottom = 0;
    // Align server epoch (Date.now) to performance clock locally
    state.startPerf =
      performance.now() +
      (startAt - Date.now());
  }

  function opponentAct(action, atMs) {
    const r = runners[0];
    const now = performance.now();
    const when = atMs
      ? atMs - Date.now() + now
      : now;
    if (action === "jump" && r.y === 0)
      r.vy = r.jumpVel;
    if (action === "roll")
      r.duckUntil = when + 320;
  }

  let lastHitAt = 0;

  function step() {
    if (!state.running) return;
    const now = performance.now();
    const dt = clamp(
      (now - state.last) / 1000,
      0,
      0.05
    );
    state.last = now;
    state.elapsed += dt;

    const spd = speed(state.elapsed);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(0, HALF - 1, W, 2);
    ctx.fillStyle = "#334155";
    ctx.font =
      "bold 14px system-ui,-apple-system,Segoe UI,Roboto";
    ctx.textAlign = "center";
    ctx.fillText("Opponent Lane", W / 2, 16);
    ctx.fillText("Your Lane", W / 2, HALF + 16);

    const live =
      HOOKS.getLives?.() || {
        top: 3,
        bottom: 3,
      };
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 14px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(
      "♥".repeat(live.top) +
        "♡".repeat(3 - live.top),
      W - 8,
      36
    );
    ctx.fillText(
      "♥".repeat(live.bottom) +
        "♡".repeat(3 - live.bottom),
      W - 8,
      HALF + 36
    );

    // spawn
    if (state.online) onlineSpawn(now);
    else {
      // practice distance-based spawn (kept)
      for (let i = 0; i < 2; i++) {
        const st = lanesState[i];
        st.dist += spd * dt;
        if (st.dist >= st.gap) {
          const cactus = Math.random() < 0.75;
          spawn(i, cactus ? "cactus" : "bird");
          st.gap = cactus
            ? clamp(
                360 - spd * 0.1,
                260,
                360
              ) +
              200 * Math.random()
            : clamp(
                420 - spd * 0.08,
                300,
                420
              ) +
              220 * Math.random();
          st.dist = 0;
        }
      }
    }

    for (let i = 0; i < 2; i++) {
      const L = lanes[i];
      const st = lanesState[i];
      const baseGround =
        HEADER + GROUND_Y + L.top;
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(0, baseGround, W, 2);

      // move/draw
      for (const o of st.obs) {
        o.x -= spd * dt;
        if (o.type === "cactus")
          drawSprite(
            ctx,
            SPRITES.cactus,
            o.x,
            o.y,
            o.scale,
            JUMP_COLORS.obstacle
          );
        else {
          o.flap = (o.flap || 0) + dt;
          const frame =
            Math.sin(o.flap * 10) > 0
              ? SPRITES.bird1
              : SPRITES.bird2;
          drawSprite(
            ctx,
            frame,
            o.x,
            o.y,
            o.scale,
            JUMP_COLORS.obstacle
          );
        }
      }
      while (
        st.obs.length &&
        st.obs[0].x < -40
      )
        st.obs.shift();

      // simple rival AI for practice only
      if (i === 0 && !state.online) {
        const r = runners[0];
        const first = st.obs.find(
          (o) =>
            o.x > r.x && o.x < r.x + 160
        );
        if (first) {
          const dist = first.x - r.x;
          const g =
            HEADER + GROUND_Y + L.top;
          if (first.type === "cactus") {
            if (
              dist <
                clamp(
                  120 - spd * 0.03,
                  70,
                  110
                ) &&
              r.y === 0
            )
              r.vy = r.jumpVel;
          } else {
            const low =
              first.y >= g - 14;
            if (low && dist < 120)
              r.duckUntil = now + 240;
            else if (
              first.y < g - 28 &&
              dist < 90 &&
              r.y === 0
            )
              r.vy = r.jumpVel;
          }
        } else r.duck = false;
      }

      const r = runners[i];
      if (r.duckUntil)
        r.duck = now < r.duckUntil;
      if (r.y < 0 || r.vy < 0) {
        r.vy += 2400 * dt;
        r.y += r.vy * dt;
        if (r.y > 0) {
          r.y = 0;
          r.vy = 0;
        }
      } else r.y = 0;

      const blinking =
        now < r.blinkUntil &&
        Math.floor(now / 60) % 2 === 0;
      if (!blinking) {
        const hb = drawSprite(
          ctx,
          r.duck
            ? SPRITES.playerDuck
            : SPRITES.player,
          r.x,
          baseGround + r.y,
          2.5,
          L.color,
          "#fff"
        );
        ctx.fillStyle = JUMP_COLORS.label;
        ctx.font = "bold 10px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(
          i === 0 ? "RIVAL" : "YOU",
          r.x,
          hb.y + hb.h - 4
        );

        for (const o of st.obs) {
          const oBox =
            o.type === "cactus"
              ? (() => {
                  const S =
                      SPRITES.cactus,
                    s = o.scale;
                  return {
                    x:
                      o.x -
                      (S[0].length * s) / 2,
                    y:
                      o.y - S.length * s,
                    w: S[0].length * s,
                    h: S.length * s,
                  };
                })()
              : (() => {
                  const S =
                      SPRITES.bird1,
                    s = o.scale;
                  return {
                    x:
                      o.x -
                      (S[0].length * s) / 2,
                    y:
                      o.y - S.length * s,
                    w: S[0].length * s,
                    h: S.length * s,
                  };
                })();
          const rBox = {
            x: hb.x + 2,
            y: hb.y + 2,
            w: hb.w - 4,
            h: hb.h - 4,
          };
          if (overlap(rBox, oBox)) {
            r.blinkUntil = now + 450;
            if (now - lastHitAt > 420) {
              lastHitAt = now;
              HOOKS.onHit?.(i);
            }
            break;
          }
        }
      }
    }
  }

  let raf = 0;
  const loop = () => {
    step();
    raf = requestAnimationFrame(loop);
  };
  return {
    setHooks(h) {
      HOOKS = { ...HOOKS, ...h };
    },
    setOnline,
    opponentAct,
    start() {
      reset();
      cancelAnimationFrame(raf);
      loop();
    },
    stop(draw) {
      cancelAnimationFrame(raf);
      draw ? draw(ctx) : drawIdleBoard(ctx);
    },
    keyDown(e) {
      const me = runners[1];
      if (!state.running) return;
      if (
        (e.key === "ArrowUp" ||
          e.key === " ") &&
        me.y === 0
      ) {
        me.vy = me.jumpVel;
        me.duck = false;
        HOOKS.online &&
          HOOKS.onInput?.("jump");
      }
      if (
        e.key === "ArrowDown" &&
        me.y === 0
      ) {
        me.duck = true;
        HOOKS.online &&
          HOOKS.onInput?.("roll");
      }
    },
    keyUp(e) {
      const me = runners[1];
      if (e.key === "ArrowDown") me.duck = false;
    },
  };
}

/** ----- helpers ----- */
const nameOf = (u) =>
  u?.username ||
  u?.displayName ||
  u?.name ||
  u?.handle ||
  "Opponent";

/** ----- shared layout styles (mirroring ChessArena) ----- */
const Wrap = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(300px, 26vw, ${SIDE_W}px);
  gap: 16px;
  align-items: start;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;

  @media (max-width: 860px) {
    display: block;
    width: 100%;
    overflow-x: hidden;
  }
`;

const Panel = styled.div`
  border: 1px solid var(--border-color);
  background: var(--container-white);
  color: var(--text-color);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
`;

const RightRailShell = styled.div`
  position: sticky;
  top: ${HEADER_H}px;
  align-self: start;
  padding: 12px 0 ${RAIL_PAD}px 0;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - ${HEADER_H}px);
  box-sizing: border-box;

  @media (max-width: 860px) {
    display: none !important;
  }
`;

const RightRailTopBar = styled.div`
  z-index: 3;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0 8px;
  height: 56px;
  margin-bottom: 12px;
`;

const ControlsPanel = styled(Panel)`
  grid-column: 2;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  flex: 1 1 auto;
  min-height: 0;
  align-self: stretch;
  overflow: auto;
  -webkit-overflow-scrolling: touch;

  @media (max-width: 860px) {
    grid-column: auto;
    width: 100%;
    max-height: none;
  }
`;

const BoardPanel = styled(Panel)`
  grid-column: 1;
  justify-self: center;
  align-self: start;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;

  max-height: calc(100vh - ${HEADER_H}px - ${BOTTOM_GAP}px);
  overflow: hidden;

  @media (max-width: 860px) {
    width: 100%;
    max-width: 100vw;
    margin: 0;
    padding: 0 0
      calc(
        ${MOBILE_NAV_H}px +
          env(safe-area-inset-bottom, 0px)
      )
      0;
    max-height: calc(
      100vh - ${HEADER_H}px - ${MOBILE_NAV_H}px
    );
    align-items: stretch;
  }
`;

const BoardViewport = styled.div`
  flex: 0 0 auto;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 0;
  position: relative;
`;

const Button = styled.button`
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid
    ${(p) =>
      p.$primary
        ? "transparent"
        : "var(--border-color)"};
  background: ${(p) =>
    p.$primary
      ? "var(--primary-orange)"
      : "rgba(255,255,255,0.06)"};
  color: ${(p) =>
    p.$primary ? "#000" : "var(--text-color)"};
  font-weight: 800;
  transition: background 0.15s ease,
    box-shadow 0.15s ease, color 0.15s ease,
    transform 0.08s ease;
  &:hover {
    background: ${(p) =>
      p.$primary
        ? "linear-gradient(90deg,var(--primary-orange),#59D0FF)"
        : "rgba(255,255,255,0.10)"};
    transform: translateY(-1px);
  }
  &:active {
    transform: translateY(0);
  }
`;

const ReturnButton = styled(Button)`
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  border-radius: 999px;
  padding: 10px 14px;
  font-weight: 800;
  letter-spacing: 0.2px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.08),
    rgba(255, 255, 255, 0.04)
  );
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 24px
      rgba(0, 0, 0, 0.2),
    inset 0 1px 0
      rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(6px);
  color: var(--text-color);
  width: 100%;
  box-sizing: border-box;

  &:hover {
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.12),
      rgba(255, 255, 255, 0.06)
    );
    border-color: rgba(255, 255, 255, 0.16);
    transform: translateY(-1px);
  }

  .icon {
    font-size: 18px;
    line-height: 1;
    opacity: 0.95;
  }
`;

/* Mobile top bar (drawer + opponent pill) */
const MobileTopBar = styled.div`
  display: none;
  @media (max-width: 860px) {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: space-between;
    margin-bottom: 8px;
  }
`;

const MobileOpponentPill = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.06);
  font-size: 11px;
`;

const MobileOpponentName = styled.span`
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MobileOpponentMeta = styled.span`
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: rgba(230, 233, 255, 0.75);
`;

/* Drawer */
const DrawerButton = styled.button`
  @media (max-width: 860px) {
    border: 1px solid var(--border-color);
    background: var(--container-white);
    color: var(--text-color);
    border-radius: 999px;
    padding: 6px 10px;
    font-weight: 800;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
  }
  @media (min-width: 861px) {
    display: none;
  }
`;

const Drawer = styled.aside`
  position: fixed;
  top: ${HEADER_H}px;
  left: 0;
  bottom: 0;
  width: min(92vw, 360px);
  background: var(--container-white);
  border-right: 1px solid var(--border-color);
  box-shadow: 12px 0 28px
    rgba(0, 0, 0, 0.28);
  transform: translateX(
    ${(p) => (p.$open ? "0" : "-100%")}
  );
  transition: transform 0.22s ease;
  z-index: 60;
  padding: 12px 10px;
  overflow: auto;
`;

const DrawerBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 59;
`;

/* Mobile stack under the board */
const MobileStack = styled.div`
  display: none;
  @media (max-width: 860px) {
    display: grid;
    gap: 10px;
    margin-top: 8px;
    width: 100%;
  }
`;

/** ----- React wrapper ----- */
export default function JumpArena({ onExit }) {
  const canvasRef = useRef(null),
    engineRef = useRef(null);
  const [status, setStatus] = useState(
    "Pick a mode to start."
  );
  const [mode, setMode] = useState(null);

  const [lives, setLives] = useState({
    top: 3,
    bottom: 3,
  });
  const livesRef = useRef(lives);
  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

  const socketRef = useRef(null);
  const roomIdRef = useRef(null);
  const mySideRef = useRef("bottom");
  const [names, setNames] = useState({
    top: "Opponent",
    bottom: "Opponent",
  });
  const awardedRef = useRef(false);

  const panelRef = useRef(null);
  const [boardSize, setBoardSize] =
    useState(456);
  const [drawerOpen, setDrawerOpen] =
    useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (drawerOpen)
      document.body.style.overflow =
        "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useLayoutEffect(() => {
    const getPad = (el) => {
      const cs = window.getComputedStyle(el);
      const padX =
        parseFloat(cs.paddingLeft) +
        parseFloat(cs.paddingRight);
      const padY =
        parseFloat(cs.paddingTop) +
        parseFloat(cs.paddingBottom);
      return { padX, padY };
    };

    const BREATHING = BOTTOM_GAP;

    const calc = () => {
      const panel = panelRef.current;
      if (!panel) return;

      const { padX, padY } = getPad(panel);
      const innerW = Math.max(
        240,
        Math.floor(panel.clientWidth - padX)
      );
      const isPhone = window
        .matchMedia("(max-width: 860px)")
        .matches;
      const inset = window.visualViewport
        ? Math.max(
            0,
            (window.innerHeight || 0) -
              window.visualViewport.height
          )
        : 0;
      const mobileExtra = isPhone
        ? MOBILE_NAV_H + inset
        : 0;
      const availH = Math.max(
        240,
        Math.floor(
          (window.innerHeight || 900) -
            HEADER_H -
            BREATHING -
            padY -
            mobileExtra
        )
      );

      setBoardSize(Math.min(innerW, availH));
    };

    calc();
    window.addEventListener("resize", calc);
    let ro;
    if (
      "ResizeObserver" in window &&
      panelRef.current
    ) {
      ro = new ResizeObserver(calc);
      ro.observe(panelRef.current);
    }
    return () => {
      window.removeEventListener(
        "resize",
        calc
      );
      if (ro) ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const ctx =
      canvasRef.current.getContext("2d");
    drawIdleBoard(ctx);
    engineRef.current = createEngine(ctx, {
      online: false,
      getLives: () => livesRef.current,
      onHit: (lane) => {
        // practice default
        setLives((prev) => {
          const n = { ...prev };
          if (lane === 0)
            n.top = Math.max(0, n.top - 1);
          else
            n.bottom = Math.max(
              0,
              n.bottom - 1
            );
          return n;
        });
      },
    });
    const kd = (e) =>
      engineRef.current?.keyDown(e);
    const ku = (e) =>
      engineRef.current?.keyUp(e);
    window.addEventListener(
      "keydown",
      kd
    );
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener(
        "keydown",
        kd
      );
      window.removeEventListener("keyup", ku);
      engineRef.current?.stop();
    };
  }, []);

  // Finish practice when a side reaches 0
  useEffect(() => {
    if (mode !== "bot") return;
    if (lives.top <= 0) {
      engineRef.current?.stop((ctx) =>
        drawResult(ctx, "YOU WIN")
      );
      setMode(null);
      setStatus("You win!");
    }
    if (lives.bottom <= 0) {
      engineRef.current?.stop((ctx) =>
        drawResult(ctx, "YOU LOSE")
      );
      setMode(null);
      setStatus("You lose.");
    }
  }, [lives, mode]);

  const practice = () => {
    setLives({ top: 3, bottom: 3 });
    engineRef.current?.setHooks({
      online: false,
      getLives: () => livesRef.current,
    });
    engineRef.current?.start();
    setMode("bot");
    setStatus(
      "Practice vs Bot — Up/Space jump · Down duck."
    );
  };

  const award = useCallback(
    async (didWin) => {
      if (awardedRef.current) return;
      try {
        await axios.post(
          `${API_BASE_URL}/api/games/result`,
          {
            userId: window.__USER__?._id,
            gameKey: "jump",
            delta: didWin ? 4 : -3,
            didWin,
          }
        );
        awardedRef.current = true;
      } catch {}
    },
    []
  );

  const connectSocket = useCallback(() => {
    if (socketRef.current)
      return socketRef.current;

    const envBase =
      typeof process !== "undefined" &&
      process.env &&
      process.env.REACT_APP_API_BASE
        ? String(
            process.env.REACT_APP_API_BASE
          )
        : "";
    let WS_BASE =
      (API_BASE_URL &&
        API_BASE_URL.trim()) ||
      (envBase && envBase.trim()) ||
      "";

    if (!WS_BASE) {
      const { protocol, hostname, host } =
        window.location;
      const isLocal =
        /^(localhost|127\.0\.0\.1)$/i.test(
          hostname
        );
      WS_BASE = isLocal
        ? `${protocol}//${hostname}:5000`
        : `${protocol}//${host}`;
    }
    WS_BASE = WS_BASE.replace(/\/+$/, "").replace(
      /\/api\/?$/,
      ""
    );

    // Prefer SAME tunnel host if the page is on Cloudflare (avoids cross-host WS issues)
    try {
      const po = new URL(
        window.location.origin
      );
      const wb = new URL(WS_BASE);
      if (
        /trycloudflare\.com$/i.test(
          po.hostname
        ) &&
        po.hostname !== wb.hostname
      ) {
        WS_BASE = po.origin;
      }
    } catch {}

    const s = io(WS_BASE, {
      path: "/api/socket.io",
      transports: ["polling", "websocket"],
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

    s.on("connect", () => {
      setStatus("Connected. Queueing…");
      s.emit("jump:queue", {
        userId: window.__USER__?._id,
        username: window.__USER__?.username,
      });
    });
    s.on("jump:queued", () =>
      setStatus("Looking for an opponent…")
    );

    s.on(
      "jump:start",
      ({
        roomId,
        startAt,
        seed,
        you,
        top,
        bottom,
        lives,
      }) => {
        roomIdRef.current = roomId;
        mySideRef.current = you;
        setMode("online");
        setNames({
          top: nameOf(top),
          bottom: nameOf(bottom),
        });
        setLives(
          lives || {
            top: 3,
            bottom: 3,
          }
        );
        awardedRef.current = false;

        engineRef.current?.setHooks({
          online: true,
          getLives: () => livesRef.current,
          onInput: (action) =>
            s.emit("jump:input", {
              roomId,
              action,
              at: Date.now(),
            }),
          onHit: (lane) => {
            if (lane === 1) {
              setLives((prev) => ({
                ...prev,
                bottom: Math.max(
                  0,
                  prev.bottom - 1
                ),
              }));
              s.emit("jump:hit", { roomId });
            }
          },
        });
        engineRef.current?.setOnline(
          startAt,
          seed
        );

        const delay = Math.max(
          0,
          startAt - Date.now()
        );
        setStatus(
          `Match found: ${nameOf(
            top
          )} vs ${nameOf(
            bottom
          )} — You are ${you.toUpperCase()}.`
        );
        setTimeout(
          () =>
            engineRef.current?.start(),
          delay
        );
      }
    );

    s.on(
      "jump:input",
      ({ side, action, at }) => {
        engineRef.current?.opponentAct(
          action,
          at
        );
      }
    );
    s.on("jump:lives", ({ lives }) => {
      setLives(lives);
    });

    s.on(
      "jump:gameover",
      async ({ winner }) => {
        const meWin =
          winner &&
          winner === mySideRef.current;
        engineRef.current?.stop((ctx) =>
          drawResult(
            ctx,
            meWin ? "YOU WIN" : "YOU LOSE"
          )
        );
        setMode(null);
        setStatus(
          meWin
            ? "You win! (+4 trophies)"
            : "You lose. (-3 trophies)"
        );
        await award(!!meWin);
      }
    );

    s.on("disconnect", () =>
      setStatus("Disconnected.")
    );
    return s;
  }, [award]);

  const rightTouches = useRef(new Set());

  const onTouchStart = (e) => {
    if (!canvasRef.current) return;
    const rect =
      canvasRef.current.getBoundingClientRect();
    for (
      let i = 0;
      i < e.changedTouches.length;
      i++
    ) {
      const t = e.changedTouches[i];
      const x = t.clientX - rect.left;
      const isLeft = x < rect.width / 2;
      if (isLeft) {
        // jump
        engineRef.current?.keyDown({
          key: "ArrowUp",
        });
      } else {
        // duck while held
        rightTouches.current.add(
          t.identifier
        );
        engineRef.current?.keyDown({
          key: "ArrowDown",
        });
      }
    }
    e.preventDefault();
  };

  const endRightIfNeeded = () => {
    if (rightTouches.current.size === 0) return;
    // release duck when no right touches remain
    engineRef.current?.keyUp({
      key: "ArrowDown",
    });
  };

  const onTouchEnd = (e) => {
    for (
      let i = 0;
      i < e.changedTouches.length;
      i++
    ) {
      const t = e.changedTouches[i];
      if (
        rightTouches.current.has(
          t.identifier
        )
      ) {
        rightTouches.current.delete(
          t.identifier
        );
      }
    }
    endRightIfNeeded();
    e.preventDefault();
  };

  const onTouchCancel = (e) => {
    for (
      let i = 0;
      i < e.changedTouches.length;
      i++
    ) {
      const t = e.changedTouches[i];
      if (
        rightTouches.current.has(
          t.identifier
        )
      ) {
        rightTouches.current.delete(
          t.identifier
        );
      }
    }
    endRightIfNeeded();
    e.preventDefault();
  };

  const online = () => {
    setStatus("Connecting…");
    const s = connectSocket();
    if (s?.connected) {
      s.emit("jump:queue", {
        userId: window.__USER__?._id,
        username: window.__USER__?.username,
      });
    }
  };

  const resign = () => {
    if (
      mode === "online" &&
      socketRef.current &&
      roomIdRef.current
    )
      socketRef.current.emit("jump:resign", {
        roomId: roomIdRef.current,
      });
    engineRef.current?.stop();
    setMode(null);
    setStatus("Stopped.");
  };

  const opponentName =
    mode === "online"
      ? names.top
      : "Opponent";

  const heartsString =
    mode === "online"
      ? `♥${lives.top}/3 · You ♥${lives.bottom}/3`
      : "Tap left to jump, right to duck";

  return (
    <>
      {/* Mobile top bar (drawer + opponent summary) */}
      <MobileTopBar>
        <DrawerButton
          onClick={() => setDrawerOpen(true)}
          aria-label="Open jump sidebar"
        >
          ➤
        </DrawerButton>

        <MobileOpponentPill>
          <MobileOpponentName>
            {opponentName}
          </MobileOpponentName>
          <MobileOpponentMeta>
            {heartsString}
          </MobileOpponentMeta>
        </MobileOpponentPill>
      </MobileTopBar>

      <Wrap>
        {/* LEFT: board/canvas panel */}
        <BoardPanel ref={panelRef}>
          <BoardViewport>
            <div
              style={{
                position: "relative",
                width: boardSize,
                maxWidth: "100%",
                margin: "0 auto",
              }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              onTouchCancel={onTouchCancel}
            >
              <canvas
                ref={canvasRef}
                width={W}
                height={H}
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  borderRadius: 12,
                  boxShadow:
                    "0 8px 24px rgba(0,0,0,.08)",
                }}
              />
            </div>
          </BoardViewport>

          {/* Small helper line under the board */}
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              textAlign: "center",
              color:
                "rgba(230,233,255,0.65)",
            }}
          >
            Mobile: tap{" "}
            <b>left</b> to jump · tap/hold{" "}
            <b>right</b> to duck
          </div>

          {/* Mobile controls stack */}
          <MobileStack>
            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {!mode && (
                <>
                  <Button onClick={practice}>
                    Practice vs Bot
                  </Button>
                  <Button
                    $primary
                    onClick={online}
                  >
                    Play Online
                  </Button>
                </>
              )}
              {mode === "bot" && (
                <>
                  <Button onClick={practice}>
                    Restart Practice
                  </Button>
                  <Button
                    onClick={() => {
                      engineRef.current?.stop();
                      setMode(null);
                      setStatus(
                        "Pick a mode to start."
                      );
                    }}
                  >
                    End Practice
                  </Button>
                </>
              )}
              {mode === "online" && (
                <Button onClick={resign}>
                  Resign
                </Button>
              )}

              <div
                style={{
                  marginTop: 4,
                  color:
                    "rgba(230,233,255,0.75)",
                  fontSize: 13,
                }}
              >
                {status}
              </div>

              {mode === "online" && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color:
                      "rgba(230,233,255,0.65)",
                  }}
                >
                  <div>
                    <b>Match:</b>{" "}
                    {names.top} (top) vs{" "}
                    {names.bottom} (bottom)
                  </div>
                  <div>
                    <b>Hearts:</b> Top{" "}
                    {lives.top}/3 · Bottom{" "}
                    {lives.bottom}/3
                  </div>
                </div>
              )}

              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                Keyboard: <b>Up</b>/
                <b>Space</b> jump · <b>Down</b>{" "}
                duck.
              </div>

              <ReturnButton
                onClick={() =>
                  typeof onExit ===
                  "function"
                    ? onExit()
                    : null
                }
                title="Return to Games"
              >
                <span className="icon">
                  ←
                </span>
                <span>Return to Games</span>
              </ReturnButton>
            </div>
          </MobileStack>
        </BoardPanel>

        {/* RIGHT: sticky control rail (desktop) */}
        <RightRailShell>
          <RightRailTopBar>
            <ReturnButton
              onClick={() =>
                typeof onExit === "function"
                  ? onExit()
                  : null
              }
              title="Return to Games"
            >
              <span className="icon">
                ←
              </span>
              <span>Return to Games</span>
            </ReturnButton>
          </RightRailTopBar>

          <ControlsPanel>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <Button onClick={practice}>
                Practice vs Bot
              </Button>
              <Button
                $primary
                onClick={online}
              >
                Play Online
              </Button>
              <Button onClick={resign}>
                Resign
              </Button>
            </div>

            <div
              style={{
                marginTop: 10,
                color:
                  "rgba(230,233,255,0.75)",
              }}
            >
              {status}
            </div>

            {mode === "online" && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color:
                    "rgba(230,233,255,0.65)",
                }}
              >
                <div>
                  <b>Match:</b>{" "}
                  {names.top} (top) vs{" "}
                  {names.bottom} (bottom)
                </div>
                <div>
                  <b>Hearts:</b> Top{" "}
                  {lives.top}/3 · Bottom{" "}
                  {lives.bottom}/3
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Keyboard: <b>Up</b>/
              <b>Space</b> jump · <b>Down</b>{" "}
              duck.
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color:
                  "rgba(230,233,255,0.65)",
              }}
            >
              Wins vs real players grant{" "}
              <b>+4 trophies</b>. Losses cost{" "}
              <b>-3 trophies</b>. Practice is
              unranked.
            </div>
          </ControlsPanel>
        </RightRailShell>
      </Wrap>

      {/* Drawer for GameSidebar on mobile */}
      {drawerOpen && (
        <DrawerBackdrop
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <Drawer
        $open={drawerOpen}
        role="complementary"
        aria-label="Jump sidebar"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 8,
          }}
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close sidebar"
            style={{
              border:
                "1px solid var(--border-color)",
              background:
                "var(--container-white)",
              borderRadius: 999,
              width: 36,
              height: 36,
              fontWeight: 900,
              lineHeight: 1,
              boxShadow:
                "0 8px 18px rgba(0,0,0,.12)",
            }}
          >
            ×
          </button>
        </div>

        <GameSidebar
          gameKey="jump"
          title="Jump"
          showOnMobile
        />
      </Drawer>
    </>
  );
}
