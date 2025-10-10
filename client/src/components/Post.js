import React, { useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { FaHeart, FaRegHeart, FaCommentAlt, FaRegCommentAlt, FaEllipsisH } from 'react-icons/fa';
import axios from 'axios';
import { AuthContext } from '../App';
import { toMediaUrl, API_BASE_URL } from '../config';
import EditPostModal from './EditPostModal';
import CommentDrawer from './CommentDrawer';
import {
  createStickerPlacement,
  updateStickerPlacement,
  deleteStickerPlacement,
  updateStickerSettings,
} from '../utils/stickers';



/* Hardcoded default avatar (always available) */
const FALLBACK_AVATAR =
  'https://www.clipartmax.com/png/middle/72-721825_tuffy-tuffy-the-titan-csuf.png';

/* Stick-with-fallback image */
function SmartImg({ src, fallback, alt = '', ...imgProps }) {
  const [useSrc, setUseSrc] = React.useState(src || fallback);
  const [errored, setErrored] = React.useState(false);
  const prev = React.useRef(src);

  React.useEffect(() => {
    if (prev.current !== src) {
      prev.current = src;
      setErrored(false);
      setUseSrc(src || fallback);
    }
  }, [src, fallback]);

  return (
    <img
      alt={alt}
      {...imgProps}
      src={useSrc || fallback}
      onError={() => {
        if (!errored) {
          setErrored(true);
          setUseSrc(fallback);
        }
      }}
    />
  );
}

const PostContainer = styled.div`
  background: var(--container-white);
  border: 1px solid ${(p) => (p.$dragOver ? 'rgba(59,130,246,0.75)' : 'var(--border-color)')};
  border-radius: 12px;
  box-shadow: ${(p) =>
    p.$dragOver ? '0 0 0 3px rgba(59,130,246,0.18)' : '0 4px 16px rgba(0,0,0,0.06)'};
  padding: 16px;
  margin: 0 0 20px 0;
  width: 100%;
  box-sizing: border-box;
  position: relative;
  transition: border 0.18s ease, box-shadow 0.18s ease;
`;

const PostHeader = styled.div` display: flex; align-items: center; margin-bottom: 12px; `;
const ProfilePic = styled(SmartImg)` width: 42px; height: 42px; border-radius: 50%; background-color: #eee; margin-right: 12px; object-fit: cover; `;
const UserInfo = styled.div` display: flex; flex-direction: column; flex-grow: 1; `;

const UsernameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const Username = styled(Link)` font-weight: 800; color: #111; text-decoration: none; `;

const TitleBadge = styled.span`
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #111;
  border: 1px solid var(--border-color);
`;

const Timestamp = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
  flex-wrap: wrap;
`;
const DateLabel = styled.span`
  font-weight: 600;
  color: #374151;
`;
const EditedStamp = styled.span`
  font-size: 11px;
  color: #9ca3af;
`;
const PostContent = styled.p` font-size: 16px; line-height: 1.5; margin: 0 0 12px 0; white-space: pre-wrap; word-break: break-word; color: #111; `;
const PostActions = styled.div` display: flex; align-items: center; gap: 20px; color: #374151; `;
const Action = styled.div` display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px; `;
const OptionsButton = styled.div` cursor: pointer; padding: 6px; border-radius: 8px; &:hover { background-color: #f3f4f6; } `;
const DropdownMenu = styled.div`
  position: absolute; background: #fff; border-radius: 12px;
  border: 1px solid var(--border-color); box-shadow: 0 12px 28px rgba(0,0,0,0.12); z-index: 10; overflow: hidden;
  top: 44px; right: 16px;
`;
const DropdownItem = styled.div` padding: 12px 16px; cursor: pointer; &:hover { background-color: #f3f4f6; } `;

const CommentPreviewInline = styled.span`
  color: #64748b;
  font-size: 12px;
  margin-left: 8px;
  flex: 1;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StickerCanvas = styled.div`
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  overflow: visible;
`;

const StickerItem = styled.div`
  position: absolute;
  pointer-events: ${(p) => (p.$interactive ? 'auto' : 'none')};
  cursor: ${(p) => (p.$interactive ? 'grab' : 'default')};
  transform-origin: center;
  transition: opacity 0.2s ease, filter 0.2s ease;
  opacity: ${(p) => (p.$muted ? 0.35 : 1)};
  will-change: transform, opacity;
  z-index: ${(p) => (p.$selected ? 7 : 5)};
  user-select: none;
  filter: ${(p) => (p.$selected ? 'drop-shadow(0 0 0.6rem rgba(59,130,246,0.5))' : 'none')};
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:active {
    cursor: ${(p) => (p.$interactive ? 'grabbing' : 'default')};
  }

  span {
    display: block;
    font-size: 48px;
    line-height: 1;
    pointer-events: none;
  }

  img {
    width: 64px;
    height: 64px;
    object-fit: contain;
    pointer-events: none;
  }
`;

const StickerSettingsPanel = styled.div`
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px dashed rgba(148, 163, 184, 0.65);
  background: rgba(226, 232, 240, 0.3);
  display: grid;
  gap: 12px;
`;

const StickerSettingsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const StickerSettingsLabel = styled.label`
  font-size: 13px;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const StickerSettingsTextarea = styled.textarea`
  border: 1px solid rgba(148, 163, 184, 0.55);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 13px;
  min-height: 54px;
  resize: vertical;
  width: 100%;
`;

const StickerSettingsActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`;

const StickerSettingsButton = styled.button`
  border-radius: 8px;
  padding: 6px 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #2563eb;
  background: ${(p) => (p.$primary ? '#2563eb' : 'transparent')};
  color: ${(p) => (p.$primary ? '#fff' : '#2563eb')};
  transition: background 0.2s ease, color 0.2s ease;

  &:hover {
    background: ${(p) => (p.$primary ? '#1e3a8a' : 'rgba(37, 99, 235, 0.12)')};
    color: ${(p) => (p.$primary ? '#fff' : '#1e3a8a')};
  }
`;

const StickerSettingsHint = styled.p`
  font-size: 12px;
  color: #64748b;
  margin: 0;
`;

const DAY_MS = 1000 * 60 * 60 * 24;

const formatRelativeLabel = (createdAt) => {
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return '';
  const now = new Date();
  const diffMs = now - createdDate;
  if (diffMs < 0) return 'Just now';
  const diffDays = Math.floor(diffMs / DAY_MS);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 4) return `${diffDays} days ago`;
  if (diffDays < 7) return '1 week ago';
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 8) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
};

const makeSnippet = (body) => {
  const cleaned = String(body || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
};
const ICON_SIZE = 16;
const HEART_COLOR = "#ef4444";
const COMMENT_COLOR = "#2563eb";

const STICKER_MIN_SCALE = 0.4;
const STICKER_MAX_SCALE = 2.5;
const ROTATION_COEFFICIENT = 0.6;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const getStickerId = (sticker) => (sticker?.id || sticker?._id || null);

const isStickerDragEvent = (event) => {
  const types = event?.dataTransfer?.types;
  if (!types) return false;
  if (typeof types.includes === 'function') {
    return types.includes('application/x-sticker-key');
  }
  const arr = Array.from(types);
  return arr.includes('application/x-sticker-key');
};

const MediaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(${p => Math.min(p.$count, 2)}, 1fr);
  gap: 8px;
  margin-bottom: 10px;
  img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    border-radius: 10px; border: 1px solid var(--border-color);
    background: #f8f9fb;
  }
`;

const Post = ({ post, onPostDeleted, onPostUpdated }) => {
  const { user: currentUser } = useContext(AuthContext);
  const [likeCount, setLikeCount] = useState(post.likes.length);
  const [isLiked, setIsLiked] = useState(currentUser ? post.likes.includes(currentUser._id) : false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [textContent, setTextContent] = useState(post.textContent);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(
    typeof post.commentCount === 'number'
      ? post.commentCount
      : Array.isArray(post.comments)
        ? post.comments.length
        : 0
  );
  const initialPreview = post.commentPreview
    ? {
        ...post.commentPreview,
        snippet: makeSnippet(post.commentPreview.body ?? post.commentPreview.snippet ?? ''),
      }
    : null;
  const [commentPreview, setCommentPreview] = useState(initialPreview);
  const [hasCommented, setHasCommented] = useState(Boolean(post.viewerCommented));
  const initialEdited =
    post.updatedAt && post.updatedAt !== post.createdAt ? new Date(post.updatedAt) : null;
  const [lastEdited, setLastEdited] = useState(initialEdited);
  const [stickers, setStickers] = useState(
    Array.isArray(post.stickers) ? post.stickers : []
  );
  const isOwner = currentUser && (currentUser._id === post.userId || currentUser.username === post.username);
  const [stickersMuted, setStickersMuted] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const holdTimerRef = useRef(null);

  const applyPreview = useCallback((payload) => {
    if (!payload) {
      setCommentPreview(null);
      return;
    }
    const snippet = makeSnippet(payload.body ?? payload.snippet ?? '');
    if (!snippet) {
      setCommentPreview(null);
      return;
    }
    setCommentPreview({
      type: payload.type === 'top' ? 'top' : 'latest',
      username: payload.username || 'user',
      snippet,
    });
  }, []);

  useEffect(() => {
    if (typeof post.commentCount === 'number') {
      setCommentCount(post.commentCount);
    }
    if (post.commentPreview) {
      applyPreview(post.commentPreview);
    } else {
      setCommentPreview(null);
    }
    if (typeof post.viewerCommented === 'boolean') {
      setHasCommented(post.viewerCommented);
    }
    if (post.updatedAt && post.updatedAt !== post.createdAt) {
      setLastEdited(new Date(post.updatedAt));
    } else {
      setLastEdited(null);
    }
  }, [post.commentCount, post.commentPreview, post.viewerCommented, post.updatedAt, post.createdAt, applyPreview]);

  useEffect(() => {
    setStickers(Array.isArray(post.stickers) ? post.stickers : []);
  }, [post.stickers]);

  const stickerSettings = post.stickerSettings || {};
  const allowlist = Array.isArray(stickerSettings.allowlist) ? stickerSettings.allowlist : [];
  const denylist = Array.isArray(stickerSettings.denylist) ? stickerSettings.denylist : [];
  const allowMode = stickerSettings.allowMode || 'everyone';
  const [selectedStickerId, setSelectedStickerId] = useState(null);
  const containerRef = useRef(null);
  const dragSessionRef = useRef(null);
  const [dragSession, setDragSession] = useState(null);
  const rotationActiveRef = useRef(false);
  const stickersRef = useRef(stickers);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({
    allowMode,
    allowlist: allowlist.join(', '),
    denylist: denylist.join(', '),
    sticky: Boolean(stickerSettings.sticky),
  });

  const canPlaceStickers = useMemo(() => {
    if (!currentUser?._id) return false;
    if (String(currentUser._id) === String(post.userId)) return true;
    if (denylist.some((id) => String(id) === String(currentUser._id))) return false;
    if (allowlist.length && !allowlist.some((id) => String(id) === String(currentUser._id))) return false;
    if (allowMode === 'none') return false;
    return true;
  }, [currentUser?._id, post.userId, allowlist, denylist, allowMode]);
  useEffect(() => {
    stickersRef.current = stickers;
  }, [stickers]);

  useEffect(() => {
    if (!settingsOpen) return;
    setSettingsDraft({
      allowMode,
      allowlist: allowlist.join(', '),
      denylist: denylist.join(', '),
      sticky: Boolean(stickerSettings.sticky),
    });
  }, [settingsOpen, allowMode, allowlist, denylist, stickerSettings.sticky]);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearHoldTimer(), [clearHoldTimer]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const viewerParam = currentUser?._id ? `?viewerId=${encodeURIComponent(currentUser._id)}` : '';
        const res = await axios.get(`${API_BASE_URL}/api/comments/post/${post._id}/count${viewerParam}`);
        if (!cancelled) {
          const count = Number(res.data?.count) || 0;
          setCommentCount(count);
          applyPreview(count > 0 ? res.data?.preview : null);
          setHasCommented(Boolean(res.data?.userCommented));
        }
      } catch (err) {
        console.error('Failed to load comment count', err);
      }
    })();
    return () => { cancelled = true; };
  }, [post._id, applyPreview, currentUser?._id]);

  const handleHoldStart = useCallback(
    (event) => {
      if (event.button !== 0) return;
      const tag = (event.target?.tagName || '').toLowerCase();
      if (['button', 'a', 'input', 'textarea', 'svg', 'path'].includes(tag)) return;
      if (event.target?.closest?.('[data-ignore-hold]')) return;
      clearHoldTimer();
      holdTimerRef.current = setTimeout(() => {
        setStickersMuted((prev) => !prev);
        holdTimerRef.current = null;
      }, 325);
    },
    [clearHoldTimer]
  );

  const handleHoldEnd = useCallback(() => {
    clearHoldTimer();
  }, [clearHoldTimer]);

  const handleDragEnter = useCallback(
    (event) => {
      if (!canPlaceStickers || !isStickerDragEvent(event)) return;
      event.preventDefault();
      setIsDragOver(true);
    },
    [canPlaceStickers]
  );

  const handleDragOver = useCallback(
    (event) => {
      if (!canPlaceStickers || !isStickerDragEvent(event)) return;
      event.preventDefault();
    },
    [canPlaceStickers]
  );

  const handleDragLeave = useCallback((event) => {
    if (!isStickerDragEvent(event)) return;
    const related = event.relatedTarget;
    if (related && event.currentTarget.contains(related)) return;
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (event) => {
      if (!canPlaceStickers || !isStickerDragEvent(event)) return;
      event.preventDefault();
      setIsDragOver(false);
      if (!currentUser?._id) return;
      const stickerKey = event.dataTransfer.getData('application/x-sticker-key');
      if (!stickerKey) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
      const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
      try {
        const placement = await createStickerPlacement(post._id, {
          userId: currentUser._id,
          stickerKey,
          position: { x, y },
          scale: 1,
          rotation: 0,
        });
        if (placement) {
          const newPlacement = { ...placement };
          setStickers((prev) => [...prev, newPlacement]);
          const newId = getStickerId(newPlacement);
          if (newId) setSelectedStickerId(newId);
        }
      } catch (err) {
        if (err?.response?.status === 403) {
          alert('Stickers are disabled for this post.');
        } else {
          console.error('Failed to place sticker', err);
        }
      }
    },
    [canPlaceStickers, currentUser?._id, post._id]
  );

  const canEditSticker = useCallback(
    (sticker) => {
      if (!currentUser?._id) return false;
      if (String(currentUser._id) === String(post.userId)) return true;
      if (!sticker) return false;
      const ownerId = sticker.placedBy
        ? String(sticker.placedBy)
        : sticker.placedByUser?._id
        ? String(sticker.placedByUser._id)
        : null;
      return ownerId === String(currentUser._id);
    },
    [currentUser?._id, post.userId]
  );

  useEffect(() => {
    if (selectedStickerId && !stickers.some((s) => getStickerId(s) === selectedStickerId)) {
      setSelectedStickerId(null);
    }
  }, [stickers, selectedStickerId]);

  const handleContainerClick = useCallback(() => {
    setSelectedStickerId(null);
    setSettingsOpen(false);
  }, []);

  const handleStickerDelete = useCallback(
    async (stickerId) => {
      if (!stickerId || !currentUser?._id) return;
      const sticker = stickersRef.current.find((s) => getStickerId(s) === stickerId);
      if (!sticker || !canEditSticker(sticker)) return;
      try {
        await deleteStickerPlacement(post._id, stickerId, { userId: currentUser._id });
        dragSessionRef.current = null;
        setDragSession(null);
        rotationActiveRef.current = false;
        setStickers((prev) => prev.filter((s) => getStickerId(s) !== stickerId));
        if (selectedStickerId === stickerId) {
          setSelectedStickerId(null);
        }
      } catch (err) {
        console.error('Failed to delete sticker', err);
      }
    },
    [currentUser?._id, post._id, canEditSticker, selectedStickerId]
  );

  const handleStickerMouseDown = useCallback(
    (event, sticker) => {
      if (!canEditSticker(sticker)) return;
      clearHoldTimer();
      const stickerId = getStickerId(sticker);
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      rotationActiveRef.current = false;
      setSelectedStickerId(stickerId);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const position = sticker.position || {};
      const centerX = rect.left + (typeof position.x === 'number' ? position.x : 0.5) * rect.width;
      const centerY = rect.top + (typeof position.y === 'number' ? position.y : 0.5) * rect.height;
      const session = {
        id: stickerId,
        offsetX: event.clientX - centerX,
        offsetY: event.clientY - centerY,
        lastX: event.clientX,
      };
      dragSessionRef.current = session;
      setDragSession(session);
    },
    [canEditSticker, clearHoldTimer]
  );

  const adjustStickerScale = useCallback((stickerId, delta) => {
    if (!stickerId || !Number.isFinite(delta)) return;
    setStickers((prev) =>
      prev.map((sticker) => {
        if (getStickerId(sticker) !== stickerId) return sticker;
        const currentScale = typeof sticker.scale === 'number' ? sticker.scale : 1;
        const nextScale = clamp(currentScale + delta, STICKER_MIN_SCALE, STICKER_MAX_SCALE);
        if (Math.abs(nextScale - currentScale) < 0.005) return sticker;
        return { ...sticker, scale: nextScale };
      })
    );
  }, []);

  const handleWheel = useCallback(
    (event) => {
      const session = dragSessionRef.current;
      if (!session) return;
      const stickerId = session.id;
      const sticker = stickersRef.current.find((s) => getStickerId(s) === stickerId);
      if (!sticker || !canEditSticker(sticker)) return;
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY < 0 ? 0.08 : -0.08;
      adjustStickerScale(stickerId, delta);
    },
    [adjustStickerScale, canEditSticker]
  );

  useEffect(() => {
    if (!dragSession) return;
    const handleDocumentWheel = (event) => {
      const session = dragSessionRef.current;
      if (!session) return;
      const sticker = stickersRef.current.find((s) => getStickerId(s) === session.id);
      if (!sticker || !canEditSticker(sticker)) return;
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.08 : -0.08;
      adjustStickerScale(session.id, delta);
    };
    const options = { passive: false };
    document.addEventListener('wheel', handleDocumentWheel, options);
    return () => {
      document.removeEventListener('wheel', handleDocumentWheel, options);
    };
  }, [dragSession, adjustStickerScale, canEditSticker]);

  useEffect(() => {
    const session = dragSessionRef.current;
    if (!dragSession || !session) return;

    const handleMove = (event) => {
      event.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const centerX = event.clientX - session.offsetX;
      const centerY = event.clientY - session.offsetY;
      const xNorm = clamp((centerX - rect.left) / rect.width, 0, 1);
      const yNorm = clamp((centerY - rect.top) / rect.height, 0, 1);

      setStickers((prev) =>
        prev.map((sticker) => {
          if (getStickerId(sticker) !== session.id) return sticker;
          let rotation = typeof sticker.rotation === 'number' ? sticker.rotation : 0;
          if ((event.buttons & 2) === 2) {
            const delta = event.clientX - session.lastX;
            rotation = clamp(rotation + delta * ROTATION_COEFFICIENT, -180, 180);
            rotationActiveRef.current = true;
          }
          session.lastX = event.clientX;
          return {
            ...sticker,
            position: { x: xNorm, y: yNorm },
            rotation,
          };
        })
      );
    };

    const handleUp = async () => {
      const completedSession = dragSessionRef.current;
      dragSessionRef.current = null;
      setDragSession(null);
      rotationActiveRef.current = false;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('mouseleave', handleUp);
      if (!completedSession || !currentUser?._id) return;
      const sticker = stickersRef.current.find((s) => getStickerId(s) === completedSession.id);
      if (!sticker) return;
      try {
        await updateStickerPlacement(post._id, completedSession.id, {
          userId: currentUser._id,
          position: sticker.position,
          rotation: sticker.rotation,
          scale: sticker.scale,
        });
      } catch (err) {
        console.error('Failed to update sticker placement', err);
      }
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('mouseleave', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('mouseleave', handleUp);
    };
  }, [dragSession, currentUser?._id, post._id]);


  const parseListInput = useCallback(
    (value = '') =>
      value
        .split(',')
        .map((token) => token.trim())
        .filter((token, index, arr) => token && arr.indexOf(token) === index),
    []
  );

  const handleToggleSettings = useCallback(() => {
    if (!isOwner) return;
    setSettingsDraft({
      allowMode,
      allowlist: allowlist.join(', '),
      denylist: denylist.join(', '),
      sticky: Boolean(stickerSettings.sticky),
    });
    setSettingsOpen((prev) => !prev);
  }, [isOwner, allowMode, allowlist, denylist, stickerSettings.sticky]);

  const handleSettingsChange = useCallback(
    (field) => (event) => {
      const value = field === 'sticky' ? event.target.checked : event.target.value;
      setSettingsDraft((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSettingsSave = useCallback(async () => {
    if (!isOwner || !currentUser?._id) return;
    try {
      const payload = {
        userId: currentUser._id,
        allowMode: settingsDraft.allowMode,
        allowlist: parseListInput(settingsDraft.allowlist),
        denylist: parseListInput(settingsDraft.denylist),
        sticky: !!settingsDraft.sticky,
      };
      const updated = await updateStickerSettings(post._id, payload);
      setSettingsOpen(false);
      if (updated) {
        onPostUpdated?.({ ...post, stickerSettings: updated });
      }
    } catch (err) {
      console.error('Failed to update sticker settings', err);
      alert('Could not update sticker settings right now.');
    }
  }, [isOwner, currentUser?._id, settingsDraft, parseListInput, post._id, onPostUpdated, post]);

  const handleSettingsCancel = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleViewerCommented = useCallback(() => {
    setHasCommented(true);
  }, []);

  const handleModalUpdated = useCallback((updated) => {
    setTextContent(updated.textContent);
    setLastEdited(updated.updatedAt ? new Date(updated.updatedAt) : new Date());
    setEditOpen(false);
    const merged = {
      ...post,
      textContent: updated.textContent,
      updatedAt: updated.updatedAt,
    };
    onPostUpdated?.(merged);
  }, [post, onPostUpdated]);

  const likeHandler = () => {
    if (!currentUser) return;
    try {
      axios.put(`http://localhost:5000/api/posts/${post._id}/like`, { userId: currentUser._id });
    } catch (err) { console.error("Failed to like post", err); }
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
    setIsLiked(!isLiked);
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (window.confirm("Delete this post?")) {
      try {
        await axios.delete(`http://localhost:5000/api/posts/${post._id}`, { data: { userId: currentUser._id } });
        onPostDeleted?.(post._id);
      } catch (err) {
        console.error("Failed to delete post", err);
        alert("Could not delete the post. Please try again.");
      }
    }
  };

  const createdDate = useMemo(() => {
    const d = new Date(post.createdAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [post.createdAt]);
  const dateLabel = useMemo(() => formatRelativeLabel(post.createdAt), [post.createdAt]);

  /* Use custom avatar if provided; otherwise the hardcoded fallback */
  const avatarSrc =
    post.profilePicture && String(post.profilePicture).trim()
      ? toMediaUrl(post.profilePicture)
      : FALLBACK_AVATAR;

  const images = (post.attachments || [])
    .filter(a => a.type === 'image')
    .map(a => toMediaUrl(a.url));
  if (post.imageUrl && images.length === 0) images.push(toMediaUrl(post.imageUrl)); // legacy

  return (
    <PostContainer
      ref={containerRef}
      className="surface"
      $dragOver={isDragOver}
      onClick={handleContainerClick}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseDown={handleHoldStart}
      onMouseUp={handleHoldEnd}
      onMouseLeave={handleHoldEnd}
      onWheel={handleWheel}
    >
      <StickerCanvas>
        {stickers.map((sticker) => {
          const position = sticker.position || {};
          const x = Math.min(Math.max(typeof position.x === 'number' ? position.x : 0.5, 0), 1);
          const y = Math.min(Math.max(typeof position.y === 'number' ? position.y : 0.5, 0), 1);
          const rotation = typeof sticker.rotation === 'number' ? sticker.rotation : 0;
          const scale = typeof sticker.scale === 'number' ? sticker.scale : 1;
          const key = sticker.id || sticker._id || `${sticker.stickerKey}-${x}-${y}-${rotation}`;
          const title = sticker.placedByUser?.username
            ? `${sticker.placedByUser.username}'s sticker`
            : 'Sticker';
          const stickerId = getStickerId(sticker);
          const interactive = canEditSticker(sticker);
          const isSelected = stickerId === selectedStickerId;
          return (
            <StickerItem
              key={key}
              title={title}
              $muted={stickersMuted}
              $interactive={interactive}
              $selected={isSelected}
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
              }}
              data-sticker-item="true"
              onMouseDown={(event) => handleStickerMouseDown(event, sticker)}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (dragSessionRef.current || rotationActiveRef.current) return;
                if (canEditSticker(sticker)) {
                  handleStickerDelete(getStickerId(sticker));
                }
              }}
            >
              {sticker.assetType === 'image' ? (
                <img src={toMediaUrl(sticker.assetValue)} alt={sticker.stickerKey || 'sticker'} />
              ) : (
                <span>{sticker.assetValue || '⭐'}</span>
              )}
            </StickerItem>
          );
        })}
      </StickerCanvas>
      <PostHeader>
        <ProfilePic src={avatarSrc} fallback={FALLBACK_AVATAR} alt="User avatar" />
        <UserInfo>
          <UsernameRow>
            <Username to={`/profile/${post.username}`} data-username-link>{post.username}</Username>
            {!!post.titleBadge && <TitleBadge>{post.titleBadge}</TitleBadge>}
          </UsernameRow>
          <Timestamp>
            {dateLabel && <DateLabel>{dateLabel}</DateLabel>}
            <span>{createdDate ? createdDate.toLocaleString() : ''}</span>
            {lastEdited && (
              <EditedStamp title={`Edited on ${lastEdited.toLocaleString()}`}>
                · Edited on {lastEdited.toLocaleString()}
              </EditedStamp>
            )}
          </Timestamp>
        </UserInfo>

        {isOwner && (
          <>
            <OptionsButton onClick={() => setMenuOpen(prev => !prev)} aria-label="More options">
              <FaEllipsisH />
            </OptionsButton>
            {menuOpen && (
              <DropdownMenu onMouseLeave={() => setMenuOpen(false)}>
                <DropdownItem onClick={() => { setMenuOpen(false); setEditOpen(true); }} > Edit Post </DropdownItem>
                <DropdownItem onClick={() => { setMenuOpen(false); handleToggleSettings(); }}>Sticker Settings</DropdownItem>
                <DropdownItem onClick={handleDelete}>Delete Post</DropdownItem>
              </DropdownMenu>
            )}
          </>
        )}
      </PostHeader>

      {textContent && <PostContent>{textContent}</PostContent>}


      {images.length > 0 && (
        <MediaGrid $count={images.length}>
          {images.map((src, i) => (
            <SmartImg key={i} src={src} fallback="" alt={`post media ${i + 1}`} />
          ))}
        </MediaGrid>
      )}
                
      <PostActions>
        <Action
          data-ignore-hold
          onClick={(event) => {
            event.stopPropagation();
            likeHandler();
          }}
        >
          {isLiked ? <FaHeart size={ICON_SIZE} color={HEART_COLOR} /> : <FaRegHeart size={ICON_SIZE} color={HEART_COLOR} />} {likeCount}
        </Action>
        <Action
          data-ignore-hold
          onClick={(event) => {
            event.stopPropagation();
            setCommentsOpen(true);
          }}
          title="View comments"
          style={{ flex: 1 }}
        >
          {hasCommented
            ? <FaCommentAlt size={ICON_SIZE} color="#2563eb" />
            : <FaRegCommentAlt size={ICON_SIZE} color="#2563eb" />} {commentCount}
          {commentCount > 0 && commentPreview && (
            <CommentPreviewInline title={`${commentPreview.username} — ${commentPreview.snippet}`}>
              {commentPreview.username} — {commentPreview.snippet}
            </CommentPreviewInline>
          )}
        </Action>
      </PostActions>
      {settingsOpen && isOwner && (
        <StickerSettingsPanel
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <StickerSettingsRow>
            <StickerSettingsLabel>
              <input
                type="radio"
                name={`sticker-allow-${post._id}`}
                value="everyone"
                checked={settingsDraft.allowMode === 'everyone'}
                onChange={handleSettingsChange('allowMode')}
              />
              Everyone
            </StickerSettingsLabel>
            <StickerSettingsLabel>
              <input
                type="radio"
                name={`sticker-allow-${post._id}`}
                value="followers"
                checked={settingsDraft.allowMode === 'followers'}
                onChange={handleSettingsChange('allowMode')}
              />
              Followers only
            </StickerSettingsLabel>
            <StickerSettingsLabel>
              <input
                type="radio"
                name={`sticker-allow-${post._id}`}
                value="none"
                checked={settingsDraft.allowMode === 'none'}
                onChange={handleSettingsChange('allowMode')}
              />
              Disabled
            </StickerSettingsLabel>
          </StickerSettingsRow>
          <div>
            <StickerSettingsLabel style={{ marginBottom: 4 }}>
              Allowlist (user IDs, comma separated)
            </StickerSettingsLabel>
            <StickerSettingsTextarea
              value={settingsDraft.allowlist}
              onChange={handleSettingsChange('allowlist')}
              placeholder="userId1, userId2"
            />
          </div>
          <div>
            <StickerSettingsLabel style={{ marginBottom: 4 }}>
              Denylist (user IDs, comma separated)
            </StickerSettingsLabel>
            <StickerSettingsTextarea
              value={settingsDraft.denylist}
              onChange={handleSettingsChange('denylist')}
              placeholder="userId1, userId2"
            />
          </div>
          <StickerSettingsLabel>
            <input
              type="checkbox"
              checked={Boolean(settingsDraft.sticky)}
              onChange={handleSettingsChange('sticky')}
            />
            Make stickers sticky on load
          </StickerSettingsLabel>
          <StickerSettingsHint>
            Allowlist overrides denylist. Leave both blank to rely solely on the allow mode.
          </StickerSettingsHint>
          <StickerSettingsActions>
          <StickerSettingsButton
            type="button"
            data-ignore-hold
            onMouseDown={(event) => event.stopPropagation()}
            onClick={handleSettingsCancel}
          >
            Cancel
          </StickerSettingsButton>
          <StickerSettingsButton
            type="button"
            data-ignore-hold
            $primary
            onMouseDown={(event) => event.stopPropagation()}
            onClick={handleSettingsSave}
          >
            Save
          </StickerSettingsButton>
        </StickerSettingsActions>
        </StickerSettingsPanel>
      )}
      
      {editOpen && (    // v edit post button   //open comments button^
        <EditPostModal
          post={{ ...post, textContent }}
          onClose={() => setEditOpen(false)}  
          onPostUpdated={handleModalUpdated}
        />
      )}

      {commentsOpen && (
        <CommentDrawer
          post={post}           // Comment Drawer
          onClose={() => setCommentsOpen(false)}
          onCountChange={setCommentCount}
          onPreviewChange={applyPreview}
          onViewerCommented={handleViewerCommented}
        />
      )}
    </PostContainer>
  );
};

export default Post;
