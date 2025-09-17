// client/src/pages/Signup.js
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import { debounce } from 'lodash';
import { AuthContext } from '../App';

// Styled components (unchanged)
const SignupContainer = styled.div`
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 100vh; background-color: var(--background-grey); padding: 20px;
`;
const SignupForm = styled.form`
  background: var(--container-white); padding: 40px; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: flex; flex-direction: column; gap: 15px;
  width: 100%; max-width: 400px;
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
  &:hover { opacity: 0.9; } &:disabled { background-color: #ccc; cursor: not-allowed; }
`;
const HobbySelector = styled.div`
  max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 4px;
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
`;
const HobbyLabel = styled.label` display: flex; align-items: center; gap: 8px; `;
const ValidationMessage = styled.p` color: red; font-size: 14px; margin: -10px 0 0 5px; `;
const LoginLink = styled(Link)`
  color: var(--primary-orange); text-decoration: none; text-align: center; margin-top: 10px;
  &:hover { text-decoration: underline; }
`;
const ErrorBanner = styled.div`
  background:#fee2e2; color:#991b1b; padding:10px 12px; border-radius:8px; font-size:14px;
`;

const HOBBY_LIMIT = 10;

const Signup = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '', username: '', password: '', department: '', hobbies: []
  });
  const [signupData, setSignupData] = useState({ departments: [], hobbies: [] });
  const [validation, setValidation] = useState({ email: '', username: '' });
  const [isChecking, setIsChecking] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  // Load departments/hobbies for UI
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/auth/signup-data');
        setSignupData(res.data);
        // Default department (optional on server; but keeps your stepper smooth)
        if (res.data.departments?.length) {
          setFormData(prev => ({ ...prev, department: res.data.departments[0] }));
        }
      } catch (err) {
        console.error('Failed to fetch signup data', err);
      }
    })();
  }, []);

  // Debounced availability check (lowercase email, trim username)
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
    // keep local state as typed; we normalize on submit/check
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'email' || name === 'username') {
      checkAvailability(name, value);
    }
    setErrMsg('');
  };

  const handleHobbyChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      hobbies: checked
        ? [...prev.hobbies, value].slice(0, HOBBY_LIMIT)
        : prev.hobbies.filter(h => h !== value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrMsg('');

    // Client-side guard for common 400s from server
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
    if (validation.email || validation.username || isChecking) {
      setErrMsg('Please resolve the availability checks before continuing.');
      return;
    }

    try {
      // 1) Create the account (department is optional on the server)
      const payload = {
        username,
        email,
        password,
        department: (formData.department || '').trim(),
        hobbies: Array.isArray(formData.hobbies) ? formData.hobbies : [],
      };
      const signupRes = await axios.post('http://localhost:5000/api/auth/signup', payload);

      // 2) Auto-login:
      //    If the server returns a user (and maybe a token), use it.
      //    Otherwise, fall back to POST /login with the same creds.
      const serverUser = signupRes?.data;
      if (serverUser && (serverUser._id || serverUser.username)) {
        login(serverUser);
        navigate('/');
        return;
      }

      // Fallback (works even if /signup didn't include token)
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
            />
            {validation.email && <ValidationMessage>{validation.email}</ValidationMessage>}

            <Input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
            />
            {validation.username && <ValidationMessage>{validation.username}</ValidationMessage>}

            <Input
              type="password"
              name="password"
              placeholder="Password (min 6 chars)"
              value={formData.password}
              onChange={handleChange}
              required
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
            <h2>Select Hobbies ({formData.hobbies.length}/{HOBBY_LIMIT})</h2>
            <HobbySelector>
              {signupData.hobbies.map(hobby => (
                <HobbyLabel key={hobby}>
                  <input
                    type="checkbox"
                    value={hobby}
                    checked={formData.hobbies.includes(hobby)}
                    onChange={handleHobbyChange}
                  />
                  {hobby}
                </HobbyLabel>
              ))}
            </HobbySelector>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button type="submit">Create Account</Button>
              <Button type="button" style={{ backgroundColor: '#888' }} onClick={() => setStep(2)}>Back</Button>
            </div>
          </>
        )}

        <LoginLink to="/login">Already have an account? Log In</LoginLink>
      </SignupForm>
    </SignupContainer>
  );
};

export default Signup;
