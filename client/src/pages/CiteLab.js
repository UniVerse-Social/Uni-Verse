// client/src/pages/CiteLab.js
// A complete, good‑looking citation builder for students.
// - Source lookup (DOI, ISBN, URL, arXiv, PMID, title search)
// - Step‑by‑step wizard
// - Styles: MLA 9, APA 7, Chicago NB (+ in‑text examples)
// - Exports: Copy, BibTeX, RIS; Save multiple entries to a project list
// - Designed with styled‑components to match the rest of the app

import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

/* ================= Layout ================= */
const Shell = styled.div`
  position: fixed;
  top: var(--nav-height, 64px);
  right: 0; left: 0; bottom: 0;
  display: grid;
  grid-template-columns: 260px 1fr;
  background: #fff;
  @media (max-width: 900px){ grid-template-columns: 1fr; }
`;

const Sidebar = styled.aside`
  border-right: 1px solid #eee; background: #fafafa; padding: 18px 16px;
  @media (max-width: 900px){ display: none; }
`;

const SideTitle = styled.div`
  font-weight: 900; font-size: 20px; margin-bottom: 14px;
`;

const Side = styled.nav`
  display: grid; gap: 12px;
`;

const SideItem = styled.button`
  appearance: none; border: 0; background: transparent; text-align: left;
  display: grid; grid-auto-flow: column; gap: 8px; align-items: center; justify-content: start;
  padding: 10px 12px; border-radius: 10px; font-weight: 800; cursor: pointer; color: #222;
  &:hover{ background: #f0f3ff; }
`;

const Main = styled.main`
  overflow: auto; padding: clamp(14px, 2.4vw, 28px);
`;

const H1 = styled.h1`
  margin: 0 0 8px; font-weight: 900; font-size: clamp(28px, 4.6vw, 48px);
`;
const Sub = styled.p`
  margin: 0 0 20px; color: #6b7280;
`;

/* ================= Cards & Controls ================= */
const Card = styled.section`
  background: #fff; border: 1px solid #eee; border-radius: 16px;
  padding: clamp(16px, 2.2vw, 22px); box-shadow: 0 10px 24px rgba(0,0,0,0.06);
`;

const Grid = styled.div`
  display: grid; gap: 12px;
  grid-template-columns: repeat(12, 1fr);
`;

const Row = styled.div`
  display: grid; gap: 12px; grid-template-columns: repeat(12, 1fr);
`;

const Field = styled.label`
  grid-column: span ${p=>p.span || 12}; display: grid; gap: 8px;
`;
const Label = styled.div` font-weight: 900; `;
const Input = styled.input`
  height: 44px; border: 1px solid #e6e6e6; border-radius: 10px; padding: 0 12px; font-weight: 700;
`;
const Select = styled.select`
  height: 44px; border: 1px solid #e6e6e6; border-radius: 10px; padding: 0 12px; font-weight: 700;
`;

const RowActions = (props) => (
  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }} {...props} />
);

const Button = styled.button`
  height: 44px; padding: 0 16px; border: 0; border-radius: 10px; font-weight: 900; cursor: pointer;
  color: #fff; background: ${p => p.secondary ? '#9aa4b2' : '#0d2d7d'};
  box-shadow: 0 10px 22px rgba(13,45,125,0.25);
  &:disabled { opacity: .6; cursor: not-allowed; box-shadow: none; }
`;

const Ghost = styled.button`
  height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid #e6e6e6; background: #fff; font-weight: 800; cursor: pointer;
`;

const Kicker = styled.div` font-size: 12px; font-weight: 900; opacity: .7; `;

const Tag = styled.span`
  display: inline-flex; align-items: center; height: 22px; padding: 0 8px; font-size: 12px; font-weight: 900;
  color: #0d2d7d; background: #e9f0ff; border: 1px solid #d6e4ff; border-radius: 999px;
`;

const Toolbar = styled.div`
  display: flex; gap: 8px; flex-wrap: wrap;
`;

const Columns = styled.div`
  display: grid; gap: 12px; grid-template-columns: 1fr 1fr; @media (max-width: 880px){ grid-template-columns: 1fr; }
`;

const ResultCard = styled(Card)` margin-top: 14px; `;

/* =============== Helpers =============== */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
// ===== Autofill helpers to maximize metadata pull =====
function normalizeDOI(raw){
  if(!raw) return '';
  const m = String(raw).match(DOI_RE);
  // strip common trailing punctuation like ),.] :
  return m ? m[0].replace(/[)\]\s.,;:]*$/, '') : '';
}
function cslToMeta(j){
  if(!j) return {};
  const typeMap = {
    'article-journal':'journal-article',
    'paper-conference':'journal-article',
    book:'book', chapter:'chapter', dataset:'dataset', report:'report', thesis:'thesis'
  };
  const dp = (j.issued?.['date-parts']?.[0]) || (j.created?.['date-parts']?.[0]) || [];
  const date = [dp[0]||'', dp[1]||'', dp[2]||''].filter(Boolean).join('-');
  return {
    type: typeMap[j.type] || 'website',
    title: j.title || '',
    containerTitle: j['container-title'] || j['container-title-short'] || '',
    publisher: j.publisher || '',
    volume: j.volume || '',
    issue: j.issue || j.number || '',
    page: j.page || '',
    doi: normalizeDOI(j.DOI || j.doi),
    url: j.URL || j.url || '',
    date,
    authors: (j.author||[]).map(a => ({ given: a.given||'', family: a.family||a['non-dropping-particle']||'' }))
  };
}

