import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import {
  PROFILE_LAYOUTS,
  PROFILE_MODULE_TYPES,
  buildAutoGridPlan,
  ensureLayoutDefaults,
  getLayoutColumns,
  MAX_CANVAS_MODULES,
  moduleHasVisibleContentPublic,
  createBioFallbackPreset,
} from '../utils/titantap-utils';
import { DEFAULT_BANNER_URL, API_BASE_URL, toMediaUrl } from '../config';
import UserLink from './UserLink';
import { getHobbyEmoji } from '../utils/hobbies';
import {
  TEXT_MODULE_CHAR_LIMIT,
  MAX_TEXTAREA_NEWLINES,
} from '../constants/profileLimits';
import { applyTextLimits } from '../utils/textLimits';

const ACCENT_COLORS = [
  '#fbbf24',
  '#f97316',
  '#ef4444',
  '#f43f5e',
  '#ec4899',
  '#d946ef',
  '#a855f7',
  '#6366f1',
  '#2563eb',
  '#0ea5e9',
  '#22d3ee',
  '#14b8a6',
  '#10b981',
  '#22c55e',
  '#84cc16',
  '#1e293b',
];

const mixWithWhite = (hex, ratio = 0.5) => {
  if (!hex) return '#ffffff';
  let normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const value = parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const mix = (channel) =>
    Math.max(0, Math.min(255, Math.round(channel + (255 - channel) * ratio)));
  const toHex = (channel) => channel.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
};

const darkenHex = (hex, ratio = 0.35) => {
  if (!hex) return '#0f172a';
  let normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const value = parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const scale = Math.max(0, 1 - ratio);
  const toHex = (channel) => channel.toString(16).padStart(2, '0');
  return `#${toHex(Math.round(r * scale))}${toHex(Math.round(g * scale))}${toHex(
    Math.round(b * scale)
  )}`;
};

const CARD_BODY_BASE_COLORS = [
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#6366f1',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#65a30d',
  '#fbbf24',
  '#1e293b',
  '#94a3b8',
];
const DEFAULT_CARD_BODY_PALENESS = 0.45;
const MIN_CARD_BODY_WHITE_MIX = 0;
const MAX_CARD_BODY_WHITE_MIX = 0.82;

const DEFAULT_CANVAS_COLOR_ID = 'glass';
const DEFAULT_CANVAS_OPACITY = 0.5;
const DEFAULT_CANVAS_PALENESS = 0.08;
const MIN_CANVAS_WHITE_MIX = 0.08;
const MAX_CANVAS_WHITE_MIX = 0.08;
const CANVAS_COLOR_OPTIONS = [
  {
    id: 'glass',
    label: 'Glass',
    colors: ['#f8fbff', '#e5edff'],
  },
  {
    id: 'classic',
    label: 'Classic',
    colors: ['#f7e27a', '#f2b94f'],
    angle: 150,
  },
  {
    id: 'frost',
    label: 'Lilac Frost',
    colors: ['#dcd2ff', '#9b7bff'],
    angle: 140,
  },
  {
    id: 'citrus',
    label: 'Citrus',
    colors: ['#ffd89a', '#ff8c42'],
    angle: 155,
  },
  {
    id: 'blush',
    label: 'Blush',
    colors: ['#ffc2d9', '#ff5f8f'],
    angle: 145,
  },
  {
    id: 'aurora',
    label: 'Aurora',
    colors: ['#d9ffb3', '#7ddf6a'],
    angle: 160,
  },
  {
    id: 'lagoon',
    label: 'Lagoon',
    colors: ['#7be8e6', '#1bb0b8'],
    angle: 150,
  },
  {
    id: 'midnight',
    label: 'Midnight',
    colors: ['#0f172a', '#1c2742'],
  },
  {
    id: 'sunset',
    label: 'Sunset',
    colors: ['#ff9a62', '#ff4f81'],
    angle: 135,
  },
  {
    id: 'oceanic',
    label: 'Oceanic',
    colors: ['#0f7bdc', '#00c6ff'],
    angle: 155,
  },
  {
    id: 'dune',
    label: 'Dune',
    colors: ['#f2e3c6', '#d9b88c'],
    angle: 125,
  },
  {
    id: 'neonwave',
    label: 'Neon Wave',
    colors: ['#ffd8f1', '#e7f3ff', '#ffe6cf'],
    stops: ['0%', '65%', '100%'],
    angle: 125,
  },
];
const CANVAS_COLOR_LOOKUP = new Map(CANVAS_COLOR_OPTIONS.map((option) => [option.id, option]));
const VISIBLE_LAYOUT_OPTIONS = new Set(['dynamic', 'freeform']);
const LAYOUT_MENU_OPTIONS = PROFILE_LAYOUTS.filter((layout) =>
  VISIBLE_LAYOUT_OPTIONS.has(layout.id)
);

const BASE_CANVAS_HEIGHT = 200;
const MIN_CANVAS_ASPECT = 1.5;
const MAX_CANVAS_ASPECT = 2.25;
const BASE_CANVAS_WIDTH = BASE_CANVAS_HEIGHT * MIN_CANVAS_ASPECT;
const MIN_CANVAS_SCALE = 0.3;
const MAX_CANVAS_SCALE = 1.2;
const MIN_MODULE_DIMENSION = 42;
const AUTO_GRID_MIN_DIMENSION = 42;
const MAX_MANUAL_HEIGHT = 520;
const SLOT_SCALE_MIN = 0.2;
const CARD_CANVAS_GAP = 6;
const CARD_CANVAS_PADDING = 6;
const CARD_CANVAS_BORDER = 1;
const CARD_CANVAS_VERTICAL_CHROME =
  (CARD_CANVAS_PADDING + CARD_CANVAS_BORDER) * 2;
const CARD_CANVAS_HORIZONTAL_CHROME =
  (CARD_CANVAS_PADDING + CARD_CANVAS_BORDER) * 2;
const TEXT_CHAR_LIMIT = TEXT_MODULE_CHAR_LIMIT;
const MAX_MODULE_NEWLINES = MAX_TEXTAREA_NEWLINES;
const TEXT_PLACEHOLDER = 'Tap to interact';

const ALIGN_MAP = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

const ALIGN_TOKENS = ['start', 'center', 'end'];
const INTEREST_LIMIT = 12;

function clampSlotScale(value, minScale = SLOT_SCALE_MIN) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 1;
  const floor = Math.max(
    SLOT_SCALE_MIN,
    Number.isFinite(minScale) ? minScale : SLOT_SCALE_MIN
  );
  return Math.min(1, Math.max(floor, num));
}

const DEFAULT_FOCUS_POINT = { x: 0.5, y: 0.5, zoom: 1 };
const MIN_IMAGE_FOCUS_ZOOM = 1;
const MAX_IMAGE_FOCUS_ZOOM = 3;

