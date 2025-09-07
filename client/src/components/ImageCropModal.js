import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import styled from 'styled-components';
import { getCroppedImg } from '../utils/cropImage';

// STYLED COMPONENTS for the Modal
const ModalBackdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 600px;
  overflow: hidden;
`;

const CropContainer = styled.div`
  position: relative;
  width: 100%;
  height: 400px;
  background: #333;
`;

const ControlsContainer = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 16px;
`;

const SliderContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const Slider = styled.input`
  width: 100%;
  -webkit-appearance: none;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  outline: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    background: var(--primary-blue, #1877f2);
    cursor: pointer;
    border-radius: 50%;
  }

  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: var(--primary-blue, #1877f2);
    cursor: pointer;
    border-radius: 50%;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const Button = styled.button`
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  border: none;
  background-color: ${props => (props.primary ? 'var(--primary-blue, #1877f2)' : '#e4e6eb')};
  color: ${props => (props.primary ? 'white' : '#333')};
  transition: filter 0.2s;
  &:hover { filter: brightness(0.95); }
`;


// COMPONENT
const ImageCropModal = ({ imageSrc, onClose, onCropComplete, aspect = 1, cropShape = 'rect' }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const onCropFull = useCallback((croppedArea, croppedAreaPixelsValue) => {
        setCroppedAreaPixels(croppedAreaPixelsValue);
    }, []);

    const handleSave = async () => {
        if (!croppedAreaPixels) return;
        try {
            const croppedImageUrl = await getCroppedImg(imageSrc, croppedAreaPixels);
            onCropComplete(croppedImageUrl);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <ModalBackdrop>
            <ModalContainer>
                <CropContainer>
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        cropShape={cropShape}
                        showGrid={false}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropFull}
                    />
                </CropContainer>
                <ControlsContainer>
                    <SliderContainer>
                        <span>Zoom</span>
                        <Slider
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(e.target.value)}
                        />
                    </SliderContainer>
                    <ButtonContainer>
                        <Button onClick={onClose}>Cancel</Button>
                        <Button primary onClick={handleSave}>Save</Button>
                    </ButtonContainer>
                </ControlsContainer>
            </ModalContainer>
        </ModalBackdrop>
    );
};

export default ImageCropModal;