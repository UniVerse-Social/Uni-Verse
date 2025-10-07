// src/utils/useTermsHtml.js
import { useEffect, useState } from 'react';

// pick one of these strategies:
const TERMS_VERSION = '2025-10-06'; // bump when you change terms
const BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ||
  process.env.PUBLIC_URL || '/';

export function useTermsHtml(
  url = `${BASE.replace(/\/$/, '')}/terms.html?v=${encodeURIComponent(TERMS_VERSION)}`
) {
  const [html, setHtml] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(url, { cache: 'no-store' }); // no-store to defeat HTTP cache
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        setHtml(text);
      } catch (e) {
        console.error('Failed to load Terms:', e);
        setError('Failed to load Terms.');
      } finally {
        setLoading(false);
      }
    })();
  }, [url]);

  return { html, loading, error };
}
