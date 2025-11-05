// src/pages/TitanTap.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  GAME_KEYS,
  getCurrentUserId,
  getCurrentUserProfile,
  api,
  pickActivePreset,
  findLayout,
  alignModulesWithLayout,
  createBioFallbackPreset,
  getLayoutColumns,
  PROFILE_MODULE_TYPES,
} from '../utils/titantap-utils';
import { SwipeableCard } from '../components/TitanTapCard';
import UserLink from '../components/UserLink';
import { getHobbyEmoji } from '../utils/hobbies';
import { DEFAULT_BANNER_URL } from '../config';

// ---------- Minimal styles (same as your original, kept inline) ----------
const styles = `
:root { --nav-mobile: 58px; --topbar-mobile: 56px; }

*, *::before, *::after { box-sizing: border-box; }
html, body { width: 100%; min-width: 0; overflow-x: hidden; }
html, body { height: 100%; }
body.no-scroll { overflow: hidden; overscroll-behavior: none; touch-action: none; }

.titantap-viewport {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100dvh; /* avoids mobile URL-bar jumps */
  overflow: hidden; /* no page scroll */
}
.titantap-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  min-height: calc(100vh - 101px);
}

/* Mobile/tablet: account for the fixed bottom nav and the small top bar */
@media (max-width: 600px) {
  .titantap-page {
    padding: 12px 12px calc(16px + var(--nav-mobile) + env(safe-area-inset-bottom, 0px));
    min-height: calc(100vh - var(--topbar-mobile) - var(--nav-mobile) - env(safe-area-inset-bottom, 0px));
  }
}

.titantap-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.titantap-header h2 { margin: 0; color: white; }
.titantap-header input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e3e3e3;
  border-radius: 10px;
  font-size: 14px;
  flex: 1; /* keep left-aligned on desktop */
}
.titantap-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 0 0 auto;
}
.titantap-header .customize-trigger { flex: 0 0 auto; }
.titantap-header .tag-trigger { flex: 0 0 auto; }

/* Mobile: lay out title on its own row; input + tags on the next row */
@media (max-width: 768px) {
  .titantap-header {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "title actions"
      "input input";
    gap: 8px;
    align-items: center;
  }
  .titantap-header h2 { grid-area: title; font-size: 20px; }
  .titantap-header input { grid-area: input; }
  .titantap-header .titantap-actions {
    grid-area: actions;
    justify-self: flex-end;
  }
  .titantap-header .customize-trigger {
    font-size: 12px;
    padding: 6px 11px;
  }
  .titantap-header .tag-trigger {
    font-size: 12px;
    padding: 7px 11px;
  }
}

.note { text-align: center; padding: 16px 0; color: #666; }

/* Search results — centered, clamped to viewport */
.search-results {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  top: 120px;
  width: min(900px, calc(100vw - 32px));
  z-index: 1550;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 6px;
  max-height: 360px;
  overflow: auto;
  margin: 0;
  box-shadow: 0 18px 42px rgba(0,0,0,0.18);
}
@media (max-width: 768px) {
  .search-results {
    top: calc(var(--topbar-mobile) + 72px); /* below the small top bar + header */
    width: min(520px, calc(100vw - 24px));
    max-height: calc(
      100vh - var(--topbar-mobile) - 72px - var(--nav-mobile)
      - 24px - env(safe-area-inset-bottom, 0px)
    );
  }
}

.result-row { background: #fff; display: flex; align-items: center; gap: 12px; padding: 8px; border-bottom: 1px solid #f3f3f3; }
.result-row:last-child { border-bottom: none; }
.res-avatar { width: 44px; height: 44px; border-radius: 50%; background: #f0f0f0; display: grid; place-items: center; overflow: hidden; flex: 0 0 auto; }
.res-avatar img { width: 100%; height: 100%; object-fit: cover; }
.res-name { color: #111; font-weight: 600;}
.res-sub { font-size: 12px; color: #111; margin-top: 2px; }
.chips { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: #f4f6f8; border: 1px solid #e5e8eb; padding: 4px 8px; border-radius: 999px; font-size: 12px; }
.chip .chip-emoji { margin-right: 4px; font-size: 13px; display: inline-block; }

/* --- badges row on the card --- */
.badges { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
.badge { background: #f3f4f6; border: 1px solid #e5e8eb; padding: 3px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #111; }
.badge.title { background: #111; color: #fff; border-color: #111; }

/* Deck & cards — responsive height/width */
.deck {
  position: relative;
  height: clamp(520px, calc(100vh - 200px), 600px);
  margin: 20px auto 0;
  width: min(520px, calc(100vw - 32px));
  perspective: 10px;
  padding: 0 8px; /* keep edges off the screen on phones */
}

@media (max-width: 600px) {
  .deck {
    margin-top: 10px;      /* was 20px */
  }
}

.card-wrap {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  touch-action: none;
  width: min(520px, calc(100vw - 32px));
  max-width: 520px;
  top: 0;
}
.card {
  width: 100%;
  max-width: 520px;
  height: clamp(520px, calc(100vh - 220px), 580px);
  border-radius: 22px;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(150deg, rgba(255,255,255,0.95), rgba(248,250,255,0.82));
  border: 1px solid rgba(15,23,42,0.08);
  box-shadow: 0 28px 48px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(8px);
}
.card-banner {
  position: relative;
  height: 150px;
  background-size: cover;
  background-position: center;
  overflow: hidden;
}
.card-banner::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.18) 55%, rgba(15,23,42,0) 85%);
  mix-blend-mode: multiply;
  pointer-events: none;
}
.card-banner::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 68%;
  background: linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.65) 60%, rgba(255,255,255,0.92) 100%);
  pointer-events: none;
  z-index: 1;
}
.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 18px 20px 16px;
  gap: 14px;
  position: relative;
  z-index: 1;
  background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.98) 45%, rgba(255,255,255,1) 100%);
  --card-title-badge-font: 11px;
  --card-title-badge-padding-x: 10px;
  --card-title-badge-letter-spacing: 0.02em;
  --card-badge-font: 12px;
  --card-badge-padding-y: 4px;
  --card-badge-padding-x: 10px;
  --interest-dot-size: 36px;
  --interest-dot-font: 20px;
  --interest-dot-padding-left: 2px;
}
.card-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: -70px;
  margin-left: auto;
  margin-right: auto;
  padding: 12px clamp(16px, 1.5vw + 12px, 20px);
  width: min(100%, clamp(280px, 95%, 480px));
  max-width: min(100%, 480px);
  align-self: center;
  background: rgba(255,255,255,0.82);
  border-radius: 20px;
  border: 1px solid rgba(148,163,184,0.22);
  box-shadow: 0 12px 24px rgba(15,23,42,0.15), 0 4px 8px rgba(37,99,235,0.1);
  position: relative;
  z-index: 2;
}
@media (max-width: 600px) {
  .card-banner {
    height: 138px;
  }
  .card-body {
    padding: 16px 16px 14px;
    gap: 8px;
    --card-title-badge-font: 8.8px;
    --card-title-badge-padding-x: 8px;
    --card-title-badge-letter-spacing: 0.04em;
    --card-badge-font: 9.6px;
    --card-badge-padding-y: 3.2px;
    --card-badge-padding-x: 8px;
    --interest-dot-size: 24px;
    --interest-dot-font: 16px;
    --interest-dot-padding-left: 0px;
  }
  .card-hero {
    margin-top: -88px;
    width: min(100%, clamp(240px, 92%, 420px));
    padding: 10px clamp(14px, 4vw, 16px);
    gap: 12px;
  }
  .card-avatar {
    width: 74px;
    height: 74px;
    border-radius: 22px;
  }
  .card-hero-info {
    gap: 4px;
  }
  .card-name-row {
    gap: 6px;
  }
  .card-name {
    font-size: 18px;
  }
  .card-pronouns {
    font-size: 11px;
    padding: 2px 7px;
  }
  .card-title-badge {
    font-size: 7px;
    padding: 2px 5px;
    letter-spacing: 0.05em;
  }
  .card-meta {
    gap: 6px;
  }
  .meta-chip {
    padding: 3px 6px;
    border-radius: 9px;
    font-size: 10px;
  }
  .meta-chip span.emoji {
    font-size: 14px;
  }
  .card-badges {
    gap: 4px;
    flex-wrap: nowrap;
    overflow-x: auto;
    justify-content: flex-start;
  }
  .interest-cloud {
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-start;
    width: 100%;
    max-width: 100%;
  }
  .interest-dot.common {
    border-width: 1.5px;
  }
  .interest-cloud-shell {
    gap: 6px;
  }
  .card-canvas.double,
  .card-canvas.triple {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 390px) {
  .card-body {
    --card-title-badge-font: 7px;
    --card-title-badge-padding-x: 6.4px;
    --card-title-badge-letter-spacing: 0.03em;
    --card-badge-font: 7.7px;
    --card-badge-padding-y: 2.5px;
    --card-badge-padding-x: 6.4px;
    --interest-dot-size: 20px;
    --interest-dot-font: 14px;
  }
  .interest-cloud {
    gap: 4px;
  }
  .interest-dot.common {
    border-width: 1.2px;
  }
}

.card-avatar {
  width: 88px;
  height: 88px;
  border-radius: 26px;
  overflow: hidden;
  border: 3px solid transparent;
  box-shadow: 0 12px 25px rgba(15,23,42,0.35);
  background:
    linear-gradient(#eef2ff, #eef2ff) padding-box,
    linear-gradient(135deg, #2563eb, #f97316) border-box;
  flex: 0 0 auto;
}
.card-avatar img { width: 100%; height: 100%; object-fit: cover; }
.card-avatar.initials {
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 28px;
  color: #334155;
}

.card-hero-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.card-name-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}
.card-name {
  font-weight: 750;
  font-size: 20px;
  color: #0f172a;
}
.card-name a { color: inherit; text-decoration: none; }
.card-name a:hover { text-decoration: underline; }
.card-pronouns {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(79, 97, 255, 0.12);
  color: #3442c3;
}
.card-title-badge {
  font-size: var(--card-title-badge-font, 11px);
  font-weight: 700;
  padding: 2px var(--card-title-badge-padding-x, 10px);
  border-radius: 999px;
  background: #0f172a;
  color: #fff;
  letter-spacing: var(--card-title-badge-letter-spacing, 0.02em);
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.meta-chip {
  padding: 4px 7px;
  border-radius: 10px;
  font-size: 10.5px;
  font-weight: 600;
  background: rgba(245,246,248,0.92);
  border: 1px solid rgba(71,85,105,0.28);
  color: #1e293b;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  line-height: 1.15;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  appearance: none;
  font-family: inherit;
}
.meta-chip span.emoji {
  font-size: 15px;
}
.meta-chip.match {
  border: 2px solid #2563eb;
  background:
    linear-gradient(#f8fafc, #f8fafc) padding-box,
    linear-gradient(135deg, rgba(37,99,235,0.65), rgba(37,99,235,0.15)) border-box;
  box-shadow: 0 10px 24px rgba(37,99,235,0.22);
  color: #1d4ed8;
}
.meta-chip:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.meta-chip-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid rgba(148,163,184,0.35);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
.meta-chip-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.card-badge {
  background: rgba(15,23,42,0.08);
  border: 1px solid rgba(148,163,184,0.45);
  padding: var(--card-badge-padding-y, 4px) var(--card-badge-padding-x, 10px);
  border-radius: 999px;
  font-size: var(--card-badge-font, 12px);
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  transition: font-size 0.18s ease, padding 0.18s ease;
}
.card-badge.lead {
  background: #0f172a;
  color: #fff;
  border-color: #0f172a;
}

.bio-snippet {
  font-size: 14px;
  line-height: 1.5;
  color: #334155;
  max-height: 60px;
  overflow: hidden;
  padding-right: 4px;
}

.interest-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 2px;
}
.interest-dot {
  width: var(--interest-dot-size, 36px);
  height: var(--interest-dot-size, 36px);
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(241,245,249,0.92);
  border: 1px solid rgba(148,163,184,0.45);
  font-size: var(--interest-dot-font, 20px);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border 0.18s ease;
  padding-left: var(--interest-dot-padding-left, 2px);
  padding-top: 0;
}
.interest-dot:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.interest-dot:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 10px 20px rgba(15,23,42,0.15);
}
.interest-dot.common {
  border: 2px solid #2563eb;
  background: linear-gradient(135deg, rgba(219,234,254,0.9), rgba(255,255,255,0.98));
  box-shadow: 0 10px 20px rgba(37,99,235,0.24);
}
.interest-cloud-shell {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
}
.interest-cloud {
  flex: 1 1 auto;
  min-width: 0;
  justify-content: flex-start;
  padding-right: 12px;
  overflow: visible;
}
.interest-cloud.carousel {
  flex-wrap: nowrap;
}
.interest-cloud-arrow {
  display: none;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid rgba(148,163,184,0.32);
  background: rgba(148,163,184,0.18);
  color: #1f2937;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}
.interest-cloud-arrow:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.interest-cloud-arrow:hover {
  background: rgba(148,163,184,0.22);
  border-color: rgba(148,163,184,0.42);
  color: #1f2937;
  transform: translateX(1px);
}
.interest-cloud.swipe-animate {
  animation: interest-cloud-swipe 0.22s ease;
}
@keyframes interest-cloud-swipe {
  0% {
    transform: translateX(0);
    opacity: 1;
  }
  45% {
    transform: translateX(-10px);
    opacity: 0.8;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

/* canvas shell (shared) */
.card-canvas-shell {
  position: relative;
  border-radius: 22px;
  transition: transform 0.18s ease;
}
.card-canvas-shell .card-canvas {
  position: relative;
  z-index: 2;
}
.card-canvas-shell.editable {
  cursor: pointer;
}
.card-canvas-shell.editable:focus-visible {
  outline: none;
}

/* outer/bulge layer */
.card-canvas-shell::before {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: 26px;
  background: transparent;
  border: 1px solid transparent;
  opacity: 0;
  transition: background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, opacity 0.22s ease;
  pointer-events: none;
  z-index: 1;
}

/* we DON'T want any dotted inner line, so no ::after */

/* normal hover */
.card-canvas-shell.editable:hover::before,
.card-canvas-shell.editable:focus-visible::before,
.card-canvas-shell.layout-open::before {
  background: linear-gradient(160deg, rgba(248,250,255,0.95), rgba(226,232,240,0.85));
  border-color: rgba(148,163,184,0.35);
  box-shadow: 0 16px 32px rgba(37,99,235,0.12);
  opacity: 1;
}

.canvas-layout-hint {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(30,41,59,0.78);
  background: rgba(248,250,255,0.96);
  border: 1px solid rgba(148,163,184,0.3);
  border-radius: 999px;
  padding: 4px 12px;
  box-shadow: 0 6px 14px rgba(15,23,42,0.12);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 3;
}
.card-canvas-shell.editable:hover .canvas-layout-hint,
.card-canvas-shell.editable:focus-visible .canvas-layout-hint {
  opacity: 1;
}
.card-canvas-shell.layout-open .canvas-layout-hint {
  opacity: 0;
}

.canvas-layout-menu {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 220px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255,255,255,0.98);
  border: 1px solid rgba(148,163,184,0.32);
  box-shadow: 0 18px 40px rgba(15,23,42,0.18);
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 20;
}
.canvas-layout-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #475569;
}
.canvas-layout-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.canvas-layout-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: 1px solid rgba(148,163,184,0.35);
  border-radius: 12px;
  padding: 8px 12px;
  background: rgba(248,250,255,0.85);
  color: #0f172a;
  font-size: 13px;
  font-weight: 600;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}
.canvas-layout-option:hover,
.canvas-layout-option:focus-visible {
  border-color: rgba(37,99,235,0.6);
  background: rgba(219,234,254,0.92);
  outline: none;
  box-shadow: 0 10px 24px rgba(37,99,235,0.16);
}
.canvas-layout-option.active {
  border-color: #2563eb;
  background: rgba(219,234,254,0.98);
  box-shadow: 0 12px 28px rgba(37,99,235,0.2);
}
.canvas-layout-option .check {
  margin-left: 10px;
  font-size: 14px;
  color: #2563eb;
}

.card-canvas-placeholder {
  margin-top: 14px;
  padding: 24px;
  border-radius: 18px;
  border: 1px dashed rgba(148,163,184,0.5);
  background: rgba(255,255,255,0.85);
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 140px;
  position: relative;
}
.card-canvas-placeholder strong {
  color: #2563eb;
}
.card-canvas-shell.placeholder .canvas-layout-hint {
  opacity: 1;
  top: -30px;
}

.canvas-resize-handle {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(37,99,235,0.85), rgba(59,130,246,0.85));
  border: 1px solid rgba(37,99,235,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  cursor: se-resize;
  box-shadow: 0 8px 18px rgba(37,99,235,0.25);
}
.canvas-resize-handle:focus-visible {
  outline: 2px solid #1d4ed8;
  outline-offset: 2px;
}
.card-canvas {
  margin-top: 0;
  padding: 6px;
  border-radius: 18px;
  border: 1px solid rgba(148,163,184,0.25);
  background: linear-gradient(160deg, rgba(248,250,255,0.95), rgba(226,232,240,0.85));
  display: grid;
  gap: 6px;
}

.card-canvas.single {
  grid-template-columns: 1fr;
}
.card-canvas.double {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.card-canvas.triple {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}


/* global hover: hide inner border, show shadow */
.card-canvas-shell.editable:hover .card-canvas,
.card-canvas-shell.editable:focus-visible .card-canvas,
.card-canvas-shell.layout-open .card-canvas {
  border-color: transparent;
  box-shadow: 0 18px 36px rgba(15,23,42,0.12);
}

.card-wrap.preview .card-canvas-shell.editable:hover .card-canvas,
.card-wrap.preview .card-canvas-shell.editable:focus-visible .card-canvas,
.card-wrap.preview .card-canvas-shell.layout-open .card-canvas {
  border: 1px solid transparent;  /* keep size, hide line */
  background: transparent;
  box-shadow: none;               /* shadow lives on ::before */
}


.card-wrap.preview .card-canvas-shell.editable:hover::before,
.card-wrap.preview .card-canvas-shell.editable:focus-visible::before,
.card-wrap.preview .card-canvas-shell.layout-open::before {
  background: linear-gradient(160deg, rgba(248,250,255,0.95), rgba(226,232,240,0.85));
  border-color: rgba(148,163,184,0.35);
  box-shadow: 0 18px 36px rgba(15,23,42,0.12);
  opacity: 1;
}
.card-canvas-item.image {
  padding: 0;
  border: none;
  border-radius: 12px;
  background: transparent;
  min-height: 130px;
}
.card-canvas-item h5 {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #475569;
}
.card-canvas-item p {
  margin: 0;
  font-size: 13px;
  color: #1f2937;
  line-height: 1.45;
  word-break: break-word;
}
.card-canvas-item .image-wrapper {
  position: relative;
  width: 100%;
  padding-bottom: 62%;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(15,23,42,0.08);
}
.card-canvas-item .image-wrapper img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.card-canvas-item .image-wrapper.full {
  padding-bottom: 0;
  height: 100%;
  min-height: 130px;
  border-radius: 12px;
  background: transparent;
}
.card-canvas-item .caption {
  font-size: 12px;
  color: #475569;
}
.card-canvas-empty {
  font-size: 12px;
  color: #94a3b8;
}
.tooltip-bubble {
  position: fixed;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 12px));
  padding: 8px 12px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
  background: rgba(255,255,255,0.96);
  border: 1px solid rgba(71,85,105,0.28);
  box-shadow: 0 14px 26px rgba(15,23,42,0.18);
  max-width: 260px;
  text-align: center;
  z-index: 4000;
  white-space: normal;
  line-height: 1.35;
}
.tooltip-bubble.align-left {
  transform: translate(0, calc(-100% - 12px));
}
.tooltip-bubble.align-right {
  transform: translate(-100%, calc(-100% - 12px));
}
.tooltip-bubble.mutual {
  border-color: #2563eb;
  background: linear-gradient(135deg, rgba(219,234,254,0.95), rgba(255,255,255,0.94));
  color: #1d4ed8;
  box-shadow: 0 16px 28px rgba(37,99,235,0.22);
}
.mutual-count {
  margin-top: 12px;
  font-size: 12px;
  color: #111827;
  font-weight: 600;
}
.mutual-count strong {
  color: inherit;
}
.card-footer {
  margin-top: auto;
  color: #64748b;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.card-footer strong { color: #c2410c; font-weight: 700; }
@media (max-width: 768px) {
  .deck {
    /* viewport minus header/search/buttons and mobile nav */
    height: clamp(
      500px,
      calc(
        100vh - var(--topbar-mobile) - 180px - var(--nav-mobile)
        - env(safe-area-inset-bottom, 0px)
      ),
      580px
    );
  }
  .card {
    /* never exceed viewport; still looks like the desktop card */
    height: clamp(
      500px,
      calc(
        100vh - var(--topbar-mobile) - 220px - var(--nav-mobile)
        - env(safe-area-inset-bottom, 0px)
      ),
      560px
    );
  }
}


.controls {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
  margin-left: auto;
  margin-right: auto;
  width: min(520px, calc(100vw - 32px));
}
.controls button { padding: 10px 16px; border-radius: 999px; border: 1px solid #111; background: #fff; color: #111; cursor: pointer; }
.controls .ghost { background: #fff; color: #111; }

.controls-compact {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.92);
  color: #fff;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.26);
  z-index: 2100;
}
.controls-compact button {
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  background: transparent;
  color: #fff;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.controls-compact button.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.32);
}

/* Mobile: ensure controls never sit under the fixed nav */
@media (max-width: 600px) {
  .controls { padding-bottom: calc(8px + var(--nav-mobile) + env(safe-area-inset-bottom, 0px)); }
  .controls-compact {
    bottom: calc(var(--nav-mobile) + env(safe-area-inset-bottom, 0px) + 8px);
  }
}

.customize-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.12);
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.18s ease;
}
.customize-trigger .icon {
  font-size: 16px;
  line-height: 1;
}
.customize-trigger:hover {
  background: rgba(255,255,255,0.2);
  transform: translateY(-1px);
}
.customize-trigger:active {
  transform: translateY(0);
}
.customize-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.profile-card-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15,23,42,0.52);
  z-index: 2500;
}
.profile-card-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(880px, calc(100vw - 24px));
  max-height: min(88vh, 720px);
  background: linear-gradient(160deg, rgba(248,250,255,0.98), rgba(237,242,255,0.94));
  border: 1px solid rgba(148,163,184,0.32);
  box-shadow: 0 30px 60px rgba(15,23,42,0.24);
  border-radius: 22px;
  z-index: 2550;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sticker-dock-placeholder {
  position: absolute;
  top: 18px;
  right: 26px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(37,99,235,0.12);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
  z-index: 1;
}
.profile-card-modal header {
  padding: 18px 24px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.profile-card-modal header h3 {
  margin: 0;
  font-size: 20px;
  color: #0f172a;
}
.profile-card-modal header button.close {
  border: none;
  background: transparent;
  color: #475569;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  transition: color 0.2s ease;
}
.profile-card-modal header button.close:hover {
  color: #0f172a;
}
.customize-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 24px 16px;
  overflow: hidden;
  align-items: center;
  width: 100%;
}
.customize-body > .module-hint[role="alert"] {
  align-self: stretch;
  text-align: center;
}
.customize-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 8px;
  flex-wrap: wrap;
}
.customize-field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.customize-field-group label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #475569;
}
.customize-select {
  width: 100%;
  min-height: 30px;
  border-radius: 10px;
  border: 1px solid rgba(148,163,184,0.45);
  background: rgba(255,255,255,0.9);
  color: #0f172a;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 10px;
  cursor: pointer;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, rgba(148,163,184,0.7) 50%), linear-gradient(135deg, rgba(148,163,184,0.7) 50%, transparent 50%);
  background-position: calc(100% - 14px) calc(50% + 2px), calc(100% - 9px) calc(50% + 2px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}
.customize-select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37,99,235,0.2);
}
.module-editor-tabs {
  display: flex;
  gap: 8px;
}
.module-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
  align-items: stretch;
  pointer-events: auto;
}
.card-canvas-item.editable.image .module-editor {
  margin-top: 6px;
}
.module-select-tab {
  border-radius: 12px 12px 0 0;
  border: 1px solid rgba(37,99,235,0.28);
  border-bottom: none;
  background: rgba(37,99,235,0.08);
  color: #1d4ed8;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  min-width: 0;
  width: fit-content;
  appearance: none;
  cursor: pointer;
}
.module-field.inline {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.module-textarea-wrapper {
  position: relative;
}
.module-field.inline textarea,
.module-field.inline input {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(148,163,184,0.45);
  padding: 10px 12px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  min-height: 104px;
  background: #fff;
}
.module-textarea-wrapper textarea {
  padding-bottom: 32px;
}
.module-field.inline textarea::placeholder {
  font-size: 11px;
  color: #94a3b8;
}
.module-char-count {
  position: absolute;
  bottom: 10px;
  right: 12px;
  font-size: 13px;
  color: #64748b;
}
.module-field.inline input {
  min-height: 0;
}
.module-placeholder {
  font-size: 12px;
  color: #94a3b8;
}
.module-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.module-field label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}
.module-field textarea,
.module-field input {
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(148,163,184,0.5);
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  min-height: 96px;
}
.module-hint {
  font-size: 11px;
  color: #64748b;
}
.customize-preview {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow: auto;
  padding-bottom: 12px;
  margin-top: 4px;
  position: relative;
  z-index: 10;
}
.customize-preview-card {
  width: min(440px, 100%);
}
.card-preview-shell {
  width: 100%;
  display: flex;
  justify-content: center;
  transform: scale(0.92);
  transform-origin: top center;
  position: relative;
  z-index: 10;
}
.card-wrap.preview {
  position: relative;
  left: auto;
  top: 0;
  transform: none;
  width: 100%;
  max-width: 440px;
  touch-action: pan-y;
  margin: 0 auto;
  z-index: 10;
}
.card-wrap.preview .card {
  height: auto;
  min-height: 420px;
}
.card-wrap.preview .card-canvas {
  width: 100%;
}
.card-wrap.preview .card-canvas-item:not(.image),
.card-preview-shell .card-canvas-item:not(.image),
.card-canvas-shell .card-canvas-item:not(.image),
.card .card-canvas-item:not(.image) {
  border: 1px solid rgba(148,163,184,0.48);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 26px rgba(15,23,42,0.12);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 130px;
}
.card-wrap.preview .card-canvas-item.editable:not(.image):hover,
.card-preview-shell .card-canvas-item.editable:not(.image):hover,
.card-canvas-shell .card-canvas-item.editable:not(.image):hover,
.card .card-canvas-item.editable:not(.image):hover {
  border-color: rgba(37,99,235,0.45);
  box-shadow: 0 10px 22px rgba(37,99,235,0.14);
}
.card-wrap.preview .card-canvas-item.editable:not(.image).active,
.card-preview-shell .card-canvas-item.editable:not(.image).active,
.card-canvas-shell .card-canvas-item.editable:not(.image).active,
.card .card-canvas-item.editable:not(.image).active {
  border-color: #2563eb;
  box-shadow: 0 16px 30px rgba(37,99,235,0.2);
}
.card-wrap.preview .card-canvas-item:not(.image) .module-preview,
.card-preview-shell .card-canvas-item:not(.image) .module-preview,
.card-canvas-shell .card-canvas-item:not(.image) .module-preview,
.card .card-canvas-item:not(.image) .module-preview {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  justify-content: flex-start;
  border-radius: inherit;
  background: transparent;
}
.card-wrap.preview button {
  pointer-events: none;
}
.card-wrap.preview .canvas-layout-menu button {
  pointer-events: auto;
}
.card-wrap.preview a {
  pointer-events: none;
}
@media (min-width: 900px) {
  .profile-card-modal {
    padding-top: 44px;
  }
  .profile-card-modal header {
    position: absolute;
    top: 8px;
    left: 36px;
    right: 36px;
    padding: 0;
    margin: 0;
    gap: 12px;
    z-index: 5;
  }
  .profile-card-modal header h3 {
    font-size: 22px;
  }
  .profile-card-modal header button.close {
    font-size: 26px;
  }
  .customize-body {
    padding: 0 32px 24px;
    align-items: center;
  }
  .customize-preview {
    margin-top: 0;
    padding-bottom: 18px;
    justify-content: center;
  }
}
.customize-footer {
  border-top: 1px solid rgba(148,163,184,0.16);
  padding: 10px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background: rgba(248,250,255,0.96);
}
.customize-footer button {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(148,163,184,0.6);
  background: #fff;
  color: #0f172a;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.customize-footer button.save {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
  box-shadow: 0 10px 24px rgba(37,99,235,0.24);
}
.customize-footer button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}
.customize-status {
  font-size: 12px;
  color: #1f2937;
  margin-right: auto;
  align-self: center;
  min-height: 18px;
}
.customize-spinner {
  display: grid;
  place-items: center;
  font-size: 14px;
  color: #475569;
  height: 220px;
}

@media (max-width: 900px) {
  .profile-card-modal {
    width: min(96vw, 760px);
  }
  .customize-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .card-preview-shell {
    transform: scale(0.9);
  }
}

@media (max-width: 768px) {
  .customize-trigger {
    justify-content: center;
    padding: 8px 10px;
  }
  .profile-card-modal {
    width: min(96vw, 680px);
    max-height: 92vh;
  }
  .sticker-dock-placeholder {
    right: 20px;
    top: 16px;
  }
  .card-preview-shell {
    transform: scale(0.88);
  }
}

@media (max-width: 600px) {
  .profile-card-modal {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .profile-card-modal header {
    padding: 16px 18px 10px;
  }
  .customize-body {
    padding: 0 18px 18px;
    gap: 18px;
  }
  .customize-footer {
    padding: 14px 18px;
  }
  .sticker-dock-placeholder {
    top: 14px;
    right: 18px;
  }
  .card-preview-shell {
    transform: scale(0.84);
  }
}

.tag-trigger {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.12);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.2s ease;
}
.tag-trigger:hover { background: rgba(255,255,255,0.2); }
.tag-active-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.tag-chip-active { display: inline-flex; align-items: center; gap: 6px; background: #2563eb; color: #fff; border: none; border-radius: 999px; padding: 4px 12px; font-size: 12px; cursor: pointer; box-shadow: 0 4px 10px rgba(37,99,235,0.28); }
.tag-chip-active span { font-weight: 600; }

/* Tag modal — center and clamp on mobile */
.tag-modal {
  position: fixed;
  top: 120px;
  right: 40px;
  width: 280px;
  max-width: 90vw;
  max-height: 70vh;
  overflow: auto;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  box-shadow: 0 18px 42px rgba(0,0,0,0.18);
  padding: 18px;
  z-index: 1600;
}
@media (max-width: 768px) {
  .tag-modal {
    left: 50%;
    transform: translateX(-50%);
    right: auto;
    top: calc(var(--topbar-mobile) + 8px);
    width: min(520px, calc(100vw - 24px));
    max-height: calc(
      100vh - var(--topbar-mobile) - 24px - var(--nav-mobile)
      - env(safe-area-inset-bottom, 0px)
    );
  }
}

@media (max-width: 375px) {
  .titantap-header {
    display: flex;
    align-items: center;
    gap: 5px;             /* balanced space between elements */
    margin-bottom: 6px;   /* slightly tightened but not cramped */
  }

  .titantap-header h2 {
    margin: 0;
    color: white;
    font-size: 0.88em;    /* modestly smaller title */
  }

  .titantap-header input {
    width: 100%;
    padding: 5px 7px;     /* smaller height, good visual balance */
    border: 1px solid #e3e3e3;
    border-radius: 6px;
    font-size: 12px;
    flex: 1;
  }

  .titantap-actions {
    display: flex;
    gap: 5px;             /* close but not cramped */
    align-items: center;
    flex: 0 0 auto;
  }

  .titantap-header .customize-trigger,
  .titantap-header .tag-trigger {
    flex: 0 0 auto;
    transform: scale(0.9); /* subtle shrink — keeps buttons crisp */
    padding: 4px 8px;      /* balanced inner spacing */
  }
}




.tag-modal header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.tag-modal h3 { margin: 0; font-size: 16px; color: #111827; }
.tag-modal button.close { border: none; background: transparent; font-size: 20px; line-height: 1; cursor: pointer; color: #6b7280; }
.tag-modal button.close:hover { color: #111827; }
.tag-error { color: #b91c1c; font-size: 12px; margin-bottom: 8px; }
.tag-section { margin-bottom: 14px; }
.tag-section h4 { margin: 0 0 6px; font-size: 13px; color: #374151; letter-spacing: 0.04em; text-transform: uppercase; }
.tag-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.tag-pill { padding: 6px 12px; border-radius: 999px; border: 1px solid #d1d5db; background: #f9fafb; color: #1f2937; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.18s ease; }
.tag-pill:hover { background: #e5edff; border-color: #bfdbfe; }
.tag-pill.active { background: #2563eb; border-color: #2563eb; color: #fff; box-shadow: 0 6px 16px rgba(37,99,235,0.28); }

.toast { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: #fff; color: #111; padding: 10px 14px; border-radius: 999px; }
`;

