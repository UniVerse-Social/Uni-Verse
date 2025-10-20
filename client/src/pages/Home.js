// client/src/pages/Home.js
import React, { useState, useEffect, useContext, useCallback } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../App';
import CreatePost from '../components/CreatePost';
import Post from '../components/Post';
import AdCard from '../components/AdCard';
import { API_BASE_URL } from '../config';
import StickerDock from '../components/StickerDock';
import CustomStickerContext from '../context/CustomStickerContext';
import StickerSettingsModal from '../components/StickerSettingsModal';

const PREF_STORAGE_KEY = 'fc__homePrefs_v1';

const DEFAULT_PREFS = Object.freeze({
  showOwn: true,
  showFollowing: true,
  includeNonFollowers: false,
  includeSameDepartment: false,
  sharedInterestsOnly: false,
  onlyInteracted: false,
  showStickerPanel: true,
  sort: 'newest',
  dateRange: 'all',
  disableAnimations: false,
});

const FEED_POST_LIMIT = 60;

const HomeContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 20px;
  min-height: calc(100vh - 101px); /* desktop unchanged */

  @media (max-width: 600px) {
    /* Make space for fixed bottom nav on phones */
    padding: 12px 12px calc(74px + env(safe-area-inset-bottom, 0px));
    min-height: 100vh;
  }
`;

const Feed = styled.div`
  width: 100%;
  max-width: 600px;
  position: relative;
