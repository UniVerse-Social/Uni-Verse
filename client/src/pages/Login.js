// client/src/pages/Login.js

import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../App'; // Assuming App.js has an AuthContext

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
    background-color: var(--primary-blue);
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    &:hover {
        opacity: 0.9;
    }
`;

const SignupLink = styled(Link)`
    color: var(--primary-orange);
    text-decoration: none;
    text-align: center;
    &:hover {
        text-decoration: underline;
    }
`;


const Login = () => {
    const [loginIdentifier, setLoginIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:5000/api/auth/login', {
                loginIdentifier,
                password
            });
            login(res.data); // Use the login function from context
            navigate('/'); // Navigate to home on success
        } catch (err) {
            alert('Login failed. Please check your username/email and password.');
        }
    };

    return (
        <LoginContainer>
            <LoginForm onSubmit={handleSubmit}>
                <h2>Login to Fullerton Connect</h2>
                {/* --- THIS IS THE FIX --- */}
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
            </LoginForm>
        </LoginContainer>
    );
};

export default Login;