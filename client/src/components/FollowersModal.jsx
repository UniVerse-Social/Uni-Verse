import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import UserLink from './UserLink';

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.35);
  z-index: 99999;
  overscroll-behavior: contain;
`;

const Card = styled.div`
  pointer-events: auto;
  width: min(560px, 92vw);
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 22px 44px rgba(0, 0, 0, 0.2);
  overflow: hidden;
`;

const Header = styled.div`
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--container-white);
  border-bottom: 1px solid var(--border-color);
  padding: 12px 14px;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;

  h2 { margin: 0; font-size: 16px; font-weight: 800; }
  button {
    border: none; background: transparent; cursor: pointer;
    border-radius: 8px; padding: 8px; font-weight: 700; color: var(--text-color);
  }
`;

const FilterWrap = styled.div`
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);

  input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    background: var(--container-white);
    color: var(--text-color);
    border-radius: 10px;
    outline: none;
  }
`;

const ListWrap = styled.div`
  max-height: 70vh;
  overflow: auto;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 44px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);

  .avatar {
    width: 44px; height: 44px; border-radius: 50%;
    background: var(--border-color); overflow: hidden;
    display: grid; place-items: center; font-weight: 700;
    color: var(--text-color); cursor: pointer;
  }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .sub { font-size: 12px; color: var(--muted-text); }

  button {
    padding: 8px 10px; border-radius: 8px;
    border: 1px solid var(--text-color);
    background: var(--text-color); color: var(--container-white);
    cursor: pointer;
  }
`;

const Empty = styled.div` padding: 18px 16px; color: var(--muted-text); `;
const LoadingRow = styled.div`
  padding: 12px 14px; display: flex; align-items: center; gap: 12px;
  .sh-ava { width: 44px; height: 44px; border-radius: 50%; background: var(--border-color); }
  .sh-line { height: 12px; width: 60%; background: var(--border-color); border-radius: 6px; }
`;

/** Normalize any shape into a { _id, username, profilePicture, department } object. */
function shapeUser(u) {
  if (!u) return null;
  if (typeof u === 'string') return { _id: u };
  if (u.user && (u.user._id || u.user.username)) {
    const inside = u.user;
    return {
      _id: inside._id || u._id,
      username: inside.username || u.username,
      profilePicture: inside.profilePicture || u.profilePicture,
      department: inside.department || u.department,
    };
  }
  return {
    _id: u._id,
    username: u.username,
    profilePicture: u.profilePicture,
    department: u.department,
  };
}

export default function FollowersModal({ userId, type='followers', me, myFollowing=[], onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  const isMe = me && String(me._id) === String(userId);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let list;
        try {
          const rel = await axios.get(`/api/users/${userId}/relations`);
          list = type === 'followers' ? rel.data.followers : rel.data.following;
        } catch {
          const url = type === 'followers'
            ? `/api/users/${userId}/followers`
            : `/api/users/${userId}/following`;
          const res = await axios.get(url);
          list = res.data || [];
        }

        let shaped = (Array.isArray(list) ? list : []).map(shapeUser);

        const needFetch = shaped.filter(u => u && !u.username && u._id).map(u => u._id);
        if (needFetch.length) {
          const fetched = await Promise.allSettled(
            needFetch.map(id => axios.get(`/api/users/${id}`))
          );
          const mapById = new Map();
          fetched.forEach((res) => {
            if (res.status === 'fulfilled' && res.value?.data?._id) {
              const d = res.value.data;
              mapById.set(String(d._id), {
                _id: d._id, username: d.username,
                profilePicture: d.profilePicture, department: d.department,
              });
            }
          });
          shaped = shaped.map(u => (!u?.username && mapById.has(String(u._id)) ? mapById.get(String(u._id)) : u)).filter(Boolean);
        }

        setItems(shaped);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, type]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(p =>
      p.username?.toLowerCase().includes(needle) ||
      p.department?.toLowerCase().includes(needle)
    );
  }, [items, q]);

  const [followingSet, setFollowingSet] = useState(() => new Set((myFollowing || []).map(String)));
  useEffect(() => {
    (async () => {
      if (!me?._id) return;
      try {
        const res = await axios.get(`/api/users/${me._id}/following`);
        const fresh = (res.data || []).map(p => String(p._id || p?.user?._id || p));
        setFollowingSet(new Set(fresh));
      } catch {}
    })();
  }, [me?._id]);

  const toggleFollow = async (targetId) => {
    try {
      await axios.put(`/api/users/${targetId}/follow`, { userId: me._id });
      setFollowingSet(prev => {
        const next = new Set(prev);
        if (next.has(String(targetId))) next.delete(String(targetId)); else next.add(String(targetId));
        return next;
      });
    } catch (e) { console.error('Follow toggle failed', e); }
  };

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const goProfile = async (u) => {
    try {
      let uname = u?.username;
      if (!uname && u?._id) {
        const res = await axios.get(`/api/users/${u._id}`);
        uname = res.data?.username;
      }
      if (uname) {
        onClose?.();
        navigate(`/profile/${encodeURIComponent(uname)}`);
      }
    } catch (e) {
      console.error('Navigate profile failed', e);
    }
  };

  // Make the whole row (except buttons/links) clickable to navigate
  const onRowClick = (p, e) => {
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'button' || tag === 'a' || e.target.closest('button') || e.target.closest('a')) return;
    goProfile(p);
  };

  const body = (
    <Backdrop onClick={onClose}>
      <Card role="dialog" aria-modal="true" aria-label={`View ${type}`} onClick={(e) => e.stopPropagation()}>
        <Header>
          <h2>{type === 'followers' ? 'Followers' : 'Following'}</h2>
          <button onClick={onClose} aria-label="Close">✕</button>
        </Header>

        <FilterWrap>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by username or department…" />
        </FilterWrap>

        <ListWrap>
          {loading && Array.from({ length: 8 }).map((_, i) => (
            <LoadingRow key={i}><div className="sh-ava" /><div className="sh-line" /></LoadingRow>
          ))}

          {!loading && filtered.length === 0 && <Empty>{q ? 'No matches.' : 'No users to show.'}</Empty>}

          {!loading && filtered.map((p) => {
            const iFollow = followingSet.has(String(p._id));
            const showFollowBtn = !!me && String(me._id) !== String(p._id) && isMe;
            const btnLabel = type === 'followers' ? (iFollow ? 'Following' : 'Follow back') : (iFollow ? 'Following' : 'Follow');
            const initialLetter = p.username?.[0]?.toUpperCase() || 'U';

            return (
              <Row key={p._id || p.username} onClick={(e) => onRowClick(p, e)} role="button">
                <div className="avatar" title={`Go to ${p.username || 'profile'}`}
                     onClick={() => goProfile(p)}>
                  {p.profilePicture ? <img src={p.profilePicture} alt={p.username || 'user'} /> : <span>{initialLetter}</span>}
                </div>
                <div className="meta">
                  <UserLink username={p.username || ''} onNavigate={(uname) => goProfile({ ...p, username: uname })}>
                    {p.username || '(unknown)'}
                  </UserLink>
                  <div className="sub">{p.department || ''}</div>
                </div>
                {showFollowBtn && <button onClick={() => toggleFollow(p._id)}>{btnLabel}</button>}
              </Row>
            );
          })}
        </ListWrap>
      </Card>
    </Backdrop>
  );

  return createPortal(body, document.body);
}
