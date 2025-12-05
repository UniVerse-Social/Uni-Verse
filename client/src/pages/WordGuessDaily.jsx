// client/src/pages/WordGuessDaily.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { dailySeed } from '../utils/dailyChallenges';

const Page = styled.div`
  height: 100vh;
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
  color: var(--text-color);
  display: flex;
  align-items: flex-start;      /* was: center */
  justify-content: center;
  overflow: hidden;             /* keep everything on one screen */
`;

const Card = styled.div`
  background: var(--container-white);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.35);
  padding: 14px 14px 16px;
  width: 100%;
  max-width: 600px;
  max-height: 100%;
  box-sizing: border-box;

  display: flex;
  flex-direction: column;
  gap: 6px;

  @media (max-height: 700px) {
    padding: 10px 10px 12px;
    border-radius: 12px;
  }
`;

const Header = styled.div`
  flex-shrink: 0;
`;

const Title = styled.h1`
  margin: 0 0 4px;
  font-size: clamp(20px, 3.4vw, 28px);
  background: linear-gradient(92deg, var(--primary-orange), #59d0ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const Subtle = styled.div`
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 6px;
`;

const Description = styled.p`
  font-size: 13px;
  opacity: 0.85;
  margin: 2px 0 6px;
`;

const Rules = styled.div`
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 4px;
`;

/* Board + tiles */
const Board = styled.div`
  display: grid;
  gap: 6px;
  margin: 6px 0 6px;
  flex: 1 1 0; /* this is the only area that shrinks/grows */
  align-content: center;
`;

const Row = styled.div`
  display: grid;
  gap: 6px;
`;

const Tile = styled.div`
  height: min(52px, 5.8vh); /* shrink on short screens */
  border-radius: 8px;
  border: 2px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: clamp(16px, 2.2vh, 20px);
  text-transform: uppercase;
  transition: transform 0.12s ease, background 0.12s ease,
    border-color 0.12s ease;
  letter-spacing: 0.03em;
  background: ${({ status }) => {
    switch (status) {
      case 'correct':
        return '#16a34a'; // green
      case 'present':
        return '#eab308'; // yellow
      case 'absent':
        return '#ef4444'; // red
      default:
        return 'rgba(15,23,42,0.85)';
    }
  }};
  border-color: ${({ status }) =>
    status ? 'transparent' : 'rgba(148,163,184,0.5)'};
  color: ${({ status }) => (status ? '#ffffff' : 'var(--text-color)')};
  box-shadow: ${({ status }) =>
    status ? '0 6px 16px rgba(0,0,0,0.45)' : 'none'};
`;

/* Input + status */
const InputRow = styled.form`
  display: flex;
  gap: 8px;
  margin-top: 2px;
  flex-shrink: 0;
`;

const Input = styled.input`
  flex: 1;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: rgba(15, 23, 42, 0.9);
  color: var(--text-color);
  outline: none;
  font-size: 14px;

  &:focus {
    border-color: var(--primary-orange);
  }
`;

const Button = styled.button`
  appearance: none;
  border-radius: 999px;
  padding: 8px 14px;
  border: none;
  background: var(--primary-orange);
  font-weight: 800;
  cursor: pointer;
  font-size: 14px;
  color: #0f172a;
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
  pointer-events: ${({ disabled }) => (disabled ? 'none' : 'auto')};
`;

const Message = styled.div`
  margin-top: 4px;
  font-size: 12px;
  min-height: 16px;
  flex-shrink: 0;
`;

/* Keyboard */
const Keyboard = styled.div`
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  user-select: none;
  flex-shrink: 0;
`;

const KeyboardRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 4px;
`;

const Key = styled.button`
  flex: 1;
  max-width: 40px;
  padding: clamp(2px, 0.7vh, 6px) 0;
  border-radius: 6px;
  border: none;
  font-size: clamp(10px, 1.5vh, 12px);
  font-weight: 700;
  text-transform: uppercase;
  cursor: default;
  background: ${({ status }) => {
    switch (status) {
      case 'correct':
        return '#16a34a';
      case 'present':
        return '#eab308';
      case 'absent':
        return '#ef4444';
      default:
        return 'rgba(15,23,42,0.9)';
    }
  }};
  color: ${({ status }) => (status ? '#ffffff' : 'var(--text-color)')};
`;

/* Completion banner */
const DoneBanner = styled.div`
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(34, 197, 94, 0.12);
  color: #bbf7d0;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  flex-shrink: 0;
`;

const BackLink = styled.a`
  appearance: none;
  border-radius: 999px;
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-color);
  font-weight: 700;
  font-size: 12px;
  text-decoration: none;
`;

// On-screen keyboard data
const ANSWERS = [
  'ARRAY', 'ALPHA', 'BRAVE', 'CLOUD', 'DELTA', 'DEBUG', 'FLOAT', 'GAMER',
  'GRAPH', 'HONEY', 'INPUT', 'JAZZY', 'KNOLL', 'LOGIC', 'METAL', 'NODES',
  'OASIS', 'PIXEL', 'QUERY', 'ROUTE', 'STACK', 'TITAN', 'UNITY', 'VIRAL',
  'WAVES', 'XENON', 'YOUTH', 'ZESTY', 'CODES', 'STUDY', 'ALGOS', 'CLASS',
  'SPORT', 'BOOKS', 'CAMPUS', 'RANGE', 'SCOPE', 'FLASH', 'QUEST', 'RIOTS',
  'TRACK', 'TREES', 'WORLD', 'WRITE', 'NOTES', 'SMILE', 'SOLVE', 'SHIFT',
  'FRAME', 'SPACE', 'LIGHT', 'CRANE', 'BOARD', 'MUSIC', 'DRINK', 'SLEEP',
].filter((w) => w.length === 5);

