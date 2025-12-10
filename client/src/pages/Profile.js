import React, { useState, useEffect, useContext, useCallback, useRef, useMemo } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../App';
import { API_BASE_URL } from '../config';
import Post from '../components/Post';
import EditProfileModal from '../components/EditProfileModal';
import ImageCropModal from '../components/ImageCropModal';
import { FaCamera } from 'react-icons/fa';
import { FiSettings, FiLogOut, FiTrash2, FiX } from 'react-icons/fi';
import FollowersModal from '../components/FollowersModal';
import HobbiesModal from '../components/HobbiesModal';
import { getHobbyEmoji, HOBBY_LIMIT } from '../utils/hobbies';
import { adminDeleteUserByUsername } from '../api';
import LetterAvatar from '../components/LetterAvatar';

/* --------------------------- Styled Components --------------------------- */

const Page = styled.div`
  background: var(--background-grey);
  color: var(--text-color);
  min-height: 100vh;
  width: 100%;
  position: relative;
  width: 100%;
  overflow-x: hidden; 

  /* guard rails: children can't widen the page */
  & * { box-sizing: border-box; }
  & img, & video { max-width: 100%; height: auto; }
`;

const Content = styled.div`
  max-width: 975px;
  width: 100%;
  margin: 0 auto;
  padding: 0 20px;
  box-sizing: border-box;

  @media (max-width: 480px) { padding: 0 12px; }
`;

const GlobalClamp = createGlobalStyle`
  html, body, #root {
    margin: 0;
    padding: 0;
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;      /* ← hard stop for the right overhang */
  }
  *, *::before, *::after { box-sizing: border-box; }
  img, video { max-width: 100%; height: auto; }
`;

const BannerWrap = styled.div`
  position: relative;
  height: 250px;
  background-color: none;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  overflow: hidden;
  object-fit: cover;

  @media (max-width: 768px) { height: 220px; }
  @media (max-width: 480px) { height: 109px; }
`;

const BannerImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const BannerEditButton = styled.label`
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 5;
  background-color: rgba(255, 255, 255, 0.9);
  color: #333;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: all 0.2s ease-in-out;

  &:hover { background-color: #fff; transform: translateY(-2px); }

  @media (max-width: 480px) {
    top: 75px;
    right: 8px;
    bottom: auto;
    padding: 6px 10px;
    font-size: 12px;
  }
`;

const BannerScrim = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(
      to bottom,
      rgba(15,23,42,.30) 0%,
      rgba(15,23,42,.50) 60%,
      rgba(15,23,42,.72) 100%
    );
`;

const HiddenFileInput = styled.input` display: none; `;

const Header = styled.div`
  display: flex;
  flex-wrap: nowrap;               /* keep everything on one line */
  align-items: center;             /* avatar/name/gear share a baseline */
  gap: 20px;
  padding: 0 20px 16px 20px;
  margin-top: -64px;               /* less overlap so username never clips */
  position: relative;
  border-bottom: 1px solid #ddd;
  margin-bottom: 20px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;

  @media (max-width: 768px) { gap: 16px; margin-top: -56px; }
  @media (max-width: 480px) {
    gap: 12px;
    padding: 0 12px 12px 12px;
    margin-top: -44px;
  }
`;

const AvatarWrap = styled.div`
  position: relative;
  width: clamp(56px, 18vw, 168px);
  height: clamp(56px, 18vw, 168px);
  flex: 0 0 auto;

  @media (max-width: 768px) {
    width: clamp(56px, 22vw, 120px);
    height: clamp(56px, 22vw, 120px);
  }
`;

const AvatarFrame = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  border: 4px solid #f0f2f5;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  background: #fff;
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const AvatarUpload = styled.label`
  position: absolute;
  bottom: 10px;
  right: 10px;
  background-color: var(--border-color);
  color: var(--text-color);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  cursor: pointer;
  border: 2px solid var(--container-white);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  transition: all 0.2s;
  &:hover { filter: brightness(0.95); }
`;

/* Info + Settings can wrap; prevent overflows */
const InfoAndActions = styled.div`
  flex: 1 1 0%;
  display: grid;                                  /* gear stays at the far right */
  grid-template-columns: minmax(0, 1fr) auto;     /* info | gear */
  align-items: center;                             /* level with name/stats */
  column-gap: 12px;
  padding-bottom: 10px;
  min-width: 0;                                   /* let the info column shrink */
  & > div:last-child { justify-self: end; }
  @media (max-width: 600px) {
    /* Let the action cell size to its content; tighten the gap */
    grid-template-columns: 1fr max-content;
    column-gap: 8px;
  }
`;

const Info = styled.div`
  padding-top: clamp(48px, 9vw, 72px);  /* always clear of the banner overlap */
  min-width: 0;                         /* prevents pushing the gear to a new row */
`;

const Username = styled.h3`
  font-size: clamp(16px, 4.8vw, 32px); /* give a bit more room on mobile */
  font-weight: 700;
  margin: 0 0 4px 0;
  color: #fff;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Stats = styled.div`
  display: flex;
  gap: clamp(6px, 2vw, 14px);
  flex-wrap: nowrap;                 /* stay on one line */
  font-size: clamp(10px, 3vw, 16px); /* shrink a bit more on phones */
  color: #fff;
  margin-bottom: 4px;
  min-width: 0;

  /* keep each “X posts / Y followers / Z following” together */
  & > * {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    white-space: nowrap;
    min-width: 0;
  }
  @media (max-width: 600px) {
    flex-wrap: wrap;
    row-gap: 2px;
  }
