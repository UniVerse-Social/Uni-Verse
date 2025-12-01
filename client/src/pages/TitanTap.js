// src/pages/TitanTap.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
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
  getDefaultLayout,
  PROFILE_MODULE_TYPES,
  MAX_CANVAS_MODULES,
  createBlankModule,
  ensureLayoutDefaults,
  moduleHasVisibleContentPublic,
  applyDefaultSlotOrdering,
} from '../utils/titantap-utils';
import { SwipeableCard } from '../components/TitanTapCard';
import UserLink from '../components/UserLink';
import { getHobbyEmoji } from '../utils/hobbies';
import { DEFAULT_BANNER_URL } from '../config';
import {
  TEXT_MODULE_CHAR_LIMIT,
  MAX_TEXTAREA_NEWLINES,
} from '../constants/profileLimits';
import { applyTextLimits } from '../utils/textLimits';

// ---------- Minimal styles (same as your original, kept inline) ----------
const styles = `
:root {
  --nav-mobile: 58px;
  --topbar-mobile: 56px;
  --profile-card-height: clamp(520px, calc(100vh - 220px), 580px);
}

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
  height: var(--profile-card-height, clamp(520px, calc(100vh - 220px), 580px));
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
  background: linear-gradient(
    180deg,
    transparent 0%,
    color-mix(in srgb, var(--card-body-fill, #ffffff) 65%, transparent) 60%,
    var(--card-body-fill, #ffffff) 100%
  );
  pointer-events: none;
  z-index: 1;
}
.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 18px 10px;
  gap: 10px;
  position: relative;
  z-index: 1;
  background: var(
    --card-body-fill,
    linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.98) 45%, rgba(255,255,255,1) 100%)
  );
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
    padding: 14px 14px 8px;
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
  border: 2px solid var(--mutual-accent, #fbbf24);
  background:
    linear-gradient(#f8fafc, #f8fafc) padding-box,
    linear-gradient(135deg, color-mix(in srgb, var(--mutual-accent, #fbbf24) 45%, transparent), rgba(37,99,235,0.1)) border-box;
  box-shadow: 0 10px 24px color-mix(in srgb, var(--mutual-accent, #fbbf24) 28%, transparent);
  color: #111827;
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
  border: 2px solid var(--mutual-accent, #fbbf24);
  background: linear-gradient(135deg, color-mix(in srgb, var(--mutual-accent, #fbbf24) 20%, #fff), rgba(255,255,255,0.98));
  box-shadow: 0 10px 20px color-mix(in srgb, var(--mutual-accent, #fbbf24) 25%, transparent);
}

.module-resize-elbow {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 16px;
  height: 16px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
  z-index: 3;
}
.module-resize-elbow span {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
  position: relative;
  cursor: se-resize;
  pointer-events: none;
}
.module-resize-elbow span::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-bottom: 2px solid rgba(71,85,105,0.8);
  border-right: 2px solid rgba(71,85,105,0.8);
  border-radius: 0 0 6px 0;
  pointer-events: none;
}
.card-canvas-item.editable:hover .module-resize-elbow,
.card-canvas-item.editable.active .module-resize-elbow,
.card-canvas-item.editable:focus-within .module-resize-elbow {
  opacity: 1;
  pointer-events: auto;
}
.card-canvas-item.editable:hover .module-resize-elbow span::after,
.card-canvas-item.editable.active .module-resize-elbow span::after,
.card-canvas-item.editable:focus-within .module-resize-elbow span::after {
  border-color: rgba(59,73,103,0.95);
}

.canvas-resize-elbow {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 28px;
  height: 28px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
  z-index: 4;
}
.canvas-resize-elbow span {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid rgba(148,163,184,0.45);
  background: rgba(15,23,42,0.08);
  position: relative;
  cursor: se-resize;
  pointer-events: auto;
}
.canvas-resize-elbow span::after {
  content: '';
  position: absolute;
  inset: 7px;
  border-bottom: 2px solid rgba(37,41,63,0.9);
  border-right: 2px solid rgba(37,41,63,0.9);
  border-radius: 0 0 8px 0;
}
.card-canvas-shell.editable:hover .canvas-resize-elbow,
.card-canvas-shell.editable:focus-within .canvas-resize-elbow,
.card-canvas-shell.editable.layout-open .canvas-resize-elbow {
  opacity: 0;
  pointer-events: none;
}

.interest-cloud-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}
.interest-cloud {
  flex: 1 1 auto;
  min-width: 0;
  justify-content: center;
  padding-right: 0;
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
.card-canvas-shell {
  position: relative;
  display: flex;
  justify-content: center;
  width: 100%;
  margin: 0 auto;
  max-width: var(--canvas-outer-width, var(--canvas-width, 100%));
  overflow: visible;
}
.card-canvas-shell .card-canvas {
  position: relative;
  z-index: 2;
  margin: 0 auto;
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
  background: var(
    --canvas-bg,
    linear-gradient(160deg, rgba(248,250,255,0.95), rgba(226,232,240,0.85))
  );
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
  background: var(
    --canvas-bg,
    linear-gradient(160deg, rgba(248,250,255,0.95), rgba(226,232,240,0.85))
  );
  border-color: var(--canvas-shell-border-color, rgba(148,163,184,0.35));
  box-shadow: 0 16px 32px rgba(37,99,235,0.12);
  opacity: 1;
}
.card-canvas-item {
  position: relative;
  min-width: 42px;
  min-height: 42px;
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
.canvas-color-menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.canvas-color-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: 1px solid rgba(148,163,184,0.35);
  border-radius: 12px;
  padding: 8px 12px;
  background: rgba(248,250,255,0.9);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}
.canvas-color-trigger.open,
.canvas-color-trigger:hover,
.canvas-color-trigger:focus-visible {
  border-color: rgba(37,99,235,0.6);
  box-shadow: 0 10px 24px rgba(37,99,235,0.16);
  outline: none;
}
.canvas-color-preview {
  width: 28px;
  height: 20px;
  border-radius: 8px;
  border: 1px solid rgba(148,163,184,0.5);
  margin-left: 10px;
}
.canvas-color-panel {
  border: 1px solid rgba(148,163,184,0.25);
  border-radius: 14px;
  padding: 10px;
  background: rgba(248,250,255,0.95);
  box-shadow: inset 0 1px 2px rgba(15,23,42,0.04);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.canvas-color-swatches {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.canvas-color-swatch {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.canvas-color-swatch.selected {
  border-color: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(37,99,235,0.28);
}
.canvas-color-swatch:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.canvas-color-slider {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}
.canvas-color-slider input[type="range"] {
  width: 100%;
}

.card-canvas {
  margin-top: 0;
  padding: 6px;
  border-radius: 18px;
  border: 1px solid var(--canvas-border-color, rgba(148,163,184,0.25));
  background: var(
    --canvas-bg,
    linear-gradient(160deg, rgba(248,250,255,0.95), rgba(226,232,240,0.85))
  );
  display: grid;
  gap: 6px;
  height: 100%;
  width: min(100%, var(--canvas-width, 100%));
  min-width: 0;
  box-sizing: border-box;
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
  background: var(
    --canvas-bg,
    linear-gradient(160deg, rgba(248,250,255,0.95), rgba(226,232,240,0.85))
  );
  border-color: var(--canvas-shell-border-color, rgba(148,163,184,0.35));
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
.card-canvas-item p.card-canvas-empty {
  color: #6b7280;
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
  overflow: hidden;
}
.card-canvas-item .image-wrapper.full img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.card-canvas-item.image .module-preview {
  padding: 0;
  height: 100%;
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
  border-color: var(--mutual-accent, #fbbf24);
  color: #0f172a;
  background: linear-gradient(135deg, color-mix(in srgb, var(--mutual-accent, #fbbf24) 20%, #ffffff), rgba(255,255,255,0.94));
  box-shadow: 0 16px 28px color-mix(in srgb, var(--mutual-accent, #fbbf24) 30%, transparent);
}
.mutual-count {
  margin-top: 0;
  font-size: 13px;
  color: #0f172a;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 2px;
}
.mutual-count strong {
  color: inherit;
}
.card-footer {
  margin-top: auto;
  color: #64748b;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 6px;
  background: var(--card-body-fill, transparent);
}
.card-footer-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.card-footer strong { color: inherit; font-weight: 700; }
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
  :root {
    --profile-card-height: clamp(
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

/* Mobile: ensure controls never sit under the fixed nav */
@media (max-width: 600px) {
  .controls { padding-bottom: calc(8px + var(--nav-mobile) + env(safe-area-inset-bottom, 0px)); }
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
  max-height: min(100vh, 900px);
  height: min(100vh, 900px);
  max-height: min(100dvh, 900px);
  height: min(100dvh, 900px);
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
  overflow: visible;
  align-items: center;
  width: 100%;
  min-height: 0;
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
  align-items: center;
  overflow: visible;
  padding: 0 8px 16px;
  margin-top: 0;
  position: relative;
  z-index: 10;
}
.customize-preview-card {
  width: min(520px, calc(100vw - 32px));
  max-width: 520px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-preview-shell {
  width: min(520px, 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  transform: none;
  transform-origin: center;
  position: relative;
  z-index: 10;
}
.card-wrap.preview {
  position: relative;
  left: auto;
  top: 0;
  transform: none;
  width: min(520px, calc(100vw - 32px));
  max-width: 520px;
  touch-action: pan-y;
  margin: 0 auto;
  z-index: 10;
}
.card-wrap.preview .card {
  height: var(--profile-card-height, clamp(520px, calc(100vh - 220px), 580px));
}
.card-wrap.preview .card-canvas {
  width: auto;
  max-width: 100%;
}

@media (max-width: 600px) {
  .profile-card-modal {
    width: calc(100vw - 8px);
    max-height: calc(100vh - 8px);
    border-radius: 18px;
  }
  .customize-body {
    padding: 0 12px 12px;
  }
  .customize-preview {
    padding: 0;
  }
  .customize-preview-card {
    width: min(520px, calc(100vw - 16px));
  }
}
.card-wrap.preview .card-canvas-item:not(.image),
.card-preview-shell .card-canvas-item:not(.image),
.card-canvas-shell .card-canvas-item:not(.image),
.card .card-canvas-item:not(.image) {
  border: 1px solid rgba(148,163,184,0.48);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 26px rgba(15,23,42,0.12);
  padding: 5px 7px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 70px;
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
.card-canvas-item.textual .module-preview {
  position: relative;
  width: 100%;
  padding-bottom: 8px;
  font-size: calc(15px * var(--text-scale, 1));
  line-height: calc(1.35 * var(--text-scale, 1));
  align-items: center;
  justify-content: center;
  text-align: center;
}
.card-canvas-item.textual .module-text-body {
  width: 100%;
  min-height: calc(100% - 8px);
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.card-canvas-item.textual .module-text-body > * {
  width: 100%;
  margin: 0;
}
.card-canvas-item.textual .module-inline-editor,
.card-canvas-item.textual p {
  font-size: inherit;
  line-height: inherit;
  text-align: center;
  white-space: pre-wrap;
  word-break: break-word;
}
.card-canvas-item.textual .module-inline-editor {
  width: 100%;
  min-height: 32px;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  cursor: text;
  padding: 0;
}
.card-canvas-item.textual .module-inline-editor:empty::before {
  content: attr(data-placeholder);
  color: #94a3b8;
  pointer-events: none;
  display: block;
  width: 100%;
  text-align: center;
}
.card-canvas-item.textual .module-char-count {
  position: absolute;
  bottom: 0;
  right: 0;
  font-size: 11px;
  color: #94a3b8;
  pointer-events: none;
}
.card-wrap.preview button,
.card-wrap.preview a {
  pointer-events: auto;
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
  flex-shrink: 0;
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
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
    transform: none;
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
    transform: none;
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
    transform: none;
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

.canvas-module-controls {
  position: absolute;
  top: 4px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: rgba(255,255,255,0.92);
  border-radius: 999px;
  box-shadow: 0 10px 24px rgba(15,23,42,0.12);
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  border: 1px solid rgba(148,163,184,0.38);
  transform: translateY(-80%);
  z-index: 60;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.canvas-module-controls button {
  border: 1px solid rgba(148,163,184,0.45);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 16px;
  font-weight: 700;
  background: rgba(248,250,255,0.9);
  color: #0f172a;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
  display: grid;
  place-items: center;
}
.canvas-module-controls button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.canvas-module-controls button:not(:disabled):hover {
  background: #fff;
  border-color: rgba(148,163,184,0.65);
  transform: translateY(-1px);
}
.canvas-module-controls span {
  min-width: 44px;
  text-align: center;
  color: #0f172a;
}
.card-canvas-shell.editable:hover .canvas-module-controls[data-floating-control="true"],
.card-canvas-shell.editable:focus-within .canvas-module-controls[data-floating-control="true"],
.card-canvas-shell.editable.layout-open .canvas-module-controls[data-floating-control="true"] {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(-60%);
}

.accent-badge {
  border: 2px solid #fbbf24;
  border-radius: 999px;
  padding: 4px 10px;
  background: rgba(15,23,42,0.75);
  color: #fff;
  cursor: pointer;
}
.accent-picker {
  position: fixed;
  background: #fff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 18px 42px rgba(15,23,42,0.2);
  border-radius: 14px;
  padding: 10px;
  z-index: 3000;
  width: 170px;
}
.accent-picker span {
  font-size: 12px;
  font-weight: 600;
  display: block;
  margin-bottom: 6px;
}
.accent-grid {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.accent-swatch {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
}
.accent-swatch.selected {
  border-color: #111;
}

.card-canvas.freeform {
  position: relative;
}
.card-canvas-item.freeform {
  position: absolute;
}

.module-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 6px;
  background: rgba(15,23,42,0.05);
  border-radius: 10px;
  margin-top: 6px;
}
.module-align-group span {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #475569;
}
.align-controls {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}
.align-controls button {
  border: 1px solid #cbd5f5;
  background: #fff;
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 11px;
  cursor: pointer;
}
.align-controls button.active {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}
.module-scale-group label {
  display: flex;
  flex-direction: column;
  font-size: 11px;
  font-weight: 600;
  color: #475569;
}
.module-scale-group input[type="range"] {
  width: 120px;
}

.accent-picker .accent-grid button {
  border: none;
}

.card-color-picker {
  position: fixed;
  background: #fff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 18px 42px rgba(15,23,42,0.2);
  border-radius: 14px;
  padding: 12px;
  width: 210px;
  z-index: 3100;
}
.card-color-picker span {
  font-size: 12px;
  font-weight: 600;
  display: block;
  margin-bottom: 6px;
  color: #0f172a;
}
.card-color-grid {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}
.card-color-swatch {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.card-color-swatch:hover {
  transform: translateY(-1px);
}
.card-color-swatch.selected {
  border-color: #111;
}

.module-menu {
  z-index: 4100;
  pointer-events: auto;
}
.module-menu.overlay {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 2px;
}
.module-menu-surface {
  background: rgba(255,255,255,0.98);
  border-radius: 12px;
  box-shadow: 0 12px 28px rgba(15,23,42,0.18);
  border: 1px solid rgba(148,163,184,0.3);
  padding: 6px 8px;
  min-width: 130px;
  max-width: 160px;
  pointer-events: auto;
}
.module-menu-section + .module-menu-section {
  margin-top: 8px;
}
.module-menu-header {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #94a3b8;
  display: block;
  margin-bottom: 4px;
}
.module-menu-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.module-menu-option {
  border: 1px solid rgba(148,163,184,0.4);
  border-radius: 10px;
  background: #f8fafc;
  color: #0f172a;
  font-size: 11px;
  font-weight: 600;
  padding: 5px 8px;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
}
.module-menu-option:not(.disabled):hover {
  background: #fff;
  border-color: rgba(148,163,184,0.6);
}
.module-menu-option.disabled {
  opacity: 0.45;
  cursor: default;
}
.module-menu-primary {
  width: 100%;
  border: none;
  border-radius: 10px;
  padding: 7px 9px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  box-shadow: 0 10px 18px rgba(249,115,22,0.3);
  cursor: pointer;
}
.module-menu-option.danger {
  margin-top: 6px;
  background: #fee2e2;
  color: #b91c1c;
  border: none;
  font-size: 11px;
  padding: 5px 8px;
}

.image-dropzone {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 18px;
  border: 1px dashed rgba(148,163,184,0.45);
  background: linear-gradient(180deg, rgba(248,250,255,0.98), rgba(226,232,240,0.8));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.image-dropzone.has-image {
  border-style: solid;
}
.image-dropzone img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.image-dropzone-empty p {
  font-size: 12px;
  color: #64748b;
  text-align: center;
  padding: 0 18px;
  margin: 0;
}
.image-dropzone-panel {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  border-radius: 14px;
  padding: 8px;
  background: rgba(15,23,42,0.9);
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 10px 24px rgba(15,23,42,0.35);
  font-size: 11px;
  max-height: calc(100% - 20px);
  overflow-y: auto;
}
.image-url-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.85);
}
.image-url-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.image-url-input input {
  flex: 1;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.35);
  padding: 6px 10px;
  font-size: 12px;
  color: #fff;
  background: rgba(15,23,42,0.65);
}
.image-panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.image-panel-actions button {
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.12);
  color: #fff;
  font-size: 11px;
  padding: 4px 12px;
  cursor: pointer;
}
.image-panel-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.image-panel-error {
  margin: 0;
  color: #fecaca;
  font-size: 10px;
}
.image-panel-note {
  margin: 0;
  color: rgba(255,255,255,0.65);
  font-size: 10px;
}
.image-dropzone video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.toast { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: #fff; color: #111; padding: 10px 14px; border-radius: 999px; }
`;

