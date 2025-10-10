import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const StickerContext = createContext({
  catalog: [],
  loading: true,
  error: '',
  refreshCatalog: () => {},
});

export const StickerProvider = ({ children }) => {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshCatalog = useCallback(async () => {
    const source = axios.CancelToken.source();
    try {
      setLoading(true);
      setError('');
      const res = await axios.get(`${API_BASE_URL}/api/stickers/catalog`, {
        cancelToken: source.token,
      });
      setCatalog(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (!axios.isCancel(err)) {
        console.error('Sticker catalog fetch failed', err);
        setError('Failed to load stickers');
      }
    } finally {
      setLoading(false);
    }
    return () => source.cancel('Sticker catalog refresh cancelled');
  }, []);

  useEffect(() => {
    const cancel = refreshCatalog();
    return () => {
      if (typeof cancel === 'function') cancel();
    };
  }, [refreshCatalog]);

  const value = useMemo(
    () => ({
      catalog,
      loading,
      error,
      refreshCatalog,
    }),
    [catalog, loading, error, refreshCatalog]
  );

  return <StickerContext.Provider value={value}>{children}</StickerContext.Provider>;
};

export const useStickers = () => useContext(StickerContext);

export default StickerContext;
