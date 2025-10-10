// client/src/pages/Home.js
import React, { useState, useEffect, useContext, useMemo } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../App';
import CreatePost from '../components/CreatePost';
import Post from '../components/Post';
import AdCard from '../components/AdCard';
import { API_BASE_URL } from '../config';

const HomeContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 20px;
  min-height: calc(100vh - 101px);
`;

const Feed = styled.div`
  width: 100%;
  max-width: 600px;
  position: relative;
`;

const PreferencesButton = styled.button`
  width: 100%;
  padding: 6px 12px;
  margin-bottom: 12px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 10px;
  color: #d1d5db;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s ease;
  &:hover { background: rgba(255,255,255,0.16); }
`;

const PreferencesBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
`;

const PreferencesModal = styled.div`
  background: var(--container-white);
  color: var(--text-color);
  width: min(520px, 90vw);
  max-height: 80vh;
  overflow: auto;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  box-shadow: 0 20px 50px rgba(0,0,0,0.25);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PrefSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PrefRow = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
`;

const PrefTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  color: #111827;
`;

const PrefActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`;

const PrefButton = styled.button`
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: rgba(255,255,255,0.08);
  color: var(--text-color);
  cursor: pointer;
  font-weight: 600;
  &:hover { background: rgba(255,255,255,0.16); }
`;


