import React, { useEffect, useLayoutEffect, useRef, useState, useContext, useCallback } from 'react';
import styled, { createGlobalStyle, css, keyframes } from 'styled-components';
import axios from 'axios';
import { Link } from 'react-router-dom';

import { AuthContext } from '../App';

import { API_BASE_URL, toMediaUrl } from '../config';
import LetterAvatar from '../components/LetterAvatar';

// Arenas
import ChessArena from './ChessArena';
import CheckersArena from './CheckersArena';
import FishingArena from './FishingArena';
import PokerArena from './PokerArena';
import ReversiArena from './ReversiArena';
import JumpArena from './JumpArena';
import MeteorArena from './MeteorArena';
import TetrisArena from './TetrisArena';
import GameSidebar from '../components/GameSidebar';

/* ------------------- Global fonts ------------------- */
const GamesFonts = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Exo+2:wght@700;800;900&display=swap');
`;

/* ------------------- Layout ------------------- */
const Page = styled.div`
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: hidden;      /* prevent page scrollbar */
  margin: 0;
  padding: 12px clamp(10px, 1.5vw, 18px);
`;

const HomeGrid = styled.div`
  display: grid;
  grid-template-columns:
    minmax(280px, 1.15fr)  /* Daily */
    minmax(0, 1.8fr)       /* Leaderboard (wider) */
    minmax(280px, 1.15fr); /* Games */
  gap: 14px;
  align-items: stretch;
`;

/* Shared full-height card */
const Shell = styled.div`
  background: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 14px 32px rgba(0,0,0,.35);
  display: grid;
  grid-template-rows: 64px 1fr;  /* fixed header row aligns all cards */
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
`;

/* ---- Card headers (same height everywhere) ---- */
const CardHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr; /* left | title | right */
  align-items: center;
  padding: 0 14px;
  border-bottom: 1px solid var(--border-color);
`;

const TitleCenter = styled.div`
  justify-self: center;
  font-weight: 900;
  letter-spacing: .3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: linear-gradient(92deg, var(--primary-orange), #59D0FF);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: 1px rgba(0,0,0,.25);
  font-size: clamp(28px, 3.8vw, 40px);
`;

const HeaderActions = styled.div`
  display:flex; align-items:center; gap:8px; justify-self:end;
`;

const CoinsPill = styled.div`
  display:flex; align-items:center; gap:8px;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid var(--border-color);
  background: rgba(255,255,255,0.06);
  color: var(--text-color);
  font-weight:900; font-size:13px;
  white-space:nowrap;
`;

const ScrollBody = styled.div`
  padding: 12px;
  overflow: auto;
  min-height: 0;
`;

const Subtle = styled.div`
  font-size: 12px;
  color: rgba(230,233,255,0.65);
  margin: 0 2px 10px;
`;

/* ---------- Mobile/Small viewport tab bar ---------- */
const TabsBar = styled.div`
  display: none;
  margin: 0 0 10px 0;

  @media (max-width: 1150px) {
    display: grid;
  }

  grid-auto-flow: column;
  gap: 8px;
  align-items: center;
  justify-content: start;
`;

const TabBtn = styled.button`
  appearance: none;
  border: 1px solid ${p => (p.$active ? 'transparent' : 'var(--border-color)')};
  background: ${p => (p.$active ? 'var(--primary-orange)' : 'rgba(255,255,255,0.06)')};
  color: ${p => (p.$active ? '#000' : 'var(--text-color)')};
  padding: 8px 12px;
  border-radius: 999px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
`;

/* ---------- Shared chip ---------- */
const Pill = styled.span`
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 900;
  font-size: 11px;
  color:#fff;
  background: ${p => ({
    Champion:'#7c3aed', Diamond:'#2563eb', Platinum:'#14b8a6',
    Gold:'#f59e0b', Silver:'#9ca3af', Bronze:'#b45309', Wood:'#374151'
  }[p.$rank] || '#374151')};
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.15), 0 4px 10px rgba(0,0,0,.12);
  justify-self: end;
`;

/* ------------------- Leaderboard ------------------- */
const LeaderCard = styled(Shell)``;
const LeaderHeaderInline = styled.div`
  display:flex; align-items:center; justify-content:space-between; gap:12px; padding: 0 2px 8px;
`;
const RankBox = styled.div` display:flex; align-items:center; gap:8px; font-weight:900; `;

const PodiumWrap = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  justify-items: center;
  align-items: end;
  gap: 10px;

  /* push the whole podium section down a bit */
  margin: 18px 0 8px;
  width: 100%;

  /* on small screens, give it a little extra space from the header */
  @media (max-width: 600px) {
    margin-top: 28px;
  }
