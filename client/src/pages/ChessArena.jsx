// src/pages/ChessArena.jsx
import React, { useCallback, useEffect, useRef, useState, useContext } from 'react';
import styled from 'styled-components';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { io } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';
import { createStockfish } from '../engine/sfEngine';

/* Styles */
const Wrap = styled.div`display:grid; grid-template-columns: 480px 1fr; gap:16px; align-items:start;`;
const Panel = styled.div`border:1px solid var(--border-color); background:var(--container-white); border-radius:12px; padding:12px;`;
const Button = styled.button`
  padding: 8px 12px; border-radius: 10px; border: 1px solid #111; cursor: pointer;
  background: ${p=>p.$primary ? '#111' : '#fff'}; color: ${p=>p.$primary ? '#fff' : '#111'};
`;
const Alert = styled.div`
  margin-top: 10px; padding: 8px 10px; border-radius: 10px;
  border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; font-size: 13px;
`;
const Overlay = styled.div`
  position: fixed; inset:0; background: rgba(0,0,0,.28);
  display:flex; align-items:center; justify-content:center; z-index: 30;
`;
const Modal = styled.div`
  width: 540px; max-width: 94vw;
  background: #fff; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.18);
  border:1px solid #e5e7eb; padding:16px;
`;
const ModalGrid = styled.div`display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-top:10px;`;

/* Bot presets — tuned for ≤1s response */
const BOT_PRESETS = {
  tutorial:  { label: 'Tutorial', status: 'Tutorial bot: explains moves clearly.', useSF: true,  sf: { movetime: 250, depth: 12, multipv: 1 }, explain:true, thinkMs: 150 },
  easy:      { label: 'Easy (500)',   useSF: false, timeMs: 220, maxDepth: 2, randomness: 0.35, blunder: 0.10, thinkMs: 120 },
  medium:    { label: 'Medium (900)', useSF: false, timeMs: 280, maxDepth: 3, randomness: 0.18, blunder: 0.05, thinkMs: 140 },
  hard:      { label: 'Hard (1300)',  useSF: false, timeMs: 420, maxDepth: 4, randomness: 0.10, blunder: 0.02, thinkMs: 160 },
  elite:     { label: 'Elite (1700)', useSF: true,  sf: { movetime: 420, depth: 14 }, randomness: 0.02, thinkMs: 180 },
  gm:        { label: 'Grandmaster (2000+)', useSF: true, sf: { movetime: 520, depth: 18 }, randomness: 0.0, thinkMs: 200 },
};

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

