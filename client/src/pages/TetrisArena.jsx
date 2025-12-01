// client/src/pages/TetrisArena.jsx
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

/** ====== layout constants (match Chess / Jump / Meteor) ====== */
const SIDE_W = 360;
const HEADER_H = 76;
const BOTTOM_GAP = 40;
const MOBILE_NAV_H = 64;
const RAIL_PAD = 12;

/** ====== core game constants ====== */
const COLS = 10;
const ROWS = 20;
const SIZE = 18;

/**
 * Sand clump shapes:
 *  - Not classic Tetris tetrominoes
 *  - Keep these different so the game has its own identity
 */
const ORDER = ["A", "B", "C", "D", "E", "F", "G"];

const SHAPES = {
  // tall column
  A: [
    [1],
    [1],
    [1],
    [1],
  ],
  // small L triomino
  B: [
    [1, 0],
    [1, 1],
  ],
  // plus-ish blob
  C: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 0],
  ],
  // zig pentaclump
  D: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 1],
  ],
  // fat 3-wide bar
  E: [[1, 1, 1]],
  // skewed 4-cell blob
  F: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  // 2×2 with a tail
  G: [
    [1, 1],
    [1, 0],
    [1, 0],
  ],
};

const SCORES = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

// input delay for online mode
const INPUT_DELAY_TICKS = 2;

const COLORS = {
  A: ["#f97373", "#fecaca", "#b91c1c"], // warm rose
  B: ["#14b8a6", "#a5f3fc", "#0f766e"], // teal
  C: ["#facc15", "#fef9c3", "#a16207"], // amber
  D: ["#6366f1", "#e0e7ff", "#4338ca"], // indigo
  E: ["#84cc16", "#dcfce7", "#3f6212"], // lime
  F: ["#0ea5e9", "#bae6fd", "#0369a1"], // sky
  G: ["#e879f9", "#fce7f3", "#a21caf"], // fuchsia
};

const BG_GRID = "rgba(255,255,255,0.08)";
const BG_NEXT = "rgba(255,255,255,0.16)";

const cssVar = (name, fallback) => {
  try {
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim() || fallback
    );
  } catch {
    return fallback;
  }
};
const HUD_TEXT = cssVar("--hud-text", "rgba(230,233,255,0.90)");
const HUD_MUTED = cssVar("--hud-muted", "rgba(230,233,255,0.65)");

/** ====== deterministic PRNG & helpers ====== */
const seeded = (a) => () => {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rngFrom = (seed) => {
  const r = seeded(seed || 1);
  return { next: () => r() };
};
const makeBag = (rng) => {
  const bag = ORDER.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
};
const clone = (m) => m.map((r) => r.slice());
const rotCW = (m) => {
  const h = m.length;
  const w = m[0].length;
  const r = [...Array(w)].map(() => Array(h).fill(0));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      r[x][h - 1 - y] = m[y][x];
    }
  }
  return r;
};

function drawTile(ctx, x, y, cMain, cLight, cDark, glow = false) {
  const inset = glow ? 0 : 1;
  // base sand block
  ctx.fillStyle = glow ? "rgba(250, 250, 250, 0.09)" : cMain;
  ctx.fillRect(x + inset, y + inset, SIZE - inset * 2, SIZE - inset * 2);

  if (!glow) {
    // simple bevel
    ctx.fillStyle = cLight;
    ctx.fillRect(x + 1, y + 1, SIZE - 2, 3);
    ctx.fillRect(x + 1, y + 1, 3, SIZE - 2);
    ctx.fillStyle = cDark;
    ctx.fillRect(x + 1, y + SIZE - 4, SIZE - 2, 3);
    ctx.fillRect(x + SIZE - 4, y + 1, 3, SIZE - 2);
  }
}

/** ====== Sandfall Tetris engine (Tetris lines + sand crumble) ====== */

