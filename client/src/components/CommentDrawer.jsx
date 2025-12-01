import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import axios from 'axios';
import { FaHeart, FaRegHeart, FaTrash, FaPlus } from 'react-icons/fa';
import { AuthContext } from '../App';
import { API_BASE_URL, toMediaUrl } from '../config';
import UserLink from './UserLink';
import {
  COMMENT_CHAR_LIMIT,
  MAX_TEXTAREA_NEWLINES,
} from '../constants/profileLimits';
import { applyTextLimits } from '../utils/textLimits';
import CharCount from './CharCount';

const Backdrop = styled.div`
  --gutter: clamp(16px, 4vh, 32px);
  --topbar-offset: var(--fc-topbar-height, 72px);
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.45);
  z-index: 4200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: calc(var(--topbar-offset) + var(--gutter)) var(--gutter) var(--gutter);
  overflow-y: auto;
  overscroll-behavior: contain;
`;
const Drawer = styled.aside`
  width: min(920px, 96vw);
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: calc(100vh - (var(--topbar-offset) + var(--gutter) * 2));

  @supports (height: 100dvh) {
    max-height: calc(100dvh - (var(--topbar-offset) + var(--gutter) * 2));
  }

  @media (max-width: 640px) {
    width: min(100%, 600px);
    border-radius: 14px;
  }
`;
const Header = styled.div`position:relative; padding:14px 16px; border-bottom:1px solid #eee; font-weight:600;`;
const CloseButton = styled.button`
  position:absolute; top:10px; right:10px;
  width:36px; height:36px;
  display:flex; align-items:center; justify-content:center;
  border-radius:10px; border:1px solid #e5e7eb; background:#fff; cursor:pointer;
  font-size:18px; line-height:1;
  &:hover { background:#f9fafb; }
`;

// --- Original Post block ---
const OPWrapper = styled.div`
  position: sticky; top:0; z-index:1; background:#fff; border-bottom:1px solid #eee;
`;
const OPInner = styled.div`padding:14px 16px;`;
const OPTitle = styled.div`font-weight:600; font-size:14px; color:#374151; margin-bottom:6px;`;
const OPText = styled.div`font-size:14px; color:#111827; white-space:pre-wrap;`;
const OPGrid = styled.div`
  margin-top:10px;
  display:grid; gap:8px;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
`;
const OPImg = styled.img`
  width:100%; height:160px; object-fit:cover; border-radius:10px; border:1px solid #eee;
`;

const PortalTarget = typeof document !== 'undefined' ? document.body : null;

/** Robust post text extraction (covers more fields) */
function getPostText(p) {
  const candidates = [p?.body, p?.text, p?.content, p?.caption, p?.message, p?.description];
  return candidates.find(v => typeof v === 'string' && v.trim()) || '';
}

/** Normalize to full URLs and accept common shapes (string | {url,type}) */
function extractImageUrls(p) {
  if (!p) return [];
  const candidates = [p.photos, p.images, p.media, p.attachments, p.files];
  const urls = [];
  for (const arr of candidates) {
    if (!arr) continue;
    for (const it of arr) {
      if (typeof it === 'string') {
        if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(it)) urls.push(toMediaUrl(it));
      } else if (it?.url && (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(it.url) || /image/i.test(it.type || ''))) {
        urls.push(toMediaUrl(it.url));
      }
    }
  }
  return urls;
}

function OriginalPost({ post }) {
  const imgs = extractImageUrls(post);
  const rawText = getPostText(post);
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(rawText); // render HTML if present

  return (
    <OPWrapper>
      <OPInner>
        <OPTitle>Original Post{post?.username ? ` — ${post.username}` : ''}</OPTitle>
        {looksLikeHtml
          ? <OPText dangerouslySetInnerHTML={{ __html: rawText }} />
          : <OPText>{rawText}</OPText>}
        {imgs.length > 0 && (
          <OPGrid>
            {imgs.map((src, i) => <OPImg key={src + i} src={src} alt={`post image ${i+1}`} loading="lazy" />)}
          </OPGrid>
        )}
      </OPInner>
    </OPWrapper>
  );
}

