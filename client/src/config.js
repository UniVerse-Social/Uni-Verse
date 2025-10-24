// client/src/config.js
export const TUFFY_DEFAULT_URL = "/img/tuffy-default.png";
export const DEFAULT_BANNER_URL = "/img/banner-default.jpg";

export const API_BASE_URL =
  (process.env.REACT_APP_API_BASE || '').replace(/\/api\/?$/,'');

// Ensure /uploads/... served by the API is absolute for <img src="">
export const toMediaUrl = (u) => {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;           // already absolute
  if (u.startsWith('/uploads/')) return `${API_BASE_URL}${u}`;
  return u;
};
