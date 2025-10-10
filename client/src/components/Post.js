import React, { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { FaHeart, FaRegHeart, FaCommentAlt, FaRegCommentAlt, FaEllipsisH } from 'react-icons/fa';
import axios from 'axios';
import { AuthContext } from '../App';
import { toMediaUrl, API_BASE_URL } from '../config';
import EditPostModal from './EditPostModal';
import CommentDrawer from './CommentDrawer';



/* Hardcoded default avatar (always available) */
const FALLBACK_AVATAR =
  'https://www.clipartmax.com/png/middle/72-721825_tuffy-tuffy-the-titan-csuf.png';

/* Stick-with-fallback image */
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

const UsernameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const Username = styled(Link)` font-weight: 800; color: #111; text-decoration: none; `;

const TitleBadge = styled.span`
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #111;
  border: 1px solid var(--border-color);
`;

const Timestamp = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
  flex-wrap: wrap;
`;
const DateLabel = styled.span`
  font-weight: 600;
  color: #374151;
`;
const EditedStamp = styled.span`
  font-size: 11px;
  color: #9ca3af;
`;
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

const CommentPreviewInline = styled.span`
  color: #64748b;
  font-size: 12px;
  margin-left: 8px;
  flex: 1;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DAY_MS = 1000 * 60 * 60 * 24;

const formatRelativeLabel = (createdAt) => {
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return '';
  const now = new Date();
  const diffMs = now - createdDate;
  if (diffMs < 0) return 'Just now';
  const diffDays = Math.floor(diffMs / DAY_MS);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 4) return `${diffDays} days ago`;
  if (diffDays < 7) return '1 week ago';
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 8) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
};

