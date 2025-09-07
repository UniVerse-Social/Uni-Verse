import React, { useState, useContext } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { FaHeart, FaRegHeart, FaCommentAlt, FaEllipsisH } from 'react-icons/fa';
import axios from 'axios';
import { AuthContext } from '../App';
import EditPostModal from './EditPostModal';

const PostContainer = styled.div` 
    background: #fff; 
    border-radius: 8px; 
    box-shadow: 0 1px 3px rgba(0,0,0,0.12); 
    padding: 20px; 
    margin-bottom: 20px; 
    position: relative;
`;
const PostHeader = styled.div` display: flex; align-items: center; margin-bottom: 15px; `;
const ProfilePic = styled.img` width: 40px; height: 40px; border-radius: 50%; background-color: #eee; margin-right: 15px; object-fit: cover; `;
const UserInfo = styled.div` display: flex; flex-direction: column; flex-grow: 1; `;
const Username = styled(Link)` font-weight: bold; color: #333; text-decoration: none; `;
const Timestamp = styled.span` font-size: 12px; color: #888; `;
const PostContent = styled.p` font-size: 16px; line-height: 1.5; margin-bottom: 15px; white-space: pre-wrap; word-break: break-word; `;
const PostActions = styled.div` display: flex; align-items: center; gap: 20px; color: #555; `;
const Action = styled.div` display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 14px; `;
const OptionsButton = styled.div`
    cursor: pointer;
    padding: 5px;
    border-radius: 50%;
    &:hover { background-color: #f0f2f5; }
`;
const DropdownMenu = styled.div`
    position: absolute;
    top: 40px;
    right: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10;
    overflow: hidden;
`;
const DropdownItem = styled.div`
    padding: 12px 20px;
    cursor: pointer;
    &:hover { background-color: #f0f2f5; }
`;

const TUFFY_DEFAULT_URL = 'https://www.clipartmax.com/png/middle/72-721825_tuffy-tuffy-the-titan-csuf.png';

const Post = ({ post, onPostDeleted, onPostUpdated }) => {
    const { user: currentUser } = useContext(AuthContext);
    const [likeCount, setLikeCount] = useState(post.likes.length);
    const [isLiked, setIsLiked] = useState(currentUser ? post.likes.includes(currentUser._id) : false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // This check determines if the current user owns the post.
    const isOwner = currentUser && (currentUser._id === post.userId || currentUser.username === post.username);

    const likeHandler = () => {
        if (!currentUser) return;
        try {
            axios.put(`http://localhost:5000/api/posts/${post._id}/like`, { userId: currentUser._id });
        } catch (err) { console.error("Failed to like post", err); }
        setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
        setIsLiked(!isLiked);
    };

    const handleDelete = async () => {
        setMenuOpen(false);
        if (window.confirm("Are you sure you want to delete this post?")) {
            try {
                await axios.delete(`http://localhost:5000/api/posts/${post._id}`, {
                    data: { userId: currentUser._id } 
                });
                onPostDeleted(post._id);
            } catch (err) {
                console.error("Failed to delete post", err);
                alert("Could not delete the post. Please try again.");
            }
        }
    };

    const handleEdit = () => {
        setMenuOpen(false);
        setIsEditing(true);
    };

    return (
        <>
            {isEditing && (
                <EditPostModal 
                    post={post}
                    onClose={() => setIsEditing(false)}
                    onPostUpdated={(updatedPost) => {
                        onPostUpdated(updatedPost);
                        setIsEditing(false);
                    }}
                />
            )}
            <PostContainer>
                <PostHeader>
                    <ProfilePic src={post.profilePicture || TUFFY_DEFAULT_URL} alt="User avatar" />
                    <UserInfo>
                        <Username to={`/profile/${post.username}`}>{post.username}</Username>
                        <Timestamp>{new Date(post.createdAt).toLocaleString()}</Timestamp>
                    </UserInfo>
                    {isOwner && (
                        <OptionsButton onClick={() => setMenuOpen(prev => !prev)}>
                            <FaEllipsisH />
                        </OptionsButton>
                    )}
                     {menuOpen && isOwner && (
                        <DropdownMenu onMouseLeave={() => setMenuOpen(false)}>
                            <DropdownItem onClick={handleEdit}>Edit Post</DropdownItem>
                            <DropdownItem onClick={handleDelete}>Delete Post</DropdownItem>
                        </DropdownMenu>
                    )}
                </PostHeader>
                <PostContent>{post.textContent}</PostContent>
                <PostActions>
                    <Action onClick={likeHandler}>
                        {isLiked ? <FaHeart color="red" /> : <FaRegHeart />} {likeCount}
                    </Action>
                    <Action><FaCommentAlt /> 0</Action>
                </PostActions>
            </PostContainer>
        </>
    );
};

export default Post;
