import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { FaHeart, FaRegHeart, FaTrash, FaPlus } from 'react-icons/fa';
import { AuthContext } from '../App';
import { API_BASE_URL, toMediaUrl } from '../config';
import UserLink from './UserLink';

const Backdrop = styled.div`position: fixed; inset:0; background: rgba(0,0,0,0.40); z-index:1500;`;
const Drawer = styled.aside`
  position: fixed;
  left:50%; top:50%;
  transform: translate(-50%, -50%);
  width: min(900px, 94vw);
  height: min(90vh, 900px);
  background: var(--container-white);
  color: var(--text-color);
  border-radius:14px;
  box-shadow: 0 32px 72px rgba(0,0,0,0.55);
  z-index:1501;
  display:flex; flex-direction:column;
  overflow:hidden;
`;
const Header = styled.div`position:relative; padding:14px 16px; border-bottom:1px solid var(--border-color); font-weight:600; color: var(--text-color);`;

const CloseButton = styled.button`
  position:absolute; top:10px; right:10px;
  width:36px; height:36px;
  display:flex; align-items:center; justify-content:center;
  border-radius:10px; border:1px solid var(--border-color); background: rgba(255,255,255,0.06); color: var(--text-color); cursor:pointer;
  font-size:18px; line-height:1;
  &:hover { background: rgba(255,255,255,0.1); }
`;

// --- Original Post block (same as main) ---
const OPWrapper = styled.div`position: sticky; top:0; z-index:1; background: var(--container-white); border-bottom:1px solid var(--border-color);`;
const OPInner = styled.div`padding:14px 16px;`;
const OPTitle = styled.div`font-weight:600; font-size:14px; color: var(--text-color); margin-bottom:6px;`;
const OPText = styled.div`font-size:14px; color: var(--text-color); white-space:pre-wrap;`;
const OPGrid = styled.div`
  margin-top:10px;
  display:grid; gap:8px;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
`;
const OPImg = styled.img`width:100%; height:160px; object-fit:cover; border-radius:10px; border:1px solid var(--border-color); background: rgba(255,255,255,0.03);`;

// Util: detect image-ish url
const isImageUrl = (u) => /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(u || '');

// Normalize to full URLs and accept common shapes (string | {url,type})
function extractImageUrls(p) {
  if (!p) return [];
  const candidates = [p.photos, p.images, p.media, p.attachments, p.files];
  const urls = [];
  for (const arr of candidates) {
    if (!arr) continue;
    for (const it of arr) {
      if (typeof it === 'string') {
        if (isImageUrl(it)) urls.push(toMediaUrl(it));
      } else if (it?.url && (isImageUrl(it.url) || /image/i.test(it.type || ''))) {
        urls.push(toMediaUrl(it.url));
      }
    }
  }
  return urls;
}

function getPostText(p) {
  const candidates = [p?.body, p?.text, p?.content, p?.caption, p?.message, p?.description];
  return candidates.find((v) => typeof v === 'string' && v.trim()) || '';
}

