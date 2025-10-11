import React, { useContext, useMemo, useState, useCallback } from 'react';
import styled from 'styled-components';
import {
  FaHeart,
  FaRegHeart,
  FaCommentAlt,
  FaRegCommentAlt,
  FaTrash,
} from 'react-icons/fa';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';
import UserLink from './UserLink';
import ClubCommentDrawer from './ClubCommentDrawer';

const ICON_SIZE = 16;
const HEART_COLOR = '#ef4444';
const COMMENT_COLOR = '#2563eb';

const Card = styled.div`
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Avatar = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 50%;
  overflow: hidden;
  background: #f2f2f2;
  display: grid;
  place-items: center;
  font-weight: 700;
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const TitleBadge = styled.span`
  font-size: 11px;
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

const Body = styled.div`
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 15px;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  color: #374151;
`;

const Action = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
`;

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

const formatRelativeLabel = (createdAt) => {
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return '';
  const now = new Date();
  const diffMs = now - createdDate;
  if (diffMs < 0) return 'Just now';
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
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

export default function ClubPostCard({ post, refresh }) {
  const { user } = useContext(AuthContext);
  const [likeCount, setLikeCount] = useState((post.likes || []).length || 0);
  const [isLiked, setIsLiked] = useState(Boolean(post.viewerLiked));
  const initialPreview = post.commentPreview
    ? {
        ...post.commentPreview,
        snippet: makeSnippet(post.commentPreview.body ?? post.commentPreview.snippet ?? ''),
      }
    : null;
  const [commentPreview, setCommentPreview] = useState(initialPreview);
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [hasCommented, setHasCommented] = useState(Boolean(post.viewerCommented));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const titleBadge = useMemo(() => {
    if (post.author?.titleBadge) return post.author.titleBadge;
    if (Array.isArray(post.author?.badgesEquipped) && post.author.badgesEquipped.length) {
      return post.author.badgesEquipped[0];
    }
    return null;
  }, [post.author]);

  const createdDate = useMemo(() => {
    const d = new Date(post.createdAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [post.createdAt]);
  const dateLabel = useMemo(() => formatRelativeLabel(post.createdAt), [post.createdAt]);
  const lastEdited = useMemo(() => {
    if (!post.updatedAt || post.updatedAt === post.createdAt) return null;
    const d = new Date(post.updatedAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [post.updatedAt, post.createdAt]);

  const toggleLike = async () => {
    try {
      await axios.put(`${API_BASE_URL}/api/club-posts/${post._id}/like`, { userId: user._id });
      setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
      setIsLiked((prev) => !prev);
      refresh?.();
    } catch (e) {
      console.error('Failed to toggle like', e);
    }
  };

  const deletePost = async () => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/club-posts/${post._id}`, { data: { userId: user._id } });
      refresh?.();
    } catch (e) {
      console.error('Failed to delete post', e);
    }
  };

  const handlePreviewChange = useCallback((payload) => {
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

  const handleViewerCommented = useCallback(() => {
    setHasCommented(true);
  }, []);

  return (
    <Card className="surface">
      <Head>
        <Avatar>
          {post.author?.profilePicture ? (
            <img src={post.author.profilePicture} alt={post.author?.username || 'user'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            (post.author?.username || '?').slice(0,1).toUpperCase()
          )}
        </Avatar>
        <div>
          <NameRow>
            <UserLink username={post.author?.username || 'user'}>
              {post.author?.username || 'user'}
            </UserLink>
            {titleBadge && <TitleBadge>{titleBadge}</TitleBadge>}
            <span style={{ fontSize: 12, color: '#6b7280' }}>{post.channel === 'main' ? 'Main' : (post.sideChannelName || 'Side')}</span>
          </NameRow>
          <Timestamp>
            {dateLabel && <DateLabel>{dateLabel}</DateLabel>}
            <span>{createdDate ? createdDate.toLocaleString() : ''}</span>
            {lastEdited && (
              <EditedStamp title={`Edited on ${lastEdited.toLocaleString()}`}>
                · Edited on {lastEdited.toLocaleString()}
              </EditedStamp>
            )}
          </Timestamp>
        </div>
        {(String(post.authorId) === String(user._id)) && (
          <span style={{ marginLeft: 'auto', cursor: 'pointer' }} onClick={deletePost} title="Delete post">
            <FaTrash />
          </span>
        )}
      </Head>

      {post.text && <Body>{post.text}</Body>}

      <Actions>
        <Action onClick={toggleLike}>
          {isLiked ? (
            <FaHeart size={ICON_SIZE} color={HEART_COLOR} />
          ) : (
            <FaRegHeart size={ICON_SIZE} color={HEART_COLOR} />
          )}
          {likeCount}
        </Action>

        <Action onClick={() => setDrawerOpen(true)} title="View comments" style={{ flex: 1 }}>
          {hasCommented ? (
            <FaCommentAlt size={ICON_SIZE} color={COMMENT_COLOR} />
          ) : (
            <FaRegCommentAlt size={ICON_SIZE} color={COMMENT_COLOR} />
          )}
          {commentCount}
          {commentCount > 0 && commentPreview && (
            <CommentPreviewInline title={`${commentPreview.username} — ${commentPreview.snippet}`}>
              {commentPreview.username} — {commentPreview.snippet}
            </CommentPreviewInline>
          )}
        </Action>
      </Actions>

      {drawerOpen && (
        <ClubCommentDrawer
          post={post}
          onClose={() => setDrawerOpen(false)}
          onCountChange={setCommentCount}
          onPreviewChange={handlePreviewChange}
          onViewerCommented={handleViewerCommented}
        />
      )}
    </Card>
  );
}