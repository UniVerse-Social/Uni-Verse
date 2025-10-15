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

// ---------- layout ----------
const Shell = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  /* Desktop: lock to viewport height so inner panels can scroll */
  height: calc(105vh - 101px);
  padding-bottom: 70px;

  @media (max-width: 900px) {
    /* Keep your mobile behavior */
    height: calc(100vh - 101px);
    overflow-x: hidden;
  }
`;

const Subbar = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 12px;

  & > button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid #e5e5e5;
    background: #fff;
    cursor: pointer;
    font-weight: 700;
  }
  & > button.active {
    border-color: #111;
    background: #111;
    color: #fff;
  }

  /* center the 3 buttons on smaller screens */
  @media (max-width: 900px) {
    justify-content: center;
    flex-wrap: wrap;
  }
`;

const Page = styled.div`
  display:grid; gap:16px; grid-template-columns: 280px 1fr 320px;
  flex:1; overflow:hidden;     /* grid never exceeds viewport */

  @media (max-width: 1024px) {
    grid-template-columns: 240px 1fr 300px;
  }
  @media (max-width: 900px) {
    grid-template-columns: 1fr; /* phones keep single column */
    overflow: hidden;           /* keep existing mobile behavior */
  }
`;

const Col = styled.div`
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
`;

const Head = styled.div`
  padding: 12px 14px;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
`;

const Body = styled.div`
  padding: 12px;
  min-height: 0;
  /* Scroll only where we ask for it; keeps rounded corners on the Col */
  overflow: ${(p) => (p.$scroll ? 'auto' : 'visible')};
  flex: ${(p) => (p.$scroll ? 1 : 'initial')};
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  &:hover {
    background: #f7f7f7;
  }
`;
const Title = styled.div`font-weight:700;`;
const Sub = styled.div`font-size:12px; color:#666;`;
const Btn = styled.button`
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #111;
  background: #111;
  color: #fff;
  cursor: pointer;
`;
const Ghost = styled(Btn)`background:#fff; color:#111;`;
const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid #eee;
  overflow-x: auto;
`;
const Chip = styled.button`
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$active ? '#111' : '#e5e5e5')};
  background: ${(p) => (p.$active ? '#111' : '#fff')};
  color: ${(p) => (p.$active ? '#fff' : '#111')};
  cursor: pointer;
`;

/* ---------- Mobile helpers (no desktop changes) ---------- */
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
    margin-bottom: 8px;

    button {
      border: 1px solid #111;
      background: #fff;
      color: #111;
    }
  }
`;

/* Slide-in drawers for mobile */
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
  height: 100vh;
  width: min(92vw, 360px);
  background: #fff;
  box-shadow: 2px 0 14px rgba(0, 0, 0, 0.25);
  z-index: 1601;
  transform: translateX(${(p) => (p.$open ? '0' : '-100%')});
  transition: transform 0.25s ease;
  display: flex;
  flex-direction: column;
`;
const RightDrawer = styled.aside`
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: min(92vw, 420px);
  background: #fff;
  box-shadow: -2px 0 14px rgba(0, 0, 0, 0.25);
  z-index: 1601;
  transform: translateX(${(p) => (p.$open ? '0' : '100%')});
  transition: transform 0.25s ease;
  display: flex;
  flex-direction: column;
`;
const DrawerHead = styled.div`
  padding: 12px 14px;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
`;
const DrawerBody = styled.div`
  padding: 12px;
  overflow: auto;
  min-height: 0;
  flex: 1;
`;

/* ---------- Events tab components (unchanged) ---------- */
const ComposerBox = styled.div`
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 10px;
  background: #fafafa;
  margin-bottom: 12px;
`;
const TA = styled.textarea`
  width: 100%;
  min-height: 70px;
  border: none;
  outline: none;
  resize: vertical;
  background: transparent;
`;
const Input = styled.input`
  width: 100%;
  padding: 8px;
  border: 1px solid #eee;
  border-radius: 8px;
  margin-bottom: 8px;
