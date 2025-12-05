// client/src/pages/FishingArena.jsx
import React, {
  useEffect,
  useRef,
  useState,
  useContext,
  useCallback,
  useLayoutEffect,
} from "react";
import styled from "styled-components";
import { createPortal } from "react-dom";
import { io } from "socket.io-client";
import axios from "axios";
import { API_BASE_URL } from "../config";
import { AuthContext } from "../App";
import GameRules from "../components/GameRules";
import GameSidebar from "../components/GameSidebar";

/* ---------- Layout (shorter to avoid vertical scrollbar) ---------- */
const STAGE_H = 396;  // was 420
const DOCK_H = 34;

const FISHER_W = 60;
const FISHER_H = 110;
const FISHER_BOTTOM = DOCK_H - 6;

const ROD_TOP_INSET = 8;
const ROD_X_LEFT_INSET = 6 + 1.5;
const ROD_X_RIGHT_INSET = 44 + 1.5;
const SPRITE_CENTER_OFFSET = (FISHER_W - 50) / 2;

const GAME_W = 600;

/* === Shared page shell (match Chess/Checkers) === */
const SIDE_W = 360;      // matches sidebar/rail
const HEADER_H = 76;     // global header height
const BOTTOM_GAP = 50;
const MOBILE_NAV_H = 64;
const RAIL_PAD = 12;
const DESKTOP_PANEL_GAP = BOTTOM_GAP + 16; // small extra so no scrolling

/* ---------- Helpers ---------- */
const fishMouth = (f) => ({ x2: f.x + 36 + (f.dir > 0 ? 22 : -22), y2: f.y + 16 });
const rodTipFromLeft  = (left) => ({ x: left + SPRITE_CENTER_OFFSET + ROD_X_LEFT_INSET,  y: STAGE_H - FISHER_BOTTOM - FISHER_H + ROD_TOP_INSET });
const rodTipFromRight = (left) => ({ x: left + SPRITE_CENTER_OFFSET + ROD_X_RIGHT_INSET, y: STAGE_H - FISHER_BOTTOM - FISHER_H + ROD_TOP_INSET });

/* ---------- Styled: shell & panels ---------- */

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

const BoardPanel = styled(Panel)`
  grid-column: 1;
  justify-self: center;
  align-self: start;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;

  /* Fill almost all of the viewport, but leave a tiny buffer so there's no page scroll */
  height: calc(100vh - ${HEADER_H}px - ${DESKTOP_PANEL_GAP}px);
  max-height: calc(100vh - ${HEADER_H}px - ${DESKTOP_PANEL_GAP}px);
  overflow: hidden;

  @media (max-width: 860px) {
    width: 100%;
    max-width: 100vw;
    margin: 0;
    padding: 0 0
      calc(
        ${MOBILE_NAV_H}px + 16px + env(safe-area-inset-bottom, 0px)
      )
      0;

    /* On mobile, go back to natural height so content can scroll */
    height: auto;
    max-height: calc(100vh - ${HEADER_H}px - ${MOBILE_NAV_H}px);
    align-items: stretch;
  }
`;

const BoardViewport = styled.div`
  flex: 0 0 auto;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  min-height: 0;
  position: relative;
`;
const StageShell = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  transform: scale(${(p) => p.$scale});
  transform-origin: top center;

  @media (max-width: 860px) {
    transform: none; /* mobile uses full size, like Chess */
  }
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
  padding-bottom: 45px;
  height: 56px;
  margin-bottom: 12px;
`;

const ControlsPanel = styled(Panel)`
  flex: 1 1 auto;
  min-height: 0;
  align-self: stretch;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
`;

/* ---------- Buttons & small UI ---------- */

const Button = styled.button`
  padding: 8px 12px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 800;
  border: 1px solid ${(p) => (p.$primary ? "transparent" : "var(--border-color)")};
  background: ${(p) => (p.$primary ? "var(--primary-orange)" : "rgba(255,255,255,0.06)")};
  color: ${(p) => (p.$primary ? "#000" : "var(--text-color)")};
  box-shadow: ${(p) => (p.$primary ? "0 8px 22px rgba(0,0,0,.35)" : "none")};
  opacity: ${(p) => (p.$disabled ? 0.6 : 1)};
  pointer-events: ${(p) => (p.$disabled ? "none" : "auto")};
  transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.08s ease;
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
  background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow: 0 8px 24px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.06);
  backdrop-filter: blur(6px);
  color: var(--text-color);
  width: 100%;
  box-sizing: border-box;

  &:hover {
    background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06));
    border-color: rgba(255,255,255,0.16);
    transform: translateY(-1px);
  }
  .icon {
    font-size: 18px;
    line-height: 1;
    opacity: 0.95;
  }
`;

const Badge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 12px;
  border: 1px solid var(--border-color);
  background: var(--container-white);
  color: var(--text-color);
`;

/* Mobile top bar + drawer bits (mirrors Chess) */

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

const DrawerButton = styled.button`
  @media (max-width: 860px) {
    border: 1px solid var(--border-color);
    background: var(--container-white);
    color: var(--text-color);
    border-radius: 999px;
    padding: 6px 10px;
    font-weight: 800;
    box-shadow: 0 8px 18px rgba(0,0,0,.12);
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
  box-shadow: 12px 0 28px rgba(0,0,0,.28);
  transform: translateX(${(p) => (p.$open ? "0" : "-100%")});
  transition: transform 0.22s ease;
  z-index: 60;
  padding: 12px 10px;
  overflow: auto;
`;

const DrawerBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.35);
  z-index: 59;
`;

const MobileStack = styled.div`
  display: none;
  @media (max-width: 860px) {
    display: grid;
    gap: 10px;
    margin-top: 10px;
    width: 100%;
  }
