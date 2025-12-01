// client/src/pages/Clubs.js
import React, {
  useEffect,
  useMemo,
  useState,
  useContext,
  useCallback,
  useRef,
} from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';
import {
  FaCrown,
  FaSearch,
  FaUsers,
  FaPaperPlane,
  FaUserPlus,
  FaSignOutAlt,
  FaPlus,
  FaBullhorn,
  FaStore,
} from 'react-icons/fa';
import ClubPostCard from '../components/ClubPostCard';
import ClubComposer from '../components/ClubComposer';
import MemberDrawer from '../components/MemberDrawer';
import Marketplace from './Marketplace';

/* ---------- Layout shell ---------- */

const Shell = styled.div`
  width: 100%;
  margin: 0;
  padding: 8px 24px 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  /* Make the Clubs page slightly shorter than the viewport to avoid page scroll.
     80px ≈ height of the global top navbar + a bit of breathing room. */
  min-height: calc(100vh - 80px);

  @media (max-width: 900px) {
    padding: 8px 8px 72px; /* some space above bottom nav on mobile */
    min-height: calc(100vh - 80px);
  }
`;

const Subbar = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 10px;

  & > button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    background: rgba(255, 255, 255, 0.06);
    cursor: pointer;
    font-weight: 700;
    color: var(--text-color);
    white-space: nowrap;
  }
  & > button.active {
    border-color: transparent;
    background: linear-gradient(90deg, var(--primary-orange), #59d0ff);
    color: #000;
  }

  @media (max-width: 900px) {
    justify-content: center;
    flex-wrap: wrap;
  }
`;

/**
 * Page grid – columns adapt like Discord:
 * Clubs rail (narrow) | Channels (narrow) | Chat (fluid)
 */
const Page = styled.div`
  flex: 1;
  min-height: 0; /* needed so children with overflow can scroll */
  display: grid;
  gap: 12px;
  grid-template-columns: ${(p) => p.$cols};
  align-items: stretch;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Col = styled.div`
  background: var(--container-white);
  color: var(--text-color);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
`;

const Head = styled.div`
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: var(--text-color);
`;

const Body = styled.div`
  padding: 10px;
  min-height: 0;
  overflow-y: ${(p) => (p.$scroll ? 'auto' : 'visible')};
  flex: ${(p) => (p.$scroll ? 1 : 'initial')};
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px;
  border-radius: 8px;
  cursor: pointer;
  min-width: 0;
  &:hover {
    background: rgba(255, 255, 255, 0.06);
  }
`;

const Title = styled.div`
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Sub = styled.div`
  font-size: 12px;
  color: rgba(230, 233, 255, 0.65);
`;

const Btn = styled.button`
  padding: 7px 10px;
  border-radius: 10px;
  border: none;
  background: var(--primary-orange);
  color: #000;
  cursor: pointer;
  font-weight: 800;
  white-space: nowrap;
  &:hover {
    background: linear-gradient(90deg, var(--primary-orange), #59d0ff);
  }
`;

const Ghost = styled(Btn)`
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-color);
  border: 1px solid var(--border-color);
`;

/* ---------- Channel list (Discord-like) ---------- */

const ChannelList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
`;

const ChannelButton = styled.button`
  width: 100%;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid
    ${(p) => (p.$active ? 'transparent' : 'rgba(255, 255, 255, 0.12)')};
  background: ${(p) =>
    p.$active ? 'var(--primary-orange)' : 'rgba(255, 255, 255, 0.04)'};
  color: ${(p) => (p.$active ? '#000' : 'var(--text-color)')};
  text-align: left;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover {
    background: ${(p) =>
      p.$active ? 'var(--primary-orange)' : 'rgba(255, 255, 255, 0.07)'};
  }
`;

const ChannelHeader = styled.div`
  padding: 4px 10px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.7;
`;

/* ---------- Mobile-only channel chips ---------- */

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;

  @media (min-width: 901px) {
    display: none;
  }
`;

const Chip = styled.button`
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$active ? 'transparent' : 'var(--border-color)')};
  background: ${(p) =>
    p.$active ? 'var(--primary-orange)' : 'rgba(255, 255, 255, 0.06)'};
  color: ${(p) => (p.$active ? '#000' : 'var(--text-color)')};
  cursor: pointer;