function mergeMeta(base, extra){
  const out = {...base}; if(!extra) return out;
  const isEmpty = (x)=> Array.isArray(x) ? x.length===0 : String(x ?? '').trim()==='';
  for (const k of Object.keys(extra)){
    if (isEmpty(out[k]) && extra[k] != null && String(extra[k]).trim() !== '') out[k] = extra[k];
  }
  if ((!out.authors || out.authors.length===0) && extra.authors) out.authors = extra.authors;
  return out;
}

// CSL via doi.org (very complete when available)
async function lookupDOIviaCSL(doi){
  const clean = normalizeDOI(doi);
  const res = await fetch(`https://doi.org/${encodeURIComponent(clean)}`, {
    headers: { Accept: 'application/vnd.citationstyles.csl+json' }
  });
  if (!res.ok) throw new Error(`DOI CSL HTTP ${res.status}`);
  return cslToMeta(await res.json());
}

// DataCite (great for datasets, Zenodo, Figshare, etc.)
async function lookupDataCite(doi){
  const clean = normalizeDOI(doi);
  const r = await fetch(`https://api.datacite.org/dois/${encodeURIComponent(clean)}`);
  if(!r.ok) throw new Error(`DataCite HTTP ${r.status}`);
  const j = await r.json(); const a = j?.data?.attributes || {};
  return cslToMeta({
    type: a.types?.resourceTypeGeneral?.toLowerCase(),
    title: (Array.isArray(a.titles)?a.titles[0]?.title:'') || '',
    'container-title': (Array.isArray(a.containerTitles)?a.containerTitles[0]:'') || a.containerTitle || '',
    publisher: a.publisher,
    volume: a.volume,
    issue: a.issue,
    page: a.sizes?.[0] || '',
    DOI: a.doi,
    URL: a.url,
    issued: { 'date-parts': [[a.publicationYear||'']] },
    author: (a.creators||[]).map(p => ({ given: p.givenName||'', family: p.familyName||p.name||'' }))
  });
}

// Google Books (fills gaps OpenLibrary misses)
async function googleBooksByISBN(isbn){
  const j = await fetchJSON(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`);
  const v = j.items?.[0]?.volumeInfo; if(!v) throw new Error('No Google Books match');
  return {
    type:'book',
    title: v.title||'',
    containerTitle:'',
    publisher: v.publisher||'',
    volume:'', issue:'', page:'',
    doi:'', url: (j.items?.[0]?.selfLink)||'',
    date: v.publishedDate||'',
    authors: (v.authors||[]).map(nameSplit)
  };
}

// PubMed CSL (super clean for PMIDs)
async function lookupPubMedCSL(id){
  const r = await fetch(`https://api.ncbi.nlm.nih.gov/lit/ctxp/v1/pubmed/?format=csl&id=${encodeURIComponent(id)}`);
  if(!r.ok) throw new Error(`PubMed HTTP ${r.status}`);
  return cslToMeta(await r.json());
}

function pad2(n){ return String(n).padStart(2,'0'); }

function parseDateParts(input){
  // Accept yyyy-mm-dd, yyyy-mm, yyyy, or mm/dd/yyyy
  if(!input) return {year:'',month:'',day:''};
  const t = input.trim();
  let y='',m='',d='';
  if(/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)){
    const [Y,M,D] = t.split('-'); y=Y; m=String(parseInt(M,10)); d=String(parseInt(D,10));
  } else if(/^\d{4}-\d{1,2}$/.test(t)){
    const [Y,M] = t.split('-'); y=Y; m=String(parseInt(M,10));
  } else if(/^\d{4}$/.test(t)){
    y=t;
  } else if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)){
    const [M,D,Y]=t.split('/'); y=Y; m=String(parseInt(M,10)); d=String(parseInt(D,10));
  }
  return {year:y, month:m, day:d};
}

function formatMonth(m){ if(!m) return ''; const i=parseInt(m,10)-1; return i>=0&&i<12?MONTHS[i]:m; }

function nameToAPA({given='',family=''}){
  // "Ada Lovelace" -> Lovelace, A.
  const initials = given.split(/[-\s]/).filter(Boolean).map(s=>s[0].toUpperCase()+'.').join(' ');
  return family ? `${family}, ${initials}` : given;
}
function nameToMLA({given='',family=''}){
  // First author: Last, First Middle; others: First Last
  const parts = given.split(' ');
  const first = parts[0]||''; const rest = parts.slice(1).join(' ');
  const fullGiven = [first, rest].filter(Boolean).join(' ');
  return family ? `${family}, ${fullGiven}` : fullGiven;
}
function nameToChicago({given='',family=''}){
  return family ? `${given} ${family}` : given;
}

