import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { io } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

/* ---------- shared look & feel (matches ChessArena) ---------- */
const Wrap = styled.div`display:grid; grid-template-columns: 480px 1fr; gap:16px; align-items:start;`;
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

/* ================================================================
   Lightweight Checkers model
   ================================================================= */
const DARK = '#b58863';
const LIGHT = '#f0d9b5';

function makeInitialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) board[r][c] = 'b';
  for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) board[r][c] = 'w';
  return board;
}
const cloneBoard = b => b.map(row => row.slice());
const isKing = p => p === 'W' || p === 'B';
const colorOf = p => (p ? (p.toLowerCase() === 'w' ? 'w' : 'b') : null);

function legalMovesFor(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const col = colorOf(piece);
  const dirs = [];
  const forward = col === 'w' ? -1 : 1;
  if (isKing(piece)) dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
  else dirs.push([forward,-1],[forward,1]);

  const inBounds = (rr, cc) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8;
  const moves = [];

  // non-captures
  for (const [dr, dc] of dirs) {
    const rr = r + dr, cc = c + dc;
    if (inBounds(rr, cc) && (rr + cc) % 2 === 1 && !board[rr][cc]) {
      moves.push({ from:[r,c], to:[rr,cc], capture:null });
    }
  }

  // captures
  for (const [dr, dc] of dirs) {
    const mr = r + dr, mc = c + dc;
    const lr = r + 2 * dr, lc = c + 2 * dc;
    if (!inBounds(lr, lc) || !inBounds(mr, mc)) continue;
    if ((lr + lc) % 2 !== 1) continue;
    const mid = board[mr][mc];
    if (mid && colorOf(mid) !== col && !board[lr][lc]) {
      moves.push({ from:[r,c], to:[lr,lc], capture:[mr,mc] });
    }
  }
  return moves;
}
const captureMovesFor = (board, r, c) => legalMovesFor(board, r, c).filter(m => !!m.capture);

function allMoves(board, color) {
  const mm = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (!board[r][c]) continue;
    if (colorOf(board[r][c]) !== color) continue;
    mm.push(...legalMovesFor(board, r, c));
  }
  return mm;
}
const hasAnyCaptures = (board, color) => {
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    if (!board[r][c] || colorOf(board[r][c])!==color) continue;
    if (captureMovesFor(board,r,c).length) return true;
  }
  return false;
};

function applyMove(board, move) {
  const b = cloneBoard(board);
  const [r1, c1] = move.from;
  const [r2, c2] = move.to;
  const piece = b[r1][c1];
  b[r1][c1] = null;
  b[r2][c2] = piece;

  if (move.capture) {
    const [mr, mc] = move.capture;
    b[mr][mc] = null;
  }

  const wasKing = isKing(piece);
  if (piece === 'w' && r2 === 0) b[r2][c2] = 'W';
  if (piece === 'b' && r2 === 7) b[r2][c2] = 'B';
  const nowKing = isKing(b[r2][c2]);

  return { board: b, to:[r2,c2], justPromoted: !wasKing && nowKing };
}
const hasAnyPieces = (board, color) => {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (board[r][c] && colorOf(board[r][c]) === color) return true;
  }
  return false;
};