`;

/* ---------- Responsive helpers ---------- */

const DesktopOnly = styled.div`
  @media (max-width: 900px) {
    display: none;
  }
`;

const MobileOnly = styled.div`
  display: none;
  @media (max-width: 900px) {
    display: block;
  }
`;

const MobileActions = styled.div`
  display: none;

  @media (max-width: 900px) {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-bottom: 6px;

    button {
      border: 1px solid var(--border-color);
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-color);
    }
    button:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }
`;

/* ---------- Drawers ---------- */

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 1600;
  opacity: ${(p) => (p.$open ? 1 : 0)};
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  transition: opacity 0.2s ease;
`;

const LeftDrawer = styled.aside`
  position: fixed;
  top: 0;
  left: 0;
  height: 100dvh;
  width: min(92vw, 360px);
  background: var(--container-white);
  color: var(--text-color);
  box-shadow: 2px 0 14px rgba(0, 0, 0, 0.25);
  z-index: 1601;
  transform: translateX(${(p) => (p.$open ? '0' : '-100%')});
  transition: transform 0.25s ease;
  display: flex;
  flex-direction: column;

  @media (max-width: 900px) {
    padding-bottom: 72px;
  }
`;

const RightDrawer = styled.aside`
  position: fixed;
  top: 0;
  right: 0;
  height: 100dvh;
  width: min(92vw, 420px);
  background: var(--container-white);
  color: var(--text-color);
  box-shadow: -2px 0 14px rgba(0, 0, 0, 0.25);
  z-index: 1601;
  transform: translateX(${(p) => (p.$open ? '0' : '100%')});
  transition: transform 0.25s ease;
  display: flex;
  flex-direction: column;

  @media (max-width: 900px) {
    padding-bottom: 72px;
  }
`;

const DrawerHead = styled.div`
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
`;

const DrawerBody = styled.div`
  padding: 10px;
  overflow: auto;
  min-height: 0;
  flex: 1;
`;

/* ---------- Events tab ---------- */

const ComposerBox = styled.div`
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px;
  background: rgba(15, 19, 41, 0.96);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.45);
  margin-bottom: 10px;
`;

const TA = styled.textarea`
  width: 100%;
  min-height: 70px;
  border: none;
  outline: none;
  resize: vertical;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--text-color);
  &::placeholder {
    color: rgba(230, 233, 255, 0.55);
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-color);
  &::placeholder {
    color: rgba(230, 233, 255, 0.55);
  }
`;

/* ---------- Discord-like chat area ---------- */

const ChatPane = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

const Messages = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  padding-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  > * {
    min-width: 0;
  }

  @media (max-width: 900px) {
    padding-bottom: 72px;
  }
`;

/* Themed, pinned composer. */
const ComposeBar = styled.div`
  position: sticky;
  bottom: 0;
  z-index: 6;
  border-top: 1px solid var(--border-color);
  background: rgba(15, 19, 41, 0.98);
  padding: 8px 12px;
  box-shadow: 0 -10px 24px rgba(0, 0, 0, 0.8);

  & textarea {
    min-height: 40px !important;
    max-height: 120px !important;
    resize: none;
  }
  & input[type='text'] {
    height: 40px;
  }

  & textarea,
  & input[type='text'] {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 10px;
    border: 1px solid var(--border-color);
    color: var(--text-color);
    padding: 10px 12px;
  }

  & ::placeholder {
    color: rgba(230, 233, 255, 0.55);
  }

  & button,
  & label[for*='photo'],
  & [data-btn] {
    border-radius: 10px;
    border: 1px solid var(--border-color);
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-color);
    font-weight: 700;
    cursor: pointer;
  }

  & button:hover,
  & label[for*='photo']:hover,
  & [data-btn]:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  & button[type='submit'],
  & button.post,
  & [data-btn='post'],
  & .post-btn {
    background: var(--primary-orange);
    color: #000;
    border-color: transparent;
  }

  & button.photo,
  & [data-btn='photo'],
  & .photo-btn,
  & label[for*='photo'] {
    background: rgba(139, 123, 255, 0.16);
    border-color: rgba(139, 123, 255, 0.6);
    color: var(--text-color);
  }