const TitanTap = () => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [justFollowed, setJustFollowed] = useState(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [activeTags, setActiveTags] = useState([]);
  const [tagData, setTagData] = useState({
    loaded: false,
    hobbies: [],
    departments: [],
    clubs: [],
    leaderboardMap: {},
  });
  const [tagLoading, setTagLoading] = useState(false);
  const [tagError, setTagError] = useState('');
  const [profileCardConfig, setProfileCardConfig] = useState(null);
  const [profileCardLoading, setProfileCardLoading] = useState(true);
  const [profileCardError, setProfileCardError] = useState('');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState(null);
  const [savingPreset, setSavingPreset] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const controlsRef = useRef(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isShortViewport, setIsShortViewport] = useState(false);
  const profileCardCacheRef = useRef(new Map());
  const inflightProfileCardsRef = useRef(new Set());
  const [, setProfileCardVersion] = useState(0);

  const userId = useMemo(() => getCurrentUserId(), []);
  const viewerProfile = useMemo(() => getCurrentUserProfile(), []);
  const clubDirectory = useMemo(() => {
    const entries = Array.isArray(tagData.clubs) ? tagData.clubs : [];
    const map = new Map();
    entries.forEach((club) => {
      if (club && club._id) {
        map.set(String(club._id), club);
      }
    });
    return map;
  }, [tagData.clubs]);
  const leaderboardMap = useMemo(
    () => tagData.leaderboardMap || {},
    [tagData.leaderboardMap]
  );
  const leaderboardSet = useMemo(
    () => new Set(Object.keys(leaderboardMap)),
    [leaderboardMap]
  );

  const ensureTagData = useCallback(async () => {
    if (tagData.loaded || tagLoading) return;
    setTagLoading(true);
    try {
      const [signupRes, clubsRes, leaderboardRes] = await Promise.all([
        api('/api/auth/signup-data'),
        api(`/api/clubs?viewer=${encodeURIComponent(userId || '')}`),
        Promise.all(
          GAME_KEYS.map((key) =>
            api(`/api/games/leaderboard/${key}?limit=50`).catch(() => ({
              leaders: [],
            }))
          )
        ),
      ]);

      const leaderboardRanks = new Map();
      leaderboardRes.forEach((entry) => {
        const leaders = Array.isArray(entry?.leaders) ? entry.leaders : [];
        leaders.forEach((leader, index) => {
          if (!leader?.userId) return;
          const key = String(leader.userId);
          const rank = index + 1;
          const existing = leaderboardRanks.get(key);
          if (!existing || rank < existing) {
            leaderboardRanks.set(key, rank);
          }
        });
      });

      setTagData({
        loaded: true,
        hobbies: Array.isArray(signupRes?.hobbies) ? signupRes.hobbies : [],
        departments: Array.isArray(signupRes?.departments)
          ? signupRes.departments
          : [],
        clubs: Array.isArray(clubsRes) ? clubsRes : [],
        leaderboardMap: Object.fromEntries(leaderboardRanks),
      });
      setTagError('');
    } catch (err) {
      setTagError(err?.message || 'Failed to load tag data');
    } finally {
      setTagLoading(false);
    }
  }, [tagData.loaded, tagLoading, userId]);

  // lock body scroll
  useEffect(() => {
    document.body.classList.add('no-scroll');
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlOB = document.documentElement.style.overscrollBehavior;
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    return () => {
      document.body.classList.remove('no-scroll');
      document.documentElement.style.overflow = prevHtmlOverflow || '';
      document.documentElement.style.overscrollBehavior = prevHtmlOB || '';
    };
  }, []);

  // track short viewport
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
      return;
    const mq = window.matchMedia('(max-height: 740px)');
    const update = () => setIsShortViewport(mq.matches);
    update();
    const handler = () => update();
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);

  // load suggestions
  useEffect(() => {
    (async () => {
      if (!userId) {
        setLoading(false);
        setError('Sign in required to load suggestions.');
        return;
      }
      try {
        setLoading(true);
        const data = await api(`/api/users/titantap/${userId}`);
        setDeck(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // load tag data if tag picker is open
  useEffect(() => {
    if (showTagPicker) ensureTagData();
  }, [showTagPicker, ensureTagData]);

  // load profile card config
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setProfileCardLoading(true);
    (async () => {
      try {
        const data = await api(`/api/profile-cards/${userId}`);
        if (!cancelled) {
          setProfileCardConfig(data);
          setProfileCardError('');
        }
      } catch (e) {
        if (!cancelled) {
          setProfileCardError(e?.message || 'Failed to load profile card');
        }
      } finally {
        if (!cancelled) setProfileCardLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // cache profile card
  useEffect(() => {
    if (!userId || !profileCardConfig) return;
    profileCardCacheRef.current.set(String(userId), profileCardConfig);
    setProfileCardVersion((v) => v + 1);
  }, [userId, profileCardConfig]);

  // search debounce
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const trimmed = query.trim();
        const hasText = trimmed.length > 0;
        const hasTags = activeTags.length > 0;
        if (!hasText && !hasTags) {
          setSearchResults([]);
          return;
        }
        const params = new URLSearchParams();
        if (hasText) params.set('q', trimmed);
        if (userId) params.set('userId', userId);
        if (hasTags)
          params.set(
            'tags',
            activeTags.map((tag) => tag.key).join(',')
          );
        const data = await api(`/api/users/search?${params.toString()}`);
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, userId, activeTags]);

  const isTagActive = useCallback(
    (key) => activeTags.some((tag) => tag.key === key),
    [activeTags]
  );

  const leaderboardTagActive = isTagActive('leaderboard');

  const sortByLeaderboardRank = useCallback(
    (list) => {
      if (!leaderboardTagActive) return list;
      const ranked = [...list].sort((a, b) => {
        const rankA = leaderboardMap[String(a?._id)] || Infinity;
        const rankB = leaderboardMap[String(b?._id)] || Infinity;
        return rankA - rankB;
      });
      return ranked;
    },
    [leaderboardTagActive, leaderboardMap]
  );

  const toggleTag = useCallback((tag) => {
    setActiveTags((prev) => {
      const exists = prev.some((t) => t.key === tag.key);
      return exists ? prev.filter((t) => t.key !== tag.key) : [...prev, tag];
    });
  }, []);

  const matchesAllTags = useCallback(
    (user) => {
      if (!activeTags.length) return true;
      const uid = String(user?._id || '');
      const userHobbies = Array.isArray(user?.hobbies) ? user.hobbies : [];
      const userClubs = Array.isArray(user?.clubs)
        ? user.clubs.map((c) => String(c))
        : [];
      const userDept = user?.department || '';

      return activeTags.every(({ key }) => {
        if (key === 'leaderboard') {
          return leaderboardSet.has(uid);
        }
        if (key.startsWith('hobby:')) {
          const hobby = key.slice('hobby:'.length);
          return userHobbies.includes(hobby);
        }
        if (key.startsWith('department:')) {
          const dept = key.slice('department:'.length);
          return userDept === dept;
        }
        if (key === 'club:any') {
          return userClubs.length > 0;
        }
        if (key.startsWith('club:')) {
          const clubId = key.slice('club:'.length);
          return userClubs.includes(clubId);
        }
        return true;
      });
    },
    [activeTags, leaderboardSet]
  );

  const queueProfileCardFetch = useCallback((targetUserId) => {
    if (!targetUserId) return;
    const key = String(targetUserId);
    if (
      profileCardCacheRef.current.has(key) ||
      inflightProfileCardsRef.current.has(key)
    )
      return;
    inflightProfileCardsRef.current.add(key);
    api(`/api/profile-cards/${key}`)
      .then((data) => {
        profileCardCacheRef.current.set(key, data);
      })
      .catch((e) => {
        console.warn('Profile card load failed:', e?.message || e);
        profileCardCacheRef.current.set(key, null);
      })
      .finally(() => {
        inflightProfileCardsRef.current.delete(key);
        setProfileCardVersion((v) => v + 1);
      });
  }, []);

  const filteredDeck = useMemo(() => {
    const base = !activeTags.length
      ? deck
      : deck.filter((user) => matchesAllTags(user));
    return sortByLeaderboardRank(base);
  }, [deck, activeTags, matchesAllTags, sortByLeaderboardRank]);

  // prefetch profiles for first few
  useEffect(() => {
    filteredDeck.slice(0, 5).forEach((cardUser) => {
      if (cardUser && cardUser._id) {
        queueProfileCardFetch(cardUser._id);
      }
    });
  }, [filteredDeck, queueProfileCardFetch]);

  // track controls visibility
  useEffect(() => {
    const target = controlsRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      setControlsVisible(true);
      return;
    }
    let frameId = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible =
          Boolean(entry?.isIntersecting) && entry.intersectionRatio >= 0.6;
        if (
          frameId != null &&
          typeof window !== 'undefined' &&
          window.cancelAnimationFrame
        ) {
          window.cancelAnimationFrame(frameId);
        }
        if (
          typeof window !== 'undefined' &&
          window.requestAnimationFrame
        ) {
          frameId = window.requestAnimationFrame(() =>
            setControlsVisible(isVisible)
          );
        } else {
          setControlsVisible(isVisible);
        }
      },
      { threshold: [0.4, 0.6, 1] }
    );
    observer.observe(target);
    return () => {
      if (
        frameId != null &&
        typeof window !== 'undefined' &&
        window.cancelAnimationFrame
      ) {
        window.cancelAnimationFrame(frameId);
      }
      observer.disconnect();
    };
  }, [controlsRef, filteredDeck.length]);

  const activeProfilePreset = useMemo(
    () => pickActivePreset(profileCardConfig),
    [profileCardConfig]
  );

  const previewPreset = useMemo(() => {
    if (!draftPreset) return null;
    const layout = findLayout(draftPreset.layout || 'single');
    return {
      ...draftPreset,
      layout: layout.id,
      modules: alignModulesWithLayout(draftPreset.modules, layout.id),
      stickers: Array.isArray(draftPreset.stickers)
        ? draftPreset.stickers
        : [],
    };
  }, [draftPreset]);

  const previewUser = useMemo(() => {
    if (viewerProfile && typeof viewerProfile === 'object') return viewerProfile;
    return {
      username: 'You',
      bio: '',
      profilePicture: '',
      bannerPicture: DEFAULT_BANNER_URL,
      hobbies: [],
      clubs: [],
      badgesEquipped: [],
      titleBadge: '',
      department: '',
      pronouns: '',
    };
  }, [viewerProfile]);
  const bioFallbackPreset = useMemo(
    () => createBioFallbackPreset(previewUser),
    [previewUser]
  );

  // when customize opens, hydrate draft
  useEffect(() => {
    if (!customizeOpen) {
      setLayoutMenuOpen(false);
      return;
    }
    if (!activeProfilePreset) {
      if (bioFallbackPreset) {
        setDraftPreset(bioFallbackPreset);
      } else {
        setDraftPreset(null);
      }
      setActiveModuleId(null);
      setLayoutMenuOpen(false);
      setSaveStatus('');
      return;
    }
    const layout = findLayout(activeProfilePreset.layout);
    const alignedModules = alignModulesWithLayout(
      activeProfilePreset.modules,
      layout.id
    );
    const nextModules = alignedModules.map((mod) => ({
      ...mod,
      content:
        typeof mod.content === 'object' && mod.content ? { ...mod.content } : {},
    }));
    const clonedPreset = {
      ...activeProfilePreset,
      layout: layout.id,
      modules: nextModules,
      stickers: Array.isArray(activeProfilePreset.stickers)
        ? [...activeProfilePreset.stickers]
        : [],
    };
    setDraftPreset(clonedPreset);
    setActiveModuleId(null);
    setLayoutMenuOpen(false);
    setSaveStatus('');
  }, [customizeOpen, activeProfilePreset, bioFallbackPreset]);

  const showCompactControls =
    filteredDeck.length > 0 && isShortViewport && !controlsVisible;

  const handleOpenCustomize = useCallback(() => {
    if (profileCardLoading) return;
    setCustomizeOpen(true);
  }, [profileCardLoading]);

  const handleCloseCustomize = useCallback(() => {
    if (savingPreset) return;
    setCustomizeOpen(false);
    setDraftPreset(null);
    setActiveModuleId(null);
    setLayoutMenuOpen(false);
    setSaveStatus('');
  }, [savingPreset]);

  const handleLayoutChange = useCallback((layoutId) => {
    setDraftPreset((prev) => {
      if (!prev) return prev;
      const layout = findLayout(layoutId);
      const modules = alignModulesWithLayout(prev.modules, layout.id);
      return { ...prev, layout: layout.id, modules };
    });
    setLayoutMenuOpen(false);
  }, []);

  const handleModuleActivate = useCallback((moduleId) => {
    setLayoutMenuOpen(false);
    setActiveModuleId(moduleId);
  }, []);

  const handlePreviewBackgroundClick = useCallback(() => {
    setLayoutMenuOpen(false);
    setActiveModuleId(null);
  }, []);

  const handleCanvasToggle = useCallback(() => {
    setActiveModuleId(null);
    setLayoutMenuOpen((prev) => !prev);
  }, []);

  const handleLayoutMenuSelect = useCallback(
    (layoutId) => {
      handleLayoutChange(layoutId);
    },
    [handleLayoutChange]
  );

  const handleModuleResize = useCallback((moduleId, nextLayout) => {
    setDraftPreset((prev) => {
      if (!prev) return prev;
      const columnLimit = Math.max(getLayoutColumns(prev.layout || 'hidden'), 1);
      const modules = prev.modules.map((mod) => {
        if (String(mod._id) !== String(moduleId)) return mod;
        const currentSettings =
          typeof mod.layoutSettings === 'object' && mod.layoutSettings
            ? { ...mod.layoutSettings }
            : { span: 1, minHeight: null };
        let nextSpan = currentSettings.span || 1;
        if (nextLayout && typeof nextLayout.span === 'number') {
          nextSpan = Math.min(Math.max(Math.round(nextLayout.span), 1), columnLimit);
        } else {
          nextSpan = Math.min(Math.max(nextSpan, 1), columnLimit);
        }
        let nextHeight = currentSettings.minHeight;
        if (nextLayout && typeof nextLayout.minHeight === 'number') {
          nextHeight = Math.max(Math.round(nextLayout.minHeight), 120);
        }
        return {
          ...mod,
          layoutSettings: {
            span: nextSpan,
            minHeight: nextHeight != null ? nextHeight : null,
          },
        };
      });
      return { ...prev, modules };
    });
  }, []);

  const handleModuleTypeChange = useCallback((moduleId, nextType) => {
    setDraftPreset((prev) => {
      if (!prev) return prev;
      const modules = prev.modules.map((mod) => {
        if (String(mod._id) !== String(moduleId)) return mod;
        let content = {};
        if (nextType === 'text') {
          content = { text: typeof mod.content?.text === 'string' ? mod.content.text : '' };
        } else if (nextType === 'image') {
          content = {
            url: typeof mod.content?.url === 'string' ? mod.content.url : '',
          };
        } else if (nextType === 'club') {
          content = { clubId: typeof mod.content?.clubId === 'string' ? mod.content.clubId : '' };
        } else if (nextType === 'prompt') {
          content = {
            promptKey: typeof mod.content?.promptKey === 'string' ? mod.content.promptKey : '',
            text: typeof mod.content?.text === 'string' ? mod.content.text : '',
          };
        }
        return { ...mod, type: nextType, content };
      });
      return { ...prev, modules };
    });
    setLayoutMenuOpen(false);
  }, []);

  const handleModuleContentChange = useCallback((moduleId, field, value) => {
    setDraftPreset((prev) => {
      if (!prev) return prev;
      const modules = prev.modules.map((mod) => {
        if (String(mod._id) !== String(moduleId)) return mod;
        const content = { ...mod.content };
        if (mod.type === 'text' && field === 'text') {
          content.text = value.slice(0, 600);
        } else if (mod.type === 'image') {
          if (field === 'url') content.url = value.slice(0, 1024);
        } else if (mod.type === 'club' && field === 'clubId') {
          content.clubId = value;
        } else if (mod.type === 'prompt') {
          if (field === 'promptKey') content.promptKey = value.slice(0, 80);
          if (field === 'text') content.text = value.slice(0, 400);
        } else {
          content[field] = value;
        }
        return { ...mod, content };
      });
      return { ...prev, modules };
    });
  }, []);

  const handleSavePreset = useCallback(async () => {
    if (!draftPreset || !userId) return;
    setSavingPreset(true);
    setLayoutMenuOpen(false);
    try {
      const layout = findLayout(draftPreset.layout);
      const modules = alignModulesWithLayout(draftPreset.modules, layout.id);
      const sanitizedDraft = {
        ...draftPreset,
        layout: layout.id,
        modules: modules.map((mod) => ({
          ...mod,
          content:
            typeof mod.content === 'object' && mod.content ? { ...mod.content } : {},
        })),
        stickers: Array.isArray(draftPreset.stickers) ? draftPreset.stickers : [],
      };
      const basePresets = Array.isArray(profileCardConfig?.presets)
        ? profileCardConfig.presets
        : [];
      const updatedPresets = basePresets.some(
        (preset) => String(preset._id) === String(sanitizedDraft._id)
      )
        ? basePresets.map((preset) =>
            String(preset._id) === String(sanitizedDraft._id)
              ? sanitizedDraft
              : preset
          )
        : [...basePresets, sanitizedDraft];
      const payload = {
        userId,
        currentPresetId: sanitizedDraft._id,
        presets: updatedPresets,
      };
      const saved = await api(`/api/profile-cards/${userId}`, {
        method: 'PUT',
        body: payload,
      });
      setProfileCardConfig(saved);
      const savedActive =
        (Array.isArray(saved?.presets) &&
          saved.presets.find(
            (preset) => String(preset._id) === String(saved.currentPresetId)
          )) ||
        saved?.presets?.[0] ||
        null;
      if (savedActive) {
        const savedLayout = findLayout(savedActive.layout);
        const savedModules = alignModulesWithLayout(
          savedActive.modules,
          savedLayout.id
        );
        const refreshedPreset = {
          ...savedActive,
          layout: savedLayout.id,
          modules: savedModules,
          stickers: Array.isArray(savedActive.stickers)
            ? [...savedActive.stickers]
            : [],
        };
        setDraftPreset(refreshedPreset);
        setActiveModuleId(null);
      }
      setSaveStatus('Saved!');
    } catch (e) {
      setSaveStatus(e?.message || 'Failed to save');
    } finally {
      setSavingPreset(false);
    }
  }, [draftPreset, userId, profileCardConfig]);

  const filteredSearchResults = useMemo(() => {
    const base = !activeTags.length
      ? searchResults
      : searchResults.filter((user) => matchesAllTags(user));
    return sortByLeaderboardRank(base);
  }, [searchResults, activeTags, matchesAllTags, sortByLeaderboardRank]);

  const tagsCatalog = useMemo(() => {
    const sections = [];
    const featuredTags = [
      { key: 'leaderboard', label: 'Leaderboard' },
      { key: 'club:any', label: 'In a Club' },
    ];
    sections.push({ id: 'featured', title: 'Featured', tags: featuredTags });

    const hobbies = Array.isArray(tagData.hobbies)
      ? [...tagData.hobbies].sort((a, b) => a.localeCompare(b))
      : [];
    if (hobbies.length) {
      sections.push({
        id: 'hobbies',
        title: 'Hobbies',
        tags: hobbies.map((h) => ({ key: `hobby:${h}`, label: h })),
      });
    }

    const departments = Array.isArray(tagData.departments)
      ? [...tagData.departments].sort((a, b) => a.localeCompare(b))
      : [];
    if (departments.length) {
      sections.push({
        id: 'departments',
        title: 'Departments',
        tags: departments.map((d) => ({ key: `department:${d}`, label: d })),
      });
    }

    const clubs = Array.isArray(tagData.clubs)
      ? [...tagData.clubs]
          .filter((c) => c && c._id && c.name)
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 30)
      : [];
    if (clubs.length) {
      sections.push({
        id: 'clubs',
        title: 'Clubs',
        tags: clubs.map((c) => ({ key: `club:${c._id}`, label: c.name })),
      });
    }

    return sections.filter((section) => section.tags.length > 0);
  }, [tagData]);

  const decideTop = async (dir, user) => {
    if (dir === 'right' && userId) {
      try {
        await api(`/api/users/${user._id}/follow`, {
          method: 'PUT',
          body: { userId },
        });
        setJustFollowed(user);
      } catch (e) {
        setError(e.message);
      }
    }
    setDeck((prev) => prev.filter((u) => u._id !== user._id));
  };

  const programmaticSwipe = async (direction) => {
    const top = filteredDeck[0];
    if (!top) return;
    await decideTop(direction, top);
  };

  const followFromSearch = async (targetId, isFollowing) => {
    if (!userId) return setError('Sign in required.');
    try {
      await api(`/api/users/${targetId}/follow`, {
        method: 'PUT',
        body: { userId },
      });
      setSearchResults((prev) =>
        prev.map((u) =>
          u._id === targetId ? { ...u, isFollowing: !isFollowing } : u
        )
      );
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="titantap-page">
      <style>{styles}</style>

      <div className="titantap-header">
        <h2>TitanTap</h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username, department, or hobbies…"
        />
        <div className="titantap-actions">
          <button
            type="button"
            className="tag-trigger"
            onClick={() => setShowTagPicker((prev) => !prev)}
            aria-expanded={showTagPicker}
          >
            Tags
          </button>
          <button
            type="button"
            className="customize-trigger"
            onClick={handleOpenCustomize}
            disabled={profileCardLoading}
            aria-haspopup="dialog"
          >
            <span className="icon" aria-hidden="true">
              🎴
            </span>
            <span>Preview</span>
          </button>
        </div>
      </div>

      {activeTags.length > 0 && (
        <div className="tag-active-row">
          {activeTags.map((tag) => (
            <button
              key={tag.key}
              type="button"
              className="tag-chip-active"
              onClick={() => toggleTag(tag)}
            >
              <span>{tag.label}</span>
              ×
            </button>
          ))}
        </div>
      )}

      {showTagPicker && (
        <div className="tag-modal">
          <header>
            <h3>Filter Tags</h3>
            <button
              type="button"
              className="close"
              onClick={() => setShowTagPicker(false)}
              aria-label="Close tag picker"
            >
              ×
            </button>
          </header>
          {tagError && <div className="tag-error">{tagError}</div>}
          {tagLoading ? (
            <div className="note" style={{ padding: '8px 0' }}>
              Loading tags…
            </div>
          ) : tagsCatalog.length > 0 ? (
            tagsCatalog.map((section) => (
              <div key={section.id} className="tag-section">
                <h4>{section.title}</h4>
                <div className="tag-pills">
                  {section.tags.map((tag) => (
                    <button
                      key={tag.key}
                      type="button"
                      className={`tag-pill ${
                        isTagActive(tag.key) ? 'active' : ''
                      }`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="note" style={{ padding: '8px 0' }}>
              No tags available right now.
            </div>
          )}
        </div>
      )}

      {error && <div className="note">{error}</div>}

      {(query.trim() || activeTags.length > 0) && (
        <div className="search-results">
          {filteredSearchResults.length === 0 ? (
            <div className="note">No results for the current filters.</div>
          ) : (
            filteredSearchResults.map((u) => (
              <div key={u._id} className="result-row">
                <div className="res-avatar" aria-hidden>
                  {u.profilePicture ? (
                    <img src={u.profilePicture} alt={u.username} />
                  ) : (
                    <span style={{ fontWeight: 700 }}>
                      {(u.username || '?').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="res-name">
                    <UserLink username={u.username}>{u.username}</UserLink>
                  </div>
                  <div className="res-sub">
                    {u.department ? `Dept: ${u.department}` : ''}
                  </div>
                  {Array.isArray(u.hobbies) && u.hobbies.length > 0 && (
                    <div className="chips">
                      {u.hobbies.slice(0, 4).map((h, i) => (
                        <span key={i} className="chip" title={h}>
                          <span className="chip-emoji" aria-hidden="true">
                            {getHobbyEmoji(h)}
                          </span>
                          {h}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <button
                    onClick={() =>
                      followFromSearch(u._id, !!u.isFollowing)
                    }
                    className={u.isFollowing ? 'ghost' : ''}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #111',
                      background: u.isFollowing ? '#111' : '#fff',
                      color: u.isFollowing ? '#fff' : '#111',
                      cursor: 'pointer',
                    }}
                  >
                    {u.isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="deck">
        {loading && <div className="note">Loading suggestions…</div>}
        {!loading && filteredDeck.length === 0 && (
          <div className="note">
            {activeTags.length
              ? 'No suggestions match the selected tags yet.'
              : 'No more suggestions right now.'}
          </div>
        )}
        {filteredDeck.map((user, idx) => {
          const config =
            profileCardCacheRef.current.get(String(user._id)) || null;
          const preset = pickActivePreset(config);
          return (
            <div
              key={user._id}
              style={{
                zIndex: 1000 + (filteredDeck.length - idx),
                opacity: idx === 0 ? 1 : 0,
                pointerEvents: idx === 0 ? 'auto' : 'none',
                transition: 'opacity 160ms ease',
              }}
            >
              <SwipeableCard
                user={user}
                viewer={viewerProfile}
                clubsMap={clubDirectory}
                onDecision={decideTop}
                profilePreset={preset}
                canvasLayoutId={preset ? preset.layout : null}
              />
            </div>
          );
        })}
      </div>

      <div className="controls" ref={controlsRef}>
        <button className="ghost" onClick={() => programmaticSwipe('left')}>
          Pass
        </button>
        <button onClick={() => programmaticSwipe('right')}>Connect</button>
      </div>

      {showCompactControls && (
        <div className="controls-compact" role="group" aria-label="Swipe actions">
          <button type="button" onClick={() => programmaticSwipe('left')}>
            Pass
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => programmaticSwipe('right')}
          >
            Connect
          </button>
        </div>
      )}

      {customizeOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className="profile-card-backdrop"
              onClick={handleCloseCustomize}
            />
            <div
              className="profile-card-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-card-editor-title"
              onClick={(e) => e.stopPropagation()}
            >
              <header>
                <h3 id="profile-card-editor-title">Customize Profile Card</h3>
                <button
                  type="button"
                  className="close"
                  onClick={handleCloseCustomize}
                  aria-label="Close editor"
                >
                  ×
                </button>
              </header>
              <div className="customize-body">
                {profileCardLoading ? (
                  <div className="customize-spinner">Loading your card…</div>
                ) : !draftPreset ? (
                  <div className="customize-spinner">
                    {profileCardError || 'Unable to load your profile card yet.'}
                  </div>
                ) : (
                  <>
                    {profileCardError && (
                      <div className="module-hint" role="alert">
                        {profileCardError}
                      </div>
                    )}
                    <div
                      className="customize-preview"
                      onClick={handlePreviewBackgroundClick}
                    >
                      <div className="customize-preview-card">
                        <div
                          className="card-preview-shell"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SwipeableCard
                            user={previewUser}
                            viewer={previewUser}
                            clubsMap={clubDirectory}
                            onDecision={() => {}}
                            profilePreset={previewPreset}
                            preview
                            editable
                            moduleTypes={PROFILE_MODULE_TYPES}
                            onModuleTypeChange={handleModuleTypeChange}
                            onModuleContentChange={handleModuleContentChange}
                            activeModuleId={activeModuleId}
                            onModuleActivate={handleModuleActivate}
                            onCanvasActivate={handleCanvasToggle}
                            layoutMenuOpen={layoutMenuOpen}
                            onLayoutSelect={handleLayoutMenuSelect}
                            onModuleResize={handleModuleResize}
                            canvasLayoutId={
                              previewPreset ? previewPreset.layout : null
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="customize-footer">
                <div
                  className="sticker-dock-placeholder"
                  style={{ position: 'static', top: 'auto', right: 'auto', marginRight: 'auto' }}
                >
                  Sticker dock coming soon
                </div>
                <span className="customize-status">
                  {saveStatus || (savingPreset ? 'Saving…' : '')}
                </span>
                <button
                  type="button"
                  onClick={handleCloseCustomize}
                  disabled={savingPreset}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="save"
                  onClick={handleSavePreset}
                  disabled={savingPreset || !draftPreset}
                >
                  {savingPreset ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </>,
          document.body
        )}


      {justFollowed && (
        <div className="toast" role="status" aria-live="polite">
          Followed {justFollowed.username}
        </div>
      )}
    </div>
  );
};

export default TitanTap;
