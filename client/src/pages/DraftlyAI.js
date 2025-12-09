// client/src/pages/DraftlyAI.js
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

/* ============ Layout (UniVerse dark purple) ============ */

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
  border-right: 1px solid rgba(100, 100, 150, 0.25);
  padding: 22px 16px;
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
  overflow: auto;
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

/* ============ Shared Cards / Buttons / Inputs ============ */

const Card = styled.section`
  background: rgba(20, 24, 40, 0.96);
  border: 1px solid rgba(120, 120, 170, 0.3);
  border-radius: 18px;
  padding: clamp(18px, 2.2vw, 24px);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  margin-bottom: 18px;
  display: grid;
  gap: 14px;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
    align-items: flex-start;
    row-gap: 16px;
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
`;

const Button = styled.button`
  height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 10px;
  font-weight: 900;
  cursor: pointer;
  color: #ffffff;
  background: ${p =>
    p.secondary
      ? 'rgba(145,170,200,0.45)'
      : 'linear-gradient(90deg, #6b7bff, #9c57ff)'};
  opacity: ${p => (p.disabled ? 0.6 : 1)};
  pointer-events: ${p => (p.disabled ? 'none' : 'auto')};
  box-shadow: 0 12px 32px rgba(100, 80, 255, 0.35);
`;

const SmallBtn = styled.button`
  height: 36px;
  padding: 0 12px;
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

  &:disabled {
    opacity: 0.5;
    cursor: default;
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

const Select = styled.select`
  height: 40px;
  border-radius: 10px;
  padding: 0 12px;
  font-weight: 700;
  border: 1px solid rgba(150, 150, 200, 0.4);
  background: rgba(25, 28, 45, 0.9);
  color: #e8ecff;
`;

const Label = styled.label`
  font-weight: 800;
  color: #cfd8ff;
`;

/* ============ Draftly-Specific Visuals (dark) ============ */

const Meter = styled.div`
  font-weight: 900;
  font-size: 14px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: ${({ val }) =>
    val >= 90
      ? 'rgba(46,214,161,.18)'
      : val >= 75
      ? 'rgba(255,186,0,.20)'
      : 'rgba(220,53,69,.26)'};
  color: ${({ val }) =>
    val >= 90 ? '#5ef2bf' : val >= 75 ? '#ffd26a' : '#ff8b8b'};
`;

const Split = styled.section`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  min-height: 0;

  @media (max-width: 1040px) {
    grid-template-columns: 1fr;
  }
`;

const Pane = styled.section`
  position: relative;
  background: rgba(18, 22, 38, 0.98);
  border: 1px solid rgba(120, 120, 170, 0.35);
  border-radius: 16px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  padding: 12px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  overflow: hidden;
`;

const PaneHead = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 6px;

  .title {
    font-weight: 900;
    color: #dde6ff;
  }

  .right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const ReadArea = styled.div`
  min-height: 0;
  overflow: auto;
  padding: 10px;
  background: radial-gradient(circle at 0% 0%, rgba(140, 130, 255, 0.18), transparent 55%),
              radial-gradient(circle at 100% 100%, rgba(89, 208, 255, 0.18), transparent 55%),
              #14182a;
  border-radius: 12px;
  border: 1px solid rgba(140, 140, 210, 0.35);
  color: #e8ecff;

  p {
    margin: 0 0 12px;
  }

  sup a {
    color: #8cc5ff;
    text-decoration: none;
  }
`;

const Editor = styled.textarea`
  width: 100%;
  height: 100%;
  resize: none;
  border: 1px solid rgba(120, 120, 180, 0.4);
  outline: none;
  font: 16px/1.55 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  background: rgba(19, 22, 37, 0.96);
  border-radius: 12px;
  padding: 12px;
  color: #e8ecff;
`;

const Toolbar = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;

  ${SmallBtn} {
    background: rgba(39, 44, 74, 0.96);
  }
`;

/* Underlines */