`;

const CountNumber = styled.strong`
  display: inline-block;
  &.bump { animation: bump 0.35s ease; }
  &.shake { animation: shake 0.35s ease; }

  @keyframes bump {
    0% { transform: scale(1); }
    30% { transform: scale(1.2); }
    70% { transform: scale(0.95); }
    100% { transform: scale(1); }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-3px); }
    75% { transform: translateX(3px); }
  }
`;

const Bio = styled.p`
  margin: 8px 0 0 0;
  color: #fff;
  font-size: 16px;
`;

const InterestsBar = styled.div`
  margin: 12px 20px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
  color: #f9fafb;

  @media (max-width: 480px) {
    margin: 12px 0 0;   /* flush to edges like Clubs chips row */
    gap: 8px;
  }
`;

const InterestsTitle = styled.span`
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.15px;
  flex: 0 0 auto; /* do not shrink away */
  white-space: nowrap;
`;

const InterestsList = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const InterestDot = styled.span`
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  font-size: 24px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);

  @media (max-width: 480px) { width: 30px; height: 30px; font-size: 18px; }
`;

const InterestTooltip = styled.div`
  position: fixed;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 10px));
  padding: 8px 12px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
  background: rgba(255,255,255,0.96);
  border: 1px solid rgba(71,85,105,0.28);
  box-shadow: 0 14px 26px rgba(15,23,42,0.18);
  max-width: 240px;
  text-align: center;
  z-index: 3500;
  line-height: 1.4;
`;

const InterestsHint = styled.span`
  font-size: 12px;
  color: rgba(249, 250, 251, 0.75);
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (max-width: 480px) { display: none; } /* keep it one line on phones */
`;

const ManageInterestsButton = styled.button`
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(15, 23, 42, 0.35);
  color: #f9fafb;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  margin-left: auto;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.1s ease;
  flex-shrink: 0; /* don’t compress into the right edge */

  &:hover { background: rgba(255, 255, 255, 0.2); transform: translateY(-1px); }
  @media (max-width: 480px) { padding: 4px 10px; font-size: 12px; }
`;

const BadgesRow = styled.div`
  display: flex;
  flex-wrap: nowrap;                           /* keep all 5 on one line */
  align-items: center;
  gap: clamp(6px, 1.6vw, 10px);
  margin-top: 10px;
  overflow: hidden;                            /* avoid horizontal jiggle */
`;

const SlotWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
`;

const SlotLabel = styled.span`
  margin-top: 6px;
  font-size: 11px;
  color: #e5e7eb;
  @media (max-width: 480px) { display: none; }
`;

