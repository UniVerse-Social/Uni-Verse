import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

/* ============ Layout (dark purple theme) ============ */

const Shell = styled.div`
  position: fixed;
  top: var(--nav-height, 64px);
  right: 0;
  bottom: 0;
  left: 0;

  display: grid;
  grid-template-columns: 240px 1fr;
  background: #0b0f1a;
  color: #e8ecff;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }

  @media (max-width: 768px) {
    bottom: calc(var(--mobile-nav-height, 64px) + env(safe-area-inset-bottom));
  }
`;

const Sidebar = styled.aside`
  background: rgba(25, 30, 48, 0.9);
  border-right: 1px solid rgba(100, 100, 150, 0.25);
  padding: 22px 16px;
  backdrop-filter: blur(6px);

  @media (max-width: 900px) {
    display: none;
  }
`;

const SideTitle = styled.div`
  font-weight: 900;
  font-size: 22px;
  margin-bottom: 18px;
  background: linear-gradient(90deg, #9ab6ff, #c8afff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const SideNav = styled.nav`
  display: grid;
  gap: 10px;
`;

const SideLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-start;
  text-decoration: none;
  color: #d9e1ff;
  padding: 10px 12px;
  border-radius: 10px;
  font-weight: 700;
  transition: 0.15s ease;

  &:hover {
    background: rgba(140, 130, 255, 0.18);
    color: #ffffff;
  }
`;

const Main = styled.main`
  overflow-y: auto;
  padding: clamp(18px, 2.4vw, 32px);
`;

const H1 = styled.h1`
  margin: 0 0 6px;
  font-weight: 900;
  font-size: clamp(30px, 4.5vw, 48px);
  background: linear-gradient(90deg, #8ea8ff, #a879ff, #59d0ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const Sub = styled.p`
  margin: 4px 0 22px;
  color: #9af0ff;
  opacity: 0.8;
`;

/* ============ Shared UI ============ */

const Tabs = styled.div`
  display: inline-flex;
  gap: 8px;
  background: rgba(24, 28, 48, 0.9);
  padding: 6px;
  border-radius: 12px;
  border: 1px solid rgba(110, 120, 190, 0.5);
  margin-bottom: 16px;
`;

const TabBtn = styled.button`
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-weight: 900;
  cursor: pointer;
  background: ${p =>
    p.active ? 'rgba(120, 120, 255, 0.35)' : 'transparent'};
  color: #e8ecff;
  transition: 0.15s ease;

  &:hover {
    background: rgba(110, 120, 220, 0.4);
  }
`;

const Card = styled.section`
  background: rgba(20, 24, 40, 0.96);
  border: 1px solid rgba(120, 120, 170, 0.3);
  border-radius: 18px;
  padding: clamp(18px, 2.2vw, 24px);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  margin-bottom: 18px;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: repeat(${p => p.cols || 2}, minmax(0, 1fr));
  gap: 14px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const PillRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
`;

const Pill = styled.button`
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid
    ${p => (p.active ? 'rgba(150,190,255,0.9)' : 'rgba(120,120,170,0.6)')};
  background: ${p =>
    p.active ? 'rgba(120, 140, 255, 0.35)' : 'rgba(20, 24, 40, 0.9)'};
  color: #e8ecff;
  font-weight: 800;
  cursor: pointer;
  font-size: 13px;
  transition: 0.15s ease;

  &:hover {
    background: rgba(120, 140, 255, 0.4);
  }
`;

const Tag = styled.span`
  display: inline-flex;
  height: 22px;
  align-items: center;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 900;
  border-radius: 999px;
  color: #a9bcff;
  background: rgba(95, 115, 255, 0.25);
  border: 1px solid rgba(145, 165, 255, 0.45);
`;

const Small = styled.small`
  color: #9bb5ff;
  opacity: 0.8;
`;

const SmallButton = styled.button`
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid rgba(140, 140, 200, 0.45);
  background: rgba(35, 40, 70, 0.95);
  font-weight: 800;
  cursor: pointer;
  color: #dbe5ff;
  transition: 0.15s ease;

  &:hover {
    background: rgba(55, 65, 100, 0.98);
  }