`;

const Pedestal = styled.div`
  position: relative;
  background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
  border: 1px solid var(--border-color);
  border-radius: 16px 16px 8px 8px;
  height: ${p => p.$h}px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 4px;
  box-shadow: inset 0 8px 16px rgba(0,0,0,.10);
`;
const RankBadge = styled.div`
  position: absolute;
  top: -10px; left: 50%; transform: translateX(-50%);
  padding: 2px 8px; background: var(--primary-orange); color: #000;
  font-weight: 900; font-size: 11px; border-radius: 999px;
  box-shadow: 0 6px 16px rgba(0,0,0,.25);
`;
const AvatarRing = styled.div`
  position: absolute;
  top: -34px;
  left: 50%; transform: translateX(-50%);
  width: ${p => p.$size}px; height: ${p => p.$size}px;
  border-radius: 999px; border: 2px solid #fff; overflow: hidden;
  box-shadow: 0 6px 18px rgba(0,0,0,.18);
  background: #fff; display: grid; place-items: center;
`;
const PodiumName = styled.div`
  font-weight: 900; font-size: 15px;
  line-height: 1; margin-top: 6px; text-align: center; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;
const PodiumScore = styled.div` font-size: 11px; color: rgba(230,233,255,0.65); text-align: center; `;

const RowItem = styled.div`
  display:flex; align-items:center; justify-content:space-between;
  padding: 6px 8px; border:1px solid var(--border-color); border-radius:10px;
  background: var(--container-white); color: var(--text-color); font-size:13px;
  margin-bottom: 6px;
`;

/* ------------------- Games Panel ------------------- */
const GamesPanel = styled(Shell)``;

const GameRow = styled.div`
  display:grid;
  grid-template-columns: auto 1fr auto;
  align-items:center;
  column-gap: 10px;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--container-white);
`;
const RowSpacer = styled.div` min-width: 0; `;

const GameButton = styled.button`
  appearance: none;
  border: none;
  background: var(--primary-orange);
  color: #000;
  font-weight: 900;
  border-radius: 999px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  width: max-content;
  max-width: 220px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  transition: transform .08s ease, box-shadow .12s ease, background .12s ease;
  &:hover {
    transform: translateY(-1px);
    background: linear-gradient(90deg, var(--primary-orange), #59D0FF);
    box-shadow: 0 8px 18px rgba(0,0,0,.22);
  }
  &:active { transform: translateY(0); }
`;
const waterDrift = keyframes`
  0% {
    /* 3 radial blobs: glow (mostly static) + 2 highlights */
    background-position:
      0% 100%,  /* accent glow anchored bottom-left */
      0% 0%,    /* highlight blob A */
      100% 50%; /* highlight blob B */
  }
  50% {
    background-position:
      0% 100%,   /* keep glow mostly fixed */
      40% 20%,   /* blob A drifts toward center */
      60% 80%;   /* blob B drifts diagonally */
  }
  100% {
    background-position:
      0% 100%,
      100% 0%,  /* blob A to top-right */
      0% 50%;   /* blob B to mid-left */
  }
`;

const challengeTheme = ({ $variant }) => {
  switch ($variant) {
    /* Crossword: navy crossword stripes + subtle squares */
    case 'crossword':
      return css`
        --accent: #38bdf8;
        --accent-soft: rgba(56, 189, 248, 0.35);
        --card-tilt: -8deg;

        background-image:
          radial-gradient(circle at 0% 0%, var(--accent-soft), transparent 55%),
          repeating-linear-gradient(
            90deg,
            rgba(15, 23, 42, 0.95) 0,
            rgba(15, 23, 42, 0.95) 18px,
            #020617 18px,
            #020617 36px
          ),
          linear-gradient(180deg, #020617, #020617);
        background-size: 220% 220%, 120px 100%, 100% 100%;
      `;

    /* Word Guess: colourful letter-tile strip */
    case 'wordguess':
      return css`
        --accent: #22c55e;
        --accent-soft: rgba(34, 197, 94, 0.45);
        --card-tilt: 6deg;

        background-image:
          radial-gradient(circle at 8% 80%, var(--accent-soft), transparent 60%),
          linear-gradient(135deg, #0f172a, #022c22 35%, #1d2745 70%, #4c1d95),
          repeating-linear-gradient(
            -45deg,
            rgba(148, 163, 184, 0.25) 0,
            rgba(148, 163, 184, 0.25) 3px,
            transparent 3px,
            transparent 16px
          );
        background-size: 220% 220%, 220% 220%, 32px 32px;
      `;

    /* Sudoku: gridded board with heavier 3×3 boxes */
    case 'sudoku':
    default:
      return css`
        --accent: #eab308;
        --accent-soft: rgba(234, 179, 8, 0.5);
        --card-tilt: -5deg;

        background-image:
          radial-gradient(circle at 100% 0%, var(--accent-soft), transparent 55%),
          /* fine grid */
          linear-gradient(
            to right,
            rgba(148, 163, 184, 0.25) 1px,
            transparent 1px
          ),
          linear-gradient(
            to bottom,
            rgba(148, 163, 184, 0.25) 1px,
            transparent 1px
          ),
          /* thicker 3x3 grid */
          linear-gradient(
            to right,
            rgba(249, 250, 251, 0.45) 2px,
            transparent 2px
          ),
          linear-gradient(
            to bottom,
            rgba(249, 250, 251, 0.45) 2px,
            transparent 2px
          ),
          linear-gradient(135deg, #020617, #020617);
        background-size:
          220% 220%,
          32px 32px,
          32px 32px,
          96px 96px,
          96px 96px,
          100% 100%;
        background-position: 0% 50%;
      `;
  }
};

