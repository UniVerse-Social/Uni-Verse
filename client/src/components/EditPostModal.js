import React, { useState, useContext } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { AuthContext } from '../App';

const ModalBackdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1050;
`;

const ModalContainer = styled.form`
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const ModalHeader = styled.h2`
  margin: 0;
  text-align: center;
`;

const Textarea = styled.textarea`
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 16px;
  min-height: 150px;
  resize: vertical;
  font-family: inherit;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`;

const Button = styled.button`
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background-color: ${props => (props.$primary ? '#1877f2' : '#f0f2f5')};
  color: ${props => props.$primary ? 'white' : '#333'};
`;

const EditPostModal = ({ post, onClose, onPostUpdated }) => {
    const { user: currentUser } = useContext(AuthContext);
    const [textContent, setTextContent] = useState(post.textContent);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.put(`http://localhost:5000/api/posts/${post._id}`, {
                userId: currentUser._id,
                textContent: textContent,
            });
            onPostUpdated(res.data);
            onClose();
        } catch (err) {
            console.error("Failed to update post", err);
            alert("Could not update the post. Please try again.");
        }
    };

    return (
        <ModalBackdrop>
            <ModalContainer onSubmit={handleSubmit}>
                <ModalHeader>Edit Post</ModalHeader>
                <Textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                />
                <ButtonGroup>
                    <Button type="button" onClick={onClose}>Cancel</Button>
                    <Button type="submit" $primary>Save Changes</Button>
                </ButtonGroup>
            </ModalContainer>
        </ModalBackdrop>
    );
};

export default EditPostModal;