function createTetris(ctx, baseX, seed, hooks = {}) {
  const H = { onScore: () => {}, ...hooks };
  const rng = rngFrom(seed || 1);
  let bag = makeBag(rng);
  const nextQ = [];

  const G = {
    grid: [...Array(ROWS)].map(() => Array(COLS).fill(0)), // sand grains
    piece: null, // {t, m}
    px: 3,
    py: 0,
    over: false,
    score: 0,
    lines: 0,
    fallInterval: 48,
    fallCount: 48,
    sandStepTick: 0,
  };

  while (nextQ.length < 5) {
    if (!bag.length) bag = makeBag(rng);
    nextQ.push(bag.pop());
  }

  function spawn() {
    if (!bag.length) bag = makeBag(rng);
    const t = nextQ.shift();
    nextQ.push((bag.length ? bag : (bag = makeBag(rng))).pop());
    G.piece = { t, m: clone(SHAPES[t]) };
    G.px = Math.floor((COLS - G.piece.m[0].length) / 2);
    G.py = -1;
    if (collide(G.px, G.py, G.piece.m)) G.over = true;
    G.fallCount = G.fallInterval;
  }

  function collide(px, py, p) {
    for (let y = 0; y < p.length; y++) {
      for (let x = 0; x < p[0].length; x++) {
        if (!p[y][x]) continue;
        const gx = px + x;
        const gy = py + y;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && G.grid[gy][gx]) return true;
      }
    }
    return false;
  }

  function merge() {
    const { t, m } = G.piece;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[0].length; x++) {
        if (m[y][x] && G.py + y >= 0) {
          // each block becomes individual sand grains of that color
          G.grid[G.py + y][G.px + x] = t;
        }
      }
    }
  }

  // one sand-physics sweep: grains fall straight down, then diagonally
  function sandStep() {
    for (let y = ROWS - 2; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        const v = G.grid[y][x];
        if (!v) continue;

        // straight down first
        if (!G.grid[y + 1][x]) {
          G.grid[y + 1][x] = v;
          G.grid[y][x] = 0;
          continue;
        }

        // then diagonals, randomized
        const firstDir = rng.next() < 0.5 ? -1 : 1;
        const secondDir = -firstDir;

        const tryDiag = (dx) => {
          const nx = x + dx;
          const ny = y + 1;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
          if (!G.grid[ny][nx]) {
            G.grid[ny][nx] = v;
            G.grid[y][x] = 0;
            return true;
          }
          return false;
        };

        if (tryDiag(firstDir)) continue;
        tryDiag(secondDir);
      }
    }
  }

  // standard line clearing
  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (G.grid[y].every((v) => v)) {
        G.grid.splice(y, 1);
        G.grid.unshift(Array(COLS).fill(0));
        cleared++;
        y++;
      }
    }
    if (cleared > 0) {
      G.lines += cleared;
      const base = SCORES[cleared] || cleared * 100;
      G.score += base;
      H.onScore?.(G.score);
    }
    return cleared;
  }

  function speedUp() {
    G.fallInterval = Math.max(4, Math.floor(G.fallInterval * 0.985));
  }

  function lock() {
    merge();

    // let the pile crumble a bit extra right after a piece locks
    for (let i = 0; i < 3; i++) sandStep();

    clearLines();
    speedUp();
    spawn();
  }

  function left() {
    if (!G.piece || G.over) return;
    if (!collide(G.px - 1, G.py, G.piece.m)) G.px--;
  }
  function right() {
    if (!G.piece || G.over) return;
    if (!collide(G.px + 1, G.py, G.piece.m)) G.px++;
  }
  function rot() {
    if (!G.piece || G.over) return;
    const r = rotCW(G.piece.m);
    if (!collide(G.px, G.py, r)) G.piece.m = r;
  }
  function soft() {
    if (!G.piece || G.over) return;
    if (!collide(G.px, G.py + 1, G.piece.m)) {
      G.py++;
      G.fallCount = G.fallInterval;
    } else {
      lock();
    }
  }
  function hardDrop() {
    if (!G.piece || G.over) return;
    while (!collide(G.px, G.py + 1, G.piece.m)) {
      G.py++;
    }
    lock();
  }

  function drawBoard() {
    ctx.save();
    ctx.clearRect(baseX, 0, COLS * SIZE, ROWS * SIZE);

    // grid + settled sand
    ctx.strokeStyle = BG_GRID;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        ctx.strokeRect(baseX + x * SIZE, y * SIZE, SIZE, SIZE);
        const cell = G.grid[y][x];
        if (cell) {
          const [c, cl, cd] = COLORS[cell];
          drawTile(
            ctx,
            baseX + x * SIZE,
            y * SIZE,
            c,
            cl,
            cd,
            false
          );
        }
      }
    }

    // active piece
    if (G.piece && !G.over) {
      const [c, cl, cd] = COLORS[G.piece.t];
      for (let y = 0; y < G.piece.m.length; y++) {
        for (let x = 0; x < G.piece.m[0].length; x++) {
          if (!G.piece.m[y][x]) continue;
          const gx = baseX + (G.px + x) * SIZE;
          const gy = (G.py + y) * SIZE;
          drawTile(ctx, gx, gy, c, cl, cd, false);
        }
      }
    }

    // HUD: score + lines
    ctx.textAlign = "left";
    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = HUD_MUTED;
    ctx.fillText("Score", baseX + 4, 12);

    ctx.font = "12px system-ui";
    ctx.fillStyle = HUD_TEXT;
    ctx.fillText(String(G.score), baseX + 4, 24);

    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = HUD_MUTED;
    ctx.fillText("Lines", baseX + 4, 40);

    ctx.font = "12px system-ui";
    ctx.fillStyle = HUD_TEXT;
    ctx.fillText(String(G.lines), baseX + 4, 52);

    // Next piece preview
    ctx.textAlign = "right";
    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = HUD_MUTED;
    ctx.fillText("Next", baseX + COLS * SIZE - 6, 12);

    const nextT = nextQ[0];
    const pv = SHAPES[nextT];
    const bw = pv[0].length;
    const bh = pv.length;
    const boxW = 4 * SIZE;
    const boxH = 4 * SIZE;
    const bx = baseX + COLS * SIZE - boxW - 6;
    const by = 16;

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = BG_NEXT;
    ctx.strokeRect(bx, by, boxW, boxH);

    const ox = bx + Math.floor((boxW - bw * SIZE) / 2);
    const oy = by + Math.floor((boxH - bh * SIZE) / 2);
    const [cN, clN, cdN] = COLORS[nextT];
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (!pv[y][x]) continue;
        drawTile(
          ctx,
          ox + x * SIZE,
          oy + y * SIZE,
          cN,
          clN,
          cdN,
          false
        );
      }
    }

    ctx.restore();
  }

  function tick() {
    if (G.over) {
      drawBoard();
      return;
    }

    // sand always slowly crumbles
    G.sandStepTick++;
    if (G.sandStepTick % 2 === 0) {
      sandStep();
    }

    G.fallCount--;
    if (G.fallCount <= 0) {
      if (!collide(G.px, G.py + 1, G.piece.m)) {
        G.py++;
        G.fallCount = G.fallInterval;
      } else {
        lock();
      }
    }

    drawBoard();
  }

  function start() {
    spawn();
    drawBoard();
  }

  return { g: G, start, tick, left, right, rot, soft, hardDrop, drawBoard };
}

