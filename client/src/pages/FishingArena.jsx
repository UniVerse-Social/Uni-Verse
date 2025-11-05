// client/src/pages/FishingArena.jsx

import React, { useEffect, useRef, useState, useContext, useCallback } from "react";
import styled from "styled-components";
import { createPortal } from "react-dom";
import { io } from "socket.io-client";
import axios from "axios";
import { API_BASE_URL } from "../config";
import { AuthContext } from "../App";

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

const fishMouth = (f) => ({ x2: f.x + 36 + (f.dir > 0 ? 22 : -22), y2: f.y + 16 });
const rodTipFromLeft  = (left) => ({ x: left + SPRITE_CENTER_OFFSET + ROD_X_LEFT_INSET,  y: STAGE_H - FISHER_BOTTOM - FISHER_H + ROD_TOP_INSET });
const rodTipFromRight = (left) => ({ x: left + SPRITE_CENTER_OFFSET + ROD_X_RIGHT_INSET, y: STAGE_H - FISHER_BOTTOM - FISHER_H + ROD_TOP_INSET });

/* ---------- Styled ---------- */
const Wrap = styled.div`display:grid;grid-template-rows:auto 1fr auto;gap:10px;height:100%;`;
const Controls = styled.div`display:flex;gap:8px;flex-wrap:wrap;align-items:center;`;
const Button = styled.button`
  padding:8px 12px;border-radius:12px;border:1px solid #111;cursor:pointer;
  background:${p=>p.$primary?"#111":"#fff"};color:${p=>p.$primary?"#fff":"#111"};font-weight:800;
  opacity:${p=>p.$disabled?0.6:1};pointer-events:${p=>p.$disabled?"none":"auto"};`;
const Badge = styled.span`display:inline-block;border:1px solid var(--border-color);padding:2px 8px;border-radius:999px;background:#fff;font-weight:800;font-size:12px;`;

const Stage = styled.div`
  position:relative;height:${STAGE_H}px;border:1px solid var(--border-color);
  border-radius:14px;overflow:hidden;background:linear-gradient(#9ed0f1,#6bb3da);`;
const CenterLine = styled.div`position:absolute;top:0;bottom:${DOCK_H}px;left:50%;width:2px;background:#0002;z-index:1;`;
const WavesCanvasEl = styled.canvas`position:absolute;left:0;right:0;top:0;bottom:${DOCK_H}px;width:100%;height:${STAGE_H-DOCK_H}px;z-index:0;pointer-events:none;`;

const DockBody = styled.div`
  position:absolute;left:0;right:0;bottom:0;height:${DOCK_H}px;background:#a87944;image-rendering:pixelated;
  background-image:linear-gradient(#b98953,#a87944),
    repeating-linear-gradient(90deg,rgba(0,0,0,.15) 0 1px,transparent 1px 15px,rgba(0,0,0,.15) 15px 16px,transparent 16px 30px),
    radial-gradient(rgba(0,0,0,.2) 25%,transparent 26%),radial-gradient(rgba(0,0,0,.2) 25%,transparent 26%);
  background-size:100% 100%,100% 100%,10px 10px,10px 10px;background-position:0 0,0 0,3px 3px,13px 8px;`;

const FisherWrap = styled.div`position:absolute;bottom:${FISHER_BOTTOM}px;width:${FISHER_W}px;height:${FISHER_H}px;display:grid;place-items:center;left:${p=>p.$left}px;filter:${p=>p.$me?"drop-shadow(0 0 .35rem #3b82f6)":"none"};`;
const Name = styled.div`position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-weight:900;font-size:13px;color:#111;text-shadow:0 1px 0 #fff;`;

const FishWrap = styled.div`position:absolute;top:${p=>p.$y}px;left:${p=>p.$x}px;width:72px;height:32px;pointer-events:none;`;
const Splash = styled.div`
  position:absolute;pointer-events:none;left:${p=>p.$x+30}px;top:${p=>p.$y-8}px;width:14px;height:14px;border-radius:50%;
  border:2px solid rgba(255,255,255,.65);animation:splash .8s ease-out infinite;
  @keyframes splash {0%{transform:scale(.4);opacity:.9}100%{transform:scale(1.8);opacity:0}}
`;

const HUDLine = styled.div`display:flex;gap:10px;align-items:center;`;
const Bar = styled.div`height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;flex:1;`;
const Fill = styled.div`height:100%;background:#111;width:${p=>p.$pct}%;transition:width .12s ease;`;