const Changed = styled.span`
  text-decoration: underline 2px
    ${({ type }) => (type === 'insert' ? 'rgba(46,214,161,1)' : '#9fb4ff')};
  text-underline-offset: 3px;
  background: ${({ active }) =>
    active ? 'rgba(111, 130, 255, 0.22)' : 'transparent'};
  border-radius: 6px;
  cursor: pointer;
`;

/* Popovers / Floating UI */

const FloatCard = styled.div`
  position: fixed;
  z-index: 1000;
  min-width: 260px;
  max-width: min(92vw, 520px);
  background: rgba(19, 22, 37, 0.98);
  border: 1px solid rgba(140, 140, 200, 0.45);
  border-radius: 14px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.6);
  padding: 12px;
  color: #e8ecff;
`;

const FloatTitle = styled.div`
  font-weight: 900;
  margin-bottom: 6px;
`;

const FloatNote = styled.div`
  font-size: 13px;
  opacity: 0.85;
  margin-bottom: 8px;
`;

const MenuRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
`;

const GhostButton = styled.button`
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(35, 40, 70, 0.96);
  border: 1px solid rgba(140, 140, 200, 0.5);
  cursor: pointer;
  font-weight: 800;
  color: #e8ecff;
  transition: 0.15s ease;

  &:hover {
    background: rgba(55, 65, 100, 0.98);
  }
`;

const SelectBubble = styled.div`
  position: fixed;
  z-index: 1000;
  background: #0e3aa2;
  color: #fff;
  border-radius: 999px;
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  box-shadow: 0 14px 36px rgba(14, 58, 162, 0.5);

  ${GhostButton} {
    background: #ffffff;
    color: #0e3aa2;
    border-color: #ffffff;
  }
