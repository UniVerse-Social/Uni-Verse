import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';

// ---------- Minimal styles (scoped via classNames) ----------
const styles = `
.titantap-page { max-width: 900px; margin: 0 auto; padding: 16px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
.titantap-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.titantap-header input { flex: 1; /* take remaining space but keep left-aligned */ }
.titantap-header h2 { margin: 0; }
.titantap-header input { width: 100%; padding: 10px 12px; border: 1px solid #e3e3e3; border-radius: 10px; font-size: 14px; }

.note { text-align: center; padding: 16px 0; color: #666; }

.search-results { border: 1px solid #eee; border-radius: 12px; padding: 6px; margin-bottom: 14px; max-height: 360px; overflow: auto; }
.result-row { display: flex; align-items: center; gap: 12px; padding: 8px; border-bottom: 1px solid #f3f3f3; }
.result-row:last-child { border-bottom: none; }
.res-avatar { width: 44px; height: 44px; border-radius: 50%; background: #f0f0f0; display: grid; place-items: center; overflow: hidden; flex: 0 0 auto; }
.res-avatar img { width: 100%; height: 100%; object-fit: cover; }
.res-name { font-weight: 600; }
.res-sub { font-size: 12px; color: #666; margin-top: 2px; }
.chips { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: #f4f6f8; border: 1px solid #e5e8eb; padding: 4px 8px; border-radius: 999px; font-size: 12px; }

.deck { position: relative; height: 460px; margin-top: 8px; perspective: 1000px; }
.card-wrap { position: absolute; left: 50%; transform: translateX(-50%); touch-action: none; width: 100%; max-width: 520px; top: 0; }

.card { width: 100%; max-width: 520px; height: 420px; background: #fff; border-radius: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); padding: 16px; position: relative; }
.card .header { display: flex; align-items: center; gap: 12px; }
.card .avatar { width: 64px; height: 64px; border-radius: 50%; background: #f0f0f0; display: grid; place-items: center; overflow: hidden; }
.card .avatar img { width: 100%; height: 100%; object-fit: cover; }
.card .name { font-weight: 700; font-size: 18px; }
.card .sub { color: #666; font-size: 12px; margin-top: 2px; }
.card .chips { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; max-height: 48px; overflow: hidden; }
.card .hint { margin-top: 18px; color: #888; font-size: 12px; text-align: center; }

.controls { display: flex; justify-content: center; gap: 12px; margin-top: 16px; }
.controls button { padding: 10px 16px; border-radius: 999px; border: 1px solid #111; background: #111; color: #fff; cursor: pointer; }
.controls .ghost { background: #fff; color: #111; }

.toast { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: #111; color: #fff; padding: 10px 14px; border-radius: 999px; }
`;

// Utility to get current user id from localStorage (adjust if you store differently)
function getCurrentUserId() {
  try {
    const u = localStorage.getItem('user') || localStorage.getItem('currentUser');
    if (u) {
      const parsed = JSON.parse(u);
      return parsed?._id || parsed?.id || parsed?.userId || null;
    }
  } catch {}
  return localStorage.getItem('userId') || localStorage.getItem('uid') || null;
}

async function api(path, { method = 'GET', body } = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  // Guard: if the dev server gave us HTML, content-type won't be JSON
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(
      `API returned non-JSON. Check API base URL/proxy. First bytes: ${text.slice(0, 60)}...`
    );
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.message || 'Request failed');
  }
  return res.json();
}

