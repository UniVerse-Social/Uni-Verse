import React, { useState, useContext, useMemo } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../App';
import { API_BASE_URL } from '../config';

const CreatePostContainer = styled.div`
  width: 100%;
  box-sizing: border-box;
  padding: 16px;
  background-color: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
  margin-bottom: 20px;
`;

const TextArea = styled.textarea`
  width: 95%;
  min-height: 88px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 7px;
  font-size: 16px;
  resize: none;
  margin-bottom: 8px;
  background: #fff;
  color: #111;
`;

const AttachBtn = styled.label`
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: #fff;
  color: #111;
  cursor: pointer;
  font-weight: 600;
  &:hover { background: #f8fafc; }
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
  img { width: 100%; height: 100%; object-fit: cover; display: block; }
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

const PostButton = styled.button`
  background-color: var(--primary-orange);
  color: white;
  border: none;
  border-radius: 999px;
  padding: 10px 18px;
  font-weight: 700;
  cursor: pointer;
  &:disabled { opacity: .6; cursor: not-allowed; }
`;

const CharPopup = styled.div`
  position: absolute;
  right: 200px;
  bottom: -35px;
  background: #333;
  color: white;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 0.85rem;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease-in-out;
  &.show { opacity: 1; }
`;

const TextAreaWrapper = styled.div`
  position: relative;
  display: inline-block;
  width 100%;
`;

const CreatePost = ({ onPostCreated }) => {
  const { user } = useContext(AuthContext);
  const [textContent, setTextContent] = useState('');
  const [files, setFiles] = useState([]);         // File[]
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(280);

  const previews = useMemo(
    () => files.map(f => ({ name: f.name, url: URL.createObjectURL(f) })),
    [files]
  );

  const onPick = (e) => {
    const next = Array.from(e.target.files || []).slice(0, 10 - files.length);
    if (next.length) setFiles(prev => [...prev, ...next]);
    e.target.value = null;
  };

  const removeAt = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const uploadOne = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await axios.post(`${API_BASE_URL}/api/uploads/image`, fd, {
      headers: { 'Content-Type': 'multipart/form-data', 'x-user-id': user._id }
    });
    return res.data; // { url, type, width, height, scan }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!textContent.trim() && files.length === 0) return;
    setBusy(true);
    try {
      const attachments = [];
      for (const f of files) {
        const up = await uploadOne(f);
        attachments.push(up);
      }

      const payload = {
        userId: user._id,
        username: user.username,
        textContent: textContent.trim(),
        attachments
      };

      const res = await axios.post(`${API_BASE_URL}/api/posts`, payload);
      const postWithPic = { ...res.data, profilePicture: user.profilePicture };
      onPostCreated?.(postWithPic);
      setTextContent('');
      setFiles([]);
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
        {previews.length > 0 && (
          <Grid aria-label="Selected images">
            {previews.map((p, i) => (
              <Thumb key={p.name}>
                <img src={p.url} alt={`selected ${p.name}`} />
                <button type="button" onClick={() => removeAt(i)}>✕</button>
              </Thumb>
            ))}
          </Grid>
        )}

       <TextAreaWrapper>
        <TextArea
          placeholder={`What's on your mind, ${user.username}?`}
          value={textContent}
          onChange={(e) => {
            const val = e.target.value;
            setTextContent(val);
            setRemaining(280 - val.length);
          }}
          maxLength={280}
        />
        <CharPopup className={remaining <= 30 ? 'show' : ''}>
          {remaining} characters remaining
        </CharPopup>
       </TextAreaWrapper>
        <Actions>
          <AttachBtn htmlFor="feed-attach">Add photos</AttachBtn>
          <HiddenInput id="feed-attach" type="file" accept="image/*" multiple onChange={onPick} />
          <PostButton type="submit" disabled={busy}>
            {busy ? 'Posting…' : 'Post'}
          </PostButton>
        </Actions>
      </form>
    </CreatePostContainer>
  );
};

export default CreatePost;