const Home = () => {
  const [posts, setPosts] = useState([]);
  const [ads, setAds] = useState([]);
  const { user } = useContext(AuthContext);
  const [showPrefs, setShowPrefs] = useState(false);
  const [preferences, setPreferences] = useState({
    showOwn: true,
    showFollowers: true,
    includeNonFollowers: false,
    includeSameDepartment: false,
    sharedInterestsOnly: false,
    onlyInteracted: false,
    sort: 'chronological',
  });

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/posts/timeline/${user._id}`);
        setPosts(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchPosts();
  }, [user._id]);

  useEffect(() => {
    const loadAds = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/ads`);
        setAds(res.data || []);
      } catch {}
    };
    loadAds();
  }, []);

  
  const handlePostCreated = (newPost) =>
    setPosts((prev) => [
      {
        ...newPost,
        commentCount: newPost.commentCount ?? 0,
        commentPreview: newPost.commentPreview ?? null,
        viewerCommented: false,
      },
      ...prev,
    ]);

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  };

  const handlePostUpdated = (updated) => {
    setPosts((prev) => prev.map((p) => (p._id === updated._id ? { ...p, ...updated } : p)));
  };

  const filteredPosts = useMemo(() => {
    const viewerId = String(user._id);
    const followingIds = new Set(
      (Array.isArray(user.following) ? user.following : []).map((id) => String(id))
    );

    const primary = posts.filter((p) => {
      const authorId = String(p.userId);
      const isOwn = authorId === viewerId;
      const isFollower = followingIds.has(authorId);
      const isNonFollower = !isOwn && !isFollower;
      const sameDepartment = user.department
        ? (p.authorDepartment || '').toLowerCase() === user.department.toLowerCase()
        : false;

      let allowed = false;
      if (isOwn && preferences.showOwn) allowed = true;
      if (isFollower && preferences.showFollowers) allowed = true;
      if (isNonFollower && preferences.includeNonFollowers) allowed = true;
      if (preferences.includeSameDepartment && sameDepartment && !isOwn) allowed = true;

      return allowed;
    });

    let list = primary;

    if (preferences.onlyInteracted) {
      list = list.filter((p) => {
        const liked = Array.isArray(p.likes) && p.likes.some((id) => String(id) === viewerId);
        return p.viewerCommented || liked;
      });
    }

    if (preferences.sharedInterestsOnly && Array.isArray(user.hobbies) && user.hobbies.length) {
      const hobbySet = new Set(user.hobbies);
      list = list.filter((p) => {
        const authorHobbies = Array.isArray(p.authorHobbies) ? p.authorHobbies : [];
        return authorHobbies.some((h) => hobbySet.has(h));
      });
    }

    if (preferences.sort === 'mostLiked') {
      list = [...list].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
    }
    return list;
  }, [posts, preferences, user]);

  return (
    <HomeContainer>
      <Feed>
        <PreferencesButton onClick={() => setShowPrefs(true)}>Home page preferences</PreferencesButton>

        <CreatePost onPostCreated={handlePostCreated} />
        {filteredPosts.map((p, idx) => {
          const adIndex = Math.floor(idx / 10) % (ads.length || 1);
          const shouldShowAd = (idx !== 0) && ((idx + 1) % 10 === 0) && ads.length > 0;
          return (
            <React.Fragment key={p._id}>
              <Post
                post={p}
                onPostDeleted={handlePostDeleted}
                onPostUpdated={handlePostUpdated}
              />
              {shouldShowAd && <AdCard ad={ads[adIndex]} />}
            </React.Fragment>
          );
        })}
      </Feed>

      {showPrefs && (
        <PreferencesBackdrop onClick={() => setShowPrefs(false)}>
          <PreferencesModal onClick={(e) => e.stopPropagation()}>
            <PrefTitle>Home Feed Preferences</PrefTitle>

            <PrefSection>
              <PrefTitle>Show posts from</PrefTitle>
              <PrefRow>
                <input
                  type="checkbox"
                  checked={preferences.showOwn}
                  onChange={(e) => setPreferences((prev) => ({ ...prev, showOwn: e.target.checked }))}
                />
                Show my posts
              </PrefRow>
              <PrefRow>
                <input
                  type="checkbox"
                  checked={preferences.showFollowers}
                  onChange={(e) => setPreferences((prev) => ({ ...prev, showFollowers: e.target.checked }))}
                />
                Show followers' posts
              </PrefRow>
              <PrefRow>
                <input
                  type="checkbox"
                  checked={preferences.includeNonFollowers}
                  onChange={(e) => setPreferences((prev) => ({ ...prev, includeNonFollowers: e.target.checked }))}
                />
                Include non-followers
              </PrefRow>
              <PrefRow>
                <input
                  type="checkbox"
                  checked={preferences.includeSameDepartment}
                  onChange={(e) => setPreferences((prev) => ({ ...prev, includeSameDepartment: e.target.checked }))}
                />
                Include people from my department
              </PrefRow>
            </PrefSection>

            <PrefSection>
              <PrefTitle>Filters</PrefTitle>
              <PrefRow>
                <input
                  type="checkbox"
                  checked={preferences.onlyInteracted}
                  onChange={(e) => setPreferences((prev) => ({ ...prev, onlyInteracted: e.target.checked }))}
                />
                Only posts I've interacted with
              </PrefRow>
              <PrefRow>
                <input
                  type="checkbox"
                  checked={preferences.sharedInterestsOnly}
                  onChange={(e) => setPreferences((prev) => ({ ...prev, sharedInterestsOnly: e.target.checked }))}
                />
                Shared interests only
              </PrefRow>
            </PrefSection>

            <PrefSection>
              <PrefTitle>Sort order</PrefTitle>
              <PrefRow>
                <input
                  type="radio"
                  name="home-sort"
                  checked={preferences.sort === 'chronological'}
                  onChange={() => setPreferences((prev) => ({ ...prev, sort: 'chronological' }))}
                />
                Newest first
              </PrefRow>
              <PrefRow>
                <input
                  type="radio"
                  name="home-sort"
                  checked={preferences.sort === 'mostLiked'}
                  onChange={() => setPreferences((prev) => ({ ...prev, sort: 'mostLiked' }))}
                />
                Most liked
              </PrefRow>
            </PrefSection>

            <PrefActions>
              <PrefButton type="button" onClick={() => {
                setPreferences({
                  showOwn: true,
                  showFollowers: true,
                  includeNonFollowers: false,
                  includeSameDepartment: false,
                  sharedInterestsOnly: false,
                  onlyInteracted: false,
                  sort: 'chronological',
                });
              }}>Reset to default</PrefButton>
              <PrefButton type="button" onClick={() => setShowPrefs(false)}>Done</PrefButton>
            </PrefActions>
          </PreferencesModal>
        </PreferencesBackdrop>
      )}
    </HomeContainer>
  );
};

export default Home;