`;

/* ---------- Fishing board styling ---------- */

const Stage = styled.div`
  position: relative;
  z-index: 0;  /* <-- add this line */
  height: ${STAGE_H}px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  overflow: hidden;
  background: linear-gradient(#9ed0f1, #6bb3da);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.35);
`;

const CenterLine = styled.div`
  position: absolute;
  top: 0;
  bottom: ${DOCK_H}px;
  left: 50%;
  width: 2px;
  background: #0002;
  z-index: 1;
`;

const WavesCanvasEl = styled.canvas`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: ${DOCK_H}px;
  width: 100%;
  height: ${STAGE_H - DOCK_H}px;
  z-index: 0;
  pointer-events: none;
`;

const DockBody = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: ${DOCK_H}px;
  background: #a87944;
  image-rendering: pixelated;
  background-image: linear-gradient(#b98953, #a87944),
    repeating-linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.15) 0 1px,
      transparent 1px 15px,
      rgba(0, 0, 0, 0.15) 15px 16px,
      transparent 16px 30px
    ),
    radial-gradient(rgba(0, 0, 0, 0.2) 25%, transparent 26%),
    radial-gradient(rgba(0, 0, 0, 0.2) 25%, transparent 26%);
  background-size: 100% 100%, 100% 100%, 10px 10px, 10px 10px;
  background-position: 0 0, 0 0, 3px 3px, 13px 8px;
`;

const FisherWrap = styled.div`
  position: absolute;
  bottom: ${FISHER_BOTTOM}px;
  width: ${FISHER_W}px;
  height: ${FISHER_H}px;
  display: grid;
  place-items: center;
  left: ${(p) => p.$left}px;
  filter: ${(p) => (p.$me ? "drop-shadow(0 0 .35rem #3b82f6)" : "none")};
`;

const Name = styled.div`
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-weight: 900;
  font-size: 13px;
  color: var(--text-color);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
`;

const FishWrap = styled.div`
  position: absolute;
  top: ${(p) => p.$y}px;
  left: ${(p) => p.$x}px;
  width: 72px;
  height: 32px;
  pointer-events: none;
`;

const Splash = styled.div`
  position: absolute;
  pointer-events: none;
  left: ${(p) => p.$x + 30}px;
  top: ${(p) => p.$y - 8}px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.65);
  animation: splash 0.8s ease-out infinite;
  @keyframes splash {
    0% {
      transform: scale(0.4);
      opacity: 0.9;
    }
    100% {
      transform: scale(1.8);
      opacity: 0;
    }
  }
`;

const HUDLine = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  color: var(--text-color);
`;

const Bar = styled.div`
  height: 10px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
  flex: 1;
  border: 1px solid var(--border-color);
`;

const Fill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, var(--primary-orange), #59d0ff);
  width: ${(p) => p.$pct}%;
  transition: width 0.12s ease;
`;

const QTEPane = styled.div`
  position: absolute;
  top: 14%;
  left: ${(p) => (p.$side === "L" ? "25%" : "75%")};
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  gap: 8px;
  z-index: 3;
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px 12px;
`;

const Key = styled.div`
  min-width: 48px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-color);
  text-align: center;
  font-weight: 800;
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.36);
  color: var(--text-color);
  z-index: 2;
`;

const CountOverlay = styled(Overlay)`
  background: rgba(0, 0, 0, 0.42);
  font-weight: 900;
  font-size: 72px;
`;

const MobilePlayOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;

  @media (min-width: 861px) {
    display: none;
  }
`;

const MobilePlayCard = styled.div`
  pointer-events: auto;
  min-width: 68%;
  max-width: 86%;
  padding: 16px 14px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: stretch;
  text-align: center;
`;

const ResultOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: rgba(0, 0, 0, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  isolation: isolate;
  pointer-events: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const ResultModal = styled.div`
  width: 540px;
  max-width: 94vw;
  max-height: min(92dvh, 560px);
  overflow: auto;
  background: var(--container-white);
  color: var(--text-color);
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  border: 1px solid var(--border-color);
  padding: 16px;
`;

const TimerBadge = styled.div`
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 4px 10px;
  font-weight: 900;
  font-size: 14px;
`;

const ScoreBadge = styled.div`
  position: absolute;
  top: 6px;
  ${(p) => (p.$side === "L" ? "left:8px;" : "right:8px;")}
  z-index: 3;
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 4px 8px;
  font-weight: 900;
  font-size: 12px;
`;

const PileWrap = styled.div`
  position: absolute;
  bottom: ${DOCK_H}px;
  ${(p) => (p.$side === "L" ? "left" : "right")}: ${(p) => p.$offset}px;
  width: 120px;
  height: 120px;
  pointer-events: none;
  z-index: 1;
`;

const PileFish = styled.div`
  position: absolute;
  transform: ${(p) =>
    `translate(${p.$x}px, ${p.$y}px) rotate(${p.$r}deg) scale(.74)`};
  transform-origin: center;
  opacity: 0.98;
`;

/* Mobile thumb-stick pad (unchanged, just defined here) */

const MobilePad = styled.div`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: ${DOCK_H + 10}px;
  width: 112px;
  height: 112px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 0.26);
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  touch-action: none;
  -webkit-tap-highlight-color: transparent;

  @media (hover: hover) and (pointer: fine) {
    display: none;
  }
`;

const DirBtn = styled.button`
  position: absolute;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(0, 0, 0, 0.28);
  border-radius: 10px;
  background: rgba(17, 17, 17, 0.22);
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;

  &:active {
    transform: scale(0.98);
  }
