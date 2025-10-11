import React, { useEffect } from 'react';
import styled from 'styled-components';

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1500;
  padding: 24px;
`;

const Modal = styled.div`
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 28px 48px rgba(15, 23, 42, 0.3);
  width: 100%;
  max-width: 540px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  padding: 20px 24px 12px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.7);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
`;

const Body = styled.div`
  padding: 24px;
  display: grid;
  gap: 18px;
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: center;
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #1f2937;
`;

const FieldLabel = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #1f2937;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 70px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.55);
  padding: 8px 10px;
  font-size: 13px;
  resize: vertical;
  background: rgba(248, 250, 252, 0.75);
`;

const Hint = styled.p`
  margin: 0;
  font-size: 12px;
  color: #64748b;
`;

const Footer = styled.div`
  padding: 18px 24px;
  border-top: 1px solid rgba(226, 232, 240, 0.7);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const Button = styled.button`
  border: none;
  border-radius: 999px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background: ${(p) => (p.$primary ? '#2563eb' : 'rgba(226, 232, 240, 0.8)')};
  color: ${(p) => (p.$primary ? '#fff' : '#1f2937')};
  transition: background 0.2s ease, color 0.2s ease;

  &:hover {
    background: ${(p) => (p.$primary ? '#1d4ed8' : 'rgba(226, 232, 240, 1)')};
  }
`;

const StickerSettingsModal = ({ open, values, onChange, onSave, onCancel }) => {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <Backdrop onClick={onCancel} role="presentation">
      <Modal
        role="dialog"
        aria-modal="true"
        aria-label="Sticker settings"
        onClick={(event) => event.stopPropagation()}
      >
        <Header>
          <Title>Sticker Settings</Title>
        </Header>
        <Body>
          <Row>
            <RadioLabel>
              <input
                type="radio"
                name="sticker-allow"
                value="everyone"
                checked={values.allowMode === 'everyone'}
                onChange={onChange('allowMode')}
              />
              Everyone
            </RadioLabel>
            <RadioLabel>
              <input
                type="radio"
                name="sticker-allow"
                value="followers"
                checked={values.allowMode === 'followers'}
                onChange={onChange('allowMode')}
              />
              Followers only
            </RadioLabel>
            <RadioLabel>
              <input
                type="radio"
                name="sticker-allow"
                value="none"
                checked={values.allowMode === 'none'}
                onChange={onChange('allowMode')}
              />
              Disabled
            </RadioLabel>
          </Row>

          <div>
            <FieldLabel htmlFor="sticker-allowlist">Allowlist (user IDs, comma separated)</FieldLabel>
            <Textarea
              id="sticker-allowlist"
              value={values.allowlist}
              onChange={onChange('allowlist')}
              placeholder="userId1, userId2"
            />
          </div>

          <div>
            <FieldLabel htmlFor="sticker-denylist">Denylist (user IDs, comma separated)</FieldLabel>
            <Textarea
              id="sticker-denylist"
              value={values.denylist}
              onChange={onChange('denylist')}
              placeholder="userId1, userId2"
            />
          </div>

          <RadioLabel>
            <input
              type="checkbox"
              checked={Boolean(values.sticky)}
              onChange={onChange('sticky')}
            />
            Make stickers sticky on load
          </RadioLabel>

          <Hint>Allowlist overrides denylist. Leave both blank to rely solely on the allow mode.</Hint>
        </Body>
        <Footer>
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" $primary onClick={onSave}>
            Save
          </Button>
        </Footer>
      </Modal>
    </Backdrop>
  );
};

export default StickerSettingsModal;