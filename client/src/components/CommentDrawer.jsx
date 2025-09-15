import React, { useEffect, useMemo, useState, useContext } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../App';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { API_BASE_URL } from '../config';

const Backdrop = styled.div`position: fixed; inset:0; background: rgba(0,0,0,.25); z-index:1500;`;
const Drawer = styled.aside`
  position: fixed; top:0; right:0; height:100vh; width:min(420px,92vw);
  background:#fff; box-shadow: -2px 0 12px rgba(0,0,0,.2); z-index:1501; display:flex; flex-direction:column;
`;
const Header = styled.div`padding:14px 16px; border-bottom:1px solid #eee; font-weight:600;`;
const List = styled.div`flex:1; overflow:auto; padding:12px 16px;`;
const Row = styled.div`margin-bottom:12px;`;
const Meta = styled.div`font-size:12px; color:#777;`;
const Body = styled.div`margin:4px 0 6px; white-space:pre-wrap; word-break:break-word;`;
const Actions = styled.div`display:flex; gap:16px; align-items:center; color:#555;`;
const InputBar = styled.form`display:grid; grid-template-columns:1fr auto; gap:8px; padding:10px; border-top:1px solid #eee;`;
const Text = styled.textarea`flex:1; resize:none; padding:10px; border-radius:8px; border:1px solid #ddd;`;

export default function CommentDrawer({ post, onClose, onCountChange }) {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');

  const api = `${API_BASE_URL}/api/comments`;

  const byId = useMemo(() => Object.fromEntries(items.map(i => [i._id, i])), [items]);
  const topLevel = useMemo(() => items.filter(i => !i.parentId), [items]);
  const repliesOf = (id) => items.filter(i => String(i.parentId) === String(id));

  const load = async () => {
    const res = await axios.get(`${api}/post/${post._id}`);
    setItems(res.data || []);
    onCountChange?.(res.data?.length || 0);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [post._id]);

  const send = async (e, parent=null) => {
    e.preventDefault();
    const base = text.trim();
    if (!base) return;
    const body = parent ? (base.startsWith('@') ? base : `@${parent.username} ${base}`) : base;
    await axios.post(`${api}`, { postId: post._id, userId: user._id, body, parentId: parent?._id || null });
    setText(''); await load();
  };

  const toggleLike = async (commentId) => {
    await axios.put(`${api}/${commentId}/like`, { userId: user._id });
    await load();
  };

  return (
    <>
      <Backdrop onClick={onClose} />
      <Drawer>
        <Header>Comments · {items.length}</Header>
        <List>
          {topLevel.map(c => (
            <div key={c._id}>
              <CommentRow c={c} me={user} onLike={() => toggleLike(c._id)} onReply={(e)=>send(e, { _id:c._id, username: byId[c._id]?.username || 'user' })}/>
              {repliesOf(c._id).map(r => (
                <Row key={r._id} style={{ marginLeft: 18 }}>
                  <CommentRow c={r} me={user} onLike={() => toggleLike(r._id)} />
                </Row>
              ))}
            </div>
          ))}
          {topLevel.length === 0 && <Meta>No comments yet — be the first!</Meta>}
        </List>
        <InputBar onSubmit={(e)=>send(e, null)}>
          <Text rows={2} value={text} onChange={e=>setText(e.target.value)} placeholder="Write a comment…" />
          <button type="submit">Send</button>
        </InputBar>
      </Drawer>
    </>
  );
}

function CommentRow({ c, me, onLike, onReply }) {
  const liked = (c.likes || []).map(String).includes(String(me._id));
  const likeCount = (c.likes || []).length || 0;
  return (
    <Row>
      <Meta>{c.username || 'user'} · {new Date(c.createdAt).toLocaleString()}</Meta>
      <Body>{c.body}</Body>
      <Actions>
        <span onClick={onLike} style={{ cursor:'pointer' }}>{liked ? <FaHeart/> : <FaRegHeart/>} {likeCount}</span>
        {onReply && <button onClick={onReply}>Reply</button>}
      </Actions>
    </Row>
  );
}
