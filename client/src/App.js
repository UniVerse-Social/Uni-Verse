// client/src/App.js
import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Signup from './pages/Signup';
import Login from './pages/Login';
import TitanTap from './pages/TitanTap';
import './App.css';
import DMPage from './pages/DMs';
const Clubs = React.lazy(() => import('./pages/Clubs'));
const Marketplace = React.lazy(() => import('./pages/Marketplace'));

export const AuthContext = createContext(null);

function App() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const login = (userData) => {
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            <Router>
                {user ? (
                    <>
                        <Navbar />
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/profile/:username" element={<Profile />} />
                            <Route path="/titantap" element={<TitanTap />} />
                            <Route path="/clubs" element={<React.Suspense><Clubs /></React.Suspense>} />
                            <Route path="/marketplace" element={<React.Suspense><Marketplace /></React.Suspense>} />
                            <Route path="*" element={<Navigate to="/" />} />
                            <Route path="/dms" element={<DMPage />} />
                        </Routes>
                    </>
                ) : (
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />
                        <Route path="*" element={<Navigate to="/login" />} />
                    </Routes>
                )}
            </Router>
        </AuthContext.Provider>
    );
}

export default App;
