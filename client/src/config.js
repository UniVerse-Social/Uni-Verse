// client/src/config.js
export const TUFFY_DEFAULT_URL = "/img/tuffy-default.png";
export const DEFAULT_BANNER_URL = "/img/banner-default.jpg";

const pageOrigin =
  (typeof window !== 'undefined' && window.location && window.location.origin) || '';
const isLocal =
  /^https?:\/\/(localhost|127(?:\.\d{1,3}){3})(:\d+)?$/i.test(pageOrigin);

const envBase = (process.env.REACT_APP_API_BASE || '')
  .replace(/\/api\/?$/,'')
  .replace(/\/+$/,'');

export const API_BASE_URL =
  envBase || (isLocal ? 'http://localhost:5000' : pageOrigin);

// Ensure /uploads/... served by the API is absolute for <img src="">
export const toMediaUrl = (u) => {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;           // already absolute
  if (u.startsWith('/uploads/')) return `${API_BASE_URL}${u}`;
  return u;
};