const makeSnippet = (body) => {
  const cleaned = String(body || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
};
const ICON_SIZE = 16;
const HEART_COLOR = "#ef4444";
const COMMENT_COLOR = "#2563eb";

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

const Post = ({ post, onPostDeleted, onPostUpdated }) => {
  const { user: currentUser } = useContext(AuthContext);
  const [likeCount, setLikeCount] = useState(post.likes.length);
  const [isLiked, setIsLiked] = useState(currentUser ? post.likes.includes(currentUser._id) : false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [textContent, setTextContent] = useState(post.textContent);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(
    typeof post.commentCount === 'number'
      ? post.commentCount
      : Array.isArray(post.comments)
        ? post.comments.length
        : 0
  );
  const initialPreview = post.commentPreview
    ? {
        ...post.commentPreview,
        snippet: makeSnippet(post.commentPreview.body ?? post.commentPreview.snippet ?? ''),
      }
    : null;
  const [commentPreview, setCommentPreview] = useState(initialPreview);
  const [hasCommented, setHasCommented] = useState(Boolean(post.viewerCommented));
  const initialEdited =
    post.updatedAt && post.updatedAt !== post.createdAt ? new Date(post.updatedAt) : null;
  const [lastEdited, setLastEdited] = useState(initialEdited);

  const applyPreview = useCallback((payload) => {
    if (!payload) {
      setCommentPreview(null);
      return;
    }
    const snippet = makeSnippet(payload.body ?? payload.snippet ?? '');
    if (!snippet) {
      setCommentPreview(null);
      return;
    }
    setCommentPreview({
      type: payload.type === 'top' ? 'top' : 'latest',
      username: payload.username || 'user',
      snippet,
    });
  }, []);

  useEffect(() => {
    if (typeof post.commentCount === 'number') {
      setCommentCount(post.commentCount);
    }
    if (post.commentPreview) {
      applyPreview(post.commentPreview);
    } else {
      setCommentPreview(null);
    }
    if (typeof post.viewerCommented === 'boolean') {
      setHasCommented(post.viewerCommented);
    }
    if (post.updatedAt && post.updatedAt !== post.createdAt) {
      setLastEdited(new Date(post.updatedAt));
    } else {
      setLastEdited(null);
    }
  }, [post.commentCount, post.commentPreview, post.viewerCommented, post.updatedAt, post.createdAt, applyPreview]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const viewerParam = currentUser?._id ? `?viewerId=${encodeURIComponent(currentUser._id)}` : '';
        const res = await axios.get(`${API_BASE_URL}/api/comments/post/${post._id}/count${viewerParam}`);
        if (!cancelled) {
          const count = Number(res.data?.count) || 0;
          setCommentCount(count);
          applyPreview(count > 0 ? res.data?.preview : null);
          setHasCommented(Boolean(res.data?.userCommented));
        }
      } catch (err) {
        console.error('Failed to load comment count', err);
      }
    })();
    return () => { cancelled = true; };
  }, [post._id, applyPreview, currentUser?._id]);

  const handleViewerCommented = useCallback(() => {
    setHasCommented(true);
  }, []);

  const handleModalUpdated = useCallback((updated) => {
    setTextContent(updated.textContent);
    setLastEdited(updated.updatedAt ? new Date(updated.updatedAt) : new Date());
    setEditOpen(false);
    const merged = {
      ...post,
      textContent: updated.textContent,
      updatedAt: updated.updatedAt,
    };
    onPostUpdated?.(merged);
  }, [post, onPostUpdated]);

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

  const createdDate = useMemo(() => {
    const d = new Date(post.createdAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [post.createdAt]);
  const dateLabel = useMemo(() => formatRelativeLabel(post.createdAt), [post.createdAt]);

  /* Use custom avatar if provided; otherwise the hardcoded fallback */
  const avatarSrc =
    post.profilePicture && String(post.profilePicture).trim()
      ? toMediaUrl(post.profilePicture)
      : FALLBACK_AVATAR;

  const images = (post.attachments || [])
    .filter(a => a.type === 'image')
    .map(a => toMediaUrl(a.url));
  if (post.imageUrl && images.length === 0) images.push(toMediaUrl(post.imageUrl)); // legacy

  return (
    <PostContainer className="surface">
      <PostHeader>
        <ProfilePic src={avatarSrc} fallback={FALLBACK_AVATAR} alt="User avatar" />
        <UserInfo>
          <UsernameRow>
            <Username to={`/profile/${post.username}`} data-username-link>{post.username}</Username>
            {!!post.titleBadge && <TitleBadge>{post.titleBadge}</TitleBadge>}
          </UsernameRow>
          <Timestamp>
            {dateLabel && <DateLabel>{dateLabel}</DateLabel>}
            <span>{createdDate ? createdDate.toLocaleString() : ''}</span>
            {lastEdited && (
              <EditedStamp title={`Edited on ${lastEdited.toLocaleString()}`}>
                · Edited on {lastEdited.toLocaleString()}
              </EditedStamp>
            )}
          </Timestamp>
        </UserInfo>

        {isOwner && (
          <>
            <OptionsButton onClick={() => setMenuOpen(prev => !prev)} aria-label="More options">
              <FaEllipsisH />
            </OptionsButton>
            {menuOpen && (
              <DropdownMenu onMouseLeave={() => setMenuOpen(false)}>
                <DropdownItem onClick={() => { setMenuOpen(false); setEditOpen(true); }} > Edit Post </DropdownItem>
                <DropdownItem onClick={handleDelete}>Delete Post</DropdownItem>
              </DropdownMenu>
            )}
          </>
        )}
      </PostHeader>

      {textContent && <PostContent>{textContent}</PostContent>}


      {images.length > 0 && (
        <MediaGrid $count={images.length}>
          {images.map((src, i) => (
            <SmartImg key={i} src={src} fallback="" alt={`post media ${i + 1}`} />
          ))}
        </MediaGrid>
      )}
                
      <PostActions>
        <Action onClick={likeHandler}>
          {isLiked ? <FaHeart size={ICON_SIZE} color={HEART_COLOR} /> : <FaRegHeart size={ICON_SIZE} color={HEART_COLOR} />} {likeCount}
        </Action>
        <Action onClick={() => {setCommentsOpen(true)}} title="View comments" style={{ flex: 1 }}> 
          {hasCommented
            ? <FaCommentAlt size={ICON_SIZE} color="#2563eb" />
            : <FaRegCommentAlt size={ICON_SIZE} color="#2563eb" />} {commentCount}
          {commentCount > 0 && commentPreview && (
            <CommentPreviewInline title={`${commentPreview.username} — ${commentPreview.snippet}`}>
              {commentPreview.username} — {commentPreview.snippet}
            </CommentPreviewInline>
          )}
        </Action>
      </PostActions>
      
      {editOpen && (    // v edit post button   //open comments button^
        <EditPostModal
          post={{ ...post, textContent }}
          onClose={() => setEditOpen(false)}  
          onPostUpdated={handleModalUpdated}
        />
      )}

      {commentsOpen && (
        <CommentDrawer
          post={post}           // Comment Drawer
          onClose={() => setCommentsOpen(false)}
          onCountChange={setCommentCount}
          onPreviewChange={applyPreview}
          onViewerCommented={handleViewerCommented}
        />
      )}
    </PostContainer>
  );
};

export default Post;
