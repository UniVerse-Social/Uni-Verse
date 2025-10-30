import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_URL, DEFAULT_BANNER_URL } from '../config';
import UserLink from "../components/UserLink";
import { getHobbyEmoji } from '../utils/hobbies';

// ---------- Minimal styles (scoped via classNames) ----------
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

/* Mobile: lay out title on its own row; input + tags on the next row */
@media (max-width: 768px) {
  .titantap-header {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "title title"
      "input tags";
    gap: 8px;
    align-items: center;
  }
  .titantap-header h2 { grid-area: title; font-size: 20px; }
  .titantap-header input { grid-area: input; }
  .titantap-header .tag-trigger { grid-area: tags; }
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
  height: 480px;
  margin-top: 20px;
  perspective: 10px;
  padding: 0 8px; /* keep edges off the screen on phones */
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
  height: 460px;
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
}
.card-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: -70px;
  padding: 12px 16px;
  width: calc(100% - 18px);
  align-self: center;
  background: rgba(255,255,255,0.82);
  border-radius: 20px;
  border: 1px solid rgba(148,163,184,0.22);
  box-shadow: 0 12px 24px rgba(15,23,42,0.15), 0 4px 8px rgba(37,99,235,0.1);
  position: relative;
  z-index: 2;
}
@media (max-width: 600px) {
  .card-hero {
    width: calc(100% - 10px);
    padding: 12px 14px;
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
  font-size: 22px;
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
  font-size: 11px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 999px;
  background: #0f172a;
  color: #fff;
  letter-spacing: 0.02em;
}
.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.meta-chip {
  padding: 5px 8px;
  border-radius: 11px;
  font-size: 11px;
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
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
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
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(241,245,249,0.92);
  border: 1px solid rgba(148,163,184,0.45);
  font-size: 20px;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border 0.18s ease;
  padding-left: 2px;
  padding-top: 0px;
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
    height: calc(100vh - 280px - var(--nav-mobile) - env(safe-area-inset-bottom, 0px));
  }
  .card {
    /* never exceed viewport; still looks like the desktop card */
    height: min(460px, calc(100vh - 340px - var(--nav-mobile) - env(safe-area-inset-bottom, 0px)));
  }
}