function OriginalPost({ post }) {
  const imgs = extractImageUrls(post);
  const text = getPostText(post);
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(text);

  return (
    <OPWrapper>
      <OPInner>
        <OPTitle>Original Post{post?.username ? ` — ${post.username}` : ''}</OPTitle>
        {looksLikeHtml
          ? <OPText dangerouslySetInnerHTML={{ __html: text }} />
          : <OPText>{text}</OPText>}
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
  flex:1;
  overflow:auto;
  padding:12px 24px;
  box-sizing:border-box;
`;
const Row = styled.div`
  margin-bottom:12px;
  min-width:max-content;
`;
const Meta = styled.div`
  font-size:12px;
  color: rgba(230,233,255,0.65);
  display:flex;
  align-items:center;
  gap:8px;
`;
const Timestamp = styled.span`color: rgba(230,233,255,0.55); font-size:11px;`;
const Body = styled.div`margin:4px 0 6px; white-space:pre-wrap; word-break:break-word; color: var(--text-color);`;
const Actions = styled.div`display:flex; gap:16px; align-items:center; color: rgba(230,233,255,0.82);`;
const ReplyButton = styled.button`
  border:none;
  background:transparent;
  color: var(--primary-orange);
  font-size:13px;
  cursor:pointer;
  padding:0;
`;
const ReplyContext = styled.div`
  padding:8px 12px;
  font-size:12px;
  color: rgba(230,233,255,0.82);
  background: rgba(255,255,255,0.06);
  border-top:1px solid var(--border-color);
  border-bottom:1px solid var(--border-color);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
`;
const ReplyCancel = styled.button`
  border:none;
  background:transparent;
  color: var(--primary-orange);
  font-weight:600;
  cursor:pointer;
  padding:0;
`;
const InputBar = styled.form`
  display:grid;
  grid-template-columns:1fr auto;
  gap:8px;
  padding:10px;
  border-top:1px solid var(--border-color);
  background: var(--container-white);
  align-items:flex-start;
`;
const Text = styled.textarea`
  padding:10px;
  border:1px solid var(--border-color);
  border-radius:8px;
  resize:none;
  min-height:64px;
  background: rgba(255,255,255,0.03);
  color: var(--text-color);
  &::placeholder{ color: rgba(230,233,255,0.55); }
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
  border:none;
  background: var(--primary-orange);
  color:#000;
  font-size:13px;
  font-weight:600;
  cursor:pointer;
  min-width:66px;
  min-height:64px;
  display:flex;
  align-items:center;
  justify-content:center;
  &:hover { background: linear-gradient(90deg, var(--primary-orange), #59D0FF); }
`;
const PlusButton = styled.label`
  display:flex;
  align-items:center;
  justify-content:center;
  padding:6px 0;
  border-radius:8px;
  border:1px solid var(--border-color);
  background: rgba(255,255,255,0.06);
  color: var(--text-color);
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
  border:1px solid var(--border-color);
  background: rgba(255,255,255,0.03);
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
  }
`;
const CommentTop = styled.div`
  margin-top:4px;
  font-size:12px;
  color: rgba(230,233,255,0.82);
  background: rgba(255,255,255,0.06);
  border:1px solid var(--border-color);
  border-radius:8px;
  padding:6px 10px;
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  align-items:center;
`;
const TopLabel = styled.span` font-weight:600; color: var(--text-color); `;
const DeleteButton = styled.button`
  border:none;
  background:transparent;
  color: rgba(230,233,255,0.55);
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:0;
  cursor:pointer;
  transition:color 0.2s ease;
  &:hover { color:#ef4444; }
`;

const buildSnippet = (text) => {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
};

export default function ClubCommentDrawer({ post, onClose, onCountChange, onPreviewChange, onViewerCommented }) {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const api = `${API_BASE_URL}/api/club-comments`;

  const repliesOf = useCallback(
    (id) => items.filter((i) => String(i.parentId) === String(id)),
    [items]
  );
  const topLevel = useMemo(() => items.filter((i) => !i.parentId), [items]);

  const previewData = useMemo(() => {
    if (!topLevel.length) return null;
    const byLikes = [...topLevel].sort((a, b) => {
      const likeDiff = (b.likes?.length || 0) - (a.likes?.length || 0);
      if (likeDiff !== 0) return likeDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    const likedTop = byLikes.find((c) => (c.likes?.length || 0) > 0);
    if (likedTop) return { type: 'top', comment: likedTop };
    const latest = [...topLevel].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    return latest ? { type: 'latest', comment: latest } : null;
  }, [topLevel]);

  const teaser = useMemo(() => {
    if (!items.length) return null;
    const sorted = [...items].sort((a, b) => {
      const likeDiff = (b.likes?.length || 0) - (a.likes?.length || 0);
      if (likeDiff !== 0) return likeDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    const winning = sorted.find((c) => (c.likes?.length || 0) > 0);
    if (!winning) return null;
    const snippet = buildSnippet(winning.body);
    if (!snippet) return null;
    return {
      username: winning.username || 'user',
      snippet,
    };
  }, [items]);

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
  }, [previewData, onPreviewChange]);

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
      console.error('Failed to load club comments', e);
      setItems([]);
      onCountChange?.(0);
    }
  }, [api, post._id, onCountChange, onViewerCommented, user?._id]);

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

  const send = async (e) => {
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
      console.error('club comment send failed', err);
      alert(err?.response?.data?.message || 'Failed to send comment');
    }
  };

  const startReply = (comment) => {
    if (!comment) return;
    const mention = `@${comment.username || 'user'} `;
    setReplyTo(comment);
    setText((prev) => (prev && prev.startsWith(mention) ? prev : mention));
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
      console.error('club comment like failed', err);
    }
  };

  const postOwnerId = useMemo(() => {
    return post.authorId || post.userId || post.author?._id || post.ownerId || '';
  }, [post]);

  const handleDelete = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await axios.delete(`${api}/${commentId}`, {
        data: { userId: user._id },
      });
      await load();
    } catch (err) {
      console.error('club comment delete failed', err);
      alert(err?.response?.data?.message || 'Failed to delete comment');
    }
  };

  const renderThread = (comment, depth = 0) => {
    const childReplies = repliesOf(comment._id);
    return (
      <div key={comment._id} style={{ marginLeft: depth === 0 ? 0 : 18 }}>
        <CommentRow
          comment={comment}
          me={user}
          onLike={() => toggleLike(comment._id)}
          onReply={() => startReply(comment)}
          onDelete={() => handleDelete(comment._id)}
          postOwnerId={postOwnerId}
        />
        {childReplies.map((child) => renderThread(child, depth + 1))}
      </div>
    );
  };

  return (
    <>
      <Backdrop onClick={onClose} />
      <Drawer role="dialog" aria-modal="true" aria-label="Comments">
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
          {topLevel.length === 0 && <Meta>No comments yet — be the first!</Meta>}
        </List>

        {replyTo && (
          <ReplyContext>
            <span>
              Replying to <strong>@{replyTo.username || 'user'}</strong>
            </span>
            <ReplyCancel type="button" onClick={cancelReply}>Cancel</ReplyCancel>
          </ReplyContext>
        )}

        <InputBar onSubmit={send}>
          <Text
            rows={2}
            value={text}
            ref={inputRef}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? `Reply to @${replyTo.username || 'user'}...` : 'Write a comment...'}
          />
          <ButtonColumn>
            <SendButton type="submit">Send</SendButton>
            <PlusButton htmlFor="club-comment-attach">
              <FaPlus size={12} />
            </PlusButton>
            <HiddenInput
              ref={fileInputRef}
              id="club-comment-attach"
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
    </>
  );
}

function CommentRow({ comment, me, onLike, onReply, onDelete, postOwnerId }) {
  const liked = (comment.likes || []).map(String).includes(String(me._id));
  const likeCount = (comment.likes || []).length || 0;
  const displayName = comment.username || 'user';
  const attachments = Array.isArray(comment.attachments) ? comment.attachments : [];
  const canDelete = String(comment.userId) === String(me._id) || (postOwnerId && String(postOwnerId) === String(me._id));

  return (
    <Row>
      <Meta>
        <UserLink username={displayName}>{displayName}</UserLink>
        <Timestamp>{new Date(comment.createdAt).toLocaleString()}</Timestamp>
      </Meta>
      <Body>{comment.body}</Body>
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