`;

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
    <Col style={{ gridColumn: '1 / span 3' }}>
      <Head>
        <FaBullhorn /> Events & Announcements
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
              background: '#fff',
              border: '1px solid #eee',
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
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
            <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{ev.text}</div>
            {canPost && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
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

export default function Clubs() {
  const { user } = useContext(AuthContext);

  // tabs
  const [tab, setTab] = useState('clubs');

  // ------- existing Clubs state & logic -------
  const [myClubs, setMyClubs] = useState([]);
  const [explore, setExplore] = useState([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [active, setActive] = useState({ type: 'main', sideId: null, name: 'Main' });
  const [posts, setPosts] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const photoInput = useRef(null);

  // NEW: mobile drawers
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
      setSelected(res.data);
      setActive({ type: 'main', sideId: null, name: 'Main' });
      setShowLeft(false); // close left drawer after choosing
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

  useEffect(() => {
    if (selected) {
      loadPosts();
    }
  }, [selected, loadPosts]);

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

  // ---------- render ----------
  return (
    <Shell>
      {/* Sub-Navbar */}
      <Subbar>
        <button className={tab === 'clubs' ? 'active' : ''} onClick={() => setTab('clubs')}>
          <FaUsers /> Clubs
        </button>
        <button className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>
          <FaBullhorn /> Events
        </button>
        <button className={tab === 'market' ? 'active' : ''} onClick={() => setTab('market')}>
          <FaStore /> Marketplace
        </button>
      </Subbar>

      {/* Mobile quick actions (centered) */}
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

      {/* Tab: Clubs */}
      {tab === 'clubs' && (
        <Page>
          {/* Left: My Clubs & Explore (desktop only) */}
          <DesktopOnly>
            <Col>
              <Head>
                <FaUsers /> My Clubs
              </Head>
              <Body $scroll>
                {myClubs.length === 0 && <Sub>You haven’t joined any clubs yet.</Sub>}
                {myClubs.map((c) => (
                  <Row key={c._id} onClick={() => loadClub(c._id)}>
                    <div
                      style={{
                        fontSize: 12,
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: '#f3f3f3',
                        display: 'grid',
                        placeItems: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {c.profilePicture ? (
                        <img
                          src={c.profilePicture}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
              </Body>
              <Body>
                <Btn onClick={createClub}>
                  <FaPaperPlane style={{ marginRight: 6 }} /> Create a Club
                </Btn>
              </Body>

              <Head>
                <FaSearch /> Explore
              </Head>
              <Body $scroll>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ flex: 1, padding: 8, border: '1px solid #eee', borderRadius: 8 }}
                    placeholder="Search clubs…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchClubs()}
                  />
                  <Ghost onClick={searchClubs}>Search</Ghost>
                </div>
                <div style={{ marginTop: 8 }}>
                  {explore.map((c) => (
                    <Row key={c._id} onClick={() => loadClub(c._id)}>
                      <div
                        style={{
                          fontSize: 12,
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: '#f3f3f3',
                          display: 'grid',
                          placeItems: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {c.profilePicture ? (
                          <img
                            src={c.profilePicture}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
              </Body>
            </Col>
          </DesktopOnly>

          {/* Middle: Club view */}
          <Col style={{ gridColumn: 'span 1' }}>
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
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
                    <Ghost className="mobile-only" onClick={() => setShowAbout(true)}>
                      About
                    </Ghost>
                  </div>
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/*"
                    onChange={onPhotoSelected}
                    style={{ display: 'none' }}
                  />
                </Head>

                <Chips>
                  <Chip
                    $active={active.type === 'main'}
                    onClick={() => setActive({ type: 'main', sideId: null, name: 'Main' })}
                  >
                    Main
                  </Chip>
                  {(selected.sideChannels || []).map((sc) => (
                    <Chip
                      key={sc._id}
                      $active={active.type === 'side' && String(active.sideId) === String(sc._id)}
                      onClick={() => setActive({ type: 'side', sideId: sc._id, name: sc.name })}
                    >
                      {sc.name}
                    </Chip>
                  ))}
                  {amPresident && (
                    <Ghost style={{ marginLeft: 'auto' }} onClick={newSideChannel}>
                      <FaPlus /> New channel
                    </Ghost>
                  )}
                </Chips>

                <Body $scroll>
                  {isMember && (
                    <ClubComposer
                      club={selected}
                      channel={active.type}
                      sideChannelId={active.type === 'side' ? active.sideId : null}
                      onPosted={loadPosts}
                    />
                  )}
                  {!isMember && <Sub>Join this club to post and comment.</Sub>}

                  <div style={{ marginTop: 12 }}>
                    {posts.map((p) => (
                      <ClubPostCard key={p._id} post={p} refresh={loadPosts} />
                    ))}
                    {posts.length === 0 && <Sub>No posts yet.</Sub>}
                  </div>
                </Body>
              </>
            )}
          </Col>

          {/* Right: About (desktop only; hidden on phones) */}
          <DesktopOnly>
            <Col>
              {!selected ? (
                <Body $scroll>
                  <Sub>
                    Tips: Create channels for different teams (e.g., “Recruitment”, “Events”). Each
                    channel can have a Director.
                  </Sub>
                </Body>
              ) : (
                <>
                  <Head>About</Head>
                  <Body $scroll>
                    <div style={{ marginBottom: 8 }}>
                      {selected.description || 'No description yet.'}
                    </div>
                    <div>
                      <b>Members:</b> {(selected.members || []).length}
                    </div>
                    <div>
                      <b>Channels:</b> {(selected.sideChannels || []).length} side
                    </div>
                  </Body>
                </>
              )}
            </Col>
          </DesktopOnly>

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

      {/* Tab: Events */}
      {tab === 'events' && <EventsPanel />}

      {/* Tab: Marketplace (reuses existing page component) */}
      {tab === 'market' && (
        <div style={{ background: 'transparent' }}>
          <Marketplace embedded />
        </div>
      )}

      {/* --- Mobile Drawers --- */}
      {/* Left drawer: My Clubs + Explore */}
      <Backdrop $open={showLeft} onClick={() => setShowLeft(false)} />
      <LeftDrawer $open={showLeft}>
        <DrawerHead>
          <FaUsers /> My Clubs
          <span style={{ marginLeft: 'auto', cursor: 'pointer' }} onClick={() => setShowLeft(false)}>
            ×
          </span>
        </DrawerHead>
        <DrawerBody>
          {myClubs.length === 0 && <Sub>You haven’t joined any clubs yet.</Sub>}
          {myClubs.map((c) => (
            <Row key={c._id} onClick={() => loadClub(c._id)}>
              <div
                style={{
                  fontSize: 12,
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: '#f3f3f3',
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                }}
              >
                {c.profilePicture ? (
                  <img
                    src={c.profilePicture}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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

          <div style={{ marginTop: 10 }}>
            <Btn onClick={createClub}>
              <FaPaperPlane style={{ marginRight: 6 }} /> Create a Club
            </Btn>
          </div>

          <Head style={{ marginTop: 14, border: 'none', paddingLeft: 0 }}>
            <FaSearch /> Explore
          </Head>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ flex: 1, padding: 8, border: '1px solid #eee', borderRadius: 8 }}
              placeholder="Search clubs…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchClubs()}
            />
            <Ghost onClick={searchClubs}>Search</Ghost>
          </div>
          <div style={{ marginTop: 8 }}>
            {explore.map((c) => (
              <Row key={c._id} onClick={() => loadClub(c._id)}>
                <div
                  style={{
                    fontSize: 12,
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: '#f3f3f3',
                    display: 'grid',
                    placeItems: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {c.profilePicture ? (
                    <img
                      src={c.profilePicture}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
        </DrawerBody>
      </LeftDrawer>

      {/* Right drawer: About */}
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
              Tips: Create channels for different teams (e.g., “Recruitment”, “Events”). Each
              channel can have a Director.
            </Sub>
          ) : (
            <>
              <div style={{ marginBottom: 8 }}>{selected.description || 'No description yet.'}</div>
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