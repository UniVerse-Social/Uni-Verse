import React, {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useDMDrawer } from "../context/DMDrawerContext";
import { api } from "../api";
import { AuthContext } from "../App";

/* -------------------------- styles -------------------------- */
const s = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 9998 },
  drawer: {
    position: "fixed",
    top: 0,
    right: 0,
    height: "100vh",
    width: "50vw",
    maxWidth: 720,
    minWidth: 360,
    background: "var(--container-white)",
    color: "var(--text-color)",
    boxShadow: "0 0 30px rgba(0,0,0,0.25)",
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    borderLeft: "1px solid var(--border-color)",
    transition: "transform 180ms ease-out",
  },
  hidden: { transform: "translateX(100%)" },

  header: {
    padding: "12px 14px",
    borderBottom: "1px solid var(--border-color)",
    display: "flex",
    gap: 8,
    alignItems: "center",
    minHeight: 60,
  },
  headerMobileThread: {
    padding: "10px 8px",
    borderBottom: "1px solid var(--border-color)",
    display: "grid",
    gridTemplateColumns: "auto 1fr auto auto",
    gap: 8,
    alignItems: "center",
    minHeight: 52,
  },
  search: {
    flex: 1,
    height: 40,
    border: "1px solid var(--border-color)",
    borderRadius: 10,
    padding: "0 12px",
    outline: "none",
    background: "#fff",
    color: "var(--text-color)",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid var(--border-color)",
    background: "#fff",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    fontSize: 18,
    lineHeight: "40px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  },

  grid: { display: "grid", gridTemplateColumns: "300px 1fr", minHeight: 0, flex: 1 },
  list: { overflowY: "auto", padding: 8, minHeight: 0, borderRight: "1px solid var(--border-color)" },
  item: { display: "grid", gridTemplateColumns: "42px 1fr auto", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 10, cursor: "pointer" },
  itemHover: { background: "#f3f4f6" },
  itemActive: { background: "#eef2f7", border: "1px solid var(--border-color)" },
  avatar: { width: 42, height: 42, borderRadius: "50%", overflow: "hidden", background: "#fff", display: "grid", placeItems: "center" },
  avatarImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  name: { fontWeight: 800, lineHeight: 1.2 },
  sub: { color: "#555", fontSize: 12, marginTop: 2, lineHeight: 1.3 },
  empty: { padding: 24, color: "#666" },

  thread: { display: "grid", gridTemplateRows: "auto 1fr auto", minHeight: 0 },
  thTitle: { fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  thHead: { padding: "10px 12px", borderBottom: "1px solid var(--border-color)", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8 },
  messages: { padding: 12, overflowY: "auto" },
  compose: { display: "grid", gridTemplateColumns: "1fr auto", gap: 8, padding: 10, borderTop: "1px solid var(--border-color)" },
  input: { padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: 10, outline: "none" },
  sendBtn: { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" },
  msgRow: { display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10 },
  msgMine: { justifyContent: "flex-end" },
  msgAvatar: { width: 28, height: 28, borderRadius: "50%", overflow: "hidden", background: "#eef2f7", flex: "0 0 auto" },
  msgAvatarImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  msgContent: { maxWidth: "70%" },
  msgHeader: { fontSize: 12, marginBottom: 4, color: "#6b7280", display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" },
  bubble: (mine) => ({
    background: mine ? "#111" : "#f1f3f5",
    color: mine ? "#fff" : "#111",
    padding: "10px 12px",
    borderRadius: 12,
    wordBreak: "break-word",
  }),

  newWrap: { padding: "8px 12px", borderBottom: "1px solid var(--border-color)" },
  chips: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 },
  chip: { border: "1px solid var(--border-color)", background: "#f3f4f6", color: "#111", padding: "4px 10px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" },
  dropdown: { position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--border-color)", borderRadius: 10, marginTop: 6, maxHeight: 240, overflowY: "auto", boxShadow: "0 6px 16px rgba(0,0,0,0.08)", zIndex: 10 },
  ddItem: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", cursor: "pointer" },
};

/* --------------------------- helpers --------------------------- */
const IconBtn = ({ label, onClick, children }) => {
  const [h, setH] = useState(false);
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{ ...s.iconBtn, background: h ? "#f1f5f9" : "#fff" }}
      type="button"
    >
      {children}
    </button>
  );
};

