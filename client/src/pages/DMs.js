// client/src/pages/DMs.js
import React, { useEffect, useMemo, useState, useContext, useRef, useCallback } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../App';
import UserLink from '../components/UserLink';
import { API_BASE_URL, toMediaUrl } from '../config';

const Page = styled.div`max-width: 980px; margin: 0 auto; padding: 16px;`;
const Title = styled.h2` color: #e5e7eb; margin: 0 0 12px 0; `;
const Layout = styled.div`
  display: grid; grid-template-columns: 320px 1fr; gap: 16px; min-height: calc(100vh - 120px);
`;
const Left = styled.div`
  border: 1px solid var(--border-color); border-radius: 12px;
  background: var(--container-white); display: flex; flex-direction: column; overflow: hidden;
`;
const Right = styled.div`
  border: 1px solid var(--border-color); border-radius: 12px;
  background: var(--container-white); display: flex; flex-direction: column; overflow: hidden;
`;
const SearchBox = styled.div`
  padding: 8px; border-bottom: 1px solid var(--border-color); display: grid; grid-template-columns: 1fr auto; gap: 8px;
  input { padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 10px; }
  button { padding: 10px 12px; border-radius: 10px; border: 1px solid #111; background: #111; color: #fff; cursor: pointer; }
`;
const List = styled.div` overflow: auto; padding: 8px; `;
const Row = styled.button`
  width: 100%; text-align: left; border: none; background: transparent; padding: 10px 8px;
  border-radius: 10px; display: grid; grid-template-columns: 42px 1fr auto; gap: 10px; align-items: center; cursor: pointer;
  &:hover { background: #f3f4f6; }
  .avatar { width: 42px; height: 42px; border-radius: 50%; overflow: hidden; background: #eef2f7; display: grid; place-items: center; }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .nameLine { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .name { font-weight: 800; }
  .sub { font-size: 12px; color: #666; }
`;
const ThreadHeader = styled.div`
  padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-weight: 800;
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
`;
const Messages = styled.div`
  flex: 1; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px;
`;
const MsgRow = styled.div`
  display: flex; gap: 8px; align-items: flex-end;
  justify-content: ${p => (p.$mine ? 'flex-end' : 'flex-start')};
`;
const MsgAvatar = styled.div`
  width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: #eef2f7; flex: 0 0 auto;
  img { width: 100%; height: 100%; object-fit: cover; display: block; }
`;
const MsgContent = styled.div` max-width: 70%; `;
const MsgHeader = styled.div`
  font-size: 12px; margin: 0 0 4px 0; color: #6b7280;
  display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;
`;
const Bubble = styled.div`
  background: ${p => (p.$mine ? '#111' : '#f1f3f5')}; color: ${p => (p.$mine ? '#fff' : '#111')};
  padding: 10px 12px; border-radius: 12px;
  img { display: block; max-width: 260px; width: 100%; height: auto; border-radius: 10px; border: 1px solid var(--border-color); margin-top: 6px; }
`;
const Compose = styled.form`
  display: grid; grid-template-columns: auto 1fr auto; gap: 8px; padding: 10px; border-top: 1px solid var(--border-color);
  input[type="text"] { padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 10px; }
  button { padding: 10px 12px; border-radius: 10px; border: 1px solid #111; background: #111; color: #fff; }
`;
const AttachBtn = styled.label`
  padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border-color); background:#fff; color:#111; cursor:pointer;
  &:hover { background:#f8fafc; }
`;
const Hidden = styled.input` display:none; `;
const Mini = styled.div` font-size: 12px; color: #666; `;
const TitleBadge = styled.span`
  font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;
  background: #f3f4f6; color: #111; border: 1px solid var(--border-color);
`;

const FALLBACK_AVATAR =
  'https://www.clipartmax.com/png/middle/72-721825_tuffy-tuffy-the-titan-csuf.png';

