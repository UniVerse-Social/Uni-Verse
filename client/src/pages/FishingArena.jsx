// client/src/pages/FishingArena.jsx
import React, { useEffect, useRef, useState, useContext } from 'react';
import styled from 'styled-components';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

/* --- Layout constants --- */
const STAGE_H = 420;
const DOCK_H  = 34;     // dock height (pixels)

/* Fisher metrics (for rod tip math) */
const FISHER_W = 60;
const FISHER_H = 110;
/* Slightly lower so boots touch the dock */
const FISHER_BOTTOM = DOCK_H - 6;

/* Rod rect inside the SVG sprite (see <FisherSprite/>) */
const ROD_TOP_INSET     = 8;            // y of rod tip within SVG
const ROD_X_LEFT_INSET  = 6 + 1.5;      // center of 3px rod on left sprite
const ROD_X_RIGHT_INSET = 44 + 1.5;     // center of 3px rod on right sprite
/* The SVG sprite is 50px wide but our container is 60px, add centering offset: */
const SPRITE_CENTER_OFFSET = (FISHER_W - 50) / 2; // 5px

/* Server/game world width used to compute "original" fisher positions */
const GAME_W = 600;

/* Given fish box (top-left of a 72x32 fish), return mouth point (for <line/>) */
const fishMouth = (f) => ({ x2: f.x + 36 + (f.dir > 0 ? 22 : -22), y2: f.y + 16 });

/* Compute absolute rod tip for a fisher whose LEFT is known */
const rodTipFromLeft = (fisherLeft) => {
  const fisherTop = STAGE_H - FISHER_BOTTOM - FISHER_H;
  return {
    x: fisherLeft + SPRITE_CENTER_OFFSET + ROD_X_LEFT_INSET,  // when sprite is "left" oriented
    y: fisherTop + ROD_TOP_INSET,
  };
};
/* And for a right-facing sprite (same container left, but rod is at the right side of SVG) */
const rodTipFromRight = (fisherLeft) => {
  const fisherTop = STAGE_H - FISHER_BOTTOM - FISHER_H;
  return {
    x: fisherLeft + SPRITE_CENTER_OFFSET + ROD_X_RIGHT_INSET,
    y: fisherTop + ROD_TOP_INSET,
  };
};

const Wrap = styled.div`display:grid; grid-template-rows:auto 1fr auto; gap:10px; height:100%;`;
const Controls = styled.div`display:flex; gap:8px; flex-wrap:wrap; align-items:center;`;
const Button = styled.button`
  padding:8px 12px; border-radius:12px; border:1px solid #111; cursor:pointer;
  background:${p=>p.$primary?'#111':'#fff'}; color:${p=>p.$primary?'#fff':'#111'}; font-weight:800;
`;
const Badge = styled.span`display:inline-block; border:1px solid var(--border-color); padding:2px 8px; border-radius:999px; background:#fff; font-weight:800; font-size:12px;`;

const Stage = styled.div`
  position:relative; height:${STAGE_H}px; border:1px solid var(--border-color);
  border-radius:14px; overflow:hidden; background:#88c7de;
`;
const CenterLine = styled.div`
  position:absolute; top:0; bottom:${DOCK_H}px; left:50%; width:2px; background:#0002; z-index:1;
`;

/* Water above the dock; dock hugs bottom */
const Water = styled.div`
  position:absolute; left:0; right:0; top:0; bottom:${DOCK_H}px;
  background:linear-gradient(180deg, #7cc0da 0%, #2b6f90 55%, #0d4a6a 100%);
`;
const DockBody = styled.div`
  position:absolute; left:0; right:0; bottom:0; height:${DOCK_H}px;
  background:repeating-linear-gradient(90deg,#9c6a3b 0 54px,#8b5a2b 54px 56px);
  box-shadow: inset 0 2px 0 rgba(255,255,255,.35), inset 0 -2px 0 rgba(0,0,0,.25);
`;

/* Fisherman anchored by absolute left (we compute it per half) */
const FisherWrap = styled.div`
  position:absolute; bottom:${FISHER_BOTTOM}px; width:${FISHER_W}px; height:${FISHER_H}px; display:grid; place-items:center;
  left:${p=>p.$left}px;
  filter:${p=>p.$me?'drop-shadow(0 0 0.35rem #3b82f6)':'none'};
`;
const Name = styled.div`position:absolute; top:-22px; left:50%; transform:translateX(-50%); font-weight:900; font-size:13px; color:#111; text-shadow:0 1px 0 #fff;`;

