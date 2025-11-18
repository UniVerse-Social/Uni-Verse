// client/src/components/EditProfileModal.jsx
import React, { useContext, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../App';
import { API_BASE_URL } from '../config';

const Backdrop = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.35);
  display: grid; place-items: center;
  z-index: 1000;
`;

const Dialog = styled.div`
  background: var(--container-white);
  color: var(--text-color);
  width: min(560px, 92vw);
  max-height: 88vh;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  box-shadow: 0 28px 60px rgba(0,0,0,0.35);
  overflow: hidden;
  display: grid;
  grid-template-rows: auto 1fr auto;
`;

const Header = styled.div`
  padding: 16px 18px;
  border-bottom: 1px solid var(--border-color);
  display: flex; align-items: center; justify-content: space-between;
  h3 { margin: 0; font-size: 18px; }
  button{
    border: 0; background: transparent; cursor: pointer; font-size: 20px;
    color: var(--text-color); opacity:.75; padding: 4px 6px; border-radius: 10px;
    &:hover { background: rgba(255,255,255,0.08); opacity:1; }
  }
`;

const Body = styled.form`
  padding: 14px 16px;
  display: grid;
  gap: 12px;
  overflow-y: auto;               /* scroll only the content */
  overscroll-behavior: contain;   /* prevent background scroll on iOS */
`;

const SectionTitle = styled.h4`
  margin: 4px 0 0;
  font-size: 14px;
`;

const Field = styled.div`
  display: grid;
  gap: 6px;
`;

const Label = styled.label`
  font-weight: 600; font-size: 13px;
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 14px;
  background: rgba(255,255,255,0.03);
  color: var(--text-color);
  &::placeholder{ color: rgba(230,233,255,0.55); }
`;

const TextArea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  min-height: 120px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 14px;
  resize: vertical;
  background: rgba(255,255,255,0.03);
  color: var(--text-color);
  &::placeholder{ color: rgba(230,233,255,0.55); }
`;

const Footer = styled.div`
  padding: 12px 16px;
  display: flex; justify-content: flex-end; gap: 10px;
  border-top: 1px solid var(--border-color);
  background: var(--container-white);
`;

const Button = styled.button`
  padding: 10px 14px;
  border-radius: 12px;
  font-weight: 800;
  border: 1px solid var(--border-color);
  color: var(--text-color);
  background: rgba(255,255,255,0.06);
  cursor: pointer;
  &:hover { background: rgba(255,255,255,0.12); }
  &:disabled { opacity: .6; cursor: not-allowed; }
`;

const Primary = styled(Button)`
  border: none;
  color: #fff;
  background: linear-gradient(90deg, var(--primary-orange), #59D0FF);
  &:hover { filter: brightness(0.98); }
`;

export default function EditProfileModal({ user, onClose, onProfileUpdate }) {
  const { user: me, login } = useContext(AuthContext);

  const [form, setForm] = useState({
    username: '', email: '', bio: '',
    oldPassword: '', oldPassword2: '', newPassword: ''
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // expose the current title badge (no UI change, just kept consistent with the previous code)
  const currentTitleBadge =
    user?.titleBadge ??
    (Array.isArray(user?.badgesEquipped) ? user.badgesEquipped[0] : null) ??
    null;

  // ref to the form so the Save button can submit it even though it's outside the <form>
  const formRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    setForm(f => ({
      ...f,
      username: user.username || '',
      email: user.email || '',
      bio: user.bio || ''
    }));
  }, [user]);

  const change = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const payload = {
        userId: me._id,
        username: form.username.trim(),
        email: (form.email || '').trim().toLowerCase(),
        bio: form.bio,
      };

      const wantsPw = form.oldPassword || form.oldPassword2 || form.newPassword;
      if (wantsPw) {
        payload.oldPassword = form.oldPassword;
        payload.oldPassword2 = form.oldPassword2;
        payload.newPassword = form.newPassword;
      }

      const res = await axios.put(`${API_BASE_URL}/api/users/${me._id}/account`, payload);

      // Update auth/user state and close
      login(res.data);
      onProfileUpdate?.(res.data);
      onClose?.();
    } catch (e2) {
      const msg = e2?.response?.data?.message || 'Failed to save changes.';
      setErr(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Backdrop onMouseDown={(e)=>{ if (e.target === e.currentTarget) onClose?.(); }}>
      <Dialog role="dialog" aria-modal="true" data-title-badge={currentTitleBadge || ''} onMouseDown={e => e.stopPropagation()}>
        <Header>
          <h3>Edit profile</h3>
          <button aria-label="Close" onClick={onClose}>×</button>
        </Header>

        <Body ref={formRef} onSubmit={submit}>
          {/* Hidden field keeps the badge value part of the form (no UI added) */}
          <input type="hidden" name="titleBadge" value={currentTitleBadge || ''} readOnly aria-hidden="true" />

          {err && (
            <div style={{background:'#fee2e2', color:'#991b1b', padding:'10px 12px', borderRadius:10}}>
              {err}
            </div>
          )}

          <Field>
            <Label>Username</Label>
            <Input
              value={form.username}
              onChange={e=>change('username', e.target.value)}
              autoComplete="username"
              required
            />
          </Field>

          <Field>
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={e=>change('email', e.target.value)}
              autoComplete="email"
              required
            />
          </Field>

          <Field>
            <Label>Bio</Label>
            <TextArea
              value={form.bio}
              onChange={e=>change('bio', e.target.value)}
              placeholder="Tell people a bit about you…"
            />
          </Field>

          <SectionTitle>Change password (optional)</SectionTitle>

          <Field>
            <Label>Old Password</Label>
            <Input
              type="password"
              value={form.oldPassword}
              onChange={e=>change('oldPassword', e.target.value)}
              autoComplete="current-password"
            />
          </Field>

          <Field>
            <Label>Retype Old Password</Label>
            <Input
              type="password"
              value={form.oldPassword2}
              onChange={e=>change('oldPassword2', e.target.value)}
              autoComplete="current-password"
            />
          </Field>

          <Field>
            <Label>New Password</Label>
            <Input
              type="password"
              value={form.newPassword}
              onChange={e=>change('newPassword', e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
          </Field>
        </Body>

        <Footer>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Primary type="button" onClick={() => formRef.current?.requestSubmit()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Primary>
        </Footer>
      </Dialog>
    </Backdrop>
  );
}
