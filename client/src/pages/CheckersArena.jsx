import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from 'styled-components';
import { io } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';
import GameRules from '../components/GameRules';

/* ---------- shared look & feel ---------- */
const Wrap = styled.div`display:grid; grid-template-columns: 460px 1fr; gap:16px; align-items:start;`;
const Panel = styled.div`
  border:1px solid var(--border-color); background:var(--container-white);
  border-radius:12px; padding:12px;
`;
const Button = styled.button`
  padding: 8px 12px; border-radius: 10px; border: 1px solid #111; cursor: pointer;
  background: ${p=>p.$primary ? '#111' : '#fff'}; color: ${p=>p.$primary ? '#fff' : '#111'};
`;
const Alert = styled.div`
  margin-top: 10px; padding: 8px 10px; border-radius: 10px;
  border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; font-size: 13px;
`;

const Overlay = styled.div`
  position: fixed; inset: 0; display: grid; place-items: center;
  background: rgba(0,0,0,.4); z-index: 50;
`;
const Modal = styled.div`
  width: 520px; max-width: 94vw;
  background: #fff; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.18);
  border:1px solid #e5e7eb; padding:16px;
`;
const ModalGrid = styled.div`display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-top:10px;`;

/* ---------- rules helpers ---------- */
const DARK = '#b58863';
const LIGHT = '#f0d9b5';
const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const isKing = (p) => p === 'W' || p === 'B';
const colorOf = (p) => (p === 'w' || p === 'W') ? 'w' : (p === 'b' || p === 'B') ? 'b' : null;

function makeInitialBoard() {
  const B = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) B[r][c] = 'b';
  for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) B[r][c] = 'w';
  return B;
}
const clone = (B) => B.map(row => row.slice());
function legalMovesFor(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const color = colorOf(piece);
  const king = isKing(piece);

  const dirs = [];
  if (king || color === 'w') dirs.push([-1, -1], [-1, 1]);
  if (king || color === 'b') dirs.push([1, -1], [1, 1]);

  const moves = [];
  // quiet moves
  for (const [dr, dc] of dirs) {
    const r2 = r + dr, c2 = c + dc;
    if (!inBounds(r2, c2)) continue;
    if ((r2 + c2) % 2 !== 1) continue;
    if (board[r2][c2] == null) moves.push({ from: [r, c], to: [r2, c2] });
  }
  // captures
  for (const [dr, dc] of dirs) {
    const mr = r + dr, mc = c + dc;
    const r2 = r + 2 * dr, c2 = c + 2 * dc;
    if (!inBounds(mr, mc) || !inBounds(r2, c2)) continue;
    if ((r2 + c2) % 2 !== 1) continue;
    const mid = board[mr][mc];
    if (mid && colorOf(mid) !== color && board[r2][c2] == null) {
      moves.push({ from: [r, c], to: [r2, c2], capture: [mr, mc] });
    }
  }
  return moves;
}
const captureMovesFor = (B, r, c) => legalMovesFor(B, r, c).filter(m => !!m.capture);
const allMoves = (B, color) => {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = B[r][c]; if (!p || colorOf(p) !== color) continue;
    out.push(...legalMovesFor(B, r, c));
  }
  return out;
};
function applyMove(board, move) {
  const b = clone(board);
  const [r1, c1] = move.from; const [r2, c2] = move.to;
  const piece = b[r1][c1];
  b[r1][c1] = null;
  if (move.capture) {
    const [mr, mc] = move.capture;
    b[mr][mc] = null;
  }
  let newPiece = piece;
  if (piece === 'w' && r2 === 0) newPiece = 'W';
  else if (piece === 'b' && r2 === 7) newPiece = 'B';
  b[r2][c2] = newPiece;
  const justPromoted = !isKing(piece) && isKing(newPiece);
  return { board: b, to: [r2, c2], justPromoted };
}
const hasAnyPieces = (board, color) => {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (board[r][c] && colorOf(board[r][c]) === color) return true;
  }
  return false;
};

