import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../App';
import Post from '../components/Post';
import EditProfileModal from '../components/EditProfileModal';
import ImageCropModal from '../components/ImageCropModal';
import { FaCamera } from 'react-icons/fa';
import { FiSettings, FiLogOut, FiTrash2, FiX } from 'react-icons/fi';
import FollowersModal from '../components/FollowersModal';
import { API_BASE_URL, TUFFY_DEFAULT_URL, DEFAULT_BANNER_URL, toMediaUrl } from '../config';

// Stick-with-fallback image component (now a11y-safe)
function SmartImg({ src, fallback, alt = '', ...imgProps }) {
  const [useSrc, setUseSrc] = React.useState(src || fallback);
  const [errored, setErrored] = React.useState(false);
  const prev = React.useRef(src);

  React.useEffect(() => {
    if (prev.current !== src) {
      prev.current = src;
      setErrored(false);
      setUseSrc(src || fallback);
    }
  }, [src, fallback]);

  return (
    <img
      alt={alt}
      {...imgProps}
      src={useSrc || fallback}
      onError={() => {
        if (!errored) {
          setErrored(true);
          setUseSrc(fallback);
        }
      }}
    />
  );
}

/* ——— Styles ——— */
const Page = styled.div` background: var(--background-grey); color: var(--text-color); min-height: 100vh; `;
const Content = styled.div` max-width: 975px; margin: 0 auto; padding: 0 20px; `;
const BannerWrap = styled.div`
  position: relative; height: 350px; background-color: var(--border-color);
  border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; overflow: hidden;
`;
const BannerImage = styled(SmartImg)` width: 100%; height: 100%; object-fit: cover; display:block; `;
const BannerEditButton = styled.label`
  position: absolute; bottom: 16px; right: 16px; background-color: rgba(255,255,255,0.9);
  color: #333; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;
  font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all .2s;
  &:hover { background-color: #fff; transform: translateY(-2px); }
`;
const HiddenFileInput = styled.input` display: none; `;
const Header = styled.div`
  display: flex; align-items: flex-end; gap: 20px; padding: 0 20px 20px 20px; margin-top: -80px; position: relative;
  border-bottom: 1px solid var(--border-color); margin-bottom: 20px;
`;
const AvatarWrap = styled.div` position: relative; width: 168px; height: 168px; flex-shrink: 0; `;
const AvatarFrame = styled.div`
  width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
  border: 4px solid #f0f2f5; box-shadow: 0 4px 12px rgba(0,0,0,0.1); background: #fff;
`;
const AvatarImg = styled(SmartImg)` width: 100%; height: 100%; object-fit: cover; display:block; `;
const AvatarUpload = styled.label`
  position: absolute; bottom: 10px; right: 10px; background-color: var(--border-color); color: var(--text-color);
  width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; border: 2px solid var(--container-white);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all .2s; &:hover { filter: brightness(0.95); }
`;
const InfoAndActions = styled.div` flex-grow: 1; display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 10px; `;
const Info = styled.div` padding-top: 80px; `;
const Username = styled.h2` font-size: 32px; font-weight: 800; margin: 0 0 4px 0; color:#fff; `;
const Stats = styled.div` display: flex; gap: 20px; font-size: 16px; color: #e5e7eb; margin-bottom: 4px; `;
const Bio = styled.p` margin: 0; color: #f3f4f6; font-size: 16px; `;
const PrimaryButton = styled.button`
  padding: 10px 20px; border-radius: 10px; font-weight: 700; font-size: 16px; cursor: pointer;
  background-color: ${p=>p.$primary ? '#1877f2' : '#e4e6eb'}; color: ${p=>p.$primary ? 'white' : '#333'};
  border: none; transition: filter .2s; &:hover { filter: brightness(.95); }
`;
const PostsGrid = styled.div` padding-top: 20px; `;
const SettingsWrap = styled.div` position: relative; display: inline-block; margin-left: 10px; `;
const SettingsButton = styled.button`
  display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 8px;
  border: 1px solid var(--border-color); background: var(--container-white); cursor: pointer; color: var(--text-color);
  &:hover {background color: white;}
`;
const SettingsMenu = styled.div`
  position: absolute; top: 48px; right: 0; z-index: 20; background: var(--container-white); border: 1px solid var(--border-color);
  border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); min-width: 240px; overflow: hidden; padding: 6px 0;
`;
const SettingsItem = styled.button`
  width: 100%; padding: 12px 14px; text-align: left; display: flex; gap: 10px; align-items: center; border: none;
  background: var(--container-white); cursor: pointer; font-weight: 700; color: ${p => (p.className?.includes('danger') ? '#b00020' : 'var(--text-color)')};
  &:hover { background: rgba(0,0,0,0.04); }
`;
const ModalBackdrop = styled.div` position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: grid; place-items: center; z-index: 50; `;
const ModalCard = styled.div`
  background: var(--container-white); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2); width: min(520px, 92vw); padding: 18px;
`;
const ModalHeader = styled.div` display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; h3 { margin: 0; font-size: 18px; } button { border: none; background: transparent; cursor: pointer; font-size: 20px; color: #666; &:hover { color: #000; } }`;
const MenuDivider = styled.div` height: 1px; background: #eee; margin: 6px 0; `;
const ModalBody = styled.div` font-size: 14px; color: #333; p { margin: 0 0 12px 0; } input { width: 100%; padding: 10px 12px; border: 1px solid #e4e6eb; border-radius: 8px; }`;
const ModalActions = styled.div` display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; `;

