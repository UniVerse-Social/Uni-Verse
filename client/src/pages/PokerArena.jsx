// client/src/pages/PokerArena.jsx
import React, {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from 'react';
import styled, { keyframes, css } from 'styled-components';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

/* === Layout constants (mirror ChessArena) === */
const SIDE_W = 360;
const HEADER_H = 76;
const BOTTOM_GAP = 40;
const MOBILE_NAV_H = 64;
const RAIL_PAD = 12;

/* ---------- Animations ---------- */
const fadeIn = keyframes`
  from { opacity:0; transform:translateY(6px); }
  to   { opacity:1; transform:translateY(0); }
`;
const flipIn = keyframes`
  from { opacity:0; transform:rotateY(90deg) scale(.9); }
  to   { opacity:1; transform:rotateY(0) scale(1); }
`;
const pop = keyframes`
  0%   { transform:scale(1);   }
  40%  { transform:scale(1.06);}
  100% { transform:scale(1);   }
`;
const pulseGlow = keyframes`
  0%   { box-shadow:0 0 0 rgba(255,255,255,0); }
  50%  { box-shadow:0 0 24px rgba(255,255,255,.35); }
  100% { box-shadow:0 0 0 rgba(255,255,255,0); }
`;

const winPop = keyframes`
  0%   { transform:translateY(8px) scale(.85); opacity:0; }
  40%  { opacity:1; }
  100% { transform:translateY(0) scale(1); opacity:1; }
`;

/* ---------- Shared layout (mirrors ChessArena) ---------- */

const Container = styled.div`
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
`;

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
  height: 56px;
  margin-bottom: 12px;
`;

const ControlsPanel = styled(Panel)`
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;

  flex: 1 1 auto;
  min-height: 0;
  align-self: stretch;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
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
  border: 1px solid ${p => (p.$primary ? 'transparent' : 'var(--border-color)')};
  background: ${p =>
    p.$primary ? 'var(--primary-orange)' : 'rgba(255,255,255,0.06)'};
  color: ${p => (p.$primary ? '#000' : 'var(--text-color)')};
  font-weight: 800;
  transition: background 0.15s ease, box-shadow 0.15s ease,
    color 0.15s ease, transform 0.08s ease;

  &:hover {
    background: ${p =>
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

/* --- Mobile top bar & drawer (mirrors ChessArena) --- */
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
  transform: translateX(${p => (p.$open ? '0' : '-100%')});
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

const MobileStack = styled.div`
  display: none;

  @media (max-width: 860px) {
    display: grid;
    gap: 10px;
    margin-top: 8px;
    width: 100%;
  }
`;

/* ---------- Poker-specific cards / lobby / table ---------- */

const Card = styled.div`
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.35);
`;

/* Lobby controls inside right rail / drawer */
const Top = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 8px;
`;

const Pill = styled.button`
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-color);
  border-radius: 999px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 700;
  transition: background 0.15s ease, box-shadow 0.15s ease,
    transform 0.08s ease, color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
  }
  &:active {
    transform: translateY(0);
  }

  ${p =>
    p.$on &&
    `
    background: var(--primary-orange);
    color: #000;
    border-color: transparent;
    box-shadow: 0 8px 22px rgba(0,0,0,.35);
  `}
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
`;

const TableCard = styled.div`
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px;
  background: var(--container-white);
  color: var(--text-color);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
`;

const TableHeader = styled.div`
  display: flex;
  justify-content: space-between;
  font-weight: 800;
  margin-bottom: 6px;
`;

/* Main poker table, sized similarly to chess board */
const TableWrap = styled(Card)`
  min-height: 520px;
  position: relative;
  margin-top: 0;
`;

const Felt = styled.div`
  position: absolute;
  inset: 10px;
  border-radius: 24px;
  background: radial-gradient(circle at 50% 20%, #065f46, #064e3b);
  border: 4px solid #064e3b;
  color: #fff;
  overflow: hidden;
`;

const Pot = styled.div`
  position: absolute;
  top: 46%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-weight: 800;
  animation: ${p => (p.$pulse ? pop : 'none')} 0.4s ease;
`;

const Comm = styled.div`
  position: absolute;
  top: 52%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  animation: ${fadeIn} 0.25s ease;
`;

const PlayingCard = styled.div`
  width: 36px;
  height: 52px;
  background: #fff;
  color: #111827;
  border-radius: 6px;
  border: 1px solid #111827;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  animation: ${flipIn} 0.22s ease;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
`;

/* Seat layout (unchanged behaviour, just re-used inside new layout) */
const Seat = styled.div`
  position: absolute;
  width: 140px;
  text-align: center;
  transform: translate(-50%, -50%);
`;

const SeatName = styled.div`
  font-weight: 800;
  min-height: 22px;
  padding-top: 6px;
`;

const SeatStack = styled.div`
  min-height: 18px;
`;

const SeatCards = styled.div`
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-top: 6px;
  min-height: 56px;
`;

const BlindChip = styled.div`
  position: absolute;
  transform: translate(-50%, -50%);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fbbf24;
  color: #111;
  font-weight: 900;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(0, 0, 0, 0.25);
  animation: ${fadeIn} 0.2s ease;
`;

const NameWrap = styled.span`
  display: inline-block;
  padding: 0 6px;
  border-radius: 12px;
  background: transparent;
`;

const NamePulse = styled.span`
  display: inline-block;
  ${p =>
    p.$on &&
    css`
      animation: ${pulseGlow} 1.2s ease infinite;
    `}
`;

/* Subtle halo under active player */
const TurnHalo = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 128px;
  height: 128px;
  border-radius: 999px;
  pointer-events: none;
  background: radial-gradient(
    closest-side,
    rgba(139, 123, 255, 0.25),
    rgba(89, 208, 255, 0)
  );
  animation: ${fadeIn} 0.18s ease;
`;

/* Winner pill */
const WinPill = styled.div`
  position: absolute;
  left: 50%;
  top: calc(100% + 4px);
  transform: translateX(-50%);
  background: #16a34a;
  color: #fff;
  padding: 4px 8px;
  border-radius: 999px;
  font-weight: 900;
  font-size: 12px;
  animation: ${winPop} 0.35s ease;
  box-shadow: 0 6px 20px rgba(22, 163, 74, 0.35);
`;

/* Action bar, still overlayed on felt */
const ActionBar = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
  justify-content: center;
`;

const Btn = styled.button`
  background: var(--primary-orange);
  color: #000;
  border: 0;
  border-radius: 12px;
  padding: 10px 12px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
  transition: background 0.15s ease, transform 0.08s ease,
    box-shadow 0.15s ease;

  &:hover {
    background: linear-gradient(90deg, var(--primary-orange), #59d0ff);
    transform: translateY(-1px);
  }
  &:active {
    transform: translateY(0);
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

/* Chat: desktop & mobile variants to slot into right rail / mobile stack */
const ChatShell = styled(Panel)`
  display: flex;
  flex-direction: column;
  height: 240px;
  margin-top: 16px;

  @media (max-width: 860px) {
    display: none;
  }
`;

const ChatMobileShell = styled(Panel)`
  display: none;
  flex-direction: column;
  height: 220px;

  @media (max-width: 860px) {
    display: flex;
    margin-top: 8px;
  }
`;

const ChatList = styled.div`
  flex: 1;
  overflow: auto;
  font-size: 13px;
`;

const ChatInput = styled.input`
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-color);
`;

/* Ready / spectating overlays */
const ReadyOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.22),
    rgba(0, 0, 0, 0)
  );
  pointer-events: auto;
`;

const ReadyBox = styled.div`
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  padding: 16px;
  border-radius: 12px;
  min-width: 260px;
  text-align: center;
  animation: ${fadeIn} 0.2s ease;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.35);
`;

/* Stakes presets */
const STAKES = ['100', '1000', '5000', '10000', 'VIP'];

/* Card glyph helper */
function CardGlyph({ c }) {
  const r = c?.[0];
  const s = c?.[1];
  const suit =
    s === 'S' ? '♠' : s === 'H' ? '♥' : s === 'D' ? '♦' : '♣';
  return (
    <PlayingCard aria-label={c}>
      {r}
      {suit}
    </PlayingCard>
  );
}

/* Seat anchor coords (%) */
const SEAT_POS = [
  { left: 50, top: 10 },
  { left: 82, top: 18 },
  { left: 90, top: 44 },
  { left: 82, top: 70 },
  { left: 50, top: 82 },
  { left: 18, top: 70 },
  { left: 10, top: 44 },
  { left: 18, top: 18 },
];

function towardCenter(pos, ratio = 0.65) {
  const cx = 50;
  const cy = 50;
  return {
    left: cx + (pos.left - cx) * ratio,
    top: cy + (pos.top - cy) * ratio,
  };
}

export default function PokerArena({ onResult, onExit }) {
  const { user } = useContext(AuthContext);

  const buyInRef = useRef(0);
  const lastStackRef = useRef(0);
  const lastPotRef = useRef(0);

  const [stake, setStake] = useState('100');
  const [tables, setTables] = useState([]);
  const [tableId, setTableId] = useState(null);
  const [state, setState] = useState(null);
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState('');
  const [myCards, setMyCards] = useState([]);
  const [potPulse, setPotPulse] = useState(false);

  const socketRef = useRef(null);
  const tableIdRef = useRef(null);
  const handIdRef = useRef(0);
  useEffect(() => {
    tableIdRef.current = tableId;
  }, [tableId]);

  const mySeat = useMemo(() => {
    if (!state?.seats) return -1;
    return state.seats.findIndex(
      s => s && String(s.userId) === String(user?._id)
    );
  }, [state, user?._id]);

  const iAmSpectating =
    mySeat >= 0 ? !!state?.seats?.[mySeat]?.waiting : false;

  const activeCount = useMemo(() => {
    return (state?.seats || []).filter(s => s && !s.waiting).length;
  }, [state?.seats]);

  const liveRound =
    state?.round && !['idle', 'ready'].includes(state.round);
  const showBoard =
    liveRound || (!!state?.lastWin && state?.round === 'idle');
  const canAct =
    mySeat >= 0 &&
    state?.turn === mySeat &&
    liveRound;

  const canLeave =
    state?.round === 'idle' ||
    state?.round === 'ready' ||
    iAmSpectating;

  const [timeLeft, setTimeLeft] = useState(0);
  const iAmReady = useMemo(() => {
    const acc = new Set(state?.ready?.accepted || []);
    return acc.has(mySeat);
  }, [state?.ready, mySeat]);

  const [drawerOpen, setDrawerOpen] = useState(false);

  /* Match ChessArena: keep table viewport similar to board size */
  const [tableWidth, setTableWidth] = useState(720);
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    const getPad = el => {
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
      const isPhone =
        window.matchMedia('(max-width: 860px)').matches;
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

      setTableWidth(Math.min(innerW, availH));
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

  /* Lock body scroll when drawer is open (mirror ChessArena) */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (drawerOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  /* --- Socket setup (unchanged behaviour, only layout changed) --- */
  useEffect(() => {
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
      const isLocal =
        /^(localhost|127\.0\.0\.1)$/i.test(hostname);
      WS_BASE = isLocal
        ? `${protocol}//${hostname}:5000`
        : `${protocol}//${host}`;
    }

    WS_BASE = WS_BASE
      .replace(/\/+$/, '')
      .replace(/\/api\/?$/, '');

    try {
      const po = new URL(window.location.origin);
      const wb = new URL(WS_BASE || po.origin);
      if (
        /trycloudflare\.com$/i.test(po.hostname) &&
        po.hostname !== wb.hostname
      ) {
        WS_BASE = po.origin;
      }
    } catch {}

    const socket = io(WS_BASE, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      upgrade: true,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 750,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    socketRef.current = socket;

    const list = () =>
      socket.emit('poker:list', { stake, stakes: stake });

    const handleConnect = () => {
      if (tableIdRef.current) {
        socket.emit('poker:join', {
          tableId: tableIdRef.current,
          userId: user?._id,
          username: user?.username,
        });
      } else {
        list();
      }
    };

    socket.on('connect', handleConnect);
    socket.on('connect_error', e => {
      try {
        console.warn(
          '[Poker] socket connect error:',
          e?.message || e
        );
      } catch {}
    });

    socket.on('poker:lobbies', arr =>
      setTables(Array.isArray(arr) ? arr : [])
    );
    socket.on('poker:lobbies:update', u => {
      if (!u || !u.id) return;
      setTables(prev =>
        prev.map(t =>
          t.id === u.id ? { ...t, players: u.players } : t
        )
      );
    });

    socket.on('poker:joined', payload => {
      setTableId(payload.id);
      setState(payload);
      setChat((payload.chat || []).slice(-20));
      setMyCards([]);

      lastPotRef.current = Number(payload?.pot || 0);
      setPotPulse(false);

      const meIdx = (payload.seats || []).findIndex(
        s => s && String(s.userId) === String(user?._id)
      );
      const start =
        meIdx >= 0 ? Number(payload.seats[meIdx].stack || 0) : 0;
      buyInRef.current = start;
      lastStackRef.current = start;
    });

    socket.on('poker:state', s => {
      const incomingHandId = s?.handId ?? 0;
      // Ignore any state from an older hand – this kills ghost replays.
      if (incomingHandId < handIdRef.current) {
        return;
      }
      handIdRef.current = incomingHandId;
      const nextPot = Number(s?.pot || 0);
      const prevPot = Number(lastPotRef.current || 0);
      if (nextPot !== prevPot) {
        setPotPulse(true);
        setTimeout(() => setPotPulse(false), 420);
      }
      lastPotRef.current = nextPot;

      setState(s);
      if (s?.round === 'idle') setMyCards([]);

      const meIdx = (s?.seats || []).findIndex(
        x => x && String(x.userId) === String(user?._id)
      );
      if (meIdx >= 0) {
        lastStackRef.current = Number(
          s.seats[meIdx]?.stack || 0
        );
      }
    });

    socket.on('poker:hole', cards =>
      setMyCards(Array.isArray(cards) ? cards : [])
    );
    socket.on('poker:chat', m =>
      setChat(x => [...x, m].slice(-20))
    );
    socket.on('poker:error', e =>
      alert(e.message || 'Poker error')
    );

    list();
    const pollId = setInterval(list, 4000);

    return () => {
      clearInterval(pollId);
      socket.off('connect', handleConnect);
      socket.off('connect_error');
      socket.off('poker:lobbies');
      socket.off('poker:lobbies:update');
      socket.off('poker:joined');
      socket.off('poker:state');
      socket.off('poker:hole');
      socket.off('poker:chat');
      socket.off('poker:error');
      socket.disconnect();
    };
  }, [stake, user?._id, user?.username]);

  useEffect(() => {
    let tId;
    const tick = () => {
      const deadline = state?.ready?.deadline;
      if (!deadline) {
        setTimeLeft(0);
        return;
      }
      const sec = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1000)
      );
      setTimeLeft(sec);
      if (sec <= 0) return;
      tId = setTimeout(tick, 250);
    };
    tick();
    return () => clearTimeout(tId);
  }, [state?.ready?.deadline]);

  useEffect(() => {
    if (state?.round === 'ready' && !iAmReady) {
      const deadline = state?.ready?.deadline || 0;
      const ms = Math.max(0, deadline - Date.now() - 900);
      const id = setTimeout(
        () => socketRef.current.emit('poker:ready'),
        ms
      );
      return () => clearTimeout(id);
    }
  }, [state?.round, state?.ready?.deadline, iAmReady]);

  useEffect(() => {
    if (!tableId) return;
    const s = socketRef.current;
    if (!s) return;

    let stopped = false;
    const ping = () => {
      if (stopped) return;
      s.emit('poker:heartbeat');
      t = setTimeout(ping, 2000);
    };
    let t = setTimeout(ping, 200);

    const onVis = () => {
      if (!document.hidden) s.emit('poker:heartbeat');
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stopped = true;
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [tableId]);

  /* --- Actions --- */
  const join = id => {
    if (tableId) return;
    socketRef.current.emit('poker:join', {
      tableId: id,
      userId: user._id,
      username: user.username,
    });
  };

  const leave = () => {
    const delta =
      Number(lastStackRef.current || 0) -
      Number(buyInRef.current || 0);
    try {
      if (typeof onResult === 'function') {
        onResult('poker', delta, delta > 0);
      }
    } catch {}

    socketRef.current.emit('poker:leave', {});
    setTableId(null);
    setState(null);
    setChat([]);
    setMyCards([]);
    buyInRef.current = 0;
    lastStackRef.current = 0;
  };

  const act = (type, amount) =>
    socketRef.current.emit('poker:action', { type, amount });

  const readyUp = () => socketRef.current.emit('poker:ready');

  const send = () => {
    const t = msg.trim();
    if (!t) return;
    socketRef.current.emit('poker:chat', { text: t });
    setMsg('');
  };

  /* Close drawer when we successfully join a table */
  useEffect(() => {
    if (tableId) setDrawerOpen(false);
  }, [tableId]);

  const tableLabel = tableId
    ? state?.name || 'Table'
    : 'Select a table';
  const stakeLabel =
    stake === 'VIP'
      ? 'VIP'
      : `${Number(stake).toLocaleString()} stakes`;

  const lobbySection = (
    <>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>
        Choose Stakes
      </div>
      <Top>
        {STAKES.map(s => (
          <Pill
            key={s}
            $on={s === stake}
            onClick={() => setStake(s)}
          >
            {s === 'VIP'
              ? 'VIP Table'
              : `${Number(s).toLocaleString()} stakes`}
          </Pill>
        ))}
      </Top>

      <div
        style={{
          marginTop: 12,
          fontWeight: 800,
          marginBottom: 4,
        }}
      >
        Available Tables
      </div>
      <Grid>
        {tables.map(t => (
          <TableCard key={t.id}>
            <TableHeader>
              <span>{t.name}</span>
              <span>
                {t.players}/{t.max}
              </span>
            </TableHeader>
            <Btn onClick={() => join(t.id)}>Join</Btn>
          </TableCard>
        ))}
        {tables.length === 0 && (
          <div
            style={{
              fontSize: 13,
              opacity: 0.7,
              paddingTop: 4,
            }}
          >
            No open tables at this stake yet. Try again in a
            moment.
          </div>
        )}
      </Grid>
    </>
  );

  const chatContent = (
    <>
      <div
        style={{ fontWeight: 800, marginBottom: 6 }}
      >
        Table Chat
      </div>
      <ChatList>
        {chat.map((m, i) => (
          <div key={i}>
            <b>{m.u || 'System'}:</b> {m.t}
          </div>
        ))}
      </ChatList>
      <div style={{ display: 'flex', gap: 6 }}>
        <ChatInput
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Say something…"
        />
        <Btn onClick={send}>Send</Btn>
      </div>
    </>
  );

  return (
    <Container>
      {/* Mobile top bar */}
      <MobileTopBar>
        <DrawerButton
          onClick={() => setDrawerOpen(true)}
          aria-label="Open poker sidebar"
        >
          ➤
        </DrawerButton>
        <MobileOpponentPill>
          <MobileOpponentName>{tableLabel}</MobileOpponentName>
          <MobileOpponentClock>
            {stakeLabel}
          </MobileOpponentClock>
        </MobileOpponentPill>
      </MobileTopBar>

      <Wrap>
        {/* LEFT: table / board panel */}
        <BoardPanel ref={panelRef}>
          <BoardViewport>
            <div
              style={{
                position: 'relative',
                width: tableWidth,
                maxWidth: '100%',
                margin: '0 auto',
              }}
            >
              {tableId ? (
                <TableWrap>
                  <Felt>
                    <Pot $pulse={potPulse}>
                      {liveRound
                        ? `Pot: ${state?.pot ?? 0}`
                        : activeCount >= 2
                          ? 'Waiting for next hand…'
                          : 'Waiting for opponent…'}
                    </Pot>
                    {showBoard && (
                      <Comm>
                        {(state?.board || []).map((c, i) => (
                          <CardGlyph key={i} c={c} />
                        ))}
                      </Comm>
                    )}

                    {['sb', 'bb'].map(kind => {
                      const seatIdx = state?.[kind];
                      if (seatIdx == null || seatIdx < 0)
                        return null;
                      const pos = towardCenter(
                        SEAT_POS[seatIdx],
                        0.65
                      );
                      return (
                        <BlindChip
                          key={kind}
                          style={{
                            left: `${pos.left}%`,
                            top: `${pos.top}%`,
                          }}
                          title={
                            kind === 'sb'
                              ? 'Small Blind'
                              : 'Big Blind'
                          }
                        >
                          {kind === 'sb' ? 'SB' : 'BB'}
                        </BlindChip>
                      );
                    })}

                    {(state?.seats ||
                      Array(8).fill(null)
                    ).map((seat, idx) => {
                      const pos = SEAT_POS[idx];
                      const isMe = mySeat === idx;
                      const waiting = !!seat?.waiting;
                      const leaving = !!seat?.leaving;
                      const disconnected = !!seat?.disconnected;
                      const turn = state?.turn === idx;
                      const isWinner =
                        state?.lastWin &&
                        state.lastWin.seat === idx;

                      const statusSuffix =
                        waiting
                          ? ' (waiting to be dealt in)'
                          : leaving
                          ? ' (leaving after hand)'
                          : disconnected
                          ? ' (disconnected)'
                          : '';

                      return (
                        <Seat
                          key={idx}
                          style={{
                            left: `${pos.left}%`,
                            top: `${pos.top}%`,
                          }}
                        >
                          {turn && <TurnHalo />}
                          <SeatName>
                            <NameWrap>
                              <NamePulse $on={turn}>
                                {seat ? seat.username : 'Empty'}
                                {statusSuffix}
                              </NamePulse>
                            </NameWrap>
                          </SeatName>
                          <SeatStack>
                            💰 {seat?.stack ?? 0}
                          </SeatStack>
                          <SeatCards
                            aria-label={
                              isMe ? 'Your cards' : ''
                            }
                          >
                            {isMe &&
                              myCards.map((c, i) => (
                                <CardGlyph
                                  key={i}
                                  c={c}
                                />
                              ))}
                          </SeatCards>
                          {isWinner && (
                            <WinPill>
                              +
                              {Number(
                                state.lastWin.amount ||
                                  0
                              )}
                            </WinPill>
                          )}
                        </Seat>
                      );
                    })}

                    {state?.round === 'ready' && (
                      <ReadyOverlay>
                        <ReadyBox>
                          <div
                            style={{
                              fontWeight: 900,
                              marginBottom: 6,
                            }}
                          >
                            Ready for the next hand?
                          </div>
                          <div
                            style={{
                              opacity: 0.85,
                              marginBottom: 10,
                            }}
                          >
                            Starting in{' '}
                            <b>{timeLeft}s</b>…
                          </div>
                          <Btn
                            onClick={readyUp}
                            disabled={iAmReady}
                          >
                            {iAmReady
                              ? 'Ready ✔'
                              : 'I’m Ready'}
                          </Btn>
                        </ReadyBox>
                      </ReadyOverlay>
                    )}

                    {iAmSpectating &&
                      state?.round !== 'idle' && (
                        <ReadyOverlay>
                          <ReadyBox>
                            <div
                              style={{
                                fontWeight: 900,
                                marginBottom: 6,
                              }}
                            >
                              You joined mid-hand
                            </div>
                            <div style={{ opacity: 0.85 }}>
                              You’re{' '}
                              <b>
                                waiting to be dealt in
                              </b>
                              . You’ll join automatically
                              next hand.
                            </div>
                          </ReadyBox>
                        </ReadyOverlay>
                      )}

                    <ActionBar>
                      <Btn
                        disabled={!canLeave}
                        onClick={
                          canLeave ? leave : undefined
                        }
                        title={
                          !canLeave
                            ? 'You can leave between hands (during Ready) or when idle.'
                            : ''
                        }
                      >
                        Leave / Cash Out
                      </Btn>
                      <Btn
                        disabled={!canAct}
                        onClick={() => act('fold')}
                      >
                        Fold
                      </Btn>
                      <Btn
                        disabled={!canAct}
                        onClick={() =>
                          act(
                            state?.toCall
                              ? 'call'
                              : 'check'
                          )
                        }
                      >
                        {state?.toCall
                          ? `Call ${state.toCall}`
                          : 'Check'}
                      </Btn>
                      <Btn
                        disabled={!canAct}
                        onClick={() => {
                          const a =
                            prompt('Raise amount');
                          if (a)
                            act('raise', Number(a));
                        }}
                      >
                        Raise
                      </Btn>
                    </ActionBar>
                  </Felt>
                </TableWrap>
              ) : (
                <Panel
                  style={{
                    textAlign: 'center',
                    padding: '24px 16px',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      marginBottom: 8,
                    }}
                  >
                    Join a table to start playing
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      opacity: 0.8,
                      marginBottom: 12,
                    }}
                  >
                    Pick a stakes level and select a table
                    from the side panel.
                  </div>
                  <Button
                    $primary
                    onClick={() =>
                      setDrawerOpen(true)
                    }
                  >
                    Browse Tables
                  </Button>
                </Panel>
              )}
            </div>
          </BoardViewport>

          {/* Mobile-only stack under table: chat + return */}
          <MobileStack>
            {tableId && (
              <>
                <ChatMobileShell>
                  {chatContent}
                </ChatMobileShell>
              </>
            )}
            <ReturnButton
              onClick={() =>
                typeof onExit === 'function'
                  ? onExit()
                  : null
              }
              title="Return to Games"
            >
              <span className="icon">←</span>
              <span>Return to Games</span>
            </ReturnButton>
          </MobileStack>
        </BoardPanel>

        {/* RIGHT rail: lobby + chat + return, matches ChessArena sizing */}
        <RightRailShell>
          <RightRailTopBar>
            <ReturnButton
              onClick={() =>
                typeof onExit === 'function'
                  ? onExit()
                  : null
              }
              title="Return to Games"
            >
              <span className="icon">←</span>
              <span>Return to Games</span>
            </ReturnButton>
          </RightRailTopBar>
          <ControlsPanel>
            {!tableId && lobbySection}
            {tableId && (
              <>
                <div
                  style={{
                    fontWeight: 800,
                    marginBottom: 4,
                  }}
                >
                  {state?.name || 'Current Table'}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.8,
                    marginBottom: 10,
                  }}
                >
                  Stakes: {stakeLabel}
                  <br />
                  Round:{' '}
                  <b>{state?.round || '—'}</b>{' '}
                  {liveRound
                    ? ''
                    : '(waiting for next hand)'}
                </div>
                <ChatShell>{chatContent}</ChatShell>
              </>
            )}
          </ControlsPanel>
        </RightRailShell>
      </Wrap>

      {/* Mobile drawer: lobby or chat, depending on state */}
      {drawerOpen && (
        <DrawerBackdrop
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <Drawer
        $open={drawerOpen}
        role="complementary"
        aria-label="Poker sidebar"
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

        {!tableId && lobbySection}
        {tableId && (
          <>
            <div
              style={{
                fontWeight: 800,
                marginBottom: 6,
              }}
            >
              {state?.name || 'Current Table'}
            </div>
            <div
              style={{
                fontSize: 13,
                opacity: 0.8,
                marginBottom: 8,
              }}
            >
              Stakes: {stakeLabel}
              <br />
              Round:{' '}
              <b>{state?.round || '—'}</b>
            </div>
            <Button
              onClick={leave}
              disabled={!canLeave}
              style={{ marginBottom: 8 }}
            >
              Leave / Cash Out
            </Button>
            <ChatMobileShell
              style={{ marginTop: 0 }}
            >
              {chatContent}
            </ChatMobileShell>
          </>
        )}
      </Drawer>
    </Container>
  );
}
