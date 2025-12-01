// client/src/pages/CrosswordDaily.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { dailySeed, rngFromSeed } from '../utils/dailyChallenges';

/* ---------- Layout + styling ---------- */

const TOP_NAV_HEIGHT = 72; // adjust if your top nav height differs

const Page = styled.div`
  height: calc(100vh - ${TOP_NAV_HEIGHT}px);
  max-height: calc(100vh - ${TOP_NAV_HEIGHT}px);
  padding: 12px clamp(12px, 4vw, 32px);
  max-width: 1200px;
  margin: 0 auto;
  color: var(--text-color);
  box-sizing: border-box;

  display: flex;
  align-items: stretch;
  min-height: 0;
`;

const Card = styled.div`
  flex: 1;
  width: 100%;
  height: 100%;
  max-height: 100%;
  background: var(--container-white);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.35);
  padding: 18px clamp(16px, 3vw, 28px);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
`;

const Title = styled.h1`
  margin: 0 0 4px;
  font-size: clamp(24px, 4vw, 32px);
  background: linear-gradient(92deg, var(--primary-orange), #59d0ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const Subtitle = styled.div`
  font-size: 13px;
  opacity: 0.75;
  margin-bottom: 4px;
`;

const ProgressRow = styled.div`
  font-size: 12px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const ProgressPill = styled.div`
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.22);
  font-size: 11px;
`;

const HintRow = styled.div`
  font-size: 11px;
  opacity: 0.8;
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
`;

const Kbd = styled.span`
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.7);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

/* central layout: clues left/right, grid center */
const GameLayout = styled.div`
  flex: 1;
  min-height: 0;

  display: grid;
  grid-template-columns:
    minmax(0, 1.1fr)
    minmax(0, min(70vh, 520px))
    minmax(0, 1.1fr);
  grid-template-areas: 'left board right';
  gap: 24px;
  align-items: start;

  @media (max-width: 960px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'board'
      'left'
      'right';
    row-gap: 18px;
  }
`;

const BoardColumn = styled.div`
  grid-area: board;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 0;
`;

const ClueColumn = styled.div`
  grid-area: ${(p) => p.$area};
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  padding-right: 4px;
`;

const ClueHeader = styled.div`
  font-weight: 900;
  font-size: 14px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.85;
  margin-bottom: 8px;
`;

const ClueList = styled.div`
  display: grid;
  gap: 6px;
`;

const solvedPulse = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
  60% {
    transform: scale(1.035);
    box-shadow: 0 0 18px 4px rgba(34, 197, 94, 0.35);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
`;

const ClueItem = styled.button`
  appearance: none;
  text-align: left;
  border-radius: 10px;
  padding: 6px 8px;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  font-size: 13px;
  cursor: pointer;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px;
  align-items: baseline;

  ${(p) =>
    p.$active &&
    css`
      background: rgba(89, 208, 255, 0.08);
      border-color: rgba(89, 208, 255, 0.7);
    `}

  ${(p) =>
    p.$solved &&
    css`
      background: linear-gradient(
        90deg,
        rgba(34, 197, 94, 0.18),
        rgba(34, 197, 94, 0.06)
      );
      border-color: rgba(34, 197, 94, 0.9);
      color: #bbf7d0;
      animation: ${solvedPulse} 0.35s ease-out;
    `}

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }
`;

const ClueNum = styled.span`
  font-weight: 800;
  font-size: 12px;
  opacity: 0.9;
  width: 36px;
`;

const ClueText = styled.span`
  font-size: 13px;
  line-height: 1.4;
`;

/* grid */

const BoardFrame = styled.div`
  width: 100%;
  max-width: min(80vh, 520px);
  min-width: 260px;
  max-height: 100%;
  border-radius: 18px;
  padding: 10px;
  background: radial-gradient(
      circle at 0% 0%,
      rgba(89, 208, 255, 0.08),
      transparent 55%
    ),
    rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.5);
  box-shadow:
    0 18px 40px rgba(15, 23, 42, 0.9),
    inset 0 0 0 1px rgba(15, 23, 42, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 0;

  @media (max-width: 960px) {
    max-width: min(90vw, 420px);
  }
`;

const BoardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(${(p) => p.$cols}, 1fr);
  gap: 2px;
  width: 100%;
  aspect-ratio: ${(p) => `${p.$cols} / ${p.$rows}`};
  user-select: none;
`;

const Cell = styled.button`
  position: relative;
  border: none;
  border-radius: 6px;
  padding: 0;
  cursor: ${(p) => (p.$isBlock ? 'default' : 'pointer')};
  background: ${(p) =>
    p.$isBlock
      ? 'radial-gradient(circle at 30% 30%, rgba(15,23,42,0.96), #020617)'
      : 'linear-gradient(145deg, rgba(15,23,42,0.9), rgba(30,64,175,0.9))'};
  box-shadow: ${(p) =>
    p.$isBlock
      ? 'inset 0 0 0 1px rgba(15,23,42,0.97)'
      : '0 4px 10px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(248,250,252,0.08)'};
  color: #e5e7eb;
  font-weight: 800;
  font-size: clamp(12px, 1.7vw, 18px);
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
  outline: none;

  ${(p) =>
    p.$isActive &&
    css`
      box-shadow:
        0 0 0 2px rgba(251, 191, 36, 0.98),
        0 0 22px rgba(251, 191, 36, 0.55),
        inset 0 0 0 1px rgba(15, 23, 42, 0.97);
      z-index: 2;
    `}

  ${(p) =>
    p.$inActiveWord &&
    !p.$isActive &&
    !p.$isBlock &&
    css`
      box-shadow:
        0 0 0 1px rgba(89, 208, 255, 0.7),
        inset 0 0 0 1px rgba(15, 23, 42, 0.97);
    `}

  ${(p) =>
    p.$inSolvedWord &&
    !p.$isBlock &&
    css`
      background: linear-gradient(145deg, #15803d, #22c55e);
      color: #f9fafb;
    `}
`;

const CellNumber = styled.span`
  position: absolute;
  top: 2px;
  left: 3px;
  font-size: 9px;
  opacity: 0.75;
`;

const DoneBanner = styled.div`
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(34, 197, 94, 0.14);
  color: #bbf7d0;
  font-weight: 600;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
`;

const BackLink = styled.a`
  appearance: none;
  border-radius: 999px;
  padding: 7px 12px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-color);
  font-weight: 700;
  font-size: 13px;
  text-decoration: none;
