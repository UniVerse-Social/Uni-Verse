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
import StickerSettingsModal from './StickerSettingsModal';
import { useStickerInteractions } from '../context/StickerInteractionsContext';
import { useCustomStickerCatalog } from '../context/CustomStickerContext';



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
  pointer-events: auto;
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
  const containerRef = useRef(null);
  const stickersRef = useRef(stickers);
  const [movingStickerId, setMovingStickerId] = useState(null);
  const deleteClickRef = useRef({ id: null, ts: 0 });
  const movingStickerIdRef = useRef(null);
  const { beginStickerMove, registerTarget, hoverTargetId, activeDrag } = useStickerInteractions();
  const { addStickerFromPlacement } = useCustomStickerCatalog();
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
    setIsDragOver(canPlaceStickers && hoverTargetId === post._id);
  }, [hoverTargetId, post._id, canPlaceStickers]);

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

  const canMoveSticker = useCallback(
    (sticker) => {
      if (!currentUser?._id) return false;
      if (!sticker) return false;
      const ownerId = sticker.placedBy
        ? String(sticker.placedBy)
        : sticker.placedByUser?._id
        ? String(sticker.placedByUser._id)
        : null;
      return ownerId === String(currentUser._id);
    },
    [currentUser?._id]
  );

  const canDeleteSticker = useCallback(
    (sticker) => {
      if (!currentUser?._id) return false;
      if (!sticker) return false;
      const ownerId = sticker.placedBy
        ? String(sticker.placedBy)
        : sticker.placedByUser?._id
        ? String(sticker.placedByUser._id)
        : null;
      if (ownerId === String(currentUser._id)) return true;
      return String(currentUser._id) === String(post.userId);
    },
    [currentUser?._id, post.userId]
  );

  const handleContainerClick = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleStickerDelete = useCallback(
    async (stickerId) => {
      if (!stickerId || !currentUser?._id) return;
      const sticker = stickersRef.current.find((s) => getStickerId(s) === stickerId);
      if (!sticker || !canDeleteSticker(sticker)) return;
      try {
        await deleteStickerPlacement(post._id, stickerId, { userId: currentUser._id });
        setStickers((prev) => prev.filter((s) => getStickerId(s) !== stickerId));
      } catch (err) {
        console.error('Failed to delete sticker', err);
      }
    },
    [currentUser?._id, post._id, canDeleteSticker]
  );

  const handleStickerPointerDown = useCallback(
    (event, sticker) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (!canMoveSticker(sticker)) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      event.preventDefault();
      event.stopPropagation();
      clearHoldTimer();
      const position = sticker.position || {};
      const center = {
        x: rect.left + (typeof position.x === 'number' ? position.x : 0.5) * rect.width,
        y: rect.top + (typeof position.y === 'number' ? position.y : 0.5) * rect.height,
      };
      const placementId = getStickerId(sticker);
      if (!placementId) return;
      const started = beginStickerMove({
        sticker,
        postId: post._id,
        placementId,
        center,
        point: { x: event.clientX, y: event.clientY },
        scale: typeof sticker.scale === 'number' ? sticker.scale : 1,
        rotation: typeof sticker.rotation === 'number' ? sticker.rotation : 0,
      });
      if (started) {
        movingStickerIdRef.current = placementId;
        setMovingStickerId(placementId);
      }
    },
    [beginStickerMove, canMoveSticker, clearHoldTimer, post._id]
  );

  const handleStickerDoubleClick = useCallback(
    (event, sticker) => {
      event.preventDefault();
      event.stopPropagation();
      if (sticker.assetType === 'image') {
        addStickerFromPlacement(sticker);
      }
    },
    [addStickerFromPlacement]
  );

  const handleStickerContextMenu = useCallback(
    (event, sticker) => {
      event.preventDefault();
      event.stopPropagation();
      if (!canDeleteSticker(sticker)) return;
      const stickerId = getStickerId(sticker);
      if (!stickerId) return;
      const now = Date.now();
      const last = deleteClickRef.current;
      if (last.id === stickerId && now - last.ts < 350) {
        deleteClickRef.current = { id: null, ts: 0 };
        handleStickerDelete(stickerId);
      } else {
        deleteClickRef.current = { id: stickerId, ts: now };
      }
    },
    [canDeleteSticker, handleStickerDelete]
  );

  const handleDropNewSticker = useCallback(
    async ({ sticker, position, scale, rotation }) => {
      if (!canPlaceStickers || !currentUser?._id) return;
      try {
        const payload = {
          userId: currentUser._id,
          position,
          scale,
          rotation,
        };
        if (sticker.origin === 'custom' || sticker.assetType === 'image') {
          payload.stickerKey = sticker.stickerKey || sticker.key;
          payload.customSticker = {
            assetType: sticker.assetType,
            assetValue: sticker.assetValue,
            label: sticker.label,
          };
        } else {
          payload.stickerKey = sticker.stickerKey || sticker.key;
        }
        const placement = await createStickerPlacement(post._id, payload);
        if (placement) {
          const newPlacement = { ...placement };
          setStickers((prev) => [...prev, newPlacement]);
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

  const handleDropMoveSticker = useCallback(
    async ({ placementId, position, scale, rotation }) => {
      if (!currentUser?._id || !placementId) return;
      const sticker = stickersRef.current.find((s) => getStickerId(s) === placementId);
      if (!sticker || !canMoveSticker(sticker)) {
        movingStickerIdRef.current = null;
        setMovingStickerId(null);
        return;
      }
      const previous = {
        position: sticker.position,
        scale: sticker.scale,
        rotation: sticker.rotation,
      };
      setStickers((prev) =>
        prev.map((item) =>
          getStickerId(item) === placementId
            ? { ...item, position, scale, rotation }
            : item
        )
      );
      try {
        await updateStickerPlacement(post._id, placementId, {
          userId: currentUser._id,
          position,
          scale,
          rotation,
        });
      } catch (err) {
        console.error('Failed to update sticker placement', err);
        setStickers((prev) =>
          prev.map((item) =>
            getStickerId(item) === placementId
              ? {
                  ...item,
                  position: previous.position,
                  scale: previous.scale,
                  rotation: previous.rotation,
                }
              : item
          )
        );
      } finally {
        movingStickerIdRef.current = null;
        setMovingStickerId(null);
      }
    },
    [currentUser?._id, post._id, canMoveSticker]
  );

  useEffect(() => {
    const unregister = registerTarget(post._id, {
      getRect: () => containerRef.current?.getBoundingClientRect() || null,
      onDropNew: handleDropNewSticker,
      onDropMove: handleDropMoveSticker,
    });
    return unregister;
  }, [registerTarget, post._id, handleDropNewSticker, handleDropMoveSticker]);

  useEffect(() => {
    if (!activeDrag && movingStickerIdRef.current) {
      movingStickerIdRef.current = null;
      setMovingStickerId(null);
    }
  }, [activeDrag]);

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
      onMouseDown={handleHoldStart}
      onMouseUp={handleHoldEnd}
      onMouseLeave={handleHoldEnd}
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
          const interactive = canMoveSticker(sticker);
          const hideSticker =
            movingStickerId && stickerId === movingStickerId && activeDrag?.placementId === movingStickerId;
          if (hideSticker) {
            return null;
          }
          return (
            <StickerItem
              key={key}
              title={title}
              $muted={stickersMuted}
              $interactive={interactive}
              $selected={false}
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
              }}
              data-sticker-item="true"
              onPointerDown={(event) => handleStickerPointerDown(event, sticker)}
              onDoubleClick={(event) => handleStickerDoubleClick(event, sticker)}
              onContextMenu={(event) => handleStickerContextMenu(event, sticker)}
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
      <StickerSettingsModal
        open={Boolean(settingsOpen && isOwner)}
        values={settingsDraft}
        onChange={handleSettingsChange}
        onSave={handleSettingsSave}
        onCancel={handleSettingsCancel}
      />

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
