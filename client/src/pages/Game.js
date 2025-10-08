// src/pages/Game.js
import React, { useEffect, useState, useContext, useCallback } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import axios from 'axios';

import { AuthContext } from '../App';
import { API_BASE_URL, toMediaUrl} from '../config';
import UserLink from '../components/UserLink';

// Arenas
import ChessArena from './ChessArena';
import CheckersArena from './CheckersArena';
import FishingArena from './FishingArena';
import PokerArena from './PokerArena';
import ReversiArena from './ReversiArena';
import JumpArena from './JumpArena';
import OddEvenArena from './OddEvenArena';
import GameSidebar from '../components/GameSidebar';

/* ------------------- Global fonts ------------------- */
const GamesFonts = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Exo+2:wght@700;800;900&display=swap');
`;

/* ------------------- Layout ------------------- */
const Page = styled.div`
  max-width: 1160px;
  margin: 0 auto;
  padding: 16px;
  min-height: calc(100vh - 101px);
`;

const TopBar = styled.nav`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 8px 18px rgba(0,0,0,.06);
`;

const TitleButton = styled.button`
  appearance: none;
  border: 0;
  background: linear-gradient(92deg, #ff8718 0%, #ffb95e 25%, #3b5cff 85%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-family: 'Exo 2','Bebas Neue',system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
  font-weight: 800;
  font-size: 38px;
  letter-spacing: 0.6px;
  line-height: 1;
  -webkit-text-stroke: 1.2px rgba(0,0,0,0.25);
  text-shadow: 0 1px 0 rgba(255,255,255,0.05), 0 3px 6px rgba(0,0,0,0.30);
  padding: 6px 10px;
  cursor: pointer;
  border-radius: 10px;
  transition: transform .08s ease-in-out, background .2s ease;
  white-space: nowrap;
  &:hover { transform: translateY(-1px) scale(1.02); }
  &:active { transform: translateY(0) scale(.99); }
`;

const TabButton = styled.button`
  appearance: none;
  border: 1px solid ${p => (p.$active ? '#111' : 'var(--border-color)')};
  background: ${p => (p.$active ? '#111' : '#fff')};
  color: ${p => (p.$active ? '#fff' : '#111')};
  font-weight: 800;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: background .15s ease, color .15s ease, transform .08s ease;
  white-space: nowrap;
  box-shadow: ${p => (p.$active ? '0 3px 10px rgba(0,0,0,.12)' : 'none')};
  &:hover { background: ${p => (p.$active ? '#111' : '#f6f7f9')}; transform: translateY(-1px); }
  &:active { transform: translateY(0); }
`;

const BarSeparator = styled.div` height: 10px; pointer-events: none; `;
const FlexGrow = styled.div` flex: 1; `;

const CoinStat = styled.div`
  display:flex; align-items:center; gap:8px;
  margin-left:auto; padding:6px 10px;
  border:1px solid var(--border-color); background:#fff; border-radius:999px;
  font-weight:900; font-size:13px;
`;

/* ------------------- Cards & Grids ------------------- */
const Row = styled.div`
  display:grid;
  grid-template-columns: 360px 1fr;
  gap:16px;
  align-items:start;
`;
const Card = styled.div`
  background: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 10px 24px rgba(0,0,0,.06);
`;
const SectionTitle = styled.div` font-weight:900; margin-bottom:8px; `;
const Subtle = styled.div` font-size:12px; color:#6b7280; `;

/* Rank pill */
const Pill = styled.span`
  padding: 3px 10px; border-radius: 999px; font-weight: 900; font-size: 11px; color:#fff;
  background: ${p => ({
    Champion:'#7c3aed', Diamond:'#2563eb', Platinum:'#14b8a6',
    Gold:'#f59e0b', Silver:'#9ca3af', Bronze:'#b45309', Wood:'#374151'
  }[p.$rank] || '#374151')};
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.15), 0 4px 10px rgba(0,0,0,.12);
`;

/* Customization scroll box */
const ScrollCard = styled(Card)`
  max-height: min(44vh, 420px);
  overflow: auto;
`;

/* ------------------- Podium & List ------------------- */
const LeaderHeader = styled.div`
  display:flex; align-items:center; justify-content:space-between; gap:12px;
`;

const RankBox = styled.div`
  display:flex; align-items:center; gap:8px; font-weight:900;
`;

const ScrollList = styled.div`
  overflow: auto;
  flex: 1;
  min-height: 140px;
  display: grid;
  gap: 6px;
`;

const RowItem = styled.div`
  display:flex; align-items:center; justify-content:space-between;
  padding: 6px 8px;
  border:1px solid var(--border-color);
  border-radius:10px; background:#fff;
  font-size:13px;
`;

const RightCol = styled.div`
  display: grid;
  gap: 12px;
  grid-auto-rows: minmax(0, 1fr);
`;

const LeaderCard = styled(Card)`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 260px);
  min-height: 420px;
`;

const PodiumWrap = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  align-items: end;
  gap: 12px;
  margin: 10px 0 14px;
`;

const Pedestal = styled.div`
  position: relative;
  background: linear-gradient(180deg,#ffffff,#eef1f5);
  border: 1px solid var(--border-color);
  border-radius: 16px 16px 8px 8px;
  height: ${p => p.$h}px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 10px;
  box-shadow: inset 0 8px 16px rgba(0,0,0,.04);
`;

const RankBadge = styled.div`
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 3px 9px;
  background: #111;
  color: #fff;
  font-weight: 900;
  font-size: 12px;
  border-radius: 999px;
  box-shadow: 0 6px 16px rgba(0,0,0,.15);
`;

const AvatarRing = styled.div`
  position: absolute;
  top: -38px;
  left: 50%;
  transform: translateX(-50%);
  width: ${p => p.$size}px;
  height: ${p => p.$size}px;
  border-radius: 999px;
  border: 2px solid #fff;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(0,0,0,.18);
  background: #fff;
`;

const PodiumName = styled.div`
  font-weight: 800;
  font-size: 12px;
  margin-top: 6px;
  text-align: center;
`;

const PodiumScore = styled.div`
  font-size: 11px;
  color: #6b7280;
  text-align: center;
`;

/* New: used for the #4/#5 row */
const Duo = styled.div`
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 6px;
`;

/* ------------------- Game metadata ------------------- */
const GAMES = [
  { key:'chess',    name:'Chess',       icon: '♟️' },
  { key:'checkers', name:'Checkers',    icon: '⛀ ' },
  { key:'fishing',  name:'Fishing',     icon: '🎣' },
  { key:'poker',    name:'Poker',       icon: '🃏' },
  { key:'reversi',  name:'Reversi',     icon: '◐ ' },
  { key:'jump',     name:'Jump Game',   icon: '🦘' },
  { key:'oddeven',  name:'Odd or Even', icon: '🎲' },
];

/* Tier thresholds */
const perGameRank = (n) => {
  if (n >= 1500) return 'Champion';
  if (n >= 900)  return 'Diamond';
  if (n >= 600)  return 'Platinum';
  if (n >= 400)  return 'Gold';
  if (n >= 250)  return 'Silver';
  if (n >= 100)  return 'Bronze';
  return 'Wood';
};

/* ------------------- Stats hook ------------------- */
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

  const addResult = useCallback(async (gameKey, delta, didWin = null) => {
    if (!userId) return;
    await axios.post(`${API_BASE_URL}/api/games/result`, { userId, gameKey, delta, didWin });
    await load();
  }, [userId, load]);

  return { stats, load, addResult };
}

/* -------- Normalize overall leaderboard rows from various API shapes -------- */
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

/* --- Fallback: merge all game leaderboards into an overall list --- */
async function fetchAggregatedOverall() {
  try {
    const endpoints = GAMES.map(g => `${API_BASE_URL}/api/games/leaderboard/${g.key}?limit=100`);
    const results = await Promise.allSettled(
      endpoints.map(u => fetch(u).then(r => r.json()))
    );

    const map = new Map(); // key: id/username -> { username, score, avatarUrl, _id }
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
    const list = Array.from(map.values()).sort((a, b) => (b.score || 0) - (a.score || 0));
    return list;
  } catch {
    return [];
  }
}

/* ---------- Avatar utilities (strict + safe default) ---------- */
/** Use the exact same safe image Profile uses */
const TUFFY_SAFE_DEFAULT =
  'https://www.clipartmax.com/png/middle/72-721825_tuffy-tuffy-the-titan-csuf.png';

/** Treat any placeholder-ish values as NOT meaningful so we force our default */
function isMeaningfulAvatar(val) {
  if (val == null) return false;
  if (typeof val !== 'string') return false;
  const s = val.trim().toLowerCase();
  if (!s || s === 'default' || s === 'tuffy' || s === 'tuffy-default' || s === 'default-avatar') return false;
  if (s === 'null' || s === 'undefined') return false;
  if (s.endsWith('/null') || s.endsWith('/undefined')) return false;
  if (s.includes('tuffy') || s.includes('default-avatar')) return false; // catch broken default file paths
  return true;
}

function resolveAvatarUrlMaybe(val) {
  if (!isMeaningfulAvatar(val)) return TUFFY_SAFE_DEFAULT; // hard safe default
  if (/^https?:\/\//i.test(val) || /^data:/i.test(val)) return val;
  if (val.startsWith('/')) return val;
  const m = typeof toMediaUrl === 'function' ? toMediaUrl(val) : null;
  return m || TUFFY_SAFE_DEFAULT;
}

function Avatar({ size = 32, src, name }) {
  const [currentSrc, setCurrentSrc] = React.useState(() => resolveAvatarUrlMaybe(src));
  useEffect(() => { setCurrentSrc(resolveAvatarUrlMaybe(src)); }, [src]);

  return (
    <img
      src={currentSrc || TUFFY_SAFE_DEFAULT}
      alt={name ? `${name}'s avatar` : 'avatar'}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: 999, border:'1px solid var(--border-color)' }}
      onError={() => {
        if (currentSrc !== TUFFY_SAFE_DEFAULT) setCurrentSrc(TUFFY_SAFE_DEFAULT);
      }}
    />
  );
}

