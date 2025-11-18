import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

/* Fixed to viewport; adds bottom inset only on mobile for the bottom navbar */
const Wrap = styled.main`
  position: fixed;
  top: var(--nav-height, 64px);  /* top app bar height (desktop/tablet) */
  right: 0;
  left: 0;
  bottom: 0;
  padding: clamp(12px, 2.5vw, 28px);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;

  /* Reserve space for the bottom navbar on mobile layouts */
  @media (max-width: 768px) {
    bottom: calc(var(--mobile-nav-height, 64px) + env(safe-area-inset-bottom));
    /* iOS 12 fallback */
    padding-bottom: calc(clamp(12px, 2.5vw, 28px) + constant(safe-area-inset-bottom));
    padding-bottom: calc(clamp(12px, 2.5vw, 28px) + env(safe-area-inset-bottom));
  }
`;

/* Full-height card with inner padding so tiles never touch edges or hang off */
const Card = styled.section`
  height: 100%;
  width: min(1200px, 100%);
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  box-shadow: 0 28px 64px rgba(0,0,0,0.55);
  padding: clamp(16px, 2.4vw, 28px);
  display: grid;
  grid-template-rows: auto 1fr;
  gap: clamp(14px, 2vw, 22px);
  text-align: center;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;                 /* for accent overlay */
}
&:before{
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  border-radius: 20px;
  /* faint spacey accent inside the card */
  background:
    radial-gradient(600px 200px at 15% 0%, rgba(139,123,255,0.10), transparent 60%),
    radial-gradient(600px 220px at 85% 100%, rgba(89,208,255,0.10), transparent 60%);
}
`;

/* Bigger, 3D-looking title */
const Title = styled.h1`
  margin: 0;
  text-align: center;
  font-weight: 900;
  font-size: clamp(30px, 4.5vw, 48px);
  letter-spacing: 0.3px;
  background: linear-gradient(90deg, var(--primary-orange), #59D0FF);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 8px 22px rgba(0,0,0,0.45);
`;

const Grid = styled.div`
  height: 100%;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: clamp(14px, 2vw, 22px);
  padding: clamp(8px, 1.6vw, 16px);
  box-sizing: border-box;
`;

const Tile = styled(Link)`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: var(--text-color);
  border-radius: 16px;
  background: var(--container-white);
  border: 1px solid var(--border-color);
  padding: clamp(12px, 1.8vw, 20px);
  box-shadow: 0 14px 32px rgba(0,0,0,0.35);
  transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease, opacity .12s ease;
  will-change: transform;
  overflow: hidden;
  isolation: isolate; /* ensure overlay sits beneath content */

  /* subtle accent wash so tiles don't look flat */
  &:before{
    content:"";
    position:absolute;
    inset:0;
    border-radius: 16px;
    pointer-events:none;
    z-index:-1;
    background:
      radial-gradient(500px 160px at 0% 0%, rgba(139,123,255,0.10), transparent 60%),
      radial-gradient(480px 160px at 100% 100%, rgba(89,208,255,0.10), transparent 60%);
    opacity:.85;
  }
 
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 22px 48px rgba(0,0,0,0.55);
    border-color: rgba(139,123,255,0.45); 
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 10px 20px rgba(0,0,0,0.35);
  }

  &:focus-visible {
    outline: 3px solid var(--primary-orange);
    outline-offset: 2px;
  }
`;

const TileTitle = styled.div`
  text-align: center;
  font-weight: 900;
  font-size: clamp(16px, 2.1vw, 22px);
  margin-bottom: 6px;
  color: var(--text-color);
  text-shadow: 0 10px 24px rgba(0,0,0,0.35);
`;

const TileSubtitle = styled.div`
  text-align: center;
  font-size: clamp(12px, 1.6vw, 16px);
  color: rgba(230,233,255,0.75);
`;

export default function AI() {
  return (
    <Wrap>
      <Card>
        <Title>Welcome to Student tools</Title>
        <Grid>
          <Tile to="/ai/noted">
            <TileTitle>Noted.Ai</TileTitle>
            <TileSubtitle>Convert files to notes</TileSubtitle>
          </Tile>
          <Tile to="/ai/draftly">
            <TileTitle>Draftly.Ai</TileTitle>
            <TileSubtitle>Essay editing</TileSubtitle>
          </Tile>
          <Tile to="/ai/citelab">
            <TileTitle>CiteLab</TileTitle>
            <TileSubtitle>Create & edit citations</TileSubtitle>
          </Tile>
          <Tile to="/ai/resumate">
            <TileTitle>Resumate</TileTitle>
            <TileSubtitle>Resumes & cover letters</TileSubtitle>
          </Tile>
        </Grid>
      </Card>
    </Wrap>
  );
}
