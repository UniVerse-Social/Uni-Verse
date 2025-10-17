import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { FaChevronLeft, FaChevronRight, FaInfoCircle } from 'react-icons/fa';
import { useStickers } from '../context/StickersContext';
import { useCustomStickerCatalog } from '../context/CustomStickerContext';
import { useStickerInteractions } from '../context/StickerInteractionsContext';
import { toMediaUrl } from '../config';

const DEFAULT_TAB = 'catalog';
const CUSTOM_TAB = 'custom';

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
    } else {
      mq.addListener(handler);
    }
    setMatches(mq.matches);
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', handler);
      } else {
        mq.removeListener(handler);
      }
    };
  }, [query]);

  return matches;
};

const DockWrap = styled.div`
  position: fixed;
  left: 24px;
  bottom: 32px;
  z-index: 1400;
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-start;
  gap: 14px;
  pointer-events: none;

  ${(p) =>
    p.$compact &&
    css`
      top: auto;
      bottom: 72px;
      left: 12px;
      right: 12px;
      flex-direction: row;
      align-items: flex-end;
      justify-content: flex-start;
    `}

  ${(p) =>
    p.$pocket &&
    css`
      left: 12px;
      right: 12px;
      bottom: 60px;
      justify-content: center;
      gap: 10px;
    `}
`;

const DockTab = styled.button`
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(17, 24, 39, 0.62);
  color: #f1f5f9;
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 999px;
  padding: 12px 18px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  font-weight: 700;
  font-size: 13px;

  &:hover {
    background: rgba(37, 99, 235, 0.88);
    border-color: rgba(96, 165, 250, 0.85);
    color: #fff;
  }

  ${(p) =>
    p.$pocket &&
    css`
      width: 44px;
      height: 44px;
      border-radius: 50%;
      padding: 0;
      gap: 0;
      font-size: 0;
    `}
`;

const Drawer = styled.aside`
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  width: 360px;
  min-width: 280px;
  max-width: 520px;
  max-height: 76vh;
  overflow: hidden;
  background: #ffffff;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
  margin-left: ${(p) => (p.$compact ? 10 : 0)}px;
  transform-origin: ${(p) => (p.$compact || p.$pocket ? 'left top' : 'left bottom')};
  transform: ${(p) => {
    if (p.$open) return 'scale(1)';
    if (p.$compact || p.$pocket) return 'scale(0.94) translateX(-8px)';
    return 'scale(0.94) translateY(8px)';
  }};
  opacity: ${(p) => (p.$open ? 1 : 0)};
  visibility: ${(p) => (p.$open ? 'visible' : 'hidden')};
  transition: transform 0.2s ease, opacity 0.2s ease, visibility 0.2s ease;
  display: flex;
  flex-direction: column;
  resize: horizontal;

  ${(p) =>
    p.$compact &&
    css`
      width: min(360px, 92vw);
      min-width: auto;
      max-width: 92vw;
      resize: none;
      max-height: 70vh;
    `}

  ${(p) =>
    p.$pocket &&
    css`
      width: min(360px, 94vw);
      min-width: auto;
      max-width: 94vw;
      resize: none;
    `}
`;

const DrawerHeader = styled.div`
  padding: 14px 18px 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  position: relative;
  flex-wrap: wrap;
`;

const HeaderTitle = styled.div`
  font-weight: 600;
  font-size: 15px;
`;

const HeaderMeta = styled.span`
  font-size: 12px;
  color: #94a3b8;
`;

const HeaderGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const InfoButton = styled.button`
  pointer-events: auto;
  border: none;
  background: none;
  color: #1d4ed8;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  transition: color 0.2s ease;

  &:hover {
    color: #1e3a8a;
  }
`;

const InfoPopover = styled.div`
  position: absolute;
  top: calc(100% + 10px);
  right: 18px;
  max-width: min(320px, 80vw);
  background: rgba(15, 23, 42, 0.96);
  color: #e2e8f0;
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.4);
  font-size: 12px;
  line-height: 1.5;
  z-index: 10;

  p {
    margin: 0 0 8px 0;
  }

  p:last-child {
    margin-bottom: 0;
  }
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

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    padding: 18px 18px 22px;
    gap: 12px;
  }
`;

const spinnerRotate = keyframes`
  to { transform: rotate(360deg); }
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

const PendingSpinner = styled.div`
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.6);
  border-top-color: rgba(59, 130, 246, 0.9);
  border-radius: 50%;
  animation: ${spinnerRotate} 0.8s linear infinite;
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

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
`;

const HintText = styled.span`
  font-size: 12px;
  color: #64748b;
  @media (max-width: 768px) {
    text-align: center;
  }
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