const List = styled.div`
  flex: 1;
  overflow: auto;
  padding: 12px 24px;
  box-sizing: border-box;
  width: 100%;
`;
const Row = styled.div`
  margin-bottom: 12px;
  min-width: 0;
`;
const Meta = styled.div`
  font-size:12px;
  color:#6b7280;
  display:flex;
  align-items:center;
  gap:8px;
`;
const Timestamp = styled.span`color:#9ca3af; font-size:11px;`;
const Body = styled.div`margin:4px 0 6px; white-space:pre-wrap; word-break:break-word;`;
const Actions = styled.div`display:flex; gap:16px; align-items:center; color:#555;`;
const InputBar = styled.form`
  display:grid;
  grid-template-columns:1fr auto;
  gap:8px;
  padding:10px;
  border-top:1px solid #eee;
  background:#fff;
  align-items:flex-start;
`;
const Text = styled.textarea`
  flex:1;
  resize:none;
  padding:10px 12px 32px;
  border-radius:8px;
  border:1px solid #ddd;
  min-height:64px;
  width:100%;
`;
const TextWrap = styled.div`
  position: relative;
`;
const ReplyContext = styled.div`
  padding:8px 12px;
  font-size:12px;
  color:#555;
  background:#f3f4f6;
  border-top:1px solid #eee;
  border-bottom:1px solid #eee;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
`;
const ReplyCancel = styled.button`
  border:none;
  background:transparent;
  color:#2563eb;
  font-weight:600;
  cursor:pointer;
  padding:0;
`;
const ReplyButton = styled.button`
  border:none;
  background:transparent;
  color:#2563eb;
  font-size:13px;
  cursor:pointer;
  padding:0;
`;
const ButtonColumn = styled.div`
  display:flex;
  flex-direction:column;
  gap:6px;
  align-items:stretch;
`;
const SendButton = styled.button`
  padding:12px 16px;
  border-radius:8px;
  border:1px solid #2563eb;
  background:#2563eb;
  color:#fff;
  font-size:13px;
  font-weight:600;
  cursor:pointer;
  min-width:66px;
  min-height:54px;
  display:flex;
  align-items:center;
  justify-content:center;
`;
const PlusButton = styled.label`
  display:flex;
  align-items:center;
  justify-content:center;
  padding:6px 0;
  border-radius:8px;
  border:1px solid #d1d5db;
  background:#f9fafb;
  color:#1f2937;
  font-size:16px;
  font-weight:700;
  cursor:pointer;
`;
const HiddenInput = styled.input`display:none;`;
const AttachmentTray = styled.div`
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  padding:0 10px 10px;
`;
const AttachmentThumb = styled.div`
  position:relative;
  width:72px;
  height:72px;
  border-radius:10px;
  overflow:hidden;
  border:1px solid #e5e7eb;
  background:#f8fafc;
  img { width:100%; height:100%; object-fit:cover; display:block; }
  button {
    position:absolute;
    top:4px;
    right:4px;
    background:rgba(0,0,0,0.6);
    color:#fff;
    border:none;
    border-radius:999px;
    font-size:11px;
    padding:2px 6px;
    cursor:pointer;
  }
`;
const CommentAttachments = styled.div`
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top:6px;
  img {
    width:100px;
    height:100px;
    border-radius:10px;
    border:1px solid #e5e7eb;
    object-fit:cover;
    display:block;
  }
`;
const CommentTop = styled.div`
  margin-top:4px;
  font-size:12px;
  color:#4b5563;
  background:#f9fafb;
  border:1px solid #e5e7eb;
  border-radius:8px;
  padding:6px 10px;
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  align-items:center;
`;
const TopLabel = styled.span`
  font-weight:600;
  color:#1f2937;
`;
const DeleteButton = styled.button`
  border:none;
  background:transparent;
  color:#9ca3af;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:0;
  cursor:pointer;
  transition:color 0.2s ease;
  &:hover { color:#ef4444; }
`;

