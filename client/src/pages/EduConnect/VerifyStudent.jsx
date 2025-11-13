import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useSearchParams } from 'react-router-dom';
import schools from '../../data/universities.json';
import { api } from '../../api';
import { emailMatchesDomains } from '../../utils/universityEmail';

const Page = styled.div`
  height: 100dvh; height: 100svh; overflow: hidden;
  display: grid; place-items: center;
  padding: 24px 16px;
  background: linear-gradient(135deg, #f59e0b 0%, #1d4ed8 100%);
`;
const Card = styled.div`
  width: min(720px, 92vw);
  height: clamp(460px, 70dvh, 620px);
  display: flex; flex-direction: column; gap: 10px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 22px;
  box-shadow: 0 10px 24px rgba(0,0,0,0.08);
`;
const Title = styled.h2` margin: 0 0 6px; color: #111827; `;
const P = styled.p` margin: 8px 0 16px; color: #6b7280; `;
const Row = styled.div` display: flex; gap: 10px; margin: 12px 0; `;
const Input = styled.input`
  flex: 1 1 auto;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 16px;
`;
const Button = styled.button`
  padding: 12px 16px; font-weight: 700; cursor: pointer;
  border-radius: 10px; border: 1px solid var(--border-color);
  background: var(--container-white);
  &:hover { background: #fff7ed; }
  &:disabled { opacity: .6; cursor: not-allowed; }
`;

export default function VerifyStudent() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('collect'); // collect -> code
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();

  const school = useMemo(() => {
    const slug = params.get('slug');
    const local = safeParse(localStorage.getItem('educonnect_school'));
    const s = slug || local?.slug;
    const found = (s && schools.find((u) => u.slug === s)) || local;
    if (found) localStorage.setItem('educonnect_school', JSON.stringify(found));
    return found || null;
  }, [params]);

  // Prevent page (document) scrolling while this screen is mounted
  useEffect(() => {
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = previous; };
  }, []);

  useEffect(() => {
    if (!school) { navigate('/edu/select', { replace: true }); return; }

    // NEW: if cookie is still valid, skip this screen
    let ignore = false;
    (async () => {
      try {
        const { data } = await api.get('/verification/status');
        if (!ignore && data?.ok && Number(data.verifiedUntil) > Date.now()) {
          localStorage.setItem('educonnect_verified', '1'); // fast-path for router
          localStorage.setItem('educonnect_verified_until', String(data.verifiedUntil));
          if (data?.email) localStorage.setItem('educonnect_verified_email', data.email);
          navigate('/login', { replace: true });
        }
      } catch {}
    })();
    return () => { ignore = true; };
  }, [school, navigate]);

  async function confirm() {
    setError('');
    try {
      setVerifying(true);
      const { data } = await api.post('/verification/confirm', {
        email: (email || '').trim().toLowerCase(),
        schoolSlug: school.slug,
        code: (code || '').trim(),
      });
      localStorage.setItem('educonnect_verified', '1');
      if (data?.verifiedUntil) {
        localStorage.setItem('educonnect_verified_until', String(data.verifiedUntil));
      }
      localStorage.setItem('educonnect_verified_email', (email || '').trim().toLowerCase());
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Invalid or expired code.');
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    let t;
    if (cooldown > 0) t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!school) return null;

  const requiresDomain = school.domains?.[0];
  const helperText = requiresDomain
    ? `Use your ${school.name} email (e.g., name@${school.domains[0]}).`
    : `Enter your official university email.`;

  async function sendCode() {
    setError('');
    const e = (email || '').trim().toLowerCase();
    if (!emailMatchesDomains(e, school.domains)) {
      setError(`Please use an email ending with @${school.domains[0]}`);
      return;
    }
    try {
      setSending(true);
      await api.post('/verification/send', { email: e, schoolSlug: school.slug });
      setStep('code');
      setCooldown(45); // anti-spam
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not send code.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Page>
      <Card>
        <Title>Verify your student status</Title>
        <P>{helperText}</P>

        {step === 'collect' && (
          <>
            <Row>
              <Input
                type="email"
                inputMode="email"
                placeholder={`name@${requiresDomain || 'university.edu'}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button onClick={sendCode} disabled={sending || !email}>
                {sending ? 'Sending…' : 'Send code'}
              </Button>
            </Row>
          </>
        )}

        {step === 'code' && (
          <>
            <P>We sent a 6-digit code to <strong>{email}</strong>.</P>
            <Row>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
              />
              <Button onClick={confirm} disabled={verifying || code.length < 6}>
                {verifying ? 'Verifying…' : 'Confirm'}
              </Button>
            </Row>
            <Row>
              <Button onClick={sendCode} disabled={cooldown > 0}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </Button>
              <Button onClick={() => setStep('collect')}>Change email</Button>
            </Row>
          </>
        )}

        {!!error && <P style={{ color: '#b91c1c' }}>{error}</P>}
      </Card>
    </Page>
  );
}

function safeParse(s) { try { return JSON.parse(s || ''); } catch { return null; } }
