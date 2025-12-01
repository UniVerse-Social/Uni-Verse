// client/src/App.js
import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate} from 'react-router-dom';
import { createGlobalStyle } from 'styled-components';

import Navbar from './components/Navbar';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Signup from './pages/Signup';
import Login from './pages/Login';
import TitanTap from './pages/TitanTap';
import './App.css';
import DMPage from './pages/DMs';
import Games from './pages/Game';
import LegalDocPage from './pages/LegalDocPage';
import AI from './pages/AI';
import NotedAI from './pages/NotedAI';
import DraftlyAI from './pages/DraftlyAI';
import CiteLab from './pages/CiteLab';
import Resumate from './pages/Resumate';
import { StickerProvider } from './context/StickersContext';
import { CustomStickerProvider } from './context/CustomStickerContext';
import { StickerInteractionsProvider } from './context/StickerInteractionsContext';
// --- EduConnect entry pages ---
import UniversitySelect from './pages/EduConnect/UniversitySelect';

// 🆕 DM drawer provider + component
import { DMDrawerProvider } from './context/DMDrawerContext';
import DMDrawer from './components/DMDrawer';

// 🆕 Daily challenge pages
import CrosswordDaily from './pages/CrosswordDaily';
import WordGuessDaily from './pages/WordGuessDaily';
import SudokuDaily from './pages/SudokuDaily';

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

function PublicEntryRouter() {
  const w = (typeof window !== 'undefined') ? window : undefined;
  const hasSchool = !!w && !!w.localStorage.getItem('educonnect_school');
  if (!hasSchool) return <Navigate to="/edu/select" replace />;
  return <Navigate to="/login" replace />;
}

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
      <StickerProvider>
        <CustomStickerProvider user={user}>
          <StickerInteractionsProvider>
            <GlobalTheme />
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              {user ? (
                // 🧃 Wrap the authenticated app with the DM drawer provider and render the drawer once
                <DMDrawerProvider>
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
                    {/* Daily challenge routes */}
                    <Route path="/games/challenges/crossword" element={<CrosswordDaily />} />
                    <Route path="/games/challenges/word" element={<WordGuessDaily />} />
                    <Route path="/games/challenges/sudoku" element={<SudokuDaily />} />
                    <Route path="/dms" element={<DMPage />} />
                    <Route path="/ai" element={<AI />} />
                    <Route path="/ai/noted" element={<NotedAI />} />
                    <Route path="/ai/draftly" element={<DraftlyAI />} />
                    <Route path="/ai/citelab" element={<CiteLab />} />
                    <Route path="/ai/resumate" element={<Resumate />} />
                    {/* Legal pages available while logged in */}
                    <Route
                      path="/terms"
                      element={<LegalDocPage docUrl="/terms.html" title="Terms of Service" />}
                    />
                    <Route
                      path="/privacy"
                      element={<LegalDocPage docUrl="/privacy.html" title="Privacy Policy" />}
                    />
                    <Route
                      path="/guidelines"
                      element={<LegalDocPage docUrl="/guidelines.html" title="Community Guidelines" />}
                    />

                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>

                  {/* Drawer lives once at the root so it's available on every screen */}
                  <DMDrawer />

                  <FooterSwitch />
                </DMDrawerProvider>
              ) : (
                <>
                  <Routes>
                    <Route path="/edu/select" element={<UniversitySelect />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />

                    {/* Public legal pages */}
                    <Route
                      path="/terms"
                      element={<LegalDocPage docUrl="/terms.html" title="Terms of Service" />}
                    />
                    <Route
                      path="/privacy"
                      element={<LegalDocPage docUrl="/privacy.html" title="Privacy Policy" />}
                    />
                    <Route
                      path="/guidelines"
                      element={<LegalDocPage docUrl="/guidelines.html" title="Community Guidelines" />}
                    />

                    <Route path="*" element={<PublicEntryRouter />} />
                  </Routes>
                  <FooterSwitch />
                </>
              )}
            </Router>
          </StickerInteractionsProvider>
        </CustomStickerProvider>
      </StickerProvider>
    </AuthContext.Provider>
  );
}

export default App;