/* ------------------- Daily Challenges ------------------- */
const ChallengesCard = styled(Shell)``;

/* wrapper so content fills card without inner scrollbar */
const ChallengesBody = styled.div`
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
`;

/* three rows that always fit inside the card */
const ChallengeList = styled.div`
  display: grid;
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 12px;
  flex: 1;
  min-height: 0;
`;

const ChallengeRow = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) auto;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  isolation: isolate;

  ${challengeTheme};

  box-shadow:
    0 10px 25px rgba(15, 23, 42, 0.8),
    inset 0 0 0 1px rgba(15, 23, 42, 0.9);
  transition:
    transform 0.16s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease,

  height: 100%;
  min-height: 90px;
  overflow: hidden;

  /* floating mini board card */
  &::before {
    content: '';
    position: absolute;
    right: -14px;
    top: 50%;
    transform: translateY(-50%) rotate(var(--card-tilt, -5deg));
    width: 110px;
    height: 80%;
    border-radius: 18px;
    border: 1px solid rgba(248, 250, 252, 0.18);
    box-shadow:
      0 16px 30px rgba(15, 23, 42, 0.95),
      inset 0 0 0 1px rgba(15, 23, 42, 0.9);
    background: inherit;
    background-size: inherit;
    background-position: inherit;
    mix-blend-mode: screen;
    opacity: 0.95;
    pointer-events: none;
  }

  /* glow overlay when hovered/focused */
  &::after {
    content: '';
    position: absolute;
    inset: -18%;

    background-image:
      radial-gradient(circle at 0% 100%, var(--accent-soft), transparent 60%),
      radial-gradient(circle at 0% 0%, rgba(255,255,255,0.14), transparent 60%),
      radial-gradient(circle at 100% 50%, rgba(255,255,255,0.10), transparent 60%);

    background-size:
      160% 160%,
      180% 180%,
      200% 200%;
    background-repeat: no-repeat;
    background-position:
      0% 100%,
      0% 0%,
      100% 50%;

    mix-blend-mode: screen;
    opacity: 0;
    pointer-events: none;
    will-change: background-position;
  }

  &:hover::after,
  &:focus-within::after {
    opacity: 1;
    animation: ${waterDrift} 10s ease-in-out infinite;
  }

  &:hover,
  &:focus-within {
    transform: translateY(-2px);
    border-color: rgba(251, 191, 36, 0.9);
    box-shadow:
      0 20px 40px rgba(15, 23, 42, 0.95),
      0 0 0 1px rgba(15, 23, 42, 1);
  }

  &:hover::before,
  &:focus-within::before {
    transform: translateY(-50%) rotate(calc(var(--card-tilt, -5deg) / 2)) scale(1.03);
  }

  &:hover::after,
  &:focus-within::after {
   opacity: 1;
   animation: ${waterDrift} 9s linear infinite; 
  }
`;

const ChallengeInfo = styled.div`
  display: grid;
  gap: 3px;
  align-content: start;
  padding-right: 16px;
`;
const ChallengeTitle = styled.div` display:flex; align-items:center; gap:8px; font-weight: 900; font-size: 16px; color: #fff; `;
const ChallengeMeta = styled.div` display:flex; align-items:center; gap:8px; flex-wrap: wrap; font-size: 12px; color: rgba(230,233,255,0.8); `;