/* ================= Overall Leaderboard ================= */
function OverallLeaderboard({ myTotal }) {
  const { user } = useContext(AuthContext);
  const userId = user?._id;
  const userName = user?.username;
  const userAvatarUrl = user?.avatarUrl;

  const [leaders, setLeaders] = React.useState([]);
  const [me, setMe] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  // cache: username -> profilePicture (from /api/users/profile/:username)
  const [avatarCache, setAvatarCache] = React.useState({});

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const q = new URLSearchParams({ limit: '100', userId: userId || '' });
        const res = await fetch(`${API_BASE_URL}/api/games/leaderboard/overall?${q.toString()}`);
        const data = await res.json();

        let raw = Array.isArray(data) ? data : (data?.leaders || data?.leaderboard || data?.rows || []);
        let list = normalizeOverallRows(raw);
        list.sort((a, b) => (b.score || 0) - (a.score || 0));

        if (list.length === 0) {
          const agg = await fetchAggregatedOverall();
          if (agg.length > 0) list = agg;
        }

        if (list.length === 0 && (myTotal || 0) > 0 && userName) {
          list = [{ _id: userId, username: userName, score: myTotal, avatarUrl: userAvatarUrl || '' }];
        }

        let mine = data?.me || null;
        if (!mine || typeof mine.rank !== 'number') {
          const idx = list.findIndex(r => (userId && (r._id === userId || r.username === userName)));
          if (idx >= 0) mine = { rank: idx + 1, score: list[idx].score };
        }

        if (!alive) return;
        setLeaders(list);
        setMe(mine || null);
      } catch {
        if (alive) { setLeaders([]); setMe(null); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, userName, userAvatarUrl, myTotal]);

  // Enrich missing avatars by hitting /api/users/profile/:username (same as Profile page)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const need = leaders
        .filter(l =>
          l.username &&
          l.username !== '—' &&
          (!isMeaningfulAvatar(l.avatarUrl)) &&
          !avatarCache[l.username]
        )
        .slice(0, 100);

      if (need.length === 0) return;

      try {
        const results = await Promise.allSettled(
          need.map(l => axios.get(`${API_BASE_URL}/api/users/profile/${encodeURIComponent(l.username)}`))
        );

        const patch = {};
        results.forEach((r, i) => {
          const uname = need[i].username;
          if (r.status === 'fulfilled' && r.value?.data) {
            patch[uname] = r.value.data.profilePicture || r.value.data.avatarUrl || '';
          } else {
            patch[uname] = '';
          }
        });

        if (!alive) return;
        setAvatarCache(prev => ({ ...prev, ...patch }));

        // update leaders so UI refreshes immediately
        setLeaders(prev =>
          prev.map(x => (isMeaningfulAvatar(x.avatarUrl) || !patch[x.username]) ? x : { ...x, avatarUrl: patch[x.username] })
        );
      } catch {
        // ignore
      }
    })();
    return () => { alive = false; };
  }, [leaders, avatarCache]);

  const tier = perGameRank(myTotal ?? 0);

  // Build 100 positions (leaders + placeholders)
  const positions = React.useMemo(() => {
    const mk = (i) => ({ place: i + 1, username: '—', score: '—', avatarUrl: '', placeholder: true });
    return Array.from({ length: 100 }, (_, i) =>
      leaders[i] ? { ...leaders[i], place: i + 1, placeholder: false } : mk(i)
    );
  }, [leaders]);

  const P = (i) => positions[i];
  const resolvedAvatar = (p) => avatarCache[p.username] ?? p.avatarUrl;

  return (
    <LeaderCard aria-label="Overall Leaderboard">
      <LeaderHeader>
        <SectionTitle>Overall Leaderboard</SectionTitle>
        <RankBox>
          <Pill $rank={tier} title={`Your tier: ${tier}`}>{tier}</Pill>
          <span>🏆 {Number(myTotal || 0).toLocaleString()}</span>
          <span style={{opacity:.6}}>·</span>
          <span title="Your global placement">#{me?.rank ?? '—'}</span>
        </RankBox>
      </LeaderHeader>

      {loading ? (
        <Subtle>Loading…</Subtle>
      ) : (
        <>
          {/* Olympic-style podium: 2 (left), 1 (center), 3 (right) */}
          <PodiumWrap>
            {[{i:1,h:110,s:56,label:2},{i:0,h:140,s:64,label:1},{i:2,h:96,s:52,label:3}].map(({i,h,s,label}) => {
              const p = P(i);
              const opacity = p.placeholder ? 0.5 : 1;
              return (
                <div key={label} style={{ position:'relative' }}>
                  <Pedestal $h={h} style={{opacity}}>
                    <RankBadge>#{label}</RankBadge>
                    <AvatarRing $size={s}>
                      <Avatar size={s} src={resolvedAvatar(p)} name={p.placeholder ? '' : p.username} />
                    </AvatarRing>
                    <div>
                      <PodiumName>
                        {p.placeholder ? '—' : <UserLink username={p.username}>{p.username}</UserLink>}
                      </PodiumName>
                      <PodiumScore>{p.score} 🏆</PodiumScore>
                    </div>
                  </Pedestal>
                </div>
              );
            })}
          </PodiumWrap>

          {/* #4 & #5 side-by-side */}
          <Duo>
            {[P(3), P(4)].map((p) => (
              <RowItem key={p.place} style={{opacity: p.placeholder ? .5 : 1}}>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <span style={{fontSize:12, color:'#6b7280'}}>#{p.place}</span>
                  <Avatar size={32} src={resolvedAvatar(p)} name={p.placeholder ? '' : p.username} />
                  {p.placeholder ? '—' : <UserLink username={p.username}>{p.username}</UserLink>}
                </div>
                <div>{p.score} 🏆</div>
              </RowItem>
            ))}
          </Duo>

          {/* Top 100 — internal scroll */}
          <ScrollList role="list" aria-label="Top 100">
            {positions.slice(5).map((p) => (
              <RowItem key={p.place} role="listitem" style={{opacity: p.placeholder ? .45 : 1}}>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <span style={{fontSize:12, color:'#6b7280'}}>#{p.place}</span>
                  <Avatar size={28} src={resolvedAvatar(p)} name={p.placeholder ? '' : p.username} />
                  {p.placeholder ? '—' : <UserLink username={p.username}>{p.username}</UserLink>}
                </div>
                <div>{p.score} 🏆</div>
              </RowItem>
            ))}
          </ScrollList>
        </>
      )}
    </LeaderCard>
  );
}

