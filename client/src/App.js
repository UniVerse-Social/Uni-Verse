// client/src/App.js
import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import { createGlobalStyle } from 'styled-components';

import Navbar from './components/Navbar';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Signup from './pages/Signup';
import Login from './pages/Login';
import TitanTap from './pages/TitanTap';
import './App.css';
import DMPage from './pages/DMs';
import Games from './pages/Games';

// ---------- Global username click handler ----------
function GlobalUsernameLinker() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e) => {
      const el = e.target.closest?.("[data-username-link]");
      if (!el) return;
      const uname = el.getAttribute("data-username-link");
      if (uname) {
        e.preventDefault();
        navigate(`/profile/${encodeURIComponent(uname)}`);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [navigate]);
  return null;
}

// ---------- Lazy pages ----------
const Clubs = React.lazy(() => import('./pages/Clubs'));

// ---------- Global themed CSS (wins cascade) ----------
const GlobalTheme = createGlobalStyle`
  html, body, #root {
    background: var(--background-grey) !important;
    color: var(--text-color) !important;
  }

  /* Generic surfaces pick up theme variables */
  nav, header, footer,
  .card, .panel, .sheet, .menu, .dropdown, .drawer, .modal,
  .container, .content, main, .screen, .page, .App {
    color: var(--text-color);
  }

  /* Opt-in class for any component that should look like a card/sheet */
  .surface {
    background: var(--container-white) !important;
    color: var(--text-color) !important;
    border-color: var(--border-color) !important;
  }
`;

export const AuthContext = createContext(null);

function App() {
  const [user, setUser] = useState(null);

  // Restore session
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));
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
      {/* Global theme styles always applied */}
      <GlobalTheme />

      <Router>
        {user ? (
          <>
            <GlobalUsernameLinker />
            <Navbar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/profile/:username" element={<Profile />} />
              <Route path="/titantap" element={<TitanTap />} />
              <Route
                path="/clubs"
                element={
                  <React.Suspense fallback={<div />}>
                    <Clubs />
                  </React.Suspense>
                }
              />
              <Route path="/games" element={<Games />} />
              <Route path="/dms" element={<DMPage />} />
              <Route path="*" element={<Navigate to="/" />} />
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
