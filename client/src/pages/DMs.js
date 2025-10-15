import React, { useEffect, useMemo, useState, useContext, useRef, useCallback } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../App';
import UserLink from '../components/UserLink';
import { API_BASE_URL, toMediaUrl } from '../config';

const Page = styled.div`
  max-width: 980px;
  margin: 0 auto;
  padding: 16px;
  overflow: hidden; /* keep the page static; internal panes handle scroll */
`;

// Make title tappable on mobile to toggle the DM list
const Title = styled.button`
  color: #e5e7eb;
  margin: 0 0 12px 0;
  font-size: 28px;
  font-weight: 800;
  line-height: 1.2;
  background: transparent;
  border: 0;
  padding: 0;
  width: 100%;
  text-align: left;
  cursor: pointer;

  /* Desktop: keep normal header behavior */
  @media (min-width: 768px) { cursor: default; }

  /* Optional chevron for mobile */
  position: relative;
  @media (max-width: 767px) {
    &::after{
      content: attr(data-chevron);
      position: absolute;
      right: 0;
      top: 0.1rem;
      font-size: 16px;
      color: #e5e7eb;
    }
  }
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  height: calc(100vh - 120px);
  min-height: 0;
  position: relative; /* enables overlay positioning on mobile */

  /* Stack on phones: chat takes full width; left is an overlay */
  @media (max-width: 767px) {
    grid-template-columns: 1fr;
    height: calc(100vh - 100px);
  }
`;

const Left = styled.div`
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--container-white);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;

  /* On mobile, turn into an overlay with its own scroll */
  @media (max-width: 767px) {
    position: absolute;
    top: 0; left: 0; right: 0;
    z-index: 30;
    display: ${p => (p.$mobileOpen ? 'flex' : 'none')};
    max-height: 70vh;
    overflow: auto; /* scrolling contained to this box */
    box-shadow: 0 12px 30px rgba(0,0,0,0.25);
  }
`;

const Right = styled.div`
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--container-white);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
`;

const MsgContent = styled.div`
  max-width: 70%;
  @media (max-width: 767px) { max-width: 90%; }
`;

const Bubble = styled.div`
  background: ${p => (p.$mine ? '#111' : '#f1f3f5')};
  color: ${p => (p.$mine ? '#fff' : '#111')};
  padding: 10px 12px;
  border-radius: 12px;

  img {
    display: block;
    max-width: 260px;
    width: 100%;
    height: auto;
    border-radius: 10px;
    border: 1px solid var(--border-color);
    margin-top: 6px;
  }

  @media (max-width: 767px) {
    img { max-width: 100%; }
  }
`;
const SearchBox = styled.div`
  padding: 8px; border-bottom: 1px solid var(--border-color);
  display: grid; grid-template-columns: 1fr auto; gap: 8px;
  input { padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 10px; box-sizing: border-box; }
  button { padding: 10px 12px; border-radius: 10px; border: 1px solid #111; background: #111; color: #fff; cursor: pointer; }
`;
const List = styled.div`flex: 1; overflow: auto; padding: 8px; min-height: 0;`;
const Row = styled.button`
  width: 100%; text-align: left; border: none; background: transparent; padding: 10px 8px;
  border-radius: 10px; display: grid; grid-template-columns: 42px 1fr auto; gap: 10px; align-items: center; cursor: pointer;
  &:hover { background: #f3f4f6; }
  .avatar { width: 42px; height: 42px; border-radius: 50%; overflow: hidden; background: #fff; display: grid; place-items: center; }
  .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .avatarBtn { all: unset; width: 42px; height: 42px; display: grid; place-items: center; cursor: pointer; }
  .avatarBtn img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .nameLine { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .name { font-weight: 800; }
  .sub { font-size: 12px; color: #666; }
`;
const ThreadHeader = styled.div`
  padding: 10px 12px; border-bottom: 1px solid var(--border-color);
  display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center;
`;
const HeaderAvatarBtn = styled.button`
  border: none; background: transparent; padding: 0; width: 36px; height: 36px; border-radius: 50%;
  overflow: hidden; cursor: pointer; display:grid; place-items:center;
  img { width: 100%; height: 100%; object-fit: cover; display:block; }
`;
const HeaderTitleButton = styled.button`
  border: none; background: transparent; font-weight: 800; text-align: left; padding: 0; cursor: pointer;
  &:hover { text-decoration: underline; }
`;
const HeaderActions = styled.div` display: flex; align-items: center; gap: 8px; `;
const SmallBtn = styled.button`
  padding: 6px 10px; border-radius: 10px; border: 1px solid var(--border-color); background: #fff; cursor: pointer;
  &:hover { background:#f8fafc; }
`;
const Messages = styled.div`
  flex: 1; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; min-height: 0;
`;
const MsgRow = styled.div`
  display: flex; gap: 8px; align-items: flex-end;
  justify-content: ${p => (p.$mine ? 'flex-end' : 'flex-start')};
`;
const MsgAvatar = styled.div`
  width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: #eef2f7; flex: 0 0 auto;
  img { width: 100%; height: 100%; object-fit: cover; display: block; }
`;
const MsgHeader = styled.div`
  font-size: 12px; margin: 0 0 4px 0; color: #6b7280;
  display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;
`;
const Compose = styled.form`
  display: grid; grid-template-columns: auto 1fr auto; gap: 8px; padding: 10px; border-top: 1px solid var(--border-color);
  input[type="text"] { padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 10px; box-sizing: border-box; }
  button { padding: 10px 12px; border-radius: 10px; border: 1px solid #111; background: #111; color: #fff; }
`;
const AttachBtn = styled.label`
  padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border-color); background:#fff; color:#111; cursor:pointer;
  &:hover { background:#f8fafc; }
`;
const Hidden = styled.input` display:none; `;
const Mini = styled.div` font-size: 12px; color: #666; `;
const SelectedBar = styled.div`
  padding: 8px; border-bottom: 1px solid var(--border-color);
  display:flex; flex-wrap:wrap; gap:8px; align-items:center;
  input { padding: 8px 10px; border: 1px solid var(--border-color); border-radius: 10px; box-sizing: border-box; }
`;

