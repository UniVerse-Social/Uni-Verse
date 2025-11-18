import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';

// ensure the modal never crashes if `values` is missing
const DEFAULTS = {
  allowMode: 'none',         // Disabled by default
  allowstickytext: false,    // off
  allowstickymedia: false,   // off
  allowlist: '',
  denylist: '',
  maxCount: 20,              // slider still valid (min 1)
  hideFeedStickers: true,    // hide stickers in feed by default
  showStickerPanel: false,   // panel hidden by default
};

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1500;
  padding: 24px;
  backdrop-filter: saturate(120%) blur(2px);
`;

const Modal = styled.div`
  background: var(--container-white);
  color: var(--text-color);
  border-radius: 18px;
  border: 1px solid var(--border-color);
  box-shadow: 0 28px 48px rgba(0, 0, 0, 0.45);
  width: 100%;
  max-width: 540px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  padding: 20px 24px 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: var(--text-color);
`;

const Body = styled.div`
  padding: 24px;
  display: grid;
  gap: 8px;

  /* make native inputs pick up brand color */
  input[type="radio"],
  input[type="checkbox"],
  input[type="range"] { accent-color: var(--primary-orange); }
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
  color: rgba(230, 233, 255, 0.9);
`;

const FieldLabel = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 6px;
  color: rgba(230, 233, 255, 0.9);
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 25px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  padding: 10px 12px;
  font-size: 13px;
  resize: vertical;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-color);
  box-sizing: border-box;

  &::placeholder { color: rgba(230, 233, 255, 0.55); }
  &:focus { outline: none; box-shadow: 0 0 0 2px rgba(139,123,255,0.25); }
`;

const FieldGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 12px;
  }
`;

const FieldGroup = styled.div`
  flex: 1 1 calc(50% - 10px);
  min-width: 220px;
  display: flex;
  flex-direction: column;
`;

const Footer = styled.div`
  padding: 18px 24px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between; /* left + right groups */
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.05);
`;

const Button = styled.button`
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  color: ${(p) => (p.$primary ? '#fff' : 'var(--text-color)')};
  background: ${(p) =>
    p.$primary
      ? 'linear-gradient(90deg, var(--primary-orange), rgba(89,208,255,0.95))'
      : 'rgba(255, 255, 255, 0.08)'};
  transition: filter 0.2s ease, background 0.2s ease, color 0.2s ease;

  &:hover { filter: brightness(0.98); }
`;

// destructive-style button
const DestructiveButton = styled.button`
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #ffd9d9;
  background: rgba(239, 68, 68, 0.14);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  &:hover {
    background: rgba(239, 68, 68, 0.22);
    border-color: rgba(239, 68, 68, 0.55);
  }
  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const SliderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
`;

const SliderInput = styled.input`
  flex: 1;
  accent-color: var(--primary-orange);
`;

const SliderValue = styled.span`
  min-width: 32px;
  font-weight: 800;
  font-size: 14px;
  color: var(--text-color);
  text-align: right;
`;

const InfoNote = styled.p`
  margin: 2px 0 0;
  line-height: 1.2;
  font-size: 10px;
  color: rgba(230, 233, 255, 0.55);
`;

const PortalTarget = typeof document !== 'undefined' ? document.body : null;

const FooterLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ResetButton = styled.button`
  border: none;
  background: transparent;
  color: var(--primary-orange);
  font-weight: 800;
  cursor: pointer;
  padding: 6px 0;
  &:hover { text-decoration: underline; }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    text-decoration: none;
  }
