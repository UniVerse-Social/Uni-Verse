// client/src/pages/FishingArena.jsx
import React, { useEffect, useRef, useState, useContext } from "react";
import styled from "styled-components";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../config";
import { AuthContext } from "../App";

/* ---------------- Layout constants ---------------- */
const STAGE_H = 420;
const DOCK_H = 34;

const FISHER_W = 60;
const FISHER_H = 110;
const FISHER_BOTTOM = DOCK_H - 6;

const ROD_TOP_INSET = 8;
const ROD_X_LEFT_INSET = 6 + 1.5;
const ROD_X_RIGHT_INSET = 44 + 1.5;
const SPRITE_CENTER_OFFSET = (FISHER_W - 50) / 2;

const GAME_W = 600;

const fishMouth = (f) => ({ x2: f.x + 36 + (f.dir > 0 ? 22 : -22), y2: f.y + 16 });

const rodTipFromLeft = (fisherLeft) => {
  const fisherTop = STAGE_H - FISHER_BOTTOM - FISHER_H;
  return {
    x: fisherLeft + SPRITE_CENTER_OFFSET + ROD_X_LEFT_INSET,
    y: fisherTop + ROD_TOP_INSET,
  };
};
const rodTipFromRight = (fisherLeft) => {
  const fisherTop = STAGE_H - FISHER_BOTTOM - FISHER_H;
  return {
    x: fisherLeft + SPRITE_CENTER_OFFSET + ROD_X_RIGHT_INSET,
    y: fisherTop + ROD_TOP_INSET,
  };
};

/* ---------------- Styled layout ---------------- */
const Wrap = styled.div`
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 10px;
  height: 100%;
`;
const Controls = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
`;
const Button = styled.button`
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid #111;
  cursor: pointer;
  background: ${(p) => (p.$primary ? "#111" : "#fff")};
  color: ${(p) => (p.$primary ? "#fff" : "#111")};
  font-weight: 800;
`;
const Badge = styled.span`
  display: inline-block;
  border: 1px solid var(--border-color);
  padding: 2px 8px;
  border-radius: 999px;
  background: #fff;
  font-weight: 800;
  font-size: 12px;
