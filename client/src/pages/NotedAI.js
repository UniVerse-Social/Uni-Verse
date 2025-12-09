import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

/* ============ Layout (Dark Purple Theme) ============ */

const Shell = styled.div`
  position: fixed;
  top: var(--nav-height, 64px);
  right: 0;
  bottom: 0;
  left: 0;

  display: grid;
  grid-template-columns: 240px 1fr;
  background: #0b0f1a; /* deep navy-purple */
  color: #e8ecff;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }

  @media (max-width: 768px) {
    bottom: calc(var(--mobile-nav-height, 64px) + env(safe-area-inset-bottom));
  }
`;

const Sidebar = styled.aside`
  background: rgba(25, 30, 48, 0.85);
  border-right: 1px solid rgba(100,100,150,0.25);
  padding: 22px 16px;
  backdrop-filter: blur(6px);
`;

const SideTitle = styled.div`
  font-weight: 900;
  font-size: 22px;
  background: linear-gradient(90deg, #9ab6ff, #c8afff);
  -webkit-background-clip: text;
  color: transparent;
  margin-bottom: 18px;
`;

const SideNav = styled.nav`
  display: grid;
  gap: 10px;
`;

const SideLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  text-decoration: none;
  font-weight: 700;
  color: #d9e1ff;
  border-radius: 12px;
  transition: 0.15s ease;

  &:hover {
    background: rgba(140, 130, 255, 0.15);
    color: #fff;
  }
`;

const Main = styled.main`
  overflow-y: auto;
  padding: clamp(18px, 2.4vw, 32px);
