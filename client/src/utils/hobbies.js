// Shared hobby metadata helpers (keeps emoji labels consistent across views)
export const HOBBY_LIMIT = 10;

const DEFAULT_EMOJI = '✨';

const HOBBY_EMOJI_TABLE = {
  Reading: '📚',
  Traveling: '✈️',
  Movies: '🎬',
  Fishing: '🎣',
  Crafts: '🧵',
  Television: '📺',
  'Bird watching': '🦜',
  Collecting: '🗃️',
  Music: '🎵',
  Gardening: '🌱',
  'Video Games': '🎮',
  Drawing: '✏️',
  Walking: '🚶',
  Hiking: '🥾',
  Cooking: '🍳',
  Sports: '🏅',
  Fitness: '🏋️',
  Yoga: '🧘',
  Photography: '📸',
  Writing: '✍️',
  Dancing: '💃',
  Painting: '🎨',
  Camping: '🏕️',
};

export const getHobbyEmoji = (name) => HOBBY_EMOJI_TABLE[name] || DEFAULT_EMOJI;

export const HOBBY_NAMES = Object.keys(HOBBY_EMOJI_TABLE);

export const toHobbyMeta = (name) => {
  const emoji = getHobbyEmoji(name);
  return { name, emoji, label: `${emoji} ${name}`.trim() };
};

export const mapHobbiesWithMeta = (names = []) => names.map(toHobbyMeta);
