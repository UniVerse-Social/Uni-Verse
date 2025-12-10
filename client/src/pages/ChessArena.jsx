import React, { useCallback, useEffect, useRef, useState, useContext, useLayoutEffect } from 'react';
import styled from 'styled-components';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { io } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';
import { createStockfish } from '../engine/sfEngine';
import GameRules from '../components/GameRules';
import GameSidebar from '../components/GameSidebar';

/* === Layout constants (match left GameSidebar width) === */
const SIDE_W = 360;      // matches sidebar
const HEADER_H = 76;     // header height (matches sidebar)
const BOTTOM_GAP = 40;   // breathing room
const MOBILE_NAV_H = 64;
const RAIL_PAD = 12; 

/* Styles */
const Wrap = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(300px, 26vw, ${SIDE_W}px);
  gap: 16px;
  align-items: start;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;

  @media (max-width: 860px) {
    display: block;          /* single-column on phones */
    width: 100%;
    overflow-x: hidden;
  }
`;

const RightRailShell = styled.div`
  position: sticky;
  top: ${HEADER_H}px;
  align-self: start;
  padding: 12px 0 ${RAIL_PAD}px 0;

  /* Keep the entire right rail (top bar + panel + padding) inside the viewport
     below the global header, regardless of screen size */
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - ${HEADER_H}px);
  box-sizing: border-box;

  @media (max-width: 860px) {
    display: none !important; /* hide on phones; we use drawer */
  }
`;

const Panel = styled.div`
  border:1px solid var(--border-color);
  background:var(--container-white);
  color: var(--text-color);
  border-radius:12px;
  box-shadow: 0 12px 28px rgba(0,0,0,.28);
`;
const RightRailTopBar = styled.div`
  z-index: 3; 
  display: flex;
  justify-content: flex-end;     /* button flush right */
  align-items: center;
  padding: 0 8px;
  padding-bottom: 35px;
  height: 10px;
  margin-bottom: 12px;
`;

const ControlsPanel = styled(Panel)`
  grid-column: 2;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;

  /* Let RightRailShell control the total height; this just fills it */
  flex: 1 1 auto;
  min-height: 0;
  align-self: stretch;
  overflow: auto; /* rail can scroll, board never does */
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

  /* Fit viewport; avoid any board scrollbars */
  max-height: calc(100vh - ${HEADER_H}px - ${BOTTOM_GAP}px);
  overflow: hidden;

  @media (max-width: 860px) {
    width: 100%;
    max-width: 100vw;
    margin: 0;
    /* Keep content clear of the bottom navbar + iOS safe area */
    padding: 0 0 calc(${MOBILE_NAV_H}px + env(safe-area-inset-bottom, 0px)) 0;
    /* Also constrain the panel height on phones */
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
  /* Let promotion dialog and tutorial tip use the full board area */
  overflow: visible;
  min-height: 0;
  position: relative;
`;

const Button = styled.button`
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid ${p=>p.$primary ? 'transparent' : 'var(--border-color)'};
  background: ${p=>p.$primary ? 'var(--primary-orange)' : 'rgba(255,255,255,0.06)'};
  color: ${p=>p.$primary ? '#000' : 'var(--text-color)'};
  font-weight: 800;
  transition: background .15s ease, box-shadow .15s ease, color .15s ease, transform .08s ease;
  &:hover{ background: ${p=>p.$primary ? 'linear-gradient(90deg,var(--primary-orange),#59D0FF)' : 'rgba(255,255,255,0.10)'}; transform: translateY(-1px); }
  &:active{ transform: translateY(0); }
`;

const ReturnButton = styled(Button)`
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;   /* <-- center icon + text */
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
  .icon { font-size: 18px; line-height: 1; opacity: .95; }
`;

const Alert = styled.div`
  margin-top: 10px; padding: 8px 10px; border-radius: 10px; font-size: 13px;
  border: 1px solid rgba(239,68,68,.35);
  background: rgba(239,68,68,.12);
  color: #fca5a5;
`;
const Overlay = styled.div`
  position: fixed; inset:0; background: rgba(0,0,0,.28);
  display:flex; align-items:center; justify-content:center; z-index: 30;
`;
const Modal = styled.div`
  width: 540px; max-width: 94vw;
  background: var(--container-white); color: var(--text-color);
  border-radius: 14px; box-shadow: 0 24px 64px rgba(0,0,0,.45);
  border:1px solid var(--border-color); padding:16px;
`;

/* top-left launcher + opponent pill (only on phones) */
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
  background: rgba(255,255,255,0.06);
  font-size: 11px;
`;

const MobileOpponentName = styled.span`
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MobileOpponentClock = styled.span`
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: rgba(230,233,255,0.75);
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
  @media (min-width: 861px) { display: none; }
`;
const DesktopBotControls = styled.div`
  display: none;
  width: 100%;
  margin-top: 12px;

  @media (min-width: 861px) {
    display: grid;
    gap: 8px;
    max-width: 340px;
  }
`;

/* Left-side drawer for the sidebar on phones */
const Drawer = styled.aside`
  position: fixed;
  top: ${HEADER_H}px;
  left: 0;
  bottom: 0;
  width: min(92vw, 360px);
  background: var(--container-white);
  border-right: 1px solid var(--border-color);
  box-shadow: 12px 0 28px rgba(0,0,0,.28);
  transform: translateX(${p => (p.$open ? '0' : '-100%')});
  transition: transform .22s ease;
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

const ModalGrid = styled.div`display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-top:10px;`;

/* Mobile stack below the board */
const MobileStack = styled.div`
  display: none;
  @media (max-width: 860px) {
    display: grid;
    gap: 10px;
    margin-top: 8px;
    width: 100%;
  }
`;

/* Buttons overlayed on the board when no game is active */
const BoardOverlayCTA = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;              /* <— ensure CTA appears above the board */
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  @media (min-width: 861px) { display: none; }
  > div {
    pointer-events: auto;
    display: grid; gap: 10px;
    background: rgba(0,0,0,.28);
    backdrop-filter: blur(6px);
    padding: 14px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,.12);
  }
`;

const MobileStatsRow = styled.div`
  @media (max-width: 860px) {
    width: 100%;                           
    border: 1px solid var(--border-color);
    border-radius: 10px;
    background: rgba(255,255,255,0.06);
  }
  @media (min-width: 861px) { display: none; }
