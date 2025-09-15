import React, { useEffect, useState, useContext } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';

const Backdrop = styled.div`position:fixed; inset:0; background:rgba(0,0,0,.35); display:grid; place-items:center; z-index:40;`;
const Card = styled.div`background:#fff; width:min(520px,92vw); max-height:80vh; border-radius:12px; overflow:hidden; display:flex; flex-direction:column;`;
const Head = styled.div`padding:12px 16px; border-bottom:1px solid #eee; font-weight:700;`;
const List = styled.div`flex:1; overflow:auto;`;
const Row = styled.div`display:flex; align-items:center; gap:10px; padding:10px 12px; border-bottom:1px solid #f4f4f4;`;
const Av = styled.div`width:40px; height:40px; border-radius:50%; overflow:hidden; background:#f0f0f0; display:grid; place-items:center;`;
const Btn = styled.button`margin-left:auto; padding:6px 10px; border-radius:8px; border:1px solid #111; background:${p=>p.$ghost?'#fff':'#111'}; color:${p=>p.$ghost?'#111':'#fff'}; cursor:pointer;`;

export default function FollowersModal({ userId, me, type='followers', onClose, myFollowing=[] }) {
  const [items, setItems] = useState([]);

  const load = async () => {
    const res = await axios.get(`${API_BASE_URL}/api/users/${userId}/${type}`);
    setItems(res.data || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId, type]);

  const toggleFollow = async (targetId, isFollowing) => {
    await axios.put(`${API_BASE_URL}/api/users/${targetId}/follow`, { userId: me._id });
    setItems(prev => prev.map(u => u._id === targetId ? ({ ...u, __following: !isFollowing }) : u));
  };

  return (
    <Backdrop onClick={onClose}>
      <Card onClick={e => e.stopPropagation()}>
        <Head>{type === 'followers' ? 'Followers' : 'Following'}</Head>
        <List>
          {items.map(u => {
            const isFollowing = myFollowing.includes(u._id) || u.__following;
            return (
              <Row key={u._id}>
                <Av>{u.profilePicture ? <img src={u.profilePicture} alt={u.username} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span>{(u.username||'?')[0]?.toUpperCase()}</span>}</Av>
                <div>
                  <div style={{fontWeight:700}}>{u.username}</div>
                  <div style={{fontSize:12, color:'#666'}}>{u.department || ''}</div>
                </div>
                {type === 'followers' && String(me._id) !== String(u._id) && (
                  <Btn $ghost={isFollowing} onClick={() => toggleFollow(u._id, isFollowing)}>
                    {isFollowing ? 'Following' : 'Follow back'}
                  </Btn>
                )}
              </Row>
            );
          })}
          {items.length === 0 && <div style={{padding:12, color:'#666'}}>No users to show.</div>}
        </List>
      </Card>
    </Backdrop>
  );
}
