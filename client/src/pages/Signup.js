// client/src/pages/Signup.js
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import { debounce } from 'lodash';
import { AuthContext } from '../App';
import TermsModal from '../components/TermsModal';
import { HOBBY_LIMIT, mapHobbiesWithMeta } from '../utils/hobbies';
import {
  CountBadge,
  Hint,
  LimitNote,
  HobbyGrid,
  HobbyOption,
  HobbyEmoji,
  HobbyText,
} from '../components/HobbyTiles';


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
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '', username: '', password: '', department: '', hobbies: []
  });
  const [signupData, setSignupData] = useState({ departments: [], hobbies: [] });
  const [validation, setValidation] = useState({ email: '', username: '' });
  const [isChecking, setIsChecking] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [hobbyLimitNote, setHobbyLimitNote] = useState('');

  // NEW: terms state
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
        const res = await axios.get('http://localhost:5000/api/auth/signup-data');
        setSignupData(res.data);
        if (res.data.departments?.length) {
          setFormData(prev => ({ ...prev, department: res.data.departments[0] }));
        }
      } catch (err) {
        console.error('Failed to fetch signup data', err);
      }
    })();
  }, []);

  // Debounced availability check
  const checkAvailability = useMemo(
    () => debounce(async (field, valueRaw) => {
      const value =
        field === 'email'
          ? String(valueRaw || '').trim().toLowerCase()
          : String(valueRaw || '').trim();
      if (!value) return;
      setIsChecking(true);
      try {
        const res = await axios.post('http://localhost:5000/api/auth/check-availability', { [field]: value });
        const { isEmailTaken, isUsernameTaken } = res.data || {};
        setValidation(prev => ({
          ...prev,
          [field]: (field === 'email' ? isEmailTaken : isUsernameTaken) ? `${field} is already taken.` : ''
        }));
      } catch (err) {
        console.error('Error checking availability', err);
      } finally {
        setIsChecking(false);
      }
    }, 400),
    []
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'email' || name === 'username') {
      checkAvailability(name, value);
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
    if (password.length < 6) {
      setErrMsg('Password must be at least 6 characters.');
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

      const signupRes = await axios.post('http://localhost:5000/api/auth/signup', payload);

      const serverUser = signupRes?.data;
      if (serverUser && (serverUser._id || serverUser.username)) {
        login(serverUser);
        navigate('/');
        return;
      }

      const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
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

  const isStep1Valid =
    formData.email.trim() &&
    formData.username.trim() &&
    String(formData.password || '').length >= 6 &&
    !validation.email && !validation.username && !isChecking;

  return (
    <SignupContainer>
      <SignupForm onSubmit={handleSubmit}>
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
              autoComplete="username"
            />
            {validation.username && <ValidationMessage>{validation.username}</ValidationMessage>}

            <Input
              type="password"
              name="password"
              placeholder="Password (min 6 chars)"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />

            <Button type="button" onClick={() => setStep(2)} disabled={!isStep1Valid}>
              Next
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Select Department</h2>
            <Select name="department" onChange={handleChange} value={formData.department}>
              {signupData.departments.map(dep => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </Select>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button type="button" onClick={() => setStep(3)}>Next</Button>
              <Button type="button" style={{ backgroundColor: '#888' }} onClick={() => setStep(1)}>Back</Button>
            </div>
          </>
        )}

        {step === 3 && (
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
                onClick={() => { setStep(2); setErrMsg(''); }}
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