/* SVG fisherman sprite (L or R just flips rod side) */
function FisherSprite({ side='L' }) {
  return (
    <svg width="50" height="110" viewBox="0 0 50 110">
      <rect x={side==='L'?6:44} y="8" width="3" height="90" rx="1.5" fill="#1f2937"/>
      <rect x="13" y="6" width="24" height="10" rx="3" fill="#047857" />
      <circle cx="25" cy="22" r="9" fill="#fde68a" stroke="#a16207" />
      <rect x="16" y="34" width="18" height="28" rx="7" fill="#3b82f6" />
      <rect x="16" y="54" width="18" height="4" fill="#111827" />
      <rect x="16" y="60" width="7" height="26" rx="3" fill="#1f2937" />
      <rect x="27" y="60" width="7" height="26" rx="3" fill="#1f2937" />
      <rect x="14" y="86" width="11" height="7" rx="2" fill="#6b7280" />
      <rect x="25" y="86" width="11" height="7" rx="2" fill="#6b7280" />
    </svg>
  );
}

/* Fish sprite (SVG) */
function FishSVG({ dir=1 }) {
  return (
    <svg width="72" height="32" viewBox="0 0 72 32" style={{ transform:`scaleX(${dir})` }}>
      <ellipse cx="36" cy="16" rx="20" ry="12" fill="#0ea5a9" stroke="#065f46" strokeWidth="3"/>
      <path d="M6 16 L18 10 L18 22 Z" fill="#0ea5a9" stroke="#065f46" strokeWidth="3"/>
      <path d="M30 6 L34 2 L38 6 Z" fill="#0ea5a9" stroke="#065f46" strokeWidth="3"/>
      <circle cx="48" cy="14" r="3" fill="#f9fafb" stroke="#111" />
    </svg>
  );
}
const FishWrap = styled.div`
  position:absolute; top:${p=>p.$y}px; left:${p=>p.$x}px; width:72px; height:32px; pointer-events:none;
`;
const Splash = styled.div`
  position:absolute; pointer-events:none; left:${p=>p.$x+30}px; top:${p=>p.$y-8}px;
  width:14px; height:14px; border-radius:50%; border:2px solid rgba(255,255,255,.65);
  animation: splash .8s ease-out infinite;
  @keyframes splash { 0%{transform:scale(.4); opacity:.9} 100%{transform:scale(1.8); opacity:0} }
`;

const HUDLine = styled.div`display:flex; gap:10px; align-items:center;`;
const Bar = styled.div`height:10px; background:#e5e7eb; border-radius:999px; overflow:hidden; flex:1;`;
const Fill = styled.div`height:100%; background:#111; width:${p=>p.$pct}%; transition:width .12s ease;`;

/* Show one key at a time, centered in the user's half */
const QTEPane = styled.div`
  position:absolute; top:14%; left:${p=>p.$side==='L'?'25%':'75%'}; transform:translateX(-50%);
  display:flex; justify-content:center; gap:8px; z-index:3;
  background:rgba(255,255,255,.92); border:1px solid var(--border-color); border-radius:12px; padding:10px 12px;
`;
const Key = styled.div`
  min-width:48px; padding:8px 12px; border-radius:10px; border:1px solid var(--border-color);
  background:#fff; text-align:center; font-weight:800;
`;
const Overlay = styled.div`position:absolute; inset:0; display:grid; place-items:center; background:rgba(255,255,255,.35); z-index:2;`;

const SIZES = [
  { name:'Big', trophy:6,  struggle:6,  chunks:8 },
  { name:'Huge', trophy:7, struggle:8,  chunks:9 },
  { name:'Massive', trophy:8, struggle:10, chunks:10 },
  { name:'Ginormous', trophy:9, struggle:12, chunks:11 },
];

