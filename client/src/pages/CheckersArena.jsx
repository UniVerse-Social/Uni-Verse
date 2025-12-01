import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useContext,
  useLayoutEffect,
  useMemo,
} from 'react';
import styled from 'styled-components';
import { io } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';
import GameSidebar from '../components/GameSidebar';
import GameRules from '../components/GameRules';

/* === Layout constants (mirror ChessArena) === */
const SIDE_W = 360;
const HEADER_H = 76;
const BOTTOM_GAP = 40;
const MOBILE_NAV_H = 64;
const RAIL_PAD = 12;

/* ---------- shared look & feel / layout ---------- */
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
  padding: 0 0 ${RAIL_PAD}px 0;
  margin-top: -12px;

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
    padding: 0 0 calc(${MOBILE_NAV_H}px + env(safe-area-inset-bottom, 0px)) 0;
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
  overflow: hidden;
  min-height: 0;
  position: relative;
`;

const Button = styled.button`
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$primary ? 'transparent' : 'var(--border-color)')};
  background: ${(p) =>
    p.$primary ? 'var(--primary-orange)' : 'rgba(255,255,255,0.06)'};
  color: ${(p) => (p.$primary ? '#000' : 'var(--text-color)')};
  font-weight: 800;
  transition: background 0.15s ease, box-shadow 0.15s ease,
    transform 0.08s ease;
  &:hover {
    background: ${(p) =>
      p.$primary
        ? 'linear-gradient(90deg,var(--primary-orange),#59D0FF)'
        : 'rgba(255,255,255,0.10)'};
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

const Alert = styled.div`
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
  font-size: 13px;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.4);
  z-index: 50;
`;
const Modal = styled.div`
  width: 520px;
  max-width: 94vw;
  background: var(--container-white);
  color: var(--text-color);
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  border: 1px solid var(--border-color);
  padding: 16px;
`;
const ModalGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 10px;
`;

/* Mobile top bar (drawer launcher + quick opponent pill) */
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
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
  }
  @media (min-width: 861px) {
    display: none;
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

const MobileOpponentClock = styled.span`
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: rgba(230, 233, 255, 0.75);
`;

/* Left-side drawer with GameSidebar on phones (like Chess) */
const Drawer = styled.aside`
  position: fixed;
  top: ${HEADER_H}px;
  left: 0;
  bottom: 0;
  width: min(92vw, 360px);
  background: var(--container-white);
  border-right: 1px solid var(--border-color);
  box-shadow: 12px 0 28px rgba(0, 0, 0, 0.28);
  transform: translateX(${(p) => (p.$open ? '0' : '-100%')});
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

/* Mobile stack below the board (names/clocks + actions) */
const MobileStack = styled.div`
  display: none;
  @media (max-width: 860px) {
    display: grid;
    gap: 10px;
    margin-top: 8px;
    width: 100%;
  }
`;

const MobileStatsRow = styled.div`
  @media (max-width: 860px) {
    width: 100%;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
  }
  @media (min-width: 861px) {
    display: none;
  }
`;

/* Buttons overlayed on the board when no game is active (mobile only) */
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

/* ---------- rules / board helpers ---------- */
const DARK = '#b58863';
const LIGHT = '#f0d9b5';
const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const isKing = (p) => p === 'W' || p === 'B';
const colorOf = (p) =>
  p === 'w' || p === 'W' ? 'w' : p === 'b' || p === 'B' ? 'b' : null;

function makeInitialBoard() {
  const B = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) B[r][c] = 'b';
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) B[r][c] = 'w';
  return B;
}
const clone = (B) => B.map((row) => row.slice());
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
    const r2 = r + dr,
      c2 = c + dc;
    if (!inBounds(r2, c2)) continue;
    if ((r2 + c2) % 2 !== 1) continue;
    if (board[r2][c2] == null) moves.push({ from: [r, c], to: [r2, c2] });
  }
  // captures
  for (const [dr, dc] of dirs) {
    const mr = r + dr,
      mc = c + dc;
    const r2 = r + 2 * dr,
      c2 = c + 2 * dc;
    if (!inBounds(mr, mc) || !inBounds(r2, c2)) continue;
    if ((r2 + c2) % 2 !== 1) continue;
    const mid = board[mr][mc];
    if (mid && colorOf(mid) !== color && board[r2][c2] == null) {
      moves.push({ from: [r, c], to: [r2, c2], capture: [mr, mc] });
    }
  }
  return moves;
}
const captureMovesFor = (B, r, c) =>
  legalMovesFor(B, r, c).filter((m) => !!m.capture);
