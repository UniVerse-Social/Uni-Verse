import React, { useCallback, useEffect, useRef, useState, useContext } from 'react';
import styled from 'styled-components';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { io } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

const Wrap = styled.div`display:grid; grid-template-columns: 480px 1fr; gap:16px; align-items:start;`;
const Panel = styled.div`border:1px solid var(--border-color); background:var(--container-white); border-radius:12px; padding:12px;`;
const Button = styled.button`
  padding: 8px 12px; border-radius: 10px; border: 1px solid #111; cursor: pointer;
  background: ${p=>p.$primary ? '#111' : '#fff'}; color: ${p=>p.$primary ? '#fff' : '#111'};
`;
const Alert = styled.div`
  margin-top: 10px; padding: 8px 10px; border-radius: 10px;
  border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; font-size: 13px;
`;

export default function ChessArena() {
  const { user } = useContext(AuthContext);

  const [mode, setMode] = useState(null);      // null | 'bot' | 'online'
  const [fen, setFen] = useState(new Chess().fen());
  const [orientation, setOrientation] = useState('white');
  const [status, setStatus] = useState('Pick a mode to start.');
  const [notice, setNotice] = useState('');
  const [roomId, setRoomId] = useState(null);
  const socketRef = useRef(null);

  // local engine
  const chessRef = useRef(new Chess());
  const awardedRef = useRef(false);
  const noticeTimer = useRef(null);

  const flashNotice = useCallback((msg, ms=1600) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(msg);
    noticeTimer.current = setTimeout(()=> setNotice(''), ms);
  }, []);
  const clearNotice = useCallback(() => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice('');
  }, []);

  const resetLocal = useCallback((flip='white')=>{
    chessRef.current = new Chess();
    setOrientation(flip);
    setFen(chessRef.current.fen());
    awardedRef.current = false;
    clearNotice();
  }, [clearNotice]);

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
    if (chess.isGameOver()) setStatus(endMessage(chess));
  }, []);

  /* ---------------- Award (online wins only) ---------------- */
  const awardWin = useCallback(async () => {
    if (!user?._id || awardedRef.current) return;
    try {
      await axios.post(`${API_BASE_URL}/api/games/result`, {
        userId: user._id, gameKey: 'chess', delta: 6, didWin: true,
      });
      awardedRef.current = true;
    } catch {}
  }, [user?._id]);

  /* ---------------- ONLINE MODE ---------------- */
  const connectSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const s = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('connect', () => setStatus('Connected. Queueing…'));
    s.on('chess:queued', () => setStatus('Looking for an opponent…'));
    s.on('chess:start', ({ roomId, color, fen, white, black }) => {
      chessRef.current = new Chess(fen || undefined);
      setFen(chessRef.current.fen());
      setOrientation(color === 'w' ? 'white' : 'black');
      setRoomId(roomId);
      setMode('online');
      awardedRef.current = false;
      clearNotice();
      setStatus(`Match found: ${white?.username || 'White'} vs ${black?.username || 'Black'}. You are ${color==='w'?'White':'Black'}.`);
    });
    s.on('chess:state', ({ fen }) => {
      try {
        chessRef.current.load(fen);
        setFen(fen);
        clearNotice();
      } catch { /* ignore malformed FEN defensively */ }
    });
    s.on('chess:gameover', ({ result, reason }) => {
      setStatus(`Game over: ${result} (${reason})`);
      if (mode === 'online') {
        const myColor = orientation === 'white' ? 'w' : 'b';
        const winColor = /white wins/i.test(result) ? 'w' : (/black wins/i.test(result) ? 'b' : null);
        if (winColor && myColor === winColor) awardWin();
      }
    });
    s.on('chess:queue-cancelled', () => setStatus('Queue cancelled.'));
    s.on('disconnect', () => setStatus('Disconnected.'));
    return s;
  }, [mode, orientation, awardWin, clearNotice]);

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
    clearNotice();
  };

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    };
  }, []);

  /* ---------------- Helpers ---------------- */
  const endMessage = (chess) => {
    if (chess.isCheckmate()) return `Checkmate. ${chess.turn()==='w' ? 'Black' : 'White'} wins.`;
    if (chess.isStalemate()) return 'Draw by stalemate.';
    if (chess.isThreefoldRepetition()) return 'Draw by threefold repetition.';
    if (chess.isInsufficientMaterial()) return 'Draw by insufficient material.';
    if (chess.isDraw()) return 'Draw.';
    return 'Game over.';
  };

  const onPieceDrop = (source, target/*, piece*/) => {
    const chess = chessRef.current;
    const mv = { from: source, to: target, promotion: 'q' };

    // online: respect turn
    if (mode === 'online') {
      const myColor = orientation === 'white' ? 'w' : 'b';
      if (chess.turn() !== myColor) { flashNotice('Not your turn.'); return false; }
    }

    try {
      const move = chess.move(mv);
      if (!move) { flashNotice('Illegal move. Try again.'); return false; }
    } catch {
      // protect UI from any unexpected throw
      flashNotice('Illegal move. Try again.');
      return false;
    }

    clearNotice();
    setFen(chess.fen());

    if (mode === 'bot') {
      if (!chess.isGameOver()) setTimeout(botMove, 480);
      else setStatus(endMessage(chess));
    } else if (mode === 'online' && socketRef.current && roomId) {
      socketRef.current.emit('chess:move', { roomId, ...mv });
    }
    return true;
  };

  const resign = () => {
    if (mode === 'online' && socketRef.current && roomId) socketRef.current.emit('chess:resign', { roomId });
    else if (mode === 'bot') setStatus('You resigned.');
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
        {!!notice && <Alert>{notice}</Alert>}
        <div style={{marginTop:12, fontSize:12, color:'#6b7280'}}>
          Wins vs real players grant <b>+6 trophies</b>. Bot games are unranked.
        </div>
      </Panel>
    </Wrap>
  );
}