const hexToRgba = (hex, alpha = 1) => {
  if (!hex) return `rgba(251, 191, 36, ${alpha})`;
  let parsed = hex.replace('#', '');
  if (parsed.length === 3) {
    parsed = parsed
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const int = parseInt(parsed, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const clamp01 = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(1, Math.max(0, num));
};

const clampFocusZoom = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_FOCUS_POINT.zoom;
  return Math.min(
    MAX_IMAGE_FOCUS_ZOOM,
    Math.max(MIN_IMAGE_FOCUS_ZOOM, num)
  );
};

const toCardWhiteMix = (paleness = DEFAULT_CARD_BODY_PALENESS) =>
  MIN_CARD_BODY_WHITE_MIX +
  clamp01(typeof paleness === 'number' ? paleness : DEFAULT_CARD_BODY_PALENESS) *
    (MAX_CARD_BODY_WHITE_MIX - MIN_CARD_BODY_WHITE_MIX);

const toWhiteMix = (paleness = DEFAULT_CANVAS_PALENESS) =>
  MIN_CANVAS_WHITE_MIX +
  clamp01(typeof paleness === 'number' ? paleness : DEFAULT_CANVAS_PALENESS) *
    (MAX_CANVAS_WHITE_MIX - MIN_CANVAS_WHITE_MIX);

const buildCanvasBackground = (colorId, opacity = 1, paleness = DEFAULT_CANVAS_PALENESS) => {
  const alpha = clamp01(opacity);
  const whiteMix = toWhiteMix(paleness);
  const option =
    CANVAS_COLOR_LOOKUP.get(colorId) ||
    CANVAS_COLOR_LOOKUP.get(DEFAULT_CANVAS_COLOR_ID);
  if (!option) {
    return `linear-gradient(160deg, ${hexToRgba('#f8faff', alpha)}, ${hexToRgba('#e2e8f0', alpha)})`;
  }
  const colors =
    Array.isArray(option.colors) && option.colors.length
      ? option.colors
      : ['#f8faff', '#e2e8f0'];
  const tinted = colors.map((color) => mixWithWhite(color, whiteMix));
  if (tinted.length === 1) {
    return hexToRgba(tinted[0], alpha);
  }
  const stops = tinted
    .map((color, index) => {
      const stop = option.stops?.[index];
      const rgba = hexToRgba(color, alpha);
      return stop ? `${rgba} ${stop}` : rgba;
    })
    .join(', ');
  const angle = option.angle ?? 160;
  return `linear-gradient(${angle}deg, ${stops})`;
};

function InterestCloud({
  interests,
  accentColor,
  viewerHobbies,
  editable,
  onAccentAnchor,
  onTooltip,
}) {
  if (!interests.length) {
    return null;
  }
  return (
    <div className="interest-cloud" role="list">
      {interests.map((interest) => {
        const isMutual = viewerHobbies.has(interest);
        return (
          <button
            key={interest}
            type="button"
            className={`interest-dot ${isMutual ? 'common' : ''}`}
            data-skip-swipe="true"
            style={{
              borderColor: isMutual ? accentColor : undefined,
              boxShadow: isMutual
                ? `0 14px 32px ${hexToRgba(accentColor, 0.45)}, 0 0 0 2px ${hexToRgba(
                    accentColor,
                    0.3
                  )}`
                : undefined,
            }}
            onClick={(event) => {
              if (editable) {
                const rect = event.currentTarget.getBoundingClientRect();
                onAccentAnchor?.({
                  left: rect.left + rect.width / 2,
                  top: rect.top,
                });
              } else {
                onTooltip?.(event.currentTarget, interest, isMutual);
              }
            }}
            aria-label={`Interest: ${interest}`}
          >
            <span aria-hidden="true">{getHobbyEmoji(interest)}</span>
          </button>
        );
      })}
    </div>
  );
}

function usePointerOutside(targetRef, handler, when) {
  useEffect(() => {
    if (!when) return undefined;
    const listener = (event) => {
      const target = targetRef.current;
      if (!target) return;
      if (target.contains(event.target)) return;
      handler?.(event);
    };
    document.addEventListener('pointerdown', listener);
    return () => document.removeEventListener('pointerdown', listener);
  }, [handler, when, targetRef]);
}

function ModuleCharCount({ value }) {
  const count = value?.length || 0;
  return (
    <div className="module-char-count" aria-live="polite">
      {count}/{TEXT_CHAR_LIMIT}
    </div>
  );
}

function ModuleMenu({
  moduleTypes,
  onSelect,
  onDelete,
  visible,
  layoutMode,
  currentType,
  isEmpty,
  onClose,
  anchorRect = null,
  canEditImagePosition = false,
  onEditImagePosition,
}) {
  const menuRef = useRef(null);
  const stopMenuEvent = useCallback((event) => {
    event.stopPropagation();
  }, []);
  usePointerOutside(menuRef, () => onClose?.(), visible);
  if (!visible) return null;
  const labelOverrides = {
    image: 'Image / GIF',
    club: 'Club',
    prompt: 'Preset',
  };
  const typeLabels = new Map(
    moduleTypes.map((option) => [option.value, labelOverrides[option.value] || option.label])
  );
  const actionLabel = (() => {
    if (!currentType) return 'Edit module';
    if (currentType === 'text') return 'Edit Text';
    if (currentType === 'image') return 'Change Image / GIF';
    if (currentType === 'club') return 'Change Club';
    if (currentType === 'prompt') return 'Change Preset';
    const fallback = typeLabels.get(currentType) || 'module';
    return 'Edit ' + fallback;
  })();
  let typeOptions = moduleTypes;
  if (currentType === 'image') {
    typeOptions = moduleTypes.filter((option) => option.value !== 'image');
  } else if (!isEmpty) {
    typeOptions = moduleTypes.filter((option) => option.value !== currentType);
  }
  const visibleTypeOptions = typeOptions.filter((option) => option.value !== 'club');

  const shouldShowPrimaryAction =
    !isEmpty &&
    currentType &&
    currentType !== 'text' &&
    currentType !== 'image';
  const shouldShowPositionButton = currentType === 'image' && canEditImagePosition;

  const overlayWidth = layoutMode === 'overlay' && anchorRect
    ? Math.min(160, Math.max(124, anchorRect.width - 20))
    : null;
  const surfaceStyle = overlayWidth != null ? { width: overlayWidth } : undefined;

  const menuBody = (
    <div className="module-menu-surface" style={surfaceStyle}>
      {shouldShowPrimaryAction || shouldShowPositionButton ? (
        <div className="module-menu-section">
          {shouldShowPrimaryAction ? (
            <button type="button" className="module-menu-primary" onClick={() => onClose?.()}>
              {actionLabel}
            </button>
          ) : null}
          {shouldShowPositionButton ? (
            <button
              type="button"
              className="module-menu-primary secondary"
              onClick={() => {
                onEditImagePosition?.();
                onClose?.();
              }}
            >
              Set image position
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="module-menu-section">
        <span className="module-menu-header">
          {isEmpty ? 'Choose module type' : 'Switch module'}
        </span>
        <div className="module-menu-options">
          {visibleTypeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={[
                'module-menu-option',
                option.disabled ? 'disabled' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={option.disabled}
              onClick={() => {
                if (option.disabled) return;
                onSelect?.({ type: option.value });
                onClose?.();
              }}
            >
              {typeLabels.get(option.value) || option.label}
              {option.disabled
                ? option.value === 'prompt'
                  ? ' - WIP'
                  : ' - coming soon'
                : ''}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="module-menu-option danger"
        onClick={() => {
          onDelete?.();
          onClose?.();
        }}
      >
        Delete module
      </button>
    </div>
  );

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const baseWidth = overlayWidth != null ? overlayWidth : 150;
  const portalStyle = anchorRect
    ? layoutMode === 'overlay'
      ? {
          top: Math.max(12, anchorRect.top + 6),
          left: Math.max(
            12,
            Math.min(
              anchorRect.left + anchorRect.width - baseWidth,
              viewportWidth ? viewportWidth - baseWidth - 12 : anchorRect.left
            )
          ),
        }
      : {
          top: Math.max(12, anchorRect.bottom + 8),
          left: Math.max(12, Math.min(anchorRect.left, viewportWidth ? viewportWidth - baseWidth - 12 : anchorRect.left)),
        }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  const containerStyle = { position: 'fixed', zIndex: 4000, ...portalStyle };
  const containerClass = ['module-menu', layoutMode === 'overlay' ? 'overlay' : 'below']
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div
      ref={menuRef}
      className={containerClass}
      role="menu"
      style={containerStyle}
      onPointerDown={stopMenuEvent}
      onMouseDown={stopMenuEvent}
      onClick={stopMenuEvent}
    >
      {menuBody}
    </div>,
    document.body
  );
}

function ImagePositionModal({
  open,
  imageSrc,
  videoSrc,
  focusX = DEFAULT_FOCUS_POINT.x,
  focusY = DEFAULT_FOCUS_POINT.y,
  focusZoom = DEFAULT_FOCUS_POINT.zoom,
  onSave,
  onClose,
}) {
  const stageRef = useRef(null);
  const draggingRef = useRef(false);
  const [draftFocus, setDraftFocus] = useState(() => ({
    x: clamp01(focusX),
    y: clamp01(focusY),
    zoom: clampFocusZoom(focusZoom),
  }));

  useEffect(() => {
    if (!open) return;
    setDraftFocus({
      x: clamp01(focusX),
      y: clamp01(focusY),
      zoom: clampFocusZoom(focusZoom),
    });
  }, [focusX, focusY, focusZoom, open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  const updateFromPoint = useCallback((clientX, clientY) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const x = clamp01((clientX - rect.left) / Math.max(rect.width, 1));
    const y = clamp01((clientY - rect.top) / Math.max(rect.height, 1));
    setDraftFocus((prev) => ({ ...prev, x, y }));
  }, []);

  const handlePointerDown = useCallback(
    (event) => {
      event.preventDefault();
      draggingRef.current = true;
      updateFromPoint(event.clientX, event.clientY);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [updateFromPoint]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!draggingRef.current) return;
      updateFromPoint(event.clientX, event.clientY);
    },
    [updateFromPoint]
  );

  const handlePointerUp = useCallback((event) => {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleSave = useCallback(() => {
    onSave?.(draftFocus);
    onClose?.();
  }, [draftFocus, onClose, onSave]);

  if (!open) return null;

  const objectPosition = `${(draftFocus.x * 100).toFixed(1)}% ${(draftFocus.y * 100).toFixed(1)}%`;
  const mediaStyle = {
    objectPosition,
    transform:
      draftFocus.zoom !== DEFAULT_FOCUS_POINT.zoom
        ? `translateZ(0) scale(${draftFocus.zoom})`
        : undefined,
    transformOrigin: objectPosition,
  };
  const markerStyle = {
    left: `${draftFocus.x * 100}%`,
    top: `${draftFocus.y * 100}%`,
  };
  const hasImage = Boolean(imageSrc);
  const hasVideo = !hasImage && Boolean(videoSrc);

  return createPortal(
    <div
      className="image-position-overlay"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        className="image-position-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          ref={stageRef}
          className="image-position-stage"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {hasImage ? (
            <img src={imageSrc} alt="Reposition" style={mediaStyle} />
          ) : hasVideo ? (
            <video
              src={videoSrc}
              muted
              loop
              autoPlay
              playsInline
              style={mediaStyle}
            />
          ) : null}
          <div className="image-position-marker" style={markerStyle} />
          <div className="image-position-help">
            Drag to set the focal point
          </div>
        </div>
        <div className="image-position-controls">
          <div className="image-position-zoom">
            <div className="image-position-zoom-label">
              Zoom <span>{draftFocus.zoom.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={MIN_IMAGE_FOCUS_ZOOM}
              max={MAX_IMAGE_FOCUS_ZOOM}
              step="0.01"
              value={draftFocus.zoom}
              onChange={(event) => {
                const nextZoom = clampFocusZoom(event.target.value);
                setDraftFocus((prev) => ({ ...prev, zoom: nextZoom }));
              }}
            />
          </div>
          <div className="image-position-actions">
            <button
              type="button"
              className="reset"
              onClick={() =>
                setDraftFocus({
                  ...DEFAULT_FOCUS_POINT,
                })
              }
            >
              Reset to center
            </button>
            <div className="image-position-actions-right">
              <button type="button" onClick={handleClose}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}


function CardCanvasModule({
  module,
  user,
  clubsMap,
  editable,
  moduleTypes,
  isActive,
  onActivate,
  onTypeChange,
  onContentChange,
  onResize,
  onDelete,
  activeShapeTool,
  activeColorTool,
  onApplyShape,
  onApplyColor,
  gridPlacement,
  autoPlacementActive = false,
  freeformMode = false,
  layoutColumns,
  showResizeHandles,
  autoGridRowHeight = null,
  isSwiping = false,
}) {
  const type = module?.type || 'text';
  const content = module?.content || {};
  const textValueRaw = typeof content.text === 'string' ? content.text : '';
  const textValue = applyTextLimits(textValueRaw, TEXT_CHAR_LIMIT, MAX_MODULE_NEWLINES);
  const imageUrl = typeof content.url === 'string' ? content.url : '';
  const imagePoster = typeof content.poster === 'string' ? content.poster : '';
  const videoUrl = typeof content.videoUrl === 'string' ? content.videoUrl : '';
  const resolvedImageUrl = imageUrl ? toMediaUrl(imageUrl) : '';
  const resolvedPoster = imagePoster ? toMediaUrl(imagePoster) : resolvedImageUrl;
  const resolvedVideoUrl = videoUrl ? toMediaUrl(videoUrl) : '';
  const hasImageMedia = Boolean(resolvedVideoUrl || resolvedImageUrl);
  const focusX = clamp01(
    typeof content.focusX === 'number' ? content.focusX : DEFAULT_FOCUS_POINT.x
  );
  const focusY = clamp01(
    typeof content.focusY === 'number' ? content.focusY : DEFAULT_FOCUS_POINT.y
  );
  const focusZoom = clampFocusZoom(
    typeof content.focusZoom === 'number' ? content.focusZoom : DEFAULT_FOCUS_POINT.zoom
  );
  const clubId = typeof content.clubId === 'string' ? content.clubId : '';
  const club = clubId && clubsMap ? clubsMap.get(String(clubId)) : null;
  const layoutSettings = ensureLayoutDefaults(module?.layoutSettings);
  const moduleId = module?._id;
  const userId = user?._id;

  const moduleRef = useRef(null);
  const textAreaRef = useRef(null);
  const textContentRef = useRef(null);
  const textMeasureRef = useRef(null);
  const imageFileInputRef = useRef(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuMode, setMenuMode] = useState('overlay');
  const [menuAnchorRect, setMenuAnchorRect] = useState(null);
  const [draftSlotScale, setDraftSlotScale] = useState({
    x: layoutSettings.slotScaleX,
    y: layoutSettings.slotScaleY,
  });
  const [draftMinHeight, setDraftMinHeight] = useState(layoutSettings.minHeight);
  const [alignPreview, setAlignPreview] = useState({
    x: layoutSettings.alignX,
    y: layoutSettings.alignY,
  });
  const [moduleSize, setModuleSize] = useState({ width: 0, height: 0 });
  const [imageUploadBusy, setImageUploadBusy] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const [positionEditorOpen, setPositionEditorOpen] = useState(false);
  const [textMeasureNonce, setTextMeasureNonce] = useState(0);
  const resizingRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const autoSlotted = Boolean(autoPlacementActive && gridPlacement);
  const resolvedSlotScaleX = autoSlotted ? draftSlotScale.x : 1;
  const resolvedSlotScaleY = autoSlotted ? draftSlotScale.y : 1;
  const slotRowSpan = Math.max(gridPlacement?.rowSpan || 1, 1);
  const slotColSpan = Math.max(
    gridPlacement?.colSpan || gridPlacement?.span || layoutSettings.span || 1,
    1
  );
  const slotHeightLimit =
    autoSlotted && typeof autoGridRowHeight === 'number'
      ? autoGridRowHeight * slotRowSpan +
        CARD_CANVAS_GAP * Math.max(slotRowSpan - 1, 0)
      : null;
  const [liveTextOverride, setLiveTextOverride] = useState(null);
  const baseModuleText = textValue;
  const canInlineOverride = type === 'text';
  const activeTextValue =
    canInlineOverride && editable && isActive && liveTextOverride !== null
      ? liveTextOverride
      : baseModuleText;
  const resolvedTextValue = applyTextLimits(
    activeTextValue,
    TEXT_CHAR_LIMIT,
    MAX_MODULE_NEWLINES
  );
  const hasTextContent = resolvedTextValue.trim().length > 0;
  const effectiveTextValue = hasTextContent ? resolvedTextValue : TEXT_PLACEHOLDER;

  const attachTextEditorRef = useCallback((node) => {
    textAreaRef.current = node;
    textContentRef.current = node;
  }, []);

  const attachStaticTextRef = useCallback((node) => {
    textContentRef.current = node;
  }, []);

  const ensureMeasureElement = useCallback(() => {
    if (typeof document === 'undefined') return null;
    let element = textMeasureRef.current;
    if (element && document.body.contains(element)) {
      return element;
    }
    element = document.createElement('div');
    textMeasureRef.current = element;
    element.setAttribute('aria-hidden', 'true');
    const style = element.style;
    style.position = 'absolute';
    style.left = '-9999px';
    style.top = '-9999px';
    style.visibility = 'hidden';
    style.pointerEvents = 'none';
    style.whiteSpace = 'pre-wrap';
    style.wordBreak = 'break-word';
    style.textAlign = 'center';
    style.padding = '0';
    style.margin = '0';
    style.width = '0px';
    style.boxSizing = 'border-box';
    style.fontSize = '15px';
    style.lineHeight = '1.35';
    document.body.appendChild(element);
    return element;
  }, []);

  useEffect(() => {
    setDraftMinHeight(layoutSettings.minHeight);
    setAlignPreview({
      x: layoutSettings.alignX,
      y: layoutSettings.alignY,
    });
  }, [layoutSettings.alignX, layoutSettings.alignY, layoutSettings.minHeight]);

  useEffect(() => {
    setLiveTextOverride(null);
  }, [moduleId, type]);

  useEffect(() => {
    if (type !== 'text' || !editable || !isActive) {
      setLiveTextOverride(null);
      return;
    }
    setLiveTextOverride((prev) => {
      if (prev !== null) return prev;
      return baseModuleText;
    });
    setTextMeasureNonce((prev) => prev + 1);
  }, [baseModuleText, editable, isActive, type]);

  useEffect(() => {
    return () => {
      const measureNode = textMeasureRef.current;
      if (measureNode && measureNode.parentNode) {
        measureNode.parentNode.removeChild(measureNode);
      }
      textMeasureRef.current = null;
      if (resizeFrameRef.current) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return undefined;
    let cancelled = false;
    const bump = () => {
      if (cancelled) return;
      setTextMeasureNonce((prev) => prev + 1);
    };
    document.fonts.ready.then(bump).catch(() => {});
    document.fonts.addEventListener('loadingdone', bump);
    return () => {
      cancelled = true;
      document.fonts.removeEventListener('loadingdone', bump);
    };
  }, []);

  useEffect(() => {
    if (type !== 'text') return undefined;
    if (typeof ResizeObserver !== 'function') return undefined;
    const node = textContentRef.current;
    if (!node) return undefined;
    let frame = null;
    const observer = new ResizeObserver(() => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setTextMeasureNonce((prev) => prev + 1);
      });
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [
    effectiveTextValue,
    isActive,
    type,
    editable,
    resolvedTextValue,
    moduleId,
    autoSlotted,
  ]);

  useEffect(() => {
    if (!autoSlotted) {
      setDraftSlotScale((prev) => {
        if (prev.x === 1 && prev.y === 1) return prev;
        return { x: 1, y: 1 };
      });
      return;
    }
    setDraftSlotScale({
      x: layoutSettings.slotScaleX,
      y: layoutSettings.slotScaleY,
    });
  }, [autoSlotted, layoutSettings.slotScaleX, layoutSettings.slotScaleY]);

  useEffect(() => {
    if (!isActive) {
      setMenuVisible(false);
      setMenuAnchorRect(null);
    }
  }, [isActive]);

  useEffect(() => {
    if (type !== 'image') {
      setImageUploadBusy(false);
      setImageUploadError('');
    }
  }, [type]);

  useEffect(() => {
    if (type !== 'image' || !hasImageMedia) {
      setPositionEditorOpen(false);
    }
  }, [hasImageMedia, type]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const node = moduleRef.current;
    if (!node) return undefined;

    const measure = () => {
      if (isSwiping) return;
      const rect = node.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      setModuleSize((prev) => {
        if (isSwiping) return prev;
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    };

    measure();

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => measure());
      observer.observe(node);
      return () => observer.disconnect();
    }

    let frame = null;
    const handleResize = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [module?._id, autoPlacementActive, freeformMode, gridPlacement, layoutColumns, isSwiping]);

  useEffect(() => {
    if (!menuVisible || typeof window === 'undefined') return undefined;
    const updateAnchor = () => {
      const target = moduleRef.current;
      if (!target) return;
      setMenuAnchorRect(target.getBoundingClientRect());
    };
    updateAnchor();
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);
    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
    };
  }, [menuVisible, moduleSize.height, moduleSize.width]);

  const autoWidthPercent = (resolvedSlotScaleX * 100).toFixed(2);
  const autoHeightPercent = (resolvedSlotScaleY * 100).toFixed(2);

  const alignStyle = autoSlotted
    ? { justifySelf: 'center', alignSelf: 'center' }
    : {
        justifySelf: ALIGN_MAP[alignPreview.x] || 'center',
        alignSelf: ALIGN_MAP[alignPreview.y] || 'center',
      };

  const moduleShape = layoutSettings.shape || 'square';
  const isFixedShape = moduleShape === 'heart' || moduleShape === 'star';
  const moduleStyle = {
    minWidth: `${MIN_MODULE_DIMENSION}px`,
    minHeight: `${MIN_MODULE_DIMENSION}px`,
  };
  const moduleColor =
    typeof layoutSettings.moduleColor === 'string' ? layoutSettings.moduleColor : null;
  const normalizedModuleColor = (moduleColor || '').trim().toLowerCase();
  const moduleFillColor = moduleColor || '#ffffff';
  const moduleBorderColor = moduleColor ? darkenHex(moduleColor, 0.18) : 'rgba(148,163,184,0.48)';
  const isWhiteModule =
    !normalizedModuleColor ||
    normalizedModuleColor === '#fff' ||
    normalizedModuleColor === '#ffffff';
  const textOnModule = (() => {
    if (isWhiteModule) return '#0f172a';
    return '#ffffff';
  })();
  moduleStyle['--module-fill-color'] = moduleFillColor;
  moduleStyle['--module-border-color'] = moduleBorderColor;
  moduleStyle['--module-text-color'] = textOnModule;
  if (autoSlotted) {
    if (gridPlacement) {
      moduleStyle.gridColumn = `${gridPlacement.column} / span ${gridPlacement.colSpan || 1}`;
      moduleStyle.gridRow = `${gridPlacement.row} / span ${gridPlacement.rowSpan || 1}`;
    }
    moduleStyle.maxWidth = '100%';
    if (!isFixedShape) {
      moduleStyle.width = `${autoWidthPercent}%`;
    }
    moduleStyle.minHeight = `${MIN_MODULE_DIMENSION}px`;
    if (slotHeightLimit != null) {
      const scaledHeight = Math.max(
        slotHeightLimit * resolvedSlotScaleY,
        AUTO_GRID_MIN_DIMENSION
      );
      const clampedHeight = Math.min(scaledHeight, slotHeightLimit);
      const appliedHeight = Math.max(clampedHeight, MIN_MODULE_DIMENSION);
      moduleStyle.height = `${appliedHeight}px`;
      moduleStyle.minHeight = `${MIN_MODULE_DIMENSION}px`;
      moduleStyle.maxHeight = `${Math.max(slotHeightLimit, appliedHeight)}px`;
    }
    Object.assign(moduleStyle, alignStyle);
  } else if (autoPlacementActive && gridPlacement) {
    moduleStyle.gridColumn = `${gridPlacement.column} / span ${gridPlacement.colSpan || 1}`;
    moduleStyle.gridRow = `${gridPlacement.row} / span ${gridPlacement.rowSpan || 1}`;
    moduleStyle.maxWidth = '100%';
    if (!isFixedShape) {
      moduleStyle.width = `${autoWidthPercent}%`;
    }
    moduleStyle.minHeight = `${MIN_MODULE_DIMENSION}px`;
    if (slotHeightLimit != null) {
      const scaledHeight = Math.max(
        slotHeightLimit * resolvedSlotScaleY,
        AUTO_GRID_MIN_DIMENSION
      );
      const clampedHeight = Math.min(scaledHeight, slotHeightLimit);
      const appliedHeight = Math.max(clampedHeight, MIN_MODULE_DIMENSION);
      moduleStyle.height = `${appliedHeight}px`;
      moduleStyle.minHeight = `${appliedHeight}px`;
      moduleStyle.maxHeight = `${Math.max(slotHeightLimit, appliedHeight)}px`;
    }
    Object.assign(moduleStyle, alignStyle);
  } else if (freeformMode) {
    const frame = layoutSettings.freeform || {};
    moduleStyle.position = 'absolute';
    moduleStyle.left = `${Math.min(Math.max(frame.x ?? 0.05, 0), 0.95) * 100}%`;
    moduleStyle.top = `${Math.min(Math.max(frame.y ?? 0.05, 0), 0.95) * 100}%`;
    moduleStyle.width = `${Math.min(Math.max(frame.width ?? 0.4, 0.2), 1) * 100}%`;
    moduleStyle.height = `${Math.min(Math.max(frame.height ?? 0.4, 0.2), 1) * 100}%`;
  } else {
    moduleStyle.gridColumn = `span ${Math.min(layoutSettings.span || 1, Math.max(layoutColumns, 1))}`;
    if (draftMinHeight != null) {
      const clampedHeight = Math.min(
        Math.max(draftMinHeight, MIN_MODULE_DIMENSION),
        MAX_MANUAL_HEIGHT
      );
      moduleStyle.minHeight = `${clampedHeight}px`;
      moduleStyle.height = `${clampedHeight}px`;
      moduleStyle.maxHeight = `${MAX_MANUAL_HEIGHT}px`;
    }
  }

  if (isFixedShape && !freeformMode) {
    moduleStyle.aspectRatio = '1 / 1';
    moduleStyle.width = 'auto';
    moduleStyle.maxWidth = moduleStyle.maxWidth || '100%';
    moduleStyle.justifySelf = 'center';
    moduleStyle.alignSelf = moduleStyle.alignSelf || 'center';
  }

  const estimatedTextScale = useMemo(() => {
    const hasContent = hasTextContent;
    const activeText = effectiveTextValue;
    const textSegments = activeText.split(/\n/);
    const width = moduleSize.width || 260;
    const height = moduleSize.height || 160;
    const usableWidth = Math.max(width - 18, 60);
    const usableHeight = Math.max(height - 6, 32);
    const clampScale = (value, min = 0.38, max = 1.8) =>
      Math.max(min, Math.min(max, value));
    let baseCharWidth = 5.9;
    const whitespaceMatches = activeText.match(/\s/g) || [];
    const whitespaceRatio = whitespaceMatches.length / Math.max(activeText.length, 1);
    if (whitespaceRatio < 0.25) {
      baseCharWidth *= 0.86;
    }
    const longTokenCount = activeText
      .split(/\s+/)
      .filter((token) => token.length >= 22).length;
    if (longTokenCount > 0) {
      baseCharWidth *= 0.78;
    }
    if (usableWidth < 150) {
      const penalty = Math.min(1.35, 150 / Math.max(usableWidth, 10));
      baseCharWidth *= penalty;
    }
    baseCharWidth = Math.max(baseCharWidth, 3.9);
    const actualLineHeight = 15 * 1.35; // matches CSS line-height
    const baseLineHeight = actualLineHeight * Math.max(usableHeight / 150, 0.88);
    const widthFactor = Math.max(usableWidth / 185, 0.45);
    const heightFactor = Math.max(usableHeight / 125, 0.45);
    const areaFactor = Math.max(Math.sqrt(Math.max(usableWidth * usableHeight, 1)) / 220, 0.45);
    const roomyBonus = Math.max(usableHeight - 170, 0) / 320;
    const baseAllowance = Math.max(widthFactor, areaFactor);
    const maxScale = clampScale(
      (baseAllowance + heightFactor * 0.35 + roomyBonus) * (hasContent ? 1 : 0.9),
      0.38,
      1.8
    );
    const minScale = 0.34;

    const projectHeight = (scaleGuess) => {
      const charWidth = Math.max(baseCharWidth * scaleGuess, 1.1);
      const charsPerLine = Math.max(Math.floor(usableWidth / charWidth), 1);
      const lines = textSegments.reduce((sum, segment) => {
        const segmentLength = Math.max(segment.length, 1);
        const projected = Math.max(Math.ceil(segmentLength / charsPerLine), 1);
        if (projected === 1 && charsPerLine - segmentLength > 4) {
          const slack = charsPerLine - segmentLength;
          const pseudoOverlap = Math.max(0, slack - 2) / charsPerLine;
          return sum + Math.max(1, 1 - pseudoOverlap * 0.4);
        }
        return sum + projected;
      }, 0);
      const lineHeight = baseLineHeight * scaleGuess;
      return lines * lineHeight;
    };

    let low = minScale;
    let high = Math.max(maxScale, minScale);
    let best = low;

    for (let i = 0; i < 22; i += 1) {
      const mid = (low + high) / 2;
      const neededHeight = projectHeight(mid);
      if (neededHeight <= usableHeight) {
        best = mid;
        low = mid + 0.001;
      } else {
        high = mid - 0.001;
      }
      if (Math.abs(high - low) <= 0.0005) {
        break;
      }
    }

    let projectedHeight = projectHeight(best);
    if (usableHeight - projectedHeight > 4) {
      let boosted = best;
      while (boosted < maxScale) {
        const next = boosted + 0.03;
        const nextHeight = projectHeight(next);
        if (nextHeight > usableHeight || next > maxScale) {
          break;
        }
        boosted = next;
        projectedHeight = nextHeight;
        if (usableHeight - projectedHeight <= 2) {
          break;
        }
      }
      best = boosted;
    }

    projectedHeight = projectHeight(best);
    const fillRatio = projectedHeight / usableHeight;
    const targetFill = hasContent ? 0.9 : 0.85;
    if (fillRatio < targetFill) {
      let boosted = best;
      const maxMultiplier = 1 + Math.min(targetFill - fillRatio, 0.2) * 0.5;
      const targetScale = Math.min(boosted * maxMultiplier, maxScale);
      while (boosted < targetScale) {
        const next = boosted + 0.02;
        const nextHeight = projectHeight(next);
        if (nextHeight > usableHeight || next > maxScale) break;
        boosted = next;
        if (nextHeight / usableHeight >= targetFill) break;
      }
      best = boosted;
    }

    const charPressure = activeText.length / TEXT_CHAR_LIMIT;
    const pressurePenalty = charPressure > 0.9 ? (charPressure - 0.9) * 0.8 : 0;
    const finalScale = clampScale(best - pressurePenalty, minScale, maxScale);

    return Number(finalScale.toFixed(3));
  }, [
    effectiveTextValue,
    hasTextContent,
    moduleSize.height,
    moduleSize.width,
    textMeasureNonce,
  ]);

  const [textScale, setTextScale] = useState(() => estimatedTextScale);
  const shapedTextScale = useMemo(() => {
    if (type !== 'text') return textScale;
    const shape = layoutSettings.shape;
    if (shape === 'heart' || shape === 'star') {
      return Number((textScale * 0.9).toFixed(3));
    }
    return textScale;
  }, [layoutSettings.shape, textScale, type]);

  useEffect(() => {
    if (type !== 'text' && textScale !== 1) {
      setTextScale(1);
    }
  }, [type, textScale]);

  useLayoutEffect(() => {
    if (type !== 'text') return;
    if (typeof window === 'undefined') return;
    const measureElement = ensureMeasureElement();
    const textNode = textContentRef.current;
    if (!measureElement || !textNode) return;
    const horizontalPadding = 14;
    const verticalPadding = 10;
    const previewReserve = 8;
    const extraReserve = 6;
    const widthAllowance = Math.max(moduleSize.width - (horizontalPadding + 2), 32);
    const heightAllowance = Math.max(
      moduleSize.height - (verticalPadding + previewReserve + extraReserve),
      32
    );
    const availableWidth = Math.max(widthAllowance, 32);
    const availableHeight = Math.max(heightAllowance, 32);

    const computed = window.getComputedStyle(textNode);
    const style = measureElement.style;
    style.fontFamily = computed.fontFamily || style.fontFamily || 'inherit';
    style.fontWeight = computed.fontWeight || style.fontWeight || '400';
    style.letterSpacing = computed.letterSpacing || style.letterSpacing || 'normal';
    style.textTransform = computed.textTransform || 'none';
    style.fontStyle = computed.fontStyle || 'normal';
    const measurementWidth = Math.max(availableWidth - 1, 1);
    style.width = `${measurementWidth}px`;
    style.whiteSpace = 'pre-wrap';
    style.wordBreak = 'break-word';
    style.textAlign = 'center';
    const measuredText = effectiveTextValue || ' ';
    measureElement.textContent = measuredText;

    const baseFontSize = 15;
    const baseLineHeight = 1.35;
    const minScale = 0.32;
    const maxScale = 2.35;

    const measureHeight = (scale) => {
      style.fontSize = `${baseFontSize * scale}px`;
      style.lineHeight = `${baseLineHeight * scale}`;
      return measureElement.scrollHeight;
    };

    let low = minScale;
    let high = maxScale;
    let best = low;

    for (let i = 0; i < 28; i += 1) {
      const mid = (low + high) / 2;
      const heightAtMid = measureHeight(mid);
      if (heightAtMid <= availableHeight) {
        best = mid;
        low = mid + 0.001;
      } else {
        high = mid - 0.001;
      }
      if (high - low < 0.0005) {
        break;
      }
    }

    let bestHeight = measureHeight(best);
    const fillTarget = hasTextContent ? 0.93 : 0.88;
    while (best < maxScale && bestHeight < availableHeight * fillTarget) {
      const next = Math.min(maxScale, best + 0.018);
      const nextHeight = measureHeight(next);
      if (nextHeight > availableHeight) break;
      best = next;
      bestHeight = nextHeight;
    }

    const resolvedScale = Number(best.toFixed(3)) || minScale;
    setTextScale((prev) =>
      Math.abs(prev - resolvedScale) <= 0.004 ? prev : resolvedScale
    );
  }, [
    effectiveTextValue,
    ensureMeasureElement,
    hasTextContent,
    editable,
    isActive,
    type,
    textMeasureNonce,
    resolvedSlotScaleX,
    resolvedSlotScaleY,
    draftMinHeight,
    moduleSize.height,
    moduleSize.width,
  ]);


  const handleActivate = useCallback(
    (event) => {
      event.stopPropagation();
      if (editable && activeShapeTool) {
        onApplyShape?.(module?._id || module?.slotId, activeShapeTool);
        return;
      }
      if (editable && activeColorTool) {
        onApplyColor?.(module?._id || module?.slotId, activeColorTool);
        return;
      }
      onActivate?.(module?._id);
      const nextMenuMode =
        type === 'image' || moduleHasVisibleContentPublic(module)
          ? 'below'
          : 'overlay';
      setMenuMode(nextMenuMode);
      setMenuVisible(true);
      const target = moduleRef.current;
      if (target) {
        setMenuAnchorRect(target.getBoundingClientRect());
      }
    },
    [activeColorTool, activeShapeTool, editable, module, onActivate, onApplyColor, onApplyShape, type]
  );

  const handleResizePointerDown = useCallback(
    (event) => {
      if (!editable) return;
      event.preventDefault();
      event.stopPropagation();
      const target = moduleRef.current;
      if (!target) return;
      const parent = target.parentElement;
      if (!parent) return;
      const parentBounds = parent.getBoundingClientRect();
      const columnWidth =
        layoutColumns > 0
          ? parentBounds.width / Math.max(layoutColumns, 1)
          : parentBounds.width;
      const bounds = target.getBoundingClientRect();
      const slotWidth = columnWidth * slotColSpan;
      const slotHeight =
        autoGridRowHeight != null
          ? autoGridRowHeight * slotRowSpan
          : bounds.height;
      resizingRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: bounds.width,
        startHeight: bounds.height,
        slotWidth: autoSlotted ? slotWidth : null,
        slotHeight: autoSlotted ? slotHeight : null,
        hasMoved: false,
        mode: autoSlotted ? 'slot' : 'grid',
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [
      autoGridRowHeight,
      autoSlotted,
      editable,
      layoutColumns,
      slotColSpan,
      slotRowSpan,
    ]
  );

  const queueResizeUpdate = useCallback((apply) => {
    if (typeof window === 'undefined') {
      apply();
      return;
    }
    if (resizeFrameRef.current) {
      window.cancelAnimationFrame(resizeFrameRef.current);
    }
    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null;
      apply();
    });
  }, []);

  const handleResizePointerMove = useCallback(
    (event) => {
      const state = resizingRef.current;
      if (!editable || !state) return;
      state.hasMoved = true;
      const deltaX = event.clientX - state.startX;
      const deltaY = event.clientY - state.startY;

      if (state.mode === 'slot') {
        const slotWidth =
          state.slotWidth ||
          moduleRef.current?.getBoundingClientRect().width ||
          1;
        const slotHeight =
          state.slotHeight ||
          autoGridRowHeight ||
          moduleRef.current?.getBoundingClientRect().height ||
          1;
        const minScaleX =
          slotWidth > 0 ? Math.min(1, MIN_MODULE_DIMENSION / slotWidth) : 1;
        const minScaleY =
          slotHeight > 0 ? Math.min(1, MIN_MODULE_DIMENSION / slotHeight) : 1;
        const nextX = clampSlotScale(
          (state.startWidth + deltaX) / Math.max(slotWidth, 1),
          minScaleX
        );
        const nextY = clampSlotScale(
          (state.startHeight + deltaY) / Math.max(slotHeight, 1),
          minScaleY
        );
        if (nextX === draftSlotScale.x && nextY === draftSlotScale.y) {
          return;
        }
        queueResizeUpdate(() => {
          setDraftSlotScale({ x: nextX, y: nextY });
          onResize?.(module?._id, {
            ...layoutSettings,
            slotScaleX: nextX,
            slotScaleY: nextY,
          });
        });
        return;
      }

      const nextHeight = Math.min(
        Math.max(state.startHeight + deltaY, MIN_MODULE_DIMENSION),
        MAX_MANUAL_HEIGHT
      );
      queueResizeUpdate(() => {
        setDraftMinHeight(nextHeight);
        onResize?.(module?._id, {
          ...layoutSettings,
          minHeight: nextHeight,
        });
      });
    },
    [
      autoGridRowHeight,
      draftSlotScale.x,
      draftSlotScale.y,
      editable,
      layoutSettings,
      module?._id,
      onResize,
      queueResizeUpdate,
    ]
  );

  const finishResize = useCallback(
    (event) => {
      const state = resizingRef.current;
      if (!state) return;
      resizingRef.current = null;
      event.currentTarget.releasePointerCapture?.(state.pointerId);
      if (resizeFrameRef.current) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      setTextMeasureNonce((prev) => prev + 1);
    },
    []
  );

  const moveCaretToEnd = useCallback((element) => {
    if (typeof window === 'undefined' || !element) return;
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const handlePreviewPointerDown = useCallback(
    (event) => {
      if (!editable || type !== 'text' || !isActive) return;
      if (activeShapeTool || activeColorTool) return; // let apply tools handle click
      const editor = textAreaRef.current;
      if (!editor) return;
      if (editor.contains(event.target)) return;
      event.preventDefault();
      editor.focus();
      moveCaretToEnd(editor);
    },
    [activeColorTool, activeShapeTool, editable, isActive, moveCaretToEnd, type]
  );

  useLayoutEffect(() => {
    if (!editable || type !== 'text' || !isActive) return;
    const el = textAreaRef.current;
    if (!el) return;
    const next = resolvedTextValue || '';
    if (document.activeElement === el && (el.textContent || '').length) {
      return;
    }
    const current = el.textContent || '';
    if (current !== next) {
      el.textContent = next;
    }
  }, [editable, isActive, resolvedTextValue, type]);

  useEffect(() => {
    if (!editable || type !== 'text' || !isActive) return;
    const el = textAreaRef.current;
    if (!el) return;
    el.focus();
    moveCaretToEnd(el);
  }, [editable, isActive, moveCaretToEnd, type]);

  const handleTextInput = (event) => {
    if (!editable) return;
    const el = event.currentTarget;
    const currentValue = el.textContent || '';
    const next = applyTextLimits(currentValue, TEXT_CHAR_LIMIT, MAX_MODULE_NEWLINES);
    if (next !== currentValue) {
      el.textContent = next;
      moveCaretToEnd(el);
    }
    setLiveTextOverride(next);
    setTextMeasureNonce((prev) => prev + 1);
    onContentChange?.(module?._id, 'text', next);
    if (menuVisible) {
      setMenuVisible(false);
      setMenuAnchorRect(null);
    }
  };

  const resetImageFocus = useCallback(() => {
    if (!editable || !moduleId) return;
    onContentChange?.(moduleId, 'focusX', DEFAULT_FOCUS_POINT.x);
    onContentChange?.(moduleId, 'focusY', DEFAULT_FOCUS_POINT.y);
    onContentChange?.(moduleId, 'focusZoom', DEFAULT_FOCUS_POINT.zoom);
  }, [editable, moduleId, onContentChange]);

  const handleImageUrlChange = useCallback(
    (event) => {
      if (!editable || !moduleId) return;
      const value = (event.currentTarget.value || '').slice(0, 1024);
      const changed = value !== imageUrl;
      onContentChange?.(moduleId, 'url', value);
      if (content.videoUrl) onContentChange?.(moduleId, 'videoUrl', '');
      if (content.poster) onContentChange?.(moduleId, 'poster', '');
      if (changed) resetImageFocus();
      setImageUploadError('');
    },
    [content.poster, content.videoUrl, editable, imageUrl, moduleId, onContentChange, resetImageFocus]
  );

  const handleImageFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file || !moduleId) {
        event.target.value = '';
        return;
      }
      setImageUploadError('');
      setImageUploadBusy(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await axios.post(`${API_BASE_URL}/api/uploads/image`, fd, {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(userId ? { 'x-user-id': userId } : {}),
          },
        });
        const payload = res.data || {};
        const payloadUrl = typeof payload.url === 'string' ? payload.url : '';
        const payloadPoster = typeof payload.poster === 'string' ? payload.poster : '';
        const isVideo = payload.type === 'video';
        if (isVideo) {
          if (payloadUrl) {
            onContentChange?.(moduleId, 'videoUrl', payloadUrl);
          }
          onContentChange?.(moduleId, 'url', payloadPoster || payloadUrl);
          if (payloadPoster) {
            onContentChange?.(moduleId, 'poster', payloadPoster);
          }
        } else if (payloadUrl) {
          onContentChange?.(moduleId, 'url', payloadUrl);
          onContentChange?.(moduleId, 'poster', '');
          onContentChange?.(moduleId, 'videoUrl', '');
        }
        resetImageFocus();
        setImageUploadError('');
      } catch (error) {
        setImageUploadError(
          error?.response?.data?.message || error?.message || 'Upload failed'
        );
      } finally {
        setImageUploadBusy(false);
        event.target.value = '';
      }
    },
    [moduleId, onContentChange, resetImageFocus, userId]
  );

  const objectPosition = `${(focusX * 100).toFixed(1)}% ${(focusY * 100).toFixed(1)}%`;
  const mediaFocusStyle = hasImageMedia
    ? {
        objectPosition,
        transform:
          focusZoom !== DEFAULT_FOCUS_POINT.zoom
            ? `translateZ(0) scale(${focusZoom})`
            : undefined,
        transformOrigin: objectPosition,
      }
    : undefined;
  const focusPreviewImage = resolvedImageUrl || resolvedPoster;
  const focusPreviewVideo = focusPreviewImage ? '' : resolvedVideoUrl;

  const freeformPlaceholder =
    editable &&
    freeformMode &&
    !moduleHasVisibleContentPublic(module) && (
      <p className="card-canvas-empty">Drag to place an image or text.</p>
    );

  const textBody = (
    <div className="module-text-body">
      {editable && isActive ? (
        <div
          ref={attachTextEditorRef}
          className="module-inline-editor text"
          role="textbox"
          aria-label="Canvas text module editor"
          aria-multiline="true"
          contentEditable="plaintext-only"
          suppressContentEditableWarning
          data-placeholder={TEXT_PLACEHOLDER}
          spellCheck
          data-skip-swipe="true"
          tabIndex={0}
          onInput={handleTextInput}
        />
      ) : !editable && !hasTextContent ? (
        <p ref={attachStaticTextRef} className="card-canvas-empty" aria-hidden="true">
          &nbsp;
        </p>
      ) : (
        <p ref={attachStaticTextRef} className={hasTextContent ? undefined : 'card-canvas-empty'}>
          {resolvedTextValue || TEXT_PLACEHOLDER}
        </p>
      )}
    </div>
  );

  return (
    <div
      ref={moduleRef}
      className={[
        'card-canvas-item',
        editable ? 'editable' : '',
        type === 'image' ? 'image' : 'textual',
        autoPlacementActive ? 'auto-slotted' : '',
        freeformMode ? 'freeform' : '',
        isActive ? 'active' : '',
        moduleShape ? `shape-${moduleShape}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={moduleStyle}
      onClick={editable ? handleActivate : undefined}
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : undefined}
    >
      <div
        className="module-preview"
        style={{ '--text-scale': shapedTextScale }}
        onPointerDown={
          editable && isActive && type === 'text'
            ? handlePreviewPointerDown
            : undefined
        }
      >
        {type === 'text' && (
          <>
            {textBody}
            {editable && isActive && <ModuleCharCount value={resolvedTextValue} />}
          </>
        )}
        {type === 'image' && (
          <div className={`image-dropzone ${hasImageMedia ? 'has-image' : 'empty'}`}>
            {hasImageMedia ? (
              resolvedVideoUrl ? (
                <video
                  src={resolvedVideoUrl}
                  poster={resolvedPoster || undefined}
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={mediaFocusStyle}
                />
              ) : (
                <img
                  src={resolvedImageUrl}
                  alt={user?.username || 'highlight'}
                  style={mediaFocusStyle}
                />
              )
            ) : (
              <div className="image-dropzone-empty">
                {editable ? (
                  <p>Drag & drop an image, paste a link, or choose a file.</p>
                ) : (
                  <span aria-hidden="true" />
                )}
              </div>
            )}
            {editable && isActive && (
              <div className="image-dropzone-panel">
                <label className="image-url-label" htmlFor={`image-url-${moduleId || 'new'}`}>
                  Image URL
                </label>
                <div className="image-url-input">
                  <input
                    id={`image-url-${moduleId || 'new'}`}
                    type="url"
                    value={imageUrl}
                    placeholder="https://media.giphy.com/..."
                    data-skip-swipe="true"
                    onChange={handleImageUrlChange}
                  />
                </div>
                <div className="image-panel-actions">
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    disabled={imageUploadBusy}
                  >
                    {imageUploadBusy ? 'Uploading...' : 'Choose file'}
                  </button>
                  <input
                    ref={imageFileInputRef}
                    type="file"
                    accept="image/*,video/mp4,video/webm"
                    hidden
                    onChange={handleImageFileChange}
                  />
                </div>
                {imageUploadError ? (
                  <p className="image-panel-error">{imageUploadError}</p>
                ) : null}
                <p className="image-panel-note">JPEG, PNG, WebP, or GIF - 10MB max</p>
              </div>
            )}
          </div>
        )}
        {type === 'club' && (
          <>
            <span className="module-title">Club Spotlight</span>
            <p>{club ? club.name : 'Coming soon.'}</p>
          </>
        )}
        {type === 'prompt' && (
          <>
            <span className="module-title">Prompt</span>
            <p>{textValue || 'Coming soon.'}</p>
          </>
        )}
        {freeformPlaceholder}
      </div>

      {editable && isActive && (
        <ModuleMenu
          moduleTypes={moduleTypes}
          visible={menuVisible}
          layoutMode={menuMode}
          currentType={type}
          isEmpty={!moduleHasVisibleContentPublic(module)}
          onClose={() => {
            setMenuVisible(false);
            setMenuAnchorRect(null);
          }}
          anchorRect={menuAnchorRect}
          canEditImagePosition={type === 'image' && hasImageMedia}
          onEditImagePosition={() => {
            setPositionEditorOpen(true);
          }}
          onSelect={(result) => {
            if (!result) {
              setMenuVisible(false);
              setMenuAnchorRect(null);
              return;
            }
            onTypeChange?.(module?._id, result.type);
          }}
          onDelete={() => {
            onDelete?.(module?._id);
          }}
        />
      )}

      {editable && positionEditorOpen && (
        <ImagePositionModal
          open={positionEditorOpen}
          imageSrc={focusPreviewImage}
          videoSrc={focusPreviewVideo}
          focusX={focusX}
          focusY={focusY}
          focusZoom={focusZoom}
          onSave={({ x, y, zoom }) => {
            if (!moduleId) return;
            onContentChange?.(moduleId, 'focusX', clamp01(x));
            onContentChange?.(moduleId, 'focusY', clamp01(y));
            onContentChange?.(moduleId, 'focusZoom', clampFocusZoom(zoom));
          }}
          onClose={() => setPositionEditorOpen(false)}
        />
      )}

      {editable && showResizeHandles && (
        <div
          className="module-resize-elbow"
          role="presentation"
          data-skip-swipe="true"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
        >
          <span />
        </div>
      )}
    </div>
  );
}

function CanvasControls({
  moduleCount,
  maxModules,
  onAddModule,
  onRemoveModule,
  editable,
  disableAdd,
  disableRemove,
}) {
  if (!editable) return null;
  const preventRemove =
    typeof disableRemove === 'boolean' ? disableRemove : moduleCount <= 0;
  const preventAdd =
    typeof disableAdd === 'boolean' ? disableAdd : moduleCount >= maxModules;
  const stopControlEvent = (event) => {
    event.stopPropagation();
  };
  const handleRemoveClick = (event) => {
    event.stopPropagation();
    onRemoveModule?.();
  };
  const handleAddClick = (event) => {
    event.stopPropagation();
    onAddModule?.();
  };
  return (
    <div
      className="canvas-module-controls"
      role="group"
      aria-label="Canvas module count"
      data-floating-control="true"
    >
      <button
        type="button"
        onPointerDown={stopControlEvent}
        onClick={handleRemoveClick}
        disabled={preventRemove}
        aria-label="Remove module"
      >
        -
      </button>
      <span>
        {moduleCount}/{maxModules}
      </span>
      <button
        type="button"
        onPointerDown={stopControlEvent}
        onClick={handleAddClick}
        disabled={preventAdd}
        aria-label="Add module"
      >
        +
      </button>
    </div>
  );
}

function AccentPicker({ anchor, open, accentColor, onSelect, onClose }) {
  const pickerRef = useRef(null);
  const canRender = typeof document !== 'undefined' && open && Boolean(anchor);
  usePointerOutside(pickerRef, () => onClose?.(), canRender);
  if (!canRender) return null;
  const viewportWidth =
    typeof window !== 'undefined'
      ? window.innerWidth || document.documentElement?.clientWidth || 0
      : 0;
  const width = 136;
  const horizontalMargin = 12;
  const clampedLeft = Math.max(
    horizontalMargin,
    Math.min(viewportWidth - width - horizontalMargin, anchor.left - width / 2)
  );
  // Bias the picker above the anchor; clamp to viewport top
  const targetTop = anchor.top - 140;
  const clampedTop = Math.max(12, targetTop);
  const style = {
    position: 'fixed',
    top: clampedTop,
    left: Number.isFinite(clampedLeft) ? clampedLeft : 24,
  };
  return createPortal(
    <div className="accent-picker" ref={pickerRef} style={style}>
      <span>Pick a favorite color</span>
      <div className="accent-grid">
        {ACCENT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`accent-swatch ${color === accentColor ? 'selected' : ''}`}
            style={{ background: color }}
            onClick={() => {
              onSelect?.(color);
              onClose?.();
            }}
          />
        ))}
      </div>
    </div>,
    document.body
  );
}

function CardColorPicker({
  anchor,
  open,
  value,
  paleness,
  onSelect,
  onPalenessChange,
  onClose,
}) {
  const pickerRef = useRef(null);
  const canRender = typeof document !== 'undefined' && open && Boolean(anchor);
  usePointerOutside(pickerRef, () => onClose?.(), canRender);
  if (!canRender) return null;
  const viewportWidth =
    typeof window !== 'undefined'
      ? window.innerWidth || document.documentElement?.clientWidth || 0
      : 0;
  const width = 200;
  const clampedLeft = Math.max(
    12,
    Math.min(viewportWidth - width - 12, anchor.left - width / 2)
  );
  const style = {
    position: 'fixed',
    top: Math.max(16, anchor.top - 170),
    left: Number.isFinite(clampedLeft) ? clampedLeft : 24,
    zIndex: 3100,
  };
  const resolvedPaleness = clamp01(
    typeof paleness === 'number' ? paleness : DEFAULT_CARD_BODY_PALENESS
  );
  const whiteMix = toCardWhiteMix(resolvedPaleness);
  return createPortal(
    <div className="card-color-picker" ref={pickerRef} style={style}>
      <span>Card background</span>
      <div className="card-color-grid">
        {CARD_BODY_BASE_COLORS.map((color) => {
          const tinted = mixWithWhite(color, whiteMix);
          return (
            <button
              key={color}
              type="button"
              className={`card-color-swatch ${value === color ? 'selected' : ''}`}
              style={{ background: tinted }}
              aria-label={`Use ${color} background`}
              onClick={() => {
                onSelect?.(color);
                onClose?.();
              }}
            />
          );
        })}
      </div>
      <label className="canvas-color-slider" style={{ marginTop: 8 }}>
        <span>Paleness: {Math.round(whiteMix * 100)}% white</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(resolvedPaleness * 100)}
          onChange={(event) => {
            const value = Math.min(
              100,
              Math.max(Number(event.target.value) || 0, 0)
            );
            const nextPaleness = clamp01(value / 100);
            onPalenessChange?.(nextPaleness);
          }}
        />
      </label>
    </div>,
    document.body
  );
}

function InterestTooltipPortal({ tooltip }) {
  if (typeof document === 'undefined' || !tooltip) return null;
  const { left, top, align, message, mutual, accent } = tooltip;
  const className = [
    'tooltip-bubble',
    mutual ? 'mutual' : '',
    align === 'left' ? 'align-left' : align === 'right' ? 'align-right' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return createPortal(
    <div
      className={className}
      style={{ left, top, '--mutual-accent': accent || undefined }}
    >
      {message}
    </div>,
    document.body
  );
}

function SwipeableCard({
  user,
  viewer,
  clubsMap,
  onDecision,
  profilePreset,
  preview = false,
  editable = false,
  moduleTypes = PROFILE_MODULE_TYPES,
  onModuleTypeChange,
  onModuleContentChange,
  activeModuleId = null,
  onModuleActivate,
  onCanvasActivate,
  layoutMenuOpen = false,
  onLayoutMenuClose,
  onLayoutSelect,
  onModuleResize,
  canvasLayoutId = null,
  onAddModule,
  onRemoveModule,
  onModuleDelete,
  onStylePresetCycle,
  moduleCount = 0,
  maxModules = MAX_CANVAS_MODULES,
  stylePreset = 'classic',
  canvasScale = 1,
  onCanvasScaleChange,
  accentColor = null,
  onAccentColorChange,
  canvasColorId = null,
  canvasColorAlpha = null,
  canvasColorPaleness = null,
  onCanvasColorChange,
  onCanvasOpacityChange,
  onCardBodyColorChange,
  onCardBodyPalenessChange,
  cardBodyBaseColor = null,
  cardBodyPaleness = null,
}) {
  const bioFallbackPreset = useMemo(() => createBioFallbackPreset(user), [user]);

  const resolvedPreset = useMemo(() => {
    const withDefaults = (preset) => {
      if (!preset) return preset;
      if (preset.cardBodyColor) return preset;
      return { ...preset, cardBodyColor: '#ffffff' };
    };
    if (profilePreset) {
      if (editable) return withDefaults(profilePreset);
      const presetLayout = profilePreset.layout || 'hidden';
      const presetModules = Array.isArray(profilePreset.modules)
        ? profilePreset.modules
        : [];
      const hasVisibleModules = presetModules.some((mod) =>
        moduleHasVisibleContentPublic(mod)
      );
      if (presetLayout === 'hidden' || !hasVisibleModules) {
        if (bioFallbackPreset) {
          // Keep user settings (e.g., colors) but use the bio fallback stand-in
          return withDefaults({
            ...bioFallbackPreset,
            ...profilePreset,
            layout: 'hidden',
            modules: [],
            dynamicSlotCount: 0,
            isBioFallback: true,
          });
        }
        return withDefaults({ ...profilePreset, layout: 'hidden', modules: [], dynamicSlotCount: 0 });
      }
      return withDefaults(profilePreset);
    }
    if (bioFallbackPreset) return withDefaults(bioFallbackPreset);
    return { layout: 'hidden', modules: [], stickers: [], cardBodyColor: '#ffffff' };
  }, [profilePreset, editable, bioFallbackPreset]);

  const resolvedLayoutId = canvasLayoutId || resolvedPreset?.layout || 'single';
  const freeformMode = resolvedLayoutId === 'freeform';
  const resolvedCanvasScale = Math.min(
    Math.max(canvasScale || 1, MIN_CANVAS_SCALE),
    MAX_CANVAS_SCALE
  );
  const resolvedCanvasColorId =
    canvasColorId ||
    resolvedPreset?.canvasColorId ||
    DEFAULT_CANVAS_COLOR_ID;
  const resolvedCanvasAlpha =
    canvasColorAlpha != null
      ? clamp01(canvasColorAlpha)
      : clamp01(
          typeof resolvedPreset?.canvasColorAlpha === 'number'
            ? resolvedPreset.canvasColorAlpha
            : DEFAULT_CANVAS_OPACITY
        );
  const resolvedCanvasPaleness =
    canvasColorPaleness != null
      ? clamp01(canvasColorPaleness)
      : clamp01(
          typeof resolvedPreset?.canvasColorPaleness === 'number'
            ? resolvedPreset.canvasColorPaleness
            : DEFAULT_CANVAS_PALENESS
        );
  const resolvedCanvasBackground = buildCanvasBackground(
    resolvedCanvasColorId,
    resolvedCanvasAlpha,
    resolvedCanvasPaleness
  );
  const hideCanvasChrome = resolvedCanvasAlpha === 0;
  const canvasWrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const [canvasHostWidth, setCanvasHostWidth] = useState(() => {
    if (typeof window === 'undefined') return BASE_CANVAS_WIDTH;
    const vwWidth = Math.min(
      520,
      Math.max((window.innerWidth || BASE_CANVAS_WIDTH) - 32, BASE_CANVAS_WIDTH)
    );
    return vwWidth;
  });
  const [accentPickerOpen, setAccentPickerOpen] = useState(false);
  const [accentPickerAnchor, setAccentPickerAnchor] = useState(null);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [rot, setRot] = useState(0);
  const [released, setReleased] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [canvasStyleMenuOpen, setCanvasStyleMenuOpen] = useState(false);
  const [canvasStyleAnchor, setCanvasStyleAnchor] = useState(null);
  const [canvasStyleMenuStyle, setCanvasStyleMenuStyle] = useState(null);
  const [activeCanvasStylePanel, setActiveCanvasStylePanel] = useState(null);
  const canvasColorMenuOpen = activeCanvasStylePanel === 'canvasColor';
  const moduleShapeMenuOpen = activeCanvasStylePanel === 'moduleShape';
  const moduleColorMenuOpen = activeCanvasStylePanel === 'moduleColor';
  const [moduleShapeTool, setModuleShapeTool] = useState(null);
  const [moduleColorTool, setModuleColorTool] = useState(null);
  const canvasStyleMenuRef = useRef(null);
  const pointerIdRef = useRef(null);
  const skipSwipeRef = useRef(false);
  const swipeStateRef = useRef({
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });
  const [interestTooltip, setInterestTooltip] = useState(null);
  const interestTooltipTimerRef = useRef(null);
  const [cardColorPickerOpen, setCardColorPickerOpen] = useState(false);
  const [cardColorPickerAnchor, setCardColorPickerAnchor] = useState(null);
  const layoutMenuRef = useRef(null);
  const clearInterestTooltip = useCallback(() => {
    if (interestTooltipTimerRef.current) {
      clearTimeout(interestTooltipTimerRef.current);
      interestTooltipTimerRef.current = null;
    }
    setInterestTooltip(null);
  }, []);

  const closeCanvasStylePanels = useCallback(() => {
    setActiveCanvasStylePanel(null);
  }, []);

  const toggleCanvasStylePanel = useCallback((panelId) => {
    setActiveCanvasStylePanel((prev) => (prev === panelId ? null : panelId));
  }, []);

  const resolvedAccentColor =
    accentColor || user?.favoriteAccentColor || ACCENT_COLORS[0];
  const accentTheme = useMemo(
    () => ({ '--mutual-accent': resolvedAccentColor }),
    [resolvedAccentColor]
  );
  const resolvedCardBodyBase =
    cardBodyBaseColor ||
    resolvedPreset?.cardBodyBaseColor ||
    resolvedPreset?.cardBodyColor ||
    '#ffffff';
  const hasExplicitCardBase =
    Boolean(cardBodyBaseColor) || Boolean(resolvedPreset?.cardBodyBaseColor);
  const resolvedCardBodyPaleness = clamp01(
    typeof cardBodyPaleness === 'number'
      ? cardBodyPaleness
      : typeof resolvedPreset?.cardBodyPaleness === 'number'
        ? resolvedPreset.cardBodyPaleness
        : hasExplicitCardBase
          ? DEFAULT_CARD_BODY_PALENESS
          : 0
  );
  const resolvedCardBodyColor = mixWithWhite(
    resolvedCardBodyBase,
    toCardWhiteMix(resolvedCardBodyPaleness)
  );
  const cardThemeStyle = useMemo(
    () => ({
      ...accentTheme,
      '--card-body-fill': resolvedCardBodyColor,
    }),
    [accentTheme, resolvedCardBodyColor]
  );
  // Canvas sizing: favor using the available host width; adjust height to stay within aspect bounds
  let canvasHeight = BASE_CANVAS_HEIGHT * resolvedCanvasScale;
  const hostWidth =
    typeof canvasHostWidth === 'number' && canvasHostWidth > 0
      ? canvasHostWidth
      : BASE_CANVAS_WIDTH;
  let canvasInnerWidth = Math.max(
    hostWidth - CARD_CANVAS_HORIZONTAL_CHROME,
    MIN_MODULE_DIMENSION
  );
  let aspectRatio = canvasInnerWidth / canvasHeight;
  if (aspectRatio < MIN_CANVAS_ASPECT) {
    canvasHeight = Math.max(canvasInnerWidth / MIN_CANVAS_ASPECT, MIN_MODULE_DIMENSION);
    aspectRatio = canvasInnerWidth / canvasHeight;
  } else if (aspectRatio > MAX_CANVAS_ASPECT) {
    canvasHeight = Math.max(canvasInnerWidth / MAX_CANVAS_ASPECT, MIN_MODULE_DIMENSION);
    aspectRatio = canvasInnerWidth / canvasHeight;
  }
  const canvasOuterWidth = canvasInnerWidth + CARD_CANVAS_HORIZONTAL_CHROME;

  usePointerOutside(
    canvasRef,
    () => {
      if (!editable) return;
      onModuleActivate?.(null);
    },
    editable && Boolean(activeModuleId)
  );

  useEffect(() => {
    return () => {
      clearInterestTooltip();
    };
  }, [clearInterestTooltip]);

  useEffect(() => {
    if (editable && interestTooltip) {
      clearInterestTooltip();
    }
  }, [editable, interestTooltip, clearInterestTooltip]);

  useEffect(() => {
    if (!layoutMenuOpen) {
      closeCanvasStylePanels();
    }
  }, [closeCanvasStylePanels, layoutMenuOpen]);

  useEffect(() => {
    if (!interestTooltip || typeof document === 'undefined') return undefined;
    const dismiss = () => {
      clearInterestTooltip();
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [interestTooltip, clearInterestTooltip]);

  useEffect(() => {
    clearInterestTooltip();
  }, [user?._id, clearInterestTooltip]);

  useEffect(() => {
    if (!editable) {
      setCardColorPickerOpen(false);
      setCardColorPickerAnchor(null);
    }
  }, [editable]);

  usePointerOutside(
    layoutMenuRef,
    () => {
      if (layoutMenuOpen) {
        onLayoutMenuClose?.();
      }
    },
    editable && layoutMenuOpen
  );

  const resetPosition = useCallback(() => {
    setDx(0);
    setDy(0);
    setRot(0);
    setReleased(false);
    swipeStateRef.current = {
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
    };
  }, []);

  useEffect(() => {
    resetPosition();
  }, [resetPosition, user?._id]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleGlobalPointerEnd = () => {
      if (pointerIdRef.current == null) return;
      pointerIdRef.current = null;
      skipSwipeRef.current = false;
      setIsSwiping(false);
      if (!released) {
        resetPosition();
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerEnd);
    window.addEventListener('pointercancel', handleGlobalPointerEnd);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerEnd);
      window.removeEventListener('pointercancel', handleGlobalPointerEnd);
    };
  }, [released, resetPosition]);

  useEffect(() => {
    if (!editable) {
      setAccentPickerOpen(false);
      setAccentPickerAnchor(null);
    }
  }, [editable]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return undefined;
    const host =
      wrapper.closest?.('.card-body') ||
      wrapper.closest?.('.card') ||
      wrapper.closest?.('.card-wrap') ||
      wrapper.parentElement ||
      wrapper;
    const measure = () => {
      const hostRect = host.getBoundingClientRect?.() || { width: 0 };
      const cardRect = wrapper.closest?.('.card')?.getBoundingClientRect?.() || { width: 0 };
      const wrapRect = wrapper.closest?.('.card-wrap')?.getBoundingClientRect?.() || { width: 0 };
      const deckRect = wrapper.closest?.('.deck')?.getBoundingClientRect?.() || { width: 0 };
      const parentWidth = wrapper.parentElement?.clientWidth || 0;
      const viewportFallback =
        typeof window !== 'undefined'
          ? Math.min(520, Math.max((window.innerWidth || BASE_CANVAS_WIDTH) - 32, BASE_CANVAS_WIDTH))
          : BASE_CANVAS_WIDTH;
      const width = Math.max(
        host.clientWidth || host.offsetWidth || hostRect.width || 0,
        cardRect.width || 0,
        wrapRect.width || 0,
        deckRect.width || 0,
        parentWidth || 0,
        viewportFallback,
        BASE_CANVAS_WIDTH
      );
      setCanvasHostWidth(width);
    };
    measure();
    const frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [preview]);

  const modules = Array.isArray(resolvedPreset?.modules)
    ? resolvedPreset.modules.slice(0, MAX_CANVAS_MODULES)
    : [];
  const visibleModulesCount = useMemo(
    () => modules.filter((mod) => moduleHasVisibleContentPublic(mod)).length,
    [modules]
  );
  const hasVisibleModules = visibleModulesCount > 0;
  const bioStandinText = useMemo(() => {
    const text = resolvedPreset?.bioStandinText;
    if (!text || !text.trim()) return '';
    if (modules.length > 0) return '';
    if (resolvedLayoutId && resolvedLayoutId !== 'hidden') return '';
    return text;
  }, [modules.length, resolvedLayoutId, resolvedPreset?.bioStandinText]);
  const showBioStandin = Boolean(bioStandinText);
  const dynamicSlotCount = useMemo(() => {
    if (resolvedLayoutId !== 'dynamic') return 0;
    const saved = Number(resolvedPreset?.dynamicSlotCount);
    const base = Number.isFinite(saved) ? saved : modules.length;
    const normalized = Math.max(
      modules.length,
      Math.min(MAX_CANVAS_MODULES, Math.max(0, Math.round(base || 0)))
    );
    return normalized;
  }, [resolvedLayoutId, resolvedPreset?.dynamicSlotCount, modules.length]);
  const shouldShowCanvas =
    !showBioStandin &&
    (editable || (hasVisibleModules && resolvedLayoutId && resolvedLayoutId !== 'hidden'));
  const managedModuleCount =
    typeof moduleCount === 'number' && Number.isFinite(moduleCount)
      ? moduleCount
      : modules.length;
  const disableRemoveModules = managedModuleCount <= 0;
  const disableAddModules = managedModuleCount >= maxModules;

  const autoGridPlan = useMemo(() => {
    if (resolvedLayoutId !== 'dynamic') return null;
    const slotTarget = dynamicSlotCount || modules.length;
    if (!slotTarget) return null;
    return buildAutoGridPlan(modules, {
      slotCount: slotTarget,
      preservePositions: true,
    });
  }, [resolvedLayoutId, modules, dynamicSlotCount]);

  const moduleSlots = useMemo(() => {
    if (!autoGridPlan) return null;
    const map = new Map();
    autoGridPlan.placements.forEach((placement) => {
      if (!placement.moduleId) return;
      map.set(String(placement.moduleId), placement);
    });
    return map;
  }, [autoGridPlan]);

  const autoGridRowHeight = useMemo(() => {
    if (!autoGridPlan) return null;
    const innerHeight = Math.max(
      canvasHeight - CARD_CANVAS_VERTICAL_CHROME,
      MIN_MODULE_DIMENSION
    );
    const totalGaps = CARD_CANVAS_GAP * Math.max(autoGridPlan.rows - 1, 0);
    const usable = Math.max(innerHeight - totalGaps, MIN_MODULE_DIMENSION);
    return usable / autoGridPlan.rows;
  }, [autoGridPlan, canvasHeight]);

  const viewerHobbySet = useMemo(
    () => new Set(Array.isArray(viewer?.hobbies) ? viewer.hobbies : []),
    [viewer?.hobbies]
  );
  const userInterests = useMemo(
    () => (Array.isArray(user?.hobbies) ? user.hobbies : []),
    [user?.hobbies]
  );
  const orderedInterests = useMemo(() => {
    const list = userInterests.slice();
    list.sort((a, b) => {
      const aCommon = viewerHobbySet.has(a) ? 0 : 1;
      const bCommon = viewerHobbySet.has(b) ? 0 : 1;
      if (aCommon !== bCommon) return aCommon - bCommon;
      return a.localeCompare(b);
    });
    return list;
  }, [userInterests, viewerHobbySet]);
  const displayedInterests = orderedInterests.slice(0, INTEREST_LIMIT);
  const mutualHobbies = useMemo(
    () => orderedInterests.filter((interest) => viewerHobbySet.has(interest)),
    [orderedInterests, viewerHobbySet]
  );
  const sharedInterestLabel =
    mutualHobbies.length === 1 ? 'shared interest' : 'shared interests';

  const metaChips = useMemo(() => {
    const chips = [];
    if (user?.department) {
      chips.push({
        key: 'department',
        label: user.department,
        emoji: '🏫',
        highlight: Boolean(viewer?.department && viewer.department === user.department),
      });
    }
    if (user?.classStanding || user?.classYear || user?.gradYear) {
      chips.push({
        key: 'class',
        label:
          user.classStanding ||
          (user.classYear ? `Class of ${user.classYear}` : `Class of ${user.gradYear}`),
        emoji: '🎓',
      });
    }
    if (user?.major) {
      chips.push({ key: 'major', label: user.major, emoji: '📘' });
    }
    return chips;
  }, [user?.department, user?.classStanding, user?.classYear, user?.gradYear, user?.major, viewer?.department]);

  const bannerUrl = user?.bannerPicture || DEFAULT_BANNER_URL;
  const avatarUrl = user?.profilePicture || '';
  const username = user?.username || 'User';
  const pronouns = user?.pronouns ? String(user.pronouns).trim() : '';

  const swipable = !preview && typeof onDecision === 'function';

  const handlePointerDown = useCallback(
    (event) => {
      if (!swipable) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const interactive = event.target.closest('button, input, textarea, select, a, [data-skip-swipe]');
      skipSwipeRef.current = Boolean(interactive);
      pointerIdRef.current = event.pointerId;
      const startX = Number.isFinite(event.clientX)
        ? event.clientX
        : Number.isFinite(event.pageX)
          ? event.pageX
          : 0;
      const startY = Number.isFinite(event.clientY)
        ? event.clientY
        : Number.isFinite(event.pageY)
          ? event.pageY
          : 0;
      swipeStateRef.current = {
        startX,
        startY,
        lastX: startX,
        lastY: startY,
      };
      setReleased(false);
      setIsSwiping(!skipSwipeRef.current);
      if (!skipSwipeRef.current) {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
    },
    [swipable]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!swipable) return;
      if (pointerIdRef.current !== event.pointerId) return;
      if (skipSwipeRef.current) return;
      const state = swipeStateRef.current;
      const currentX = Number.isFinite(event.clientX)
        ? event.clientX
        : Number.isFinite(event.pageX)
          ? event.pageX
          : state.lastX ?? state.startX;
      const currentY = Number.isFinite(event.clientY)
        ? event.clientY
        : Number.isFinite(event.pageY)
          ? event.pageY
          : state.lastY ?? state.startY;
      state.lastX = currentX;
      state.lastY = currentY;
      const nextDx = currentX - state.startX;
      const nextDy = currentY - state.startY;
      setDx(nextDx);
      setRot(nextDx / 12);
      setDy(nextDy);
    },
    [swipable]
  );

  const handlePointerUp = useCallback(
    (event) => {
      if (!swipable) return;
      if (pointerIdRef.current !== event.pointerId) return;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      pointerIdRef.current = null;
      const wasSkip = skipSwipeRef.current;
      skipSwipeRef.current = false;
      setIsSwiping(false);
      if (wasSkip) {
        resetPosition();
        return;
      }
      const threshold = 120;
      if (dx > threshold) {
        setReleased(true);
        onDecision?.('right', user);
      } else if (dx < -threshold) {
        setReleased(true);
        onDecision?.('left', user);
      } else {
        resetPosition();
      }
    },
    [dx, swipable, onDecision, resetPosition, user]
  );

  const handleAccentAnchor = useCallback(
    (coords) => {
      if (!editable) return;
      setAccentPickerAnchor(coords);
      setAccentPickerOpen(true);
    },
    [editable]
  );

  const handleAccentClose = useCallback(() => {
    setAccentPickerOpen(false);
    setAccentPickerAnchor(null);
  }, []);

  const handleCanvasStyleButton = useCallback(
    (event) => {
      event.stopPropagation();
      if (!editable) return;
      const rect =
        event.currentTarget?.getBoundingClientRect() ||
        canvasWrapperRef.current?.getBoundingClientRect();
      setCanvasStyleAnchor(rect);
      setCanvasStyleMenuOpen((prev) => {
        const next = !prev;
        if (!next) {
          closeCanvasStylePanels();
        }
        return next;
      });
    },
    [closeCanvasStylePanels, editable]
  );

  usePointerOutside(
    canvasStyleMenuRef,
    (event) => {
      const target = event?.target;
      // When a shape/color tool is active, allow clicks on modules to apply without closing.
      if ((moduleShapeTool || moduleColorTool) && target?.closest?.('.card-canvas-item')) {
        return;
      }
      setCanvasStyleMenuOpen(false);
      closeCanvasStylePanels();
      setModuleShapeTool(null);
      setModuleColorTool(null);
    },
    canvasStyleMenuOpen
  );

  useEffect(() => {
    if (!editable || (!moduleShapeTool && !moduleColorTool)) return undefined;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (target?.closest?.('.card-canvas-item')) return;
      if (target?.closest?.('.canvas-style-menu')) return;
      setModuleShapeTool(null);
      setModuleColorTool(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [editable, moduleColorTool, moduleShapeTool]);

  const handleAccentSelect = useCallback(
    (color) => {
      handleAccentClose();
      if (color) onAccentColorChange?.(color);
    },
    [handleAccentClose, onAccentColorChange]
  );

  const handleCardColorPickerClose = useCallback(() => {
    setCardColorPickerOpen(false);
    setCardColorPickerAnchor(null);
  }, []);

  const handleCardColorSelect = useCallback(
    (color) => {
      if (!color) return;
      onCardBodyColorChange?.(color);
    },
    [onCardBodyColorChange]
  );

  const showAnchoredTooltip = useCallback(
    (target, message, options = {}) => {
      if (!target || editable || typeof window === 'undefined' || !message) return;
      const rect = target.getBoundingClientRect();
      const viewportWidth =
        window.innerWidth || document.documentElement?.clientWidth || 0;
      const centerX = rect.left + rect.width / 2;
      const alignmentThreshold = 120;
      let align = 'center';
      if (centerX < alignmentThreshold) align = 'left';
      else if (viewportWidth - centerX < alignmentThreshold) align = 'right';
      const clampedLeft = Math.max(16, Math.min(centerX, viewportWidth - 16));
      const clampedTop = Math.max(32, rect.top);
      setInterestTooltip({
        left: clampedLeft,
        top: clampedTop,
        align,
        message,
        mutual: Boolean(options.mutual),
        accent: options.accent || resolvedAccentColor,
      });
      if (interestTooltipTimerRef.current) {
        clearTimeout(interestTooltipTimerRef.current);
        interestTooltipTimerRef.current = null;
      }
      interestTooltipTimerRef.current = window.setTimeout(() => {
        clearInterestTooltip();
      }, 2000);
    },
    [clearInterestTooltip, editable, resolvedAccentColor]
  );

  const handleInterestTooltip = useCallback(
    (target, interest, isMutual) => {
      const safeInterest = interest || 'this';
      const displayName = user?.username || 'They';
      const message = isMutual
        ? `You both enjoy ${safeInterest}!`
        : `${displayName} enjoys ${safeInterest}!`;
      showAnchoredTooltip(target, message, { mutual: Boolean(isMutual) });
    },
    [showAnchoredTooltip, user?.username]
  );

  const handleCardBodyClick = useCallback(
    (event) => {
      if (!editable) return;
      const target = event.target;
      if (
        target.closest('.card-canvas-shell') ||
        target.closest('.interest-cloud') ||
        target.closest('.meta-chip') ||
        target.closest('.card-hero') ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('[data-skip-swipe]')
      ) {
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const anchor = {
        left:
          event.clientX && Number.isFinite(event.clientX)
            ? event.clientX
            : rect.left + rect.width / 2,
        top: rect.top,
      };
      setCardColorPickerAnchor(anchor);
      setCardColorPickerOpen(true);
    },
    [editable]
  );

  const handleDepartmentTooltip = useCallback(
    (target) => {
      if (!user?.department) return;
      const isMatch = Boolean(
        viewer?.department && viewer.department === user.department
      );
      const displayName = user?.username || 'They';
      const dept = user.department;
      const message = isMatch
        ? `You both belong to ${dept}!`
        : `${displayName} is in ${dept}.`;
      showAnchoredTooltip(target, message, { mutual: isMatch });
    },
    [showAnchoredTooltip, user?.department, user?.username, viewer?.department]
  );

  const handleCanvasResizePointerDown = useCallback(
    (event) => {
      if (!editable || !onCanvasScaleChange) return;
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const startScale = resolvedCanvasScale;
      const pointerId = event.pointerId;
      const handleMove = (moveEvent) => {
        if (pointerId != null && moveEvent.pointerId !== pointerId) return;
        moveEvent.preventDefault();
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const dominantRatio =
          Math.abs(deltaX) > Math.abs(deltaY)
            ? deltaX / BASE_CANVAS_WIDTH
            : deltaY / BASE_CANVAS_HEIGHT;
        const nextScale = Math.min(
          MAX_CANVAS_SCALE,
          Math.max(MIN_CANVAS_SCALE, startScale + dominantRatio)
        );
        onCanvasScaleChange?.(Number(nextScale.toFixed(3)));
      };
      const handleUp = (upEvent) => {
        if (pointerId != null && upEvent.pointerId !== pointerId) return;
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
        document.removeEventListener('pointercancel', handleUp);
      };
      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
      document.addEventListener('pointercancel', handleUp);
    },
    [editable, onCanvasScaleChange, resolvedCanvasScale]
  );

  const canvasStyle = {
    width: '100%',
    maxWidth: 'var(--canvas-outer-width, 100%)',
    height: `${canvasHeight}px`,
    maxHeight: `${canvasHeight}px`,
    '--canvas-width': `${canvasOuterWidth}px`,
    '--canvas-height': `${canvasHeight}px`,
    '--canvas-scale': resolvedCanvasScale,
    '--canvas-outer-width': `${canvasOuterWidth}px`,
    '--canvas-bg': resolvedCanvasBackground,
    '--canvas-opacity': resolvedCanvasAlpha,
    '--canvas-border-color': hideCanvasChrome ? 'transparent' : 'rgba(148,163,184,0.25)',
    '--canvas-shell-border-color': hideCanvasChrome ? 'transparent' : 'rgba(148,163,184,0.35)',
  };

  const canvasGridStyle = useMemo(() => {
    if (!autoGridPlan) return undefined;
    return {
      gridTemplateColumns: `repeat(${autoGridPlan.columns}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${autoGridPlan.rows}, minmax(0, 1fr))`,
    };
  }, [autoGridPlan]);

  const animatedCanvas = false;

  useLayoutEffect(() => {
    if (!canvasStyleAnchor || !canvasStyleMenuOpen) {
      setCanvasStyleMenuStyle(null);
      return;
    }
    const width = 153; // ~15% narrower
    const horizontalMargin = 10;
    const verticalMargin = 10;
    const verticalGap = 2;
    const verticalLift = 30;
    const viewportWidth =
      typeof window !== 'undefined'
        ? window.innerWidth || document.documentElement?.clientWidth || 0
        : 0;
    const anchorLeft = canvasStyleAnchor.left || 0;
    const anchorBottom =
      canvasStyleAnchor.bottom ??
      (canvasStyleAnchor.top != null && canvasStyleAnchor.height != null
        ? canvasStyleAnchor.top + canvasStyleAnchor.height
        : canvasStyleAnchor.top || 0);
    const left = Math.max(
      horizontalMargin,
      Math.min(viewportWidth - width - horizontalMargin, anchorLeft + horizontalMargin)
    );
    const updatePosition = () => {
      const measuredHeight = canvasStyleMenuRef.current?.offsetHeight || 200;
      const preferredTop = anchorBottom - measuredHeight - verticalGap - verticalLift;
      const top = Math.max(verticalMargin, preferredTop);
      setCanvasStyleMenuStyle({
        position: 'fixed',
        top,
        left,
        width,
      });
    };
    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(raf);
  }, [canvasStyleAnchor, canvasStyleMenuOpen]);

  const handleModuleShapeTrigger = useCallback(() => {
    toggleCanvasStylePanel('moduleShape');
  }, [toggleCanvasStylePanel]);

  const handleModuleColorTrigger = useCallback(() => {
    toggleCanvasStylePanel('moduleColor');
  }, [toggleCanvasStylePanel]);

  const handleModuleShapeSelect = useCallback((shapeId) => {
    setModuleShapeTool((prev) => (prev === shapeId ? null : shapeId));
    setModuleColorTool(null);
  }, []);

  const handleModuleColorSelect = useCallback((color) => {
    setModuleColorTool((prev) => (prev === color ? null : color));
    setModuleShapeTool(null);
  }, []);

  const handleResetCanvasStyles = useCallback(() => {
    onCanvasColorChange?.(DEFAULT_CANVAS_COLOR_ID);
    onCanvasOpacityChange?.(DEFAULT_CANVAS_OPACITY);
    if (onModuleResize) {
      modules.forEach((mod) => {
        const id = mod?._id || mod?.slotId;
        if (!id) return;
        onModuleResize(id, { shape: 'square', moduleColor: null });
      });
    }
    setModuleShapeTool(null);
    setModuleColorTool(null);
    closeCanvasStylePanels();
  }, [closeCanvasStylePanels, modules, onCanvasColorChange, onCanvasOpacityChange, onModuleResize]);

  const canvasStyleMenuWidth = canvasStyleMenuStyle?.width || 153;

  const canvasStyleMenu =
    editable && canvasStyleMenuOpen && canvasStyleMenuStyle ? (
      <div
        className="canvas-style-menu"
        role="menu"
        ref={canvasStyleMenuRef}
        style={
          canvasStyleMenuStyle
            ? {
                ...canvasStyleMenuStyle,
                '--canvas-style-menu-width': `${canvasStyleMenuWidth}px`,
              }
            : canvasStyleMenuStyle
        }
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span className="canvas-style-title">Canvas Style</span>
        <div className="canvas-color-menu">
          <button
            type="button"
            className={`canvas-color-trigger ${canvasColorMenuOpen ? 'open' : ''}`}
            onClick={() => toggleCanvasStylePanel('canvasColor')}
          >
            <span>Canvas Color</span>
            <span className="canvas-color-preview" style={{ background: resolvedCanvasBackground }} />
          </button>
          {canvasColorMenuOpen && (
            <div
              className="canvas-color-panel floating"
              style={{ width: `${canvasStyleMenuWidth}px` }}
            >
              <div className="canvas-color-swatches">
                {CANVAS_COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={[
                      'canvas-color-swatch',
                      option.id === resolvedCanvasColorId ? 'selected' : '',
                      option.id,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ background: buildCanvasBackground(option.id, 1, resolvedCanvasPaleness) }}
                    onClick={() => {
                      onCanvasColorChange?.(option.id);
                    }}
                    aria-label={`Use ${option.label} canvas`}
                  />
                ))}
              </div>
              <label className="canvas-color-slider">
                <span>Transparency: {Math.round((1 - resolvedCanvasAlpha) * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((1 - resolvedCanvasAlpha) * 100)}
                  onChange={(event) => {
                    const value = Math.min(100, Math.max(Number(event.target.value) || 0, 0));
                    const nextAlpha = clamp01(1 - value / 100);
                    onCanvasOpacityChange?.(nextAlpha);
                  }}
                />
              </label>
            </div>
          )}
        </div>

        <div className="canvas-color-menu module-style-menu">
          <button
            type="button"
            className={`canvas-color-trigger ${moduleShapeMenuOpen ? 'open' : ''}`}
            onClick={handleModuleShapeTrigger}
          >
            <span>Module Shape</span>
            <span className="canvas-color-preview module-shape-preview">{moduleShapeTool || 'Off'}</span>
          </button>
          {moduleShapeMenuOpen && (
            <div
              className="canvas-color-panel floating module-shape-panel"
              style={{ width: `${canvasStyleMenuWidth}px` }}
            >
              <div className="module-shape-grid">
                {['square', 'circle', 'star', 'heart'].map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    className={`module-shape-swatch ${shape} ${moduleShapeTool === shape ? 'selected' : ''}`}
                    onClick={() => handleModuleShapeSelect(shape)}
                    aria-label={`Apply ${shape} modules`}
                  >
                    <span className={`shape-icon shape-${shape}`} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <p className="canvas-apply-hint">
                Select a shape, then click modules to apply. Click outside modules to exit apply mode.
              </p>
            </div>
          )}
        </div>

        <div className="canvas-color-menu module-style-menu">
          <button
            type="button"
            className={`canvas-color-trigger ${moduleColorMenuOpen ? 'open' : ''}`}
            onClick={handleModuleColorTrigger}
          >
            <span>Module Color</span>
            <span
              className="canvas-color-preview"
              style={{ background: moduleColorTool || '#ffffff', borderColor: moduleColorTool ? darkenHex(moduleColorTool, 0.4) : undefined }}
            />
          </button>
          {moduleColorMenuOpen && (
            <div
              className="canvas-color-panel floating module-color-panel"
              style={{ width: `${canvasStyleMenuWidth}px` }}
            >
              <div className="module-color-swatches">
                {ACCENT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`module-color-swatch ${moduleColorTool === color ? 'selected' : ''}`}
                    style={{ background: color }}
                    onClick={() => handleModuleColorSelect(color)}
                    aria-label={`Apply ${color} to modules`}
                  />
                ))}
              </div>
              <p className="canvas-apply-hint">
                Pick a color, then click modules to paint them. Click outside modules to exit apply mode.
              </p>
            </div>
          )}
        </div>

        <button type="button" className="canvas-reset-button" onClick={handleResetCanvasStyles}>
          Reset to defaults
        </button>
      </div>
    ) : null;

  const handleModuleDelete = useCallback(
    (moduleId) => {
      onModuleDelete?.(moduleId);
    },
    [onModuleDelete]
  );

  const handleApplyModuleShape = useCallback(
    (moduleId, shape) => {
      if (!editable || !moduleId || !shape) return;
      onModuleResize?.(moduleId, { shape });
    },
    [editable, onModuleResize]
  );

  const handleApplyModuleColor = useCallback(
    (moduleId, color) => {
      if (!editable || !moduleId) return;
      const nextColor = typeof color === 'string' ? color : null;
      onModuleResize?.(moduleId, { moduleColor: nextColor });
    },
    [editable, onModuleResize]
  );

  const renderModules = () => {
    if (!modules.length) {
      return null;
    }

    if (freeformMode) {
      return modules.map((mod) => {
        const placement = moduleSlots?.get(String(mod._id)) || null;
        return (
          <CardCanvasModule
            key={mod._id}
            module={mod}
            user={user}
            clubsMap={clubsMap}
            editable={editable}
            moduleTypes={moduleTypes}
            isActive={editable && String(activeModuleId) === String(mod._id)}
            onActivate={editable ? onModuleActivate : undefined}
            onTypeChange={editable ? onModuleTypeChange : undefined}
            onContentChange={editable ? onModuleContentChange : undefined}
            onResize={editable ? onModuleResize : undefined}
            onDelete={editable ? handleModuleDelete : undefined}
            activeShapeTool={moduleShapeTool}
            activeColorTool={moduleColorTool}
            onApplyShape={onModuleResize ? handleApplyModuleShape : undefined}
            onApplyColor={onModuleResize ? handleApplyModuleColor : undefined}
            gridPlacement={placement}
            autoPlacementActive={false}
            freeformMode
            layoutColumns={getLayoutColumns(resolvedLayoutId || 'freeform', modules.length)}
            showResizeHandles={editable}
            isSwiping={isSwiping}
          />
        );
      });
    }

    if (autoGridPlan) {
      return modules.map((mod) => {
        const placement = moduleSlots?.get(String(mod._id)) || null;
        return (
          <CardCanvasModule
            key={mod._id}
            module={mod}
            user={user}
            clubsMap={clubsMap}
            editable={editable}
            moduleTypes={moduleTypes}
            isActive={editable && String(activeModuleId) === String(mod._id)}
            onActivate={editable ? onModuleActivate : undefined}
            onTypeChange={editable ? onModuleTypeChange : undefined}
            onContentChange={editable ? onModuleContentChange : undefined}
            onResize={editable ? onModuleResize : undefined}
            onDelete={editable ? handleModuleDelete : undefined}
            activeShapeTool={moduleShapeTool}
            activeColorTool={moduleColorTool}
            onApplyShape={onModuleResize ? handleApplyModuleShape : undefined}
            onApplyColor={onModuleResize ? handleApplyModuleColor : undefined}
            gridPlacement={placement}
            autoPlacementActive
            freeformMode={false}
            layoutColumns={autoGridPlan.columns}
            autoGridRowHeight={autoGridRowHeight}
            showResizeHandles={editable}
            isSwiping={isSwiping}
          />
        );
      });
    }

    return modules.map((mod) => (
      <CardCanvasModule
        key={mod._id}
        module={mod}
        user={user}
        clubsMap={clubsMap}
        editable={editable}
        moduleTypes={moduleTypes}
        isActive={editable && String(activeModuleId) === String(mod._id)}
        onActivate={editable ? onModuleActivate : undefined}
        onTypeChange={editable ? onModuleTypeChange : undefined}
        onContentChange={editable ? onModuleContentChange : undefined}
        onResize={editable ? onModuleResize : undefined}
        onDelete={editable ? handleModuleDelete : undefined}
        activeShapeTool={moduleShapeTool}
        activeColorTool={moduleColorTool}
        onApplyShape={onModuleResize ? handleApplyModuleShape : undefined}
        onApplyColor={onModuleResize ? handleApplyModuleColor : undefined}
        autoPlacementActive={false}
        freeformMode={false}
        layoutColumns={getLayoutColumns(resolvedLayoutId || 'single', modules.length)}
        showResizeHandles={editable}
        isSwiping={isSwiping}
      />
    ));
  };

  const toolModeActive = editable && (moduleShapeTool || moduleColorTool);
  const wrapClassName = ['card-wrap', preview ? 'preview' : '', toolModeActive ? 'tool-mode-active' : '']
    .filter(Boolean)
    .join(' ');
  const cardClassName = ['card', stylePreset || 'classic', preview ? 'preview' : '']
    .filter(Boolean)
    .join(' ');
  const cardWrapStyle = preview
    ? {}
    : {
        transform: `translate(calc(-50% + ${dx}px), ${dy}px) rotate(${rot}deg)`,
        transition: released ? 'transform 200ms ease-out' : 'none',
      };

  return (
    <div
      className={wrapClassName}
      style={cardWrapStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {editable && (moduleShapeTool || moduleColorTool) ? (
        <div className="canvas-tool-overlay" aria-hidden="true" />
      ) : null}
      <div className={cardClassName} style={cardThemeStyle}>
        <div className="card-banner" style={{ backgroundImage: `url(${bannerUrl})` }} />
        <div className="card-body" onClick={handleCardBodyClick}>
          <div className="card-hero">
            <div className={`card-avatar ${avatarUrl ? '' : 'initials'}`}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={username} />
              ) : (
                <span>{username.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="card-hero-info">
              <div className="card-name-row">
                <div className="card-name">
                  <UserLink
                    username={username}
                    onNavigate={preview ? () => {} : undefined}
                  >
                    {username}
                  </UserLink>
                </div>
                {pronouns && <span className="card-pronouns">{pronouns}</span>}
              </div>
              {metaChips.length > 0 && (
                <div className="card-meta">
                  {metaChips.map((chip) => {
                    const isDepartmentChip = chip.key === 'department';
                    return (
                      <span
                        key={chip.key}
                        className={`meta-chip ${chip.highlight ? 'match' : ''}`}
                        data-skip-swipe="true"
                        role={isDepartmentChip ? 'button' : undefined}
                        tabIndex={isDepartmentChip ? 0 : undefined}
                        onClick={
                          isDepartmentChip
                            ? (event) => handleDepartmentTooltip(event.currentTarget)
                            : undefined
                        }
                        onKeyDown={
                          isDepartmentChip
                            ? (event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  handleDepartmentTooltip(event.currentTarget);
                                }
                              }
                            : undefined
                        }
                      >
                        {chip.emoji ? (
                          <span className="emoji" aria-hidden>
                            {chip.emoji}
                          </span>
                        ) : null}
                        {chip.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="interest-cloud-shell">
            <InterestCloud
              interests={displayedInterests}
              accentColor={resolvedAccentColor}
              viewerHobbies={viewerHobbySet}
              editable={editable}
              onAccentAnchor={handleAccentAnchor}
              onTooltip={handleInterestTooltip}
            />
          </div>

          {showBioStandin && (
            <div
              className={`card-canvas-shell bio-standin-shell ${preview ? 'preview' : ''} ${editable ? 'editable' : ''} ${managedModuleCount === 0 ? 'empty' : ''}`}
              style={canvasStyle}
              ref={canvasWrapperRef}
              onClick={() => {
                if (editable) {
                  onAddModule?.();
                }
              }}
            >
              <div className="bio-standin" role={editable ? 'button' : undefined}>
                <p>{bioStandinText}</p>
              </div>
              {editable && preview && managedModuleCount === 0 && (
                <div className="bio-standin-overlay">Click to add a module</div>
              )}
              {editable && (
                <CanvasControls
                  editable={editable}
                  moduleCount={managedModuleCount}
                  maxModules={maxModules}
                  onAddModule={onAddModule}
                  onRemoveModule={onRemoveModule}
                  disableAdd={disableAddModules}
                  disableRemove={disableRemoveModules}
                />
              )}
            </div>
          )}

          {shouldShowCanvas && (
          <div
            className={[
              'card-canvas-shell',
              editable ? 'editable' : '',
              layoutMenuOpen ? 'layout-open' : '',
              animatedCanvas ? 'animated-canvas neonwave' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={canvasStyle}
            ref={canvasWrapperRef}
            onClick={() => {
                if (editable) onCanvasActivate?.();
              }}
            >
              <div
                className={[
                  'card-canvas',
                  resolvedLayoutId,
                  freeformMode ? 'freeform' : '',
                  autoGridPlan ? 'dynamic' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={canvasGridStyle}
                ref={canvasRef}
              >
                {renderModules()}
              </div>

              {editable && (
                <button
                  type="button"
                  className={`canvas-style-control ${canvasStyleMenuOpen ? 'open' : ''}`}
                  onClick={handleCanvasStyleButton}
                  aria-label="Canvas style"
                  data-floating-control="true"
                >
                  <span aria-hidden="true">✦</span>
                </button>
              )}

              <CanvasControls
                editable={editable}
                moduleCount={managedModuleCount}
                maxModules={maxModules}
                onAddModule={onAddModule}
                onRemoveModule={onRemoveModule}
                disableAdd={disableAddModules}
                disableRemove={disableRemoveModules}
              />

              {canvasStyleMenu &&
                (typeof document !== 'undefined'
                  ? createPortal(canvasStyleMenu, document.body)
                  : canvasStyleMenu)}

              {layoutMenuOpen && editable && (
                <div
                  className="canvas-layout-menu"
                  role="menu"
                  ref={layoutMenuRef}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <span className="canvas-layout-title">Module Layout</span>
                  <div className="canvas-layout-options">
                    {LAYOUT_MENU_OPTIONS.map((layout) => (
                      <button
                        key={layout.id}
                        type="button"
                        className={`canvas-layout-option ${layout.id === resolvedLayoutId ? 'active' : ''}`}
                        onClick={() => onLayoutSelect?.(layout.id)}
                      >
                        {layout.label}
                        {layout.id === resolvedLayoutId && <span className="check">&check;</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {false && editable && onCanvasScaleChange && (
                <div
                  className="canvas-resize-elbow"
                  role="presentation"
                  data-skip-swipe="true"
                  onPointerDown={handleCanvasResizePointerDown}
                >
                  <span />
                </div>
              )}
            </div>
          )}

          <div className="card-footer" onClick={handleCardBodyClick}>
            <div className="card-footer-left">
              <div className="mutual-count" aria-live="polite">
                <strong>{mutualHobbies.length}</strong> {sharedInterestLabel}
              </div>
              {resolvedPreset?.modules?.length ? (
                <span className="swipe-hint">Drag right to connect, left to pass</span>
              ) : (
                <span className="swipe-hint">Preview only</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {editable && (
        <AccentPicker
          anchor={accentPickerAnchor}
          open={accentPickerOpen && Boolean(accentPickerAnchor)}
          accentColor={resolvedAccentColor}
          onSelect={handleAccentSelect}
          onClose={handleAccentClose}
        />
      )}
      {editable && (
        <CardColorPicker
          anchor={cardColorPickerAnchor}
          open={cardColorPickerOpen && Boolean(cardColorPickerAnchor)}
          value={resolvedCardBodyBase}
          paleness={resolvedCardBodyPaleness}
          onSelect={handleCardColorSelect}
          onPalenessChange={onCardBodyPalenessChange}
          onClose={handleCardColorPickerClose}
        />
      )}

      <InterestTooltipPortal tooltip={interestTooltip} />
    </div>
  );
}

export { SwipeableCard };
export default SwipeableCard;