function DMListRow({ id, name, sub, avatar, unread, active, onSelect }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSelect(id)}
      style={{ ...s.item, ...(active ? s.itemActive : hover ? s.itemHover : null) }}
    >
      <div style={s.avatar}>
        <img src={avatar || "/tuffy-default.jpg"} alt="" style={s.avatarImg} />
      </div>
      <div>
        <div style={s.name}>{name}</div>
        <div style={s.sub}>{sub}</div>
      </div>
      <div>
        {unread > 0 ? (
          <span style={{ background: "#e02424", color: "#fff", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>
            {unread}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------- component --------------------------- */
export default function DMDrawer() {
  const { isOpen, close } = useDMDrawer();
  const { user } = useContext(AuthContext);

  // viewport mode
  const [mobile, setMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 900 : false));
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // conversations + thread
  const [convos, setConvos] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState({});
  const [q, setQ] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  // new chat state
  const [selecting, setSelecting] = useState(false);
  const [newQuery, setNewQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");

  const [showThreadMobile, setShowThreadMobile] = useState(false);
  const messagesRef = useRef(null);

  const titleOf = (c) => c?.title || c?.name || "Conversation";

  /* ---------- conversations ---------- */
  const loadConversations = useCallback(async () => {
    if (!user?._id) return;
    try {
      const { data } = await api.get(`/messages/conversations/${user._id}`, { params: { userId: user._id } });
      setConvos(Array.isArray(data) ? data : data?.conversations || []);
    } catch (e) {
      console.error(e);
    }
  }, [user?._id]);

  useEffect(() => {
    if (!isOpen || !user?._id) return;
    (async () => {
      setLoading(true);
      await loadConversations();
      setLoading(false);
    })();
    const t = setInterval(loadConversations, 15000);
    return () => clearInterval(t);
  }, [isOpen, user?._id, loadConversations]);

  // auto-select last or first
  useEffect(() => {
    if (!convos.length) { setActive(null); return; }
    const last = (typeof localStorage !== "undefined" && localStorage.getItem("lastConv")) || "";
    const found = last && convos.find(c => String(c._id) === String(last));
    const target = found || convos[0];
    if (!active || active._id !== target._id) openConversation(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convos]);

  // fetch basic user records for participants we don’t know yet
  const ensureUsers = useCallback(async (ids) => {
    const need = (ids || [])
      .map((x) => (x && typeof x === "object" ? (x._id || x.id || x.userId) : x))
      .map(String)
      .filter(Boolean)
      .filter((id, i, a) => a.indexOf(id) === i)
      .filter((id) => !participants[id] || !participants[id].username);
    if (!need.length) return;
    try {
      const res = await api.get(`/users/basic`, { params: { ids: need.join(",") } });
      const map = {};
      (res.data || []).forEach((u) => { map[String(u._id)] = u; });
      setParticipants((prev) => ({ ...prev, ...map }));
    } catch {}
  }, [participants]);

  const loadMessages = useCallback(async (convId) => {
    if (!user?._id || !convId) return;
    try {
      const res = await api.get(`/messages/${convId}`, { params: { userId: user._id } });
      setMessages(res.data || []);
      await api.put(`/messages/${convId}/read`, { userId: user._id });
      await loadConversations();
    } catch (e) {
      console.error(e);
    }
  }, [user?._id, loadConversations]);

  const openConversation = async (conv) => {
    if (!conv) return;
    setActive(conv);
    try { localStorage.setItem("lastConv", conv._id); } catch {}
    if (Array.isArray(conv.participants) && conv.participants.length) {
      await ensureUsers(conv.participants);
    }
    await loadMessages(conv._id);
    if (mobile) setShowThreadMobile(true);
  };

  // scroll messages down as they load
  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!active || !text.trim()) return;
    try {
      const res = await api.post(`/messages/${active._id}`, {
        senderId: user._id,
        body: text.trim(),
        attachments: [],
      });
      setMessages((m) => [...m, res.data]);
      setText("");
      await loadConversations();
    } catch (e) {
      console.error(e);
    }
  };

  /* ---------- “allowed users” = followers ∪ following ---------- */
  const [allowedIds, setAllowedIds] = useState(null);
  const loadAllowed = useCallback(async () => {
    if (!user?._id) return;
    const set = new Set();

    const tryFetch = async (path, mapper = (x) => x) => {
      try {
        const { data } = await api.get(path);
        const arr = Array.isArray(data) ? data : (data?.users || data?.results || []);
        (arr || []).forEach((u) => {
          const id = mapper(u);
          if (id) set.add(String(id));
        });
      } catch { /* ignore; try other shapes */ }
    };

    // try common patterns
    await tryFetch(`/users/${user._id}/followers`, (u) => u._id || u.id || u);
    await tryFetch(`/users/${user._id}/following`, (u) => u._id || u.id || u);
    if (set.size === 0) {
      try {
        const { data } = await api.get(`/users/${user._id}`);
        [...(data?.followers || []), ...(data?.following || [])].forEach((id) => {
          const v = (typeof id === "object") ? (id._id || id.id) : id;
          if (v) set.add(String(v));
        });
      } catch { /* ignore */ }
    }
    // last resort: if AuthContext has them
    try { (user.followers || []).forEach((id) => set.add(String(id))); } catch {}
    try { (user.following || []).forEach((id) => set.add(String(id))); } catch {}

    setAllowedIds(set);
  }, [user]);

  useEffect(() => {
    if (!isOpen) return;
    loadAllowed();
  }, [isOpen, loadAllowed]);

  /* ---------- search in list ---------- */
  const listItems = useMemo(() => {
    const mapped = (convos || []).map((c) => ({
      id: c._id || c.id,
      name: titleOf(c),
      avatar: c.avatar,
      sub: c.last?.body || c.lastMessage?.text || "—",
      unread: c.unread || 0,
      isGroup: !!c.isGroup,
      participants: c.participants || [],
    }));
    if (!q.trim()) return mapped; // keep server order (recency)
    const term = q.trim().toLowerCase();
    return mapped
      .filter((c) => c.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [q, convos]);

  /* ---------- new chat: user search (debounced) ---------- */
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!selecting || !newQuery.trim()) { setResults([]); return; }
      try {
        const { data } = await api.get(`/users/search`, { params: { q: newQuery.trim(), userId: user._id } });
        let arr = data || [];
        // Restrict to followers ∪ following if we have them
        if (allowedIds && allowedIds.size > 0) {
          arr = arr.filter((u) => allowedIds.has(String(u._id)));
        }
        // Never include myself
        arr = arr.filter((u) => String(u._id) !== String(user._id));
        setResults(arr);
      } catch (e) {
        console.error(e);
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [newQuery, selecting, user._id, allowedIds]);

  // detect existing 1:1 chat with a given user
  const hasDirectWith = useCallback((otherId) => {
    const O = String(otherId);
    return (convos || []).some((c) => {
      if (c.isGroup) return false;
      const ids = (Array.isArray(c.participants) ? c.participants : []).map((x) =>
        String(typeof x === "object" ? (x._id || x.id || x.userId) : x)
      );
      return ids.includes(O) && ids.includes(String(user._id));
    });
  }, [convos, user?._id]);

  const openDirectWith = useCallback((otherId) => {
    const O = String(otherId);
    const conv = (convos || []).find((c) => {
      if (c.isGroup) return false;
      const ids = (Array.isArray(c.participants) ? c.participants : []).map((x) =>
        String(typeof x === "object" ? (x._id || x.id || x.userId) : x)
      );
      return ids.includes(O) && ids.includes(String(user._id));
    });
    if (conv) openConversation(conv);
  }, [convos]);

  const toggleSelectUser = (u) => {
    // if selecting exactly one and a direct exists, open it instead of creating a duplicate
    if (selectedUsers.length === 0 && hasDirectWith(u._id)) {
      openDirectWith(u._id);
      setSelecting(false);
      setNewQuery(""); setResults([]);
      return;
    }
    setSelectedUsers((prev) => {
      const exists = prev.some((x) => x._id === u._id);
      return exists ? prev.filter((x) => x._id !== u._id) : [...prev, u];
    });
  };

  const startConversation = async () => {
    if (selectedUsers.length === 0) {
      setSelecting(false);
      setNewQuery(""); setResults([]); setSelectedUsers([]); setGroupName("");
      return;
    }

    // If it's a single user and a direct exists, open it (guard rails)
    if (selectedUsers.length === 1 && hasDirectWith(selectedUsers[0]._id)) {
      openDirectWith(selectedUsers[0]._id);
      setSelecting(false);
      setNewQuery(""); setResults([]); setSelectedUsers([]);
      return;
    }

    // If we know the allowed IDs, enforce the rule (followers ∪ following)
    if (allowedIds && allowedIds.size > 0) {
      const allAllowed = selectedUsers.every((u) => allowedIds.has(String(u._id)));
      if (!allAllowed) {
        alert("You can only start chats with your followers or people you follow.");
        return;
      }
    }

    const ids = selectedUsers.map((u) => u._id);
    try {
      const body = {
        creatorId: user._id,
        participants: ids,
        name: selectedUsers.length > 1 ? (groupName || "Group chat") : null,
      };
      const { data } = await api.post(`/messages/conversation`, body);
      await loadConversations();
      setSelecting(false); setSelectedUsers([]); setGroupName(""); setNewQuery(""); setResults([]);
      await openConversation(data);
    } catch (e) {
      console.error(e);
      alert("Failed to start conversation");
    }
  };

  /* ---------- delete chat ---------- */
  const deleteConversation = async () => {
    if (!active?._id) return;
    const title = titleOf(active);
    if (!window.confirm(`Delete conversation "${title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/messages/conversation/${active._id}`, { data: { userId: user._id } });
      setActive(null);
      setMessages([]);
      await loadConversations();
      if (mobile) setShowThreadMobile(false);
    } catch (e) {
      console.error(e);
      alert("Failed to delete conversation");
    }
  };

  const backFromThread = () => setShowThreadMobile(false);

  /* ------------------------------ UI ------------------------------ */
  const HeaderDesktop = (
    <div style={s.header}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search DMs…" style={s.search} />
      <IconBtn label={selecting ? "Close new chat" : "New chat"} onClick={() => setSelecting((v) => !v)}>
        {selecting ? "–" : "+"}
      </IconBtn>
      <IconBtn label="Close" onClick={close}>×</IconBtn>
    </div>
  );

  const HeaderMobileList = (
    <div style={s.header}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search DMs…" style={s.search} />
      <IconBtn label={selecting ? "Close new chat" : "New chat"} onClick={() => setSelecting((v) => !v)}>
        {selecting ? "–" : "+"}
      </IconBtn>
      <IconBtn label="Close" onClick={close}>×</IconBtn>
    </div>
  );

  const HeaderMobileThread = (
    <div style={s.headerMobileThread}>
      <button aria-label="Back" title="Back" onClick={backFromThread} style={{ ...s.iconBtn, width: 36, height: 36 }}>←</button>
      <div style={s.thTitle}>{titleOf(active)}</div>
      <IconBtn label="Delete chat" onClick={deleteConversation}>🗑</IconBtn>
      <IconBtn label="Close" onClick={close}>×</IconBtn>
    </div>
  );

  return (
    <>
      {isOpen && <div aria-hidden style={s.overlay} onClick={close} />}

      <aside role="dialog" aria-label="Direct Messages" style={{ ...s.drawer, ...(isOpen ? null : s.hidden) }}>
        {/* header */}
        {!mobile && HeaderDesktop}
        {mobile && (!showThreadMobile ? HeaderMobileList : HeaderMobileThread)}

        {/* new chat strip */}
        {selecting && !showThreadMobile && (
          <div style={s.newWrap}>
            <div style={{ position: "relative" }}>
              <input
                placeholder="Search followers / following…"
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
                style={{ ...s.search, height: 36 }}
              />
              {/* search dropdown */}
              {results.length > 0 && (
                <div style={s.dropdown}>
                  {results.map((u) => {
                    const existsDirect = hasDirectWith(u._id);
                    return (
                      <div
                        key={u._id}
                        style={s.ddItem}
                        onClick={() => toggleSelectUser(u)}
                        title={existsDirect ? "You already have a 1-on-1 with this user" : "Add to selection"}
                      >
                        <img src={u.profilePicture || "/tuffy-default.jpg"} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                        <div style={{ fontWeight: 700, flex: 1 }}>{u.username}</div>
                        {existsDirect && <span style={{ fontSize: 12, color: "#6b7280" }}>existing chat</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* selected chips + optional group name */}
            {selectedUsers.length > 0 && (
              <>
                <div style={s.chips}>
                  {selectedUsers.map((u) => (
                    <span key={u._id} style={s.chip} onClick={() => toggleSelectUser(u)}>
                      <img src={u.profilePicture || "/tuffy-default.jpg"} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                      {u.username} <strong>×</strong>
                    </span>
                  ))}
                </div>
                {selectedUsers.length >= 2 && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      placeholder="Group name (optional)"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      style={{ ...s.search, height: 36 }}
                    />
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <button type="button" onClick={startConversation} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border-color)", background: "#fff", cursor: "pointer" }}>
                    Start
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* layout */}
        {!mobile ? (
          <div style={s.grid}>
            {/* list */}
            <div style={s.list}>
              {loading && <div style={s.empty}>Loading…</div>}
              {!loading && listItems.length === 0 && <div style={s.empty}>No conversations found.</div>}
              {listItems.map((c) => {
                const isActive = active && String(c.id) === String(active._id);
                return (
                  <DMListRow
                    key={c.id}
                    id={c.id}
                    name={c.name}
                    sub={c.sub}
                    avatar={c.avatar}
                    unread={c.unread}
                    active={isActive}
                    onSelect={(id) => openConversation(convos.find((x) => String(x._id || x.id) === String(id)))}
                  />
                );
              })}
            </div>

            {/* thread */}
            <div style={s.thread}>
              {!active ? (
                <div style={{ padding: 16, color: "#666" }}>Select a conversation or start a new one.</div>
              ) : (
                <>
                  <div style={s.thHead}>
                    <div style={s.thTitle}>{titleOf(active)}</div>
                    <IconBtn label="Delete chat" onClick={deleteConversation}>🗑</IconBtn>
                  </div>

                  <div ref={messagesRef} style={s.messages}>
                    {messages.map((m) => {
                      const mine = String(m.senderId) === String(user._id);
                      const sender = mine
                        ? { username: user.username, profilePicture: user.profilePicture }
                        : (participants[m.senderId] || m.sender || {});
                      const senderAvatar = sender.profilePicture || active?.avatar || "/tuffy-default.jpg";
                      return (
                        <div key={m._id} style={{ ...s.msgRow, ...(mine ? s.msgMine : null) }}>
                          {!mine && (
                            <div style={s.msgAvatar}>
                              <img src={senderAvatar} alt="" style={s.msgAvatarImg} />
                            </div>
                          )}
                          <div style={s.msgContent}>
                            <div style={s.msgHeader}>
                              <span>{sender.username || (mine ? user.username : titleOf(active))}</span>
                              <span>{new Date(m.createdAt).toLocaleString()}</span>
                            </div>
                            <div style={s.bubble(mine)}>{m.body}</div>
                          </div>
                          {mine && (
                            <div style={s.msgAvatar}>
                              <img src={user.profilePicture || "/tuffy-default.jpg"} alt="" style={s.msgAvatarImg} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <form onSubmit={handleSend} style={s.compose}>
                    <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" style={s.input} />
                    <button type="submit" style={s.sendBtn}>Send</button>
                  </form>
                </>
              )}
            </div>
          </div>
        ) : (
          // --------- MOBILE ---------
          <>
            {!showThreadMobile ? (
              <div style={{ ...s.list, borderRight: "none" }}>
                {loading && <div style={s.empty}>Loading…</div>}
                {!loading && listItems.length === 0 && <div style={s.empty}>No conversations found.</div>}
                {listItems.map((c) => {
                  const isActive = active && String(c.id) === String(active._id);
                  return (
                    <DMListRow
                      key={c.id}
                      id={c.id}
                      name={c.name}
                      sub={c.sub}
                      avatar={c.avatar}
                      unread={c.unread}
                      active={isActive}
                      onSelect={(id) => openConversation(convos.find((x) => String(x._id || x.id) === String(id)))}
                    />
                  );
                })}
              </div>
            ) : (
              <div style={s.thread}>
                {!active ? (
                  <div style={{ padding: 16, color: "#666" }}>Select a conversation.</div>
                ) : (
                  <>
                    {/* Mobile thread header is rendered above (HeaderMobileThread) */}
                    <div ref={messagesRef} style={s.messages}>
                      {messages.map((m) => {
                        const mine = String(m.senderId) === String(user._id);
                        const sender = mine
                          ? { username: user.username, profilePicture: user.profilePicture }
                          : (participants[m.senderId] || m.sender || {});
                        const senderAvatar = sender.profilePicture || active?.avatar || "/tuffy-default.jpg";
                        return (
                          <div key={m._id} style={{ ...s.msgRow, ...(mine ? s.msgMine : null) }}>
                            {!mine && (
                              <div style={s.msgAvatar}>
                                <img src={senderAvatar} alt="" style={s.msgAvatarImg} />
                              </div>
                            )}
                            <div style={s.msgContent}>
                              <div style={s.msgHeader}>
                                <span>{sender.username || (mine ? user.username : titleOf(active))}</span>
                                <span>{new Date(m.createdAt).toLocaleString()}</span>
                              </div>
                              <div style={s.bubble(mine)}>{m.body}</div>
                            </div>
                            {mine && (
                              <div style={s.msgAvatar}>
                                <img src={user.profilePicture || "/tuffy-default.jpg"} alt="" style={s.msgAvatarImg} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <form onSubmit={handleSend} style={s.compose}>
                      <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" style={s.input} />
                      <button type="submit" style={s.sendBtn}>Send</button>
                    </form>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </aside>

      <style>{`
        @media (max-width: 900px) {
          aside[role="dialog"] { width: 100vw !important; min-width: 0 !important; }
        }
      `}</style>
    </>
  );
}
