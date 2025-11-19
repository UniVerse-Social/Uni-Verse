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
  '#ec4899',
  '#a855f7',
  '#6366f1',
  '#3b82f6',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#84cc16',
  '#65a30d',
  '#d946ef',
  '#f43f5e',
  '#f87171',
  '#1e293b',
  '#fde047',
  '#2563eb',
  '#0f766e',
  '#94a3b8',
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

const CARD_BODY_COLORS = ACCENT_COLORS.map((color) =>
  color.toLowerCase() === '#94a3b8' ? '#ffffff' : mixWithWhite(color, 0.5)
);

const DEFAULT_CANVAS_COLOR_ID = 'classic';
const DEFAULT_CANVAS_OPACITY = 1;
const CANVAS_COLOR_OPTIONS = [
  {
    id: 'classic',
    label: 'Classic',
    colors: ['#f8faff', '#e2e8f0'],
  },
  {
    id: 'frost',
    label: 'Frost',
    colors: ['#e0f2fe', '#f0f9ff'],
  },
  {
    id: 'citrus',
    label: 'Citrus',
    colors: ['#fff7ed', '#fed7aa'],
  },
  {
    id: 'blush',
    label: 'Blush',
    colors: ['#fef2f2', '#fee2e2'],
  },
  {
    id: 'aurora',
    label: 'Aurora',
    colors: ['#ecfccb', '#d9f99d'],
  },
  {
    id: 'lagoon',
    label: 'Lagoon',
    colors: ['#cffafe', '#a5f3fc'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    colors: ['#1e293b', '#0f172a'],
  },
  {
    id: 'pearl',
    label: 'Pearl',
    colors: ['#f9fafb'],
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
const TEXT_PLACEHOLDER = 'Share something about yourself...';

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

const buildCanvasBackground = (colorId, opacity = 1) => {
  const alpha = clamp01(opacity);
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
  if (colors.length === 1) {
    return hexToRgba(colors[0], alpha);
  }
  const stops = colors
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
                ? `0 0 0 2px ${hexToRgba(accentColor, 0.25)}`
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
      handler?.();
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
  const typeOptions = isEmpty
    ? moduleTypes
    : moduleTypes.filter((option) => option.value !== currentType);

  const overlayWidth = layoutMode === 'overlay' && anchorRect
    ? Math.min(160, Math.max(124, anchorRect.width - 20))
    : null;
  const surfaceStyle = overlayWidth != null ? { width: overlayWidth } : undefined;

  const menuBody = (
    <div className="module-menu-surface" style={surfaceStyle}>
      {!isEmpty && currentType ? (
        <div className="module-menu-section">
          <span className="module-menu-header">Done</span>
          <button type="button" className="module-menu-primary" onClick={() => onClose?.()}>
            {actionLabel}
          </button>
        </div>
      ) : null}
      <div className="module-menu-section">
        <span className="module-menu-header">
          {isEmpty ? 'Choose module type' : 'Switch module'}
        </span>
        <div className="module-menu-options">
          {typeOptions.map((option) => (
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
              {option.disabled ? ' · soon' : ''}
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
  const [textMeasureNonce, setTextMeasureNonce] = useState(0);
  const resizingRef = useRef(null);
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

  const alignStyle = {
    justifySelf: ALIGN_MAP[alignPreview.x] || 'center',
    alignSelf: ALIGN_MAP[alignPreview.y] || 'center',
  };

  const moduleStyle = {
    minWidth: `${MIN_MODULE_DIMENSION}px`,
    minHeight: `${MIN_MODULE_DIMENSION}px`,
  };
  if (autoSlotted) {
    if (gridPlacement) {
      moduleStyle.gridColumn = `${gridPlacement.column} / span ${gridPlacement.colSpan || 1}`;
      moduleStyle.gridRow = `${gridPlacement.row} / span ${gridPlacement.rowSpan || 1}`;
    }
    moduleStyle.maxWidth = '100%';
    moduleStyle.width = `${autoWidthPercent}%`;
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
    } else {
      moduleStyle.height = `${autoHeightPercent}%`;
      moduleStyle.minHeight = `${MIN_MODULE_DIMENSION}px`;
    }
    Object.assign(moduleStyle, alignStyle);
  } else if (autoPlacementActive && gridPlacement) {
    moduleStyle.gridColumn = `${gridPlacement.column} / span ${gridPlacement.colSpan || 1}`;
    moduleStyle.gridRow = `${gridPlacement.row} / span ${gridPlacement.rowSpan || 1}`;
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
      moduleStyle.minHeight = `${Math.min(
        Math.max(draftMinHeight, MIN_MODULE_DIMENSION),
        MAX_MANUAL_HEIGHT
      )}px`;
    }
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

  useEffect(() => {
    if (type !== 'text') {
      setTextScale(1);
      return;
    }
    setTextScale((prev) =>
      Math.abs(prev - estimatedTextScale) <= 0.005 ? prev : estimatedTextScale
    );
  }, [estimatedTextScale, type]);

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
      onActivate?.(module?._id);
      setMenuMode(moduleHasVisibleContentPublic(module) ? 'below' : 'overlay');
      setMenuVisible(true);
      const target = moduleRef.current;
      if (target) {
        setMenuAnchorRect(target.getBoundingClientRect());
      }
    },
    [module, onActivate]
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
        setDraftSlotScale({ x: nextX, y: nextY });
        onResize?.(module?._id, {
          ...layoutSettings,
          slotScaleX: nextX,
          slotScaleY: nextY,
        });
        setTextMeasureNonce((prev) => prev + 1);
        return;
      }

      const nextHeight = Math.min(
        Math.max(state.startHeight + deltaY, MIN_MODULE_DIMENSION),
        MAX_MANUAL_HEIGHT
      );
      setDraftMinHeight(nextHeight);
      onResize?.(module?._id, {
        ...layoutSettings,
        minHeight: nextHeight,
      });
      setTextMeasureNonce((prev) => prev + 1);
    },
    [
      autoGridRowHeight,
      draftSlotScale.x,
      draftSlotScale.y,
      editable,
      layoutSettings,
      module?._id,
      onResize,
    ]
  );

  const finishResize = useCallback(
    (event) => {
      const state = resizingRef.current;
      if (!state) return;
      resizingRef.current = null;
      event.currentTarget.releasePointerCapture?.(state.pointerId);
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
      const editor = textAreaRef.current;
      if (!editor) return;
      if (editor.contains(event.target)) return;
      event.preventDefault();
      editor.focus();
      moveCaretToEnd(editor);
    },
    [editable, isActive, moveCaretToEnd, type]
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

  const handleImageUrlChange = useCallback(
    (event) => {
      if (!editable || !moduleId) return;
      const value = (event.currentTarget.value || '').slice(0, 1024);
      onContentChange?.(moduleId, 'url', value);
      if (content.videoUrl) onContentChange?.(moduleId, 'videoUrl', '');
      if (content.poster) onContentChange?.(moduleId, 'poster', '');
      setImageUploadError('');
    },
    [content.poster, content.videoUrl, editable, moduleId, onContentChange]
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
    [moduleId, onContentChange, userId]
  );

  const freeformPlaceholder =
    editable &&
    freeformMode &&
    !moduleHasVisibleContentPublic(module) && (
      <p className="card-canvas-empty">Drag to place an image or text.</p>
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
        style={{ '--text-scale': textScale }}
        onPointerDown={
          editable && isActive && type === 'text'
            ? handlePreviewPointerDown
            : undefined
        }
      >
        {type === 'text' && (
          <>
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
                <p
                  ref={attachStaticTextRef}
                  className="card-canvas-empty"
                  aria-hidden="true"
                >
                  &nbsp;
                </p>
              ) : (
                <p
                  ref={attachStaticTextRef}
                  className={hasTextContent ? undefined : 'card-canvas-empty'}
                >
                  {resolvedTextValue || TEXT_PLACEHOLDER}
                </p>
              )}
            </div>
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
                />
              ) : (
                <img src={resolvedImageUrl} alt={user?.username || 'highlight'} />
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
                    {imageUploadBusy ? 'Uploading…' : 'Choose file'}
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
                <p className="image-panel-note">JPEG, PNG, WebP, or GIF · 10MB max</p>
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
  const width = 170;
  const clampedLeft = Math.max(
    12,
    Math.min(viewportWidth - width - 12, anchor.left - width / 2)
  );
  const style = {
    position: 'fixed',
    top: Math.max(16, anchor.top - 150),
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

function CardColorPicker({ anchor, open, value, onSelect, onClose }) {
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
  return createPortal(
    <div className="card-color-picker" ref={pickerRef} style={style}>
      <span>Card background</span>
      <div className="card-color-grid">
        {CARD_BODY_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`card-color-swatch ${value === color ? 'selected' : ''}`}
            style={{ background: color }}
            aria-label={`Use ${color} background`}
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
  onCanvasColorChange,
  onCanvasOpacityChange,
  onCardBodyColorChange,
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
      if (presetLayout === 'hidden') {
        return withDefaults(profilePreset);
      }
      if (!hasVisibleModules) {
        if (bioFallbackPreset) return withDefaults(bioFallbackPreset);
        return withDefaults({ ...profilePreset, layout: 'hidden', modules: [] });
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
  const resolvedCanvasBackground = buildCanvasBackground(
    resolvedCanvasColorId,
    resolvedCanvasAlpha
  );
  const hideCanvasChrome =
    resolvedCanvasColorId === DEFAULT_CANVAS_COLOR_ID && resolvedCanvasAlpha === 0;
  const canvasWrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const [canvasHostWidth, setCanvasHostWidth] = useState(null);
  const [accentPickerOpen, setAccentPickerOpen] = useState(false);
  const [accentPickerAnchor, setAccentPickerAnchor] = useState(null);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [rot, setRot] = useState(0);
  const [released, setReleased] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [canvasColorMenuOpen, setCanvasColorMenuOpen] = useState(false);
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

  const resolvedAccentColor =
    accentColor || user?.favoriteAccentColor || ACCENT_COLORS[0];
  const accentTheme = useMemo(
    () => ({ '--mutual-accent': resolvedAccentColor }),
    [resolvedAccentColor]
  );
  const resolvedCardBodyColor = resolvedPreset?.cardBodyColor || '#ffffff';
  const cardThemeStyle = useMemo(
    () => ({
      ...accentTheme,
      '--card-body-fill': resolvedCardBodyColor,
    }),
    [accentTheme, resolvedCardBodyColor]
  );
  let canvasHeight = BASE_CANVAS_HEIGHT * resolvedCanvasScale;
  const maxInnerWidthAtBaseHeight = canvasHeight * MAX_CANVAS_ASPECT;
  const fallbackHostWidth = maxInnerWidthAtBaseHeight;
  const hostWidth =
    typeof canvasHostWidth === 'number' && canvasHostWidth > 0
      ? canvasHostWidth
      : fallbackHostWidth;
  const usableWidth = Math.max(
    hostWidth - CARD_CANVAS_HORIZONTAL_CHROME,
    MIN_MODULE_DIMENSION
  );
  let canvasInnerWidth = Math.min(usableWidth, maxInnerWidthAtBaseHeight);
  let aspectRatio = canvasInnerWidth / canvasHeight;
  if (aspectRatio < MIN_CANVAS_ASPECT) {
    canvasHeight = Math.max(
      canvasInnerWidth / MIN_CANVAS_ASPECT,
      MIN_MODULE_DIMENSION
    );
    aspectRatio = canvasInnerWidth / canvasHeight;
  }
  const maxInnerWidth = canvasHeight * MAX_CANVAS_ASPECT;
  if (canvasInnerWidth > maxInnerWidth) {
    canvasInnerWidth = maxInnerWidth;
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
      setCanvasColorMenuOpen(false);
    }
  }, [layoutMenuOpen]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return undefined;
    const host =
      wrapper.closest?.('.card-body') ||
      wrapper.closest?.('.card') ||
      wrapper.parentElement ||
      wrapper;
    const parseLength = (value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const measure = () => {
      const rect = host.getBoundingClientRect();
      let width = Math.max(0, rect.width || 0);
      const styles = window.getComputedStyle(host);
      if (styles) {
        width -= parseLength(styles.paddingLeft) + parseLength(styles.paddingRight);
        width -= parseLength(styles.borderLeftWidth) + parseLength(styles.borderRightWidth);
      }
      setCanvasHostWidth(Math.max(width, MIN_MODULE_DIMENSION));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [preview]);

  const modules = Array.isArray(resolvedPreset?.modules)
    ? resolvedPreset.modules.slice(0, MAX_CANVAS_MODULES)
    : [];
  const visibleModulesCount = useMemo(
    () => modules.filter((mod) => moduleHasVisibleContentPublic(mod)).length,
    [modules]
  );
  const hasVisibleModules = visibleModulesCount > 0;
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
    editable || (hasVisibleModules && resolvedLayoutId && resolvedLayoutId !== 'hidden');
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
    '--canvas-width': `${canvasInnerWidth}px`,
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

  const handleModuleDelete = useCallback(
    (moduleId) => {
      onModuleDelete?.(moduleId);
    },
    [onModuleDelete]
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
        autoPlacementActive={false}
        freeformMode={false}
        layoutColumns={getLayoutColumns(resolvedLayoutId || 'single', modules.length)}
        showResizeHandles={editable}
        isSwiping={isSwiping}
      />
    ));
  };

  const wrapClassName = ['card-wrap', preview ? 'preview' : '']
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

          {shouldShowCanvas && (
            <div
              className={`card-canvas-shell ${editable ? 'editable' : ''} ${layoutMenuOpen ? 'layout-open' : ''}`}
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

              <CanvasControls
                editable={editable}
                moduleCount={managedModuleCount}
                maxModules={maxModules}
                onAddModule={onAddModule}
                onRemoveModule={onRemoveModule}
                disableAdd={disableAddModules}
                disableRemove={disableRemoveModules}
              />

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
                        {layout.id === resolvedLayoutId && <span className="check">✓</span>}
                      </button>
                    ))}
                  </div>
                  <div className="canvas-color-menu">
                    <button
                      type="button"
                      className={`canvas-color-trigger ${canvasColorMenuOpen ? 'open' : ''}`}
                      onClick={() => setCanvasColorMenuOpen((prev) => !prev)}
                    >
                      <span>Canvas Color</span>
                      <span
                        className="canvas-color-preview"
                        style={{ background: resolvedCanvasBackground }}
                      />
                    </button>
                    {canvasColorMenuOpen && (
                      <div className="canvas-color-panel">
                        <div className="canvas-color-swatches">
                          {CANVAS_COLOR_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className={`canvas-color-swatch ${option.id === resolvedCanvasColorId ? 'selected' : ''}`}
                              style={{ background: buildCanvasBackground(option.id, 1) }}
                              onClick={() => {
                                onCanvasColorChange?.(option.id);
                              }}
                              aria-label={`Use ${option.label} canvas`}
                            />
                          ))}
                        </div>
                        <label className="canvas-color-slider">
                          <span>
                            Transparency: {Math.round((1 - resolvedCanvasAlpha) * 100)}%
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round((1 - resolvedCanvasAlpha) * 100)}
                            onChange={(event) => {
                              const value = Math.min(
                                100,
                                Math.max(Number(event.target.value) || 0, 0)
                              );
                              const nextAlpha = clamp01(1 - value / 100);
                              onCanvasOpacityChange?.(nextAlpha);
                            }}
                          />
                        </label>
                      </div>
                    )}
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
          value={resolvedCardBodyColor}
          onSelect={handleCardColorSelect}
          onClose={handleCardColorPickerClose}
        />
      )}

      <InterestTooltipPortal tooltip={interestTooltip} />
    </div>
  );
}

export { SwipeableCard };
export default SwipeableCard;