/* ------------------- Data / helpers ------------------- */
const GAMES = [
  { key:'chess',    name:'Chess',       icon: '♟️' },
  { key:'checkers', name:'Checkers',    icon: '⛀ ' },
  { key:'fishing',  name:'Fishing',     icon: '🎣' },
  { key:'poker',    name:'Poker',       icon: '🃏' },
  { key:'reversi',  name:'Reversi',     icon: '◐ ' },
  { key:'jump',     name:'Jump Game',   icon: '🦘' },
  { key:'meteor',   name:'Meteor',      icon: '☄️' },
  { key:'tetris',   name:'Tetris VS',   icon: '🧱' },
];

const DAILY_CHALLENGES = [
  { key: 'crossword', label: 'Crossword Puzzle', emoji: '🧩', route: '/games/challenges/crossword' },
  { key: 'wordguess', label: 'Word Guess', emoji: '🔤', route: '/games/challenges/word' },
  { key: 'sudoku',    label: 'Sudoku', emoji: '🧠', route: '/games/challenges/sudoku' },
];

const perGameRank = (n) => {
  if (n >= 1500) return 'Champion';
  if (n >= 900)  return 'Diamond';
  if (n >= 600)  return 'Platinum';
  if (n >= 400)  return 'Gold';
  if (n >= 250)  return 'Silver';
  if (n >= 100)  return 'Bronze';
  return 'Wood';
};

/* Stats hook */
function useGameStats(userId) {
  const [stats, setStats] = useState({ totalTrophies: 0, coins: 0, byGame: {} });

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await axios.get(`${API_BASE_URL}/api/games/stats/${userId}`);

    const byGame = {};
    GAMES.forEach(g => {
      const t = (data.trophiesByGame && data.trophiesByGame[g.key]) || 0;
      byGame[g.key] = { trophies: t };
    });

    let total = data.totalTrophies;
    if (typeof total !== 'number') {
      total = Object.values(data.trophiesByGame || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    }

    setStats({ totalTrophies: total || 0, coins: data.coins || 0, byGame });
  }, [userId]);

  const addResult = useCallback(async (gameKey, delta, didWin = null, extra = {}) => {
    if (!userId) return;
    try { await axios.post(`${API_BASE_URL}/api/games/result`, { userId, gameKey, delta, didWin, ...extra }); }
    finally { await load(); }
  }, [userId, load]);

  return { stats, load, addResult };
}

/* Normalize leaderboard rows */
function normalizeOverallRows(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((r, i) => {
    const userObj = r.user || {};
    const username = r.username || r.name || userObj.username || r.userName || '—';
    const score = typeof r.score === 'number'
      ? r.score
      : (typeof r.trophies === 'number'
          ? r.trophies
          : (typeof r.total === 'number' ? r.total : 0));
    const avatarUrl = r.avatarUrl || r.avatar || userObj.avatarUrl || userObj.avatar || '';
    const _id = r._id || r.userId || userObj._id || `row-${i}`;
    return { _id, username, score, avatarUrl };
  });
}

/* Avatar helpers */
const TUFFY_SAFE_DEFAULT =
  'https://www.clipartmax.com/png/middle/72-721825_tuffy-tuffy-the-titan-csuf.png';
function isMeaningfulAvatar(v){
  if (!v || typeof v !== 'string') return false;
  const s = v.trim().toLowerCase();
  if (!s || s === 'default' || s.includes('tuffy')) return false;
  if (s === 'null' || s === 'undefined') return false;
  return true;
}
function resolveAvatarUrlMaybe(val) {
  if (!isMeaningfulAvatar(val)) return TUFFY_SAFE_DEFAULT;
  if (/^https?:\/\//i.test(val) || /^data:/i.test(val)) return val;
  if (val.startsWith('/')) return val;
  const m = typeof toMediaUrl === 'function' ? toMediaUrl(val) : null;
  return m || TUFFY_SAFE_DEFAULT;
}
function Avatar({ size = 32, src, name }) {
  const [broken, setBroken] = React.useState(false);
  const hasSrc = isMeaningfulAvatar(src);
  if (!hasSrc || broken) return <LetterAvatar name={name || ''} size={size} />;
  return (
    <img
      src={resolveAvatarUrlMaybe(src)}
      alt={name ? `${name}'s avatar` : 'avatar'}
      width={size}
      height={size}
      style={{ width:size, height:size, objectFit:'cover', borderRadius:999, border:'1px solid var(--border-color)' }}
      onError={() => setBroken(true)}
    />
  );
}

/* Aggregate fallback (cached) */
async function fetchAggregatedOverallOnce() {
  try {
    const endpoints = GAMES.map(g => `${API_BASE_URL}/api/games/leaderboard/${g.key}?limit=100`);
    const results = await Promise.allSettled(
      endpoints.map(u => fetch(u).then(r => r.json()).catch(() => []))
    );

    const map = new Map();
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const raw = Array.isArray(r.value) ? r.value
        : (r.value?.leaders || r.value?.leaderboard || r.value?.rows || []);
      const rows = normalizeOverallRows(raw);
      for (const row of rows) {
        const key = row._id || row.username;
        const cur = map.get(key) || { username: row.username, _id: row._id || key, score: 0, avatarUrl: row.avatarUrl || '' };
        cur.score += (Number(row.score) || 0);
        if (!cur.avatarUrl && row.avatarUrl) cur.avatarUrl = row.avatarUrl;
        map.set(key, cur);
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.score || 0) - (a.score || 0));
  } catch { return []; }
}