`;

const FooterRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StickerSettingsModal = ({
  open,
  values,
  onChange,
  onSave,
  onCancel,
  onClearAll,
}) => {
  const [clearing, setClearing] = useState(false);
  const isPostModal = typeof onClearAll === 'function';

  useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent('fc-modal-open', { detail: 'sticker-settings' }));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [open]);

  const hasShowStickerPanel =
    values && Object.prototype.hasOwnProperty.call(values, 'showStickerPanel');

  const v = useMemo(() => {
    const merged = { ...DEFAULTS, ...(values || {}) };
    const max = Number(merged.maxCount);
    merged.maxCount = Number.isFinite(max) ? Math.min(30, Math.max(1, Math.round(max))) : DEFAULTS.maxCount;
    merged.hideFeedStickers = !!merged.hideFeedStickers;
    if (hasShowStickerPanel) {
      merged.showStickerPanel = merged.showStickerPanel !== false;
    } else {
      delete merged.showStickerPanel;
    }
    return merged;
  }, [values, hasShowStickerPanel]);

  const handleMaxSliderChange = (event) => {
    const value = Number(event.target.value);
    onChange('maxCount')({ target: { value } });
  };

  const handleClearAll = async () => {
    if (clearing || typeof onClearAll !== 'function') return;
    const confirmed = window.confirm('Remove ALL stickers from this post? This cannot be undone.');
    if (!confirmed) return;
    try {
      setClearing(true);
      const result = await onClearAll();
      if (result !== false) {
        onCancel();
      }
    } catch (err) {
      console.error('Clear all stickers failed', err);
    } finally {
      setClearing(false);
    }
  };

  const handleToggleHideFeed = () => {
    if (typeof onChange !== 'function') return;
    const handler = onChange('hideFeedStickers');
    if (typeof handler === 'function') {
      handler({ target: { value: !v.hideFeedStickers } });
    }
  };

  const handleToggleStickerPanel = () => {
    if (typeof onChange !== 'function') return;
    const handler = onChange('showStickerPanel');
    if (typeof handler === 'function') {
      handler({ target: { checked: !v.showStickerPanel } });
    }
  };

  const handleResetDefaults = () => {
    if (typeof onChange !== 'function') return;
    const emit = (field, payload) => {
      const handler = onChange(field);
      if (typeof handler === 'function') {
        handler(payload);
      }
    };

    emit('allowMode', { target: { value: DEFAULTS.allowMode } });
    emit('allowstickytext', { target: { checked: DEFAULTS.allowstickytext } });
    emit('allowstickymedia', { target: { checked: DEFAULTS.allowstickymedia } });
    emit('allowlist', { target: { value: DEFAULTS.allowlist } });
    emit('denylist', { target: { value: DEFAULTS.denylist } });
    emit('maxCount', { target: { value: DEFAULTS.maxCount } });
    emit('hideFeedStickers', { target: { value: DEFAULTS.hideFeedStickers } });
    if (!isPostModal && hasShowStickerPanel) {
      emit('showStickerPanel', { target: { checked: DEFAULTS.showStickerPanel } });
    }
  };

  if (!open || !PortalTarget) return null;

  const modal = (
    <Backdrop onClick={onCancel} role="presentation">
      <Modal
        role="dialog"
        aria-modal="true"
        aria-label="Sticker settings"
        onClick={(e) => e.stopPropagation()}
      >
        <Header>
          <Title>{isPostModal ? "Post Sticker Settings" : "Sticker Settings"}</Title>
        </Header>

        <Body>
          <Row>
            <RadioLabel>
              <input
                type="radio"
                name="sticker-allow"
                value="everyone"
                checked={v.allowMode === 'everyone'}
                onChange={onChange('allowMode')}
              />
              Everyone
            </RadioLabel>
            <RadioLabel>
              <input
                type="radio"
                name="sticker-allow"
                value="followers"
                checked={v.allowMode === 'followers'}
                onChange={onChange('allowMode')}
              />
              Followers
            </RadioLabel>
            <RadioLabel>
              <input
                type="radio"
                name="sticker-allow"
                value="owner"
                checked={v.allowMode === 'owner'}
                onChange={onChange('allowMode')}
              />
              Myself only
            </RadioLabel>
            <RadioLabel>
              <input
                type="radio"
                name="sticker-allow"
                value="none"
                checked={v.allowMode === 'none'}
                onChange={onChange('allowMode')}
              />
              Disabled
            </RadioLabel>
          </Row>

          <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
          <div>
            <FieldLabel>Placement</FieldLabel>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0', color: 'var(--text-color)' }}>
              <input
                type="checkbox"
                checked={!!v.allowstickytext}
                onChange={onChange('allowstickytext')}
              />
              Allow stickers over post text
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-color)' }}>
              <input
                type="checkbox"
                checked={!!v.allowstickymedia}
                onChange={onChange('allowstickymedia')}
              />
              Allow stickers over images/media
            </label>
            <SliderRow>
              <label htmlFor="max-stickers-slider" style={{ fontWeight: 700, fontSize: 13, color: 'rgba(230,233,255,0.9)' }}>
                Max stickers per post
              </label>
              <SliderValue>{v.maxCount}</SliderValue>
            </SliderRow>
            <SliderInput
              id="max-stickers-slider"
              type="range"
              min={1}
              max={30}
              value={v.maxCount}
              onChange={handleMaxSliderChange}
            />
            <InfoNote>
              Sticker limit caps total placements on this post. Lowering the limit does not delete stickers, but it prevents new ones.
            </InfoNote>
          </div>

          <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />

          <FieldGrid>
            <FieldGroup>
              <FieldLabel htmlFor="sticker-allowlist">
                Allowlist (usernames, comma separated)
              </FieldLabel>
              <Textarea
                id="sticker-allowlist"
                value={v.allowlist || ''}
                onChange={onChange('allowlist')}
                placeholder="Jim, Bob, Joe"
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel htmlFor="sticker-denylist">
                Denylist (usernames, comma separated)
              </FieldLabel>
              <Textarea
                id="sticker-denylist"
                value={v.denylist || ''}
                onChange={onChange('denylist')}
                placeholder="Cassy, Kim"
              />
            </FieldGroup>
          </FieldGrid>

          {!isPostModal && (
            hasShowStickerPanel ? (
              <div>
                <FieldLabel>Sticker Panel Toggle</FieldLabel>
                <ToggleStack>
                  <PanelToggle
                    type="button"
                    onClick={handleToggleStickerPanel}
                    $active={!!v.showStickerPanel}
                    aria-pressed={!!v.showStickerPanel}
                  >
                    <div>
                      {v.showStickerPanel ? 'Hide Sticker Panel' : 'Show Sticker Panel'}
                    </div>
                    <span>{v.showStickerPanel ? 'Visible' : 'Hidden'}</span>
                  </PanelToggle>
                  <PanelToggle
                    type="button"
                    onClick={handleToggleHideFeed}
                    $active={!v.hideFeedStickers}
                    aria-pressed={!v.hideFeedStickers}
                  >
                    <div>
                      {v.hideFeedStickers ? 'Show stickers in my feed' : 'Hide stickers in my feed'}
                    </div>
                    <span>{v.hideFeedStickers ? 'Hidden' : 'Visible'}</span>
                  </PanelToggle>
                </ToggleStack>
              </div>
            ) : (
              <div>
                <FieldLabel>Feed Sticker Visibility</FieldLabel>
                <PanelToggle
                  type="button"
                  onClick={handleToggleHideFeed}
                  $active={!v.hideFeedStickers}
                  aria-pressed={!v.hideFeedStickers}
                >
                  <div>
                    {v.hideFeedStickers ? 'Show stickers in my feed' : 'Hide stickers in my feed'}
                  </div>
                  <span>{v.hideFeedStickers ? 'Hidden' : 'Visible'}</span>
                </PanelToggle>
              </div>
            )
          )}
        </Body>

        <Footer>
          <FooterLeft>
            {!isPostModal && (
              <ResetButton type="button" onClick={handleResetDefaults}>
                Reset to default
              </ResetButton>
            )}
            {typeof onClearAll === 'function' && (
              <DestructiveButton
                type="button"
                onClick={handleClearAll}
                disabled={clearing}
              >
                {clearing ? 'Clearing…' : 'Clear all stickers'}
              </DestructiveButton>
            )}
          </FooterLeft>
          <FooterRight>
            <Button type="button" onClick={onCancel}>Cancel</Button>
            <Button type="button" $primary onClick={onSave}>Save</Button>
          </FooterRight>
        </Footer>
      </Modal>
    </Backdrop>
  );

  return createPortal(modal, PortalTarget);
};

export default StickerSettingsModal;

const ToggleStack = styled.div`
  display: grid;
  gap: 10px;
  margin-top: 8px;
`;

const PanelToggle = styled.button`
  border-radius: 12px;
  padding: 12px 16px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;

  background: ${(p) => (p.$active ? 'rgba(139,123,255,0.16)' : 'rgba(255,255,255,0.06)')};
  color: var(--text-color);
  border: 1px solid ${(p) => (p.$active ? 'rgba(139,123,255,0.45)' : 'var(--border-color)')};
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;

  span {
    font-size: 12px;
    font-weight: 600;
    color: ${(p) => (p.$active ? 'rgba(230,233,255,0.85)' : 'rgba(230,233,255,0.70)')};
  }

  &:hover {
    background: ${(p) => (p.$active ? 'rgba(139,123,255,0.22)' : 'rgba(255,255,255,0.10)')};
  }
`;