`;

const Stage = styled.div`
  position: relative;
  height: ${STAGE_H}px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  overflow: hidden;
  background: linear-gradient(#9ed0f1, #6bb3da); /* base water; waves animate above */
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

/* Animated tiny ∩ waves live on this canvas */
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

/* Dock */
const DockBody = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: ${DOCK_H}px;
  background: #a87944;
  image-rendering: pixelated;
  /* pixel planks + nails */
  background-image:
    linear-gradient(#b98953, #a87944),
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

/* Fisher anchors */
const FisherWrap = styled.div`
  position: absolute;
  bottom: ${FISHER_BOTTOM}px;
  width: ${FISHER_W}px;
  height: ${FISHER_H}px;
  display: grid;
  place-items: center;
  left: ${(p) => p.$left}px;
  filter: ${(p) => (p.$me ? "drop-shadow(0 0 0.35rem #3b82f6)" : "none")};
`;
const Name = styled.div`
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-weight: 900;
  font-size: 13px;
  color: #111;
  text-shadow: 0 1px 0 #fff;
`;

/* Fish position boxes */
const FishWrap = styled.div`
  position: absolute;
  top: ${(p) => p.$y}px;
  left: ${(p) => p.$x}px;
  width: 72px;
  height: 32px;
  pointer-events: none;
`;

/* Reel splashes */
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
`;
const Bar = styled.div`
  height: 10px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
  flex: 1;
`;
const Fill = styled.div`
  height: 100%;
  background: #111;
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
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px 12px;
`;
const Key = styled.div`
  min-width: 48px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: #fff;
  text-align: center;
  font-weight: 800;
`;
const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.35);
  z-index: 2;
`;

/* Fish sizes */
const SIZES = [
  { name: "Big", trophy: 6, struggle: 6, chunks: 8 },
  { name: "Huge", trophy: 7, struggle: 8, chunks: 9 },
  { name: "Massive", trophy: 8, struggle: 10, chunks: 10 },
  { name: "Ginormous", trophy: 9, struggle: 12, chunks: 11 },
];

/* ---------------- 8-bit sprites ---------------- */

/** Draw an 8-bit fisherman into a 50x110 canvas.
 * The rod tip math assumes: top rod tip y=8, and x at 6 (left) / 44 (right) inside this 50px sprite. */
function drawFisherman(ctx, side = "L") {
  ctx.clearRect(0, 0, 50, 110);
  const p = 2; // pixel size
  const put = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * p), Math.round(y * p), Math.round(w * p), Math.round(h * p));
  };

  // Palette
  const SKIN = "#f1c27d";
  const SHADOW = "#d19a66";
  const HAT_D = "#1e5631";
  const HAT_L = "#2a6b3c";
  const SHIRT = "#1c4d9e";
  const VEST = "#c49a6c";
  const VEST_SH = "#a77f54";
  const PANTS = "#6b7f39";
  const BOOTS = "#1b1b1b";
  const EYE = "#111";
  const WHITE = "#fff";

  // --- Hat (cap + brim)
  put(6, 2, 19, 5, HAT_D);
  put(7, 3, 17, 3, HAT_L);
  put(4, 6, 23, 2, HAT_D); // brim

  // --- Face
  put(9, 8, 14, 9, SKIN);
  put(9, 15, 14, 2, SHADOW); // jaw shadow
  put(11, 11, 2, 2, EYE);
  put(19, 11, 2, 2, EYE);

  // beard shade
  put(11, 16, 10, 2, SHADOW);

  // --- Neck
  put(13, 18, 6, 2, SKIN);

  // --- Vest over shirt (torso 14x14)
  put(7, 20, 22, 14, SHIRT);
  put(8, 21, 20, 12, VEST);
  put(8, 26, 20, 2, VEST_SH);

  // pockets
  put(10, 23, 4, 3, VEST_SH);
  put(22, 23, 4, 3, VEST_SH);

  // --- Belt
  put(7, 34, 22, 2, "#111");

  // --- Legs
  put(9, 36, 7, 12, PANTS);
  put(20, 36, 7, 12, PANTS);

  // --- Boots
  put(8, 48, 9, 4, BOOTS);
  put(19, 48, 9, 4, BOOTS);

  // tiny highlight edges (just a couple pixels)
  put(8, 21, 1, 1, WHITE);
  put(26, 21, 1, 1, WHITE);

  // (No rod rendered here — the rod line is drawn globally from the tip to fish)
}

/** 8-bit fish (72x32) with simple shading */
function drawFish(ctx, dir = 1) {
  ctx.clearRect(0, 0, 72, 32);
  const p = 2; // pixel grid
  const put = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x * p), Math.round(y * p), Math.round(w * p), Math.round(h * p));
  };
  const BODY = "#89d3ec";
  const EDGE = "#337b9c";
  const LIGHT = "#bff0ff";

  // body block
  put(6, 6, 24, 10, BODY);
  // rounded edges
  put(5, 7, 1, 8, EDGE);
  put(30, 7, 1, 8, EDGE);
  put(6, 5, 24, 1, EDGE);
  put(6, 16, 24, 1, EDGE);

  // head bump
  put(28, 8, 6, 6, BODY);
  put(27, 9, 1, 4, EDGE);
  put(34, 9, 1, 4, EDGE);

  // tail
  put(0, 9, 6, 4, BODY);
  put(0, 10, 1, 2, EDGE);
  put(5, 10, 1, 2, EDGE);

  // highlight line
  put(8, 8, 10, 1, LIGHT);
  // eye
  put(32, 11, 1, 1, "#111");

  if (dir < 0) {
    const img = ctx.getImageData(0, 0, 72, 32);
    // simple horizontal flip using an offscreen canvas
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

/* Canvas wrappers for sprites */
function FisherSprite({ side = "L" }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = ref.current.getContext("2d");
    drawFisherman(ctx, side);
  }, [side]);
  return <canvas width={50} height={110} ref={ref} style={{ imageRendering: "pixelated" }} />;
}
function FishCanvas({ dir = 1 }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = ref.current.getContext("2d");
    drawFish(ctx, dir);
  }, [dir]);
  return <canvas width={72} height={32} ref={ref} style={{ imageRendering: "pixelated" }} />;
}