/* ---------- Display board (fixed width like chess: 456 px) ---------- */
function CheckersBoard({ board, onTryMove, orientation='white', turn='w', lockFrom=null, mustCapture=false, onIllegal }) {
  const [sel, setSel] = useState(null);
  const size = 456;
  const sq = Math.floor(size / 8);

  const squares = useMemo(() => {
    const coords = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) coords.push([r,c]);
    if (orientation === 'black') coords.reverse();
    return coords;
  }, [orientation]);

  const legalForSel = useMemo(() => {
    if (!sel) return [];
    const all = legalMovesFor(board, sel[0], sel[1]);
    if (lockFrom) {
      if (sel[0] !== lockFrom[0] || sel[1] !== lockFrom[1]) return [];
      return all.filter(m => !!m.capture);
    }
    return mustCapture ? all.filter(m => !!m.capture) : all;
  }, [board, sel, lockFrom, mustCapture]);

  const canSelect = (r,c) => {
    const p = board[r][c];
    if (!p || colorOf(p) !== turn) return false;
    if (lockFrom) return r === lockFrom[0] && c === lockFrom[1];
    if (mustCapture) return captureMovesFor(board, r, c).length > 0;
    return true;
  };

  const clickSquare = (r, c) => {
    if (!sel) {
      if (canSelect(r,c)) setSel([r,c]);
      else if (board[r][c] && colorOf(board[r][c]) === turn) {
        if (lockFrom) onIllegal?.('You must continue jumping with the same piece.');
        else if (mustCapture) onIllegal?.('A capture is available — you must capture.');
      }
      return;
    }

    if (sel[0] === r && sel[1] === c) { setSel(null); return; }

    const mv = legalForSel.find(m => m.to[0] === r && m.to[1] === c);
    if (mv) {
      const ok = onTryMove(mv); if (ok !== false) setSel(null);
    } else {
      if (canSelect(r,c)) setSel([r,c]);
      else onIllegal?.('Illegal move. Try again.');
    }
  };

  const renderPiece = (p) => {
    const king = isKing(p);
    const fill = p.toLowerCase() === 'w' ? '#fff' : '#111';
    const stroke = p.toLowerCase() === 'w' ? '#ddd' : '#333';
    return (
      <svg width={sq} height={sq} viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="34" fill={fill} stroke={stroke} strokeWidth="6" />
        {king && (
          <text x="50" y="60" textAnchor="middle" fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif"
                fontWeight="900" fontSize="44" fill={p.toLowerCase()==='w' ? '#111' : '#fff'}>K</text>
        )}
      </svg>
    );
  };

  return (
    <div style={{ width:size, height:size, borderRadius:12, overflow:'hidden',
                  boxShadow:'0 8px 24px rgba(0,0,0,.08)', border:'1px solid var(--border-color)' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(8, 1fr)', gridTemplateRows:'repeat(8, 1fr)' }}>
        {squares.map(([r,c]) => {
          const dark = (r+c) % 2 === 1;
          const selected = sel && sel[0] === r && sel[1] === c;
          const canGo = !!(sel && legalForSel.find(m => m.to[0] === r && m.to[1] === c));
          const piece = board[r][c];
          return (
            <button
              key={`${r}-${c}`}
              onClick={()=>clickSquare(r,c)}
              style={{
                width:sq, height:sq, padding:0, margin:0, appearance:'none',
                background: dark ? DARK : LIGHT,
                border: 'none',
                outline: selected ? '3px solid #0ea5e9' : 'none',
                position:'relative', cursor:'pointer'
              }}
              aria-label={`r${r}c${c}`}
            >
              {piece && <div style={{ position:'absolute', inset:0 }}>{renderPiece(piece)}</div>}
              {canGo && (
                <span style={{
                  position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
                  width:18, height:18, borderRadius:'999px', background:'rgba(14,165,233,.75)'
                }}/>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
   Arena
   ================================================================= */
export default function CheckersArena() {
  const { user } = useContext(AuthContext);

  const [mode, setMode] = useState(null);       // null | 'bot' | 'online'
  const [board, setBoard] = useState(makeInitialBoard());
  const [turn, setTurn] = useState('w');
  const [orientation, setOrientation] = useState('white');
  const [status, setStatus] = useState('Pick a mode to start.');
  const [notice, setNotice] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [lockFrom, setLockFrom] = useState(null); // force same piece during capture chain
  const socketRef = useRef(null);

  const awardedRef = useRef(false);
  const noticeTimer = useRef(null);

  const flashNotice = useCallback((msg, ms=1600) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(msg);
    noticeTimer.current = setTimeout(()=> setNotice(''), ms);
  }, []);
  const clearNotice = useCallback(() => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice('');
  }, []);

  const resetLocal = useCallback((flip='white') => {
    setBoard(makeInitialBoard());
    setTurn('w');
    setOrientation(flip);
    setLockFrom(null);
    awardedRef.current = false;
    clearNotice();
  }, [clearNotice]);

  /* ---------------- BOT MODE ---------------- */
  const startBot = () => {
    setMode('bot');
    setRoomId(null);
    resetLocal('white');
    setStatus('Practice vs Bot. You are White.');
  };

  // Bot plays entire turn incl. capture chains
  const botPlayTurn = (b, side) => {
    let moves = allMoves(b, side);
    if (!moves.length) return { board: b, next: side };

    // prefer captures
    let pool = moves.filter(m => !!m.capture);
    if (!pool.length) {
      const m = moves[Math.floor(Math.random() * moves.length)];
      const res = applyMove(b, m);
      return { board: res.board, next: (side === 'w' ? 'b' : 'w') };
    }

    let cur = applyMove(b, pool[Math.floor(Math.random() * pool.length)]);
    while (!cur.justPromoted) {
      const [rr, cc] = cur.to;
      const further = captureMovesFor(cur.board, rr, cc);
      if (!further.length) break;
      const m2 = further[Math.floor(Math.random() * further.length)];
      cur = applyMove(cur.board, m2);
    }
    return { board: cur.board, next: (side === 'w' ? 'b' : 'w') };
  };

  /* ---------------- TROPHY AWARD (online only) ---------------- */
  const awardWin = useCallback(async () => {
    if (!user?._id || awardedRef.current) return;
    try {
      await axios.post(`${API_BASE_URL}/api/games/result`, {
        userId: user._id,
        gameKey: 'checkers',
        delta: 6,
        didWin: true,
      });
      awardedRef.current = true;
    } catch (e) {
      console.warn('Failed to award checkers trophies:', e?.message || e);
    }
  }, [user?._id]);

  /* ---------------- ONLINE MODE ---------------- */
  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const s = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => setStatus('Connected. Queueing…'));
    s.on('checkers:queued', () => setStatus('Looking for an opponent…'));

    s.on('checkers:start', ({ roomId, color, state, white, black }) => {
      setBoard(state?.board || makeInitialBoard());
      setTurn(state?.turn || 'w');
      setOrientation(color === 'w' ? 'white' : 'black');
      setRoomId(roomId);
      setMode('online');
      setLockFrom(null);
      awardedRef.current = false;
      clearNotice();
      setStatus(`Match found: ${white?.username || 'White'} vs ${black?.username || 'Black'}. You are ${color==='w'?'White':'Black'}.`);
    });

    s.on('checkers:state', ({ state }) => {
      if (!state) return;
      setBoard(state.board);
      setTurn(state.turn);
      setLockFrom(state.lockFrom || null);
      clearNotice();
    });

    s.on('checkers:gameover', ({ result, reason }) => {
      setStatus(`Game over: ${result} (${reason})`);
      if (mode === 'online') {
        const myColor = orientation === 'white' ? 'w' : 'b';
        const winColor = /white wins/i.test(result) ? 'w' : (/black wins/i.test(result) ? 'b' : null);
        if (winColor && myColor === winColor) awardWin();
      }
    });

    s.on('checkers:queue-cancelled', () => setStatus('Queue cancelled.'));
    s.on('disconnect', () => setStatus('Disconnected.'));
    return s;
  }, [mode, orientation, awardWin, clearNotice]);

  const startOnline = () => {
    resetLocal('white');
    const s = connectSocket();
    s.emit('checkers:queue', { userId: user?._id, username: user?.username });
  };

  const leaveOnline = () => {
    const s = socketRef.current;
    if (s && roomId) s.emit('checkers:leave', { roomId });
    if (s) { s.disconnect(); socketRef.current = null; }
    setMode(null);
    setRoomId(null);
    setStatus('Left online mode.');
    clearNotice();
  };

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  /* ---------------- Moves / rules ---------------- */
  const myColor = useMemo(() => (orientation === 'white' ? 'w' : 'b'), [orientation]);
  const mustCapture = useMemo(() => hasAnyCaptures(board, turn), [board, turn]);

  const tryMove = (mv) => {
    // online: only your turn
    if (mode === 'online' && myColor !== turn) { flashNotice('Not your turn.'); return false; }

    // mid-chain: must keep jumping with same piece
    if (lockFrom) {
      if (!(mv.capture && mv.from[0] === lockFrom[0] && mv.from[1] === lockFrom[1])) {
        flashNotice('You must continue jumping with the same piece.');
        return false;
      }
    }

    // forced-capture: if any capture exists, non-capture is illegal
    if (!lockFrom && mustCapture && !mv.capture) {
      flashNotice('A capture is available — you must capture.');
      return false;
    }

    // verify against legal set
    const legal = allMoves(board, turn);
    const ok = legal.find(m =>
      m.from[0] === mv.from[0] && m.from[1] === mv.from[1] &&
      m.to[0] === mv.to[0] && m.to[1] === mv.to[1] &&
      ((m.capture && mv.capture &&
        m.capture[0] === mv.capture[0] && m.capture[1] === mv.capture[1]) || (!m.capture && !mv.capture))
    );
    if (!ok) { flashNotice('Illegal move. Try again.'); return false; }

    const res = applyMove(board, mv);

    // continue chain if more captures are available (promotion ends chain)
    if (mv.capture && !res.justPromoted) {
      const further = captureMovesFor(res.board, res.to[0], res.to[1]);
      if (further.length) {
        setBoard(res.board);
        setLockFrom(res.to);
        setStatus('Keep jumping with the same piece.');
        clearNotice();
        if (mode === 'online' && socketRef.current && roomId) {
          socketRef.current.emit('checkers:move', { roomId, move: mv, chain: true });
        }
        return true;
      }
    }

    // end of turn
    const next = (turn === 'w' ? 'b' : 'w');
    setBoard(res.board);
    setTurn(next);
    setLockFrom(null);
    clearNotice();

    if (mode === 'bot') {
      setTimeout(() => {
        const botRes = botPlayTurn(res.board, next);
        setBoard(botRes.board);
        setTurn(botRes.next);
        setLockFrom(null);
      }, 450);
    } else if (mode === 'online' && socketRef.current && roomId) {
      socketRef.current.emit('checkers:move', { roomId, move: mv, chain: false });
    }
    return true;
  };

  /* ---------------- Game end helpers ---------------- */
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

  const resign = () => {
    if (mode === 'online' && socketRef.current && roomId) {
      socketRef.current.emit('checkers:resign', { roomId });
    } else if (mode === 'bot') {
      setStatus('You resigned.');
    }
  };

  return (
    <Wrap>
      <Panel>
        <CheckersBoard
          board={board}
          onTryMove={tryMove}
          orientation={orientation}
          turn={turn}
          lockFrom={lockFrom}
          mustCapture={mustCapture}
          onIllegal={(msg)=> flashNotice(msg || 'Illegal move. Try again.')}
        />
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
        <div style={{marginTop:10, color:'#555'}}>{status}</div>
        {!!notice && <Alert>{notice}</Alert>}
        <div style={{marginTop:12, fontSize:12, color:'#6b7280'}}>
          Wins vs real players grant <b>+6 trophies</b>. Bot games are unranked.
        </div>
      </Panel>
    </Wrap>
  );
}
