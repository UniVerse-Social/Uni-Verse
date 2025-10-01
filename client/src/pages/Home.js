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

const HomeContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 20px;
  min-height: calc(100vh - 101px);
  /* inherits page background + text from theme */
`;

const Feed = styled.div`
  width: 100%;
  max-width: 600px;
  position: relative;
`;


const Home = () => {
  const [posts, setPosts] = useState([]);
  const [ads, setAds] = useState([]);
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

  
  const handlePostCreated = (newPost) => setPosts([newPost, ...posts]);

  return (
    <HomeContainer>
      <Feed>

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