const clampDynamicSlots = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_CANVAS_MODULES, Math.max(0, Math.round(value)));
};

const resolveDynamicSlotCount = (layoutId, modulesLength, storedValue) => {
  if (layoutId !== 'dynamic') return 0;
  const safeModules = Math.max(0, modulesLength || 0);
  const clampedStored = clampDynamicSlots(
    typeof storedValue === 'number' ? storedValue : NaN
  );
  if (!clampedStored && safeModules === 0) return 0;
  const base = clampedStored || safeModules || 0;
  return Math.max(base, safeModules);
};

const findFirstOpenDynamicSlotId = (slotCount, modules) => {
  if (!slotCount) return null;
  const normalizedCount = Math.min(
    MAX_CANVAS_MODULES,
    Math.max(1, Math.round(slotCount))
  );
  const layout = getDefaultLayout(normalizedCount);
  if (!layout?.slots?.length) return null;
  const used = new Set(
    (modules || [])
      .map((mod) => mod?.slotId || mod?.layoutSettings?.slotId)
      .filter((slotId) => typeof slotId === 'string' && slotId)
  );
  const openSlot = layout.slots.find((slot) => !used.has(slot.id));
  return openSlot ? openSlot.id : null;
};

const STYLE_PRESETS = ['classic', 'glass', 'midnight'];
const DEFAULT_ACCENT = '#fbbf24';
const MIN_MODULE_DIMENSION = 42;
const ALIGN_TOKENS = ['start', 'center', 'end'];
const TEXT_CHAR_LIMIT = TEXT_MODULE_CHAR_LIMIT;
const MAX_MODULE_NEWLINES = MAX_TEXTAREA_NEWLINES;
const DEFAULT_CANVAS_COLOR_ID = 'classic';
const DEFAULT_CANVAS_COLOR_ALPHA = 1;

