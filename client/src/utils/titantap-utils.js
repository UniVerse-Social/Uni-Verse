export const GAME_KEYS = ['chess', 'checkers', 'fishing', 'poker', 'reversi', 'jump', 'oddeven'];

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
];

export const PROFILE_MODULE_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'image', label: 'Image / GIF' },
  { value: 'club', label: 'Club Spotlight', disabled: true },
  { value: 'prompt', label: 'Prompt', disabled: true },
];

function createBlankModule(slotId) {
  return {
    _id: `module-${slotId}-${Math.random().toString(36).slice(2, 9)}`,
    slotId,
    type: 'text',
    content: { text: '' },
    layoutSettings: { span: 1, minHeight: null },
  };
}

export function findLayout(layoutId) {
  return PROFILE_LAYOUTS.find((layout) => layout.id === layoutId) || PROFILE_LAYOUTS[0];
}

export function getLayoutColumns(layoutId) {
  if (layoutId === 'double') return 2;
  if (layoutId === 'triple') return 3;
  if (layoutId === 'single') return 1;
  return 0;
}

export function alignModulesWithLayout(modules, layoutId) {
  const layout = findLayout(layoutId);
  if (!layout.slots.length) return [];
  const existing = Array.isArray(modules) ? modules : [];
  const bySlot = new Map(existing.map((mod) => [mod.slotId, mod]));
  const columns = Math.max(layout.slots.length, 1);

  return layout.slots.map((slotId, idx) => {
    const base = bySlot.get(slotId) || existing[idx];
    if (base) {
      const layoutSettings =
        typeof base.layoutSettings === 'object' && base.layoutSettings
          ? { ...base.layoutSettings }
          : { span: 1, minHeight: null };
      layoutSettings.span = Math.min(Math.max(layoutSettings.span || 1, 1), columns);
      return {
        ...base,
        slotId,
        layoutSettings,
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
  const bioSnippet = typeof rawBio === 'string' ? rawBio.trim() : '';
  if (!bioSnippet) return null;
  const layout = findLayout('single');
  const modules = alignModulesWithLayout(
    [
      {
        _id: `fallback-${user._id || user.id || 'viewer'}`,
        slotId: 'slot-1',
        type: 'text',
        content: { text: bioSnippet },
        layoutSettings: { span: 1, minHeight: null },
      },
    ],
    layout.id
  );
  return {
    _id: `bio-fallback-${user._id || user.id || 'viewer'}`,
    layout: layout.id,
    modules,
    stickers: [],
    isBioFallback: true,
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
