// client/src/pages/Games.js
import React, { useEffect, useState, useContext, useCallback } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { AuthContext } from '../App';
import axios from 'axios';
import { API_BASE_URL } from '../config';

// Arenas (bots + online matchmaking)
import ChessArena from './ChessArena';
import CheckersArena from './CheckersArena';
import IceRacerArena from './IceRacerArena';
import JengaArena from './JengaArena';
import ArmArena from './ArmArena';
import JumpArena from './JumpArena';
import OddEvenArena from './OddEvenArena';

/* ------------------- Global fonts for the header ------------------- */
const GamesFonts = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Exo+2:wght@700;800;900&display=swap');
`;

/* ------------------- Layout ------------------- */
const Page = styled.div` max-width: 1120px; margin: 0 auto; padding: 16px; `;

/* ======= New connected top bar ======= */
const TopBar = styled.nav`
  position: sticky;
  top: 72px;                /* sits under your main app header */
  z-index: 12;
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
  /* vibrant gradient kept */
  background: linear-gradient(92deg, #ff8718 0%, #ffb95e 25%, #3b5cff 85%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;

  font-family: 'Exo 2', 'Bebas Neue', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  font-weight: 600;              /* ultra-bold */
  font-size: 34px;               /* a touch larger than tabs */
  letter-spacing: 0.6px;
  line-height: 1;

  -webkit-text-stroke: 1px rgba(0,0,0,0.22);   /* Safari/Chromium */
  text-shadow:
    0 1px 0 rgba(255,255,255,0.05),
    0 2px 4px rgba(0,0,0,0.25);

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

const BarSeparator = styled.div`
  height: 10px;
  pointer-events: none;
`;

/* ------------------- Content blocks ------------------- */
const Row = styled.div` display:grid; grid-template-columns: 300px 1fr; gap:16px; align-items:start; `;
const Card = styled.div`
  background: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 16px; padding: 14px;
  box-shadow: 0 10px 24px rgba(0,0,0,.06);
`;

const Stat = styled.div` font-size:14px; margin: 6px 0; `;
const Big = styled.div` font-size:30px; font-weight:900; `;
const Subtle = styled.div` font-size:12px; color:#6b7280; `;
const Pill = styled.span`
  padding:2px 8px; border-radius:999px; border:1px solid var(--border-color); background:#f3f4f6; font-size:11px; font-weight:800;
`;

const Grid = styled.div` display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:12px; `;
const GameCard = styled.div`
  border:1px solid var(--border-color); border-radius:14px; padding:12px; background:#fff;
  display:flex; flex-direction:column; gap:8px;
  box-shadow: 0 6px 16px rgba(0,0,0,.05);
`;

const SectionTitle = styled.div` font-weight:900; margin-bottom:8px; `;
const LeaderTabs = styled.div` display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; `;
const LeaderList = styled.div` display:flex; flex-direction:column; gap:6px; `;

/* ------------------- Games Meta ------------------- */
const GAMES = [
  { key:'chess',    name:'Chess' },
  { key:'checkers', name:'Checkers' },
  { key:'iceracer', name:'Ice Racer' },
  { key:'jenga',    name:'Jenga' },
  { key:'arm',      name:'Arm Wrestling' },
  { key:'jump',     name:'Jump Game' },
  { key:'oddeven',  name:'Odd or Even' },
];

/* Per-game rank thresholds (unchanged) */
const perGameRank = (n) => {
  if (n >= 1500) return 'Champion';
  if (n >= 900)  return 'Diamond';
  if (n >= 600)  return 'Platinum';
  if (n >= 400)  return 'Gold';
  if (n >= 250)  return 'Silver';
  if (n >= 100)  return 'Bronze';
  return 'Wood';
};

/* NEW: Overall rank is tougher than per-game */
const overallRank = (n) => {
  if (n >= 5000) return 'Champion';
  if (n >= 3200) return 'Diamond';
  if (n >= 2000) return 'Platinum';
  if (n >= 1200) return 'Gold';
  if (n >= 600)  return 'Silver';
  if (n >= 200)  return 'Bronze';
  return 'Wood';
};

/* ------------------- Stats Hook ------------------- */
function useGameStats(userId) {
  // final shape used by the UI
  const [stats, setStats] = useState({
    totalTrophies: 0,
    coins: 0,
    byGame: {}, // key -> { trophies, wins, losses }
  });

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await axios.get(`${API_BASE_URL}/api/games/stats/${userId}`);
    const byGame = {};
    GAMES.forEach(g => {
      const t = (data.trophiesByGame && data.trophiesByGame[g.key]) || 0;
      const sg = (data.statsByGame && data.statsByGame[g.key]) || {};
      byGame[g.key] = {
        trophies: t,
        wins: sg.wins || 0,
        losses: sg.losses || 0,
      };
    });
    setStats({
      totalTrophies: data.totalTrophies || 0,
      coins: data.coins || 0,
      byGame,
    });
  }, [userId]);

  const addResult = useCallback(async (gameKey, delta, didWin = null) => {
    if (!userId) return;
    await axios.post(`${API_BASE_URL}/api/games/result`, { userId, gameKey, delta, didWin });
    await load();
  }, [userId, load]);

  return { stats, load, addResult };
}

