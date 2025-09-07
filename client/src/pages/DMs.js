import React, { useEffect, useMemo, useState, useContext } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../App';

const Page = styled.div`
  max-width: 980px;
  margin: 0 auto;
  padding: 16px;
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  min-height: calc(100vh - 120px);
`;

const Left = styled.div`
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Right = styled.div`
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SearchBox = styled.div`
  padding: 8px;
  border-bottom: 1px solid #eee;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  input {
    padding: 10px 12px;
    border: 1px solid #e3e3e3;
    border-radius: 10px;
  }
  button {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #111;
    background: #111;
    color: #fff;
    cursor: pointer;
  }
`;

const List = styled.div`
  overflow: auto;
  padding: 8px;
`;

const Row = styled.button`
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 10px 8px;
  border-radius: 10px;
  display: grid;
  grid-template-columns: 42px 1fr auto;
  gap: 10px;
  align-items: center;
  cursor: pointer;
  &:hover { background: #f7f7f7; }

  .avatar { width: 42px; height: 42px; border-radius: 50%; overflow: hidden; background: #f0f0f0; display: grid; place-items: center; }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .name { font-weight: 700; }
  .sub { font-size: 12px; color: #666; }
`;

const ThreadHeader = styled.div`
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
  font-weight: 700;
`;

const Messages = styled.div`
  flex: 1;
  overflow: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Bubble = styled.div`
  max-width: 70%;
  align-self: ${p => (p.$mine ? 'flex-end' : 'flex-start')};
  background: ${p => (p.$mine ? '#111' : '#f1f3f5')};
  color: ${p => (p.$mine ? '#fff' : '#111')};
  padding: 10px 12px;
  border-radius: 12px;
`;

const Compose = styled.form`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid #eee;
  input {
    padding: 10px 12px;
    border: 1px solid #e3e3e3;
    border-radius: 10px;
  }
  button {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #111;
    background: #111;
    color: #fff;
  }
`;

const Mini = styled.div`
  font-size: 12px;
  color: #666;
`;

const DMPage = () => {
  const { user } = useContext(AuthContext);
  const [q, setQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);       // conversation object
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]); // for group creation
  const [groupName, setGroupName] = useState('');

  const isGroup = useMemo(() => active?.isGroup, [active]);

  // Load conversations
  const loadConversations = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/messages/conversations/${user._id}`);
      setConversations(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Load messages for active conv
  const loadMessages = async (convId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/messages/${convId}`);
      setMessages(res.data || []);
      // mark read
      await axios.put(`http://localhost:5000/api/messages/${convId}/read`, { userId: user._id });
      // refresh counts
      await loadConversations();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Debounced user search (for new DM / add to group)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setSearchResults([]); return; }
      try {
        const res = await axios.get(`http://localhost:5000/api/users/search?q=${encodeURIComponent(q)}&userId=${user._id}`);
        setSearchResults(res.data || []);
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, user._id]);

  const openConversation = async (conv) => {
    setActive(conv);
    await loadMessages(conv._id);
  };

  const createConversation = async (participantIds, name) => {
    try {
      const res = await axios.post(`http://localhost:5000/api/messages/conversation`, {
        creatorId: user._id,
        participants: participantIds,
        name: name || null
      });
      await loadConversations();
      await openConversation(res.data);
      setSelecting(false);
      setSelectedUsers([]);
      setGroupName('');
      setQ('');
      setSearchResults([]);
    } catch (e) {
      console.error(e);
      alert('Failed to start conversation');
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    try {
      const res = await axios.post(`http://localhost:5000/api/messages/${active._id}`, {
        senderId: user._id,
        body: text.trim()
      });
      setMessages(m => [...m, res.data]);
      setText('');
      await loadConversations();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSelect = (u) => {
    setSelectedUsers(prev => {
      const has = prev.find(x => x._id === u._id);
      return has ? prev.filter(x => x._id !== u._id) : [...prev, u];
    });
  };

  return (
    <Page>
      <h2>Messages</h2>
      <Layout>
        <Left>
          <SearchBox>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={selecting ? 'Search people to add…' : 'Search people to DM…'}
            />
            {!selecting ? (
              <button onClick={() => setSelecting(true)} type="button">New chat</button>
            ) : (
              <button
                onClick={() => {
                  if (selectedUsers.length === 1) {
                    createConversation([selectedUsers[0]._id]); // DM
                  } else if (selectedUsers.length >= 2) {
                    createConversation(selectedUsers.map(u => u._id), groupName || 'Group chat');
                  } else {
                    setSelecting(false);
                  }
                }}
                type="button"
              >
                Start
              </button>
            )}
          </SearchBox>

          {selecting && (
            <div style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
              {selectedUsers.length >= 2 && (
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Group name (optional)"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e3e3e3', borderRadius: 8, marginBottom: 8 }}
                />
              )}
              <Mini>
                {selectedUsers.length === 0 ? 'Pick one or more people.' :
                 selectedUsers.length === 1 ? `DM with ${selectedUsers[0].username}` :
                 `${selectedUsers.length} people selected`}
              </Mini>
            </div>
          )}

          {selecting && (
            <List>
              {searchResults.map(u => (
                <Row key={u._id} onClick={() => toggleSelect(u)}>
                  <div className="avatar">{u.profilePicture ? <img src={u.profilePicture} alt={u.username} /> : <span>{u.username?.[0]?.toUpperCase() || '?'}</span>}</div>
                  <div>
                    <div className="name">{u.username}</div>
                    <div className="sub">{u.department || ''}</div>
                  </div>
                  <div>{selectedUsers.some(x => x._id === u._id) ? '✓' : ''}</div>
                </Row>
              ))}
            </List>
          )}

          {!selecting && (
            <List>
              {conversations.length === 0 && <Mini style={{ padding: 8 }}>No messages yet.</Mini>}
              {conversations.map(c => (
                <Row key={c._id} onClick={() => openConversation(c)}>
                  <div className="avatar">
                    {c.avatar ? <img src={c.avatar} alt={c.title} /> : <span>{c.title?.[0]?.toUpperCase() || '?'}</span>}
                  </div>
                  <div>
                    <div className="name">{c.title}</div>
                    <div className="sub">{c.last?.body || 'No messages yet'}</div>
                  </div>
                  <div>{c.unread > 0 ? <span style={{ background:'#e02424', color:'#fff', borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{c.unread}</span> : null}</div>
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
              <ThreadHeader>{active.title}</ThreadHeader>
              <Messages>
                {messages.map(m => (
                  <Bubble key={m._id} $mine={m.senderId === user._id}>
                    {m.body}
                    <div style={{ fontSize: 10, opacity: .7, marginTop: 4 }}>
                      {new Date(m.createdAt).toLocaleString()}
                    </div>
                  </Bubble>
                ))}
              </Messages>
              <Compose onSubmit={handleSend}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" />
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