`;

const H1 = styled.h1`
  margin: 0;
  font-weight: 900;
  font-size: clamp(30px, 4.5vw, 48px);
  background: linear-gradient(90deg, #8ea8ff, #a879ff, #59d0ff);
  -webkit-background-clip: text;
  color: transparent;
`;

const Sub = styled.p`
  margin: 6px 0 20px;
  color: #9af0ff;
  opacity: 0.75;
`;

/* ============ Cards (Dark Mode) ============ */

const Card = styled.section`
  background: rgba(20, 24, 40, 0.9);
  border: 1px solid rgba(120, 120, 170, 0.25);
  border-radius: 18px;
  padding: clamp(18px, 2vw, 26px);
  box-shadow: 0 18px 48px rgba(0,0,0,0.45);
  backdrop-filter: blur(6px);
  margin-bottom: 18px;
`;

const UploadZone = styled.label`
  display: grid;
  place-items: center;
  min-height: 190px;
  border: 2px dashed rgba(150,160,255,0.35);
  border-radius: 14px;
  cursor: pointer;
  transition: 0.15s ease;
  background: rgba(45, 55, 95, 0.35);
  color: #dbe5ff;

  &:hover {
    background: rgba(65, 75, 115, 0.5);
    border-color: #9bb3ff;
  }
`;

const InlineControls = styled.div`
  display: grid;
  grid-template-columns: repeat(2,1fr);
  gap: 16px;
  margin-top: 20px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.div`
  display: grid;
  gap: 10px;
`;

const Label = styled.label`
  font-weight: 800;
  color: #cfd8ff;
`;

const Select = styled.select`
  height: 40px;
  border: 1px solid rgba(150,150,200,0.3);
  border-radius: 10px;
  padding: 0 12px;
  font-weight: 700;
  background: rgba(25,28,45,0.8);
  color: #e8ecff;
`;

const Opts = styled.div`
  display: grid;
  gap: 12px;
`;

const Check = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  user-select: none;

  input {
    width: 18px;
    height: 18px;
    accent-color: #bba6ff;
  }

  span {
    font-weight: 700;
    color: #dbe3ff;
  }
`;

const Actions = styled.div`
  display: flex;
  justify-content: end;
  gap: 12px;
  margin-top: 12px;
`;

const Button = styled.button`
  height: 44px;
  padding: 0 20px;
  border: 0;
  border-radius: 10px;
  font-weight: 900;
  cursor: pointer;
  color: #fff;
  background: ${p => p.secondary
    ? 'rgba(145,170,200,0.45)'
    : 'linear-gradient(90deg, #6b7bff, #9c57ff)'};
  opacity: ${p => p.disabled ? 0.6 : 1};
  pointer-events: ${p => p.disabled ? 'none' : 'auto'};
  box-shadow: 0 12px 32px rgba(100,80,255,0.35);
`;

const Small = styled.small`
  color: #9bb5ff;
  opacity: 0.7;
`;

/* ============ Results ============ */

const Results = styled.section`
  margin-top: 24px;
  display: grid;
  gap: 18px;
`;

const ResultCard = styled(Card)`
  margin: 0;
`;

const ResultHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  margin-bottom: 12px;

  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 900;
    color: #dce4ff;
  }
`;

const ResultToolbar = styled.div`
  display: flex;
  gap: 10px;

  button {
    height: 34px;
    padding: 0 12px;
    color: #dce4ff;
    font-weight: 800;
    border-radius: 8px;
    background: rgba(40,45,70,0.85);
    border: 1px solid rgba(120,120,180,0.35);
    cursor: pointer;
    transition: 0.15s ease;

    &:hover {
      background: rgba(60,70,100,0.9);
    }
  }
`;

const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 900;
  border-radius: 999px;
  background: rgba(95,115,255,0.25);
  border: 1px solid rgba(145,165,255,0.4);
  color: #a9bcff;
`;

/* ============ Structured Notes UI ============ */

const SectionCard = styled.div`
  border-radius: 14px;
  border: 1px solid ${p => p.border || '#e6e6e6'};
  background: ${p => p.bg || '#fff'};
  padding: 12px 14px;
`;

const SectionHeader = styled.div`
  font-weight: 900;
  margin-bottom: 8px;
  display: flex;
  align-items: baseline;
  gap: 8px;

  span.kicker {
    font-size: 12px;
    font-weight: 900;
    opacity: .8;
  }
`;

const Bullet = styled.li`
  margin: 4px 0;
`;

/* ============ Utilities (client-side extract + generators) ============ */

const STOPWORDS = new Set(("a,about,above,after,again,against,all,am,an,and,any,are,as,at,be," +
"because,been,before,being,below,between,both,but,by,could,did,do,does,doing,down,during," +
"each,few,for,from,further,had,has,have,having,he,her,here,hers,him,himself,his,how,i,if," +
"in,into,is,it,its,itself,let,me,more,most,my,myself,no,nor,not,of,off,on,once,only,or,other," +
"our,ours,ourselves,out,over,own,same,she,should,so,some,such,than,that,the,their,theirs," +
"them,themselves,then,there,these,they,this,those,through,to,too,under,until,up,very,was," +
"we,were,what,when,where,which,while,who,whom,why,with,you,your,yours,yourself,yourselves").split(','));

function normalizeText(text) {
  return (text || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Sentence splitter */
function splitSentences(text) {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9(])/)
    .filter(Boolean);
}

/* TF-based keywords */
function topKeywords(text, k = 15) {
  const counts = new Map();
  const words = normalizeText(text).toLowerCase().match(/[a-z][a-z\-']+/g) || [];
  for (const w of words) {
    if (STOPWORDS.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0, k).map(([w])=>w);
}

/* Extract explicit question sentences */
function extractQuestions(text, max = 12) {
  const qs = splitSentences(text).filter(s => s.trim().endsWith('?'));
  const unique = [];
  for (const q of qs) {
    if (!unique.find(u => u.toLowerCase() === q.toLowerCase())) unique.push(q);
    if (unique.length >= max) break;
  }
  return unique;
}

/* Outline builder: returns color-coded sections */
function buildOutline(text, style = 'detailed') {
  const sents = splitSentences(text);
  const kws = topKeywords(text, 20);
  const questions = extractQuestions(text, 10);

  const take = (xs, n) => xs.slice(0, Math.max(0, n));

  const sizes = {
    detailed: { overview: 5, terms: 10, flows: 8, numbers: 6, checklist: 6 },
    concise:  { overview: 3, terms: 6,  flows: 5, numbers: 3, checklist: 4 },
    bullets:  { overview: 0, terms: 8,  flows: 6, numbers: 4, checklist: 6 },
  }[style] || { overview: 4, terms: 8, flows: 6, numbers: 4, checklist: 5 };

  // Key terms -> sentence that best explains it
  const termItems = [];
  for (const kw of kws) {
    const hit = sents.find(s => new RegExp(`\\b${kw}\\b`, 'i').test(s));
    if (hit && kw.length > 2) termItems.push({ term: kw, def: hit });
    if (termItems.length >= sizes.terms) break;
  }

  // Process/Flow sentences (protocols, actions, cause→effect)
  const flowCandidates = sents.filter(s =>
    /protocol|process|steps|forward|broadcast|reply|encapsulat|address|table|switch|frame|uses|consists|then|therefore|results|because/i.test(s)
  );
  const flowItems = take(flowCandidates, sizes.flows);

  // Numbered/metrics sentences
  const numItems = take(sents.filter(s => /\d/.test(s)), sizes.numbers);

  // Overview (first few good lines)
  const overviewItems = take(
    sents.filter(s => s.length > 30 && !/\?$/.test(s)),
    sizes.overview
  );

  // Checklist
  const checklist = [];
  if (termItems.length) checklist.push('Review the key term definitions.');
  if (flowItems.length) checklist.push('Practice the step-by-step processes.');
  if (numItems.length) checklist.push('Memorize common sizes/values (e.g., 48-bit MAC, MTU 1500).');
  if (questions.length) checklist.push('Attempt the embedded practice questions.');
  checklist.push('Summarize each section in your own words.');
  const checklistItems = take(checklist, sizes.checklist);

  const palette = [
    { bg: '#EAF2FF', border: '#C9DAFF', title: 'Overview' },
    { bg: '#EAFBF3', border: '#CBEFDD', title: 'Key Terms & Definitions' },
    { bg: '#FFF3E8', border: '#F8D9BF', title: 'How It Works (Processes)' },
    { bg: '#F3E8FF', border: '#E1C9FF', title: 'Important Numbers' },
    { bg: '#E8F9FF', border: '#C9F0FF', title: 'Questions from Slides' },
    { bg: '#FFF7D6', border: '#FFE9A8', title: 'Study Checklist' },
  ];

  return {
    palette,
    questions, // return for quiz enrichment
    sections: [
      overviewItems.length ? {
        key: 'overview', ...palette[0],
        items: overviewItems.map(text => ({ type: 'bullet', text }))
      } : null,
      termItems.length ? {
        key: 'terms', ...palette[1],
        items: termItems.map(({term, def}) => ({ type: 'kv', term, def }))
      } : null,
      flowItems.length ? {
        key: 'flows', ...palette[2],
        items: flowItems.map(text => ({ type: 'bullet', text }))
      } : null,
      numItems.length ? {
        key: 'numbers', ...palette[3],
        items: numItems.map(text => ({ type: 'bullet', text }))
      } : null,
      questions.length ? {
        key: 'qs', ...palette[4],
        items: questions.map(q => ({ type: 'q', q }))
      } : null,
      checklistItems.length ? {
        key: 'check', ...palette[5],
        items: checklistItems.map(text => ({ type: 'bullet', text }))
      } : null,
    ].filter(Boolean)
  };
}

/* Simple multi-choice quiz from keywords + append open-ended questions */
function generateQuiz(text, extraOpenQs = []) {
  const kws = topKeywords(text, 10);
  const sents = splitSentences(text);
  const items = [];

  for (let i=0; i<Math.min(5, kws.length); i++) {
    const term = kws[i];
    const context = sents.find(s => new RegExp(`\\b${term}\\b`, 'i').test(s)) || 'No context available.';
    const wrong = kws.filter(k => k!==term).slice(0, 8);
    const distractors = shuffle(wrong).slice(0, 3);
    const options = shuffle([term, ...distractors]);
    items.push({ type: 'mc', question: `Which term best fits: "${context}"`, options, answer: term });
  }

  // Append open-ended questions found in the notes/slides
  for (const q of extraOpenQs) {
    items.push({ type: 'open', question: q });
  }
  return items;
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

/* ===== File extractors (lazy loaded) ===== */

async function extractTextFromFile(file, onProgress = () => {}) {
  const ext = file.name.toLowerCase().split('.').pop();
  const buf = await file.arrayBuffer();

  if (ext === 'txt' || ext === 'md' || ext === 'csv') {
    return new TextDecoder().decode(buf);
  }

    if (ext === 'pdf') {
    try {
        onProgress('Loading PDF…');
        // Use legacy builds so CRA/Webpack can resolve the worker without special loaders
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
        const worker = await import('pdfjs-dist/legacy/build/pdf.worker');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default || worker;

        const loadingTask = pdfjs.getDocument({ data: buf });
        const pdf = await loadingTask.promise;
        let text = '';
        for (let p = 1; p <= pdf.numPages; p++) {
        onProgress(`Reading page ${p}/${pdf.numPages}`);
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        text += content.items.map(it => it.str).join(' ') + '\n';
        }
        return text;
    } catch (e) {
        console.warn('PDF extraction unavailable', e);
        return fallbackMessage('PDF', 'pdfjs-dist');
    }
    }

  if (ext === 'pptx') {
    try {
      onProgress('Reading slides…');
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buf);
      let text = '';
      const slideFiles = Object.keys(zip.files).filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort();
      for (let i=0; i<slideFiles.length; i++) {
        onProgress(`Slide ${i+1}/${slideFiles.length}`);
        const xml = await zip.files[slideFiles[i]].async('string');
        const matches = [...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map(m => m[1]);
        text += matches.join(' ') + '\n';
      }
      return text || 'No text found in slides.';
    } catch (e) {
      console.warn('PPTX extraction unavailable', e);
      return fallbackMessage('PowerPoint (PPTX)', 'jszip');
    }
  }

  if (ext === 'docx') {
    try {
      onProgress('Reading document…');
      const mammoth = await import('mammoth/mammoth.browser');
      const res = await mammoth.extractRawText({ arrayBuffer: buf });
      return res.value || 'No text found.';
    } catch (e) {
      console.warn('DOCX extraction unavailable', e);
      return fallbackMessage('Word (DOCX)', 'mammoth');
    }
  }

  if (['png','jpg','jpeg','webp','gif'].includes(ext)) {
    try {
      onProgress('Running OCR…');
      const Tesseract = (await import('tesseract.js')).default;
      const { data } = await Tesseract.recognize(new Blob([buf]));
      return data.text || 'No text found.';
    } catch (e) {
      console.warn('OCR unavailable', e);
      return fallbackMessage('image OCR', 'tesseract.js');
    }
  }

  return `Unsupported file type: .${ext}. Try PDF, PPTX, DOCX, TXT/MD, or an image.`;
}

function fallbackMessage(kind, pkg) {
  return `[${kind} text extraction not enabled on this build. Install "${pkg}" to enable this feature.]`;
}

/* ============ Component ============ */

export default function NotedAI() {
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [noteStyle, setNoteStyle] = useState('detailed');
  const [genFlashcards, setGenFlashcards] = useState(true);
  const [genQA, setGenQA] = useState(false);
  const [genQuiz, setGenQuiz] = useState(true);

  const [rawText, setRawText] = useState('');
  const [outline, setOutline] = useState(null); // structured notes
  const [flashcards, setFlashcards] = useState([]);
  const [qas, setQAs] = useState([]);
  const [quiz, setQuiz] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  const onPick = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }, []);

  const generate = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setProgress('Reading file…');
    try {
      const text = await extractTextFromFile(file, setProgress);
      setRawText(text);

      const built = buildOutline(text, noteStyle);
      setOutline(built);

      if (genFlashcards) setFlashcards(generateFlashcards(text));
      else setFlashcards([]);

      if (genQA) setQAs(generateQA(text));
      else setQAs([]);

      if (genQuiz) setQuiz(generateQuiz(text, built.questions));
      else setQuiz([]);
      // save
      const saved = JSON.parse(localStorage.getItem('noted_ai_notes') || '[]');
      const item = {
        id: `${Date.now()}`,
        name: file.name,
        ts: new Date().toISOString(),
        outline: built,
        flashcards: genFlashcards ? generateFlashcards(text) : [],
        qas: genQA ? generateQA(text) : [],
        quiz: genQuiz ? generateQuiz(text, built.questions) : [],
        raw: text
      };
      localStorage.setItem('noted_ai_notes', JSON.stringify([item, ...saved].slice(0, 50)));
    } finally {
      setBusy(false);
      setProgress('');
    }
  }, [file, noteStyle, genFlashcards, genQA, genQuiz]);

  const download = (filename, content) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const notesMd = useMemo(() => {
    if (!outline) return '';
    const md = [];
    md.push(`# Notes for ${file?.name || 'Untitled'}\n`);
    for (const sec of outline.sections) {
      md.push(`## ${sec.title}`);
      for (const it of sec.items) {
        if (it.type === 'kv') md.push(`- **${it.term}:** ${it.def}`);
        else if (it.type === 'q') md.push(`- ❓ ${it.q}`);
        else md.push(`- ${it.text}`);
      }
      md.push('');
    }
    if (flashcards.length) {
      md.push('## Flashcards');
      md.push(...flashcards.map((c,i)=>`**Q${i+1}. ${c.q}**\nA: ${c.a}\n`));
    }
    if (qas.length) {
      md.push('## Questions & Answers');
      md.push(...qas.map((c,i)=>`**Q${i+1}. ${c.q}**\nA: ${c.a}\n`));
    }
    if (quiz.length) {
      md.push('## Quiz');
      for (let i=0;i<quiz.length;i++) {
        const q = quiz[i];
        if (q.type === 'open') {
          md.push(`**Q${i+1}. ${q.question}**`);
          md.push('_Short answer_\n');
        } else {
          md.push(`**Q${i+1}. ${q.question}**`);
          md.push(...q.options.map((o,j)=>`  ${String.fromCharCode(65+j)}. ${o}`));
          md.push(`Answer: ${q.answer}\n`);
        }
      }
    }
    return md.join('\n');
  }, [outline, flashcards, qas, quiz, file]);

  return (
    <Shell>
      <Sidebar>
        <SideTitle>NoteLab</SideTitle>
        <SideNav>
          <SideLink to="/ai">🏠 Home</SideLink>
          <SideLink to="/ai/noted">📝 My Notes</SideLink>
          {/* Account removed */}
        </SideNav>
      </Sidebar>

      <Main>
        <H1>Create New Notes</H1>
        <Sub>Upload a document or screenshot to get started.</Sub>

        <Card>
          <div>
            <Label>1. Upload Your File</Label>
            <UploadZone
              onDragOver={(e)=>e.preventDefault()}
              onDrop={onDrop}
              htmlFor="file-input"
              aria-label="Upload area"
            >
              <div>
                <div style={{fontSize: 42, opacity:.6}}>☁️⬆️</div>
                <div>Drag ’n’ drop a file here, or click to select a file</div>
                <Small>PDF, PPTX, DOCX, TXT/MD, JPG/PNG/WEBP</Small>
                {file ? <div style={{marginTop:8, fontWeight:900}}><Tag>Selected</Tag> {file.name}</div> : null}
              </div>
            </UploadZone>
            <input
              id="file-input"
              ref={inputRef}
              type="file"
              style={{display:'none'}}
              accept=".pdf,.pptx,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif"
              onChange={onPick}
            />
          </div>

          <InlineControls>
            <Field>
              <Label>2. Customize Your Output</Label>
              <div style={{display:'grid', gap:10}}>
                <div>
                  <div style={{fontWeight:800, marginBottom:6}}>Note Style</div>
                  <Select value={noteStyle} onChange={e=>setNoteStyle(e.target.value)}>
                    <option value="detailed">Detailed</option>
                    <option value="concise">Concise</option>
                    <option value="bullets">Bullets</option>
                  </Select>
                </div>
                <Opts>
                  <Check><input type="checkbox" checked={genFlashcards} onChange={e=>setGenFlashcards(e.target.checked)} /><span>Generate Flashcards</span></Check>
                  <Check><input type="checkbox" checked={genQA} onChange={e=>setGenQA(e.target.checked)} /><span>Find & Answer Questions</span></Check>
                  <Check><input type="checkbox" checked={genQuiz} onChange={e=>setGenQuiz(e.target.checked)} /><span>Generate Quiz (includes detected questions)</span></Check>
                </Opts>
              </div>
            </Field>
            <Field>
              <Label>3. Actions</Label>
              <div>
                <Actions>
                  <Button secondary onClick={()=>{ setFile(null); setRawText(''); setOutline(null); setFlashcards([]); setQAs([]); setQuiz([]); }}>Clear</Button>
                  <Button onClick={generate} disabled={!file || busy}>{busy ? (progress || 'Working…') : 'Generate Notes'}</Button>
                </Actions>
                <Small>All features are free. Ads coming later for monetization.</Small>
              </div>
            </Field>
          </InlineControls>
        </Card>

        {outline ? (
          <Results>
            <ResultCard>
              <ResultHeader>
                <h3>Organized Notes</h3>
                <ResultToolbar>
                  <button onClick={()=>navigator.clipboard.writeText(notesMd)}>Copy Markdown</button>
                  <button onClick={()=>download(`${file?.name || 'notes'}.md`, notesMd)}>Download .md</button>
                </ResultToolbar>
              </ResultHeader>

              <div style={{display:'grid', gap:12}}>
                {outline.sections.map((sec, idx) => (
                  <SectionCard key={sec.key} bg={sec.bg} border={sec.border}>
                    <SectionHeader>
                      <span className="kicker">{String(idx+1).padStart(2,'0')}</span>
                      <div style={{fontWeight:900}}>{sec.title}</div>
                    </SectionHeader>
                    {sec.items.some(it => it.type === 'kv') ? (
                      <ul>
                        {sec.items.map((it,i) =>
                          it.type === 'kv'
                            ? <Bullet key={i}><strong>{it.term}:</strong> {it.def}</Bullet>
                            : it.type === 'q'
                              ? <Bullet key={i}>❓ {it.q}</Bullet>
                              : <Bullet key={i}>{it.text}</Bullet>
                        )}
                      </ul>
                    ) : (
                      <ul>
                        {sec.items.map((it,i) =>
                          it.type === 'q'
                            ? <Bullet key={i}>❓ {it.q}</Bullet>
                            : <Bullet key={i}>{it.text}</Bullet>
                        )}
                      </ul>
                    )}
                  </SectionCard>
                ))}
              </div>
            </ResultCard>

            {flashcards.length ? (
              <ResultCard>
                <ResultHeader>
                  <h3>Flashcards</h3>
                  <ResultToolbar>
                    <button onClick={()=>navigator.clipboard.writeText(flashcards.map((c,i)=>`Q${i+1}. ${c.q}\nA: ${c.a}`).join('\n\n'))}>Copy</button>
                    <button onClick={()=>download('flashcards.txt', flashcards.map((c,i)=>`Q${i+1}. ${c.q}\nA: ${c.a}`).join('\n\n'))}>Download</button>
                  </ResultToolbar>
                </ResultHeader>
                <div>
                  {flashcards.map((c,i)=>(
                    <div key={i} style={{marginBottom:10}}>
                      <strong>Q{i+1}. {c.q}</strong><br/>{c.a}
                    </div>
                  ))}
                </div>
              </ResultCard>
            ) : null}

            {qas.length ? (
              <ResultCard>
                <ResultHeader>
                  <h3>Questions & Answers</h3>
                  <ResultToolbar>
                    <button onClick={()=>navigator.clipboard.writeText(qas.map((c,i)=>`Q${i+1}. ${c.q}\nA: ${c.a}`).join('\n\n'))}>Copy</button>
                    <button onClick={()=>download('qa.txt', qas.map((c,i)=>`Q${i+1}. ${c.q}\nA: ${c.a}`).join('\n\n'))}>Download</button>
                  </ResultToolbar>
                </ResultHeader>
                <div>
                  {qas.map((c,i)=>(
                    <div key={i} style={{marginBottom:10}}>
                      <strong>Q{i+1}. {c.q}</strong><br/>{c.a}
                    </div>
                  ))}
                </div>
              </ResultCard>
            ) : null}

            {quiz.length ? (
              <ResultCard>
                <ResultHeader>
                  <h3>Practice Quiz</h3>
                  <ResultToolbar>
                    <button onClick={()=>{
                      const text = quiz.map((q,i)=>{
                        if (q.type === 'open') return `Q${i+1}. ${q.question}\n(Short answer)\n`;
                        return [
                          `Q${i+1}. ${q.question}`,
                          ...q.options.map((o,j)=>`  ${String.fromCharCode(65+j)}. ${o}`),
                          `Answer: ${q.answer}`
                        ].join('\n');
                      }).join('\n\n');
                      navigator.clipboard.writeText(text);
                    }}>Copy</button>
                    <button onClick={()=>{
                      const text = quiz.map((q,i)=>{
                        if (q.type === 'open') return `Q${i+1}. ${q.question}\n(Short answer)\n`;
                        return [
                          `Q${i+1}. ${q.question}`,
                          ...q.options.map((o,j)=>`  ${String.fromCharCode(65+j)}. ${o}`),
                          `Answer: ${q.answer}`
                        ].join('\n');
                      }).join('\n\n');
                      download('quiz.txt', text);
                    }}>Download</button>
                  </ResultToolbar>
                </ResultHeader>

                <div>
                  {quiz.map((q,i)=>(
                    <div key={i} style={{marginBottom:12}}>
                      <strong>Q{i+1}. {q.question}</strong>
                      {q.type === 'open' ? (
                        <div><Tag>Short answer</Tag></div>
                      ) : (
                        <>
                          <ul>
                            {q.options.map((o,j)=><li key={j}>{String.fromCharCode(65+j)}. {o}</li>)}
                          </ul>
                          <div><Tag>Answer</Tag> {q.answer}</div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </ResultCard>
            ) : null}

            {rawText && (
              <ResultCard>
                <ResultHeader>
                  <h3>Source Text</h3>
                  <ResultToolbar>
                    <button onClick={()=>navigator.clipboard.writeText(rawText)}>Copy</button>
                    <button onClick={()=>download('source.txt', rawText)}>Download</button>
                  </ResultToolbar>
                </ResultHeader>
                <div style={{maxHeight:300, overflow:'auto', whiteSpace:'pre-wrap', lineHeight:1.5}}>{rawText}</div>
              </ResultCard>
            )}
          </Results>
        ) : null}
      </Main>
    </Shell>
  );
}

/* ===== Legacy helpers kept for flashcards & QA generation ===== */

function generateFlashcards(text) {
  const sents = splitSentences(text);
  const kws = topKeywords(text, 10);
  const cards = [];
  for (const kw of kws) {
    const hit = sents.find(s => new RegExp(`\\b${kw}\\b`, 'i').test(s));
    if (hit) cards.push({ q: `What is ${kw}?`, a: hit });
  }
  return cards;
}

function generateQA(text) {
  const sents = splitSentences(text).slice(0, 12);
  return sents.map((s, i) => ({
    q: `Explain: ${s.replace(/[.?!]\s*$/, '')}?`,
    a: s
  }));
}