/* ------------------- Reusable top bar component ------------------- */
function GamesTopBar({ active, onChange }) {
  return (
    <>
      <GamesFonts />
      <TopBar role="tablist" aria-label="Games">
        <TitleButton
          role="tab"
          aria-selected={active === 'home'}
          onClick={() => onChange('home')}
          title="Back to Games profile"
        >
          Games
        </TitleButton>

        {GAMES.map(g => (
          <TabButton
            key={g.key}
            role="tab"
            $active={active === g.key}
            aria-selected={active === g.key}
            onClick={() => onChange(g.key)}
            title={g.name}
          >
            {g.name}
          </TabButton>
        ))}
      </TopBar>
      <BarSeparator />
    </>
  );
}

/* ------------------- Main Page ------------------- */
export default function Games() {
  const { user } = useContext(AuthContext);
  const { stats, load, addResult } = useGameStats(user?._id);

  // view: 'home' (dashboard) OR a specific game key
  const [view, setView] = useState('home');

  // leaderboards
  const [lbTab, setLbTab] = useState(GAMES[0].key);
  const [leaderboards, setLeaderboards] = useState({}); // key -> array
  const [lbErr, setLbErr] = useState('');

  useEffect(() => { if (user?._id) load(); }, [user?._id, load]);

  const fetchLeaderboard = useCallback(async (gameKey) => {
    try {
      setLbErr('');
      const { data } = await axios.get(`${API_BASE_URL}/api/games/leaderboard/${gameKey}`);
      const arr = Array.isArray(data) ? data : (data?.leaders || []);
      setLeaderboards(prev => ({ ...prev, [gameKey]: arr }));
    } catch {
      setLbErr('Leaderboard not available yet.');
      setLeaderboards(prev => ({ ...prev, [gameKey]: [] }));
    }
  }, []);

  useEffect(() => { fetchLeaderboard(lbTab); }, [lbTab, fetchLeaderboard]);

  const onResult = async (gameKey, delta, didWin) => {
    try { await addResult(gameKey, delta, didWin); }
    catch (e) { console.error(e); alert('Failed to save result'); }
  };

  const byGame = stats.byGame || {};
  const getGame = (k) => byGame[k] || { trophies:0, wins:0, losses:0 };
  const perRank = (k) => perGameRank(getGame(k).trophies);
  const totalRank = overallRank(stats.totalTrophies || 0);

  return (
    <Page>
      {/* Connected top bar (Games title + 7 game tabs) */}
      <GamesTopBar active={view} onChange={setView} />

      {view === 'home' ? (
        /* --------- Game Profile (dashboard) --------- */
        <Row>
          {/* Left: overview */}
          <Card>
            <Big>{totalRank}</Big>
            <Stat>Total Trophies: <b>{stats.totalTrophies || 0}</b></Stat>
            <Stat>Coins: <b>{stats.coins || 0}</b></Stat>
            <hr/>
            {GAMES.map(g => {
              const s = getGame(g.key);
              return (
                <Stat key={g.key}>
                  {g.name}: <b>{s.trophies}</b> <Subtle>({perRank(g.key)})</Subtle>
                  <div><Subtle>W-L: {s.wins}-{s.losses}</Subtle></div>
                </Stat>
              );
            })}
            <hr/>
            <Subtle>
              <b>Overall Rank:</b> Wood(0-200), Bronze(200-600), Silver(600-1200), Gold(1200-2000), Platinum(2000-3200), Diamond(3200-5000), Champion(5000+).
              <br/>
              <b>Per-Game Rank:</b> Wood(0-100), Bronze(100-250), Silver(250-400), Gold(400-600), Platinum(600-900), Diamond(900-1500), Champion(1500+).
              Champions reset to 1500 monthly; overflow converts to coins.
            </Subtle>
          </Card>

          {/* Right: quick-play, customization, leaderboards */}
          <div style={{ display: 'grid', gap: 12 }}>
            <Card>
              <SectionTitle>Your Games</SectionTitle>
              <Grid>
                {GAMES.map(g => {
                  const s = getGame(g.key);
                  return (
                    <GameCard key={g.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 900 }}>{g.name}</div>
                        <Pill>{perRank(g.key)}</Pill>
                      </div>
                      <Subtle>Trophies: <b>{s.trophies}</b></Subtle>
                      <Subtle>W-L: <b>{s.wins}</b>-<b>{s.losses}</b></Subtle>
                      <button onClick={() => setView(g.key)} style={{ alignSelf: 'flex-start' }}>Play</button>
                    </GameCard>
                  );
                })}
              </Grid>
            </Card>

            <Card>
              <SectionTitle>Customization</SectionTitle>
              <Subtle>Coming soon: board themes, avatars, emotes, and more.</Subtle>
            </Card>

            <Card>
              <SectionTitle>Leaderboards</SectionTitle>
              <LeaderTabs>
                {GAMES.map(g => (
                  <TabButton key={g.key} $active={lbTab === g.key} onClick={() => setLbTab(g.key)}>{g.name}</TabButton>
                ))}
              </LeaderTabs>
              {lbErr && <Subtle style={{ color: '#b00020' }}>{lbErr}</Subtle>}
              <LeaderList>
                {(leaderboards[lbTab] || []).slice(0, 10).map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: 12, background: '#fff' }}>
                    <div><b>{idx + 1}.</b> {p.username || 'Player'}</div>
                    <div>Trophies: <b>{p.trophies ?? p.score ?? 0}</b></div>
                  </div>
                ))}
                {(!leaderboards[lbTab] || leaderboards[lbTab].length === 0) && (
                  <Subtle>No leaderboard entries yet.</Subtle>
                )}
              </LeaderList>
            </Card>
          </div>
        </Row>
      ) : (
        /* --------- Specific game view --------- */
        <Row>
          <Card>
            <Big>{totalRank}</Big>
            <Stat>Total Trophies: <b>{stats.totalTrophies || 0}</b></Stat>
            <Stat>Coins: <b>{stats.coins || 0}</b></Stat>
            <hr/>
            {(() => {
              const g = GAMES.find(x => x.key === view);
              const s = getGame(view);
              return (
                <>
                  <Stat style={{ fontWeight: 900 }}>{g?.name}</Stat>
                  <Stat>Trophies: <b>{s.trophies}</b> <Subtle>({perRank(view)})</Subtle></Stat>
                  <Stat>W-L: <b>{s.wins}</b>-<b>{s.losses}</b></Stat>
                </>
              );
            })()}
          </Card>

          <Card>
            {view === 'chess'    && <ChessArena />}                   {/* Unranked */}
            {view === 'checkers' && <CheckersArena onResult={onResult} />}
            {view === 'iceracer' && <IceRacerArena onResult={onResult} />}
            {view === 'jenga'    && <JengaArena onResult={onResult} />}
            {view === 'arm'      && <ArmArena onResult={onResult} />}
            {view === 'jump'     && <JumpArena onResult={onResult} />}
            {view === 'oddeven'  && <OddEvenArena onResult={onResult} />}
          </Card>
        </Row>
      )}
    </Page>
  );
}
