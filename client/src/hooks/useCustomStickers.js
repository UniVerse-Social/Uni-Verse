import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, toMediaUrl } from '../config';

const STORAGE_PREFIX = 'fc.customStickers';
const MAX_CUSTOM_COUNT = 150;
const MAX_DIMENSION = 160;
const MAX_GIF_BYTES = 4 * 1024 * 1024;

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });

const shrinkImage = (dataUrl) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const largestSide = Math.max(img.width, img.height) || 1;
        const scale = Math.min(1, MAX_DIMENSION / largestSide);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const output = canvas.toDataURL('image/png');
        resolve({ dataUrl: output, width, height });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Image decode failed'));
    img.src = dataUrl;
  });

const makeId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `custom-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
};

const safeParse = (value) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const toStorageKey = (user) => {
  if (user?._id) return `${STORAGE_PREFIX}:${user._id}`;
  if (user?.username) return `${STORAGE_PREFIX}:u:${user.username}`;
  return `${STORAGE_PREFIX}:guest`;
};

const normalizeSticker = (raw) => ({
  id: raw.id,
  key: raw.key || `custom-${raw.id}`,
  label: raw.label || 'Custom sticker',
  type: 'custom',
  assetType: raw.assetType || 'image',
  assetValue: raw.assetValue ? toMediaUrl(raw.assetValue) : raw.value,
  poster: raw.poster ? toMediaUrl(raw.poster) : null,
  mediaSize: typeof raw.mediaSize === 'number' ? raw.mediaSize : null,
  format: raw.format || null,
  width: raw.width,
  height: raw.height,
  createdAt: raw.createdAt || new Date().toISOString(),
});

export default function useCustomStickers(user) {
  const storageKey = useMemo(() => toStorageKey(user), [user]);
  const [customStickers, setCustomStickers] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      const parsed = safeParse(stored || '[]').map(normalizeSticker);
      setCustomStickers(parsed);
    } catch (err) {
      console.error('Failed to load custom stickers', err);
      setCustomStickers([]);
    }
  }, [storageKey]);

  const persist = useCallback(
    (next) => {
      setCustomStickers(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (err) {
        console.error('Failed to persist custom stickers', err);
      }
    },
    [storageKey]
  );

  const addStickerFromImage = useCallback(
    async (file) => {
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        throw new Error('Unsupported file type');
      }
      if (customStickers.length >= MAX_CUSTOM_COUNT) {
        throw new Error('Custom sticker limit reached');
      }
      const isGif = file.type === 'image/gif';
      if (isGif) {
        if (file.size > MAX_GIF_BYTES) {
          throw new Error('GIF stickers must be under 4MB.');
        }
        const formData = new FormData();
        formData.append('file', file);
        const headers = {};
        if (user?._id) headers['x-user-id'] = user._id;
        const res = await fetch(`${API_BASE_URL}/api/uploads/image`, {
          method: 'POST',
          body: formData,
          headers,
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.message || 'Failed to process animated sticker');
        }
        const id = makeId();
        const label = file.name ? file.name.split('.').slice(0, -1).join('.') || 'Custom sticker' : 'Custom sticker';
        const nextSticker = normalizeSticker({
          id,
          key: `custom-${id}`,
          label,
          assetType: payload.type === 'video' ? 'video' : 'image',
          assetValue: toMediaUrl(payload.url),
          poster: payload.poster ? toMediaUrl(payload.poster) : null,
          mediaSize: payload.size || null,
          format: payload.format || null,
          width: payload.width,
          height: payload.height,
          createdAt: new Date().toISOString(),
        });
        persist([...customStickers, nextSticker]);
        return nextSticker;
      }
      const dataUrl = await readFileAsDataURL(file);
      const resized = await shrinkImage(dataUrl);
      const id = makeId();
      const label = file.name ? file.name.split('.').slice(0, -1).join('.') || 'Custom sticker' : 'Custom sticker';
      const nextSticker = normalizeSticker({
        id,
        key: `custom-${id}`,
        label,
        assetType: 'image',
        assetValue: resized.dataUrl,
        width: resized.width,
        height: resized.height,
        createdAt: new Date().toISOString(),
      });
      persist([...customStickers, nextSticker]);
      return nextSticker;
    },
    [customStickers, persist, user?._id]
  );

  const addStickerFromPlacement = useCallback(
    (placement) => {
      if (!placement || !placement.assetType || !placement.assetValue) return null;
      const already = customStickers.some((item) => item.assetValue === placement.assetValue && item.assetType === placement.assetType);
      if (already) return null;
      const id = makeId();
      const nextSticker = normalizeSticker({
        id,
        key: `custom-${id}`,
        label: placement.label || 'Saved sticker',
        assetType: placement.assetType,
        assetValue: placement.assetValue,
        poster: placement.poster || null,
        mediaSize: placement.mediaSize || null,
        format: placement.format || null,
        width: placement.width || MAX_DIMENSION,
        height: placement.height || MAX_DIMENSION,
        createdAt: new Date().toISOString(),
      });
      persist([...customStickers, nextSticker]);
      return nextSticker;
    },
    [customStickers, persist]
  );

  const removeCustomSticker = useCallback(
    (stickerId) => {
      if (!stickerId) return;
      persist(customStickers.filter((item) => item.id !== stickerId));
    },
    [customStickers, persist]
  );

  return {
    customStickers,
    addStickerFromImage,
    addStickerFromPlacement,
    removeCustomSticker,
  };
}
