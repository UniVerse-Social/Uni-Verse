import React, { useMemo, useRef, useState, useCallback } from 'react';
import styled from 'styled-components';
import { useStickers } from '../context/StickersContext';
import { useCustomStickerCatalog } from '../context/CustomStickerContext';
import { useStickerInteractions } from '../context/StickerInteractionsContext';

const DEFAULT_TAB = 'catalog';
const CUSTOM_TAB = 'custom';

const DockWrap = styled.div`
  position: fixed;
  left: 0;
  top: 140px;
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
  background: rgba(17, 24, 39, 0.62);
  color: #f1f5f9;
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 0 16px 16px 0;
  padding: 18px 14px;
  width: 52px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover {
    background: rgba(37, 99, 235, 0.88);
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
  width: 420px;
  max-height: 76vh;
  overflow: hidden;
  background: #ffffff;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 18px;
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
  padding: 14px 18px 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const HeaderTitle = styled.div`
  font-weight: 600;
  font-size: 15px;
`;

const HeaderMeta = styled.span`
  font-size: 12px;
  color: #94a3b8;
`;

const TabsBar = styled.div`
  display: flex;
  padding: 8px 12px;
  gap: 8px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.7);
  background: rgba(241, 245, 249, 0.6);
`;

const TabButton = styled.button`
  flex: 1;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 0;
  cursor: pointer;
  color: ${(p) => (p.$active ? '#1d4ed8' : '#475569')};
  background: ${(p) => (p.$active ? 'rgba(191, 219, 254, 0.7)' : 'transparent')};
  transition: background 0.18s ease, color 0.18s ease;

  &:hover {
    background: ${(p) => (p.$active ? 'rgba(191, 219, 254, 0.9)' : 'rgba(226, 232, 240, 0.8)')};
  }
`;

const DrawerBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 22px 26px 28px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 14px;
  background: #ffffff;
`;

const StickerCard = styled.button`
  background: none;
  border: none;
  padding: 0;
  font-size: ${(p) => (p.$isCustom ? 0 : 38)}px;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
  user-select: none;
  width: 100%;
  height: 100%;
  outline: none;

  img {
    display: block;
    max-width: 64px;
    max-height: 64px;
    width: auto;
    height: auto;
    pointer-events: none;
    border-radius: 12px;
  }

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
  grid-column: 1 / -1;
`;

const CustomToolbar = styled.div`
  padding: 10px 18px;
  border-top: 1px solid rgba(226, 232, 240, 0.7);
  background: rgba(248, 250, 252, 0.9);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const HintText = styled.span`
  font-size: 12px;
  color: #64748b;
`;

const UploadButton = styled.button`
  border: none;
  background: #1d4ed8;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  border-radius: 999px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: #1e40af;
  }
`;

const tabs = [
  { id: DEFAULT_TAB, label: 'Default Stickers' },
  { id: CUSTOM_TAB, label: 'Custom Stickers' },
];

export default function StickerDock() {
  const { catalog, loading, error } = useStickers();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const fileInputRef = useRef(null);
  const removeClickRef = useRef({ id: null, ts: 0 });
  const { beginPickerDrag } = useStickerInteractions();
  const {
    customStickers,
    addStickerFromImage,
    removeCustomSticker,
  } = useCustomStickerCatalog();

  const defaultStickers = useMemo(() => {
    if (!Array.isArray(catalog)) return [];
    const seen = new Set();
    return catalog.filter((item) => {
      if (!item?.key) return false;
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return Boolean(item.value);
    });
  }, [catalog]);

  const displayItems = activeTab === CUSTOM_TAB ? customStickers : defaultStickers;
  const totalCount = activeTab === CUSTOM_TAB ? customStickers.length : defaultStickers.length;

  const handleTabChange = useCallback((next) => {
    setActiveTab(next);
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        await addStickerFromImage(file);
        setActiveTab(CUSTOM_TAB);
      } catch (err) {
        console.error('Custom sticker add failed', err);
        alert('Could not add that image as a sticker. Try a smaller file.');
      }
    },
    [addStickerFromImage]
  );

  const handleCustomRemove = useCallback(
    (event, stickerId) => {
      event.preventDefault();
      const now = Date.now();
      const last = removeClickRef.current;
      if (last.id === stickerId && now - last.ts < 350) {
        removeCustomSticker(stickerId);
        removeClickRef.current = { id: null, ts: 0 };
      } else {
        removeClickRef.current = { id: stickerId, ts: now };
      }
    },
    [removeCustomSticker]
  );

  const handleStickerPointerDown = useCallback(
    (event, item, origin) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      beginPickerDrag({ sticker: item, point: { x: event.clientX, y: event.clientY }, origin });
    },
    [beginPickerDrag]
  );

  return (
    <DockWrap>
      <DockTab type="button" onClick={() => setOpen((prev) => !prev)} aria-expanded={open}>
        {['S', 't', 'i', 'c', 'k', 'e', 'r', 's'].map((letter, idx) => (
          <DockTabLetter key={`${letter}-${idx}`}>{letter}</DockTabLetter>
        ))}
      </DockTab>
      <Drawer $open={open} role="dialog" aria-label="Sticker catalog">
        <DrawerHeader>
          <HeaderTitle>Stickers</HeaderTitle>
          <HeaderMeta>{loading ? 'Loading…' : `${totalCount} items`}</HeaderMeta>
        </DrawerHeader>

        <TabsBar>
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              type="button"
              $active={activeTab === tab.id}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </TabButton>
          ))}
        </TabsBar>

        <DrawerBody>
          {loading && <StatusText>Loading stickers…</StatusText>}
          {!loading && error && <StatusText>{error}</StatusText>}
          {!loading && !error && displayItems.length === 0 && activeTab === DEFAULT_TAB && (
            <StatusText>No stickers available yet.</StatusText>
          )}
          {!loading && !error && displayItems.length === 0 && activeTab === CUSTOM_TAB && (
            <StatusText>Your custom catalog is empty. Upload a PNG, JPG, or GIF.</StatusText>
          )}
          {!loading &&
            !error &&
            displayItems.map((item) => (
              <StickerCard
                key={item.key}
                title={item.label}
                $isCustom={activeTab === CUSTOM_TAB}
                onPointerDown={(event) =>
                  handleStickerPointerDown(
                    event,
                    item,
                    activeTab === CUSTOM_TAB ? 'custom' : 'catalog'
                  )
                }
                onContextMenu={
                  activeTab === CUSTOM_TAB
                    ? (event) => handleCustomRemove(event, item.id)
                    : undefined
                }
              >
                {item.assetType === 'image' || activeTab === CUSTOM_TAB ? (
                  <img src={item.assetValue || item.value} alt={item.label} />
                ) : (
                  item.value
                )}
              </StickerCard>
            ))}
        </DrawerBody>

        <CustomToolbar>
          <HintText>
            {activeTab === CUSTOM_TAB
              ? 'Double right-click to remove saved stickers. Double left-click stickers on posts to save them here.'
              : 'Drag stickers onto a post.'}
          </HintText>
          <UploadButton type="button" onClick={handleUploadClick}>
            Upload custom
          </UploadButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </CustomToolbar>
      </Drawer>
    </DockWrap>
  );
}