const DMPage = () => {
  const { user } = useContext(AuthContext);
  const [q, setQ] = useState('');
  const [, setSearchResults] = useState([]); // value not used in current UI; keep setter for debounce effect
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState({}); // id -> {_id, username, profilePicture, badgesEquipped}
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [err, setErr] = useState('');
  const messagesRef = useRef(null);

  const isGroup = useMemo(() => active?.isGroup, [active]);
  const getConvTitleBadge = (conv) =>
    conv?.titleBadge ??
    conv?.otherUser?.titleBadge ??
    (Array.isArray(conv?.otherUser?.badgesEquipped) ? conv.otherUser.badgesEquipped[0] : null) ??
    (Array.isArray(conv?.badgesEquipped) ? conv.badgesEquipped[0] : null) ?? '';

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages]);

  // Compact user loader (batch)
  const ensureUsers = useCallback(async (ids) => {
    const need = (ids || [])
      .map((x) => (x && typeof x === 'object' ? (x._id || x.id || x.userId) : x))
      .map(String)
      .filter(Boolean)
      .filter((id, i, a) => a.indexOf(id) === i)
      .filter((id) => !participants[id] || !participants[id].username);
    if (!need.length) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/users/basic`, { params: { ids: need.join(',') } });
      const map = {};
      (res.data || []).forEach(u => { map[String(u._id)] = u; });
      setParticipants(prev => ({ ...prev, ...map }));
    } catch { /* ignore */ }
  }, [participants]);

  // Conversations list loader
  const loadConversations = useCallback(async () => {
    if (!user?._id) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/messages/conversations/${user._id}`, { params: { userId: user._id } });
      setConversations(res.data || []);
      setErr('');
    } catch (e) { console.error(e); setErr('Failed to load conversations'); }
  }, [user?._id]);

  const loadMessages = useCallback(async (convId) => {
    if (!user?._id || !convId) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/messages/${convId}`, { params: { userId: user._id } });
      setMessages(res.data || []);
      await axios.put(`${API_BASE_URL}/api/messages/${convId}/read`, { userId: user._id });
      await loadConversations();
      setErr('');
    } catch (e) { console.error(e); setErr('Failed to load messages'); }
  }, [user?._id, loadConversations]); // ✅ no duplicate deps

  // initial load + poll
  useEffect(() => {
    if (!user?._id) return;
    loadConversations();
    const t = setInterval(loadConversations, 15000);
    return () => clearInterval(t);
  }, [user?._id, loadConversations]);

  // auto-open a conversation
  useEffect(() => {
    if (!conversations.length) return;
    const last = localStorage.getItem('lastConv');
    const found = last && conversations.find(c => c._id === last);
    const target = found || conversations[0];
    if (!active || active._id !== target._id) {
      openConversation(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  const openConversation = async (conv) => {
    if (!conv) return;
    setActive(conv);
    localStorage.setItem('lastConv', conv._id);

    // seed with me
    setParticipants(prev => ({ ...prev, [user._id]: { _id: user._id, username: user.username, profilePicture: user.profilePicture, badgesEquipped: user.badgesEquipped } }));

    // proactively hydrate group members from conv.participants if present
    if (Array.isArray(conv.participants) && conv.participants.length) {
      ensureUsers(conv.participants);
    }

    await loadMessages(conv._id);
  };

  // when messages change, resolve unknown senders (covers group DMs)
  useEffect(() => {
    if (!messages.length) return;
    const ids = messages.map(m => m.senderId);
    ensureUsers(ids);
  }, [messages, ensureUsers]);

  const createConversation = async (participantIds, name) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/messages/conversation`, {
        creatorId: user._id,
        participants: participantIds,
        name: name || null
      });
      await loadConversations();
      await openConversation(res.data);
      setSelecting(false); setSelectedUsers([]); setGroupName(''); setQ(''); setSearchResults([]);
    } catch (e) { console.error(e); alert('Failed to start conversation'); }
  };

  const uploadImage = async () => {
    if (!file) return null;
    const fd = new FormData(); fd.append('file', file);
    const res = await axios.post(`${API_BASE_URL}/api/uploads/image`, fd, {
      headers: { 'Content-Type': 'multipart/form-data', 'x-user-id': user._id }
    });
    return res.data;
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!active) return;
    if (!text.trim() && !file) return;

    try {
      const attachment = file ? await uploadImage() : null;
      const res = await axios.post(`${API_BASE_URL}/api/messages/${active._id}`, {
        senderId: user._id,
        body: text.trim(),
        attachments: attachment ? [attachment] : []
      });
      setMessages(m => [...m, res.data]);
      setText(''); setFile(null);
      await loadConversations();
    } catch (e) { console.error(e); }
  };

  // search people to start a chat (kept for future “New chat” UI)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setSearchResults([]); return; }
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(q)}&userId=${user._id}`);
        setSearchResults(res.data || []);
      } catch (e) { console.error(e); }
    }, 300);
    return () => clearTimeout(t);
  }, [q, user._id]);

  const titleBadge = getConvTitleBadge(active);

  const nameFromMessage = (m) => {
    const mine = m.senderId === user._id;
    if (mine) return user.username;
    if (!isGroup && active?.title) return active.title; // 1-1 fallback
    return (
      participants[m.senderId]?.username ||
      m.sender?.username ||
      m.senderUsername ||
      m.username ||
      'Unknown'
    );
  };

  const avatarFromMessage = (m) => {
    const mine = m.senderId === user._id;
    if (mine) return user.profilePicture || FALLBACK_AVATAR;
    return (
      participants[m.senderId]?.profilePicture ||
      (isGroup ? null : active?.avatar) ||
      FALLBACK_AVATAR
    );
  };

  const renderMessage = (m) => {
    const mine = m.senderId === user._id;
    const senderUsername = nameFromMessage(m);
    const senderAvatar = avatarFromMessage(m);

    return (
      <MsgRow key={m._id} $mine={mine}>
        {!mine && (
          <MsgAvatar aria-hidden>
            <img src={senderAvatar || FALLBACK_AVATAR} alt="" />
          </MsgAvatar>
        )}
        <MsgContent>
          <MsgHeader>
            {senderUsername && senderUsername !== 'Unknown'
              ? <UserLink username={senderUsername}>{senderUsername}</UserLink>
              : <span>Unknown</span>}
            <span>{new Date(m.createdAt).toLocaleString()}</span>
          </MsgHeader>
          <Bubble $mine={mine}>
            {m.body}
            {(m.attachments || []).map((a, i) =>
              a.type === 'image' ? <img key={i} src={toMediaUrl(a.url)} alt="DM attachment" /> : null
            )}
          </Bubble>
        </MsgContent>
        {mine && (
          <MsgAvatar aria-hidden>
            <img src={user.profilePicture || FALLBACK_AVATAR} alt="" />
          </MsgAvatar>
        )}
      </MsgRow>
    );
  };

  return (
    <Page>
      <Title>Messages</Title>
      <Layout>
        <Left>
          <SearchBox>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={selecting ? 'Search people to add…' : 'Search people to DM…'} />
            {!selecting ? (
              <button onClick={() => setSelecting(true)} type="button">New chat</button>
            ) : (
              <button
                onClick={() => {
                  if (selectedUsers.length === 1) createConversation([selectedUsers[0]._id]);
                  else if (selectedUsers.length >= 2) createConversation(selectedUsers.map(u => u._id), groupName || 'Group chat');
                  else setSelecting(false);
                }}
                type="button"
              >Start</button>
            )}
          </SearchBox>

          {!selecting && (
            <List>
              {err && <Mini style={{ padding: 8, color: '#b00020' }}>{err}</Mini>}
              {conversations.length === 0 && <Mini style={{ padding: 8 }}>No messages yet.</Mini>}
              {conversations.map(c => (
                <Row key={c._id} onClick={() => openConversation(c)}>
                  <div className="avatar">
                    {c.avatar ? <img src={c.avatar} alt={c.title} /> : <span>{c.title?.[0]?.toUpperCase() || '?'}</span>}
                  </div>
                  <div>
                    <div className="nameLine">
                      <div className="name">{c.title}</div>
                      {!!getConvTitleBadge(c) && <TitleBadge>{getConvTitleBadge(c)}</TitleBadge>}
                    </div>
                    <div className="sub">{c.last?.body || 'No messages yet'}</div>
                  </div>
                  <div>
                    {c.unread > 0 ? (
                      <span style={{ background:'#e02424', color:'#fff', borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                        {c.unread}
                      </span>
                    ) : null}
                  </div>
                </Row>
              ))}
            </List>
          )}
        </Left>

        <Right>
          {!active ? (
            <div style={{ padding: 16, color: '#666' }}>Select a conversation or start a new one.</div>
          ) : (
            <>
              {isGroup ? (
                <ThreadHeader>{active.title}</ThreadHeader>
              ) : (
                <ThreadHeader>
                  <UserLink username={active.title}>{active.title}</UserLink>
                  {!!titleBadge && <TitleBadge>{titleBadge}</TitleBadge>}
                </ThreadHeader>
              )}

              <Messages ref={messagesRef}>
                {messages.map(renderMessage)}
              </Messages>

              <Compose onSubmit={handleSend}>
                <AttachBtn htmlFor="dm-attach">Attach</AttachBtn>
                <Hidden id="dm-attach" type="file" accept="image/*" onChange={(e)=> setFile(e.target.files?.[0] || null)} />
                <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" />
                <button type="submit">Send</button>
              </Compose>
            </>
          )}
        </Right>
      </Layout>
    </Page>
  );
};

export default DMPage;
