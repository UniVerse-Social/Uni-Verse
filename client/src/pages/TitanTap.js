import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import UserLink from "../components/UserLink";

// ---------- Minimal styles (scoped via classNames) ----------
const styles = `
.titantap-page { max-width: 900px; margin: 0 auto; padding: 16px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; min-height: calc(100vh - 101px);}
.titantap-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.titantap-header input { flex: 1; /* take remaining space but keep left-aligned */ }
.titantap-header h2 { margin: 0; color: white}
.titantap-header input { width: 100%; padding: 10px 12px; border: 1px solid #e3e3e3; border-radius: 10px; font-size: 14px; }

.note { text-align: center; padding: 16px 0; color: #666; }

.search-results { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 6px; margin-bottom: 14px; max-height: 360px; overflow: auto; }
.result-row { background: #fff; display: flex; align-items: center; gap: 12px; padding: 8px; border-bottom: 1px solid #f3f3f3; }
.result-row:last-child { border-bottom: none; }
.res-avatar { width: 44px; height: 44px; border-radius: 50%; background: #f0f0f0; display: grid; place-items: center; overflow: hidden; flex: 0 0 auto; }
.res-avatar img { width: 100%; height: 100%; object-fit: cover; }
.res-name { color: #111; font-weight: 600;}
.res-sub { font-size: 12px; color: #111; margin-top: 2px; }
.chips { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: #f4f6f8; border: 1px solid #e5e8eb; padding: 4px 8px; border-radius: 999px; font-size: 12px; }

/* --- NEW: badges row on the card --- */
.badges { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
.badge { background: #f3f4f6; border: 1px solid #e5e8eb; padding: 3px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #111; }
.badge.title { background: #111; color: #fff; border-color: #111; }

.deck { position: relative; height: 480px; margin-top: 20px; perspective: 10px; }
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
.controls button { padding: 10px 16px; border-radius: 999px; border: 1px solid #111; background: #fff; color: #111; cursor: pointer; }
.controls .ghost { background: #fff; color: #111; }

.toast { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: #fff; color: #111; padding: 10px 14px; border-radius: 999px; }
`;

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
    if (!(e.buttons & 1)) return;
    const nextDx = dx + (e.movementX || 0);
    const nextDy = dy + (e.movementY || 0);
    setDx(nextDx); setDy(nextDy); setRot(nextDx / 12);
  };
  const handlePointerUp = () => {
    if (released) return;
    const threshold = 120;
    if (dx > threshold) { setReleased(true); onDecision('right', user); }
    else if (dx < -threshold) { setReleased(true); onDecision('left', user); }
    else { setDx(0); setDy(0); setRot(0); }
  };

  const style = { transform: `translate(calc(-50% + ${dx}px), ${dy}px) rotate(${rot}deg)`, transition: released ? 'transform 250ms ease-out' : 'transform 0s' };

  /* --- NEW: compute badges for display (title first, then slots 1-4) --- */
  const equipped = Array.isArray(user.badgesEquipped) ? user.badgesEquipped.slice(0, 5) : [];
  const title = user.titleBadge || equipped[0] || null;
  const badgeLine = (() => {
    const out = [];
    if (title) out.push(title);
    for (let i = 0; i < equipped.length; i++) {
      if (i === 0 && equipped[0] === title) continue;
      const b = equipped[i];
      if (b && !out.includes(b)) out.push(b);
    }
    return out.slice(0, 5);
  })();

  return (
    <div className="card-wrap" style={style}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
      <div className="card">
        <div className="header">
          <div className="avatar">
            {user.profilePicture ? <img src={user.profilePicture} alt={user.username || 'user'} /> : <span style={{ fontWeight: 700 }}>{(user.username || '?').slice(0,1).toUpperCase()}</span>}
          </div>
          <div>
            <div className="name">
              <UserLink username={user.username}>{user.username}</UserLink>
            </div>
            <div className="sub">{user.department ? `Dept: ${user.department}` : ''}</div>
          </div>
        </div>

        {/* --- NEW: badges row (title first) --- */}
        {badgeLine.length > 0 && (
          <div className="badges" aria-label="Equipped badges">
            {badgeLine.map((b, i) => (
              <span key={i} className={`badge ${i === 0 ? 'title' : ''}`}>{b}</span>
            ))}
          </div>
        )}

        {Array.isArray(user.hobbies) && user.hobbies.length > 0 && (
          <div className="chips">
            {user.hobbies.slice(0, 6).map((h, i) => (<span key={i} className="chip">{h}</span>))}
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

  useEffect(() => {
    (async () => {
      if (!userId) { setLoading(false); setError('Sign in required to load suggestions.'); return; }
      try { setLoading(true); const data = await api(`/api/users/titantap/${userId}`); setDeck(Array.isArray(data) ? data : []); }
      catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [userId]);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        if (!query.trim()) return setSearchResults([]);
        const data = await api(`/api/users/search?q=${encodeURIComponent(query.trim())}&userId=${encodeURIComponent(userId || '')}`);
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (e) { setError(e.message); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, userId]);

  const decideTop = async (dir, user) => {
    if (dir === 'right' && userId) {
      try { await api(`/api/users/${user._id}/follow`, { method: 'PUT', body: { userId } }); setJustFollowed(user); }
      catch (e) { setError(e.message); }
    }
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
      await api(`/api/users/${targetId}/follow`, { method: 'PUT', body: { userId } });
      setSearchResults(prev => prev.map(u => u._id === targetId ? { ...u, isFollowing: !isFollowing } : u));
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="titantap-page">
      <style>{styles}</style>

      <div className="titantap-header">
        <h2>TitanTap</h2>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username, department, or hobbies…" />
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
                  {u.profilePicture ? <img src={u.profilePicture} alt={u.username} /> : <span style={{ fontWeight: 700 }}>{(u.username || '?').slice(0,1).toUpperCase()}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="res-name">
                    <UserLink username={u.username}>{u.username}</UserLink>
                  </div>
                  <div className="res-sub">{u.department ? `Dept: ${u.department}` : ''}</div>
                  {Array.isArray(u.hobbies) && u.hobbies.length > 0 && (
                    <div className="chips">
                      {u.hobbies.slice(0,4).map((h,i) => (<span key={i} className="chip">{h}</span>))}
                    </div>
                  )}
                </div>
                <div>
                  <button
                    onClick={() => followFromSearch(u._id, !!u.isFollowing)}
                    className={u.isFollowing ? 'ghost' : ''}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #111', background: u.isFollowing ? '#111' : '#fff', color: u.isFollowing ? '#fff' : '#111', cursor: 'pointer' }}
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
        {deck.map((user, idx) => (
          <div key={user._id} style={{ zIndex: 1000 + idx }}>
            <SwipeableCard user={user} onDecision={decideTop} />
          </div>
        ))}
      </div>

      <div className="controls">
        <button className="ghost" onClick={() => programmaticSwipe('left')}>Pass</button>
        <button onClick={() => programmaticSwipe('right')}>Connect</button>
      </div>

      {justFollowed && <div className="toast" role="status" aria-live="polite">Followed {justFollowed.username}</div>}
    </div>
  );
};

export default TitanTap;