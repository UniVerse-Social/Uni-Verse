import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

const STICKER_MIN_SCALE = 0.4;
const STICKER_MAX_SCALE = 2.5;

const StickerInteractionsContext = createContext({
  beginPickerDrag: () => false,
  beginStickerMove: () => false,
  registerTarget: () => () => {},
  activeDrag: null,
  hoverTargetId: null,
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const scheduleStateUpdate = (dragRef, setDragState, rafRef) => {
  if (rafRef.current) return;
  rafRef.current = requestAnimationFrame(() => {
    rafRef.current = null;
    const snapshot = dragRef.current;
    setDragState(snapshot ? { ...snapshot } : null);
  });
};

const getPointInsideRect = (point, rect) => {
  if (!rect) return false;
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
};

const computeNormalizedPosition = (point, rect) => ({
  x: clamp((point.x - rect.left) / rect.width, 0, 1),
  y: clamp((point.y - rect.top) / rect.height, 0, 1),
});

const sanitizeSticker = (raw, origin = 'catalog') => {
  const assetType = raw.assetType || (raw.type === 'custom' ? 'image' : raw.type) || 'emoji';
  const assetValue = raw.assetValue || raw.value || '';
  const key = raw.key || raw.stickerKey || raw.id;
  const placedBy = raw.placedBy
    ? String(raw.placedBy)
    : raw.placedByUser?._id
    ? String(raw.placedByUser._id)
    : null;
  return {
    id: raw.id || raw._id || key,
    key,
    stickerKey: raw.stickerKey || raw.key || null,
    label: raw.label || 'Sticker',
    assetType,
    assetValue,
    type: raw.type || (assetType === 'image' ? 'custom' : 'emoji'),
    value: raw.value !== undefined ? raw.value : raw.assetValue || '',
    origin,
    placedBy,
    placedByUser: raw.placedByUser || null,
    meta: raw,
  };
};

export const StickerInteractionsProvider = ({ children }) => {
  const [dragState, setDragState] = useState(null);
  const dragRef = useRef(null);
  const rafRef = useRef(null);
  const targetsRef = useRef(new Map());
  const listenersAttachedRef = useRef(false);

  // stable options
  const wheelListenerOptions = useRef({ passive: false, capture: true }).current;

  // allow handlers to call finalizeDrag before it's defined (breaks cycle cleanly)
  const finalizeDragRef = useRef(null);

  const updateHover = useCallback((activePoint, draft) => {
    if (!draft) return;
    let matchedTarget = null;
    let matchedRect = null;
    targetsRef.current.forEach((target) => {
      const rect = target.getRect();
      if (!rect) return;
      if (getPointInsideRect(activePoint, rect)) {
        matchedTarget = target;
        matchedRect = rect;
      }
    });

    if (!matchedTarget) {
      draft.hoverTargetId = null;
      draft.hoverPosition = null;
      return;
    }

    draft.hoverTargetId = matchedTarget.id;
    draft.hoverPosition = computeNormalizedPosition(activePoint, matchedRect);
  }, []);

  const suppressContextMenu = useCallback((event) => {
    if (dragRef.current) {
      event.preventDefault();
    }
  }, []);

  const handleWheel = useCallback((event) => {
    const draft = dragRef.current;
    if (!draft) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.08 : -0.08;
    draft.scale = clamp(draft.scale + delta, STICKER_MIN_SCALE, STICKER_MAX_SCALE);
    scheduleStateUpdate(dragRef, setDragState, rafRef);
  }, []);

  const handlePointerMove = useCallback(
    (event) => {
      const draft = dragRef.current;
      if (!draft) return;
      event.preventDefault();
      const isRightHeld = (event.buttons & 2) === 2;
      const point = { x: event.clientX, y: event.clientY };

      if (draft.rotateMode) {
        if (!isRightHeld) {
          draft.rotateMode = false;
          draft.rotateAnchor = null;
          draft.rotateStartAngle = null;
          draft.baseRotation = draft.rotation;
        } else if (draft.rotateAnchor) {
          const angle = Math.atan2(point.y - draft.rotateAnchor.y, point.x - draft.rotateAnchor.x);
          const deltaDeg = ((angle - draft.rotateStartAngle) * 180) / Math.PI;
          draft.rotation = clamp(draft.baseRotation + deltaDeg, -180, 180);
        }
      }

      if (!draft.rotateMode && isRightHeld) {
        draft.rotateMode = true;
        const centerPoint = draft.center || point;
        draft.rotateAnchor = { ...centerPoint };
        const angle = Math.atan2(point.y - centerPoint.y, point.x - centerPoint.x);
        draft.rotateStartAngle = angle;
        draft.baseRotation = draft.rotation;
      }

      if (!draft.rotateMode) {
        draft.center = point;
      }
      draft.pointer = point;

      const activePoint =
        draft.rotateMode && draft.rotateAnchor ? draft.rotateAnchor : draft.center || point;
      updateHover(activePoint, draft);
      scheduleStateUpdate(dragRef, setDragState, rafRef);
    },
    [updateHover]
  );

  // Define handlers that were previously "used before defined"
  const handlePointerUp = useCallback(
    (event) => {
      const draft = dragRef.current;
      if (!draft) return;
      if (event.button !== 0) return;
      event.preventDefault();
      const dispatchCompletion = (snapshot) => {
        if (!snapshot) return;
        const activePoint =
          snapshot.rotateMode && snapshot.rotateAnchor
            ? snapshot.rotateAnchor
            : snapshot.center || snapshot.pointer;
        updateHover(activePoint, snapshot);
        const target = snapshot.hoverTargetId ? targetsRef.current.get(snapshot.hoverTargetId) : null;
        if (!target || !snapshot.hoverPosition) return;

        if (snapshot.source === 'picker') {
          target.onDropNew?.({
            sticker: snapshot.sticker,
            position: snapshot.hoverPosition,
            scale: snapshot.scale,
            rotation: snapshot.rotation,
          });
        } else if (snapshot.source === 'existing') {
          const samePost = snapshot.fromPostId === target.id;
          if (!samePost) return;
          target.onDropMove?.({
            sticker: snapshot.sticker,
            placementId: snapshot.placementId,
            position: snapshot.hoverPosition,
            scale: snapshot.scale,
            rotation: snapshot.rotation,
            fromPostId: snapshot.fromPostId,
          });
        }
      };
      // use ref to avoid use-before-define
      finalizeDragRef.current?.(dispatchCompletion);
    },
    [updateHover]
  );

  const handlePointerCancel = useCallback(() => {
    finalizeDragRef.current?.();
  }, []);

  const detachListeners = useCallback(() => {
    if (!listenersAttachedRef.current) return;
    listenersAttachedRef.current = false;
    document.removeEventListener('pointermove', handlePointerMove, true);
    document.removeEventListener('pointerup', handlePointerUp, true);
    document.removeEventListener('pointercancel', handlePointerCancel, true);
    document.removeEventListener('wheel', handleWheel, wheelListenerOptions);
    document.removeEventListener('contextmenu', suppressContextMenu, true);
  }, [
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleWheel,
    wheelListenerOptions,
    suppressContextMenu,
  ]);

  const finalizeDrag = useCallback(
    (dispatch = null) => {
      const current = dragRef.current;
      dragRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setDragState(null);
      detachListeners();
      if (dispatch && typeof dispatch === 'function') {
        try {
          dispatch(current);
        } catch (err) {
          console.error('Sticker drag completion failed', err);
        }
      }
    },
    [detachListeners]
  );

  // keep ref in sync each render
  finalizeDragRef.current = finalizeDrag;

  const attachListeners = useCallback(() => {
    if (listenersAttachedRef.current) return;
    listenersAttachedRef.current = true;
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('pointercancel', handlePointerCancel, true);
    document.addEventListener('wheel', handleWheel, wheelListenerOptions);
    document.addEventListener('contextmenu', suppressContextMenu, true);
  }, [
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleWheel,
    wheelListenerOptions,
    suppressContextMenu,
  ]);

  const beginPickerDrag = useCallback(
    ({ sticker, point, origin = 'catalog' }) => {
      if (!sticker || !point) return false;
      const sanitized = sanitizeSticker(sticker, origin);
      dragRef.current = {
        source: 'picker',
        sticker: sanitized,
        scale: 1,
        rotation: 0,
        center: { ...point },
        pointer: { ...point },
        hoverTargetId: null,
        hoverPosition: null,
        rotateMode: false,
        rotateAnchor: null,
        rotateStartAngle: null,
        baseRotation: 0,
      };
      updateHover(point, dragRef.current);
      setDragState({ ...dragRef.current });
      attachListeners();
      return true;
    },
    [attachListeners, updateHover]
  );

  const beginStickerMove = useCallback(
    ({ sticker, postId, placementId, center, point, scale, rotation }) => {
      if (!sticker || !postId || !placementId || !center || !point) return false;
      const sanitized = sanitizeSticker(sticker, sticker.origin || sticker.type || 'catalog');
      dragRef.current = {
        source: 'existing',
        sticker: sanitized,
        fromPostId: postId,
        placementId,
        scale: typeof scale === 'number' ? clamp(scale, STICKER_MIN_SCALE, STICKER_MAX_SCALE) : 1,
        rotation: typeof rotation === 'number' ? clamp(rotation, -180, 180) : 0,
        center: { ...center },
        pointer: { ...point },
        hoverTargetId: postId,
        hoverPosition: null,
        rotateMode: false,
        rotateAnchor: null,
        rotateStartAngle: null,
        baseRotation: typeof rotation === 'number' ? rotation : 0,
      };
      updateHover(center, dragRef.current);
      setDragState({ ...dragRef.current });
      attachListeners();
      return true;
    },
    [attachListeners, updateHover]
  );

  const registerTarget = useCallback((id, options) => {
    if (!id || !options?.getRect) return () => {};
    const target = {
      id,
      getRect: options.getRect,
      onDropNew: options.onDropNew,
      onDropMove: options.onDropMove,
    };
    targetsRef.current.set(id, target);
    return () => {
      targetsRef.current.delete(id);
    };
  }, []);

  // include finalizeDrag in deps
  useEffect(() => () => finalizeDrag(), [finalizeDrag]);

  const contextValue = useMemo(
    () => ({
      beginPickerDrag,
      beginStickerMove,
      registerTarget,
      activeDrag: dragState,
      hoverTargetId: dragState?.hoverTargetId || null,
    }),
    [beginPickerDrag, beginStickerMove, registerTarget, dragState]
  );

  return (
    <StickerInteractionsContext.Provider value={contextValue}>
      {children}
      <StickerDragOverlay state={dragState} />
    </StickerInteractionsContext.Provider>
  );
};

const OverlayRoot = typeof document !== 'undefined' ? document.body : null;

const StickerPreview = ({ state }) => {
  if (!state) return null;
  const style = {
    position: 'fixed',
    left: 0,
    top: 0,
    pointerEvents: 'none',
    transform: `translate(${(state.center?.x || state.pointer?.x || 0) - 32}px, ${
      (state.center?.y || state.pointer?.y || 0) - 32
    }px) rotate(${state.rotation}deg) scale(${state.scale})`,
    transformOrigin: 'center',
    zIndex: 5000,
    opacity: 0.92,
    filter: 'drop-shadow(0 12px 24px rgba(15, 23, 42, 0.32))',
    width: 64,
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: state.sticker.assetType === 'image' ? 0 : 48,
  };

  return (
    <div style={style}>
      {state.sticker.assetType === 'image' ? (
        <img
          src={state.sticker.assetValue}
          alt={state.sticker.label}
          style={{ maxWidth: 64, maxHeight: 64, borderRadius: 12 }}
        />
      ) : (
        state.sticker.value || state.sticker.assetValue || '⭐'
      )}
    </div>
  );
};

const StickerDragOverlay = ({ state }) => {
  if (!state || !OverlayRoot) return null;
  return createPortal(<StickerPreview state={state} />, OverlayRoot);
};

export const useStickerInteractions = () => useContext(StickerInteractionsContext);

export default StickerInteractionsContext;
