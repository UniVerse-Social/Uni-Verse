import {
  TEXT_MODULE_CHAR_LIMIT,
  MAX_TEXTAREA_NEWLINES,
} from '../constants/profileLimits';
import { applyTextLimits } from './textLimits';

export const GAME_KEYS = ['chess', 'checkers', 'fishing', 'poker', 'reversi', 'jump', 'oddeven'];
export const MAX_CANVAS_MODULES = 12;
const MIN_MODULE_DIMENSION = 42;
export const AUTO_LAYOUT_DEFAULTS = {
  span: 1,
  minHeight: null,
  alignX: 'center',
  alignY: 'center',
  slotScaleX: 1,
  slotScaleY: 1,
  autoPlaced: true,
  shape: 'square',
  moduleColor: null,
};

const DYNAMIC_SLOTS = Array.from({ length: MAX_CANVAS_MODULES }, (_, idx) => `slot-${idx + 1}`);

export function getCurrentUserId() {
  try {
    const u = localStorage.getItem('user') || localStorage.getItem('currentUser');
    if (u) {
      const parsed = JSON.parse(u);
      return parsed?._id || parsed?.id || parsed?.userId || null;
    }
  } catch {}
  return localStorage.getItem('userId') || localStorage.getItem('uid') || null;
}

export function getCurrentUserProfile() {
  try {
    const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

const API_BASE_URL = window.API_BASE_URL || '';

export async function api(path, { method = 'GET', body } = {}) {
  const url = path.startsWith('http')
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
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

export const PROFILE_LAYOUTS = [
  { id: 'hidden', label: 'Hide Canvas', description: 'No additional spotlight area', slots: [] },
  { id: 'single', label: 'Full Spotlight', description: 'One large canvas', slots: ['slot-1'] },
  { id: 'double', label: 'Split Duo', description: 'Two equal boxes', slots: ['slot-1', 'slot-2'] },
  { id: 'triple', label: 'Showcase Trio', description: 'Three highlights', slots: ['slot-1', 'slot-2', 'slot-3'] },
  {
    id: 'dynamic',
    label: 'Dynamic Grid',
    description: 'Auto-fit modules up to 12 slots',
    slots: DYNAMIC_SLOTS,
  },
  {
    id: 'freeform',
    label: 'Freeform',
    description: 'Place modules anywhere',
    slots: DYNAMIC_SLOTS,
  },
];

export const PROFILE_MODULE_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'image', label: 'Image / GIF' },
  { value: 'club', label: 'Club Spotlight', disabled: true },
  { value: 'prompt', label: 'Prompt', disabled: true },
];

export function createBlankModule(slotId, overrides = {}) {
  return {
    _id: `module-${slotId}-${Math.random().toString(36).slice(2, 9)}`,
    slotId,
    type: 'text',
    content: { text: '' },
    layoutSettings: { ...AUTO_LAYOUT_DEFAULTS, ...overrides },
  };
}

export function findLayout(layoutId) {
  return PROFILE_LAYOUTS.find((layout) => layout.id === layoutId) || PROFILE_LAYOUTS[0];
}

export function getLayoutColumns(layoutId, moduleCount = 1) {
  if (layoutId === 'double') return 2;
  if (layoutId === 'triple') return 3;
  if (layoutId === 'single') return 1;
  if (layoutId === 'dynamic') {
    if (moduleCount <= 1) return 1;
    if (moduleCount === 2) return 2;
    if (moduleCount <= 4) return 2;
    if (moduleCount <= 6) return 3;
    return 4;
  }
  return 0;
}

export function ensureLayoutDefaults(settings = {}) {
  if (!settings || typeof settings !== 'object') return { ...AUTO_LAYOUT_DEFAULTS };
  const allowedShapes = new Set(['square', 'circle', 'star', 'heart']);
  return {
    ...AUTO_LAYOUT_DEFAULTS,
    ...settings,
    span: Math.min(Math.max(settings.span || 1, 1), 12),
    slotScaleX: Math.min(Math.max(settings.slotScaleX ?? 1, 0.2), 1),
    slotScaleY: Math.min(Math.max(settings.slotScaleY ?? 1, 0.2), 1),
    alignX: ['start', 'center', 'end'].includes(settings.alignX) ? settings.alignX : 'center',
    alignY: ['start', 'center', 'end'].includes(settings.alignY) ? settings.alignY : 'center',
    minHeight:
      typeof settings.minHeight === 'number' && Number.isFinite(settings.minHeight)
        ? Math.max(settings.minHeight, MIN_MODULE_DIMENSION)
        : null,
    shape: allowedShapes.has(settings.shape) ? settings.shape : 'square',
    moduleColor: typeof settings.moduleColor === 'string' ? settings.moduleColor : null,
  };
}

export function alignModulesWithLayout(modules, layoutId, options = {}) {
  const layout = findLayout(layoutId);
  if (!layout.slots.length) return [];
  const slotLimit = layout.slots.length || MAX_CANVAS_MODULES;
  const existing = Array.isArray(modules) ? modules.slice(0, slotLimit) : [];

  if (layout.id === 'dynamic') {
    const requestedCount = Number(options.slotCount);
    const slotCount = Number.isFinite(requestedCount)
      ? Math.min(MAX_CANVAS_MODULES, Math.max(0, Math.round(requestedCount)))
      : existing.length;
    return applyDefaultSlotOrdering(existing, {
      slotCount: Math.max(slotCount, existing.length),
      preserveEmpty: true,
    });
  }
  if (layout.id === 'freeform') {
    return existing.map((mod, idx) => ({
      ...mod,
      slotId: mod.slotId || layout.slots[idx] || `slot-${idx + 1}`,
      layoutSettings: ensureLayoutDefaults(mod.layoutSettings),
      content: typeof mod.content === 'object' && mod.content ? { ...mod.content } : {},
    }));
  }

  const bySlot = new Map(existing.map((mod) => [mod.slotId, mod]));
  return layout.slots.map((slotId, idx) => {
    const base = bySlot.get(slotId) || existing[idx];
    if (base) {
      return {
        ...base,
        slotId,
        layoutSettings: ensureLayoutDefaults(base.layoutSettings),
        content: typeof base.content === 'object' && base.content ? { ...base.content } : {},
      };
    }
    return createBlankModule(slotId);
  });
}

function moduleHasVisibleContent(module) {
  if (!module || typeof module !== 'object') return false;
  const type = module.type;
  const content = module.content || {};
  if (type === 'text') {
    return typeof content.text === 'string' && content.text.trim().length > 0;
  }
  if (type === 'image') {
    return typeof content.url === 'string' && content.url.trim().length > 0;
  }
  if (type === 'club') {
    if (typeof content.clubId === 'string' && content.clubId.trim()) return true;
    if (typeof content.name === 'string' && content.name.trim()) return true;
    return false;
  }
  if (type === 'prompt') {
    return typeof content.text === 'string' && content.text.trim().length > 0;
  }
  return false;
}

export function createBioFallbackPreset(user) {
  if (!user || typeof user !== 'object') return null;
  const rawBio = user.bio || user.statusMessage || user.tagline || '';
  const cleanBio = typeof rawBio === 'string' ? rawBio.trim() : '';
  if (!cleanBio) return null;
  const moduleText = applyTextLimits(
    cleanBio,
    TEXT_MODULE_CHAR_LIMIT,
    MAX_TEXTAREA_NEWLINES
  );
  if (!moduleText) return null;
  const isLongBio = cleanBio.length > TEXT_MODULE_CHAR_LIMIT;
  const layout = findLayout('dynamic');
  const modules = isLongBio
    ? []
    : alignModulesWithLayout(
        [
          {
            _id: `fallback-${user._id || user.id || 'viewer'}`,
            slotId: 'slot-1',
            type: 'text',
            content: { text: moduleText },
            layoutSettings: AUTO_LAYOUT_DEFAULTS,
          },
        ],
        layout.id
      );
  return {
    _id: `bio-fallback-${user._id || user.id || 'viewer'}`,
    layout: isLongBio ? 'hidden' : layout.id,
    modules,
    dynamicSlotCount: isLongBio ? 0 : modules.length,
    stickers: [],
    isBioFallback: true,
    bioStandinText: isLongBio ? cleanBio : undefined,
    bioPrefillText: moduleText,
    canvasColorId: 'glass',
    canvasColorAlpha: 1,
    canvasColorPaleness: 0.08,
    cardBodyColor: '#ffffff',
    cardBodyBaseColor: '#ffffff',
    cardBodyPaleness: 0.45,
  };
}

export function pickActivePreset(cardConfig) {
  if (!cardConfig || !Array.isArray(cardConfig.presets) || !cardConfig.presets.length) return null;
  const targetId = cardConfig.currentPresetId;
  if (targetId) {
    const match = cardConfig.presets.find((preset) => String(preset._id) === String(targetId));
    if (match) return match;
  }
  return cardConfig.presets[0];
}

export function moduleHasVisibleContentPublic(module) {
  return moduleHasVisibleContent(module);
}

/**
 * @typedef {Object} Slot
 * @property {number} row
 * @property {number} col
 * @property {number} [rowSpan]
 * @property {number} [colSpan]
 *
 * @typedef {Object} LayoutConfig
 * @property {number} rows
 * @property {number} cols
 * @property {Slot[]} slots
 */

export function computeAutoGridLayout(count = 0) {
  if (count <= 0) return null;
  const special = {
    1: { rows: 1, columns: 1 },
    2: { rows: 1, columns: 2 },
    3: { rows: 1, columns: 3 },
    4: { rows: 2, columns: 2 },
    5: { rows: 2, columns: 3 },
    6: { rows: 2, columns: 3 },
    7: { rows: 3, columns: 3 },
    8: { rows: 3, columns: 3 },
    9: { rows: 3, columns: 3 },
    10: { rows: 3, columns: 4 },
    11: { rows: 3, columns: 4 },
    12: { rows: 3, columns: 4 },
  };
  if (special[count]) return { ...special[count], count };
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / columns);
  return { rows, columns, count };
}

