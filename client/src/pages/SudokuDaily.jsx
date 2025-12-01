// client/src/pages/SudokuDaily.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { dailySeed, rngFromSeed } from '../utils/dailyChallenges';

const Page = styled.div`
  height: 100vh;
  max-height: 100vh;
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  overflow: hidden; /* never show scrollbars for this page */
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color);
`;

const Card = styled.div`
  background: var(--container-white);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 14px 32px rgba(0,0,0,.35);
  width: 100%;
  max-width: 980px;
  height: 100%;
  max-height: 100%;
  padding: 12px 16px;
  box-sizing: border-box;

  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0; /* allow inner flex children to shrink */
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: clamp(20px, 3.6vw, 28px);
  background: linear-gradient(92deg, var(--primary-orange), #59D0FF);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const Subtle = styled.div`
  font-size: 12px;
  opacity: 0.7;
`;

const StatusRow = styled.div`
  display: flex;
  gap: 10px;
  font-size: 12px;
  opacity: 0.85;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const Layout = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const BoardWrapper = styled.div`
  flex: 1.2;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  grid-auto-rows: 1fr;
  width: min(78vw, 78vh, 520px); /* keep it inside viewport on mobile & desktop */
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: inset 0 0 0 2px var(--border-color);
`;

const CellButton = styled.button`
  position: relative;
  border: 1px solid var(--border-color);
  background: rgba(12, 18, 30, 0.9);
  color: var(--text-color);
  font-weight: 700;
  font-size: clamp(16px, 2.6vw, 24px);
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  padding: 0;
  cursor: pointer;
  transition: background 120ms ease, box-shadow 120ms ease, color 120ms ease;

  &.given {
    background: rgba(255,255,255,0.06);
    font-weight: 800;
  }

  &.selected {
    box-shadow: inset 0 0 0 2px var(--primary-orange);
    z-index: 2;
  }

  &.related {
    background: rgba(255,255,255,0.03);
  }

  &.same-value {
    background: rgba(59,130,246,0.24);
  }

  &.error {
    background: rgba(239,68,68,0.2);
  }

  &.given.error {
    background: rgba(239,68,68,0.28);
  }

  &:disabled {
    cursor: default;
  }
`;

const ThickBorderCell = styled(CellButton)`
  border-right-width: ${(props) => (props.$thickRight ? '2px' : '1px')};
  border-bottom-width: ${(props) => (props.$thickBottom ? '2px' : '1px')};
`;

const NotesGrid = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  font-size: clamp(8px, 1.4vw, 11px);
  opacity: 0.8;
`;

const NoteDigit = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ControlsPanel = styled.div`
  flex: 0.9;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: space-between;

  @media (max-width: 768px) {
    flex-direction: column;
    flex: 0.8;
  }
`;

const Instruction = styled.p`
  font-size: 12px;
  line-height: 1.4;
  margin: 0;
  opacity: 0.9;
`;

const Keypad = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
`;

const NumberKey = styled.button`
  border-radius: 999px;
  border: 1px solid var(--border-color);
  padding: 10px 0;
  font-size: clamp(16px, 3vw, 20px);
  font-weight: 700;
  background: rgba(255,255,255,0.06);
  color: var(--text-color);
  cursor: pointer;
  outline: none;
  transition: transform 80ms ease, box-shadow 80ms ease, background 120ms ease;

  &:active {
    transform: translateY(1px) scale(0.98);
    box-shadow: 0 0 0 1px var(--border-color);
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
`;

const TogglesRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const ToggleButton = styled.button`
  flex: 1;
  min-width: 0;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  background: ${(props) => (props.$active ? 'var(--primary-orange)' : 'rgba(255,255,255,0.04)')};
  color: ${(props) => (props.$active ? '#111827' : 'var(--text-color)')};
  cursor: pointer;
  outline: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const Legend = styled.div`
  font-size: 11px;
  opacity: 0.7;
  line-height: 1.4;
`;

const DoneBanner = styled.div`
  margin-top: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(34,197,94,0.12);
  color: #bbf7d0;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
`;

const BackLink = styled.a`
  appearance: none;
  border-radius: 999px;
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  background: rgba(255,255,255,0.06);
  color: var(--text-color);
  font-weight: 700;
  font-size: 12px;
  text-decoration: none;