`;

const TopButtonsRow = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;

  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

const PreferencesButton = styled.button`
  flex: 1 1 0;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 10px;
  color: #d1d5db;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s ease;
  &:hover { background: rgba(255,255,255,0.16); }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StickerSettingsButton = styled(PreferencesButton)``;

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
  background: #ffffff;
  color: #0f172a;
  width: min(620px, 92vw);
  max-height: 82vh;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 28px 48px rgba(15, 23, 42, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const PrefHeader = styled.div`
  padding: 20px 24px 12px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.7);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
`;

const PrefHeading = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
`;

const PrefHelper = styled.p`
  margin: 0;
  font-size: 12px;
  color: #64748b;
`;

const PrefBody = styled.div`
  padding: 18px 20px;
  display: grid;
  gap: 18px;
  overflow-y: auto;
`;

const PrefDivider = styled.hr`
  border: none;
  border-top: 1px solid rgba(226, 232, 240, 0.7);
  margin: 0;
`;

const PrefSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(226, 232, 240, 0.7);
  background: rgba(248, 250, 252, 0.6);
`;

const PrefRow = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #1f2937;
  padding: 2px 0;
`;

const PrefTitle = styled.h3`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
`;

const PrefActionGroup = styled.div`
  display: flex;
  gap: 10px;
`;

const PrefContent = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
`;

const PrefColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const PrefButton = styled.button`
  padding: 9px 20px;
  border-radius: 999px;
  border: ${(p) => (p.$primary ? 'none' : '1px solid rgba(148, 163, 184, 0.45)')};
  background: ${(p) => (p.$primary ? '#2563eb' : 'rgba(226, 232, 240, 0.9)')};
  color: ${(p) => (p.$primary ? '#fff' : '#1f2937')};
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s ease, opacity 0.2s ease;
  &:hover {
    background: ${(p) => (p.$primary ? '#1d4ed8' : 'rgba(226, 232, 240, 1)')};
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const PrefResetButton = styled.button`
  border: none;
  background: transparent;
  color: #2563eb;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 0;
  &:hover {
    text-decoration: underline;
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    text-decoration: none;
  }
`;

const PrefFooter = styled.div`
  padding: 16px 24px;
  background: rgba(248, 250, 252, 0.65);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;


const readStoredPrefs = () => {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(PREF_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...(parsed || {}) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
};

const mergePreferences = (raw = {}) => ({ ...DEFAULT_PREFS, ...(raw || {}) });

const buildStickerDefaultsDraft = (source = {}) => ({
  allowMode: source?.allowMode || 'everyone',
  allowstickytext: !!source?.allowstickytext,
  allowstickymedia: !!source?.allowstickymedia,
  allowlist: Array.isArray(source?.allowlist)
    ? source.allowlist.join(', ')
    : source?.allowlist || '',
  denylist: Array.isArray(source?.denylist)
    ? source.denylist.join(', ')
    : source?.denylist || '',
  maxCount: Number(source?.maxCount) || 20,
  hideFeedStickers: !!source?.hideFeedStickers,
  showStickerPanel: source?.showStickerPanel !== false,
});

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [ads, setAds] = useState([]);
  const { user } = useContext(AuthContext);
  const { stickerDefaults, saveStickerDefaults } = useContext(CustomStickerContext);
  const userId = user?._id || null;
  const [preferences, setPreferences] = useState(() => readStoredPrefs());
  const [draftPrefs, setDraftPrefs] = useState(() => readStoredPrefs());
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [showStickerDefaults, setShowStickerDefaults] = useState(false);
  const [defaultsDraft, setDefaultsDraft] = useState(() => buildStickerDefaultsDraft(stickerDefaults));
  const openPrefs = useCallback(() => {
    setDraftPrefs({ ...DEFAULT_PREFS, ...preferences });
    window.dispatchEvent(new CustomEvent('fc-modal-open', { detail: 'home-preferences' }));
    setShowPrefs(true);
  }, [preferences]);

  const closePrefs = useCallback(() => {
    setShowPrefs(false);
    setDraftPrefs({ ...DEFAULT_PREFS, ...preferences });
  }, [preferences]);

  const openStickerDefaults = useCallback(() => {
    setDefaultsDraft(buildStickerDefaultsDraft(stickerDefaults));
    setShowStickerDefaults(true);
  }, [stickerDefaults]);

  const cancelStickerDefaults = useCallback(() => {
    setShowStickerDefaults(false);
    setDefaultsDraft(buildStickerDefaultsDraft(stickerDefaults));
  }, [stickerDefaults]);

  const onChangeDefaults = useCallback(
    (field) => (event) => {
      const isCheckbox =
        field === 'allowstickytext' ||
        field === 'allowstickymedia' ||
        field === 'showStickerPanel';
      let value = isCheckbox ? event.target.checked : event.target.value;
      if (field === 'maxCount') {
        value = Math.min(30, Math.max(1, parseInt(value, 10) || 20));
      }
      if (field === 'hideFeedStickers') {
        value = !!value;
      }
      setDefaultsDraft((prev) => ({ ...prev, [field]: value }));
    },
    [setDefaultsDraft]
  );

  const saveDefaults = useCallback(() => {
    saveStickerDefaults(defaultsDraft);
    setShowStickerDefaults(false);
  }, [defaultsDraft, saveStickerDefaults]);

  useEffect(() => {
    if (!showPrefs) return;
    setDraftPrefs({ ...DEFAULT_PREFS, ...preferences });
  }, [showPrefs, preferences]);

  useEffect(() => {
    setDefaultsDraft(buildStickerDefaultsDraft(stickerDefaults));
  }, [stickerDefaults, setDefaultsDraft]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PREF_STORAGE_KEY, JSON.stringify(preferences));
    } catch {}
  }, [preferences]);

  useEffect(() => {
    if (stickerDefaults && typeof stickerDefaults.showStickerPanel === 'boolean') {
      setPreferences((prev) => ({
        ...prev,
        showStickerPanel: stickerDefaults.showStickerPanel,
      }));
      setDraftPrefs((prev) => ({
        ...prev,
        showStickerPanel: stickerDefaults.showStickerPanel,
      }));
    }
  }, [stickerDefaults]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      const local = readStoredPrefs();
      if (!cancelled) {
        const merged = mergePreferences(local);
        setPreferences(merged);
        setDraftPrefs(merged);
      }
      return () => {
        cancelled = true;
      };
    }

    const fetchPrefs = async () => {
      setPrefsLoading(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/users/${userId}/feed-preferences`);
        if (cancelled) return;
        const merged = mergePreferences(res.data);
        setPreferences(merged);
        setDraftPrefs(merged);
      } catch (err) {
        console.error('Failed to load feed preferences', err);
        if (cancelled) return;
        const local = mergePreferences(readStoredPrefs());
        setPreferences(local);
        setDraftPrefs(local);
      } finally {
        if (!cancelled) setPrefsLoading(false);
      }
    };

    fetchPrefs();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleResetPreferences = useCallback(async () => {
    const next = { ...DEFAULT_PREFS };
    setDraftPrefs(next);
    if (userId) {
      try {
        setSavingPrefs(true);
        await axios.put(`${API_BASE_URL}/api/users/${userId}/feed-preferences`, {
          userId,
          ...next,
        });
        setPreferences(next);
      } catch (err) {
        console.error('Failed to reset preferences', err);
        setDraftPrefs(mergePreferences(preferences));
        alert('Could not reset preferences right now.');
      } finally {
        setSavingPrefs(false);
      }
    } else {
      setPreferences(next);
    }
  }, [userId, preferences]);

  const handleSavePreferences = useCallback(async () => {
    const next = mergePreferences(draftPrefs);
    if (userId) {
      try {
        setSavingPrefs(true);
        const res = await axios.put(`${API_BASE_URL}/api/users/${userId}/feed-preferences`, {
          userId,
          ...next,
        });
        const saved = mergePreferences(res.data || next);
        setPreferences(saved);
        setDraftPrefs(saved);
        setShowPrefs(false);
      } catch (err) {
        console.error('Failed to save preferences', err);
        alert('Could not save preferences right now.');
      } finally {
        setSavingPrefs(false);
      }
    } else {
      setPreferences(next);
      setShowPrefs(false);
    }
  }, [draftPrefs, userId]);

  // Load posts whenever preferences change
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const params = new URLSearchParams({
          showOwn: String(preferences.showOwn),
          showFollowers: String(preferences.showFollowing),
          includeNonFollowers: String(preferences.includeNonFollowers),
          includeSameDepartment: String(preferences.includeSameDepartment),
          sharedInterestsOnly: String(preferences.sharedInterestsOnly),
          onlyInteracted: String(preferences.onlyInteracted),
          sort: preferences.sort === 'chronological' ? 'newest' : preferences.sort,
          dateRange: preferences.dateRange || 'all',
        });
        const res = await axios.get(
          `${API_BASE_URL}/api/posts/home-feed/${user._id}?${params.toString()}`
        );
        if (!cancelled) {
          setPosts(Array.isArray(res.data) ? res.data.slice(0, FEED_POST_LIMIT) : []);
        }
      } catch (err) {
        console.error('Failed to load home feed', err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user._id, preferences]);

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
    setPosts((prev) => {
      const next = [
        {
          ...newPost,
          commentCount: newPost.commentCount ?? 0,
          commentPreview: newPost.commentPreview ?? null,
          viewerCommented: false,
        },
        ...prev,
      ];
      return next.slice(0, FEED_POST_LIMIT);
    });

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  };

  const handlePostUpdated = (updated) => {
    setPosts((prev) => prev.map((p) => (p._id === updated._id ? { ...p, ...updated } : p)));
  };

  const filteredPosts = posts;
  const showStickerPanel = stickerDefaults?.showStickerPanel ?? preferences.showStickerPanel ?? true;

  return (
    <HomeContainer>
      {showStickerPanel && (
        <StickerDock animationsDisabled={preferences.disableAnimations} />
      )}
      <Feed data-feed-container>
        <TopButtonsRow>
          <PreferencesButton onClick={openPrefs} disabled={prefsLoading}>
            {prefsLoading ? 'Loading preferences…' : 'Home page preferences'}
          </PreferencesButton>
          <StickerSettingsButton type="button" onClick={openStickerDefaults}>
            Sticker Settings
          </StickerSettingsButton>
        </TopButtonsRow>

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
                animationsDisabled={preferences.disableAnimations}
              />
              {shouldShowAd && <AdCard ad={ads[adIndex]} />}
            </React.Fragment>
          );
        })}
      </Feed>

      <StickerSettingsModal
        open={showStickerDefaults}
        values={defaultsDraft}
        onChange={onChangeDefaults}
        onSave={saveDefaults}
        onCancel={cancelStickerDefaults}
      />

      {showPrefs && (
        <PreferencesBackdrop onClick={closePrefs}>
          <PreferencesModal onClick={(e) => e.stopPropagation()}>
            <PrefHeader>
              <PrefHeading>Home Feed Preferences</PrefHeading>
              {prefsLoading && <PrefHelper>Loading saved preferences…</PrefHelper>}
            </PrefHeader>
            <PrefBody>
              <PrefContent>
                <PrefColumn>
                <PrefSection>
                  <PrefTitle>Show posts from</PrefTitle>
                  <PrefRow>
                    <input
                      type="checkbox"
                      checked={draftPrefs.showOwn}
                      onChange={(e) => setDraftPrefs((prev) => ({ ...prev, showOwn: e.target.checked }))}
                    />
                    Show my posts
                  </PrefRow>
                  <PrefRow>
                    <input
                      type="checkbox"
                      checked={draftPrefs.showFollowing}
                      onChange={(e) => setDraftPrefs((prev) => ({ ...prev, showFollowing: e.target.checked }))}
                    />
                    Show following
                  </PrefRow>
                  <PrefRow>
                    <input
                      type="checkbox"
                      checked={draftPrefs.includeNonFollowers}
                      onChange={(e) => setDraftPrefs((prev) => ({ ...prev, includeNonFollowers: e.target.checked }))}
                    />
                    Include non-followers
                  </PrefRow>
                  <PrefRow>
                    <input
                      type="checkbox"
                      checked={draftPrefs.includeSameDepartment}
                      onChange={(e) => setDraftPrefs((prev) => ({ ...prev, includeSameDepartment: e.target.checked }))}
                    />
                    Include people from my department
                  </PrefRow>
                </PrefSection>

                <PrefSection>
                  <PrefTitle>Filters</PrefTitle>
                  <PrefRow>
                    <input
                      type="checkbox"
                      checked={draftPrefs.onlyInteracted}
                      onChange={(e) => setDraftPrefs((prev) => ({ ...prev, onlyInteracted: e.target.checked }))}
                    />
                    Only posts I've interacted with
                  </PrefRow>
                  <PrefRow>
                    <input
                      type="checkbox"
                      checked={draftPrefs.sharedInterestsOnly}
                      onChange={(e) => setDraftPrefs((prev) => ({ ...prev, sharedInterestsOnly: e.target.checked }))}
                    />
                    Shared interests only
                  </PrefRow>
                </PrefSection>

                <PrefSection>
                  <PrefTitle>Interface</PrefTitle>
                  <PrefRow>
                    <input
                      type="checkbox"
                      checked={draftPrefs.disableAnimations}
                      onChange={(e) =>
                        setDraftPrefs((prev) => ({
                          ...prev,
                          disableAnimations: e.target.checked,
                        }))
                      }
                    />
                    Prevent animations (videos, GIFs, stickers)
                  </PrefRow>
                </PrefSection>
                </PrefColumn>

                <PrefColumn>
                <PrefSection>
                  <PrefTitle>Date range</PrefTitle>
                  {[
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: 'Past 7 days' },
                    { value: 'month', label: 'Past 30 days' },
                    { value: 'year', label: 'Past 12 months' },
                    { value: 'all', label: 'All time' },
                  ].map((option) => (
                    <PrefRow key={option.value}>
                      <input
                        type="radio"
                        name="home-date"
                        checked={draftPrefs.dateRange === option.value}
                        onChange={() => setDraftPrefs((prev) => ({ ...prev, dateRange: option.value }))}
                      />
                      {option.label}
                    </PrefRow>
                  ))}
                </PrefSection>

                <PrefSection>
                  <PrefTitle>Sort order</PrefTitle>
                  <PrefRow>
                    <input
                      type="radio"
                      name="home-sort"
                      checked={draftPrefs.sort === 'newest'}
                      onChange={() => setDraftPrefs((prev) => ({ ...prev, sort: 'newest' }))}
                    />
                    Newest first
                  </PrefRow>
                  <PrefRow>
                    <input
                      type="radio"
                      name="home-sort"
                      checked={draftPrefs.sort === 'mostLiked'}
                      onChange={() => setDraftPrefs((prev) => ({ ...prev, sort: 'mostLiked' }))}
                    />
                    Most liked
                  </PrefRow>
                </PrefSection>
                </PrefColumn>
              </PrefContent>
            </PrefBody>
            <PrefDivider />
            <PrefFooter>
              <PrefResetButton
                type="button"
                onClick={handleResetPreferences}
                disabled={savingPrefs || prefsLoading}
              >
                Reset to default
              </PrefResetButton>
              <PrefActionGroup>
                <PrefButton type="button" onClick={closePrefs}>Cancel</PrefButton>
                <PrefButton
                  type="button"
                  $primary
                  onClick={handleSavePreferences}
                  disabled={savingPrefs || prefsLoading}
                >
                  {savingPrefs ? 'Saving…' : 'Save preferences'}
                </PrefButton>
              </PrefActionGroup>
            </PrefFooter>
          </PreferencesModal>
        </PreferencesBackdrop>
      )}
    </HomeContainer>
  );
};

export default Home;