/* ---------- Board (rotation + **stable drag**) ---------- */
// Memoized inner to avoid re-rendering on every clock tick
function CheckersBoardInner({ board, onTryMove, orientation='white', onIllegal, boardSize=432 }) {
  const [sel, setSel] = useState(null);

  // latest refs so handlers stay stable
  const onTryMoveRef = useRef(onTryMove);
  useEffect(() => { onTryMoveRef.current = onTryMove; }, [onTryMove]);

  const orientationRef = useRef(orientation);
  useEffect(() => { orientationRef.current = orientation; }, [orientation]);

  const [drag, setDrag] = useState(null); // { from:[r,c], x,y,startX,startY,moved,rect,piece }
  const dragRef = useRef(null);
  const boardRef = useRef(null);
  const latestBoardRef = useRef(board);
  useEffect(() => { latestBoardRef.current = board; }, [board]);
  useEffect(() => { dragRef.current = drag; }, [drag]);

  const sq = Math.floor(boardSize / 8);
  const size = 8 * sq;

  const mapDisplayToLogical = useCallback((dr, dc) => {
    return orientationRef.current === 'white' ? [dr, dc] : [7 - dr, 7 - dc];
  }, []);

  const legalForSel = useMemo(() => {
    if (!sel) return [];
    return legalMovesFor(board, sel[0], sel[1]);
  }, [board, sel]);

  const clickSquare = (r, c) => {
    const p = board[r][c];
    if (p) { setSel([r, c]); return; }
    if (!sel) return;
    const candidate = legalForSel.find(m => m.to[0] === r && m.to[1] === c);
    if (!candidate) return onIllegal?.('Illegal move.');
    const ok = onTryMoveRef.current?.(candidate);
    if (ok) setSel(null);
  };

  const pointToLogicalSquare = useCallback((clientX, clientY) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const cell = rect.width / 8;
    const dc = Math.floor((clientX - rect.left) / cell);
    const dr = Math.floor((clientY - rect.top) / cell);
    if (!inBounds(dr, dc)) return null;
    return mapDisplayToLogical(dr, dc);
  }, [mapDisplayToLogical]);

  const onWindowPointerMove = useCallback((e) => {
    setDrag(d => {
      if (!d) return d;
      const dx = Math.abs(e.clientX - d.startX);
      const dy = Math.abs(e.clientY - d.startY);
      const moved = d.moved || (dx > 3 || dy > 3);
      return { ...d, x: e.clientX, y: e.clientY, moved };
    });
  }, []);

  const onWindowPointerUp = useCallback((e) => {
    window.removeEventListener('pointermove', onWindowPointerMove);
    window.removeEventListener('pointerup', onWindowPointerUp);
    const prev = dragRef.current;
    setDrag(null);
    if (!prev) return;

    const to = pointToLogicalSquare(e.clientX, e.clientY);
    if (!to) return;
    const [r, c] = to;

    const boardNow = latestBoardRef.current;
    const moves = legalMovesFor(boardNow, prev.from[0], prev.from[1]);
    const candidate = moves.find(m => m.to[0] === r && m.to[1] === c);
    if (candidate) {
      const ok = onTryMoveRef.current?.(candidate);
      if (ok) setSel(null);
    }
  }, [onWindowPointerMove, pointToLogicalSquare]);

  const onPiecePointerDown = (e, r, c) => {
    e.preventDefault();
    const piece = board[r][c];
    if (!piece) return;
    setSel([r, c]);
    const rect = boardRef.current?.getBoundingClientRect();
    // snapshot piece so `toLowerCase()` never sees null mid-drag
    setDrag({ from: [r, c], x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false, rect, piece });
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
    };
  }, [onWindowPointerMove, onWindowPointerUp]);

  const renderPiece = (p) => {
    if (!p) return null;
    const king = p === 'W' || p === 'B';
    const fill = p.toLowerCase() === 'w' ? '#fafafa' : '#222';
    const stroke = p.toLowerCase() === 'w' ? '#ddd' : '#333';
    return (
      <svg width={sq} height={sq} viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="34" fill={fill} stroke={stroke} strokeWidth="6" />
        {king && (
          <text x="50" y="60" textAnchor="middle" fontWeight="900" fontSize="44" fontFamily="system-ui" fill={p.toLowerCase()==='w' ? '#111' : '#fff'}>K</text>
        )}
      </svg>
    );
  };

  const cells = [];
  for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++) cells.push([dr, dc]);

  const floating = drag ? renderPiece(drag.piece ?? board[drag.from[0]]?.[drag.from[1]]) : null;
  const draggingKey = drag?.from ? `${drag.from[0]}-${drag.from[1]}` : null;

  return (
    <div
      ref={boardRef}
      style={{
        width:size, height:size, borderRadius:12, overflow:'hidden',
        boxShadow:'0 8px 24px rgba(0,0,0,.08)', border:'1px solid var(--border-color)',
        position:'relative'
      }}
    >
      <div style={{ display:'grid', gridTemplateColumns:'repeat(8, 1fr)', gridTemplateRows:'repeat(8, 1fr)' }}>
        {cells.map(([dr,dc]) => {
          const [r,c] = mapDisplayToLogical(dr, dc);
          const dark = (dr+dc) % 2 === 1;
          const selected = sel && sel[0] === r && sel[1] === c;
          const movesForSel = sel ? legalMovesFor(board, sel[0], sel[1]) : [];
          const canGo = !!(sel && movesForSel.find(m => m.to[0] === r && m.to[1] === c));
          const piece = board[r][c];
          const key = `${r}-${c}`;
          const isBeingDragged = draggingKey === key;

          return (
            <div
              key={`${dr}-${dc}`}
              style={{
                width:sq, height:sq, background: dark ? DARK : LIGHT,
                position:'relative', outline: sel ? (selected ? '3px solid #0ea5e9' : 'none') : 'none'
              }}
              onClick={() => clickSquare(r,c)}
              onPointerDown={(e)=> piece && onPiecePointerDown(e, r, c)}
              role="button"
              aria-label={`r${r}c${c}`}
            >
              {piece && !isBeingDragged && (
                <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
                  {renderPiece(piece)}
                </div>
              )}
              {canGo && (
                <span style={{
                  position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
                  width:18, height:18, borderRadius:'999px', background:'rgba(14,165,233,.75)'
                }}/>
              )}
            </div>
          );
        })}
      </div>

      {drag && (
        <div
          style={{
            position:'absolute',
            left: drag.x - (sq/2) - (drag.rect?.left ?? 0),
            top: drag.y - (sq/2) - (drag.rect?.top ?? 0),
            width: sq, height: sq, pointerEvents:'none'
          }}
        >
          {floating}
        </div>
      )}
    </div>
  );
}
const CheckersBoard = React.memo(CheckersBoardInner);