export default function StickerDock({ animationsDisabled = false }) {
  const { catalog, loading, error } = useStickers();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const fileInputRef = useRef(null);
  const removeClickRef = useRef({ id: null, ts: 0 });
  const { beginPickerDrag } = useStickerInteractions();
  const isCompact = useMediaQuery('(max-width: 1100px)');
  const isPocket = useMediaQuery('(max-width: 768px)');
  const infoButtonRef = useRef(null);
  const infoPopoverRef = useRef(null);
  const drawerRef = useRef(null);
  const [pendingItems, setPendingItems] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const {
    customStickers,
    addStickerFromImage,
    removeCustomSticker,
  } = useCustomStickerCatalog();

  useEffect(() => {
    if (!showInfo) return undefined;
    const handleOutside = (event) => {
      if (infoPopoverRef.current?.contains(event.target)) return;
      if (infoButtonRef.current?.contains(event.target)) return;
      setShowInfo(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [showInfo]);

  useEffect(() => {
    if (!open) setShowInfo(false);
  }, [open]);

  useEffect(() => {
    const handleModalOpen = () => setOpen(false);
    window.addEventListener('fc-modal-open', handleModalOpen);
    return () => window.removeEventListener('fc-modal-open', handleModalOpen);
  }, []);

  useEffect(() => {
    if (!animationsDisabled) return;
    const drawerEl = drawerRef.current;
    if (!drawerEl) return;
    const videos = drawerEl.querySelectorAll('video');
    videos.forEach((video) => {
      try {
        video.pause();
      } catch {}
    });
  }, [animationsDisabled]);

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
      const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setPendingItems((prev) => [...prev, { token }]);
      try {
        await addStickerFromImage(file);
        setActiveTab(CUSTOM_TAB);
        setPendingItems((prev) => prev.filter((item) => item.token !== token));
      } catch (err) {
        console.error('Custom sticker add failed', err);
        setPendingItems((prev) => prev.filter((item) => item.token !== token));
        alert(err?.message || 'Could not add that image as a sticker. Try a smaller file.');
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
      const started = beginPickerDrag({ sticker: item, point: { x: event.clientX, y: event.clientY }, origin });
      if (!started) return;
      setShowInfo(false);

      if (isCompact || isPocket) {
        setTimeout(() => setOpen(false), 80);
        return;
      }

      if (!open) return;

      const drawerEl = drawerRef.current;
      const feedEl = typeof document !== 'undefined'
        ? document.querySelector('[data-feed-container]')
        : null;

      let overlapsFeed = false;
      if (drawerEl && feedEl) {
        const drawerRect = drawerEl.getBoundingClientRect();
        const feedRect = feedEl.getBoundingClientRect();
        overlapsFeed =
          drawerRect.right > feedRect.left &&
          drawerRect.left < feedRect.right &&
          drawerRect.bottom > feedRect.top &&
          drawerRect.top < feedRect.bottom;
      }

      if (overlapsFeed) {
        setOpen(false);
      }
    },
    [beginPickerDrag, isCompact, isPocket, open, drawerRef]
  );

  const arrowIcon = open
    ? <FaChevronLeft size={isPocket ? 18 : 12} />
    : <FaChevronRight size={isPocket ? 18 : 12} />;

  return (
    <DockWrap $compact={isCompact} $pocket={isPocket}>
      <DockTab
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={open ? 'Hide sticker drawer' : 'Show sticker drawer'}
        $pocket={isPocket}
      >
        {isPocket ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            {arrowIcon}
          </span>
        ) : (
          <>
            {arrowIcon}
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>Stickers</span>
          </>
        )}
      </DockTab>
      <Drawer
        $open={open}
        $compact={isCompact}
        $pocket={isPocket}
        role="dialog"
        aria-label="Sticker catalog"
        ref={drawerRef}
      >
        <DrawerHeader>
          <HeaderGroup>
            <HeaderTitle>Stickers</HeaderTitle>
            <InfoButton
              type="button"
              ref={infoButtonRef}
              aria-label="How stickers work"
              aria-expanded={showInfo}
              onClick={() => setShowInfo((prev) => !prev)}
            >
              <FaInfoCircle size={12} />
            </InfoButton>
          </HeaderGroup>
          <HeaderMeta>{loading ? 'Loading…' : `${totalCount} items`}</HeaderMeta>
          {showInfo && (
            <InfoPopover ref={infoPopoverRef}>
              <p>Drag and drop stickers onto posts you have access to. Owners always keep control and can adjust limits.</p>
              <p>While dragging, scroll with two fingers to resize. Swipe horizontally on a touchpad (or hold the right mouse button) to rotate before releasing.</p>
              <p>Double right-click a sticker you own to remove it. Double left-click a custom sticker to save it to your catalog.</p>
              <p>You can upload PNG, JPG, WebP, and animated GIFs — GIFs convert to lightweight looping video for better performance.</p>
            </InfoPopover>
          )}
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
                {item.assetType === 'video' ? (
                  <video
                    src={toMediaUrl(item.assetValue)}
                    poster={item.poster ? toMediaUrl(item.poster) : undefined}
                    autoPlay={!animationsDisabled}
                    loop={!animationsDisabled}
                    muted
                    playsInline
                    preload="metadata"
                    style={{ width: '100%', height: '100%', borderRadius: 12 }}
                  />
                ) : item.assetType === 'image' || activeTab === CUSTOM_TAB ? (
                  <img src={item.assetValue || item.value} alt={item.label} />
                ) : (
                  item.value
                )}
              </StickerCard>
            ))}
          {!loading && !error && activeTab === CUSTOM_TAB && pendingItems.length > 0 && (
            pendingItems.map((item) => (
              <StickerCard key={`pending-${item.token}`} $isCustom>
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(148, 163, 184, 0.25)',
                  }}
                >
                  <PendingSpinner />
                </div>
              </StickerCard>
            ))
          )}
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