`;

/* ===================== Engine Data ===================== */

const HEDGES = [
  'very','really','basically','generally','sort of','kind of','quite','somewhat',
  'perhaps','maybe','a bit','a little','rather'
];
const WEASELS = ['clearly','obviously','evidently','apparently'];
const FILLERS = [
  ['in order to','to'],
  ['due to the fact that','because'],
  ['at this point in time','now'],
  ['for the purpose of','for'],
  ['in the event that','if'],
  ['it is important to note that',''],
  ['the fact that',''],
  ['is able to','can'],
];

const STRONGER = [
  ['use','utilize'], ['shows','demonstrates'], ['make','create'],
  ['fix','resolve'], ['help','facilitate'], ['good','effective'],
  ['bad','suboptimal'], ['big','significant'], ['small','minor'],
  ['get','obtain'], ['do','perform'],
];

const FORMAL_UP = [
  ['a lot','substantially'], ['but','however'],
  ['try','attempt'], ['start','initiate'], ['end','conclude'],
];

const SCI_UP = [
  ['think','hypothesize'], ['prove','validate'], ['guess','estimate'],
  ['look at','analyze'], ['talk about','discuss'], ['use','employ'],
  ['things','phenomena'], ['stuff','materials']
];

const CASUALIZE = [
  ['do not','don’t'], ['is not','isn’t'], ['cannot','can’t'],
  ['we will','we’ll'], ['they are','they’re'], ['it is','it’s'],
];

const PUNCT_FIXES = [
  [/ +([,.!?;:])/g, '$1'],
  [/([,.!?;:])(?!\s|$)/g, '$1 '],
  [/ {2,}/g, ' '],
  [/\s+\n/g, '\n'],
];

/* ===================== Helpers ===================== */

function preserveCase(out, orig){
  if(!orig) return out;
  if(orig === orig.toUpperCase()) return out.toUpperCase();
  if(orig[0] === orig[0].toUpperCase()) return out[0].toUpperCase()+out.slice(1);
  return out;
}

/* ---------- Analysis & Goal-Seeking Score ---------- */

function analyzeIssues(text, style){
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordsPerSent = sentences.length ? words.length / sentences.length : words.length;

  const countFromList = (list) =>
    list.reduce((sum, item) => {
      const phrase = Array.isArray(item) ? item[0] : item;
      const re = new RegExp(`\\b${phrase}\\b`, 'gi');
      const hits = (text.match(re)||[]).length;
      return sum + hits;
    }, 0);

  const hedges = countFromList(HEDGES) + countFromList(WEASELS);
  const fillers = FILLERS.reduce((sum,[from]) => sum + ((text.match(new RegExp(`\\b${from}\\b`,'gi'))||[]).length),0);
  const passive = (text.match(/\b(be|am|is|are|was|were|been|being)\b\s+\w+ed\s+by\b/gi)||[]).length;
  const veryLong = sentences.filter(s => s.split(/\s+/).length > 42).length;
  const longAvg = Math.max(0, Math.round(wordsPerSent - 30)); // leniency

  const connectors = (text.match(/\b(however|therefore|thus|consequently|moreover|in practice|as a result|in turn)\b/gi)||[]).length;
  const citations = (text.match(/\[[0-9]+\]/g)||[]).length;

  const issues = [
    { key:'hedges', label:'Hedges', count: hedges, penalty: hedges*1.2, desc:'Remove hedging words (very, really, maybe, etc.)' },
    { key:'fillers', label:'Fillers', count: fillers, penalty: fillers*1.1, desc:'Tighten filler phrases (in order to → to, etc.)' },
    { key:'passive', label:'Passive voice', count: passive, penalty: passive * (style==='scientific'?0.6:1.0), desc:'Prefer active voice when clearer.' },
    { key:'verylong', label:'Very long sentences', count: veryLong, penalty: veryLong*2.0, desc:'Split sentences over ~42 words.' },
    { key:'avglen', label:'Long average length', count: longAvg, penalty: longAvg*0.8, desc:'Shorten average sentence length.' },
  ];

  const reward = Math.min(8, connectors*1.2) + Math.min(8, citations*2);
  return { issues, reward };
}

function goalSeekingScore(text, style, ignoredSet){
  const { issues, reward } = analyzeIssues(text, style);
  const penalty = issues
    .filter(i => !ignoredSet.has(i.key))
    .reduce((s, i) => s + i.penalty, 0);

  const score = Math.round(Math.max(1, Math.min(100, 100 - penalty + reward)));
  return { score, issues };
}

/* ---------- Sentence utils ---------- */

function splitSentences(text) {
  return text.replace(/\r/g,'')
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .filter(Boolean);
}

function mergeShortSentences(sents) {
  const out=[];
  for(let i=0;i<sents.length;i++){
    const s=sents[i].trim();
    const next=sents[i+1]?.trim();
    if(s.split(/\s+/).length < 7 && next && next.split(/\s+/).length < 10){
      out.push(`${s.replace(/[.!?]$/,'')}; ${next}`);
      i++;
    } else out.push(s);
  }
  return out;
}

function splitLong(sentence) {
  const MAX = 40;
  let s = sentence;
  const out=[];
  while (s.split(/\s+/).length > MAX) {
    const mid = Math.floor(s.length/2);
    const commas = [...s.matchAll(/,/g)].map(m=>m.index);
    let cut = -1, best = Infinity;
    for (const idx of commas) { const d=Math.abs(idx-mid); if(d<best){best=d;cut=idx;} }
    if (cut !== -1) { out.push(s.slice(0,cut+1).trim()); s = s.slice(cut+1).trim(); }
    else {
      const words = s.split(/\s+/);
      const wmid = Math.floor(words.length/2);
      out.push(words.slice(0, wmid).join(' ') + '.');
      s = words.slice(wmid).join(' ');
    }
  }
  out.push(s);
  return out;
}

function passiveToActive(sentence){
  const m = sentence.match(/^\s*(.*?)\s+(?:was|were|is|are|been|being)\s+(\w+ed)\s+by\s+(.*?)([.!?])?$/i);
  if(!m) return sentence;
  const [, obj, verb, subj, end] = m;
  if (obj.split(' ').length > 15) return sentence;
  return `${subj.trim()} ${verb} ${obj.trim()}${end||'.'}`;
}

/* ---------- Tokenization / Diff ---------- */

function keywordsFor(text){
  const words = (text.toLowerCase().match(/[a-z]{5,}/g)||[]).slice(0,60);
  const counts = {};
  words.forEach(w => counts[w]=(counts[w]||0)+1);
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k).join(' ');
}

function tokenize(text){
  return text.split(/(\s+|[.,!?;:()[\]—–-])/).filter(t=>t!=='');
}
function LCS(a,b){
  const n=a.length, m=b.length;
  const dp = Array(n+1).fill(0).map(()=>Array(m+1).fill(0));
  for(let i=n-1;i>=0;i--){
    for(let j=m-1;j>=0;j--){
      dp[i][j] = a[i]===b[j] ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j], dp[i][j+1]);
    }
  }
  const seq=[];
  let i=0, j=0;
  while(i<n && j<m){
    if(a[i]===b[j]) { seq.push({i,j}); i++; j++; }
    else if(dp[i+1][j] >= dp[i][j+1]) i++;
    else j++;
  }
  return seq;
}
function reasonForChange(before, after){
  if(!before) return 'Added for clarity/flow.';
  if(before.toLowerCase()===after.toLowerCase()) return 'Adjusted casing/punctuation.';
  if(STRONGER.some(([w,strong])=> w===before.toLowerCase() && strong===after.toLowerCase())) return 'Strengthened wording.';
  if(FORMAL_UP.some(([w,to])=> w===before.toLowerCase() && to===after.toLowerCase())) return 'More professional tone.';
  if(SCI_UP.some(([w,to])=> w===before.toLowerCase() && to===after.toLowerCase())) return 'More scientific/precise term.';
  if(CASUALIZE.some(([w,to])=> w===before.toLowerCase() && to===after.toLowerCase())) return 'Relaxed tone.';
  return 'Improved concision or clarity.';
}
function buildDiff(original, improved) {
  const aParas = original.split(/\n{2,}/);
  const bParas = improved.split(/\n{2,}/);
  const len = Math.max(aParas.length, bParas.length);
  const tokens = []; const changes = [];

  for(let p=0;p<len;p++){
    const aTok = tokenize(aParas[p]||'');
    const bTok = tokenize(bParas[p]||'');

    const lcs = LCS(aTok, bTok);
    const inA = new Set(lcs.map(x=>x.i));
    const inB = new Set(lcs.map(x=>x.j));

    let j=0;
    for(let i=0;i<bTok.length;i++){
      const token = bTok[i];
      if(!inB.has(i)){
        while(j<aTok.length && inA.has(j)) j++;
        let type='insert', before='';
        if(j<aTok.length && !inA.has(j)) { type='replace'; before=aTok[j]; j++; }
        const id = `${type}-${p}-${i}-${Math.random().toString(36).slice(2,7)}`;
        const change = { id, type, before, after: token, reason: reasonForChange(before, token) };
        changes.push(change);
        tokens.push({ t: token, changeId:id, change });
      } else {
        tokens.push({ t: token });
        while(j<aTok.length && inA.has(j)) j++;
      }
    }
    if (p < len-1) tokens.push({ t: '\n\n' });
  }
  return { tokens, changes };
}

/* ===================== Rewrite Pipeline ===================== */

function normalize(text){
  let t = text;
  for (const [find, rep] of FILLERS) {
    const re = new RegExp(`\\b${find}\\b`, 'gi');
    t = t.replace(re, (m)=>preserveCase(rep, m));
  }
  for (const h of HEDGES) t = t.replace(new RegExp(`\\b${h}\\b`, 'gi'),'');
  for (const [re, rep] of PUNCT_FIXES) t = t.replace(re, rep);
  return t.replace(/ {2,}/g,' ').trim();
}
function applyStyle(text, style){
  let t = text;
  const applyPairs = (pairs) => {
    for(const [from,to] of pairs) {
      const re = new RegExp(`\\b${from}\\b`, 'gi');
      t = t.replace(re, (m)=> preserveCase(to, m));
    }
  };
  if(style==='professional') applyPairs(FORMAL_UP);
  if(style==='scientific') applyPairs(SCI_UP.concat(FORMAL_UP));
  if(style==='casual') applyPairs(CASUALIZE);
  applyPairs(STRONGER);
  return t;
}
function restructure(text){
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const improved = paras.map(p => {
    let sents = splitSentences(p).map(s => {
      const s2 = passiveToActive(s.trim());
      return s2.replace(/^\s*There (is|are) ([^.!?]+)([.!?])?/i, (_, __, rest, end) => `${rest}${end||'.'}`);
    });
    sents = sents.flatMap(splitLong);
    sents = mergeShortSentences(sents);
    return sents.join(' ');
  });
  return improved.join('\n\n');
}
function rewrite(text, style) {
  let working = text;
  working = normalize(working);
  working = applyStyle(working, style);
  working = restructure(working);
  working = normalize(working);
  return working;
}

/* ===================== Component ===================== */

export default function DraftlyAI(){
  const [style, setStyle] = useState('professional');
  const [input, setInput] = useState('');
  const [inputScore, setInputScore] = useState(0);

  const [result, setResult] = useState({ text:'', score:0, tokens:[], changes:[], issues:[] });
  const [hoverCard, setHoverCard] = useState(null);
  const [activeChangeId, setActiveChangeId] = useState(null);
  const [clickCard, setClickCard] = useState(null);
  const [selectionBubble, setSelectionBubble] = useState(null);
  const [citations, setCitations] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [ignoredRules, setIgnoredRules] = useState(new Set());
  const [ignoredChangeIds, setIgnoredChangeIds] = useState(new Set());

  useEffect(()=>{
    const { score } = goalSeekingScore(input, style, new Set());
    setInputScore(score);
  }, [input, style]);

  const start = () => {
    if(!input.trim()) return;
    const improved = rewrite(input, style);
    const { tokens, changes } = buildDiff(input, improved);
    const { score, issues } = goalSeekingScore(improved, style, ignoredRules);
    setResult({ text: improved, score, tokens, changes, issues });
    setCitations([]);
  };

  const recalc = (text, tokens=undefined) => {
    const { score, issues } = goalSeekingScore(text, style, ignoredRules);
    setResult(prev => ({
      ...prev,
      text,
      score,
      issues,
      tokens: tokens ?? prev.tokens,
    }));
  };

  const onHover = (change, id, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverCard({
      x: rect.left + rect.width/2,
      y: rect.top - 10,
      title: change.type==='replace'
        ? `Changed “${change.before}” → “${change.after}”`
        : `Inserted “${change.after}”`,
      note: change.reason
    });
    setActiveChangeId(id);
  };
  const clearHover = () => { setHoverCard(null); setActiveChangeId(null); };
  const onClick = (change, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setClickCard({ x: rect.left + rect.width/2, y: rect.bottom + 8, change });
  };

  const rebuildFromTokens = (tokens) => {
    const txt = tokens.map(t=>t.t).join('');
    recalc(txt, tokens);
  };
  const applyEditToToken = (change, newText) => {
    const tokens = result.tokens.map(t=>{
      if(t.changeId === change.id){
        if(newText==='__REMOVE__') return { t:'' };
        const updatedChange = { ...t.change, after:newText };
        return { ...t, t:newText, change: updatedChange };
      }
      return t;
    });
    rebuildFromTokens(tokens);
  };

  const revertChange = (change) => {
    if(change.type==='insert'){
      applyEditToToken(change, '__REMOVE__');
    } else {
      applyEditToToken(change, change.before);
    }
  };
  const rephraseChange = (change) => {
    const alt = applyStyle(change.after, style);
    applyEditToToken(change, alt);
  };
  const editChange = (change) => {
    const to = window.prompt('Edit replacement text:', change.after);
    if(to && to !== change.after) applyEditToToken(change, to);
  };
  const ignoreChange = (change) => {
    setIgnoredChangeIds(new Set([...ignoredChangeIds, change.id]));
    const tokens = result.tokens.map(t => t.changeId === change.id ? { t: t.t } : t);
    rebuildFromTokens(tokens);
  };

  /* Selection actions */
  const handleMouseUp = () => {
    const sel = window.getSelection();
    if(!sel || sel.isCollapsed) { setSelectionBubble(null); return; }
    const text = sel.toString();
    if(!text.trim()) { setSelectionBubble(null); return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelectionBubble({ x: rect.left + rect.width/2, y: rect.top - 8, text });
  };

  const actStronger = () => {
    const t = selectionBubble?.text || '';
    const updated = result.text.replace(t, applyStyle(t, style));
    recalc(updated);
    setSelectionBubble(null);
  };
  const actRephrase = () => {
    const t = selectionBubble?.text || '';
    const updated = result.text.replace(t, applyStyle(t, style));
    recalc(updated);
    setSelectionBubble(null);
  };
  const actAddSource = () => {
    const t = selectionBubble?.text || '';
    const kw = keywordsFor(t);
    const url = `https://scholar.google.com/scholar?q=${encodeURIComponent(kw)}`;
    const id = citations.length + 1;
    const token = ` [${id}]`;
    const updated = result.text.replace(t, `${t}${token}`);
    recalc(updated);
    setCitations([...citations, { id, label: kw, url }]);
    setSelectionBubble(null);
  };

  /* Suggestions */
  const fixers = {
    hedges: (txt)=> normalize(txt),
    fillers: (txt)=> normalize(txt),
    passive: (txt)=> splitSentences(txt).map(s=>passiveToActive(s)).join(' '),
    verylong: (txt)=> splitSentences(txt).flatMap(splitLong).join(' '),
    avglen: (txt)=> splitSentences(txt).flatMap(splitLong).join(' '),
  };
  const applySuggestion = (key) => {
    const fn = fixers[key];
    if(!fn) return;
    const updated = normalize(applyStyle(fn(result.text), style));
    recalc(updated);
  };
  const fixAllSuggestions = () => {
    let updated = result.text;
    ['hedges','fillers','passive','verylong','avglen'].forEach(k=>{
      const fn = fixers[k];
      if(fn && !ignoredRules.has(k)) updated = fn(updated);
    });
    updated = normalize(applyStyle(updated, style));
    recalc(updated);
  };
  const toggleIgnoreRule = (key) => {
    const next = new Set(ignoredRules);
    if(next.has(key)) next.delete(key); else next.add(key);
    setIgnoredRules(next);
    const { score, issues } = goalSeekingScore(result.text, style, next);
    setResult(prev => ({ ...prev, score, issues }));
  };
  const clearIgnores = () => {
    const next = new Set();
    setIgnoredRules(next);
    const { score, issues } = goalSeekingScore(result.text, style, next);
    setResult(prev => ({ ...prev, score, issues }));
  };

  /* Render tokens */
  const rendered = useMemo(()=>{
    return result.tokens.map((tk, idx)=>{
      if(tk.changeId && !ignoredChangeIds.has(tk.changeId)){
        return (
          <Changed
            key={idx}
            type={tk.change.type}
            active={activeChangeId===tk.changeId}
            onMouseEnter={(e)=>onHover(tk.change, tk.changeId, e)}
            onMouseLeave={clearHover}
            onClick={(e)=>onClick(tk.change, e)}
          >
            {tk.t}
          </Changed>
        );
      }
      return <span key={idx}>{tk.t}</span>;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.tokens, activeChangeId, ignoredChangeIds]);

  /* Export helpers */
  const copyImproved = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
      alert('Improved essay copied to clipboard!');
    } catch(e) {
      alert('Copy failed. Select and copy manually.');
    }
  };
  const downloadImproved = () => {
    const blob = new Blob([result.text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'draftly_improved_essay.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  /* Left-pane actions */
  const polishAgain = () => {
    const updated = rewrite(result.text, style);
    const tokens = tokenize(updated).map(t=>({t}));
    const { score, issues } = goalSeekingScore(updated, style, ignoredRules);
    setResult(prev => ({ ...prev, text: updated, tokens, changes: [], score, issues }));
  };
  const acceptAll = () => {
    const plain = result.tokens.map(t=>t.t).join('');
    const { score, issues } = goalSeekingScore(plain, style, ignoredRules);
    setResult({ text: plain, score, tokens: tokenize(plain).map(t=>({t})), changes: [], issues });
  };
  const sendLeftToRight = () => { setInput(result.text); };

  return (
    <Shell>
      <Sidebar>
        <SideTitle>DraftLab</SideTitle>
        <SideNav>
          <SideLink to="/ai">🏠 Home</SideLink>
          <SideLink to="/ai/draftly">🧹 Editor</SideLink>
        </SideNav>
      </Sidebar>

      <Main>
        <H1>Rewrite & Polish</H1>
        <Sub>Paste your essay, pick a style, and refine it with Draftly’s suggestions and goal-seeking score.</Sub>

        {/* Controls Card */}
        <Card>
          <Row>
            <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
              <Label htmlFor="style">Style</Label>
              <Select id="style" value={style} onChange={(e)=>setStyle(e.target.value)}>
                <option value="casual">Casual</option>
                <option value="professional">Professional</option>
                <option value="scientific">Scientific</option>
              </Select>
              <Button onClick={start} disabled={!input.trim()}>Improve</Button>
              {result.text ? <Tag>Score: {result.score}%</Tag> : null}
            </div>
            <Actions>
              <SmallBtn onClick={copyImproved} disabled={!result.text}>Copy improved</SmallBtn>
              <SmallBtn onClick={downloadImproved} disabled={!result.text}>Download</SmallBtn>
              <SmallBtn onClick={()=>setShowSuggestions(true)} disabled={!result.text}>
                Suggestions {(result.issues||[]).filter(i=>!ignoredRules.has(i.key) && i.count>0).length || 0}
              </SmallBtn>
            </Actions>
          </Row>
        </Card>

        {/* Work Area Card */}
        <Card style={{minHeight: 420, gridTemplateRows: 'auto minmax(0,1fr)'}}>
          <Split>
            {/* Left: Improved */}
            <Pane onMouseUp={handleMouseUp}>
              <PaneHead>
                <div className="title">Improved Essay ({style[0].toUpperCase()+style.slice(1)})</div>
                <div className="right">
                  <Meter val={result.score}>{result.score}%</Meter>
                </div>
              </PaneHead>

              <ReadArea>
                {result.text ? (
                  <p>{rendered}</p>
                ) : (
                  <p style={{opacity:.65}}>
                    Your improved essay will appear here with
                    {' '}<span style={{textDecoration:'underline 2px #0d2d7d', textUnderlineOffset:3}}>replacements</span>
                    {' '}and
                    {' '}<span style={{textDecoration:'underline 2px #2ed6a1', textUnderlineOffset:3}}>insertions</span>.
                    Hover for reasons; click to revert, edit, rephrase, or ignore. Select any passage to Make stronger, Rephrase, or Add source.
                  </p>
                )}

                {citations.length > 0 && (
                  <>
                    <hr style={{margin:'16px 0', border:'none', borderTop:'1px dashed #dfe3f6'}}/>
                    <p style={{fontWeight:800, marginBottom:8}}>References</p>
                    <ol style={{paddingLeft: '20px', marginTop: 0}}>
                      {citations.map(c=>(
                        <li key={c.id}><a href={c.url} target="_blank" rel="noreferrer">{c.label}</a></li>
                      ))}
                    </ol>
                  </>
                )}
              </ReadArea>

              <Toolbar>
                <SmallBtn onClick={polishAgain} disabled={!result.text}>Polish again</SmallBtn>
                <SmallBtn onClick={acceptAll} disabled={!result.text}>Accept all</SmallBtn>
                <SmallBtn onClick={sendLeftToRight} disabled={!result.text}>Send left → right</SmallBtn>
                <SmallBtn onClick={()=>{
                  setResult({ text:'', score:0, tokens:[], changes:[], issues:[] });
                  setCitations([]); setIgnoredChangeIds(new Set());
                }}>Clear</SmallBtn>
              </Toolbar>
            </Pane>

            {/* Right: Original */}
            <Pane>
              <PaneHead>
                <div className="title">Original Essay</div>
                <div className="right"><Meter val={inputScore}>{inputScore}%</Meter></div>
              </PaneHead>
              <Editor
                placeholder="Paste your essay here, choose a style, then press Improve."
                value={input}
                onChange={(e)=>setInput(e.target.value)}
              />
              <div style={{height:0}} /> {/* spacer for grid */}
            </Pane>
          </Split>
        </Card>

        {/* Hover tooltip */}
        {hoverCard && (
          <FloatCard style={{left: hoverCard.x, top: hoverCard.y, transform:'translate(-50%,-100%)'}}>
            <FloatTitle>{hoverCard.title}</FloatTitle>
            <FloatNote>{hoverCard.note}</FloatNote>
            <div style={{fontSize:12, opacity:.7}}>Tip: click to revert, edit, rephrase, or ignore.</div>
          </FloatCard>
        )}

        {/* Click menu (with Ignore) */}
        {clickCard && (
          <FloatCard style={{left: clickCard.x, top: clickCard.y, transform:'translate(-50%,0)'}}>
            <FloatTitle>Change</FloatTitle>
            <FloatNote>“{clickCard.change.before || '∅'}” → “{clickCard.change.after}”</FloatNote>
            <MenuRow>
              <GhostButton onClick={()=>{ revertChange(clickCard.change); setClickCard(null); }}>Revert</GhostButton>
              <GhostButton onClick={()=>{ editChange(clickCard.change); setClickCard(null); }}>Edit</GhostButton>
              <GhostButton onClick={()=>{ rephraseChange(clickCard.change); setClickCard(null); }}>Rephrase</GhostButton>
              <GhostButton onClick={()=>{ ignoreChange(clickCard.change); setClickCard(null); }}>Ignore</GhostButton>
            </MenuRow>
          </FloatCard>
        )}

        {/* Selection bubble */}
        {selectionBubble && (
          <SelectBubble style={{left: selectionBubble.x, top: selectionBubble.y, transform:'translate(-50%,-100%)'}}>
            <GhostButton onClick={actStronger}>Make stronger</GhostButton>
            <GhostButton onClick={actRephrase}>Rephrase</GhostButton>
            <GhostButton onClick={actAddSource}>Add source</GhostButton>
          </SelectBubble>
        )}

        {/* Suggestions panel */}
        {showSuggestions && (
          <FloatCard style={{left:'50%', top:'12%', transform:'translate(-50%,0)'}}>
            <FloatTitle>Suggested improvements (aim for 100%)</FloatTitle>
            <div style={{fontSize:13, opacity:.8, marginBottom:8}}>
              Click <b>Fix</b> to apply a targeted improvement, or <b>Ignore</b> to stop counting it against your score.
            </div>
            <div style={{display:'grid', gap:8}}>
              {(result.issues||[]).map((iss)=>(
                <div key={iss.key} style={{
                  display:'grid',
                  gridTemplateColumns:'1fr auto auto',
                  gap:8,
                  alignItems:'center',
                  border:'1px solid #edf0fb',
                  borderRadius:10,
                  padding:'8px 10px',
                  background:'#fbfcff'
                }}>
                  <div>
                    <div style={{fontWeight:800}}>
                      {iss.label} — {iss.count} {iss.count===1?'instance':'instances'}
                      {ignoredRules.has(iss.key) && <span style={{marginLeft:8, fontWeight:700, color:'#7a7a7a'}}>(ignored)</span>}
                    </div>
                    <div style={{fontSize:13, opacity:.8}}>{iss.desc}</div>
                  </div>
                  <GhostButton onClick={()=>applySuggestion(iss.key)} disabled={iss.count===0}>Fix</GhostButton>
                  <GhostButton onClick={()=>toggleIgnoreRule(iss.key)}>{ignoredRules.has(iss.key)?'Unignore':'Ignore'}</GhostButton>
                </div>
              ))}
            </div>
            <div style={{display:'flex', gap:8, marginTop:10}}>
              <GhostButton onClick={fixAllSuggestions}>Fix all</GhostButton>
              <GhostButton onClick={clearIgnores} disabled={ignoredRules.size===0}>Clear ignores</GhostButton>
              <GhostButton onClick={()=>setShowSuggestions(false)} style={{marginLeft:'auto'}}>Close</GhostButton>
            </div>
          </FloatCard>
        )}
      </Main>
    </Shell>
  );
}
