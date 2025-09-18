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

// --------------------------- Styled Components ---------------------------

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
  height: 350px;
  background-color: var(--border-color); /* was #d1d5db */
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

  &:hover {
    background-color: #fff;
    transform: translateY(-2px);
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

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
  background:
    #fff
    url(${(p) => p.src}) center / 150% no-repeat;
`;

const AvatarUpload = styled.label`
  position: absolute;
  bottom: 10px;
  right: 10px;
  background-color: var(--border-color); /* was #e4e6eb */
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

const Info = styled.div`
  padding-top: 80px;
`;

const Username = styled.h2`
  font-size: 32px;
  font-weight: 700;
  color: '#fff';
  margin: 0 0 4px 0;
`;

const Stats = styled.div`
  display: flex;
  gap: 20px;
  font-size: 16px;
  color: #fff;
  margin-bottom: 4px;
`;

const Bio = styled.p`
  margin: 0;
  color: #fff;
  font-size: 16px;
`;

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

const PostsGrid = styled.div`
  padding-top: 20px;
`;

// ---------- Settings UI (gear + dropdown) ----------

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
  &:hover { background: orange }
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

// ---------- Confirm Modal (for delete) ----------

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
  width: min(520px, 92vw);
  padding: 18px;
`;

const ModalHeader = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
  h3 { margin: 0; font-size: 18px; }
  button {
    border: none; background: transparent; cursor: pointer; font-size: 20px; color: #666;
    &:hover { color: #000; }
  }
`;

const MenuDivider = styled.div`
  height: 1px;
  background: #eee;
  margin: 6px 0;
`;

const ModalBody = styled.div`
  font-size: 14px; color: #333;
  p { margin: 0 0 12px 0; }
  input {
    width: 100%; padding: 10px 12px; border: 1px solid #e4e6eb; border-radius: 8px;
  }
`;

const ModalActions = styled.div`
  display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;
`;

// --------------------------- Constants ---------------------------

const TUFFY_DEFAULT_URL =
  'https://www.clipartmax.com/png/middle/72-721825_tuffy-tuffy-the-titan-csuf.png';
const DEFAULT_BANNER_DATA =
  'https://dslv9ilpbe7p1.cloudfront.net/jT7zrQp7WtGXTdoT3rpLxg_store_banner_image.jpeg';

// --------------------------- Component ---------------------------

const Profile = () => {
  // Core state
  const [userOnPage, setUserOnPage] = useState(null);
  const [posts, setPosts] = useState([]);
  const { username } = useParams();
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

  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  // Fetch profile and posts
  const fetchUserAndPosts = useCallback(async () => {
    try {
      const userRes = await axios.get(
        `http://localhost:5000/api/users/profile/${username}`
      );
      const postsRes = await axios.get(
        `http://localhost:5000/api/posts/profile/${username}`
      );
      setUserOnPage(userRes.data);
      setPosts(postsRes.data);
    } catch (err) {
      console.error('Error fetching profile data:', err);
    }
  }, [username]);

  useEffect(() => {
    fetchUserAndPosts();
  }, [fetchUserAndPosts]);

  // Follow state
  useEffect(() => {
    if (userOnPage && currentUser) {
      setIsFollowing(
        Array.isArray(userOnPage.followers) &&
          userOnPage.followers.includes(currentUser._id)
      );
    }
  }, [userOnPage, currentUser]);

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
          {
            userId: currentUser._id,
            [imageType]: base64data,
          }
        );
        // persist new user in context + page
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
  const handleProfileUpdate = (updatedUserData) => {
    setUserOnPage(updatedUserData);
  };

  // Follow/unfollow
  const handleFollow = async () => {
    if (!userOnPage || !currentUser) return;
    try {
      await axios.put(
        `http://localhost:5000/api/users/${userOnPage._id}/follow`,
        { userId: currentUser._id }
      );
      fetchUserAndPosts();
    } catch (err) {
      console.error('Failed to follow/unfollow:', err);
    }
  };

  // Post update/delete handlers (passed to <Post/>)
  const handlePostUpdated = (updatedPost) => {
    setPosts((current) =>
      current.map((p) => (p._id === updatedPost._id ? updatedPost : p))
    );
  };
  const handlePostDeleted = (postId) => {
    setPosts((current) => current.filter((p) => p._id !== postId));
  };

  // Logout
  const handleLogout = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.clear();
      }
    } finally {
      window.location.href = '/login';
    }
  };

  // Delete account flow (double confirmation)
  const requestDeleteAccount = () => {
    setDeleteConfirmText('');
    setShowDeleteModal(true);
    setShowSettings(false);
  };

  const doDeleteAccount = async () => {
    if (!currentUser) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      alert('Please type DELETE to confirm.');
      return;
    }
    try {
      await axios.delete(`http://localhost:5000/api/users/${currentUser._id}`, {
        data: { userId: currentUser._id },
      });
    } catch (err) {
      console.error('Failed to delete account', err);
      alert('Failed to delete account.');
      return;
    }
    handleLogout();
  };

  // Render guard
  if (!userOnPage) {
    return <Page>Loading...</Page>;
  }

  const isOwnProfile = currentUser && currentUser.username === username;

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
              <button aria-label="Close" onClick={() => setShowDeleteModal(false)}>
                <FiX />
              </button>
            </ModalHeader>
            <ModalBody>
              <p>
                This will permanently delete your account and all of your posts.
                This action cannot be undone.
              </p>
              <p>
                To confirm, type <b>DELETE</b> below:
              </p>
              <input
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
              />
            </ModalBody>
            <ModalActions>
              <PrimaryButton onClick={() => setShowDeleteModal(false)}>
                Cancel
              </PrimaryButton>
              <PrimaryButton
                $primary
                onClick={doDeleteAccount}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                title="Type DELETE to enable"
              >
                Delete account
              </PrimaryButton>
            </ModalActions>
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* Main page */}
      <Page>
        <BannerWrap>
          <BannerImage
            src={userOnPage.bannerPicture || DEFAULT_BANNER_DATA}
            alt="Banner"
          />
          {isOwnProfile && (
            <>
              <HiddenFileInput
                type="file"
                id="bannerUpload"
                accept="image/*"
                onChange={(e) => handleFileChange(e, setBannerToCrop)}
              />
              <BannerEditButton htmlFor="bannerUpload">
                <FaCamera /> Edit cover photo
              </BannerEditButton>
            </>
          )}
        </BannerWrap>

        <Content>
          <Header>
            <AvatarWrap>
              <AvatarFrame>
                {userOnPage.profilePicture ? (
                  <AvatarImg
                    src={userOnPage.profilePicture}
                    alt="Profile"
                  />
                ) : (
                  <DefaultAvatar src={TUFFY_DEFAULT_URL} aria-label="Default avatar" />
                )}
              </AvatarFrame>
              {isOwnProfile && (
                <>
                  <HiddenFileInput
                    type="file"
                    id="profilePicUpload"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setImageToCrop)}
                  />
                  <AvatarUpload htmlFor="profilePicUpload" title="Change profile picture">
                    <FaCamera />
                  </AvatarUpload>
                </>
              )}
            </AvatarWrap>

            <InfoAndActions>
              <Info>
                <Username>{userOnPage.username}</Username>
              <Stats>
                <span><strong>{posts.length}</strong> posts</span>

                {isOwnProfile ? (
                  <button
                    style={{ all: 'unset', cursor: 'pointer', color: '#fff' }}
                    onClick={() => setShowFollowers(true)}
                    title="View your followers"
                  >
                    <strong>{userOnPage.followers?.length || 0}</strong> followers
                  </button>
                ) : (
                  <span style={{ color: '#fff' }}>
                    <strong>{userOnPage.followers?.length || 0}</strong> followers
                  </span>
                )}

                {isOwnProfile ? (
                  <button
                    style={{ all: 'unset', cursor: 'pointer', color: '#fff' }}
                    onClick={() => setShowFollowing(true)}
                    title="View who you follow"
                  >
                    <strong>{userOnPage.following?.length || 0}</strong> following
                  </button>
                ) : (
                  <span style={{ color: '#fff' }}>
                    <strong>{userOnPage.following?.length || 0}</strong> following
                  </span>
                )}
              </Stats>
                <Bio>
                  {userOnPage.bio || `Welcome to ${userOnPage.username}'s page!`}
                </Bio>
              </Info>

              <div ref={settingsRef}>
                {isOwnProfile ? (
                  <SettingsWrap>
                    <SettingsButton
                      aria-label="Settings"
                      onClick={() => setShowSettings((v) => !v)}
                      title="Settings"
                    >
                      <FiSettings />
                    </SettingsButton>

                    {showSettings && (
                  <SettingsMenu>
                    <SettingsItem onClick={() => { setIsEditModalOpen(true); setShowSettings(false); }}>
                      <FiSettings /> Edit profile
                    </SettingsItem>

                    <SettingsItem onClick={handleLogout}>
                      <FiLogOut /> Log out
                    </SettingsItem>

                    <MenuDivider />

                    <SettingsItem
                      className="danger"
                      onClick={requestDeleteAccount}
                    >
                      <FiTrash2 /> Delete account
                    </SettingsItem>
                  </SettingsMenu>
                    )}
                  </SettingsWrap>
                ) : (
                  currentUser && (
                    <PrimaryButton
                      $primary={!isFollowing}
                      onClick={handleFollow}
                    >
                      {isFollowing ? 'Unfollow' : 'Follow'}
                    </PrimaryButton>
                  )
                )}
              </div>
            </InfoAndActions>
          </Header>

          <PostsGrid>
            {posts.map((p) => (
              <Post
                key={p._id}
                post={p}
                onPostUpdated={handlePostUpdated}
                onPostDeleted={handlePostDeleted}
              />
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