const QTEPane = styled.div`
  position:absolute;top:14%;left:${p=>p.$side==="L"?"25%":"75%"};transform:translateX(-50%);
  display:flex;justify-content:center;gap:8px;z-index:3;background:rgba(255,255,255,.92);
  border:1px solid var(--border-color);border-radius:12px;padding:10px 12px;`;
const Key = styled.div`min-width:48px;padding:8px 12px;border-radius:10px;border:1px solid var(--border-color);background:#fff;text-align:center;font-weight:800;`;

const Overlay = styled.div`position:absolute;inset:0;display:grid;place-items:center;background:rgba(255,255,255,.35);z-index:2;`;
const CountOverlay = styled(Overlay)`background:rgba(255,255,255,.45);font-weight:900;font-size:72px;color:#111;`;

const ResultOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;                 /* iOS Safari dynamic viewport */
  background: rgba(0,0,0,.32);
  display: flex; align-items: center; justify-content: center;
  z-index: 2147483647;            /* sit above anything */
  isolation: isolate;             /* own stacking context */
  pointer-events: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const ResultModal = styled.div`
  width: 540px; max-width: 94vw;
  max-height: min(92dvh, 560px);
  overflow: auto;
  background: #fff; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.18);
  border: 1px solid #e5e7eb; padding: 16px;
`;

// Same thresholds used elsewhere for the badge
const perGameRank = (n) => {
  if (n >= 1500) return 'Champion';
  if (n >= 900)  return 'Diamond';
  if (n >= 600)  return 'Platinum';
  if (n >= 400)  return 'Gold';
  if (n >= 250)  return 'Silver';
  if (n >= 100)  return 'Bronze';
  return 'Wood';
};

// Trophies (Fishing only) + overall place for the modal
const fetchMyFishingTrophies = async (userId) => {
  try {
    const { data } = await axios.get(`${API_BASE_URL}/api/games/stats/${userId}`);
    return (data?.trophiesByGame?.fishing) || 0;
  } catch { return 0; }
};
const fetchMyOverallPlace = async (userId) => {
  try {
    const q = new URLSearchParams({ limit: '100', userId });
    const { data } = await axios.get(`${API_BASE_URL}/api/games/leaderboard/overall?${q.toString()}`);
    return data?.me?.rank ?? null;
  } catch { return null; }
};

const TimerBadge = styled.div`position:absolute;top:6px;left:50%;transform:translateX(-50%);z-index:3;background:#fff;border:1px solid var(--border-color);border-radius:999px;padding:4px 10px;font-weight:900;font-size:14px;`;
const ScoreBadge = styled.div`position:absolute;top:6px;${p=>p.$side==="L"?"left:8px;":"right:8px;"}z-index:3;background:#fff;border:1px solid var(--border-color);border-radius:10px;padding:4px 8px;font-weight:900;font-size:12px;`;

const PileWrap = styled.div`position:absolute;bottom:${DOCK_H}px;${p=>p.$side==="L"?"left":"right"}:${p=>p.$offset}px;width:120px;height:120px;pointer-events:none;z-index:1;`;
const PileFish = styled.div`position:absolute;transform:${p=>`translate(${p.$x}px, ${p.$y}px) rotate(${p.$r}deg) scale(.74)`};transform-origin:center;opacity:.98;`;

/* ---------- Client sizes ---------- */
const SIZES = [
  { name: "Big", trophy: 6, chunks: 8 },
  { name: "Huge", trophy: 7, chunks: 9 },
  { name: "Massive", trophy: 8, chunks: 10 },
  { name: "Ginormous", trophy: 9, chunks: 11 },
];