`;

const BOT_PRESETS = {
  // Tutorial now also plays via Stockfish (like Elite/GM) but with
  // softer parameters and more variety. Explanations still come from SF.
  tutorial: {
    label: 'Tutorial',
    status: 'Tutorial bot: explains moves clearly.',
    useSF: true,
    sf: { movetime: 450, multipv: 4 }, // more lines so teaching has options
    safetyCp: 80,        // will happily play slightly worse moves
    inaccuracyCp: 140,   // up to ~1.4 pawns worse than best allowed
    randomness: 0.4,     // picks among several decent / okay moves
    thinkMs: 200,
    explain: true,
  },

  // Easy: SF-backed, but with big allowed eval drops and high randomness.
  easy: {
    label: 'Easy (~800)',
    status: 'Beginner bot: blunders often and misses tactics.',
    useSF: true,
    sf: { movetime: 350, multipv: 6 }, // more candidate moves to choose bad ones from
    safetyCp: 160,
    inaccuracyCp: 260,   // can play quite bad moves sometimes
    randomness: 0.85,    // very swingy / random within that bad pool
    thinkMs: 220,
    explain: false,
  },

  // Medium: still clearly weaker than Elite, but closer to a club player.
  medium: {
    label: 'Medium (~1200)',
    status: 'Club player bot: plays decent moves but still slips.',
    useSF: true,
    sf: { movetime: 500, multipv: 5 },
    safetyCp: 90,
    inaccuracyCp: 150,
    randomness: 0.55,
    thinkMs: 240,
    explain: false,
  },

  // Hard: strong club level, mostly solid, occasional inaccuracies.
  hard: {
    label: 'Hard (~1600)',
    status: 'Strong club bot: mostly solid, occasional inaccuracies.',
    useSF: true,
    sf: { movetime: 650, multipv: 4 },
    safetyCp: 45,
    inaccuracyCp: 80,
    randomness: 0.25,
    thinkMs: 260,
    explain: false,
  },

  // Elite & GM

  elite: {
    label: 'Elite (2000)',
    status: 'Fast engine bot around 2000 level.',
    useSF: true,
    sf: { movetime: 600, multipv: 2 },
    safetyCp: 8,
    inaccuracyCp: 15,
    randomness: 0, // tiny bit of variation via pool logic in fastBestMove
    thinkMs: 240,
  },

  gm: {
    label: 'Grandmaster (2200+)',
    status: 'Fast engine bot ~2200+ with best-move behavior.',
    useSF: true,
    sf: { movetime: 900, multipv: 2 },
    safetyCp: 0,
    inaccuracyCp: 0,
    randomness: 0, // always pure best move from the pool
    thinkMs: 260,
  },
};

// Build a tutorial profile that scales strength based on an Elo slider.
// 100  ≈ very weak / beginner
// 1000 ≈ casual club player
// 2000 ≈ strong trainer
function buildTutorialProfileFromElo(rawElo = 1000) {
  // Clamp to the supported range
  const elo = Math.max(100, Math.min(2000, rawElo));

  // Normalized 0..1 for interpolation
  const t = (elo - 100) / (2000 - 100);

  // JS search parameters — scaled with elo
  // More time & depth at higher ratings, less randomness and fewer blunders.
  const timeMs       = 220 + t * 580;                 // ~220ms → ~800ms
  const maxDepth     = 2 + Math.round(t * 3);         // 2 → 5 plies
  const randomness   = 0.9 - t * 0.6;                 // 0.9 → 0.3
  const safeDropCp   = 260 - t * 210;                 // 260 → 50 (max eval drop vs best)
  const inaccuracyCp = 280 - t * 210;                 // 280 → 70 (allowable inaccuracy)
  const blunder      = Math.max(0, 0.25 - t * 0.22);  // 25% → ~3% deliberate blunder

  // Simple text description buckets
  let bandLabel;
  if (elo < 500) bandLabel = 'beginner';
  else if (elo < 900) bandLabel = 'improving';
  else if (elo < 1400) bandLabel = 'intermediate';
  else if (elo < 1800) bandLabel = 'advanced';
  else bandLabel = 'strong';

  return {
    label: `Tutorial (~${elo})`,
    status: `Tutorial bot (~${elo} Elo): ${bandLabel} level, explains moves clearly.`,
    // Use the lightweight JS engine (searchBestMove) instead of SF for move choice.
    useSF: false,
    timeMs,
    maxDepth,
    randomness,
    pruneAggressive: t > 0.6, // slightly sharper pruning at higher levels
    safeDropCp,
    inaccuracyCp,
    blunder,
    explain: true,            // keep all the tutorial explanations enabled
  };
}

/* Rank helper used for modal badge (mirror Games page thresholds) */
const perGameRank = (n) => {
  if (n >= 1500) return 'Champion';
  if (n >= 900)  return 'Diamond';
  if (n >= 600)  return 'Platinum';
  if (n >= 400)  return 'Gold';
  if (n >= 250)  return 'Silver';
  if (n >= 100)  return 'Bronze';
  return 'Wood';
};

/* Lightweight JS engine (for Easy/Medium/Hard) */
const VAL = { p:100, n:320, b:330, r:500, q:900, k:0 };
const PST = {
  p: [ 0,5,5,0,5,10,50,0,  0,10,-5,0,5,10,50,0,  0,10,-10,20,25,30,50,0,  0,-20,0,25,30,35,50,0,  5,5,10,20,25,30,50,0,  5,10,10,-20,0,20,50,0,  5,5,0,-25,-20,0,50,0,  0,0,0,0,0,0,0,0 ],
  n: [ -50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50 ],
  b: [ -20,-10,-10,-10,-10,-10,-10,-20,-10,5,0,0,0,0,5,-10,-10,10,10,10,10,10,10,-10,-10,0,10,10,10,10,0,-10,-10,5,5,10,10,5,5,-10,-10,0,0,10,10,0,0,-10,-10,0,0,0,0,0,0,-10,-20,-10,-10,-10,-10,-10,-10,-20 ],
  r: [ 0,0,5,10,10,5,0,0,0,0,5,10,10,5,0,0,0,0,5,10,10,5,0,0,5,5,10,15,15,10,5,5,5,5,10,15,15,10,5,5,0,0,5,10,10,5,0,0,0,0,5,10,10,5,0,0,0,0,5,10,10,5,0,0 ],
  q: [ -20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20 ],
  k: [ 20,30,10,0,0,10,30,20,20,20,0,0,0,0,20,20,-10,-20,-20,-20,-20,-20,-20,-10,-20,-30,-30,-40,-40,-30,-30,-20,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30 ],
};
const idx = (r,c)=> r*8+c;
const flipIdx = (i)=> 63 - i;

function evaluate(chess) {
  const board = chess.board();
  let score = 0, whiteBishops = 0, blackBishops = 0;
  let mobilityMe = 0, mobilityThem = 0;
  for (let r=0; r<8; r++) {
    for (let c=0; c<8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const t = sq.type, clr = sq.color;
      const base = VAL[t];
      const table = PST[t] || [];
      let tableIdx = idx(7-r, c);
      if (clr === 'b') tableIdx = flipIdx(tableIdx);
      const pst = table[tableIdx] || 0;
      const s = base + pst;
      score += (clr === chess.turn() ? s : -s);
      if (t==='b') (clr==='w' ? whiteBishops++ : blackBishops++);
    }
  }
  if (whiteBishops >= 2) score += 35;
  if (blackBishops >= 2) score -= 35;

  try {
    mobilityMe = chess.moves().length;
    chess.swap_color?.();
    mobilityThem = chess.moves().length;
    chess.swap_color?.();
    score += 1.5 * (mobilityMe - mobilityThem);
  } catch {}

  const fen = chess.fen();
  const [placement] = fen.split(' ');
  const wk = placement.indexOf('K'), bk = placement.indexOf('k');
  const centerFiles = [3,4], centerRanks = [3,4];
  const fileOf = (i)=> i % 8, rankOf = (i)=> Math.floor(i/8);
  if (wk >= 0) {
    const rf = rankOf(wk), ff = fileOf(wk);
    if (centerFiles.includes(ff) && centerRanks.includes(7-rf)) score -= 18;
  }
  if (bk >= 0) {
    const rf = rankOf(bk), ff = fileOf(bk);
    if (centerFiles.includes(ff) && centerRanks.includes(rf)) score += 18;
  }

  const ahead = (color, r)=> (color==='w' ? [...Array(8-r).keys()].map(k=> r+k+1) : [...Array(r+1).keys()].map(k=> r-k-1));
  for (let r=0; r<8; r++) for (let c=0; c<8; c++) {
    const sq = board[r][c]; if (!sq || sq.type!=='p') continue;
    const files = [c-1,c,c+1].filter(x=> x>=0 && x<8);
    let blocked = false;
    for (const rr of ahead(sq.color, r)) {
      for (const cc of files) {
        const opp = board[rr]?.[cc];
        if (opp && opp.type==='p' && opp.color!==sq.color) { blocked = true; break; }
      }
      if (blocked) break;
    }
    if (!blocked) score += (sq.color===chess.turn()? 12 : -12);
  }

  return score;
}

const TT = new Map();
function ttKey(chess, depth) { return chess.fen() + '|' + depth; }
function isBacktrackMove(chess, move) {
  const hist = chess.history({ verbose: true });
  const last = hist[hist.length - 1];
  if (!last) return false;
  return (last.to === move.from && last.from === move.to && !move.flags.includes('c'));
}

/* --- material & capture helpers for UI --- */
const MAT = VAL;
function boardCounts(chess) {
  const counts = { w:{p:0,n:0,b:0,r:0,q:0,k:0}, b:{p:0,n:0,b:0,r:0,q:0,k:0} };
  for (const row of chess.board()) for (const sq of row) if (sq) counts[sq.color][sq.type]++;
  return counts;
}
function capturedLists(chess) {
  const START = { w:{p:8,n:2,b:2,r:2,q:1,k:1}, b:{p:8,n:2,b:2,r:2,q:1,k:1} };
  const cur = boardCounts(chess);
  const cap = { w:[], b:[] };
  for (const t of ['p','n','b','r','q']) {
    const lostByWhite = START.w[t] - cur.w[t];
    const lostByBlack = START.b[t] - cur.b[t];
    for (let i=0;i<lostByBlack;i++) cap.w.push(t);
    for (let i=0;i<lostByWhite;i++) cap.b.push(t);
  }
  return cap;
}
function materialDelta(chess) {
  const c = boardCounts(chess);
  const side = (s)=> Object.entries(c[s]).reduce((sum,[t,n])=> sum + MAT[t]*n, 0);
  return side('w') - side('b'); // + if white ahead
}
const pieceGlyph = (t, color='w') => {
  const map = { w:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕'}, b:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛'} };
  return map[color][t] || '';
};

// Material advantage from one side's perspective (in centipawns)
function materialAdvantageFor(chess, color = 'w') {
  const delta = materialDelta(chess); // + if white is ahead
  return color === 'w' ? delta : -delta;
}

// Very lightweight, rule-based tactical / strategic explanation for a single move
function describeMoveMotifs(fenBefore, uci, evalCp = null) {
  const gameBefore = new Chess(fenBefore);
  const side = gameBefore.turn?.() || 'w';

  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promo = uci.slice(4) || 'q';

  const matBefore = materialAdvantageFor(gameBefore, side);
  const moved = gameBefore.move({ from, to, promotion: promo });
  if (!moved) {
    return '';
  }
  const matAfter = materialAdvantageFor(gameBefore, side);
  const matGain = matAfter - matBefore; // >0 means we gained stuff

  const motifs = [];

  // 1) Simple material narrative
  if (moved.captured) {
    const val = MAT[moved.captured] || 100;
    if (val <= 120) motifs.push('wins a pawn');
    else if (val <= 350) motifs.push('wins a minor piece');
    else if (val <= 550) motifs.push('wins a rook');
    else motifs.push('wins the queen');
  } else if (matGain > 80) {
    motifs.push('gains material');
  }

  // 2) Check / king safety
  const checkNow =
    (typeof gameBefore.inCheck === 'function' && gameBefore.inCheck()) ||
    (typeof gameBefore.isCheck === 'function' && gameBefore.isCheck()) ||
    (typeof gameBefore.in_check === 'function' && gameBefore.in_check()) ||
    (typeof gameBefore.is_check === 'function' && gameBefore.is_check()) || false;

  if (checkNow) {
    motifs.push('gives check');
  } else {
    // Did we move our king to safety or block a check line?
    if (moved.piece === 'k') {
      motifs.push('improves king safety');
    }
  }

  // 3) Simple “activity” story using eval
  if (evalCp != null && motifs.length === 0) {
    if (evalCp > 80) motifs.push('improves your position');
    else if (evalCp > 15) motifs.push('keeps a small edge');
    else if (evalCp > -15) motifs.push('keeps the balance');
    else if (evalCp > -80) motifs.push('drifts slightly worse');
    else motifs.push('seriously worsens your position');
  }

  if (!motifs.length) return '';
  // Use the nicest / most instructive-sounding clause first
  return motifs[0];
}

/* mm:ss clock formatter */
function fmtClock(ms) {
  ms = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(ms / 60);
  const s = ms % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* --- JS search with anti-rook-shuffle --- */
function searchBestMove(
  chess,
  { timeMs = 250, maxDepth = 3, randomness = 0, pruneAggressive = false, safeDropCp = 9999, inaccuracyCp = 0, blunder = 0 }
) {
  const deadline = Date.now() + timeMs;
  const killers = Array.from({ length: 128 }, () => ({ a: null, b: null }));
  const history = new Map();
  const shouldStop = () => Date.now() > deadline;

  // 🔧 FIXED: build recentFENs by cloning the *actual* game via PGN,
  // then walking backwards with undo(). No SAN re-play from a wrong startpos.
  const recentFENs = new Set();
  try {
    const clone = new Chess();
    const pgn = chess.pgn({ max_width: 0, newline_char: '\n' });

    if (pgn && pgn.trim()) {
      // This recreates the game including a custom start FEN if there is one.
      clone.load_pgn(pgn);
    } else {
      // No moves yet – just record current FEN.
      clone.load(chess.fen());
    }

    // Collect current + up to 9 previous positions.
    recentFENs.add(clone.fen());
    for (let i = 0; i < 9; i++) {
      const undone = clone.undo();
      if (!undone) break;
      recentFENs.add(clone.fen());
    }
  } catch (e) {
    // If anything goes wrong, we just skip repetition penalties
    // and leave recentFENs empty.
    console.warn('recentFENs reconstruction failed:', e);
  }

  function orderMoves(moves) {
    for (const mv of moves) {
      let score = 0;
      if (mv.flags.includes('c')) score += 900;
      if (mv.flags.includes('p')) score += 220;
      if (mv.flags.includes('+')) score += 80;
      const h = history.get(mv.san) || 0; score += h;
      if (isBacktrackMove(chess, mv)) score -= 260; // stronger anti-backtrack
      const corners = new Set(['a1','h1','a8','h8']);
      if (mv.piece === 'r' && corners.has(mv.to) && !mv.flags.includes('c')) score -= 260;

      // extra: discourage pointless rook shuffles on the back rank
      const backRank = (sq) => sq[1] === '1' || sq[1] === '8';
      if (
        mv.piece === 'r' &&
        backRank(mv.from) &&
        backRank(mv.to) &&
        !mv.flags.includes('c')
      ) {
        score -= 120;
      }
      mv.__o = score;
    }
    moves.sort((a,b)=> (b.__o|0) - (a.__o|0));
  }

  function qsearch(alpha, beta) {
    if (shouldStop()) return { score: 0, abort:true };
    let stand = evaluate(chess);
    if (stand >= beta) return { score: beta };
    if (stand > alpha) alpha = stand;

    const moves = chess.moves({ verbose:true }).filter(m => m.flags.includes('c') || m.flags.includes('+'));
    orderMoves(moves);
    for (const m of moves) {
      chess.move(m);
      const child = qsearch(-beta, -alpha);
      chess.undo();
      if (child.abort) return child;
      const score = -child.score;
      if (score >= beta) return { score: beta };
      if (score > alpha) alpha = score;
    }
    return { score: alpha };
  }

  function alphabeta(depth, alpha, beta, ply) {
    if (shouldStop()) return { score: 0, abort:true };
    if (depth === 0) return qsearch(alpha, beta);

    const cached = TT.get(ttKey(chess, depth));
    if (cached && cached.bestUci) {
      history.set(cached.bestUci, (history.get(cached.bestUci) || 0) + depth*depth);
    }

    const legal = chess.moves({ verbose:true });
    if (legal.length === 0) {
      if (chess.isCheckmate()) return { score: -99999 + ply };
      return { score: 0 };
    }

    orderMoves(legal);
    let bestLocal = null;
    let best = -Infinity;
    const origAlpha = alpha;

    for (const m of legal) {
      chess.move(m);

      let repPenalty = 0;
      const f = chess.fen();
      if (recentFENs.has(f)) repPenalty -= 60;

      const child = alphabeta(depth-1, -beta, -alpha, ply+1);
      chess.undo();
      if (child.abort) return child;
      const score = -child.score + repPenalty;

      if (score > best) { best = score; bestLocal = m; }
      if (score > alpha) alpha = score;

      if (score > origAlpha && !m.flags.includes('c')) {
        const k = killers[ply] || {};
        if (m.san !== k.a) killers[ply] = { a:m.san, b:k.a };
        history.set(m.san, (history.get(m.san) || 0) + depth*depth);
      }

      if (alpha >= beta || (pruneAggressive && depth >= 2 && alpha > beta - 80)) break;
    }

    if (bestLocal) {
      const uci = `${bestLocal.from}${bestLocal.to}${bestLocal.promotion || ''}`;
      TT.set(ttKey(chess, depth), { score: best, bestUci: uci });
    }
    return { score: best, best: bestLocal };
  }

  let alpha = -99999, beta = 99999, bestMove = null, bestScore = -Infinity, lastScore = 0;
  for (let d=1; d<=maxDepth; d++) {
    const res = alphabeta(d, alpha, beta, 0);
    if (res.abort) break;
    lastScore = res.score;
    bestScore = res.score; bestMove = res.best || bestMove;
    if (Date.now() > deadline) break;
    alpha = lastScore - 60; beta = lastScore + 60;
  }

  if (!bestMove) {
    const moves = chess.moves({ verbose:true });
    if (moves.length === 0) return { move: null, score: 0 };
    // avoid immediate backtrack
    const filtered = moves.filter(m => !isBacktrackMove(chess, m));
    bestMove = (filtered[0] || moves[0]);
  }

// Always build candidate list with quick scores
const rootMoves = chess.moves({ verbose:true });
if (!bestMove && rootMoves.length) bestMove = rootMoves[0];

const candidates = rootMoves.map(m => {
  chess.move(m);
  const s = qsearch(-9999, 9999).score; // quick but tactical-aware
  chess.undo();
  return { m, s };
}).sort((a,b)=> b.s - a.s);

if (candidates.length) {
  const bestCp = candidates[0].s;

  // Easy/Medium: occasional deliberate blunder (outside safe window)
  if (blunder > 0 && Math.random() < blunder) {
    // pick from the bottom 25% of all moves
    const start = Math.floor(candidates.length * 0.75);
    const pool = candidates.slice(start);
    if (pool.length) bestMove = pool[Math.floor(Math.random()*pool.length)].m;
  } else {
    // Respect a safety floor: don't pick a move that drops more than safeDropCp vs best
    const safePool = candidates.filter(c => (bestCp - c.s) <= safeDropCp);
    // Allow small inaccuracies if requested (hard: ~35cp, medium: ~90cp, etc.)
    const okPool = (inaccuracyCp > 0)
      ? candidates.filter(c => (bestCp - c.s) <= inaccuracyCp)
      : safePool;

    // Add controlled variety via 'randomness' but only within the okPool
    const pool = (okPool.length ? okPool : safePool);
    const k = Math.max(1, Math.min(pool.length, Math.round(1 + randomness * (pool.length - 1))));
    bestMove = pool[Math.floor(Math.random() * k)]?.m || candidates[0].m;
  }
}

  return { move: bestMove, score: bestScore };
}

/* Stockfish lifecycle + mutex */
function useStockfish() {
  const sfRef = useRef(null);
  const readyRef = useRef(false);
  const [sfStatus, setSfStatus] = useState('Starting engine…');

  // Serialize calls so SF never receives overlapping "go"
  const lockRef = useRef(Promise.resolve());
  const withSFLock = useCallback((fn) => {
    const run = lockRef.current.then(() => fn(), () => fn());
    lockRef.current = run.catch(() => {});
    return run;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const sf = createStockfish();
        if (!mounted) return;
        sfRef.current = sf;
        setSfStatus('Initializing…');

        // Use MultiPV for tutorial/analysis; modes can override
        await sf.init({ hash: 64, threads: 1, contempt: 0, multipv: 3 });
        if (!mounted) return;
        readyRef.current = true;
        setSfStatus('Ready');
      } catch (e) {
        if (!mounted) return;
        readyRef.current = false;
        setSfStatus('Engine failed to init. Falling back soon…');
      }
    })();

    return () => { mounted = false; sfRef.current?.destroy?.(); };
  }, []);

  return { sfRef, readyRef, withSFLock, sfStatus };
}

async function analyzeMoveWithStockfish(sfRef, readyRef, withSFLock, fen, uciPlayed) {
  const motifFallback = () => {
    try {
      const gameBefore = new Chess(fen);
      const from = uciPlayed.slice(0, 2);
      const to = uciPlayed.slice(2, 4);
      const promo = uciPlayed.slice(4) || 'q';
      const moved = gameBefore.move({ from, to, promotion: promo });
      const san = moved?.san || '';

      const motif = (describeMoveMotifs(fen, uciPlayed, null) || '').toLowerCase();

      const fullmoveNumber = parseInt(fen.split(' ')[5] || '1', 10) || 1;
      const inOpening = fullmoveNumber <= 10;

      // in roughly equal positions
      let nearEqual = true;
      try {
        const cp = evaluate(gameBefore); // from the JS engine above
        nearEqual = Math.abs(cp) <= 80;
      } catch {
        nearEqual = true;
      }

      let label;

      if (
        inOpening &&
        nearEqual &&
        !motif.includes('worsens') &&
        !motif.includes('seriously worsens') &&
        !motif.includes('losing')
      ) {
        // Treat early, normal moves (like 1.e4, 1.d4, 1.Nf3…) as “Book”
        label = 'Book';
      } else if (
        motif.includes('wins a pawn') ||
        motif.includes('wins a minor piece') ||
        motif.includes('wins a rook') ||
        motif.includes('wins the queen') ||
        motif.includes('gains material') ||
        motif.includes('gives check') ||
        motif.includes('improves king safety') ||
        motif.includes('improves your position') ||
        motif.includes('keeps a small edge') ||
        motif.includes('keeps the balance')
      ) {
        label = 'Good';
      } else if (
        motif.includes('seriously worsens') ||
        motif.includes('worsens your position') ||
        motif.includes('losing') ||
        motif.includes('drifts slightly worse')
      ) {
        label = 'Mistake';
      } else {
        label = 'Info';
      }

      let text = `${label}: ${san}. `;
      if (label === 'Book') {
        text += 'A standard opening move; detailed engine analysis is not available yet.';
      } else if (motif) {
        text += `Idea: ${motif}.`;
      } else {
        text += 'A normal developing move; engine details are unavailable here.';
      }

      return {
        label,
        text,
        bestUci: null,
        bestSan: null,
        beforeScore: null,
        afterScore: null,
        delta: null,
        san,
      };
    } catch {
      return {
        label: 'Info',
        text: 'Move played. Explanation is temporarily unavailable, but the game continues normally.',
        bestUci: null,
        bestSan: null,
        beforeScore: null,
        afterScore: null,
        delta: null,
        san: '',
      };
    }
  };

  try {
    const sf = sfRef.current;
    if (!sf || !readyRef.current) {
      // Engine not ready → still give *something*.
      return motifFallback();
    }

    // --- 1. Analyze BEFORE the move (get eval + best move) ---
    const linesBefore = await withSFLock(() =>
      sf.analyze({
        fen,
        movetime: 200,
        depth: 12,
        multipv: 3,
        hardLimitMs: 700,
      })
    );
    const primaryBefore = linesBefore?.[0];
    if (!primaryBefore) return motifFallback();

    const beforeScore = primaryBefore.scoreCp ?? 0; // centipawns from side-to-move POV
    const bestPv = primaryBefore.pv || '';
    const bestUci = bestPv.split(/\s+/)[0] || null;

    // --- 2. Apply the played move ---
    const from = uciPlayed.slice(0, 2);
    const to = uciPlayed.slice(2, 4);
    const promo = uciPlayed.slice(4) || 'q';

    const gameBefore = new Chess(fen);
    const moved = gameBefore.move({ from, to, promotion: promo });
    if (!moved) return null;

    const san = moved.san || '';
    const afterFen = gameBefore.fen();

    // Compute SAN for the engine best move (for “View Best Move” etc.)
    let bestSan = null;
    if (bestUci) {
      try {
        const tmp = new Chess(fen);
        const bm = tmp.move({
          from: bestUci.slice(0, 2),
          to: bestUci.slice(2, 4),
          promotion: bestUci.slice(4) || 'q',
        });
        bestSan = bm?.san || null;
      } catch {
        // ignore
      }
    }

    // --- 3. Analyze AFTER the move ---
    const linesAfter = await withSFLock(() =>
      sf.analyze({
        fen: afterFen,
        movetime: 200,
        depth: 12,
        multipv: 2,
        hardLimitMs: 700,
      })
    );

    const primaryAfter = linesAfter?.[0];
    if (!primaryAfter) return motifFallback();

    const afterScoreOpp = primaryAfter.scoreCp ?? 0; // now it's opponent to move
    const afterScore = -afterScoreOpp;               // convert back to "our" POV
    const delta = afterScore - beforeScore;
    const absDelta = Math.abs(delta);

    // --- 4. Context: opening / winning / tactical? ---
    const fullmoveNumber = parseInt(fen.split(' ')[5] || '1', 10) || 1;
    const inOpening = fullmoveNumber <= 10;

    const pieceVals = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
    const capturedVal = moved.captured ? (pieceVals[moved.captured] || 100) : 0;

    const checkNow =
      (typeof gameBefore.inCheck === 'function' && gameBefore.inCheck()) ||
      (typeof gameBefore.isCheck === 'function' && gameBefore.isCheck()) ||
      (typeof gameBefore.in_check === 'function' && gameBefore.in_check()) ||
      (typeof gameBefore.is_check === 'function' && gameBefore.is_check()) || false;

    const isTactical = capturedVal >= 300 || checkNow;
    const playedIsBest = !!bestUci && uciPlayed === bestUci;

    const wasWinning = beforeScore >= 150; // ~1.5 pawns
    const stillWinning = afterScore >= 80;
    const drop = -delta; // positive if we made things worse

    // Bucket evals *before* label selection so we can safely use them.
    const evalBucket = (cp) => {
      if (cp > 250) return 'clearly winning';
      if (cp > 120) return 'better';
      if (cp > 40)  return 'slightly better';
      if (cp >= -40) return 'about equal';
      if (cp >= -120) return 'slightly worse';
      if (cp >= -250) return 'worse';
      return 'losing';
    };

    const beforeState = evalBucket(beforeScore);
    const afterState = evalBucket(afterScore);

    // --- 5. Choose a label (brilliant / best / etc.) ---
    let label;

    const isBookish =
      inOpening &&
      Math.abs(beforeScore) <= 120 &&
      absDelta <= 60 &&
      !isTactical &&
      playedIsBest; // removed nonexistent isBookishDevelopingMove

    if (isBookish) {
      // Opening, roughly equal, normal development → treat as book.
      label = 'Book';
    }
    // “Brilliant”: big positive swing, usually tactical, improving a lot.
    else if (
      delta >= 220 &&
      afterScore >= Math.max(120, beforeScore + 80) &&
      (isTactical || !wasWinning)
    ) {
      label = 'Brilliant';
    }
    // If we actually matched SF’s top move, never punish it.
    else if (playedIsBest) {
      if (delta >= 140) {
        label = 'Great';
      } else if (delta >= 70) {
        label = 'Excellent';
      } else if (delta >= 25) {
        label = 'Good';
      } else {
        label = 'Best';
      }
    }
    // Non-best moves: positive deltas are rewarded.
    else if (delta >= 140) {
      label = 'Great';
    } else if (delta >= 70) {
      label = 'Excellent';
    } else if (delta >= 25) {
      label = 'Good';
    }
    // “Miss”: you were winning, still winning, but threw away a big chunk.
    else if (wasWinning && stillWinning && drop >= 150) {
      label = 'Miss';
    }
    // Big errors on the downside (only for non-best moves).
    else if (drop >= 320) {
      label = 'Blunder';
    } else if (drop >= 180) {
      label = 'Mistake';
    } else if (drop >= 60) {
      // Only call it an inaccuracy if the eval bucket actually worsens
      // (e.g. clearly winning → better, not clearly winning → equal, etc).
      if (beforeState !== afterState) {
        label = 'Inaccuracy';
      } else {
        // Same bucket (e.g. clearly winning → clearly winning): still fine.
        label = 'Good';
      }
    } else {
      // Tiny eval changes get a soft verdict.
      label = delta >= -15 ? 'Good' : 'Inaccuracy';
    }

    // --- 6. Build human-readable explanation text ---
    const motif = describeMoveMotifs(fen, uciPlayed, afterScore);

    const labelBlurbs = {
      Brilliant: 'Finds a powerful tactical resource that sharply improves your position.',
      Great: 'Very strong move that improves your position a lot.',
      Best: 'Matches the engine’s top move in this position.',
      Excellent: 'Accurate move that clearly improves or keeps your advantage.',
      Good: 'Solid move that keeps your position healthy.',
      Book: 'Standard opening move that keeps the position on track.',
      Miss: 'You were winning and stayed winning, but you missed a much stronger continuation.',
      Inaccuracy: 'Playable, but it lets some of your advantage slip.',
      Mistake: 'A serious error that hands over a big chunk of your advantage.',
      Blunder: 'A huge mistake: the evaluation swings heavily against you.',
    };

    let text = `${label}: ${san}. `;
    if (labelBlurbs[label]) text += `${labelBlurbs[label]} `;

    if (absDelta >= 30) {
      text += `You were ${beforeState}, now you are ${afterState}. `;
      const pawnSwing = (absDelta / 100).toFixed(1);
      text += `That’s roughly a ${pawnSwing}-pawn swing in the evaluation. `;
    } else {
      text += `This keeps the position ${afterState}. `;
    }

    if (motif) {
      text += `Idea: ${motif}.`;
    }

    return {
      label,
      text,
      bestUci: bestUci && bestUci.length >= 4 ? bestUci : null,
      bestSan,
      beforeScore,
      afterScore,
      delta,
      san,
    };
  } catch {
    return motifFallback();
  }
}

async function gradeWithStockfish(sfRef, readyRef, withSFLock, fen, uciPlayed) {
  const res = await analyzeMoveWithStockfish(sfRef, readyRef, withSFLock, fen, uciPlayed);
  if (!res) return '';
  if (res.text && res.text.trim()) return res.text;
  const prefix = res.label ? `${res.label}: ` : '';
  const moveStr = res.san || '';
  return `${prefix}${moveStr}`.trim();
}

/* Component */
export default function ChessArena({ onExit }) {
  const { user } = useContext(AuthContext);

  const [mode, setMode] = useState(null);
  const [fen, setFen] = useState(new Chess().fen());
  const [orientation, setOrientation] = useState('white');
  const [status, setStatus] = useState('Pick a mode to start.');
  const [notice, setNotice] = useState('');
  const [roomId, setRoomId] = useState(null);
  const socketRef = useRef(null);
  const [showTutorialSettings, setShowTutorialSettings] = useState(false); // NEW
  const [tutorialElo, setTutorialElo] = useState(1000);                    // NEW
  const [showTutorialLog, setShowTutorialLog] = useState(false);          // NEW

  const [showPicker, setShowPicker] = useState(false);
  const [botProfile, setBotProfile] = useState(null);
  const [tips, setTips] = useState([]);
  const chessRef = useRef(new Chess());
  const awardedRef = useRef(false);
  const noticeTimer = useRef(null);
  const panelRef = useRef(null);
  const [boardSize, setBoardSize] = useState(720);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hintBusy, setHintBusy] = useState(false);
  const [hintLines, setHintLines] = useState(null); // array of { san, uci, comment }
  const [hintSquares, setHintSquares] = useState({});
  const [lastMoveGrade, setLastMoveGrade] = useState(null); // { who, san, label, text }
  const [tutorialOverlay, setTutorialOverlay] = useState(null);
  // Tutorial overlay drag state
  const [tutorialOverlayPos, setTutorialOverlayPos] = useState(null);

  const tutorialOverlayRef = useRef(null);
  const tutorialDragRef = useRef(null);
  const boardRef = useRef(null);
  // Keep the floating tutorial bubble fully inside the board
  const clampOverlayToBoard = React.useCallback(
    (x, y) => {
      if (!boardRef.current || !tutorialOverlayRef.current) return { x, y };

      const boardRect = boardRef.current.getBoundingClientRect();
      const overlayRect = tutorialOverlayRef.current.getBoundingClientRect();

      const pad = 8; // small margin from the edges
      const halfW = overlayRect.width / 2;
      const halfH = overlayRect.height / 2;

      const minX = pad + halfW;
      const maxX = boardRect.width - pad - halfW;
      const minY = pad + halfH;
      const maxY = boardRect.height - pad - halfH;

      return {
        x: Math.max(minX, Math.min(x, maxX)),
        y: Math.max(minY, Math.min(y, maxY)),
      };
    },
    []
  );

  // After the overlay mounts / resizes, clamp one more time
  useEffect(() => {
    if (!tutorialOverlayPos || !boardRef.current || !tutorialOverlayRef.current) return;

    setTutorialOverlayPos((prev) => {
      if (!prev) return prev;
      const { x, y } = clampOverlayToBoard(prev.x, prev.y);
      if (x === prev.x && y === prev.y) return prev;
      return { ...prev, x, y };
    });
  }, [tutorialOverlayPos, clampOverlayToBoard]);

  // define resultModal BEFORE using it
  const [resultModal, setResultModal] = useState(null); // { didWin, resultText, trophies, rank, place }

  // now it's safe to compute the CTA flag
  const noMovesYet = (chessRef.current?.history?.() || []).length === 0;
  const showStartCTA =
    !resultModal &&
    noMovesYet &&
    (
      !mode ||
      (mode === 'bot' && !botProfile) ||
      (mode === 'online' && !roomId)
    );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (drawerOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => (document.body.style.overflow = '');
  }, [drawerOpen]);

  useLayoutEffect(() => {
    const getPad = (el) => {
      const cs = window.getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      return { padX, padY };
    };

  const BREATHING = BOTTOM_GAP;

  const calc = () => {
    const panel = panelRef.current;
    if (!panel) return;

    const { padX, padY } = getPad(panel);
    const innerW = Math.max(240, Math.floor(panel.clientWidth - padX));
    const isPhone = window.matchMedia('(max-width: 860px)').matches;
    // visualViewport gap helps detect bottom bars / keyboard shrink on iOS
    const inset = window.visualViewport
      ? Math.max(0, (window.innerHeight || 0) - window.visualViewport.height)
      : 0;
    const mobileExtra = isPhone ? (MOBILE_NAV_H + inset) : 0;
    const availH = Math.max(
      240,
      Math.floor((window.innerHeight || 900) - HEADER_H - BREATHING - padY - mobileExtra)
    );
 

    setBoardSize(Math.min(innerW, availH));
  };

  calc();
  window.addEventListener('resize', calc);
  let ro;
  if ('ResizeObserver' in window && panelRef.current) {
    ro = new ResizeObserver(calc);
    ro.observe(panelRef.current);
  }
  return () => {
    window.removeEventListener('resize', calc);
    if (ro) ro.disconnect();
  };
}, []);
  // Track my color for online in a ref to avoid stale closures
  const colorRef = useRef('w'); // 'w' | 'b'

  // Track recent FENs to avoid immediate repetition / rook shuffle with SF
  const recentFensRef = useRef([]);
  useEffect(() => {
    const arr = recentFensRef.current;
    if (arr[arr.length - 1] !== fen) {
      arr.push(fen);
      if (arr.length > 6) arr.shift();
    }
  }, [fen]);

  // end-of-game modal & naming
  const [oppName, setOppName] = useState('');
  const myColor = useCallback(
    () => (orientation === 'white' ? 'w' : 'b'),
    [orientation]
  );
  const lastTurnRef = useRef('w');
  const timeoutHandledRef = useRef(false);
  // Drag origin highlight
  const [dragFrom, setDragFrom] = useState(null);

  // Bot busy lock
  const botBusyRef = useRef(false);
  const setBusy = (v) => { botBusyRef.current = v; };

  // PREMOVE
  const [premove, setPremove] = useState(null); // {from, to, promotion}
  const [premoveSquares, setPremoveSquares] = useState({});
  useEffect(() => {
    if (!premove) { setPremoveSquares({}); return; }
    setPremoveSquares({
      [premove.from]: { boxShadow: 'inset 0 0 0 3px rgba(59,130,246,.9)' },
      [premove.to]:   { boxShadow: 'inset 0 0 0 3px rgba(59,130,246,.9)' },
    });
  }, [premove]);

  const { sfRef, readyRef, withSFLock, sfStatus } = useStockfish();

  const flashNotice = useCallback((msg, ms=1200) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(msg);
    noticeTimer.current = setTimeout(()=> setNotice(''), ms);
  }, []);
  const clearNotice = useCallback(() => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice('');
  }, []);

  const resetLocal = useCallback((flip='white')=>{
    chessRef.current = new Chess();
    setOrientation(flip);
    setFen(chessRef.current.fen());
    awardedRef.current = false;
    clearNotice();
    setTips([]);
    setPremove(null);
    setDragFrom(null);
    recentFensRef.current = [chessRef.current.fen()];
    setHintLines(null);
    setHintSquares({});
    setLastMoveGrade(null);
  }, [clearNotice]);

  const openBotPicker = () => {
    setMode('bot');
    setRoomId(null);
    resetLocal('white');
    setStatus('Select a bot mode to begin. You are White.');
    setShowPicker(true);
  };
  const startTutorialWithElo = useCallback(() => {
    const profile = buildTutorialProfileFromElo(tutorialElo);
    setBotProfile({ key: 'tutorial', ...profile });
    setShowTutorialSettings(false);
    setStatus(profile.status || `${profile.label}: You are White.`);
    setOppName(profile.label || 'Tutorial');
  }, [tutorialElo, setBotProfile, setStatus, setOppName]);

  const chooseBot = (key) => {
    const profile = BOT_PRESETS[key];
    setBotProfile({ key, ...profile });
    setShowPicker(false);
    setStatus(profile.status || `${profile.label}: You are White.`);
    setOppName(profile.label || 'Bot');
  };
  const appendTip = useCallback((text) => {
    // Keep the full history for the current game; the modal is scrollable.
    setTips(prev => [text, ...prev]);
  }, [setTips]);
  const fmt = (m) => m ? `${m.from}→${m.to}` : '';

  const tryPremove = useCallback(async () => {
    if (!premove) return false;
    const chess = chessRef.current;
    if (chess.isGameOver()) {
      setPremove(null);
      setPremoveSquares({});
      return false;
    }
    if (chess.turn() !== myColor()) return false;

    const isPromotionNow = chess
      .moves({ verbose: true })
      .some(
        m =>
          m.from === premove.from &&
          m.to === premove.to &&
          m.flags &&
          m.flags.includes('p')
      );
    const mv = isPromotionNow
      ? {
          from: premove.from,
          to: premove.to,
          promotion: premove.promotion || 'q',
        }
      : { from: premove.from, to: premove.to };

    const beforeFen = chess.fen();
    const moved = chess.move(mv);
    if (!moved) {
      setPremove(null);
      setPremoveSquares({});
      return false;
    }

    setFen(chess.fen());
    setPremove(null);
    setPremoveSquares({});
    clearNotice();

    if (mode === 'bot' && botProfile?.explain) {
      try {
        const last = chess.history({ verbose: true }).slice(-1)[0];
        const uci = last
          ? `${last.from}${last.to}${last.promotion || ''}`
          : '';
        const msg = await gradeWithStockfish(
          sfRef,
          readyRef,
          withSFLock,
          beforeFen,
          uci
        );
        if (msg) appendTip(`Your move ${last?.san}. ${msg}`);
      } catch {
        // swallow engine errors; premove still stands
      }
    }

    if (mode === 'bot' && !chess.isGameOver()) {
      botMove();
    } else if (mode === 'online' && socketRef.current && roomId) {
      socketRef.current.emit('chess:move', { roomId, ...mv });
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premove, mode, botProfile, roomId, sfRef, readyRef, withSFLock, myColor]);

  const fastBestMove = useCallback(async (fenStr, p) => {
    const requiresSF = !!p.useSF; // true for elite / gm

    // If GM/Elite *require* SF and it's not ready, still treat as an error.
    if (requiresSF && (!sfRef.current || !readyRef.current)) {
      throw new Error('Stockfish not ready for SF-backed bot');
    }

    // For non-SF bots (Easy/Medium/Hard/Tutorial) we can safely use the JS engine
    // if SF isn't ready. (Right now fastBestMove is only used for SF bots, but
    // this keeps things future-proof.)
    if (!requiresSF && (!sfRef.current || !readyRef.current)) {
      const clone = new Chess(fenStr);
      const { move } = searchBestMove(clone, {
        timeMs: 320,
        maxDepth: 3,
        randomness: p.randomness || 0,
      });
      return move ? `${move.from}${move.to}${move.promotion || ''}` : null;
    }

    // --- SF-backed path (elite / gm) ---

    // Keep these fairly small so it feels "chess.com fast".
    const movetime   = p.sf?.movetime ?? 700;          // ms to *aim* for
    const depth      = p.sf?.depth ?? null;            // usually null now
    const multipv    = p.sf?.multipv ?? 2;             // use preset, not hard-coded 4
    const safetyCp   = p.safetyCp ?? 12;
    const allowInacc = p.inaccuracyCp ?? 0;

    // Give SF plenty of leeway vs movetime to avoid timeouts on slower machines.
    // Example: movetime = 900ms → hardLimit ≈ 2600ms.
    const hardLimitMs = movetime * 2 + 800;

    try {
      const params = { fen: fenStr, movetime, multipv, hardLimitMs };
      if (depth != null) params.depth = depth;

      const lines = await withSFLock(() =>
        sfRef.current.analyze(params)
      );

      const candidates = (lines || [])
        .map(l => {
          const uci  = (l.pv || '').split(/\s+/)[0] || null;
          const mate = (l.scoreMate ?? l.mate ?? null);
          const cp   = Number(l.scoreCp ?? 0);

          const norm = (mate != null)
            ? (mate > 0
                ? 100000 - Math.abs(mate) * 100
                : -100000 + Math.abs(mate) * 100)
            : cp;

          return { uci, cp, norm, mate };
        })
        .filter(x => x.uci && x.uci.length >= 4)
        .sort((a, b) => b.norm - a.norm);

      if (!candidates.length) {
        // If SF gave us nothing at all, just bail out to JS engine below.
        throw new Error('Stockfish returned no candidate lines');
      }

      const chessNow  = chessRef.current;
      const last      = chessNow.history({ verbose:true }).slice(-1)[0];
      const lastFrom  = last?.from, lastTo = last?.to;
      const recentSet = new Set(recentFensRef.current);

      const bestScore = candidates[0].norm;
      const maxDrop   = Math.max(0, allowInacc || safetyCp);

      const pool = [];
      for (const cand of candidates) {
        const mv = {
          from: cand.uci.slice(0, 2),
          to:   cand.uci.slice(2, 4),
          promotion: cand.uci.slice(4) || 'q',
        };

        const probe = new Chess(fenStr);
        const moved = probe.move(mv);
        if (!moved) continue;

        // Avoid instant repetition / trivial backtracks
        const repeats     = recentSet.has(probe.fen());
        const isBacktrack =
          !!lastFrom && !!lastTo &&
          lastFrom === mv.to && lastTo === mv.from &&
          !moved.flags?.includes('c');

        if (repeats || isBacktrack) continue;

        const drop = Math.abs(bestScore - cand.norm);
        if (drop <= maxDrop) pool.push(cand);
      }

      if (pool.length === 0) {
        // No filtered pool? Just take pure best.
        return candidates[0].uci || null;
      }

    let pick;

    if (p.key === 'elite' && pool.length > 1) {
      // keep existing Elite behavior exactly
      pick = pool[Math.floor(Math.random() * Math.min(pool.length, 2))];
    } else if ((p.randomness ?? 0) > 0 && pool.length > 1) {
      // generic SF randomness for Easy/Medium/Hard (and others if desired)
      const r = Math.max(
        1,
        Math.round(1 + p.randomness * (pool.length - 1))
      );
      const k = Math.min(pool.length, r);
      pick = pool[Math.floor(Math.random() * k)];
    } else {
      // GM or any mode with randomness = 0 → always best move in pool
      pick = pool[0];
    }

    return pick.uci;

    } catch (err) {
      console.error('Stockfish analyze/bestMove failed for bot', p.key, err);

      // 1) Try a direct bestMove with a shorter thinking time.
      try {
        const bmParams = {
          fen: fenStr,
          movetime: Math.min(500, movetime),
          hardLimitMs,
        };
        if (depth != null) bmParams.depth = Math.min(16, depth);

        const uci = await withSFLock(() =>
          sfRef.current.bestMove(bmParams)
        );
        if (uci && uci !== '(none)') return uci;
      } catch (e2) {
        console.error('Stockfish bestMove fallback failed for bot', p.key, e2);
      }

      // 2) Final emergency fallback: JS engine so the bot still moves.
      try {
        const clone = new Chess(fenStr);
        const { move } = searchBestMove(clone, {
          timeMs: 260,
          maxDepth: 3,
          randomness: p.randomness || 0,
        });
        return move ? `${move.from}${move.to}${move.promotion || ''}` : null;
      } catch (e3) {
        console.error('JS fallback search failed for bot', p.key, e3);
        return null;
      }
    }
  }, [sfRef, readyRef, withSFLock]);

  // ---- Results modal helpers (must come before botMove/connectSocket) ----
  const fetchMyChessTrophies = useCallback(async () => {
    if (!user?._id) return 0;
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/games/stats/${user._id}`);
      return (data?.trophiesByGame?.chess) || 0;
    } catch {
      return 0;
    }
  }, [user?._id]);

  // overall leaderboard place for the modal
  const fetchMyOverallPlace = useCallback(async () => {
    if (!user?._id) return null;
    try {
      const q = new URLSearchParams({ limit: '100', userId: user._id });
      const { data } = await axios.get(`${API_BASE_URL}/api/games/leaderboard/overall?${q.toString()}`);
      return data?.me?.rank ?? null;
    } catch {
      return null;
    }
  }, [user?._id]);
  // returns 'w' | 'b' | null based on text like "White wins", "0-1", "resigns", "on time", etc.
  const winnerFromText = (t = '') => {
    if (!t) return null;
    if (/\b1-0\b/i.test(t) || /white\s*wins/i.test(t)) return 'w';
    if (/\b0-1\b/i.test(t) || /black\s*wins/i.test(t)) return 'b';
    if (/white.*checkmate|checkmate.*white/i.test(t)) return 'w';
    if (/black.*checkmate|checkmate.*black/i.test(t)) return 'b';
    if (/white\s*resign|white.*flag|white.*timeout/i.test(t)) return 'b';
    if (/black\s*resign|black.*flag|black.*timeout/i.test(t)) return 'w';
    return null;
  };

  // Accept an optional override of trophies (to ensure post-write freshness)
  const openResultModal = useCallback(
    async (resultText, trophiesOverride = null, didWinOverride = null) => {
      let didWin = (typeof didWinOverride === 'boolean') ? didWinOverride : null;
      if (didWin === null) {
        const isDraw = /draw|½-½|1\/2-1\/2/i.test(resultText);
        const w = winnerFromText(resultText);
        const mine = colorRef.current;        // 'w' | 'b' set on chess:start
        didWin = !isDraw && !!w && (w === mine);
      }
      const trophies = trophiesOverride ?? (await fetchMyChessTrophies());
      const place = await fetchMyOverallPlace();
      setResultModal({ didWin, resultText, trophies, rank: perGameRank(trophies), place });
    },
    [fetchMyChessTrophies, fetchMyOverallPlace]
  );

  /* Bot move */
  const botMove = useCallback(async () => {
    const chess = chessRef.current;
    if (chess.isGameOver() || botBusyRef.current) return;

    setBusy(true);
    const p = botProfile || BOT_PRESETS.elite;
    const thinkMs = p.thinkMs ?? 150;
    await new Promise(res => setTimeout(res, thinkMs));

    try {
      const beforeFen = chess.fen();

      if (p.useSF) {
        let uciMove = null;
        try {
          uciMove = await fastBestMove(beforeFen, p);
        } catch (e) {
          console.error('Stockfish error for bot', p.key, e);
          setStatus('Engine error for this bot. Please refresh or pick a different bot.');
          setBusy(false);
          return; // do NOT play a garbage fallback move as GM
        }

        if (!uciMove) {
          // Terminal position — no move; declare result without throwing UI errors
          const txt = endMessage(chess);
          setStatus(txt);
          openResultModal(txt);
          return;
        }

        chess.move({
          from: uciMove.slice(0, 2),
          to: uciMove.slice(2, 4),
          promotion: uciMove.slice(4) || 'q',
        });
        setFen(chess.fen());

        if (p.explain) {
          const san = chess.history().slice(-1)[0];

          if (p.key === 'tutorial') {
            const detail = await analyzeMoveWithStockfish(
              sfRef,
              readyRef,
              withSFLock,
              beforeFen,
              uciMove
            );
            if (detail) {
              appendTip(`Bot move ${san}. ${detail.text}`);
              setLastMoveGrade({
                who: 'bot',
                san,
                label: detail.label,
                text: detail.text,
              });
              setTutorialOverlay({
                who: 'bot',
                san,
                label: detail.label,
                text: detail.text,
                from: uciMove.slice(0, 2),
                to: uciMove.slice(2, 4),
                beforeFen,
                bestUci: detail.bestUci,
                bestSan: detail.san,
              });
            }
          } else {
            const msg = await gradeWithStockfish(
              sfRef,
              readyRef,
              withSFLock,
              beforeFen,
              uciMove
            );
            if (msg) {
              appendTip(`Bot move ${san}. ${msg}`);
              const label = msg.split(':')[0] || '';
              setLastMoveGrade({
                who: 'bot',
                san,
                label,
                text: msg,
              });
            }
          }
        }

        if (chess.isGameOver()) {
          const txt = endMessage(chess);
          setStatus(txt);
          openResultModal(txt);
          return;
        }
      } else {
        const res = searchBestMove(chess, {
          timeMs: p.timeMs,
          maxDepth: p.maxDepth,
          randomness: p.randomness || 0,
          pruneAggressive: !!p.pruneAggressive,
          safeDropCp: p.safeDropCp ?? 9999,
          inaccuracyCp: p.inaccuracyCp ?? 0,
          blunder: p.blunder ?? 0,
        });

        let m = res.move;
        if (!m) {
          const moves = chess.moves({ verbose: true });
          if (moves.length === 0) {
            const txt = endMessage(chess);
            setStatus(txt);
            openResultModal(txt);
            return;
          }
          m = moves[0];
        }

        chess.move(m);
        setFen(chess.fen());

        if (p.explain && m) {
          const uci = `${m.from}${m.to}${m.promotion || ''}`;
          if (p.key === 'tutorial') {
            try {
              const detail = await analyzeMoveWithStockfish(
                sfRef,
                readyRef,
                withSFLock,
                beforeFen,
                uci
              );
              if (detail) {
                appendTip(`Bot move ${m.san}. ${detail.text}`);
                setLastMoveGrade({
                  who: 'bot',
                  san: m.san,
                  label: detail.label,
                  text: detail.text,
                });
                setTutorialOverlay({
                  who: 'bot',
                  san: m.san,
                  label: detail.label,
                  text: detail.text,
                  from: m.from,
                  to: m.to,
                  beforeFen,
                  bestUci: detail.bestUci,
                  bestSan: detail.bestSan || detail.san,
                });
                setTutorialOverlayPos(null);
              }
            } catch {
              appendTip(`Bot move ${m.san}.`);
            }
          } else {
            try {
              const msg = await gradeWithStockfish(
                sfRef,
                readyRef,
                withSFLock,
                beforeFen,
                uci
              );
              if (msg) {
                appendTip(`Bot move ${m.san}. ${msg}`);
                const label = msg.split(':')[0] || '';
                setLastMoveGrade({
                  who: 'bot',
                  san: m.san,
                  label,
                  text: msg,
                });
              }
            } catch {
              appendTip(`Bot move ${m.san}.`);
            }
          }
        }

        if (chess.isGameOver()) {
          const txt = endMessage(chess);
          setStatus(txt);
          openResultModal(txt);
          return;
        }
      }
    } finally {
      setBusy(false);
    }

    await tryPremove();
  }, [
    botProfile,
    fastBestMove,
    tryPremove,
    appendTip,
    sfRef,
    readyRef,
    withSFLock,
    openResultModal,
  ]);

  const explainLastMove = useCallback(async () => {
    try {
      const sf = sfRef.current;
      if (!sf || !readyRef.current) {
        flashNotice('Engine is still starting up. Try again in a moment.');
        return;
      }

      const chess = chessRef.current;
      const histVerbose = chess.history({ verbose: true });
      if (!histVerbose.length) {
        flashNotice('No moves have been played yet.');
        return;
      }

      const last = histVerbose[histVerbose.length - 1];
      const sans = chess.history(); // SAN strings

      // Rebuild position just before the last move
      const before = new Chess();
      for (let i = 0; i < sans.length - 1; i++) before.move(sans[i]);
      const beforeFen = before.fen();
      const uci = `${last.from}${last.to}${last.promotion || ''}`;

      let msg = '';
      if (sfRef.current && readyRef.current) {
        msg = await gradeWithStockfish(sfRef, readyRef, withSFLock, beforeFen, uci);
      }
      if (!msg) {
        // motif-only backup
        const motif = describeMoveMotifs(beforeFen, uci, null);
        if (motif) msg = `Idea: ${motif}.`;
      }
      if (!msg) {
        flashNotice('Could not get an explanation for that move.');
        return;
      }

      const mine = myColor(); // 'w' | 'b'
      const who =
        last.color === mine
          ? 'you'
          : mode === 'bot'
          ? 'bot'
          : 'opponent';

      appendTip(`${who === 'you' ? 'Your' : 'Their'} move ${last.san}. ${msg}`);
      const label = msg.split(':')[0] || '';
      setLastMoveGrade({
        who,
        san: last.san,
        label,
        text: msg,
      });
    } catch {
      flashNotice('Engine error while explaining that move.');
    }
  }, [sfRef, readyRef, withSFLock, flashNotice, myColor, mode, appendTip]);

  const jsHintFallback = useCallback(
    (fenNow) => {
      const clone = new Chess(fenNow);
      const { move } = searchBestMove(clone, {
        timeMs: 260,
        maxDepth: 3,
        randomness: 0,
        pruneAggressive: false,
        safeDropCp: 9999,
        inaccuracyCp: 0,
        blunder: 0,
      });
      if (!move) return false;

      const temp = new Chess(fenNow);
      const played = temp.move(move);
      if (!played) return false;

      const uci = `${move.from}${move.to}${move.promotion || ''}`;
      const comment = describeMoveMotifs(fenNow, uci, null);

      const hints = [
        {
          san: played.san,
          uci,
          cp: null,
          mate: null,
          comment,
        },
      ];

      setHintLines(hints);

      const fromSq = uci.slice(0, 2);
      const toSq = uci.slice(2, 4);
      setHintSquares({
        [fromSq]: {
          boxShadow: 'inset 0 0 0 3px rgba(96,165,250,.95)',
        },
        [toSq]: {
          boxShadow: 'inset 0 0 0 3px rgba(96,165,250,.95)',
          background: 'rgba(96,165,250,.35)',
        },
      });

      const extra = comment ? ` — ${comment}` : '';
      appendTip(`Hint: ${played.san}.${extra}`);
      return true;
    },
    [appendTip]
  );

