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
  z-index: 1000;
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

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const Label = styled.label`
  font-weight: 600;
  font-size: 14px;
`;

const Input = styled.input`
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 16px;
`;

const Textarea = styled.textarea`
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 16px;
  min-height: 100px;
  resize: vertical;
  font-family: inherit;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
`;

const Button = styled.button`
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #ccc;
  background-color: ${props => props.primary ? '#1877f2' : '#f0f2f5'};
  color: ${props => props.primary ? 'white' : '#333'};

   &:hover {
    filter: brightness(0.95);
  }
`;

const EditProfileModal = ({ user, onClose, onProfileUpdate }) => {
    const { user: currentUser, login } = useContext(AuthContext);
    const [formData, setFormData] = useState({
        username: user.username || '',
        bio: user.bio || ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        try {
            const res = await axios.put(`http://localhost:5000/api/users/${currentUser._id}`, {
                userId: currentUser._id, // Required for backend validation
                ...formData
            });
            // 1. Update the global context state
            login(res.data); 
            // 2. Update the local state on the Profile page
            onProfileUpdate(res.data); 
            // 3. Close the modal
            onClose();
        } catch (err) {
            console.error("Failed to update profile", err);
            // Provide more specific feedback if possible
            const errorMessage = err.response?.data?.message || "The username might already be taken.";
            alert(`Failed to update profile: ${errorMessage}`);
        }
    };

    return (
        <ModalBackdrop>
            <ModalContainer onSubmit={handleSubmit}>
                <ModalHeader>Edit Profile</ModalHeader>
                <InputGroup>
                    <Label htmlFor="username">Username</Label>
                    <Input
                        id="username"
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                    />
                </InputGroup>
                <InputGroup>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                        id="bio"
                        name="bio"
                        value={formData.bio}
                        onChange={handleChange}
                        placeholder="Tell us about yourself..."
                    />
                </InputGroup>
                <ButtonGroup>
                    <Button type="button" onClick={onClose}>Cancel</Button>
                    <Button type="submit" primary>Save Changes</Button>
                </ButtonGroup>
            </ModalContainer>
        </ModalBackdrop>
    );
};

export default EditProfileModal;