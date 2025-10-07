// client/src/components/TermsModal.jsx
import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useTermsHtml } from '../utils/useTermsHtml';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  display: ${({ $open }) => ($open ? 'flex' : 'none')};
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
`;

const Content = styled.div`
  background: #fff;
  width: min(92vw, 800px);
  max-height: 80vh;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
`;

const Header = styled.div`
  padding: 14px 16px;
  font-weight: 700;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #111;
`;

const CloseX = styled.button`
  background: none;
  border: none;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
`;

const Body = styled.div`
  padding: 16px;
  overflow: auto;
  font-size: 14px;
  line-height: 1.5;
  color: #111;

  /* keep injected content readable */
  .terms-html h1, .terms-html h2, .terms-html h3,
  .terms-html h4, .terms-html h5, .terms-html h6 { color:#111 !important; }
  .terms-html h1 *, .terms-html h2 *, .terms-html h3 *,
  .terms-html h4 *, .terms-html h5 *, .terms-html h6 * { color:inherit !important; }
  .terms-html a { color: var(--primary-orange, #0a58ca); }
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
  onNavigate,        // (url, title) => void
}) {
  // Hooks must run unconditionally
  const { html, loading, error } = useTermsHtml(docUrl);
  const bodyRef = useRef(null);

  // scroll to top whenever doc changes
  useEffect(() => {
    bodyRef.current?.scrollTo?.({ top: 0, behavior: 'auto' });
  }, [docUrl, html]);

  // Intercept clicks on links with data-legal-doc and swap docs
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

  // Early return AFTER hooks to satisfy rules-of-hooks
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
          <CloseX aria-label="Close" onClick={onClose}>×</CloseX>
        </Header>
        <Body ref={bodyRef} onClick={handleBodyClick}>
          {loading && <p>Loading…</p>}
          {error && <p>{error}</p>}
          {html && <div className="terms-html" dangerouslySetInnerHTML={{ __html: html }} />}
        </Body>
      </Content>
    </Overlay>
  );
}