function oxfordComma(list, joiner='and'){
  if(list.length===0) return '';
  if(list.length===1) return list[0];
  if(list.length===2) return `${list[0]} ${joiner} ${list[1]}`;
  return `${list.slice(0,-1).join(', ')}, ${joiner} ${list[list.length-1]}`;
}

function truncateAuthorsAPA(authors){
  // APA up to 20 authors; if >20, list first 19, ellipsis, last
  if(authors.length<=20) return authors.map(nameToAPA).join(', ');
  const first19 = authors.slice(0,19).map(nameToAPA).join(', ');
  const last = nameToAPA(authors[authors.length-1]);
  return `${first19}, …, ${last}`;
}

function websiteMLA(meta){
  const {authors=[], title='', containerTitle='', publisher='', date='', url='', accessed=''} = meta;
  const {year, month, day} = parseDateParts(date);
  const dateStr = [day && parseInt(day,10), month && formatMonth(month), year].filter(Boolean).join(' ');
  const a = authors[0] ? nameToMLA(authors[0]) : '';
  const andEtal = authors.length>2;
  const others = authors.slice(1,3).map(p=>`${p.given} ${p.family}`);
  const authorStr = a ? (andEtal ? `${a}, et al.` : authors.length===2 ? `${a}, and ${others[0]}` : `${a}`) : '';
  return [
    authorStr && `${authorStr}.`,
    title && `"${title}."`,
    containerTitle && `<i>${containerTitle}</i>,`,
    publisher && `${publisher},`,
    dateStr && `${dateStr},`,
    url && `${url}.`,
    accessed && `Accessed ${accessed}.`
  ].filter(Boolean).join(' ');
}

function journalMLA(meta){
  const {authors=[], title='', containerTitle='', volume='', issue='', page='', date='', doi='', url=''} = meta;
  const y = parseDateParts(date).year;
  const a = authors[0] ? nameToMLA(authors[0]) : '';
  const andEtal = authors.length>2;
  const others = authors.slice(1,3).map(p=>`${p.given} ${p.family}`);
  const authorStr = a ? (andEtal ? `${a}, et al.` : authors.length===2 ? `${a}, and ${others[0]}` : `${a}`) : '';
  const locator = doi ? `https://doi.org/${doi.replace(/^https?:\/\//,'').replace(/^doi\.org\//,'')}` : url || '';
  return [
    authorStr && `${authorStr}.`,
    title && `"${title}."`,
    containerTitle && `<i>${containerTitle}</i>`,
    volume && `vol. ${volume}`,
    issue && `no. ${issue}`,
    y && `${y}`,
    page && `pp. ${page}`,
    locator && `${locator}.`
  ].filter(Boolean).join(', ').replace(/, \./g, '.');
}

function websiteAPA(meta){
  const {authors=[], title='', containerTitle='', date='', url=''} = meta;
  const {year, month, day} = parseDateParts(date);
  const dateStr = year ? `(${year}${month?`, ${formatMonth(month)}`:''}${day?` ${parseInt(day,10)}`:''}).` : '(n.d.).';
  const authorStr = authors.length ? truncateAuthorsAPA(authors) + ' ' : '';
  return [authorStr, dateStr, title ? `${title}.` : '', containerTitle ? `${containerTitle}.` : '', url].filter(Boolean).join(' ');
}

function journalAPA(meta){
  const {authors=[], title='', containerTitle='', volume='', issue='', page='', date='', doi='', url=''} = meta;
  const y = parseDateParts(date).year;
  const authorStr = authors.length ? truncateAuthorsAPA(authors) : '';
  const volIssue = volume ? (issue ? `${volume}(${issue})` : `${volume}`) : (issue ? `(${issue})` : '');
  const locator = doi ? `https://doi.org/${doi.replace(/^https?:\/\//,'').replace(/^doi\.org\//,'')}` : (url||'');
  return [
    authorStr && `${authorStr} (${y||'n.d.'}).`,
    title && `${title}.`,
    containerTitle && `${containerTitle},`,
    volIssue && `${volIssue},`,
    page && `${page}.`,
    locator
  ].filter(Boolean).join(' ').replace(/,\s*,/g, ',');
}

function websiteChicagoNB(meta){
  const {authors=[], title='', containerTitle='', date='', url=''} = meta;
  const {year, month, day} = parseDateParts(date);
  const a = authors.length ? nameToChicago(authors[0]) : '';
  const d = [month&&formatMonth(month), day&&parseInt(day,10), year].filter(Boolean).join(' ');
  return [
    a && `${a}.`,
    title && `"${title}."`,
    containerTitle && `<i>${containerTitle}</i>`,
    d && `${d}.`,
    url
  ].filter(Boolean).join(' ');
}