/**
 * Layout presets keyed by module count.
 * @type {Record<number, LayoutConfig>}
 */
export const DEFAULT_LAYOUTS = {
  5: {
    rows: 2,
    cols: 3,
    slots: [
      { id: 'left-top', row: 1, col: 1 },
      { id: 'right-top', row: 1, col: 3 },
      { id: 'left-bottom', row: 2, col: 1 },
      { id: 'right-bottom', row: 2, col: 3 },
      { id: 'center-mid', row: 1, col: 2, rowSpan: 2, colSpan: 1 },
    ],
  },
  7: {
    rows: 4,
    cols: 3,
    slots: [
      { id: 'left-top', row: 1, col: 1, rowSpan: 2 },
      { id: 'center-top', row: 1, col: 2 },
      { id: 'right-top', row: 1, col: 3, rowSpan: 2 },
      { id: 'center-mid', row: 2, col: 2, rowSpan: 2 },
      { id: 'left-bottom', row: 3, col: 1, rowSpan: 2 },
      { id: 'center-bottom', row: 4, col: 2 },
      { id: 'right-bottom', row: 3, col: 3, rowSpan: 2 },
    ],
  },
  8: {
    rows: 2,
    cols: 4,
    slots: [
      { id: 'c1-top', row: 1, col: 1 },
      { id: 'c2-top', row: 1, col: 2 },
      { id: 'c3-top', row: 1, col: 3 },
      { id: 'c4-top', row: 1, col: 4 },
      { id: 'c1-bottom', row: 2, col: 1 },
      { id: 'c2-bottom', row: 2, col: 2 },
      { id: 'c3-bottom', row: 2, col: 3 },
      { id: 'c4-bottom', row: 2, col: 4 },
    ],
  },
  9: {
    rows: 3,
    cols: 3,
    slots: [
      { id: 'r1c1', row: 1, col: 1 },
      { id: 'r1c2', row: 1, col: 2 },
      { id: 'r1c3', row: 1, col: 3 },
      { id: 'r2c1', row: 2, col: 1 },
      { id: 'r2c2', row: 2, col: 2 },
      { id: 'r2c3', row: 2, col: 3 },
      { id: 'r3c1', row: 3, col: 1 },
      { id: 'r3c2', row: 3, col: 2 },
      { id: 'r3c3', row: 3, col: 3 },
    ],
  },
  10: {
    rows: 3,
    cols: 4,
    slots: [
      { id: 'r1c1', row: 1, col: 1 },
      { id: 'r1c2', row: 1, col: 2 },
      { id: 'r1c3', row: 1, col: 3 },
      { id: 'r1c4', row: 1, col: 4 },
      { id: 'mid-left', row: 2, col: 1, colSpan: 2 },
      { id: 'mid-right', row: 2, col: 3, colSpan: 2 },
      { id: 'r3c1', row: 3, col: 1 },
      { id: 'r3c2', row: 3, col: 2 },
      { id: 'r3c3', row: 3, col: 3 },
      { id: 'r3c4', row: 3, col: 4 },
    ],
  },
  11: {
    rows: 3,
    cols: 4,
    slots: [
      { id: 'r1c1', row: 1, col: 1 },
      { id: 'r1c2', row: 1, col: 2 },
      { id: 'r1c3', row: 1, col: 3 },
      { id: 'r1c4', row: 1, col: 4 },
      { id: 'r2c1', row: 2, col: 1 },
      { id: 'center-mid', row: 2, col: 2, colSpan: 2 },
      { id: 'r2c4', row: 2, col: 4 },
      { id: 'r3c1', row: 3, col: 1 },
      { id: 'r3c2', row: 3, col: 2 },
      { id: 'r3c3', row: 3, col: 3 },
      { id: 'r3c4', row: 3, col: 4 },
    ],
  },
};

