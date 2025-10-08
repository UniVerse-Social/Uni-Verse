import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../App';
import Post from '../components/Post';
import EditProfileModal from '../components/EditProfileModal';
import ImageCropModal from '../components/ImageCropModal';
import { FaCamera } from 'react-icons/fa';
import { FiSettings, FiLogOut, FiTrash2, FiX } from 'react-icons/fi';
import FollowersModal from '../components/FollowersModal';

/* --------------------------- Styled Components --------------------------- */

const Page = styled.div`
  background: var(--background-grey);
  color: var(--text-color);
  min-height: 100vh;
`;

const Content = styled.div`
  max-width: 975px;
  margin: 0 auto;
  padding: 0 20px;
`;

const BannerWrap = styled.div`
  position: relative;
  height: 300px;
  background-color: var(--border-color);
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  overflow: hidden;
`;

const BannerImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const BannerEditButton = styled.label`
  position: absolute;
  bottom: 16px;
  right: 16px;
  background-color: rgba(255, 255, 255, 0.9);
  color: #333;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: all 0.2s ease-in-out;

  &:hover { background-color: #fff; transform: translateY(-2px); }
`;

const HiddenFileInput = styled.input` display: none; `;

const Header = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 20px;
  padding: 0 20px 20px 20px;
  margin-top: -80px;
  position: relative;
  border-bottom: 1px solid #ddd;
  margin-bottom: 20px;
`;

const AvatarWrap = styled.div`
  position: relative;
  width: 168px;
  height: 168px;
  flex-shrink: 0;
`;

const AvatarFrame = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  border: 4px solid #f0f2f5;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  background: #fff;
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const DefaultAvatar = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #fff url(${(p) => p.src}) center / 150% no-repeat;
`;

const AvatarUpload = styled.label`
  position: absolute;
  bottom: 10px;
  right: 10px;
  background-color: var(--border-color);
  color: var(--text-color);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  cursor: pointer;
  border: 2px solid var(--container-white);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  transition: all 0.2s;
  &:hover { filter: brightness(0.95); }
`;

const InfoAndActions = styled.div`
  flex-grow: 1;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-bottom: 10px;
`;

const Info = styled.div` padding-top: 80px; `;

const Username = styled.h3`
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: #fff;
`;

const Stats = styled.div`
  display: flex;
  gap: 20px;
  font-size: 16px;
  color: #fff;
  margin-bottom: 4px;
`;

const Bio = styled.p`
  margin: 8px 0 0 0;
  color: #fff;
  font-size: 16px;
`;

/* ---- NEW: Badges row + slots ---- */

const BadgesRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 10px;
  align-items: center;
`;

const SlotWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const SlotLabel = styled.span`
  margin-top: 6px;
  font-size: 11px;
  color: #e5e7eb;
