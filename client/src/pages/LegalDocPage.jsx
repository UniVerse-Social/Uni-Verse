// src/pages/LegalDocPage.jsx
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

const Page = styled.main`
  max-width: 1024px;
  margin: 32px auto;
  padding: 0 16px 48px;
`;

const Card = styled.section`
  background: var(--container-white, #0f1329);
  color: var(--text-color, #e6e9ff);
  border: 1px solid var(--border-color, #1a2147);
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
  padding: 32px 24px;
  backdrop-filter: blur(18px);

  /* Let links use your primary accent */
  a {
    color: var(--primary-orange, #8b7bff);
  }

  /* Kill the light container background from the static HTML docs */
  .container {
    background: transparent !important;
    color: inherit !important;
  }

  /* If the embedded doc tried to set its own body/html bg, neutralize it */
  html,
  body {
    background: transparent !important;
  }
`;

export default function LegalDocPage({
  docUrl = '/terms.html',
  title = 'Legal',
}) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDoc() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(docUrl, { credentials: 'include' });
        if (!res.ok) {
          throw new Error(`Failed to load document (${res.status})`);
        }

        const text = await res.text();
        if (!cancelled) {
          setHtml(text);
        }
      } catch (err) {
        console.error('Error loading legal doc:', err);
        if (!cancelled) {
          setError('Could not load this page. Please try again later.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDoc();
    return () => {
      cancelled = true;
    };
  }, [docUrl]);

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
