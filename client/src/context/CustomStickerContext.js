import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import useCustomStickers from '../hooks/useCustomStickers';
import { API_BASE_URL } from '../config';

// Fallback so consumers never see undefined
const DEFAULTS = {
  allowMode: 'everyone', // 'everyone' | 'followers' | 'none'
  allowstickytext: false,
  allowstickymedia: false,
  allowlist: '',
  denylist: '',
  maxCount: 20,
  hideFeedStickers: false,
  showStickerPanel: true,
};

const LOCAL_KEY_PREFIX = 'fc__stickerDefaults_v1';

const makeDefaultsKey = (user) => {
  if (user?._id) return `${LOCAL_KEY_PREFIX}:${user._id}`;
  if (user?.username) return `${LOCAL_KEY_PREFIX}:u:${user.username}`;
  return `${LOCAL_KEY_PREFIX}:guest`;
};

const readDefaultsFromStorage = (key) => {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULTS,
      ...(parsed || {}),
      hideFeedStickers: !!parsed?.hideFeedStickers,
      showStickerPanel: parsed?.showStickerPanel !== false,
    };
  } catch {
    return { ...DEFAULTS };
  }
};

const CustomStickerContext = createContext({
  customStickers: [],
  addStickerFromImage: async () => {},
  addStickerFromPlacement: () => {},
  removeCustomSticker: () => {},
  // NEW:
  stickerDefaults: DEFAULTS,
  saveStickerDefaults: () => {},
});

export const CustomStickerProvider = ({ user, children }) => {
  const {
    customStickers,
    addStickerFromImage,
    addStickerFromPlacement,
    removeCustomSticker,
  } = useCustomStickers(user);

  const storageKey = useMemo(() => makeDefaultsKey(user), [user?._id, user?.username]);
  const [stickerDefaults, setStickerDefaults] = useState(() => readDefaultsFromStorage(storageKey));

  useEffect(() => {
    setStickerDefaults(readDefaultsFromStorage(storageKey));
  }, [storageKey]);

  const persistLocal = useCallback((value) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (!user?._id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/${user._id}/sticker-settings`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const merged = {
          ...DEFAULTS,
          ...(data || {}),
          hideFeedStickers: !!(data?.hideFeedStickers),
          showStickerPanel: data?.showStickerPanel !== false,
        };
        setStickerDefaults(merged);
        persistLocal(merged);
      } catch {
        /* ignore network issues; fall back to local */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persistLocal, user?._id]);

  const saveStickerDefaults = useCallback((next) => {
    const merged = {
      ...DEFAULTS,
      ...(next || {}),
      hideFeedStickers: !!(next?.hideFeedStickers ?? DEFAULTS.hideFeedStickers),
      showStickerPanel: next?.showStickerPanel !== false,
    };
    setStickerDefaults(merged);
    persistLocal(merged);
    if (typeof window !== 'undefined') {
      try {
        const PREF_KEY = 'fc__homePrefs_v1';
        const raw = window.localStorage.getItem(PREF_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.showStickerPanel = merged.showStickerPanel;
        window.localStorage.setItem(PREF_KEY, JSON.stringify(parsed));
      } catch {}
    }
    // Server persistence for cross-device
    try {
      if (user?._id) {
        fetch(`${API_BASE_URL}/api/users/${user._id}/sticker-settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user._id, ...merged }),
          credentials: 'include',
        }).catch(() => {});
      }
    } catch {}
  }, [persistLocal, user?._id]);

  const memoValue = useMemo(
    () => ({
      customStickers,
      addStickerFromImage,
      addStickerFromPlacement,
      removeCustomSticker,
      // expose defaults API
      stickerDefaults,
      saveStickerDefaults,
    }),
    [
      customStickers,
      addStickerFromImage,
      addStickerFromPlacement,
      removeCustomSticker,
      stickerDefaults,
      saveStickerDefaults,
    ]
  );

  return (
    <CustomStickerContext.Provider value={memoValue}>
      {children}
    </CustomStickerContext.Provider>
  );
};

export const useCustomStickerCatalog = () => useContext(CustomStickerContext);

export default CustomStickerContext;