`;

const OptionButton = styled.button`
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid
    ${p =>
      p.state === 'correct'
        ? 'rgba(64, 205, 140, 0.9)'
        : p.state === 'wrong'
        ? 'rgba(255, 140, 140, 0.9)'
        : 'rgba(140, 140, 210, 0.6)'};
  background: ${p =>
    p.state === 'correct'
      ? 'rgba(64, 205, 140, 0.18)'
      : p.state === 'wrong'
      ? 'rgba(255, 140, 140, 0.18)'
      : 'rgba(22, 26, 44, 0.95)'};
  color: #e8ecff;
  font-weight: 700;
  cursor: pointer;
  margin-bottom: 8px;
  transition: 0.15s ease;
`;

/* ============ Data ============ */

const LESSONS = {
  fr: {
    name: 'French',
    lessons: [
      { id: 1, title: 'Basics 1: Greetings', words: [
        { native: 'hello', target: 'bonjour' },
        { native: 'goodbye', target: 'au revoir' },
        { native: 'please', target: 's’il vous plaît' },
        { native: 'thank you', target: 'merci' },
      ]},
      { id: 2, title: 'Basics 2: People', words: [
        { native: 'I', target: 'je' },
        { native: 'you', target: 'tu' },
        { native: 'he', target: 'il' },
        { native: 'she', target: 'elle' },
      ]},
      { id: 3, title: 'Food 1', words: [
        { native: 'water', target: 'eau' },
        { native: 'bread', target: 'pain' },
        { native: 'apple', target: 'pomme' },
      ]},
      { id: 4, title: 'Numbers 1–5', words: [
        { native: 'one', target: 'un' },
        { native: 'two', target: 'deux' },
        { native: 'three', target: 'trois' },
        { native: 'four', target: 'quatre' },
        { native: 'five', target: 'cinq' },
      ]},
      { id: 5, title: 'Colors', words: [
        { native: 'red', target: 'rouge' },
        { native: 'blue', target: 'bleu' },
        { native: 'green', target: 'vert' },
      ]},
      { id: 6, title: 'Family', words: [
        { native: 'mother', target: 'mère' },
        { native: 'father', target: 'père' },
        { native: 'friend', target: 'ami' },
      ]},
      { id: 7, title: 'School', words: [
        { native: 'book', target: 'livre' },
        { native: 'teacher', target: 'professeur' },
      ]},
      { id: 8, title: 'Days', words: [
        { native: 'Monday', target: 'lundi' },
        { native: 'Tuesday', target: 'mardi' },
      ]},
      { id: 9, title: 'Phrases 1', words: [
        { native: 'How are you?', target: 'Comment ça va ?' },
        { native: 'My name is…', target: 'Je m’appelle…' },
      ]},
      { id: 10, title: 'Travel 1', words: [
        { native: 'ticket', target: 'billet' },
        { native: 'train', target: 'train' },
      ]},
    ],
  },
  es: {
    name: 'Spanish',
    lessons: [
      { id: 1, title: 'Basics 1: Greetings', words: [
        { native: 'hello', target: 'hola' },
        { native: 'goodbye', target: 'adiós' },
        { native: 'please', target: 'por favor' },
        { native: 'thank you', target: 'gracias' },
      ]},
      { id: 2, title: 'Basics 2: People', words: [
        { native: 'I', target: 'yo' },
        { native: 'you', target: 'tú' },
        { native: 'he', target: 'él' },
        { native: 'she', target: 'ella' },
      ]},
      { id: 3, title: 'Food 1', words: [
        { native: 'water', target: 'agua' },
        { native: 'bread', target: 'pan' },
        { native: 'apple', target: 'manzana' },
      ]},
      { id: 4, title: 'Numbers 1–5', words: [
        { native: 'one', target: 'uno' },
        { native: 'two', target: 'dos' },
        { native: 'three', target: 'tres' },
        { native: 'four', target: 'cuatro' },
        { native: 'five', target: 'cinco' },
      ]},
      { id: 5, title: 'Colors', words: [
        { native: 'red', target: 'rojo' },
        { native: 'blue', target: 'azul' },
        { native: 'green', target: 'verde' },
      ]},
      { id: 6, title: 'Family', words: [
        { native: 'mother', target: 'madre' },
        { native: 'father', target: 'padre' },
        { native: 'friend', target: 'amigo' },
      ]},
      { id: 7, title: 'School', words: [
        { native: 'book', target: 'libro' },
        { native: 'teacher', target: 'profesor' },
      ]},
      { id: 8, title: 'Days', words: [
        { native: 'Monday', target: 'lunes' },
        { native: 'Tuesday', target: 'martes' },
      ]},
      { id: 9, title: 'Phrases 1', words: [
        { native: 'How are you?', target: '¿Cómo estás?' },
        { native: 'My name is…', target: 'Me llamo…' },
      ]},
      { id: 10, title: 'Travel 1', words: [
        { native: 'ticket', target: 'boleto' },
        { native: 'train', target: 'tren' },
      ]},
    ],
  },
  jp: {
    name: 'Japanese',
    lessons: [
      { id: 1, title: 'Greetings', words: [
        { native: 'hello', target: 'こんにちは' },
        { native: 'thank you', target: 'ありがとう' },
      ]},
      { id: 2, title: 'People', words: [
        { native: 'I', target: 'わたし' },
        { native: 'you', target: 'あなた' },
      ]},
      { id: 3, title: 'Food 1', words: [
        { native: 'water', target: 'みず' },
        { native: 'rice', target: 'ごはん' },
      ]},
      { id: 4, title: 'Numbers 1–5', words: [
        { native: 'one', target: 'いち' },
        { native: 'two', target: 'に' },
        { native: 'three', target: 'さん' },
        { native: 'four', target: 'よん' },
        { native: 'five', target: 'ご' },
      ]},
      { id: 5, title: 'School', words: [
        { native: 'student', target: 'がくせい' },
        { native: 'teacher', target: 'せんせい' },
      ]},
      { id: 6, title: 'Family', words: [
        { native: 'mother', target: 'おかあさん' },
        { native: 'father', target: 'おとうさん' },
      ]},
      { id: 7, title: 'Colors', words: [
        { native: 'red', target: 'あか' },
        { native: 'blue', target: 'あお' },
      ]},
      { id: 8, title: 'Phrases 1', words: [
        { native: 'good morning', target: 'おはよう' },
        { native: 'good night', target: 'おやすみ' },
      ]},
      { id: 9, title: 'Travel 1', words: [
        { native: 'train', target: 'でんしゃ' },
        { native: 'station', target: 'えき' },
      ]},
      { id: 10, title: 'Extra words', words: [
        { native: 'yes', target: 'はい' },
        { native: 'no', target: 'いいえ' },
      ]},
    ],
  },
};

const JP_SYLLABLES = {
  hiragana: [
    { kana: 'あ', romaji: 'a' },
    { kana: 'い', romaji: 'i' },
    { kana: 'う', romaji: 'u' },
    { kana: 'え', romaji: 'e' },
    { kana: 'お', romaji: 'o' },
  ],
  katakana: [
    { kana: 'ア', romaji: 'a' },
    { kana: 'イ', romaji: 'i' },
    { kana: 'ウ', romaji: 'u' },
    { kana: 'エ', romaji: 'e' },
    { kana: 'オ', romaji: 'o' },
  ],
};

const JP_COUNTING = [
  { native: 'one', target: 'いち' },
  { native: 'two', target: 'に' },
  { native: 'three', target: 'さん' },
  { native: 'four', target: 'よん' },
  { native: 'five', target: 'ご' },
];

/* ============ Local storage helpers ============ */

const STORAGE_KEY = 'lingolab_progress';

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data || {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

/* ============ Lesson Session ============ */

function buildQuestionsFromLesson(langCode, lesson) {
  const allWords = LESSONS[langCode].lessons.flatMap(l => l.words);
  const words = lesson.words || [];
  const questions = [];

  words.forEach(word => {
    const isNativePrompt = Math.random() < 0.5;
    const correct = isNativePrompt ? word.target : word.native;
    const prompt = isNativePrompt ? word.native : word.target;

    // distractors
    const pool = allWords.filter(
      w => (isNativePrompt ? w.target : w.native) !== correct
    );
    const shuffled = shuffleArray(pool).slice(0, 3);
    const options = shuffleArray([
      correct,
      ...shuffled.map(w => (isNativePrompt ? w.target : w.native)),
    ]);

    questions.push({
      id: `${lesson.id}_${word.native}`,
      prompt,
      correct,
      options,
      isNativePrompt,
    });
  });

  return questions;
}

function shuffleArray(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

/* ============ Lessons UI ============ */

const LessonGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
`;

