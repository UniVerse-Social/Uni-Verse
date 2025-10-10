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

export const updateStickerSettings = async (postId, payload) => {
  const res = await api.put(`/post/${postId}/settings`, payload);
  return res.data;
};

export default {
  fetchStickerCatalog,
  fetchPostStickers,
  createStickerPlacement,
  updateStickerPlacement,
  deleteStickerPlacement,
  updateStickerSettings,
};
