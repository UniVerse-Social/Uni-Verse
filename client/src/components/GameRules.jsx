// src/components/GameRules.jsx
import React, { useState } from 'react';
import styled from 'styled-components';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
`;

const Modal = styled.div`
  width: min(640px, 94vw);
  max-height: 80vh; /* <-- card never taller than the viewport */
  background: var(--container-white);
  color: var(--text-color);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  padding: 16px 16px 14px;
  display: flex;
  flex-direction: column;
`;

const Body = styled.div`
  margin-top: 12px;
  overflow-y: auto;
  padding-right: 4px;
  max-height: 60vh; /* <-- only the body scrolls */

  /* smoother scrolling on mobile */
  -webkit-overflow-scrolling: touch;
`;

const ModalGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
`;

const TriggerButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;

  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-color);
  border-radius: 12px;
  padding: 8px 12px;
  font-weight: 800;
  cursor: pointer;

  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition: background 0.15s ease, transform 0.08s ease, box-shadow 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

export default function GameRules({
  title = 'Rules',
  subtitle,
  sections = [],
  buttonText = 'Rules',
  buttonTitle,
  buttonStyle,
  renderFooter,
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TriggerButton
        type="button"
        onClick={() => setOpen(true)}
        title={buttonTitle}
        style={buttonStyle}
      >
        {buttonText}
      </TriggerButton>

      {open && (
        <Overlay onClick={() => setOpen(false)}>
          <Modal onClick={(e) => e.stopPropagation()}>
            {/* Header with close button (always visible) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
                {!!subtitle && (
                  <div
                    style={{
                      fontSize: 13,
                      color: 'rgba(230,233,255,0.70)',
                      marginTop: 4,
                    }}
                  >
                    {subtitle}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close rules"
                style={{
                  border: '1px solid var(--border-color)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-color)',
                  borderRadius: 999,
                  width: 32,
                  height: 32,
                  fontSize: 18,
                  fontWeight: 800,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <Body>
              <div style={{ display: 'grid', gap: 10, fontSize: 14 }}>
                {sections.map((sec, i) => (
                  <div key={i}>
                    {sec.heading && (
                      <div style={{ fontWeight: 800 }}>{sec.heading}:</div>
                    )}

                    {sec.text && <div>{sec.text}</div>}

                    {Array.isArray(sec.list) && (
                      <ul>
                        {sec.list.map((li, j) => (
                          <li key={j}>{li}</li>
                        ))}
                      </ul>
                    )}

                    {sec.note && (
                      <div
                        style={{
                          fontSize: 12,
                          marginTop: 6,
                          color: 'rgba(230,233,255,0.75)',
                        }}
                      >
                        {sec.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Body>

            {typeof renderFooter === 'function' && (
              <ModalGrid>
                {renderFooter({ close: () => setOpen(false) })}
              </ModalGrid>
            )}
          </Modal>
        </Overlay>
      )}
    </>
  );
}
