// client/src/components/ClubComposer.jsx
import React, { useContext, useState, useMemo } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

const Box = styled.div`
  border:1px solid var(--border-color);
  border-radius:12px; padding:12px;
  background: var(--container-white);
`;
const TA = styled.textarea`
  width:96%; min-height:80px; border:1px solid var(--border-color);
  border-radius:10px; padding:10px; resize:none; background:#fff; color:#111;
`;
const Row = styled.div`display:flex; justify-content:space-between; gap:8px; align-items:center; margin-top:8px;`;
const Btn = styled.button`
  padding:10px 14px; border-radius:10px; border:1px solid var(--border-color);
  background: #111; color:#fff; font-weight:700; cursor:pointer;
  &:disabled { opacity:.6; cursor:not-allowed; }
`;
const Attach = styled.label`
  padding:8px 12px; border-radius:10px; border:1px solid var(--border-color);
  background:#fff; color:#111; cursor:pointer; font-weight:600;
  &:hover { background:#f8fafc; }
`;
const Hidden = styled.input` display:none; `;
const Grid = styled.div`
  display:grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap:10px; margin:10px 0 0;
  div{ position:relative; border:1px solid var(--border-color); border-radius:10px; overflow:hidden; background:#f8f9fb; aspect-ratio:1/1; }
  img{ width:100%; height:100%; object-fit:cover; display:block; }
  button{ position:absolute; top:6px; right:6px; border:none; background:rgba(0,0,0,.6); color:#fff; border-radius:999px; padding:4px 8px; cursor:pointer; font-size:12px; }
`;

export default function ClubComposer({ club, channel, sideChannelId, onPosted }){
  const { user } = useContext(AuthContext);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);

  const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);

  const onPick = (e) => {
    const next = Array.from(e.target.files || []).slice(0, 10 - files.length);
    if (next.length) setFiles(prev => [...prev, ...next]);
    e.target.value = null;
  };
  const removeAt = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const uploadOne = async (file) => {
    const fd = new FormData(); fd.append('file', file);
    const res = await axios.post(`${API_BASE_URL}/api/uploads/image`, fd, {
      headers: { 'Content-Type': 'multipart/form-data', 'x-user-id': user._id }
    });
    return res.data; // { url, type, ... }
  };

  const submit = async () => {
    if (!text.trim() && files.length === 0) return;
    setSending(true);
    try{
      const attachments = [];
      for (const f of files) attachments.push(await uploadOne(f));
      await axios.post(`${API_BASE_URL}/api/club-posts`, {
        clubId: club._id, authorId: user._id,
        channel, sideChannelId: channel==='side' ? sideChannelId : null,
        text: text.trim(),
        attachments,
        // keep legacy images array for any existing readers
        images: attachments.filter(a => a.type==='image').map(a => a.url)
      });
      setText(''); setFiles([]);
      onPosted?.();
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to post');
    } finally {
      setSending(false);
    }
  };

  return (
    <Box className="surface">
      <TA value={text} onChange={e=>setText(e.target.value)} placeholder={`Post to ${channel==='main'?'Main': 'Side'}…`} />
      {previews.length > 0 && (
        <Grid>
          {previews.map((src, i) => (
            <div key={i}>
              <img src={src} alt={`selected ${i+1}`} />
              <button type="button" onClick={() => removeAt(i)}>✕</button>
            </div>
          ))}
        </Grid>
      )}
      <Row>
        <Attach htmlFor="club-attach">Add photos</Attach>
        <div>
          <Hidden id="club-attach" type="file" accept="image/*" multiple onChange={onPick} />
          <Btn onClick={submit} disabled={sending}>{sending ? 'Posting…' : 'Post'}</Btn>
        </div>
      </Row>
    </Box>
  );
}