const MAX_ATTEMPTS = 6;
const LETTERS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

function pickTodayWord() {
  const seed = dailySeed('wordguess');
  const index = seed % ANSWERS.length;
  const answer = ANSWERS[index];
  return { seed, answer };
}

function evaluateGuess(answer, guess) {
  const ans = answer.split('');
  const g = guess.split('');

  const result = Array(g.length).fill('absent');
  const remaining = {};

  for (let i = 0; i < ans.length; i++) {
    if (g[i] === ans[i]) {
      result[i] = 'correct';
    } else {
      const ch = ans[i];
      remaining[ch] = (remaining[ch] || 0) + 1;
    }
  }

  for (let i = 0; i < ans.length; i++) {
    if (result[i] === 'correct') continue;
    const ch = g[i];
    if (remaining[ch]) {
      result[i] = 'present';
      remaining[ch] -= 1;
    } else {
      result[i] = 'absent';
    }
  }

  return result;
}

function mergeStatus(prev, next) {
  const rank = { absent: 0, present: 1, correct: 2 };
  if (!prev) return next;
  return rank[next] > rank[prev] ? next : prev;
}

export default function WordGuessDaily() {
  const { seed, answer } = useMemo(pickTodayWord, []);
  const [currentGuess, setCurrentGuess] = useState('');
  const [rows, setRows] = useState([]); // { word, result[] }
  const [status, setStatus] = useState('');
  const [keyboardState, setKeyboardState] = useState({});
  const [solved, setSolved] = useState(false);
  const solvedRef = useRef(false);

  const gameOver = solved || rows.length >= MAX_ATTEMPTS;
  const wordLength = answer.length;

  useEffect(() => {
    document.title = 'Daily Word Guess – UniVerse';
  }, []);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (gameOver) return;

    const cleaned = currentGuess.trim().toUpperCase();
    if (!cleaned) {
      setStatus('Type a guess first.');
      return;
    }

    if (cleaned.length !== wordLength) {
      setStatus(`Word must be exactly ${wordLength} letters.`);
      return;
    }

    const result = evaluateGuess(answer, cleaned);
    const newRow = { word: cleaned, result };

    setRows((prev) => [...prev, newRow]);
    setCurrentGuess('');
    setStatus('');

    setKeyboardState((prev) => {
      const nextState = { ...prev };
      cleaned.split('').forEach((ch, i) => {
        const s = result[i];
        nextState[ch] = mergeStatus(nextState[ch], s);
      });
      return nextState;
    });

    const isCorrect = result.every((r) => r === 'correct');

    if (isCorrect && !solvedRef.current) {
      solvedRef.current = true;
      setSolved(true);
      setStatus(`Nice! You solved it in ${rows.length + 1} / ${MAX_ATTEMPTS} attempts.`);
      if (
        window.UniVerseDailyChallenge &&
        typeof window.UniVerseDailyChallenge.complete === 'function'
      ) {
        window.UniVerseDailyChallenge.complete('wordguess');
      }
    } else if (!isCorrect && rows.length + 1 >= MAX_ATTEMPTS) {
      setStatus(`Out of guesses. The word was ${answer}.`);
    } else if (!isCorrect) {
      setStatus('Not quite. Keep trying!');
    }
  };

  return (
    <Page>
      <Card>
        <Header>
          <Title>Daily Word Grid</Title>
          <Subtle>Seed #{seed}</Subtle>

          <Description>
            Guess today&apos;s secret {wordLength}-letter word. You have{' '}
            {MAX_ATTEMPTS} tries.
          </Description>
          <Rules>
            Letters turn <strong style={{ color: '#16a34a' }}>green</strong> when
            they&apos;re in the correct spot,{' '}
            <strong style={{ color: '#eab308' }}>yellow</strong> when they&apos;re
            in the word but the wrong spot, and{' '}
            <strong style={{ color: '#ef4444' }}>red</strong> when they&apos;re not
            in the word at all.
          </Rules>
        </Header>

        <Board>
          {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIndex) => {
            const row = rows[rowIndex];
            const letters = row ? row.word.split('') : [];
            return (
              <Row
                key={rowIndex}
                style={{ gridTemplateColumns: `repeat(${wordLength}, 1fr)` }}
              >
                {Array.from({ length: wordLength }).map((_, colIndex) => {
                  const ch = letters[colIndex] || '';
                  const tileStatus = row?.result[colIndex];
                  return (
                    <Tile key={colIndex} status={tileStatus}>
                      {ch}
                    </Tile>
                  );
                })}
              </Row>
            );
          })}
        </Board>

        <InputRow onSubmit={handleSubmit}>
          <Input
            placeholder={`Type a ${wordLength}-letter word...`}
            value={currentGuess}
            onChange={(e) => {
              const value = e.target.value.replace(/[^a-zA-Z]/g, '');
              if (value.length <= wordLength) {
                setCurrentGuess(value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit(e);
              }
            }}
            disabled={gameOver}
          />
          <Button type="submit" disabled={gameOver}>
            Guess
          </Button>
        </InputRow>

        <Message>{status}</Message>

        <Keyboard>
          {LETTERS.map((row) => (
            <KeyboardRow key={row}>
              {row.split('').map((ch) => (
                <Key key={ch} status={keyboardState[ch]}>
                  {ch}
                </Key>
              ))}
            </KeyboardRow>
          ))}
        </Keyboard>

        {solved && (
          <DoneBanner>
            <span>✅ Correct! +200 coins have been queued.</span>
            <BackLink href="/games">Back to Games</BackLink>
          </DoneBanner>
        )}
      </Card>
    </Page>
  );
}
