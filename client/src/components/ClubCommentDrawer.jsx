import React, { useEffect, useMemo, useState, useContext } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import UserLink from './UserLink';

const Backdrop = styled.div`position:fixed; inset:0; background:rgba(0,0,0,.25); z-index:1500;`;
const Drawer = styled.div`position:fixed; top:0; right:0; height:100vh; width:min(420px,92vw); background:#fff; z-index:1501; box-shadow:-2px 0 12px rgba(0,0,0,.2); display:flex; flex-direction:column;`;
const Head = styled.div`padding:12px 14px; border-bottom:1px solid #eee; font-weight:700;`;
const List = styled.div`flex:1; overflow:auto; padding:12px;`;
const Row = styled.div`margin-bottom:12px;`;
const Meta = styled.div`font-size:12px; color:#777;`;
const Body = styled.div`white-space:pre-wrap; word-break:break-word; margin:4px 0 6px;`;
const Actions = styled.div`display:flex; gap:16px; color:#444; align-items:center;`;
const Bar = styled.form`display:grid; grid-template-columns:1fr auto; gap:8px; padding:10px; border-top:1px solid #eee;`;
const TA = styled.textarea`padding:10px; border:1px solid #ddd; border-radius:8px; resize:none;`;

export default function ClubCommentDrawer({ post, onClose, onCountChange }){
  const { user } = useContext(AuthContext);
  const api = `${API_BASE_URL}/api/club-comments`;
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');

  const topLevel = useMemo(()=> items.filter(i => !i.parentId), [items]);
  const repliesOf = (id)=> items.filter(i => String(i.parentId) === String(id));

  const load = async ()=>{
    const r = await axios.get(`${api}/post/${post._id}`);
    setItems(r.data || []); onCountChange?.(r.data?.length || 0);
  };
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [post._id]);

  const send = async (e, parent=null)=>{
    e.preventDefault();
    const base = text.trim(); if(!base) return;
    const body = parent ? (base.startsWith('@') ? base : `@${parent.username} ${base}`) : base;
    await axios.post(`${api}`, { postId: post._id, userId: user._id, body, parentId: parent?._id || null });
    setText(''); await load();
  };
  const like = async (id)=>{ await axios.put(`${api}/${id}/like`, { userId: user._id }); await load(); };

  return (
    <>
      <Backdrop onClick={onClose}/>
      <Drawer>
        <Head>Comments · {items.length}</Head>
        <List>
          {topLevel.map(c=>(
            <div key={c._id}>
              <CommentRow c={c} me={user} onLike={()=>like(c._id)} onReply={(e)=>send(e, { _id:c._id, username:c.username || 'user' })}/>
              {repliesOf(c._id).map(r=>(
                <Row key={r._id} style={{marginLeft:18}}>
                  <CommentRow c={r} me={user} onLike={()=>like(r._id)}/>
                </Row>
              ))}
            </div>
          ))}
          {topLevel.length===0 && <Meta>No comments yet.</Meta>}
        </List>
        <Bar onSubmit={(e)=>send(e, null)}>
          <TA rows={2} value={text} onChange={e=>setText(e.target.value)} placeholder="Write a comment…"/>
          <button type="submit">Send</button>
        </Bar>
      </Drawer>
    </>
  );
}

function CommentRow({ c, me, onLike, onReply }){
  const liked = (c.likes||[]).map(String).includes(String(me._id));
  return (
    <Row>
      <Meta>
        <UserLink username={c.username || 'user'}>{c.username || 'user'}</UserLink>
        {' · '}{new Date(c.createdAt).toLocaleString()}
      </Meta>
      <Body>{c.body}</Body>
      <Actions>
        <span onClick={onLike} style={{cursor:'pointer'}}>{liked ? <FaHeart/> : <FaRegHeart/>} {(c.likes||[]).length||0}</span>
        {onReply && <button onClick={onReply}>Reply</button>}
      </Actions>
    </Row>
  );
}