/* --- JS search with anti-rook-shuffle --- */
function searchBestMove(chess, { timeMs=250, maxDepth=3, randomness=0, pruneAggressive=false }) {
  const deadline = Date.now() + timeMs;
  const killers = Array.from({length:128}, ()=>({a:null,b:null}));
  const history = new Map();
  const shouldStop = ()=> Date.now() > deadline;

  const recentFENs = new Set(); {
    const h = chess.history();
    const clone = new Chess();
    for (const san of h) { clone.move(san); recentFENs.add(clone.fen()); if (recentFENs.size > 10) break; }
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
      if (mv.piece === 'r' && corners.has(mv.to) && !mv.flags.includes('c')) score -= 140; // stop corner rook dance
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

    const ttK = ttKey(chess, depth);
    const cached = TT.get(ttK);
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
      TT.set(ttK, { score: best, bestUci: uci });
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
    orderMoves(moves);
    const filtered = moves.filter(m => !isBacktrackMove(chess, m));
    bestMove = (filtered[0] || moves[0]);
  }

  if (bestMove && randomness > 0) {
    const candidates = chess.moves({ verbose:true }).map(m=>{
      chess.move(m); const s = qsearch(-9999, 9999).score; chess.undo();
      return { m, s };
    }).sort((a,b)=> b.s - a.s);
    const k = Math.max(1, Math.min(6, Math.round(1 + randomness * (candidates.length-1))));
    bestMove = candidates[Math.floor(Math.random()*k)].m;
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
    const run = lockRef.current.then(fn, fn);
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

        await sf.init({ hash: 64, threads: 1, contempt: 0, multipv: 1 });
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

/* Fast grading for tutorial */
async function gradeWithStockfish(sfRef, readyRef, withSFLock, fen, uciPlayed) {
  try {
    const sf = sfRef.current;
    if (!sf || !readyRef.current) return '';

    const linesBefore = await withSFLock(() =>
      sf.analyze({ fen, movetime: 140, depth: 10, multipv: 1, hardLimitMs: 450 })
    );
    const beforeScore = linesBefore?.[0]?.scoreCp ?? 0;

    const after = new Chess(fen);
    after.move({ from: uciPlayed.slice(0,2), to: uciPlayed.slice(2,4), promotion: uciPlayed.slice(4) || 'q' });
    const linesAfter = await withSFLock(() =>
      sf.analyze({ fen: after.fen(), movetime: 140, depth: 10, multipv: 1, hardLimitMs: 450 })
    );
    const afterScoreOpp = linesAfter?.[0]?.scoreCp ?? 0;
    const delta = (-afterScoreOpp) - beforeScore;
    const abs = Math.abs(delta);

    let label = 'Alright';
    if (abs <= 12) label = 'Best';
    else if (delta <= -200) label = 'Brilliant';
    else if (delta <= -90) label = 'Great';
    else if (abs <= 90) label = 'Inaccuracy';
    else if (abs <= 200) label = 'Mistake';
    else label = 'Blunder';

    const san = new Chess(fen).move({ from: uciPlayed.slice(0,2), to: uciPlayed.slice(2,4), promotion: uciPlayed.slice(4) || 'q' })?.san || '';
    let text = `${label}: ${san}. `;
    if (label === 'Brilliant') text += 'Creative idea that outperforms shallow engine lines.';
    else if (label === 'Great' || label === 'Best') text += 'Strong, engine-approved continuation.';
    else if (label === 'Inaccuracy') text += 'Playable, but a more precise move keeps a larger edge.';
    else if (label === 'Mistake') text += 'This cedes the initiative or weakens your position.';
    else if (label === 'Blunder') text += 'Drops material or allows a decisive tactic.';
    return text;
  } catch {
    return '';
  }
}

/* Component */
export default function ChessArena() {
  const { user } = useContext(AuthContext);

  const [mode, setMode] = useState(null);
  const [fen, setFen] = useState(new Chess().fen());
  const [orientation, setOrientation] = useState('white');
  const [status, setStatus] = useState('Pick a mode to start.');
  const [notice, setNotice] = useState('');
  const [roomId, setRoomId] = useState(null);
  const socketRef = useRef(null);

  const [showPicker, setShowPicker] = useState(false);
  const [botProfile, setBotProfile] = useState(null);
  const [tips, setTips] = useState([]);
  const chessRef = useRef(new Chess());
  const awardedRef = useRef(false);
  const noticeTimer = useRef(null);

  // NEW: end-of-game modal & naming
  const [resultModal, setResultModal] = useState(null); // { didWin, resultText, trophies, rank }
  const [oppName, setOppName] = useState('');
  const myColor = useCallback(
    () => (orientation === 'white' ? 'w' : 'b'),
    [orientation]
  );

  // NEW: rules modal state
  const [showRules, setShowRules] = useState(false);

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
  }, [clearNotice]);

  const openBotPicker = () => {
    setMode('bot');
    setRoomId(null);
    resetLocal('white');
    setStatus('Select a bot mode to begin. You are White.');
    setShowPicker(true);
  };
  const chooseBot = (key) => {
    const profile = BOT_PRESETS[key];
    setBotProfile({ key, ...profile });
    setShowPicker(false);
    setStatus(profile.status || `${profile.label}: You are White.`);
    setOppName(profile.label || 'Bot');
  };
  const appendTip = useCallback((text) => {
    setTips(prev => [text, ...prev].slice(0, 6));
  }, [setTips]);
  const fmt = (m) => m ? `${m.from}→${m.to}` : '';

  /* Try to execute premove if legal */
  const tryPremove = useCallback(async () => {
    if (!premove) return false;
    const chess = chessRef.current;
    if (chess.isGameOver()) { setPremove(null); return false; }
    if (chess.turn() !== myColor()) return false;

    const mv = { from: premove.from, to: premove.to, promotion: premove.promotion || 'q' };
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

    if (mode === 'bot' && botProfile?.explain && sfRef.current && readyRef.current) {
      const beforeFen = moved.before || '';
      try {
        const last = chess.history({ verbose:true }).slice(-1)[0];
        const uci = last ? `${last.from}${last.to}${last.promotion || ''}` : '';
        const msg = await gradeWithStockfish(sfRef, readyRef, withSFLock, beforeFen || '', uci);
        if (msg) appendTip(`Your move ${last?.san}. ${msg}`);
      } catch {}
    }

    if (mode === 'bot' && !chess.isGameOver()) {
      botMove();
    } else if (mode === 'online' && socketRef.current && roomId) {
      socketRef.current.emit('chess:move', { roomId, ...mv });
    }
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premove, mode, botProfile, roomId, sfRef, readyRef, withSFLock, myColor]);

  /* Safer SF best move with fallback (prevents GM crash) */
  const fastBestMove = useCallback(async (fenStr, p) => {
    if (!sfRef.current || !readyRef.current) {
      const clone = new Chess(fenStr);
      const { move } = searchBestMove(clone, { timeMs: 240, maxDepth: 3, randomness: p.randomness || 0 });
      return move ? `${move.from}${move.to}${move.promotion || ''}` : null;
    }
    const sfParams = { fen: fenStr, movetime: p.sf?.movetime ?? 520, depth: p.sf?.depth, hardLimitMs: Math.min(1100, (p.sf?.movetime ?? 520) + 400) };
    try {
      const uci = await withSFLock(() => sfRef.current.bestMove(sfParams));
      if (typeof uci !== 'string' || uci.length < 4) throw new Error('bad uci');
      return uci;
    } catch {
      const clone = new Chess(fenStr);
      const { move } = searchBestMove(clone, { timeMs: 260, maxDepth: 3, randomness: p.randomness || 0 });
      return move ? `${move.from}${move.to}${move.promotion || ''}` : null;
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

  const openResultModal = useCallback(async (resultText) => {
    const isDraw = /draw/i.test(resultText);
    const winner = /white wins/i.test(resultText) ? 'w'
                  : (/black wins/i.test(resultText) ? 'b' : null);
    const didWin = !isDraw && winner && (winner === myColor());
    const trophies = await fetchMyChessTrophies();
    setResultModal({ didWin, resultText, trophies, rank: perGameRank(trophies) });
  }, [fetchMyChessTrophies, myColor]);

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
        const uciMove = await fastBestMove(beforeFen, p);
        if (!uciMove) { setBusy(false); return; }
        chess.move({ from: uciMove.slice(0,2), to: uciMove.slice(2,4), promotion: uciMove.slice(4) || 'q' });
        setFen(chess.fen());

        if (p.explain) {
          const msg = await gradeWithStockfish(sfRef, readyRef, withSFLock, beforeFen, uciMove);
          const san = chess.history().slice(-1)[0];
          if (msg) appendTip(`Bot move ${san}. ${msg}`);
        }
        if (chess.isGameOver()) { 
          const txt = endMessage(chess);
          setStatus(txt);
          openResultModal(txt);
          return; 
        }
      } else {
        const res = searchBestMove(chess, {
          timeMs: p.timeMs, maxDepth: p.maxDepth,
          randomness: p.randomness || 0, pruneAggressive: !!p.pruneAggressive
        });
        const m = res.move;
        if (!m) {
          const moves = chess.moves({ verbose:true });
          if (moves.length === 0) return;
          chess.move(moves[0]);
        } else {
          chess.move(m);
        }
        setFen(chess.fen());
        if (p.explain && m?.san) appendTip(`Bot move ${m.san}. Strong practical choice.`);
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
  }, [botProfile, fastBestMove, tryPremove, appendTip, sfRef, readyRef, withSFLock, openResultModal]);

  /* Online mode */
  const awardWin = useCallback(async () => {
    if (!user?._id || awardedRef.current) return;
    try {
      await axios.post(`${API_BASE_URL}/api/games/result`, {
        userId: user._id, gameKey: 'chess', delta: 6, didWin: true,
      });
      awardedRef.current = true;
    } catch {}
  }, [user?._id]);

  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const s = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => setStatus('Connected. Queueing…'));
    s.on('chess:queued', () => setStatus('Looking for an opponent…'));
    s.on('chess:start', ({ roomId, color, fen, white, black }) => {
      chessRef.current = new Chess(fen || undefined);
      setFen(chessRef.current.fen());
      setOrientation(color === 'w' ? 'white' : 'black');
      setRoomId(roomId);
      setMode('online');
      awardedRef.current = false;
      clearNotice();
      setTips([]);
      setOppName(color === 'w' ? (black?.username || 'Black') : (white?.username || 'White'));
      setStatus(`Match found: ${white?.username || 'White'} vs ${black?.username || 'Black'}. You are ${color==='w'?'White':'Black'}.`);
    });
    s.on('chess:state', ({ fen }) => {
      try { chessRef.current.load(fen); setFen(fen); clearNotice(); } catch {}
    });
    s.on('chess:gameover', ({ result, reason }) => {
      const txt = `Game over: ${result} (${reason})`;
      setStatus(txt);
      if (mode === 'online') {
        const winColor = /white wins/i.test(result) ? 'w' : (/black wins/i.test(result) ? 'b' : null);
        if (winColor && myColor() === winColor) awardWin();
      }
      openResultModal(txt);
    });
    s.on('chess:queue-cancelled', () => setStatus('Queue cancelled.'));
    s.on('disconnect', () => setStatus('Disconnected.'));
    return s;
  }, [mode, awardWin, clearNotice, openResultModal, myColor]);

  const startOnline = () => {
    setMode('online');
    resetLocal('white');
    const s = connectSocket();
    s.emit('chess:queue', { userId: user?._id, username: user?.username });
  };

  const leaveOnline = () => {
    const s = socketRef.current;
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
  };

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    };
  }, []);

  /* helpers */
  const endMessage = (chess) => {
    if (chess.isCheckmate()) return `Checkmate. ${chess.turn()==='w' ? 'Black' : 'White'} wins.`;
    if (chess.isStalemate()) return 'Draw by stalemate.';
    if (chess.isThreefoldRepetition()) return 'Draw by threefold repetition.';
    if (chess.isInsufficientMaterial()) return 'Draw by insufficient material.';
    if (chess.isDraw()) return 'Draw.';
    return 'Game over.';
  };

  /* onPieceDrop with premove */
  const onPieceDrop = async (source, target) => {
    const chess = chessRef.current;
    const mv = { from: source, to: target, promotion: 'q' };
    const isMyTurn = chess.turn() === myColor();

    if (!isMyTurn || (mode === 'bot' && botBusyRef.current)) {
      setPremove(mv);
      flashNotice(`Premove set: ${fmt(mv)}`, 900);
      return false;
    }

    try {
      const beforeFen = chess.fen();
      const move = chess.move(mv);
      if (!move) { flashNotice('Illegal move. Try again.'); return false; }
      setFen(chess.fen());
      clearNotice();
      setPremove(null);

      if (mode === 'bot' && botProfile?.explain) {
        const last = chess.history({ verbose:true }).slice(-1)[0];
        const uci = last ? `${last.from}${last.to}${last.promotion || ''}` : '';
        const msg = await gradeWithStockfish(sfRef, readyRef, withSFLock, beforeFen, uci);
        if (msg) appendTip(`Your move ${last?.san}. ${msg}`);
      }
    } catch {
      flashNotice('Illegal move. Try again.');
      return false;
    }

    if (mode === 'bot') {
      if (!chess.isGameOver()) botMove();
      else { const txt = endMessage(chess); setStatus(txt); openResultModal(txt); }
    } else if (mode === 'online' && socketRef.current && roomId) {
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

  /* Header/footer capture bars */
  const caps = capturedLists(chessRef.current);
  const delta = materialDelta(chessRef.current);
  const oppIsWhite = (myColor() === 'b');
  const oppCap = oppIsWhite ? caps.w : caps.b;
  const meCap  = oppIsWhite ? caps.b : caps.w;
  const oppUpCp  = (oppIsWhite ? -delta : delta); // centipawns if opponent ahead
  const meUpCp   = (oppIsWhite ? delta : -delta);  // our edge if ahead

  const CaptRow = ({ name, caps, up }) => (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13, padding:'6px 8px'}}>
      <strong>{name}</strong>
      <div style={{display:'flex', alignItems:'center', gap:6}}>
        <span>{caps.map((t,i)=><span key={i}>{pieceGlyph(t, 'w')}</span>)}</span>
        {up>0 && <span style={{fontWeight:700}}>+{Math.round(up/100)}</span>}
      </div>
    </div>
  );

  // Merge square styles: premove + drag origin
  const customSquareStyles = {
    ...premoveSquares,
    ...(dragFrom ? { [dragFrom]: { boxShadow: 'inset 0 0 0 3px rgba(234,88,12,.9)' } } : {})
  };

  return (
    <>
      <Wrap>
        <Panel>
          <CaptRow name={oppName || (mode==='bot' ? (botProfile?.label || 'Bot') : 'Opponent')} caps={oppCap} up={Math.max(0, oppUpCp)} />
          <Chessboard
            position={fen}
            onPieceDrop={onPieceDrop}
            onPieceDragBegin={(_, from) => setDragFrom(from)}
            onPieceDragEnd={() => setDragFrom(null)}
            boardOrientation={orientation}
            boardWidth={456}
            customBoardStyle={{ borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.08)' }}
            customSquareStyles={customSquareStyles}
            isDraggablePiece={({ piece }) => piece && piece[0] === myColor()}
          />
          <CaptRow name={user?.username || 'You'} caps={meCap} up={Math.max(0, meUpCp)} />
        </Panel>

        <Panel>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <Button onClick={openBotPicker}>Practice vs Bot</Button>
            {mode !== 'online' ? (
              <Button $primary onClick={startOnline}>Play Online</Button>
            ) : (
              <Button onClick={leaveOnline}>Leave Online</Button>
            )}
            <Button onClick={resign}>Resign</Button>
          </div>
          <div style={{marginTop:10, color:'#555'}}>{status}</div>
          {!!notice && <Alert>{notice}</Alert>}

          {(!botProfile || botProfile.useSF) && (
            <div style={{marginTop:8, fontSize:12, color:'#6b7280'}}>
              Engine: <b>{sfStatus}</b>
            </div>
          )}

          {premove && (
            <div style={{marginTop:8, fontSize:12, color:'#1f2937', display:'flex', alignItems:'center', gap:8}}>
              <span>⏭️ Premove queued: <b>{fmt(premove)}</b></span>
              <Button onClick={()=> setPremove(null)} style={{padding:'4px 8px', borderRadius:8, fontSize:12}}>Clear</Button>
            </div>
          )}

          {botProfile?.explain && tips.length > 0 && (
            <div style={{marginTop:10, padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:10, background:'#fafafa'}}>
              <div style={{fontWeight:600, marginBottom:6}}>Tutorial</div>
              <ul style={{margin:0, paddingLeft:18}}>
                {tips.map((t,i)=> <li key={i} style={{fontSize:13, color:'#374151', margin:'4px 0'}}>{t}</li>)}
              </ul>
            </div>
          )}
          <div style={{marginTop:12, fontSize:12, color:'#6b7280'}}>
            Wins vs real players grant <b>+6 trophies</b>. Bot games are unranked.
          </div>
        </Panel>
      </Wrap>

      {/* Floating Rules button */}
      <button
        onClick={()=>setShowRules(true)}
        style={{position:'fixed', right:24, bottom:24, zIndex:20, border:'1px solid var(--border-color)', background:'#fff',
                borderRadius:12, padding:'8px 12px', boxShadow:'0 8px 24px rgba(0,0,0,.06)'}}
        title="Basic Chess Rules"
      >📘 Rules</button>

      {/* Bot picker */}
      {showPicker && (
        <Overlay onClick={()=>setShowPicker(false)}>
          <Modal onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18, fontWeight:700}}>Select a bot mode</div>
            <div style={{fontSize:13, color:'#6b7280', marginTop:4}}>
              Tutorial explains moves; other modes approximate player ratings.
            </div>
            <ModalGrid>
              <Button onClick={()=>chooseBot('tutorial')}>Tutorial</Button>
              <Button onClick={()=>chooseBot('easy')}>Easy</Button>
              <Button onClick={()=>chooseBot('medium')}>Medium</Button>
              <Button onClick={()=>chooseBot('hard')}>Hard</Button>
              <Button onClick={()=>chooseBot('elite')}>Elite</Button>
              <Button onClick={()=>chooseBot('gm')}>Grandmaster</Button>
            </ModalGrid>
          </Modal>
        </Overlay>
      )}

      {/* End-of-game modal */}
      {resultModal && (
        <Overlay onClick={()=>setResultModal(null)}>
          <Modal onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18, fontWeight:800, marginBottom:6}}>
              {resultModal.didWin ? 'You win! 🎉' : /draw/i.test(resultModal.resultText) ? 'Draw' : 'You lose'}
            </div>
            <div style={{fontSize:13, color:'#6b7280'}}>{resultModal.resultText}</div>
            <div style={{display:'flex', gap:10, alignItems:'center', marginTop:10, padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:10}}>
              <span style={{fontWeight:800}}>🏆 {resultModal.trophies}</span>
              <span style={{padding:'3px 10px', borderRadius:999, fontSize:12, fontWeight:800, background:'#111', color:'#fff'}}>
                {resultModal.rank}
              </span>
            </div>
            <ModalGrid style={{marginTop:12}}>
              <Button onClick={()=>{ setMode(null); setRoomId(null); setResultModal(null); setStatus('Pick a mode to start.'); }}>Back</Button>
              <Button onClick={()=>{ setResultModal(null); openBotPicker(); }}>Play Bot Again</Button>
              <Button $primary onClick={()=>{ setResultModal(null); startOnline(); }}>Matchmake Online</Button>
            </ModalGrid>
          </Modal>
        </Overlay>
      )}

      {/* Rules modal */}
      {showRules && (
        <Overlay onClick={()=>setShowRules(false)}>
          <Modal onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18, fontWeight:800}}>How to Play Chess</div>
            <div style={{fontSize:13, color:'#6b7280', marginTop:4}}>Quick basics with examples.</div>
            <div style={{display:'grid', gap:10, marginTop:10, fontSize:14}}>
              <div><b>Goal:</b> Checkmate the enemy king (attack it so it can’t escape).</div>
              <div><b>Setup:</b> White starts. Pieces: ♔♕♖♖♗♗♘♘ + 8×♙ per side.</div>
              <div><b>Moves:</b>
                <ul style={{margin:'6px 0 0 18px'}}>
                  <li>♙ Pawns move forward 1 (2 from start), capture diagonally; en-passant is allowed.</li>
                  <li>♘ Knights jump in an L-shape.</li>
                  <li>♗ Bishops along diagonals; ♖ Rooks along ranks/files; ♕ both; ♔ one square.</li>
                  <li><b>Castling:</b> King two squares toward a rook, rook jumps over (no check/no through check, no moved pieces).</li>
                  <li><b>Promotion:</b> A pawn reaching last rank becomes ♕ (default) or any piece.</li>
                </ul>
              </div>
              <div><b>Draws:</b> Stalemate, threefold repetition, insufficient material, 50-move rule.</div>
              <div style={{fontSize:12, color:'#6b7280'}}>Tip: Control the center and develop ♘/♗ before moving the same piece twice.</div>
            </div>
          </Modal>
        </Overlay>
      )}
    </>
  );
}