/* ------------------- Main Page ------------------- */
export default function Games() {
  const { user } = useContext(AuthContext);
  const { stats, load, addResult } = useGameStats(user?._id);

  const [view, setView] = useState('home');
  const [chessSet, setChessSet] = useState('Classic');
  const [checkersSet, setCheckersSet] = useState('Red/Black');

  useEffect(() => { if (user?._id) load(); }, [user?._id, load]);

  const onResult = async (gameKey, delta, didWin) => {
    try { await addResult(gameKey, delta, didWin); }
    catch (e) { console.error(e); alert('Failed to save result'); }
  };

  const byGame = stats.byGame || {};
  const getGame = (k) => byGame[k] || { trophies:0 };

  const Home = (
    <Row>
      {/* LEFT: Your Game Ranks + Customization */}
      <div style={{ display:'grid', gap:12 }}>
        <Card>
          <SectionTitle>Your Game Ranks</SectionTitle>
          <div style={{display:'grid', gap:8}}>
            {GAMES.map(g => {
              const s = getGame(g.key);
              const r = perGameRank(s.trophies);
              return (
                <div key={g.key} style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span aria-hidden style={{fontSize:16}}>{g.icon}</span>
                    <strong>{g.name}</strong>
                  </div>
                  <Pill $rank={r}>{r} · 🏆 {s.trophies}</Pill>
                </div>
              );
            })}
          </div>
        </Card>

        <ScrollCard>
          <SectionTitle>Customization</SectionTitle>

          <div style={{fontWeight:800, marginTop:4}}>Chess Set</div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:6}}>
            {['Classic','Neo','Wood'].map(s=>(
              <button
                key={s}
                onClick={()=>setChessSet(s)}
                style={{
                  appearance:'none',
                  border:'1px solid ' + (chessSet===s?'#111':'var(--border-color)'),
                  background: chessSet===s? '#111':'#fff',
                  color: chessSet===s? '#fff':'#111',
                  borderRadius:10, padding:'8px 10px', fontWeight:800, fontSize:12,
                  boxShadow: chessSet===s ? '0 3px 10px rgba(0,0,0,.12)' : 'none', cursor:'pointer'
                }}
              >{s}</button>
            ))}
          </div>

          <div style={{fontWeight:800, marginTop:10}}>Checkers Set</div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:6}}>
            {['White/Black','Cream/Brown','Blue/White'].map(s=>(
              <button
                key={s}
                onClick={()=>setCheckersSet(s)}
                style={{
                  appearance:'none',
                  border:'1px solid ' + (checkersSet===s?'#111':'var(--border-color)'),
                  background: checkersSet===s? '#111':'#fff',
                  color: checkersSet===s? '#fff':'#111',
                  borderRadius:10, padding:'8px 10px', fontWeight:800, fontSize:12,
                  boxShadow: checkersSet===s ? '0 3px 10px rgba(0,0,0,.12)' : 'none', cursor:'pointer'
                }}
              >{s}</button>
            ))}
          </div>

          <Subtle style={{marginTop:12}}>More cosmetics soon.</Subtle>
        </ScrollCard>
      </div>

      {/* RIGHT: Overall leaderboard */}
      <RightCol>
        <OverallLeaderboard myTotal={stats.totalTrophies || 0} />
      </RightCol>
    </Row>
  );

  const GameView = (
    <Row>
      <GameSidebar gameKey={view} title={GAMES.find(g => g.key === view)?.name} />
      <Card>
        {view === 'chess'    && <ChessArena />}
        {view === 'checkers' && <CheckersArena onResult={onResult} />}
        {view === 'fishing'  && <FishingArena onResult={onResult} />}
        {view === 'poker'    && <PokerArena onResult={onResult} />}
        {view === 'reversi'  && <ReversiArena onResult={onResult} />}
        {view === 'jump'     && <JumpArena onResult={onResult} />}
        {view === 'oddeven'  && <OddEvenArena onResult={onResult} />}
      </Card>
    </Row>
  );

  return (
    <Page>
      <GamesFonts />
      <TopBar role="tablist" aria-label="Games">
        <TitleButton role="tab" aria-selected={view === 'home'} onClick={() => setView('home')} title="Back to Games profile">
          Games
        </TitleButton>
        {GAMES.map(g => (
          <TabButton
            key={g.key}
            role="tab"
            $active={view === g.key}
            aria-selected={view === g.key}
            onClick={() => setView(g.key)}
            title={g.name}
          >
            {g.name}
          </TabButton>
        ))}
        <FlexGrow />
        <CoinStat title="Your coin balance">
          <span aria-hidden>🪙</span>
          <span>Coins</span>
          <span style={{opacity:.6}}>·</span>
          <span>{(stats.coins ?? 0).toLocaleString()}</span>
        </CoinStat>
      </TopBar>

      <BarSeparator />
      {view === 'home' ? Home : GameView}
    </Page>
  );
}