`;

const SearchRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  min-width: 0;

  input {
    min-width: 0;
  }
`;

/* ---------- Events panel ---------- */

function EventsPanel() {
  const { user } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const r = await axios.get(`${API_BASE_URL}/api/events`);
    setEvents(r.data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canPost = !!user?.isAdmin;

  const submit = async () => {
    if (!title.trim() || !text.trim()) return;
    setSending(true);
    try {
      await axios.post(`${API_BASE_URL}/api/events`, {
        authorId: user._id,
        title,
        text,
      });
      setTitle('');
      setText('');
      load();
    } finally {
      setSending(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    await axios.delete(`${API_BASE_URL}/api/events/${id}`, {
      data: { userId: user._id },
    });
    load();
  };

  return (
    <Col style={{ gridColumn: '1 / -1' }}>
      <Head>
        <FaBullhorn /> Events &amp; Announcements
      </Head>
      <Body $scroll>
        {canPost && (
          <ComposerBox>
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <TA
              placeholder="Share an update…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn onClick={submit} disabled={sending}>
                Post
              </Btn>
            </div>
          </ComposerBox>
        )}

        {events.map((ev) => (
          <div
            key={ev._id}
            style={{
              background: 'var(--container-white)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              padding: 10,
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>{ev.title}</div>
              <div
                style={{ marginLeft: 'auto', color: '#777', fontSize: 12 }}
              >
                {new Date(ev.createdAt).toLocaleString()}
              </div>
            </div>
            <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>
              {ev.text}
            </div>
            {canPost && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: 6,
                }}
              >
                <Ghost onClick={() => del(ev._id)}>Delete</Ghost>
              </div>
            )}
          </div>
        ))}
        {events.length === 0 && <Sub>No announcements yet.</Sub>}
      </Body>
    </Col>
  );
}

/* ---------- Main page ---------- */

export default function Clubs() {
  const { user } = useContext(AuthContext);

  const [tab, setTab] = useState('clubs');

  const [myClubs, setMyClubs] = useState([]);
  const [explore, setExplore] = useState([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [active, setActive] = useState({
    type: 'main',
    sideId: null,
    name: 'Main',
  });
  const [posts, setPosts] = useState([]);
  const [showMembers, setShowMembers] = useState(false);

  const photoInput = useRef(null);
  const scrollerRef = useRef(null); // chat scroller
  const initialClubLoadedRef = useRef(false);

  // drawers
  const [showLeft, setShowLeft] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const api = {
    clubs: `${API_BASE_URL}/api/clubs`,
    posts: `${API_BASE_URL}/api/club-posts`,
  };

  const refreshMine = useCallback(async () => {
    const res = await axios.get(`${api.clubs}/mine/${user._id}`);
    setMyClubs(res.data || []);
  }, [api.clubs, user._id]);

  const searchClubs = useCallback(async () => {
    const res = await axios.get(`${api.clubs}`, {
      params: { q, viewer: user._id },
    });
    setExplore(res.data || []);
  }, [api.clubs, q, user._id]);

  const loadClub = useCallback(
    async (clubId) => {
      const res = await axios.get(`${api.clubs}/${clubId}`);
      setShowAbout(false);
      setSelected(res.data);
      setActive({ type: 'main', sideId: null, name: 'Main' });
      setShowLeft(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastClubId', clubId);
      }
    },
    [api.clubs]
  );

  const loadPosts = useCallback(async () => {
    if (!selected) return;
    const params =
      active.type === 'main'
        ? { channel: 'main' }
        : { channel: 'side', sideId: active.sideId };
    params.viewerId = user._id;
    const res = await axios.get(`${api.posts}/${selected._id}`, { params });
    setPosts(res.data || []);
  }, [api.posts, selected, active.type, active.sideId, user._id]);

  useEffect(() => {
    refreshMine();
    searchClubs();
  }, [refreshMine, searchClubs]);

  // Once myClubs is loaded, auto-open the last club the user accessed
  useEffect(() => {
    if (initialClubLoadedRef.current) return;
    if (!myClubs || myClubs.length === 0) return;

    let lastId = null;
    if (typeof window !== 'undefined') {
      lastId = localStorage.getItem('lastClubId');
    }

    let toOpen = null;
    if (lastId && myClubs.some((c) => String(c._id) === String(lastId))) {
      toOpen = lastId;
    } else {
      toOpen = myClubs[0]._id;
    }

    initialClubLoadedRef.current = true;
    loadClub(toOpen);
  }, [myClubs, loadClub]);

  useEffect(() => {
    if (selected) {
      loadPosts();
    }
  }, [selected, loadPosts]);

  /* --- Discord semantics: oldest → newest, start scrolled to bottom --- */
  const postsChrono = useMemo(() => {
    const list = Array.isArray(posts) ? [...posts] : [];
    try {
      list.sort((a, b) => {
        const da = new Date(a.createdAt || 0).getTime();
        const db = new Date(b.createdAt || 0).getTime();
        return da - db;
      });
    } catch {}
    return list;
  }, [posts]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  useEffect(() => {
    const t = requestAnimationFrame(() => scrollToBottom(false));
    return () => cancelAnimationFrame(t);
  }, [scrollToBottom, selected?._id, active.type, active.sideId, postsChrono.length]);

  const isMember = useMemo(
    () =>
      selected &&
      (selected.members || []).map(String).includes(String(user._id)),
    [selected, user._id]
  );

  const amPresident = useMemo(
    () => selected && String(selected.president) === String(user._id),
    [selected, user._id]
  );

  const createClub = async () => {
    const name = prompt('Club name? (unique)');
    if (!name) return;
    const description = prompt('Short description (optional)') || '';
    const res = await axios.post(api.clubs, {
      userId: user._id,
      name,
      description,
    });
    setSelected(res.data);
    setShowAbout(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastClubId', res.data._id);
    }
    refreshMine();
    searchClubs();
  };

  const join = async (clubId) => {
    await axios.put(`${api.clubs}/${clubId}/join`, { userId: user._id });
    await loadClub(clubId);
    refreshMine();
    searchClubs();
  };

  const leave = async (clubId) => {
    if (!window.confirm('Leave this club?')) return;
    await axios.put(`${api.clubs}/${clubId}/leave`, { userId: user._id });
    setSelected(null);
    setShowAbout(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lastClubId');
    }
    refreshMine();
    searchClubs();
  };

  const newSideChannel = async () => {
    const name = prompt('Side channel name?');
    if (!name) return;
    await axios.post(`${api.clubs}/${selected._id}/side-channels`, {
      actorId: user._id,
      name,
    });
    await loadClub(selected._id);
  };

  const choosePhoto = () => photoInput.current?.click();

  const onPhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    const toDataUrl = (f) =>
      new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(f);
      });
    const dataUrl = await toDataUrl(file);
    await axios.put(`${api.clubs}/${selected._id}/photo`, {
      actorId: user._id,
      dataUrl,
    });
    await loadClub(selected._id);
    refreshMine();
    searchClubs();
  };

  /* ---------- Desktop columns (Discord-like widths) ---------- */
  let cols;
  if (!selected) {
    cols = '240px minmax(0, 1fr)';
  } else {
    cols = '220px 200px minmax(0, 1fr)'; // Clubs | Channels | Chat
  }

  return (
    <Shell>
      {/* Sub-tabs */}
      <Subbar>
        <button
          className={tab === 'clubs' ? 'active' : ''}
          onClick={() => setTab('clubs')}
        >
          <FaUsers /> Clubs
        </button>
        <button
          className={tab === 'events' ? 'active' : ''}
          onClick={() => setTab('events')}
        >
          <FaBullhorn /> Events
        </button>
        <button
          className={tab === 'market' ? 'active' : ''}
          onClick={() => setTab('market')}
        >
          <FaStore /> Marketplace
        </button>
      </Subbar>

      {/* Mobile quick actions */}
      {tab === 'clubs' && (
        <MobileOnly>
          <MobileActions>
            <Ghost onClick={() => setShowLeft(true)}>
              <FaUsers /> My Clubs
            </Ghost>
            <Ghost onClick={() => setShowAbout(true)} disabled={!selected}>
              About
            </Ghost>
            <Ghost onClick={() => setShowMembers(true)} disabled={!selected}>
              Members
            </Ghost>
          </MobileActions>
        </MobileOnly>
      )}

      {/* Clubs tab */}
      {tab === 'clubs' && (
        <Page $cols={cols}>
          {/* LEFT: My Clubs + Explore (desktop) */}
          <DesktopOnly>
            <Col>
              <Head>
                <FaUsers /> My Clubs
              </Head>
              <Body $scroll>
                {myClubs.length === 0 && (
                  <Sub>You haven’t joined any clubs yet.</Sub>
                )}
                {myClubs.map((c) => (
                  <Row key={c._id} onClick={() => loadClub(c._id)}>
                    <div
                      style={{
                        fontSize: 12,
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.06)',
                        display: 'grid',
                        placeItems: 'center',
                        overflow: 'hidden',
                        flex: '0 0 auto',
                      }}
                    >
                      {c.profilePicture ? (
                        <img
                          src={c.profilePicture}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        c.name[0]?.toUpperCase()
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Title>{c.name}</Title>
                      <Sub>{(c.members || []).length} members</Sub>
                    </div>
                    {String(c.president) === String(user._id) && (
                      <FaCrown title="President" color="#d4a417" />
                    )}
                  </Row>
                ))}

                <div style={{ marginTop: 8, marginBottom: 12 }}>
                  <Btn onClick={createClub}>
                    <FaPaperPlane style={{ marginRight: 6 }} /> Create a Club
                  </Btn>
                </div>

                {/* Explore */}
                <div
                  style={{
                    marginTop: 4,
                    paddingTop: 8,
                    borderTop: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <FaSearch />
                    <span style={{ fontWeight: 700 }}>Explore</span>
                  </div>
                  <SearchRow>
                    <input
                      placeholder="Search clubs…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchClubs()}
                      style={{
                        padding: 7,
                        border: '1px solid #eee',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.03)',
                        color: 'var(--text-color)',
                      }}
                    />
                    <Ghost onClick={searchClubs}>Search</Ghost>
                  </SearchRow>
                  <div style={{ marginTop: 6 }}>
                    {explore.map((c) => (
                      <Row key={c._id} onClick={() => loadClub(c._id)}>
                        <div
                          style={{
                            fontSize: 12,
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: 'rgba(255, 255, 255, 0.06)',
                            display: 'grid',
                            placeItems: 'center',
                            overflow: 'hidden',
                            flex: '0 0 auto',
                          }}
                        >
                          {c.profilePicture ? (
                            <img
                              src={c.profilePicture}
                              alt=""
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            c.name[0]?.toUpperCase()
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Title>{c.name}</Title>
                          <Sub>{c.membersCount} members</Sub>
                        </div>
                        {!c.isMember && (
                          <Ghost
                            onClick={(e) => {
                              e.stopPropagation();
                              join(c._id);
                            }}
                          >
                            <FaUserPlus /> Join
                          </Ghost>
                        )}
                      </Row>
                    ))}
                  </div>
                </div>
              </Body>
            </Col>
          </DesktopOnly>

          {/* MIDDLE: Channels (desktop) */}
          {selected && (
            <DesktopOnly>
              <Col>
                <Head>Channels</Head>
                <>
                  <ChannelList>
                    <ChannelHeader>Text Channels</ChannelHeader>
                    <ChannelButton
                      $active={active.type === 'main'}
                      onClick={() =>
                        setActive({
                          type: 'main',
                          sideId: null,
                          name: 'Main',
                        })
                      }
                    >
                      # Main
                    </ChannelButton>
                    {(selected.sideChannels || []).map((sc) => (
                      <ChannelButton
                        key={sc._id}
                        $active={
                          active.type === 'side' &&
                          String(active.sideId) === String(sc._id)
                        }
                        onClick={() =>
                          setActive({
                            type: 'side',
                            sideId: sc._id,
                            name: sc.name,
                          })
                        }
                      >
                        # {sc.name}
                      </ChannelButton>
                    ))}
                  </ChannelList>
                  {amPresident && (
                    <div
                      style={{
                        padding: '8px 10px 10px',
                        borderTop: '1px solid var(--border-color)',
                      }}
                    >
                      <Ghost
                        style={{ width: '100%' }}
                        onClick={newSideChannel}
                      >
                        <FaPlus /> New channel
                      </Ghost>
                    </div>
                  )}
                </>
              </Col>
            </DesktopOnly>
          )}

          {/* RIGHT: Chat */}
          <Col>
            {!selected ? (
              <Body $scroll>
                <Sub>Select a club to view its feeds.</Sub>
              </Body>
            ) : (
              <>
                <Head>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      onClick={amPresident ? choosePhoto : undefined}
                      title={amPresident ? 'Change club photo' : ''}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: '#f2f2f2',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: amPresident ? 'pointer' : 'default',
                      }}
                    >
                      {selected.profilePicture ? (
                        <img
                          src={selected.profilePicture}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <span style={{ fontWeight: 700 }}>
                          {selected.name[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700 }}>{selected.name}</div>
                    {amPresident && (
                      <FaCrown
                        title="You are the President"
                        color="#d4a417"
                        style={{ marginLeft: 6 }}
                      />
                    )}
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    {!isMember ? (
                      <Btn onClick={() => join(selected._id)}>Join</Btn>
                    ) : (
                      <Ghost onClick={() => leave(selected._id)}>
                        <FaSignOutAlt /> Leave
                      </Ghost>
                    )}
                    <Ghost onClick={() => setShowMembers(true)}>Members</Ghost>
                    <Ghost onClick={() => setShowAbout(true)}>About</Ghost>
                  </div>
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/*"
                    onChange={onPhotoSelected}
                    style={{ display: 'none' }}
                  />
                </Head>

                {/* Mobile: channel chips */}
                <Chips>
                  <Chip
                    $active={active.type === 'main'}
                    onClick={() =>
                      setActive({
                        type: 'main',
                        sideId: null,
                        name: 'Main',
                      })
                    }
                  >
                    Main
                  </Chip>
                  {(selected.sideChannels || []).map((sc) => (
                    <Chip
                      key={sc._id}
                      $active={
                        active.type === 'side' &&
                        String(active.sideId) === String(sc._id)
                      }
                      onClick={() =>
                        setActive({
                          type: 'side',
                          sideId: sc._id,
                          name: sc.name,
                        })
                      }
                    >
                      {sc.name}
                    </Chip>
                  ))}
                  {amPresident && (
                    <Ghost
                      style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
                      onClick={newSideChannel}
                    >
                      <FaPlus /> New
                    </Ghost>
                  )}
                </Chips>

                {/* Chat pane */}
                <ChatPane>
                  <Messages ref={scrollerRef}>
                    {postsChrono.length === 0 && <Sub>No posts yet.</Sub>}
                    {postsChrono.map((p) => (
                      <div key={p._id}>
                        <ClubPostCard post={p} refresh={loadPosts} />
                      </div>
                    ))}
                  </Messages>

                  <ComposeBar>
                    {isMember ? (
                      <ClubComposer
                        club={selected}
                        channel={active.type}
                        sideChannelId={
                          active.type === 'side' ? active.sideId : null
                        }
                        onPosted={() => {
                          loadPosts();
                          setTimeout(() => scrollToBottom(true), 0);
                        }}
                      />
                    ) : (
                      <Sub>Join this club to post and comment.</Sub>
                    )}
                  </ComposeBar>
                </ChatPane>
              </>
            )}
          </Col>

          {/* Members Drawer */}
          {selected && showMembers && (
            <MemberDrawer
              club={selected}
              me={user}
              onClose={async () => {
                setShowMembers(false);
                await loadClub(selected._id);
              }}
            />
          )}
        </Page>
      )}

      {/* Events tab */}
      {tab === 'events' && <EventsPanel />}

      {/* Marketplace tab */}
      {tab === 'market' && (
        <div style={{ background: 'transparent', flex: 1, minHeight: 0 }}>
          <Marketplace embedded />
        </div>
      )}

      {/* Mobile left drawer */}
      <MobileOnly>
        <Backdrop $open={showLeft} onClick={() => setShowLeft(false)} />
        <LeftDrawer $open={showLeft}>
          <DrawerHead>
            <FaUsers /> My Clubs
            <span
              style={{ marginLeft: 'auto', cursor: 'pointer' }}
              onClick={() => setShowLeft(false)}
            >
              ×
            </span>
          </DrawerHead>
          <DrawerBody>
            {myClubs.length === 0 && (
              <Sub>You haven’t joined any clubs yet.</Sub>
            )}
            {myClubs.map((c) => (
              <Row key={c._id} onClick={() => loadClub(c._id)}>
                <div
                  style={{
                    fontSize: 12,
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.06)',
                    display: 'grid',
                    placeItems: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {c.profilePicture ? (
                    <img
                      src={c.profilePicture}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    c.name[0]?.toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <Title>{c.name}</Title>
                  <Sub>{(c.members || []).length} members</Sub>
                </div>
                {String(c.president) === String(user._id) && (
                  <FaCrown title="President" color="#d4a417" />
                )}
              </Row>
            ))}

            <div style={{ marginTop: 8 }}>
              <Btn onClick={createClub}>
                <FaPaperPlane style={{ marginRight: 6 }} /> Create a Club
              </Btn>
            </div>

            <div
              style={{
                marginTop: 12,
                paddingTop: 8,
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <FaSearch />
                <span style={{ fontWeight: 700 }}>Explore</span>
              </div>
              <SearchRow>
                <input
                  placeholder="Search clubs…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchClubs()}
                  style={{
                    padding: 7,
                    border: '1px solid #eee',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)',
                    color: 'var(--text-color)',
                  }}
                />
                <Ghost onClick={searchClubs}>Search</Ghost>
              </SearchRow>
              <div style={{ marginTop: 6 }}>
                {explore.map((c) => (
                  <Row key={c._id} onClick={() => loadClub(c._id)}>
                    <div
                      style={{
                        fontSize: 12,
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.06)',
                        display: 'grid',
                        placeItems: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {c.profilePicture ? (
                        <img
                          src={c.profilePicture}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        c.name[0]?.toUpperCase()
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Title>{c.name}</Title>
                      <Sub>{c.membersCount} members</Sub>
                    </div>
                    {!c.isMember && (
                      <Ghost
                        onClick={(e) => {
                          e.stopPropagation();
                          join(c._id);
                        }}
                      >
                        <FaUserPlus /> Join
                      </Ghost>
                    )}
                  </Row>
                ))}
              </div>
            </div>
          </DrawerBody>
        </LeftDrawer>
      </MobileOnly>

      {/* About drawer */}
      <Backdrop $open={showAbout} onClick={() => setShowAbout(false)} />
      <RightDrawer $open={showAbout}>
        <DrawerHead>
          About
          <span
            style={{ marginLeft: 'auto', cursor: 'pointer' }}
            onClick={() => setShowAbout(false)}
          >
            ×
          </span>
        </DrawerHead>
        <DrawerBody>
          {!selected ? (
            <Sub>
              Tips: Create channels for different teams (e.g., “Recruitment”,
              “Events”). Each channel can have a Director.
            </Sub>
          ) : (
            <>
              <div style={{ marginBottom: 8 }}>
                {selected.description || 'No description yet.'}
              </div>
              <div>
                <b>Members:</b> {(selected.members || []).length}
              </div>
              <div>
                <b>Channels:</b> {(selected.sideChannels || []).length} side
              </div>
            </>
          )}
        </DrawerBody>
      </RightDrawer>
    </Shell>
  );
}
