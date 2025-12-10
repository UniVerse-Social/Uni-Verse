// client/src/pages/Signup.js
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styled from 'styled-components';
import { api } from '../api';

import { debounce } from 'lodash';
import { AuthContext } from '../App';
import TermsModal from '../components/TermsModal';
import { HOBBY_LIMIT, mapHobbiesWithMeta } from '../utils/hobbies';
import {
  CountBadge,
  Hint,
  LimitNote,
  HobbyGrid,
  HobbyOption as BaseHobbyOption,
  HobbyEmoji,
  HobbyText,
} from '../components/HobbyTiles';

// Small helper for reading JSON from localStorage safely
const safeParse = (s) => {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
};
// Strictly require school email (accept exact match or subdomain-of-school)
const ensureSchoolEmail = (email, school) => {
  if (!email || !school || !Array.isArray(school.domains)) return false;
  const at = String(email).toLowerCase().split('@')[1];
  if (!at) return false;
  return school.domains.some((d) => {
    const need = String(d).toLowerCase();
    return at === need || at.endsWith(`.${need}`);
  });
};
// Password rules: >=8 chars and at least 1 number
const passwordIssues = (pw) => {
  const s = String(pw || '');
  const issues = [];
  if (s.length < 8) issues.push('at least 8 characters');
  if (!/\d/.test(s)) issues.push('at least one number');
  return issues;
};
const isStrongPassword = (pw) => passwordIssues(pw).length === 0;
const fieldAvailable = async (field, value) => {
  try {
    const body =
      field === 'email'
        ? { email: String(value || '').trim().toLowerCase() }
        : { username: String(value || '').trim() };

    const res = await api.post('/auth/check-availability', body);
    const d = res?.data || {};

    if (field === 'email') {
      if (typeof d.isEmailTaken === 'boolean') return !d.isEmailTaken;
    } else if (field === 'username') {
      if (typeof d.isUsernameTaken === 'boolean') return !d.isUsernameTaken;
    }

    // fallback if server shape changes
    if (typeof d.available === 'boolean') return d.available;
    if (typeof d.taken === 'boolean') return !d.taken;

    return true;
  } catch (err) {
    console.error('Error during hard availability check', err);
    return true; // don't hard-block signup on network error
  }
};

// ===== Styled components (existing + a few new ones) =====
const SignupContainer = styled.div`
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 100vh; background-color: var(--background-grey); padding: 20px;
`;

const SignupForm = styled.form`
  background: var(--container-white); padding: 40px; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: flex; flex-direction: column; gap: 18px;
  width: 100%; max-width: 520px;
`;

const Input = styled.input`
  padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 16px;
`;

const Select = styled.select`
  padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 16px;
`;

const Button = styled.button`
  padding: 12px; background-color: var(--primary-orange); color: white; border: none; border-radius: 4px;
  font-size: 16px; font-weight: bold; cursor: pointer;
  &:hover { opacity: 0.9; }
  &:disabled { background-color: #ccc; cursor: not-allowed; }
`;

const HobbyPanel = styled.div`
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 16px;
  padding: 16px;
  display: grid;
  gap: 14px;
`;

const HobbyHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
`;

const HobbyHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const ClearAllButton = styled.button`
  border: none;
  background: transparent;
  color: #2563eb;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  &:hover { text-decoration: underline; }
`;
const HobbyOption = styled(BaseHobbyOption)`
  /* default (unselected) can keep the base styles; tweak hover a bit */
  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  /* selected state */
  ${({ $selected }) =>
    $selected &&
    `
      background: linear-gradient(135deg, var(--primary-orange) 0%, #6B63FF 100%) !important;
      color: #fff !important;
      border-color: transparent !important;
      box-shadow: 0 0 0 1px rgba(139, 123, 255, 0.45) inset;

      &:hover {
        background: linear-gradient(135deg, #9B8CFF 0%, #7A72FF 100%) !important;
      }
    `}

  /* keyboard focus ring */
  &:focus-visible {
    outline: 2px solid var(--primary-orange);
    outline-offset: 2px;
  }