// Simple swipeable card using Pointer Events
function SwipeableCard({ user, onDecision }) {
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [rot, setRot] = useState(0);
  const [released, setReleased] = useState(false);

  const handlePointerDown = (e) => {
    if (released) return;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (released) return;
    if (!(e.buttons & 1)) return; // only while pressed
    const movementX = e.movementX || 0;
    const movementY = e.movementY || 0;
    const nextDx = dx + movementX;
    const nextDy = dy + movementY;
    setDx(nextDx);
    setDy(nextDy);
    setRot(nextDx / 12); // little rotation
  };

  const handlePointerUp = () => {
    if (released) return;
    const threshold = 120; // px
    if (dx > threshold) {
      setReleased(true);
      onDecision('right', user);
    } else if (dx < -threshold) {
      setReleased(true);
      onDecision('left', user);
    } else {
      // snap back
      setDx(0);
      setDy(0);
      setRot(0);
    }
  };

  const style = {
    transform: `translate(calc(-50% + ${dx}px), ${dy}px) rotate(${rot}deg)`,
    transition: released ? 'transform 250ms ease-out' : 'transform 0s',
  };

  return (
    <div
      className="card-wrap"
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="card">
        <div className="header">
          <div className="avatar">
            {user.profilePicture ? (
              <img src={user.profilePicture} alt={user.username || 'user'} />
            ) : (
              <span style={{ fontWeight: 700 }}>
                {(user.username || '?').slice(0,1).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="name">{user.username}</div>
            <div className="sub">{user.department ? `Dept: ${user.department}` : ''}</div>
          </div>
        </div>

        {Array.isArray(user.hobbies) && user.hobbies.length > 0 && (
          <div className="chips">
            {user.hobbies.slice(0, 6).map((h, i) => (
              <span key={i} className="chip">{h}</span>
            ))}
          </div>
        )}

        <div className="hint">Drag right to connect, left to pass</div>
      </div>
    </div>
  );
}

const TitanTap = () => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [justFollowed, setJustFollowed] = useState(null);

  const userId = useMemo(() => getCurrentUserId(), []);

  // Load suggestions
  useEffect(() => {
    (async () => {
      if (!userId) {
        setLoading(false);
        setError('Sign in required to load suggestions.');
        return;
      }
      try {
        setLoading(true);
        const data = await api(`/api/users/suggestions/${userId}`);
        setDeck(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        if (!query.trim()) return setSearchResults([]);
        const data = await api(
          `/api/users/search?q=${encodeURIComponent(query.trim())}&userId=${encodeURIComponent(userId || '')}`
        );
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, userId]);

  const decideTop = async (dir, user) => {
    if (dir === 'right' && userId) {
      try {
        await api(`/api/users/${user._id}/follow`, {
          method: 'PUT',
          body: { userId }
        });
        setJustFollowed(user);
      } catch (e) {
        setError(e.message);
      }
    }
    // remove from deck (top card)
    setDeck(prev => prev.filter(u => u._id !== user._id));
  };

  const programmaticSwipe = async (direction) => {
    const top = deck[deck.length - 1];
    if (!top) return;
    await decideTop(direction, top);
  };

  const followFromSearch = async (targetId, isFollowing) => {
    if (!userId) return setError('Sign in required.');
    try {
      await api(`/api/users/${targetId}/follow`, {
        method: 'PUT',
        body: { userId }
      });
      setSearchResults(prev =>
        prev.map(u => u._id === targetId ? { ...u, isFollowing: !isFollowing } : u)
      );
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="titantap-page">
      {/* inline style injection */}
      <style>{styles}</style>

      <div className="titantap-header">
        <h2>TitanTap</h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username, department, or hobbies…"
        />
      </div>

      {error && <div className="note">{error}</div>}

      {query.trim() && (
        <div className="search-results">
          {searchResults.length === 0 ? (
            <div className="note">No results</div>
          ) : (
            searchResults.map(u => (
              <div key={u._id} className="result-row">
                <div className="res-avatar" aria-hidden>
                  {u.profilePicture ? (
                    <img src={u.profilePicture} alt={u.username} />
                  ) : (
                    <span style={{ fontWeight: 700 }}>
                      {(u.username || '?').slice(0,1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="res-name">{u.username}</div>
                  <div className="res-sub">{u.department ? `Dept: ${u.department}` : ''}</div>
                  {Array.isArray(u.hobbies) && u.hobbies.length > 0 && (
                    <div className="chips">
                      {u.hobbies.slice(0,4).map((h,i) => (
                        <span key={i} className="chip">{h}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <button
                    onClick={() => followFromSearch(u._id, !!u.isFollowing)}
                    className={u.isFollowing ? 'ghost' : ''}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #111',
                      background: u.isFollowing ? '#fff' : '#111',
                      color: u.isFollowing ? '#111' : '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    {u.isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="deck">
        {loading && <div className="note">Loading suggestions…</div>}
        {!loading && deck.length === 0 && <div className="note">No more suggestions right now.</div>}

        {deck.map((user, idx) => {
          // stack: later items underneath
          const z = 1000 + idx;
          return (
            <div key={user._id} style={{ zIndex: z }}>
              <SwipeableCard user={user} onDecision={decideTop} />
            </div>
          );
        })}
      </div>

      <div className="controls">
        <button className="ghost" onClick={() => programmaticSwipe('left')}>Pass</button>
        <button onClick={() => programmaticSwipe('right')}>Connect</button>
      </div>

      {justFollowed && (
        <div className="toast" role="status" aria-live="polite">
          Followed {justFollowed.username}
        </div>
      )}
    </div>
  );
};

export default TitanTap;