/* ---------------- Animated wavelet canvas ---------------- */
function WavesCanvas({ stageW }) {
  const ref = useRef(null);
  const animRef = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const W = canvas.width = Math.max(1, Math.floor(stageW));
    const H = canvas.height = STAGE_H - DOCK_H;

    const N = Math.floor((W * H) / 12000) + 60; // density scales with size
    const waves = Array.from({ length: N }).map(() => ({
      x: Math.random() * W,
      y: Math.random() * (H - 26) + 12,
      amp: 2 + Math.random() * 2.5,      // 2..4.5 px swing
      speed: 0.6 + Math.random() * 0.8,  // oscillation speed
      w: 7 + (Math.random() * 3 | 0),    // width of the 'cap'
      c: Math.random() < 0.5 ? "#2a6ca0" : "#1f557f",
      phase: Math.random() * Math.PI * 2,
    }));

    const draw = (t) => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      for (const wv of waves) {
        const dx = Math.sin(t * 0.001 * wv.speed + wv.phase) * wv.amp;
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

/* ---------------- Component ---------------- */
export default function FishingArena({ onResult }) {
  const { user } = useContext(AuthContext);
  const sockRef = useRef(null);
  const stageRef = useRef(null);
  const [stageW, setStageW] = useState(600);

  const [roomId, setRoom] = useState(null);
  const [mode, setMode] = useState("idle"); // idle | bot | online | playing
  const [ranked, setRanked] = useState(false);
  const [meSide, setMeSide] = useState("L");
  const [meUser, setMeUser] = useState(null);
  const [oppUser, setOppUser] = useState(null);

  const [fishL, setFishL] = useState({ x: 30, y: 180, dir: 1 });
  const [fishR, setFishR] = useState({ x: 498, y: 180, dir: -1 });
  const [size, setSize] = useState(SIZES[0]);
  const [phase, setPhase] = useState("waiting");
  const [progress, setProgress] = useState(0);
  const [qte, setQte] = useState([]);
  const [qIdx, setQIdx] = useState(0);
  const [message, setMessage] = useState("Pick a mode to start.");
  const [holding, setHolding] = useState(null);

  useEffect(() => {
    const measure = () =>
      setStageW(stageRef.current?.getBoundingClientRect().width || 600);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const s = io(API_BASE_URL);
    sockRef.current = s;

    s.on("fishing:queued", () => setMessage("Looking for opponent…"));
    s.on("fishing:start", ({ roomId, you, opp, side, state, ranked }) => {
      setRoom(roomId);
      setMode("playing");
      setRanked(!!ranked);
      setMeSide(side);
      setMeUser(you);
      setOppUser(opp);
      setSize(SIZES[state.sizeIdx]);
      setPhase(state.phase);
      setFishL(state.fishL);
      setFishR(state.fishR);
      setProgress(side === "L" ? state.progress.L : state.progress.R);
      if (side === "L") {
        setQte(state.qteL || []);
        setQIdx(state.qIdxL || 0);
      } else {
        setQte(state.qteR || []);
        setQIdx(state.qIdxR || 0);
      }
      setMessage(`${SIZES[state.sizeIdx].name} fish hooked! Hold opposite arrow.`);
    });
    s.on("fishing:state", (st) => {
      setPhase(st.phase);
      setFishL(st.fishL);
      setFishR(st.fishR);
      setProgress(meSide === "L" ? st.progress.L : st.progress.R);
      if (meSide === "L") {
        setQte(st.qteL || []);
        setQIdx(st.qIdxL || 0);
      } else {
        setQte(st.qteR || []);
        setQIdx(st.qIdxR || 0);
      }
    });
    s.on("fishing:gameover", ({ winnerUserId, sizeIdx, ranked }) => {
      const win = String(winnerUserId) === String(user._id);
      if (win && ranked && onResult) onResult("fishing", SIZES[sizeIdx].trophy, true);
      setMessage(win ? `You caught it! ${ranked ? `+${SIZES[sizeIdx].trophy} 🏆` : ""}` : "Lost this one!");
      setPhase("over");
      setMode("idle");
      setRoom(null);
    });

    return () => {
      try {
        s.emit("fishing:leave", { roomId });
        s.disconnect();
      } catch {}
      // eslint-disable-next-line
    };
  }, [user._id, meSide]);

  const queueOnline = () => {
    setMode("online");
    setMessage("Queueing…");
    sockRef.current?.emit("fishing:queue", {
      userId: user._id,
      username: user.username,
    });
  };
  const startBot = () => {
    setMode("bot");
    setMessage("Starting practice vs bot…");
    sockRef.current?.emit("fishing:practice", {
      userId: user._id,
      username: user.username,
    });
  };
  const resign = () => {
    if (roomId) sockRef.current?.emit("fishing:leave", { roomId });
    setMode("idle");
    setRoom(null);
    setMessage("Pick a mode to start.");
  };

  // input
  useEffect(() => {
    const s = sockRef.current;
    const down = (e) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        setHolding(e.key);
        if (roomId) {
          s?.emit("fishing:input", { roomId, type: "down", key: e.key });
          if (phase === "reel" && qte[qIdx] === e.key) {
            s?.emit("fishing:input", { roomId, type: "tap", key: e.key });
            setQIdx(qIdx + 1);
          } else if (phase === "reel") {
            s?.emit("fishing:input", { roomId, type: "tap-wrong", key: e.key });
          }
        }
      }
    };
    const up = (e) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        if (holding === e.key) setHolding(null);
        if (roomId) s?.emit("fishing:input", { roomId, type: "up", key: e.key });
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [roomId, holding, phase, qte, qIdx]);

  /* ---------- Centering logic & line endpoints ---------- */
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
    phase === "struggle" ? "Hold opposite arrow!" : phase === "reel" ? "Reel!" : message;

  return (
    <Wrap>
      <Controls>
        <Button onClick={startBot}>Practice vs Bot</Button>
        <Button $primary onClick={queueOnline}>
          Play Online
        </Button>
        <Button onClick={resign}>Resign</Button>
        <Badge>{mode === "playing" ? (ranked ? "Ranked" : "Practice") : "Practice"}</Badge>
        <Badge>Fish: {size.name}</Badge>
      </Controls>

      <Stage ref={stageRef}>
        <CenterLine />
        {/* scattered animated wavelets */}
        <WavesCanvas stageW={stageW} />

        {/* rod lines */}
        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
        >
          <line {...lineL} stroke="#0d1b2a" strokeWidth="2" strokeLinecap="round" />
          <line {...lineR} stroke="#0d1b2a" strokeWidth="2" strokeLinecap="round" />
        </svg>

        {/* fishermen */}
        <FisherWrap $left={fisherLeftL} $me={meSide === "L"}>
          <Name>{meSide === "L" ? meUser?.username || "You" : oppUser?.username || "—"}</Name>
          <FisherSprite side="L" />
        </FisherWrap>
        <FisherWrap $left={fisherLeftR} $me={meSide === "R"}>
          <Name>{meSide === "R" ? meUser?.username || "You" : oppUser?.username || "—"}</Name>
          <FisherSprite side="R" />
        </FisherWrap>

        {/* fish */}
        <FishWrap $x={fishLDraw.x} $y={fishLDraw.y}>
          <FishCanvas dir={fishLDraw.dir} />
        </FishWrap>
        {phase === "struggle" && <Splash $x={fishLDraw.x} $y={fishLDraw.y} />}

        <FishWrap $x={fishRDraw.x} $y={fishRDraw.y}>
          <FishCanvas dir={fishRDraw.dir} />
        </FishWrap>
        {phase === "struggle" && <Splash $x={fishRDraw.x} $y={fishRDraw.y} />}

        {/* QTE */}
        {phase === "reel" && qte[qIdx] && (
          <QTEPane $side={meSide}>
            <Key>{qte[qIdx].replace("Arrow", "")}</Key>
          </QTEPane>
        )}

        <DockBody />
        {mode !== "playing" && !roomId && (
          <Overlay>
            <div style={{ fontWeight: 900 }}>{message}</div>
          </Overlay>
        )}
      </Stage>

      <HUDLine>
        <b>{instruction}</b>
        <Bar>
          <Fill $pct={(progress / (size?.chunks || 10)) * 100} />
        </Bar>
      </HUDLine>
    </Wrap>
  );
}