function journalChicagoNB(meta){
  const {authors=[], title='', containerTitle='', volume='', issue='', page='', date='', doi='', url=''} = meta;
  const y = parseDateParts(date).year;
  const a = authors.map(nameToChicago);
  const loc = doi ? `https://doi.org/${doi.replace(/^https?:\/\//,'').replace(/^doi\.org\//,'')}` : (url||'');
  return [
    a.length && `${oxfordComma(a)}.`,
    title && `"${title}."`,
    containerTitle && `<i>${containerTitle}</i>`,
    volume && `${volume}`,
    issue && `, no. ${issue}`,
    y && `(${y})`,
    page && `: ${page}.`,
    loc
  ].filter(Boolean).join(' ').replace(/\s+,/g, ',');
}

function inTextExamples(meta){
  const {authors=[], date=''} = meta; const y = parseDateParts(date).year || 'n.d.';
  const first = authors[0];
  const last = first?.family || first?.given || 'Author';
  const many = authors.length>2;
  const two = authors.length===2;
  return {
    apa: many ? `(${last} et al., ${y})` : two ? `(${nameToAPA(authors[0]).split(',')[0]} & ${nameToAPA(authors[1]).split(',')[0]}, ${y})` : `(${last}, ${y})`,
    mla: many ? `(${last} et al. ${y})` : two ? `(${authors[0]?.family || ''} and ${authors[1]?.family || ''} ${y})` : `(${last} ${y})`,
    chicago: many ? `${last} et al. ${y}` : two ? `${authors[0]?.family || ''} and ${authors[1]?.family || ''} ${y}` : `${last} ${y}`
  };
}

function toBibTeX(meta){
  const typeMap = { 'journal-article':'article', book:'book', chapter:'incollection', website:'misc', report:'techreport', thesis:'phdthesis', dataset:'dataset' };
  const keyBase = (meta.authors?.[0]?.family || meta.title || 'entry').replace(/[^a-z0-9]+/gi,'');
  const year = parseDateParts(meta.date).year || 'n.d.';
  const key = `${keyBase}${year}`;
  const fields = [];
  const add=(k,v)=>{ if(v) fields.push(`  ${k} = {${v}}`); };
  add('title', meta.title);
  add('author', (meta.authors||[]).map(a=>`${a.family||''}, ${a.given||''}`).filter(Boolean).join(' and '));
  add('journal', meta.containerTitle);
  add('booktitle', meta.containerTitle);
  add('publisher', meta.publisher);
  add('year', year);
  add('month', parseDateParts(meta.date).month);
  add('day', parseDateParts(meta.date).day);
  add('volume', meta.volume);
  add('number', meta.issue);
  add('pages', meta.page);
  add('doi', meta.doi);
  add('url', meta.url);
  return `@${typeMap[meta.type]||'misc'}{${key},\n${fields.join(',\n')}\n}`;
}

function toRIS(meta){
  const typeMap = { 'journal-article':'JOUR', book:'BOOK', chapter:'CHAP', website:'ELEC', report:'RPRT', thesis:'THES', dataset:'DATA' };
  const lines = [];
  const add=(k,v)=>{ if(v) lines.push(`${k}  - ${v}`); };
  lines.push(`TY  - ${typeMap[meta.type]||'GEN'}`);
  (meta.authors||[]).forEach(a=> add('AU', `${a.family||''}, ${a.given||''}`));
  add('TI', meta.title);
  add('T2', meta.containerTitle);
  add('PY', parseDateParts(meta.date).year);
  add('DA', `${parseDateParts(meta.date).year}/${pad2(parseDateParts(meta.date).month)}/${pad2(parseDateParts(meta.date).day)}`);
  add('VL', meta.volume);
  add('IS', meta.issue);
  add('SP', meta.page?.split('-')[0]);
  add('EP', meta.page?.split('-')[1]);
  add('DO', meta.doi);
  add('UR', meta.url);
  add('PB', meta.publisher);
  lines.push('ER  - ');
  return lines.join('\n');
}

/* =============== Lookup (Crossref/OpenLibrary/OpenAlex/URL) =============== */
const DOI_RE = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
const ISBN_RE = /^(97(8|9))?\d{9}(\d|X)$/i;
const ARXIV_RE = /^(?:arXiv:)?\d{4}\.\d{4,5}(?:v\d+)?$/i;
const PMID_RE = /^\d{5,9}$/;