/** ====== styled layout (same shell as before) ====== */

const Wrap = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr)
    clamp(300px, 26vw, ${SIDE_W}px);
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
    max-height: none;
    overflow: visible;
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
      p.$primary ? "transparent" : "var(--border-color)"};
  background: ${(p) =>
    p.$primary
      ? "var(--primary-orange)"
      : "rgba(255,255,255,0.06)"};
  color: ${(p) => (p.$primary ? "#000" : "var(--text-color)")};
  font-weight: 800;
  transition: background 0.15s ease, box-shadow 0.15s ease,
    color 0.15s ease, transform 0.08s ease;

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
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
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

/* Mobile top bar (drawer + pill) */
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
  box-shadow: 12px 0 28px rgba(0, 0, 0, 0.28);
  transform: translateX(${(p) => (p.$open ? "0" : "-100%")});
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

const MobileStack = styled.div`
  display: none;
  @media (max-width: 860px) {
    display: grid;
    gap: 10px;
    margin-top: 8px;
    width: 100%;
  }
`;
const BoardOverlayCTA = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;

  @media (min-width: 861px) {
    display: none;
  }

  > div {
    pointer-events: auto;
    display: grid;
    gap: 10px;
    background: rgba(0, 0, 0, 0.28);
    backdrop-filter: blur(6px);
    padding: 14px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
`;

/** ====== React wrapper ====== */

export default function TetrisArena({ onExit }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  const meRef = useRef(null);
  const opRef = useRef(null);

  const [mode, setMode] = useState(null); // null | "bot" | "online"
  const [status, setStatus] = useState("Pick a mode to start.");

  const socketRef = useRef(null);
  const roomIdRef = useRef(null);
  const sideRef = useRef("left");
  const tickHzRef = useRef(60);
  const serverTickRef = useRef(0);
  const lastSimTickRef = useRef(0);
  const myQRef = useRef(new Map());
  const opQRef = useRef(new Map());
  const awardedRef = useRef(false);

  const simIntRef = useRef(null);

  const clearSim = useCallback(() => {
    if (simIntRef.current) {
      clearInterval(simIntRef.current);
      simIntRef.current = null;
    }
  }, []);

  // attract screen
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.fillStyle = "rgba(248,250,252,0.96)";
    ctx.font = "bold 18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Sandfall Lines VS", c.width / 2, c.height / 2 - 22);

    ctx.font = "13px system-ui";
    ctx.fillStyle = "rgba(226,232,240,0.85)";
    ctx.fillText(
      "Stack falling sand blocks to complete horizontal layers.",
      c.width / 2,
      c.height / 2 + 2
    );
    ctx.fillText(
      "Full sand rows clear; the pile below crumbles into dunes.",
      c.width / 2,
      c.height / 2 + 20
    );

    ctx.font = "12px system-ui";
    ctx.fillStyle = "rgba(148,163,184,0.9)";
    ctx.fillText(
      "Controls: ←/→ move · ↑ rotate · ↓ soft drop · space hard drop",
      c.width / 2,
      c.height / 2 + 40
    );

    return () => {
      clearSim();
      cancelAnimationFrame(rafRef.current);
    };
  }, [clearSim]);

  const loop = useCallback(() => {
    meRef.current?.drawBoard();
    opRef.current?.drawBoard();
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const clearLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  const finish = useCallback(
    (didWin) => {
      clearSim();
      clearLoop();
      setMode(null);
      setMode(null);
      setStatus(
        didWin ? "You win! (+6 trophies)" : "You lose. (-5 trophies)"
      );
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
    },
    [clearLoop, clearSim]
  );

  // keyboard controls
  useEffect(() => {
    if (!mode) return;
    const s = socketRef.current;

    const kd = (e) => {
      const key = e.key;
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Spacebar"].includes(
          key
        )
      ) {
        e.preventDefault();
      }
      if (mode === "bot") {
        if (key === "ArrowLeft") meRef.current?.left();
        if (key === "ArrowRight") meRef.current?.right();
        if (key === "ArrowUp") meRef.current?.rot();
        if (key === "ArrowDown") meRef.current?.soft();
        if (key === " " || key === "Spacebar") meRef.current?.hardDrop();
        return;
      }
      const action =
        key === "ArrowLeft"
          ? "L"
          : key === "ArrowRight"
          ? "R"
          : key === "ArrowUp"
          ? "U"
          : key === "ArrowDown"
          ? "D"
          : key === " " || key === "Spacebar"
          ? "H"
          : null;
      if (!action) return;
      const desiredTick = serverTickRef.current + INPUT_DELAY_TICKS;
      s?.emit("tetris:input", {
        roomId: roomIdRef.current,
        action,
        desiredTick,
      });
    };

    window.addEventListener("keydown", kd, true);
    return () => window.removeEventListener("keydown", kd, true);
  }, [mode]);

  // mobile detection
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

  const sendAction = useCallback(
    (action) => {
      if (mode === "bot") {
        if (action === "L") meRef.current?.left();
        else if (action === "R") meRef.current?.right();
        else if (action === "U") meRef.current?.rot();
        else if (action === "D") meRef.current?.soft();
        else if (action === "H") meRef.current?.hardDrop();
        return;
      }
      const desiredTick = serverTickRef.current + INPUT_DELAY_TICKS;
      socketRef.current?.emit("tetris:input", {
        roomId: roomIdRef.current,
        action,
        desiredTick,
      });
    },
    [mode]
  );

  // slide pad for mobile
  const padRef = useRef({ active: false, lastX: 0, acc: 0 });
  const STEP_PX = 20;

  const onPadPointerDown = (e) => {
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {}
    const x = e.clientX;
    padRef.current = { active: true, lastX: x, acc: 0 };
    e.preventDefault();
  };
  const onPadPointerMove = (e) => {
    if (!padRef.current.active) return;
    const x = e.clientX;
    let dx = x - padRef.current.lastX;
    padRef.current.lastX = x;
    padRef.current.acc += dx;
    while (padRef.current.acc <= -STEP_PX) {
      sendAction("L");
      padRef.current.acc += STEP_PX;
    }
    while (padRef.current.acc >= STEP_PX) {
      sendAction("R");
      padRef.current.acc -= STEP_PX;
    }
    e.preventDefault();
  };
  const endPad = (e) => {
    padRef.current.active = false;
    padRef.current.acc = 0;
    e.preventDefault();
  };

  const rotateTap = (e) => {
    e.preventDefault();
    sendAction("U");
  };
  const dropTap = (e) => {
    e.preventDefault();
    sendAction("H");
  };

  const btnStyle = (w = 48, h = 48) => ({
    width: w,
    height: h,
    borderRadius: "9999px",
    border: "1px solid var(--border-color)",
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(6px)",
    color: "var(--text-color)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,.28)",
    opacity: 0.85,
    userSelect: "none",
    WebkitUserSelect: "none",
    MozUserSelect: "none",
    msUserSelect: "none",
    WebkitTouchCallout: "none",
    WebkitTapHighlightColor: "transparent",
    touchAction: "none",
    outline: "none",
  });

  function startPractice() {
    const ctx = canvasRef.current.getContext("2d");
    const W = (COLS * 2 + 1) * SIZE;
    const H = ROWS * SIZE;
    ctx.clearRect(0, 0, W, H);

    meRef.current = createTetris(ctx, 0, 12345, { onScore: () => {} });
    opRef.current = createTetris(ctx, (COLS + 1) * SIZE, 98765, {
      onScore: () => {},
    });

    meRef.current.start();
    opRef.current.start();

    setMode("bot");
    setStatus(
      "Practice — clear sand rows and watch the pile crumble into slopes."
    );
    clearLoop();
    rafRef.current = requestAnimationFrame(loop);

    clearSim();
    simIntRef.current = setInterval(() => {
      meRef.current?.tick();
      opRef.current?.tick();
      if (meRef.current?.g.over || opRef.current?.g.over) {
        clearInterval(simIntRef.current);
        simIntRef.current = null;
        const myScore = meRef.current?.g.score || 0;
        const opScore = opRef.current?.g.score || 0;
        const win = !meRef.current?.g.over && myScore >= opScore;
        finish(!!win);
      }
    }, 1000 / 60);

    const bot = setInterval(() => {
      if (!opRef.current || opRef.current.g.over) {
        clearInterval(bot);
        return;
      }
      const r = Math.random();
      if (r < 0.4) opRef.current.left();
      else if (r < 0.8) opRef.current.right();
      else opRef.current.rot();
      if (Math.random() < 0.35) opRef.current.soft();
    }, 120);
  }

  const ensureSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;

    let WS_BASE = (API_BASE_URL && API_BASE_URL.trim()) || "";
    WS_BASE = WS_BASE.replace(/\/+$/, "").replace(/\/api\/?$/, "");

    try {
      const po = new URL(window.location.origin);
      const wb = new URL(WS_BASE || po.origin);
      if (/trycloudflare\.com$/i.test(po.hostname) && po.hostname !== wb.hostname) {
        WS_BASE = po.origin;
      }
    } catch {}

    const s = io(WS_BASE || undefined, {
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

    s.on("connect", () => setStatus("Connected. Queueing…"));
    s.on("tetris:queued", () => setStatus("Looking for an opponent…"));

    s.on("tetris:start", ({ roomId, seed, tickHz, you }) => {
      clearSim();
      roomIdRef.current = roomId;
      sideRef.current = you;
      tickHzRef.current = tickHz || 60;
      serverTickRef.current = 0;
      lastSimTickRef.current = 0;
      myQRef.current = new Map();
      opQRef.current = new Map();
      awardedRef.current = false;

      const ctx = canvasRef.current.getContext("2d");
      meRef.current = createTetris(
        ctx,
        you === "left" ? 0 : (COLS + 1) * SIZE,
        seed,
        {
          onScore: (sc) =>
            s.emit("tetris:score", {
              roomId: roomIdRef.current,
              score: sc,
            }),
        }
      );
      opRef.current = createTetris(
        ctx,
        you === "left" ? (COLS + 1) * SIZE : 0,
        seed + 1337
      );

      meRef.current.start();
      opRef.current.start();
      clearLoop();
      rafRef.current = requestAnimationFrame(loop);
      setMode("online");
      setStatus(
        "Match found — clear more sand lines than your opponent before someone tops out."
      );
    });

    s.on("tetris:tick", ({ tick }) => {
      serverTickRef.current = tick;
      while (lastSimTickRef.current < tick) {
        const t = ++lastSimTickRef.current;

        const apply = (inst, Qmap) => {
          const list = Qmap.get(t);
          if (list && list.length) {
            for (const a of list) {
              if (a === "L") inst.left();
              else if (a === "R") inst.right();
              else if (a === "U") inst.rot();
              else if (a === "D") inst.soft();
              else if (a === "H") inst.hardDrop();
            }
            Qmap.delete(t);
          }
          inst.tick();
        };

        meRef.current && apply(meRef.current, myQRef.current);
        opRef.current && apply(opRef.current, opQRef.current);

        if (meRef.current?.g.over) {
          s.emit("tetris:topout", { roomId: roomIdRef.current });
        }
      }
    });

    s.on("tetris:input", ({ from, action, tick }) => {
      const Q = from === sideRef.current ? myQRef.current : opQRef.current;
      if (!Q.has(tick)) Q.set(tick, []);
      Q.get(tick).push(action);
    });

    s.on("tetris:opscore", () => {});

    s.on("tetris:topout", ({ winner }) => {
      const didWin = winner === sideRef.current;
      finish(didWin);
    });

    return s;
  }, [loop, finish, clearLoop, clearSim]);

  function online() {
    const s = ensureSocket();
    setStatus("Connecting…");
    s.emit("tetris:queue", {
      userId: window.__USER__?._id,
      username: window.__USER__?.username,
    });
  }

  function resign() {
    if (mode === "online" && socketRef.current && roomIdRef.current) {
      socketRef.current.emit("tetris:resign", { roomId: roomIdRef.current });
    }
    clearSim();
    clearLoop();
    setMode(null);
    setStatus("Stopped.");
  }

  const PIX_W = (COLS * 2 + 1) * SIZE;
  const PIX_H = ROWS * SIZE;

  const panelRef = useRef(null);
  const [boardSize, setBoardSize] = useState(PIX_W);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (drawerOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useLayoutEffect(() => {
    const getPad = (el) => {
      const cs = window.getComputedStyle(el);
      const padX =
        parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY =
        parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
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
      const mobileExtra = isPhone ? MOBILE_NAV_H + inset : 0;
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

      const ratio = PIX_W / PIX_H;
      const maxWidthFromHeight = availH * ratio;

      setBoardSize(Math.min(innerW, maxWidthFromHeight));
    };

    calc();
    window.addEventListener("resize", calc);
    let ro;
    if ("ResizeObserver" in window && panelRef.current) {
      ro = new ResizeObserver(calc);
      ro.observe(panelRef.current);
    }
    return () => {
      window.removeEventListener("resize", calc);
      if (ro) ro.disconnect();
    };
  }, [PIX_W, PIX_H]);

  const mobileMeta =
    mode === "bot"
      ? "Practice"
      : mode === "online"
      ? "Online Match"
      : "Idle";

  const showStartCTA = !mode; // mirror Checkers

  return (
    <>
      {/* Mobile top bar: drawer + pill */}
      <MobileTopBar>
        <DrawerButton
          onClick={() => setDrawerOpen(true)}
          aria-label="Open Sandfall sidebar"
        >
          ➤
        </DrawerButton>

        <MobileOpponentPill>
          <MobileOpponentName>Sandfall Lines VS</MobileOpponentName>
          <MobileOpponentMeta>{mobileMeta}</MobileOpponentMeta>
        </MobileOpponentPill>
      </MobileTopBar>

      <Wrap>
        {/* LEFT: board */}
        <BoardPanel ref={panelRef}>
          <BoardViewport>
            <div
              style={{
                position: "relative",
                width: boardSize,
                maxWidth: "100%",
                margin: "0 auto",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 14px 32px rgba(0,0,0,.35)",
                background: "linear-gradient(180deg,#020617,#020617)",
                // NEW: reserve space for the mobile control bar so it
                // doesn't overlap the bottom of the canvas.
                paddingBottom: isTouch ? 76 : 0, // ~height of control bar
              }}
            >
              {showStartCTA && (
               <BoardOverlayCTA>
                 <div>
                   <Button onClick={startPractice}>Practice vs Bot</Button>
                   <Button $primary onClick={online}>Play Online</Button>
                 </div>
               </BoardOverlayCTA>
             )}
              <canvas
                ref={canvasRef}
                width={PIX_W}
                height={PIX_H}
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                }}
              />

              {isTouch && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderTop: "1px solid var(--border-color)",
                    background: "var(--container-white)",
                    padding: "8px 10px env(safe-area-inset-bottom,0px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={btnStyle(44, 44)}
                      onPointerDown={rotateTap}
                      onDragStart={(e) => e.preventDefault()}
                      tabIndex={-1}
                      aria-label="Rotate sand block"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        style={{ pointerEvents: "none" }}
                        aria-hidden="true"
                      >
                        <path
                          d="M12 5v3l4-4-4-4v3A8 8 0 1 0 20 12h-2a6 6 0 1 1-6-7z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <div
                      style={btnStyle(44, 44)}
                      onPointerDown={dropTap}
                      onDragStart={(e) => e.preventDefault()}
                      tabIndex={-1}
                      aria-label="Hard drop sand block"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        style={{ pointerEvents: "none" }}
                        aria-hidden="true"
                      >
                        <path
                          d="M12 3v12M12 15l-4-4m4 4 4-4M5 21h14"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>

                  <div
                    style={{
                      flex: "1 1 auto",
                      marginLeft: 12,
                      minWidth: 140,
                      maxWidth: 260,
                      height: 46,
                      background: "rgba(17,17,17,.18)",
                      border: "1px solid rgba(0,0,0,.10)",
                      borderRadius: 12,
                      backdropFilter: "blur(6px)",
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,.35)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      touchAction: "none",
                      overscrollBehavior: "contain",
                    }}
                    onPointerDown={onPadPointerDown}
                    onPointerMove={onPadPointerMove}
                    onPointerUp={endPad}
                    onPointerCancel={endPad}
                    onTouchMove={(e) => e.preventDefault()}
                    onWheel={(e) => e.preventDefault()}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        opacity: 0.95,
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 22 22"
                        style={{ pointerEvents: "none" }}
                        aria-hidden="true"
                      >
                        <path
                          d="M6 11 L18 4 V18 Z"
                          fill="#fff"
                        />
                      </svg>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 22 22"
                        style={{ pointerEvents: "none" }}
                        aria-hidden="true"
                      >
                        <path
                          d="M16 11 L4 4 V18 Z"
                          fill="#fff"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </BoardViewport>

          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              textAlign: "center",
              color: "rgba(230,233,255,0.65)",
            }}
          >
            Clear full <b>sand rows</b> to score. Settled blocks
            crumble into individual grains, forming dunes like in the
            screenshot.
          </div>

          <MobileStack>
            <div style={{ display: "grid", gap: 10 }}>
              {mode && (
                <Button onClick={resign}>Resign</Button>
              )}

              <div
                style={{
                  marginTop: 4,
                  color: "rgba(230,233,255,0.75)",
                  fontSize: 13,
                }}
              >
                {status}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                Controls: <b>←/→</b> move · <b>↑</b> rotate ·{" "}
                <b>↓</b> soft drop · <b>space</b> hard drop.
              </div>

              <ReturnButton
                onClick={() =>
                  typeof onExit === "function" ? onExit() : null
                }
                title="Return to Games"
              >
                <span className="icon">←</span>
                <span>Return to Games</span>
              </ReturnButton>
            </div>
          </MobileStack>
        </BoardPanel>

        {/* RIGHT: sticky rail */}
        <RightRailShell>
          <RightRailTopBar>
            <ReturnButton
              onClick={() =>
                typeof onExit === "function" ? onExit() : null
              }
              title="Return to Games"
            >
              <span className="icon">←</span>
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
              <Button onClick={startPractice}>Practice vs Bot</Button>
              <Button $primary onClick={online}>
                Play Online
              </Button>
              <Button onClick={resign}>Resign</Button>
            </div>

            <div
              style={{
                marginTop: 10,
                color: "rgba(230,233,255,0.75)",
              }}
            >
              {status}
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "rgba(230,233,255,0.75)",
              }}
            >
              Build a crumbling dune of sand blocks. When a horizontal
              row is completely filled with sand grains, that layer is
              cleared and everything above drops down.
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Keyboard: <b>←/→</b> move · <b>↑</b> rotate ·{" "}
              <b>↓</b> soft drop · <b>space</b> hard drop. Higher total
              score wins when someone tops out.
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: "rgba(230,233,255,0.65)",
              }}
            >
              Wins vs real players grant <b>+6 trophies</b>. Losses
              cost <b>-5 trophies</b>. Practice is unranked.
            </div>
          </ControlsPanel>
        </RightRailShell>
      </Wrap>

      {/* Drawer for stats on mobile */}
      {drawerOpen && (
        <DrawerBackdrop onClick={() => setDrawerOpen(false)} />
      )}
      <Drawer
        $open={drawerOpen}
        role="complementary"
        aria-label="Sandfall sidebar"
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
              border: "1px solid var(--border-color)",
              background: "var(--container-white)",
              borderRadius: 999,
              width: 36,
              height: 36,
              fontWeight: 900,
              lineHeight: 1,
              boxShadow: "0 8px 18px rgba(0,0,0,.12)",
            }}
          >
            ×
          </button>
        </div>

        <GameSidebar
          gameKey="tetris"
          title="Sandfall Lines"
          showOnMobile
        />
      </Drawer>
    </>
  );
}