.controls { display: flex; justify-content: center; gap: 12px; margin-top: 16px; }
.controls button { padding: 10px 16px; border-radius: 999px; border: 1px solid #111; background: #fff; color: #111; cursor: pointer; }
.controls .ghost { background: #fff; color: #111; }

/* Mobile: ensure controls never sit under the fixed nav */
@media (max-width: 600px) {
  .controls { padding-bottom: calc(8px + var(--nav-mobile) + env(safe-area-inset-bottom, 0px)); }
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

const GAME_KEYS = ['chess', 'checkers', 'fishing', 'poker', 'reversi', 'jump', 'oddeven'];

function getCurrentUserId() {
  try {
    const u = localStorage.getItem('user') || localStorage.getItem('currentUser');
    if (u) {
      const parsed = JSON.parse(u);
      return parsed?._id || parsed?.id || parsed?.userId || null;
    }
  } catch {}
  return localStorage.getItem('userId') || localStorage.getItem('uid') || null;
}

function getCurrentUserProfile() {
  try {
    const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

async function api(path, { method = 'GET', body } = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(
      `API returned non-JSON. Check API base URL/proxy. First bytes: ${text.slice(0, 60)}...`
    );
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.message || 'Request failed');
  }
  return res.json();
}

function SwipeableCard({ user, viewer, clubsMap, onDecision }) {
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [rot, setRot] = useState(0);
  const [released, setReleased] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const tooltipTimerRef = useRef(null);
  const skipSwipeRef = useRef(false);

  const handlePointerDown = (e) => {
    if (released) return;
    if (e.target.closest('a, button, [data-skip-swipe]')) {
      skipSwipeRef.current = true;
      return;
    }
    skipSwipeRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e) => {
    if (released || skipSwipeRef.current) return;
    if (!(e.buttons & 1)) return;
    const nextDx = dx + (e.movementX || 0);
    const nextDy = dy + (e.movementY || 0);
    setDx(nextDx); setDy(nextDy); setRot(nextDx / 12);
  };
  const handlePointerUp = () => {
    if (skipSwipeRef.current) {
      skipSwipeRef.current = false;
      setDx(0);
      setDy(0);
      setRot(0);
      return;
    }
    if (released) return;
    const threshold = 120;
    if (dx > threshold) { setReleased(true); onDecision('right', user); }
    else if (dx < -threshold) { setReleased(true); onDecision('left', user); }
    else { setDx(0); setDy(0); setRot(0); }
  };

  const style = { transform: `translate(calc(-50% + ${dx}px), ${dy}px) rotate(${rot}deg)`, transition: released ? 'transform 250ms ease-out' : 'transform 0s' };

  /* compute badges for display (title first, then slots 1-4) */
  const equipped = Array.isArray(user.badgesEquipped) ? user.badgesEquipped.slice(0, 5) : [];
  const title = user.titleBadge || equipped[0] || null;
  const badgeLine = (() => {
    const out = [];
    if (title) out.push(title);
    for (let i = 0; i < equipped.length; i++) {
      if (i === 0 && equipped[0] === title) continue;
      const b = equipped[i];
      if (b && !out.includes(b)) out.push(b);
    }
    return out.slice(0, 5);
  })();

  const leadBadge = badgeLine[0] || null;
  const supportingBadges = badgeLine.slice(1).filter((b) => b && b !== leadBadge);

  const viewerHobbiesSource = viewer?.hobbies;
  const viewerHobbies = useMemo(() => {
    const raw = Array.isArray(viewerHobbiesSource) ? viewerHobbiesSource : [];
    return new Set(raw);
  }, [viewerHobbiesSource]);

  const viewerClubsSource = viewer?.clubs;
  const viewerClubIds = useMemo(() => {
    const out = new Set();
    const raw = Array.isArray(viewerClubsSource) ? viewerClubsSource : [];
    raw.forEach((club) => {
        if (!club) return;
        if (typeof club === 'string') {
          out.add(String(club));
        } else if (typeof club === 'object') {
          const id = club._id || club.id || club.clubId;
          if (id) out.add(String(id));
        }
      });
    return out;
  }, [viewerClubsSource]);

  const userHobbiesSource = user?.hobbies;
  const userInterests = useMemo(
    () => (Array.isArray(userHobbiesSource) ? userHobbiesSource : []),
    [userHobbiesSource]
  );
  const orderedInterests = useMemo(() => {
    if (!userInterests.length) return [];
    const common = [];
    const others = [];
    userInterests.forEach((interest) => {
      if (viewerHobbies.has(interest)) common.push(interest);
      else others.push(interest);
    });
    return [...common, ...others];
  }, [userInterests, viewerHobbies]);
  const mutualInterests = useMemo(
    () => orderedInterests.filter((h) => viewerHobbies.has(h)),
    [orderedInterests, viewerHobbies]
  );

  const showTooltip = useCallback((target, message, variant = 'default', sourceType = null, sourceValue = null) => {
    if (!target || typeof window === 'undefined') return;
    const targetRect = target.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const rawLeft = targetRect.left + targetRect.width / 2;
    const rawTop = targetRect.top;
    let align = 'center';
    const edgeThreshold = 120;
    if (rawLeft < edgeThreshold) align = 'left';
    else if (viewportWidth - rawLeft < edgeThreshold) align = 'right';

    let clampedLeft = rawLeft;
    if (align === 'left') {
      clampedLeft = Math.max(16, rawLeft);
    } else if (align === 'right') {
      clampedLeft = Math.min(viewportWidth - 16, rawLeft);
    } else {
      clampedLeft = Math.max(16, Math.min(rawLeft, viewportWidth - 16));
    }
    const clampedTop = Math.max(32, rawTop);

    setTooltip({
      id: `${Date.now()}-${Math.random()}`,
      message,
      variant,
      left: clampedLeft,
      top: clampedTop,
      align,
      sourceType,
      sourceValue,
    });

    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
    }
    tooltipTimerRef.current = setTimeout(() => {
      setTooltip(null);
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (tooltip?.sourceType === 'interest' && tooltip.sourceValue && !userInterests.includes(tooltip.sourceValue)) {
      setTooltip(null);
    }
  }, [tooltip, userInterests]);

  const hasDepartmentMatch =
    !!viewer?.department &&
    !!user?.department &&
    viewer.department === user.department;

  const metaChips = [];
  if (user.department) {
    metaChips.push({
      label: user.department,
      icon: '🏛️',
      match: hasDepartmentMatch,
      type: 'department',
    });
  }
  if (user.classStanding || user.classYear || user.gradYear) {
    const label =
      user.classStanding ||
      (user.classYear ? `Class of ${user.classYear}` : null) ||
      (user.gradYear ? `Class of ${user.gradYear}` : null);
    if (label) metaChips.push({ label, icon: '🎓', type: 'class' });
  }
  if (typeof user.major === 'string' && user.major.trim()) {
    metaChips.push({ label: user.major.trim(), icon: '📘', type: 'major' });
  }
  const userClubsSource = user?.clubs;
  const userClubsData = useMemo(
    () => (Array.isArray(userClubsSource) ? userClubsSource : []),
    [userClubsSource]
  );

  const sharedClubInfos = useMemo(() => {
    const lookup = clubsMap instanceof Map ? clubsMap : null;
    const results = [];
    userClubsData.forEach((club) => {
      let id = null;
      let name = '';
      if (typeof club === 'string') {
        id = club;
      } else if (club) {
        id = club._id || club.id || club.clubId || null;
        name = club.name || club.title || club.label || '';
      }
      if (!id) return;
      const lookupEntry = lookup ? lookup.get(String(id)) : null;
      if (lookupEntry) {
        name = lookupEntry.name || lookupEntry.title || name || 'Club';
      } else if (!name) {
        name = 'Club';
      }
      if (viewerClubIds.has(String(id)) && !results.includes(name)) {
        results.push(name);
      }
    });
    return results;
  }, [userClubsData, clubsMap, viewerClubIds]);

  const handleMetaChipClick = useCallback(
    (target, chip) => {
      if (!chip) return;
      let message = chip.label;
      let variant = chip.match ? 'mutual' : 'default';
      const formatList = (items) => {
        if (!Array.isArray(items) || !items.length) return '';
        if (items.length === 1) return items[0];
        if (items.length === 2) return `${items[0]} and ${items[1]}`;
        const last = items[items.length - 1];
        return `${items.slice(0, -1).join(', ')} and ${last}`;
      };

      if (chip.match) {
        if (chip.type === 'department') {
          message = `You both are in the ${chip.label} department!`;
        } else if (chip.type === 'club') {
          const listText = formatList(sharedClubInfos);
          message = listText ? `You both are in ${listText}!` : `You both are in this club!`;
        }
      }

      showTooltip(target, message, variant, chip.type, chip.match ? chip.label : null);
    },
    [showTooltip, sharedClubInfos]
  );
  const locationLabel =
    (typeof user.location === 'string' && user.location.trim()) ||
    (typeof user.city === 'string' && user.city.trim()) ||
    '';
  if (locationLabel) {
    metaChips.push({ label: locationLabel, icon: '📍', type: 'location' });
  }

  const bannerUrl = user.bannerPicture || DEFAULT_BANNER_URL;
  const rawBio = user.bio || user.statusMessage || user.tagline || '';
  const bioSnippet = typeof rawBio === 'string' ? rawBio.trim() : '';

  return (
    <div
      className="card-wrap"
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="card">
        <div
          className="card-banner"
          style={{ backgroundImage: `url(${bannerUrl})` }}
          aria-hidden="true"
        />
        <div className="card-body">
          <div className="card-hero">
            <div className={`card-avatar ${user.profilePicture ? '' : 'initials'}`}>
              {user.profilePicture ? (
                <img src={user.profilePicture} alt={user.username || 'user'} />
              ) : (
                <span>{(user.username || '?').slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="card-hero-info">
              <div className="card-name-row">
                <div className="card-name">
                  <UserLink username={user.username} hideBadge>{user.username}</UserLink>
                </div>
                {user.pronouns && (
                  <span className="card-pronouns">{user.pronouns}</span>
                )}
                {leadBadge && (
                  <span className="card-title-badge">{leadBadge}</span>
                )}
              </div>
              {metaChips.length > 0 && (
                <div className="card-meta" aria-label="Profile highlights">
                  {metaChips.map((chip, idx) => (
                    <button
                      type="button"
                      key={`${chip.label}-${idx}`}
                      className={`meta-chip ${chip.match ? 'match' : ''}`}
                      data-skip-swipe
                      onClick={(e) => handleMetaChipClick(e.currentTarget, chip)}
                    >
                      {chip.avatar ? (
                        <span className="meta-chip-avatar" aria-hidden="true">
                          <img src={chip.avatar} alt="" />
                        </span>
                      ) : (chip.icon || chip.fallbackIcon) && (
                        <span className="emoji" aria-hidden>
                          {chip.icon || chip.fallbackIcon}
                        </span>
                      )}
                      <span>{chip.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {supportingBadges.length > 0 && (
            <div className="card-badges" aria-label="Equipped badges">
              {supportingBadges.map((b, i) => (
                <span key={`${b}-${i}`} className="card-badge">
                  {b}
                </span>
              ))}
            </div>
          )}

          {orderedInterests.length > 0 && (
            <>
              <div className="interest-cloud" aria-label="Interests">
                {orderedInterests.map((interest) => {
                  const isCommon = viewerHobbies.has(interest);
                  const isDimmed = mutualInterests.length > 0 && !isCommon;
                  return (
                    <button
                      key={interest}
                      type="button"
                      className={`interest-dot ${isCommon ? 'common' : ''} ${
                        isDimmed ? 'dimmed' : ''
                      }`}
                      data-skip-swipe
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                      onClick={(e) =>
                        showTooltip(
                          e.currentTarget,
                          isCommon
                            ? `You both enjoy ${interest}!`
                            : `${user?.username || 'They'} enjoys ${interest}!`,
                          isCommon ? 'mutual' : 'default',
                          'interest',
                          interest
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          showTooltip(
                            e.currentTarget,
                            isCommon
                              ? `You both enjoy ${interest}!`
                              : `${user?.username || 'They'} enjoys ${interest}!`,
                            isCommon ? 'mutual' : 'default',
                            'interest',
                            interest
                          );
                        }
                      }}
                      aria-label={
                        isCommon
                          ? `${interest}, shared interest`
                          : `${interest} interest`
                      }
                    >
                      {getHobbyEmoji(interest)}
                    </button>
                  );
                })}
              </div>
              {tooltip && typeof document !== 'undefined' &&
                createPortal(
                  <div
                    key={tooltip.id}
                    className={`tooltip-bubble ${tooltip.variant === 'mutual' ? 'mutual' : ''} ${tooltip.align ? `align-${tooltip.align}` : ''}`}
                    style={{ left: tooltip.left, top: tooltip.top }}
                    role="status"
                    aria-live="polite"
                  >
                    <span>{tooltip.message}</span>
                  </div>,
                  document.body
                )}
            </>
          )}

          {bioSnippet && (
            <div className="bio-snippet" aria-label="Bio">
              {bioSnippet.length > 180 ? `${bioSnippet.slice(0, 177)}…` : bioSnippet}
            </div>
          )}

          <div className="card-footer">
            <span className="swipe-hint">
              Drag right to connect, left to pass
            </span>
          </div>

          {mutualInterests.length > 0 && (
            <div className="mutual-count" role="status">
              <strong>
                {mutualInterests.length} mutual interest
                {mutualInterests.length === 1 ? '' : 's'}
              </strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const TitanTap = () => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [justFollowed, setJustFollowed] = useState(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [activeTags, setActiveTags] = useState([]);
  const [tagData, setTagData] = useState({ loaded: false, hobbies: [], departments: [], clubs: [], leaderboardMap: {} });
  const [tagLoading, setTagLoading] = useState(false);
  const [tagError, setTagError] = useState('');

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
            api(`/api/games/leaderboard/${key}?limit=50`).catch(() => ({ leaders: [] }))
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
        departments: Array.isArray(signupRes?.departments) ? signupRes.departments : [],
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
  
  useEffect(() => {
    (async () => {
      if (!userId) { setLoading(false); setError('Sign in required to load suggestions.'); return; }
      try { setLoading(true); const data = await api(`/api/users/titantap/${userId}`); setDeck(Array.isArray(data) ? data : []); }
      catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [userId]);

  useEffect(() => {
    if (showTagPicker) ensureTagData();
  }, [showTagPicker, ensureTagData]);

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
        if (hasTags) params.set('tags', activeTags.map((tag) => tag.key).join(','));
        const data = await api(`/api/users/search?${params.toString()}`);
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (e) { setError(e.message); }
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
      const userClubs = Array.isArray(user?.clubs) ? user.clubs.map((c) => String(c)) : [];
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

  const filteredDeck = useMemo(() => {
    const base = !activeTags.length ? deck : deck.filter((user) => matchesAllTags(user));
    return sortByLeaderboardRank(base);
  }, [deck, activeTags, matchesAllTags, sortByLeaderboardRank]);

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
      try { await api(`/api/users/${user._id}/follow`, { method: 'PUT', body: { userId } }); setJustFollowed(user); }
      catch (e) { setError(e.message); }
    }
    setDeck(prev => prev.filter(u => u._id !== user._id));
  };

  const programmaticSwipe = async (direction) => {
    const top = filteredDeck[filteredDeck.length - 1];
    if (!top) return;
    await decideTop(direction, top);
  };

  const followFromSearch = async (targetId, isFollowing) => {
    if (!userId) return setError('Sign in required.');
    try {
      await api(`/api/users/${targetId}/follow`, { method: 'PUT', body: { userId } });
      setSearchResults(prev => prev.map(u => u._id === targetId ? { ...u, isFollowing: !isFollowing } : u));
    } catch (e) { setError(e.message); }
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
        <button
          type="button"
          className="tag-trigger"
          onClick={() => setShowTagPicker((prev) => !prev)}
          aria-expanded={showTagPicker}
        >
          Tags
        </button>
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
            <button type="button" className="close" onClick={() => setShowTagPicker(false)} aria-label="Close tag picker">×</button>
          </header>
          {tagError && <div className="tag-error">{tagError}</div>}
          {tagLoading ? (
            <div className="note" style={{ padding: '8px 0' }}>Loading tags…</div>
          ) : (
            tagsCatalog.length > 0 ? (
              tagsCatalog.map((section) => (
                <div key={section.id} className="tag-section">
                  <h4>{section.title}</h4>
                  <div className="tag-pills">
                    {section.tags.map((tag) => (
                      <button
                        key={tag.key}
                        type="button"
                        className={`tag-pill ${isTagActive(tag.key) ? 'active' : ''}`}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="note" style={{ padding: '8px 0' }}>No tags available right now.</div>
            )
          )}
        </div>
      )}

      {error && <div className="note">{error}</div>}

      {(query.trim() || activeTags.length > 0) && (
        <div className="search-results">
          {filteredSearchResults.length === 0 ? (
            <div className="note">No results for the current filters.</div>
          ) : (
            filteredSearchResults.map(u => (
              <div key={u._id} className="result-row">
                <div className="res-avatar" aria-hidden>
                  {u.profilePicture ? <img src={u.profilePicture} alt={u.username} /> : <span style={{ fontWeight: 700 }}>{(u.username || '?').slice(0,1).toUpperCase()}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="res-name">
                    <UserLink username={u.username}>{u.username}</UserLink>
                  </div>
                  <div className="res-sub">{u.department ? `Dept: ${u.department}` : ''}</div>
                  {Array.isArray(u.hobbies) && u.hobbies.length > 0 && (
                    <div className="chips">
                      {u.hobbies.slice(0,4).map((h,i) => (
                        <span key={i} className="chip" title={h}>
                          <span className="chip-emoji" aria-hidden="true">{getHobbyEmoji(h)}</span>
                          {h}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <button
                    onClick={() => followFromSearch(u._id, !!u.isFollowing)}
                    className={u.isFollowing ? 'ghost' : ''}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #111', background: u.isFollowing ? '#111' : '#fff', color: u.isFollowing ? '#fff' : '#111', cursor: 'pointer' }}
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
            {activeTags.length ? 'No suggestions match the selected tags yet.' : 'No more suggestions right now.'}
          </div>
        )}
        {filteredDeck.map((user, idx) => (
          <div
            key={user._id}
            style={{
              zIndex: 1000 + (filteredDeck.length - idx),
              opacity: idx === 0 ? 1 : 0,
              pointerEvents: idx === 0 ? 'auto' : 'none',
              transition: 'opacity 160ms ease'
            }}
          >
            <SwipeableCard
              user={user}
              viewer={viewerProfile}
              clubsMap={clubDirectory}
              onDecision={decideTop}
            />
          </div>
        ))}
      </div>

      <div className="controls">
        <button className="ghost" onClick={() => programmaticSwipe('left')}>Pass</button>
        <button onClick={() => programmaticSwipe('right')}>Connect</button>
      </div>

      {justFollowed && <div className="toast" role="status" aria-live="polite">Followed {justFollowed.username}</div>}
    </div>
  );
};

export default TitanTap;
