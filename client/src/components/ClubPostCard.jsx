// client/src/components/ClubPostCard.jsx
import React, { useContext, useState } from 'react';
import styled from 'styled-components';
import { FaHeart, FaRegHeart, FaCommentAlt, FaTrash } from 'react-icons/fa';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AuthContext } from '../App';
import ClubCommentDrawer from './ClubCommentDrawer';
import UserLink from './UserLink';

const Card = styled.div`
  background: var(--container-white);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  /* ... */
`;
const Head = styled.div`display:flex; align-items:center; gap:10px;`;
const Av = styled.div`width:36px; height:36px; border-radius:50%; background:#f2f2f2; overflow:hidden; display:grid; place-items:center; font-weight:700;`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;
const Name = styled.div`font-weight:700;`;
const TitleBadge = styled.span`
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #111;
  border: 1px solid var(--border-color);
`;

const Time = styled.div`margin-left:auto; color:#777; font-size:12px;`;
const Body = styled.div`margin-top:8px; white-space:pre-wrap; word-break:break-word;`;
const Actions = styled.div`margin-top:8px; display:flex; gap:16px; color:#444; align-items:center;`;

export default function ClubPostCard({ post, refresh }){
  const { user } = useContext(AuthContext);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  const liked = (post.likes || []).map(String).includes(String(user._id));
  const channelLabel = post.channel === 'main' ? 'Main' : (post.sideChannelName || 'Side');

  const toggleLike = async ()=>{
    await axios.put(`${API_BASE_URL}/api/club-posts/${post._id}/like`, { userId: user._id });
    refresh?.();
  };
  const del = async ()=>{
    if(!window.confirm('Delete this post?')) return;
    await axios.delete(`${API_BASE_URL}/api/club-posts/${post._id}`, { data: { userId: user._id }});
    refresh?.();
  };

  // Title badge (slot 0) from author or post payload
  const titleBadge =
    post?.author?.titleBadge ??
    (Array.isArray(post?.author?.badgesEquipped) ? post.author.badgesEquipped[0] : null) ??
    post?.titleBadge ??
    '';

  const avatar = post.author?.profilePicture;

  return (
    <Card className="surface">
      <Head>
        <Av>
          {avatar
            ? <img src={avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            : (post.author?.username || '?')[0]?.toUpperCase()
          }
        </Av>
        <div>
          <NameRow>
            <Name>
              <UserLink username={post.author?.username || 'user'}>
                {post.author?.username || 'user'}
              </UserLink>
            </Name>
            {!!titleBadge && <TitleBadge>{titleBadge}</TitleBadge>}
          </NameRow>
          <div style={{fontSize:12, color:'#666'}}>{channelLabel}</div>
        </div>
        <Time>{new Date(post.createdAt).toLocaleString()}</Time>
      </Head>

      <Body>{post.text}</Body>

      <Actions>
        <span onClick={toggleLike} style={{cursor:'pointer'}}>
          {liked ? <FaHeart/> : <FaRegHeart/>} {(post.likes||[]).length||0}
        </span>
        <span onClick={()=>setCommentsOpen(true)} style={{cursor:'pointer'}}>
          <FaCommentAlt/> {commentCount}
        </span>
        {(String(post.authorId)===String(user._id)) && (
          <span onClick={del} style={{marginLeft:'auto', cursor:'pointer'}}>
            <FaTrash/>
          </span>
        )}
      </Actions>

      {commentsOpen && (
        <ClubCommentDrawer
          post={post}
          onClose={()=>setCommentsOpen(false)}
          onCountChange={setCommentCount}
        />
      )}
    </Card>
  );
}