/* modal */
const ModalBackdrop = styled.div`
  position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: grid; place-items: center; z-index: 50;
`;
const ModalCard = styled.div`
  width: 560px; max-width: calc(100vw - 40px);
  background: #fff; border-radius: 14px; border: 1px solid var(--border-color);
  box-shadow: 0 10px 30px rgba(0,0,0,0.25);
  overflow: hidden;
`;
const ModalHead = styled.div`
  padding: 12px 14px; border-bottom: 1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between;
  h3 { margin: 0; }
`;
const ModalBody = styled.div`
  padding: 12px 14px; max-height: 60vh; overflow-y: auto; overflow-x: hidden;
  input { width: 100%; box-sizing: border-box; }
`;
const ModalFoot = styled.div`
  padding: 12px 14px; border-top: 1px solid var(--border-color); display:flex; gap:8px; justify-content:flex-end;
`;

const FALLBACK_AVATAR = 'https://www.clipartmax.com/png/middle/72-721825_tuffy-tuffy-the-titan-csuf.png';

// Utility: always return a valid, absolute URL for media
const media = (url) => {
  if (!url) return '';
  try {
    // absolute?
    if (/^https?:\/\//i.test(url)) return url;
    return toMediaUrl(url); // prefix with API base if needed
  } catch {
    return url;
  }
};

const DMPage = () => {
  const { user } = useContext(AuthContext);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState({});
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [err, setErr] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const messagesRef = useRef(null);

  // group avatar modal state
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarForConv, setAvatarForConv] = useState(null);

  const isGroup = useMemo(() => active?.isGroup, [active]);

  // Lock the body scroll when the mobile dropdown is open
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isPhone = window.innerWidth < 768;
    if (isPhone) document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { if (isPhone) document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages]);

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
    } catch {}
  }, [participants]);

  const loadConversations = useCallback(async () => {
    if (!user?._id) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/messages/conversations/${user._id}`, { params: { userId: user._id } });
      setConversations(res.data || []);
      setErr('');
    } catch (e) {
      console.error(e);
      setErr('Failed to load conversations');
    }
  }, [user?._id]);

  const fetchConversationDetails = useCallback(async (convId) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/messages/conversation/${convId}`, { params: { userId: user._id } });
      const data = res.data || {};
      if (Array.isArray(data.participants) && data.participants.length) {
        await ensureUsers(data.participants);
        setActive(prev => prev && prev._id === convId
          ? { ...prev, participants: data.participants, title: data.name || prev.title, avatar: data.avatar || prev.avatar }
          : prev);
      }
    } catch {}
  }, [ensureUsers, user?._id]);

  const loadMessages = useCallback(async (convId) => {
    if (!user?._id || !convId) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/messages/${convId}`, { params: { userId: user._id } });
      setMessages(res.data || []);
      await axios.put(`${API_BASE_URL}/api/messages/${convId}/read`, { userId: user._id });
      await loadConversations();
      setErr('');
    } catch (e) {
      console.error(e);
      setErr('Failed to load messages');
    }
  }, [user?._id, loadConversations]);

  useEffect(() => {
    if (!user?._id) return;
    loadConversations();
    const t = setInterval(loadConversations, 15000);
    return () => clearInterval(t);
  }, [user?._id, loadConversations]);

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
    setParticipants(prev => ({ ...prev, [user._id]: { _id: user._id, username: user.username, profilePicture: user.profilePicture, badgesEquipped: user.badgesEquipped } }));
    if (Array.isArray(conv.participants) && conv.participants.length) {
      ensureUsers(conv.participants);
    } else if (conv.isGroup) {
      await fetchConversationDetails(conv._id);
    }
    await loadMessages(conv._id);

    // Collapse the left panel on small screens after selection
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileOpen(false);
    }
  };
  useEffect(() => {
    if (!messages.length) return;
    ensureUsers(messages.map(m => m.senderId));
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
    } catch (e) {
      console.error(e);
      alert('Failed to start conversation');
    }
  };

  const renameConversation = async (newName) => {
    if (!active?._id) return false;
    try {
      await axios.put(`${API_BASE_URL}/api/messages/conversation/${active._id}`, { name: newName, userId: user._id });
      await fetchConversationDetails(active._id);
      await loadConversations();
      setActive(prev => (prev ? { ...prev, title: newName } : prev));
      return true;
    } catch (e) {
      console.error('Rename failed', e);
      return false;
    }
  };

  // Upload helpers
  const uploadImage = async () => {
    if (!file) return null;
    const fd = new FormData(); fd.append('file', file);
    const res = await axios.post(`${API_BASE_URL}/api/uploads/image`, fd, {
      headers: { 'Content-Type': 'multipart/form-data', 'x-user-id': user._id }
    });
    return res.data;
  };
  const uploadImageFile = async (f) => {
    if (!f) return null;
    const fd = new FormData(); fd.append('file', f);
    const res = await axios.post(`${API_BASE_URL}/api/uploads/image`, fd, {
      headers: { 'Content-Type': 'multipart/form-data', 'x-user-id': user._id }
    });
    return res.data;
  };

  const updateGroupAvatar = async (convId, avatarUrl) => {
    // Try /:id/avatar first; fall back to /conversation/:id/avatar
    try {
      await axios.put(`${API_BASE_URL}/api/messages/${convId}/avatar`, { avatar: avatarUrl, userId: user._id });
    } catch {
      await axios.put(`${API_BASE_URL}/api/messages/conversation/${convId}/avatar`, { avatar: avatarUrl, userId: user._id });
    }
    await fetchConversationDetails(convId);
    await loadConversations();
    setActive(prev => (prev ? { ...prev, avatar: avatarUrl } : prev));
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

  // Search people (for New chat)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setSearchResults([]); return; }
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users/search`, {
          params: { q: q.trim(), userId: user._id }
        });
        setSearchResults(res.data || []);
      } catch (e) {
        console.error(e);
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, user._id]);

  const toggleSelectUser = (u) => {
    setSelectedUsers(prev => {
      const exists = prev.some(x => x._id === u._id);
      return exists ? prev.filter(x => x._id !== u._id) : [...prev, u];
    });
  };

  const handleStartClick = () => {
    if (selectedUsers.length === 0) {
      setSelecting(false);
      setQ(''); setSearchResults([]); setSelectedUsers([]); setGroupName('');
      return;
    }
    if (selectedUsers.length === 1) {
      createConversation([selectedUsers[0]._id]);
    } else {
      createConversation(selectedUsers.map(u => u._id), groupName || 'Group chat');
    }
  };

  const openAvatarModal = (conv) => {
    setAvatarForConv(conv);
    setAvatarFile(null);
    setAvatarPreview(conv?.avatar ? media(conv.avatar) : '');
    setShowAvatarModal(true);
  };

  const renderMessage = (m) => {
    const mine = m.senderId === user._id;
    const sender = mine
      ? { username: user.username, profilePicture: user.profilePicture }
      : (participants[m.senderId] || m.sender || {});
    const senderAvatar = (sender.profilePicture || (isGroup ? null : (active?.avatar && media(active.avatar))) || FALLBACK_AVATAR);
    const senderUsername = sender.username || m.senderUsername || m.username || 'Unknown';

    return (
      <MsgRow key={m._id} $mine={mine}>
        {!mine && (
          <MsgAvatar aria-hidden>
            <img src={senderAvatar} alt="" />
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
      <Title
        onClick={() => {
          if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setMobileOpen(prev => !prev);
          }
        }}
        data-chevron={mobileOpen ? '▴' : '▾'}
        aria-expanded={mobileOpen}
        aria-controls="dm-list"
      >
        Messages
      </Title>
      <Layout>
        <Left id="dm-list" $mobileOpen={mobileOpen}>
          <SearchBox>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={selecting ? 'Search people to add…' : 'Search people to DM…'}
            />
            {!selecting ? (
              <button onClick={() => setSelecting(true)} type="button">New chat</button>
            ) : (
              <button onClick={handleStartClick} type="button">Start</button>
            )}
          </SearchBox>

          {selecting && (
            <>
              <SelectedBar>
                {selectedUsers.map(u => (
                  <button
                    key={u._id}
                    onClick={() => toggleSelectUser(u)}
                    style={{
                      border: '1px solid var(--border-color)',
                      background: '#f3f4f6',
                      color: '#111',
                      padding: '4px 10px',
                      borderRadius: 999,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{display:'inline-flex', alignItems:'center', gap:8}}>
                      <img src={media(u.profilePicture) || FALLBACK_AVATAR} alt="" style={{width:20, height:20, borderRadius:'50%', objectFit:'cover'}} />
                      {u.username}
                    </span>
                    <span style={{fontWeight:800}}>×</span>
                  </button>
                ))}
                {selectedUsers.length >= 2 && (
                  <input
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    placeholder="Group name (optional)"
                  />
                )}
              </SelectedBar>

              <List>
                {!q.trim() && <Mini style={{ padding: 8 }}>Type to search for people…</Mini>}
                {q.trim() && searchResults.length === 0 && <Mini style={{ padding: 8 }}>No users found.</Mini>}
                {searchResults
                  .filter(u => String(u._id) !== String(user._id))
                  .map(r => {
                    const isSelected = selectedUsers.some(u => u._id === r._id);
                    return (
                      <Row
                        key={r._id}
                        onClick={() => toggleSelectUser(r)}
                        title={isSelected ? 'Remove' : 'Add'}
                      >
                        <div className="avatar">
                          <img src={media(r.profilePicture) || FALLBACK_AVATAR} alt={r.username} />
                        </div>
                        <div>
                          <div className="nameLine">
                            <div className="name">{r.username}</div>
                          </div>
                          {r.fullName && <div className="sub">{r.fullName}</div>}
                        </div>
                        <div>{isSelected ? '✓' : '+'}</div>
                      </Row>
                    );
                  })}
              </List>
            </>
          )}

          {!selecting && (
            <List>
              {err && <Mini style={{ padding: 8, color: '#b00020' }}>{err}</Mini>}
              {conversations.length === 0 && <Mini style={{ padding: 8 }}>No messages yet.</Mini>}
              {conversations.map(c => (
                <Row key={c._id} onClick={() => openConversation(c)}>
                  <div className="avatar">
                    {c.isGroup ? (
                      <button
                        className="avatarBtn"
                        title="Edit group photo"
                        onClick={(e) => { e.stopPropagation(); openAvatarModal(c); }}
                      >
                        {c.avatar
                          ? <img src={media(c.avatar)} alt={c.title} />
                          : <img src={FALLBACK_AVATAR} alt="" />}
                      </button>
                    ) : (
                      <>
                        {c.avatar
                          ? <img src={media(c.avatar)} alt={c.title} />
                          : <img src={FALLBACK_AVATAR} alt="" />}
                      </>
                    )}
                  </div>
                  <div>
                    <div className="nameLine">
                      <div className="name">{c.title}</div>
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
                <ThreadHeader>
                  {/* Avatar in header – click to edit */}
                  <HeaderAvatarBtn
                    title="Edit group photo"
                    onClick={() => openAvatarModal(active)}
                  >
                    {active.avatar
                      ? <img src={media(active.avatar)} alt={active.title || 'Group'} />
                      : <img src={FALLBACK_AVATAR} alt="" />}
                  </HeaderAvatarBtn>

                  <HeaderTitleButton onClick={() => setShowMembers(true)} title="Show members">
                    {active.title || 'Group chat'}
                  </HeaderTitleButton>

                  <HeaderActions>
                    <SmallBtn onClick={() => { setRenameValue(active.title || ''); setShowRename(true); }}>Rename</SmallBtn>
                  </HeaderActions>
                </ThreadHeader>
              ) : (
                <ThreadHeader>
                  <div />
                  <div style={{ fontWeight: 800 }}>
                    <UserLink username={active.title}>{active.title}</UserLink>
                  </div>
                  <div />
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

      {/* Edit group photo modal */}
      {showAvatarModal && (
        <ModalBackdrop onClick={() => setShowAvatarModal(false)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalHead>
              <h3>Edit group photo</h3>
              <SmallBtn onClick={() => setShowAvatarModal(false)}>Close</SmallBtn>
            </ModalHead>
            <ModalBody>
              {avatarPreview ? (
                <div style={{display:'grid', placeItems:'center', marginBottom:12}}>
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    style={{ width:140, height:140, borderRadius:'50%', objectFit:'cover', border:'1px solid var(--border-color)' }}
                  />
                </div>
              ) : (
                <Mini style={{marginBottom:12}}>No image selected.</Mini>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setAvatarFile(f || null);
                  setAvatarPreview(f ? URL.createObjectURL(f) : (avatarForConv?.avatar ? media(avatarForConv.avatar) : ''));
                }}
              />
            </ModalBody>
            <ModalFoot>
              <SmallBtn onClick={() => setShowAvatarModal(false)}>Cancel</SmallBtn>
              <SmallBtn
                onClick={async () => {
                  if (!avatarForConv) return;
                  if (!avatarFile && !avatarPreview) { setShowAvatarModal(false); return; }
                  let url = avatarPreview;
                  if (avatarFile) {
                    const uploaded = await uploadImageFile(avatarFile);
                    url = uploaded?.url ? media(uploaded.url) : url;
                  }
                  if (url) await updateGroupAvatar(avatarForConv._id, url);
                  setShowAvatarModal(false);
                }}
              >Save</SmallBtn>
            </ModalFoot>
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* Members modal */}
      {showMembers && (
        <ModalBackdrop onClick={() => setShowMembers(false)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalHead>
              <h3>Group members</h3>
              <SmallBtn onClick={() => setShowMembers(false)}>Close</SmallBtn>
            </ModalHead>
            <ModalBody>
              {(() => {
                const ids = (Array.isArray(active?.participants) && active.participants.length)
                  ? active.participants.map(x => String(x._id || x))
                  : Array.from(new Set([user?._id, ...messages.map(m => String(m.senderId))].filter(Boolean)));
                return ids.map(id => {
                  const u = participants[id] || {};
                  const avatar = media(u.profilePicture) || FALLBACK_AVATAR;
                  const badges = Array.isArray(u.badgesEquipped) ? u.badgesEquipped : [];
                  return (
                    <div key={id} style={{ display:'grid', gridTemplateColumns:'48px 1fr', gap:12, alignItems:'center', padding:'10px 0', borderBottom:'1px solid #f1f3f5' }}>
                      <img src={avatar} alt="" style={{ width:48, height:48, borderRadius:'50%', objectFit:'cover', border:'1px solid var(--border-color)' }} />
                      <div>
                        <div style={{ fontWeight:800 }}>{u.username || 'unknown'}</div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
                          {badges.map((b, i) => <span key={i} style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999, background:'#f3f4f6', border:'1px solid var(--border-color)' }}>{b}</span>)}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </ModalBody>
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* Rename modal */}
      {showRename && (
        <ModalBackdrop onClick={() => setShowRename(false)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalHead>
              <h3>Rename group</h3>
              <SmallBtn onClick={() => setShowRename(false)}>Close</SmallBtn>
            </ModalHead>
            <ModalBody>
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Group name"
                style={{
                  width:'100%',
                  boxSizing:'border-box',
                  padding:'10px 12px',
                  border:'1px solid var(--border-color)',
                  borderRadius:10
                }}
              />
              <Mini style={{ marginTop:8 }}>All members can rename the group.</Mini>
            </ModalBody>
            <ModalFoot>
              <SmallBtn onClick={() => setShowRename(false)}>Cancel</SmallBtn>
              <SmallBtn
                onClick={async () => {
                  const name = renameValue.trim() || 'Group chat';
                  await renameConversation(name);
                  setShowRename(false);
                }}
              >Save</SmallBtn>
            </ModalFoot>
          </ModalCard>
        </ModalBackdrop>
      )}
    </Page>
  );
};

export default DMPage;