async function fetchJSON(url){
  const res = await fetch(url, { headers: { 'Accept':'application/json' } });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function lookupCrossrefByDOI(doi){
  const clean = doi.replace(/^https?:\/\//,'').replace(/^doi\.org\//,'');
  const j = await fetchJSON(`https://api.crossref.org/works/${encodeURIComponent(clean)}`);
  return crossrefToMeta(j.message);
}

async function searchCrossrefByTitle(q){
  const j = await fetchJSON(`https://api.crossref.org/works?query.title=${encodeURIComponent(q)}&rows=8`);
  return (j.message.items||[]).map(crossrefToMeta);
}

function crossrefToMeta(it){
  const authors = (it.author||[]).map(a=>({ given:a.given||'', family:a.family||'' }));
  const dp = it.issued?.['date-parts']?.[0] || it.created?.['date-parts']?.[0] || [];
  const date = [dp[0]||'', dp[1]||'', dp[2]||''].filter(Boolean).join('-');
  const page = it.page || it['article-number'] || '';
  const type =
    it.type==='journal-article' ? 'journal-article'
    : (it.type?.includes('book') ? 'book'
    : it.type==='dataset' ? 'dataset' : 'website');
  return {
    type,
    title: it.title?.[0] || '',
    containerTitle: it['container-title']?.[0] || '',
    publisher: it.publisher || it['publisher-name'] || '',
    volume: it.volume || '',
    issue: it.issue || '',
    page,
    doi: it.DOI || '',
    url: it.URL || '',
    date,
    authors
  };
}

async function lookupOpenLibrary(isbn){
  const j = await fetchJSON(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
  const key = Object.keys(j)[0];
  const b = j[key];
  if(!b) throw new Error('Not found');
  const authors = (b.authors||[]).map(a=>({ given: a.name?.split(' ').slice(0,-1).join(' ') || '', family: a.name?.split(' ').slice(-1)[0] || '' }));
  const date = (b.publish_date||'').split(' ').reverse().join('-'); // naive
  return {
    type:'book',
    title: b.title || '',
    containerTitle: '',
    publisher: (b.publishers?.[0]?.name)||'',
    volume:'', issue:'', page:'', doi:'', url:'',
    date,
    authors
  };
}


async function searchOpenAlex(q){
  const j = await fetchJSON(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&per_page=8`);
  return (j.results||[]).map(openalexToMeta);
}

function openalexToMeta(w){
  const authors = (w.authorships||[]).map(a=>({ given: a.author?.display_name?.split(' ').slice(0,-1).join(' ')||'', family: a.author?.display_name?.split(' ').slice(-1)[0]||'' }));
  const date = (w.publication_date)||'';
  const type = w.type==='journal-article'?'journal-article': w.type==='dataset'?'dataset':'website';
  return {
    type,
    title: w.title||'',
    containerTitle: w.host_venue?.display_name||'',
    publisher: w.primary_location?.source?.publisher||'',
    volume: w.biblio?.volume||'',
    issue: w.biblio?.issue||'',
    page: w.biblio?.first_page && w.biblio?.last_page ? `${w.biblio.first_page}-${w.biblio.last_page}` : '',
    doi: (w.doi||'').replace(/^https?:\/\//,''),
    url: w.primary_location?.landing_page_url||'',
    date,
    authors
  };
}

async function lookupURL(url){
  // Try serverless proxy first for reliable metadata
  try{
    const r = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
    if (r.ok){
      const j = await r.json();
      let base = {
        type:'website',
        title: j.title || '',
        containerTitle: j.site || new URL(url).hostname.replace(/^www\./,''),
        publisher: j.publisher || '',
        date: j.date || '',
        url,
        authors: (j.author ? j.author.split(/;|,\s*(?=[A-Z][a-z])/).map(n=>nameSplit(n.trim())) : []),
        doi: normalizeDOI(j.doi || '')
      };
      if (base.doi){
        try { base = mergeMeta(await lookupDOIviaCSL(base.doi), base); } catch {}
      }
      if (base.title){
        try {
          const [cr, oa] = await Promise.allSettled([searchCrossrefByTitle(base.title), searchOpenAlex(base.title)]);
          const candidate = (cr.value?.[0]) || (oa.value?.[0]);
          if (candidate) base = mergeMeta(candidate, base);
        } catch {}
      }
      return base;
    }
  } catch {}

  // 2) Fallback: Jina reader (returns readable text). Heuristics.
  try {
    const r = await fetch(`https://r.jina.ai/${url}`);
    const text = await r.text();
    const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
    const title = lines[0] || '';
    const byLine = lines.find(l => /^by\s+/i.test(l)) || '';
    const dateLine = lines.find(l => /(Published|Updated|Posted)\s*:?\s*\w+/i.test(l)) || '';
    const authors = byLine ? byLine.replace(/^by\s+/i,'').split(/,| and /i).map(s=>nameSplit(s.trim())) : [];
    const date = (dateLine.match(/\b\d{4}-\d{2}-\d{2}\b/) || dateLine.match(/\b\w+\s+\d{1,2},\s*\d{4}\b/) || [''])[0];
    const doiMatch = text.match(DOI_RE);
    let base = { type:'website', title, containerTitle: new URL(url).hostname.replace(/^www\./,''), publisher:'', url, date: date||'', authors, doi: doiMatch?normalizeDOI(doiMatch[0]):'' };
    if (base.doi){
      try {
        const viaDOI = await lookupDOIviaCSL(base.doi);
        base = mergeMeta(viaDOI, base);
      } catch {}
    }
    return base;
  } catch (e) {
    throw new Error('Unable to fetch page. Enter details manually.');
  }
}

function nameSplit(n){
  if(!n) return {given:'', family:''};
  const parts = n.split(' ');
  if(parts.length===1) return {given:'', family:n};
  return { given: parts.slice(0,-1).join(' '), family: parts.slice(-1)[0] };
}

/* =================== UI =================== */

const STEPS = ['Source Type', 'Identify / Lookup', 'Review & Edit', 'Style & Export'];
const SOURCE_TYPES = [
  {id:'website', label:'Website'},
  {id:'journal-article', label:'Journal Article'},
  {id:'book', label:'Book'},
  {id:'chapter', label:'Book Chapter'},
  {id:'report', label:'Report'},
  {id:'thesis', label:'Thesis/Dissertation'},
  {id:'dataset', label:'Dataset'},
  {id:'video', label:'Video'},
  {id:'podcast', label:'Podcast'},
  {id:'newspaper', label:'Newspaper/Magazine'},
];

const emptyMeta = { type:'website', title:'', containerTitle:'', publisher:'', volume:'', issue:'', page:'', doi:'', url:'', date:'', accessed:'', edition:'', editors:[], place:'', authors:[] };

export default function CiteLab(){
  const [step, setStep] = useState(0);
  const [meta, setMeta] = useState({...emptyMeta});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [list, setList] = useState(()=>{ try{ return JSON.parse(localStorage.getItem('citelab_saved')||'[]'); } catch{ return []; } });
  const [style, setStyle] = useState('mla');

  // Persist list
  useEffect(()=>{ localStorage.setItem('citelab_saved', JSON.stringify(list)); }, [list]);

  const setMetaField = (k,v)=>setMeta(m=>({...m, [k]:v}));

  async function doLookup(){
    if(!query) return;
    setLoading(true); setResults([]);
    try{
      // DOI anywhere in the query?
      const foundDOI = normalizeDOI(query);
      if (foundDOI){
        let metaFromDOI = {};
        try { metaFromDOI = await lookupDOIviaCSL(foundDOI); } catch {}
        if (!metaFromDOI.title) { try { metaFromDOI = mergeMeta(metaFromDOI, await lookupCrossrefByDOI(foundDOI)); } catch {} }
        try { metaFromDOI = mergeMeta(metaFromDOI, await lookupDataCite(foundDOI)); } catch {}
        setMeta(metaFromDOI); setStep(2); return;
      }

      // ISBN?
      const maybeISBN = query.replace(/[-\s]/g,'');
      if (ISBN_RE.test(maybeISBN)){
        let book = {};
        try { book = await googleBooksByISBN(maybeISBN); } catch {}
        try { book = mergeMeta(book, await lookupOpenLibrary(maybeISBN)); } catch {}
        setMeta(book); setStep(2); return;
      }

      // PMID?
      if (PMID_RE.test(query)){
        let pm = {};
        try { pm = await lookupPubMedCSL(query); } catch {}
        // OpenAlex can sometimes add container/venue/pages
        try {
          const oa = (await searchOpenAlex(query))?.[0];
          if (oa) pm = mergeMeta(pm, oa);
        } catch {}
        setMeta(pm); setStep(2); return;
      }
      // arXiv?
      const arxivMatch = query.match(ARXIV_RE);
      if (arxivMatch){
        const id = arxivMatch[0].replace(/^arXiv:/i,'');
        try {
          // Direct OpenAlex by arXiv URL gives richer metadata than plain search
          const j = await fetchJSON(`https://api.openalex.org/works/https://arxiv.org/abs/${id}`);
          const m = openalexToMeta(j);   // uses the same mapper you already have
          setMeta(m); setStep(2); return;
        } catch {}
        // Fallback: text search
        try {
          const r = (await searchOpenAlex(id))?.[0];
          if (r){ setMeta(r); setStep(2); return; }
        } catch {}
      }
      // URL?
      if (/^https?:\/\//i.test(query)){
        let m = await lookupURL(query);
        // If still missing bits and we have a title, try Crossref/OpenAlex by title to enrich.
        if (m.title){
          try {
            const [cr, oa] = await Promise.allSettled([searchCrossrefByTitle(m.title), searchOpenAlex(m.title)]);
            const candidate = (cr.value?.[0]) || (oa.value?.[0]);
            if (candidate) m = mergeMeta(candidate, m);
          } catch {}
        }
        setMeta(m); setStep(2); return;
      }

      // Title search → show matches, auto-take exact single hit
      const [cr, oa] = await Promise.allSettled([searchCrossrefByTitle(query), searchOpenAlex(query)]);
      const rows = [ ...(cr.value||[]), ...(oa.value||[]) ];
      setResults(rows.slice(0,12));
      if(rows.length===1){ setMeta(rows[0]); setStep(2); }

    } catch(e){
      console.error('Lookup failed', e);
    } finally {
      setLoading(false);
    }
  }

  function addAuthor(){ setMeta(m=>({...m, authors:[...m.authors, {given:'', family:''}]})); }
  function removeAuthor(i){ setMeta(m=>({...m, authors:m.authors.filter((_,j)=>j!==i)})); }
  function moveAuthor(i, dir){ setMeta(m=>{ const a=[...m.authors]; const j=i+dir; if(j<0||j>=a.length) return m; const t=a[i]; a[i]=a[j]; a[j]=t; return {...m, authors:a}; }); }

  const renderedCitation = useMemo(()=>{
    const t = meta.type;
    if(style==='mla') return t==='journal-article' ? journalMLA(meta) : websiteMLA(meta);
    if(style==='apa') return t==='journal-article' ? journalAPA(meta) : websiteAPA(meta);
    return t==='journal-article' ? journalChicagoNB(meta) : websiteChicagoNB(meta);
  }, [meta, style]);

  const inText = useMemo(()=>inTextExamples(meta), [meta]);

  function copy(text){ navigator.clipboard.writeText(text); }

  function addToList(){ setList(lst=>[{ id: `${Date.now()}`, meta }, ...lst]); }
  function removeFromList(id){ setList(lst=>lst.filter(x=>x.id!==id)); }

  function download(filename, content){
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
  }

  function exportBib(){
    const items = list.length? list.map(x=>toBibTeX(x.meta)).join('\n\n') : toBibTeX(meta);
    download(list.length? 'citelab.bib':'citation.bib', items);
  }
  function exportRIS(){
    const items = list.length? list.map(x=>toRIS(x.meta)).join('\n\n') : toRIS(meta);
    download(list.length? 'citelab.ris':'citation.ris', items);
  }

  return (
    <Shell>
      <Sidebar>
        <SideTitle>CiteLab</SideTitle>
        <Side>
          {STEPS.map((s,i)=> (
            <SideItem key={s} onClick={()=>setStep(i)} aria-current={step===i}>
              <Tag>{String(i+1).padStart(2,'0')}</Tag> <span style={{fontWeight:900}}>{s}</span>
            </SideItem>
          ))}
          <div style={{height:1, background:'#eee', margin:'6px 0 10px'}}/>
          <Kicker>Saved Citations</Kicker>
          <div style={{display:'grid', gap:8, marginTop:6}}>
            {list.length===0 && <div style={{color:'#6b7280'}}>No saved items yet.</div>}
            {list.map(row=> (
              <Card key={row.id} style={{padding:12}}>
                <div style={{fontWeight:900, marginBottom:6, fontSize:14}}>{row.meta.title || 'Untitled'}</div>
                <Toolbar>
                  <Ghost onClick={()=>copy((()=>{ const tmpStyle=style; const t=row.meta.type; const x = tmpStyle==='mla' ? (t==='journal-article'?journalMLA(row.meta):websiteMLA(row.meta)) : tmpStyle==='apa' ? (t==='journal-article'?journalAPA(row.meta):websiteAPA(row.meta)) : (t==='journal-article'?journalChicagoNB(row.meta):websiteChicagoNB(row.meta)); return x; })())}>Copy</Ghost>
                  <Ghost onClick={()=>removeFromList(row.id)}>Remove</Ghost>
                </Toolbar>
              </Card>
            ))}
          </div>
        </Side>
      </Sidebar>

      <Main>
        <H1>Build a Perfect Citation</H1>
        <Sub>Search for a source, review the details, then export in MLA/APA/Chicago. Paste a URL, DOI, ISBN, arXiv, PMID, or a title.</Sub>

        {/* Step 1 */}
        <Card style={{marginBottom:14}}>
          <Kicker>Step 1</Kicker>
          <Row style={{alignItems:'end'}}>
            <Field span={6}>
              <Label>Source Type</Label>
              <Select value={meta.type} onChange={e=>setMetaField('type', e.target.value)}>
                {SOURCE_TYPES.map(opt=> <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </Select>
            </Field>
            <Field span={6}>
              <Label>Quick Start (Optional)</Label>
              <Input placeholder="Paste DOI, ISBN, URL, arXiv ID, PMID, or a title" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') doLookup(); }} />
            </Field>
          </Row>
          <RowActions>
            <Button onClick={doLookup} disabled={!query}>{loading? 'Looking up…':'Lookup'}</Button>
          </RowActions>

          {results.length>0 && (
            <ResultCard>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{fontWeight:900}}>Matches</div>
                <Ghost onClick={()=>setResults([])}>Clear</Ghost>
              </div>
              <div style={{display:'grid', gap:10, marginTop:8}}>
                {results.map((r,idx)=> (
                  <Card key={idx} style={{padding:12}}>
                    <div style={{display:'grid', gap:6}}>
                      <div style={{fontWeight:900}}>{r.title}</div>
                      <div style={{color:'#6b7280', fontSize:14}}>{r.containerTitle}</div>
                      <Toolbar>
                        <Tag>{(r.type||'').replace('-', ' ')}</Tag>
                        {r.doi && <Tag>DOI</Tag>}
                        {r.url && <Tag>URL</Tag>}
                      </Toolbar>
                      <RowActions>
                        <Ghost onClick={()=>{ setMeta(r); setResults([]); setStep(2); }}>Use This</Ghost>
                      </RowActions>
                    </div>
                  </Card>
                ))}
              </div>
            </ResultCard>
          )}
        </Card>

        {/* Step 2 */}
        <Card style={{marginBottom:14}}>
          <Kicker>Step 2</Kicker>
          <div style={{fontWeight:900, marginBottom:8}}>Review & Edit Metadata</div>
          <Columns>
            <div>
              <Grid>
                <Field span={12}><Label>Title</Label><Input value={meta.title} onChange={e=>setMetaField('title', e.target.value)} /></Field>
                <Field span={6}><Label>Container (Journal/Website/Book)</Label><Input value={meta.containerTitle} onChange={e=>setMetaField('containerTitle', e.target.value)} /></Field>
                <Field span={6}><Label>Publisher</Label><Input value={meta.publisher} onChange={e=>setMetaField('publisher', e.target.value)} /></Field>
                <Field span={4}><Label>Year/Month/Day</Label><Input placeholder="YYYY or YYYY-MM or YYYY-MM-DD" value={meta.date} onChange={e=>setMetaField('date', e.target.value)} /></Field>
                <Field span={4}><Label>URL</Label><Input value={meta.url} onChange={e=>setMetaField('url', e.target.value)} /></Field>
                <Field span={4}><Label>DOI</Label><Input value={meta.doi} onChange={e=>setMetaField('doi', e.target.value)} /></Field>
                <Field span={4}><Label>Volume</Label><Input value={meta.volume} onChange={e=>setMetaField('volume', e.target.value)} /></Field>
                <Field span={4}><Label>Issue</Label><Input value={meta.issue} onChange={e=>setMetaField('issue', e.target.value)} /></Field>
                <Field span={4}><Label>Pages</Label><Input placeholder="123-145" value={meta.page} onChange={e=>setMetaField('page', e.target.value)} /></Field>
                <Field span={12}><Label>Accessed (optional)</Label><Input placeholder="Month Day, Year" value={meta.accessed||''} onChange={e=>setMetaField('accessed', e.target.value)} /></Field>
              </Grid>
            </div>
            <div>
              <div style={{fontWeight:900, marginBottom:8}}>Authors</div>
              <div style={{display:'grid', gap:10}}>
                {(meta.authors||[]).map((a, i)=> (
                  <Card key={i} style={{padding:12}}>
                    <Row>
                      <Field span={6}><Label>Given (First/Middle)</Label><Input value={a.given} onChange={e=> setMeta(m=>{ const arr=[...m.authors]; arr[i] = {...arr[i], given:e.target.value}; return {...m, authors:arr}; }) } /></Field>
                      <Field span={6}><Label>Family (Last)</Label><Input value={a.family} onChange={e=> setMeta(m=>{ const arr=[...m.authors]; arr[i] = {...arr[i], family:e.target.value}; return {...m, authors:arr}; }) } /></Field>
                    </Row>
                    <Toolbar>
                      <Ghost onClick={()=>moveAuthor(i,-1)}>↑</Ghost>
                      <Ghost onClick={()=>moveAuthor(i, 1)}>↓</Ghost>
                      <Ghost onClick={()=>removeAuthor(i)}>Remove</Ghost>
                    </Toolbar>
                  </Card>
                ))}
                <Ghost onClick={addAuthor}>+ Add author</Ghost>
              </div>
            </div>
          </Columns>
        </Card>

        {/* Step 3 */}
        <Card style={{marginBottom:14}}>
          <Kicker>Step 3</Kicker>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
            <div style={{fontWeight:900}}>Style & Preview</div>
            <Toolbar>
              <Ghost onClick={()=>setStyle('mla')} aria-pressed={style==='mla'}>MLA 9</Ghost>
              <Ghost onClick={()=>setStyle('apa')} aria-pressed={style==='apa'}>APA 7</Ghost>
              <Ghost onClick={()=>setStyle('chicago')} aria-pressed={style==='chicago'}>Chicago NB</Ghost>
            </Toolbar>
          </div>
          <ResultCard>
            <div style={{display:'grid', gap:8}}>
              <div style={{fontWeight:900}}>Bibliography</div>
              <div style={{lineHeight:1.6}} dangerouslySetInnerHTML={{__html: renderedCitation}} />
              <Toolbar>
                <Ghost onClick={()=>copy(stripHTML(renderedCitation))}>Copy</Ghost>
                <Ghost onClick={addToList}>Add to Saved</Ghost>
              </Toolbar>
            </div>
          </ResultCard>

          <Columns>
            <ResultCard>
              <div style={{display:'grid', gap:8}}>
                <div style={{fontWeight:900}}>In-text (APA)</div>
                <code style={{fontWeight:900}}>{inText.apa}</code>
              </div>
            </ResultCard>
            <ResultCard>
              <div style={{display:'grid', gap:8}}>
                <div style={{fontWeight:900}}>In-text (MLA)</div>
                <code style={{fontWeight:900}}>{inText.mla}</code>
              </div>
            </ResultCard>
          </Columns>

          <RowActions>
            <Button secondary onClick={exportRIS}>Export RIS</Button>
            <Button onClick={exportBib}>Export BibTeX</Button>
          </RowActions>
        </Card>

        {/* Tips */}
        <Card>
          <Kicker>Hints</Kicker>
          <ul>
            <li>Enter a DOI for the most accurate metadata on journal articles.</li>
            <li>For books, use an ISBN (10 or 13 digits).</li>
            <li>If a website lookup fails due to CORS, paste details manually—title, site, author, and date are usually enough.</li>
          </ul>
        </Card>

      </Main>
    </Shell>
  );
}

function stripHTML(s){
  const el = document.createElement('div'); el.innerHTML = s; return el.textContent || el.innerText || '';
}