const requestHint = useCallback(async () => {
  const chess = chessRef.current;
  if (chess.isGameOver()) {
    flashNotice('Game is already over.');
    return;
  }
  if (chess.turn() !== myColor()) {
    flashNotice("It's not your move.");
    return;
  }

  const fenNow = chess.fen();
  setHintBusy(true);
  setHintLines(null);
  setHintSquares({});

  // If engine is not ready, immediately fall back to JS search.
  if (!sfRef.current || !readyRef.current) {
    const ok = jsHintFallback(fenNow);
    if (!ok) flashNotice('No hint available in this position.');
    setHintBusy(false);
    return;
  }

  try {
    const movetime = botProfile?.useSF ? (botProfile.sf?.movetime ?? 1200) : 700;
    const depth = botProfile?.useSF ? (botProfile.sf?.depth ?? 18) : 14;
    const multipv = 3;
    const hardLimitMs = movetime + 500;

    const lines = await withSFLock(() =>
      sfRef.current.analyze({ fen: fenNow, movetime, depth, multipv, hardLimitMs })
    );

    if (!lines || !lines.length) {
      if (!jsHintFallback(fenNow)) flashNotice('No hint available in this position.');
      return;
    }

    const hints = [];

    for (const line of lines.slice(0, 3)) {
      const uci = (line.pv || '').split(/\s+/)[0] || null;
      if (!uci || uci.length < 4) continue;

      const cp = Number(line.scoreCp ?? line.cp ?? 0);
      const mate = line.scoreMate ?? line.mate ?? null;

      const before = new Chess(fenNow);
      const move = before.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4) || 'q',
      });
      if (!move) continue;

      const comment = describeMoveMotifs(fenNow, uci, cp);

      hints.push({
        san: move.san,
        uci,
        cp,
        mate,
        comment,
      });
    }

    if (!hints.length) {
      if (!jsHintFallback(fenNow)) flashNotice('No hint available in this position.');
      return;
    }

    setHintLines(hints);

    // Highlight best line on the board
    const best = hints[0];
    const fromSq = best.uci.slice(0, 2);
    const toSq = best.uci.slice(2, 4);
    setHintSquares({
      [fromSq]: {
        boxShadow: 'inset 0 0 0 3px rgba(96,165,250,.95)',
      },
      [toSq]: {
        boxShadow: 'inset 0 0 0 3px rgba(96,165,250,.95)',
        background: 'rgba(96,165,250,.35)',
      },
    });

    const listStr = hints.map((h) => h.san).join(', ');
    const extra = hints[0].comment ? ` — ${hints[0].comment}` : '';
    appendTip(`Hint: ${listStr}.${extra}`);
  } catch {
    // Hard failure: still try JS fallback before giving up.
    if (!jsHintFallback(fenNow)) {
      flashNotice('Engine error while computing a hint.');
    }
  } finally {
    setHintBusy(false);
  }
}, [sfRef, readyRef, withSFLock, flashNotice, myColor, botProfile, appendTip, jsHintFallback]);

  /* Online mode */

  // Award +8 for win, -8 for loss, 0 for draw — once per game; returns updated trophies.
  const awardOutcome = useCallback(async (kind) => {
    if (!user?._id || awardedRef.current) return null;
    try {
      const delta =
        kind === 'win'  ?  8 :
        kind === 'loss' ? -8 : 0;
      // Post result (server floors at 0)
      await axios.post(`${API_BASE_URL}/api/games/result`, {
        userId: user._id, gameKey: 'chess', delta, didWin: kind === 'win',
      });
      awardedRef.current = true;

      // 🔔 notify sidebar & other widgets to refresh immediately
      try {
        window.dispatchEvent(new CustomEvent('games:statsUpdated', { detail: { gameKey: 'chess' } }));
      } catch {}

      // Read back fresh trophies to ensure UI shows updated total
      const t = await fetchMyChessTrophies();
      return t;
    } catch {
      return null;
    }
  }, [user?._id, fetchMyChessTrophies]);

  // --- Online clocks state (10 minutes each; server-authoritative) ---
  const [wMs, setWms] = useState(600000);
  const [bMs, setBms] = useState(600000);
  const [clockSince, setClockSince] = useState(null); // when the last server sync arrived
  const [nowTs, setNowTs] = useState(Date.now());
  const clockSinceRef = useRef(null);
  const modeRef = useRef(mode);
  useEffect(() => { clockSinceRef.current = clockSince; }, [clockSince]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => {
    if (mode !== 'online' || !roomId) return;
    const id = setInterval(() => setNowTs(Date.now()), 200); // smooth UI countdown
    return () => clearInterval(id);
  }, [mode, roomId]);

  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;

    const envBase = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE)
      ? String(process.env.REACT_APP_API_BASE)
      : '';
    let WS_BASE =
      (API_BASE_URL && API_BASE_URL.trim()) ||
      (envBase && envBase.trim()) ||
      '';

    if (!WS_BASE) {
      // inside connectSocket()
      const { protocol, hostname, host } = window.location;
      const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(hostname);
      if (isLocal) {
        const srvPort = '5000';
        WS_BASE = `${protocol}//${hostname}:${srvPort}`;
      } else {
        WS_BASE = `${protocol}//${host}`;
      }
    }

    WS_BASE = WS_BASE.replace(/\/+$/, '').replace(/\/api\/?$/, '');

    // If the page itself is on a Cloudflare Tunnel, prefer SAME origin for sockets.
    try {
      const po = new URL(window.location.origin);
      const wb = new URL(WS_BASE);
      if (/trycloudflare\.com$/i.test(po.hostname) && po.hostname !== wb.hostname) {
        WS_BASE = po.origin;
      }
    } catch {}

    try { console.info('[Chess] WS_BASE =', WS_BASE); } catch {}

    const s = io(WS_BASE, {
      path: '/api/socket.io',
      // Start with HTTP long-polling so it always works through Cloudflare/carriers,
      // then Socket.IO will upgrade to websocket when available.
      transports: ['polling', 'websocket'],
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

    s.on('connect', () => {
      setStatus('Connected. Queueing…');
      const payload = { userId: user?._id, username: user?.username };
      s.emit('chess:queue', payload);
    });

    s.on('connect_error', (e) => setStatus(`Socket connect error: ${e?.message || e}`));
    s.on('error', (e) => setStatus(`Socket error: ${e?.message || e}`));
    s.on('chess:queued', () => setStatus('Looking for an opponent…'));

    s.on('chess:start', ({ roomId, color, fen, white, black, wMs, bMs }) => {
      chessRef.current = new Chess(fen || undefined);
      setFen(chessRef.current.fen());
      setOrientation(color === 'w' ? 'white' : 'black');
      colorRef.current = color === 'w' ? 'w' : 'b';
      lastTurnRef.current = chessRef.current.turn?.() || 'w';
      setRoomId(roomId);
      setMode('online');
      awardedRef.current = false;
      clearNotice();
      setTips([]);
      setOppName(color === 'w' ? (black?.username || 'Black') : (white?.username || 'White'));
      setStatus(`Match found: ${white?.username || 'White'} vs ${black?.username || 'Black'}. You are ${color==='w'?'White':'Black'}.`);
      recentFensRef.current = [chessRef.current.fen()];
      if (typeof wMs === 'number') setWms(wMs);
      if (typeof bMs === 'number') setBms(bMs);
      const now = Date.now();
      setClockSince(now);
      clockSinceRef.current = now;
      timeoutHandledRef.current = false;
    });

    s.on('chess:state', ({ fen, wMs, bMs }) => {
      /* Apply a local debit to the side that was running since the last sync
         without reading stale state from closures. */
      if (clockSinceRef.current && modeRef.current === 'online') {
        const delta = Math.max(0, Date.now() - clockSinceRef.current);
        if (lastTurnRef.current === 'w') setWms(prev => Math.max(0, prev - delta));
        else setBms(prev => Math.max(0, prev - delta));
      }
      try { chessRef.current.load(fen); setFen(fen); clearNotice(); } catch {}
      /* Prefer server-provided times if present; otherwise keep locally debited values */
      if (typeof wMs === 'number') setWms(wMs);
      if (typeof bMs === 'number') setBms(bMs);
      /* Update whose turn is now running and start a new local epoch */
      lastTurnRef.current = chessRef.current.turn?.() || lastTurnRef.current;
      const now = Date.now();
      setClockSince(now);
      clockSinceRef.current = now
    });

    s.on('chess:gameover', async ({ result, reason }) => {
      const txt = `Game over: ${result} (${reason})`;
      setStatus(txt);
      setRoomId(null);
      let trophiesOverride = null;
      const drawish = /draw|stalemate|½-½|1\/2-1\/2/i.test(result) || /draw/i.test(reason || '');
      let winColor = winnerFromText(result);
      // Fallback: if checkmate and no text winner, the side *not* to move wins.
      if (!winColor && chessRef.current?.isCheckmate?.()) {
        winColor = (chessRef.current.turn() === 'w') ? 'b' : 'w';
      }
      const mine = colorRef.current;
      const didWinBool = !drawish && !!winColor && (mine === winColor);
      trophiesOverride = await awardOutcome(drawish ? 'draw' : (didWinBool ? 'win' : 'loss'));
      await openResultModal(txt, trophiesOverride, didWinBool);
    });

    s.on('chess:queue-cancelled', () => setStatus('Queue cancelled.'));
    s.on('disconnect', () => setStatus('Disconnected.'));

    return s;
  }, [awardOutcome, clearNotice, openResultModal, user?._id, user?.username]);

  const startOnline = () => {
    setMode('online');
    resetLocal('white');
    setStatus('Connecting…');
    const s = connectSocket();
    if (s?.connected) {
      s.emit('chess:queue', { userId: user?._id, username: user?.username });
    }
  };

  useEffect(() => {
    if (mode !== 'online') return;
    const s = socketRef.current;
    if (!s) return;

    // If we're already in a match, do nothing (prevents "leave" during live games).
    if (roomId) return;

    let satisfied = false;
    const onQueued = () => { satisfied = true; };
    const onStart  = () => { satisfied = true; }; // treat a started game as success too

    s.on('chess:queued', onQueued);
    s.on('chess:start',  onStart);

    const t = setTimeout(() => {
      if (!satisfied && s.connected) {
        // Don't send 'leave' here; we only need to (re)queue.
        s.emit('chess:queue', { userId: user?._id, username: user?.username });
      }
    }, 1500);

    return () => {
      clearTimeout(t);
      s.off('chess:queued', onQueued);
      s.off('chess:start',  onStart);
    };
  }, [mode, roomId, user?._id, user?.username]);

  // Leave Online should RESIGN if a live match is in progress.
  const leaveOnline = useCallback(() => {
    const s = socketRef.current;

    // In an active game? Treat this as a proper resign so the result + trophies are correct.
    if (mode === 'online' && s && roomId) {
      s.emit('chess:resign', { roomId });
      setStatus('You resigned.');
      // Important: do NOT disconnect here. Wait for `chess:gameover`
      // so awardOutcome + modal flow run correctly.
      return;
    }

    // Not in a live game (e.g., still matchmaking/queued) — safe to leave & disconnect.
    if (s) {
      s.emit('chess:leave', { roomId });
      s.disconnect();
      socketRef.current = null;
    }
    setMode(null);
    setRoomId(null);
    setBotProfile(null);
    setStatus('Left online mode.');
    clearNotice();
  }, [mode, roomId, clearNotice]);

  /* helpers */
  const endMessage = (chess) => {
    if (chess.isCheckmate()) return `Checkmate. ${chess.turn()==='w' ? 'Black' : 'White'} wins.`;
    if (chess.isStalemate()) return 'Draw by stalemate.';
    if (chess.isThreefoldRepetition()) return 'Draw by threefold repetition.';
    if (chess.isInsufficientMaterial()) return 'Draw by insufficient material.';
    if (chess.isDraw()) return 'Draw.';
    return 'Game over.';
  };

  // Honor selected piece on promotion + keep premove choice
  // Honor selected piece on promotion + keep premove choice
  const onPieceDrop = async (source, target, piece) => {
    const chess = chessRef.current;

    // Track whether a tutorial popup was successfully shown for this move
    let tutorialOverlayShown = false;

    // Is this move a promotion from the current position?
    const isPromotion = chess
      .moves({ verbose: true })
      .some(m => m.from === source && m.to === target && m.flags && m.flags.includes('p'));
    // react-chessboard passes "piece" like "wQ", "bN" on promotion
    const chosen = (piece || '').slice(-1).toLowerCase(); // q|r|b|n
    const promotion = isPromotion && ['q','r','b','n'].includes(chosen) ? chosen : undefined;
    const mv = promotion ? { from: source, to: target, promotion } : { from: source, to: target };
    const isMyTurn = chess.turn() === myColor();

    if (!isMyTurn || (mode === 'bot' && botBusyRef.current)) {
      setPremove(mv); // keep the user’s choice for premoves too
      flashNotice(`Premove set: ${fmt(mv)}`, 900);
      return false;
    }

    try {
      const beforeFen = chess.fen();
      const move = chess.move(mv);
      if (!move) { 
        flashNotice('Illegal move. Try again.'); 
        return false; 
      }
      setFen(chess.fen());
      clearNotice();
      setPremove(null);
      setHintLines(null);
      setHintSquares({});

      if (mode === 'bot' && botProfile?.explain) {
        const last = chess.history({ verbose: true }).slice(-1)[0];
        const uci = last ? `${last.from}${last.to}${last.promotion || ''}` : '';

        if (botProfile?.key === 'tutorial') {
          // Tutorial mode: try to get a detailed explanation + popup
          let detail = null;
          try {
            detail = await analyzeMoveWithStockfish(
              sfRef,
              readyRef,
              withSFLock,
              beforeFen,
              uci
            );
          } catch (e) {
            console.error('Tutorial analyze failed', e);
          }

          if (detail) {
            tutorialOverlayShown = true; // ✅ we really showed the popup

            appendTip(`Your move ${last?.san}. ${detail.text}`);
            setLastMoveGrade({
              who: 'you',
              san: last?.san,
              label: detail.label,
              text: detail.text,
            });

            setTutorialOverlay({
              who: 'you',
              san: last?.san,
              label: detail.label,
              text: detail.text,
              from: last.from,
              to: last.to,
              beforeFen,
              bestUci: detail.bestUci,
              bestSan: detail.bestSan || detail.san,
            });
            setTutorialOverlayPos(null);
          } else {
            console.warn('Tutorial: no analysis detail, skipping popup.');
            // No popup → we’ll fall back to immediate botMove below
          }
        } else {
          // non-Tutorial bots keep the old behavior
          const msg = await gradeWithStockfish(
            sfRef,
            readyRef,
            withSFLock,
            beforeFen,
            uci
          );
          if (msg) {
            appendTip(`Your move ${last?.san}. ${msg}`);
            const label = msg.split(':')[0] || '';
            setLastMoveGrade({
              who: 'you',
              san: last?.san,
              label,
              text: msg,
            });
          }
        }
      }
    } catch {
      flashNotice('Illegal move. Try again.');
      return false;
    }

    if (mode === 'bot') {
      if (botProfile?.key === 'tutorial') {
        // In Tutorial mode, we normally wait until the user closes the tooltip.
        // But if we *didn't* manage to show one, just let the bot move immediately.
        if (chess.isGameOver()) {
          const txt = endMessage(chess);
          setStatus(txt);
          openResultModal(txt);
        } else if (!tutorialOverlayShown) {
          // ⬅️ fallback: no popup → don't stall the game
          botMove();
        }
      } else {
        if (!chess.isGameOver()) botMove();
        else {
          const txt = endMessage(chess);
          setStatus(txt);
          openResultModal(txt);
        }
      }
    } else if (mode === 'online' && socketRef.current && roomId) {
      /* Before we emit our move, locally debit our running clock so the UI
         continues smoothly without waiting for the server push. */
      if (clockSince) {
        const delta = Math.max(0, Date.now() - clockSince);
        if (myColor() === 'w') setWms(prev => Math.max(0, prev - delta));
        else setBms(prev => Math.max(0, prev - delta));
      }
      lastTurnRef.current = (myColor() === 'w') ? 'b' : 'w';  // after our move, opp runs
      setClockSince(Date.now());   
      socketRef.current.emit('chess:move', { roomId, ...mv });
    }
    return true;
  };

  const resign = () => {
    if (mode === 'online' && socketRef.current && roomId) socketRef.current.emit('chess:resign', { roomId });
    else if (mode === 'bot') {
      const txt = 'You resigned.';
      setStatus(txt);
      openResultModal(txt);
    }
  };

  /* Header/footer capture bars + clocks */
  const caps = capturedLists(chessRef.current);
  const delta = materialDelta(chessRef.current);
  const myCol  = myColor();                 // 'w' | 'b'
  const oppCol = (myCol === 'w') ? 'b' : 'w';
  const oppCap = (oppCol === 'w') ? caps.w : caps.b;
  const meCap  = (myCol  === 'w') ? caps.w : caps.b;
  const oppUpCp = (oppCol === 'w') ? delta : -delta; // + if opponent’s color is ahead
  const meUpCp  = (myCol  === 'w') ? delta : -delta;

  // live clocks (client-side view, server authoritative times)
  const turn = chessRef.current.turn ? chessRef.current.turn() : 'w';
  const elapsed = (mode === 'online' && clockSince) ? (nowTs - clockSince) : 0;
  const wLeft = Math.max(0, wMs - (mode==='online' && turn==='w' ? elapsed : 0));
  const bLeft = Math.max(0, bMs - (mode==='online' && turn==='b' ? elapsed : 0));
  const oppTime = (oppCol === 'w') ? wLeft : bLeft;
  const myTime  = (myCol  === 'w') ? wLeft : bLeft;
  const oppRunning = (mode === 'online' && turn === oppCol);
  const myRunning  = (mode === 'online' && turn === myCol);

  useEffect(() => {
    if (mode !== 'online' || !roomId || timeoutHandledRef.current) return;
    if (wLeft <= 0 || bLeft <= 0) {
      timeoutHandledRef.current = true;
      const loser = (wLeft <= 0) ? 'w' : 'b';
      const resultText = `Game over: ${loser === 'w' ? '0-1' : '1-0'} (flagged)`;
      try { socketRef.current?.emit?.('chess:timeout', { roomId, loser }); } catch {}
      setStatus(resultText);
      setRoomId(null);
      const didWin = (colorRef.current !== loser);
      openResultModal(resultText, null, didWin);
    }
  }, [wLeft, bLeft, mode, roomId, openResultModal]);

  useEffect(() => {
    if (!tutorialOverlay || !boardSize) return;

    setTutorialOverlayPos(prev => {
      if (prev?.userPlaced) return prev;

      const anchor = squareAnchor(tutorialOverlay.to, boardSize, orientation);
      if (!anchor) return prev;

      const pad = 18;
      let x = anchor.cx + (anchor.horizontal === "left" ? pad : -pad);
      let y = anchor.cy + (anchor.vertical === "top" ? pad : -pad);

      return { x, y, userPlaced: false };
    });
  }, [tutorialOverlay, boardSize, orientation]);

  const CaptRow = ({ name, caps, up, timeMs, running, trailing = null }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 13,
        padding: '6px 8px',
      }}
    >
      <strong>{name}</strong>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {typeof timeMs === 'number' && mode === 'online' && (
          <span
            style={{
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              color: running ? '#ffffff' : 'rgba(230,233,255,0.65)',
            }}
          >
            {fmtClock(timeMs)}
          </span>
        )}
        <span>
          {caps.map((t, i) => (
            <span key={i}>{pieceGlyph(t, 'w')}</span>
          ))}
        </span>
        {up > 0 && <span style={{ fontWeight: 700 }}>+{Math.round(up / 100)}</span>}
        {trailing}
      </div>
    </div>
  );
