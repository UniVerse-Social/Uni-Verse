// client/src/pages/Home.js
import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AuthContext } from '../App';
import CreatePost from '../components/CreatePost';
import Post from '../components/Post';
import AdCard from '../components/AdCard';
import { API_BASE_URL } from '../config';
import { FaEnvelope } from 'react-icons/fa';

const HomeContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 20px;
  /* inherits page background + text from theme */
`;

const Feed = styled.div`
  width: 100%;
  max-width: 600px;
  position: relative;
`;

const DMButton = styled(Link)`
  position: fixed;
  top: 8px;                /* top-right of the page */
  right: 18px;
  z-index: 1100;
  width: 42px;
  height: 42px;
  border-radius: 999px;

  /* THEME-AWARE contrast pill */
  background: var(--text-color);
  color: var(--container-white);

  display: grid;
  place-items: center;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  transition: transform .15s ease, filter .15s ease;
  &:hover { transform: translateY(-1px); filter: brightness(1.05); }
`;

const Badge = styled.span`
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #e02424;                     /* alert red works in both themes */
  color: var(--container-white);
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
  border: 2px solid var(--container-white); /* ring matches theme surface */
`;

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [ads, setAds] = useState([]);
  const [unread, setUnread] = useState(0);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/posts/timeline/${user._id}`);
        setPosts(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchPosts();
  }, [user._id]);

  useEffect(() => {
    const loadAds = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/ads`);
        setAds(res.data || []);
      } catch {}
    };
    loadAds();
  }, []);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/messages/unread/${user._id}`);
        setUnread(res.data?.count || 0);
      } catch (e) {
        console.error(e);
      }
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 10000); // poll every 10s
    return () => clearInterval(id);
  }, [user._id]);

  const handlePostCreated = (newPost) => setPosts([newPost, ...posts]);

  return (
    <HomeContainer>
      <Feed>
        {/* Floating DM icon with unread badge */}
        <DMButton to="/dms" aria-label="Direct Messages">
          <FaEnvelope />
          {unread > 0 && <Badge>{unread > 99 ? '99+' : unread}</Badge>}
        </DMButton>

        <CreatePost onPostCreated={handlePostCreated} />
        {posts.map((p, idx) => {
          const adIndex = Math.floor(idx / 10) % (ads.length || 1);
          const shouldShowAd = (idx !== 0) && ((idx + 1) % 10 === 0) && ads.length > 0;
          return (
            <React.Fragment key={p._id}>
              <Post post={p} />
              {shouldShowAd && <AdCard ad={ads[adIndex]} />}
            </React.Fragment>
          );
        })}
      </Feed>
    </HomeContainer>
  );
};

export default Home;
