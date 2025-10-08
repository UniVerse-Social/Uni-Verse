// client/src/components/MemberDrawer.jsx
import React, { useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import UserLink from './UserLink';

const Backdrop = styled.div`position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:50;`;
const Panel = styled.div`position:fixed; top:0; right:0; width:min(480px,92vw); height:100vh; background:#fff; box-shadow:-2px 0 12px rgba(0,0,0,.2); z-index:51; display:flex; flex-direction:column;`;
const Head = styled.div`
  padding:12px 14px;
  border-bottom:1px solid #eee;
  font-weight:700;
  flex:0 0 auto;           /* keep header fixed */
`;
const Section = styled.div`
  padding:12px 14px;
  border-bottom:1px solid #f3f3f3;
  flex:0 0 auto;           /* keep sections fixed */
`;
/* Fill remaining space; scroll only when content overflows */
const List = styled.div`
  flex:1 1 auto;
  min-height:0;            /* critical so overflow works in flex column */
  overflow:auto;
  padding:0 14px 12px;
`;
const Row = styled.div`display:grid; grid-template-columns:40px 1fr auto; gap:10px; align-items:center; padding:8px 0; border-bottom:1px solid #f4f4f4;`;
const Av = styled.div`width:40px; height:40px; border-radius:50%; background:#f2f2f2; display:grid; place-items:center; overflow:hidden;`;
const Title = styled.span`font-size:12px; color:#666;`;
const Btn = styled.button`padding:6px 10px; border-radius:8px; border:1px solid #111; background:#111; color:#fff;`;
const Ghost = styled(Btn)`background:#fff; color:#111;`;

export default function MemberDrawer({ club, me, onClose }){
  const [members, setMembers] = useState([]);
  const [clubDoc, setClubDoc] = useState(club);
  const amPresident = String(clubDoc.president) === String(me._id);

  const loadMembers = useCallback(async () => {
    const r = await axios.get(`${API_BASE_URL}/api/clubs/${clubDoc._id}/members`);
    setMembers(r.data || []);
  }, [clubDoc._id]);

  const refreshClub = useCallback(async () => {
    const c = await axios.get(`${API_BASE_URL}/api/clubs/${clubDoc._id}`);
    setClubDoc(c.data);
  }, [clubDoc._id]);

  useEffect(() => { setClubDoc(club); }, [club]);
  useEffect(() => { loadMembers(); refreshClub(); }, [loadMembers, refreshClub]);

  const setTitle = async (u)=>{
    const title = prompt(`Set a title for ${u.username}`, u.title || 'Member');
    if (title === null) return;
    await axios.put(`${API_BASE_URL}/api/clubs/${clubDoc._id}/title`, { actorId: me._id, targetId: u._id, title });
    loadMembers();
  };
  const toggleMain = async (u)=>{
    const inMain = (clubDoc.mainPosters || []).map(String).includes(String(u._id));
    await axios.put(`${API_BASE_URL}/api/clubs/${clubDoc._id}/allow-main`, { actorId: me._id, targetId: u._id, allow: !inMain });
    await refreshClub();
  };
  const transfer = async (u)=>{
    if (!window.confirm(`Transfer presidency to ${u.username}?`)) return;
    await axios.put(`${API_BASE_URL}/api/clubs/${clubDoc._id}/transfer`, { actorId: me._id, targetId: u._id });
    await refreshClub(); loadMembers();
  };

  // Side channels (unchanged) …
  const newSide = async ()=>{
    const name = prompt('New side channel name?'); if(!name) return;
    await axios.post(`${API_BASE_URL}/api/clubs/${clubDoc._id}/side-channels`, { actorId: me._id, name });
    await refreshClub();
  };
  const renameSide = async (sc)=>{
    const name = prompt('Rename channel', sc.name); if(name===null) return;
    await axios.put(`${API_BASE_URL}/api/clubs/${clubDoc._id}/side-channels/${sc._id}/rename`, { actorId: me._id, name });
    await refreshClub();
  };
  const setDirector = async (sc)=>{
    const username = prompt(`Set director for "${sc.name}". Enter exact username from member list:`);
    if(!username) return;
    const m = members.find(x => x.username === username);
    if(!m) return alert('No such member');
    await axios.put(`${API_BASE_URL}/api/clubs/${clubDoc._id}/side-channels/${sc._id}/director`, { actorId: me._id, targetId: m._id });
    await refreshClub();
  };
  const deleteSide = async (sc)=>{
    if(!window.confirm(`Delete side channel "${sc.name}"?`)) return;
    await axios.delete(`${API_BASE_URL}/api/clubs/${clubDoc._id}/side-channels/${sc._id}`, { data: { actorId: me._id } });
    await refreshClub();
  };

  return (
    <>
      <Backdrop onClick={onClose}/>
      <Panel>
        <Head>Members · {(members||[]).length}</Head>

        {amPresident && (
          <Section>
            <b>Side Channels</b>
            <div style={{marginTop:8, display:'grid', gap:6}}>
              {(clubDoc.sideChannels || []).map(sc => (
                <div key={sc._id} style={{display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:8, alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:700}}>{sc.name}</div>
                    <Title>Director: {sc.director ? (members.find(m=>String(m._id)===String(sc.director))?.username || 'Member') : '—'}</Title>
                  </div>
                  <Ghost onClick={()=>renameSide(sc)}>Rename</Ghost>
                  <Ghost onClick={()=>setDirector(sc)}>Set Director</Ghost>
                  <Btn onClick={()=>deleteSide(sc)}>Delete</Btn>
                </div>
              ))}
              <Ghost onClick={newSide} style={{marginTop:6}}>+ New side channel</Ghost>
            </div>
          </Section>
        )}

        <Section><b>People</b></Section>
        <List>
          {members.map(u=>{
            const inMain = (clubDoc.mainPosters || []).map(String).includes(String(u._id));
            return (
              <Row key={u._id}>
                <Av>{u.profilePicture ? <img src={u.profilePicture} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : (u.username||'?')[0]?.toUpperCase()}</Av>
                <div>
                  <div style={{fontWeight:700}}>
                    <UserLink username={u.username}>{u.username}</UserLink>
                  </div>
                  <Title>{u.title}</Title>
                </div>
                {amPresident ? (
                  <div style={{display:'flex', gap:6}}>
                    <Ghost onClick={()=>setTitle(u)}>Set title</Ghost>
                    <Ghost onClick={()=>toggleMain(u)}>{inMain?'Revoke Main':'Allow Main'}</Ghost>
                    <Btn onClick={()=>transfer(u)}>Make President</Btn>
                  </div>
                ) : <div/>}
              </Row>
            );
          })}
          {members.length===0 && <div style={{color:'#666'}}>No members yet.</div>}
        </List>
      </Panel>
    </>
  );
}
