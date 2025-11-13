import React, { useMemo, useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import schools from '../../data/universities.json';

const Page = styled.div`
  /* Lock to the viewport and prevent page scrolling */
  height: 100dvh; /* modern viewport unit */
  height: 100svh; /* Safari fallback */
  overflow: hidden;

  display: grid;
  place-items: center;
  padding: 24px 16px;

  /* Brand background (adjust as you like) */
  background: linear-gradient(135deg, #f59e0b 0%, #1d4ed8 100%);
`;

const Card = styled.div`
  width: min(880px, 92vw);
  height: clamp(520px, 80dvh, 720px); /* fixed card height so only list can scroll */
  display: flex;
  flex-direction: column;
  gap: 8px;

  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 22px;
  box-shadow: 0 10px 24px rgba(0,0,0,0.08);
`;

const Title = styled.h1`
  margin: 0 0 6px;
  font-size: 28px;
  color: #111827; /* readable dark header */
  letter-spacing: -0.02em;
`;

const Sub = styled.p`
  margin: 0 0 10px;
  color: #6b7280;
`;

const SearchRow = styled.div`
  display: flex;
  gap: 12px;
  margin: 12px 0 6px;
`;

const SearchInput = styled.input`
  flex: 1 1 auto;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 16px;
  outline: none;
  transition: border-color .15s ease;
  &:focus { border-color: #d1d5db; }
`;

const ListWrap = styled.div`
  /* Make this the ONLY scrollable area */
  flex: 1 1 auto;
  min-height: 0; /* required for flex children to allow overflow scroll */
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
`;

const Item = styled.button`
  width: 100%;
  text-align: left;
  padding: 12px 14px;
  border: none;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  background: #fff;
  cursor: pointer;
  &:hover { background: #fff7ed; }
  &:last-child { border-bottom: none; }
`;

const Domain = styled.span`
  display: inline-block;
  font-size: 12px;
  color: #6b7280;
  margin-left: 8px;
`;

export default function UniversitySelect() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [ready, setReady] = useState(false);

  // Prevent page (document) scrolling while this screen is mounted
  useEffect(() => {
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = previous; };
  }, []);

  // If already verified previously, skip this screen
  useEffect(() => {
    const verified = localStorage.getItem('educonnect_verified') === '1';
    const school = safeParse(localStorage.getItem('educonnect_school'));
    if (verified && school?.slug) {
      navigate('/login', { replace: true });
    } else {
      setReady(true);
    }
  }, [navigate]);

  const results = useMemo(() => {
    const s = (q || '').trim().toLowerCase();
    if (!s) return schools;
    return schools.filter(
      (u) => u.name.toLowerCase().includes(s) || u.slug.includes(s)
    );
  }, [q]);

  function onSelect(u) {
    localStorage.setItem('educonnect_school', JSON.stringify(u));
    navigate(`/edu/verify?slug=${encodeURIComponent(u.slug)}`);
  }

  if (!ready) return null;

  return (
    <Page>
      <Card>
        <Title>Welcome to EduConnect</Title>
        <Sub>Select your university to continue.</Sub>

        <SearchRow>
          <SearchInput
            type="search"
            placeholder="Search your university (e.g., Fullerton, UCLA, Texas)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </SearchRow>

        <ListWrap>
          {results.map((u) => (
            <Item key={u.id} onClick={() => onSelect(u)}>
              {u.name}
              {!!u.domains?.length && (
                <Domain>email domain: @{u.domains[0]}</Domain>
              )}
            </Item>
          ))}
        </ListWrap>
      </Card>
    </Page>
  );
}

function safeParse(s) {
  try { return JSON.parse(s || ''); } catch { return null; }
}