/* ---------- Pixel sprites ---------- */
function drawFisherman(ctx) {
  ctx.clearRect(0, 0, 50, 110);
  const p = 2;
  const put = (x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x*p),Math.round(y*p),Math.round(w*p),Math.round(h*p));};
  const SKIN="#f1c27d", SHADOW="#d19a66", HAT_D="#1e5631", HAT_L="#2a6b3c", SHIRT="#1c4d9e", VEST="#c49a6c", VEST_SH="#a77f54", PANTS="#6b7f39", BOOTS="#1b1b1b", EYE="#111", WHITE="#fff";
  put(6,2,19,5,HAT_D); put(7,3,17,3,HAT_L); put(4,6,23,2,HAT_D);
  put(9,8,14,9,SKIN); put(9,15,14,2,SHADOW); put(11,11,2,2,EYE); put(19,11,2,2,EYE); put(11,16,10,2,SHADOW);
  put(13,18,6,2,SKIN);
  put(7,20,22,14,SHIRT); put(8,21,20,12,VEST); put(8,26,20,2,VEST_SH); put(10,23,4,3,VEST_SH); put(22,23,4,3,VEST_SH);
  put(7,34,22,2,"#111");
  put(9,36,7,12,PANTS); put(20,36,7,12,PANTS);
  put(8,48,9,4,BOOTS); put(19,48,9,4,BOOTS);
  put(8,21,1,1,WHITE); put(26,21,1,1,WHITE);
}
function drawFish(ctx, dir = 1) {
  ctx.clearRect(0, 0, 72, 32);
  const p=2; const put=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x*p),Math.round(y*p),Math.round(w*p),Math.round(h*p));};
  const BODY="#89d3ec", EDGE="#337b9c", LIGHT="#bff0ff";
  put(6,6,24,10,BODY); put(5,7,1,8,EDGE); put(30,7,1,8,EDGE); put(6,5,24,1,EDGE); put(6,16,24,1,EDGE);
  put(28,8,6,6,BODY); put(27,9,1,4,EDGE); put(34,9,1,4,EDGE); put(0,9,6,4,BODY); put(0,10,1,2,EDGE); put(5,10,1,2,EDGE);
  put(8,8,10,1,LIGHT); put(32,11,1,1,"#111");
  if (dir < 0) { const img=ctx.getImageData(0,0,72,32); const off=document.createElement("canvas"); off.width=72; off.height=32; const octx=off.getContext("2d"); octx.putImageData(img,0,0); ctx.clearRect(0,0,72,32); ctx.save(); ctx.scale(-1,1); ctx.drawImage(off,-72,0); ctx.restore(); }
}
function FisherSprite() {
  const ref = useRef(null);
  useEffect(()=>{ drawFisherman(ref.current.getContext("2d")); },[]);
  return <canvas width={50} height={110} ref={ref} style={{ imageRendering: "pixelated" }} />;
}
function FishCanvas({ dir=1 }) {
  const ref = useRef(null);
  useEffect(()=>{ drawFish(ref.current.getContext("2d"), dir); },[dir]);
  return <canvas width={72} height={32} ref={ref} style={{ imageRendering: "pixelated" }} />;
}

/* ---------- Waves ---------- */
function WavesCanvas({ stageW }) {
  const ref = useRef(null); const animRef = useRef(0);
  useEffect(() => {
    const canvas=ref.current, ctx=canvas.getContext("2d");
    const W=(canvas.width=Math.max(1,Math.floor(stageW))); const H=(canvas.height=STAGE_H-DOCK_H);
    const N=Math.floor((W*H)/12000)+60;
    const waves=Array.from({length:N}).map(()=>({x:Math.random()*W,y:Math.random()*(H-26)+12,amp:2+Math.random()*2.5,speed:.6+Math.random()*.8,w:7+((Math.random()*3)|0),c:Math.random()<.5?"#2a6ca0":"#1f557f",phase:Math.random()*Math.PI*2}));
    const draw=(t)=>{ ctx.clearRect(0,0,W,H); ctx.lineWidth=1; ctx.lineCap="round";
      for(const wv of waves){ const dx=Math.sin(t*.001*wv.speed+wv.phase)*wv.amp; const x=Math.round(wv.x+dx)+.5; const y=Math.round(wv.y)+.5; const half=Math.floor(wv.w/2);
        ctx.strokeStyle=wv.c; ctx.beginPath(); ctx.moveTo(x-half,y+1); ctx.lineTo(x-Math.ceil(half/2),y); ctx.lineTo(x+Math.ceil(half/2),y); ctx.lineTo(x+half,y+1); ctx.stroke(); }
      animRef.current=requestAnimationFrame(draw); };
    animRef.current=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(animRef.current);
  },[stageW]);
  return <WavesCanvasEl ref={ref} />;
}

