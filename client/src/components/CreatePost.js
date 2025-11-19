import React, { useState, useContext, useRef, useCallback, useEffect } from 'react';
import { FaPlus } from 'react-icons/fa';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../App';
import { API_BASE_URL } from '../config';
import CustomStickerContext from '../context/CustomStickerContext';
import {
  POST_CHAR_LIMIT,
  MAX_TEXTAREA_NEWLINES,
} from '../constants/profileLimits';
import { applyTextLimits } from '../utils/textLimits';
import CharCount from './CharCount';

const CreatePostContainer = styled.div`
  width: 100%;
  box-sizing: border-box;
  padding: 16px 16px 8px;
  background-color: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
  margin-bottom: 20px;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 88px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 14px 32px;
  box-sizing: border-box;
  font-size: 16px;
  resize: none;
  overflow: hidden;
  margin-bottom: 4px;
  background: #fff;
  color: #111;
  line-height: 1.6;
`;

const ControlsRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const AttachBtn = styled.label`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: #fff;
  color: #111;
  cursor: pointer;
  font-weight: 600;
  line-height: 0; /* kill baseline extra space from inline SVG */
  &:hover { background: #f8fafc; }
`;

const PostButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 20px;
  border-radius: 999px;
  background-color: var(--primary-orange);
  color: #fff;
  border: none;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;
  &:disabled { opacity: .6; cursor: not-allowed; }
`;

const HiddenInput = styled.input` display: none; `;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
`;

const Thumb = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: #f8f9fb;
  aspect-ratio: 1/1;
  img, video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  button {
    position: absolute; top: 6px; right: 6px;
    border: none; background: rgba(0,0,0,0.6); color: #fff;
    font-size: 12px; border-radius: 999px; padding: 4px 8px; cursor: pointer;
  }
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
`;

const TextAreaWrapper = styled.div`
  position: relative;
  display: inline-block;
  width: 100%;