// Quality → square color (tutorial mode)
const QUALITY_COLORS = {
  brilliant: 'rgba(168, 85, 247, 0.55)',    // purple
  great:     'rgba(34, 197, 94, 0.55)',     // green
  best:      'rgba(45, 212, 191, 0.55)',    // teal
  excellent: 'rgba(74, 222, 128, 0.55)',    // light green
  good:      'rgba(132, 204, 22, 0.55)',    // lime
  book:      'rgba(56, 189, 248, 0.55)',    // sky
  inaccuracy:'rgba(250, 204, 21, 0.55)',    // yellow
  mistake:   'rgba(249, 115, 22, 0.55)',    // orange
  miss:      'rgba(251, 146, 60, 0.55)',    // softer orange
  blunder:   'rgba(248, 113, 113, 0.60)',   // red
};

// Convert "e4" → pixel center + quadrant for tooltip placement
function squareAnchor(square, boardSize, orientation = 'white') {
  if (!square || square.length < 2) return null;
  const files = 'abcdefgh';
  const file = square[0];
  const rank = parseInt(square[1], 10);
  if (!files.includes(file) || Number.isNaN(rank)) return null;

  let fx = files.indexOf(file);      // 0–7 from a→h
  let ry = rank - 1;                 // 0–7 from 1→8

  // Board coordinates: (0,0) is top-left of board pixels
  // react-chessboard uses orientation to flip visual squares, so we must match that.
  if (orientation === 'white') {
    // a1 bottom-left visually
    const yFromTop = 7 - ry;
    const xFromLeft = fx;
    fx = xFromLeft;
    ry = yFromTop;
  } else {
    // black at bottom: a1 is top-right
    const xFromLeft = 7 - fx;
    const yFromTop = ry;
    fx = xFromLeft;
    ry = yFromTop;
  }

  const sq = boardSize / 8;
  const cx = fx * sq + sq / 2;
  const cy = ry * sq + sq / 2;

  const horizontal = cx < boardSize / 2 ? 'left' : 'right';
  const vertical = cy < boardSize / 2 ? 'top' : 'bottom';

  return { cx, cy, horizontal, vertical };
}

