// src/components/TitanTapCard.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  PROFILE_LAYOUTS,
  PROFILE_MODULE_TYPES,
  findLayout,
  alignModulesWithLayout,
  getLayoutColumns,
  createBioFallbackPreset,
  moduleHasVisibleContentPublic,
} from '../utils/titantap-utils';
import UserLink from './UserLink';
import { getHobbyEmoji } from '../utils/hobbies';
import { DEFAULT_BANNER_URL } from '../config';

/**
 * One little module inside the profile canvas (text / image / etc)
 */
function CardCanvasModule({
  module,
  user,
  clubsMap,
  editable = false,
  moduleTypes = PROFILE_MODULE_TYPES,
  onTypeChange,
  onContentChange,
  isActive = false,
  onActivate,
  layoutColumns = 1,
  onResize,
  showResizeHandles = false,
}) {
  const type = module?.type || 'text';
  const textValue =
    typeof module?.content?.text === 'string'
      ? module.content.text.trim()
      : '';
  const imageUrl =
    typeof module?.content?.url === 'string' ? module.content.url : '';
  const clubId =
    typeof module?.content?.clubId === 'string' ? module.content.clubId : null;
  const promptText =
    typeof module?.content?.text === 'string'
      ? module.content.text.trim()
      : '';
  const club = clubId && clubsMap ? clubsMap.get(String(clubId)) : null;
  const moduleId = module?._id;

  const layoutSettings =
    typeof module?.layoutSettings === 'object' && module.layoutSettings
      ? module.layoutSettings
      : { span: 1, minHeight: null };

  const clampedSpan = Math.min(
    Math.max(layoutSettings.span || 1, 1),
    Math.max(layoutColumns || 1, 1)
  );
  const baseMinHeight =
    typeof layoutSettings.minHeight === 'number' &&
    Number.isFinite(layoutSettings.minHeight)
      ? Math.max(layoutSettings.minHeight, 120)
      : null;

  const moduleRef = useRef(null);
  const resizingRef = useRef(null);
  const [draftSpan, setDraftSpan] = useState(clampedSpan);
  const [draftHeight, setDraftHeight] = useState(baseMinHeight);

  useEffect(() => {
    setDraftSpan(clampedSpan);
  }, [clampedSpan]);

  useEffect(() => {
    setDraftHeight(baseMinHeight);
  }, [baseMinHeight]);

  const normalizedDraftSpan = Math.min(
    Math.max(draftSpan, 1),
    Math.max(layoutColumns || 1, 1)
  );
  const normalizedDraftHeight =
    draftHeight != null ? Math.max(draftHeight, 120) : null;

  const handleResizePointerDown = useCallback(
    (event) => {
      if (!editable || !onResize) return;
      event.preventDefault();
      event.stopPropagation();

      const target = moduleRef.current;
      if (!target) return;
      const container = target.parentElement;
      if (!container) return;

      const gridWidth = container.getBoundingClientRect().width || 1;
      const columnWidth =
        layoutColumns > 0 ? gridWidth / Math.max(layoutColumns, 1) : gridWidth;
      const currentHeight = target.getBoundingClientRect().height;

      resizingRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        columnWidth,
        startSpan: normalizedDraftSpan,
        startHeight: currentHeight,
        hasMoved: false,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [editable, onResize, layoutColumns, normalizedDraftSpan]
  );

  const handleResizePointerMove = useCallback(
    (event) => {
      const state = resizingRef.current;
      if (!state) return;
      state.hasMoved = true;

      const deltaX = event.clientX - state.startX;
      const deltaY = event.clientY - state.startY;

      if (layoutColumns > 1 && state.columnWidth > 0) {
        let nextSpan = Math.round(
          state.startSpan + deltaX / state.columnWidth
        );
        nextSpan = Math.min(Math.max(nextSpan, 1), layoutColumns);
        if (nextSpan !== draftSpan) {
          setDraftSpan(nextSpan);
        }
      }

      let nextHeight = state.startHeight + deltaY;
      nextHeight = Math.max(Math.min(nextHeight, 520), 120);
      if (nextHeight !== draftHeight) {
        setDraftHeight(nextHeight);
      }
    },
    [layoutColumns, draftSpan, draftHeight]
  );

  const finishResize = useCallback(
    (event) => {
      const state = resizingRef.current;
      if (!state) return;
      event.currentTarget.releasePointerCapture?.(state.pointerId);
      resizingRef.current = null;

      if (!onResize) return;

      let nextSpan = normalizedDraftSpan;
      let nextHeight =
        normalizedDraftHeight != null ? normalizedDraftHeight : baseMinHeight;

      // click-to-cycle if the user just clicked the handle
      if (!state.hasMoved) {
        if (layoutColumns > 1) {
          nextSpan =
            normalizedDraftSpan >= layoutColumns ? 1 : normalizedDraftSpan + 1;
          setDraftSpan(nextSpan);
        }
      }

      const payload = {};
      if (layoutColumns > 1) {
        payload.span = Math.min(Math.max(nextSpan, 1), layoutColumns);
      }
      payload.minHeight =
        nextHeight != null ? Math.max(nextHeight, 120) : null;

      onResize?.(moduleId, payload);
    },
    [
      onResize,
      layoutColumns,
      normalizedDraftSpan,
      normalizedDraftHeight,
      baseMinHeight,
      moduleId,
    ]
  );

  const previewContent = (() => {
    if (type === 'text') {
      return <p>{textValue || 'Add custom text from Customize Card.'}</p>;
    }
    if (type === 'image') {
      return imageUrl ? (
        <div className="image-wrapper full">
          <img src={imageUrl} alt={user?.username || 'profile highlight'} />
        </div>
      ) : (
        <p className="card-canvas-empty">Add an image or GIF in Customize Card.</p>
      );
    }
    if (type === 'club') {
      if (club) {
        return (
          <>
            <span className="module-title">Club</span>
            <p>{club.name}</p>
          </>
        );
      }
      return (
        <>
          <span className="module-title">Club</span>
          <p className="card-canvas-empty">Club spotlights are coming soon.</p>
        </>
      );
    }
    if (type === 'prompt') {
      return (
        <>
          <span className="module-title">Prompt</span>
          <p className={promptText ? '' : 'card-canvas-empty'}>
            {promptText || 'Prompt responses are coming soon.'}
          </p>
        </>
      );
    }
    return (
      <>
        <span className="module-title">Module</span>
        <p className="card-canvas-empty">
          Customize this section from the editor.
        </p>
      </>
    );
  })();

  const appliedSpan = editable ? normalizedDraftSpan : clampedSpan;
  const appliedMinHeight = editable ? normalizedDraftHeight : baseMinHeight;

  const layoutStyle = {};
  if (layoutColumns > 1 && appliedSpan) {
    layoutStyle.gridColumn = `span ${Math.min(appliedSpan, layoutColumns)}`;
  }
  if (appliedMinHeight != null) {
    layoutStyle.minHeight = `${Math.max(appliedMinHeight, 120)}px`;
  }

  if (editable) {
    const handleTypeChange = (event) => {
      onTypeChange?.(module._id, event.target.value);
    };
    const handleContentChange = (field) => (event) => {
      onContentChange?.(module._id, field, event.target.value);
    };
    const stopPropagation = (event) => event.stopPropagation();
    const activate = (event) => {
      event.stopPropagation();
      onActivate?.(module._id);
    };

    return (
      <div
        ref={moduleRef}
        className={`card-canvas-item editable ${
          type === 'image' ? 'image' : ''
        } ${isActive ? 'active' : ''}`}
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(e) => {
          if (!onActivate) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onActivate(module._id);
          }
        }}
        style={layoutStyle}
      >
        <div className="module-preview">{previewContent}</div>

        {isActive && (
          <div className="module-editor" onClick={stopPropagation}>
            <div className="module-tile-header">
              <label htmlFor={`module-type-${module._id}`}>Module Section</label>
              <select
                id={`module-type-${module._id}`}
                className="module-select-inline"
                value={type}
                onClick={stopPropagation}
                onChange={handleTypeChange}
              >
                {moduleTypes.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled && option.value !== type}
                  >
                    {option.label}
                    {option.disabled ? ' (Coming soon)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {type === 'text' && (
              <div className="module-field inline" onClick={stopPropagation}>
                <textarea
                  rows={4}
                  value={module?.content?.text || ''}
                  placeholder="Share a fun blurb about yourself…"
                  maxLength={600}
                  data-skip-swipe="true"
                  onClick={stopPropagation}
                  onChange={handleContentChange('text')}
                />
                <div className="module-hint">
                  Up to 600 characters will appear in this highlight.
                </div>
              </div>
            )}

            {type === 'image' && (
              <div className="module-field inline" onClick={stopPropagation}>
                <input
                  type="url"
                  value={module?.content?.url || ''}
                  placeholder="https://..."
                  data-skip-swipe="true"
                  onClick={stopPropagation}
                  onChange={handleContentChange('url')}
                />
                {imageUrl ? (
                  <div className="image-wrapper full">
                    <img
                      src={imageUrl}
                      alt={user?.username || 'profile highlight'}
                    />
                  </div>
                ) : (
                  <p className="card-canvas-empty">
                    Add an image or GIF in Customize Card.
                  </p>
                )}
                <div className="module-hint">Images fill the entire module.</div>
              </div>
            )}

            {type === 'club' && (
              <div className="module-placeholder">
                Club spotlights are coming soon.
              </div>
            )}

            {type === 'prompt' && (
              <div className="module-placeholder">
                Prompt responses are coming soon.
              </div>
            )}
          </div>
        )}

        {showResizeHandles && (
          <button
            type="button"
            className="canvas-resize-handle"
            aria-label="Resize module"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
          >
            ↘
          </button>
        )}
      </div>
    );
  }

  // read-only
  return (
    <div
      ref={moduleRef}
      className={`card-canvas-item ${type === 'image' ? 'image' : ''}`}
      style={layoutStyle}
    >
      <div className="module-preview">{previewContent}</div>
    </div>
  );
}

