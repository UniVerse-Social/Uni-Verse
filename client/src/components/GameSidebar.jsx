// client/src/components/GameSidebar.jsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

/* =============== styled =============== */

const Card = styled.div`
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 12px;
  box-shadow: 0 14px 32px rgba(0,0,0,.35);

  /* Keep the sidebar visually "cut" to the viewport height.
     The internal lists scroll; the card itself doesn't overflow. */
  max-height: calc(100vh - 220px);
  overflow: hidden;
`;

const Title = styled.div`
  font-family: 'Exo 2', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  font-weight: 800;
  font-size: 24px;
  letter-spacing: .4px;
  margin-bottom: 10px;
`;

const Meta = styled.div` font-size: 12px; color: rgba(230,233,255,0.65); `;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 12px;
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--border-color);
`;

const Label = styled.div`
  font-weight: 600;
`;

const Value = styled.div`
  font-weight: 700;
`;

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 700;
  background: rgba(255,255,255,0.08);
  border: 1px solid var(--border-color);
`;

const BoardWrap = styled.div`
  margin: 12px 0 4px;
`;

const Podium = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
`;

const Ped = styled.div`
  background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04));
  border: 1px solid var(--border-color);
  border-radius: 10px;
  height: ${p => p.$h || 80}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const PedName = styled.div`
  font-weight: 700;
  font-size: 12px;
`;

const PedScore = styled.div` font-size: 11px; color: rgba(230,233,255,0.65); `;

const List = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  max-height: 76px;          /* fixed area for the rest of the leaderboard */
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;         /* space for scrollbar */
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: rgba(255,255,255,0.06);
`;

const HistoryList = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  max-height: 280px;          /* fixed area for recent games */
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
`;

const Result = styled.div`
  font-weight: 800;
  font-size: 11px;
  color: ${p => (p.$win ? '#16a34a' : '#dc2626')};
`;

const Small = styled.span` font-size: 11px; color: rgba(230,233,255,0.65); `;

const ScrollbarStyles = styled.div`
  & *::-webkit-scrollbar { width: 8px; height: 8px; }
  & *::-webkit-scrollbar-thumb { background: rgba(139,123,255,0.35); border-radius: 8px; }
  & *::-webkit-scrollbar-track { background: transparent; }
`;

const DesktopOnly = styled.div`
  @media (max-width: 860px) { display: ${p => (p.$showOnMobile ? 'block' : 'none')}; }
`;
/* =============== helpers =============== */

// Mirror rank thresholds used elsewhere
const perGameRank = (n) => {
  if (n >= 1500) return 'Champion';
  if (n >= 900)  return 'Diamond';
  if (n >= 600)  return 'Platinum';
  if (n >= 400)  return 'Gold';
  if (n >= 250)  return 'Silver';
  if (n >= 100)  return 'Bronze';
  return 'Wood';
};

// Normalize various leaderboard row shapes into { name, trophies, _id }
function normalizeLeaders(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((r, i) => ({
    _id: r._id || r.userId || `row-${i}`,
    name: r.name || r.username || r.user || 'Player',
    trophies: typeof r.trophies === 'number'
      ? r.trophies
      : (typeof r.score === 'number' ? r.score : 0),
  }));
}

const MobileGuard = styled.div`
  /* On phones we’ll render a dropdown copy inside ChessArena instead */
  @media (max-width: 860px) { display: ${p => (p.$showOnMobile ? 'block' : 'none')}; }
`;

/* =============== component =============== */

