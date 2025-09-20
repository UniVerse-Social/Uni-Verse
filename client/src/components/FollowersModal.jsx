import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import axios from "axios";
import UserLink from "./UserLink";

const Backdrop = styled.div`
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 1500;
`;

const Modal = styled.div`
  position: fixed; inset: 0; display: grid; place-items: center; z-index: 1501;
`;

const Card = styled.div`
  width: min(560px, 92vw);
  /* THEME-AWARE SURFACE */
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 22px 44px rgba(0, 0, 0, 0.2);
  overflow: hidden;
`;

const Header = styled.div`
  position: sticky; top: 0; z-index: 2;
  background: var(--container-white);
  border-bottom: 1px solid var(--border-color);
  padding: 12px 14px;
  display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px;
  h3 { margin: 0; font-size: 16px; font-weight: 800; }
  button { border: none; background: transparent; cursor: pointer; border-radius: 8px; padding: 8px; font-weight: 700; color: var(--text-color); }
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
  max-height: 70vh; overflow: auto;
`;

const Row = styled.div`
  display: grid; grid-template-columns: 44px 1fr auto; gap: 12px; align-items: center;
  padding: 12px 14px; border-bottom: 1px solid var(--border-color);

  .avatar {
    width: 44px; height: 44px; border-radius: 50%;
    background: var(--border-color); overflow: hidden;
    display: grid; place-items: center; font-weight: 700; color: var(--text-color);
  }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .meta { display: flex; flex-direction: column; gap: 2px; }
  .sub { font-size: 12px; color: var(--muted-text); }

  button {
    padding: 8px 10px; border-radius: 8px;
    border: 1px solid var(--text-color);
    background: var(--text-color);
    color: var(--container-white);
    cursor: pointer;
  }
`;

const Empty = styled.div` padding: 18px 16px; color: var(--muted-text); `;
const LoadingRow = styled.div`
  padding: 12px 14px; display: flex; align-items: center; gap: 12px;
  .sh-ava { width: 44px; height: 44px; border-radius: 50%; background: var(--border-color); }
  .sh-line { height: 12px; width: 60%; background: var(--border-color); border-radius: 6px; }
`;

export default function FollowersModal({
  userId, type = "followers", me, myFollowing = [], onClose,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const isMe = me && String(me._id) === String(userId);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const rel = await axios.get(`http://localhost:5000/api/users/${userId}/relations`);
        const list = type === "followers" ? rel.data.followers : rel.data.following;
        if (Array.isArray(list)) setItems(list);
        else {
          const url = type === "followers"
            ? `http://localhost:5000/api/users/${userId}/followers`
            : `http://localhost:5000/api/users/${userId}/following`;
          const res = await axios.get(url);
          setItems(res.data || []);
        }
      } catch {
        try {
          const fallback = type === "followers"
            ? `http://localhost:5000/api/users/${userId}/followers`
            : `http://localhost:5000/api/users/${userId}/following`;
          const res = await axios.get(fallback);
          setItems(res.data || []);
        } catch { setItems([]); }
      } finally { setLoading(false); }
    };
    load();
  }, [userId, type]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      p => p.username?.toLowerCase().includes(needle) ||
           p.department?.toLowerCase().includes(needle)
    );
  }, [items, q]);

  const [followingSet, setFollowingSet] = useState(
    () => new Set((myFollowing || []).map(String))
  );
  useEffect(() => {
    setFollowingSet(new Set((myFollowing || []).map(String)));
  }, [myFollowing]);

  const toggleFollow = async (targetId) => {
    try {
      await axios.put(`http://localhost:5000/api/users/${targetId}/follow`, { userId: me._id });
      setFollowingSet(prev => {
        const next = new Set(prev);
        if (next.has(String(targetId))) next.delete(String(targetId));
        else next.add(String(targetId));
        return next;
      });
    } catch (e) { console.error("Follow toggle failed", e); }
  };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <Backdrop onClick={onClose} />
      <Modal>
        <Card className="surface" role="dialog" aria-modal="true" aria-label={`View ${type}`}>
          <Header>
            <h2>{type === "followers" ? "Followers" : "Following"}</h2>
            <button onClick={onClose} aria-label="Close">✕</button>
          </Header>

          <FilterWrap>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by username or department…"
            />
          </FilterWrap>

          <ListWrap>
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <LoadingRow key={i}><div className="sh-ava" /><div className="sh-line" /></LoadingRow>
            ))}

            {!loading && filtered.length === 0 && (
              <Empty>{q ? "No matches." : "No users to show."}</Empty>
            )}

            {!loading && filtered.map((p) => {
              const showFollowBtn = !!me && String(me._id) !== String(p._id) && isMe;
              const iFollow = followingSet.has(String(p._id));
              const btnLabel = type === "followers"
                ? (iFollow ? "Following" : "Follow back")
                : (iFollow ? "Following" : "Follow");

              return (
                <Row key={p._id}>
                  <div className="avatar">
                    {p.profilePicture ? <img src={p.profilePicture} alt={p.username} /> : <span>{p.username?.[0]?.toUpperCase() || "U"}</span>}
                  </div>
                  <div className="meta">
                    <UserLink username={p.username}>{p.username}</UserLink>
                    <div className="sub">{p.department || ""}</div>
                  </div>
                  {showFollowBtn && <button onClick={() => toggleFollow(p._id)}>{btnLabel}</button>}
                </Row>
              );
            })}
          </ListWrap>
        </Card>
      </Modal>
    </>
  );
}
