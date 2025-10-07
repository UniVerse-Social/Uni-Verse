// src/pages/LegalDocPage.jsx
import React from 'react';
import styled from 'styled-components';
import { useTermsHtml } from '../utils/useTermsHtml';

const Page = styled.main`
  max-width: 1024px;
  margin: 32px auto;
  padding: 0 16px;
`;

const Card = styled.section`
  background: var(--container-white, #fff);
  color: #111;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
  padding: 24px;

  /* Let links use theme accent */
  a { color: var(--primary-orange, #0a58ca); }

  /* If the embedded HTML sets its own page background, neutralize it */
  .container { background: transparent !important; }
`;

export default function LegalDocPage({ docUrl = '/terms.html', title = 'Legal' }) {
  const { html, loading, error } = useTermsHtml(docUrl);

  return (
    <Page aria-label={title}>
      {loading && <p>Loading…</p>}
      {error && <p>{error}</p>}
      {html && (
        <Card className="legal-doc">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </Card>
      )}
    </Page>
  );
}