export default function CommentDrawer({ post, onClose, onCountChange, onPreviewChange, onViewerCommented }) {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const api = `${API_BASE_URL}/api/comments`;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    window.dispatchEvent(new CustomEvent('fc-modal-open', { detail: 'comment-drawer' }));
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadding;
    };
  }, []);

  const repliesOf = useCallback((id) => items.filter(i => String(i.parentId) === String(id)), [items]);
  const topLevel = useMemo(() => items.filter(i => !i.parentId), [items]);

  const buildSnippet = useCallback((value) => {
    const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
  }, []);

  const previewData = useMemo(() => {
    if (!topLevel.length) return null;
    const byLikes = [...topLevel].sort((a, b) => {
      const likeDiff = (b.likes?.length || 0) - (a.likes?.length || 0);
      if (likeDiff !== 0) return likeDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    const likedTop = byLikes.find(c => (c.likes?.length || 0) > 0);
    if (likedTop) return { type: 'top', comment: likedTop };
    const latest = [...topLevel].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    return latest ? { type: 'latest', comment: latest } : null;
  }, [topLevel]);

  const teaser = useMemo(() => {
    if (!items.length) return null;
    const byLikes = [...items].sort((a, b) => {
      const likeDiff = (b.likes?.length || 0) - (a.likes?.length || 0);
      if (likeDiff !== 0) return likeDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    const winner = byLikes.find(c => (c.likes?.length || 0) > 0);
    if (!winner) return null;
    const snippet = buildSnippet(winner.body);
    if (!snippet) return null;
    return { snippet, username: winner.username || 'user' };
  }, [items, buildSnippet]);

  useEffect(() => {
    if (!onPreviewChange) return;
    if (!previewData) {
      onPreviewChange(null);
      return;
    }
    const snippet = buildSnippet(previewData.comment.body);
    if (!snippet) {
      onPreviewChange(null);
      return;
    }
    onPreviewChange({
      type: previewData.type,
      username: previewData.comment.username || 'user',
      body: previewData.comment.body || '',
    });
  }, [previewData, onPreviewChange, buildSnippet]);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${api}/post/${post._id}`);
      const payload = Array.isArray(res.data) ? res.data : [];
      setItems(payload);
      onCountChange?.(payload.length);
      if (onViewerCommented && user?._id) {
        const didComment = payload.some((c) => String(c.userId) === String(user._id));
        if (didComment) onViewerCommented();
      }
    } catch (e) {
      console.error('comments load failed', e);
      setItems([]);
      onCountChange?.(0);
    }
  }, [api, onCountChange, onViewerCommented, post._id, user?._id]);

  useEffect(() => {
    load();
    setReplyTo(null);
    setText('');
    setFiles([]);
  }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const previews = useMemo(() => files.map((file, idx) => ({
    key: `${file.name}-${file.size}-${file.lastModified}-${idx}`,
    url: URL.createObjectURL(file),
    name: file.name,
  })), [files]);

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const base = text.trim();
    if (!base && files.length === 0) return;
    try {
      const attachments = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await axios.post(`${API_BASE_URL}/api/uploads/image`, fd, {
          headers: { 'Content-Type': 'multipart/form-data', 'x-user-id': user._id },
        });
        attachments.push(res.data);
      }

      await axios.post(`${api}`, {
        postId: post._id,
        userId: user._id,
        body: base,
        parentId: replyTo?._id || null,
        attachments,
      });
      setText('');
      setReplyTo(null);
      setFiles([]);
      await load();
      onViewerCommented?.();
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (err) {
      console.error('comment send failed', err);
      alert(err?.response?.data?.message || 'Failed to send comment');
    }
  };

  const startReply = (comment) => {
    if (!comment) return;
    const mention = `@${comment.username || 'user'} `;
    setReplyTo(comment);
    setText((prev) => {
      const nextDraft = prev && prev.startsWith(mention) ? prev : mention;
      return applyTextLimits(nextDraft, COMMENT_CHAR_LIMIT, MAX_TEXTAREA_NEWLINES);
    });
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }, 0);
  };

  const cancelReply = () => {
    setReplyTo(null);
    setText('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handlePick = (event) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    setFiles((prev) => {
      const next = [...prev, ...selected];
      return next.slice(0, 6);
    });
    event.target.value = '';
  };

  const removeFileAt = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleLike = async (commentId) => {
    try {
      await axios.put(`${api}/${commentId}/like`, { userId: user._id });
      await load();
    } catch (err) {
      console.error('comment like failed', err);
    }
  };

  const postOwnerId = useMemo(() => {
    return post.userId || post.authorId || post.author?._id || post.ownerId || '';
  }, [post]);

  const handleDelete = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await axios.delete(`${api}/${commentId}`, {
        data: { userId: user._id },
      });
      await load();
    } catch (err) {
      console.error('comment delete failed', err);
      alert(err?.response?.data?.message || 'Failed to delete comment');
    }
  };

  const renderThread = (comment, depth = 0) => {
    const childReplies = repliesOf(comment._id);
    return (
      <div key={comment._id} style={{ marginLeft: depth === 0 ? 0 : 18 }}>
        <CommentRow
          c={comment}
          me={user}
          onLike={() => toggleLike(comment._id)}
          onReply={() => startReply(comment)}
          onDelete={() => handleDelete(comment._id)}
          postOwnerId={postOwnerId}
        />
        {childReplies.map(child => renderThread(child, depth + 1))}
      </div>
    );
  };

  if (!PortalTarget) return null;

  return createPortal(
    <Backdrop onClick={onClose}>
      <Drawer
        role="dialog"
        aria-modal="true"
        aria-label="Comments"
        onClick={(event) => event.stopPropagation()}
      >
        <Header>
          <CloseButton aria-label="Close comments" onClick={onClose}>×</CloseButton>
          Comments · {items.length}
          {teaser && (
            <CommentTop>
              <TopLabel>Top Comment</TopLabel>
              <span>{teaser.username} — {teaser.snippet},</span>
            </CommentTop>
          )}
        </Header>
        <OriginalPost post={post} />
        <List>
          {topLevel.map((c) => renderThread(c))}
          {topLevel.length === 0 && <Meta>No comments yet - be the first!</Meta>}
        </List>
        {replyTo && (
          <ReplyContext>
            <span>
              Replying to <strong>@{replyTo.username || 'user'}</strong>
            </span>
            <ReplyCancel type="button" onClick={cancelReply}>Cancel</ReplyCancel>
          </ReplyContext>
        )}
        <InputBar onSubmit={handleSubmit}>
          <TextWrap>
            <Text
              rows={2}
              value={text}
              ref={inputRef}
              onChange={e => {
                const nextValue = applyTextLimits(
                  e.target.value,
                  COMMENT_CHAR_LIMIT,
                  MAX_TEXTAREA_NEWLINES
                );
                if (nextValue !== e.target.value) {
                  e.target.value = nextValue;
                }
                setText(nextValue);
              }}
              placeholder={replyTo ? `Reply to @${replyTo.username || 'user'}...` : 'Write a comment...'}
              maxLength={COMMENT_CHAR_LIMIT}
            />
            <CharCount>{text.length}/{COMMENT_CHAR_LIMIT}</CharCount>
          </TextWrap>
          <ButtonColumn>
            <SendButton type="submit">Send</SendButton>
            <PlusButton htmlFor="comment-attach">
              <FaPlus size={12} />
            </PlusButton>
            <HiddenInput
              ref={fileInputRef}
              id="comment-attach"
              type="file"
              accept="image/*"
              multiple
              onChange={handlePick}
            />
          </ButtonColumn>
        </InputBar>
        {previews.length > 0 && (
          <AttachmentTray>
            {previews.map((preview, idx) => (
              <AttachmentThumb key={preview.key}>
                <img src={preview.url} alt={preview.name} />
                <button type="button" onClick={() => removeFileAt(idx)}>✕</button>
              </AttachmentThumb>
            ))}
          </AttachmentTray>
        )}
      </Drawer>
    </Backdrop>,
    PortalTarget
  );
}

function CommentRow({ c, me, onLike, onReply, onDelete, postOwnerId }) {
  const liked = (c.likes || []).map(String).includes(String(me._id));
  const likeCount = (c.likes || []).length || 0;
  const displayName = c.username || 'user';
  const attachments = Array.isArray(c.attachments) ? c.attachments : [];
  const canDelete = String(c.userId) === String(me._id) || (postOwnerId && String(postOwnerId) === String(me._id));

  return (
    <Row>
      <Meta>
        <UserLink username={displayName}>{displayName}</UserLink>
        <Timestamp>{new Date(c.createdAt).toLocaleString()}</Timestamp>
      </Meta>
      <Body>{c.body}</Body>
      {attachments.length > 0 && (
        <CommentAttachments>
          {attachments.map((att, idx) => {
            const href = att?.url ? toMediaUrl(att.url) : '';
            if (!href) return null;
            return (
              <a
                key={`${att.url || idx}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={href} alt={att.type || 'attachment'} />
              </a>
            );
          })}
        </CommentAttachments>
      )}
      <Actions>
        <span onClick={onLike} style={{ cursor: 'pointer' }}>
          {liked ? <FaHeart color="#ef4444" /> : <FaRegHeart color="#f87171" />} {likeCount}
        </span>
        {onReply && <ReplyButton type="button" onClick={onReply}>Reply</ReplyButton>}
        {canDelete && (
          <DeleteButton type="button" onClick={onDelete} title="Delete comment">
            <FaTrash size={11} />
          </DeleteButton>
        )}
      </Actions>
    </Row>
  );
}