/* Square style builder: premove, drag origin, legal targets, last move, in-check */
function buildSquareStyles(
  chess,
  { premoveSquares, dragFrom, hintSquares, tutorialOverlay }
) {
  const styles = {
    ...premoveSquares,
    ...hintSquares, // hint-from / hint-to highlight
  };

  // Highlight the origin square being dragged
  if (dragFrom) {
    styles[dragFrom] = {
      ...(styles[dragFrom] || {}),
      boxShadow: 'inset 0 0 0 3px rgba(234,88,12,.9)',
    };

    // Show legal targets for the dragged/selected piece
    const legal = chess.moves({ verbose: true }).filter(m => m.from === dragFrom);
    for (const m of legal) {
      const isCapture = m.flags?.includes('c') || m.flags?.includes('e'); // capture or en passant
      styles[m.to] = {
        ...(styles[m.to] || {}),
        // a small dot for quiet moves, a ring for captures
        background: isCapture
          ? 'radial-gradient(circle, rgba(0,0,0,0) 65%, rgba(59,130,246,.45) 66%)'
          : 'radial-gradient(circle, rgba(59,130,246,.35) 22%, rgba(0,0,0,0) 23%)',
        boxShadow: isCapture
          ? 'inset 0 0 0 3px rgba(59,130,246,.85)'
          : (styles[m.to]?.boxShadow || undefined),
        borderRadius: '2px',
      };
    }
  }

  // Highlight the last move (from & to squares)
  const last = chess.history({ verbose: true }).slice(-1)[0];
  if (last) {
    const base = 'rgba(251,191,36,.40)'; // default amber

    // If we have a tutorial overlay for THIS move, color-code it by quality
    let bgFrom = base;
    let bgTo = base;
    if (tutorialOverlay &&
        tutorialOverlay.from === last.from &&
        tutorialOverlay.to === last.to &&
        tutorialOverlay.label
    ) {
      const key = tutorialOverlay.label.toLowerCase();
      const col = QUALITY_COLORS[key];
      if (col) {
        bgFrom = col;
        bgTo = col;
      }
    }

    styles[last.from] = { ...(styles[last.from] || {}), background: bgFrom };
    styles[last.to]   = { ...(styles[last.to]   || {}), background: bgTo };
  }

  // If the side to move is in check, mark their king square
  const inCheck =
    (typeof chess.inCheck === 'function' && chess.inCheck()) ||
    (typeof chess.isCheck === 'function' && chess.isCheck()) ||
    (typeof chess.in_check === 'function' && chess.in_check()) ||
    (typeof chess.is_check === 'function' && chess.is_check()) || false;

  if (inCheck) {
    const board = chess.board();
    const tm = chess.turn?.() || 'w';
    let kingSq = null;
    for (let r = 0; r < 8 && !kingSq; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = board[r][c];
        if (sq && sq.type === 'k' && sq.color === tm) {
          const file = 'abcdefgh'[c];
          const rank = String(8 - r);
          kingSq = file + rank;
          break;
        }
      }
    }
    if (kingSq) {
      styles[kingSq] = {
        ...(styles[kingSq] || {}),
        boxShadow: 'inset 0 0 0 3px rgba(239,68,68,.9)',   // red ring
        background: 'rgba(239,68,68,.25)',
      };
    }
  }

  return styles;
}

