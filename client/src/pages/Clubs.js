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
} from 'react-icons/fa';
import ClubPostCard from '../components/ClubPostCard';
import ClubComposer from '../components/ClubComposer';
import MemberDrawer from '../components/MemberDrawer';

const Page = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
  display: grid;
  gap: 16px;
  grid-template-columns: 280px 1fr 320px;
`;
const Col = styled.div`
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
const Title = styled.div`
  font-weight: 700;
`;
const Sub = styled.div`
  font-size: 12px;
  color: #666;
`;
const Btn = styled.button`
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #111;
  background: #111;
  color: #fff;
  cursor: pointer;
`;
const Ghost = styled(Btn)`
  background: #fff;
  color: #111;
`;
const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid #eee;
`;
const Chip = styled.button`
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$active ? '#111' : '#e5e5e5')};
  background: ${(p) => (p.$active ? '#111' : '#fff')};
  color: ${(p) => (p.$active ? '#fff' : '#111')};
  cursor: pointer;
`;

export default function Clubs() {
  const { user } = useContext(AuthContext);

  const [myClubs, setMyClubs] = useState([]);
  const [explore, setExplore] = useState([]);
  const [q, setQ] = useState('');

  const [selected, setSelected] = useState(null); // club doc
  const [active, setActive] = useState({
    type: 'main', // 'main' | 'side'
    sideId: null,
    name: 'Main',
  });
  const [posts, setPosts] = useState([]);
  const [showMembers, setShowMembers] = useState(false);

  const photoInput = useRef(null);

  const api = {
    clubs: `${API_BASE_URL}/api/clubs`,
    posts: `${API_BASE_URL}/api/club-posts`,
  };

  // ------- Data loaders (memoized) -------

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
    },
    [api.clubs]
  );

  const loadPosts = useCallback(async () => {
    if (!selected) return;
    const params =
      active.type === 'main'
        ? { channel: 'main' }
        : { channel: 'side', sideId: active.sideId };
    const res = await axios.get(`${api.posts}/${selected._id}`, { params });
    setPosts(res.data || []);
  }, [api.posts, selected, active.type, active.sideId]);

  // initial fetches
  useEffect(() => {
    refreshMine();
    searchClubs();
  }, [refreshMine, searchClubs]);

  // reload posts upon channel/club change
  useEffect(() => {
    if (selected) loadPosts();
  }, [selected, loadPosts]);

  // ------- Derived booleans -------
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

  // ------- Actions -------
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

  // ------- Club photo upload (president only) -------
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

  return (
    <Page>
      {/* Left: My Clubs & Explore */}
      <Col>
        <Head>
          <FaUsers /> My Clubs
        </Head>
        <Body>
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
        <Body>
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

      {/* Middle: Club view */}
      <Col style={{ gridColumn: 'span 1' }}>
        {!selected ? (
          <Body>
            <Sub>Select a club to view its feeds.</Sub>
          </Body>
        ) : (
          <>
            <Head>
              {/* Club avatar + name */}
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
              </div>

              {/* hidden file input for photo */}
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                onChange={onPhotoSelected}
                style={{ display: 'none' }}
              />
            </Head>

            {/* Channels: Main + named side channels */}
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

            <Body>
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

      {/* Right: About */}
      <Col>
        {!selected ? (
          <Body>
            <Sub>
              Tips: Create channels for different teams (e.g., “Recruitment”, “Events”).
              Each channel can have a Director.
            </Sub>
          </Body>
        ) : (
          <>
            <Head>About</Head>
            <Body>
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
  );
}