/* ---------- Pile layout ---------- */
function pileLayout(n) {
  const out=[]; let row=0; let remaining=n; const perRowMax=5;
  while(remaining>0 && row<6){ const perRow=Math.min(perRowMax-(row%2),remaining); const baseY=4+row*18; const startX=6+(perRowMax-perRow)*8;
    for(let i=0;i<perRow;i++){ out.push({x:startX+i*18+((Math.random()*2)|0), y:84-baseY, r:(Math.random()*8-4).toFixed(1)}); }
    remaining-=perRow; row++;
  }
  return out;
}

/* ---------- Component ---------- */
export default function FishingArena({ onResult }) {
  const { user } = useContext(AuthContext);
  const sockRef = useRef(null);
  const roomRef = useRef(null);
  const stageRef = useRef(null);

  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const sideRef = useRef("L"); // authoritative side for socket handlers

  const [stageW, setStageW] = useState(600);
  const [roomId, setRoom] = useState(null);
  const [mode, setMode] = useState("idle");      // idle | queued | playing
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

  // trophies: ALWAYS ±6 for ranked
  const awardedRef = useRef(false);
  const awardFishing = useCallback(async (kind) => {
    if (!user?._id || awardedRef.current) return;
    const delta = kind === 'win' ? 6 : -6;
    try {
      await axios.post(`${API_BASE_URL}/api/games/result`, {
        userId: user._id, gameKey: 'fishing', delta, didWin: kind === 'win'
      });
      awardedRef.current = true;
      try { window.dispatchEvent(new CustomEvent('games:statsUpdated', { detail: { gameKey: 'fishing' } })); } catch {}
    } catch {}
  }, [user?._id]);
  const awardRef = useRef(awardFishing);
  useEffect(() => { awardRef.current = awardFishing; }, [awardFishing]);

  // stage size (single listener)
  useEffect(() => {
    const measure = () => setStageW(stageRef.current?.getBoundingClientRect().width || 600);
    measure(); window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const isPhone = typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches;
    if (resultModal && isPhone) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [resultModal]);

  useEffect(() => {
    // Derive a stable WS base (strip trailing slashes and optional /api)
    const envBase = (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE)
      ? String(process.env.REACT_APP_API_BASE)
      : "";
    let WS_BASE =
      (API_BASE_URL && API_BASE_URL.trim()) ||
      (envBase && envBase.trim()) ||
      "";

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

    // Prefer SAME tunnel host if the page is on Cloudflare (avoids cross-host WS issues)
    try {
      const po = new URL(window.location.origin);
      const wb = new URL(WS_BASE);
      if (/trycloudflare\.com$/i.test(po.hostname) && po.hostname !== wb.hostname) {
        WS_BASE = po.origin;
      }
    } catch {}

    const s = io(WS_BASE, {
      path: '/api/socket.io',                 // mount under /api (rides existing ingress)
      transports: ['polling', 'websocket'],   // start with polling, upgrade to WS when allowed
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

    s.on("connect", () => { setMessage("Connected. Pick a mode to start."); });
    s.on("connect_error", (e) => { setMessage(`Socket connect error: ${e?.message || e}`); });
    s.on("error", (e) => { setMessage(`Socket error: ${e?.message || e}`); });

    s.on("fishing:queued", () => {
      resigningRef.current = false; setResigning(false); setResultModal(null);
      setMode("queued"); setMessage("Looking for opponent…");
    });
    s.on("fishing:queueLeft", () => {
      resigningRef.current = false; setResigning(false); setResultModal(null);
      setMode("idle"); setMessage("Pick a mode to start.");
    });

    s.on("fishing:start", ({ roomId, you, opp, side, state, ranked }) => {
      roomRef.current = roomId;
      awardedRef.current = false;
      resigningRef.current = false; setResigning(false); setResultModal(null);

      sideRef.current = side;
      setMeSide(side);

      setRoom(roomId); setMode("playing"); setRanked(!!ranked);
      setMeUser(you); setOppUser(opp);

      if (state && state.roomId === roomId) {
        setMatch(state.match || "countdown");
        setCountdown(state.countdown ?? 3);
        setTimeLeft(state.timeLeft ?? 60);
        setScore(state.score || { L: 0, R: 0 });
        setFishL(state.fishL); setFishR(state.fishR);
        setSizeIdxL(state.sizeIdxL ?? 0); setSizeIdxR(state.sizeIdxR ?? 0);
        setProgress(side === "L" ? state.progress.L : state.progress.R);
        setNeed(side === "L" ? state.needL : state.needR);
      }
      setMessage("Get ready…");

      s.emit("fishing:ready", { roomId });
    });

    s.on("fishing:state", (st) => {
      if (st.roomId && st.roomId !== roomRef.current) return; // ignore stale
      const mySide = sideRef.current;
      setMatch(st.match || "live");
      setCountdown(st.countdown ?? 0);
      setTimeLeft(st.timeLeft ?? 60);
      setScore(st.score || { L: 0, R: 0 });
      setFishL(st.fishL); setFishR(st.fishR);
      setSizeIdxL(st.sizeIdxL ?? 0); setSizeIdxR(st.sizeIdxR ?? 0);
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

  s.on("fishing:gameover", async ({ roomId: rid, winnerUserId, ranked, score: finalScore }) => {
    if (rid && rid !== roomRef.current) return;
    const didWin = String(winnerUserId) === String(user._id);

    if (ranked && !awardedRef.current) {
      await awardRef.current(didWin ? "win" : "loss");
      if (onResultRef.current) onResultRef.current("fishing", didWin ? 6 : -6, didWin);
    }

    const resultText = didWin
      ? `You win! ${finalScore?.L ?? 0}-${finalScore?.R ?? 0}`
      : `You lose! ${finalScore?.L ?? 0}-${finalScore?.R ?? 0}`;

    const trophies = user?._id ? await fetchMyFishingTrophies(user._id) : 0;
    const rank = perGameRank(trophies);
    const place = user?._id ? await fetchMyOverallPlace(user._id) : null;

    setMessage(resultText);
    setResultModal({ didWin, resultText, trophies, rank, place });

    roomRef.current = null; setMode("idle"); setRoom(null); setMatch("over");
  });

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
    const onStart = () => { satisfied = true; };

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

  const queueOnline = () => {
    if (mode === "queued" || mode === "playing") return;
    setMessage("Queueing…");
    sockRef.current?.emit("fishing:queue", { userId: user._id, username: user.username });
  };

  const cancelQueue = () => {
    if (mode !== "queued") return;
    sockRef.current?.emit("fishing:leaveQueue");
  };

  const startBot = () => {
    if (mode === "queued" || mode === "playing") return;
    setMessage("Starting practice vs bot…");
    sockRef.current?.emit("fishing:practice", { userId: user._id, username: user.username });
  };

  const resign = async () => {
    // Mobile multi-tap guard
    if (resigningRef.current) return;
    resigningRef.current = true;
    setResigning(true);

    if (mode === "queued") {
      cancelQueue();
      setResigning(false); resigningRef.current = false;
      return;
    }

    if (!roomRef.current) {
      setMode("idle"); setRoom(null); setMessage("Pick a mode to start.");
      setResigning(false); resigningRef.current = false;
      return;
    }

    const rid = roomRef.current;
    sockRef.current?.emit("fishing:leave", { roomId: rid });

    // Immediate feedback so users stop tapping
    setResultModal({ didWin: false, resultText: "You resigned.", trophies: null, rank: null, place: null });

    // Award exactly once
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
        setResultModal(prev => prev && { ...prev, trophies, rank, place });
      }
    } finally {
      roomRef.current = null; setMode("idle"); setRoom(null); setMessage("Pick a mode to start.");
      // keep lock until modal is dismissed (see buttons below)
    }
  };

  const MobilePad = styled.div`
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: ${DOCK_H + 10}px;            /* snugs into the white band above the dock */
    width: 112px;                         /* compact, fits the red outline */
    height: 112px;
    border-radius: 14px;
    border: 1px solid rgba(0,0,0,.15);
    background: rgba(255,255,255,.26);
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 10px rgba(0,0,0,.2);
    touch-action: none;                   /* block page scroll while pressing */
    -webkit-tap-highlight-color: transparent;

    @media (hover: hover) and (pointer: fine) {
      display: none;                      /* hide on desktop */
    }
  `;

  const DirBtn = styled.button`
    position: absolute;                   /* let us place the 4 arrows in a diamond */
    width: 36px; height: 36px;
    display: grid; place-items: center;
    border: 1px solid rgba(0,0,0,.28);
    border-radius: 10px;
    background: rgba(17,17,17,.22);
    color: #fff;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.35);
    cursor: pointer;
    user-select: none; -webkit-user-select: none;
    touch-action: none;

    &:active { transform: scale(.98); }
  `;

  // Mobile -> same logic as keyboard: right direction = +1 chunk, wrong = -1 chunk.
  const sendTap = useCallback((dir) => {
    const key =
      dir === "up" ? "ArrowUp" :
      dir === "down" ? "ArrowDown" :
      dir === "left" ? "ArrowLeft" : "ArrowRight";

    if (!roomRef.current || match !== "live") return;
    const s = sockRef.current;
    if (key === need) {
      s?.emit("fishing:input", { roomId: roomRef.current, type: "tap", key });
    } else {
      s?.emit("fishing:input", { roomId: roomRef.current, type: "tap-wrong", key });
    }
  }, [match, need]);

  // Input: prevent page scroll on arrow keys; only send to active room
  useEffect(() => {
    const s = sockRef.current;
    const onKeyDown = (e) => {
      if (!roomRef.current || match !== "live") return;
      if (!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      if (e.key === need) s?.emit("fishing:input", { roomId: roomRef.current, type: "tap", key: e.key });
      else s?.emit("fishing:input", { roomId: roomRef.current, type: "tap-wrong", key: e.key });
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [need, match]);

  /* ---------- Coords & rendering ---------- */
  const leftHalfCenterX = stageW * 0.25;
  const rightHalfCenterX = stageW * 0.75;

  const fisherLeftL = Math.max(0, Math.min(leftHalfCenterX - FISHER_W / 2, stageW / 2 - FISHER_W));
  const fisherLeftR = Math.max(stageW / 2, Math.min(rightHalfCenterX - FISHER_W / 2, stageW - FISHER_W));

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

  const instruction = match === "countdown" ? "Get ready…" : "Reel! Press the arrow shown.";
  const myScore = meSide === "L" ? score.L : score.R;

  const pileOffsetL = Math.max(6, fisherLeftL - 110);
  const pileOffsetR = Math.max(6, stageW - (fisherLeftR + FISHER_W) - 110);

  return (
    <>
      <Wrap>
        <Controls>
          <Button onClick={startBot} $disabled={mode === "queued" || mode === "playing"}>Practice vs Bot</Button>
          <Button $primary onClick={queueOnline} $disabled={mode === "queued" || mode === "playing"}>Play Online</Button>
          <Button onClick={resign} $disabled={resigning}>
            {mode === "queued" ? "Cancel Queue" : (resigning ? "Resigning…" : "Resign")}
          </Button>
          <Badge>{mode === "playing" ? (ranked ? "Ranked" : "Practice") : mode === "queued" ? "Queued" : "Practice"}</Badge>
          <Badge>Fish: {size.name}</Badge>
          <Badge>Score: {myScore}</Badge>
        </Controls>

        <Stage ref={stageRef}>
          <CenterLine />
          <WavesCanvas stageW={stageW} />

          <TimerBadge>{timeLeft.toString().padStart(2, "0")}s</TimerBadge>
          <ScoreBadge $side="L">Fish {score.L}</ScoreBadge>
          <ScoreBadge $side="R">Fish {score.R}</ScoreBadge>

          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
            <line {...lineL} stroke="#0d1b2a" strokeWidth="2" strokeLinecap="round" />
            <line {...lineR} stroke="#0d1b2a" strokeWidth="2" strokeLinecap="round" />
          </svg>

          <FisherWrap $left={fisherLeftL} $me={meSide === "L"}>
            <Name>{meSide === "L" ? meUser?.username || "You" : oppUser?.username || "—"}</Name>
            <FisherSprite />
          </FisherWrap>
          <FisherWrap $left={fisherLeftR} $me={meSide === "R"}>
            <Name>{meSide === "R" ? meUser?.username || "You" : oppUser?.username || "—"}</Name>
            <FisherSprite />
          </FisherWrap>

          <FishWrap $x={fishLDraw.x} $y={fishLDraw.y}><FishCanvas dir={fishLDraw.dir} /></FishWrap>
          <Splash $x={fishLDraw.x} $y={fishLDraw.y} />
          <FishWrap $x={fishRDraw.x} $y={fishRDraw.y}><FishCanvas dir={fishRDraw.dir} /></FishWrap>
          <Splash $x={fishRDraw.x} $y={fishRDraw.y} />

          {match === "live" && need && (
            <QTEPane $side={meSide}>
              <Key>{need.replace("Arrow", "")}</Key>
            </QTEPane>
          )}

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

          {match === "live" && (
            <MobilePad
              onTouchMove={(e)=>e.preventDefault()}
              onWheel={(e)=>e.preventDefault()}
              onContextMenu={(e)=>e.preventDefault()}
            >
              {/* Up */}
              <DirBtn
                aria-label="Up"
                style={{ left: "50%", top: "8px", transform: "translateX(-50%)" }}
                onPointerDown={(e)=>{ e.preventDefault(); sendTap("up"); }}
              >
                <svg width="16" height="16" viewBox="0 0 22 22" aria-hidden="true" style={{ pointerEvents:"none" }}>
                  <path d="M11 5 L18 15 H4 Z" fill="#fff" />
                </svg>
              </DirBtn>

              {/* Left */}
              <DirBtn
                aria-label="Left"
                style={{ left: "8px", top: "50%", transform: "translateY(-50%)" }}
                onPointerDown={(e)=>{ e.preventDefault(); sendTap("left"); }}
              >
                <svg width="16" height="16" viewBox="0 0 22 22" aria-hidden="true" style={{ pointerEvents:"none" }}>
                  <path d="M6 11 L16 4 V18 Z" fill="#fff" />
                </svg>
              </DirBtn>

              {/* Right */}
              <DirBtn
                aria-label="Right"
                style={{ right: "8px", top: "50%", transform: "translateY(-50%)" }}
                onPointerDown={(e)=>{ e.preventDefault(); sendTap("right"); }}
              >
                <svg width="16" height="16" viewBox="0 0 22 22" aria-hidden="true" style={{ pointerEvents:"none" }}>
                  <path d="M16 11 L6 4 V18 Z" fill="#fff" />
                </svg>
              </DirBtn>

              {/* Down */}
              <DirBtn
                aria-label="Down"
                style={{ left: "50%", bottom: "8px", transform: "translateX(-50%)" }}
                onPointerDown={(e)=>{ e.preventDefault(); sendTap("down"); }}
              >
                <svg width="16" height="16" viewBox="0 0 22 22" aria-hidden="true" style={{ pointerEvents:"none" }}>
                  <path d="M11 17 L18 7 H4 Z" fill="#fff" />
                </svg>
              </DirBtn>
            </MobilePad>
          )}

          <DockBody />
          {match === "countdown" && <CountOverlay>{countdown}</CountOverlay>}
          {mode !== "playing" && !roomId && (
            <Overlay><div style={{ fontWeight: 900 }}>{message}</div></Overlay>
          )}
        </Stage>

        <HUDLine>
          <b>{instruction}</b>
          <Bar><Fill $pct={(progress / (size?.chunks || 10)) * 100} /></Bar>
        </HUDLine>
      </Wrap>

      {resultModal && createPortal(
        <ResultOverlay onClick={() => setResultModal(null)}>
          <ResultModal onClick={(e) => e.stopPropagation()}>
            <div style={{fontSize:18, fontWeight:800, marginBottom:6}}>
              {resultModal.didWin ? 'You win! 🎉' : 'You lose'}
            </div>
            <div style={{fontSize:13, color:'#6b7280'}}>{resultModal.resultText}</div>

            <div style={{display:'flex', gap:10, alignItems:'center', marginTop:10, padding:'8px 10px',
                        border:'1px solid #e5e7eb', borderRadius:10}}>
              <span style={{fontWeight:800}}>🏆 {resultModal.trophies}</span>
              <span style={{padding:'3px 10px', borderRadius:999, fontSize:12, fontWeight:800, background:'#111', color:'#fff'}}>
                {resultModal.rank || ' '}
              </span>
            </div>
            <div style={{marginTop:6, fontSize:12, color:'#6b7280'}}>
              Overall leaderboard place: <b>#{resultModal.place ?? '—'}</b>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:12}}>
              <Button onClick={() => { setResultModal(null); setMode("idle"); setMessage("Pick a mode to start."); setResigning(false); resigningRef.current = false; }}>Back</Button>
              <Button onClick={() => { setResultModal(null); setResigning(false); resigningRef.current = false; startBot(); }}>Practice Again</Button>
              <Button $primary onClick={() => { setResultModal(null); setResigning(false); resigningRef.current = false; queueOnline(); }}>Matchmake Online</Button>
            </div>
          </ResultModal>
        </ResultOverlay>,
        document.body
      )}
    </>
  );
}
