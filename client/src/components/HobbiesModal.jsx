import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { FiX } from 'react-icons/fi';
import { HOBBY_LIMIT, HOBBY_NAMES, mapHobbiesWithMeta } from '../utils/hobbies';
import {
  CountBadge,
  Hint,
  LimitNote,
  HobbyGrid,
  HobbyOption,
  HobbyEmoji,
  HobbyText,
} from './HobbyTiles';

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display: grid;
  place-items: center;
  z-index: 1200;
`;

const Dialog = styled.div`
  background: var(--container-white);
  color: var(--text-color);
  width: min(640px, 94vw);
  max-height: 90vh;
  border-radius: 18px;
  box-shadow: 0 24px 56px rgba(0,0,0,0.25);
  display: grid;
  grid-template-rows: auto 1fr auto;
  overflow: hidden;
`;

const Header = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-color);
  h3 {
    margin: 0;
    font-size: 20px;
    color: var(--text-color);
  }
  button {
    border: 0;
    background: transparent;
    color: #6b7280;
    font-size: 24px;
    cursor: pointer;
    border-radius: 999px;
    padding: 4px 6px;
    transition: background 0.2s ease;
    &:hover {
      background: rgba(0,0,0,0.06);
      color: #111827;
    }
  }
`;

const Body = styled.div`
  padding: 16px 20px 12px;
  overflow-y: auto;
  display: grid;
  gap: 16px;
`;

const Footer = styled.div`
  padding: 14px 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: var(--container-white);
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
`;

const ErrorNote = styled.div`
  font-size: 13px;
  color: #b91c1c;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 10px 12px;
`;

const Button = styled.button`
  border: 0;
  border-radius: 10px;
  padding: 10px 16px;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  background: ${p => (p.$primary ? '#2563eb' : '#e5e7eb')};
  color: ${p => (p.$primary ? '#fff' : '#111827')};
  transition: filter 0.2s ease;
  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
  &:hover:not(:disabled) {
    filter: brightness(0.95);
  }
`;

const LoadingState = styled.div`
  font-size: 14px;
  color: #6b7280;
`;

export default function HobbiesModal({ open, onClose, selected = [], onSave }) {
  const [catalog, setCatalog] = useState(() => mapHobbiesWithMeta(HOBBY_NAMES));
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [limitMessage, setLimitMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState(() => (Array.isArray(selected) ? [...selected] : []));

  useEffect(() => {
    if (!open) return;
    setSelection(Array.isArray(selected) ? [...selected] : []);
    setLimitMessage('');
    setSaveError('');
  }, [open, selected]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setLoading(true);
    setLoadError('');
    (async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/auth/signup-data');
        if (cancelled) return;
        const names = Array.isArray(res.data?.hobbies) && res.data.hobbies.length
          ? res.data.hobbies
          : HOBBY_NAMES;
        setCatalog(mapHobbiesWithMeta(names));
      } catch (err) {
        if (cancelled) return;
        setLoadError('Unable to fetch the latest hobbies list. Showing the default options.');
        setCatalog(mapHobbiesWithMeta(HOBBY_NAMES));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  const selectionSet = useMemo(() => new Set(selection), [selection]);
  const countLabel = `${selection.length}/${HOBBY_LIMIT}`;

  const toggleHobby = (name) => {
    setLimitMessage('');
    setSelection(prev => {
      if (prev.includes(name)) {
        return prev.filter(h => h !== name);
      }
      if (prev.length >= HOBBY_LIMIT) {
        setLimitMessage(`You can select up to ${HOBBY_LIMIT} hobbies.`);
        return prev;
      }
      return [...prev, name];
    });
  };

  const resetSelection = () => {
    setSelection([]);
    setLimitMessage('');
  };

  const handleSave = async () => {
    if (!onSave) {
      onClose?.();
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await onSave(selection);
      onClose?.();
    } catch (err) {
      const fallback = err?.message || 'Failed to update hobbies. Please try again.';
      setSaveError(fallback);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Backdrop onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <Dialog role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <Header>
          <h3>Update your interests</h3>
          <button aria-label="Close hobbies modal" onClick={onClose}>
            <FiX />
          </button>
        </Header>

        <Body>
          <InfoRow>
            <div>
              <CountBadge>Selected: {countLabel}</CountBadge>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Hint>Pick up to {HOBBY_LIMIT} hobbies.</Hint>
              {selection.length > 0 && (
                <button
                  type="button"
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: '#2563eb',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  onClick={resetSelection}
                >
                  Clear all
                </button>
              )}
            </div>
          </InfoRow>

          {loadError && <ErrorNote>{loadError}</ErrorNote>}
          {saveError && <ErrorNote>{saveError}</ErrorNote>}
          {limitMessage && <LimitNote>{limitMessage}</LimitNote>}

          {loading ? (
            <LoadingState>Loading hobbies…</LoadingState>
          ) : (
            <HobbyGrid>
              {catalog.map(({ name, emoji, label }) => (
                <HobbyOption
                  key={name}
                  type="button"
                  onClick={() => toggleHobby(name)}
                  $selected={selectionSet.has(name)}
                  aria-label={label}
                  title={label}
                >
                  <HobbyEmoji>{emoji}</HobbyEmoji>
                  <HobbyText>{name}</HobbyText>
                </HobbyOption>
              ))}
            </HobbyGrid>
          )}
        </Body>

        <Footer>
          <Button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" $primary onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </Footer>
      </Dialog>
    </Backdrop>
  );
}