import React, { useState, useContext } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../App';

const CreatePostContainer = styled.div` padding: 20px; background-color: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.12); margin-bottom: 20px; `;
const TextArea = styled.textarea` width: 100%; min-height: 80px; border: 1px solid #ddd; border-radius: 6px; padding: 10px; font-size: 16px; resize: vertical; margin-bottom: 10px; `;
const PostButton = styled.button` background-color: var(--primary-orange); color: white; border: none; border-radius: 20px; padding: 10px 20px; font-weight: bold; cursor: pointer; float: right; &:hover { opacity: 0.9; } `;

const CreatePost = ({ onPostCreated }) => {
    const { user } = useContext(AuthContext);
    const [textContent, setTextContent] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!textContent.trim()) return;

        // Simplified: The backend now handles the profile picture logic
        const newPost = {
            userId: user._id,
            username: user.username,
            textContent: textContent,
        };

        try {
            const res = await axios.post("http://localhost:5000/api/posts", newPost);
            
            // The response from the server doesn't have the aggregated picture,
            // so we add it manually to the new post for instant UI update.
            const postWithPic = { ...res.data, profilePicture: user.profilePicture };
            onPostCreated(postWithPic);
            setTextContent('');
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <CreatePostContainer>
            <form onSubmit={handleSubmit}>
                <TextArea
                    placeholder={`What's on your mind, ${user.username}?`}
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                />
                <PostButton type="submit">Post</PostButton>
            </form>
        </CreatePostContainer>
    );
};

export default CreatePost;