`;

const BadgeSlot = styled.button`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: ${p => p.$filled ? '2px solid transparent' : '2px dashed var(--border-color)'};
  background: ${p => p.$filled ? 'var(--container-white)' : 'transparent'};
  color: var(--text-color);
  display: grid;
  place-items: center;
  position: relative;
  cursor: ${p => p.$clickable ? 'pointer' : 'default'};
  box-shadow: ${p => p.$filled ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'};
  transition: transform .1s ease;
  &:hover { transform: ${p => p.$clickable ? 'translateY(-1px)' : 'none'}; }
`;

const PlusDot = styled.span`
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #1877f2;
  color: #fff;
  display: ${p => (p.$show ? 'grid' : 'none')};
  place-items: center;
  font-size: 12px;
  border: 2px solid var(--container-white);
  font-weight: 200;
`;

const BadgeEmoji = styled.span`
  font-size: 20px;
  line-height: 1;
`;

/* ---- Badges Modal ---- */

const ModalBackdrop = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.35);
  display: grid; place-items: center;
  z-index: 50;
`;

const ModalCard = styled.div`
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
  width: min(720px, 95vw);
  padding: 18px;
`;

const ModalHeader = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
  h3 { margin: 0; font-size: 18px; }
  button { border: none; background: transparent; cursor: pointer; font-size: 20px; color: #666; &:hover { color: #000; } }
`;

const MenuDivider = styled.div` height: 1px; background: #eee; margin: 10px 0; `;

const ModalBody = styled.div` font-size: 14px; color: #333; `;

const SlotsBar = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: center;
`;

const SlotMini = styled(BadgeSlot)`
  width: 40px;
  height: 40px;
  border: ${p => p.$active ? '2px solid #1877f2' : p.$filled ? '2px solid transparent' : '2px dashed var(--border-color)'};
`;

const BadgeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
`;

const BadgeCard = styled.button`
  border: 1px solid var(--border-color);
  background: ${p => p.$unlocked ? 'var(--container-white)' : 'rgba(0,0,0,0.03)'};
  color: var(--text-color);
  border-radius: 10px;
  padding: 10px;
  text-align: left;
  cursor: ${p => p.$unlocked ? 'pointer' : 'not-allowed'};
  opacity: ${p => p.$unlocked ? 1 : 0.5};
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 10px;
  align-items: center;
  &:hover { box-shadow: ${p => p.$unlocked ? '0 4px 12px rgba(0,0,0,0.08)' : 'none'}; }
`;

const BadgeIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  display: grid;
  place-items: center;
  background: #fff;
  font-size: 18px;
`;

const BadgeName = styled.div` font-weight: 700; `;
const BadgeMeta = styled.div` font-size: 12px; color: #6b7280; `;

const PrimaryButton = styled.button`
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  background-color: ${props => (props.$primary ? '#1877f2' : '#e4e6eb')};
  color: ${props => (props.$primary ? 'white' : '#333')};
  border: none;
  transition: filter 0.2s;
  &:hover { filter: brightness(0.95); }
`;

const PostsGrid = styled.div` padding-top: 20px; `;

/* ---------- Settings UI (gear + dropdown) ---------- */

const SettingsWrap = styled.div`
  position: relative;
  display: inline-block;
  margin-left: 10px;
`;

const SettingsButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--container-white);
  cursor: pointer;
  color: var(--text-color);
  &:hover { background: #b9b9b9 }
`;

const SettingsMenu = styled.div`
  position: absolute;
  top: 48px;
  right: 0;
  z-index: 20;
  background: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  min-width: 240px;
  overflow: hidden;
  padding: 6px 0;
`;

const SettingsItem = styled.button`
  width: 100%;
  padding: 12px 14px;
  text-align: left;
  display: flex;
  gap: 10px;
  align-items: center;
  border: none;
  background: var(--container-white);
  cursor: pointer;
  font-weight: 600;
  color: ${p => (p.className?.includes('danger') ? '#b00020' : 'var(--text-color)')};
  &:hover { background: rgba(0,0,0,0.04); }
`;

/* --------------------------- Constants --------------------------- */

const TUFFY_DEFAULT_URL = 'https://www.clipartmax.com/png/middle/72-721825_tuffy-tuffy-the-titan-csuf.png';
const DEFAULT_BANNER_DATA = 'https://dslv9ilpbe7p1.cloudfront.net/jT7zrQp7WtGXTdoT3rpLxg_store_banner_image.jpeg';

/* --------------------------- Component --------------------------- */

const Profile = () => {
  // Core state
  const [userOnPage, setUserOnPage] = useState(null);
  const [posts, setPosts] = useState([]);
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, login } = useContext(AuthContext);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Crop state
  const [imageToCrop, setImageToCrop] = useState(null);
  const [bannerToCrop, setBannerToCrop] = useState(null);

  // Settings UI
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(null);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Followers modal
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  // Badges state
  const [badges, setBadges] = useState({ catalog: [], unlocked: [], equipped: ['', '', '', '', ''] });
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [activeSlot, setActiveSlot] = useState(0);

  // Reset stale state on route change (prevents ghosts from previous profile)
  useEffect(() => {
    setUserOnPage(null);
    setPosts([]);
    setShowFollowers(false);
    setShowFollowing(false);
  }, [username]);

  // Fetch profile and posts
  const fetchUserAndPosts = useCallback(async () => {
    try {
      const userRes = await axios.get(`http://localhost:5000/api/users/profile/${username}`);
      const postsRes = await axios.get(`http://localhost:5000/api/posts/profile/${username}`);
      setUserOnPage(userRes.data);
      setPosts(postsRes.data);
    } catch (err) {
      console.error('Error fetching profile data:', err);
    }
  }, [username]);

  useEffect(() => { fetchUserAndPosts(); }, [fetchUserAndPosts]);

  // Follow state
  useEffect(() => {
    if (userOnPage && currentUser) {
      setIsFollowing(Array.isArray(userOnPage.followers) && userOnPage.followers.includes(currentUser._id));
    }
  }, [userOnPage, currentUser]);

  useEffect(() => {
    if (!userOnPage || !currentUser) return;

    // Only redirect if we're truly viewing our *own* profile route.
    const viewingOwnRoute = username === currentUser.username;

    if (
      viewingOwnRoute &&
      String(userOnPage._id) === String(currentUser._id) &&
      userOnPage.username !== username
    ) {
      navigate(`/profile/${userOnPage.username}`, { replace: true });
    }
  }, [userOnPage, currentUser, username, navigate]);
  
  // Close settings when clicking outside
  useEffect(() => {
    function onDocClick(e) {
      if (!settingsRef.current) return;
      if (settingsRef.current.contains(e.target)) return;
      setShowSettings(false);
    }
    if (showSettings) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
  }, [showSettings]);

  // File select → preview for cropper
  const handleFileChange = (e, setImageState) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImageState(reader.result);
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  // Crop → upload
  const handleCropComplete = async (croppedImageBlobUrl, imageType) => {
    try {
      const response = await fetch(croppedImageBlobUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result;
        const res = await axios.put(
          `http://localhost:5000/api/users/${currentUser._id}`,
          { userId: currentUser._id, [imageType]: base64data }
        );
        login(res.data);
        setUserOnPage(res.data);
        setImageToCrop(null);
        setBannerToCrop(null);
      };
    } catch (err) {
      console.error('Failed to upload cropped image', err);
      setImageToCrop(null);
      setBannerToCrop(null);
    }
  };

  // Update Profile after editing profile in modal
  const handleProfileUpdate = (updatedUserData) => setUserOnPage(updatedUserData);

  // Follow/unfollow
  const handleFollow = async () => {
    if (!userOnPage || !currentUser) return;
    try {
      await axios.put(`http://localhost:5000/api/users/${userOnPage._id}/follow`, { userId: currentUser._id });
      fetchUserAndPosts();
    } catch (err) { console.error('Failed to follow/unfollow:', err); }
  };

  // Post update/delete handlers
  const handlePostUpdated = (updatedPost) => {
    setPosts((current) => current.map((p) => (p._id === updatedPost._id ? updatedPost : p)));
  };
  const handlePostDeleted = (postId) => {
    setPosts((current) => current.filter((p) => p._id !== postId));
  };

  // Logout
  const handleLogout = () => {
    try { if (typeof window !== 'undefined') localStorage.clear(); }
    finally { window.location.href = '/login'; }
  };

  // Delete account flow
  const requestDeleteAccount = () => { setDeleteConfirmText(''); setShowDeleteModal(true); setShowSettings(false); };
  const doDeleteAccount = async () => {
    if (!currentUser) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') { alert('Please type DELETE to confirm.'); return; }
    try {
      await axios.delete(`http://localhost:5000/api/users/${currentUser._id}`, { data: { userId: currentUser._id } });
    } catch (err) { console.error('Failed to delete account', err); alert('Failed to delete account.'); return; }
    handleLogout();
  };

  const isOwnProfile = !!currentUser && !!userOnPage && String(currentUser._id) === String(userOnPage._id);

  /* ---- Badges helpers ---- */

  const fetchBadges = useCallback(async () => {
    if (!userOnPage?._id) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/users/${userOnPage._id}/badges`);
      const { catalog = [], unlocked = [], equipped = [] } = res.data || {};
      setBadges({
        catalog,
        unlocked: Array.isArray(unlocked) ? unlocked : [],
        equipped: Array.isArray(equipped) ? equipped : ['', '', '', '', ''],
      });
    } catch (e) {
      console.error('Failed to load badges', e);
    }
  }, [userOnPage?._id]);

  useEffect(() => { if (userOnPage?._id) fetchBadges(); }, [userOnPage?._id, fetchBadges]);

  const openBadgesModal = (slotIndex) => {
    setActiveSlot(slotIndex);
    setShowBadgesModal(true);
  };

  const equipToSlot = async (slotIndex, badgeName) => {
    if (!isOwnProfile) return;
    try {
      const res = await axios.post(`http://localhost:5000/api/users/${currentUser._id}/badges/equip`, {
        userId: currentUser._id,
        slot: slotIndex,
        badgeName: badgeName ?? null,
      });
      const { unlocked = [], equipped = [] } = res.data || {};
      setBadges((b) => ({ ...b, unlocked, equipped }));
    } catch (e) {
      console.error('Equip badge failed', e);
      alert(e?.response?.data?.message || 'Failed to equip badge');
    }
  };

  /* --------------------------- Render --------------------------- */

  if (!userOnPage) return <Page>Loading...</Page>;

  return (
    <>
      {/* Crop modals */}
      {imageToCrop && (
        <ImageCropModal
          imageSrc={imageToCrop}
          onClose={() => setImageToCrop(null)}
          onCropComplete={(url) => handleCropComplete(url, 'profilePicture')}
          aspect={1}
          cropShape="round"
        />
      )}
      {bannerToCrop && (
        <ImageCropModal
          imageSrc={bannerToCrop}
          onClose={() => setBannerToCrop(null)}
          onCropComplete={(url) => handleCropComplete(url, 'bannerPicture')}
          aspect={1200 / 350}
          cropShape="rect"
        />
      )}

      {/* Edit profile modal */}
      {isEditModalOpen && (
        <EditProfileModal
          user={userOnPage}
          onClose={() => setIsEditModalOpen(false)}
          onProfileUpdate={handleProfileUpdate}
        />
      )}

      {/* Delete confirm modal */}
      {showDeleteModal && (
        <ModalBackdrop role="dialog" aria-modal="true">
          <ModalCard>
            <ModalHeader>
              <h3>Delete account</h3>
              <button aria-label="Close" onClick={() => setShowDeleteModal(false)}><FiX /></button>
            </ModalHeader>
            <ModalBody>
              <p>This will permanently delete your account and all of your posts. This action cannot be undone.</p>
              <p>To confirm, type <b>DELETE</b> below:</p>
              <input
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
              />
            </ModalBody>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <PrimaryButton onClick={() => setShowDeleteModal(false)}>Cancel</PrimaryButton>
              <PrimaryButton $primary onClick={doDeleteAccount} disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE'} title="Type DELETE to enable">Delete account</PrimaryButton>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* Badges modal */}
      {showBadgesModal && (
        <ModalBackdrop role="dialog" aria-modal="true" onClick={() => setShowBadgesModal(false)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <h2>Your Badges</h2>
              <button aria-label="Close" onClick={() => setShowBadgesModal(false)}><FiX /></button>
            </ModalHeader>

            <ModalBody>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                Click a badge to equip it to the selected slot. Slot 0 is your <b>Title</b> badge.
              </div>

              <SlotsBar>
                {badges.equipped.map((name, i) => {
                  const meta = badges.catalog.find(b => b.name === name);
                  const emoji = meta?.icon || (name ? '🏅' : '');
                  return (
                    <SlotMini
                      key={i}
                      $active={activeSlot === i}
                      $filled={!!name}
                      $clickable={isOwnProfile}
                      onClick={() => setActiveSlot(i)}
                      title={i === 0 ? 'Title Slot' : `Slot ${i+1}`}
                    >
                      {name ? <BadgeEmoji>{emoji}</BadgeEmoji> : '+'}
                    </SlotMini>
                  );
                })}
                {badges.equipped[activeSlot] && (
                  <PrimaryButton style={{ marginLeft: 'auto' }} onClick={() => equipToSlot(activeSlot, '')}>
                    Unequip
                  </PrimaryButton>
                )}
              </SlotsBar>

              <MenuDivider />

              <BadgeGrid>
                {badges.catalog.map((b) => {
                  const unlocked = badges.unlocked.includes(b.name);
                  const equippedHere = badges.equipped.includes(b.name);
                  return (
                    <BadgeCard
                      key={b.name}
                      $unlocked={unlocked}
                      onClick={() => unlocked && equipToSlot(activeSlot, b.name)}
                      title={unlocked ? `Equip "${b.name}"` : 'Locked'}
                    >
                      <BadgeIcon>{b.icon || '🏅'}</BadgeIcon>
                      <div>
                        <BadgeName>
                          {b.name} {equippedHere ? '• Equipped' : ''}
                        </BadgeName>
                        <BadgeMeta>
                          {unlocked ? 'Unlocked' : 'Locked'}
                        </BadgeMeta>
                      </div>
                    </BadgeCard>
                  );
                })}
              </BadgeGrid>
            </ModalBody>
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* Main page */}
      <Page>
        <BannerWrap>
          <BannerImage src={userOnPage.bannerPicture || DEFAULT_BANNER_DATA} alt="Banner" />
          {isOwnProfile && (
            <>
              <HiddenFileInput type="file" id="bannerUpload" accept="image/*" onChange={(e) => handleFileChange(e, setBannerToCrop)} />
              <BannerEditButton htmlFor="bannerUpload"><FaCamera /> Edit cover photo</BannerEditButton>
            </>
          )}
        </BannerWrap>

        <Content>
          <Header>
            <AvatarWrap>
              <AvatarFrame>
                {userOnPage.profilePicture ? (
                  <AvatarImg src={userOnPage.profilePicture} alt="Profile" />
                ) : (
                  <DefaultAvatar src={TUFFY_DEFAULT_URL} aria-label="Default avatar" />
                )}
              </AvatarFrame>
              {isOwnProfile && (
                <>
                  <HiddenFileInput type="file" id="profilePicUpload" accept="image/*" onChange={(e) => handleFileChange(e, setImageToCrop)} />
                  <AvatarUpload htmlFor="profilePicUpload" title="Change profile picture"><FaCamera /></AvatarUpload>
                </>
              )}
            </AvatarWrap>

            <InfoAndActions>
              <Info>
                <Username>{userOnPage.username}</Username>

                <Stats>
                  <span><strong>{posts.length}</strong> posts</span>

                  {isOwnProfile ? (
                    <button style={{ all: 'unset', cursor: 'pointer', color: '#fff' }} onClick={() => setShowFollowers(true)} title="View your followers">
                      <strong>{userOnPage.followers?.length || 0}</strong> followers
                    </button>
                  ) : (
                    <span style={{ color: '#fff' }}>
                      <strong>{userOnPage.followers?.length || 0}</strong> followers
                    </span>
                  )}

                  {isOwnProfile ? (
                    <button style={{ all: 'unset', cursor: 'pointer', color: '#fff' }} onClick={() => setShowFollowing(true)} title="View who you follow">
                      <strong>{userOnPage.following?.length || 0}</strong> following
                    </button>
                  ) : (
                    <span style={{ color: '#fff' }}>
                      <strong>{userOnPage.following?.length || 0}</strong> following
                    </span>
                  )}
                </Stats>

                {/* ---- Five badge slots under stats ---- */}
                <BadgesRow>
                  {Array.from({ length: 5 }).map((_, i) => {
                    const name = badges.equipped[i];
                    const meta = badges.catalog.find(b => b.name === name);
                    const emoji = meta?.icon || (name ? '🏅' : '');
                    const label = i === 0 ? 'Title' : `Badge ${i+1}`;
                    const clickable = isOwnProfile;
                    return (
                      <SlotWrap key={i}>
                        <BadgeSlot
                          aria-label={label}
                          $filled={!!name}
                          $clickable={clickable}
                          onClick={() => clickable && openBadgesModal(i)}
                          title={clickable ? `Click to set ${label}` : label}
                        >
                          {name ? <BadgeEmoji>{emoji}</BadgeEmoji> : <span style={{ opacity: 0.6 }}>+</span>}
                          <PlusDot $show={isOwnProfile}>+</PlusDot>
                        </BadgeSlot>
                        <SlotLabel>{label}</SlotLabel>
                      </SlotWrap>
                    );
                  })}
                </BadgesRow>

                <Bio>{userOnPage.bio || `Welcome to ${userOnPage.username}'s page!`}</Bio>
              </Info>

              <div ref={settingsRef}>
                {isOwnProfile ? (
                  <SettingsWrap>
                    <SettingsButton aria-label="Settings" onClick={() => setShowSettings((v) => !v)} title="Settings">
                      <FiSettings />
                    </SettingsButton>

                    {showSettings && (
                      <SettingsMenu>
                        <SettingsItem onClick={() => { setIsEditModalOpen(true); setShowSettings(false); }}>
                          <FiSettings /> Edit profile
                        </SettingsItem>
                        <SettingsItem onClick={handleLogout}><FiLogOut /> Log out</SettingsItem>
                        <MenuDivider />
                        <SettingsItem className="danger" onClick={requestDeleteAccount}><FiTrash2 /> Delete account</SettingsItem>
                      </SettingsMenu>
                    )}
                  </SettingsWrap>
                ) : (
                  currentUser && (
                    <PrimaryButton $primary={!isFollowing} onClick={handleFollow}>
                      {isFollowing ? 'Unfollow' : 'Follow'}
                    </PrimaryButton>
                  )
                )}
              </div>
            </InfoAndActions>
          </Header>

          <PostsGrid>
            {posts.map((p) => (
              <Post key={p._id} post={p} onPostUpdated={handlePostUpdated} onPostDeleted={handlePostDeleted} />
            ))}
          </PostsGrid>

          {/* Only allow viewing these lists on your own profile */}
          {isOwnProfile && showFollowers && (
            <FollowersModal
              userId={userOnPage._id}
              me={currentUser}
              type="followers"
              myFollowing={currentUser?.following || []}
              onClose={() => setShowFollowers(false)}
            />
          )}
          {isOwnProfile && showFollowing && (
            <FollowersModal
              userId={userOnPage._id}
              me={currentUser}
              type="following"
              myFollowing={currentUser?.following || []}
              onClose={() => setShowFollowing(false)}
            />
          )}
        </Content>
      </Page>
    </>
  );
};

export default Profile;
