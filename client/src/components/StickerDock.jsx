import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useStickers } from '../context/StickersContext';

const setDragPayload = (event, item) => {
  try {
    event.dataTransfer.setData('application/x-sticker-key', item.key);
    event.dataTransfer.setData('application/x-sticker-type', item.type || 'emoji');
    event.dataTransfer.setData('application/x-sticker-value', item.value || '');
    event.dataTransfer.effectAllowed = 'copy';
  } catch (err) {
    // ignore errors (e.g., unsupported browsers)
  }
};

const EXTRA_STICKERS = [
  { key: 'emoji-sparkles', label: 'Sparkles', type: 'emoji', value: '✨' },
  { key: 'emoji-heart-hands', label: 'Heart Hands', type: 'emoji', value: '🫶' },
  { key: 'emoji-confetti', label: 'Confetti', type: 'emoji', value: '🎉' },
  { key: 'emoji-fire', label: 'Fire', type: 'emoji', value: '🔥' },
  { key: 'emoji-shine', label: 'Shining Star', type: 'emoji', value: '🌟' },
  { key: 'emoji-rainbow', label: 'Rainbow', type: 'emoji', value: '🌈' },
  { key: 'emoji-sunglasses', label: 'Cool', type: 'emoji', value: '😎' },
  { key: 'emoji-party', label: 'Party Face', type: 'emoji', value: '🥳' },
  { key: 'emoji-applause', label: 'Applause', type: 'emoji', value: '👏' },
  { key: 'emoji-thumbs-up', label: 'Thumbs Up', type: 'emoji', value: '👍' },
  { key: 'emoji-rocket', label: 'Rocket', type: 'emoji', value: '🚀' },
  { key: 'emoji-lightbulb', label: 'Idea', type: 'emoji', value: '💡' },
  { key: 'emoji-laugh', label: 'Joy', type: 'emoji', value: '😂' },
  { key: 'emoji-thinking', label: 'Thinking', type: 'emoji', value: '🤔' },
  { key: 'emoji-wow', label: 'Wow', type: 'emoji', value: '🤯' },
  { key: 'emoji-cherry-blossom', label: 'Bloom', type: 'emoji', value: '🌸' },
  { key: 'emoji-crystal-ball', label: 'Vision', type: 'emoji', value: '🔮' },
  { key: 'emoji-headphones', label: 'Vibes', type: 'emoji', value: '🎧' },
  { key: 'emoji-game', label: 'Gamer', type: 'emoji', value: '🎮' },
  { key: 'emoji-palette', label: 'Palette', type: 'emoji', value: '🎨' },
  { key: 'emoji-stars', label: 'Sparkle Cluster', type: 'emoji', value: '💫' },
  { key: 'emoji-target', label: 'Target', type: 'emoji', value: '🎯' },
  { key: 'emoji-shield', label: 'Shield', type: 'emoji', value: '🛡️' },
  { key: 'emoji-lightning', label: 'Lightning', type: 'emoji', value: '⚡' },
  { key: 'emoji-mic', label: 'Mic Drop', type: 'emoji', value: '🎤' },
  { key: 'emoji-sparkling-heart', label: 'Sparkling Heart', type: 'emoji', value: '💖' },
  { key: 'emoji-peace', label: 'Peace', type: 'emoji', value: '✌️' },
  { key: 'emoji-clover', label: 'Lucky Clover', type: 'emoji', value: '🍀' },
  { key: 'emoji-wave', label: 'Wave', type: 'emoji', value: '👋' },
  { key: 'emoji-books', label: 'Books', type: 'emoji', value: '📚' },
  { key: 'emoji-camera', label: 'Camera', type: 'emoji', value: '📸' },
  { key: 'emoji-pin', label: 'Push Pin', type: 'emoji', value: '📌' },
  { key: 'emoji-music-notes', label: 'Music Notes', type: 'emoji', value: '🎶' },
  { key: 'emoji-checkered-flag', label: 'Finish', type: 'emoji', value: '🏁' },
  { key: 'emoji-sunflower', label: 'Sunflower', type: 'emoji', value: '🌻' },
  { key: 'emoji-earth', label: 'Globe', type: 'emoji', value: '🌎' },
  { key: 'emoji-cookie', label: 'Cookie', type: 'emoji', value: '🍪' },
  { key: 'emoji-boba', label: 'Boba', type: 'emoji', value: '🧋' },
  { key: 'emoji-burger', label: 'Burger', type: 'emoji', value: '🍔' },
  { key: 'emoji-taco', label: 'Taco', type: 'emoji', value: '🌮' },
  { key: 'emoji-ramen', label: 'Ramen', type: 'emoji', value: '🍜' },
  { key: 'emoji-fries', label: 'Fries', type: 'emoji', value: '🍟' },
  { key: 'emoji-basketball', label: 'Basketball', type: 'emoji', value: '🏀' },
  { key: 'emoji-football', label: 'Football', type: 'emoji', value: '🏈' },
  { key: 'emoji-baseball', label: 'Baseball', type: 'emoji', value: '⚾' },
  { key: 'emoji-tennis', label: 'Tennis', type: 'emoji', value: '🎾' },
  { key: 'emoji-volleyball', label: 'Volleyball', type: 'emoji', value: '🏐' },
  { key: 'emoji-watermelon', label: 'Watermelon', type: 'emoji', value: '🍉' },
  { key: 'emoji-ice-cream', label: 'Ice Cream', type: 'emoji', value: '🍦' },
  { key: 'emoji-donut', label: 'Donut', type: 'emoji', value: '🍩' },
  { key: 'emoji-pizza', label: 'Pizza', type: 'emoji', value: '🍕' },
  { key: 'emoji-trophy', label: 'Victory', type: 'emoji', value: '🥇' },
  { key: 'emoji-sparkle-heart', label: 'Heart Sparkle', type: 'emoji', value: '💗' },
  { key: 'emoji-glasses', label: 'Reading', type: 'emoji', value: '👓' },
  { key: 'emoji-running', label: 'Runner', type: 'emoji', value: '🏃' },
  { key: 'emoji-raise-hands', label: 'Raise Hands', type: 'emoji', value: '🙌' },
  { key: 'emoji-pinwheel', label: 'Pinwheel', type: 'emoji', value: '🎐' },
  { key: 'emoji-notebook', label: 'Notebook', type: 'emoji', value: '📓' },
  { key: 'emoji-plant', label: 'Plant', type: 'emoji', value: '🪴' },
  { key: 'emoji-sun', label: 'Sun', type: 'emoji', value: '☀️' },
  { key: 'emoji-moon', label: 'Moon', type: 'emoji', value: '🌙' },
  { key: 'emoji-cloud', label: 'Cloud', type: 'emoji', value: '☁️' },
  { key: 'emoji-umbrella', label: 'Umbrella', type: 'emoji', value: '☂️' },
  { key: 'emoji-crystal', label: 'Gem', type: 'emoji', value: '💎' },
  { key: 'emoji-alien', label: 'Alien', type: 'emoji', value: '👽' },
];