// Use the builder to produce the object the board expects
const customSquareStyles = buildSquareStyles(chessRef.current, {
  premoveSquares,
  dragFrom,
  hintSquares,
  tutorialOverlay,
});
  const handleDismissTutorialOverlay = React.useCallback(() => {
    setTutorialOverlay(null);
    setHintLines(null);
    setHintSquares({});

    if (
      mode === 'bot' &&
      botProfile?.key === 'tutorial' &&
      !chessRef.current.isGameOver() &&
      chessRef.current.turn?.() === (myColor() === 'w' ? 'b' : 'w')
    ) {
      // After your move, dismissing the bubble lets the bot continue
      botMove();
    }
  }, [mode, botProfile, botMove, myColor]);

  const beginDragTutorialOverlay = useCallback((e) => {
    if (!tutorialOverlayPos || !boardRef.current || !tutorialOverlayRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    const boardRect = boardRef.current.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : e;

    tutorialDragRef.current = {
      offsetX: point.clientX - (boardRect.left + tutorialOverlayPos.x),
      offsetY: point.clientY - (boardRect.top + tutorialOverlayPos.y)
    };

    const onMove = (ev) => {
      const pt = "touches" in ev ? ev.touches[0] : ev;
      const rect = boardRef.current.getBoundingClientRect();
      const overlayRect = tutorialOverlayRef.current.getBoundingClientRect();

    let x = pt.clientX - rect.left - tutorialDragRef.current.offsetX;
    let y = pt.clientY - rect.top  - tutorialDragRef.current.offsetY;

    const w = overlayRect.width;
    const h = overlayRect.height;
    const pad = 8;

    // Because we render with transform: translate(-50%, -50%),
    // (x, y) is the *center* of the bubble, so clamp using half W/H.
    const minX = pad + w / 2;
    const maxX = rect.width - pad - w / 2;
    const minY = pad + h / 2;
    const maxY = rect.height - pad - h / 2;

    x = Math.max(minX, Math.min(x, maxX));
    y = Math.max(minY, Math.min(y, maxY));
 
    setTutorialOverlayPos({ x, y, userPlaced: true });
    };

    const end = () => {
      tutorialDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", end);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", end);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", end);
  }, [tutorialOverlayPos]);

  return (
    <>
      {/* Mobile top bar: games sidebar toggle + opponent summary */}
      <MobileTopBar>
        <DrawerButton
          onClick={() => setDrawerOpen(true)}
          aria-label="Open chess sidebar"
        >
          ➤
        </DrawerButton>

        <MobileOpponentPill>
          <MobileOpponentName>
            {oppName || (mode === 'bot' ? (botProfile?.label || 'Bot') : 'Opponent')}
          </MobileOpponentName>

          {mode === 'online' && (
            <MobileOpponentClock
              style={{
                opacity: oppTime > 0 ? 1 : 0.5,
              }}
            >
              {fmtClock(oppTime)}
            </MobileOpponentClock>
          )}
        </MobileOpponentPill>
      </MobileTopBar>
      <Wrap>
        <BoardPanel ref={panelRef}>
          <BoardViewport>
            <div
              ref={boardRef}
              style={{ position:'relative', width: boardSize, maxWidth:'100%', margin:'0 auto' }}
            >
              {/* Start overlay CTA on phones */}
              {showStartCTA && (
                <BoardOverlayCTA>
                  <div>
                    <Button onClick={openBotPicker}>Practice vs Bot</Button>
                    <Button $primary onClick={startOnline}>Play Online</Button>
                  </div>
                </BoardOverlayCTA>
              )}

              <Chessboard
                position={fen}
                onPieceDrop={onPieceDrop}
                autoPromoteToQueen={false}
                onPieceDragBegin={(_, from) => setDragFrom(from)}
                onPieceDragEnd={() => setDragFrom(null)}
                boardOrientation={orientation}
                boardWidth={boardSize}
                customBoardStyle={{ borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.08)' }}
                customSquareStyles={customSquareStyles}
                isDraggablePiece={({ piece }) => piece && piece[0] === myColor()}
                promotionDialogVariant="modal"
              />

              {/* Tutorial floating move explanation (like chess.com analysis) */}
              {mode === 'bot' &&
                botProfile?.key === 'tutorial' &&
                tutorialOverlay &&
                tutorialOverlayPos && (
                  <div
                    ref={tutorialOverlayRef}
                    style={{
                      position: 'absolute',
                      left: tutorialOverlayPos.x,
                      top: tutorialOverlayPos.y,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 10,
                      maxWidth: Math.min(260, boardSize - 24),
                      background: 'rgba(15,23,42,0.96)',
                      borderRadius: 10,
                      border: '1px solid rgba(148,163,184,0.7)',
                      padding: '8px 10px',
                      fontSize: 12,
                      color: 'rgba(226,232,240,0.96)',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.55)',
                    }}
                  >
                    {/* Drag handle row */}
                    <div
                      onMouseDown={beginDragTutorialOverlay}
                      onTouchStart={beginDragTutorialOverlay}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4,
                        cursor: 'move',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background:
                            QUALITY_COLORS[tutorialOverlay.label?.toLowerCase?.()] ||
                            'rgba(148,163,184,0.5)',
                          color: '#020617',
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                        }}
                      >
                        {tutorialOverlay.label}
                      </span>

                      <button
                        type="button"
                        onClick={handleDismissTutorialOverlay}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'rgba(148,163,184,0.9)',
                          cursor: 'pointer',
                          fontSize: 14,
                          fontWeight: 700,
                          lineHeight: 1,
                        }}
                        aria-label="Close explanation"
                      >
                        ×
                      </button>
                    </div>

                    {/* Body text */}
                    <div style={{ marginBottom: 6, lineHeight: 1.3 }}>
                      {tutorialOverlay.text}
                    </div>

                    {/* Buttons row */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-start',
                        gap: 6,
                        marginTop: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      {tutorialOverlay.bestUci &&
                        tutorialOverlay.label?.toLowerCase?.() !== 'book' && (
                          <button
                            type="button"
                            onClick={() => {
                              const uci = tutorialOverlay.bestUci;
                              const fromSq = uci.slice(0, 2);
                              const toSq = uci.slice(2, 4);

                              setHintSquares({
                                [fromSq]: {
                                  boxShadow: 'inset 0 0 0 3px rgba(96,165,250,.95)',
                                },
                                [toSq]: {
                                  boxShadow: 'inset 0 0 0 3px rgba(96,165,250,.95)',
                                  background: 'rgba(96,165,250,.35)',
                                },
                              });

                              setHintLines([
                                {
                                  san: tutorialOverlay.bestSan || 'Best move',
                                  uci: tutorialOverlay.bestUci,
                                  cp: null,
                                  mate: null,
                                  comment: 'Engine best move in this position.',
                                },
                              ]);
                            }}
                            style={{
                              borderRadius: 999,
                              padding: '3px 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              border: '1px solid rgba(148,163,184,0.7)',
                              background: 'rgba(15,23,42,0.8)',
                              color: 'rgba(226,232,240,0.95)',
                              cursor: 'pointer',
                            }}
                          >
                            View Best Move
                          </button>
                        )}

                      <button
                        type="button"
                        onClick={handleDismissTutorialOverlay}
                        style={{
                          borderRadius: 999,
                          padding: '3px 10px',
                          fontSize: 11,
                          fontWeight: 700,
                          border: '1px solid rgba(148,163,184,0.9)',
                          background: 'rgba(30,64,175,0.9)',
                          color: 'rgba(239,246,255,0.98)',
                          cursor: 'pointer',
                        }}
                      >
                        Continue
                      </button>

                      {tutorialOverlay.who === 'you' &&
                        !chessRef.current.isGameOver() &&
                        tutorialOverlay.beforeFen && (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                chessRef.current = new Chess(tutorialOverlay.beforeFen);
                                setFen(tutorialOverlay.beforeFen);
                              } catch {}
                              setTutorialOverlay(null);
                              setTutorialOverlayPos(null);
                              setHintLines(null);
                              setHintSquares({});
                            }}
                            style={{
                              borderRadius: 999,
                              padding: '3px 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              border: '1px solid rgba(248,113,113,0.8)',
                              background: 'rgba(127,29,29,0.85)',
                              color: '#fee2e2',
                              cursor: 'pointer',
                            }}
                          >
                            Retry Move
                          </button>
                        )}
                    </div>
                  </div>
                )}

            </div>
          </BoardViewport>

          {/* Desktop-only tutor controls under the board */}
          <DesktopBotControls>
            {mode === 'bot' && botProfile?.key !== 'tutorial' && (
              <>
                <div style={{ display: 'grid', gap: 8 }}>
                  <Button
                    onClick={requestHint}
                    style={{ padding: '8px 10px', opacity: hintBusy ? 0.7 : 1 }}
                    disabled={hintBusy}
                  >
                    {hintBusy ? 'Calculating Hint…' : 'Show Hint'}
                  </Button>
                  <Button
                    onClick={explainLastMove}
                    style={{ padding: '8px 10px' }}
                  >
                    Explain This Move
                  </Button>
                </div>

                {lastMoveGrade && (
                  <div
                    style={{
                      fontSize: 12,
                      padding: '6px 8px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'rgba(230,233,255,0.85)',
                    }}
                  >
                    <strong>Last move rating:</strong>{' '}
                    <span style={{ fontWeight: 700 }}>
                      {lastMoveGrade.label || '—'}
                    </span>{' '}
                    ({lastMoveGrade.who === 'you'
                      ? 'you'
                      : lastMoveGrade.who === 'bot'
                      ? (botProfile?.label || 'bot')
                      : 'opponent'}
                    , {lastMoveGrade.san})
                  </div>
                )}

                {hintLines && hintLines.length > 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      padding: '6px 8px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      background: 'rgba(15,23,42,0.85)',
                      color: 'rgba(226,232,240,0.9)',
                    }}
                  >
                    <strong>Top engine moves:</strong>
                    <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {hintLines.map((h, i) => (
                        <li key={i} style={{ margin: '2px 0' }}>
                          <span style={{ fontWeight: 600 }}>{h.san}</span>
                          {h.comment && <span> — {h.comment}</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </DesktopBotControls>

          <MobileStack>
            {/* your own username row, snug under the board */}
            <MobileStatsRow>
              <CaptRow
                name={user?.username || 'You'}
                caps={meCap}
                up={Math.max(0, meUpCp)}
                timeMs={myTime}
                running={myRunning}
              />
            </MobileStatsRow>

            <div style={{ display: 'grid', gap: 10 }}>
                  {mode === 'online' && (
                    <Button onClick={leaveOnline}>Leave Online</Button>
                  )}
                  {mode === 'bot' && botProfile?.key !== 'tutorial' && (
                    <>
                      <Button
                        onClick={requestHint}
                        style={{ padding: '8px 10px', opacity: hintBusy ? 0.7 : 1 }}
                        disabled={hintBusy}
                      >
                        {hintBusy ? 'Hint…' : 'Show Hint'}
                      </Button>
                      <Button
                        onClick={explainLastMove}
                        style={{ padding: '8px 10px' }}
                      >
                        Explain This Move
                      </Button>
                    </>
                  )}
                  <Button onClick={resign}>Resign</Button>

              <GameRules
                title="How to Play Chess"
                subtitle="Quick basics with examples."
                sections={[
                  { heading: 'Goal', text: 'Checkmate the enemy king (attack it so it can’t escape).' },
                  { heading: 'Setup', text: 'White starts. Pieces: ♔♕♖♖♗♗♘♘ + 8×♙ per side.' },
                  {
                    heading: 'Moves',
                    list: [
                      '♙ Pawns move forward 1 (2 from start), capture diagonally; en passant is allowed.',
                      '♘ Knights jump in an L-shape.',
                      '♗ Bishops along diagonals; ♖ rooks along files/ranks; ♕ both; ♔ one square.',
                      'Castling: king two squares toward a rook, rook jumps over; only if not in check, no pieces in between, and neither piece has moved.',
                      'Promotion: a pawn reaching last rank becomes a queen by default (or any piece).',
                    ],
                  },
                  {
                    heading: 'Draws',
                    list: ['Stalemate', 'Threefold repetition', 'Insufficient material', '50-move rule'],
                    note: 'Tip: Control the center and develop knights/bishops before moving the same piece twice.',
                  },
                ]}
                buttonText="📘 Rules"
                buttonTitle="Chess Rules"
                buttonStyle={{
                  position: 'static',
                  width: '100%',
                  boxShadow: 'none',
                  borderRadius: 10,
                  padding: '6px 10px',
                  background: 'rgba(255,255,255,0.06)',
                }}
              />

              <ReturnButton
                onClick={() => (typeof onExit === 'function' ? onExit() : null)}
                title="Return to Games"
              >
                <span className="icon">←</span>
                <span>Return to Games</span>
              </ReturnButton>
            </div>
          </MobileStack>
        </BoardPanel>
        {/* RIGHT: start/resign & rules in a sticky rail (same width as sidebar) */}
        <RightRailShell>
            <RightRailTopBar>
              <ReturnButton
                onClick={() => (typeof onExit === 'function' ? onExit() : null)}
                title="Return to Games"
              >
                <span className="icon">←</span>
                <span>Return to Games</span>
              </ReturnButton>
            </RightRailTopBar>
          <ControlsPanel>

          {/* Primary actions (compact; keep original size/spacing) */}
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <Button onClick={openBotPicker} style={{ padding: '10px 12px' }}>
              Practice vs Bot
            </Button>
            {mode !== 'online' ? (
              <Button $primary onClick={startOnline} style={{ padding: '10px 12px' }}>
                Play Online
              </Button>
            ) : (
              <Button onClick={leaveOnline} style={{ padding: '10px 12px' }}>
                Leave Online
              </Button>
            )}
            <Button onClick={resign} style={{ padding: '10px 12px' }}>
              Resign
            </Button>
          </div>

          {/* Status + Engine + Ranked note */}
          <div style={{ marginTop: 16, color: 'rgba(230,233,255,0.75)' }}>{status}</div>
          {!!notice && <Alert>{notice}</Alert>}
          {(!botProfile || botProfile.useSF) && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(230,233,255,0.65)' }}>
              Engine: <b>{sfStatus}</b>
            </div>
          )}

          {/* === Game stats (usernames, points, timers) === */}
          <div
            style={{
              marginTop: 10,
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              padding: '8px 10px',
              display: 'grid',
              gap: 6,
            }}
          >
            <div style={{ fontWeight: 800 }}>Game</div>

            {/* Opponent row; show Tutorial Logs button when using tutorial bot */}
            <CaptRow
              name={oppName || (mode === 'bot' ? (botProfile?.label || 'Bot') : 'Opponent')}
              caps={oppCap}
              up={Math.max(0, oppUpCp)}
              timeMs={oppTime}
              running={oppRunning}
              trailing={
                mode === 'bot' &&
                botProfile?.key === 'tutorial' &&
                tips.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowTutorialLog(true)}
                    style={{
                      borderRadius: 999,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      border: '1px solid rgba(129,140,248,0.9)',
                      background: 'rgba(15,23,42,0.9)',
                      color: 'rgba(191,219,254,0.98)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Tutorial Logs
                  </button>
                )
              }
            />

            <CaptRow
              name={user?.username || 'You'}
              caps={meCap}
              up={Math.max(0, meUpCp)}
              timeMs={myTime}
              running={myRunning}
            />
          </div>

          {premove && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⏭️ Premove queued: <b>{fmt(premove)}</b></span>
              <Button onClick={() => setPremove(null)} style={{ padding: '4px 8px', borderRadius: 8, fontSize: 12 }}>Clear</Button>
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(230,233,255,0.65)' }}>
            Wins vs real players grant <b>+8 trophies</b>. Bot games are unranked.
          </div>

          {/* Rules inside the right rail (not floating) */}
          <div style={{ marginTop: 12 }}>
            <GameRules
              title="How to Play Chess"
              subtitle="Quick basics with examples."
              sections={[
                { heading: 'Goal', text: 'Checkmate the enemy king (attack it so it can’t escape).' },
                { heading: 'Setup', text: 'White starts. Pieces: ♔♕♖♖♗♗♘♘ + 8×♙ per side.' },
                {
                  heading: 'Moves',
                  list: [
                    '♙ Pawns move forward 1 (2 from start), capture diagonally; en-passant is allowed.',
                    '♘ Knights jump in an L-shape.',
                    '♗ Bishops along diagonals; ♖ rooks along files/ranks; ♕ both; ♔ one square.',
                    'Castling: king two squares toward a rook, rook jumps over; only if not in check, no pieces in between, and neither piece has moved.',
                    'Promotion: a pawn reaching last rank becomes a queen by default (or any piece).',
                  ],
                },
                {
                  heading: 'Draws',
                  list: ['Stalemate', 'Threefold repetition', 'Insufficient material', '50-move rule'],
                  note: 'Tip: Control the center and develop knights/bishops before moving the same piece twice.',
                },
              ]}
              buttonText="📘 Rules"
              buttonTitle="Chess Rules"
              buttonStyle={{
                position: 'static',
                width: '100%',
                boxShadow: 'none',
                borderRadius: 10,
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.06)',
              }}
            />
          </div>
          </ControlsPanel>
        </RightRailShell>
      </Wrap>
      {drawerOpen && <DrawerBackdrop onClick={() => setDrawerOpen(false)} />}

      <Drawer $open={drawerOpen} role="complementary" aria-label="Chess sidebar">
        {/* X close button in the top-right of the drawer */}
        <div style={{display:'flex', justifyContent:'flex-end', marginBottom:8}}>
          <button
            type="button"
            onClick={handleDismissTutorialOverlay}
            aria-label="Close sidebar"
            style={{
              border: '1px solid var(--border-color)',
              background: 'var(--container-white)',
              borderRadius: 999,
              width: 36,
              height: 36,
              fontWeight: 900,
              lineHeight: 1,
              boxShadow: '0 8px 18px rgba(0,0,0,.12)'
            }}
          >
            ×
          </button>
        </div>

        <GameSidebar gameKey="chess" title="Chess" showOnMobile />
      </Drawer>
      {/* Bot picker */}
      {showPicker && (
        <Overlay onClick={() => setShowPicker(false)}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Select a bot mode</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
              Tutorial explains moves; other modes approximate player ratings.
            </div>
            <ModalGrid>
              <Button
                onClick={() => {
                  setShowPicker(false);
                  setShowTutorialSettings(true);
                }}
              >
                Tutorial
              </Button>
              <Button onClick={() => chooseBot('easy')}>Easy</Button>
              <Button onClick={() => chooseBot('medium')}>Medium</Button>
              <Button onClick={() => chooseBot('hard')}>Hard</Button>
              <Button onClick={() => chooseBot('elite')}>Elite</Button>
              <Button onClick={() => chooseBot('gm')}>Grandmaster</Button>
            </ModalGrid>
          </Modal>
        </Overlay>
      )}
      {/* Tutorial difficulty settings (shown after clicking Tutorial in picker) */}
      {showTutorialSettings && (
        <Overlay
          onClick={() => {
            setShowTutorialSettings(false);
            setShowPicker(true);
          }}
        >
          <Modal onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Tutorial difficulty</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
              Adjust the tutorial bot’s approximate rating. Higher rating = stronger play,
              but the bot will still explain your moves clearly.
            </div>

            <div style={{ marginTop: 14 }}>
              <label
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  marginBottom: 4,
                  color: 'rgba(148,163,184,0.95)',
                }}
              >
                <span>Bot rating</span>
                <span style={{ fontWeight: 700 }}>{tutorialElo}</span>
              </label>
              <input
                type="range"
                min={100}
                max={2000}
                step={100}
                value={tutorialElo}
                onChange={(e) => setTutorialElo(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  marginTop: 4,
                  color: 'rgba(148,163,184,0.9)',
                }}
              >
                <span>Beginner</span>
                <span>Intermediate</span>
                <span>Advanced</span>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <Button
                onClick={() => {
                  setShowTutorialSettings(false);
                  setShowPicker(true);
                }}
              >
                Back
              </Button>
              <Button $primary onClick={startTutorialWithElo}>
                Start Tutorial Game
              </Button>
            </div>
          </Modal>
        </Overlay>
      )}

      {/* Tutorial log modal (center screen) */}
      {showTutorialLog && (
        <Overlay onClick={() => setShowTutorialLog(false)}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
              Tutorial Logs
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              Move-by-move explanations for this tutorial game.
            </div>
            <div
              style={{
                maxHeight: 360,
                overflowY: 'auto',
                paddingRight: 4,
                marginTop: 4,
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                background: 'rgba(15,23,42,0.9)',
              }}
            >
              <ul style={{ margin: 0, padding: '8px 12px 10px 22px' }}>
                {[...tips].reverse().map((t, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 13,
                      color: 'rgba(226,232,240,0.9)',
                      margin: '4px 0',
                      lineHeight: 1.35,
                    }}
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setShowTutorialLog(false)}>Close</Button>
            </div>
          </Modal>
        </Overlay>
      )}

      {/* End-of-game modal */}
      {resultModal && (
        <Overlay onClick={() => setResultModal(null)}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
              {resultModal.didWin ? 'You win! 🎉' : /draw/i.test(resultModal.resultText) ? 'Draw' : 'You lose'}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{resultModal.resultText}</div>
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                marginTop: 10,
                padding: '8px 10px',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
              }}
            >
              <span style={{ fontWeight: 800 }}>🏆 {resultModal.trophies}</span>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  background: 'var(--primary-orange)',
                  color: '#000',
                }}
              >
                {resultModal.rank}
              </span>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(230,233,255,0.65)' }}>
              Overall leaderboard place: <b>#{resultModal.place ?? '—'}</b>
            </div>
            <ModalGrid style={{ marginTop: 12 }}>
              <Button
                onClick={() => {
                  setMode(null);
                  setRoomId(null);
                  setResultModal(null);
                  setStatus('Pick a mode to start.');
                }}
              >
                Back
              </Button>
              <Button
                onClick={() => {
                  setResultModal(null);
                  openBotPicker();
                }}
              >
                Play Bot Again
              </Button>
              <Button
                $primary
                onClick={() => {
                  setResultModal(null);
                  startOnline();
                }}
              >
                Matchmake Online
              </Button>
            </ModalGrid>
          </Modal>
        </Overlay>
      )}
    </>
  );
}