/**
 * The actual swipeable profile card.
 */
function SwipeableCard({
  user,
  viewer,
  clubsMap,
  onDecision,
  profilePreset,
  preview = false,
  editable = false,
  moduleTypes = PROFILE_MODULE_TYPES,
  onModuleTypeChange,
  onModuleContentChange,
  activeModuleId = null,
  onModuleActivate,
  onCanvasActivate,
  layoutMenuOpen = false,
  onLayoutSelect,
  onModuleResize,
  canvasLayoutId = null,
}) {
  // basic swipe state
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [rot, setRot] = useState(0);
  const [released, setReleased] = useState(false);
  const activePointerIdRef = useRef(null);
  const skipSwipeRef = useRef(false);

  const resetTransforms = useCallback(() => {
    setDx(0);
    setDy(0);
    setRot(0);
    setReleased(false);
  }, []);

  // figure out what to show in the canvas
  const activeCanvasPreset = useMemo(() => {
    const rawBio =
      user?.bio || user?.statusMessage || user?.tagline || '';
    const fallbackPreset =
      rawBio && user ? createBioFallbackPreset(user) : null;

    if (profilePreset) {
      const layout = findLayout(profilePreset.layout);
      const modules = alignModulesWithLayout(profilePreset.modules, layout.id);
      const hasContent = modules.some((m) => moduleHasVisibleContentPublic(m));
      if (hasContent || editable || layout.id === 'hidden') {
        return { layout: layout.id, modules };
      }
      // otherwise fall back to bio
      if (fallbackPreset) {
        return {
          layout: fallbackPreset.layout,
          modules: fallbackPreset.modules,
        };
      }
      return { layout: 'hidden', modules: [] };
    }

    if (fallbackPreset) {
      return {
        layout: fallbackPreset.layout,
        modules: fallbackPreset.modules,
      };
    }

    return { layout: 'hidden', modules: [] };
  }, [profilePreset, user, editable]);

  const currentLayoutId =
    canvasLayoutId || activeCanvasPreset?.layout || 'hidden';
  const layoutColumns = getLayoutColumns(currentLayoutId);
  const canvasModules = Array.isArray(activeCanvasPreset?.modules)
    ? activeCanvasPreset.modules
    : [];
  const hasCanvasModules = editable
    ? canvasModules.length > 0
    : canvasModules.some((m) => moduleHasVisibleContentPublic(m));

  // basic pointer handlers
  const handlePointerDownCapture = (e) => {
    if (released) return;
    const isInteractive = !!e.target.closest(
      'button, input, textarea, select, a, [data-skip-swipe]'
    );
    if (isInteractive) {
      skipSwipeRef.current = true;
      activePointerIdRef.current = null;
      return;
    }
    skipSwipeRef.current = false;
    activePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (released) return;
    if (skipSwipeRef.current) return;
    if (activePointerIdRef.current !== e.pointerId) return;

    const nextDx = dx + (e.movementX || 0);
    const nextDy = dy + (e.movementY || 0);
    setDx(nextDx);
    setDy(nextDy);
    setRot(nextDx / 12);
  };

  const finishSwipe = (direction) => {
    setReleased(true);
    onDecision?.(direction, user);
  };

  const handlePointerUp = (e) => {
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
      return;
    }
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    activePointerIdRef.current = null;

    if (skipSwipeRef.current) {
      skipSwipeRef.current = false;
      resetTransforms();
      return;
    }

    const threshold = 120;
    if (dx > threshold) {
      finishSwipe('right');
    } else if (dx < -threshold) {
      finishSwipe('left');
    } else {
      resetTransforms();
    }
  };

  const handlePointerCancel = (e) => {
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
      return;
    }
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    activePointerIdRef.current = null;
    skipSwipeRef.current = false;
    resetTransforms();
  };

  const bannerUrl = user?.bannerPicture || DEFAULT_BANNER_URL;
  const avatarUrl = user?.profilePicture || '';
  const username = user?.username || 'user';

  const metaChips = [];
  if (user?.department) {
    metaChips.push({ label: user.department, icon: '🏛️' });
  }
  if (user?.classStanding || user?.classYear || user?.gradYear) {
    metaChips.push({
      label:
        user.classStanding ||
        (user.classYear ? `Class of ${user.classYear}` : '') ||
        (user.gradYear ? `Class of ${user.gradYear}` : ''),
      icon: '🎓',
    });
  }
  if (user?.major) {
    metaChips.push({ label: user.major, icon: '📘' });
  }
  if (user?.location || user?.city) {
    metaChips.push({
      label: user.location || user.city,
      icon: '📍',
    });
  }

  const userInterests = Array.isArray(user?.hobbies) ? user.hobbies : [];
  const viewerInterests = new Set(
    Array.isArray(viewer?.hobbies) ? viewer.hobbies : []
  );
  const mutualInterests = userInterests.filter((h) => viewerInterests.has(h));

  const cardStyle = preview
    ? {}
    : {
        transform: `translate(calc(-50% + ${dx}px), ${dy}px) rotate(${rot}deg)`,
        transition: released ? 'transform 0.25s ease-out' : 'none',
      };

  const canvasGrid =
    !hasCanvasModules && editable ? (
      <div
        className={`card-canvas-shell editable ${
          layoutMenuOpen ? 'layout-open' : ''
        }`}
        onClick={() => onCanvasActivate?.()}
        role="button"
        tabIndex={0}
      >
        <div className="card-canvas-placeholder">
          Canvas hidden. <strong>Tap to choose a layout.</strong>
        </div>
        {layoutMenuOpen && (
          <div className="canvas-layout-menu" role="menu">
            <span className="canvas-layout-title">Module Layout</span>
            <div className="canvas-layout-options">
              {PROFILE_LAYOUTS.map((layout) => {
                const isActive = layout.id === currentLayoutId;
                return (
                  <button
                    key={layout.id}
                    type="button"
                    className={`canvas-layout-option ${
                      isActive ? 'active' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLayoutSelect?.(layout.id);
                    }}
                  >
                    {layout.label}
                    {isActive ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    ) : hasCanvasModules ? (
      <div
        className={`card-canvas-shell ${editable ? 'editable' : ''} ${
          layoutMenuOpen ? 'layout-open' : ''
        }`}
        onClick={() => {
          if (editable) onCanvasActivate?.();
        }}
        role={editable ? 'button' : undefined}
        tabIndex={editable ? 0 : undefined}
        aria-expanded={editable ? layoutMenuOpen : undefined}
      >
        <div className={`card-canvas ${currentLayoutId}`}>
          {canvasModules.map((mod) => (
            <CardCanvasModule
              key={mod._id}
              module={mod}
              user={user}
              clubsMap={clubsMap}
              editable={editable}
              moduleTypes={moduleTypes}
              onTypeChange={editable ? onModuleTypeChange : undefined}
              onContentChange={editable ? onModuleContentChange : undefined}
              isActive={
                editable ? String(mod._id) === String(activeModuleId) : false
              }
              onActivate={editable ? onModuleActivate : undefined}
              layoutColumns={layoutColumns || 1}
              onResize={editable ? onModuleResize : undefined}
              showResizeHandles={
                editable &&
                (layoutMenuOpen || String(mod._id) === String(activeModuleId))
              }
            />
          ))}
        </div>
        {editable && layoutMenuOpen && (
          <div className="canvas-layout-menu" role="menu">
            <span className="canvas-layout-title">Module Layout</span>
            <div className="canvas-layout-options">
              {PROFILE_LAYOUTS.map((layout) => {
                const isActive = layout.id === currentLayoutId;
                return (
                  <button
                    key={layout.id}
                    type="button"
                    className={`canvas-layout-option ${
                      isActive ? 'active' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLayoutSelect?.(layout.id);
                    }}
                  >
                    {layout.label}
                    {isActive ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    ) : null;

  const cardBody = (
    <div className="card">
      <div
        className="card-banner"
        style={{ backgroundImage: `url(${bannerUrl})` }}
        aria-hidden="true"
      />
      <div className="card-body">
        <div className="card-hero">
          <div className={`card-avatar ${avatarUrl ? '' : 'initials'}`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} />
            ) : (
              <span>{username.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="card-hero-info">
            <div className="card-name-row">
              <div className="card-name">
                <UserLink username={username} hideBadge>
                  {username}
                </UserLink>
              </div>
              {user?.pronouns && (
                <span className="card-pronouns">{user.pronouns}</span>
              )}
            </div>
            {metaChips.length > 0 && (
              <div className="card-meta">
                {metaChips.map((chip, i) => (
                  <span key={i} className="meta-chip" data-skip-swipe>
                    {chip.icon ? (
                      <span className="emoji" aria-hidden>
                        {chip.icon}
                      </span>
                    ) : null}
                    <span>{chip.label}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {userInterests.length > 0 && (
          <div className="interest-cloud-shell">
            <div className="interest-cloud" aria-label="Interests">
              {userInterests.map((interest, index) => {
                const isCommon = viewerInterests.has(interest);
                return (
                  <span
                    key={`${interest}-${index}`}
                    className={`interest-dot ${isCommon ? 'common' : ''}`}
                    title={
                      isCommon
                        ? `You both enjoy ${interest}`
                        : `${username} enjoys ${interest}`
                    }
                    data-skip-swipe
                  >
                    {getHobbyEmoji(interest)}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {canvasGrid}

        <div className="card-footer">
          {!preview ? (
            <span className="swipe-hint">
              Drag right to connect, left to pass
            </span>
          ) : (
            <span className="swipe-hint">Preview only</span>
          )}
        </div>

        {mutualInterests.length > 0 && (
          <div className="mutual-count" role="status">
            <strong>
              {mutualInterests.length} mutual interest
              {mutualInterests.length === 1 ? '' : 's'}
            </strong>
          </div>
        )}
      </div>
    </div>
  );

  if (preview) {
    return <div className="card-wrap preview">{cardBody}</div>;
  }

  return (
    <div
      className="card-wrap"
      style={cardStyle}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {cardBody}
    </div>
  );
}

export { SwipeableCard };
export default SwipeableCard;