/* ================= Overall Leaderboard Component ================= */
const OverallLeaderboard = React.memo(function OverallLeaderboard({ myTotal }) {
  const { user } = useContext(AuthContext);
  const userId = user?._id;
  const userName = user?.username;
  const userAvatarUrl = user?.avatarUrl;

  const [leaders, setLeaders] = React.useState([]);
  const [me, setMe] = React.useState(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const didInitRef = React.useRef(false);
  const controllerRef = React.useRef(null);
  const lastFetchAtRef = React.useRef(0);
  const lastPayloadRef = React.useRef('');
  const aggCacheRef = React.useRef({ ts: 0, list: [] });

  const getAggregated = React.useCallback(async () => {
    const now = Date.now();
    if (now - aggCacheRef.current.ts < 120000 && aggCacheRef.current.list.length) {
      return aggCacheRef.current.list;
    }
    const list = await fetchAggregatedOverallOnce();
    aggCacheRef.current = { ts: Date.now(), list };
    return list;
  }, []);

  const fetchLeaders = React.useCallback(async (soft = false) => {
    const now = Date.now();
    if (soft && now - lastFetchAtRef.current < 15000) return;
    lastFetchAtRef.current = now;

    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();
    const signal = controllerRef.current.signal;

    try {
      if (soft) setRefreshing(true);

      const q = new URLSearchParams({ limit: '100' });
      const res = await fetch(`${API_BASE_URL}/api/games/leaderboard/overall?${q.toString()}`, { signal });
      const data = await res.json().catch(() => ({}));

      const raw = Array.isArray(data) ? data : (data?.leaders || data?.leaderboard || data?.rows || []);
      let list = normalizeOverallRows(raw).sort((a,b)=>(b.score||0)-(a.score||0));

      if (!didInitRef.current && list.length < 3) {
        const agg = await getAggregated();
        if (agg.length > 0) list = agg;
      }
      if (soft && list.length === 0) { setRefreshing(false); return; }

      if (list.length === 0 && (myTotal || 0) > 0 && userName) {
        list = [{ _id:userId, username:userName, score:myTotal, avatarUrl:userAvatarUrl || '' }];
      }

      let mine = data?.me || null;
      if (!mine || typeof mine.rank !== 'number') {
        const idx = list.findIndex(r => (userId && (r._id === userId || r.username === userName)));
        if (idx >= 0) mine = { rank: idx + 1, score: list[idx].score };
      }

      const fingerprint = JSON.stringify({ list, mine });
      if (fingerprint !== lastPayloadRef.current) {
        lastPayloadRef.current = fingerprint;
        setLeaders(list);
        setMe(mine || null);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {}
    } finally {
      setRefreshing(false);
      didInitRef.current = true;
    }
  }, [userId, userName, userAvatarUrl, myTotal, getAggregated]);

  useEffect(() => {
    fetchLeaders(false);
    let t = null;
    const onStats = () => { clearTimeout(t); t = setTimeout(() => fetchLeaders(true), 300); };
    const onVis = () => { if (document.visibilityState === 'visible') fetchLeaders(true); };
    window.addEventListener('games:statsUpdated', onStats);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('games:statsUpdated', onStats);
      document.removeEventListener('visibilitychange', onVis);
      clearTimeout(t);
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, [fetchLeaders]);

  const tier = perGameRank(myTotal ?? 0);

  const positions = React.useMemo(() => {
    const mk = (i) => ({ place: i + 1, username: '—', score: '—', avatarUrl: '', placeholder: true });
    return Array.from({ length: 100 }, (_, i) =>
      leaders[i] ? { ...leaders[i], place: i + 1, placeholder: false } : mk(i)
    );
  }, [leaders]);

  const P = (i) => positions[i];
  const S = [
    { i: 1, h: 90, s: 56, label: 2 },
    { i: 0, h: 116, s: 64, label: 1 },
    { i: 2, h: 80, s: 52, label: 3 },
  ];

  return (
    <LeaderCard aria-label="Overall Leaderboard">
      <CardHeader>
        <div />
        <TitleCenter>Leaderboard</TitleCenter>
        <div />
      </CardHeader>

      <ScrollBody>
        <LeaderHeaderInline>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <strong>Overall Leaderboard</strong>
            {refreshing ? <span style={{marginLeft:6, opacity:.6, fontSize:12}}>updating…</span> : null}
          </div>
          <RankBox>
            <Pill $rank={tier} title={`Your tier: ${tier}`}>{tier}</Pill>
            <span>🏆 {Number(myTotal || 0).toLocaleString()}</span>
            <span style={{opacity:.6}}>·</span>
            <span title="Your global placement">#{/* rank */}{leaders.length ? ( (leaders.findIndex(r=>r._id===userId||r.username===userName)+1) || (me?.rank) || '—') : (me?.rank ?? '—')}</span>
          </RankBox>
        </LeaderHeaderInline>

        <PodiumWrap>
          {S.map(({i,h,s,label}) => {
            const p = P(i);
            const opacity = p.placeholder ? 0.5 : 1;
            return (
              <div key={label} style={{ position:'relative', width:'100%', maxWidth: 240 }}>
                <Pedestal $h={h} style={{opacity}}>
                  <RankBadge>#{label}</RankBadge>
                  <AvatarRing $size={s} data-rank={label}>
                    <Avatar size={s} src={p.avatarUrl} name={p.placeholder ? '' : p.username} />
                  </AvatarRing>
                  <div style={{display:'grid', justifyItems:'center', rowGap: 2, textAlign:'center'}}>
                    <PodiumName>{p.placeholder ? '—' : p.username}</PodiumName>
                    <PodiumScore>{p.score} 🏆</PodiumScore>
                  </div>
                </Pedestal>
              </div>
            );
          })}
        </PodiumWrap>

        <div style={{overflow:'auto', maxHeight:'calc(100% - 196px)'}}>
          {positions.slice(3).map((p) => (
            <RowItem key={p.place} style={{opacity: p.placeholder ? .45 : 1}}>
              <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0}}>
                <span style={{fontSize:12, color:'#6b7280'}}>#{p.place}</span>
                <Avatar size={28} src={p.avatarUrl} name={p.placeholder ? '' : p.username} />
                <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                  {p.placeholder ? '—' : p.username}
                </span>
              </div>
              <div>{p.score} 🏆</div>
            </RowItem>
          ))}
        </div>
      </ScrollBody>
    </LeaderCard>
  );
});

/* ------------------- Left/Right panels ------------------- */

function GamesListPanel({ getGame, setView, onCustomize, coins }) {
  return (
    <GamesPanel>
      <CardHeader>
        {/* Coins on the LEFT */}
        <div style={{justifySelf:'start'}}>
          <CoinsPill title="Your coin balance">
            <span aria-hidden>🪙 Coins:</span>
            <span>{Number(coins || 0).toLocaleString()}</span>
          </CoinsPill>
        </div>

        <TitleCenter>Games</TitleCenter>

        <HeaderActions>
          <button
            onClick={onCustomize}
            title="Customize your game list"
            style={{
              appearance:'none',
              border:'1px solid var(--border-color)',
              background:'rgba(255,255,255,0.06)',
              color:'var(--text-color)',
              fontWeight:900,
              borderRadius:999,
              padding:'6px 10px',
              cursor:'pointer',
              whiteSpace:'nowrap'
            }}
          >
            Customize
          </button>
        </HeaderActions>
      </CardHeader>

      <ScrollBody>
        <div style={{display:'grid', gap:8}}>
          {GAMES.map(g => {
            const s = getGame(g.key);
            const r = perGameRank(s.trophies);
            return (
              <GameRow key={g.key}>
                <GameButton onClick={() => setView(g.key)} title={`Play ${g.name}`}>
                  <span aria-hidden style={{marginRight: 8}}>{g.icon}</span>
                  {g.name}
                </GameButton>

                <RowSpacer />

                <Pill $rank={r} title={`${r} · ${s.trophies} trophies`}>
                  {r} · 🏆 {s.trophies}
                </Pill>
              </GameRow>
            );
          })}
        </div>
      </ScrollBody>
    </GamesPanel>
  );
}

function nextLocalMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
}
function dailyKeyFor(chKey) {
  const now = new Date();
  const d = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  return `uv-daily-${chKey}-${d}`;
}
function dailySeed(chKey) {
  const now = new Date();
  const dayNumber = Math.floor(now.getTime() / (24*60*60*1000));
  let hash = 2166136261;
  const s = chKey + ':' + dayNumber;
  for (let i=0;i<s.length;i++) { hash ^= s.charCodeAt(i); hash = (hash * 16777619) >>> 0; }
  return hash;
}
function isCompletedToday(chKey) { return !!localStorage.getItem(dailyKeyFor(chKey)); }
function markCompletedToday(chKey) { localStorage.setItem(dailyKeyFor(chKey), '1'); }
function timeLeftString() {
  const ms = nextLocalMidnight().getTime() - Date.now();
  if (ms <= 0) return '00:00:00';
  const sec = Math.floor(ms/1000);
  const h = String(Math.floor(sec/3600)).padStart(2,'0');
  const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
  const s = String(sec%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}

function DailyChallengesPanel() {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (!window.UniVerseDailyChallenge) {
      window.UniVerseDailyChallenge = {
        complete: (key) => { window.dispatchEvent(new CustomEvent('uv:dailyComplete', { detail: { key } })); },
        getStatus: (key) => isCompletedToday(key)
      };
    }
  }, []);

  return (
    <ChallengesCard>
      <CardHeader>
        <div />
        <TitleCenter>Daily Challenges</TitleCenter>
        <div />
      </CardHeader>

      <ChallengesBody>
        <Subtle>
          New challenges every 24 hours · +200 coins each · resets in {timeLeftString()}
        </Subtle>

        <ChallengeList>
        {DAILY_CHALLENGES.map(dc => {
          const done = isCompletedToday(dc.key);
          const seed = dailySeed(dc.key);
          return (
            <ChallengeRow
              key={dc.key}
              $variant={dc.key}
              as={Link}
              to={dc.route}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              <ChallengeInfo>
                <ChallengeTitle>
                  <span aria-hidden style={{ fontSize: 18 }}>{dc.emoji}</span>
                  {dc.label}
                </ChallengeTitle>
                <ChallengeMeta>
                  <span>Seed #{seed}</span>
                  <span>Reward: <strong>200 🪙</strong></span>
                  {done ? (
                    <span style={{ color: '#8ef3a5' }}>Completed today</span>
                  ) : (
                    <span>Tap to play</span>
                  )}
                </ChallengeMeta>
              </ChallengeInfo>

              <div style={{ display: 'grid', justifyItems: 'end', rowGap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 900 }}>
                  {done ? 'Completed' : 'Play challenge'}
                </span>
              </div>
            </ChallengeRow>
          );
        })}
        </ChallengeList>
      </ChallengesBody>
    </ChallengesCard>
  );
}

