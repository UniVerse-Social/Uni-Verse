// client/src/App.js
import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { createGlobalStyle } from 'styled-components';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Signup from './pages/Signup';
import Login from './pages/Login';
import TitanTap from './pages/TitanTap';
import './App.css';
import DMPage from './pages/DMs';
import Games from './pages/Game';
import LegalDocPage from './pages/LegalDocPage';

// ---------- Global username click handler ----------
function GlobalUsernameLinker() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e) => {
      const el = e.target.closest?.('[data-username-link]');
      if (!el) return;
      const uname = el.getAttribute('data-username-link');
      if (uname) {
        e.preventDefault();
        navigate(`/profile/${encodeURIComponent(uname)}`);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [navigate]);
  return null;
}

// ---------- Footer gate ----------
function FooterSwitch() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/profile/')) return <Footer />;   // inline
  if (pathname === '/clubs') return <Footer fixed />;        // fixed overlay
  return null;                                               // hidden elsewhere
}


// ---------- Lazy pages ----------
const Clubs = React.lazy(() => import('./pages/Clubs'));

// ---------- Global themed CSS (wins cascade) ----------
const GlobalTheme = createGlobalStyle`
  html, body, #root {
    background: var(--background-grey) !important;
    color: var(--text-color) !important;
  }
  nav, header, footer,
  .card, .panel, .sheet, .menu, .dropdown, .drawer, .modal,
  .container, .content, main, .screen, .page, .App {
    color: var(--text-color);
  }
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

              {/* Legal pages available while logged in */}
              <Route path="/terms" element={<LegalDocPage docUrl="/terms.html" title="Terms of Service" />} />
              <Route path="/privacy" element={<LegalDocPage docUrl="/privacy.html" title="Privacy Policy" />} />
              <Route path="/guidelines" element={<LegalDocPage docUrl="/guidelines.html" title="Community Guidelines" />} />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            <FooterSwitch />
          </>
        ) : (
          <>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Public legal pages */}
              <Route path="/terms" element={<LegalDocPage docUrl="/terms.html" title="Terms of Service" />} />
              <Route path="/privacy" element={<LegalDocPage docUrl="/privacy.html" title="Privacy Policy" />} />
              <Route path="/guidelines" element={<LegalDocPage docUrl="/guidelines.html" title="Community Guidelines" />} />

              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
            <FooterSwitch />
          </>
        )}
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