`;

/* ---------- Per-game rank helpers ---------- */

const perGameRank = (n) => {
  if (n >= 1500) return "Champion";
  if (n >= 900) return "Diamond";
  if (n >= 600) return "Platinum";
  if (n >= 400) return "Gold";
  if (n >= 250) return "Silver";
  if (n >= 100) return "Bronze";
  return "Wood";
};

// Trophies (Fishing only) + overall place for the modal
const fetchMyFishingTrophies = async (userId) => {
  try {
    const { data } = await axios.get(`${API_BASE_URL}/api/games/stats/${userId}`);
    return data?.trophiesByGame?.fishing || 0;
  } catch {
    return 0;
  }
};
const fetchMyOverallPlace = async (userId) => {
  try {
    const q = new URLSearchParams({ limit: "100", userId });
    const { data } = await axios.get(
      `${API_BASE_URL}/api/games/leaderboard/overall?${q.toString()}`
    );
    return data?.me?.rank ?? null;
  } catch {
    return null;
  }
};

/* ---------- Client sizes ---------- */
const SIZES = [
  { name: "Big", trophy: 6, chunks: 8 },
  { name: "Huge", trophy: 7, chunks: 9 },
  { name: "Massive", trophy: 8, chunks: 10 },
  { name: "Ginormous", trophy: 9, chunks: 11 },
];

const FISHING_RULE_SECTIONS = [
  {
    heading: "Goal",
    text: "Reel in more fish than your opponent before the timer runs out.",
  },
  {
    heading: "Controls",
    list: [
      "Watch for the arrow prompt in the water.",
      "Press the same arrow on your keyboard (or tap it on mobile).",
      "Correct inputs increase your reel progress, wrong ones decrease it.",
    ],
  },
  {
    heading: "Scoring",
    list: [
      "Each fish is split into chunks along the line.",
      "Reaching the end scores a point and spawns a new fish.",
      "Highest total when time expires wins the match.",
    ],
    note: "Tip: Try to get into a rhythm instead of mashing keys at random.",
  },
];

/* ---------- Pixel sprites ---------- */
function drawFisherman(ctx) {
  ctx.clearRect(0, 0, 50, 110);
  const p = 2;
  const put = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x * p), Math.round(y * p), Math.round(w * p), Math.round(h * p));
  };
  const SKIN = "#f1c27d",
    SHADOW = "#d19a66",
    HAT_D = "#1e5631",
    HAT_L = "#2a6b3c",
    SHIRT = "#1c4d9e",
    VEST = "#c49a6c",
    VEST_SH = "#a77f54",
    PANTS = "#6b7f39",
    BOOTS = "#1b1b1b",
    EYE = "#111",
    WHITE = "#fff";
  put(6, 2, 19, 5, HAT_D);
  put(7, 3, 17, 3, HAT_L);
  put(4, 6, 23, 2, HAT_D);
  put(9, 8, 14, 9, SKIN);
  put(9, 15, 14, 2, SHADOW);
  put(11, 11, 2, 2, EYE);
  put(19, 11, 2, 2, EYE);
  put(11, 16, 10, 2, SHADOW);
  put(13, 18, 6, 2, SKIN);
  put(7, 20, 22, 14, SHIRT);
  put(8, 21, 20, 12, VEST);
  put(8, 26, 20, 2, VEST_SH);
  put(10, 23, 4, 3, VEST_SH);
  put(22, 23, 4, 3, VEST_SH);
  put(7, 34, 22, 2, "#111");
  put(9, 36, 7, 12, PANTS);
  put(20, 36, 7, 12, PANTS);
  put(8, 48, 9, 4, BOOTS);
  put(19, 48, 9, 4, BOOTS);
  put(8, 21, 1, 1, WHITE);
  put(26, 21, 1, 1, WHITE);
}

function drawFish(ctx, dir = 1) {
  ctx.clearRect(0, 0, 72, 32);
  const p = 2;
  const put = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x * p), Math.round(y * p), Math.round(w * p), Math.round(h * p));
  };
  const BODY = "#89d3ec",
    EDGE = "#337b9c",
    LIGHT = "#bff0ff";
  put(6, 6, 24, 10, BODY);
  put(5, 7, 1, 8, EDGE);
  put(30, 7, 1, 8, EDGE);
  put(6, 5, 24, 1, EDGE);
  put(6, 16, 24, 1, EDGE);
  put(28, 8, 6, 6, BODY);
  put(27, 9, 1, 4, EDGE);
  put(34, 9, 1, 4, EDGE);
  put(0, 9, 6, 4, BODY);
  put(0, 10, 1, 2, EDGE);
  put(5, 10, 1, 2, EDGE);
  put(8, 8, 10, 1, LIGHT);
  put(32, 11, 1, 1, "#111");
  if (dir < 0) {
    const img = ctx.getImageData(0, 0, 72, 32);
    const off = document.createElement("canvas");
    off.width = 72;
    off.height = 32;
    const octx = off.getContext("2d");
    octx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, 72, 32);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(off, -72, 0);
    ctx.restore();
  }
}

function FisherSprite() {
  const ref = useRef(null);
  useEffect(() => {
    drawFisherman(ref.current.getContext("2d"));
  }, []);
  return <canvas width={50} height={110} ref={ref} style={{ imageRendering: "pixelated" }} />;
}

function FishCanvas({ dir = 1 }) {
  const ref = useRef(null);
  useEffect(() => {
    drawFish(ref.current.getContext("2d"), dir);
  }, [dir]);
  return <canvas width={72} height={32} ref={ref} style={{ imageRendering: "pixelated" }} />;
}

/* ---------- Waves ---------- */
function WavesCanvas({ stageW }) {
  const ref = useRef(null);
  const animRef = useRef(0);
  useEffect(() => {
    const canvas = ref.current,
      ctx = canvas.getContext("2d");
    const W = (canvas.width = Math.max(1, Math.floor(stageW)));
    const H = (canvas.height = STAGE_H - DOCK_H);
    const N = Math.floor((W * H) / 12000) + 60;
    const waves = Array.from({ length: N }).map(() => ({
      x: Math.random() * W,
      y: Math.random() * (H - 26) + 12,
      amp: 2 + Math.random() * 2.5,
      speed: 0.6 + Math.random() * 0.8,
      w: 7 + ((Math.random() * 3) | 0),
      c: Math.random() < 0.5 ? "#2a6ca0" : "#1f557f",
      phase: Math.random() * Math.PI * 2,
    }));
    const draw = (t) => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      for (const wv of waves) {
        const dx = Math.sin((t * 0.001 * wv.speed) + wv.phase) * wv.amp;
        const x = Math.round(wv.x + dx) + 0.5;
        const y = Math.round(wv.y) + 0.5;
        const half = Math.floor(wv.w / 2);
        ctx.strokeStyle = wv.c;
        ctx.beginPath();
        ctx.moveTo(x - half, y + 1);
        ctx.lineTo(x - Math.ceil(half / 2), y);
        ctx.lineTo(x + Math.ceil(half / 2), y);
        ctx.lineTo(x + half, y + 1);
        ctx.stroke();
      }
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [stageW]);
  return <WavesCanvasEl ref={ref} />;
}

/* ---------- Pile layout ---------- */
function pileLayout(n) {
  const out = [];
  let row = 0;
  let remaining = n;
  const perRowMax = 5;
  while (remaining > 0 && row < 6) {
    const perRow = Math.min(perRowMax - (row % 2), remaining);
    const baseY = 4 + row * 18;
    const startX = 6 + (perRowMax - perRow) * 8;
    for (let i = 0; i < perRow; i++) {
      out.push({
        x: startX + i * 18 + ((Math.random() * 2) | 0),
        y: 84 - baseY,
        r: (Math.random() * 8 - 4).toFixed(1),
      });
    }
    remaining -= perRow;
    row++;
  }
  return out;
}

/* ---------- Component ---------- */
export default function FishingArena({ onResult, onExit }) {
  const { user } = useContext(AuthContext);
  const sockRef = useRef(null);
  const roomRef = useRef(null);
  const stageRef = useRef(null);
  const panelRef = useRef(null);

  // how much to scale the entire stage+HUD on desktop so it fits the viewport
  const [stageScale, setStageScale] = useState(1);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const sideRef = useRef("L"); // authoritative side for socket handlers

  const [stageW, setStageW] = useState(600);
  const [, setRoom] = useState(null);
  const [mode, setMode] = useState("idle"); // idle | queued | playing
  const [ranked, setRanked] = useState(false);
  const [meSide, setMeSide] = useState("L");
  const [meUser, setMeUser] = useState(null);
  const [oppUser, setOppUser] = useState(null);

  const [fishL, setFishL] = useState({ x: 30, y: 180, dir: 1 });
  const [fishR, setFishR] = useState({ x: 498, y: 180, dir: -1 });

  const [sizeIdxL, setSizeIdxL] = useState(0);
  const [sizeIdxR, setSizeIdxR] = useState(0);
  const size = meSide === "L" ? SIZES[sizeIdxL] : SIZES[sizeIdxR];

  const [progress, setProgress] = useState(0);
  const [need, setNeed] = useState(null);

  const [match, setMatch] = useState("countdown");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState({ L: 0, R: 0 });

  const [message, setMessage] = useState("Pick a mode to start.");
  const [resultModal, setResultModal] = useState(null); // { didWin, resultText, trophies, rank, place }
  const [resigning, setResigning] = useState(false);
  const resigningRef = useRef(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Hide countdown/lines when a big overlay (rules, result, etc.) has
  // locked the body scroll. GameRules and our result modal both do this.
  const [uiOverlayActive, setUiOverlayActive] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;

    const check = () => {
      const hidden = document.body && document.body.style.overflow === "hidden";
      setUiOverlayActive(hidden);
    };

    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style"] });

    return () => observer.disconnect();
  }, []);

  // trophies: ALWAYS ±6 for ranked
  const awardedRef = useRef(false);
  const awardFishing = useCallback(
    async (kind) => {
      if (!user?._id || awardedRef.current) return;
      const delta = kind === "win" ? 6 : -6;
      try {
        await axios.post(`${API_BASE_URL}/api/games/result`, {
          userId: user._id,
          gameKey: "fishing",
          delta,
          didWin: kind === "win",
        });
        awardedRef.current = true;
        try {
          window.dispatchEvent(
            new CustomEvent("games:statsUpdated", { detail: { gameKey: "fishing" } })
          );
        } catch {}
      } catch {}
    },
    [user?._id]
  );
  const awardRef = useRef(awardFishing);
  useEffect(() => {
    awardRef.current = awardFishing;
  }, [awardFishing]);

  // stage size (single listener)
  useEffect(() => {
    const measure = () =>
      setStageW(stageRef.current?.getBoundingClientRect().width || 600);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const isPhone =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 860px)").matches;
    if (resultModal && isPhone) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [resultModal]);

  useEffect(() => {
    // Derive a stable WS base (strip trailing slashes and optional /api)
    const envBase =
      typeof process !== "undefined" &&
      process.env &&
      process.env.REACT_APP_API_BASE
        ? String(process.env.REACT_APP_API_BASE)
        : "";
    let WS_BASE =
      (API_BASE_URL && API_BASE_URL.trim()) || (envBase && envBase.trim()) || "";

    if (!WS_BASE) {
      const { protocol, hostname, host } = window.location;
      const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(hostname);
      if (isLocal) {
        const srvPort = "5000";
        WS_BASE = `${protocol}//${hostname}:${srvPort}`;
      } else {
        WS_BASE = `${protocol}//${host}`;
      }
    }

    WS_BASE = WS_BASE.replace(/\/+$/, "").replace(/\/api\/?$/, "");

    try {
      const po = new URL(window.location.origin);
      const wb = new URL(WS_BASE);
      if (/trycloudflare\.com$/i.test(po.hostname) && po.hostname !== wb.hostname) {
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
    sockRef.current = s;

    s.on("connect", () => {
      setMessage("Connected. Pick a mode to start.");
    });
    s.on("connect_error", (e) => {
      setMessage(`Socket connect error: ${e?.message || e}`);
    });
    s.on("error", (e) => {
      setMessage(`Socket error: ${e?.message || e}`);
    });

    s.on("fishing:queued", () => {
      resigningRef.current = false;
      setResigning(false);
      setResultModal(null);
      setMode("queued");
      setMessage("Looking for opponent…");
    });
    s.on("fishing:queueLeft", () => {
      resigningRef.current = false;
      setResigning(false);
      setResultModal(null);
      setMode("idle");
      setMessage("Pick a mode to start.");
    });

    s.on("fishing:start", ({ roomId, you, opp, side, state, ranked }) => {
      roomRef.current = roomId;
      awardedRef.current = false;
      resigningRef.current = false;
      setResigning(false);
      setResultModal(null);

      sideRef.current = side;
      setMeSide(side);

      setRoom(roomId);
      setMode("playing");
      setRanked(!!ranked);
      setMeUser(you);
      setOppUser(opp);

      if (state && state.roomId === roomId) {
        setMatch(state.match || "countdown");
        setCountdown(state.countdown ?? 3);
        setTimeLeft(state.timeLeft ?? 60);
        setScore(state.score || { L: 0, R: 0 });
        setFishL(state.fishL);
        setFishR(state.fishR);
        setSizeIdxL(state.sizeIdxL ?? 0);
        setSizeIdxR(state.sizeIdxR ?? 0);
        setProgress(side === "L" ? state.progress.L : state.progress.R);
        setNeed(side === "L" ? state.needL : state.needR);
      }
      setMessage("Get ready…");

      s.emit("fishing:ready", { roomId });
    });

    s.on("fishing:state", (st) => {
      if (st.roomId && st.roomId !== roomRef.current) return;
      const mySide = sideRef.current;
      setMatch(st.match || "live");
      setCountdown(st.countdown ?? 0);
      setTimeLeft(st.timeLeft ?? 60);
      setScore(st.score || { L: 0, R: 0 });
      setFishL(st.fishL);
      setFishR(st.fishR);
      setSizeIdxL(st.sizeIdxL ?? 0);
      setSizeIdxR(st.sizeIdxR ?? 0);
      setProgress(mySide === "L" ? st.progress.L : st.progress.R);
      setNeed(mySide === "L" ? st.needL : st.needR);
    });

    s.on("fishing:cancelled", ({ roomId: rid }) => {
      if (rid && rid !== roomRef.current) return;
      setMode("queued");
      setRoom(null);
      roomRef.current = null;
      setMessage("Opponent left. Looking for a new match…");
    });

    s.on(
      "fishing:gameover",
      async ({ roomId: rid, winnerUserId, ranked: rankedEnd, score: finalScore }) => {
        if (rid && rid !== roomRef.current) return;
        const didWin = String(winnerUserId) === String(user._id);

        if (rankedEnd && !awardedRef.current) {
          await awardRef.current(didWin ? "win" : "loss");
          if (onResultRef.current)
            onResultRef.current("fishing", didWin ? 6 : -6, didWin);
        }

        const resultText = didWin
          ? `You win! ${finalScore?.L ?? 0}-${finalScore?.R ?? 0}`
          : `You lose! ${finalScore?.L ?? 0}-${finalScore?.R ?? 0}`;

        const trophies = user?._id ? await fetchMyFishingTrophies(user._id) : 0;
        const rank = perGameRank(trophies);
        const place = user?._id ? await fetchMyOverallPlace(user._id) : null;

        setMessage(resultText);
        setResultModal({ didWin, resultText, trophies, rank, place });

        roomRef.current = null;
        setMode("idle");
        setRoom(null);
        setMatch("over");
      }
    );

    return () => {
      try {
        if (roomRef.current) s.emit("fishing:leave", { roomId: roomRef.current });
        else s.emit("fishing:leaveQueue");
        s.disconnect();
      } catch {}
    };
  }, [user?._id]);

  useEffect(() => {
    if (mode !== "queued") return;
    const s = sockRef.current;
    if (!s?.connected) return;

    let satisfied = false;
    const onStart = () => {
      satisfied = true;
    };

    s.on("fishing:start", onStart);
    const t = setTimeout(() => {
      if (!satisfied && s.connected) {
        s.emit("fishing:queue", { userId: user._id, username: user.username });
      }
    }, 1500);

    return () => {
      clearTimeout(t);
      s.off("fishing:start", onStart);
    };
  }, [mode, user._id, user.username]);
  // Desktop: keep the Fishing stage snug to the viewport height,
  // similar to how Chess sizes its board.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const getPad = (el) => {
      if (!el) return { padX: 0, padY: 0 };
      const cs = window.getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      return { padX, padY };
    };

    const BREATHING = BOTTOM_GAP;

    const calc = () => {
      const panel = panelRef.current;
      if (!panel) return;

      const { padY } = getPad(panel);
      const isPhone = window.matchMedia("(max-width: 860px)").matches;

      // visualViewport helps account for bottom browser UI / soft keyboard
      const inset = window.visualViewport
        ? Math.max(0, (window.innerHeight || 0) - window.visualViewport.height)
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

      // Approximate content height: the water stage + HUD under it.
      const CONTENT_H = STAGE_H + 80; // 396px water + ~HUD
      const scale = Math.min(1, availH / CONTENT_H);
      setStageScale(scale);
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
  }, []);

  const queueOnline = () => {
    if (mode === "queued" || mode === "playing") return;
    setMessage("Queueing…");
    sockRef.current?.emit("fishing:queue", {
      userId: user._id,
      username: user.username,
    });
  };

  const cancelQueue = () => {
    if (mode !== "queued") return;
    sockRef.current?.emit("fishing:leaveQueue");
  };

  const startBot = () => {
    if (mode === "queued" || mode === "playing") return;
    setMessage("Starting practice vs bot…");
    sockRef.current?.emit("fishing:practice", {
      userId: user._id,
      username: user.username,
    });
  };

  const resign = async () => {
    if (resigningRef.current) return;
    resigningRef.current = true;
    setResigning(true);

    if (mode === "queued") {
      cancelQueue();
      setResigning(false);
      resigningRef.current = false;
      return;
    }

    if (!roomRef.current) {
      setMode("idle");
      setRoom(null);
      setMessage("Pick a mode to start.");
      setResigning(false);
      resigningRef.current = false;
      return;
    }

    const rid = roomRef.current;
    sockRef.current?.emit("fishing:leave", { roomId: rid });

    setResultModal({
      didWin: false,
      resultText: "You resigned.",
      trophies: null,
      rank: null,
      place: null,
    });

    const shouldAward = ranked && !awardedRef.current && user?._id;
    if (shouldAward) awardedRef.current = true;

    try {
      if (shouldAward) {
        await awardRef.current("loss");
        if (onResultRef.current) onResultRef.current("fishing", -6, false);
      }
      if (user?._id) {
        const [trophies, place] = await Promise.all([
          fetchMyFishingTrophies(user._id),
          fetchMyOverallPlace(user._id),
        ]);
        const rank = perGameRank(trophies);
        setResultModal((prev) => prev && { ...prev, trophies, rank, place });
      }
    } finally {
      roomRef.current = null;
      setMode("idle");
      setRoom(null);
      setMessage("Pick a mode to start.");
      // keep lock until modal is dismissed
    }
  };

  // Mobile tap -> same logic as keyboard
  const sendTap = useCallback(
    (dir) => {
      const key =
        dir === "up"
          ? "ArrowUp"
          : dir === "down"
          ? "ArrowDown"
          : dir === "left"
          ? "ArrowLeft"
          : "ArrowRight";

      if (!roomRef.current || match !== "live") return;
      const s = sockRef.current;
      if (key === need) {
        s?.emit("fishing:input", { roomId: roomRef.current, type: "tap", key });
      } else {
        s?.emit("fishing:input", { roomId: roomRef.current, type: "tap-wrong", key });
      }
    },
    [match, need]
  );

  // Input: prevent page scroll on arrow keys; only send to active room
  useEffect(() => {
    const s = sockRef.current;
    const onKeyDown = (e) => {
      if (!roomRef.current || match !== "live") return;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      if (e.key === need)
        s?.emit("fishing:input", { roomId: roomRef.current, type: "tap", key: e.key });
      else
        s?.emit("fishing:input", {
          roomId: roomRef.current,
          type: "tap-wrong",
          key: e.key,
        });
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [need, match]);

  /* ---------- Coords & rendering ---------- */
  const leftHalfCenterX = stageW * 0.25;
  const rightHalfCenterX = stageW * 0.75;

  const fisherLeftL = Math.max(
    0,
    Math.min(leftHalfCenterX - FISHER_W / 2, stageW / 2 - FISHER_W)
  );
  const fisherLeftR = Math.max(
    stageW / 2,
    Math.min(rightHalfCenterX - FISHER_W / 2, stageW - FISHER_W)
  );

  const origLeftFisherLeft = 34;
  const origRightFisherLeft = GAME_W - 34 - FISHER_W;
  const dxL = fisherLeftL - origLeftFisherLeft;
  const dxR = fisherLeftR - origRightFisherLeft;

  const fishLDraw = { ...fishL, x: fishL.x + dxL };
  const fishRDraw = { ...fishR, x: fishR.x + dxR };

  const rodTipL = rodTipFromLeft(fisherLeftL);
  const rodTipR = rodTipFromRight(fisherLeftR);

  const lineL = { x1: rodTipL.x, y1: rodTipL.y, ...fishMouth(fishLDraw) };
  const lineR = { x1: rodTipR.x, y1: rodTipR.y, ...fishMouth(fishRDraw) };

  const instruction =
    match === "countdown" ? "Get ready…" : "Reel! Press the arrow shown.";
  const myScore = meSide === "L" ? score.L : score.R;

  const pileOffsetL = Math.max(6, fisherLeftL - 110);
  const pileOffsetR = Math.max(6, stageW - (fisherLeftR + FISHER_W) - 110);

  const fmtTime = (secs) =>
    `0:${String(Math.max(0, secs | 0)).padStart(2, "0")}`;

  /* ---------- JSX ---------- */

  return (
    <>
      {/* Mobile top bar: sidebar toggle + opponent summary */}
      <MobileTopBar>
        <DrawerButton
          onClick={() => setDrawerOpen(true)}
          aria-label="Open fishing sidebar"
        >
          ➤
        </DrawerButton>
      </MobileTopBar>

      <Wrap>
        {/* LEFT: stage + HUD */}
        <BoardPanel ref={panelRef}>
          <BoardViewport>
            <StageShell $scale={stageScale}>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 900, // allow the game to breathe on big screens
                  margin: "0 auto",
                }}
              >
                <Stage ref={stageRef}>
                <CenterLine />
                <WavesCanvas stageW={stageW} />

                <TimerBadge>{timeLeft.toString().padStart(2, "0")}s</TimerBadge>
                <ScoreBadge $side="L">Fish {score.L}</ScoreBadge>
                <ScoreBadge $side="R">Fish {score.R}</ScoreBadge>

                {/* Fishing lines – only while actually playing and no overlay (rules/results) */}
                {mode === "playing" && match === "live" && !uiOverlayActive && (
                  <svg
                    width="100%"
                    height="100%"
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      zIndex: 2,
                    }}
                  >
                    <line
                      {...lineL}
                      stroke="#0d1b2a"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <line
                      {...lineR}
                      stroke="#0d1b2a"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}

                <FisherWrap $left={fisherLeftL} $me={meSide === "L"}>
                  <Name>
                    {meSide === "L"
                      ? meUser?.username || "You"
                      : oppUser?.username || "—"}
                  </Name>
                  <FisherSprite />
                </FisherWrap>
                <FisherWrap $left={fisherLeftR} $me={meSide === "R"}>
                  <Name>
                    {meSide === "R"
                      ? meUser?.username || "You"
                      : oppUser?.username || "—"}
                  </Name>
                  <FisherSprite />
                </FisherWrap>

                <FishWrap $x={fishLDraw.x} $y={fishLDraw.y}>
                  <FishCanvas dir={fishLDraw.dir} />
                </FishWrap>
                <Splash $x={fishLDraw.x} $y={fishLDraw.y} />
                <FishWrap $x={fishRDraw.x} $y={fishRDraw.y}>
                  <FishCanvas dir={fishRDraw.dir} />
                </FishWrap>
                <Splash $x={fishRDraw.x} $y={fishRDraw.y} />

                {/* Arrow prompt – only while live and no big overlay */}
                {mode === "playing" &&
                  match === "live" &&
                  need &&
                  !uiOverlayActive && (
                    <QTEPane $side={meSide}>
                      <Key>{need.replace("Arrow", "")}</Key>
                    </QTEPane>
                  )}

                {/* Fish piles – hidden while rules/results overlay is active */}
                {!uiOverlayActive && (
                  <>
                    <PileWrap $side="L" $offset={pileOffsetL}>
                      {pileLayout(score.L).map((p, i) => (
                        <PileFish key={i} $x={p.x} $y={p.y} $r={p.r}>
                          <FishCanvas dir={1} />
                        </PileFish>
                      ))}
                    </PileWrap>

                    <PileWrap $side="R" $offset={pileOffsetR}>
                      {pileLayout(score.R).map((p, i) => (
                        <PileFish key={i} $x={p.x} $y={p.y} $r={-p.r}>
                          <FishCanvas dir={-1} />
                        </PileFish>
                      ))}
                    </PileWrap>
                  </>
                )}

                {/* Countdown – only when a match is starting, not on the lobby screen */}
                {mode === "playing" &&
                  match === "countdown" &&
                  !uiOverlayActive && <CountOverlay>{countdown}</CountOverlay>}

                {/* Mobile thumb pad (only when match is live) */}
                {match === "live" && (
                  <MobilePad
                    onTouchMove={(e) => e.preventDefault()}
                    onWheel={(e) => e.preventDefault()}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {/* Up */}
                    <DirBtn
                      aria-label="Up"
                      style={{
                        left: "50%",
                        top: "8px",
                        transform: "translateX(-50%)",
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        sendTap("up");
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 22 22"
                        aria-hidden="true"
                        style={{ pointerEvents: "none" }}
                      >
                        <path d="M11 5 L18 15 H4 Z" fill="#fff" />
                      </svg>
                    </DirBtn>

                    {/* Left */}
                    <DirBtn
                      aria-label="Left"
                      style={{
                        left: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        sendTap("left");
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 22 22"
                        aria-hidden="true"
                        style={{ pointerEvents: "none" }}
                      >
                        <path d="M6 11 L16 4 V18 Z" fill="#fff" />
                      </svg>
                    </DirBtn>

                    {/* Right */}
                    <DirBtn
                      aria-label="Right"
                      style={{
                        right: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        sendTap("right");
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 22 22"
                        aria-hidden="true"
                        style={{ pointerEvents: "none" }}
                      >
                        <path d="M16 11 L6 4 V18 Z" fill="#fff" />
                      </svg>
                    </DirBtn>

                    {/* Down */}
                    <DirBtn
                      aria-label="Down"
                      style={{
                        left: "50%",
                        bottom: "8px",
                        transform: "translateX(-50%)",
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        sendTap("down");
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 22 22"
                        aria-hidden="true"
                        style={{ pointerEvents: "none" }}
                      >
                        <path d="M11 17 L18 7 H4 Z" fill="#fff" />
                      </svg>
                    </DirBtn>
                  </MobilePad>
                )}

                <DockBody />
                <MobilePlayOverlay>
                  {(mode === "idle" || mode === "queued") && (
                    <MobilePlayCard>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>Fishing</div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(230,233,255,0.75)",
                          marginBottom: 6,
                        }}
                      >
                        {message}
                      </div>

                      <Button
                        onClick={startBot}
                        $disabled={mode === "queued"}
                        style={{ padding: "10px 12px" }}
                      >
                        Practice vs Bot
                      </Button>

                      <Button
                        $primary
                        onClick={mode === "queued" ? cancelQueue : queueOnline}
                        style={{ padding: "10px 12px" }}
                      >
                        {mode === "queued" ? "Cancel Queue" : "Play Online"}
                      </Button>
                    </MobilePlayCard>
                  )}
                </MobilePlayOverlay>

                  {mode === "playing" &&
                    match === "countdown" &&
                    !uiOverlayActive && (
                      <CountOverlay>{countdown}</CountOverlay>
                    )}
                </Stage>

                {/* Under-board HUD (scaled together with the stage on desktop) */}
                <div
                  style={{
                    marginTop: 10,
                    width: "100%",
                    maxWidth: 900,
                    marginInline: "auto",
                  }}
                >
                  <HUDLine>
                    <b>{instruction}</b>
                    <Bar>
                      <Fill
                        $pct={
                          (progress / (size?.chunks || 10)) * 100
                        }
                      />
                    </Bar>
                  </HUDLine>
                </div>
              </div>
            </StageShell>
          </BoardViewport>

          {/* Mobile controls stack */}
          <MobileStack>
            <div style={{ display: "grid", gap: 10 }}>
              <Button onClick={resign} $disabled={resigning}>
                {mode === "queued"
                  ? "Cancel Queue"
                  : resigning
                  ? "Resigning…"
                  : "Resign"}
              </Button>

              <GameRules
                title="How to Play Fishing Duel"
                subtitle="Catch more fish than your opponent."
                sections={FISHING_RULE_SECTIONS}
                buttonText="📘 Rules"
                buttonTitle="Fishing Rules"
                buttonStyle={{
                  position: "static",
                  width: "100%",
                  boxShadow: "none",
                  borderRadius: 10,
                  padding: "6px 10px",
                  background: "rgba(255,255,255,0.06)",
                }}
              />

              <ReturnButton
                onClick={() => (typeof onExit === "function" ? onExit() : null)}
                title="Return to Games"
              >
                <span className="icon">←</span>
                <span>Return to Games</span>
              </ReturnButton>
            </div>
          </MobileStack>
        </BoardPanel>

        {/* RIGHT: sticky controls rail (desktop) */}
        <RightRailShell>
          <RightRailTopBar>
            <ReturnButton
              onClick={() => (typeof onExit === "function" ? onExit() : null)}
              title="Return to Games"
            >
              <span className="icon">←</span>
              <span>Return to Games</span>
            </ReturnButton>
          </RightRailTopBar>

          <ControlsPanel>
            {/* Primary actions */}
            <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
              <Button
                onClick={startBot}
                $disabled={mode === "queued" || mode === "playing"}
                style={{ padding: "10px 12px" }}
              >
                Practice vs Bot
              </Button>
              <Button
                $primary
                onClick={queueOnline}
                $disabled={mode === "queued" || mode === "playing"}
                style={{ padding: "10px 12px" }}
              >
                {mode === "queued" ? "Queueing…" : "Play Online"}
              </Button>
              <Button
                onClick={resign}
                $disabled={resigning}
                style={{ padding: "10px 12px" }}
              >
                {mode === "queued"
                  ? "Cancel Queue"
                  : resigning
                  ? "Resigning…"
                  : "Resign"}
              </Button>
            </div>

            {/* Status + badges */}
            <div
              style={{
                marginTop: 16,
                fontSize: 13,
                color: "rgba(230,233,255,0.75)",
              }}
            >
              {message}
            </div>

            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <Badge>
                {mode === "playing"
                  ? ranked
                    ? "Ranked"
                    : "Practice"
                  : mode === "queued"
                  ? "Queued"
                  : "Practice"}
              </Badge>
              <Badge>Fish: {size.name}</Badge>
              <Badge>Score: {myScore}</Badge>
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: "rgba(230,233,255,0.65)",
              }}
            >
              Wins vs real players grant <b>+6 trophies</b>. Bot games are
              unranked.
            </div>

            {/* Game summary card */}
            <div
              style={{
                marginTop: 12,
                border: "1px solid var(--border-color)",
                borderRadius: 10,
                background: "rgba(255,255,255,0.06)",
                padding: "8px 10px",
                display: "grid",
                gap: 6,
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 800 }}>Game</div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Opponent</span>
                <span style={{ fontWeight: 700 }}>
                  {mode === "playing"
                    ? ranked
                      ? oppUser?.username || "Opponent"
                      : "Bot"
                    : "—"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Time</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmtTime(timeLeft)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Score</span>
                <span style={{ fontWeight: 700 }}>
                  {score.L} – {score.R}
                </span>
              </div>
            </div>

            {/* Rules in rail */}
            <div style={{ marginTop: 12 }}>
              <GameRules
                title="How to Play Fishing Duel"
                subtitle="Quick overview of reeling battles."
                sections={[
                  {
                    heading: "Goal",
                    text: "Reel in more fish than your opponent before the timer runs out.",
                  },
                  {
                    heading: "Controls",
                    list: [
                      "Watch for the arrow prompt in the water.",
                      "Press the same arrow on your keyboard (or tap it on mobile).",
                      "Correct inputs increase your reel progress, wrong ones decrease it.",
                    ],
                  },
                  {
                    heading: "Scoring",
                    list: [
                      "Each fish is split into chunks along the line.",
                      "Reaching the end scores a point and spawns a new fish.",
                      "Highest total when time expires wins the match.",
                    ],
                    note: "Tip: Try to get into a rhythm instead of mashing keys at random.",
                  },
                ]}
                buttonText="📘 Rules"
                buttonTitle="Fishing Rules"
                buttonStyle={{
                  position: "static",
                  width: "100%",
                  boxShadow: "none",
                  borderRadius: 10,
                  padding: "6px 10px",
                  background: "rgba(255,255,255,0.06)",
                }}
              />
            </div>
          </ControlsPanel>
        </RightRailShell>
      </Wrap>

      {/* Sidebar drawer on phones */}
      {drawerOpen && <DrawerBackdrop onClick={() => setDrawerOpen(false)} />}

      <Drawer $open={drawerOpen} aria-label="Fishing sidebar">
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

        <GameSidebar gameKey="fishing" title="Fishing" showOnMobile />
      </Drawer>

      {/* Result modal (unchanged, just below layout) */}
      {resultModal &&
        createPortal(
          <ResultOverlay onClick={() => setResultModal(null)}>
            <ResultModal onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                {resultModal.didWin ? "You win! 🎉" : "You lose"}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(230,233,255,0.65)",
                }}
              >
                {resultModal.resultText}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  marginTop: 10,
                  padding: "8px 10px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 10,
                }}
              >
                <span style={{ fontWeight: 800 }}>🏆 {resultModal.trophies}</span>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    background: "var(--primary-orange)",
                    color: "#000",
                  }}
                >
                  {resultModal.rank || " "}
                </span>
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: "rgba(230,233,255,0.65)",
                }}
              >
                Overall leaderboard place: <b>#{resultModal.place ?? "—"}</b>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <Button
                  onClick={() => {
                    setResultModal(null);
                    setMode("idle");
                    setMessage("Pick a mode to start.");
                    setResigning(false);
                    resigningRef.current = false;
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    setResultModal(null);
                    setResigning(false);
                    resigningRef.current = false;
                    startBot();
                  }}
                >
                  Practice Again
                </Button>
                <Button
                  $primary
                  onClick={() => {
                    setResultModal(null);
                    setResigning(false);
                    resigningRef.current = false;
                    queueOnline();
                  }}
                >
                  Matchmake Online
                </Button>
              </div>
            </ResultModal>
          </ResultOverlay>,
          document.body
        )}
    </>
  );
}
