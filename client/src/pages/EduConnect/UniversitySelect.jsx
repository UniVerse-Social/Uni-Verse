import React, { useMemo, useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import schools from '../../data/universities.json';

const Page = styled.div`
  min-height: 100dvh;
  display: grid;
  place-items: center;
  gap: 10px;
  padding: 24px 16px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 28px;
  letter-spacing: -0.02em;
  color: var(--text-color);
`;

const Sub = styled.p`
  margin: 0 0 6px;
  opacity: 0.85;
  color: var(--text-color);
`;

const Card = styled.div`
  width: min(560px, 92vw);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border-radius: 16px;
  background: var(--container-white);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  box-shadow: 0 10px 24px rgba(0,0,0,0.12);
`;

const Search = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: transparent;
  color: var(--text-color);
  font-size: 16px;
  outline: none;
`;

const List = styled.div`
  max-height: 340px;
  overflow: auto;
  border: 1px solid var(--border-color);
  border-radius: 12px;
`;

const Item = styled.button`
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  background: transparent;
  color: var(--text-color);
  cursor: pointer;
  &:hover { background: rgba(0,0,0,0.04); }
  &:last-child { border-bottom: 0; }
`;

const Domain = styled.span`
  font-size: 12px;
  opacity: 0.7;
  margin-left: 8px;
`;

export default function UniversitySelect() {
  const nav = useNavigate();
  const [q, setQ] = useState('');

  useEffect(() => {
    // prevent body scroll bounce while the list is open
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = prev; };
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return schools;
    return schools.filter(u =>
      u.name.toLowerCase().includes(s) || u.slug.includes(s)
    );
  }, [q]);

  function onSelect(u) {
    localStorage.setItem('educonnect_school', JSON.stringify(u));
    // 🚀 new flow: go straight to login; email verify later in signup
    nav('/login');
  }

  return (
    <Page>
      <div style={{width:'min(560px, 92vw)'}}>
        <Title>Welcome to UniVerse</Title>
        <Sub>Select your university to continue.</Sub>
      </div>

      <Card className="surface">
        <Search
          type="search"
          placeholder="Search your university (e.g., Fullerton, UCLA, Texas)…"
          value={q}
          onChange={e => setQ(e.target.value)}
          autoFocus
        />
        <List>
          {results.map(u => (
            <Item key={u.id} onClick={() => onSelect(u)}>
              {u.name}
              {!!u.domains?.length && <Domain>@{u.domains[0]}</Domain>}
            </Item>
          ))}
        </List>
      </Card>
    </Page>
  );
}
