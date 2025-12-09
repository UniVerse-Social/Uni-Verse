import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

/* ===================== Layout & Shared UI (Dark UniVerse Theme) ===================== */
const Shell = styled.div`
  position: fixed;
  top: var(--nav-height, 64px);
  right: 0;
  bottom: 0;
  left: 0;
  background: #0b0f1a;
  color: #e8ecff;
  display: grid;
  grid-template-columns: 240px 1fr;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Sidebar = styled.aside`
  border-right: 1px solid rgba(100, 100, 150, 0.25);
  padding: 20px 16px;
  background: rgba(25, 30, 48, 0.9);
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
  gap: 8px;
  justify-content: flex-start;
  text-decoration: none;
  color: #d9e1ff;
  padding: 10px 12px;
  border-radius: 10px;
  font-weight: 700;
  transition: 0.15s ease;

  &:hover {
    background: rgba(140, 130, 255, 0.2);
    color: #ffffff;
  }
`;

const Main = styled.main`
  overflow: auto;
  padding: clamp(18px, 2.4vw, 32px);
`;

const H1 = styled.h1`
  margin: 0 0 6px;
  font-weight: 900;
  font-size: clamp(30px, 4.6vw, 48px);
  background: linear-gradient(90deg, #8ea8ff, #a879ff, #59d0ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const Sub = styled.p`
  margin: 0 0 20px;
  color: #9af0ff;
  opacity: 0.8;
`;

const Tabs = styled.div`
  display: inline-flex;
  gap: 8px;
  background: rgba(24, 28, 48, 0.9);
  padding: 6px;
  border-radius: 12px;
  border: 1px solid rgba(110, 120, 190, 0.5);
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.div`
  display: grid;
  gap: 8px;
`;

const Label = styled.label`
  font-weight: 800;
  color: #cfd8ff;
`;

const Input = styled.input`
  height: 40px;
  border: 1px solid rgba(150, 150, 200, 0.4);
  border-radius: 10px;
  padding: 0 10px;
  font-weight: 600;
  background: rgba(25, 28, 45, 0.9);
  color: #e8ecff;
`;

const TextArea = styled.textarea`
  min-height: 110px;
  border: 1px solid rgba(150, 150, 200, 0.4);
  border-radius: 12px;
  padding: 10px;
  font-weight: 600;
  background: rgba(25, 28, 45, 0.9);
  color: #e8ecff;
`;

const Select = styled.select`
  height: 40px;
  border: 1px solid rgba(150, 150, 200, 0.4);
  border-radius: 10px;
  padding: 0 10px;
  font-weight: 700;
  background: rgba(25, 28, 45, 0.9);
  color: #e8ecff;
`;

const Button = styled.button`
  height: 44px;
  padding: 0 16px;
  border: 0;
  border-radius: 10px;
  font-weight: 900;
  cursor: pointer;
  color: #fff;
  background: ${p =>
    p.secondary
      ? 'rgba(145,170,200,0.45)'
      : 'linear-gradient(90deg, #6b7bff, #9c57ff)'};
  opacity: ${p => (p.disabled ? 0.6 : 1)};
  pointer-events: ${p => (p.disabled ? 'none' : 'auto')};
  box-shadow: 0 12px 32px rgba(100, 80, 255, 0.35);
`;

const ButtonGhost = styled.button`
  height: 40px;
  padding: 0 12px;
  border-radius: 10px;
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

const Small = styled.small`
  color: #9bb5ff;
  opacity: 0.8;
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

const UploadZone = styled.label`
  display: grid;
  place-items: center;
  min-height: 160px;
  border: 2px dashed rgba(150, 160, 255, 0.4);
  border-radius: 12px;
  cursor: pointer;
  color: #d1ddff;
  font-weight: 700;
  transition: background 0.15s ease, border-color 0.15s ease;
  background: rgba(45, 55, 95, 0.35);

  &:hover {
    background: rgba(65, 75, 115, 0.5);
    border-color: #9bb3ff;
  }
`;

const TemplateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 10px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const TemplateCard = styled.div`
  border: 1px solid rgba(150, 150, 200, 0.4);
  border-radius: 12px;
  padding: 10px;
  background: rgba(22, 26, 44, 0.98);
  display: grid;
  gap: 8px;
`;

const PreviewBox = styled.pre`
  white-space: pre-wrap;
  line-height: 1.4;
  border: 1px solid rgba(140, 140, 200, 0.5);
  border-radius: 12px;
  padding: 12px;
  max-height: 380px;
  overflow: auto;
  background: radial-gradient(circle at 0% 0%, rgba(140, 130, 255, 0.18), transparent 55%),
              radial-gradient(circle at 100% 100%, rgba(89, 208, 255, 0.18), transparent 55%),
              #14182a;
  color: #e8ecff;
`;

const Toolbar = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 12px;
`;

/* ===================== Utilities & Extractors (client) ===================== */
const STOPWORDS = new Set(("a,about,above,after,again,against,all,am,an,and,any,are,as,at,be," +
"because,been,before,being,below,between,both,but,by,could,did,do,does,doing,down,during," +
"each,few,for,from,further,had,has,have,having,he,her,here,hers,him,himself,his,how,i,if," +
"in,into,is,it,its,itself,let,me,more,most,my,myself,no,nor,not,of,off,on,once,only,or,other," +
"our,ours,ourselves,out,over,own,same,she,should,so,some,such,than,that,the,their,theirs," +
"them,themselves,then,there,these,they,this,those,through,to,too,under,until,up,very,was," +
"we,were,what,when,where,which,while,who,whom,why,with,you,your,yours,yourself,yourselves").split(','));

function normalizeText(text='') { return text.replace(/\u00A0/g, ' ').replace(/\s+/g,' ').trim(); }
function splitSentences(text='') { return normalizeText(text).split(/(?<=[.!?])\s+(?=[A-Z0-9(])/).filter(Boolean); }
function words(text='') { return (normalizeText(text).toLowerCase().match(/[a-z][a-z\-']+/g) || []); }
function topKeywords(text, k=20) {
  const map = new Map();
  for (const w of words(text)) { if (STOPWORDS.has(w)) continue; map.set(w, (map.get(w)||0)+1); }
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k).map(([w])=>w);
}

async function extractTextFromFile(file, onProgress = () => {}) {
  const ext = file.name.toLowerCase().split('.').pop();
  const buf = await file.arrayBuffer();

  if (["txt","md","csv"].includes(ext)) return new TextDecoder().decode(buf);

  if (ext === 'pdf') {
    try {
      onProgress('Loading PDF…');
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default || worker;
      const loadingTask = pdfjs.getDocument({ data: buf });
      const pdf = await loadingTask.promise; let text='';
      for (let p=1; p<=pdf.numPages; p++) {
        onProgress(`Reading page ${p}/${pdf.numPages}`);
        const page = await pdf.getPage(p); const content = await page.getTextContent();
        text += content.items.map(it=>it.str).join(' ') + '\n';
      }
      return text;
    } catch(e) { console.warn('PDF extraction unavailable', e); return fallbackMessage('PDF', 'pdfjs-dist'); }
  }

  if (ext === 'pptx') {
    try {
      onProgress('Reading slides…');
      const JSZip = (await import('jszip')).default; const zip = await JSZip.loadAsync(buf);
      let text=''; const slideFiles = Object.keys(zip.files).filter(k=>/^ppt\/slides\/slide\d+\.xml$/.test(k)).sort();
      for (let i=0; i<slideFiles.length; i++) {
        onProgress(`Slide ${i+1}/${slideFiles.length}`);
        const xml = await zip.files[slideFiles[i]].async('string');
        const matches = [...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map(m=>m[1]);
        text += matches.join(' ') + '\n';
      }
      return text || 'No text found in slides.';
    } catch(e) { console.warn('PPTX extraction unavailable', e); return fallbackMessage('PowerPoint (PPTX)', 'jszip'); }
  }

  if (ext === 'docx') {
    try {
      onProgress('Reading document…');
      const mammoth = await import('mammoth/mammoth.browser');
      const res = await mammoth.extractRawText({ arrayBuffer: buf });
      return res.value || 'No text found.';
    } catch(e) { console.warn('DOCX extraction unavailable', e); return fallbackMessage('Word (DOCX)', 'mammoth'); }
  }

  if (["png","jpg","jpeg","webp","gif"].includes(ext)) {
    try {
      onProgress('Running OCR…');
      const Tesseract = (await import('tesseract.js')).default;
      const { data } = await Tesseract.recognize(new Blob([buf]));
      return data.text || 'No text found.';
    } catch(e) { console.warn('OCR unavailable', e); return fallbackMessage('image OCR', 'tesseract.js'); }
  }

  return `Unsupported file type: .${ext}. Try PDF, PPTX, DOCX, TXT/MD, or an image.`;
}
function fallbackMessage(kind, pkg) { return `[${kind} text extraction not enabled on this build. Install "${pkg}" to enable this feature.]`; }

/* ===================== Templates & Compilers ===================== */
const DOC_TYPES = [
  {key:'resume', label:'Resume'},
  {key:'cover', label:'Cover Letter'},
];

const CATEGORIES = [
  {key:'stem', label:'STEM / Engineering'},
  {key:'business', label:'Business / Operations'},
  {key:'creative', label:'Creative / Marketing'},
  {key:'general', label:'General / Other'},
];

const RESUME_TEMPLATES = {
  clean: {
    name: 'Clean ATS',
    description: 'One-column, recruiter-friendly, strong section headers.',
    build: (p) => `
${p.name.toUpperCase()}\n${p.city} • ${p.phone} • ${p.email} ${p.links?`• ${p.links}`:''}
\nSUMMARY\n${p.summary}\n\nSKILLS\n${joinBullets(p.skills)}\n\nEXPERIENCE\n${p.exp1_title} — ${p.exp1_company} (${p.exp1_dates})\n${joinBullets(p.exp1_bullets)}\n\n${p.exp2_title?`${p.exp2_title} — ${p.exp2_company} (${p.exp2_dates})\n${joinBullets(p.exp2_bullets)}\n\n`:''}EDUCATION\n${p.edu_school} — ${p.edu_degree} (${p.edu_dates})\n`},
  modernSplit: {
    name: 'Modern Split',
    description: 'Compact contact block + skills column feel (text-based).',
    build: (p) => `
${p.name}\n${p.role || 'Candidate'}\n${p.email} | ${p.phone} | ${p.city}${p.links?` | ${p.links}`:''}\n\nCORE SKILLS\n${joinBullets(p.skills)}\n\nPROFESSIONAL EXPERIENCE\n• ${p.exp1_title}, ${p.exp1_company} — ${p.exp1_dates}\n${joinBullets(p.exp1_bullets)}\n${p.exp2_title?`• ${p.exp2_title}, ${p.exp2_company} — ${p.exp2_dates}\n${joinBullets(p.exp2_bullets)}\n`:''}\nEDUCATION\n${p.edu_degree}, ${p.edu_school} — ${p.edu_dates}\n\nADDITIONAL\n${p.additional || 'Projects, awards, languages (optional)'}\n`},
  compact: {
    name: 'Compact One-Page',
    description: 'Ultra concise bullets with quantified impact.',
    build: (p) => `
${p.name} — ${p.email} — ${p.phone} — ${p.city}${p.links?` — ${p.links}`:''}\n\nSUMMARY\n${p.summary}\n\nSKILLS: ${p.skills.join(', ')}\n\nEXPERIENCE\n${p.exp1_title} @ ${p.exp1_company}, ${p.exp1_dates}\n${joinBullets(p.exp1_bullets)}\n${p.exp2_title?`${p.exp2_title} @ ${p.exp2_company}, ${p.exp2_dates}\n${joinBullets(p.exp2_bullets)}\n`:''}\nEDUCATION: ${p.edu_degree}, ${p.edu_school} (${p.edu_dates})\n`},
};

const COVER_TEMPLATES = {
  classic: {
    name: 'Classic',
    description: 'Formal, to-the-point paragraphs.',
    build: (p) => `
${p.name}\n${p.city} • ${p.phone} • ${p.email}${p.links?` • ${p.links}`:''}\n\n${p.date}\n${p.company}\n${p.hiring} ${p.hiring ? 'Hiring Manager' : ''}\n\nDear ${p.hiring || 'Hiring Manager'},\n\nI am excited to apply for the ${p.role} role at ${p.company}. ${p.pitch}\n\nIn my most recent role as ${p.exp1_title} at ${p.exp1_company}, I ${oneLineBullets(p.exp1_bullets)}. These experiences align strongly with your needs for ${p.role}.\n\nThank you for your consideration. I look forward to the opportunity to discuss how I can contribute to ${p.company}.\n\nSincerely,\n${p.name}\n`},
  narrative: {
    name: 'Narrative',
    description: 'Story-led intro with a strong close.',
    build: (p) => `
${p.name} | ${p.email} | ${p.phone} | ${p.city}${p.links?` | ${p.links}`:''}\n\n${p.date}\n${p.company}\n\nDear ${p.hiring || 'Hiring Team'},\n\n${p.story}\n\nAt ${p.exp1_company}, I ${oneLineBullets(p.exp1_bullets)}. I would bring the same impact to ${p.company} as a ${p.role}.\n\nWarm regards,\n${p.name}\n`},
  concise: {
    name: 'Concise',
    description: 'Short paragraphs; scannable.',
    build: (p) => `
${p.name}\n${p.email} | ${p.phone} | ${p.city}${p.links?` | ${p.links}`:''}\n\n${p.date}\n${p.company}\n\nHello ${p.hiring || 'there'},\n\nRole: ${p.role}\nWhy me: ${p.pitch}\nRelevance: ${oneLineBullets(p.exp1_bullets)}\n\nBest,\n${p.name}\n`}
};

function joinBullets(xs=[]) { return xs.filter(Boolean).map(b=>`• ${b}`).join('\n'); }
function oneLineBullets(xs=[]) { return xs.filter(Boolean).slice(0,3).join('; '); }

/* Pre-fill helpers by category */
const defaultSkillsByCat = {
  stem: ['Python', 'Data Analysis', 'Algorithms', 'SQL', 'Git', 'Linux'],
  business: ['Excel', 'Analytics', 'Project Management', 'Stakeholder Communication', 'Tableau'],
  creative: ['Figma', 'Copywriting', 'Social Media', 'SEO', 'Adobe CC'],
  general: ['Time Management', 'Teamwork', 'Problem Solving', 'Leadership'],
};

/* ===================== Reviewer (Scoring) ===================== */
function scoreDocument(text, mode='resume', jobText='') {
  const sents = splitSentences(text);
  const w = words(text);
  const len = w.length;

  // Structure
  const hasSections = [/education/i,/experience|employment/i,/skills/i, mode==='cover'?/dear|sincerely/i:/summary|objective/i]
    .map(r=>r.test(text)).filter(Boolean).length;
  const structureScore = Math.min(25, hasSections * 6 + Math.min(5, Math.floor(len/200)));

  // Impact (numbers, % , action verbs)
  const actionVerbs = ['led','built','designed','created','launched','improved','increased','reduced','optimized','automated','delivered','developed','analyzed','implemented'];
  const actCount = w.filter(t=>actionVerbs.includes(t)).length;
  const numCount = (text.match(/[0-9%$]/g)||[]).length;
  const impactScore = Math.min(25, actCount*2 + Math.min(15, Math.floor(numCount/8)));

  // Keywords vs Job Description
  const jobKws = new Set(topKeywords(jobText, 25));
  const overlap = jobText ? words(text).filter(t=>jobKws.has(t)).length : 0;
  const keywordScore = Math.min(25, jobText ? Math.floor((overlap/Math.max(1, words(jobText).length))*400) : 12);

  // Clarity (short bullets/sents, passive voice heuristic)
  const avgLen = sents.length ? Math.round(w.length / sents.length) : 20;
  const passiveHits = (text.match(/\b(was|were|been|being|be|is|are)\s+(\w+ed)\b/gi)||[]).length;
  const clarityScore = Math.max(0, 25 - Math.max(0, avgLen-24) - Math.min(8, Math.floor(passiveHits/3)));

  let total = structureScore + impactScore + keywordScore + clarityScore;
  total = Math.max(0, Math.min(100, total));

  const ideas = [];
  if (hasSections < 3) ideas.push('Add/strengthen key sections: Summary, Skills, Experience, Education.');
  if (actCount < 6) ideas.push('Use stronger action verbs at the start of bullets (e.g., Led, Built, Launched).');
  if (numCount < 6) ideas.push('Quantify impact with numbers/%, time saved, revenue, users.');
  if (jobText && keywordScore < 20) ideas.push('Mirror keywords from the target job description (skills, tools, responsibilities).');
  if (avgLen > 26) ideas.push('Tighten long sentences; aim for concise, scannable bullets.');
  if (passiveHits > 4) ideas.push('Prefer active voice (“Built X”) over passive (“X was built”).');

  return {
    total, structureScore, impactScore, keywordScore, clarityScore,
    summary: `Length: ${len} words · Avg sentence length: ${avgLen} · Passive indicators: ${passiveHits}`,
    ideas
  };
}

/* ===================== Interview Prep ===================== */
function buildInterviewPlan(roleTitle='', jobDesc='', category='general') {
  const qs = [];
  const add = (q)=>qs.push({by:'bot', text:q});
  add(`Thanks for sharing the details. Let’s practice for “${roleTitle || 'the role'}”. I’ll start with a quick warm‑up.`);
  add('Give me a 60–90 second overview of your background and what you are targeting.');

  const jdKws = new Set(topKeywords(jobDesc, 20));
  const has = (k)=>Array.from(jdKws).some(w=>new RegExp(k,'i').test(w));

  // Category-specific technical probes
  if (category==='stem' || has('python|sql|ml|engineer|software|data')) {
    add('Tell me about a time you optimized performance. What was the baseline, what did you change, and the resulting metrics?');
    add('Walk me through a project where you used data structures/algorithms to improve efficiency.');
  }
  if (category==='business' || has('project|operations|sales|excel|stakeholder')) {
    add('Describe a project you led end‑to‑end. How did you scope, align stakeholders, and track success?');
    add('Share a time you used data to influence a decision. What was the impact?');
  }
  if (category==='creative' || has('marketing|content|design|figma|seo|brand')) {
    add('Walk me through a campaign or piece you shipped. What was the brief, your approach, and the outcome metrics?');
    add('How do you balance creativity with constraints like brand guidelines and timelines?');
  }

  // Core behavioral
  add('Tell me about a conflict or setback. Use the STAR method.');
  add('What’s a mistake you learned from? How did it change your approach?');
  add('Why this company and role? What unique strengths would you bring?');

  // Role‑specific from JD keywords
  const kwFocus = Array.from(jdKws).slice(0,5).join(', ');
  if (kwFocus) add(`I see the JD highlights: ${kwFocus}. Pick one and describe your strongest example.`);

  add('Great work! Any questions for me about the role or team?');
  return qs;
}

function speak(text, voiceOn) {
  if (!voiceOn || typeof window === 'undefined') return;
  try { const u = new SpeechSynthesisUtterance(text); window.speechSynthesis.speak(u); } catch {}
}

function useSpeechToText(enabled) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recRef = useRef(null);
  useEffect(()=>{
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) { setSupported(true); recRef.current = new SR(); recRef.current.continuous = true; recRef.current.interimResults = true; }
  },[]);

  useEffect(()=>{
    if (!supported || !enabled || !recRef.current) return;
    const rec = recRef.current;
    const onres = (e)=>{
      let final=''; let interim='';
      for (let i = 0; i < e.results.length; i++) {
      const res = e.results[i];
      const t = (res && res[0] && res[0].transcript) ? res[0].transcript : '';
      if (res.isFinal) {
        final += t;
      } else {
        interim += t;
      }
    }
      setTranscript(final || interim);
    };
    const onend = ()=> setListening(false);
    rec.onresult = onres; rec.onend = onend;
    return ()=>{ rec.onresult=null; rec.onend=null; };
  },[supported, enabled]);

  const start = ()=>{ if (supported && recRef.current) { setTranscript(''); recRef.current.start(); setListening(true);} };
  const stop = ()=>{ if (supported && recRef.current) { recRef.current.stop(); }};
  return { supported, listening, transcript, start, stop, setTranscript };
}

/* ===================== Main Component ===================== */
export default function Resumate() {
  const [tab, setTab] = useState('build'); // 'build' | 'review' | 'interview'

  return (
    <Shell>
      <Sidebar>
        <SideTitle>CareerLab</SideTitle>
        <SideNav>
          <SideLink to="/ai">🏠 Home</SideLink>
          <SideLink to="/ai/resumate">📄 Builder</SideLink>
          <SideLink to="#" onClick={(e)=>{e.preventDefault(); setTab('review');}}>✅ Review</SideLink>
          <SideLink to="#" onClick={(e)=>{e.preventDefault(); setTab('interview');}}>🎤 Interview Prep</SideLink>
        </SideNav>
      </Sidebar>

      <Main>
        <H1>CareerLab</H1>
        <Sub>Build ATS‑friendly resumes & cover letters, get instant feedback, and practice interviews with voice.</Sub>

        <Tabs role="tablist" aria-label="Resumate tabs">
          <TabBtn active={tab==='build'} onClick={()=>setTab('build')} role="tab" aria-selected={tab==='build'}>Builder</TabBtn>
          <TabBtn active={tab==='review'} onClick={()=>setTab('review')} role="tab" aria-selected={tab==='review'}>Upload & Review</TabBtn>
          <TabBtn active={tab==='interview'} onClick={()=>setTab('interview')} role="tab" aria-selected={tab==='interview'}>Interview Prep</TabBtn>
        </Tabs>

        {tab==='build' && <Builder />}
        {tab==='review' && <Reviewer />}
        {tab==='interview' && <InterviewPrep />}
      </Main>
    </Shell>
  );
}

/* ===================== Builder ===================== */
function Builder() {
  const [type, setType] = useState('resume');
  const [category, setCategory] = useState('stem');
  const [templateKey, setTemplateKey] = useState('clean');

  const defaults = useMemo(()=>({
    name: '', email: '', phone: '', city: '', links: '', role: '',
    summary: 'Student with hands‑on project experience seeking an opportunity to apply skills and grow.',
    skills: defaultSkillsByCat[category] || defaultSkillsByCat.general,
    exp1_title: 'Intern', exp1_company: 'Company', exp1_dates: '2024 – 2025',
    exp1_bullets: [ 'Built X using Y, improving Z by 30%', 'Collaborated with A, B to deliver C', 'Automated D to save 5 hours/week' ],
    exp2_title: '', exp2_company: '', exp2_dates: '', exp2_bullets: [],
    edu_school: 'Your University', edu_degree: 'B.S. Major', edu_dates: 'Expected 2026',
    additional: '',
    // cover‑letter
    date: new Date().toLocaleDateString(), company: 'Target Company', hiring: 'Hiring Manager', pitch: 'My skills and experiences align closely with your needs.', story: 'Since starting school, I have focused my projects on …',
  }),[category]);

  const [p, setP] = useState(defaults);
  useEffect(()=>{ setP(prev=>({ ...defaults, name: prev.name, email: prev.email, phone: prev.phone, city: prev.city, links: prev.links })); },[defaults]);

  const templateSet = type==='resume' ? RESUME_TEMPLATES : COVER_TEMPLATES;
  const templateKeys = Object.keys(templateSet).slice(0,3);

  const compiled = useMemo(()=>{
    const builder = templateSet[templateKey]?.build || ((x)=>'');
    return builder(p).trim();
  },[templateKey, templateSet, p]);

  const onSkillChange = (e)=> setP(s=>({ ...s, skills: e.target.value.split(',').map(x=>x.trim()).filter(Boolean) }));
  

  return (
    <>
      <Card>
        <Row>
          <Field>
            <Label>1. Document Type</Label>
            <Select value={type} onChange={e=>setType(e.target.value)}>
              {DOC_TYPES.map(d=> <option key={d.key} value={d.key}>{d.label}</option>)}
            </Select>
          </Field>
          <Field>
            <Label>2. Job Category</Label>
            <Select value={category} onChange={e=>setCategory(e.target.value)}>
              {CATEGORIES.map(c=> <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </Field>
        </Row>
      </Card>

      <Card>
        <Label>3. Choose a Template</Label>
        <TemplateGrid>
          {templateKeys.map(key => (
            <TemplateCard key={key}>
              <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}>
                <div style={{fontWeight:900}}>{templateSet[key].name}</div>
                {templateKey===key? <Tag>Selected</Tag>: null}
              </div>
              <Small>{templateSet[key].description}</Small>
              <ButtonGhost onClick={()=>setTemplateKey(key)}>Use Template</ButtonGhost>
            </TemplateCard>
          ))}
        </TemplateGrid>
      </Card>

      <Card>
        <Label>4. Your Details</Label>
        <Row>
          <Field><Label>Name</Label><Input value={p.name} onChange={e=>setP(s=>({...s,name:e.target.value}))} placeholder="Full name"/></Field>
          <Field><Label>Email</Label><Input value={p.email} onChange={e=>setP(s=>({...s,email:e.target.value}))} placeholder="name@email.com"/></Field>
        </Row>
        <Row>
          <Field><Label>Phone</Label><Input value={p.phone} onChange={e=>setP(s=>({...s,phone:e.target.value}))} placeholder="(555) 555-5555"/></Field>
          <Field><Label>City</Label><Input value={p.city} onChange={e=>setP(s=>({...s,city:e.target.value}))} placeholder="City, ST"/></Field>
        </Row>
        <Row>
          <Field><Label>Links (Portfolio/LinkedIn/GitHub)</Label><Input value={p.links} onChange={e=>setP(s=>({...s,links:e.target.value}))} placeholder="linkedin.com/in/you; github.com/you"/></Field>
          <Field><Label>Target Role (optional)</Label><Input value={p.role} onChange={e=>setP(s=>({...s,role:e.target.value}))} placeholder="Software Engineer Intern"/></Field>
        </Row>

        {type==='resume' ? (
          <>
            <Field><Label>Summary</Label><TextArea value={p.summary} onChange={e=>setP(s=>({...s,summary:e.target.value}))}/></Field>
            <Field><Label>Skills (comma‑separated)</Label><Input value={p.skills.join(', ')} onChange={onSkillChange}/></Field>
            <Row>
              <Field>
                <Label>Experience 1</Label>
                <Row>
                  <Field><Input value={p.exp1_title} onChange={e=>setP(s=>({...s,exp1_title:e.target.value}))} placeholder="Title"/></Field>
                  <Field><Input value={p.exp1_company} onChange={e=>setP(s=>({...s,exp1_company:e.target.value}))} placeholder="Company"/></Field>
                </Row>
                <Field><Input value={p.exp1_dates} onChange={e=>setP(s=>({...s,exp1_dates:e.target.value}))} placeholder="Dates"/></Field>
                <Field><TextArea value={p.exp1_bullets.join('\n')} onChange={e=>setP(s=>({...s,exp1_bullets:e.target.value.split('\n').filter(Boolean)}))} placeholder="• Use numbers (%, $, #)\n• Start bullets with strong verbs\n• Focus on results"/></Field>
              </Field>
              <Field>
                <Label>Experience 2 (optional)</Label>
                <Row>
                  <Field><Input value={p.exp2_title} onChange={e=>setP(s=>({...s,exp2_title:e.target.value}))} placeholder="Title"/></Field>
                  <Field><Input value={p.exp2_company} onChange={e=>setP(s=>({...s,exp2_company:e.target.value}))} placeholder="Company"/></Field>
                </Row>
                <Field><Input value={p.exp2_dates} onChange={e=>setP(s=>({...s,exp2_dates:e.target.value}))} placeholder="Dates"/></Field>
                <Field><TextArea value={p.exp2_bullets.join('\n')} onChange={e=>setP(s=>({...s,exp2_bullets:e.target.value.split('\n').filter(Boolean)}))} placeholder="Optional bullets"/></Field>
              </Field>
            </Row>
            <Row>
              <Field><Label>Education</Label><Input value={p.edu_school} onChange={e=>setP(s=>({...s,edu_school:e.target.value}))} placeholder="School"/></Field>
              <Field><Label>Degree & Dates</Label><Input value={p.edu_degree + (p.edu_dates?` • ${p.edu_dates}`:'')} onChange={e=>{
                const v = e.target.value; const [deg, ...rest] = v.split('•'); setP(s=>({...s,edu_degree:deg?.trim()||'', edu_dates:rest.join('•').trim()}));
              }} placeholder="B.S. Computer Science • 2022–2026"/></Field>
            </Row>
          </>
        ) : (
          <>
            <Row>
              <Field><Label>Date</Label><Input value={p.date} onChange={e=>setP(s=>({...s,date:e.target.value}))}/></Field>
              <Field><Label>Company</Label><Input value={p.company} onChange={e=>setP(s=>({...s,company:e.target.value}))}/></Field>
            </Row>
            <Row>
              <Field><Label>Hiring Manager (optional)</Label><Input value={p.hiring} onChange={e=>setP(s=>({...s,hiring:e.target.value}))}/></Field>
              <Field><Label>Role</Label><Input value={p.role} onChange={e=>setP(s=>({...s,role:e.target.value}))} placeholder="e.g., Marketing Intern"/></Field>
            </Row>
            <Field><Label>Pitch / Why You</Label><TextArea value={p.pitch} onChange={e=>setP(s=>({...s,pitch:e.target.value}))}/></Field>
            <Field><Label>Story or Highlights</Label><TextArea value={p.story} onChange={e=>setP(s=>({...s,story:e.target.value}))}/></Field>
            <Field><Label>Relevant Experience Bullets</Label><TextArea value={p.exp1_bullets.join('\n')} onChange={e=>setP(s=>({...s,exp1_bullets:e.target.value.split('\n').filter(Boolean)}))}/></Field>
          </>
        )}
      </Card>

      <Card>
        <Label>5. Preview & Export</Label>
        <PreviewBox aria-live="polite">{compiled}</PreviewBox>
        <Toolbar>
          <ButtonGhost onClick={()=>navigator.clipboard.writeText(compiled)}>Copy</ButtonGhost>
          <Button onClick={()=>{
            const ext = type==='resume' ? 'resume' : 'cover-letter';
            const name = `${p.name || 'document'}-${ext}.txt`.replace(/\s+/g,'-');
            const content = compiled + '\n';
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
          }}>Download .txt</Button>
          <Button secondary onClick={()=>{
            const md = '```\n' + compiled + '\n```\n';
            const name = `${p.name || 'document'}-${type}.md`.replace(/\s+/g,'-');
            const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
          }}>Download .md</Button>
        </Toolbar>
      </Card>
    </>
  );
}

/* ===================== Reviewer ===================== */
function Reviewer() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState('');
  const [mode, setMode] = useState('resume');
  const [jobText, setJobText] = useState('');
  const [report, setReport] = useState(null);

  const onDrop = useCallback((e)=>{ e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); },[]);
  const onPick = useCallback((e)=>{ const f = e.target.files?.[0]; if (f) setFile(f); },[]);

  const analyze = useCallback(async ()=>{
    if (!file) return; setBusy(true); setProgress('Reading file…');
    try {
      const text = await extractTextFromFile(file, setProgress); setRaw(text);
      const rep = scoreDocument(text, mode, jobText); setReport(rep);
    } finally { setBusy(false); setProgress(''); }
  },[file, mode, jobText]);

  return (
    <>
      <Card>
        <Row>
          <Field>
            <Label>Document Type</Label>
            <Select value={mode} onChange={e=>setMode(e.target.value)}>
              <option value="resume">Resume</option>
              <option value="cover">Cover Letter</option>
            </Select>
          </Field>
          <Field>
            <Label>Target Job Description (optional)</Label>
            <TextArea placeholder="Paste the job description to check keyword alignment" value={jobText} onChange={e=>setJobText(e.target.value)} />
          </Field>
        </Row>
      </Card>

      <Card>
        <Label>Upload Your {mode==='resume'?'Resume':'Cover Letter'}</Label>
        <UploadZone onDragOver={(e)=>e.preventDefault()} onDrop={onDrop} htmlFor="file-input" aria-label="Upload area">
          <div>
            <div style={{fontSize: 42, opacity:.6}}>☁️⬆️</div>
            <div>Drag ’n’ drop a file here, or click to select</div>
            <Small>PDF, DOCX, PPTX, TXT/MD, JPG/PNG/WEBP</Small>
            {file ? <div style={{marginTop:8, fontWeight:900}}><Tag>Selected</Tag> {file.name}</div> : null}
            {busy && <div style={{marginTop:8}}>{progress}</div>}
          </div>
        </UploadZone>
        <input id="file-input" ref={inputRef} type="file" style={{display:'none'}} accept=".pdf,.pptx,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif" onChange={onPick} />
        <div style={{display:'flex', gap:10, justifyContent:'end', marginTop:12}}>
          <Button secondary onClick={()=>{ setFile(null); setRaw(''); setReport(null); }}>Clear</Button>
          <Button onClick={analyze} disabled={!file || busy}>{busy? (progress || 'Working…') : 'Analyze'}</Button>
        </div>
      </Card>

      {report && (
        <Card>
          <div style={{display:'grid', gap:8}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div style={{fontWeight:900, fontSize:18}}>Score: {report.total}/100</div>
              <div>
                <Tag>Structure {report.structureScore}</Tag>{' '}
                <Tag>Impact {report.impactScore}</Tag>{' '}
                <Tag>Keywords {report.keywordScore}</Tag>{' '}
                <Tag>Clarity {report.clarityScore}</Tag>
              </div>
            </div>
            <Small>{report.summary}</Small>
            <div>
              <Label>Ideas for Improvement</Label>
              <ul>
                {report.ideas.map((x,i)=>(<li key={i}>{x}</li>))}
              </ul>
            </div>
            {raw && (
              <div>
                <Label>Extracted Text</Label>
                <PreviewBox style={{maxHeight:260}}>{raw}</PreviewBox>
                <Toolbar>
                  <ButtonGhost onClick={()=>navigator.clipboard.writeText(raw)}>Copy</ButtonGhost>
                  <Button secondary onClick={()=>{
                    const a = document.createElement('a');
                    const url = URL.createObjectURL(new Blob([raw], {type:'text/plain;charset=utf-8'}));
                    a.href=url; a.download=`extracted-${mode}.txt`; a.click(); URL.revokeObjectURL(url);
                  }}>Download Extract</Button>
                </Toolbar>
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  );
}

/* ===================== Interview Prep ===================== */
function InterviewPrep() {
  const [voiceOn, setVoiceOn] = useState(true);
  const [useMic, setUseMic] = useState(false);
  const {supported, listening, transcript, start, stop, setTranscript} = useSpeechToText(useMic);

  const [category, setCategory] = useState('stem');
  const [roleTitle, setRoleTitle] = useState('Software Engineer Intern');
  const [jobDesc, setJobDesc] = useState('Paste a job description here so I can tailor the interview.');

  const [chat, setChat] = useState([{by:'bot', text:'Welcome! Paste the job description, set your role title, and press Start Interview. I can speak my questions and you can type or use your mic.'}]);
  const [input, setInput] = useState('');
  const planRef = useRef([]);
  const idxRef = useRef(0);

  const push = (m)=> setChat(c=>[...c, m]);

  const startInterview = ()=>{
    planRef.current = buildInterviewPlan(roleTitle, jobDesc, category);
    idxRef.current = 0;
    push({by:'bot', text:'Okay, let’s begin. I will ask ~8–12 questions.'});
    askNext();
  };

  const askNext = ()=>{
    const q = planRef.current[idxRef.current++];
    if (!q) { push({by:'bot', text:'That’s a wrap! Great session. I can evaluate one of your answers for STAR structure if you paste it below.'}); speak('That’s a wrap! Great session.', voiceOn); return; }
    push(q); speak(q.text, voiceOn);
  };

  const quickFeedback = (answer)=>{
    const hasSTAR = /situation|task|action|result/i.test(answer);
    const hasMetrics = /[%$0-9]/.test(answer);
    const lengthOK = answer.split(/\s+/).length >= 60; // ~60+ words ~ 60–90 sec if spoken
    const tips = [];
    if (!hasSTAR) tips.push('Try structuring with STAR (Situation, Task, Action, Result).');
    if (!hasMetrics) tips.push('Quantify results (numbers, %, time saved).');
    if (!lengthOK) tips.push('Aim for 60–90 seconds with one clear example.');
    return tips.length ? `Feedback: ${tips.join(' ')}` : 'Nice! Clear and well‑structured.';
  };

  const onSend = (text)=>{
    const msg = text.trim(); if (!msg) return;
    push({by:'you', text: msg});
    setInput(''); setTranscript('');
    // lightweight feedback & next
    const fb = quickFeedback(msg);
    push({by:'bot', text: fb}); speak(fb, voiceOn);
    setTimeout(askNext, 300); // keep it snappy
  };

  useEffect(()=>{ if (transcript) setInput(transcript); }, [transcript]);

  const exportChat = ()=>{
    const text = chat.map(m=>`${m.by.toUpperCase()}: ${m.text}`).join('\n');
    const url = URL.createObjectURL(new Blob([text], {type:'text/plain;charset=utf-8'}));
    const a = document.createElement('a'); a.href=url; a.download='interview-transcript.txt'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card>
        <Row>
          <Field>
            <Label>Category</Label>
            <Select value={category} onChange={e=>setCategory(e.target.value)}>
              {CATEGORIES.map(c=> <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </Field>
          <Field>
            <Label>Role Title</Label>
            <Input value={roleTitle} onChange={e=>setRoleTitle(e.target.value)} />
          </Field>
        </Row>
        <Field>
          <Label>Job Description / Notes</Label>
          <TextArea value={jobDesc} onChange={e=>setJobDesc(e.target.value)} />
        </Field>
        <div style={{display:'flex', gap:10, justifyContent:'end'}}>
          <ButtonGhost onClick={()=>setVoiceOn(v=>!v)}>{voiceOn ? '🔊 Voice: On' : '🔇 Voice: Off'}</ButtonGhost>
          <Button secondary onClick={()=> setUseMic(m=>!m)} disabled={!supported}>{useMic? (listening? '🎙️ Listening…' : '🎙️ Mic Ready') : (supported? 'Enable Mic' : 'Mic Not Supported')}</Button>
          <Button onClick={startInterview}>Start Interview</Button>
        </div>
      </Card>

      <Card>
        <Label>Chat</Label>
          <div
            style={{
              border: '1px solid rgba(140,140,200,0.5)',
              borderRadius: 12,
              height: 360,
              overflow: 'auto',
              padding: 10,
              background:
                'radial-gradient(circle at 0% 0%, rgba(140,130,255,0.15), transparent 55%), ' +
                'radial-gradient(circle at 100% 100%, rgba(89,208,255,0.18), transparent 55%), ' +
                '#14182a'
            }}
            aria-live="polite"
          >
            {chat.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  justifyContent: m.by === 'you' ? 'end' : 'start',
                  margin: '8px 0'
                }}
              >
                <div
                  style={{
                    maxWidth: '92%',
                    background:
                      m.by === 'you'
                        ? 'rgba(120,140,255,0.28)'
                        : 'rgba(35,40,70,0.95)',
                    border: '1px solid rgba(140,140,200,0.6)',
                    borderRadius: 10,
                    padding: '8px 10px'
                  }}
                >
                <strong style={{opacity:.7}}>{m.by==='you'?'You':'Bot'}</strong><br/>
                <span>{m.text}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{display:'flex', gap:8, marginTop:10}}>
          <Input style={{flex:1}} placeholder={listening? 'Listening… speak now' : 'Type your answer…'} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); onSend(input);} }} />
          <ButtonGhost onClick={()=> onSend(input)}>Send</ButtonGhost>
          {useMic && !listening && <Button onClick={start}>Start Mic</Button>}
          {useMic && listening && <Button secondary onClick={stop}>Stop Mic</Button>}
          <Button secondary onClick={exportChat}>Export</Button>
        </div>
        <Small>Tip: Use STAR. Mention concrete metrics. Keep answers crisp.</Small>
      </Card>
    </>
  );
}
