// client/src/pages/ReversiArena.js
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useContext,
  useRef,
  useLayoutEffect,
} from 'react';
import styled from 'styled-components';
import { io } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';
import GameSidebar from '../components/GameSidebar';
import GameRules from '../components/GameRules';

/* === Layout constants (match Checkers / Chess) === */
const SIDE_W = 360;
const HEADER_H = 76;
const BOTTOM_GAP = 40;
const MOBILE_NAV_H = 64;
const RAIL_PAD = 12;

/* ---------- shared look & feel (mirrors CheckersArena) ---------- */
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
  padding-bottom: 80px;
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
  transition: background 0.15s ease, box-shadow 0.15s ease, color 0.15s ease,
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
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.06);
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
  font-size: 13px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
`;

const Modal = styled.div`
  width: 540px;
  max-width: 94vw;
  background: var(--container-white);
  color: var(--text-color);
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  border: 1px solid var(--border-color);
  padding: 16px;
`;

/* Mobile top bar & drawer (like Checkers) */
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

const MobileOpponentClock = styled.span`
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: rgba(230, 233, 255, 0.75);
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

/* Mobile stack below board */
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

/* Buttons overlayed on board when no mode picked (mobile) */
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

/* ---------- clock helpers ---------- */
const START_MS = 4 * 60 * 1000; // 4 minutes
const fmtClock = (ms) => {
  ms = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(ms / 60);
  const s = ms % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/* ---------- Arena ---------- */
export default function ReversiArena({ onExit }) {
  const { user } = useContext(AuthContext);
  const SIZE = 8;

  const newBoard = () => {
    const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    b[3][3] = -1;
    b[4][4] = -1; // white
    b[3][4] = 1;
    b[4][3] = 1; // black
    return b;
  };

  const [board, setBoard] = useState(() => newBoard());
  const [player, setPlayer] = useState(1); // 1 = black (you), -1 = white
  const [status, setStatus] = useState('Pick a mode to start.');
  const [live, setLive] = useState(false);
  const [mode, setMode] = useState(null); // null | 'bot' | 'online'
  const [notice] = useState('');

  // online bits
  const [roomId, setRoomId] = useState(null);
  const [myColor, setMyColor] = useState(1); // 1=black, -1=white
  const myColorRef = useRef(1);
  const [oppName, setOppName] = useState('');
  const socketRef = useRef(null);

  // responsive board size (Checkers layout)
  const [boardSize, setBoardSize] = useState(720);
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
      const innerW = Math.max(240, Math.floor(panel.clientWidth - padX));
      const isPhone = window.matchMedia('(max-width: 860px)').matches;
      const inset = window.visualViewport
        ? Math.max(
            0,
            (window.innerHeight || 0) - window.visualViewport.height
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

  /* ---------- clocks ---------- */
  const [bMs, setBms] = useState(START_MS);
  const [wMs, setWms] = useState(START_MS);
  const [clockSince, setClockSince] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  const viewLeft = useCallback(
    (side /* 1=Black, -1=White */) => {
      const base = side === 1 ? bMs : wMs;
      if (
        clockSince &&
        player === side &&
        live &&
        (mode === 'bot' || mode === 'online')
      ) {
        const elapsed = nowTs - clockSince;
        return Math.max(0, base - elapsed);
      }
      return base;
    },
    [bMs, wMs, clockSince, player, live, mode, nowTs]
  );
  const chargeElapsedToCurrent = useCallback(() => {
    if (!clockSince) return;
    const elapsed = Date.now() - clockSince;
    if (player === 1) setBms((ms) => Math.max(0, ms - elapsed));
    else setWms((ms) => Math.max(0, ms - elapsed));
    setClockSince(Date.now());
  }, [clockSince, player]);

  /* ---------- rules / move generation ---------- */
  const dirs = useMemo(
    () =>
      [-1, 0, 1]
        .flatMap((dx) => [-1, 0, 1].map((dy) => [dx, dy]))
        .filter(([dx, dy]) => dx || dy),
    []
  );
  const inBounds = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

  const flipsFrom = useCallback(
    (b, x, y, turn) => {
      if (b[y][x] !== 0) return [];
      const flips = [];
      for (const [dx, dy] of dirs) {
        let nx = x + dx,
          ny = y + dy;
        const line = [];
        while (inBounds(nx, ny) && b[ny][nx] === -turn) {
          line.push([nx, ny]);
          nx += dx;
          ny += dy;
        }
        if (line.length && inBounds(nx, ny) && b[ny][nx] === turn) {
          flips.push(...line);
        }
      }
      return flips;
    },
    [dirs]
  );

  const allMoves = useCallback(
    (b, turn) => {
      const mv = [];
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          const f = flipsFrom(b, x, y, turn);
          if (f.length) mv.push({ x, y, flips: f });
        }
      return mv;
    },
    [flipsFrom]
  );

  const score = (b) => b.flat().reduce((s, v) => s + v, 0);

  const applyMove = (b, mv, turn) => {
    const nb = b.map((r) => r.slice());
    nb[mv.y][mv.x] = turn;
    for (const [fx, fy] of mv.flips) nb[fy][fx] = turn;
    return nb;
  };

  const endGame = useCallback(
    (b) => {
      setLive(false);
      setClockSince(null);
      const s = score(b);
      if (s > 0) setStatus('Black wins!');
      else if (s < 0) setStatus('White wins!');
      else setStatus('Draw!');
    },
    []
  );

  const passIfNeeded = useCallback(
    (b, turn) => {
      const myMoves = allMoves(b, turn);
      if (myMoves.length) return;
      const oppMoves = allMoves(b, -turn);
      if (oppMoves.length) {
        setPlayer(-turn);
        setStatus('No legal move — pass.');
        setClockSince(Date.now());
      } else {
        endGame(b);
      }
    },
    [allMoves, endGame]
  );

  const [resultModal, setResultModal] = useState(null);
  const awardedRef = useRef(false);

  const perGameRank = (n) => {
    if (n >= 1500) return 'Champion';
    if (n >= 900) return 'Diamond';
    if (n >= 600) return 'Platinum';
    if (n >= 400) return 'Gold';
    if (n >= 250) return 'Silver';
    if (n >= 100) return 'Bronze';
    return 'Wood';
  };

  const fetchMyReversiTrophies = useCallback(async () => {
    if (!user?._id) return 0;
    try {
      const { data } = await axios.get(
        `${API_BASE_URL}/api/games/stats/${user._id}`
      );
      return data?.trophiesByGame?.reversi || 0;
    } catch {
      return 0;
    }
  }, [user?._id]);

  const fetchMyOverallPlace = useCallback(async () => {
    if (!user?._id) return null;
    try {
      const q = new URLSearchParams({
        limit: '100',
        userId: user._id,
      });
      const { data } = await axios.get(
        `${API_BASE_URL}/api/games/leaderboard/overall?${q.toString()}`
      );
      return data?.me?.rank ?? null;
    } catch {
      return null;
    }
  }, [user?._id]);

  const awardOutcome = useCallback(
    async (kind) => {
      if (!user?._id || awardedRef.current) return null;
      try {
        const delta = kind === 'win' ? 6 : kind === 'loss' ? -6 : 0;
        await axios.post(`${API_BASE_URL}/api/games/result`, {
          userId: user._id,
          gameKey: 'reversi',
          delta,
          didWin: kind === 'win',
        });
        awardedRef.current = true;
        try {
          window.dispatchEvent(
            new CustomEvent('games:statsUpdated', {
              detail: { gameKey: 'reversi' },
            })
          );
        } catch {}
        const t = await fetchMyReversiTrophies();
        return t;
      } catch {
        return null;
      }
    },
    [user?._id, fetchMyReversiTrophies]
  );

  const openResultModal = useCallback(
    async (resultText, trophiesOverride = null, didWinOverride = null) => {
      const didWin =
        typeof didWinOverride === 'boolean' ? didWinOverride : false;
      const trophies =
        trophiesOverride ?? (await fetchMyReversiTrophies());
      const place = await fetchMyOverallPlace();
      setResultModal({
        didWin,
        resultText,
        trophies,
        rank: perGameRank(trophies),
        place,
      });
    },
    [fetchMyReversiTrophies, fetchMyOverallPlace]
  );

  /* ---------- derived state ---------- */
  const moves = useMemo(
    () => allMoves(board, player),
    [board, player, allMoves]
  );
  const legalMask = useMemo(
    () => new Set(moves.map((m) => `${m.x},${m.y}`)),
    [moves]
  );

  /* ---------- actions ---------- */
  const startBot = () => {
    setBoard(newBoard());
    setPlayer(1);
    setLive(true);
    setMode('bot');
    setStatus('Practice vs Bot: you are Black. Highest flips wins.');
    setMyColor(1);
    myColorRef.current = 1;
    setOppName('Bot');
    setBms(START_MS);
    setWms(START_MS);
    setClockSince(Date.now());
  };

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
      const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(hostname);
      if (isLocal) {
        const srvPort = '5000';
        WS_BASE = `${protocol}//${hostname}:${srvPort}`;
      } else {
        WS_BASE = `${protocol}//${host}`;
      }
    }
    WS_BASE = WS_BASE.replace(/\/+$/, '').replace(/\/api\/?$/, '');

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
      s.emit('reversi:queue', payload);
    });

    s.on('connect_error', (e) =>
      setStatus(`Socket connect error: ${e?.message || e}`)
    );
    s.on('error', (e) =>
      setStatus(`Socket error: ${e?.message || e}`)
    );
    s.on('reversi:queued', () =>
      setStatus('Looking for an opponent…')
    );

    s.on(
      'reversi:start',
      ({ roomId, color, state, black, white }) => {
        setRoomId(roomId);
        const mine = color === 'b' ? 1 : -1;
        setMyColor(mine);
        myColorRef.current = mine;
        setOppName(
          mine === 1
            ? white?.username || 'White'
            : black?.username || 'Black'
        );
        setBoard(state?.board || newBoard());
        setPlayer(state?.turn ?? 1);
        setLive(true);
        awardedRef.current = false;

        setBms(START_MS);
        setWms(START_MS);
        setClockSince(Date.now());

        setMode('online');
        setStatus('Live match started.');
      }
    );

    s.on('reversi:state', (payload) => {
      const state = payload?.state || payload;
      if (!state) return;
      chargeElapsedToCurrent();
      setBoard(state.board);
      setPlayer(state.turn);
      setClockSince(Date.now());
    });

    s.on(
      'reversi:gameover',
      async ({ roomId: rid, result, reason, winner }) => {
        if (rid && roomId && rid !== roomId) return;
        setClockSince(null);
        setLive(false);
        setMode(null);
        setStatus(`Game over: ${result} (${reason})`);

        const myLetter = myColorRef.current === 1 ? 'b' : 'w';
        const isDraw = winner == null;
        const didWin = !isDraw && winner === myLetter;

        const trophiesOverride = await awardOutcome(
          isDraw ? 'draw' : didWin ? 'win' : 'loss'
        );
        await openResultModal(result, trophiesOverride, didWin);
        setRoomId(null);
      }
    );

    s.on('reversi:queue-cancelled', () =>
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
    openResultModal,
    chargeElapsedToCurrent,
    roomId,
  ]);

  useEffect(() => {
    if (mode !== 'online') return;
    const s = socketRef.current;
    if (!s) return;

    if (roomId) return;

    let satisfied = false;
    const onQueued = () => {
      satisfied = true;
    };
    const onStart = () => {
      satisfied = true;
    };

    s.on('reversi:queued', onQueued);
    s.on('reversi:start', onStart);

    const t = setTimeout(() => {
      if (!satisfied && s.connected) {
        s.emit('reversi:queue', {
          userId: user?._id,
          username: user?.username,
        });
      }
    }, 1500);

    return () => {
      clearTimeout(t);
      s.off('reversi:queued', onQueued);
      s.off('reversi:start', onStart);
    };
  }, [mode, roomId, user?._id, user?.username]);

  const startOnline = () => {
    setBoard(newBoard());
    setLive(false);
    setMode('online');
    setStatus('Connecting…');
    setRoomId(null);
    setBms(START_MS);
    setWms(START_MS);
    setClockSince(null);
    const s = connectSocket();
    if (s?.connected) {
      s.emit('reversi:queue', {
        userId: user?._id,
        username: user?.username,
      });
    }
  };

  const leaveOnline = () => {
    const s = socketRef.current;

    if (mode === 'online' && s && roomId) {
      s.emit('reversi:resign', { roomId });
      setStatus('You resigned.');
      return;
    }

    if (s) {
      s.emit('reversi:leave', { roomId });
      s.disconnect();
      socketRef.current = null;
    }
    setLive(false);
    setMode(null);
    setRoomId(null);
    setClockSince(null);
  };

  const resign = () => {
    if (mode === 'online')
      socketRef.current?.emit('reversi:resign', {
        roomId,
      });
    setClockSince(null);
    setLive(false);
    setStatus('You resigned.');
  };

  const clickCell = (x, y) => {
    if (!live) return;

    if (mode === 'bot') {
      if (player !== 1) return;
      const mv = moves.find((m) => m.x === x && m.y === y);
      if (!mv) return;
      chargeElapsedToCurrent();
      const nb = applyMove(board, mv, 1);
      setBoard(nb);
      setPlayer(-1);
      setClockSince(Date.now());
      passIfNeeded(nb, -1);
      return;
    }

    if (mode === 'online') {
      if (player !== myColor) return;
      const mv = moves.find((m) => m.x === x && m.y === y);
      if (!mv) return;
      chargeElapsedToCurrent();
      socketRef.current?.emit('reversi:move', {
        roomId,
        x,
        y,
      });
      setClockSince(Date.now());
    }
  };

  /* ---------- bot move ---------- */
  useEffect(() => {
    if (player === -1 && live && mode === 'bot') {
      const mv = allMoves(board, -1);
      if (!mv.length) {
        passIfNeeded(board, -1);
        return;
      }
      const best = mv.reduce((a, m) => {
        if (!a || m.flips.length > a.flips.length) return m;
        if (
          m.flips.length === a.flips.length &&
          Math.random() < 0.5
        )
          return m;
        return a;
      }, null);
      const t = setTimeout(() => {
        chargeElapsedToCurrent();
        const nb = applyMove(board, best, -1);
        setBoard(nb);
        setPlayer(1);
        setClockSince(Date.now());
        passIfNeeded(nb, 1);
      }, 380);
      return () => clearTimeout(t);
    }
  }, [player, live, mode, board, allMoves, passIfNeeded, chargeElapsedToCurrent]);

  useEffect(
    () => () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    },
    []
  );

  /* ---------- rendering helpers ---------- */
  const cellSize = boardSize / SIZE;

  const oppSide = myColor === 1 ? -1 : 1;
  const opponentLabel =
    mode === 'bot'
      ? 'Bot'
      : oppName || (myColor === 1 ? 'White' : 'Black');
  const oppTimeMs = viewLeft(oppSide);
  const myTimeMs = viewLeft(myColor);
  const opponentTime = fmtClock(oppTimeMs);
  const myTime = fmtClock(myTimeMs);

  const showStartCTA = !mode && !resultModal;

  return (
    <>
      {/* Mobile top bar (drawer + opponent pill) */}
      <MobileTopBar>
        <DrawerButton
          onClick={() => setDrawerOpen(true)}
          aria-label="Open Reversi sidebar"
        >
          ➤
        </DrawerButton>

        <MobileOpponentPill>
          <MobileOpponentName>{opponentLabel}</MobileOpponentName>
          {(mode === 'bot' || mode === 'online') && (
            <MobileOpponentClock>{opponentTime}</MobileOpponentClock>
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
              {/* mobile start CTA overlay (same as Checkers) */}
              {showStartCTA && (
                <BoardOverlayCTA>
                  <div>
                    <Button onClick={startBot}>Practice vs Bot</Button>
                    <Button $primary onClick={startOnline}>
                      Play Online
                    </Button>
                  </div>
                </BoardOverlayCTA>
              )}

              {/* Board */}
              <div
                style={{
                  width: boardSize,
                  height: boardSize,
                  maxWidth: '100%',
                  maxHeight: boardSize,
                  borderRadius: 12,
                  border: '1px solid #ddd',
                  background: '#0f5132',
                  padding: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,.08)',
                  margin: '0 auto',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
                    gridTemplateRows: `repeat(${SIZE}, 1fr)`,
                    gap: 2,
                    width: '100%',
                    height: '100%',
                  }}
                >
                  {board.map((row, y) =>
                    row.map((v, x) => {
                      const isLegal =
                        live &&
                        legalMask.has(`${x},${y}`) &&
                        (mode === 'bot'
                          ? player === 1
                          : myColor === player);
                      return (
                        <div
                          key={`${x}-${y}`}
                          onClick={() => isLegal && clickCell(x, y)}
                          style={{
                            background: '#136f43',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isLegal ? 'pointer' : 'default',
                            position: 'relative',
                            boxShadow:
                              'inset 0 1px 0 rgba(255,255,255,.06), inset 0 -1px 0 rgba(0,0,0,.08)',
                          }}
                        >
                          {/* legal move dot */}
                          {isLegal && v === 0 && (
                            <div
                              style={{
                                width: cellSize * 0.22,
                                height: cellSize * 0.22,
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,.8)',
                              }}
                            />
                          )}
                          {/* discs */}
                          {v !== 0 && (
                            <div
                              style={{
                                width: cellSize * 0.72,
                                height: cellSize * 0.72,
                                borderRadius: '50%',
                                background: v === 1 ? '#111' : '#f9fafb',
                                boxShadow:
                                  v === 1
                                    ? 'inset 0 3px 8px rgba(255,255,255,.15), inset 0 -4px 8px rgba(0,0,0,.5)'
                                    : 'inset 0 3px 8px rgba(0,0,0,.15), inset 0 -4px 8px rgba(0,0,0,.25), 0 1px 0 rgba(0,0,0,.05)',
                              }}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </BoardViewport>

          {/* Mobile stats + actions under board (like Checkers) */}
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
                    {myTime}
                  </span>
                </div>
              </div>
            </MobileStatsRow>

            <div style={{ display: 'grid', gap: 10 }}>
              {mode && (
                <>
                  {mode === 'online' && (
                    <Button onClick={leaveOnline}>Leave Online</Button>
                  )}
                  <Button onClick={resign}>Resign</Button>
                </>
              )}

              <GameRules
                title="How to Play Reversi (Othello)"
                subtitle="Surround your opponent’s discs to flip them to your color."
                sections={[
                  {
                    heading: 'Goal',
                    text: 'Finish the game with more discs of your color on the board than your opponent.',
                  },
                  {
                    heading: 'Board & Setup',
                    list: [
                      '8×8 board with pieces that are black on one side and white on the other.',
                      'Game starts with 2 black and 2 white discs in the center in a diagonal pattern.',
                    ],
                  },
                  {
                    heading: 'Moves',
                    list: [
                      'Players alternate turns placing a disc of their color.',
                      'Each move must flip at least one opponent disc.',
                      'You flip by bracketing a line of opponent discs between the disc you place and an existing disc of your color (horizontally, vertically, or diagonally).',
                    ],
                  },
                  {
                    heading: 'Passing & End',
                    list: [
                      'If you have no legal move, you must pass.',
                      'The game ends when neither player has a legal move (usually when the board is full).',
                    ],
                  },
                ]}
                buttonText="📘 Rules"
                buttonTitle="Reversi Rules"
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
                onClick={() =>
                  typeof onExit === 'function' ? onExit() : null
                }
                title="Return to Games"
              >
                <span className="icon">←</span>
                <span>Return to Games</span>
              </ReturnButton>
            </div>
          </MobileStack>
        </BoardPanel>

        {/* RIGHT: sticky rail with controls (desktop, Checkers-style) */}
        <RightRailShell>
          <RightRailTopBar>
            <ReturnButton
              onClick={() =>
                typeof onExit === 'function' ? onExit() : null
              }
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
              <Button onClick={startBot} style={{ padding: '10px 12px' }}>
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
              <Button onClick={resign} style={{ padding: '10px 12px' }}>
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
              {status}
            </div>

            {!!notice && <Alert>{notice}</Alert>}

            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: 'rgba(230,233,255,0.65)',
              }}
            >
              Wins vs real players grant <b>+6 trophies</b>. Bot games are
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
                <strong>{opponentLabel}</strong>
                <span
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtClock(oppTimeMs)}
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
                <strong>{user?.username || 'You'}</strong>
                <span
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtClock(myTimeMs)}
                </span>
              </div>
            </div>

            {/* rules in-rail on desktop */}
            <div style={{ marginTop: 12 }}>
              <GameRules
                title="How to Play Reversi (Othello)"
                subtitle="Control the board by flipping discs to your color."
                sections={[
                  {
                    heading: 'Goal',
                    text: 'End the game with more discs showing your color than your opponent.',
                  },
                  {
                    heading: 'Moves',
                    list: [
                      'On your turn, place a disc of your color so that it brackets one or more lines of opponent discs.',
                      'You flip every bracketed line between the new disc and an existing disc of your color.',
                      'If you have no legal move, you must pass.',
                    ],
                  },
                  {
                    heading: 'End of Game',
                    list: [
                      'Game ends when neither player has a legal move.',
                      'The player with more discs on the board wins.',
                    ],
                  },
                ]}
                buttonText="📘 Rules"
                buttonTitle="Reversi Rules"
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

      {/* Mobile drawer for Reversi stats (GameSidebar), like Checkers */}
      {drawerOpen && (
        <DrawerBackdrop onClick={() => setDrawerOpen(false)} />
      )}
      <Drawer
        $open={drawerOpen}
        role="complementary"
        aria-label="Reversi sidebar"
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
              boxShadow: '0 8px 18px rgba(0,0,0,.12)',
            }}
          >
            ×
          </button>
        </div>

        <GameSidebar gameKey="reversi" title="Reversi" showOnMobile />
      </Drawer>

      {/* Result modal (same style as Checkers) */}
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
                color: 'rgba(230,233,255,0.80)',
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
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: 'rgba(230,233,255,0.65)',
              }}
            >
              Overall leaderboard place:{' '}
              <b>#{resultModal.place ?? '—'}</b>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3,1fr)',
                gap: 8,
                marginTop: 12,
              }}
            >
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
                  startBot();
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
            </div>
          </Modal>
        </Overlay>
      )}
    </>
  );
}