const LessonTile = styled.button`
  position: relative;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid
    ${p => (p.completed ? 'rgba(144, 238, 144, 0.9)' : 'rgba(130, 140, 210, 0.7)')};
  background: ${p =>
    p.completed ? 'rgba(64, 205, 140, 0.16)' : 'rgba(24, 30, 52, 0.95)'};
  color: #e8ecff;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.45);
  transition: 0.15s ease;
  display: grid;
  gap: 6px;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.55);
  }
`;

const LessonNumber = styled.div`
  font-size: 12px;
  font-weight: 900;
  opacity: 0.8;
  color: #9bb5ff;
`;

const LessonTitle = styled.div`
  font-weight: 900;
  font-size: 14px;
`;

const LessonStatus = styled.div`
  font-size: 12px;
  opacity: 0.85;
`;

/* ============ Component: LessonsCard ============ */

function LessonsCard({ language, progress, onCompleteLesson }) {
  const langInfo = LESSONS[language];
  const [currentLesson, setCurrentLesson] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setCurrentLesson(null);
    setQuestions([]);
    setQIndex(0);
    setSelectedOption('');
    setShowFeedback(false);
    setFinished(false);
  }, [language]);

  const lessons = langInfo.lessons;

  const completedIds = (progress[language]?.completedLessons || []).reduce(
    (map, id) => ({ ...map, [id]: true }),
    {}
  );

  const startLesson = (lesson) => {
    const qs = buildQuestionsFromLesson(language, lesson);
    setCurrentLesson(lesson);
    setQuestions(qs);
    setQIndex(0);
    setSelectedOption('');
    setShowFeedback(false);
    setFeedbackCorrect(false);
    setFinished(false);
  };

  const currentQuestion = questions[qIndex] || null;

  const handleOptionClick = (opt) => {
    if (!currentQuestion || showFeedback) return;
    setSelectedOption(opt);
    const correct = opt === currentQuestion.correct;
    setFeedbackCorrect(correct);
    setShowFeedback(true);
  };

  const handleNext = () => {
    if (!currentQuestion) return;
    if (qIndex + 1 >= questions.length) {
      setFinished(true);
      onCompleteLesson(language, currentLesson);
    } else {
      setQIndex(qIndex + 1);
      setSelectedOption('');
      setShowFeedback(false);
      setFeedbackCorrect(false);
    }
  };

  const completedCount = lessons.filter(l => completedIds[l.id]).length;

  return (
    <>
      <Card>
        <Row cols={2}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 4 }}>
              {langInfo.name} path
            </h2>
            <Small>
              {completedCount} / {lessons.length} lessons completed
            </Small>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Tag>Pick a lesson to begin</Tag>
          </div>
        </Row>

        <LessonGrid style={{ marginTop: 14 }}>
          {lessons.map((lesson) => (
            <LessonTile
              key={lesson.id}
              type="button"
              completed={!!completedIds[lesson.id]}
              onClick={() => startLesson(lesson)}
            >
              <LessonNumber>Lesson {lesson.id}</LessonNumber>
              <LessonTitle>{lesson.title}</LessonTitle>
              <LessonStatus>
                {completedIds[lesson.id] ? '✓ Completed' : 'Start'}
              </LessonStatus>
            </LessonTile>
          ))}
        </LessonGrid>
      </Card>

      {currentLesson && (
        <Card>
          <Row cols={2}>
            <div>
              <h3 style={{ marginTop: 0, marginBottom: 4 }}>
                Lesson {currentLesson.id}: {currentLesson.title}
              </h3>
              <Small>
                Question {qIndex + 1} / {questions.length}
              </Small>
            </div>
            <div style={{ textAlign: 'right' }}>
              <SmallButton
                type="button"
                onClick={() => {
                  setCurrentLesson(null);
                  setQuestions([]);
                  setQIndex(0);
                  setSelectedOption('');
                  setShowFeedback(false);
                  setFinished(false);
                }}
              >
                Exit lesson
              </SmallButton>
            </div>
          </Row>

          {currentQuestion && (
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 10, fontWeight: 900 }}>
                {currentQuestion.isNativePrompt
                  ? `What is “${currentQuestion.prompt}” in ${langInfo.name}?`
                  : `What does “${currentQuestion.prompt}” mean?`}
              </div>

              {currentQuestion.options.map((opt) => {
                let state = null;
                if (showFeedback) {
                  if (opt === currentQuestion.correct) state = 'correct';
                  else if (opt === selectedOption) state = 'wrong';
                }
                return (
                  <OptionButton
                    key={opt}
                    type="button"
                    onClick={() => handleOptionClick(opt)}
                    state={state}
                  >
                    {opt}
                  </OptionButton>
                );
              })}

              <div style={{ marginTop: 10 }}>
                {showFeedback && (
                  <div
                    style={{
                      marginBottom: 8,
                      fontWeight: 800,
                      color: feedbackCorrect ? '#5ef2bf' : '#ffb3b3',
                    }}
                  >
                    {feedbackCorrect ? 'Nice! 🎉' : 'Not quite, keep going.'}
                  </div>
                )}
                {finished ? (
                  <Small>
                    Lesson complete! These words have been added to your
                    flashcard pile in the Study tab.
                  </Small>
                ) : (
                  <Small>
                    Tap an answer, then continue to the next question.
                  </Small>
                )}
              </div>

              {showFeedback && !finished && (
                <div style={{ marginTop: 12 }}>
                  <SmallButton type="button" onClick={handleNext}>
                    Next question →
                  </SmallButton>
                </div>
              )}
              {finished && (
                <div style={{ marginTop: 12 }}>
                  <SmallButton
                    type="button"
                    onClick={() => {
                      setCurrentLesson(null);
                      setQuestions([]);
                      setQIndex(0);
                      setSelectedOption('');
                      setShowFeedback(false);
                      setFinished(false);
                    }}
                  >
                    Back to lessons
                  </SmallButton>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

/* ============ Syllables & Basics (Japanese focus) ============ */

const SyllableGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 10px;
  margin-top: 10px;
`;

const SyllableTile = styled.div`
  border-radius: 12px;
  border: 1px solid rgba(140, 140, 210, 0.6);
  background: rgba(22, 26, 44, 0.95);
  padding: 10px;
  text-align: center;
`;

function SyllablesCard() {
  const [mode, setMode] = useState('hiragana');

  const data = JP_SYLLABLES[mode];

  return (
    <Card>
      <Row cols={2}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>
            Japanese syllables
          </h2>
          <Small>
            Practice reading the basic gojūon in hiragana and katakana.
          </Small>
        </div>
        <div style={{ textAlign: 'right' }}>
          <PillRow style={{ justifyContent: 'flex-end' }}>
            <Pill
              type="button"
              active={mode === 'hiragana'}
              onClick={() => setMode('hiragana')}
            >
              Hiragana
            </Pill>
            <Pill
              type="button"
              active={mode === 'katakana'}
              onClick={() => setMode('katakana')}
            >
              Katakana
            </Pill>
          </PillRow>
        </div>
      </Row>

      <SyllableGrid>
        {data.map((s) => (
          <SyllableTile key={s.kana}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>{s.kana}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{s.romaji}</div>
          </SyllableTile>
        ))}
      </SyllableGrid>
    </Card>
  );
}

function BasicsCard() {
  return (
    <Card>
      <h2 style={{ marginTop: 0, marginBottom: 4 }}>Japanese basics</h2>
      <Small>Start with counting and key words you&apos;ll see often.</Small>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Counting 1–5</div>
        {JP_COUNTING.map((w) => (
          <div
            key={w.target}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 8px',
              borderRadius: 10,
              border: '1px solid rgba(140,140,210,0.5)',
              background: 'rgba(22,26,44,0.95)',
              marginBottom: 4,
            }}
          >
            <span>{w.native}</span>
            <span style={{ fontWeight: 800 }}>{w.target}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ============ Flashcard Study ============ */

function FlashcardCard({ progress }) {
  const [lang, setLang] = useState('fr');
  const [currentWord, setCurrentWord] = useState(null);
  const [selected, setSelected] = useState('');
  const [feedback, setFeedback] = useState(null);

  const learnedByLang = useMemo(() => {
    const result = {};
    Object.keys(LESSONS).forEach((code) => {
      const langProgress = progress[code] || {};
      const completed = new Set(langProgress.completedLessons || []);
      const words = [];
      LESSONS[code].lessons.forEach((lesson) => {
        if (completed.has(lesson.id)) {
          words.push(...lesson.words);
        }
      });
      result[code] = words;
    });
    return result;
  }, [progress]);

  const allWords = learnedByLang[lang] || [];

  const hasWords = allWords.length >= 2;

  const newQuestion = () => {
    if (!hasWords) {
      setCurrentWord(null);
      return;
    }
    const correct = allWords[Math.floor(Math.random() * allWords.length)];
    const distractPool = allWords.filter(w => w !== correct);
    const distractors = shuffleArray(distractPool).slice(0, 3);

    const isNativePrompt = Math.random() < 0.5;
    const prompt = isNativePrompt ? correct.native : correct.target;

    const options = shuffleArray([
      correct,
      ...distractors,
    ]).map(w => ({
      label: isNativePrompt ? w.target : w.native,
      value: w === correct ? 'correct' : 'wrong',
    }));

    setCurrentWord({
      prompt,
      isNativePrompt,
      correct,
      options,
    });
    setSelected('');
    setFeedback(null);
  };

  useEffect(() => {
    // refresh question when language changes
    setCurrentWord(null);
    setSelected('');
    setFeedback(null);
    if (hasWords) {
      newQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, hasWords]);

  const handleOption = (opt) => {
    if (!currentWord) return;
    setSelected(opt.label);
    const isCorrect = opt.value === 'correct';
    setFeedback(isCorrect ? 'correct' : 'wrong');
  };

  return (
    <Card>
      <Row cols={2}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>Study flashcards</h2>
          <Small>
            Words you unlock from lessons show up here. Tap a language and
            practice with multiple choice.
          </Small>
        </div>
        <div style={{ textAlign: 'right' }}>
          <PillRow style={{ justifyContent: 'flex-end' }}>
            {Object.entries(LESSONS).map(([code, info]) => (
              <Pill
                key={code}
                type="button"
                active={lang === code}
                onClick={() => setLang(code)}
              >
                {info.name}
              </Pill>
            ))}
          </PillRow>
        </div>
      </Row>

      {!hasWords ? (
        <div style={{ marginTop: 14 }}>
          <Small>
            Complete a few lessons in {LESSONS[lang].name} to unlock flashcards
            for that language.
          </Small>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          {!currentWord ? (
            <SmallButton type="button" onClick={newQuestion}>
              Start practicing
            </SmallButton>
          ) : (
            <>
              <div style={{ marginBottom: 10, fontWeight: 900 }}>
                {currentWord.isNativePrompt
                  ? `What is “${currentWord.prompt}” in ${LESSONS[lang].name}?`
                  : `What does “${currentWord.prompt}” mean?`}
              </div>
              {currentWord.options.map((opt) => {
                let state = null;
                if (feedback && selected === opt.label) {
                  state = feedback === 'correct' ? 'correct' : 'wrong';
                }
                if (feedback === 'correct' && opt.value === 'correct') {
                  state = 'correct';
                }
                return (
                  <OptionButton
                    key={opt.label}
                    type="button"
                    state={state}
                    onClick={() => handleOption(opt)}
                  >
                    {opt.label}
                  </OptionButton>
                );
              })}
              <div style={{ marginTop: 10 }}>
                {feedback === 'correct' && (
                  <div
                    style={{
                      fontWeight: 800,
                      color: '#5ef2bf',
                      marginBottom: 8,
                    }}
                  >
                    Great! 🎉
                  </div>
                )}
                {feedback === 'wrong' && (
                  <div
                    style={{
                      fontWeight: 800,
                      color: '#ffb3b3',
                      marginBottom: 8,
                    }}
                  >
                    Not quite — try another one.
                  </div>
                )}
                <SmallButton type="button" onClick={newQuestion}>
                  Next card →
                </SmallButton>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/* ============ Page Component ============ */

export default function LingoLab() {
  const [tab, setTab] = useState('lessons'); // 'lessons' | 'syllables' | 'study'
  const [language, setLanguage] = useState('fr');
  const [progress, setProgress] = useState({});

  // load
  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  // save
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const handleCompleteLesson = (langCode, lesson) => {
    setProgress(prev => {
      const existing = prev[langCode] || {};
      const completedLessons = new Set(existing.completedLessons || []);
      completedLessons.add(lesson.id);
      const prevWords = existing.learnedWords || [];
      const newWords = [
        ...prevWords,
        ...lesson.words,
      ];
      return {
        ...prev,
        [langCode]: {
          completedLessons: Array.from(completedLessons),
          learnedWords: newWords,
        },
      };
    });
  };

  return (
    <Shell>
      <Sidebar>
        <SideTitle>LingoLab</SideTitle>
        <SideNav>
          <SideLink to="/ai">🏠 AI Home</SideLink>
          <SideLink to="/ai/lingolab">🌎 LingoLab</SideLink>
        </SideNav>
      </Sidebar>

      <Main>
        <H1>LingoLab</H1>
        <Sub>
          A gentle, Language lab for building real study streaks in
          French, Spanish, and Japanese.
        </Sub>

        <Tabs>
          <TabBtn
            type="button"
            active={tab === 'lessons'}
            onClick={() => setTab('lessons')}
          >
            Lesson path
          </TabBtn>
          <TabBtn
            type="button"
            active={tab === 'syllables'}
            onClick={() => setTab('syllables')}
          >
            Syllables & basics
          </TabBtn>
          <TabBtn
            type="button"
            active={tab === 'study'}
            onClick={() => setTab('study')}
          >
            Flashcard study
          </TabBtn>
        </Tabs>

        {tab === 'lessons' && (
          <>
            <Card>
              <Row cols={2}>
                <div>
                  <Small>
                    Pick a language, then tap a lesson tile to start a short,
                    four-option multiple choice session. Words you see will be
                    added to your flashcard pile.
                  </Small>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <PillRow style={{ justifyContent: 'flex-end' }}>
                    {Object.entries(LESSONS).map(([code, info]) => (
                      <Pill
                        key={code}
                        type="button"
                        active={language === code}
                        onClick={() => setLanguage(code)}
                      >
                        {info.name}
                      </Pill>
                    ))}
                  </PillRow>
                </div>
              </Row>
            </Card>
            <LessonsCard
              language={language}
              progress={progress}
              onCompleteLesson={handleCompleteLesson}
            />
          </>
        )}

        {tab === 'syllables' && (
          <>
            <SyllablesCard />
            <BasicsCard />
          </>
        )}

        {tab === 'study' && <FlashcardCard progress={progress} />}
      </Main>
    </Shell>
  );
}
