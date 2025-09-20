// client/src/components/EditProfileModal.jsx
import React, { useContext, useEffect, useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../App';

const Backdrop = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.35);
  display: grid; place-items: center;
  z-index: 1000;
`;

const Dialog = styled.div`
  background: #fff;
  width: min(560px, 92vw);
  max-height: 88vh;
  border-radius: 12px;
  box-shadow: 0 20px 44px rgba(0,0,0,0.18);
  overflow: hidden;

  /* 3 rows: header / scrolling body / footer */
  display: grid;
  grid-template-rows: auto 1fr auto;
`;

const Header = styled.div`
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex; align-items: center; justify-content: space-between;
  h3 { margin: 0; font-size: 18px; }
  button {
    border: 0; background: transparent; cursor: pointer; font-size: 20px; color: #666;
    padding: 4px 6px; border-radius: 8px;
    &:hover { background:#f3f4f6; color:#111; }
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
  background: #fff;
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
`;

const Footer = styled.div`
  padding: 12px 16px;
  display: flex; justify-content: flex-end; gap: 10px;
  border-top: 1px solid var(--border-color);
  background: #fff;
`;

const Button = styled.button`
  padding: 10px 14px; border-radius: 10px; font-weight: 700; border: 0; cursor: pointer;
  background: ${p => (p.$primary ? 'var(--primary-blue)' : '#e5e7eb')};
  color: ${p => (p.$primary ? '#fff' : '#111')};
  &:disabled { opacity: .6; cursor: not-allowed; }
`;

export default function EditProfileModal({ user, onClose, onProfileUpdate }) {
  const { user: me, login } = useContext(AuthContext);

  const [form, setForm] = useState({
    username: '', email: '', bio: '',
    oldPassword: '', oldPassword2: '', newPassword: ''
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // --- NEW: derive effective title badge string (read-only, no UI changes) ---
  const currentTitleBadge =
    user?.titleBadge ??
    (Array.isArray(user?.badgesEquipped) ? user.badgesEquipped[0] : null) ??
    null;

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

      const res = await axios.put(`http://localhost:5000/api/users/${me._id}/account`, payload);

      // server returns full user (sans password); badges/titleBadge preserved
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
      {/* Expose current title badge in a non-visual way for consistency/debug */}
      <Dialog role="dialog" aria-modal="true" data-title-badge={currentTitleBadge || ''}>
        <Header>
          <h3>Edit profile</h3>
          <button aria-label="Close" onClick={onClose}>×</button>
        </Header>

        <Body onSubmit={submit}>
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
              required
            />
          </Field>

          <Field>
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={e=>change('email', e.target.value)}
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
            />
          </Field>

          <Field>
            <Label>Retype Old Password</Label>
            <Input
              type="password"
              value={form.oldPassword2}
              onChange={e=>change('oldPassword2', e.target.value)}
            />
          </Field>

          <Field>
            <Label>New Password</Label>
            <Input
              type="password"
              value={form.newPassword}
              onChange={e=>change('newPassword', e.target.value)}
              placeholder="At least 6 characters"
            />
          </Field>
        </Body>

        <Footer>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button $primary type="submit" formAction="submit" onClick={(e)=>e.currentTarget.form?.dispatchEvent(new Event('submit', {cancelable:true, bubbles:true}))} disabled={saving}>
            Save
          </Button>
        </Footer>
      </Dialog>
    </Backdrop>
  );
}