`;

// Deterministic, valid 9x9 Sudoku solution
const BASE_SOLUTION = (() => {
  const grid = [];
  for (let r = 0; r < 9; r++) {
    const row = [];
    for (let c = 0; c < 9; c++) {
      const val = ((r * 3 + Math.floor(r / 3) + c) % 9) + 1;
      row.push(val);
    }
    grid.push(row);
  }
  return grid;
})();

function makePuzzle(seed) {
  const rng = rngFromSeed(seed);
  const puzzle = BASE_SOLUTION.map((row) => row.slice());

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      // remove around 55% of cells
      if (rng() < 0.55) puzzle[r][c] = null;
    }
  }
  return puzzle;
}

function sameBox(r1, c1, r2, c2) {
  return Math.floor(r1 / 3) === Math.floor(r2 / 3) &&
    Math.floor(c1 / 3) === Math.floor(c2 / 3);
}

export default function SudokuDaily() {
  const seed = useMemo(() => dailySeed('sudoku'), []);
  const puzzle = useMemo(() => makePuzzle(seed), [seed]);

  const givenMask = useMemo(
    () => puzzle.map((row) => row.map((v) => v != null)),
    [puzzle]
  );

  const [values, setValues] = useState(() =>
    puzzle.map((row) => row.map((v) => (v == null ? '' : String(v))))
  );

  const [notes, setNotes] = useState(() =>
    Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => new Set())
    )
  );

  const [selected, setSelected] = useState(null); // { row, col }
  const [notesMode, setNotesMode] = useState(false);
  const [solved, setSolved] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const solvedRef = useRef(false);

  useEffect(() => {
    document.title = 'Daily Sudoku – UniVerse';
  }, []);

  const checkSolved = (grid) => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = Number(grid[r][c]);
        if (val !== BASE_SOLUTION[r][c]) return false;
      }
    }
    return true;
  };

  const handleSetCellValue = (row, col, digit) => {
    if (givenMask[row][col] || solved) return;

    setValues((prev) => {
      const next = prev.map((r) => r.slice());
      next[row][col] = digit;

      // clear notes in this cell
      setNotes((prevNotes) => {
        const cloned = prevNotes.map((r) =>
          r.map((s) => new Set(s))
        );
        cloned[row][col].clear();
        return cloned;
      });

      const wrong = digit && Number(digit) !== BASE_SOLUTION[row][col];
      if (wrong) {
        setMistakes((m) => m + 1);
      }

      const done = digit ? checkSolved(next) : false;
      if (done && !solvedRef.current) {
        solvedRef.current = true;
        setSolved(true);
        if (
          window.UniVerseDailyChallenge &&
          typeof window.UniVerseDailyChallenge.complete === 'function'
        ) {
          window.UniVerseDailyChallenge.complete('sudoku');
        }
      }

      return next;
    });
  };

  const toggleNote = (row, col, digit) => {
    if (givenMask[row][col] || solved) return;
    setNotes((prev) => {
      const next = prev.map((r) => r.map((s) => new Set(s)));
      const set = next[row][col];
      if (set.has(digit)) set.delete(digit);
      else set.add(digit);
      return next;
    });
  };

  const clearCell = (row, col) => {
    if (givenMask[row][col] || solved) return;
    setValues((prev) => {
      const next = prev.map((r) => r.slice());
      next[row][col] = '';
      return next;
    });
    setNotes((prev) => {
      const next = prev.map((r) => r.map((s) => new Set(s)));
      next[row][col].clear();
      return next;
    });
  };

  const handleDigitInput = (digit) => {
    if (!selected) return;
    const { row, col } = selected;
    if (notesMode) {
      toggleNote(row, col, digit);
    } else {
      handleSetCellValue(row, col, digit);
    }
  };

  const handleErase = () => {
    if (!selected) return;
    const { row, col } = selected;
    clearCell(row, col);
  };

  const moveSelection = (dr, dc) => {
    setSelected((prev) => {
      if (!prev) return { row: 0, col: 0 };
      let r = prev.row + dr;
      let c = prev.col + dc;
      if (r < 0) r = 0;
      if (r > 8) r = 8;
      if (c < 0) c = 0;
      if (c > 8) c = 8;
      return { row: r, col: c };
    });
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (solved) return;

      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        handleDigitInput(e.key);
      } else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleErase();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection(-1, 0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection(1, 0);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveSelection(0, -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveSelection(0, 1);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setNotesMode((v) => !v);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const hasConflict = (row, col) => {
    const val = values[row][col];
    if (!val) return false;

    // row
    for (let c = 0; c < 9; c++) {
      if (c !== col && values[row][c] === val) return true;
    }
    // col
    for (let r = 0; r < 9; r++) {
      if (r !== row && values[r][col] === val) return true;
    }
    // box
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++) {
      for (let c = bc; c < bc + 3; c++) {
        if ((r !== row || c !== col) && values[r][c] === val) return true;
      }
    }
    return false;
  };

  const isErrorCell = (row, col) => {
    const val = values[row][col];
    if (!val) return false;
    if (Number(val) !== BASE_SOLUTION[row][col]) return true;
    return hasConflict(row, col);
  };

  return (
    <Page>
      <Card>
        <HeaderRow>
          <TitleBlock>
            <Title>Daily Sudoku</Title>
            <Subtle>Seed #{seed}</Subtle>
          </TitleBlock>

          <StatusRow>
            <span>Notes: {notesMode ? 'ON' : 'OFF'} (press N)</span>
            <span>Mistakes: {mistakes}</span>
          </StatusRow>
        </HeaderRow>

        <Layout>
          <BoardWrapper>
            <Grid>
              {values.map((row, r) =>
                row.map((cell, c) => {
                  const given = givenMask[r][c];
                  const selectedCell =
                    selected && selected.row === r && selected.col === c;
                  const related =
                    selected &&
                    !selectedCell &&
                    (selected.row === r ||
                      selected.col === c ||
                      sameBox(selected.row, selected.col, r, c));
                  const sameValue =
                    selected &&
                    values[selected.row][selected.col] &&
                    values[selected.row][selected.col] === cell &&
                    !given;
                  const error = !given && isErrorCell(r, c);

                  const classes = [
                    given ? 'given' : '',
                    selectedCell ? 'selected' : '',
                    related ? 'related' : '',
                    sameValue ? 'same-value' : '',
                    error ? 'error' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  const noteSet = notes[r][c];

                  return (
                    <ThickBorderCell
                      key={`${r}-${c}`}
                      type="button"
                      className={classes}
                      onClick={() => setSelected({ row: r, col: c })}
                      disabled={solved}
                      $thickRight={c === 2 || c === 5}
                      $thickBottom={r === 2 || r === 5}
                    >
                      {cell ? (
                        cell
                      ) : noteSet.size ? (
                        <NotesGrid>
                          {Array.from({ length: 9 }, (_, i) => {
                            const d = String(i + 1);
                            return (
                              <NoteDigit key={d}>
                                {noteSet.has(d) ? d : ''}
                              </NoteDigit>
                            );
                          })}
                        </NotesGrid>
                      ) : null}
                    </ThickBorderCell>
                  );
                })
              )}
            </Grid>
          </BoardWrapper>

          <ControlsPanel>
            <Instruction>
              Tap a cell, then use the keypad or your keyboard. Turn on{' '}
              <strong>Notes</strong> for pencil marks. Duplicate numbers in a
              row, column, or box, and incorrect digits, will glow red.
            </Instruction>

            <div>
              <Subtle>Number pad</Subtle>
              <Keypad>
                {Array.from({ length: 9 }, (_, i) => {
                  const n = String(i + 1);
                  return (
                    <NumberKey
                      key={n}
                      onClick={() => handleDigitInput(n)}
                      disabled={solved}
                    >
                      {n}
                    </NumberKey>
                  );
                })}
              </Keypad>
            </div>

            <div>
              <Subtle>Tools</Subtle>
              <TogglesRow>
                <ToggleButton
                  type="button"
                  onClick={() => setNotesMode((v) => !v)}
                  $active={notesMode}
                  disabled={solved}
                >
                  ✏️ Notes {notesMode ? 'On' : 'Off'}
                </ToggleButton>
                <ToggleButton
                  type="button"
                  onClick={handleErase}
                  $active={false}
                  disabled={solved || !selected}
                >
                  ⌫ Erase
                </ToggleButton>
              </TogglesRow>
            </div>

            <Legend>
              <div>
                <strong>Tip:</strong> Use arrow keys to move, numbers to fill,
                and 0 / Backspace to clear.
              </div>
              <div>Orange outline = selected cell.</div>
              <div>Blue = same number as the selected cell.</div>
              <div>Red = conflict or wrong number.</div>
            </Legend>
          </ControlsPanel>
        </Layout>

        {solved && (
          <DoneBanner>
            <span>✅ You solved today&apos;s Sudoku! +200 coins have been queued.</span>
            <BackLink href="/games">Back to Games</BackLink>
          </DoneBanner>
        )}
      </Card>
    </Page>
  );
}
