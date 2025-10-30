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
import { clearAllStickers } from '../utils/stickers';



/* Hardcoded default avatar (always available) */
const FALLBACK_AVATAR =
  'https://www.clipartmax.com/png/middle/72-721825_tuffy-tuffy-the-titan-csuf.png';

// Stick-with-fallback image (now with forwardRef)
const SmartImg = React.forwardRef(({ src, fallback, alt = '', ...imgProps }, ref) => {
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
      ref={ref}
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
});
SmartImg.displayName = 'SmartImg';

const usePrefersReducedMotion = () => {
  const [prefers, setPrefers] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefers(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return prefers;
};

const MAX_ACTIVE_ANIMATED = 6;
const AnimatedVideoRegistry = (() => {
  const active = new Set();

  const play = (video) => {
    if (!video) return;
    if (active.has(video)) {
      if (video.paused) {
        video.play().catch(() => {});
      }
      return;
    }
    if (active.size >= MAX_ACTIVE_ANIMATED) {
      const first = active.values().next().value;
      if (first) {
        try {
          first.pause();
        } catch {}
        active.delete(first);
      }
    }
    active.add(video);
    video.play().catch(() => {});
  };

  const pause = (video) => {
    if (!video) return;
    if (active.delete(video)) {
      try {
        video.pause();
      } catch {}
    } else {
      try {
        video.pause();
      } catch {}
    }
  };

  const pauseAll = () => {
    active.forEach((video) => {
      try {
        video.pause();
      } catch {}
    });
    active.clear();
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') {
        pauseAll();
      }
    });
  }

  return { play, pause, pauseAll };
})();

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
  z-index: ${(p) => (p.$raised ? 40 : 0)}; /* isolate stickers so other cards layer above any bleed */
  overflow: visible;
  transition: border 0.18s ease, box-shadow 0.18s ease;