/* ---------- time helpers ---------- */
const START_MS = 4 * 60 * 1000; // 4 minutes
const fmtClock = (ms) => {
  ms = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(ms / 60);
  const s = ms % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/* ---------- Arena ---------- */
export default function CheckersArena() {
  const { user } = useContext(AuthContext);

  const [boardSize, setBoardSize] = useState(432);
  useEffect(() => {
    const calc = () => {
      const vh = window.innerHeight || 900;
      const fit = Math.min(444, Math.floor(vh - 320));
      setBoardSize(Math.max(380, fit));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  const [board, setBoard] = useState(makeInitialBoard());
  const [turn, setTurn] = useState('w');
  const [lockFrom, setLockFrom] = useState(null);          // multi-jump lock (local & server)
  const [orientation, setOrientation] = useState('white'); // my POV
  const myColorRef = useRef('w');
  const roomIdRef = useRef(null);

  const [resultModal, setResultModal] = useState(null);
  const [oppName, setOppName] = useState('');
  const [status, setStatus] = useState('Pick a mode to start.');
  const [mode, setMode] = useState(null); // null | 'bot' | 'online'
  const [roomId, setRoomId] = useState(null);
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef(null);
  const socketRef = useRef(null);
  const awardedRef = useRef(false);

  // total clocks
  const [wMs, setWms] = useState(START_MS);
  const [bMs, setBms] = useState(START_MS);
  const [clockSince, setClockSince] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const flashNotice = useCallback((msg, ms=1500) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(()=> setNotice(''), ms);
  }, []);
  const clearNotice = useCallback(() => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice('');
  }, []);

  const resetLocal = useCallback((flip='white') => {
    setBoard(makeInitialBoard());
    setTurn('w');
    setLockFrom(null);
    setOrientation(flip);
    myColorRef.current = flip === 'white' ? 'w' : 'b';
    roomIdRef.current = null;
    setRoomId(null);
    awardedRef.current = false;
    clearNotice();
    setStatus('Pick a mode to start.');

    // reset clocks
    setWms(START_MS);
    setBms(START_MS);
    setClockSince(Date.now());
  }, [clearNotice]);

  // visible time left (charge elapsed only visually; state updates happen on moves)
  const viewLeft = useCallback((side) => {
    const base = side === 'w' ? wMs : bMs;
    if (clockSince && turn === side && (mode === 'bot' || mode === 'online')) {
      const elapsed = nowTs - clockSince;
      return Math.max(0, base - elapsed);
    }
    return base;
  }, [wMs, bMs, clockSince, turn, mode, nowTs]);

  const chargeElapsedToCurrent = useCallback(() => {
    if (!clockSince) return;
    const elapsed = Date.now() - clockSince;
    if (turn === 'w') setWms(ms => Math.max(0, ms - elapsed));
    else setBms(ms => Math.max(0, ms - elapsed));
    setClockSince(Date.now());
  }, [clockSince, turn]);

  /* ----- Trophies & Modal helpers ----- */
  const perGameRank = (n) => (n>=1500?'Champion':n>=900?'Diamond':n>=600?'Platinum':n>=400?'Gold':n>=250?'Silver':n>=100?'Bronze':'Wood');

  const fetchMyCheckersTrophies = useCallback(async () => {
    if (!user?._id) return 0;
    try { const { data } = await axios.get(`${API_BASE_URL}/api/games/stats/${user._id}`); return (data?.trophiesByGame?.checkers)||0; }
    catch { return 0; }
  }, [user?._id]);

  const fetchMyOverallPlace = useCallback(async () => {
    if (!user?._id) return null;
    try { const q = new URLSearchParams({ userId: user._id }); const { data } = await axios.get(`${API_BASE_URL}/api/games/leaderboard/overall?${q.toString()}`); return data?.me?.rank ?? null; }
    catch { return null; }
  }, [user?._id]);

  const openResultModal = useCallback(async (resultText, trophiesOverride=null) => {
    const winner = /white wins/i.test(resultText) ? 'w' : (/black wins/i.test(resultText) ? 'b' : null);
    const didWin = !!winner && (myColorRef.current === winner);
    const trophies = trophiesOverride ?? (await fetchMyCheckersTrophies());
    const place = await fetchMyOverallPlace();
    setResultModal({ didWin, resultText, trophies, rank: perGameRank(trophies), place });
  }, [fetchMyCheckersTrophies, fetchMyOverallPlace]);

  // award +6 / -6 / 0 (draw) exactly once per game; returns fresh trophies
  const awardOutcome = useCallback(async (kind) => {
    if (!user?._id || awardedRef.current) return null;
    try {
      const delta = kind === 'win' ? 6 : kind === 'loss' ? -6 : 0;
      await axios.post(`${API_BASE_URL}/api/games/result`, {
        userId: user._id, gameKey: 'checkers', delta, didWin: kind === 'win',
      });
      awardedRef.current = true;
      // notify the rest of the app to refresh leaderboards/sidebars
      try {
        window.dispatchEvent(new CustomEvent('games:statsUpdated', { detail: { gameKey: 'checkers' } }));
      } catch {}
      const t = await fetchMyCheckersTrophies();
      return t;
    } catch {
      return null;
    }
  }, [user?._id, fetchMyCheckersTrophies]);

  // timeout detection (bot mode locally)
  useEffect(() => {
    if (mode !== 'bot') return;
    const left = viewLeft(turn);
    if (left <= 0) {
      const loser = turn;
      const winnerLabel = loser === 'w' ? 'Black' : 'White';
      setClockSince(null);
      setStatus(`Game over: ${winnerLabel} wins (time).`);
      openResultModal(`Game over: ${winnerLabel} wins (time).`);
    }
  }, [mode, turn, viewLeft, nowTs, openResultModal]);

  // --- bot mode ---
  const startBot = () => {
    setMode('bot');
    resetLocal('white');
    setStatus('Practice vs Bot. You are White.');
  };
  const botPlayTurn = (b, side) => {
    let moves = allMoves(b, side);
    if (!moves.length) return { board: b, next: side };
    if (moves.some(m=>!!m.capture)) moves = moves.filter(m=>!!m.capture);
    const mv = moves[Math.floor(Math.random() * moves.length)];
    let res = applyMove(b, mv);
    if (mv.capture && !res.justPromoted) {
      let currBoard = res.board, currTo = res.to;
      while (true) {
        const caps = captureMovesFor(currBoard, currTo[0], currTo[1]);
        if (!caps.length) break;
        const nextCap = caps[Math.floor(Math.random() * caps.length)];
        const nextRes = applyMove(currBoard, nextCap);
        currBoard = nextRes.board; currTo = nextRes.to;
        if (nextRes.justPromoted) break;
      }
      res = { board: currBoard, to: currTo, justPromoted: false };
    }
    return { board: res.board, next: side === 'w' ? 'b' : 'w' };
  };

  // --- online mode ---
  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const s = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => setStatus('Connected. Queueing…'));
    s.on('checkers:queued', () => setStatus('Looking for an opponent…'));

    s.on('checkers:start', ({ roomId, color, state, white, black }) => {
      roomIdRef.current = roomId;
      setRoomId(roomId);
      setBoard(state?.board || makeInitialBoard());
      setTurn(state?.turn || 'w');
      setLockFrom(state?.lockFrom || null);

      // clocks reset for a new game
      setWms(START_MS);
      setBms(START_MS);
      setClockSince(Date.now());

      const myCol = (color === 'w') ? 'w' : 'b';
      myColorRef.current = myCol;
      setOrientation(myCol === 'w' ? 'white' : 'black');
      setMode('online');
      awardedRef.current = false;
      clearNotice();
      setStatus('Live match started.');
      setOppName(myCol === 'w' ? (black?.username || 'Black') : (white?.username || 'White'));
    });

    // Authoritative updates (no server clocks provided; we keep local view ticking)
    s.on('checkers:state', ({ roomId, state }) => {
      if (roomId !== roomIdRef.current) return;
      // charge the elapsed to the side who just moved (current side before state.turn flips)
      chargeElapsedToCurrent();
      setBoard(state.board);
      setTurn(state.turn);
      setLockFrom(state.lockFrom || null);
      setClockSince(Date.now());
      const myCol = myColorRef.current;
      setStatus(state.turn === myCol ? 'Your move.' : 'Waiting for opponent…');
    });

    s.on('checkers:gameover', async ({ roomId, result, reason }) => {
      if (roomId !== roomIdRef.current) return;
      setClockSince(null);
      const txt = `Game over: ${result} (${reason})`;
      setStatus(txt);

      // Determine outcome and award before opening modal (so counts are fresh)
      let trophiesOverride = null;
      const winColor = /white wins/i.test(result) ? 'w' :
                       (/black wins/i.test(result) ? 'b' : null);
      if (winColor) {
        const mine = myColorRef.current;
        trophiesOverride = await awardOutcome(mine === winColor ? 'win' : 'loss');
      } else {
        trophiesOverride = await awardOutcome('draw');
      }

      await openResultModal(txt, trophiesOverride);
      roomIdRef.current = null;
      setRoomId(null);
      setLockFrom(null);
    });

    s.on('checkers:queue-cancelled', () => setStatus('Queue cancelled.'));
    s.on('disconnect', () => setStatus('Disconnected.'));
    return s;
  }, [awardOutcome, clearNotice, openResultModal, chargeElapsedToCurrent]);

  const startOnline = () => {
    resetLocal('white');
    setMode('online');
    const s = connectSocket();
    s.emit('checkers:queue', { userId: user?._id, username: user?.username });
  };

  // Leave Online should act as RESIGN if a live match is in progress.
  const leaveOnline = useCallback(() => {
    const s = socketRef.current;

    // In a live game? Treat this as a proper resign so both sides get the correct result.
    if (mode === 'online' && s && roomIdRef.current) {
      s.emit('checkers:resign', { roomId: roomIdRef.current });
      setStatus('You resigned.');
      // Do NOT disconnect here — wait for the server's `checkers:gameover`
      // which will open the modal and run the award flow correctly.
      return;
    }

    // Not in a live game (e.g., just queued) — safe to leave/disconnect.
    if (s) {
      s.emit('checkers:leave', { roomId: roomIdRef.current });
      s.disconnect();
      socketRef.current = null;
    }
    setMode(null);
    roomIdRef.current = null;
    setRoomId(null);
    setLockFrom(null);
    setStatus('Left online mode.');
    clearNotice();
  }, [mode, clearNotice]);

  // --- local move (bot) / networked move (online) ---
  const tryMove = useCallback((mv) => {
    // ONLINE — send to server; it enforces rules and multi-jump lock
    if (mode === 'online') {
      const myCol = myColorRef.current;
      if (turn !== myCol) { flashNotice('Not your turn.'); return false; }
      if (lockFrom && (mv.from[0] !== lockFrom[0] || mv.from[1] !== lockFrom[1])) {
        flashNotice('You must continue jumping with the same piece.');
        return false;
      }
      const move = { from: mv.from, to: mv.to };
      if (Math.abs(mv.to[0] - mv.from[0]) === 2 && Math.abs(mv.to[1] - mv.from[1]) === 2) {
        move.capture = [ (mv.from[0] + mv.to[0]) / 2, (mv.from[1] + mv.to[1]) / 2 ];
      }
      if (socketRef.current && roomIdRef.current) {
        socketRef.current.emit('checkers:move', { roomId: roomIdRef.current, move });
      }
      return true;
    }

    // LOCAL vs BOT — full rule enforcement (must-capture + multi-jump continuation)
    const legal = allMoves(board, turn);
    if (!legal.length) { setStatus('No legal moves.'); return false; }

    const mustCapture = legal.some(m => !!m.capture);
    if (mustCapture && !mv.capture) { setStatus('You must capture.'); return false; }

    if (lockFrom && (mv.from[0] !== lockFrom[0] || mv.from[1] !== lockFrom[1])) {
      setStatus('You must continue jumping with the same piece.');
      return false;
    }

    // Validate that mv is among legal
    const ok = legal.find(m =>
      m.from[0] === mv.from[0] && m.from[1] === mv.from[1] &&
      m.to[0] === mv.to[0] && m.to[1] === mv.to[1] &&
      (!!m.capture) === (!!mv.capture) &&
      (!m.capture || (m.capture[0] === mv.capture[0] && m.capture[1] === mv.capture[1]))
    );
    if (!ok) { setStatus('Illegal move.'); return false; }

    // charge time to the current side (me) for this move duration
    chargeElapsedToCurrent();

    const res = applyMove(board, mv);
    setBoard(res.board);

    // If a capture that didn't promote, check for more captures with same piece
    if (mv.capture && !res.justPromoted) {
      const more = captureMovesFor(res.board, res.to[0], res.to[1]);
      if (more.length) {
        setLockFrom(res.to);                 // lock to continue the chain
        setStatus('You must continue jumping.');
        // still my turn; clock keeps running for me (clockSince already updated)
        return true;
      }
    }

    // Chain ended — pass turn to bot
    setLockFrom(null);
    const next = (turn === 'w') ? 'b' : 'w';
    setTurn(next);
    setClockSince(Date.now());

    // let bot "think" a little; during this time its clock runs
    setTimeout(() => {
      // charge bot's elapsed once it actually moves
      chargeElapsedToCurrent();

      const botRes = botPlayTurn(res.board, next);
      setBoard(botRes.board);

      // If bot ended with a chain, its move already continued internally
      setTurn(botRes.next);
      setClockSince(Date.now());
    }, 450);

    return true;
  }, [mode, board, turn, lockFrom, flashNotice, chargeElapsedToCurrent]);

  // ---- helpers for sidebar text ----
  const noMoves = (b, color) => allMoves(b, color).length === 0;
  function isGameOver(b) {
    const wHas = hasAnyPieces(b, 'w');
    const bHas = hasAnyPieces(b, 'b');
    if (!wHas || !bHas) return true;
    if (noMoves(b, 'w') || noMoves(b, 'b')) return true;
    return false;
  }
  function gameOverText(b, nextToMove) {
    const loser = (!hasAnyPieces(b, nextToMove) || noMoves(b, nextToMove)) ? nextToMove : null;
    if (loser) {
      const winner = loser === 'w' ? 'Black' : 'White';
      return `Game over: ${winner} wins.`;
    }
    return 'Game over.';
  }

  const onIllegalCb = useCallback((msg) => setStatus(msg || 'Illegal move.'), []);

  const resign = () => {
    if (mode === 'online' && socketRef.current && roomIdRef.current) {
      socketRef.current.emit('checkers:resign', { roomId: roomIdRef.current });
    } else {
      setStatus('You resigned.');
      setClockSince(null);
    }
  };

  // names & clocks for top/bottom bars
  const myCol = myColorRef.current;                // 'w' | 'b'
  const oppCol = myCol === 'w' ? 'b' : 'w';
  const oppTime = viewLeft(oppCol);
  const myTime  = viewLeft(myCol);

  return (
    <Wrap>
      <Panel>
        {/* Opponent name + clock (top) */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 8px', fontWeight:700, fontSize:13, width: boardSize, boxSizing: 'border-box',}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            {mode === 'online'}
            <span>{oppName || (mode==='bot' ? 'Bot' : oppCol==='w'?'White':'Black')}</span>
          </div>
          <div style={{fontVariantNumeric:'tabular-nums'}}>{fmtClock(oppTime)}</div>
        </div>

        <CheckersBoard
          board={board}
          onTryMove={tryMove}
          orientation={orientation}
          onIllegal={onIllegalCb}
          boardSize={boardSize}
        />

        {/* My name + clock (bottom) */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 8px', fontWeight:700, fontSize:13, width: boardSize, boxSizing: 'border-box',}}>
          <span>{user?.username || 'You'}</span>
          <div style={{fontVariantNumeric:'tabular-nums'}}>{fmtClock(myTime)}</div>
        </div>
      </Panel>

      <Panel>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <Button onClick={startBot}>Practice vs Bot</Button>
          {mode !== 'online' ? (
            <Button $primary onClick={startOnline}>Play Online</Button>
          ) : (
            <Button onClick={leaveOnline}>Leave Online</Button>
          )}
          <Button onClick={resign}>Resign</Button>
        </div>

        <div style={{marginTop:6}}>
          {mode === 'online' && roomId && (
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <div style={{fontWeight:800}}>
                {(myCol==='w' ? 'You (White)' : 'You (Black)')} vs {oppName || 'Opponent'}
              </div>
            </div>
          )}
        </div>

        <div style={{marginTop:10, color:'#555'}}>
          {isGameOver(board) ? gameOverText(board, turn) : status}
        </div>
        {!!notice && <Alert>{notice}</Alert>}
        <div style={{marginTop:12, fontSize:12, color:'#6b7280'}}>
          Wins vs real players grant <b>+6 trophies</b>. Bot games are unranked.
        </div>
      </Panel>

      {resultModal && (
        <Overlay onClick={()=>setResultModal(null)}>
          <Modal onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18, fontWeight:800, marginBottom:6}}>
              {resultModal.didWin ? 'You win! 🎉' : /draw/i.test(resultModal.resultText) ? 'Draw' : 'You lose'}
            </div>
            <div style={{fontSize:13, color:'#6b7280'}}>{resultModal.resultText}</div>
            <div style={{display:'flex', gap:10, alignItems:'center', marginTop:10}}>
              <span style={{fontWeight:800}}>🏆 {resultModal.trophies}</span>
              <span style={{padding:'3px 10px', borderRadius:9999, fontSize:12, fontWeight:800, background:'#111', color:'#fff'}}>
                {resultModal.rank}
              </span>
            </div>
            {resultModal.place && (
              <div style={{marginTop:6, fontSize:12, color:'#6b7280'}}>Overall leaderboard position: #{resultModal.place}</div>
            )}
            <div style={{marginTop:12, fontSize:12, color:'#6b7280'}}>
              Tip: Only wins in live online games award trophies. Bot games are unranked.
            </div>
            <ModalGrid>
              <Button onClick={()=>{ setMode(null); roomIdRef.current=null; setRoomId(null); setResultModal(null); setStatus('Pick a mode to start.'); }}>Back</Button>
              <Button onClick={()=>{ setResultModal(null); startBot(); }}>Play Bot</Button>
              <Button $primary onClick={()=>{ setResultModal(null); startOnline(); }}>Find Online Match</Button>
            </ModalGrid>
          </Modal>
        </Overlay>
      )}

      <GameRules
        title="How to Play American Checkers (English Draughts)"
        subtitle="Mandatory captures, multiple jumps, and simple one-square moves."
        sections={[
          { heading: 'Goal', text: 'Capture all of your opponent’s pieces, or block them so they have no legal move.' },
          { heading: 'Board & Setup', list: ['8×8 board; only the dark squares are used.', 'Each side starts with 12 men on the first three rows of dark squares.'] },
          { heading: 'Moves', list: ['Men move diagonally forward one square to an empty dark square.', 'Kings move diagonally any direction one square.', 'Capture by jumping over a single adjacent opponent piece to an empty square beyond it.', 'Multiple jumps are allowed and must be continued within the same turn.', 'If a capture exists, you must capture.'] },
          { heading: 'Promotion', list: ['Reach the far row to become a king immediately.'] },
          { heading: 'End of Game', list: ['Win by capturing all opposing pieces or leaving the opponent with no legal move.'] },
        ]}
      />
    </Wrap>
  );
}