const BadgeSlot = styled.button`
  width: clamp(28px, 8.5vw, 48px);
  height: clamp(28px, 8.5vw, 48px);
  border-radius: 50%;
  position: relative;
  display: grid;
  place-items: center;
  cursor: ${p => p.$clickable ? 'pointer' : 'default'};
  transition: transform .1s ease, box-shadow .18s ease;
  /* glassy chip look to match Clubs chips */
  background: rgba(255,255,255,0.08);
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 6px rgba(0,0,0,0.18);
  color: var(--text-color);
  &:hover { transform: ${p => p.$clickable ? 'translateY(-1px)' : 'none'}; }

  /* when filled, give a subtle gradient ring */
  ${p => p.$filled && `
    background: var(--container-white);
    border: 2px solid transparent;
    box-shadow:
      0 2px 10px rgba(0,0,0,0.22),
      0 0 0 2px rgba(255,255,255,0.06);
    &::after{
      content:'';
      position:absolute; inset:-2px;
      border-radius:50%;
      padding:2px; pointer-events:none;
      background: linear-gradient(90deg, var(--primary-orange), #59D0FF);
      -webkit-mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
              mask-composite: exclude;
    }
  `}
`;

const PlusDot = styled.span`
  position: absolute;
  right: 0;
  bottom: 0;
  transform: translate(35%, 35%);
  width: clamp(9px, 2.4vw, 14px);
  height: clamp(9px, 2.4vw, 14px);
  border-radius: 50%;
  background: linear-gradient(90deg, var(--primary-orange), #59D0FF);
  color: #fff;
  display: ${p => (p.$show ? 'grid' : 'none')};
  place-items: center;
  font-size: clamp(9px, 2.6vw, 12px);
  border: 2px solid var(--container-white);
  font-weight: 200;
  pointer-events: none;
`;

const BadgeEmoji = styled.span`
  font-size: clamp(12px, 3.6vw, 20px);  /* scales with the slot */
  line-height: 1;
`;

/* ---- Badges Modal ---- */

const ModalBackdrop = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: grid; place-items: center;
  z-index: 2200; /* above top/bottom nav and DM pill */
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overscroll-behavior: contain;
`;

const ModalCard = styled.div`
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 28px 60px rgba(0,0,0,0.35);
  width: min(640px, 96vw);
  max-height: calc(100vh - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  padding: 18px;
`;

const ModalHeader = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
  h3 { margin: 0; font-size: 18px; }
  button { border: none; background: transparent; cursor: pointer; font-size: 20px; color: #666; &:hover { color: #000; } }
`;

const MenuDivider = styled.div` height: 1px; background: #eee; margin: 10px 0; `;

const ModalBody = styled.div` font-size: 14px; color: var(--text-color); `;

const SlotsBar = styled.div`
  display: flex;
  gap: 12px;
  row-gap: 8px;
  margin-bottom: 12px;
  align-items: center;
  flex-wrap: wrap; /* let Unequip wrap on narrow screens */
`;

const SlotMini = styled(BadgeSlot)`
  width: 40px;
  height: 40px;
  border: 1px solid var(--border-color);
  ${p => p.$active && `box-shadow: 0 0 0 2px var(--container-white), 0 0 0 4px rgba(89,208,255,.45);`}
`;

const BadgeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
`;

const BadgeCard = styled.button`
  border: 1px solid var(--border-color);
  background: ${p => p.$unlocked ? 'var(--container-white)' : 'rgba(0,0,0,0.03)'};
  color: var(--text-color);
  border-radius: 10px;
  padding: 10px;
  text-align: left;
  cursor: ${p => p.$unlocked ? 'pointer' : 'not-allowed'};
  opacity: ${p => p.$unlocked ? 1 : 0.5};
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 10px;
  align-items: center;
  &:hover { box-shadow: ${p => p.$unlocked ? '0 4px 12px rgba(0,0,0,0.08)' : 'none'}; }
`;

const BadgeIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  display: grid;
  place-items: center;
  background: #fff;
  font-size: 18px;
`;

const BadgeName = styled.div` font-weight: 700; `;
const BadgeMeta = styled.div` font-size: 12px; color: #6b7280; `;

const PrimaryButton = styled.button`
  padding: clamp(6px, 1.6vw, 10px) clamp(10px, 3vw, 20px);
  border-radius: 999px;
  font-weight: 800;
  font-size: clamp(12px, 3.3vw, 16px);
  cursor: pointer;
  border: 1px solid var(--border-color);
  max-width: 100%;
  white-space: nowrap;
  flex-shrink: 0;
  color: ${p => (p.$primary ? '#fff' : 'var(--text-color)')};
  background: ${p =>
    p.$primary
      ? 'linear-gradient(90deg, var(--primary-orange), #59D0FF)'
      : 'rgba(255,255,255,0.08)'};
  &:hover { filter: brightness(0.98); }
`;

const ThreeDotsButton = styled.button`
  padding: clamp(4px, 1vw, 8px);
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.08);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  /* Keeps the button a perfect circle */
  width: clamp(28px, 4vw, 36px);
  height: clamp(28px, 4vw, 36px);

  &:hover { filter: brightness(0.95); }

  /* Optional: make the dots scale smoothly */
  font-size: clamp(14px, 3vw, 18px);
  color: var(--text-color);
`;

const PopupMenu = styled.div`
  position: absolute;
  top: 100%; /* directly below the button */
  right: 0;
  background: #1a1a1a;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 12px;
  margin-top: 4px;
  white-space: nowrap;
  z-index: 100;
`;

const BlockText = styled.span`
  color: red;
  cursor: pointer;
`;

/* Themed input for delete-confirm field */
const ModalInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: rgba(255,255,255,0.03);
  color: var(--text-color);
  &::placeholder { color: rgba(230,233,255,0.55); }
`;

/* Admin “Delete account” button that shrinks like Follow */
const DangerButton = styled.button`
  padding: clamp(6px, 1.6vw, 10px) clamp(8px, 2.6vw, 16px);
  border-radius: 6px;
  font-weight: 700;
  font-size: clamp(12px, 3vw, 16px);
  border: 1px solid var(--border-color);
  background: #c62828;
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
`;

/* Right-column container for actions (settings/follow/delete) */
const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  justify-self: end;

  @media (max-width: 600px) {
    /* Keep actions in the right column, but STACK them vertically */
    flex-direction: column;
    align-items: stretch;                /* make both buttons equal width */
    gap: 6px;
    max-width: min(48vw, 240px);         /* cap column width so info doesn't squish */
    & > * { width: 100%; }               /* Follow on top, Delete account under it */
  }
`;
const PostsGrid = styled.div`
  padding-top: 20px;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;

  & > * { max-width: 100%; }
`;

/* ---------- Settings UI (gear + dropdown) ---------- */

const SettingsWrap = styled.div`
  position: relative;
  display: inline-block;
  margin-left: auto;           /* pinned to the far right of the grid */
  flex: 0 0 auto;
  align-self: center;          /* level with name/stats */
`;

const SettingsButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(36px, 9vw, 40px);
  height: clamp(36px, 9vw, 40px);
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: rgba(255,255,255,0.08);
  color: #d1d5db;
  cursor: pointer;
  transition: background .18s ease, transform .08s ease;
  &:hover { background: rgba(255,255,255,0.16); transform: translateY(-1px); }
`;

/* The menu already has max-width; keep it hugging the right edge */
const SettingsMenu = styled.div`
  position: absolute;
  top: 48px;
  right: 0;
  z-index: 20;
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 18px 36px rgba(0,0,0,0.28);
  min-width: 240px;
  max-width: 92vw;
  overflow: hidden;
  padding: 6px 0;
`;

const SettingsItem = styled.button`
  width: 100%;
  padding: 12px 14px;
  text-align: left;
  display: flex;
  gap: 10px;
  align-items: center;
  border: none;
  background: transparent;
  cursor: pointer;
  font-weight: 700;
  color: ${p => (p.className?.includes('danger') ? '#ff5861' : 'var(--text-color)')};
  &:hover { background: rgba(255,255,255,0.06); }
`;

/* --------------------------- Constants --------------------------- */

const DEFAULT_BANNER_DATA = 'https://dslv9ilpbe7p1.cloudfront.net/jT7zrQp7WtGXTdoT3rpLxg_store_banner_image.jpeg';

/* --------------------------- Component --------------------------- */

const Profile = () => {
  // Core state
  const [userOnPage, setUserOnPage] = useState(null);
  const [posts, setPosts] = useState([]);
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, login } = useContext(AuthContext);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followerAnim, setFollowerAnim] = useState('');
  const [followingAnim, setFollowingAnim] = useState('');

  // Crop state
  const [imageToCrop, setImageToCrop] = useState(null);
  const [bannerToCrop, setBannerToCrop] = useState(null);

  // Settings UI
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(null);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Followers modal
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showHobbiesModal, setShowHobbiesModal] = useState(false);
  const [pfpBroken, setPfpBroken] = useState(false);
  const [interestTooltip, setInterestTooltip] = useState(null);
  const interestTooltipTimerRef = useRef(null);

  // Badges state
  const [badges, setBadges] = useState({ catalog: [], unlocked: [], equipped: ['', '', '', '', ''] });
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [activeSlot, setActiveSlot] = useState(0);
  const onAdminDeleteUser = async () => {
    if (!currentUser?.isAdmin) return;

    // Ultra-defensive: pull the username from the loaded profile,
    // the route param, or the URL slug.
    const slug = (typeof window !== 'undefined'
      ? decodeURIComponent((window.location.pathname.split('/profile/')[1] || '').split('/')[0])
      : '');
    const targetUsername = (userOnPage?.username || username || slug || '').trim();

    if (!targetUsername) {
      alert('No username found for this profile.');
      return;
    }

    if (!window.confirm(`Admin action: permanently delete ${targetUsername}? This cannot be undone.`)) return;

    try {
      await adminDeleteUserByUsername(targetUsername);
      alert('Account deleted.');
      navigate('/');
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete user.';
      alert(msg);
    }
  };
  // Reset stale state on route change (prevents ghosts from previous profile)
  useEffect(() => {
    setUserOnPage(null);
    setPosts([]);
    setShowFollowers(false);
    setShowFollowing(false);
    setInterestTooltip(null);
  }, [username]);

  useEffect(() => () => {
    if (interestTooltipTimerRef.current) {
      clearTimeout(interestTooltipTimerRef.current);
    }
  }, []);

  // Fetch profile and posts
  const fetchUserAndPosts = useCallback(async () => {
    try {
      const userRes = await axios.get(`/api/users/profile/${username}`);
      const viewerParam = currentUser?._id ? `?viewerId=${currentUser._id}` : '';
      const postsRes = await axios.get(`/api/posts/profile/${username}${viewerParam}`);

      const rawUser = userRes.data;
      const profileUser =
        rawUser && typeof rawUser === 'object' && rawUser.user
          ? rawUser.user          // common pattern: { user: {...} }
          : rawUser;              // or just the user itself

      setUserOnPage(profileUser);

      // Normalise posts into an array
      const rawPosts = postsRes.data;
      const normalizedPosts = Array.isArray(rawPosts)
        ? rawPosts
        : Array.isArray(rawPosts?.posts)
          ? rawPosts.posts
          : [];

      setPosts(normalizedPosts);
    } catch (err) {
      console.error('Error fetching profile data:', err);
    }
  }, [username, currentUser?._id]);

  useEffect(() => { fetchUserAndPosts(); }, [fetchUserAndPosts]);

  useEffect(() => {
    if (!userOnPage) {
      setFollowerCount(0);
      setFollowingCount(0);
      return;
    }
    setFollowerCount(Array.isArray(userOnPage.followers) ? userOnPage.followers.length : 0);
    setFollowingCount(Array.isArray(userOnPage.following) ? userOnPage.following.length : 0);
  }, [userOnPage]);

  useEffect(() => {
    if (!userOnPage?._id) return undefined;
    let cancelled = false;

    const refreshCounts = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users/${userOnPage._id}/follow-stats`);
        if (cancelled) return;
        const followers = Number(res.data?.followers) || 0;
        const following = Number(res.data?.following) || 0;

        setFollowerCount((prev) => {
          if (prev !== followers) {
            setFollowerAnim(followers > prev ? 'bump' : 'shake');
          }
          return followers;
        });
        setFollowingCount((prev) => {
          if (prev !== following) {
            setFollowingAnim(following > prev ? 'bump' : 'shake');
          }
          return following;
        });
      } catch (err) {
        // best-effort; ignore errors
      }
    };

    refreshCounts();
    const timer = setInterval(refreshCounts, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [userOnPage?._id]);

  useEffect(() => {
    if (!followerAnim) return;
    const id = setTimeout(() => setFollowerAnim(''), 450);
    return () => clearTimeout(id);
  }, [followerAnim]);

  useEffect(() => {
    if (!followingAnim) return;
    const id = setTimeout(() => setFollowingAnim(''), 450);
    return () => clearTimeout(id);
  }, [followingAnim]);

  // Follow state
  useEffect(() => {
    if (userOnPage && currentUser) {
      setIsFollowing(Array.isArray(userOnPage.followers) && userOnPage.followers.includes(currentUser._id));
    }
  }, [userOnPage, currentUser]);

  useEffect(() => {
    if (!userOnPage || !currentUser) return;
    setPfpBroken(false);
    // Only redirect if we're truly viewing our *own* profile route.
    const viewingOwnRoute = username === currentUser.username;

    if (
      viewingOwnRoute &&
      String(userOnPage._id) === String(currentUser._id) &&
      userOnPage.username !== username
    ) {
      navigate(`/profile/${userOnPage.username}`, { replace: true });
    }
  }, [userOnPage, currentUser, username, navigate]);
  
  // Close settings when clicking outside
  useEffect(() => {
    function onDocClick(e) {
      if (!settingsRef.current) return;
      if (settingsRef.current.contains(e.target)) return;
      setShowSettings(false);
    }
    if (showSettings) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
  }, [showSettings]);

  // File select → preview for cropper
  const handleFileChange = (e, setImageState) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImageState(reader.result);
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  // Crop → upload
  const handleCropComplete = async (croppedImageBlobUrl, imageType) => {
    try {
      const response = await fetch(croppedImageBlobUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result;
        const res = await axios.put(
          `/api/users/${currentUser._id}`,
          { userId: currentUser._id, [imageType]: base64data }
        );
        login(res.data);
        setUserOnPage(res.data);
        setImageToCrop(null);
        setBannerToCrop(null);
      };
    } catch (err) {
      console.error('Failed to upload cropped image', err);
      setImageToCrop(null);
      setBannerToCrop(null);
    }
  };

  // Update Profile after editing profile in modal
  const handleProfileUpdate = (updatedUserData) => setUserOnPage(updatedUserData);

  const handleSaveHobbies = async (nextHobbies) => {
    if (!currentUser) {
      throw new Error('You must be signed in to update hobbies.');
    }
    if (!userOnPage || String(currentUser._id) !== String(userOnPage._id)) {
      throw new Error('You can only update your own hobbies.');
    }
    try {
      const safeList = Array.isArray(nextHobbies) ? nextHobbies.slice(0, HOBBY_LIMIT) : [];
      const res = await axios.put(
        `/api/users/${currentUser._id}`,
        { userId: currentUser._id, hobbies: safeList }
      );
      login(res.data);
      setUserOnPage(res.data);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to update hobbies.';
      throw new Error(msg);
    }
  };

  // Follow/unfollow
  const handleFollow = async () => {
    if (!userOnPage || !currentUser) return;
    try {
      const res = await axios.put(`${API_BASE_URL}/api/users/${userOnPage._id}/follow`, { userId: currentUser._id });
      const message = res.data?.message || '';
      const followersCount = typeof res.data?.followersCount === 'number' ? res.data.followersCount : null;
      const nowFollowing = message.toLowerCase().includes('followed');
      const viewerIdStr = String(currentUser._id);
      const targetIdStr = String(userOnPage._id);

      setIsFollowing(nowFollowing);

      setUserOnPage((prev) => {
        if (!prev) return prev;
        const prevFollowers = Array.isArray(prev.followers) ? prev.followers.map(String) : [];
        let nextFollowers = prevFollowers;
        if (nowFollowing) {
          if (!prevFollowers.includes(viewerIdStr)) nextFollowers = [...prevFollowers, viewerIdStr];
        } else {
          nextFollowers = prevFollowers.filter((id) => id !== viewerIdStr);
        }
        return { ...prev, followers: nextFollowers };
      });

      const previousCount = followerCount;
      const nextCount = followersCount !== null
        ? followersCount
        : (nowFollowing ? previousCount + 1 : Math.max(0, previousCount - 1));
      setFollowerCount(nextCount);
      setFollowerAnim(nextCount >= previousCount ? 'bump' : 'shake');

      if (typeof login === 'function') {
        const prevFollowing = Array.isArray(currentUser.following)
          ? currentUser.following.map(String)
          : [];
        let nextFollowing = prevFollowing;
        if (nowFollowing) {
          if (!prevFollowing.includes(targetIdStr)) nextFollowing = [...prevFollowing, targetIdStr];
        } else {
          nextFollowing = prevFollowing.filter((id) => id !== targetIdStr);
        }
        if (nextFollowing !== prevFollowing) {
          login({ ...currentUser, following: nextFollowing });
        }
        if (String(currentUser._id) === targetIdStr) {
          const prevFollowingCount = followingCount;
          const nextFollowingCount = nextFollowing.length;
          setFollowingCount(nextFollowingCount);
          setFollowingAnim(nextFollowingCount >= prevFollowingCount ? 'bump' : 'shake');
        }
      }
    } catch (err) { console.error('Failed to follow/unfollow:', err); }
  };

  // Post update/delete handlers
  const handlePostUpdated = (updatedPost) => {
    setPosts((current) => current.map((p) => (p._id === updatedPost._id ? updatedPost : p)));
  };
  const handlePostDeleted = (postId) => {
    setPosts((current) => current.filter((p) => p._id !== postId));
  };

  // Logout
  const handleLogout = () => {
    try { if (typeof window !== 'undefined') localStorage.clear(); }
    finally { window.location.href = '/login'; }
  };

  // Delete account flow
  const requestDeleteAccount = () => { setDeleteConfirmText(''); setShowDeleteModal(true); setShowSettings(false); };
  const doDeleteAccount = async () => {
    if (!currentUser) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') { alert('Please type DELETE to confirm.'); return; }
    try {
      await axios.delete(`/api/users/${currentUser._id}`, { data: { userId: currentUser._id } });
    } catch (err) { console.error('Failed to delete account', err); alert('Failed to delete account.'); return; }
    handleLogout();
  };

  const isOwnProfile = !!currentUser && !!userOnPage && String(currentUser._id) === String(userOnPage._id);
  const viewerHobbies = useMemo(
    () => new Set(Array.isArray(currentUser?.hobbies) ? currentUser.hobbies : []),
    [currentUser?.hobbies]
  );
  const viewedUserHobbies = useMemo(
    () => (Array.isArray(userOnPage?.hobbies) ? userOnPage.hobbies : []),
    [userOnPage?.hobbies]
  );
  // Three dots popup state
  const [showThreeDotsPopup, setShowThreeDotsPopup] = useState(false);
  const threeDotsRef = useRef(null);


  /* ---- Badges helpers ---- */

  const fetchBadges = useCallback(async () => {
    if (!userOnPage?._id) return;
    try {
      const res = await axios.get(`/api/users/${userOnPage._id}/badges`);
      const { catalog = [], unlocked = [], equipped = [] } = res.data || {};
      setBadges({
        catalog,
        unlocked: Array.isArray(unlocked) ? unlocked : [],
        equipped: Array.isArray(equipped) ? equipped : ['', '', '', '', ''],
      });
    } catch (e) {
      console.error('Failed to load badges', e);
    }
  }, [userOnPage?._id]);

  useEffect(() => { if (userOnPage?._id) fetchBadges(); }, [userOnPage?._id, fetchBadges]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (threeDotsRef.current && !threeDotsRef.current.contains(event.target)) {
        setShowThreeDotsPopup(false);
      }
    };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);


  const openBadgesModal = (slotIndex) => {
    setActiveSlot(slotIndex);
    setShowBadgesModal(true);
  };

  const equipToSlot = async (slotIndex, badgeName) => {
    if (!isOwnProfile) return;
    try {
      const res = await axios.post(`/api/users/${currentUser._id}/badges/equip`, {
        userId: currentUser._id,
        slot: slotIndex,
        badgeName: badgeName ?? null,
      });
      const { unlocked = [], equipped = [] } = res.data || {};
      setBadges((b) => ({ ...b, unlocked, equipped }));
    } catch (e) {
      console.error('Equip badge failed', e);
      alert(e?.response?.data?.message || 'Failed to equip badge');
    }
  };

  const showInterestTooltip = useCallback(
    (target, interest) => {
      if (!target || typeof window === 'undefined') return;
      const rect = target.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const rawLeft = rect.left + rect.width / 2;
      const rawTop = rect.top;
      const edgeThreshold = 120;
      let align = 'center';
      if (rawLeft < edgeThreshold) align = 'left';
      else if (viewportWidth - rawLeft < edgeThreshold) align = 'right';

      let clampedLeft = rawLeft;
      if (align === 'left') clampedLeft = Math.max(16, rawLeft);
      else if (align === 'right') clampedLeft = Math.min(viewportWidth - 16, rawLeft);
      else clampedLeft = Math.max(16, Math.min(rawLeft, viewportWidth - 16));
      const clampedTop = Math.max(32, rawTop);

      let message;
      const safeInterest = interest || '';
      if (isOwnProfile) {
        message = `You enjoy ${safeInterest}!`;
      } else if (viewerHobbies.has(safeInterest)) {
        message = `You both enjoy ${safeInterest}!`;
      } else {
        message = `${userOnPage?.username || 'They'} enjoys ${safeInterest}!`;
      }

      setInterestTooltip({
        id: `${Date.now()}-${Math.random()}`,
        message,
        left: clampedLeft,
        top: clampedTop,
        align,
        interest: safeInterest,
      });

      if (interestTooltipTimerRef.current) {
        clearTimeout(interestTooltipTimerRef.current);
      }
      interestTooltipTimerRef.current = setTimeout(() => {
        setInterestTooltip(null);
      }, 2000);
    },
    [isOwnProfile, viewerHobbies, userOnPage?.username]
  );

  useEffect(() => {
    if (interestTooltip && interestTooltip.interest && !viewedUserHobbies.includes(interestTooltip.interest)) {
      setInterestTooltip(null);
    }
  }, [interestTooltip, viewedUserHobbies]);

  /* --------------------------- Render --------------------------- */

  if (!userOnPage) return <Page>Loading...</Page>;

  return (
    <>
      {interestTooltip && typeof document !== 'undefined' &&
        createPortal(
          <InterestTooltip
            style={{
              left: interestTooltip.left,
              top: interestTooltip.top,
              transform:
                interestTooltip.align === 'left'
                  ? 'translate(0, calc(-100% - 10px))'
                  : interestTooltip.align === 'right'
                    ? 'translate(-100%, calc(-100% - 10px))'
                    : 'translate(-50%, calc(-100% - 10px))',
            }}
            role="status"
            aria-live="polite"
          >
            {interestTooltip.message}
          </InterestTooltip>,
          document.body
        )}
      <GlobalClamp />
      {/* Crop modals */}
      {imageToCrop && (
        <ImageCropModal
          imageSrc={imageToCrop}
          onClose={() => setImageToCrop(null)}
          onCropComplete={(url) => handleCropComplete(url, 'profilePicture')}
          aspect={1}
          cropShape="round"
        />
      )}
      {bannerToCrop && (
        <ImageCropModal
          imageSrc={bannerToCrop}
          onClose={() => setBannerToCrop(null)}
          onCropComplete={(url) => handleCropComplete(url, 'bannerPicture')}
          aspect={1200 / 350}
          cropShape="rect"
        />
      )}

      {/* Edit profile modal */}
      {isEditModalOpen && (
        <EditProfileModal
          user={userOnPage}
          onClose={() => setIsEditModalOpen(false)}
          onProfileUpdate={handleProfileUpdate}
        />
      )}

      {/* Delete confirm modal */}
      {showDeleteModal && (
        <ModalBackdrop role="dialog" aria-modal="true">
          <ModalCard>
            <ModalHeader>
              <h3>Delete account</h3>
              <button aria-label="Close" onClick={() => setShowDeleteModal(false)}><FiX /></button>
            </ModalHeader>
            <ModalBody>
              <p>This will permanently delete your account and all of your posts. This action cannot be undone.</p>
              <p>To confirm, type <b>DELETE</b> below:</p>
              <ModalInput
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
              />
            </ModalBody>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <PrimaryButton onClick={() => setShowDeleteModal(false)}>Cancel</PrimaryButton>
              <PrimaryButton $primary onClick={doDeleteAccount} disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE'} title="Type DELETE to enable">Delete account</PrimaryButton>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* Badges modal */}
      {showBadgesModal && (
        <ModalBackdrop role="dialog" aria-modal="true" onClick={() => setShowBadgesModal(false)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <h2>Your Badges</h2>
              <button aria-label="Close" onClick={() => setShowBadgesModal(false)}><FiX /></button>
            </ModalHeader>

            <ModalBody>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                Click a badge to equip it to the selected slot. Slot 0 is your <b>Title</b> badge.
              </div>

              <SlotsBar>
                {badges.equipped.map((name, i) => {
                  const meta = badges.catalog.find(b => b.name === name);
                  const emoji = meta?.icon || (name ? '🏅' : '');
                  return (
                    <SlotMini
                      key={i}
                      $active={activeSlot === i}
                      $filled={!!name}
                      $clickable={isOwnProfile}
                      onClick={() => setActiveSlot(i)}
                      title={i === 0 ? 'Title Slot' : `Slot ${i+1}`}
                    >
                      {name ? <BadgeEmoji>{emoji}</BadgeEmoji> : '+'}
                    </SlotMini>
                  );
                })}
                {badges.equipped[activeSlot] && (
                  <PrimaryButton style={{ marginLeft: 'auto' }} onClick={() => equipToSlot(activeSlot, '')}>
                    Unequip
                  </PrimaryButton>
                )}
              </SlotsBar>

              <MenuDivider />

              <BadgeGrid>
                {badges.catalog.map((b) => {
                  const unlocked = badges.unlocked.includes(b.name);
                  const equippedHere = badges.equipped.includes(b.name);
                  return (
                    <BadgeCard
                      key={b.name}
                      $unlocked={unlocked}
                      onClick={() => unlocked && equipToSlot(activeSlot, b.name)}
                      title={unlocked ? `Equip "${b.name}"` : 'Locked'}
                    >
                      <BadgeIcon>{b.icon || '🏅'}</BadgeIcon>
                      <div>
                        <BadgeName>
                          {b.name} {equippedHere ? '• Equipped' : ''}
                        </BadgeName>
                        <BadgeMeta>
                          {unlocked ? 'Unlocked' : 'Locked'}
                        </BadgeMeta>
                      </div>
                    </BadgeCard>
                  );
                })}
              </BadgeGrid>
            </ModalBody>
          </ModalCard>
        </ModalBackdrop>
      )}

      <HobbiesModal
        open={showHobbiesModal}
        selected={Array.isArray(userOnPage.hobbies) ? userOnPage.hobbies : []}
        onClose={() => setShowHobbiesModal(false)}
        onSave={handleSaveHobbies}
      />

      {/* Main page */}
      <Page>
        <BannerWrap>
          <BannerImage src={userOnPage.bannerPicture || DEFAULT_BANNER_DATA} alt="Banner" />
          <BannerScrim /> {/* ← keeps white text readable on any banner */}
          {isOwnProfile && (
            <>
              <HiddenFileInput type="file" id="bannerUpload" accept="image/*" onChange={(e) => handleFileChange(e, setBannerToCrop)} />
              <BannerEditButton htmlFor="bannerUpload"><FaCamera /> Edit cover photo</BannerEditButton>
            </>
          )}
        </BannerWrap>

        <Content>
          <Header>
            <AvatarWrap>
              <AvatarFrame>
                {userOnPage.profilePicture && !pfpBroken ? (
                  <AvatarImg
                    src={userOnPage.profilePicture}
                    alt="Profile"
                    onError={() => setPfpBroken(true)}
                  />
                ) : (
                  <LetterAvatar name={userOnPage.username} size="100%" />
                )}
              </AvatarFrame>
              {isOwnProfile && (
                <>
                  <HiddenFileInput type="file" id="profilePicUpload" accept="image/*" onChange={(e) => handleFileChange(e, setImageToCrop)} />
                  <AvatarUpload htmlFor="profilePicUpload" title="Change profile picture"><FaCamera /></AvatarUpload>
                </>
              )}
            </AvatarWrap>

            <InfoAndActions>
              <Info>
                <Username>{userOnPage.username}</Username>

                <Stats>
                  <span><strong>{posts.length}</strong> posts</span>

                  {isOwnProfile ? (
                    <button style={{ all: 'unset', cursor: 'pointer', color: '#fff' }} onClick={() => setShowFollowers(true)} title="View your followers">
                      <CountNumber className={followerAnim}>{followerCount}</CountNumber> followers
                    </button>
                  ) : (
                    <span style={{ color: '#fff' }}>
                      <CountNumber className={followerAnim}>{followerCount}</CountNumber> followers
                    </span>
                  )}

                  {isOwnProfile ? (
                    <button style={{ all: 'unset', cursor: 'pointer', color: '#fff' }} onClick={() => setShowFollowing(true)} title="View who you follow">
                      <CountNumber className={followingAnim}>{followingCount}</CountNumber> following
                    </button>
                  ) : (
                    <span style={{ color: '#fff' }}>
                      <CountNumber className={followingAnim}>{followingCount}</CountNumber> following
                    </span>
                  )}
                </Stats>

                {/* ---- Five badge slots under stats ---- */}
                <BadgesRow>
                  {Array.from({ length: 5 }).map((_, i) => {
                    const name = badges.equipped[i];
                    const meta = badges.catalog.find(b => b.name === name);
                    const emoji = meta?.icon || (name ? '🏅' : '');
                    const label = i === 0 ? 'Title' : `Badge ${i+1}`;
                    const clickable = isOwnProfile;
                    return (
                      <SlotWrap key={i}>
                        <BadgeSlot
                          aria-label={label}
                          $filled={!!name}
                          $clickable={clickable}
                          onClick={() => clickable && openBadgesModal(i)}
                          title={clickable ? `Click to set ${label}` : label}
                        >
                          {name ? <BadgeEmoji>{emoji}</BadgeEmoji> : <span style={{ opacity: 0.6 }}>+</span>}
                          <PlusDot $show={isOwnProfile}>+</PlusDot>
                        </BadgeSlot>
                        <SlotLabel>{label}</SlotLabel>
                      </SlotWrap>
                    );
                  })}
                </BadgesRow>

                <Bio>
                  {userOnPage.bio ||
                    `Welcome to ${(userOnPage.username || username || 'this user')}'s page!`}
                </Bio>
              </Info>

              <Actions ref={settingsRef}>
                {isOwnProfile ? (
                  <SettingsWrap>
                    <SettingsButton aria-label="Settings" onClick={() => setShowSettings((v) => !v)} title="Settings">
                      <FiSettings />
                    </SettingsButton>

                    {showSettings && (
                      <SettingsMenu>
                        <SettingsItem onClick={() => { setIsEditModalOpen(true); setShowSettings(false); }}>
                          <FiSettings /> Edit profile
                        </SettingsItem>
                        <SettingsItem onClick={handleLogout}><FiLogOut /> Log out</SettingsItem>
                        <MenuDivider />
                        <SettingsItem className="danger" onClick={requestDeleteAccount}><FiTrash2 /> Delete account</SettingsItem>
                      </SettingsMenu>
                    )}
                  </SettingsWrap>
                ) : (
                  currentUser && (
                    <>
                      <PrimaryButton $primary={!isFollowing} onClick={handleFollow}>
                        {isFollowing ? 'Unfollow' : 'Follow'}
                      </PrimaryButton>
                      <div style={{ position: 'relative' }} ref={threeDotsRef}>
                      <ThreeDotsButton onClick={() => setShowThreeDotsPopup(prev => !prev)}>
                        ⋯
                      </ThreeDotsButton>
                      {showThreeDotsPopup && (
                        <PopupMenu>
                          <BlockText onClick={() => alert('Block user clicked!')}>
                            Block User
                          </BlockText>
                        </PopupMenu>
                      )}
                    </div>
                      {currentUser.isAdmin && String(currentUser._id) !== String(userOnPage?._id) && (
                        <DangerButton
                          onClick={onAdminDeleteUser}
                          title="Admin: permanently delete this account"
                          aria-label="Delete account"
                        >
                          Delete account
                        </DangerButton>
                      )}
                    </>
                  )
                )}
              </Actions>
            </InfoAndActions>
          </Header>

          {(isOwnProfile || (Array.isArray(userOnPage.hobbies) && userOnPage.hobbies.length > 0)) && (
            <InterestsBar>
              <InterestsTitle>Interests</InterestsTitle>

              {Array.isArray(userOnPage.hobbies) && userOnPage.hobbies.length > 0 ? (
                <InterestsList aria-label="Selected interests">
                  {userOnPage.hobbies.map((hobby) => (
                    <InterestDot
                      key={hobby}
                      title={hobby}
                      aria-label={hobby}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => showInterestTooltip(e.currentTarget, hobby)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          showInterestTooltip(e.currentTarget, hobby);
                        }
                      }}
                    >
                      {getHobbyEmoji(hobby)}
                    </InterestDot>
                  ))}
                </InterestsList>
              ) : (
                <InterestsHint>
                  {isOwnProfile
                    ? 'Add a few so Titans know what you are into.'
                    : 'No interests shared yet.'}
                </InterestsHint>
              )}

              {isOwnProfile && (
                <ManageInterestsButton type="button" onClick={() => setShowHobbiesModal(true)}>
                  {Array.isArray(userOnPage.hobbies) && userOnPage.hobbies.length ? 'Edit' : 'Add'}
                </ManageInterestsButton>
              )}
            </InterestsBar>
          )}

          <PostsGrid>
            {Array.isArray(posts) &&
              posts.map((post) => (
                <Post
                  key={post._id}
                  post={post}
                  viewer={currentUser}
                  onPostUpdated={handlePostUpdated}
                  onPostDeleted={handlePostDeleted}
                />
              ))}
          </PostsGrid>

          {/* Only allow viewing these lists on your own profile */}
          {isOwnProfile && showFollowers && (
            <FollowersModal
              userId={userOnPage._id}
              me={currentUser}
              type="followers"
              myFollowing={currentUser?.following || []}
              onClose={() => setShowFollowers(false)}
            />
          )}
          {isOwnProfile && showFollowing && (
            <FollowersModal
              userId={userOnPage._id}
              me={currentUser}
              type="following"
              myFollowing={currentUser?.following || []}
              onClose={() => setShowFollowing(false)}
            />
          )}
        </Content>
      </Page>
    </>
  );
};

export default Profile;
