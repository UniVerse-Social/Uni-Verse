// client/src/components/GameSidebar.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

/* =============== styled =============== */

const Card = styled.div`
  background: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 10px 24px rgba(0,0,0,.06);
`;

const Title = styled.div`
  font-family: 'Exo 2', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  font-weight: 800;
  font-size: 28px;
  letter-spacing: .4px;
  margin-bottom: 12px;
`;

const Meta = styled.div`
  font-size: 13px;
  color: #6b7280;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff;
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
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  background: #f3f4f6;
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
  background: linear-gradient(180deg, #f3f4f6, #e5e7eb);
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

const PedScore = styled.div`
  font-size: 11px;
  color: #6b7280;
`;

const List = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: #fff;
`;

const HistoryList = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
`;

const Result = styled.div`
  font-weight: 800;
  font-size: 12px;
  color: ${p => (p.$win ? '#16a34a' : '#dc2626')};
`;

const Small = styled.span`
  font-size: 11px;
  color: #6b7280;
`;

/* =============== component =============== */

export default function GameSidebar({ gameKey, title }) {
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);       // { rankName, trophies, wins, losses }
  const [leaders, setLeaders] = useState([]);     // [{ name, trophies, _id }, ...]
  const [history, setHistory] = useState([]);     // [{ _id, didWin, delta, createdAt }, ...]

  const myScore = useMemo(() => stats?.trophies ?? 0, [stats]);

  useEffect(() => {
    // Guard: nothing to load without a user or a game
    if (!user?._id || !gameKey) return;

    const controller = new AbortController();
    let mounted = true;

    const loadAll = async () => {
      setLoading(true);
      try {
        const [stRes, lbRes, hiRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/games/stats/${user._id}`, { signal: controller.signal }),
          axios.get(`${API_BASE_URL}/api/games/leaderboard/${gameKey}?limit=10`, { signal: controller.signal }),
          axios.get(`${API_BASE_URL}/api/games/history/${user._id}/${gameKey}?limit=10`, { signal: controller.signal }),
        ]);

        if (!mounted) return;

        setStats(stRes?.data ?? null);
        // handle both {leaders: [...]} and [...] shapes
        const lb = lbRes?.data?.leaders ?? lbRes?.data ?? [];
        setLeaders(Array.isArray(lb) ? lb : []);

        const hi = hiRes?.data?.history ?? hiRes?.data ?? [];
        setHistory(Array.isArray(hi) ? hi : []);
      } catch (e) {
        // ignore request cancellations; surface other errors
        if (e.name !== 'CanceledError' && e.name !== 'AbortError') {
          console.error('GameSidebar load error', e);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadAll();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [user?._id, gameKey]);

  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;
  const rankName = stats?.rankName ?? stats?.rank ?? '—';

  // top-3 for the podium, rest go to the list
  const podium = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <Card>
      <Title>{title ?? 'Game'}</Title>

      {/* Quick stats */}
      <div style={{ display: 'grid', gap: 8 }}>
        <Row>
          <Label>Rank</Label>
          <Value>{rankName}</Value>
        </Row>
        <Row>
          <Label>Trophies</Label>
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
              <Ped $h={70}>
                <PedName>{podium[1]?.name ?? '—'}</PedName>
                <PedScore>{podium[1]?.trophies ?? 0} 🏆</PedScore>
              </Ped>
              <Ped $h={90}>
                <PedName>{podium[0]?.name ?? '—'}</PedName>
                <PedScore>{podium[0]?.trophies ?? 0} 🏆</PedScore>
              </Ped>
              <Ped $h={60}>
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
          {history.map((h) => (
            <Item key={h._id}>
              <Result $win={h.didWin}>{h.didWin ? 'Win' : 'Loss'}</Result>
              <div>
                <Small>
                  {new Date(h.createdAt).toLocaleDateString()}&nbsp;
                  {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Small>
              </div>
              <div>{h.delta > 0 ? `+${h.delta}` : h.delta} 🏆</div>
            </Item>
          ))}
        </HistoryList>
      )}
    </Card>
  );
}