`;

/* ---------- Crossword generation ---------- */
/**
 * Curated medium/“daily” difficulty word list.
 * You can keep expanding this list – the generator
 * will automatically incorporate the new entries.
 */
const WORD_BANK = [
  { answer: 'LIBRARY', clue: 'Quiet place with stacks of books.' },
  { answer: 'SYLLABUS', clue: 'Document that outlines a course.' },
  { answer: 'HEADPHONES', clue: 'What you wear to study with music on.' },
  { answer: 'NOTEBOOK', clue: 'Paper companion for lectures.' },
  { answer: 'SEMESTER', clue: 'Half of an academic year.' },
  { answer: 'DEADLINE', clue: 'Time when an assignment is due.' },
  { answer: 'LAPTOP', clue: 'Portable computer you might bring to class.' },
  { answer: 'PASSWORD', clue: 'You should never share this with strangers.' },
  { answer: 'ALGORITHM', clue: 'Step-by-step recipe for solving a problem.' },
  { answer: 'CAMPFIRE', clue: 'Circle of friends and marshmallows.' },
  { answer: 'ASTRONAUT', clue: 'Traveler far beyond the atmosphere.' },
  { answer: 'MUSEUM', clue: 'Place to see art or history exhibits.' },
  { answer: 'KEYBOARD', clue: 'Instrument or input device with many keys.' },
  { answer: 'SATELLITE', clue: 'Object that orbits a planet.' },
  { answer: 'BLUEPRINT', clue: "Architect's detailed plan." },
  { answer: 'SNOWSTORM', clue: 'Winter weather that can close schools.' },
  { answer: 'PLAYLIST', clue: 'Curated list of songs.' },
  { answer: 'GROUPCHAT', clue: 'Where plans are made and memes are sent.' },
  { answer: 'ELEVATOR', clue: 'It lifts you between floors.' },
  { answer: 'SPAGHETTI', clue: 'Long pasta often served with sauce.' },
  { answer: 'COMPASS', clue: 'Tool that points north.' },
  { answer: 'OVERTIME', clue: 'Extra minutes when a game is tied.' },
  { answer: 'ARCHIVE', clue: 'Long-term storage for old documents.' },
  { answer: 'PUZZLE', clue: "Your brain's favorite kind of challenge." },
  { answer: 'TEASER', clue: 'Short preview that hooks your interest.' },
  { answer: 'PROJECTOR', clue: 'Device that throws images on a screen.' },
  { answer: 'BACKPACK', clue: 'You use it to haul everything around.' },
  { answer: 'ECLIPSE', clue: 'When one space object blocks another.' },
  { answer: 'MOSAIC', clue: 'Picture made from tiny colored pieces.' },
  { answer: 'ENIGMA', clue: 'Something mysterious and hard to explain.' },
  { answer: 'VOYAGER', clue: 'Long-distance traveler or explorer.' },
  { answer: 'LABYRINTH', clue: 'Complicated maze with many twists.' },
  { answer: 'GALAXY', clue: 'Huge collection of stars and planets.' },
  { answer: 'MODULE', clue: 'Self-contained unit in a larger system.' },
  { answer: 'PORTFOLIO', clue: 'Collection of your best work.' },
  { answer: 'SNACKBAR', clue: 'Small place to grab something quick to eat.' },
  { answer: 'JOURNAL', clue: 'Place where you jot down thoughts.' },
  { answer: 'KEYSTONE', clue: 'Central piece that holds everything together.' },
  { answer: 'MINDSET', clue: 'Your usual way of thinking.' },
  { answer: 'OVERLAP', clue: 'Part that covers the same space as another.' },
  { answer: 'CAMERA', clue: 'Device used to capture photos or video.' },
  { answer: 'TREASURE', clue: 'Something valuable you want to protect.' },
  { answer: 'SATCHEL', clue: 'Sturdy shoulder bag for carrying things.' },
  { answer: 'SUNLIGHT', clue: 'Warm rays streaming through a window.' },
  { answer: 'DAYDREAM', clue: 'Imagination wandering during the day.' },
  { answer: 'RAINSTORM', clue: 'Heavy shower with thunder or lightning.' },
  { answer: 'CHECKLIST', clue: 'List that keeps your tasks on track.' },
  { answer: 'HEADLINE', clue: 'Big text at the top of the news.' },
  { answer: 'INBOX', clue: 'First place your messages arrive.' },
  { answer: 'PLAYGROUND', clue: 'Outdoor area with swings and slides.' },
  { answer: 'FOOTSTEP', clue: 'Sound of someone walking nearby.' },
  { answer: 'SCRAMBLE', clue: 'Move quickly and a little chaotically.' },
  { answer: 'TIMELINE', clue: 'Visual line showing events in order.' },
  { answer: 'SPOTLIGHT', clue: 'Bright beam that puts you center stage.' },
  { answer: 'SANDBOX', clue: 'Safe digital space to experiment in.' },
  { answer: 'BRAINSTORM', clue: 'Fast session of idea generation.' },
  { answer: 'OVERVIEW', clue: 'High-level summary of something big.' },
  { answer: 'FIREWORKS', clue: 'Explosions of color in the night sky.' },
  { answer: 'TRAVELER', clue: 'Person who loves to be on the move.' },
  { answer: 'COFFEE', clue: 'Bitter drink that powers late nights.' },
  { answer: 'ENERGY', clue: 'What you need to keep going.' },
  { answer: 'KEYCHAIN', clue: 'Ring that keeps important keys together.' },
  { answer: 'CHEMISTRY', clue: 'Science of reactions and bonds.' },
  { answer: 'STARGAZER', clue: 'Person who loves looking at the night sky.' },
  { answer: 'PASSPORT', clue: 'Document that lets you cross borders.' },
  { answer: 'FLASHCARD', clue: 'Small card used for rapid review.' },
  { answer: 'WORKSHOP', clue: 'Hands-on session to learn a skill.' },
  { answer: 'ADVENTURE', clue: 'Exciting trip into the unknown.' },
];

// de-dupe just in case
const UNIQUE_WORD_BANK = Array.from(
  new Map(WORD_BANK.map((w) => [w.answer, w])).values(),
);

function buildTodayPuzzle() {
  const seed = dailySeed('crossword');
  const rng = rngFromSeed(seed);

  const size = 15;
  const board = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );

  // length-weighted shuffle: longer words first, but still random
  const pool = [...UNIQUE_WORD_BANK].sort((a, b) => {
    const scoreA = a.answer.length * 10 + rng();
    const scoreB = b.answer.length * 10 + rng();
    return scoreB - scoreA;
  });

  const placements = [];

  // pick first word that fits horizontally
  let firstIndex = 0;
  while (
    firstIndex < pool.length &&
    pool[firstIndex].answer.length > size
  ) {
    firstIndex += 1;
  }
  const first = pool[firstIndex] || pool[0];

  const midRow = Math.floor(size / 2);
  const startCol = Math.floor((size - first.answer.length) / 2);
  for (let i = 0; i < first.answer.length; i += 1) {
    board[midRow][startCol + i] = first.answer[i];
  }
  placements.push({
    answer: first.answer,
    clue: first.clue,
    direction: 'across',
    row: midRow,
    col: startCol,
    length: first.answer.length,
  });

  const TARGET_WORDS = 20; // aim for dense grids
  const MAX_ATTEMPTS = pool.length * 3;

  const tryPlace = (entry) => {
    const letters = entry.answer.split('');
    const candidates = [];

    placements.forEach((p) => {
      const pLetters = p.answer.split('');

      for (let pi = 0; pi < pLetters.length; pi += 1) {
        const shared = pLetters[pi];

        for (let wi = 0; wi < letters.length; wi += 1) {
          if (letters[wi] !== shared) continue;

          if (p.direction === 'across') {
            // new word vertical
            const row = p.row - wi;
            const col = p.col + pi;
            if (row < 0 || row + letters.length > size) continue;

            let ok = true;
            for (let t = 0; t < letters.length; t += 1) {
              const r = row + t;
              const c = col;
              const existing = board[r][c];
              if (existing && existing !== letters[t]) {
                ok = false;
                break;
              }
            }
            if (!ok) continue;

            // score: prefer cells near unused territory
            let score = 0;
            for (let t = 0; t < letters.length; t += 1) {
              const r = row + t;
              const c = col;
              const up = r > 0 && !board[r - 1][c];
              const down = r < size - 1 && !board[r + 1][c];
              const left = c > 0 && !board[r][c - 1];
              const right = c < size - 1 && !board[r][c + 1];
              score += up + down + left + right;
            }
            candidates.push({ row, col, direction: 'down', score });
          } else {
            // p is down -> new word horizontal
            const row = p.row + pi;
            const col = p.col - wi;
            if (col < 0 || col + letters.length > size) continue;

            let ok = true;
            for (let t = 0; t < letters.length; t += 1) {
              const r = row;
              const c = col + t;
              const existing = board[r][c];
              if (existing && existing !== letters[t]) {
                ok = false;
                break;
              }
            }
            if (!ok) continue;

            let score = 0;
            for (let t = 0; t < letters.length; t += 1) {
              const r = row;
              const c = col + t;
              const up = r > 0 && !board[r - 1][c];
              const down = r < size - 1 && !board[r + 1][c];
              const left = c > 0 && !board[r][c - 1];
              const right = c < size - 1 && !board[r][c + 1];
              score += up + down + left + right;
            }
            candidates.push({ row, col, direction: 'across', score });
          }
        }
      }
    });

    if (!candidates.length) return false;

    // pick best few candidates, then choose randomly among them
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.slice(0, Math.min(5, candidates.length));
    const chosen = top[Math.floor(rng() * top.length)];

    if (chosen.direction === 'across') {
      for (let i = 0; i < letters.length; i += 1) {
        board[chosen.row][chosen.col + i] = letters[i];
      }
    } else {
      for (let i = 0; i < letters.length; i += 1) {
        board[chosen.row + i][chosen.col] = letters[i];
      }
    }

    placements.push({
      answer: entry.answer,
      clue: entry.clue,
      direction: chosen.direction,
      row: chosen.row,
      col: chosen.col,
      length: letters.length,
    });
    return true;
  };

  let cursor = (firstIndex + 1) % pool.length;
  let attempts = 0;

  while (
    placements.length < TARGET_WORDS &&
    attempts < MAX_ATTEMPTS
  ) {
    const entry = pool[cursor];
    cursor = (cursor + 1) % pool.length;
    attempts += 1;

    if (!entry) continue;
    if (entry.answer.length < 4) continue; // avoid ultra-short fill
    if (placements.some((p) => p.answer === entry.answer)) continue;

    tryPlace(entry);
  }

  // trim board to bounding box
  let minR = size - 1;
  let maxR = 0;
  let minC = size - 1;
  let maxC = 0;
  let any = false;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (board[r][c]) {
        any = true;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }

  if (!any) {
    return {
      seed,
      rows: size,
      cols: size,
      grid: Array.from({ length: size }, () =>
        Array.from({ length: size }, () => ({ letter: null })),
      ),
      across: [],
      down: [],
    };
  }

  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;

  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      row: r,
      col: c,
      letter: board[minR + r][minC + c] || null,
      number: null,
      acrossId: null,
      acrossIndex: null,
      downId: null,
      downIndex: null,
    })),
  );

  const adjusted = placements.map((p) => ({
    ...p,
    row: p.row - minR,
    col: p.col - minC,
  }));

  const byStart = {};
  adjusted.forEach((p) => {
    byStart[`${p.row}:${p.col}:${p.direction}`] = p;
  });

  const across = [];
  const down = [];
  const clueById = {};
  let number = 1;

  // classic crossword numbering
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cell = grid[r][c];
      if (!cell.letter) continue;

      const leftIsEmpty = c === 0 || !grid[r][c - 1].letter;
      const rightHasLetter = c + 1 < cols && grid[r][c + 1].letter;
      if (leftIsEmpty && rightHasLetter) {
        const key = `${r}:${c}:across`;
        const p = byStart[key];
        if (p) {
          const id = `A-${number}`;
          const clue = {
            id,
            number,
            direction: 'across',
            row: r,
            col: c,
            length: p.length,
            answer: p.answer,
            clue: p.clue,
          };
          across.push(clue);
          clueById[id] = clue;

          cell.number = cell.number || number;
          for (let i = 0; i < p.length; i += 1) {
            const cc = grid[r][c + i];
            cc.acrossId = id;
            cc.acrossIndex = i;
          }
          number += 1;
        }
      }

      const topIsEmpty = r === 0 || !grid[r - 1][c].letter;
      const bottomHasLetter = r + 1 < rows && grid[r + 1][c].letter;
      if (topIsEmpty && bottomHasLetter) {
        const key = `${r}:${c}:down`;
        const p = byStart[key];
        if (p) {
          const id = `D-${number}`;
          const clue = {
            id,
            number,
            direction: 'down',
            row: r,
            col: c,
            length: p.length,
            answer: p.answer,
            clue: p.clue,
          };
          down.push(clue);
          clueById[id] = clue;

          cell.number = cell.number || number;
          for (let i = 0; i < p.length; i += 1) {
            const rr = grid[r + i][c];
            rr.downId = id;
            rr.downIndex = i;
          }
          number += 1;
        }
      }
    }
  }

  return {
    seed,
    rows,
    cols,
    grid,
    across,
    down,
    clueById,
  };
}

/* ---------- Component ---------- */

export default function CrosswordDaily() {
  const navigate = useNavigate();
  const puzzle = useMemo(() => buildTodayPuzzle(), []);

  const [entries, setEntries] = useState(() => {
    const map = {};
    [...puzzle.across, ...puzzle.down].forEach((cl) => {
      map[cl.id] = Array(cl.length).fill('');
    });
    return map;
  });

  const [active, setActive] = useState(() => {
    const first = puzzle.across[0] || puzzle.down[0];
    if (!first) return null;
    return { id: first.id, direction: first.direction, index: 0 };
  });

  const [solved, setSolved] = useState(false);
  const [solvedMap, setSolvedMap] = useState({});
  const solvedRef = useRef(false);
  const hiddenInputRef = useRef(null);

  useEffect(() => {
    document.title = 'Daily Crossword – UniVerse';
  }, []);

  const allCluesOrdered = useMemo(
    () => [...puzzle.across, ...puzzle.down],
    [puzzle],
  );
  const totalClues = allCluesOrdered.length;
  const solvedCount = Object.keys(solvedMap).length;

  const getClue = (id) =>
    puzzle.across.find((c) => c.id === id) ||
    puzzle.down.find((c) => c.id === id);

  const focusHiddenInput = () => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  };

  const getCellChar = (cell) => {
    const { acrossId, acrossIndex, downId, downIndex } = cell;
    let ch = '';
    if (acrossId && entries[acrossId]?.[acrossIndex]) {
      ch = entries[acrossId][acrossIndex];
    }
    if (downId && entries[downId]?.[downIndex]) {
      ch = entries[downId][downIndex];
    }
    return ch || '';
  };

  const updateEntriesForCell = (cell, letter, primaryId, primaryIndex) => {
    setEntries((prev) => {
      const next = { ...prev };
      if (primaryId != null) {
        const arr = [...(next[primaryId] || [])];
        arr[primaryIndex] = letter;
        next[primaryId] = arr;
      }
      const isAcrossPrimary = primaryId === cell.acrossId;
      const secondaryId = isAcrossPrimary ? cell.downId : cell.acrossId;
      const secondaryIndex = isAcrossPrimary
        ? cell.downIndex
        : cell.acrossIndex;

      if (secondaryId != null && secondaryIndex != null) {
        const arr2 = [...(next[secondaryId] || [])];
        arr2[secondaryIndex] = letter;
        next[secondaryId] = arr2;
      }

      return next;
    });
  };

  const setActiveFromCell = (cell, preferDirection = 'across') => {
    if (!cell.letter) return;
    const hasAcross = !!cell.acrossId;
    const hasDown = !!cell.downId;

    let id = null;
    let direction = null;
    let index = 0;

    if (preferDirection === 'across' && hasAcross) {
      id = cell.acrossId;
      direction = 'across';
      index = cell.acrossIndex;
    } else if (preferDirection === 'down' && hasDown) {
      id = cell.downId;
      direction = 'down';
      index = cell.downIndex;
    } else if (hasAcross) {
      id = cell.acrossId;
      direction = 'across';
      index = cell.acrossIndex;
    } else if (hasDown) {
      id = cell.downId;
      direction = 'down';
      index = cell.downIndex;
    }

    if (id) {
      setActive({ id, direction, index });
    }
  };

  const handleBoardClick = (cell) => {
    if (!cell.letter) return;
    focusHiddenInput();
    const sameCellActive =
      active &&
      getClue(active.id) &&
      (() => {
        const clue = getClue(active.id);
        const row =
          clue.direction === 'across' ? clue.row : clue.row + active.index;
        const col =
          clue.direction === 'across' ? clue.col + active.index : clue.col;
        return row === cell.row && col === cell.col;
      })();

    if (sameCellActive && cell.acrossId && cell.downId) {
      const newDir = active.direction === 'across' ? 'down' : 'across';
      setActiveFromCell(cell, newDir);
    } else {
      setActiveFromCell(cell, active?.direction || 'across');
    }
  };

  const moveWithinClue = (clue, newIndex) => {
    if (!clue) return;
    const clamped = Math.max(0, Math.min(clue.length - 1, newIndex));
    setActive({ id: clue.id, direction: clue.direction, index: clamped });
  };

  const moveToCellOffset = (dr, dc) => {
    if (!active) return;
    const clue = getClue(active.id);
    if (!clue) return;
    const baseRow =
      clue.direction === 'across' ? clue.row : clue.row + active.index;
    const baseCol =
      clue.direction === 'across' ? clue.col + active.index : clue.col;

    let r = baseRow + dr;
    let c = baseCol + dc;
    const { rows, cols } = puzzle;

    while (r >= 0 && r < rows && c >= 0 && c < cols) {
      const cell = puzzle.grid[r][c];
      if (cell && cell.letter) {
        if (dr !== 0 && cell.downId) {
          setActiveFromCell(cell, 'down');
        } else if (dc !== 0 && cell.acrossId) {
          setActiveFromCell(cell, 'across');
        } else {
          setActiveFromCell(cell, active.direction);
        }
        return;
      }
      r += dr;
      c += dc;
    }
  };

  const moveToNextClue = (delta) => {
    if (!allCluesOrdered.length) return;
    const currentId = active?.id;
    const currentIndex = allCluesOrdered.findIndex(
      (cl) => cl.id === currentId,
    );
    const startIndex = currentIndex === -1 ? 0 : currentIndex;
    let nextIndex =
      (startIndex + delta + allCluesOrdered.length) %
      allCluesOrdered.length;

    // skip already-solved clues when possible
    let safeguard = 0;
    while (
      solvedMap[allCluesOrdered[nextIndex].id] &&
      safeguard < allCluesOrdered.length
    ) {
      nextIndex =
        (nextIndex + delta + allCluesOrdered.length) %
        allCluesOrdered.length;
      safeguard += 1;
    }

    const next = allCluesOrdered[nextIndex];
    setActive({ id: next.id, direction: next.direction, index: 0 });
  };

  const handleHiddenKeyDown = (e) => {
    if (!active) return;

    const clue = getClue(active.id);
    if (!clue) return;
    const key = e.key;

    if (key === 'ArrowLeft') {
      e.preventDefault();
      moveToCellOffset(0, -1);
      return;
    }
    if (key === 'ArrowRight') {
      e.preventDefault();
      moveToCellOffset(0, 1);
      return;
    }
    if (key === 'ArrowUp') {
      e.preventDefault();
      moveToCellOffset(-1, 0);
      return;
    }
    if (key === 'ArrowDown') {
      e.preventDefault();
      moveToCellOffset(1, 0);
      return;
    }
    if (key === 'Tab') {
      e.preventDefault();
      moveToNextClue(e.shiftKey ? -1 : 1);
      return;
    }

    if (key === 'Backspace') {
      e.preventDefault();
      const cell =
        clue.direction === 'across'
          ? puzzle.grid[clue.row][clue.col + active.index]
          : puzzle.grid[clue.row + active.index][clue.col];

      const current = getCellChar(cell);
      if (current) {
        updateEntriesForCell(cell, '', active.id, active.index);
      } else if (active.index > 0) {
        moveWithinClue(clue, active.index - 1);
        const cell2 =
          clue.direction === 'across'
            ? puzzle.grid[clue.row][clue.col + active.index - 1]
            : puzzle.grid[clue.row + active.index - 1][clue.col];
        updateEntriesForCell(cell2, '', active.id, active.index - 1);
      }
      return;
    }

    if (key.length === 1 && /[a-zA-Z]/.test(key)) {
      e.preventDefault();
      const letter = key.toUpperCase();

      const cell =
        clue.direction === 'across'
          ? puzzle.grid[clue.row][clue.col + active.index]
          : puzzle.grid[clue.row + active.index][clue.col];

      updateEntriesForCell(cell, letter, active.id, active.index);

      const isLast = active.index === clue.length - 1;

      if (!isLast) {
        moveWithinClue(clue, active.index + 1);
      } else {
        // auto-jump to next unsolved clue when you finish a word
        moveToNextClue(1);
      }
    }
  };

  const handleClueClick = (clue) => {
    focusHiddenInput();
    setActive({ id: clue.id, direction: clue.direction, index: 0 });
  };

  const isCellInActiveWord = (cell) => {
    if (!active) return false;
    const clue = getClue(active.id);
    if (!clue) return false;

    if (clue.direction === 'across') {
      if (cell.row !== clue.row) return false;
      return (
        cell.col >= clue.col && cell.col < clue.col + clue.length && !!cell.letter
      );
    }
    if (cell.col !== clue.col) return false;
    return (
      cell.row >= clue.row && cell.row < clue.row + clue.length && !!cell.letter
    );
  };

  const isCellActive = (cell) => {
    if (!active) return false;
    const clue = getClue(active.id);
    if (!clue) return false;

    const r =
      clue.direction === 'across' ? clue.row : clue.row + active.index;
    const c =
      clue.direction === 'across' ? clue.col + active.index : clue.col;
    return cell.row === r && cell.col === c;
  };

  const isCellInSolvedWord = (cell) => {
    if (!cell.letter) return false;
    return (
      (cell.acrossId && solvedMap[cell.acrossId]) ||
      (cell.downId && solvedMap[cell.downId])
    );
  };

  // correctness + completion check
  useEffect(() => {
    const allClues = [...puzzle.across, ...puzzle.down];
    if (!allClues.length) return;

    const nextSolved = {};
    allClues.forEach((clue) => {
      const attempt = (entries[clue.id] || [])
        .join('')
        .toUpperCase();
      if (attempt.length === clue.answer.length && attempt === clue.answer) {
        nextSolved[clue.id] = true;
      }
    });

    setSolvedMap(nextSolved);

    const allCorrect =
      allClues.length > 0 &&
      allClues.every((clue) => nextSolved[clue.id]);

    if (allCorrect && !solvedRef.current) {
      solvedRef.current = true;
      setSolved(true);

      if (
        window.UniVerseDailyChallenge &&
        typeof window.UniVerseDailyChallenge.complete === 'function'
      ) {
        window.UniVerseDailyChallenge.complete('crossword');
      }

      setTimeout(() => {
        try {
          navigate('/games');
        } catch {
          /* ignore navigation errors */
        }
      }, 1600);
    }
  }, [entries, puzzle, navigate]);

  return (
    <Page>
      <Card>
        <Title>Daily Crossword</Title>
        <Subtitle>
          Daily Mix Crossword · Seed #{puzzle.seed}
        </Subtitle>

        <ProgressRow>
          <ProgressPill>
            Solved {solvedCount} / {totalClues || 0} clues
          </ProgressPill>
        </ProgressRow>

        <HintRow>
          <span>Click a clue or cell, then type.</span>
          <span>
            <Kbd>Arrow keys</Kbd> · move
          </span>
          <span>
            <Kbd>Tab</Kbd> · next clue
          </span>
          <span>· answers glow green when correct.</span>
        </HintRow>

        {/* hidden input to capture keyboard events */}
        <input
          ref={hiddenInputRef}
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            height: 0,
            width: 0,
          }}
          onKeyDown={handleHiddenKeyDown}
        />

        <GameLayout>
          <ClueColumn $area="left">
            <ClueHeader>Across</ClueHeader>
            <ClueList>
              {puzzle.across.map((cl) => (
                <ClueItem
                  key={cl.id}
                  type="button"
                  onClick={() => handleClueClick(cl)}
                  $active={active?.id === cl.id}
                  $solved={!!solvedMap[cl.id]}
                >
                  <ClueNum>{cl.number}A</ClueNum>
                  <ClueText>{cl.clue}</ClueText>
                </ClueItem>
              ))}
            </ClueList>
          </ClueColumn>

          <BoardColumn>
            <BoardFrame onClick={focusHiddenInput}>
              <BoardGrid $rows={puzzle.rows} $cols={puzzle.cols}>
                {puzzle.grid.map((row, r) =>
                  row.map((cell) => {
                    const char = getCellChar(cell);
                    const inActiveWord = isCellInActiveWord(cell);
                    const activeCell = isCellActive(cell);
                    const inSolvedWord = isCellInSolvedWord(cell);

                    return (
                      <Cell
                        key={`${r}-${cell.col}`}
                        type="button"
                        $isBlock={!cell.letter}
                        $inActiveWord={inActiveWord}
                        $isActive={activeCell}
                        $inSolvedWord={inSolvedWord}
                        onClick={() => handleBoardClick(cell)}
                      >
                        {cell.number != null && cell.letter && (
                          <CellNumber>{cell.number}</CellNumber>
                        )}
                        {cell.letter ? char : null}
                      </Cell>
                    );
                  }),
                )}
              </BoardGrid>
            </BoardFrame>
          </BoardColumn>

          <ClueColumn $area="right">
            <ClueHeader>Down</ClueHeader>
            <ClueList>
              {puzzle.down.map((cl) => (
                <ClueItem
                  key={cl.id}
                  type="button"
                  onClick={() => handleClueClick(cl)}
                  $active={active?.id === cl.id}
                  $solved={!!solvedMap[cl.id]}
                >
                  <ClueNum>{cl.number}D</ClueNum>
                  <ClueText>{cl.clue}</ClueText>
                </ClueItem>
              ))}
            </ClueList>
          </ClueColumn>
        </GameLayout>

        {solved && (
          <DoneBanner>
            <span>
              ✅ You solved today&apos;s crossword! +200 coins have been queued.
              Returning to Games…
            </span>
            <BackLink href="/games">Back to Games now</BackLink>
          </DoneBanner>
        )}
      </Card>
    </Page>
  );
}