`;
const ValidationMessage = styled.p` color: red; font-size: 14px; margin: -10px 0 0 5px; `;

const LoginLink = styled(Link)`
  color: var(--primary-orange); text-decoration: none; text-align: center; margin-top: 10px;
  &:hover { text-decoration: underline; }
`;

const ErrorBanner = styled.div`
  background:#fee2e2; color:#991b1b; padding:10px 12px; border-radius:8px; font-size:14px;
`;

// NEW: Terms row + modal
const TermsRow = styled.div`
  display: flex; align-items: flex-start; gap: 10px; font-size: 14px; line-height: 1.4;
  margin-top: 6px;
  input { margin-top: 2px; }
`;

const InlineLink = styled.button`
  background: none; border: none; padding: 0; margin: 0;
  color: var(--primary-orange); cursor: pointer; text-decoration: underline; font: inherit;
`;


const Signup = () => {
  const [step, setStep] = useState(1); // 1: account, 2: verify, 3: dept, 4: hobbies
  const [formData, setFormData] = useState({
    email: '', username: '', password: '', password2: '', department: '', hobbies: []
  });
  const [signupData, setSignupData] = useState({ departments: [], hobbies: [] });
  const [validation, setValidation] = useState({ email: '', username: '' });
  const [isChecking, setIsChecking] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [hobbyLimitNote, setHobbyLimitNote] = useState('');
  // email verification step
  const [verifyCode, setVerifyCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [sendCooldown, setSendCooldown] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  // terms state
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [modalDoc, setModalDoc] = useState('/terms.html');
  const [modalTitle, setModalTitle] = useState('Terms of Service');
  const TERMS_VERSION = '2025-10-06'; //for when we update T&C down the line


  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const hobbyOptions = useMemo(
    () => mapHobbiesWithMeta(signupData.hobbies),
    [signupData.hobbies]
  );

  // clear error when leaving step 3
  useEffect(() => {
    if (step !== 3 && errMsg) setErrMsg('');
  }, [step]); // eslint-disable-line

  // clear error as soon as they accept
  useEffect(() => {
    if (termsAccepted && errMsg) setErrMsg('');
  }, [termsAccepted]); // eslint-disable-line

  // Load departments/hobbies for UI
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/auth/signup-data');
        setSignupData(res.data);
        if (res.data.departments?.length) {
          setFormData(prev => ({ ...prev, department: res.data.departments[0] }));
        }
      } catch (err) {
        console.error('Failed to fetch signup data', err);
      }
    })();
  }, []);

  useEffect(() => {
    if (sendCooldown <= 0) return;
    const t = setInterval(() => setSendCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [sendCooldown]);
  // Debounced availability check
const checkAvailability = useMemo(
  () =>
    debounce(async (field, valueRaw) => {
      const value =
        field === 'email'
          ? String(valueRaw || '').trim().toLowerCase()
          : String(valueRaw || '').trim();

      if (!value) {
        setValidation((prev) => ({ ...prev, [field]: '' }));
        return;
      }

      setIsChecking(true);
      try {
        const body =
          field === 'email'
            ? { email: value }
            : { username: value };

        const res = await api.post('/auth/check-availability', body);

        const taken =
          field === 'email'
            ? !!res?.data?.isEmailTaken
            : !!res?.data?.isUsernameTaken;

        setValidation((prev) => ({
          ...prev,
          [field]: taken
            ? `${field === 'email' ? 'Email' : 'Username'} is already taken`
            : '',
        }));

        // Extra: school email domain enforcement
        if (field === 'email') {
          const school = safeParse(localStorage.getItem('educonnect_school'));
          const ok = ensureSchoolEmail(value, school);
          if (!ok) {
            const hint = school?.domains?.length
              ? `Use your ${school.name} email (${school.domains
                  .map((d) => '@' + d)
                  .join(', ')})`
              : 'Select your university first';
            setValidation((prev) => ({ ...prev, email: hint }));
          }
        }
      } catch (err) {
        console.error('Error checking availability', err);
        // on error keep current validation
      } finally {
        setIsChecking(false);
      }
    }, 400),
  []
);

async function startEmailVerification() {
  setErrMsg('');
  const school = safeParse(localStorage.getItem('educonnect_school'));
  const email = String(formData.email || '').trim().toLowerCase();
  const username = String(formData.username || '').trim();
  if (emailVerified) { setStep(3); return; } // already verified -> jump ahead
  if (!school) { setErrMsg('Please select your university.'); return; }
  if (!ensureSchoolEmail(email, school)) {
    setErrMsg(`Use your ${school.name} email (${(school.domains||[]).map(d=>'@'+d).join(', ')})`);
    return;
  }
  if (!isStrongPassword(formData.password)) {
    setErrMsg(`Password must have ${passwordIssues(formData.password).join(' and ')}.`);
    return;
  }
  // Hard check with server before sending code
  const [emailOK, userOK] = await Promise.all([
    fieldAvailable('email', email),
    fieldAvailable('username', username),
  ]);
  if (!emailOK) {
    setValidation((prev) => ({ ...prev, email: 'Email is already taken' }));
    setErrMsg('Please use a different email.');
    return;
  }
  if (!userOK) {
    setValidation((prev) => ({ ...prev, username: 'Username is already taken' }));
    setErrMsg('Please choose a different username.');
    return;
  }
  if (formData.password !== formData.password2) { setErrMsg('Passwords do not match.'); return; }
  if (validation.email || validation.username || isChecking) {
    setErrMsg('Please resolve the availability checks before continuing.');
    return;
  }
  // startEmailVerification
  try {
    setSendingCode(true);
    await api.post('/verification/send', { email, schoolSlug: school.slug });
    setSendCooldown(60);
    setStep(2);
  } catch (err) {
    const msg = err?.response?.data?.message || 'Failed to send verification email.';
    setErrMsg(msg);
  } finally {
    setSendingCode(false);
  }
}

async function confirmEmailCode() {
  setErrMsg('');
  const school = safeParse(localStorage.getItem('educonnect_school'));
  const email = String(formData.email || '').trim().toLowerCase();
  try {
    setConfirming(true);
    const { data } = await api.post('/verification/confirm', {
      email,
      schoolSlug: school?.slug,
      code: String(verifyCode || '').trim(),
    });
    if (data?.ok || data?.verifiedUntil) {
      // also store locally so returning users skip in future
      localStorage.setItem('educonnect_verified', '1');
      if (data?.verifiedUntil) localStorage.setItem('educonnect_verified_until', String(data.verifiedUntil));
      localStorage.setItem('educonnect_verified_email', email);
      setEmailVerified(true);
      setStep(3);
    } else {
      setErrMsg('Invalid or expired code.');
    }
  } catch (err) {
    const msg = err?.response?.data?.message || 'Invalid or expired code.';
    setErrMsg(msg);
  } finally {
    setConfirming(false);
  }
}

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'email' || name === 'username') {
      checkAvailability(name, value);
      if (!value.trim()) {
        setValidation((prev) => ({ ...prev, [name]: '' }));
      }
    }
    setErrMsg('');
  };

  const toggleHobby = (name) => {
    setHobbyLimitNote('');
    setFormData(prev => {
      const already = prev.hobbies.includes(name);
      if (already) {
        return { ...prev, hobbies: prev.hobbies.filter(h => h !== name) };
      }
      if (prev.hobbies.length >= HOBBY_LIMIT) {
        setHobbyLimitNote(`You can select up to ${HOBBY_LIMIT} hobbies.`);
        return prev;
      }
      return { ...prev, hobbies: [...prev.hobbies, name] };
    });
  };

  const clearHobbies = () => {
    setFormData(prev => ({ ...prev, hobbies: [] }));
    setHobbyLimitNote('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrMsg('');

    const username = formData.username.trim();
    const email = formData.email.trim().toLowerCase();
    const password = String(formData.password || '');

    if (!username || !email || !password) {
      setErrMsg('Please complete all required fields.');
      return;
    }
    const pwIssues = passwordIssues(password);
    if (pwIssues.length > 0) {
      setErrMsg(`Password must have ${pwIssues.join(' and ')}.`);
      return;
    }
    if (!termsAccepted) {
      setErrMsg('You must accept the Terms of Service, Community Guidelines, and acknowledge the Privacy Policy to create an account.');
      return;
    }
    if (validation.email || validation.username || isChecking) {
      setErrMsg('Please resolve the availability checks before continuing.');
      return;
    }

    try {
      if (!emailVerified) {
        setErrMsg('Please verify your email to continue.');
        setStep(2);
        return;
      }
      const payload = {
      username,
      email,
      password,
      department: (formData.department || '').trim(),
      hobbies: Array.isArray(formData.hobbies) ? formData.hobbies : [],
      termsAccepted: true,
      termsAcceptedVersion: TERMS_VERSION,
      termsAcceptedAt: new Date().toISOString(),
    };

      const signupRes = await api.post('/auth/signup', payload);

      const serverUser = signupRes?.data;
      if (serverUser && (serverUser._id || serverUser.username)) {
        login(serverUser);
        navigate('/');
        return;
      }

      const loginRes = await api.post('/auth/login', {
        loginIdentifier: email,
        password,
      });
      login(loginRes.data);
      navigate('/');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to create account. Please try again.';
      setErrMsg(msg);
    }
  };

  const selectedSchool = safeParse(localStorage.getItem('educonnect_school'));
  const emailOkForSchool = ensureSchoolEmail(
    String(formData.email||'').trim().toLowerCase(),
    selectedSchool
  );
  const pwMatch = formData.password && formData.password2 && formData.password === formData.password2;
  const pwStrong = isStrongPassword(formData.password);
  const isStep1Valid =
    formData.email.trim() &&
    formData.username.trim() &&
    pwStrong &&
    pwMatch &&
    emailOkForSchool &&
    !validation.email && !validation.username && !isChecking;

  return (
    <SignupContainer>
      <SignupForm onSubmit={handleSubmit} autoComplete="off">
        {errMsg && <ErrorBanner>{errMsg}</ErrorBanner>}

        {step === 1 && (
          <>
            <h2>Create Account</h2>
            <Input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
            {validation.email && <ValidationMessage>{validation.email}</ValidationMessage>}

            <Input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="text"
              data-1p-ignore="true"     // 1Password hint to ignore
              data-lpignore="true"      // LastPass hint to ignore
            />
            {validation.username && <ValidationMessage>{validation.username}</ValidationMessage>}

            <Input
              type="password"
              name="password"
              placeholder="Password (min 8 chars, 1 number)"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
            {formData.password && !isStrongPassword(formData.password) && (
              <ValidationMessage>
                Password must have {passwordIssues(formData.password).join(' and ')}.
              </ValidationMessage>
            )}
            <Input
              type="password"
              name="password2"
              placeholder="Retype password"
              value={formData.password2}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
            {formData.password2 && formData.password !== formData.password2 && (
              <ValidationMessage>Passwords do not match</ValidationMessage>
            )}
            <Button type="button" onClick={startEmailVerification} disabled={!isStep1Valid || sendingCode}>
              {sendingCode ? 'Sending…' : 'Next'}
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Verify your email</h2>
            <p>We sent a 6-digit code to <b>{String(formData.email).trim().toLowerCase()}</b>.</p>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="verify"
              placeholder="Enter code"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <Button type="button" onClick={confirmEmailCode} disabled={!verifyCode || confirming}>
                {confirming ? 'Verifying…' : 'Verify & Continue'}
              </Button>
              <Button type="button" style={{ backgroundColor: '#888' }} onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                type="button"
                style={{ backgroundColor: '#4b5563' }}
                disabled={sendCooldown > 0 || sendingCode}
                onClick={startEmailVerification}
              >
                {sendCooldown > 0 ? `Resend in ${sendCooldown}s` : (sendingCode ? 'Sending…' : 'Resend code')}
              </Button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h2>Select Department</h2>
            <Select name="department" onChange={handleChange} value={formData.department}>
              {signupData.departments.map(dep => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </Select>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button type="button" onClick={() => setStep(4)}>Next</Button>
              <Button type="button" style={{ backgroundColor: '#888' }} onClick={() => setStep(1)}>Back</Button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2>Hobbies ({formData.hobbies.length}/{HOBBY_LIMIT})</h2>
            <HobbyPanel>
              <HobbyHeaderRow>
                <HobbyHeaderLeft>
                  <CountBadge>Selected: {formData.hobbies.length}/{HOBBY_LIMIT}</CountBadge>
                  <Hint>Pick up to {HOBBY_LIMIT} hobbies.</Hint>
                </HobbyHeaderLeft>
                {formData.hobbies.length > 0 && (
                  <ClearAllButton type="button" onClick={clearHobbies}>
                    Clear all
                  </ClearAllButton>
                )}
              </HobbyHeaderRow>

              {hobbyLimitNote && <LimitNote>{hobbyLimitNote}</LimitNote>}

              <HobbyGrid>
                {hobbyOptions.map(({ name, emoji }) => {
                  const selected = formData.hobbies.includes(name);
                  return (
                    <HobbyOption
                      key={name}
                      type="button"
                      $selected={selected}
                      onClick={() => toggleHobby(name)}
                      aria-pressed={selected}
                      aria-label={`${selected ? 'Deselect' : 'Select'} ${name}`}
                    >
                      <HobbyEmoji aria-hidden="true">{emoji}</HobbyEmoji>
                      <HobbyText>{name}</HobbyText>
                    </HobbyOption>
                  );
                })}
              </HobbyGrid>
            </HobbyPanel>

            {/* Terms & Conditions gate (required before submit) */}
            <TermsRow>
              <input
                id="agree-terms"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  if (e.target.checked && errMsg) setErrMsg('');
                }}
                aria-required="true"
              />
              <span>
                <label htmlFor="agree-terms" style={{ cursor: 'pointer' }}>
                  I agree to the
                </label>{' '}
                <InlineLink
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setModalDoc('/terms.html');
                    setModalTitle('Terms of Service');
                    setShowTerms(true);
                    if (errMsg) setErrMsg('');
                  }}
                >
                  Terms of Service
                </InlineLink>
                , I’ve read the{' '}
                <InlineLink
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setModalDoc('/privacy.html');
                    setModalTitle('Privacy Policy');
                    setShowTerms(true);
                  }}
                >
                  Privacy Policy
                </InlineLink>
                , and I will follow the{' '}
                <InlineLink
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setModalDoc('/guidelines.html');
                    setModalTitle('Community Guidelines');
                    setShowTerms(true);
                  }}
                >
                  Community Guidelines
                </InlineLink>
                .
              </span>
            </TermsRow>

            <div style={{ display: 'flex', gap: 10 }}>
              <Button type="submit">Create Account</Button>
              <Button
                type="button"
                style={{ backgroundColor: '#888' }}
                onClick={() => { setStep(3); setErrMsg(''); }}
              >
                Back
              </Button>
            </div>
          </>
        )}
        <LoginLink to="/login">Already have an account? Log In</LoginLink>
      </SignupForm>
      <TermsModal
        open={showTerms}
        onClose={() => setShowTerms(false)}
        title={modalTitle}
        docUrl={modalDoc}
        onNavigate={(url, nextTitle) => {
          setModalDoc(url);
          setModalTitle(nextTitle);
        }}
      />
    </SignupContainer>
  );
};

export default Signup;