const DockWrap = styled.div`
  position: fixed;
  left: 0;
  top: 160px;
  z-index: 1400;
  display: flex;
  align-items: flex-start;
  pointer-events: none;

  @media (max-width: 1100px) {
    display: none;
  }
`;

const DockTab = styled.button`
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: rgba(17, 24, 39, 0.68);
  color: #f1f5f9;
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 0 16px 16px 0;
  padding: 18px 14px;
  width: 52px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover {
    background: rgba(37, 99, 235, 0.9);
    border-color: rgba(96, 165, 250, 0.85);
    color: #fff;
  }
`;

const DockTabLetter = styled.span`
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
`;

const Drawer = styled.aside`
  pointer-events: auto;
  width: 380px;
  max-height: 80vh;
  overflow: hidden;
  background: #ffffff;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
  margin-left: 14px;
  transform-origin: left top;
  transform: ${(p) => (p.$open ? 'scale(1)' : 'scale(0.94) translateX(-8px)')};
  opacity: ${(p) => (p.$open ? 1 : 0)};
  visibility: ${(p) => (p.$open ? 'visible' : 'hidden')};
  transition: transform 0.2s ease, opacity 0.2s ease, visibility 0.2s ease;
  display: flex;
  flex-direction: column;
`;

const DrawerHeader = styled.div`
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
  font-size: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const DrawerBody = styled.div`
  overflow-y: auto;
  padding: 22px 26px 28px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 12px;
  background: #ffffff;
`;

const StickerCard = styled.button`
  background: none;
  border: none;
  padding: 0;
  font-size: 40px;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
  user-select: none;
  width: 100%;
  height: 100%;
  outline: none;

  &:hover {
    transform: scale(1.12);
  }

  &:active {
    cursor: grabbing;
    transform: scale(0.96);
  }
`;

const StatusText = styled.div`
  padding: 40px 16px;
  text-align: center;
  font-size: 13px;
  color: #64748b;
`;

export default function StickerDock() {
  const { catalog, loading, error } = useStickers();
  const [open, setOpen] = useState(false);

  const stickerItems = useMemo(() => {
    const baseList = Array.isArray(catalog) ? catalog : [];
    const merged = [...baseList];
    EXTRA_STICKERS.forEach((extra) => {
      if (!merged.some((item) => item.key === extra.key)) {
        merged.push(extra);
      }
    });
    return merged.slice(0, 128);
  }, [catalog]);

  return (
    <DockWrap>
      <DockTab type="button" onClick={() => setOpen((prev) => !prev)} aria-expanded={open}>
        {['S', 't', 'i', 'c', 'k', 'e', 'r', 's'].map((letter, idx) => (
          <DockTabLetter key={`${letter}-${idx}`}>{letter}</DockTabLetter>
        ))}
      </DockTab>
      <Drawer $open={open} role="dialog" aria-label="Sticker catalog">
        <DrawerHeader>
          Sticker Catalog
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {loading ? 'Loading…' : `${stickerItems.length} items`}
          </span>
        </DrawerHeader>
        <DrawerBody>
          {loading && <StatusText>Loading stickers…</StatusText>}
          {!loading && error && <StatusText>{error}</StatusText>}
          {!loading && !error && stickerItems.length === 0 && (
            <StatusText>No stickers available yet.</StatusText>
          )}
          {!loading &&
            !error &&
            stickerItems.map((item) => (
              <StickerCard
                key={item.key}
                title={item.label}
                draggable
                data-sticker-key={item.key}
                data-sticker-type={item.type}
                data-sticker-value={item.value}
                onDragStart={(event) => setDragPayload(event, item)}
              >
                {item.value}
              </StickerCard>
            ))}
        </DrawerBody>
      </Drawer>
    </DockWrap>
  );
}
