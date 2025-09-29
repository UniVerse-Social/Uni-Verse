// client/src/pages/Games.js
import React, { useEffect, useState, useContext, useCallback } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import axios from 'axios';

import { AuthContext } from '../App';
import { API_BASE_URL } from '../config';

// Arenas
import ChessArena from './ChessArena';
import CheckersArena from './CheckersArena';
import ShogiArena from './ShogiArena';
import GoArena from './GoArena';
import ReversiArena from './ReversiArena';
import JumpArena from './JumpArena';
import OddEvenArena from './OddEvenArena';
import GameSidebar from '../components/GameSidebar';

/* ------------------- Global fonts ------------------- */
const GamesFonts = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Exo+2:wght@700;800;900&display=swap');
`;

/* ------------------- Layout ------------------- */
const Page = styled.div` max-width: 1160px; margin: 0 auto; padding: 16px; min-height: calc(100vh - 101px); `;

/* ======= Top bar (now non-sticky) ======= */
const TopBar = styled.nav`
  position: static;
  top: auto;
  z-index: 1;

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
  font-family: 'Exo 2', 'Bebas Neue', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
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

/* ------------------- Cards & Grids ------------------- */
const Row = styled.div`
  display:grid; grid-template-columns: 360px 1fr; gap:16px; align-items:start;
`;
const Card = styled.div`
  background: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 16px; padding: 14px;
  box-shadow: 0 10px 24px rgba(0,0,0,.06);
`;
const SectionTitle = styled.div` font-weight:900; margin-bottom:8px; `;
const Subtle = styled.div` font-size:12px; color:#6b7280; `;

const Grid = styled.div`
  display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:12px;
`;
const GameCard = styled.div`
  border:1px solid var(--border-color); border-radius:14px; padding:12px; background:#fff;
  display:flex; flex-direction:column; gap:8px; min-height: 112px;
  box-shadow: 0 6px 16px rgba(0,0,0,.05);
`;

const Pill = styled.span`
  padding: 3px 10px; border-radius: 999px; font-weight: 900; font-size: 11px; color:#fff;
  background: ${p => ({
    Champion:'#7c3aed', Diamond:'#2563eb', Platinum:'#14b8a6',
    Gold:'#f59e0b', Silver:'#9ca3af', Bronze:'#b45309', Wood:'#374151'
  }[p.$rank] || '#374151')};
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.15), 0 4px 10px rgba(0,0,0,.12);
`;

/* ------------------- Game metadata ------------------- */
const GAMES = [
  { key:'chess',    name:'Chess',       icon:'♟️' },
  { key:'checkers', name:'Checkers',    icon:'⛀' },
  { key:'shogi',    name:'Shogi',       icon:'将' },
  { key:'go',       name:'Go',          icon:'⚪' },
  { key:'reversi',  name:'Reversi',     icon:'◐' },
  { key:'jump',     name:'Jump Game',   icon:'🦘' },
  { key:'oddeven',  name:'Odd or Even', icon:'🎲' },
];

/* Rank thresholds */
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
      const sg = (data.statsByGame && data.statsByGame[g.key]) || {};
      byGame[g.key] = { trophies: t, wins: sg.wins || 0, losses: sg.losses || 0 };
    });
    setStats({ totalTrophies: data.totalTrophies || 0, coins: data.coins || 0, byGame });
  }, [userId]);

  const addResult = useCallback(async (gameKey, delta, didWin = null) => {
    if (!userId) return;
    await axios.post(`${API_BASE_URL}/api/games/result`, { userId, gameKey, delta, didWin });
    await load();
  }, [userId, load]);

  return { stats, load, addResult };
}

