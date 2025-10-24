// client/src/api.js
import axios from 'axios';

// Prefer same-origin via the dev proxy. If you *do* set REACT_APP_API_BASE_URL or VITE_API_BASE_URL,
// we’ll use it, otherwise we default to '' (same-origin). No localhost hardcoding.
const API_BASE =
  (import.meta?.env?.VITE_API_BASE_URL) ||
  (process.env.REACT_APP_API_BASE_URL) ||
  '';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true, // if you use cookies/sessions
});
