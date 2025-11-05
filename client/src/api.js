// client/src/api.js
import axios from 'axios';

import { API_BASE_URL } from './config';

// Vite env shim (safe no-op in CRA/Webpack builds)
const metaEnv =
  (typeof import.meta !== 'undefined' && import.meta && import.meta.env) || undefined;

const REST_BASE =
  (API_BASE_URL && API_BASE_URL.trim()) ||
  ((typeof window !== 'undefined' && window.location.origin) || '');


export const api = axios.create({
  baseURL: `${REST_BASE.replace(/\/+$/,'')}/api`,
  withCredentials: true,
});

// ----- Ads helpers -----
export async function fetchEligibleAds({
  placement = 'home_feed',
  city = 'Fullerton',
  limit = 10,
  mode = (metaEnv && metaEnv.VITE_AD_MODE) || process.env.REACT_APP_AD_MODE || 'dev',
}) {
  const { data } = await api.get('/ads/eligible', {
    params: { placement, city, limit, mode },
  });
  return data?.items || [];
}

export function trackAdImpression(id) {
  return api.post(`/ads/${id}/imp`).catch(() => {});
}

export function trackAdClick(id) {
  return api.post(`/ads/${id}/click`).catch(() => {});
}
// ----- Admin helpers -----

/** Hard-delete by Mongo _id (preferred) */
export function adminDeleteUser(userId, { allowAdmin = false } = {}) {
  if (!userId) throw new Error('Missing user id');
  return api.delete(`/admin/users/${userId}`, { data: { allowAdmin } });
}

/** Hard-delete by username (fallback when _id is not available in UI) */
export function adminDeleteUserByUsername(username, { allowAdmin = false } = {}) {
  if (!username) throw new Error('Missing username');
  return api.delete(`/admin/users/by-username/${encodeURIComponent(username)}`, {
    data: { allowAdmin },
  });
}
