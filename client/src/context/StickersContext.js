import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import axios from 'axios';
import { API_BASE_URL, toMediaUrl } from '../config';

const StickerContext = createContext({
  catalog: [],
  loading: true,
  error: '',
  lastUpdated: 0,
  refreshCatalog: () => {},
});

export const StickerProvider = ({ children }) => {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(0);

  // Track the current in-flight request to avoid race conditions
  const controllerRef = useRef(null);
  const requestIdRef = useRef(0);

  const refreshCatalog = useCallback(async () => {
    // Abort any previous request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const reqId = ++requestIdRef.current;

    try {
      setLoading(true);
      setError('');

      const res = await axios.get(`${API_BASE_URL}/api/stickers/catalog`, {
        signal: controller.signal,
      });

      // Validate/normalize the payload
      const data = Array.isArray(res.data) ? res.data : [];
      const normalized = data.map((item) => ({
        ...item,
        assetValue: item.assetValue ? toMediaUrl(item.assetValue) : item.assetValue,
        poster: item.poster ? toMediaUrl(item.poster) : item.poster,
      }));
      // Only apply latest request
      if (requestIdRef.current === reqId) {
        setCatalog(normalized);
        setLastUpdated(Date.now());
      }
    } catch (err) {
      // Ignore abort errors
      const aborted =
        err?.name === 'CanceledError' ||
        err?.code === 'ERR_CANCELED' ||
        axios.isCancel?.(err);

      if (!aborted) {
        console.error('Sticker catalog fetch failed', err);
        if (requestIdRef.current === reqId) {
          setError('Failed to load stickers');
        }
      }
    } finally {
      if (requestIdRef.current === reqId) {
        setLoading(false);
        // Only clear the controller if it's ours
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
      }
    }
  }, []);

  useEffect(() => {
    // Kick off initial load
    refreshCatalog();
    // Cleanup on unmount: abort any in-flight request
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [refreshCatalog]);

  const value = useMemo(
    () => ({
      catalog,
      loading,
      error,
      lastUpdated,
      refreshCatalog,
    }),
    [catalog, loading, error, lastUpdated, refreshCatalog]
  );

  return <StickerContext.Provider value={value}>{children}</StickerContext.Provider>;
};

export const useStickers = () => useContext(StickerContext);

export default StickerContext;
