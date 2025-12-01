// client/src/utils/dailyChallenges.js

// Same seed logic as on the Games page
export function dailySeed(chKey) {
  const now = new Date();
  const dayNumber = Math.floor(now.getTime() / (24 * 60 * 60 * 1000));
  let hash = 2166136261;
  const s = chKey + ':' + dayNumber;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash >>> 0;
}

// Simple deterministic RNG from a seed
export function rngFromSeed(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