/**
 * @param {number} moduleCount
 * @returns {LayoutConfig}
 */
function normalizeSlots(slots = [], moduleCount = slots.length) {
  return slots.map((slot, idx) => ({
    row: slot.row,
    col: slot.col,
    rowSpan: slot.rowSpan || 1,
    colSpan: slot.colSpan || 1,
    id: slot.id || `slot-${moduleCount}-${idx + 1}`,
  }));
}

export function getDefaultLayout(moduleCount) {
  if (DEFAULT_LAYOUTS[moduleCount]) {
    const preset = DEFAULT_LAYOUTS[moduleCount];
    return {
      rows: preset.rows,
      cols: preset.cols,
      slots: normalizeSlots(preset.slots, moduleCount),
    };
  }
  const auto = computeAutoGridLayout(moduleCount) || {
    rows: 1,
    columns: moduleCount,
    count: moduleCount,
  };
  const slots = [];
  let idx = 0;
  for (let row = 1; row <= auto.rows && idx < moduleCount; row += 1) {
    for (let col = 1; col <= auto.columns && idx < moduleCount; col += 1) {
      slots.push({ row, col, id: `slot-${moduleCount}-${idx + 1}` });
      idx += 1;
    }
  }
  return { rows: auto.rows, cols: auto.columns, slots: normalizeSlots(slots, moduleCount) };
}

