// client/src/pages/Games.js
import React, { useEffect, useState, useContext, useCallback } from 'react';
import styled from 'styled-components';
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

/* ------------------- Layout ------------------- */
const Page = styled.div` max-width: 1120px; margin: 0 auto; padding: 16px; `;
const Top = styled.div` display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; `;
const TitleBtn = styled.button`
  border:none; background:transparent; color:#e5e7eb; font-size:28px; font-weight:900; padding:0; cursor:pointer;
  &:hover { opacity:.9; text-decoration: underline; text-underline-offset: 4px; }
`;
const GameBarWrap = styled.div`
  position:sticky; top:72px; z-index:5;
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(6px);
  border:1px solid var(--border-color);
  border-radius:12px; padding:8px;
`;
const GameBar = styled.div` display:flex; gap:8px; flex-wrap:wrap; align-items:center; `;
const GameTab = styled.button`
  padding: 8px 12px; border-radius: 999px; cursor: pointer; font-weight: 700;
  background: ${p=>p.$active ? '#111' : '#fff'};
  color: ${p=>p.$active ? '#fff' : '#111'};
  border: 1px solid ${p=>p.$active ? '#111' : 'var(--border-color)'};
  box-shadow: ${p=>p.$active ? '0 3px 10px rgba(0,0,0,.15)' : 'none'};
`;

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
      {/* Secondary bar: title navigates to profile; bar provides direct game buttons */}
      <Top>
        <TitleBtn onClick={() => setView('home')} title="Open Game Profile">Games</TitleBtn>
        <GameBarWrap>
          <GameBar>
            {GAMES.map(g => (
              <GameTab key={g.key} $active={view === g.key} onClick={() => setView(g.key)}>
                {g.name}
              </GameTab>
            ))}
          </GameBar>
        </GameBarWrap>
      </Top>

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
                  <GameTab key={g.key} $active={lbTab === g.key} onClick={() => setLbTab(g.key)}>{g.name}</GameTab>
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