export default function FishingArena({ onResult }) {
  const { user } = useContext(AuthContext);
  const sockRef = useRef(null);
  const stageRef = useRef(null);
  const [stageW, setStageW] = useState(600);

  const [roomId, setRoom] = useState(null);
  const [mode, setMode] = useState('idle');        // idle | bot | online | playing
  const [ranked, setRanked] = useState(false);
  const [meSide, setMeSide] = useState('L');
  const [meUser, setMeUser] = useState(null);
  const [oppUser, setOppUser] = useState(null);

  // fish positions from server
  const [fishL, setFishL] = useState({ x:30,  y:180, dir:1 });
  const [fishR, setFishR] = useState({ x:498, y:180, dir:-1 });
  const [size, setSize] = useState(SIZES[0]);
  const [phase, setPhase] = useState('waiting');          // waiting | struggle | reel | over
  const [progress, setProgress] = useState(0);            // my progress
  const [qte, setQte] = useState([]); const [qIdx, setQIdx] = useState(0);
  const [message, setMessage] = useState('Pick a mode to start.');
  const [holding, setHolding] = useState(null);

  // track stage width to place things in the center of each half
  useEffect(() => {
    const measure = () => setStageW(stageRef.current?.getBoundingClientRect().width || 600);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const s = io(API_BASE_URL);
    sockRef.current = s;

    s.on('fishing:queued', ()=> setMessage('Looking for opponent…'));
    s.on('fishing:start', ({ roomId, you, opp, side, state, ranked }) => {
      setRoom(roomId); setMode('playing'); setRanked(!!ranked);
      setMeSide(side); setMeUser(you); setOppUser(opp);
      setSize(SIZES[state.sizeIdx]); setPhase(state.phase);
      setFishL(state.fishL); setFishR(state.fishR);
      setProgress(side==='L' ? state.progress.L : state.progress.R);
      if (side==='L'){ setQte(state.qteL||[]); setQIdx(state.qIdxL||0); }
      else           { setQte(state.qteR||[]); setQIdx(state.qIdxR||0); }
      setMessage(`${SIZES[state.sizeIdx].name} fish hooked! Hold opposite arrow.`);
    });
    s.on('fishing:state', (st) => {
      setPhase(st.phase);
      setFishL(st.fishL); setFishR(st.fishR);
      setProgress(meSide==='L' ? st.progress.L : st.progress.R);
      if (meSide==='L'){ setQte(st.qteL||[]); setQIdx(st.qIdxL||0); }
      else             { setQte(st.qteR||[]); setQIdx(st.qIdxR||0); }
    });
    s.on('fishing:gameover', ({ winnerUserId, sizeIdx, ranked }) => {
      const win = String(winnerUserId) === String(user._id);
      if (win && ranked && onResult) onResult('fishing', SIZES[sizeIdx].trophy, true);
      setMessage(win ? `You caught it! ${ranked?`+${SIZES[sizeIdx].trophy} 🏆`:''}` : 'Lost this one!');
      setPhase('over'); setMode('idle'); setRoom(null);
    });

    return () => { try { s.emit('fishing:leave', { roomId }); s.disconnect(); } catch {} };
  // eslint-disable-next-line
  }, [user._id, meSide]);

  const queueOnline = () => { setMode('online'); setMessage('Queueing…'); sockRef.current?.emit('fishing:queue', { userId: user._id, username: user.username }); };
  const startBot   = () => { setMode('bot');    setMessage('Starting practice vs bot…'); sockRef.current?.emit('fishing:practice', { userId: user._id, username: user.username }); };
  const resign     = () => { if (roomId) sockRef.current?.emit('fishing:leave', { roomId }); setMode('idle'); setRoom(null); setMessage('Pick a mode to start.'); };

  // input
  useEffect(() => {
    const s = sockRef.current;
    const down = (e) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        setHolding(e.key);
        if (roomId) {
          s?.emit('fishing:input', { roomId, type:'down', key:e.key });
          if (phase === 'reel' && qte[qIdx] === e.key) { s?.emit('fishing:input', { roomId, type:'tap', key:e.key }); setQIdx(qIdx + 1); }
          else if (phase === 'reel') { s?.emit('fishing:input', { roomId, type:'tap-wrong', key:e.key }); }
        }
      }
    };
    const up = (e) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        if (holding === e.key) setHolding(null);
        if (roomId) s?.emit('fishing:input', { roomId, type:'up', key:e.key });
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [roomId, holding, phase, qte, qIdx]);

  /* ---------- Centering logic & line endpoints ---------- */
  // Center of each half (left/right)
  const leftHalfCenterX  = stageW * 0.25;
  const rightHalfCenterX = stageW * 0.75;

  // Place fishermen centered in each half
  const fisherLeftL = Math.max(0, Math.min(leftHalfCenterX - FISHER_W/2, stageW/2 - FISHER_W));
  const fisherLeftR = Math.max(stageW/2, Math.min(rightHalfCenterX - FISHER_W/2, stageW - FISHER_W));

  // How much our layout shifted compared to the original edge-anchored layout (in GAME_W space)
  const origLeftFisherLeft  = 34;
  const origRightFisherLeft = GAME_W - 34 - FISHER_W;
  const dxL = fisherLeftL - origLeftFisherLeft;
  const dxR = fisherLeftR - origRightFisherLeft;

  // Use shifted fish positions so they remain centered with their fisher (but keep server movement)
  const fishLDraw = { ...fishL, x: fishL.x + dxL };
  const fishRDraw = { ...fishR, x: fishR.x + dxR };

  // Rod tips (left sprite uses left-rod x; right sprite uses right-rod x)
  const rodTipL = rodTipFromLeft(fisherLeftL);
  const rodTipR = rodTipFromRight(fisherLeftR);

  // Lines in CSS pixels: rod tip -> fish mouth
  const lineL = { x1: rodTipL.x, y1: rodTipL.y, ...fishMouth(fishLDraw) };
  const lineR = { x1: rodTipR.x, y1: rodTipR.y, ...fishMouth(fishRDraw) };

  const instruction = phase === 'struggle' ? 'Hold opposite arrow!' : phase === 'reel' ? 'Reel!' : message;

  return (
    <Wrap>
      <Controls>
        <Button onClick={startBot}>Practice vs Bot</Button>
        <Button $primary onClick={queueOnline}>Play Online</Button>
        <Button onClick={resign}>Resign</Button>
        <Badge>{mode==='playing' ? (ranked?'Ranked':'Practice') : 'Practice'}</Badge>
        <Badge>Fish: {size.name}</Badge>
      </Controls>

      <Stage ref={stageRef}>
        <CenterLine />
        <Water />

        {/* rod lines (CSS pixel coordinates) */}
        <svg width="100%" height="100%" style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:2 }}>
          <line {...lineL} stroke="#111" strokeWidth="2" strokeLinecap="round" />
          <line {...lineR} stroke="#111" strokeWidth="2" strokeLinecap="round" />
        </svg>

        {/* fishermen centered in halves */}
        <FisherWrap $left={fisherLeftL} $me={meSide==='L'}>
          <Name>{meSide==='L' ? (meUser?.username || 'You') : (oppUser?.username || '—')}</Name>
          <FisherSprite side="L" />
        </FisherWrap>
        <FisherWrap $left={fisherLeftR} $me={meSide==='R'}>
          <Name>{meSide==='R' ? (meUser?.username || 'You') : (oppUser?.username || '—')}</Name>
          <FisherSprite side="R" />
        </FisherWrap>

        {/* fish centered with their fisher (server movement preserved by dx shift) */}
        <FishWrap $x={fishLDraw.x} $y={fishLDraw.y}><FishSVG dir={fishLDraw.dir} /></FishWrap>{phase==='struggle' && <Splash $x={fishLDraw.x} $y={fishLDraw.y} />}
        <FishWrap $x={fishRDraw.x} $y={fishRDraw.y}><FishSVG dir={fishRDraw.dir} /></FishWrap>{phase==='struggle' && <Splash $x={fishRDraw.x} $y={fishRDraw.y} />}

        {/* QTE: show ONLY the current key, centered in your half */}
        {phase === 'reel' && qte[qIdx] && (
          <QTEPane $side={meSide}>
            <Key>{qte[qIdx].replace('Arrow','')}</Key>
          </QTEPane>
        )}

        <DockBody />
        {(mode!=='playing' && !roomId) && <Overlay><div style={{fontWeight:900}}>{message}</div></Overlay>}
      </Stage>

      <HUDLine>
        <b>{instruction}</b>
        <Bar><Fill $pct={(progress / (size?.chunks||10))*100} /></Bar>
      </HUDLine>
    </Wrap>
  );
}