`;

const MAX_ATTACHMENTS = 10;
const VIDEO_MAX_SECONDS = 20;

const CreatePost = ({ onPostCreated }) => {
  const { user } = useContext(AuthContext);
  const { stickerDefaults } = useContext(CustomStickerContext);
  const [textContent, setTextContent] = useState('');
  const [attachments, setAttachments] = useState([]); // { id, file, kind, duration?, preview }
  const [busy, setBusy] = useState(false);


  const textAreaRef = useRef(null);

  const revokePreview = useCallback((entry) => {
    if (entry?.preview) {
      URL.revokeObjectURL(entry.preview);
    }
  }, []);

  useEffect(() => {
    return () => {
      attachments.forEach(revokePreview);
    };
  }, [attachments, revokePreview]);

  const makeAttachmentEntry = useCallback((file, kind, extra = {}) => ({
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    kind,
    duration: typeof extra.duration === 'number' ? extra.duration : null,
    preview: URL.createObjectURL(file),
  }), []);

  const getVideoDuration = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const duration = video.duration;
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(duration) ? duration : 0);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Unable to read video metadata'));
      };
      video.src = url;
    });
  }, []);

  const onPick = useCallback(async (event) => {
    const fileList = Array.from(event.target.files || []);
    event.target.value = null;
    if (!fileList.length) return;
    const capacity = MAX_ATTACHMENTS - attachments.length;
    if (capacity <= 0) return;

    const selected = fileList.slice(0, capacity);
    const nextEntries = [];
    for (const file of selected) {
      const mime = (file.type || '').toLowerCase();
      try {
        if (mime.startsWith('video/')) {
          const duration = await getVideoDuration(file);
          if (duration > VIDEO_MAX_SECONDS) {
            alert(`Skipped ${file.name}: videos must be ${VIDEO_MAX_SECONDS} seconds or shorter.`);
            continue;
          }
          nextEntries.push(makeAttachmentEntry(file, 'video', { duration }));
        } else if (mime.startsWith('image/')) {
          nextEntries.push(makeAttachmentEntry(file, 'image'));
        } else {
          alert(`Unsupported file type: ${file.name}`);
        }
      } catch (err) {
        console.error('Attachment load failed', err);
        alert(`Could not add ${file.name}. Please try another file.`);
      }
    }
    if (nextEntries.length) {
      setAttachments((prev) => [...prev, ...nextEntries]);
    }
  }, [attachments.length, getVideoDuration, makeAttachmentEntry]);

  const removeAttachment = useCallback((id) => {
    setAttachments((prev) => {
      const target = prev.find((entry) => entry.id === id);
      if (target) revokePreview(target);
      return prev.filter((entry) => entry.id !== id);
    });
  }, [revokePreview]);

  const uploadOne = async (entry) => {
    const fd = new FormData();
    fd.append('file', entry.file);
    if (entry.kind === 'video' && entry.duration != null) {
      fd.append('duration', String(entry.duration));
    }
    const endpoint = entry.kind === 'video' ? 'video' : 'image';
    const res = await axios.post(`${API_BASE_URL}/api/uploads/${endpoint}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data', 'x-user-id': user._id }
    });
    return res.data;
  };

  const parseListInput = useCallback((value) => {
    if (Array.isArray(value)) return value.map((token) => String(token)).filter(Boolean);
    return String(value || '')
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!textContent.trim() && attachments.length === 0) return;
    setBusy(true);
    try {
      const uploaded = [];
      for (const entry of attachments) {
        const up = await uploadOne(entry);
        uploaded.push(up);
      }

      const payload = {
        userId: user._id,
        username: user.username,
        textContent: textContent.trim(),
        attachments: uploaded,
        // NEW: Logic for per-post sticker settings, deviatinng from the user defaults
        stickerSettings: {
          allowMode: stickerDefaults?.allowMode || 'everyone',
          allowlist: parseListInput(stickerDefaults?.allowlist),
          denylist: parseListInput(stickerDefaults?.denylist),
          allowstickytext: !!stickerDefaults?.allowstickytext,
          allowstickymedia: !!stickerDefaults?.allowstickymedia,
          maxCount: Number(stickerDefaults?.maxCount) || 20,
        }
      };

      const res = await axios.post(`${API_BASE_URL}/api/posts`, payload);
      const postWithPic = { ...res.data, profilePicture: user.profilePicture };
      onPostCreated?.(postWithPic);
      setTextContent('');
      attachments.forEach(revokePreview);
      setAttachments([]);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Failed to create post');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CreatePostContainer className="surface">
      <form onSubmit={handleSubmit}>
        {attachments.length > 0 && (
          <Grid aria-label="Selected media">
            {attachments.map((item) => (
              <Thumb key={item.id}>
                {item.kind === 'video' ? (
                  <video
                    src={item.preview}
                    controls
                    preload="metadata"
                    style={{ borderRadius: 10 }}
                  />
                ) : (
                  <img src={item.preview} alt={`selected ${item.file.name}`} />
                )}
                <button type="button" onClick={() => removeAttachment(item.id)}>✕</button>
              </Thumb>
            ))}
          </Grid>
        )}

       <TextAreaWrapper>
        <TextArea
          ref = {textAreaRef}
          placeholder={`What's on your mind, ${user.username}?`}
          value={textContent}
          onChange={(e) => {
            const nextValue = applyTextLimits(
              e.target.value,
              POST_CHAR_LIMIT,
              MAX_TEXTAREA_NEWLINES
            );
            if (nextValue !== e.target.value) {
              e.target.value = nextValue;
            }
            setTextContent(nextValue);

            const el = textAreaRef.current;
            if (el) {
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
            }
          }}
          maxLength={POST_CHAR_LIMIT}
        />
        <CharCount>{textContent.length}/{POST_CHAR_LIMIT}</CharCount>
       </TextAreaWrapper>
        <Actions>
          <HiddenInput
            id="feed-attach"
            type="file"
            accept="image/*,video/mp4,video/webm"
            multiple
            onChange={onPick}
          />
          <ControlsRight>
            <AttachBtn htmlFor="feed-attach" aria-label="Add media">
              <FaPlus size={14} />
            </AttachBtn>
            <PostButton type="submit" disabled={busy}>
            {busy ? 'Posting…' : 'Post'}
            </PostButton>
          </ControlsRight>
        </Actions>
      </form>
    </CreatePostContainer>
  );
};

export default CreatePost;