/* ------------------- Main Page ------------------- */
export default function Games() {
  const { user } = useContext(AuthContext);
  const { stats, load, addResult } = useGameStats(user?._id);

  const [view, setView] = useState('home');

  /* small-screen tab selection */
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'daily' | 'leaderboard' | 'games'
  const [isCompact, setIsCompact] = useState(false); // <= 1150px

  // Exact grid height (no page-level scrollbar)
  const pageRef = useRef(null);
  const [gridHeight, setGridHeight] = useState(null);
  useLayoutEffect(() => {
    const compute = () => {
      if (!pageRef.current) return;
      const rect = pageRef.current.getBoundingClientRect();
      const styles = getComputedStyle(pageRef.current);
      const padBottom = parseFloat(styles.paddingBottom || '0');

      // Reserve space for a bottom navbar on mobile so content
      // isn't hidden underneath it.
      let bottomInset = 0;
      try {
        const rootStyles = getComputedStyle(document.documentElement);
        const cssVar = rootStyles.getPropertyValue('--bottom-nav-height');
        const parsed = parseFloat(cssVar);
        if (!Number.isNaN(parsed) && parsed > 0) {
          bottomInset = parsed;
        }
      } catch {
        // ignore – best-effort only
      }
      if (!bottomInset && window.innerWidth <= 768) {
        bottomInset = 72; // sensible fallback for mobile bottom nav
      }

      const epsilon = 14; // fills to bottom, avoids overflow
      const h = Math.max(
        360,
        Math.floor(window.innerHeight - rect.top - padBottom - bottomInset - epsilon)
      );
      setGridHeight(h);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1150px)');
    const apply = () => setIsCompact(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const rewardCoins = useCallback(async (amount = 200) => {
    try {
      await addResult('daily', 0, true, { coins: amount });
    } catch (e) {
      /* non-fatal */
    } finally {
      await load();
      window.dispatchEvent(new Event('games:statsUpdated'));
    }
  }, [addResult, load]);

  const onDailyComplete = useCallback(
    async (key) => {
      if (isCompletedToday(key)) return;
      markCompletedToday(key);
      await rewardCoins(200);
    },
    [rewardCoins]
  );

  useEffect(() => {
    const onEvt = (e) => { const k = e?.detail?.key; if (k) onDailyComplete(k); };
    window.addEventListener('uv:dailyComplete', onEvt);
    return () => window.removeEventListener('uv:dailyComplete', onEvt);
  }, [onDailyComplete]);

  useEffect(() => { if (user?._id) load(); }, [user?._id, load]);
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('games:statsUpdated', handler);
    return () => window.removeEventListener('games:statsUpdated', handler);
  }, [load]);

  const byGame = stats.byGame || {};
  const getGame = (k) => byGame[k] || { trophies:0 };

  const onResult = async (gameKey, delta, didWin) => {
    try { await addResult(gameKey, delta, didWin); }
    catch { alert('Failed to save result'); }
  };

  const Desktop = (
    <HomeGrid style={{ height: gridHeight ? `${gridHeight}px` : undefined }}>
      <DailyChallengesPanel />
      <OverallLeaderboard myTotal={stats.totalTrophies || 0} />
      <GamesListPanel
        getGame={getGame}
        setView={setView}
        coins={stats.coins || 0}
        onCustomize={() => alert('Customize coming soon')}
      />
    </HomeGrid>
  );

  const Compact = (
    <div style={{display:'grid', gridTemplateRows:'auto 1fr', height: gridHeight ? `${gridHeight}px` : 'auto'}}>
      <TabsBar>
        <TabBtn $active={activeTab==='daily'} onClick={()=>setActiveTab('daily')}>Daily Challenges</TabBtn>
        <TabBtn $active={activeTab==='leaderboard'} onClick={()=>setActiveTab('leaderboard')}>Leaderboard</TabBtn>
        <TabBtn $active={activeTab==='games'} onClick={()=>setActiveTab('games')}>Games</TabBtn>
      </TabsBar>

      {activeTab === 'daily' && <DailyChallengesPanel />}
      {activeTab === 'leaderboard' && <OverallLeaderboard myTotal={stats.totalTrophies || 0} />}
      {activeTab === 'games' && (
        <GamesListPanel
          getGame={getGame}
          setView={setView}
          coins={stats.coins || 0}
          onCustomize={() => alert('Customize coming soon')}
        />
      )}
    </div>
  );

  const GameView = (
    <div style={{ display:'grid', gridTemplateColumns:'360px minmax(0, 1fr)', gap:16, alignItems:'start' }}>
      <GameSidebar gameKey={view} title={GAMES.find(g => g.key === view)?.name} />
      <div style={{background:'var(--container-white)', border:'1px solid var(--border-color)', borderRadius:16, boxShadow:'0 14px 32px rgba(0,0,0,.35)', padding:14}}>
        {view === 'chess'    && <ChessArena onExit={() => setView('home')} />}
        {view === 'checkers' && (
          <CheckersArena
            onExit={() => setView('home')}
            onResult={onResult}
          />
        )}
        {view === 'fishing'  && (
          <FishingArena             
            onExit={() => setView('home')}
            onResult={onResult}
          />
        )}
        {view === 'poker'    && (
          <PokerArena
            onExit={() => setView('home')}
            onResult={onResult}
          />
        )}
        {view === 'reversi'  && (
        <ReversiArena
            onExit={() => setView('home')}
            onResult={onResult}
          />
        )}
        {view === 'jump'     && (
          <JumpArena
            onExit={() => setView('home')}
            onResult={onResult}
          />
        )}
        {view === 'meteor'   && (
        <MeteorArena
            onExit={() => setView('home')}
            onResult={onResult}
          />
        )}
        {view === 'tetris'   && (
        <TetrisArena
            onExit={() => setView('home')}
            onResult={onResult}
          />
        )}
      </div>
    </div>
  );

  return (
    <Page ref={pageRef}>
      <GamesFonts />
      {view === 'home' ? (isCompact ? Compact : Desktop) : GameView}
    </Page>
  );
}
