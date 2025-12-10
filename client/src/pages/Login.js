// client/src/pages/Login.js

import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { api } from '../api';
import { AuthContext } from '../App';

const LoginContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background-color: var(--background-grey);
`;

const LoginForm = styled.form`
    background: var(--container-white);
    padding: 40px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    max-width: 400px;
`;

const Input = styled.input`
    padding: 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 16px;
`;

const Button = styled.button`
    padding: 12px;
    background-color: var(--primary-orange);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    &:hover { opacity: 0.9; }
`;

const SignupLink = styled(Link)`
    color: var(--primary-orange);
    text-decoration: none;
    text-align: center;
    &:hover {
        text-decoration: underline;
    }
`;
const SmallLinkButton = styled.button`
  background: none; border: none; padding: 0; margin-top: 8px;
  color: var(--primary-orange); cursor: pointer; text-decoration: underline; font: inherit;
`;

const Login = () => {
    const [loginIdentifier, setLoginIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();
    const changeSchool = () => {
        localStorage.removeItem('educonnect_school');
        navigate('/edu/select');
    };
    const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        const raw = (loginIdentifier || '').trim();
        const normalized = raw.includes('@') ? raw.toLowerCase() : raw;

        const res = await api.post('/auth/login', {
        loginIdentifier: normalized,
        password,
        });
        login(res.data);
        navigate('/');
    } catch (err) {
        const msg = err?.response?.data?.message || 'Login failed. Please check your username/email and password.';
        alert(msg);
    }
    };

    return (
        <LoginContainer>
            <LoginForm onSubmit={handleSubmit}>
                <h2>
                  {(() => {
                    const school = safeParse(localStorage.getItem('educonnect_school'));
                    return school?.name ? `Login to ${school.name}` : 'Login to UniVerse';
                  })()}
                </h2>
                <Input
                    type="text" // Changed from "email" to "text"
                    placeholder="Email or Username"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    required
                />
                <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <Button type="submit">Log In</Button>
                <SignupLink to="/signup">Don't have an account? Sign Up</SignupLink>
                <SmallLinkButton type="button" onClick={changeSchool}>
                    Choose a different university
                </SmallLinkButton>
            </LoginForm>
        </LoginContainer>
    );
};

export default Login;
function safeParse(s){ try { return JSON.parse(s || ''); } catch { return null; } }
