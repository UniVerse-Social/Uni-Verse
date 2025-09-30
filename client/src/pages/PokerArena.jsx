// client/src/pages/PokerArena.jsx
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { io } from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

const Container = styled.div`display:block;`;
const Card = styled.div`
  background: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 16px; padding: 14px;
  box-shadow: 0 10px 24px rgba(0,0,0,.06);
`;
const Top = styled.div`display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;`;
const Pill = styled.button`
  border:1px solid var(--border-color); background:#f9fafb; border-radius:999px; padding:8px 12px;
  cursor:pointer; font-weight:700; ${(p)=>p.$on && 'background:#111827;color:#fff;'}
`;
const Grid = styled.div`display:grid; grid-template-columns: repeat(auto-fill, minmax(180px,1fr)); gap:8px;`;
const TableCard = styled.div`border:1px solid var(--border-color); border-radius:12px; padding:10px;`;
const TableHeader = styled.div`display:flex; justify-content:space-between; font-weight:800; margin-bottom:6px;`;

const TableWrap = styled(Card)`min-height:520px; position:relative; margin-top:16px;`;
const Felt = styled.div`
  position:absolute; inset:10px; border-radius:24px;
  background: radial-gradient(circle at 50% 20%, #065f46, #064e3b);
  border:4px solid #064e3b; color:#fff;
`;
const Pot = styled.div`position:absolute; top: 46%; left:50%; transform:translate(-50%,-50%); font-weight:800;`;
const Comm = styled.div`position:absolute; top: 52%; left:50%; transform:translateX(-50%); display:flex; gap:6px;`;
const Seat = styled.div`
  position:absolute; width:120px; text-align:center;
  & > div.cards {display:flex; justify-content:center; gap:4px; margin-top:6px;}
  & .card { width:36px; height:52px; background:#fff; border-radius:6px; border:1px solid #111827; color:#111827; display:flex; align-items:center; justify-content:center; font-weight:800;}
`;
const ActionBar = styled.div`position:absolute; bottom:10px; left:10px; right:10px; display:flex; gap:8px; justify-content:center;`;
const Btn = styled.button`background:#111827;color:#fff;border:0;border-radius:12px;padding:10px 12px;font-weight:800;cursor:pointer; &:disabled{opacity:.5;cursor:not-allowed;}`;

const Chat = styled(Card)`display:flex; flex-direction:column; height:240px; margin-top:16px;`;
const ChatList = styled.div`flex:1; overflow:auto; font-size:13px;`;
const ChatInput = styled.input`border:1px solid var(--border-color); border-radius:8px; padding:8px;`;

const STAKES = ['100','1000','5000','10000','VIP'];
const MAX_TABLES_PER_STAKE = 10;

function CardGlyph({c}) {
  const s = c.s; const r = c.r;
  const suit = s==='S'?'♠':s==='H'?'♥':s==='D'?'♦':'♣';
  return <div className="card">{r}{suit}</div>;
}

