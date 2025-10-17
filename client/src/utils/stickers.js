import axios from 'axios';
import { API_BASE_URL } from '../config';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/stickers`,
  timeout: 15000,
});

export const fetchStickerCatalog = async () => {
  const res = await api.get('/catalog');
  return Array.isArray(res.data) ? res.data : [];
};

export const fetchPostStickers = async (postId) => {
  if (!postId) return [];
  const res = await api.get(`/post/${postId}`);
  return Array.isArray(res.data) ? res.data : [];
};

export const createStickerPlacement = async (postId, payload) => {
  const res = await api.post(`/post/${postId}`, payload);
  return res.data;
};

export const updateStickerPlacement = async (postId, stickerId, payload) => {
  const res = await api.put(`/post/${postId}/${stickerId}`, payload);
  return res.data;
};

export const deleteStickerPlacement = async (postId, stickerId, payload) => {
  const res = await api.delete(`/post/${postId}/${stickerId}`, { data: payload });
  return res.data;
};

export const clearAllStickers = async (postId, payload) => {
  // batch clear endpoint (owner only)
  const res = await api.delete(`/post/${postId}`, { data: payload });
  return res.data;
};

export const updateStickerSettings = async (postId, payload) => {
  const { data } = await axios.put(
    `${API_BASE_URL}/api/posts/${postId}/sticker-settings`,
    payload
  );
  return {
    allowMode: data.allowMode ?? 'everyone',
    allowlist: Array.isArray(data.allowlist) ? data.allowlist.map(String) : [],
    denylist: Array.isArray(data.denylist) ? data.denylist.map(String) : [],
    allowstickytext: !!data.allowstickytext,
    allowstickymedia: !!data.allowstickymedia,
    maxCount: Number.isFinite(Number(data.maxCount))
      ? Math.min(30, Math.max(1, Number(data.maxCount)))
      : 20,
  };
};


export const saveUserStickerDefaults = async (userId, settings) => {
  const body = { userId, ...settings };
  const res = await axios.put(`${API_BASE_URL}/api/users/${userId}/sticker-settings`, body);
  return res.data || {};
};

export const fetchUserStickerDefaults = async (userId) => {
  const res = await axios.get(`${API_BASE_URL}/api/users/${userId}/sticker-settings`);
  return res.data || {};
};


const stickersApi = {
  fetchStickerCatalog,
  fetchPostStickers,
  createStickerPlacement,
  updateStickerPlacement,
  deleteStickerPlacement,
  updateStickerSettings,
};

export default stickersApi;
