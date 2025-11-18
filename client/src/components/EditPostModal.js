import React, { useState, useContext, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../App';
import { createPortal } from 'react-dom';

const ModalBackdrop = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  display: grid; place-items: center;
  z-index: 1600;
  padding: 24px;
  backdrop-filter: saturate(120%) blur(2px);
`;

const ModalContainer = styled.form`
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 28px 48px rgba(0,0,0,0.45);
  width: min(560px, 92vw);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ModalHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  font-weight: 800;
  font-size: 16px;
`;

const Body = styled.div`
  padding: 16px 20px;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 160px;
  resize: vertical;
  font: inherit;
  padding: 12px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: rgba(255,255,255,0.03);
  color: var(--text-color);
  &::placeholder { color: rgba(230,233,255,0.55); }
  &:focus { outline: none; box-shadow: 0 0 0 2px rgba(139,123,255,0.25); }
`;

const Footer = styled.div`
  padding: 14px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid var(--border-color);
  background: rgba(0,0,0,0.05);
`;

const Button = styled.button`
  padding: 9px 18px;
  border-radius: 999px;
  font-weight: 800;
  border: 1px solid var(--border-color);
  cursor: pointer;
  color: ${p => (p.$primary ? '#fff' : 'var(--text-color)')};
  background: ${p =>
    p.$primary
      ? 'linear-gradient(90deg, var(--primary-orange), #59D0FF)'
      : 'rgba(255,255,255,0.08)'};
  &:hover { filter: brightness(0.98); }
`;

const EditPostModal = ({ post, onClose, onPostUpdated }) => {
  const { user: currentUser } = useContext(AuthContext);
  const [textContent, setTextContent] = useState(post.textContent);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put(`/api/posts/${post._id}`, {
        userId: currentUser._id,
        textContent,
      });
      onPostUpdated(res.data);
      onClose();
    } catch (err) {
      console.error('Failed to update post', err);
      alert('Could not update the post. Please try again.');
    }
  };

  const content = (
    <ModalBackdrop role="dialog" aria-modal="true" onClick={onClose}>
      <ModalContainer onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <ModalHeader>Edit Post</ModalHeader>
        <Body>
          <Textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Update your post…"
          />
        </Body>
        <Footer>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" $primary>Save Changes</Button>
        </Footer>
      </ModalContainer>
    </ModalBackdrop>
  );

  return createPortal(content, document.body);
};

export default EditPostModal;
