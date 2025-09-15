// client/src/components/ClubComposer.jsx
import React, { useContext, useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

const Box = styled.div`border:1px solid #eee; border-radius:12px; padding:10px; background:#fafafa;`;
const TA = styled.textarea`width:100%; min-height:70px; border:none; outline:none; resize:vertical; background:transparent;`;
const Row = styled.div`display:flex; justify-content:flex-end; gap:8px;`;
const Btn = styled.button`padding:8px 12px; border-radius:10px; border:1px solid #111; background:#111; color:#fff;`;

export default function ClubComposer({ club, channel, sideChannelId, onPosted }){
  const { user } = useContext(AuthContext);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try{
      await axios.post(`${API_BASE_URL}/api/club-posts`, {
        clubId: club._id, authorId: user._id,
        channel, sideChannelId: channel==='side' ? sideChannelId : null,
        text
      });
    } finally {
      setSending(false); setText(''); onPosted?.();
    }
  };
  return (
    <Box>
      <TA value={text} onChange={e=>setText(e.target.value)} placeholder={`Post to ${channel==='main'?'Main': 'Side'}…`} />
      <Row><Btn onClick={submit} disabled={sending}>Post</Btn></Row>
    </Box>
  );
}