export default function PokerArena() {
  const { user } = useContext(AuthContext);
  const [stake, setStake] = useState('100');
  const [tables, setTables] = useState([]); // [{id,stake,players,count,max}]
  const [room, setRoom] = useState(null);
  const [state, setState] = useState(null); // authoritative table state
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.emit('poker:list'); // initial

    // NOTE: If your server emits different event names, align them here.
    socket.on('poker:tables', ({ tables }) => setTables(tables));
    socket.on('poker:join-ok', ({ roomId }) => setRoom(roomId));
    socket.on('poker:state', (s) => setState(s));
    socket.on('poker:msg', (m) => setChat((x)=>[...x, m]));
    socket.on('poker:error', (e) => alert(e.message || 'Poker error'));
    socket.on('poker:cashout-ok', async ({ coins }) => {
      try { await axios.get(`${API_BASE_URL}/api/games/stats/${user._id}`); } catch {}
    });

    const timer = setInterval(()=>socket.emit('poker:list'), 4000);
    return () => { clearInterval(timer); socket.disconnect(); };
  }, [user?._id]);

  const join = (tableId) => socketRef.current.emit('poker:join', { tableId, stake, user: { userId:user._id, username:user.username } });
  const sit  = (buyin)   => socketRef.current.emit('poker:sit',  { roomId: room, buyin });
  const leave= ()        => socketRef.current.emit('poker:leave',{ roomId: room });
  const act  = (type, amount)=> socketRef.current.emit('poker:act', { roomId: room, type, amount });
  const send = () => { if (!msg.trim()) return; socketRef.current.emit('poker:chat', { roomId: room, text: msg }); setMsg(''); };

  const me = useMemo(()=> state?.players?.find(p => String(p.userId)===String(user?._id)), [state, user?._id]);

  return (
    <Container>
      {/* LOBBY (no duplicate sidebar; this page is now content-only) */}
      {!room && (
        <Card>
          <Top>
            {STAKES.map(s => <Pill key={s} $on={s===stake} onClick={()=>setStake(s)}>{s==='VIP'?'VIP Table':`${Number(s).toLocaleString()} stakes`}</Pill>)}
          </Top>
          <Grid>
            {Array.from({length:MAX_TABLES_PER_STAKE}).map((_,i)=>{
              const id = `${stake}-${i+1}`;
              const t = tables.find(t=>t.id===id) || { id, stake, count:0, max:8 };
              return (
                <TableCard key={id}>
                  <TableHeader><span>Table {i+1}</span><span>{t.count}/8</span></TableHeader>
                  <Btn onClick={()=>join(id)}>Join</Btn>
                </TableCard>
              );
            })}
          </Grid>

          <div style={{marginTop:12, display:'flex', gap:8, alignItems:'center'}}>
            <b>Private table</b>
            <Btn onClick={()=>socketRef.current.emit('poker:createPrivate', { stake, user: { userId:user._id, username:user.username } })}>Create</Btn>
            <Btn onClick={()=>{
              const code = prompt('Enter private code'); 
              if (code) socketRef.current.emit('poker:joinPrivate', { code, stake, user: { userId:user._id, username:user.username } });
            }}>Join</Btn>
          </div>
        </Card>
      )}

      {/* TABLE */}
      {room && (
        <TableWrap>
          <Felt>
            <Pot>Pot: {state?.pot ?? 0}</Pot>
            <Comm>
              {(state?.community||[]).map((c,i)=><CardGlyph key={i} c={c}/>)}
            </Comm>

            {state?.seats?.map((seat,idx)=>{
              const pos = [
                {left:'50%',top:'6%'}, {left:'82%',top:'18%'}, {left:'90%',top:'44%'},
                {left:'82%',top:'70%'},{left:'50%',top:'82%'},{left:'18%',top:'70%'},
                {left:'10%',top:'44%'},{left:'18%',top:'18%'},
              ][idx];
              const p = state.players.find(x=>x.seat===idx);
              return (
                <Seat key={idx} style={{position:'absolute', transform:'translate(-50%,-50%)', ...pos}}>
                  <div style={{fontWeight:800}}>{p?.username || 'Empty'}</div>
                  <div>💰 {p?.stack ?? 0}</div>
                  <div className="cards">
                    {(p && (p.userId===user?._id || state.showdown)) ? (p.hole||[]).map((c,i)=><CardGlyph key={i} c={c}/>) : null}
                  </div>
                </Seat>
              );
            })}

            <ActionBar>
              <Btn onClick={()=>leave()}>Leave / Cash Out</Btn>
              <Btn disabled={!state?.canAct || !me || state.turnUserId!==me.userId} onClick={()=>act('fold')}>Fold</Btn>
              <Btn disabled={!state?.canAct || !me || state.turnUserId!==me.userId || state.toCall===0} onClick={()=>act('call')}>{state?.toCall?`Call ${state.toCall}`:'Check'}</Btn>
              <Btn disabled={!state?.canAct || !me || state.turnUserId!==me.userId} onClick={()=>{
                const a = prompt('Raise amount'); if (a) act('raise', Number(a));
              }}>Raise</Btn>
              {!me && <Btn onClick={()=>{ const b = prompt('Buy-in amount'); if (b) sit(Number(b)); }}>Sit & Buy-in</Btn>}
            </ActionBar>
          </Felt>
        </TableWrap>
      )}

      <Chat>
        <div style={{fontWeight:800, marginBottom:6}}>Table Chat</div>
        <ChatList>{chat.map((m,i)=><div key={i}><b>{m.user?.username||'System'}:</b> {m.text}</div>)}</ChatList>
        <div style={{display:'flex', gap:6}}>
          <ChatInput value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Say something…"/>
          <Btn onClick={send}>Send</Btn>
        </div>
      </Chat>
    </Container>
  );
}
