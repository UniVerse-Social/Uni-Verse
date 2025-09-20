// client/src/pages/ChessArena.jsx
import React, { useCallback, useEffect, useRef, useState, useContext } from 'react';
import styled from 'styled-components';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

const Wrap = styled.div`display:grid; grid-template-columns: 480px 1fr; gap:16px; align-items:start;`;
const Panel = styled.div`
  border:1px solid var(--border-color); background:var(--container-white);
  border-radius:12px; padding:12px;
`;
const Button = styled.button`
  padding: 8px 12px; border-radius: 10px; border: 1px solid #111; cursor: pointer;
  background: ${p=>p.$primary ? '#111' : '#fff'}; color: ${p=>p.$primary ? '#fff' : '#111'};
`;

export default function ChessArena() {
  const { user } = useContext(AuthContext);

  const [mode, setMode] = useState(null);      // null | 'bot' | 'online'
  const [fen, setFen] = useState(new Chess().fen());
  const [orientation, setOrientation] = useState('white');
  const [status, setStatus] = useState('Pick a mode to start.');
  const [roomId, setRoomId] = useState(null);
  const socketRef = useRef(null);

  // Local engine for bot / optimistic board for online
  const chessRef = useRef(new Chess());

  const resetLocal = useCallback((flip='white')=>{
    chessRef.current = new Chess();
    setOrientation(flip);
    setFen(chessRef.current.fen());
  }, []);

  /* ---------------- BOT MODE ---------------- */
  const startBot = () => {
    setMode('bot');
    setRoomId(null);
    resetLocal('white');
    setStatus('Practice vs Bot (random legal moves). You are White.');
  };

  const botMove = useCallback(() => {
    const chess = chessRef.current;
    if (chess.isGameOver()) return;
    const legal = chess.moves({ verbose: true });
    if (!legal.length) return;
    const m = legal[Math.floor(Math.random() * legal.length)];
    chess.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
    setFen(chess.fen());
    if (chess.isGameOver()) {
      setStatus(endMessage(chess));
    }
  }, []);

  /* ---------------- ONLINE MODE ---------------- */
  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const s = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => setStatus('Connected. Queueing…'));
    s.on('chess:start', ({ roomId, color, fen, white, black }) => {
      chessRef.current = new Chess(fen || undefined);
      setFen(chessRef.current.fen());
      setOrientation(color === 'w' ? 'white' : 'black');
      setRoomId(roomId);
      setStatus(`Match found: ${white?.username || 'White'} vs ${black?.username || 'Black'}. You are ${color==='w'?'White':'Black'}.`);
    });
    s.on('chess:state', ({ fen }) => {
      chessRef.current.load(fen);
      setFen(fen);
    });
    s.on('chess:gameover', ({ result, reason }) => {
      setStatus(`Game over: ${result} (${reason})`);
    });
    s.on('chess:queued', () => setStatus('Looking for an opponent…'));
    s.on('chess:queue-cancelled', () => setStatus('Queue cancelled.'));
    s.on('disconnect', () => setStatus('Disconnected.'));

    return s;
  }, []); // API_BASE_URL is a stable module constant — no dep needed

  const startOnline = () => {
    setMode('online');
    resetLocal('white');
    const s = connectSocket();
    s.emit('chess:queue', { userId: user?._id, username: user?.username });
  };

  const leaveOnline = () => {
    const s = socketRef.current;
    if (s) {
      s.emit('chess:leave', { roomId });
      s.disconnect();
      socketRef.current = null;
    }
    setMode(null);
    setRoomId(null);
    setStatus('Left online mode.');
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  /* ---------------- HELPERS ---------------- */
  const endMessage = (chess) => {
    if (chess.isCheckmate()) {
      return `Checkmate. ${chess.turn()==='w' ? 'Black' : 'White'} wins.`;
    }
    if (chess.isStalemate()) return 'Draw by stalemate.';
    if (chess.isThreefoldRepetition()) return 'Draw by threefold repetition.';
    if (chess.isInsufficientMaterial()) return 'Draw by insufficient material.';
    if (chess.isDraw()) return 'Draw.';
    return 'Game over.';
  };

  const onPieceDrop = (source, target) => {
    const chess = chessRef.current;
    const mv = { from: source, to: target, promotion: 'q' };

    // In online mode, only allow moving if it's your turn
    if (mode === 'online') {
      const myColor = orientation === 'white' ? 'w' : 'b';
      if (chess.turn() !== myColor) return false;
    }

    const move = chess.move(mv);
    if (!move) return false;

    setFen(chess.fen());

    if (mode === 'bot') {
      if (!chess.isGameOver()) {
        setTimeout(botMove, 500);
      } else {
        setStatus(endMessage(chess));
      }
    } else if (mode === 'online' && socketRef.current && roomId) {
      socketRef.current.emit('chess:move', { roomId, ...mv });
    }
    return true;
  };

  const resign = () => {
    if (mode === 'online' && socketRef.current && roomId) {
      socketRef.current.emit('chess:resign', { roomId });
    } else if (mode === 'bot') {
      setStatus('You resigned.');
    }
  };

  return (
    <Wrap>
      <Panel>
        <Chessboard
          position={fen}
          onPieceDrop={onPieceDrop}
          boardOrientation={orientation}
          boardWidth={456}
          customBoardStyle={{ borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.08)' }}
        />
      </Panel>

      <Panel>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <Button onClick={startBot}>Practice vs Bot</Button>
          {mode !== 'online' ? (
            <Button $primary onClick={startOnline}>Play Online</Button>
          ) : (
            <Button onClick={leaveOnline}>Leave Online</Button>
          )}
          <Button onClick={resign}>Resign</Button>
        </div>
        <div style={{marginTop:10, color:'#555'}}>{status}</div>
        <div style={{marginTop:12, fontSize:12, color:'#6b7280'}}>
          Chess games here are <b>unranked</b> — no trophies are awarded.
        </div>
      </Panel>
    </Wrap>
  );
}