export default function GameSidebar({ gameKey, title, showOnMobile = false }) {
  const { user } = useContext(AuthContext);
  const isPoker = gameKey === 'poker';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ trophies: 0, wins: 0, losses: 0, rankName: '—' });
  const [leaders, setLeaders] = useState([]); // [{ name, trophies, _id }]
  const [history, setHistory] = useState([]); // [{ _id, didWin, delta, createdAt }]

  const myScore = useMemo(() => {
    if (!isPoker) return stats.trophies ?? 0;
    return (history || []).reduce((s, h) => s + (Number(h.delta) || 0), 0);
  }, [isPoker, stats, history]);

  // single fetcher we can reuse (initial load, event-driven refresh, visibility change)
  const loadAll = useCallback(async () => {
    if (!user?._id || !gameKey) return;
    setLoading(true);
    try {
      const [stRes, lbRes, hiRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/games/stats/${user._id}`),
        axios.get(`${API_BASE_URL}/api/games/leaderboard/${gameKey}?limit=10`),
        axios.get(`${API_BASE_URL}/api/games/history/${user._id}/${gameKey}?limit=100`),
      ]);

      // ---- Normalize stats: take per-game trophies from trophiesByGame ----
      const rawStats = stRes?.data || {};
      const trophiesByGame = rawStats?.trophiesByGame || {};
      const t = Number(trophiesByGame?.[gameKey] ?? 0);
      const hi = (hiRes?.data?.history ?? hiRes?.data ?? []);
      const wins   = isPoker ? hi.filter(h => Number(h.delta) > 0).length
                            : hi.filter(h => !!h.didWin).length;
      const losses = isPoker ? hi.filter(h => Number(h.delta) < 0).length
                            : hi.filter(h => !h.didWin).length;

      setStats({
        trophies: t,
        wins,
        losses,
        rankName: perGameRank(t),
      });

      // ---- Normalize leaderboard rows (server uses `score` & `username`) ----
      const lbRaw = lbRes?.data?.leaders ?? lbRes?.data ?? [];
      setLeaders(normalizeLeaders(lbRaw));

      setHistory(Array.isArray(hi) ? hi : []);
    } catch (e) {
      console.error('GameSidebar load error', e);
    } finally {
      setLoading(false);
    }
  }, [user?._id, gameKey, isPoker]);

  // initial load and when user/gameKey changes
  useEffect(() => { loadAll(); }, [loadAll]);

  // refresh automatically when games award trophies
  useEffect(() => {
    const onRefresh = (e) => {
      const changedKey = e?.detail?.gameKey;
      if (!changedKey || changedKey === gameKey) loadAll();
      else {
        // Even if another game changed, overall positions can shift; refresh anyway if you prefer:
        // loadAll();
      }
    };
    window.addEventListener('games:statsUpdated', onRefresh);
    return () => window.removeEventListener('games:statsUpdated', onRefresh);
  }, [gameKey, loadAll]);

  // optional: refresh when user returns to the tab
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') loadAll(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadAll]);

  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;
  const rankName = stats.rankName ?? '—';

  // top-3 for the podium, rest go to the list
  const podium = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <MobileGuard $showOnMobile={showOnMobile}>
      <DesktopOnly $showOnMobile={showOnMobile}>
      <ScrollbarStyles>
        <Card>
        <Title>{title ?? 'Game'}</Title>

        {/* Quick stats */}
        <div style={{ display: 'grid', gap: 8 }}>
          <Row>
            <Label>Rank</Label>
            <Value>{rankName}</Value>
          </Row>
          <Row>
            <Label>{isPoker ? 'Coins earned' : 'Trophies'}</Label>
            <Value>{myScore}</Value>
          </Row>
          <Row>
            <Label>W / L</Label>
            <Value>{wins} / {losses}</Value>
          </Row>
        </div>

        {/* Leaderboard */}
        <BoardWrap>
          <div style={{ fontWeight: 800, margin: '12px 0 6px' }}>Leaderboard</div>
          {loading && <Meta>Loading…</Meta>}
          {!loading && (
            <>
              <Podium>
                <Ped $h={44}>
                  <PedName>{podium[1]?.name ?? '—'}</PedName>
                  <PedScore>{podium[1]?.trophies ?? 0} 🏆</PedScore>
                </Ped>
                <Ped $h={60}>
                  <PedName>{podium[0]?.name ?? '—'}</PedName>
                  <PedScore>{podium[0]?.trophies ?? 0} 🏆</PedScore>
                </Ped>
                <Ped $h={40}>
                  <PedName>{podium[2]?.name ?? '—'}</PedName>
                  <PedScore>{podium[2]?.trophies ?? 0} 🏆</PedScore>
                </Ped>
              </Podium>

              <List>
                {rest.length === 0 && <Meta>No other players yet.</Meta>}
                {rest.map((p, i) => (
                  <Item key={p._id ?? `${p.name}-${i}`}>
                    <div>
                      <Pill>#{i + 4}</Pill>{' '}
                      <strong>{p.name ?? 'Anonymous'}</strong>
                    </div>
                    <div>{p.trophies ?? 0} 🏆</div>
                  </Item>
                ))}
              </List>
            </>
          )}
        </BoardWrap>

        {/* Recent games */}
        <div style={{ fontWeight: 800, margin: '12px 0 6px' }}>Recent games</div>
        {loading && <Meta>Loading…</Meta>}
        {!loading && (
          <HistoryList>
            {history.length === 0 && <Meta>No recent games.</Meta>}
            {history.map((h) => {
              const win = isPoker ? Number(h.delta) > 0 : !!h.didWin;
              return (
                <Item key={h._id}>
                  <Result $win={win}>{win ? 'Win' : 'Loss'}</Result>
                  <div>
                    <Small>
                      {new Date(h.createdAt).toLocaleDateString()}&nbsp;
                      {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Small>
                  </div>
                  <div>{h.delta > 0 ? `+${h.delta}` : h.delta} {isPoker ? '🪙' : '🏆'}</div>
                </Item>
              );
            })}
          </HistoryList>
        )}
      </Card>
    </ScrollbarStyles>
    </DesktopOnly>
    </MobileGuard>
  );
}