const clampSlotScale = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 1;
  return Math.min(1, Math.max(0.2, num));
};

const clamp01 = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(1, Math.max(0, num));
};

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
  const deckRef = useRef(null);
  const [liveCardHeight, setLiveCardHeight] = useState(null);
  const controlsRef = useRef(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isShortViewport, setIsShortViewport] = useState(false);
  const profileCardCacheRef = useRef(new Map());
  const inflightProfileCardsRef = useRef(new Set());
  const [, setProfileCardVersion] = useState(0);
  const lastVisibleLayoutRef = useRef('single');

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
  const topCardId = filteredDeck.length > 0 ? String(filteredDeck[0]?._id) : null;

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

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }
    const deckElement = deckRef.current;
    if (!deckElement) {
      setLiveCardHeight(null);
      return undefined;
    }

    let resizeFrame = null;

    const measure = () => {
      const cardNode = deckElement.querySelector('.card');
      if (!cardNode) {
        setLiveCardHeight(null);
        return;
      }
      const nextHeight = cardNode.getBoundingClientRect().height;
      setLiveCardHeight((prev) => {
        if (typeof prev === 'number' && Math.abs(prev - nextHeight) < 0.5) {
          return prev;
        }
        return nextHeight;
      });
    };

    const requestMeasure = () => {
      if (
        resizeFrame != null &&
        typeof window.cancelAnimationFrame === 'function'
      ) {
        window.cancelAnimationFrame(resizeFrame);
      }
      if (typeof window.requestAnimationFrame === 'function') {
        resizeFrame = window.requestAnimationFrame(measure);
      } else {
        measure();
      }
    };

    measure();
    window.addEventListener('resize', requestMeasure);

    const observedCard = deckElement.querySelector('.card');
    let observer;
    if (observedCard && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => requestMeasure());
      observer.observe(observedCard);
    }

    return () => {
      window.removeEventListener('resize', requestMeasure);
      if (observer) observer.disconnect();
      if (
        resizeFrame != null &&
        typeof window.cancelAnimationFrame === 'function'
      ) {
        window.cancelAnimationFrame(resizeFrame);
      }
    };
  }, [topCardId]);

  const activeProfilePreset = useMemo(
    () => pickActivePreset(profileCardConfig),
    [profileCardConfig]
  );

  const previewPreset = useMemo(() => {
    if (!draftPreset) return null;
    const layout = findLayout(draftPreset.layout || 'single');
    const moduleList = Array.isArray(draftPreset.modules) ? draftPreset.modules : [];
    const dynamicSlotCount =
      layout.id === 'dynamic'
        ? resolveDynamicSlotCount(layout.id, moduleList.length, draftPreset.dynamicSlotCount)
        : 0;
    return {
      ...draftPreset,
      layout: layout.id,
      modules: alignModulesWithLayout(moduleList, layout.id, {
        slotCount: dynamicSlotCount || undefined,
      }),
      stickers: Array.isArray(draftPreset.stickers)
        ? draftPreset.stickers
        : [],
      accentColor: draftPreset.accentColor || DEFAULT_ACCENT,
      stylePreset: draftPreset.stylePreset || STYLE_PRESETS[0],
      canvasScale:
        typeof draftPreset.canvasScale === 'number'
          ? draftPreset.canvasScale
          : 1,
      canvasColorId: draftPreset.canvasColorId || DEFAULT_CANVAS_COLOR_ID,
      canvasColorAlpha: clamp01(
        typeof draftPreset.canvasColorAlpha === 'number'
          ? draftPreset.canvasColorAlpha
          : DEFAULT_CANVAS_COLOR_ALPHA
      ),
      dynamicSlotCount: layout.id === 'dynamic' ? dynamicSlotCount : 0,
      cardBodyColor: draftPreset.cardBodyColor || '#ffffff',
    };
  }, [draftPreset]);

  useEffect(() => {
    if (draftPreset?.layout && draftPreset.layout !== 'hidden') {
      lastVisibleLayoutRef.current = draftPreset.layout;
    }
  }, [draftPreset?.layout]);

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
        const ordered = applyDefaultSlotOrdering(bioFallbackPreset.modules || []);
        setDraftPreset({
          ...bioFallbackPreset,
          stylePreset: STYLE_PRESETS[0],
          accentColor: DEFAULT_ACCENT,
          canvasScale: 1,
          canvasColorId: DEFAULT_CANVAS_COLOR_ID,
          canvasColorAlpha: DEFAULT_CANVAS_COLOR_ALPHA,
          modules: ordered,
          dynamicSlotCount: 0,
          cardBodyColor: bioFallbackPreset.cardBodyColor || '#ffffff',
        });
      } else {
        const viewerId =
          previewUser?._id || previewUser?.id || userId || 'viewer';
        setDraftPreset({
          _id: `hidden-${viewerId}`,
          layout: 'hidden',
          modules: [],
          stickers: [],
          stylePreset: STYLE_PRESETS[0],
          accentColor: DEFAULT_ACCENT,
          canvasScale: 1,
          canvasColorId: DEFAULT_CANVAS_COLOR_ID,
          canvasColorAlpha: DEFAULT_CANVAS_COLOR_ALPHA,
          dynamicSlotCount: 0,
          cardBodyColor: '#ffffff',
        });
      }
      setActiveModuleId(null);
      setLayoutMenuOpen(false);
      setSaveStatus('');
      return;
    }
    const layout = findLayout(activeProfilePreset.layout);
    const alignedModules = alignModulesWithLayout(
      activeProfilePreset.modules,
      layout.id,
      {
        slotCount:
          layout.id === 'dynamic'
            ? resolveDynamicSlotCount(
                layout.id,
                Array.isArray(activeProfilePreset.modules)
                  ? activeProfilePreset.modules.length
                  : 0,
                activeProfilePreset.dynamicSlotCount
              )
            : undefined,
      }
    );
    const nextModules = alignedModules.map((mod) => ({
      ...mod,
      content:
        typeof mod.content === 'object' && mod.content ? { ...mod.content } : {},
    }));
    const slotCount = resolveDynamicSlotCount(
      layout.id,
      nextModules.length,
      activeProfilePreset.dynamicSlotCount
    );
    const orderedModules =
      layout.id === 'dynamic'
        ? applyDefaultSlotOrdering(nextModules, {
            slotCount,
            preserveEmpty: true,
          })
        : applyDefaultSlotOrdering(nextModules);
    const clonedPreset = {
      ...activeProfilePreset,
      layout: layout.id,
      modules: orderedModules,
      stickers: Array.isArray(activeProfilePreset.stickers)
        ? [...activeProfilePreset.stickers]
        : [],
      stylePreset: activeProfilePreset.stylePreset || STYLE_PRESETS[0],
      accentColor: activeProfilePreset.accentColor || DEFAULT_ACCENT,
      canvasScale:
        typeof activeProfilePreset.canvasScale === 'number'
          ? activeProfilePreset.canvasScale
          : 1,
      canvasColorId: activeProfilePreset.canvasColorId || DEFAULT_CANVAS_COLOR_ID,
      canvasColorAlpha: clamp01(
        typeof activeProfilePreset.canvasColorAlpha === 'number'
          ? activeProfilePreset.canvasColorAlpha
          : DEFAULT_CANVAS_COLOR_ALPHA
      ),
      dynamicSlotCount: layout.id === 'dynamic' ? slotCount : 0,
      cardBodyColor: activeProfilePreset.cardBodyColor || '#ffffff',
    };
    setDraftPreset(clonedPreset);
    setActiveModuleId(null);
    setLayoutMenuOpen(false);
    setSaveStatus('');
  }, [customizeOpen, activeProfilePreset, bioFallbackPreset, previewUser, userId]);

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
      const modules = Array.isArray(prev.modules) ? prev.modules : [];
      const nextSlotCount =
        layout.id === 'dynamic'
          ? resolveDynamicSlotCount(
              layout.id,
              modules.length,
              prev.dynamicSlotCount
            )
          : 0;
      const aligned = alignModulesWithLayout(modules, layout.id, {
        slotCount: nextSlotCount || undefined,
      });
      return {
        ...prev,
        layout: layout.id,
        modules: aligned,
        dynamicSlotCount: layout.id === 'dynamic' ? nextSlotCount : 0,
      };
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

  const handleCanvasStyleCycle = useCallback(() => {
    setDraftPreset((prev) => {
      if (!prev) return prev;
      const current = prev.stylePreset || STYLE_PRESETS[0];
      const idx = STYLE_PRESETS.indexOf(current);
      const nextPreset = STYLE_PRESETS[(idx + 1) % STYLE_PRESETS.length];
      return { ...prev, stylePreset: nextPreset };
    });
  }, []);

  const handleCanvasScaleChange = useCallback((scale) => {
    setDraftPreset((prev) => {
      if (!prev) return prev;
      return { ...prev, canvasScale: scale };
    });
  }, []);

  const handleCanvasColorChange = useCallback((colorId) => {
    if (!colorId) return;
    setDraftPreset((prev) => (prev ? { ...prev, canvasColorId: colorId } : prev));
  }, []);

  const handleCanvasOpacityChange = useCallback((alpha) => {
    const clamped = clamp01(typeof alpha === 'number' ? alpha : 0);
    setDraftPreset((prev) => (prev ? { ...prev, canvasColorAlpha: clamped } : prev));
  }, []);

  const handleCardBodyColorChange = useCallback((color) => {
    if (!color) return;
    setDraftPreset((prev) => (prev ? { ...prev, cardBodyColor: color } : prev));
  }, []);

  const handleAccentColorChange = useCallback(
    async (color) => {
      if (!color) return;
      setDraftPreset((prev) => (prev ? { ...prev, accentColor: color } : prev));
      if (userId) {
        try {
          await api(`/api/users/${userId}/preferences`, {
            method: 'PATCH',
            body: { userId, favoriteAccentColor: color },
          });
        } catch (err) {
          console.warn('Accent color save failed', err?.message || err);
        }
      }
    },
    [userId]
  );

  const handleLayoutMenuSelect = useCallback(
    (layoutId) => {
      handleLayoutChange(layoutId);
    },
    [handleLayoutChange]
  );
  const handleLayoutMenuClose = useCallback(() => {
    setLayoutMenuOpen(false);
  }, []);

  const handleAddModule = useCallback(() => {
    setDraftPreset((prev) => {
      if (!prev) return prev;
      const currentModules = Array.isArray(prev.modules) ? prev.modules : [];
      if (currentModules.length >= MAX_CANVAS_MODULES) return prev;
      let nextLayoutId = prev.layout || 'dynamic';
      if (nextLayoutId === 'hidden') {
        nextLayoutId = lastVisibleLayoutRef.current || 'single';
      }
      let layout = findLayout(nextLayoutId);
      const slotLimit = Array.isArray(layout.slots) ? layout.slots.length : 0;
      if (
        layout.id !== 'dynamic' &&
        layout.id !== 'freeform' &&
        slotLimit > 0 &&
        currentModules.length >= slotLimit
      ) {
        nextLayoutId = 'dynamic';
        layout = findLayout(nextLayoutId);
      }
      if (layout.id === 'dynamic') {
        const currentSlotBudget = resolveDynamicSlotCount(
          layout.id,
          currentModules.length,
          prev.dynamicSlotCount
        );
        let nextSlotBudget = currentSlotBudget || Math.max(currentModules.length, 1);
        let targetSlotId = findFirstOpenDynamicSlotId(nextSlotBudget, currentModules);
        if (!targetSlotId) {
          if (nextSlotBudget >= MAX_CANVAS_MODULES) return prev;
          nextSlotBudget = Math.min(MAX_CANVAS_MODULES, nextSlotBudget + 1);
          targetSlotId = findFirstOpenDynamicSlotId(nextSlotBudget, currentModules);
        }
        const newModule = createBlankModule(
          targetSlotId || `slot-${currentModules.length + 1}`
        );
        const orderedModules = applyDefaultSlotOrdering(
          [...currentModules, newModule],
          {
            slotCount: nextSlotBudget,
            preserveEmpty: true,
          }
        );
        return {
          ...prev,
          layout: orderedModules.length ? nextLayoutId : 'hidden',
          modules: orderedModules,
          dynamicSlotCount: orderedModules.length ? nextSlotBudget : 0,
        };
      }
      const slots = layout.slots && layout.slots.length ? layout.slots : [];
      const nextSlotId =
        slots[currentModules.length] || `slot-${currentModules.length + 1}`;
      const newModule = createBlankModule(nextSlotId);
      const orderedModules = applyDefaultSlotOrdering([
        ...currentModules,
        newModule,
      ]);
      return {
        ...prev,
        layout: orderedModules.length ? nextLayoutId : 'hidden',
        modules: orderedModules,
        dynamicSlotCount: nextLayoutId === 'dynamic' ? orderedModules.length : 0,
      };
    });
  }, [lastVisibleLayoutRef]);

  const handleRemoveModule = useCallback(() => {
    setDraftPreset((prev) => {
      if (!prev) return prev;
      const currentModules = Array.isArray(prev.modules) ? prev.modules : [];
      if (!currentModules.length) return prev;
      if (prev.layout === 'dynamic') {
        const slotCount = resolveDynamicSlotCount(
          prev.layout,
          currentModules.length,
          prev.dynamicSlotCount
        );
        if (slotCount <= 0) return prev;
        const hasEmptySlots = slotCount > currentModules.length;
        const nextSlotCount = clampDynamicSlots(slotCount - 1);
        const sourceModules = hasEmptySlots
          ? currentModules
          : currentModules.slice(0, -1);
        const orderedModules = applyDefaultSlotOrdering(sourceModules, {
          slotCount: nextSlotCount,
          preserveEmpty: true,
        });
        const nextLayout =
          orderedModules.length === 0
            ? 'hidden'
            : prev.layout === 'hidden'
            ? lastVisibleLayoutRef.current || 'single'
            : prev.layout;
        const nextPreset = {
          ...prev,
          layout: nextLayout,
          modules: orderedModules,
          dynamicSlotCount: nextLayout === 'dynamic' ? nextSlotCount : 0,
        };
        return nextPreset;
      }
      const trimmed = currentModules.slice(0, -1);
      const orderedModules = applyDefaultSlotOrdering(trimmed);
      const nextLayout =
        orderedModules.length === 0
          ? 'hidden'
          : prev.layout === 'hidden'
          ? lastVisibleLayoutRef.current || 'single'
          : prev.layout;
      return {
        ...prev,
        layout: nextLayout,
        modules: orderedModules,
        dynamicSlotCount: nextLayout === 'dynamic' ? orderedModules.length : 0,
      };
    });
  }, [lastVisibleLayoutRef]);

  const handleModuleDelete = useCallback(
    (moduleId) => {
      setDraftPreset((prev) => {
        if (!prev) return prev;
        const currentModules = Array.isArray(prev.modules) ? prev.modules : [];
        const filtered = currentModules.filter(
          (mod) => String(mod._id) !== String(moduleId)
        );
        let orderedModules;
        let nextSlotCount = prev.dynamicSlotCount;
        if (prev.layout === 'dynamic') {
          const slotCount = resolveDynamicSlotCount(
            prev.layout,
            currentModules.length,
            prev.dynamicSlotCount
          );
          nextSlotCount = slotCount;
          if (slotCount <= filtered.length) {
            orderedModules = applyDefaultSlotOrdering(filtered, {
              slotCount,
              preserveEmpty: true,
            });
            nextSlotCount = orderedModules.length ? slotCount : 0;
          } else {
            orderedModules = filtered;
            if (!orderedModules.length) {
              nextSlotCount = 0;
            }
          }
        } else {
          orderedModules = applyDefaultSlotOrdering(filtered);
          nextSlotCount = orderedModules.length && prev.layout === 'dynamic' ? orderedModules.length : 0;
        }
        const nextLayout =
          orderedModules.length === 0
            ? 'hidden'
            : prev.layout === 'hidden'
            ? lastVisibleLayoutRef.current || 'single'
            : prev.layout;
        return {
          ...prev,
          layout: nextLayout,
          modules: orderedModules,
          dynamicSlotCount: nextLayout === 'dynamic' ? nextSlotCount : 0,
        };
      });
      if (String(activeModuleId) === String(moduleId)) {
        setActiveModuleId(null);
      }
    },
    [activeModuleId, lastVisibleLayoutRef]
  );

  const handleModuleResize = useCallback((moduleId, nextLayout) => {
    setDraftPreset((prev) => {
      if (!prev) return prev;
      const currentList = Array.isArray(prev.modules) ? prev.modules : [];
      const sizingCount =
        prev.layout === 'dynamic'
          ? resolveDynamicSlotCount(
              prev.layout,
              currentList.length,
              prev.dynamicSlotCount
            )
          : currentList.length;
      const columnLimit = Math.max(
        getLayoutColumns(prev.layout || 'hidden', sizingCount || currentList.length),
        1
      );
      const modules = currentList.map((mod) => {
        if (String(mod._id) !== String(moduleId)) return mod;
        const currentSettings = ensureLayoutDefaults(mod.layoutSettings);
        const merged = {
          ...currentSettings,
          ...nextLayout,
        };
        if (merged.span != null) {
          merged.span = Math.min(
            Math.max(Math.round(merged.span), 1),
            columnLimit
          );
        }
        if (merged.minHeight != null) {
          merged.minHeight = Math.max(
            Math.round(merged.minHeight),
            MIN_MODULE_DIMENSION
          );
        }
        if (merged.slotScaleX != null) merged.slotScaleX = clampSlotScale(merged.slotScaleX);
        if (merged.slotScaleY != null) merged.slotScaleY = clampSlotScale(merged.slotScaleY);
        if (merged.alignX && !ALIGN_TOKENS.includes(merged.alignX)) {
          merged.alignX = currentSettings.alignX;
        }
        if (merged.alignY && !ALIGN_TOKENS.includes(merged.alignY)) {
          merged.alignY = currentSettings.alignY;
        }
        return {
          ...mod,
          layoutSettings: merged,
        };
      });
      return { ...prev, modules };
    });
  }, []);

  const handleModuleTypeChange = useCallback((moduleId, nextType) => {
    setDraftPreset((prev) => {
      if (!prev) return prev;
      const currentModules = Array.isArray(prev.modules) ? prev.modules : [];
      const modules = currentModules.map((mod) => {
        if (String(mod._id) !== String(moduleId)) return mod;
        let content = {};
        if (nextType === 'text') {
          content = { text: typeof mod.content?.text === 'string' ? mod.content.text : '' };
        } else if (nextType === 'image') {
          content = {
            url: typeof mod.content?.url === 'string' ? mod.content.url : '',
            poster: typeof mod.content?.poster === 'string' ? mod.content.poster : '',
            videoUrl: typeof mod.content?.videoUrl === 'string' ? mod.content.videoUrl : '',
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
      const currentModules = Array.isArray(prev.modules) ? prev.modules : [];
      const modules = currentModules.map((mod) => {
        if (String(mod._id) !== String(moduleId)) return mod;
        const content = { ...mod.content };
        if (mod.type === 'text' && field === 'text') {
          content.text = applyTextLimits(value, TEXT_CHAR_LIMIT, MAX_MODULE_NEWLINES);
        } else if (mod.type === 'image') {
          if (field === 'url') content.url = (value || '').slice(0, 1024);
          if (field === 'poster') content.poster = (value || '').slice(0, 1024);
          if (field === 'videoUrl') content.videoUrl = (value || '').slice(0, 1024);
        } else if (mod.type === 'club' && field === 'clubId') {
          content.clubId = value;
        } else if (mod.type === 'prompt') {
          if (field === 'promptKey') content.promptKey = value.slice(0, 80);
          if (field === 'text') {
            content.text = applyTextLimits(value, TEXT_CHAR_LIMIT, MAX_MODULE_NEWLINES);
          }
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
      const sourceModules = Array.isArray(draftPreset.modules)
        ? draftPreset.modules
        : [];
      const slotCount =
        layout.id === 'dynamic'
          ? resolveDynamicSlotCount(
              layout.id,
              sourceModules.length,
              draftPreset.dynamicSlotCount
            )
          : 0;
      const alignedModules = alignModulesWithLayout(sourceModules, layout.id, {
        slotCount: slotCount || undefined,
      });
      const filteredModules = alignedModules.filter((mod) =>
        moduleHasVisibleContentPublic(mod)
      );
      const normalizedModules = filteredModules.map((mod) => {
        const modContent =
          typeof mod.content === 'object' && mod.content ? { ...mod.content } : {};
        if (mod.type === 'text' && typeof modContent.text === 'string') {
          modContent.text = applyTextLimits(
            modContent.text,
            TEXT_CHAR_LIMIT,
            MAX_MODULE_NEWLINES
          );
        }
        if (mod.type === 'prompt' && typeof modContent.text === 'string') {
          modContent.text = applyTextLimits(
            modContent.text,
            TEXT_CHAR_LIMIT,
            MAX_MODULE_NEWLINES
          );
        }
        return { ...mod, content: modContent };
      });
      const resolvedLayoutId = normalizedModules.length > 0 ? layout.id : 'hidden';
      const resolvedSlotCount =
        resolvedLayoutId === 'dynamic'
          ? resolveDynamicSlotCount(
              resolvedLayoutId,
              normalizedModules.length,
              draftPreset.dynamicSlotCount
            )
          : 0;
      const sanitizedDraft = {
        ...draftPreset,
        layout: resolvedLayoutId,
        modules: normalizedModules,
        stickers: Array.isArray(draftPreset.stickers) ? draftPreset.stickers : [],
        canvasColorId: draftPreset.canvasColorId || DEFAULT_CANVAS_COLOR_ID,
        canvasColorAlpha: clamp01(
          typeof draftPreset.canvasColorAlpha === 'number'
            ? draftPreset.canvasColorAlpha
            : DEFAULT_CANVAS_COLOR_ALPHA
        ),
        dynamicSlotCount: resolvedLayoutId === 'dynamic' ? resolvedSlotCount : 0,
        cardBodyColor: draftPreset.cardBodyColor || '#ffffff',
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
        const savedSourceModules = Array.isArray(savedActive.modules)
          ? savedActive.modules
          : [];
        const savedSlotCount =
          savedLayout.id === 'dynamic'
            ? resolveDynamicSlotCount(
                savedLayout.id,
                savedSourceModules.length,
                savedActive.dynamicSlotCount
              )
            : 0;
        const savedModules = alignModulesWithLayout(
          savedSourceModules,
          savedLayout.id,
          {
            slotCount: savedSlotCount || undefined,
          }
        );
        const refreshedPreset = {
          ...savedActive,
          layout: savedLayout.id,
          modules: savedModules,
          stickers: Array.isArray(savedActive.stickers)
            ? [...savedActive.stickers]
            : [],
          stylePreset: savedActive.stylePreset || STYLE_PRESETS[0],
          accentColor: savedActive.accentColor || DEFAULT_ACCENT,
          canvasScale:
            typeof savedActive.canvasScale === 'number'
              ? savedActive.canvasScale
              : 1,
          canvasColorId: savedActive.canvasColorId || DEFAULT_CANVAS_COLOR_ID,
          canvasColorAlpha: clamp01(
            typeof savedActive.canvasColorAlpha === 'number'
              ? savedActive.canvasColorAlpha
              : DEFAULT_CANVAS_COLOR_ALPHA
          ),
          dynamicSlotCount: savedLayout.id === 'dynamic' ? savedSlotCount : 0,
          cardBodyColor: savedActive.cardBodyColor || '#ffffff',
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
        <h2>UniConnect</h2>
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

      <div className="deck" ref={deckRef}>
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
          const resolvedPreset =
            preset ||
            createBioFallbackPreset(user) || {
              layout: 'hidden',
              modules: [],
              stickers: [],
            };
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
                profilePreset={resolvedPreset}
                canvasLayoutId={resolvedPreset ? resolvedPreset.layout : null}
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
                      <div
                        className="customize-preview-card"
                        style={
                          typeof liveCardHeight === 'number'
                            ? { '--profile-card-height': `${liveCardHeight}px` }
                            : undefined
                        }
                      >
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
                          onLayoutMenuClose={handleLayoutMenuClose}
                          onLayoutSelect={handleLayoutMenuSelect}
                          onModuleResize={handleModuleResize}
                          onAddModule={handleAddModule}
                          onRemoveModule={handleRemoveModule}
                          onModuleDelete={handleModuleDelete}
                          onStylePresetCycle={handleCanvasStyleCycle}
                          moduleCount={draftPreset?.modules?.length || 0}
                          maxModules={MAX_CANVAS_MODULES}
                          stylePreset={draftPreset?.stylePreset || STYLE_PRESETS[0]}
                          accentColor={draftPreset?.accentColor || DEFAULT_ACCENT}
                          canvasScale={draftPreset?.canvasScale || 1}
                          canvasColorId={draftPreset?.canvasColorId}
                          canvasColorAlpha={
                            typeof draftPreset?.canvasColorAlpha === 'number'
                              ? draftPreset.canvasColorAlpha
                              : undefined
                          }
                          onCanvasScaleChange={handleCanvasScaleChange}
                          onCanvasColorChange={handleCanvasColorChange}
                          onCanvasOpacityChange={handleCanvasOpacityChange}
                          onAccentColorChange={handleAccentColorChange}
                          onCardBodyColorChange={handleCardBodyColorChange}
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