const Profile = () => {
  const [userOnPage, setUserOnPage] = useState(null);
  const [posts, setPosts] = useState([]);
  const { username } = useParams();
  const { user: currentUser, login } = useContext(AuthContext);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [bannerToCrop, setBannerToCrop] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  const fetchUserAndPosts = useCallback(async () => {
    try {
      const userRes = await axios.get(`${API_BASE_URL}/api/users/profile/${username}`);
      const postsRes = await axios.get(`${API_BASE_URL}/api/posts/profile/${username}`);
      setUserOnPage(userRes.data);
      setPosts(postsRes.data);
    } catch (err) {
      console.error('Error fetching profile data:', err);
    }
  }, [username]);

  useEffect(() => { fetchUserAndPosts(); }, [fetchUserAndPosts]);

  useEffect(() => {
    if (userOnPage && currentUser) {
      setIsFollowing(Array.isArray(userOnPage.followers) && userOnPage.followers.includes(currentUser._id));
    }
  }, [userOnPage, currentUser]);

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

  const handleFileChange = (e, setImageState) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImageToCrop(reader.result);
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const handleCropComplete = async (croppedImageBlobUrl, imageType) => {
    try {
      const response = await fetch(croppedImageBlobUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result;
        const res = await axios.put(`${API_BASE_URL}/api/users/${currentUser._id}`, {
          userId: currentUser._id,
          [imageType]: base64data,
        });
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

  const handleProfileUpdate = (updatedUserData) => setUserOnPage(updatedUserData);

  const handleFollow = async () => {
    if (!userOnPage || !currentUser) return;
    try {
      await axios.put(`${API_BASE_URL}/api/users/${userOnPage._id}/follow`, { userId: currentUser._id });
      fetchUserAndPosts();
    } catch (err) { console.error('Failed to follow/unfollow:', err); }
  };

  const handlePostUpdated = (updatedPost) => setPosts((curr) => curr.map((p) => (p._id === updatedPost._id ? updatedPost : p)));
  const handlePostDeleted = (postId) => setPosts((curr) => curr.filter((p) => p._id !== postId));

  const handleLogout = () => { try { localStorage.clear(); } finally { window.location.href = '/login'; } };

  const requestDeleteAccount = () => { setDeleteConfirmText(''); setShowDeleteModal(true); setShowSettings(false); };
  const doDeleteAccount = async () => {
    if (!currentUser) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') { alert('Please type DELETE to confirm.'); return; }
    try {
      await axios.delete(`${API_BASE_URL}/api/users/${currentUser._id}`, { data: { userId: currentUser._id } });
    } catch (err) {
      console.error('Failed to delete account', err);
      alert('Failed to delete account.'); return;
    }
    handleLogout();
  };

  if (!userOnPage) return <Page>Loading...</Page>;

  const isOwnProfile = currentUser && currentUser.username === username;

  // Resolve potential /uploads/... paths to the API host ONCE here
  const avatarSrc = userOnPage.profilePicture ? toMediaUrl(userOnPage.profilePicture) : TUFFY_DEFAULT_URL;
  const bannerSrc = userOnPage.bannerPicture ? toMediaUrl(userOnPage.bannerPicture) : DEFAULT_BANNER_URL;

  return (
    <>
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

      {isEditModalOpen && (
        <EditProfileModal
          user={userOnPage}
          onClose={() => setIsEditModalOpen(false)}
          onProfileUpdate={handleProfileUpdate}
        />
      )}

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
              <input autoFocus value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="Type DELETE to confirm" />
            </ModalBody>
            <ModalActions>
              <PrimaryButton onClick={() => setShowDeleteModal(false)}>Cancel</PrimaryButton>
              <PrimaryButton $primary onClick={doDeleteAccount} disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE'} title="Type DELETE to enable">Delete account</PrimaryButton>
            </ModalActions>
          </ModalCard>
        </ModalBackdrop>
      )}

      <Page>
        <BannerWrap>
          <BannerImage src={bannerSrc} fallback={DEFAULT_BANNER_URL} alt="Banner" />
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
                <AvatarImg src={avatarSrc} fallback={TUFFY_DEFAULT_URL} alt="Profile" />
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

          {showFollowers && (
            <FollowersModal
              userId={userOnPage._id}
              me={currentUser}
              type="followers"
              myFollowing={currentUser?.following || []}
              onClose={() => setShowFollowers(false)}
            />
          )}
          {showFollowing && (
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
