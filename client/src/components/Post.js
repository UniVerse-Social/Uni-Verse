import React, { useState, useContext} from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { FaHeart, FaRegHeart, FaCommentAlt, FaEllipsisH } from 'react-icons/fa';
import axios from 'axios';
import { AuthContext } from '../App';
import { toMediaUrl } from '../config';

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

const PostContainer = styled.div`
  background: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
  padding: 16px;
  margin: 0 0 20px 0;
  width: 100%;
  box-sizing: border-box;
  position: relative;
`;

const PostHeader = styled.div` display: flex; align-items: center; margin-bottom: 12px; `;
const ProfilePic = styled(SmartImg)` width: 42px; height: 42px; border-radius: 50%; background-color: #eee; margin-right: 12px; object-fit: cover; `;
const UserInfo = styled.div` display: flex; flex-direction: column; flex-grow: 1; `;
const Username = styled(Link)` font-weight: 800; color: #111; text-decoration: none; `;
const Timestamp = styled.span` font-size: 12px; color: #6b7280; `;
const PostContent = styled.p` font-size: 16px; line-height: 1.5; margin: 0 0 12px 0; white-space: pre-wrap; word-break: break-word; color: #111; `;
const PostActions = styled.div` display: flex; align-items: center; gap: 20px; color: #374151; `;
const Action = styled.div` display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 14px; `;
const OptionsButton = styled.div` cursor: pointer; padding: 6px; border-radius: 8px; &:hover { background-color: #f3f4f6; } `;
const DropdownMenu = styled.div`
  position: absolute; background: #fff; border-radius: 12px;
  border: 1px solid var(--border-color); box-shadow: 0 12px 28px rgba(0,0,0,0.12); z-index: 10; overflow: hidden;
  top: 44px; right: 16px;
`;
const DropdownItem = styled.div` padding: 12px 16px; cursor: pointer; &:hover { background-color: #f3f4f6; } `;

const MediaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(${p => Math.min(p.$count, 2)}, 1fr);
  gap: 8px;
  margin-bottom: 10px;
  img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    border-radius: 10px; border: 1px solid var(--border-color);
    background: #f8f9fb;
  }
`;

const TUFFY_FALLBACK = '/img/tuffy-default.png';

const Post = ({ post, onPostDeleted, onPostUpdated }) => {
  const { user: currentUser } = useContext(AuthContext);
  const [likeCount, setLikeCount] = useState(post.likes.length);
  const [isLiked, setIsLiked] = useState(currentUser ? post.likes.includes(currentUser._id) : false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isOwner = currentUser && (currentUser._id === post.userId || currentUser.username === post.username);

  const likeHandler = () => {
    if (!currentUser) return;
    try {
      axios.put(`http://localhost:5000/api/posts/${post._id}/like`, { userId: currentUser._id });
    } catch (err) { console.error("Failed to like post", err); }
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
    setIsLiked(!isLiked);
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (window.confirm("Delete this post?")) {
      try {
        await axios.delete(`http://localhost:5000/api/posts/${post._id}`, { data: { userId: currentUser._id } });
        onPostDeleted?.(post._id);
      } catch (err) {
        console.error("Failed to delete post", err);
        alert("Could not delete the post. Please try again.");
      }
    }
  };

  const avatarSrc = post.profilePicture || TUFFY_FALLBACK;

  const images = (post.attachments || [])
    .filter(a => a.type === 'image')
    .map(a => toMediaUrl(a.url));
  if (post.imageUrl && images.length === 0) images.push(toMediaUrl(post.imageUrl)); // legacy

  return (
    <PostContainer className="surface">
      <PostHeader>
        <ProfilePic src={avatarSrc} fallback={TUFFY_FALLBACK} alt="User avatar" />
        <UserInfo>
          <Username to={`/profile/${post.username}`} data-username-link>{post.username}</Username>
          <Timestamp>{new Date(post.createdAt).toLocaleString()}</Timestamp>
        </UserInfo>

        {isOwner && (
          <>
            <OptionsButton onClick={() => setMenuOpen(prev => !prev)} aria-label="More options">
              <FaEllipsisH />
            </OptionsButton>
            {menuOpen && (
              <DropdownMenu onMouseLeave={() => setMenuOpen(false)}>
                <DropdownItem onClick={() => onPostUpdated?.(post)}>Edit Post</DropdownItem>
                <DropdownItem onClick={handleDelete}>Delete Post</DropdownItem>
              </DropdownMenu>
            )}
          </>
        )}
      </PostHeader>

      {post.textContent && <PostContent>{post.textContent}</PostContent>}

      {images.length > 0 && (
        <MediaGrid $count={images.length}>
          {images.map((src, i) => (
            <SmartImg key={i} src={src} fallback="" alt={`post media ${i+1}`} />
          ))}
        </MediaGrid>
      )}

      <PostActions>
        <Action onClick={likeHandler}>
          {isLiked ? <FaHeart color="red" /> : <FaRegHeart />} {likeCount}
        </Action>
        <Action onClick={() => window.dispatchEvent(new CustomEvent('open-comments', { detail: { postId: post._id } }))}>
          <FaCommentAlt /> Comments
        </Action>
      </PostActions>
    </PostContainer>
  );
};

export default Post;
