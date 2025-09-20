// client/src/lib/useMatchmaking.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';

export function useMatchmaking(game, me) {
  const socketRef = useRef(null);
  const [roomId, setRoomId] = useState(null);
  const [role, setRole] = useState(null); // 'A' or 'B'
  const [seed, setSeed] = useState(null);
  const [status, setStatus] = useState('Idle');
  const [connected, setConnected] = useState(false);

  const ensure = () => {
    if (socketRef.current) return socketRef.current;
    const s = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = s;
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('mm:queued', () => setStatus('Looking for an opponent…'));
    s.on('mm:start', ({ roomId, role, seed }) => {
      setRoomId(roomId); setRole(role); setSeed(seed);
      setStatus(`Matched! You are ${role}.`);
    });
    s.on('mm:ended', ({ reason }) => {
      setStatus(`Match ended (${reason || 'done'}).`);
      setRoomId(null); setRole(null); setSeed(null);
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
    setRoomId(null); setRole(null); setSeed(null);
  }, [roomId]);

  const send = useCallback((type, payload) => {
    const s = ensure();
    if (!roomId) return;
    s.emit('mm:relay', { roomId, type, payload });
  }, [roomId]);

  const on = useCallback((handler) => {
    const s = ensure();
    const fn = ({ type, payload }) => handler(type, payload);
    s.on('mm:msg', fn);
    return () => s.off('mm:msg', fn);
  }, []);

  useEffect(() => () => {
    if (socketRef.current) socketRef.current.disconnect();
  }, []);

  return { queue, leave, send, on, roomId, role, seed, status, connected };
}