/**
 * @param {Slot} slot
 * @returns {import('react').CSSProperties}
 */
export function slotToGridStyle(slot) {
  return {
    gridRowStart: slot.row,
    gridRowEnd: `span ${slot.rowSpan ?? 1}`,
    gridColumnStart: slot.col,
    gridColumnEnd: `span ${slot.colSpan ?? 1}`,
  };
}

export function applyDefaultSlotOrdering(modules = [], options = {}) {
  const count = Array.isArray(modules) ? modules.length : 0;
  const requestedCount = Number(options.slotCount);
  const preserveEmpty = Boolean(options && options.preserveEmpty);
  const slotCount = Number.isFinite(requestedCount)
    ? Math.min(MAX_CANVAS_MODULES, Math.max(count, Math.round(requestedCount)))
    : count;
  if (slotCount <= 0) {
    return preserveEmpty ? [] : modules.slice();
  }
  const layout = getDefaultLayout(slotCount);
  if (!layout) return modules.slice();
  const slots = layout.slots;
  const normalized = modules.map((mod) => ({
    ...mod,
    layoutSettings: ensureLayoutDefaults(mod.layoutSettings),
  }));
  const used = new Set();
  const usedSlots = new Set();
  const slotBuckets = new Map();
  normalized.forEach((mod) => {
    const key = mod.slotId || mod.layoutSettings.slotId;
    if (!key) return;
    if (!slotBuckets.has(key)) slotBuckets.set(key, []);
    slotBuckets.get(key).push(mod);
  });

  const result = [];
  slots.forEach((slot) => {
    const key = slot.id;
    const bucket = slotBuckets.get(key);
    let chosen = bucket?.find((candidate) => !used.has(candidate._id));
    if (!chosen && !preserveEmpty) {
      chosen = normalized.find((candidate) => !used.has(candidate._id));
    }
    if (chosen) {
      used.add(chosen._id);
      usedSlots.add(key);
      result.push({
        ...chosen,
        slotId: key,
        layoutSettings: {
          ...chosen.layoutSettings,
          slotId: key,
        },
      });
    }
  });

  const leftovers = normalized.filter((mod) => !used.has(mod._id));
  if (leftovers.length) {
    const availableSlots = slots.filter((slot) => !usedSlots.has(slot.id));
    let slotIndex = 0;
    leftovers.forEach((mod) => {
      const slotTarget = slotIndex < availableSlots.length ? availableSlots[slotIndex] : null;
      if (slotTarget) slotIndex += 1;
      const fallbackKey = slotTarget?.id || mod.slotId || mod.layoutSettings.slotId || `slot-extra-${result.length + 1}`;
      if (slotTarget) usedSlots.add(slotTarget.id);
      used.add(mod._id);
      result.push({
        ...mod,
        slotId: fallbackKey,
        layoutSettings: {
          ...mod.layoutSettings,
          slotId: fallbackKey,
        },
      });
    });
  }

  return result;
}

