// client/src/components/LetterAvatar.jsx
import React from 'react';

// Pleasant deterministic colors so users get a consistent chip color.
const PALETTE = [
  '#4c51bf', '#3b82f6', '#0ea5e9', '#06b6d4', '#10b981',
  '#16a34a', '#65a30d', '#f59e0b', '#ea580c', '#ef4444',
  '#db2777', '#8b5cf6',
];

function hashCode(str = '?') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
}

/**
 * Letter avatar used everywhere we used to show the old default image.
 * - `size`: number (px) or string (e.g. '100%')
 */
export default function LetterAvatar({ name = '', size = 40, rounded = true, className = '', title }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const idx = hashCode(name) % PALETTE.length;
  const bg = PALETTE[idx];

  const dim = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      className={className}
      title={title || name}
      aria-label={`${name || 'user'} avatar`}
      style={{
        width: dim,
        height: dim,
        borderRadius: rounded ? '50%' : 8,
        display: 'grid',
        placeItems: 'center',
        userSelect: 'none',
        background: bg,
        color: '#fff',
        fontWeight: 900,
        fontSize: typeof size === 'number' ? Math.max(12, Math.floor(size * 0.42)) : 18,
        border: '1px solid var(--border-color)',
      }}
    >
      {initial}
    </div>
  );
}
