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
  background: var(--container-white, #fff);
  border: 1px solid var(--border-color, #e6e6e6);
  border-radius: 20px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.08);
  padding: clamp(16px, 2.4vw, 28px);
  display: grid;
  grid-template-rows: auto 1fr;
  gap: clamp(14px, 2vw, 22px);
  text-align: center;
  box-sizing: border-box;
  overflow: hidden;
`;

/* Bigger, 3D-looking title */
const Title = styled.h1`
  margin: 0;
  text-align: center;
  font-weight: 900;
  font-size: clamp(30px, 4.5vw, 48px);
  letter-spacing: 0.3px;
  color: #111;
  text-shadow:
    0 2px 0 rgba(0,0,0,0.18),
    0 8px 18px rgba(0,0,0,0.18),
    0 -1px 0 rgba(255,255,255,0.65);
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
  color: #111;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #e6e6e6;
  padding: clamp(12px, 1.8vw, 20px);
  box-shadow:
    0 14px 28px rgba(0,0,0,0.10),
    0 2px 0 rgba(255,255,255,0.85) inset,
    0 0 0 1px rgba(255,255,255,0.6) inset;
  transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
  will-change: transform;
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 18px 32px rgba(0,0,0,0.12),
      0 2px 0 rgba(255,255,255,0.9) inset,
      0 0 0 1px rgba(255,255,255,0.65) inset;
  }

  &:active {
    transform: translateY(0);
    box-shadow:
      0 10px 20px rgba(0,0,0,0.10),
      0 1px 0 rgba(255,255,255,0.8) inset,
      0 0 0 1px rgba(255,255,255,0.55) inset;
  }

  &:focus-visible {
    outline: 3px solid #0d2d7d;
    outline-offset: 2px;
  }
`;

const TileTitle = styled.div`
  text-align: center;
  font-weight: 900;
  font-size: clamp(16px, 2.1vw, 22px);
  margin-bottom: 6px;
  text-shadow:
    0 2px 0 rgba(0,0,0,0.15),
    0 8px 16px rgba(0,0,0,0.12);
`;

const TileSubtitle = styled.div`
  text-align: center;
  font-size: clamp(12px, 1.6vw, 16px);
  opacity: 0.9;
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