/* ------------------- Main Page ------------------- */
export default function Games() {
  const { user } = useContext(AuthContext);
  const { stats, load, addResult } = useGameStats(user?._id);

  const [view, setView] = useState('home');

  // cosmetics (keep sets; avatar & game mounts removed)
  const [chessSet, setChessSet] = useState('Classic');
  const [checkersSet, setCheckersSet] = useState('Red/Black');

  useEffect(() => { if (user?._id) load(); }, [user?._id, load]);

  const onResult = async (gameKey, delta, didWin) => {
    try { await addResult(gameKey, delta, didWin); }
    catch (e) { console.error(e); alert('Failed to save result'); }
  };

  const byGame = stats.byGame || {};
  const getGame = (k) => byGame[k] || { trophies:0, wins:0, losses:0 };

  /* ---------- Overall Leaderboard (inline helper) ---------- */
  const OverallLeaderboard = () => {
    const [leaders, setLeaders] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      let alive = true;
      (async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/games/leaderboard/overall?limit=10`);
          const data = await res.json();
          if (!alive) return;
          setLeaders(data?.leaders || []);
        } catch {
          setLeaders([]);
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => { alive = false; };
    }, []);

    return (
      <Card>
        <SectionTitle>Overall Leaderboard</SectionTitle>
        {loading ? (
          <Subtle>Loading…</Subtle>
        ) : leaders.length === 0 ? (
          <Subtle>No data yet.</Subtle>
        ) : (
          <>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, alignItems:'end', marginBottom:8}}>
              {[leaders[1], leaders[0], leaders[2]].map((p, i) => (
                <div key={i} style={{
                  background:'linear-gradient(180deg,#f3f4f6,#e5e7eb)',
                  border:'1px solid var(--border-color)', borderRadius:10,
                  height: i===1 ? 92 : 70, display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center'
                }}>
                  <div style={{fontWeight:800, fontSize:12}}>{p?.username || '-'}</div>
                  <div style={{fontSize:11, color:'#6b7280'}}>{p?.score ?? ''} 🏆</div>
                </div>
              ))}
            </div>
            <div style={{display:'grid', gap:6}}>
              {leaders.slice(3, 10).map((p, idx) => (
                <div key={p.userId || idx} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  fontSize:13, padding:'6px 8px', borderRadius:10, border:'1px solid var(--border-color)', background:'#fff'
                }}>
                  <div><span style={{fontSize:12, color:'#6b7280'}}>#{idx+4}</span> &nbsp; {p.username}</div>
                  <div>{p.score} 🏆</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    );
  };

  /* --------- Home (Dashboard) --------- */
  const Home = (
    <Row>
      {/* LEFT: Overall Rank → Per-game Ranks → Customization (avatar removed) */}
      <div style={{ display:'grid', gap:12 }}>
        {/* Overall rank card */}
        <Card>
          <SectionTitle>Overall Rank</SectionTitle>
          {(() => {
            const total = typeof stats.totalTrophies === 'number'
              ? stats.totalTrophies
              : GAMES.reduce((sum, g) => sum + getGame(g.key).trophies, 0);
            const rank = perGameRank(total);
            return (
              <>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
                  <Pill $rank={rank} title={`Rank: ${rank}`}>{rank}</Pill>
                  <div style={{fontWeight:900}}>🏆 {total}</div>
                </div>
                <Subtle style={{marginTop:6}}>Sum of trophies across all games.</Subtle>
              </>
            );
          })()}
        </Card>

        {/* Per-game ranks snapshot */}
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

        {/* Customization (kept minimal, under ranks) */}
        <Card>
          <SectionTitle>Customization</SectionTitle>

          <div style={{fontWeight:800, marginTop:4}}>Chess Set</div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:6}}>
            {['Classic','Neo','Wood'].map(s=>(
              <button
                key={s}
                onClick={()=>setChessSet(s)}
                style={{
                  appearance:'none', border:'1px solid ' + (chessSet===s?'#111':'var(--border-color)'),
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
            {['Red/Black','Cream/Brown','Blue/White'].map(s=>(
              <button
                key={s}
                onClick={()=>setCheckersSet(s)}
                style={{
                  appearance:'none', border:'1px solid ' + (checkersSet===s?'#111':'var(--border-color)'),
                  background: checkersSet===s? '#111':'#fff',
                  color: checkersSet===s? '#fff':'#111',
                  borderRadius:10, padding:'8px 10px', fontWeight:800, fontSize:12,
                  boxShadow: checkersSet===s ? '0 3px 10px rgba(0,0,0,.12)' : 'none', cursor:'pointer'
                }}
              >{s}</button>
            ))}
          </div>

          <Subtle style={{marginTop:12}}>
            More cosmetics soon. Avatar preview removed from this page per your request.
          </Subtle>
        </Card>
      </div>

      {/* RIGHT: Your Games + Overall leaderboard */}
      <div style={{ display: 'grid', gap: 12 }}>
        <Card>
          <SectionTitle>Your Games</SectionTitle>
          <Grid>
            {GAMES.map(g => {
              const s = getGame(g.key);
              const rank = perGameRank(s.trophies);
              return (
                <GameCard key={g.key}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                    <div style={{ fontWeight: 900, display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{fontSize:18}} aria-hidden>{g.icon}</span>
                      {g.name}
                    </div>
                    <Pill $rank={rank} title={`Rank: ${rank}`}>{rank} · 🏆 {s.trophies}</Pill>
                  </div>
                  <Subtle>Record: <b>{s.wins}</b>-<b>{s.losses}</b></Subtle>
                  <button onClick={() => setView(g.key)} style={{ alignSelf: 'flex-start' }}>Play</button>
                </GameCard>
              );
            })}
          </Grid>
        </Card>

        <OverallLeaderboard />
      </div>
    </Row>
  );

  /* --------- Specific Game View --------- */
  const GameView = (
    <Row>
      {/* LEFT: Game hub (Title • Rank • Leaderboard • Recent games) */}
      <GameSidebar gameKey={view} title={GAMES.find(g => g.key === view)?.name} />

      {/* RIGHT: Active Game Arena */}
      <Card>
        {view === 'chess'    && <ChessArena />}                    {/* Unranked */}
        {view === 'checkers' && <CheckersArena onResult={onResult} />}
        {view === 'shogi'    && <ShogiArena onResult={onResult} />}
        {view === 'go'       && <GoArena onResult={onResult} />}
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
      </TopBar>
      <BarSeparator />
      {view === 'home' ? Home : GameView}
    </Page>
  );
}