`;

const PostHeader = styled.div`
   display: flex;
   align-items: center;
   margin-bottom: 12px;
   position: relative;
   z-index: 10;       /* stays above sticker layer */
 `;
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
const PostContent = styled.p`
   font-size: 16px;
   line-height: 1.5;
   margin: 0 0 12px 0;
   white-space: pre-wrap;
   word-break: break-word;
   color: #111;
   position: relative;
   z-index: 2; /* allow stickers to layer above while keeping text selectable */
 `;
const PostActions = styled.div`
   display: flex;
   align-items: center;
   gap: 20px;
   color: #374151;
   position: relative;
   z-index: 10;       /* keep action buttons above guides */
 `;
const Action = styled.div` display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px; `;
const OptionsButton = styled.div` cursor: pointer; padding: 6px; border-radius: 8px; &:hover { background-color: #f3f4f6; } `;
const DropdownMenu = styled.div`
  position: absolute; background: #fff; border-radius: 12px;
  border: 1px solid var(--border-color); box-shadow: 0 12px 28px rgba(0,0,0,0.12); z-index: 360; overflow: hidden;
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
  z-index: 6;
  pointer-events: none;
  overflow: visible;
`;

const StickerItem = styled.div`
  position: absolute;
  pointer-events: ${(p) => (p.$pointerEnabled ? 'auto' : 'none')};
  cursor: ${(p) => (p.$interactive && p.$pointerEnabled ? 'grab' : 'default')};
  transform-origin: center;
  transition: opacity 0.25s ease, filter 0.25s ease, transform 0.15s ease;
  opacity: ${(p) => (p.$muted ? 0.25 : 1)};
  will-change: transform, opacity;
  z-index: ${(p) => (p.$attributed ? 16 : p.$selected ? 9 : 7)};
  user-select: none;
  filter: ${(p) => (p.$selected ? 'drop-shadow(0 0 0.45rem rgba(59,130,246,0.4))' : 'none')};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  box-sizing: content-box;
  border-radius: 18px;
  touch-action: none;
  overflow: visible;

  &:active {
    cursor: ${(p) => (p.$interactive && p.$pointerEnabled ? 'grabbing' : 'default')};
  }

  span {
    display: block;
    line-height: 1;
    pointer-events: none;
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 12px;
    object-fit: contain;
    pointer-events: none;
  }

  video {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 12px;
    object-fit: contain;
    pointer-events: none;
  }
`;

const StickerHandle = styled.button`
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(96, 165, 250, 0.95);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.92), rgba(29, 78, 216, 0.92));
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.28);
  cursor: ${(p) => (p.$visible && !p.$hidden ? (p.$active ? 'grabbing' : 'grab') : 'default')};
  pointer-events: ${(p) => (p.$visible && !p.$hidden ? 'auto' : 'none')};
  opacity: ${(p) => (p.$visible && !p.$hidden ? 1 : 0)};
  transform: ${(p) => (p.$active ? 'scale(1.08)' : 'scale(1)')};
  transition: opacity 0.18s ease, transform 0.18s ease;
  touch-action: none;
  padding: 0;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4;
`;

const StickerBody = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: center;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
`;

const StickerOutline = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: ${(p) => (p.$visible ? 0.9 : 0)};
  transition: opacity 0.18s ease;
  transform-origin: center;
  border-radius: ${(p) => p.$radius}px;
  border: ${(p) => `${p.$borderWidth}px dashed rgba(148, 163, 184, 0.78)`};
  z-index: 3;
`;

const StickerAttribution = styled.div`
  position: absolute;
  left: 50%;
  top: 100%;
  transform: translate(-50%, 0);
  background: rgba(15, 23, 42, 0.94);
  color: #f8fafc;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.28);
  opacity: 0.95;
  z-index: 16;
`;

const DropGuide = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 12px;
  pointer-events: none;
  border: 2px solid transparent;
  box-shadow: none;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transition: opacity 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  z-index: 12;
  border-color: ${(p) =>
    p.$state === 'allowed'
      ? 'rgba(34,197,94,0.7)'
      : p.$state === 'blocked'
      ? 'rgba(239,68,68,0.75)'
      : 'transparent'};
  box-shadow: ${(p) =>
    p.$state === 'allowed'
      ? '0 0 0 3px rgba(34,197,94,0.15)'
      : p.$state === 'blocked'
      ? '0 0 0 3px rgba(239,68,68,0.12)'
      : 'none'};
`;

const DropGhost = styled.div`
  position: absolute;
  pointer-events: none;
  transform-origin: center;
  border-radius: 14px;
  border: 2px dashed ${(p) => (p.$allowed ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)')};
  background: ${(p) => (p.$allowed ? 'rgba(16,185,129,0.14)' : 'rgba(248,113,113,0.16)')};
  transition: border-color 0.18s ease, background-color 0.18s ease;
  opacity: 0.8;
  z-index: 11;
`;

const ProtectedMask = styled.div`
  position: absolute;
  border-radius: 12px;
  background: rgba(248, 113, 113, 0.16);
  border: 1px solid rgba(248, 113, 113, 0.28);
  pointer-events: none;
  z-index: 8;
`;

const PermissionNotice = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.92);
  color: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  pointer-events: none;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const StickerVideo = React.memo(function StickerVideo({
  src,
  poster,
  size,
  muted,
  disableAutoPlay,
  prefersReducedMotion,
  rounded = false,
}) {
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [inView, setInView] = useState(false);
  const [manualPlay, setManualPlay] = useState(false);
  const [hovering, setHovering] = useState(false);
  const manualTimerRef = useRef(null);

  const effectiveSize = useMemo(() => {
    if (typeof size === 'number' && Number.isFinite(size)) {
      return Math.max(size, 1);
    }
    return 64;
  }, [size]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          setInView(true);
        } else {
          setInView(false);
          setShouldLoad(false);
        }
      },
      { rootMargin: '160px' }
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
  }, [shouldLoad]);

  const triggerManualPreview = useCallback(() => {
    setManualPlay(true);
    if (manualTimerRef.current) {
      clearTimeout(manualTimerRef.current);
    }
    manualTimerRef.current = setTimeout(() => {
      setManualPlay(false);
      manualTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => () => {
    if (manualTimerRef.current) {
      clearTimeout(manualTimerRef.current);
      manualTimerRef.current = null;
    }
  }, []);

  const effectiveAutoPlay =
    shouldLoad &&
    inView &&
    !muted &&
    (hovering || manualPlay || (!disableAutoPlay && !prefersReducedMotion));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (effectiveAutoPlay) {
      AnimatedVideoRegistry.play(video);
    } else {
      AnimatedVideoRegistry.pause(video);
      if (!inView && shouldLoad) {
        video.removeAttribute('src');
        try {
          video.load();
        } catch {}
      }
    }
    return () => {
      AnimatedVideoRegistry.pause(video);
      if (video.hasAttribute('src')) {
        video.removeAttribute('src');
        try {
          video.load();
        } catch {}
      }
    };
  }, [effectiveAutoPlay, inView, shouldLoad]);

  useEffect(() => () => {
    const video = videoRef.current;
    if (video) AnimatedVideoRegistry.pause(video);
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{
        width: effectiveSize,
        height: effectiveSize,
        position: 'relative',
        borderRadius: rounded ? 12 : 0,
        overflow: rounded ? 'hidden' : 'visible',
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') {
          setHovering(true);
        }
      }}
      onPointerLeave={() => {
        setHovering(false);
      }}
      onPointerCancel={() => {
        setHovering(false);
      }}
      onPointerDown={(event) => {
        if (disableAutoPlay || prefersReducedMotion) {
          triggerManualPreview();
        }
        if (event.pointerType !== 'mouse') {
          setHovering(false);
        }
      }}
    >
      {shouldLoad ? (
        <video
          ref={videoRef}
          poster={poster || undefined}
          src={shouldLoad ? src : undefined}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: rounded ? 12 : 0,
            background: 'transparent',
          }}
        />
      ) : poster ? (
        <img src={poster} alt="animated sticker" />
      ) : (
        <div style={{ width: '100%', height: '100%', background: '#1f2937', borderRadius: 12 }} />
      )}
    </div>
  );
});

const AttachmentVideo = ({ src, poster, autoPlay, prefersReducedMotion, animationsDisabled }) => {
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [inView, setInView] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [manualPlay, setManualPlay] = useState(false);
  const manualTimerRef = useRef(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          setInView(true);
        } else {
          setInView(false);
          setShouldLoad(false);
        }
      },
      { rootMargin: '160px' }
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const allowAuto = autoPlay && !animationsDisabled;
    video.loop = allowAuto;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.controls = !allowAuto;
  }, [autoPlay, animationsDisabled, shouldLoad]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const allowAuto = autoPlay && !animationsDisabled;
    const shouldPlay =
      shouldLoad &&
      inView &&
      (allowAuto ? !prefersReducedMotion : hovering || manualPlay);
    if (shouldPlay) {
      video.play().catch(() => {});
    } else {
      video.pause();
      if (!inView && shouldLoad) {
        video.removeAttribute('src');
        try {
          video.load();
        } catch {}
      }
    }
  }, [shouldLoad, inView, prefersReducedMotion, autoPlay, animationsDisabled, hovering, manualPlay]);

  useEffect(() => () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      if (video.hasAttribute('src')) {
        video.removeAttribute('src');
        try {
          video.load();
        } catch {}
      }
    }
  }, []);

  useEffect(() => () => {
    if (manualTimerRef.current) {
      clearTimeout(manualTimerRef.current);
      manualTimerRef.current = null;
    }
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse' && animationsDisabled) {
          setHovering(true);
        }
      }}
      onPointerLeave={() => {
        if (animationsDisabled) {
          setHovering(false);
        }
      }}
      onPointerDown={(event) => {
        if (!animationsDisabled) return;
        if (manualTimerRef.current) {
          clearTimeout(manualTimerRef.current);
          manualTimerRef.current = null;
        }
        setManualPlay(true);
        manualTimerRef.current = setTimeout(() => {
          setManualPlay(false);
          manualTimerRef.current = null;
        }, 4000);
        if (event.pointerType !== 'mouse') {
          setHovering(false);
        }
      }}
    >
      <video
        ref={videoRef}
        poster={poster || undefined}
        src={shouldLoad ? src : undefined}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 10,
          border: '1px solid var(--border-color)',
          background: autoPlay ? 'transparent' : '#000',
        }}
      />
    </div>
  );
};

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

const STICKER_MIN_SCALE = 0.25;
const STICKER_MAX_SCALE = 2.5;
const ROTATION_COEFFICIENT = 0.6;
const STICKER_EDGE_OVERFLOW = 0.28; // allow ~28% bleed over card edge

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const normalizeDegrees = (value) => {
  if (!Number.isFinite(value)) return 0;
  let deg = value % 360;
  if (deg > 180) deg -= 360;
  if (deg < -180) deg += 360;
  return deg;
};
const getStickerId = (sticker) => (sticker?.id || sticker?._id || null);

const resolveAnchorInfo = (pos, areas = {}) => {
  if (
    !pos ||
    typeof pos.x !== 'number' ||
    typeof pos.y !== 'number'
  ) {
    return {
      anchor: 'card',
      anchorRect: { top: 0, left: 0, width: 1, height: 1 },
    };
  }

  const normalizeRect = (rect) => ({
    top: clamp(rect.top, 0, 1),
    left: clamp(rect.left, 0, 1),
    width: clamp(rect.width, 0.001, 1),
    height: clamp(rect.height, 0.001, 1),
  });

  const isInside = (bounds) =>
    bounds &&
    bounds.width > 0 &&
    bounds.height > 0 &&
    typeof bounds.left === 'number' &&
    typeof bounds.top === 'number' &&
    pos.x >= bounds.left &&
    pos.x <= bounds.left + bounds.width &&
    pos.y >= bounds.top &&
    pos.y <= bounds.top + bounds.height;

  if (isInside(areas.text)) {
    return {
      anchor: 'text',
      anchorRect: normalizeRect(areas.text),
    };
  }

  if (isInside(areas.media)) {
    return {
      anchor: 'media',
      anchorRect: normalizeRect(areas.media),
    };
  }

  return {
    anchor: 'card',
    anchorRect: { top: 0, left: 0, width: 1, height: 1 },
  };
};

const toAnchorSpace = (pos, anchorInfo) => {
  if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return pos;
  if (!anchorInfo || anchorInfo.anchor === 'card') return pos;
  const rect = anchorInfo.anchorRect || { top: 0, left: 0, width: 1, height: 1 };
  const width = rect.width || 1;
  const height = rect.height || 1;
  return {
    x: clamp((pos.x - rect.left) / width, 0, 1),
    y: clamp((pos.y - rect.top) / height, 0, 1),
  };
};

const MediaGrid = styled.div`
   display: grid;
   grid-template-columns: repeat(${p => Math.min(p.$count, 2)}, 1fr);
   gap: 8px;
   margin-bottom: 10px;
   position: relative;
   z-index: 2;   /* sit below stickers but above background */
   img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    border-radius: 10px; border: 1px solid var(--border-color);
    background: #f8f9fb;
  }
`;

const Post = ({ post, onPostDeleted, onPostUpdated, animationsDisabled }) => {
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
  const [permissionNotice, setPermissionNotice] = useState(null);
  const permissionTimerRef = useRef(null);
  const lastPermissionTsRef = useRef(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const normalizeMediaUrl = useCallback((value) => {
    if (typeof value !== 'string') return value;
    if (value.startsWith(API_BASE_URL)) {
      return value.slice(API_BASE_URL.length);
    }
    return value;
  }, []);

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
  const allowlist = useMemo(
    () => (Array.isArray(stickerSettings.allowlist) ? stickerSettings.allowlist : []),
    [stickerSettings.allowlist]
  );
  const denylist = useMemo(
    () => (Array.isArray(stickerSettings.denylist) ? stickerSettings.denylist : []),
    [stickerSettings.denylist]
  );
  const allowMode = stickerSettings.allowMode || 'everyone';
  // container stays
  const containerRef = useRef(null);
  const avatarRef      = useRef(null);
  const usernameRef    = useRef(null);
  const titleBadgeRef  = useRef(null);
  const timestampRef   = useRef(null);
  const optionsBtnRef  = useRef(null);
  const menuRef        = useRef(null);
  const contentTextRef = useRef(null);   // wraps the actual text only
  const mediaRef       = useRef(null);   // keep images protected
  const actionsBtnsRef = useRef(null);   // just the like/comment buttons area
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const [mediaBounds, setMediaBounds] = useState(null);
  const [textBounds, setTextBounds] = useState(null);

  /* Overlap helpers */
  const PROTECT_PAD = 6;
  const overlaps = (a, b) =>
    !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

  const rectsProtected = useCallback(() => {
    const card = containerRef.current?.getBoundingClientRect();
    if (!card) return [];

    const toLocal = (r) => ({
      left: r.left - card.left - PROTECT_PAD,
      top: r.top - card.top - PROTECT_PAD,
      right: r.right - card.left + PROTECT_PAD,
      bottom: r.bottom - card.top + PROTECT_PAD,
    });

    // Read per-post placement permissions
    const allowTextOverlap  = Boolean(post?.stickerSettings?.allowstickytext);
    const allowMediaOverlap = Boolean(post?.stickerSettings?.allowstickymedia);

    // Always protect core UI; conditionally protect text/media
    const refs = [
      avatarRef,
      usernameRef,
      titleBadgeRef,
      timestampRef,
      optionsBtnRef,   // kebab menu button
      !allowTextOverlap  ? contentTextRef : null, // protect text only if NOT allowed
      !allowMediaOverlap ? mediaRef       : null, // protect media only if NOT allowed
      actionsBtnsRef,   // like/comment cluster always protected
    ].filter(Boolean);

    const out = [];
    refs.forEach((ref) => {
      const r = ref.current?.getBoundingClientRect();
      if (r) out.push(toLocal(r));
    });
    return out;
  }, [
    post?.stickerSettings?.allowstickytext,
    post?.stickerSettings?.allowstickymedia,
    avatarRef, usernameRef, titleBadgeRef, timestampRef,
    optionsBtnRef, contentTextRef, mediaRef, actionsBtnsRef
  ]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setCardSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect) {
          const { width, height } = entries[0].contentRect;
          setCardSize({ width, height });
        } else {
          updateSize();
        }
      });
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const baseImageSize = useMemo(() => {
    if (!cardSize.width) return 48;
    const scale = cardSize.width < 420 ? 0.14 : 0.18;
    return Math.min(84, Math.max(18, cardSize.width * scale));
  }, [cardSize.width]);

  const baseEmojiSize = useMemo(() => {
    return Math.min(72, Math.max(28, baseImageSize * 0.72));
  }, [baseImageSize]);

  const getBaseSize = useCallback(
    (sticker) => (sticker?.assetType === 'image' || sticker?.assetType === 'video' ? baseImageSize : baseEmojiSize),
    [baseImageSize, baseEmojiSize]
  );

  const maxStickers = useMemo(() => {
    const raw = Number(stickerSettings.maxCount);
    if (Number.isFinite(raw)) {
      return Math.min(30, Math.max(1, raw));
    }
    return 20;
  }, [stickerSettings.maxCount]);

  const showPermissionNotice = useCallback((message) => {
    if (!message) return;
    setPermissionNotice(message);
    if (permissionTimerRef.current) {
      clearTimeout(permissionTimerRef.current);
    }
    permissionTimerRef.current = setTimeout(() => {
      setPermissionNotice(null);
      permissionTimerRef.current = null;
    }, 2000);
  }, [setPermissionNotice]);

  const clearSelectionTimer = useCallback(() => {
    if (selectionTimerRef.current) {
      clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = null;
    }
  }, []);

  const clearAttributionTimer = useCallback(() => {
    if (attributionTimerRef.current) {
      clearTimeout(attributionTimerRef.current);
      attributionTimerRef.current = null;
    }
  }, []);

  const showStickerControls = useCallback(
    (stickerId) => {
      if (!stickerId) return;
      clearSelectionTimer();
      setSelectedStickerId(stickerId);
      setSelectionVisible(true);
      selectionTimerRef.current = setTimeout(() => {
        setSelectionVisible(false);
        selectionTimerRef.current = null;
      }, 2000);
    },
    [clearSelectionTimer]
  );

  const hideStickerControls = useCallback(() => {
    clearSelectionTimer();
    setSelectionVisible(false);
  }, [clearSelectionTimer]);

  const hideStickerAttribution = useCallback(() => {
    clearAttributionTimer();
    setStickerAttribution(null);
  }, [clearAttributionTimer]);

  const showStickerAttribution = useCallback(
    (sticker) => {
      if (!sticker) return;
      const stickerId = getStickerId(sticker);
      if (!stickerId) return;
      const ownerId = sticker.placedBy
        ? String(sticker.placedBy)
        : sticker.placedByUser?._id
        ? String(sticker.placedByUser._id)
        : null;
      const viewerId = currentUser?._id ? String(currentUser._id) : null;
      if (ownerId && viewerId && ownerId === viewerId) return;
      const ownerName =
        (sticker.placedByUser && sticker.placedByUser.username) ||
        (sticker.meta && sticker.meta.placedByUser && sticker.meta.placedByUser.username) ||
        sticker.placedByUsername ||
        sticker.meta?.username ||
        'Someone';
      const possessive =
        typeof ownerName === 'string' && /s$/i.test(ownerName)
          ? `${ownerName}' sticker`
          : `${ownerName}'s sticker`;
      clearAttributionTimer();
      setStickerAttribution({
        id: stickerId,
        label: possessive,
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sticker-attribution-shown', {
            detail: { postId: post._id, stickerId },
          })
        );
      }
      attributionTimerRef.current = setTimeout(() => {
        setStickerAttribution(null);
        attributionTimerRef.current = null;
      }, 2000);
    },
    [clearAttributionTimer, currentUser?._id, post._id]
  );

  useEffect(() => {
    return () => {
      clearSelectionTimer();
      clearAttributionTimer();
      const state = transformStateRef.current;
      if (state) {
        if (state.moveListener) {
          document.removeEventListener('pointermove', state.moveListener, true);
        }
        if (state.upListener) {
          document.removeEventListener('pointerup', state.upListener, true);
          document.removeEventListener('pointercancel', state.upListener, true);
        }
        transformStateRef.current = null;
      }
    };
  }, [clearSelectionTimer, clearAttributionTimer]);

  const isAllowedCenter = useCallback((pos, sizePx) => {
    const card = containerRef.current?.getBoundingClientRect();
    if (!card) return true;
    const { x = 0.5, y = 0.5 } = pos || {};
    const cx = x * card.width;
    const cy = y * card.height;
    const effectiveSize = typeof sizePx === 'number' ? sizePx : baseImageSize;
    const half = effectiveSize / 2;
    const overflowAllowance = effectiveSize * STICKER_EDGE_OVERFLOW;
    if (
      cx < half - overflowAllowance ||
      cx > card.width - half + overflowAllowance ||
      cy < half - overflowAllowance ||
      cy > card.height - half + overflowAllowance
    ) {
      return false;
    }
    const me = { left: cx - half, top: cy - half, right: cx + half, bottom: cy + half };
    return !rectsProtected().some((b) => overlaps(me, b));
  }, [rectsProtected, baseImageSize]);
  const stickersRef = useRef(stickers);
  const [movingStickerId, setMovingStickerId] = useState(null);
  const deleteClickRef = useRef({ id: null, ts: 0 });
  const [selectedStickerId, setSelectedStickerId] = useState(null);
  const [selectionVisible, setSelectionVisible] = useState(false);
  const selectionTimerRef = useRef(null);
  const [stickerAttribution, setStickerAttribution] = useState(null);
  const attributionTimerRef = useRef(null);
  const stickerRefs = useRef(new Map());
  const transformStateRef = useRef(null);
  const [activeTransformId, setActiveTransformId] = useState(null);
  const movingStickerIdRef = useRef(null);
  const touchDragRef = useRef(null);
  const { beginStickerMove, registerTarget, hoverTargetId, activeDrag } = useStickerInteractions();
  const {
    addStickerFromPlacement,
    stickerDefaults: userStickerDefaults,
  } = useCustomStickerCatalog();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hideStickersInFeed = Boolean(userStickerDefaults?.hideFeedStickers);
  const resolvedAnimationsDisabled = useMemo(() => {
    if (typeof animationsDisabled === 'boolean') return animationsDisabled;
    if (typeof window === 'undefined') return false;
    try {
      const raw = window.localStorage.getItem('fc__homePrefs_v1');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!parsed.disableAnimations;
    } catch {
      return false;
    }
  }, [animationsDisabled]);
  const [settingsDraft, setSettingsDraft] = useState({
    allowMode,
    allowstickytext: Boolean(stickerSettings.allowstickytext),
    allowstickymedia: Boolean(stickerSettings.allowstickymedia),
    allowlist: allowlist.join(', '),
    denylist: denylist.join(', '),
    maxCount: Number(stickerSettings.maxCount) || 20,
  });

  const canPlaceStickers = useMemo(() => {
    if (hideStickersInFeed) return false;
    if (!currentUser?._id) return false;
    const isOwner = String(currentUser._id) === String(post.userId);
    if (allowMode === 'none') return false;           // fully disabled
    if (allowMode === 'owner') return isOwner;        // owner only
    if (isOwner) return true;                         // owner always allowed on their own post (optional)
    if (denylist.some((id) => String(id) === String(currentUser._id))) return false;
    if (allowlist.length && !allowlist.some((id) => String(id) === String(currentUser._id))) return false;
    if (allowMode === 'none') return false;
    return true;
  }, [currentUser?._id, post.userId, allowlist, denylist, allowMode, hideStickersInFeed]);
  useEffect(() => {
    stickersRef.current = stickers;
  }, [stickers]);

  useEffect(() => {
    if (!selectedStickerId) return;
    const stillExists = stickers.some((item) => getStickerId(item) === selectedStickerId);
    if (!stillExists) {
      setSelectedStickerId(null);
      hideStickerControls();
    }
  }, [stickers, selectedStickerId, hideStickerControls]);

  useEffect(() => {
    if (!stickerAttribution?.id) return;
    const stillExists = stickers.some((item) => getStickerId(item) === stickerAttribution.id);
    if (!stillExists) {
      hideStickerAttribution();
    }
  }, [stickers, stickerAttribution?.id, hideStickerAttribution]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleExternalAttribution = (event) => {
      const externalPostId = event?.detail?.postId;
      if (!externalPostId || externalPostId === post._id) return;
      hideStickerAttribution();
    };
    window.addEventListener('sticker-attribution-shown', handleExternalAttribution);
    return () => {
      window.removeEventListener('sticker-attribution-shown', handleExternalAttribution);
    };
  }, [post._id, hideStickerAttribution]);

  useEffect(() => {
    if (stickersMuted) {
      AnimatedVideoRegistry.pauseAll();
    }
  }, [stickersMuted]);

  useEffect(() => () => {
    if (touchDragRef.current?.cleanup) {
      touchDragRef.current.cleanup();
    }
  }, []);

  useEffect(() => {
    setIsDragOver(canPlaceStickers && hoverTargetId === post._id);
  }, [hoverTargetId, post._id, canPlaceStickers]);

  useEffect(() => {
    if (!activeDrag) return;
    if (hoverTargetId !== post._id) return;

    if (!canPlaceStickers) {
      const now = Date.now();
      if (now - lastPermissionTsRef.current < 1800) return;
      lastPermissionTsRef.current = now;
      showPermissionNotice('You do not have permission to place stickers here.');
      return;
    }

    if (activeDrag?.source === 'picker') {
      const currentCount = stickersRef.current ? stickersRef.current.length : stickers.length;
      if (currentCount >= maxStickers) {
        showPermissionNotice('Sticker limit reached for this post.');
      }
    }
  }, [activeDrag, hoverTargetId, post._id, canPlaceStickers, maxStickers, showPermissionNotice, stickers.length]);

  useEffect(() => {
    if (!settingsOpen) return;
    setSettingsDraft({
      allowMode,
      allowstickytext: Boolean(stickerSettings.allowstickytext),
      allowstickymedia: Boolean(stickerSettings.allowstickymedia),
      allowlist: allowlist.join(', '),
      denylist: denylist.join(', '),
      maxCount: Number(stickerSettings.maxCount) || 20,
    });
  }, [settingsOpen, allowMode, stickerSettings.allowstickytext, stickerSettings.allowstickymedia, allowlist, denylist, stickerSettings.maxCount]);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearHoldTimer(), [clearHoldTimer]);

  useEffect(
    () => () => {
      if (permissionTimerRef.current) {
        clearTimeout(permissionTimerRef.current);
        permissionTimerRef.current = null;
      }
    },
    []
  );

  useEffect(
    () => () => {
      if (permissionTimerRef.current) {
        clearTimeout(permissionTimerRef.current);
        permissionTimerRef.current = null;
      }
    },
    []
  );

  // close menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!menuOpen) return;

    const onDocMouseDown = (e) => {
      const menuEl = menuRef.current;
      const btnEl = optionsBtnRef.current;
      if (!menuEl || !btnEl) return;
      if (menuEl.contains(e.target) || btnEl.contains(e.target)) return; // click inside; keep open
      setMenuOpen(false);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleTrashDrop = (event) => {
      const detail = event.detail || {};
      const placementId =
        detail.placementId || (detail.sticker ? getStickerId(detail.sticker) : null);
      if (!placementId) return;
      const sticker = stickersRef.current.find((item) => getStickerId(item) === placementId);
      if (!sticker) return;
      if (!canDeleteSticker(sticker)) return;
      hideStickerControls();
      setSelectedStickerId((prev) => (prev === placementId ? null : prev));
      handleStickerDelete(placementId);
    };
    window.addEventListener('sticker-trash-drop', handleTrashDrop);
    return () => window.removeEventListener('sticker-trash-drop', handleTrashDrop);
  }, [handleStickerDelete, hideStickerControls, canDeleteSticker]);

  const startStickerMove = useCallback(
    (sticker, clientX, clientY, rect) => {
      const placementId = getStickerId(sticker);
      if (!placementId) return false;
      const position = sticker.position || {};
      const center = {
        x: rect.left + (typeof position.x === 'number' ? position.x : 0.5) * rect.width,
        y: rect.top + (typeof position.y === 'number' ? position.y : 0.5) * rect.height,
      };
      const started = beginStickerMove({
        sticker,
        postId: post._id,
        placementId,
        center,
        point: { x: clientX, y: clientY },
        scale: typeof sticker.scale === 'number' ? sticker.scale : 1,
        rotation: typeof sticker.rotation === 'number' ? sticker.rotation : 0,
      });
      if (started) {
        movingStickerIdRef.current = placementId;
        setMovingStickerId(placementId);
      }
      return started;
    },
    [beginStickerMove, post._id]
  );

  const handleStickerPointerDown = useCallback(
    (event, sticker) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (stickersMuted || allowMode === 'none') return;
      const stickerId = getStickerId(sticker);
      if (!stickerId) return;
      const movable = canMoveSticker(sticker);
      if (!movable) {
        event.preventDefault();
        event.stopPropagation();
        clearHoldTimer();
        showStickerAttribution(sticker);
        return;
      }
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      event.preventDefault();
      event.stopPropagation();
      clearHoldTimer();
      hideStickerAttribution();
      showStickerControls(stickerId);

      const pointerType = event.pointerType || 'mouse';
      if (pointerType === 'touch' || pointerType === 'pen') {
        const startX = event.clientX;
        const startY = event.clientY;
        const pointerId = event.pointerId;

        const state = {
          pointerId,
          rect,
          sticker,
          started: false,
          cleanup: () => {},
        };

        const cleanup = () => {
          document.removeEventListener('pointermove', handleMove, true);
          document.removeEventListener('pointerup', handleUpOrCancel, true);
          document.removeEventListener('pointercancel', handleUpOrCancel, true);
          if (touchDragRef.current === state) {
            touchDragRef.current = null;
          }
        };

        const handleMove = (moveEvent) => {
          if (moveEvent.pointerId !== pointerId || state.started) return;
          const dx = Math.abs(moveEvent.clientX - startX);
          const dy = Math.abs(moveEvent.clientY - startY);
          if (Math.max(dx, dy) >= 6) {
            const started = startStickerMove(sticker, moveEvent.clientX, moveEvent.clientY, rect);
            state.started = started;
            cleanup();
          }
        };

        const handleUpOrCancel = (endEvent) => {
          if (endEvent.pointerId !== pointerId) return;
          cleanup();
        };

        state.cleanup = cleanup;
        touchDragRef.current = state;
        document.addEventListener('pointermove', handleMove, true);
        document.addEventListener('pointerup', handleUpOrCancel, true);
        document.addEventListener('pointercancel', handleUpOrCancel, true);
        return;
      }

      startStickerMove(sticker, event.clientX, event.clientY, rect);
    },
    [allowMode, canMoveSticker, clearHoldTimer, hideStickerAttribution, showStickerAttribution, showStickerControls, startStickerMove, stickersMuted]
  );

  const handleStickerDoubleClick = useCallback(
    (event, sticker) => {
      event.preventDefault();
      event.stopPropagation();
      if (stickersMuted || allowMode === 'none') return;
      if (sticker.assetType === 'image' || sticker.assetType === 'video') {
        addStickerFromPlacement(sticker);
      }
    },
    [addStickerFromPlacement, stickersMuted, allowMode]
  );

  const handleStickerContextMenu = useCallback(
    (event, sticker) => {
      event.preventDefault();
      event.stopPropagation();
      if (stickersMuted || allowMode === 'none') return;
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
    [canDeleteSticker, handleStickerDelete, stickersMuted, allowMode]
  );

  const commitStickerTransform = useCallback(
    async ({ stickerId, baseScale, baseRotation, nextScale, nextRotation }) => {
      if (!stickerId) return;
      const userId = currentUser?._id;
      if (!userId) {
        setStickers((prev) =>
          prev.map((item) =>
            getStickerId(item) === stickerId
              ? { ...item, scale: baseScale, rotation: baseRotation }
              : item
          )
        );
        return;
      }
      const sticker = stickersRef.current.find((s) => getStickerId(s) === stickerId);
      if (!sticker) return;

      const payload = {
        userId,
        position: sticker.position,
        scale: clamp(nextScale, STICKER_MIN_SCALE, STICKER_MAX_SCALE),
        rotation: normalizeDegrees(nextRotation),
        anchor: sticker.anchor,
        anchorRect: sticker.anchorRect,
      };

      const previous = {
        scale: baseScale,
        rotation: normalizeDegrees(baseRotation),
      };

      try {
        const updated = await updateStickerPlacement(post._id, stickerId, payload);
        if (updated && typeof updated === 'object') {
          setStickers((prev) =>
            prev.map((item) =>
              getStickerId(item) === stickerId
                ? {
                    ...item,
                    scale: typeof updated.scale === 'number' ? updated.scale : payload.scale,
                    rotation:
                      typeof updated.rotation === 'number'
                        ? normalizeDegrees(updated.rotation)
                        : payload.rotation,
                    position: updated.position || item.position,
                    anchor: updated.anchor || item.anchor,
                    anchorRect: updated.anchorRect || item.anchorRect,
                  }
                : item
            )
          );
        }
      } catch (err) {
        console.error('Failed to resize sticker', err);
        setStickers((prev) =>
          prev.map((item) =>
            getStickerId(item) === stickerId
              ? { ...item, scale: previous.scale, rotation: previous.rotation }
              : item
          )
        );
      }
    },
    [currentUser?._id, post._id]
  );

  const handleDropNewSticker = useCallback(
    async ({ sticker, position, scale, rotation }) => {
      const safeScale = clamp(
        typeof scale === 'number' ? scale : 1,
        STICKER_MIN_SCALE,
        STICKER_MAX_SCALE
      );
      const safeRotation =
        typeof rotation === 'number' ? rotation * ROTATION_COEFFICIENT : 0;

      if (!canPlaceStickers || !currentUser?._id) return;

      const currentCount = stickersRef.current ? stickersRef.current.length : stickers.length;
      if (currentCount >= maxStickers) {
        showPermissionNotice('Sticker limit reached for this post.');
        return;
      }

      const baseSize = getBaseSize(sticker);
      if (!isAllowedCenter(position, baseSize * safeScale)) {
        return;
      }
      const anchorInfo = resolveAnchorInfo(position, { media: mediaBounds, text: textBounds });
      const anchorPosition = toAnchorSpace(position, anchorInfo);
      try {
        const payload = {
          userId: currentUser._id,
          position: anchorPosition,
          scale: safeScale,
          rotation: safeRotation,
          anchor: anchorInfo.anchor,
          anchorRect: anchorInfo.anchorRect,
        };

        if (sticker.origin === 'custom' || sticker.assetType === 'image' || sticker.assetType === 'video') {
          payload.stickerKey = sticker.stickerKey || sticker.key;
          payload.customSticker = {
            assetType: sticker.assetType,
            assetValue: normalizeMediaUrl(sticker.assetValue),
            label: sticker.label,
            poster: normalizeMediaUrl(sticker.poster) || null,
            mediaSize: sticker.mediaSize || null,
            format: sticker.format || null,
          };
        } else {
          payload.stickerKey = sticker.stickerKey || sticker.key;
        }

        const placement = await createStickerPlacement(post._id, payload);
        if (placement) {
          const newPlacement = {
            ...placement,
            position: placement.position || anchorPosition,
            anchor: placement.anchor || anchorInfo.anchor,
            anchorRect: placement.anchorRect || anchorInfo.anchorRect,
          };
          setStickers((prev) => [...prev, { ...newPlacement, position: anchorPosition }]);
          const newId = getStickerId(newPlacement);
          if (newId) {
            showStickerControls(newId);
          }
        }
      } catch (err) {
        if (err?.response?.status === 403) {
          alert('Stickers are disabled for this post.');
        } else if (err?.response?.status === 409) {
          showPermissionNotice('Sticker limit reached for this post.');
        } else {
          console.error('Failed to place sticker', err);
        }
      }
    }, [canPlaceStickers, currentUser?._id, post._id, isAllowedCenter, maxStickers, showPermissionNotice, getBaseSize, stickers.length, normalizeMediaUrl, mediaBounds, textBounds, showStickerControls]);

  const handleDropMoveSticker = useCallback(
    async ({ placementId, position, scale, rotation }) => {
      const safeScale = clamp(
        typeof scale === 'number' ? scale : 1,
        STICKER_MIN_SCALE,
        STICKER_MAX_SCALE
      );
      const safeRotation =
        typeof rotation === 'number' ? rotation * ROTATION_COEFFICIENT : 0;

      if (!currentUser?._id || !placementId) return;

      const sticker = stickersRef.current.find(
        (s) => getStickerId(s) === placementId
      );
      if (!sticker || !canMoveSticker(sticker)) {
        movingStickerIdRef.current = null;
        setMovingStickerId(null);
        return;
      }
      const baseSize = getBaseSize(sticker);
      if (!isAllowedCenter(position, baseSize * safeScale)) {
        movingStickerIdRef.current = null;
        setMovingStickerId(null);
        return;
      }
      const anchorInfo = resolveAnchorInfo(position, { media: mediaBounds, text: textBounds });
      const anchorPosition = toAnchorSpace(position, anchorInfo);

      const previous = {
        position: sticker.position,
        scale: sticker.scale,
        rotation: sticker.rotation,
      };

      setStickers((prev) =>
        prev.map((item) =>
          getStickerId(item) === placementId
            ? {
                ...item,
                position: anchorPosition,
                scale: safeScale,
                rotation: safeRotation,
                anchor: anchorInfo.anchor,
                anchorRect: anchorInfo.anchorRect,
              }
            : item
        )
      );
      showStickerControls(placementId);

      try {
        await updateStickerPlacement(post._id, placementId, {
          userId: currentUser._id,
          position: anchorPosition,
          scale: safeScale,
          rotation: safeRotation,
          anchor: anchorInfo.anchor,
          anchorRect: anchorInfo.anchorRect,
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
                  anchor: sticker.anchor,
                  anchorRect: sticker.anchorRect,
                }
              : item
          )
        );
      } finally {
        movingStickerIdRef.current = null;
        setMovingStickerId(null);
      }
    }, [currentUser?._id, canMoveSticker, post._id, isAllowedCenter, getBaseSize, mediaBounds, textBounds, showStickerControls]);

  const handleStickerTransformPointerDown = useCallback(
    (event, sticker) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (stickersMuted || allowMode === 'none') return;
      if (!canMoveSticker(sticker)) return;
      const stickerId = getStickerId(sticker);
      if (!stickerId) return;
      const node = stickerRefs.current.get(stickerId);
      if (!node) return;

      hideStickerAttribution();
      showStickerControls(stickerId);
      event.preventDefault();
      event.stopPropagation();

      const rect = node.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      const baseScale = clamp(
        typeof sticker.scale === 'number' ? sticker.scale : 1,
        STICKER_MIN_SCALE,
        STICKER_MAX_SCALE
      );
      const baseRotation = normalizeDegrees(
        typeof sticker.rotation === 'number' ? sticker.rotation : 0
      );
      const pointerId = event.pointerId || 0;
      const pointerTarget = event.currentTarget;
      const vectorX = event.clientX - center.x;
      const vectorY = event.clientY - center.y;
      const baseDistance = Math.max(Math.hypot(vectorX, vectorY), 12);
      const baseAngle = Math.atan2(vectorY, vectorX);

      const existing = transformStateRef.current;
      if (existing) {
        if (existing.moveListener) {
          document.removeEventListener('pointermove', existing.moveListener, true);
        }
        if (existing.upListener) {
          document.removeEventListener('pointerup', existing.upListener, true);
          document.removeEventListener('pointercancel', existing.upListener, true);
        }
        transformStateRef.current = null;
      }

      const state = {
        stickerId,
        pointerId,
        pointerTarget,
        center,
        baseScale,
        baseRotation,
        baseDistance,
        baseAngle,
        latestScale: baseScale,
        latestRotation: baseRotation,
        moveListener: null,
        upListener: null,
      };

      const handleMove = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        const dx = moveEvent.clientX - center.x;
        const dy = moveEvent.clientY - center.y;
        const distance = Math.max(Math.hypot(dx, dy), 6);
        const ratio = distance / state.baseDistance;
        const nextScale = clamp(state.baseScale * (Number.isFinite(ratio) ? ratio : 1), STICKER_MIN_SCALE, STICKER_MAX_SCALE);
        const angle = Math.atan2(dy, dx);
        const deltaDeg = ((angle - state.baseAngle) * 180) / Math.PI;
        const nextRotation = normalizeDegrees(state.baseRotation + deltaDeg);

        state.latestScale = nextScale;
        state.latestRotation = nextRotation;

        setStickers((prev) =>
          prev.map((item) =>
            getStickerId(item) === stickerId
              ? { ...item, scale: nextScale, rotation: nextRotation }
              : item
          )
        );
        showStickerControls(stickerId);
      };

      const handleUp = async (endEvent) => {
        if (endEvent.pointerId !== pointerId) return;
        endEvent.preventDefault();
        endEvent.stopPropagation();
        if (state.pointerTarget && state.pointerTarget.releasePointerCapture) {
          try {
            state.pointerTarget.releasePointerCapture(pointerId);
          } catch (err) {
            // ignore capture release errors
          }
        }
        document.removeEventListener('pointermove', handleMove, true);
        document.removeEventListener('pointerup', handleUp, true);
        document.removeEventListener('pointercancel', handleUp, true);
        transformStateRef.current = null;
        setActiveTransformId(null);

        const finalScale = clamp(state.latestScale, STICKER_MIN_SCALE, STICKER_MAX_SCALE);
        const finalRotation = normalizeDegrees(state.latestRotation);
        const cancelled = endEvent.type === 'pointercancel';

        if (cancelled) {
          setStickers((prev) =>
            prev.map((item) =>
              getStickerId(item) === stickerId
                ? { ...item, scale: state.baseScale, rotation: state.baseRotation }
                : item
            )
          );
          showStickerControls(stickerId);
          return;
        }

        const scaleChanged = Math.abs(finalScale - state.baseScale) > 0.002;
        const rotationChanged = Math.abs(finalRotation - state.baseRotation) > 0.75;

        showStickerControls(stickerId);

        if (!scaleChanged && !rotationChanged) {
          return;
        }

        await commitStickerTransform({
          stickerId,
          baseScale: state.baseScale,
          baseRotation: state.baseRotation,
          nextScale: finalScale,
          nextRotation: finalRotation,
        });
      };

      state.moveListener = handleMove;
      state.upListener = handleUp;
      transformStateRef.current = state;
      setActiveTransformId(stickerId);

      document.addEventListener('pointermove', handleMove, true);
      document.addEventListener('pointerup', handleUp, true);
      document.addEventListener('pointercancel', handleUp, true);

      if (pointerTarget && pointerTarget.setPointerCapture) {
        try {
          pointerTarget.setPointerCapture(pointerId);
        } catch (err) {
          // ignore capture errors
        }
      }
    },
    [allowMode, canMoveSticker, commitStickerTransform, hideStickerAttribution, setStickers, showStickerControls, stickersMuted]
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
      allowstickytext: Boolean(stickerSettings.allowstickytext),
      allowstickymedia: Boolean(stickerSettings.allowstickymedia),
      allowlist: allowlist.join(', '),
      denylist: denylist.join(', '),
      maxCount: Number(stickerSettings.maxCount) || 20,
    });
    setSettingsOpen((prev) => !prev);
  }, [isOwner, allowMode, stickerSettings.allowstickytext, stickerSettings.allowstickymedia, allowlist, denylist, stickerSettings.maxCount]);

  const handleSettingsChange = useCallback(
    (field) => (event) => {
      const isCheckbox = field === 'allowstickytext' || field === 'allowstickymedia';
      let value = isCheckbox ? event.target.checked : event.target.value;
      if (field === 'maxCount') {
        value = Math.min(30, Math.max(1, parseInt(value, 10) || 20));
      }
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
        allowstickytext: !!settingsDraft.allowstickytext,
        allowstickymedia: !!settingsDraft.allowstickymedia,
        maxCount: Math.min(30, Math.max(1, parseInt(settingsDraft.maxCount, 10) || 20)),
      };

      const updated = await updateStickerSettings(post._id, payload);
      setSettingsOpen(false);

      if (updated) {
        onPostUpdated?.({ ...post, stickerSettings: updated });
      }
    } catch (err) {
      console.error('Failed to update sticker settings', err?.response?.status, err?.response?.data);
      alert('Could not update sticker settings right now!');
    }


  }, [
    isOwner,
    currentUser?._id,
    settingsDraft,
    parseListInput,
    onPostUpdated,
    post,
  ]);

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
      axios.put(`/api/posts/${post._id}/like`, { userId: currentUser._id });
    } catch (err) { console.error("Failed to like post", err); }
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
    setIsLiked(!isLiked);
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (window.confirm("Delete this post?")) {
      try {
        await axios.delete(`/api/posts/${post._id}`, { data: { userId: currentUser._id } });
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

  const mediaAttachments = useMemo(() => {
    const list = Array.isArray(post.attachments) ? [...post.attachments] : [];
    const normalized = list.map((item, index) => ({
      ...item,
      type: item.type === 'gif' ? 'video' : item.type || 'image',
      key: item._id || `${post._id}-att-${index}`,
      url: toMediaUrl(item.url),
      poster: item.poster ? toMediaUrl(item.poster) : item.poster,
      autoPlay: Boolean(item.autoPlay),
    }));
    if (post.imageUrl) {
      const legacyUrl = post.imageUrl;
      const already = normalized.some((item) => String(item.url) === String(legacyUrl));
      if (!already) {
        normalized.unshift({
          type: 'image',
          url: toMediaUrl(legacyUrl),
          key: `${post._id}-legacy-image`,
        });
      }
    }
    return normalized;
  }, [post.attachments, post.imageUrl, post._id]);

  const computeAnchorBounds = useCallback(() => {
    const cardEl = containerRef.current;
    if (!cardEl) {
      setMediaBounds(null);
      setTextBounds(null);
      return;
    }
    const cardRect = cardEl.getBoundingClientRect();
    if (!cardRect.width || !cardRect.height) {
      setMediaBounds(null);
      setTextBounds(null);
      return;
    }

    const calcBounds = (target) => {
      if (!target) return null;
      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return {
        top: (rect.top - cardRect.top) / cardRect.height,
        left: (rect.left - cardRect.left) / cardRect.width,
        width: rect.width / cardRect.width,
        height: rect.height / cardRect.height,
      };
    };

    const media = calcBounds(mediaRef.current);
    const text = calcBounds(contentTextRef.current);

    setMediaBounds(
      media
        ? {
            top: clamp(media.top, 0, 1),
            left: clamp(media.left, 0, 1),
            width: clamp(media.width, 0, 1),
            height: clamp(media.height, 0, 1),
          }
        : null
    );

    setTextBounds(
      text
        ? {
            top: clamp(text.top, 0, 1),
            left: clamp(text.left, 0, 1),
            width: clamp(text.width, 0, 1),
            height: clamp(text.height, 0, 1),
          }
        : null
    );
  }, []);

  useEffect(() => {
    computeAnchorBounds();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => computeAnchorBounds());
      if (mediaRef.current) observer.observe(mediaRef.current);
      if (contentTextRef.current) observer.observe(contentTextRef.current);
      if (containerRef.current) observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', computeAnchorBounds);
    return () => window.removeEventListener('resize', computeAnchorBounds);
  }, [computeAnchorBounds, mediaAttachments.length, textContent]);

  const pointerEnabled = !hideStickersInFeed && allowMode !== 'none' && !stickersMuted;

  useEffect(() => {
    if (pointerEnabled) return;
    setSelectedStickerId(null);
    hideStickerControls();
    hideStickerAttribution();
  }, [pointerEnabled, hideStickerControls, hideStickerAttribution, setSelectedStickerId]);

  const isHovering = hoverTargetId === post._id;

  const dropPreview = useMemo(() => {
    if (hideStickersInFeed) return null;
    if (!activeDrag) return null;
    if (!isHovering) return null;
    if (!activeDrag.hoverPosition) return null;
    const card = containerRef.current?.getBoundingClientRect();
    if (!card) return null;
    const baseSize = getBaseSize(activeDrag.sticker);
    const scale = clamp(
      typeof activeDrag.scale === 'number' ? activeDrag.scale : 1,
      STICKER_MIN_SCALE,
      STICKER_MAX_SCALE
    );
    const sizePx = baseSize * scale;
    const isNewSticker = activeDrag?.source === 'picker';
    const currentCount = stickersRef.current ? stickersRef.current.length : stickers.length;
    const capacityAvailable = !isNewSticker || currentCount < maxStickers;
    const allowed =
      canPlaceStickers &&
      capacityAvailable &&
      isAllowedCenter(activeDrag.hoverPosition, sizePx);
    const centerX = activeDrag.hoverPosition.x * card.width;
    const centerY = activeDrag.hoverPosition.y * card.height;
    const rotation =
      typeof activeDrag.rotation === 'number' ? activeDrag.rotation : 0;
    return {
      allowed,
      sizePx,
      centerX,
      centerY,
      rotation,
    };
  }, [activeDrag, canPlaceStickers, hideStickersInFeed, isHovering, isAllowedCenter, getBaseSize, maxStickers, stickers.length]);

  const protectedZones = useMemo(() => {
    if (hideStickersInFeed) return [];
    if (!isHovering || !canPlaceStickers) return [];
    const card = containerRef.current?.getBoundingClientRect();
    if (!card) return [];
    const zones = rectsProtected();
    return zones.map((rect, index) => ({
      id: index,
      left: (rect.left / card.width) * 100,
      top: (rect.top / card.height) * 100,
      width: ((rect.right - rect.left) / card.width) * 100,
      height: ((rect.bottom - rect.top) / card.height) * 100,
    }));
  }, [hideStickersInFeed, isHovering, canPlaceStickers, rectsProtected]);

  const addCapacityBlocked = useMemo(() => {
    if (hideStickersInFeed) return false;
    if (!activeDrag || activeDrag.source !== 'picker') return false;
    const currentCount = stickersRef.current ? stickersRef.current.length : stickers.length;
    return currentCount >= maxStickers;
  }, [activeDrag, hideStickersInFeed, maxStickers, stickers.length]);

  const dropGuideState = !isHovering || !canPlaceStickers
    ? 'neutral'
    : addCapacityBlocked
    ? 'blocked'
    : dropPreview
    ? dropPreview.allowed
      ? 'allowed'
      : 'blocked'
    : 'neutral';

  const stickersForDisplay = useMemo(() => {
    if (hideStickersInFeed) return [];
    return Array.isArray(stickers) ? stickers : [];
  }, [stickers, hideStickersInFeed]);

  const totalAnimatedBytes = useMemo(() => {
    return stickersForDisplay.reduce((sum, sticker) => {
      if (sticker?.assetType === 'video') {
        const bytes = Number(sticker.mediaSize) || 0;
        return sum + bytes;
      }
      return sum;
    }, 0);
  }, [stickersForDisplay]);

  const animatedBudgetExceeded = totalAnimatedBytes > 10 * 1024 * 1024;

  useEffect(() => {
    if (hideStickersInFeed || resolvedAnimationsDisabled) {
      AnimatedVideoRegistry.pauseAll();
      return;
    }
    if (animatedBudgetExceeded) {
      showPermissionNotice('Animations paused to keep things responsive.');
      AnimatedVideoRegistry.pauseAll();
    }
  }, [animatedBudgetExceeded, hideStickersInFeed, resolvedAnimationsDisabled, showPermissionNotice]);

  useEffect(() => {
    if (hideStickersInFeed || resolvedAnimationsDisabled) {
      setPermissionNotice(null);
      if (permissionTimerRef.current) {
        clearTimeout(permissionTimerRef.current);
        permissionTimerRef.current = null;
      }
    }
  }, [hideStickersInFeed, resolvedAnimationsDisabled]);


  const handleClearAllStickers = useCallback(async () => {
    if (!isOwner || !currentUser?._id) return false;
    try {
      await clearAllStickers(post._id, { userId: currentUser._id });
      setStickers([]); // instant UI update
      setSettingsOpen(false);
      return true;
    } catch (err) {
      console.error('Failed to clear stickers', err);
      alert('Could not clear stickers right now.');
      return false;
    }
  }, [isOwner, currentUser?._id, post._id]);


  return (
    <PostContainer
      ref={containerRef}
      className="surface"
      $dragOver={isDragOver}
      $raised={menuOpen || settingsOpen || selectionVisible || Boolean(stickerAttribution)}
      onClick={handleContainerClick}
      onMouseDown={handleHoldStart}
      onMouseUp={handleHoldEnd}
      onMouseLeave={handleHoldEnd}
    >
      <StickerCanvas>
        {isHovering && canPlaceStickers &&
          protectedZones.map((zone) => (
            <ProtectedMask
              key={zone.id}
              style={{
                left: `${zone.left}%`,
                top: `${zone.top}%`,
                width: `${zone.width}%`,
                height: `${zone.height}%`,
              }}
            />
          ))}

        {canPlaceStickers && dropPreview && (
          <DropGhost
            $allowed={dropPreview.allowed}
            style={{
              width: dropPreview.sizePx,
              height: dropPreview.sizePx,
              left: dropPreview.centerX,
              top: dropPreview.centerY,
              transform: `translate(-50%, -50%) rotate(${dropPreview.rotation}deg)`,
            }}
          />
        )}

        {stickersForDisplay.map((sticker) => {
          const position = sticker.position || {};
          const x = Math.min(Math.max(typeof position.x === 'number' ? position.x : 0.5, 0), 1);
          const y = Math.min(Math.max(typeof position.y === 'number' ? position.y : 0.5, 0), 1);
          const rotation = typeof sticker.rotation === 'number' ? sticker.rotation : 0;
          const scale = clamp(
            typeof sticker.scale === 'number' ? sticker.scale : 1,
            STICKER_MIN_SCALE,
            STICKER_MAX_SCALE
          );
          const baseVisualSize = getBaseSize(sticker);
          const anchorRectRaw =
            sticker.anchor === 'text' && textBounds
              ? textBounds
              : sticker.anchor === 'media' && mediaBounds
              ? mediaBounds
              : (sticker.anchor === 'media' || sticker.anchor === 'text') && sticker.anchorRect
              ? sticker.anchorRect
              : { top: 0, left: 0, width: 1, height: 1 };
          const anchorRect = {
            top: clamp(Number(anchorRectRaw.top) || 0, 0, 1),
            left: clamp(Number(anchorRectRaw.left) || 0, 0, 1),
            width: clamp(Number(anchorRectRaw.width) || 1, 0.001, 1),
            height: clamp(Number(anchorRectRaw.height) || 1, 0.001, 1),
          };
          const anchorLeft = clamp(anchorRect.left + x * anchorRect.width, 0, 1);
          const anchorTop = clamp(anchorRect.top + y * anchorRect.height, 0, 1);
          const key = sticker.id || sticker._id || `${sticker.stickerKey}-${x}-${y}-${rotation}`;
          const title = sticker.placedByUser?.username
            ? `${sticker.placedByUser.username}'s sticker`
            : 'Sticker';
          const stickerId = getStickerId(sticker);
          const interactive = canMoveSticker(sticker);
          const hideSticker =
            movingStickerId && stickerId === movingStickerId && activeDrag?.placementId === movingStickerId;
          const stickerPoster = sticker.poster ? toMediaUrl(sticker.poster) : null;
          const stickerSrc = toMediaUrl(sticker.assetValue);
          const isAttributed = stickerAttribution?.id === stickerId;
          const isSelected = interactive && selectionVisible && selectedStickerId === stickerId;
          const isTransforming = activeTransformId === stickerId;
          const actualSize = baseVisualSize * scale;
          const outlineScale = scale * 1.08;
          const outlineRadius = Math.max(12, baseVisualSize * 0.36);
          const outlineBorderWidth = Math.max(2, Math.min(3, baseVisualSize * 0.045));
          const handleSize = Math.max(16, Math.min(28, actualSize * 0.24));
          const handleOffset = Math.max(8, Math.min(actualSize * 0.16, 26));
          const labelOffset = Math.max(10, Math.min(actualSize * 0.24, 44));
          if (hideSticker) {
            return null;
          }
          return (
            <StickerItem
              key={key}
              title={title}
              $muted={stickersMuted}
              $interactive={interactive}
              $pointerEnabled={pointerEnabled}
              $selected={isSelected}
              $attributed={isAttributed}
              style={{
                left: `${anchorLeft * 100}%`,
                top: `${anchorTop * 100}%`,
                transform: `translate(-50%, -50%)`,
                width: `${baseVisualSize}px`,
                height: `${baseVisualSize}px`,
              }}
              data-sticker-item="true"
              ref={(node) => {
                if (!stickerId) return;
                if (node) {
                  stickerRefs.current.set(stickerId, node);
                } else {
                  stickerRefs.current.delete(stickerId);
                }
              }}
              onPointerDown={(event) => handleStickerPointerDown(event, sticker)}
              onDoubleClick={(event) => handleStickerDoubleClick(event, sticker)}
              onContextMenu={(event) => handleStickerContextMenu(event, sticker)}
            >
            <StickerOutline
              $visible={isSelected}
              $radius={outlineRadius}
              $borderWidth={outlineBorderWidth}
              style={{
                transform: `rotate(${rotation}deg) scale(${outlineScale})`,
              }}
            />
            <StickerBody
              style={{
                transform: `rotate(${rotation}deg) scale(${scale})`,
              }}
            >
              {sticker.assetType === 'image' ? (
                <img
                  src={stickerSrc}
                  alt={sticker.stickerKey || 'sticker'}
                  style={{ width: `${baseVisualSize}px`, height: `${baseVisualSize}px` }}
                />
              ) : sticker.assetType === 'video' ? (
                <StickerVideo
                  src={stickerSrc}
                  poster={stickerPoster}
                  size={baseVisualSize}
                  muted={stickersMuted}
                  disableAutoPlay={resolvedAnimationsDisabled || animatedBudgetExceeded}
                  prefersReducedMotion={prefersReducedMotion || resolvedAnimationsDisabled}
                  rounded
                />
              ) : (
                <span style={{ fontSize: `${baseEmojiSize}px` }}>{sticker.assetValue || '⭐'}</span>
              )}
            </StickerBody>
            {interactive && (
              <StickerHandle
                type="button"
                aria-label="Resize or rotate sticker"
                $visible={isSelected}
                $active={isTransforming}
                $hidden={isTransforming}
                onPointerDown={(event) => handleStickerTransformPointerDown(event, sticker)}
                style={{
                  width: handleSize,
                  height: handleSize,
                  right: -handleOffset,
                  bottom: -handleOffset,
                }}
              />
            )}
            {isAttributed && stickerAttribution.label && (
              <StickerAttribution
                style={{
                  transform: `translate(-50%, ${labelOffset}px)`,
                }}
              >
                {stickerAttribution.label}
              </StickerAttribution>
            )}
            </StickerItem>
          );
        })}
      </StickerCanvas>
      <DropGuide
        $visible={isHovering && canPlaceStickers}
        $state={dropGuideState}
      />
      {permissionNotice && (
        <PermissionNotice role="status" aria-live="polite">
          {permissionNotice}
        </PermissionNotice>
      )}
        <PostHeader>
          <ProfilePic ref={avatarRef} src={avatarSrc} fallback={FALLBACK_AVATAR} alt="User avatar" />

          <UserInfo>
            <UsernameRow>
              <Username
                ref={usernameRef}
                to={`/profile/${post.username}`}
                data-username-link={post.username}
              >
                {post.username}
              </Username>
              {!!post.titleBadge && (
                <TitleBadge ref={titleBadgeRef}>{post.titleBadge}</TitleBadge>
              )}
            </UsernameRow>

            <Timestamp ref={timestampRef}>
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
              <OptionsButton
                ref={optionsBtnRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                aria-label="More options"
              >
                <FaEllipsisH />
              </OptionsButton>

              {menuOpen && (
                <DropdownMenu
                  ref={menuRef}
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownItem
                    onClick={() => {
                      setMenuOpen(false);
                      setEditOpen(true);
                    }}
                  >
                    Edit Post
                  </DropdownItem>

                  <DropdownItem
                    onClick={() => {
                      setMenuOpen(false);
                      handleToggleSettings();
                    }}
                  >
                    Sticker Settings
                  </DropdownItem>

                  <DropdownItem
                    onClick={() => {
                      setMenuOpen(false);
                      handleDelete();
                    }}
                  >
                    Delete Post
                  </DropdownItem>
                </DropdownMenu>
              )}
            </>
          )}
        </PostHeader>

      {textContent && (
        <PostContent>
          <span ref={contentTextRef}>{textContent}</span>
        </PostContent>
      )}

      {mediaAttachments.length > 0 && (
        <MediaGrid ref={mediaRef} $count={mediaAttachments.length}>
          {mediaAttachments.map((attachment, index) => {
            const src = attachment.url;
            if (attachment.type === 'video') {
              return (
                <AttachmentVideo
                  key={attachment.key || `${post._id}-video-${index}`}
                  src={src}
                  poster={attachment.poster}
                  autoPlay={Boolean(attachment.autoPlay)}
                  prefersReducedMotion={prefersReducedMotion}
                  animationsDisabled={resolvedAnimationsDisabled}
                />
              );
            }
            return (
              <SmartImg
                key={attachment.key || `${post._id}-img-${index}`}
                src={src}
                fallback=""
                alt={`post media ${index + 1}`}
              />
            );
          })}
        </MediaGrid>
      )}
                
    <PostActions>
      {/* Protect only the buttons cluster so white space stays placeable */}
      <div
        ref={actionsBtnsRef}
        style={{ display: 'flex', alignItems: 'center', gap: 20 }}
      >
        <Action
          data-ignore-hold
          onClick={(event) => {
            event.stopPropagation();
            likeHandler();
          }}
        >
          {isLiked ? (
            <FaHeart size={ICON_SIZE} color={HEART_COLOR} />
          ) : (
            <FaRegHeart size={ICON_SIZE} color={HEART_COLOR} />
          )}
          {likeCount}
        </Action>

        <Action
          data-ignore-hold
          onClick={(event) => {
            event.stopPropagation();
            window.dispatchEvent(new CustomEvent('fc-modal-open', { detail: 'post-comments' }));
            setCommentsOpen(true);
          }}
          title="View comments"
        >
          {hasCommented ? (
            <FaCommentAlt size={ICON_SIZE} color={COMMENT_COLOR} />
          ) : (
            <FaRegCommentAlt size={ICON_SIZE} color={COMMENT_COLOR} />
          )}
          {commentCount}
        </Action>
      </div>

      {/* Preview text is not protected so stickers can go in the white space */}
      {commentCount > 0 && commentPreview && (
        <CommentPreviewInline
          title={`${commentPreview.username} — ${commentPreview.snippet}`}
          style={{ marginLeft: 8, flex: 1 }}
        >
          {commentPreview.username} — {commentPreview.snippet}
        </CommentPreviewInline>
      )}
    </PostActions>
      <StickerSettingsModal
        open={Boolean(settingsOpen && isOwner)}
        values={settingsDraft}
        onChange={handleSettingsChange}
        onSave={handleSettingsSave}
        onCancel={handleSettingsCancel}
        onClearAll={handleClearAllStickers}
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
