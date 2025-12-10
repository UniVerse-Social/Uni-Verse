// client/src/components/TermsModal.jsx
import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useTermsHtml } from '../utils/useTermsHtml';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(3, 6, 26, 0.78);
  display: ${({ $open }) => ($open ? 'flex' : 'none')};
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  padding: 16px;
`;

const Content = styled.div`
  width: min(960px, 100%);
  max-height: min(90vh, 720px);
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #050510;
  border: 1px solid rgba(72, 85, 130, 0.7);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.85);
`;

const Header = styled.div`
  padding: 14px 18px;
  font-weight: 700;
  border-bottom: 1px solid rgba(72, 85, 130, 0.7);
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #e6e9ff;
  background: radial-gradient(
      800px 420px at 0% 0%,
      rgba(139, 123, 255, 0.22) 0%,
      transparent 60%
    ),
    #050510;
`;

const CloseX = styled.button`
  background: none;
  border: none;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  color: #a3a8c6;
  border-radius: 999px;
  padding: 4px;

  &:hover {
    background: rgba(40, 48, 94, 0.9);
    color: #ffffff;
  }
`;

const Body = styled.div`
  padding: 16px;
  overflow: auto;
  font-size: 14px;
  line-height: 1.5;
  color: #e6e9ff;
  background: radial-gradient(
      900px 500px at 10% 0%,
      rgba(139, 123, 255, 0.15),
      transparent 60%
    ),
    radial-gradient(
      900px 500px at 90% 100%,
      rgba(89, 208, 255, 0.12),
      transparent 60%
    ),
    #050510;

  /* Make injected legal HTML match the dark theme */
  .terms-html,
  .terms-html body,
  .terms-html main,
  .terms-html .container {
    background: transparent !important;
    color: inherit !important;
  }

  .terms-html h1,
  .terms-html h2,
  .terms-html h3,
  .terms-html h4,
  .terms-html h5,
  .terms-html h6 {
    color: inherit !important;
  }

  .terms-html h1 *,
  .terms-html h2 *,
  .terms-html h3 *,
  .terms-html h4 *,
  .terms-html h5 *,
  .terms-html h6 * {
    color: inherit !important;
  }

  .terms-html a {
    color: var(--primary-orange, #8b7bff);
  }
`;

const DOC_MAP = {
  terms: { url: '/terms.html', title: 'Terms and Conditions' },
  privacy: { url: '/privacy.html', title: 'Privacy Policy' },
  guidelines: { url: '/guidelines.html', title: 'Community Guidelines' },
};

export default function TermsModal({
  open,
  onClose,
  title = 'Terms and Conditions',
  docUrl = '/terms.html',
  onNavigate, // (url, title) => void
}) {
  // Load HTML for the selected doc
  const { html, loading, error } = useTermsHtml(docUrl);
  const bodyRef = useRef(null);

  // Scroll to top when we swap docs
  useEffect(() => {
    bodyRef.current?.scrollTo?.({ top: 0, behavior: 'auto' });
  }, [docUrl, html]);

  // Intercept clicks on links with data-legal-doc and swap docs instead of navigating
  const handleBodyClick = (e) => {
    const a = e.target.closest?.('a');
    if (!a) return;
    const key = a.dataset.legalDoc; // "terms" | "privacy" | "guidelines"
    if (!key) return;

    const next = DOC_MAP[key];
    if (!next) return;

    e.preventDefault();
    e.stopPropagation();
    onNavigate?.(next.url, next.title);
  };

  if (!open) return null;

  return (
    <Overlay $open={open} onClick={onClose} aria-hidden={!open}>
      <Content
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        onClick={(e) => e.stopPropagation()}
      >
        <Header>
          <span id="terms-title">{title}</span>
          <CloseX aria-label="Close" onClick={onClose}>
            ×
          </CloseX>
        </Header>
        <Body ref={bodyRef} onClick={handleBodyClick}>
          {loading && <p>Loading…</p>}
          {error && <p>{error}</p>}
          {html && (
            <div
              className="terms-html"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </Body>
      </Content>
    </Overlay>
  );
}
