// client/src/pages/Signup.js

import React, { useState, useEffect, useMemo, useContext } from 'react'; // Changed useCallback to useMemo
import { useNavigate, Link } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import { debounce } from 'lodash';
import { AuthContext } from '../App';

// Styled components (no changes)
const SignupContainer = styled.div` display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background-color: var(--background-grey); padding: 20px; `;
const SignupForm = styled.form` background: var(--container-white); padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); display: flex; flex-direction: column; gap: 15px; width: 100%; max-width: 400px; `;
const Input = styled.input` padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 16px; `;
const Select = styled.select` padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 16px; `;
const Button = styled.button` padding: 12px; background-color: var(--primary-orange); color: white; border: none; border-radius: 4px; font-size: 16px; font-weight: bold; cursor: pointer; &:hover { opacity: 0.9; } &:disabled { background-color: #ccc; cursor: not-allowed; } `;
const HobbySelector = styled.div` max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; `;
const HobbyLabel = styled.label` display: flex; align-items: center; gap: 8px; `;
const ValidationMessage = styled.p` color: red; font-size: 14px; margin: -10px 0 0 5px; `;
const LoginLink = styled(Link)` color: var(--primary-orange); text-decoration: none; text-align: center; margin-top: 10px; &:hover { text-decoration: underline; } `;


const HOBBY_LIMIT = 10;

const Signup = () => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        email: '', username: '', password: '', department: '', hobbies: []
    });
    const [signupData, setSignupData] = useState({ departments: [], hobbies: [] });
    const [validation, setValidation] = useState({ email: '', username: '' });
    const [isChecking, setIsChecking] = useState(false);
    
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchSignupData = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/auth/signup-data');
                setSignupData(res.data);
                if (res.data.departments.length > 0) {
                    setFormData(prev => ({ ...prev, department: res.data.departments[0] }));
                }
            } catch (err) {
                console.error("Failed to fetch signup data", err);
            }
        };
        fetchSignupData();
    }, []);

    // --- THIS IS THE FIX: Replaced useCallback with useMemo ---
    // This creates the debounced function only once and removes the ESLint warning.
    const checkAvailability = useMemo(
        () =>
            debounce(async (field, value) => {
                if (!value) return;
                setIsChecking(true);
                try {
                    const res = await axios.post('http://localhost:5000/api/auth/check-availability', { [field]: value });
                    const { isEmailTaken, isUsernameTaken } = res.data;
                    setValidation(prev => ({
                        ...prev,
                        [field]: (isEmailTaken || isUsernameTaken) ? `${field} is already taken.` : ''
                    }));
                } catch (err) {
                    console.error("Error checking availability", err);
                } finally {
                    setIsChecking(false);
                }
            }, 500),
        [] // The empty dependency array ensures this is created only on the initial render.
    );

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        if (name === 'email' || name === 'username') {
            checkAvailability(name, value);
        }
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
        try {
            // 1. Create the account
            await axios.post('http://localhost:5000/api/auth/signup', formData);

            // 2. Automatically log the user in
            const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
                loginIdentifier: formData.email,
                password: formData.password
            });

            // 3. Save user data globally and navigate to home
            login(loginRes.data);
            navigate('/');

        } catch (err) {
            alert('Failed to create account. Please try again.');
        }
    };
    
    const isStep1Valid = formData.email && formData.username && formData.password && !validation.email && !validation.username && !isChecking;

    return (
        <SignupContainer>
            <SignupForm onSubmit={handleSubmit}>
                 {step === 1 && (
                    <>
                        <h2>Create Account</h2>
                        <Input type="email" name="email" placeholder="Email" onChange={handleChange} required />
                        {validation.email && <ValidationMessage>{validation.email}</ValidationMessage>}
                        <Input type="text" name="username" placeholder="Username" onChange={handleChange} required />
                        {validation.username && <ValidationMessage>{validation.username}</ValidationMessage>}
                        <Input type="password" name="password" placeholder="Password" onChange={handleChange} required />
                        <Button type="button" onClick={() => setStep(2)} disabled={!isStep1Valid}>Next</Button>
                    </>
                )}
                {step === 2 && (
                    <>
                        <h2>Select Department</h2>
                        <Select name="department" onChange={handleChange} value={formData.department}>
                            {signupData.departments.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                        </Select>
                        <Button type="button" onClick={() => setStep(3)}>Next</Button>
                        <Button type="button" style={{backgroundColor: '#888'}} onClick={() => setStep(1)}>Back</Button>
                    </>
                )}
                 {step === 3 && (
                    <>
                        <h2>Select Hobbies ({formData.hobbies.length}/{HOBBY_LIMIT})</h2>
                        <HobbySelector>
                            {signupData.hobbies.map(hobby => (
                                <HobbyLabel key={hobby}>
                                    <input type="checkbox" value={hobby} checked={formData.hobbies.includes(hobby)} onChange={handleHobbyChange} />
                                    {hobby}
                                </HobbyLabel>
                            ))}
                        </HobbySelector>
                        <Button type="submit">Create Account</Button>
                         <Button type="button" style={{backgroundColor: '#888'}} onClick={() => setStep(2)}>Back</Button>
                    </>
                )}
                <LoginLink to="/login">Already have an account? Log In</LoginLink>
            </SignupForm>
        </SignupContainer>
    );
};

export default Signup;
