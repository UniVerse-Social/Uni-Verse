// client/src/components/GameSidebar.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

const Card = styled.div`
  background: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 16px; padding: 14px;
  box-shadow: 0 10px 24px rgba(0,0,0,.06);
`;
const Title = styled.div`
  font-family: 'Exo 2', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  font-weight: 800; font-size: 28px; letter-spacing: .4px;
  margin-bottom: 8px;
`;
const Meta = styled.div` font-size: 13px; color: #6b7280; `;
const Row = styled.div` display: grid; grid-template-columns: 1fr; gap: 12px; `;
const Pill = styled.div`
  border: 1px solid var(--border-color);
  background: #f9fafb;
  border-radius: 12px;
  padding: 8px 10px;
  font-size: 13px;
  display: flex; gap: 8px; align-items: center; justify-content: space-between;
`;

const BoardWrap = styled.div` margin-top: 10px; `;
const Pedestals = styled.div`
  display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; align-items:end; margin-bottom: 8px;
`;
const Ped = styled.div`
  background: linear-gradient(180deg, #f3f4f6, #e5e7eb);
  border: 1px solid var(--border-color); border-radius: 10px;
  height: ${p=>p.$h || 80}px; display:flex; flex-direction:column; align-items:center; justify-content:center;
`;
const PedName = styled.div` font-weight: 700; font-size: 12px; `;
const PedScore = styled.div` font-size: 11px; color:#6b7280; `;
const List = styled.div` display:grid; grid-template-columns: 1fr; gap:6px; `;
const Item = styled.div`
  display:flex; align-items:center; justify-content:space-between; font-size: 13px;
  padding:6px 8px; border-radius:10px; border:1px solid var(--border-color); background:#fff;
`;

const HistoryList = styled.div` display:grid; grid-template-columns:1fr; gap:6px; `;
const Result = styled.div` font-weight:700; color:${p=>p.$win ? '#065f46' : '#991b1b'}; `;
const Small = styled.span` font-size:12px; color:#6b7280; `;

export default function GameSidebar({ gameKey, title }) {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [board, setBoard] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      const [st, lb, hi] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/games/stats/${user._id}`),
        axios.get(`${API_BASE_URL}/api/games/leaderboard/${gameKey}?limit=10`),
        axios.get(`${API_BASE_URL}/api/games/history/${user._id}/${gameKey}?limit=10`),
      ]);
      setStats(st.data);
      setBoard(lb.data?.leaders || []);
      setHistory(hi.data?.history || []);
    } catch (e) {
      console.error('sidebar load', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ });

  const myScore = stats?.trophiesByGame?.[gameKey] || 0;
  const wins = useMemo(() => history.filter(h => !!h.didWin).length, [history]);
  const losses = Math.max(0, history.length - wins);

  return (
    <Card>
      <Title>{title || (gameKey === 'chess' ? 'Chess' :
                        gameKey === 'checkers' ? 'Checkers' :
                        gameKey === 'iceracer' ? 'Ice Racer' : gameKey)}</Title>

      {/* Rank + W/L */}
      <Row>
        <Pill><span>Rank</span><b>{stats?.rank || '—'}</b></Pill>
        <Pill><span>Trophies</span><b>{myScore}</b></Pill>
        <Pill><span>W / L</span><b>{wins} / {losses}</b></Pill>
      </Row>

      {/* Leaderboard */}
      <BoardWrap>
        <div style={{fontWeight:800, margin:'10px 0 6px'}}>Leaderboard</div>
        {loading && <Meta>Loading…</Meta>}
        {!loading && (
          <>
            <Pedestals>
              {[board[1], board[0], board[2]].map((p, i) => (
                <Ped key={i} $h={i===1?92:(i===0?70:70)}>
                  <PedName>{p?.username || '-'}</PedName>
                  <PedScore>{p?.score ?? ''} 🏆</PedScore>
                </Ped>
              ))}
            </Pedestals>
            <List>
              {board.slice(3, 10).map((p, idx) => (
                <Item key={p.userId || idx}>
                  <div><Small>#{idx+4}</Small> &nbsp; {p.username}</div>
                  <div>{p.score} 🏆</div>
                </Item>
              ))}
            </List>
          </>
        )}
      </BoardWrap>

      {/* Recent games */}
      <div style={{fontWeight:800, margin:'12px 0 6px'}}>Recent games</div>
      {loading && <Meta>Loading…</Meta>}
      {!loading && (
        <HistoryList>
          {history.length === 0 && <Meta>No recent games.</Meta>}
          {history.map((h) => (
            <Item key={h._id}>
              <Result $win={h.didWin}>{h.didWin ? 'Win' : 'Loss'}</Result>
              <div><Small>{new Date(h.createdAt).toLocaleDateString()} • {new Date(h.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Small></div>
              <div>{h.delta>0?`+${h.delta}`:h.delta} 🏆</div>
            </Item>
          ))}
        </HistoryList>
      )}
    </Card>
  );
}