const allMoves = (B, color) => {
  const out = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = B[r][c];
      if (!p || colorOf(p) !== color) continue;
      out.push(...legalMovesFor(B, r, c));
    }
  return out;
};
function applyMove(board, move) {
  const b = clone(board);
  const [r1, c1] = move.from;
  const [r2, c2] = move.to;
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
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      if (board[r][c] && colorOf(board[r][c]) === color) return true;
    }
  return false;
};
const noMoves = (b, color) => allMoves(b, color).length === 0;

const isGameOver = (b) => {
  const wHas = hasAnyPieces(b, 'w');
  const bHas = hasAnyPieces(b, 'b');
  if (!wHas || !bHas) return true;
  if (noMoves(b, 'w') || noMoves(b, 'b')) return true;
  return false;
};

const gameOverText = (b, nextToMove) => {
  const loser =
    !hasAnyPieces(b, nextToMove) || noMoves(b, nextToMove)
      ? nextToMove
      : null;
  if (loser) {
    const winner = loser === 'w' ? 'Black' : 'White';
    return `Game over: ${winner} wins.`;
  }
  return 'Game over.';
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
      // Slightly higher threshold avoids accidental taps being treated as drags
      const moved = d.moved || (dx > 6 || dy > 6);
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
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const piece = board[r][c];
    if (!piece) return;

    setSel([r, c]);
    const rect = boardRef.current?.getBoundingClientRect();
    setDrag({
      from: [r, c],
      x: e.clientX, y: e.clientY,
      startX: e.clientX, startY: e.clientY,
      moved: false, rect, piece
    });

    window.addEventListener('pointermove', onWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', onWindowPointerUp, { passive: false });
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
          width: size, height: size, borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 12px 28px rgba(0,0,0,.18)', border: '1px solid var(--border-color)',
          position: 'relative',
          // KEY lines for mobile touch-drag
          touchAction: 'none', WebkitTouchCallout: 'none',
          userSelect: 'none', WebkitUserSelect: 'none',
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
const LocalCheckersBoard = React.memo(CheckersBoardInner);

/* ---------- time helpers ---------- */
const START_MS = 4 * 60 * 1000;
const fmtClock = (ms) => {
  ms = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(ms / 60);
  const s = ms % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/* ---------- Arena ---------- */
export default function CheckersArena({ onExit }) {
  const { user } = useContext(AuthContext);

  const [boardSize, setBoardSize] = useState(360);
  const panelRef = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (drawerOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
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
        .matchMedia('(max-width: 860px)')
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

  const [board, setBoard] = useState(makeInitialBoard());
  const [turn, setTurn] = useState('w');
  const [lockFrom, setLockFrom] = useState(null);
  const [orientation, setOrientation] = useState('white');
  const myColorRef = useRef('w');
  const roomIdRef = useRef(null);

  const [resultModal, setResultModal] = useState(null);
  const [oppName, setOppName] = useState('');
  const [status, setStatus] = useState('Pick a mode to start.');
  const [mode, setMode] = useState(null); // null | 'bot' | 'online'
  const [, setRoomId] = useState(null);
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef(null);
  const socketRef = useRef(null);
  const awardedRef = useRef(false);

  const [wMs, setWms] = useState(START_MS);
  const [bMs, setBms] = useState(START_MS);
  const [clockSince, setClockSince] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const flashNotice = useCallback((msg, ms = 1500) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), ms);
  }, []);
  const clearNotice = useCallback(() => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice('');
  }, []);

  const resetLocal = useCallback(
    (flip = 'white') => {
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

      setWms(START_MS);
      setBms(START_MS);
      setClockSince(Date.now());
    },
    [clearNotice]
  );

  const viewLeft = useCallback(
    (side) => {
      const base = side === 'w' ? wMs : bMs;
      if (
        clockSince &&
        turn === side &&
        (mode === 'bot' || mode === 'online')
      ) {
        const elapsed = nowTs - clockSince;
        return Math.max(0, base - elapsed);
      }
      return base;
    },
    [wMs, bMs, clockSince, turn, mode, nowTs]
  );

  const chargeElapsedToCurrent = useCallback(() => {
    if (!clockSince) return;
    const elapsed = Date.now() - clockSince;
    if (turn === 'w')
      setWms((ms) => Math.max(0, ms - elapsed));
    else setBms((ms) => Math.max(0, ms - elapsed));
    setClockSince(Date.now());
  }, [clockSince, turn]);

  /* ----- trophies / modal helpers ----- */
  const perGameRank = (n) =>
    n >= 1500
      ? 'Champion'
      : n >= 900
      ? 'Diamond'
      : n >= 600
      ? 'Platinum'
      : n >= 400
      ? 'Gold'
      : n >= 250
      ? 'Silver'
      : n >= 100
      ? 'Bronze'
      : 'Wood';

  const fetchMyCheckersTrophies = useCallback(async () => {
    if (!user?._id) return 0;
    try {
      const { data } = await axios.get(
        `${API_BASE_URL}/api/games/stats/${user._id}`
      );
      return data?.trophiesByGame?.checkers || 0;
    } catch {
      return 0;
    }
  }, [user?._id]);

  const fetchMyOverallPlace = useCallback(async () => {
    if (!user?._id) return null;
    try {
      const q = new URLSearchParams({ userId: user._id });
      const { data } = await axios.get(
        `${API_BASE_URL}/api/games/leaderboard/overall?${q.toString()}`
      );
      return data?.me?.rank ?? null;
    } catch {
      return null;
    }
  }, [user?._id]);

  const openResultModal = useCallback(
    async (resultText, trophiesOverride = null) => {
      const winner = /white wins/i.test(resultText)
        ? 'w'
        : /black wins/i.test(resultText)
        ? 'b'
        : null;
      const didWin =
        !!winner && myColorRef.current === winner;
      const trophies =
        trophiesOverride ??
        (await fetchMyCheckersTrophies());
      const place = await fetchMyOverallPlace();
      setResultModal({
        didWin,
        resultText,
        trophies,
        rank: perGameRank(trophies),
        place,
      });
    },
    [fetchMyCheckersTrophies, fetchMyOverallPlace]
  );

  const awardOutcome = useCallback(
    async (kind) => {
      if (!user?._id || awardedRef.current) return null;
      try {
        const delta =
          kind === 'win' ? 6 : kind === 'loss' ? -6 : 0;
        await axios.post(
          `${API_BASE_URL}/api/games/result`,
          {
            userId: user._id,
            gameKey: 'checkers',
            delta,
            didWin: kind === 'win',
          }
        );
        awardedRef.current = true;
        try {
          window.dispatchEvent(
            new CustomEvent('games:statsUpdated', {
              detail: { gameKey: 'checkers' },
            })
          );
        } catch {}
        const t = await fetchMyCheckersTrophies();
        return t;
      } catch {
        return null;
      }
    },
    [user?._id, fetchMyCheckersTrophies]
  );

  useEffect(() => {
    if (mode !== 'bot') return;
    const left = viewLeft(turn);
    if (left <= 0) {
      const loser = turn;
      const winnerLabel = loser === 'w' ? 'Black' : 'White';
      setClockSince(null);
      setStatus(
        `Game over: ${winnerLabel} wins (time).`
      );
      openResultModal(
        `Game over: ${winnerLabel} wins (time).`
      );
    }
  }, [mode, turn, viewLeft, nowTs, openResultModal]);

  /* --- bot mode --- */
  const startBot = () => {
    setMode('bot');
    resetLocal('white');
    setStatus('Practice vs Bot. You are White.');
  };
  const botPlayTurn = (b, side) => {
    let moves = allMoves(b, side);
    if (!moves.length) return { board: b, next: side };
    if (moves.some((m) => !!m.capture))
      moves = moves.filter((m) => !!m.capture);
    const mv =
      moves[Math.floor(Math.random() * moves.length)];
    let res = applyMove(b, mv);
    if (mv.capture && !res.justPromoted) {
      let currBoard = res.board,
        currTo = res.to;
      while (true) {
        const caps = captureMovesFor(
          currBoard,
          currTo[0],
          currTo[1]
        );
        if (!caps.length) break;
        const nextCap =
          caps[Math.floor(Math.random() * caps.length)];
        const nextRes = applyMove(currBoard, nextCap);
        currBoard = nextRes.board;
        currTo = nextRes.to;
        if (nextRes.justPromoted) break;
      }
      res = { board: currBoard, to: currTo, justPromoted: false };
    }
    return {
      board: res.board,
      next: side === 'w' ? 'b' : 'w',
    };
  };

  /* --- online mode (Chess-style WS base) --- */
  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;

    const envBase =
      typeof process !== 'undefined' &&
      process.env &&
      process.env.REACT_APP_API_BASE
        ? String(process.env.REACT_APP_API_BASE)
        : '';
    let WS_BASE =
      (API_BASE_URL && API_BASE_URL.trim()) ||
      (envBase && envBase.trim()) ||
      '';

    if (!WS_BASE) {
      const { protocol, hostname, host } = window.location;
      const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(
        hostname
      );
      if (isLocal) {
        const srvPort = '5000';
        WS_BASE = `${protocol}//${hostname}:${srvPort}`;
      } else {
        WS_BASE = `${protocol}//${host}`;
      }
    }

    WS_BASE = WS_BASE.replace(/\/+$/, '').replace(
      /\/api\/?$/,
      ''
    );
    try {
      console.info('[Checkers] WS_BASE =', WS_BASE);
    } catch {}

    try {
      const po = new URL(window.location.origin);
      const wb = new URL(WS_BASE);
      if (
        /trycloudflare\.com$/i.test(po.hostname) &&
        po.hostname !== wb.hostname
      ) {
        WS_BASE = po.origin;
      }
    } catch {}

    const s = io(WS_BASE, {
      path: '/api/socket.io',
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
      const payload = {
        userId: user?._id,
        username: user?.username,
      };
      s.emit('checkers:queue', payload);
    });

    s.on('connect_error', (e) =>
      setStatus(`Socket connect error: ${e?.message || e}`)
    );
    s.on('error', (e) =>
      setStatus(`Socket error: ${e?.message || e}`)
    );
    s.on('checkers:queued', () =>
      setStatus('Looking for an opponent…')
    );

    s.on(
      'checkers:start',
      ({ roomId, color, state, white, black }) => {
        roomIdRef.current = roomId;
        setRoomId(roomId);
        setBoard(state?.board || makeInitialBoard());
        setTurn(state?.turn || 'w');
        setLockFrom(state?.lockFrom || null);

        setWms(START_MS);
        setBms(START_MS);
        setClockSince(Date.now());

        const myCol = color === 'w' ? 'w' : 'b';
        myColorRef.current = myCol;
        setOrientation(
          myCol === 'w' ? 'white' : 'black'
        );
        setMode('online');
        awardedRef.current = false;
        clearNotice();
        setStatus('Live match started.');
        setOppName(
          myCol === 'w'
            ? black?.username || 'Black'
            : white?.username || 'White'
        );
      }
    );

    s.on('checkers:state', ({ roomId, state }) => {
      if (roomId !== roomIdRef.current) return;
      chargeElapsedToCurrent();
      setBoard(state.board);
      setTurn(state.turn);
      setLockFrom(state.lockFrom || null);
      setClockSince(Date.now());
      const myCol = myColorRef.current;
      setStatus(
        state.turn === myCol ? 'Your move.' : 'Waiting for opponent…'
      );
    });

    s.on(
      'checkers:gameover',
      async ({ roomId, result, reason }) => {
        if (roomId !== roomIdRef.current) return;
        setClockSince(null);
        const txt = `Game over: ${result} (${reason})`;
        setStatus(txt);

        let trophiesOverride = null;
        const winColor = /white wins/i.test(result)
          ? 'w'
          : /black wins/i.test(result)
          ? 'b'
          : null;
        if (winColor) {
          const mine = myColorRef.current;
          trophiesOverride = await awardOutcome(
            mine === winColor ? 'win' : 'loss'
          );
        } else {
          trophiesOverride = await awardOutcome('draw');
        }

        await openResultModal(txt, trophiesOverride);
        roomIdRef.current = null;
        setRoomId(null);
        setLockFrom(null);
      }
    );

    s.on('checkers:queue-cancelled', () =>
      setStatus('Queue cancelled.')
    );
    s.on('disconnect', () =>
      setStatus('Disconnected.')
    );

    return s;
  }, [
    user?._id,
    user?.username,
    awardOutcome,
    clearNotice,
    openResultModal,
    chargeElapsedToCurrent,
  ]);

  useEffect(() => {
    if (mode !== 'online') return;
    const s = socketRef.current;
    if (!s) return;
    if (roomIdRef.current) return;

    let satisfied = false;
    const onQueued = () => {
      satisfied = true;
    };
    const onStart = () => {
      satisfied = true;
    };

    s.on('checkers:queued', onQueued);
    s.on('checkers:start', onStart);

    const t = setTimeout(() => {
      if (!satisfied && s.connected) {
        s.emit('checkers:queue', {
          userId: user?._id,
          username: user?.username,
        });
      }
    }, 1500);

    return () => {
      clearTimeout(t);
      s.off('checkers:queued', onQueued);
      s.off('checkers:start', onStart);
    };
  }, [mode, user?._id, user?.username]);

  const startOnline = () => {
    resetLocal('white');
    setMode('online');
    setStatus('Connecting…');
    const s = connectSocket();
    if (s?.connected) {
      s.emit('checkers:queue', {
        userId: user?._id,
        username: user?.username,
      });
    }
  };

  const leaveOnline = useCallback(() => {
    const s = socketRef.current;
    if (mode === 'online' && s && roomIdRef.current) {
      s.emit('checkers:resign', {
        roomId: roomIdRef.current,
      });
      setStatus('You resigned.');
      return;
    }
    if (s) {
      s.emit('checkers:leave', {
        roomId: roomIdRef.current,
      });
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

  /* --- local / networked move handling --- */
  const tryMove = useCallback(
    (mv) => {
      if (mode === 'online') {
        const myCol = myColorRef.current;
        if (turn !== myCol) {
          flashNotice('Not your turn.');
          return false;
        }
        if (
          lockFrom &&
          (mv.from[0] !== lockFrom[0] ||
            mv.from[1] !== lockFrom[1])
        ) {
          flashNotice(
            'You must continue jumping with the same piece.'
          );
          return false;
        }
        const move = { from: mv.from, to: mv.to };
        if (
          Math.abs(mv.to[0] - mv.from[0]) === 2 &&
          Math.abs(mv.to[1] - mv.from[1]) === 2
        ) {
          move.capture = [
            (mv.from[0] + mv.to[0]) / 2,
            (mv.from[1] + mv.to[1]) / 2,
          ];
        }
        if (socketRef.current && roomIdRef.current) {
          socketRef.current.emit('checkers:move', {
            roomId: roomIdRef.current,
            move,
          });
        }
        return true;
      }

      const legal = allMoves(board, turn);
      if (!legal.length) {
        setStatus('No legal moves.');
        return false;
      }

      const mustCapture = legal.some((m) => !!m.capture);
      if (mustCapture && !mv.capture) {
        setStatus('You must capture.');
        return false;
      }

      if (
        lockFrom &&
        (mv.from[0] !== lockFrom[0] ||
          mv.from[1] !== lockFrom[1])
      ) {
        setStatus(
          'You must continue jumping with the same piece.'
        );
        return false;
      }

      const ok = legal.find(
        (m) =>
          m.from[0] === mv.from[0] &&
          m.from[1] === mv.from[1] &&
          m.to[0] === mv.to[0] &&
          m.to[1] === mv.to[1] &&
          !!m.capture === !!mv.capture &&
          (!m.capture ||
            (m.capture[0] === mv.capture[0] &&
              m.capture[1] === mv.capture[1]))
      );
      if (!ok) {
        setStatus('Illegal move.');
        return false;
      }

      chargeElapsedToCurrent();

      const res = applyMove(board, mv);
      setBoard(res.board);

      // multi-jump continuation (unchanged)
      if (mv.capture && !res.justPromoted) {
        const more = captureMovesFor(
          res.board,
          res.to[0],
          res.to[1]
        );
        if (more.length) {
          setLockFrom(res.to);
          setStatus('You must continue jumping.');
          return true;
        }
      }

      setLockFrom(null);
      const next = turn === 'w' ? 'b' : 'w';

      // 🔹 NEW: check if the game ended on *your* move
      if (isGameOver(res.board)) {
        const txt = gameOverText(res.board, next);
        setStatus(txt);
        setClockSince(null);
        openResultModal(txt);      // same style modal as chess
        return true;
      }

      setTurn(next);
      setClockSince(Date.now());

      // bot reply
      setTimeout(() => {
        chargeElapsedToCurrent();
        const botRes = botPlayTurn(res.board, next);
        setBoard(botRes.board);

        // 🔹 NEW: check if the game ended on the bot's move
        if (isGameOver(botRes.board)) {
          const txt = gameOverText(botRes.board, botRes.next);
          setStatus(txt);
          setClockSince(null);
          openResultModal(txt);
          return;
        }

        setTurn(botRes.next);
        setClockSince(Date.now());
      }, 450);

    return true;
  },
  [
    mode,
    board,
    turn,
    lockFrom,
    flashNotice,
    chargeElapsedToCurrent,
    openResultModal,
  ]
);

  const onIllegalCb = useCallback(
    (msg) => setStatus(msg || 'Illegal move.'),
    []
  );

  const resign = () => {
    if (mode === 'online' && socketRef.current && roomIdRef.current) {
      socketRef.current.emit('checkers:resign', {
        roomId: roomIdRef.current,
      });
    } else {
      setStatus('You resigned.');
      setClockSince(null);
    }
  };

  const myCol = myColorRef.current;
  const oppCol = myCol === 'w' ? 'b' : 'w';
  const oppTime = viewLeft(oppCol);
  const myTime = viewLeft(myCol);

  // show CTA when no mode is picked and there is no result modal open
  const showStartCTA = !mode && !resultModal;


  return (
    <>
      {/* Mobile top bar: open sidebar + opponent pill */}
      <MobileTopBar>
        <DrawerButton
          onClick={() => setDrawerOpen(true)}
          aria-label="Open checkers sidebar"
        >
          ➤
        </DrawerButton>
        <MobileOpponentPill>
          <MobileOpponentName>
            {oppName ||
              (mode === 'bot'
                ? 'Bot'
                : oppCol === 'w'
                ? 'White'
                : 'Black')}
          </MobileOpponentName>
          {(mode === 'bot' || mode === 'online') && (
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
        {/* LEFT: board panel */}
        <BoardPanel ref={panelRef}>
          <BoardViewport>
            <div
              style={{
                position: 'relative',
                width: boardSize,
                maxWidth: '100%',
                margin: '0 auto',
              }}
            >
              {/* mobile start CTA overlay, like Chess */}
              {showStartCTA && (
                <BoardOverlayCTA>
                  <div>
                    <Button onClick={startBot}>Practice vs Bot</Button>
                    <Button $primary onClick={startOnline}>Play Online</Button>
                  </div>
                </BoardOverlayCTA>
              )}

              <LocalCheckersBoard
                board={board}
                onTryMove={tryMove}
                orientation={orientation}
                onIllegal={onIllegalCb}
                boardSize={boardSize}
                turn={turn}
                myColor={myCol}
              />
            </div>
          </BoardViewport>

          {/* Mobile stats + actions under board */}
          <MobileStack>
            <MobileStatsRow>
              <div
                style={{
                  display: 'grid',
                  gap: 4,
                  padding: '6px 8px',
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <strong>{user?.username || 'You'}</strong>
                  <span
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmtClock(myTime)}
                  </span>
                </div>
              </div>
            </MobileStatsRow>

            <div style={{ display: 'grid', gap: 10 }}>
              {mode && (
                <>
                  {mode === 'online' && (
                    <Button onClick={leaveOnline}>
                      Leave Online
                    </Button>
                  )}
                  <Button onClick={resign}>Resign</Button>
                </>
              )}

              <GameRules
                title="How to Play American Checkers (English Draughts)"
                subtitle="Mandatory captures, multiple jumps, and simple one-square moves."
                sections={[
                  {
                    heading: 'Goal',
                    text: 'Capture all of your opponent’s pieces, or block them so they have no legal move.',
                  },
                  {
                    heading: 'Board & Setup',
                    list: [
                      '8×8 board; only the dark squares are used.',
                      'Each side starts with 12 men on the first three rows of dark squares.',
                    ],
                  },
                  {
                    heading: 'Moves',
                    list: [
                      'Men move diagonally forward one square to an empty dark square.',
                      'Kings move diagonally any direction one square.',
                      'Capture by jumping over a single adjacent opponent piece to an empty square beyond it.',
                      'Multiple jumps are allowed and must be continued within the same turn.',
                      'If a capture exists, you must capture.',
                    ],
                  },
                  {
                    heading: 'Promotion',
                    list: [
                      'Reach the far row to become a king immediately.',
                    ],
                  },
                  {
                    heading: 'End of Game',
                    list: [
                      'Win by capturing all opposing pieces or leaving the opponent with no legal move.',
                    ],
                  },
                ]}
                buttonText="📘 Rules"
                buttonTitle="Checkers Rules"
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

        {/* RIGHT: sticky controls rail (desktop) */}
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
            {/* primary actions */}
            <div
              style={{
                display: 'grid',
                gap: 12,
                marginTop: 12,
              }}
            >
              <Button
                onClick={startBot}
                style={{ padding: '10px 12px' }}
              >
                Practice vs Bot
              </Button>
              {mode !== 'online' ? (
                <Button
                  $primary
                  onClick={startOnline}
                  style={{ padding: '10px 12px' }}
                >
                  Play Online
                </Button>
              ) : (
                <Button
                  onClick={leaveOnline}
                  style={{ padding: '10px 12px' }}
                >
                  Leave Online
                </Button>
              )}
              <Button
                onClick={resign}
                style={{ padding: '10px 12px' }}
              >
                Resign
              </Button>
            </div>

            {/* status / notices */}
            <div
              style={{
                marginTop: 10,
                color: 'rgba(230,233,255,0.75)',
              }}
            >
              {isGameOver(board)
                ? gameOverText(board, turn)
                : status}
            </div>
            {!!notice && <Alert>{notice}</Alert>}
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: 'rgba(230,233,255,0.65)',
              }}
            >
              Wins vs real players grant{' '}
              <b>+6 trophies</b>. Bot games are
              unranked.
            </div>

            {/* game card: names + clocks */}
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 13,
                }}
              >
                <strong>
                  {oppName ||
                    (mode === 'bot'
                      ? 'Bot'
                      : oppCol === 'w'
                      ? 'White'
                      : 'Black')}
                </strong>
                <span
                  style={{
                    fontVariantNumeric:
                      'tabular-nums',
                  }}
                >
                  {fmtClock(oppTime)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 13,
                }}
              >
                <strong>
                  {user?.username || 'You'}
                </strong>
                <span
                  style={{
                    fontVariantNumeric:
                      'tabular-nums',
                  }}
                >
                  {fmtClock(myTime)}
                </span>
              </div>
            </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(230,233,255,0.65)' }}>
            Wins vs real players grant <b>+6 trophies</b>. Bot games are unranked.
          </div>

            {/* rules in-rail on desktop */}
            <div style={{ marginTop: 12 }}>
              <GameRules
                title="How to Play American Checkers (English Draughts)"
                subtitle="Mandatory captures, multiple jumps, and simple one-square moves."
                sections={[
                  {
                    heading: 'Goal',
                    text: 'Capture all of your opponent’s pieces, or block them so they have no legal move.',
                  },
                  {
                    heading: 'Board & Setup',
                    list: [
                      '8×8 board; only the dark squares are used.',
                      'Each side starts with 12 men on the first three rows of dark squares.',
                    ],
                  },
                  {
                    heading: 'Moves',
                    list: [
                      'Men move diagonally forward one square to an empty dark square.',
                      'Kings move diagonally any direction one square.',
                      'Capture by jumping over a single adjacent opponent piece to an empty square beyond it.',
                      'Multiple jumps are allowed and must be continued within the same turn.',
                      'If a capture exists, you must capture.',
                    ],
                  },
                  {
                    heading: 'Promotion',
                    list: [
                      'Reach the far row to become a king immediately.',
                    ],
                  },
                  {
                    heading: 'End of Game',
                    list: [
                      'Win by capturing all opposing pieces or leaving the opponent with no legal move.',
                    ],
                  },
                ]}
                buttonText="📘 Rules"
                buttonTitle="Checkers Rules"
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

      {/* mobile GameSidebar drawer */}
      {drawerOpen && (
        <DrawerBackdrop onClick={() => setDrawerOpen(false)} />
      )}
      <Drawer
        $open={drawerOpen}
        role="complementary"
        aria-label="Checkers sidebar"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 8,
          }}
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close sidebar"
            style={{
              border: '1px solid var(--border-color)',
              background: 'var(--container-white)',
              borderRadius: 999,
              width: 36,
              height: 36,
              fontWeight: 900,
              lineHeight: 1,
              boxShadow:
                '0 8px 18px rgba(0,0,0,.12)',
            }}
          >
            ×
          </button>
        </div>

        <GameSidebar
          gameKey="checkers"
          title="Checkers"
          showOnMobile
        />
      </Drawer>

      {/* end-of-game modal */}
      {resultModal && (
        <Overlay onClick={() => setResultModal(null)}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                marginBottom: 6,
              }}
            >
              {resultModal.didWin
                ? 'You win! 🎉'
                : /draw/i.test(resultModal.resultText)
                ? 'Draw'
                : 'You lose'}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'rgba(230,233,255,0.65)',
              }}
            >
              {resultModal.resultText}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                marginTop: 10,
              }}
            >
              <span style={{ fontWeight: 800 }}>
                🏆 {resultModal.trophies}
              </span>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 800,
                  background: 'var(--primary-orange)',
                  color: '#000',
                }}
              >
                {resultModal.rank}
              </span>
            </div>
            {resultModal.place && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color:
                    'rgba(230,233,255,0.65)',
                }}
              >
                Overall leaderboard position: #
                {resultModal.place}
              </div>
            )}
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color:
                  'rgba(230,233,255,0.65)',
              }}
            >
              Tip: Only wins in live online games
              award trophies. Bot games are
              unranked.
            </div>
            <ModalGrid>
              <Button
                onClick={() => {
                  setMode(null);
                  roomIdRef.current = null;
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
                  startBot();
                }}
              >
                Play Bot
              </Button>
              <Button
                $primary
                onClick={() => {
                  setResultModal(null);
                  startOnline();
                }}
              >
                Find Online Match
              </Button>
            </ModalGrid>
          </Modal>
        </Overlay>
      )}
    </>
  );
}