export function buildAutoGridPlan(modules = [], options = {}) {
  const filtered = modules.filter(Boolean).slice(0, MAX_CANVAS_MODULES);
  const moduleCount = filtered.length;
  const requestedCount = Number(options.slotCount);
  const targetCount = Number.isFinite(requestedCount)
    ? Math.min(MAX_CANVAS_MODULES, Math.max(Math.round(requestedCount), moduleCount || 0))
    : moduleCount;
  if (!targetCount) return null;
  const layout = getDefaultLayout(targetCount);
  if (!layout) return null;

  const preservePositions = Boolean(options && options.preservePositions);
  const usedSlotIds = new Set();
  const placements = [];
  const findSlot = (slotId) =>
    layout.slots.find((slot) => slot.id === slotId && !usedSlotIds.has(slot.id));

  filtered.forEach((mod) => {
    const desiredId = mod.slotId || mod.layoutSettings?.slotId;
    let targetSlot = desiredId ? findSlot(desiredId) : null;
    if (!targetSlot && !preservePositions) {
      targetSlot = layout.slots.find((slot) => !usedSlotIds.has(slot.id));
    }
    if (targetSlot) {
      usedSlotIds.add(targetSlot.id);
      placements.push({
        row: targetSlot.row,
        column: targetSlot.col,
        rowSpan: targetSlot.rowSpan || 1,
        colSpan: targetSlot.colSpan || 1,
        moduleId: mod?._id ? String(mod._id) : targetSlot.id,
      });
    }
  });

  return {
    rows: layout.rows,
    columns: layout.cols,
    slots: layout.slots,
    placements,
  };
}
