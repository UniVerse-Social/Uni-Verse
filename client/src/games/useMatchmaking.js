// client/src/games/useMatchmaking.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';

export function useMatchmaking(game, me) {
  const socketRef = useRef(null);
  const [roomId, setRoomId] = useState(null);
  const [seed, setSeed] = useState(null);
  const [status, setStatus] = useState('Idle');
  const [connected, setConnected] = useState(false);

  // IceRacer additions
  const [lobbyCount, setLobbyCount] = useState(0);
  const [lobbySize, setLobbySize] = useState(0);
  const [roster, setRoster] = useState(null);
  const [raceMeta, setRaceMeta] = useState(null); // { mapId, laps, startAt }

  const ensure = () => {
    if (socketRef.current) return socketRef.current;

    // Prefer same-origin when we’re on a Cloudflare Tunnel.
    const pageOrigin =
      (typeof window !== 'undefined' && window.location && window.location.origin) || '';
    let WS_BASE = (API_BASE_URL || pageOrigin || '').replace(/\/+$/, '').replace(/\/api\/?$/, '');

    try {
      const po = new URL(pageOrigin);
      const wb = new URL(WS_BASE);
      if (/trycloudflare\.com$/i.test(po.hostname) && po.hostname !== wb.hostname) {
        WS_BASE = po.origin; // force same tunnel for sockets
      }
    } catch {}

    const s = io(WS_BASE || undefined, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      upgrade: true,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 750,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
    });

    socketRef.current = s;
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    s.on('mm:queued', () => setStatus('Looking for opponents…'));
    s.on('mm:lobby', ({ count, size }) => {
      setLobbyCount(count);
      setLobbySize(size);
      setStatus(`Looking for opponents… (${count}/${size} players)`);
    });

    s.on('mm:start', (payload) => {
      const { roomId, seed, roster, mapId, laps, startAt, size } = payload;
      setRoomId(roomId);
      setSeed(seed);
      setRoster(roster || []);
      setLobbySize(size || (roster ? roster.length : 0));
      setRaceMeta({ mapId, laps, startAt });
      setStatus('Matched! Starting…');
    });

    s.on('mm:ended', ({ reason }) => {
      setStatus(`Match ended (${reason || 'done'}).`);
      setRoomId(null); setSeed(null); setRoster(null);
      setLobbyCount(0); setLobbySize(0); setRaceMeta(null);
    });
    return s;
  };

  const queue = useCallback(() => {
    const s = ensure();
    s.emit('mm:queue', { game, userId: me?._id, username: me?.username });
  }, [game, me?._id, me?.username]);

  const leave = useCallback(() => {
    const s = ensure();
    s.emit('mm:leave', { roomId });
    setRoomId(null); setSeed(null); setRoster(null);
    setLobbyCount(0); setLobbySize(0); setRaceMeta(null);
  }, [roomId]);

  const send = useCallback((type, payload) => {
    const s = ensure();
    if (!roomId) return;
    s.emit('mm:relay', { roomId, type, payload });
  }, [roomId]);

  const on = useCallback((handler) => {
    const s = ensure();
    const fn = ({ type, payload, from }) => handler(type, payload, from);
    s.on('mm:msg', fn);
    return () => s.off('mm:msg', fn);
  }, []);

  useEffect(() => () => {
    if (socketRef.current) socketRef.current.disconnect();
  }, []);

  return {
    queue, leave, send, on,
    roomId, seed, status, connected,
    lobbyCount, lobbySize, roster, raceMeta
  };
}
