// client/src/pages/Games.js
import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import axios from 'axios';

import { AuthContext } from '../App';
import { API_BASE_URL } from '../config';

// Arenas (bots + online matchmaking)
import ChessArena from './ChessArena';
import CheckersArena from './CheckersArena';
import IceRacerArena from './IceRacerArena';
import JengaArena from './JengaArena';
import ArmArena from './ArmArena';
import JumpArena from './JumpArena';
import OddEvenArena from './OddEvenArena';
import GameSidebar from '../components/GameSidebar';

/* ------------------- Global fonts ------------------- */
const GamesFonts = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Exo+2:wght@700;800;900&display=swap');
`;

/* ------------------- Layout ------------------- */
const Page = styled.div` max-width: 1160px; margin: 0 auto; padding: 16px; `;

/* ======= Top bar ======= */
const TopBar = styled.nav`
  /* was: position: sticky; top: 72px; z-index: 12; */
  position: static;
  top: auto;
  z-index: 1;

  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 8px 18px rgba(0,0,0,.06);
`;

const TitleButton = styled.button`
  appearance: none;
  border: 0;
  background: linear-gradient(92deg, #ff8718 0%, #ffb95e 25%, #3b5cff 85%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-family: 'Exo 2', 'Bebas Neue', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  font-weight: 800;
  font-size: 38px;
  letter-spacing: 0.6px;
  line-height: 1;
  -webkit-text-stroke: 1.2px rgba(0,0,0,0.25);
  text-shadow: 0 1px 0 rgba(255,255,255,0.05), 0 3px 6px rgba(0,0,0,0.30);
  padding: 6px 10px;
  cursor: pointer;
  border-radius: 10px;
  transition: transform .08s ease-in-out, background .2s ease;
  white-space: nowrap;
  &:hover { transform: translateY(-1px) scale(1.02); }
  &:active { transform: translateY(0) scale(.99); }
`;

const TabButton = styled.button`
  appearance: none;
  border: 1px solid ${p => (p.$active ? '#111' : 'var(--border-color)')};
  background: ${p => (p.$active ? '#111' : '#fff')};
  color: ${p => (p.$active ? '#fff' : '#111')};
  font-weight: 800;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: background .15s ease, color .15s ease, transform .08s ease;
  white-space: nowrap;
  box-shadow: ${p => (p.$active ? '0 3px 10px rgba(0,0,0,.12)' : 'none')};
  &:hover { background: ${p => (p.$active ? '#111' : '#f6f7f9')}; transform: translateY(-1px); }
  &:active { transform: translateY(0); }
`;

const BarSeparator = styled.div` height: 10px; pointer-events: none; `;

/* ------------------- Cards & Grids ------------------- */
const Row = styled.div`
  display:grid; grid-template-columns: 360px 1fr; gap:16px; align-items:start;
`;
const Card = styled.div`
  background: var(--container-white);
  border: 1px solid var(--border-color);
  border-radius: 16px; padding: 14px;
  box-shadow: 0 10px 24px rgba(0,0,0,.06);
`;
const SectionTitle = styled.div` font-weight:900; margin-bottom:8px; `;
const Subtle = styled.div` font-size:12px; color:#6b7280; `;

const Grid = styled.div`
  display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:12px;
`;
const GameCard = styled.div`
  border:1px solid var(--border-color); border-radius:14px; padding:12px; background:#fff;
  display:flex; flex-direction:column; gap:8px; min-height: 112px;
  box-shadow: 0 6px 16px rgba(0,0,0,.05);
`;

const RankPill = styled.span`
  padding: 3px 10px; border-radius: 999px; font-weight: 900; font-size: 11px;
  color: #fff;
  background: ${p => ({
    Champion:'#7c3aed', Diamond:'#2563eb', Platinum:'#14b8a6',
    Gold:'#f59e0b', Silver:'#9ca3af', Bronze:'#b45309', Wood:'#374151'
  }[p.$rank] || '#374151')};
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.15), 0 4px 10px rgba(0,0,0,.12);
`;

/* ------------------- Game metadata ------------------- */
const GAMES = [
  { key:'chess',    name:'Chess',       icon:'♟️' },
  { key:'checkers', name:'Checkers',    icon:'⛀' },
  { key:'iceracer', name:'Ice Racer',   icon:'🛷' },
  { key:'jenga',    name:'Jenga',       icon:'🧱' },
  { key:'arm',      name:'Arm Wrestling', icon:'💪' },
  { key:'jump',     name:'Jump Game',   icon:'🦘' },
  { key:'oddeven',  name:'Odd or Even', icon:'🎲' },
];

/* Rank thresholds */
const perGameRank = (n) => {
  if (n >= 1500) return 'Champion';
  if (n >= 900)  return 'Diamond';
  if (n >= 600)  return 'Platinum';
  if (n >= 400)  return 'Gold';
  if (n >= 250)  return 'Silver';
  if (n >= 100)  return 'Bronze';
  return 'Wood';
};

/* ------------------- Stats hook ------------------- */
function useGameStats(userId) {
  const [stats, setStats] = useState({
    totalTrophies: 0,
    coins: 0,
    byGame: {},
  });

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await axios.get(`${API_BASE_URL}/api/games/stats/${userId}`);
    const byGame = {};
    GAMES.forEach(g => {
      const t = (data.trophiesByGame && data.trophiesByGame[g.key]) || 0;
      const sg = (data.statsByGame && data.statsByGame[g.key]) || {};
      byGame[g.key] = { trophies: t, wins: sg.wins || 0, losses: sg.losses || 0 };
    });
    setStats({ totalTrophies: data.totalTrophies || 0, coins: data.coins || 0, byGame });
  }, [userId]);

  const addResult = useCallback(async (gameKey, delta, didWin = null) => {
    if (!userId) return;
    await axios.post(`${API_BASE_URL}/api/games/result`, { userId, gameKey, delta, didWin });
    await load();
  }, [userId, load]);

  return { stats, load, addResult };
}

/* ------------------- 3D Avatar ------------------- */
const AvatarStage = styled.div`
  position: relative;
  aspect-ratio: 1 / 1; width: 100%; max-width: 320px; margin: 0 auto 8px;
  background: radial-gradient(120px 80px at 50% 105%, rgba(0,0,0,.25), transparent 60%),
              linear-gradient(#f8fafc, #eef2f7);
  border: 1px solid var(--border-color); border-radius: 14px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.6), 0 10px 24px rgba(0,0,0,.08);
  display:flex; align-items:center; justify-content:center;
  overflow: hidden;
`;

/* New: controls row under the viewport */
const AvatarControlsWrap = styled.div`
  position: relative; display:flex; justify-content:flex-end; margin: 8px auto 2px; max-width: 320px;
`;
const CustomizeBtn = styled.button`
  appearance:none; border:1px solid var(--border-color);
  background:#fff; border-radius:10px; padding:8px 12px; font-weight:900; cursor:pointer;
  box-shadow: 0 6px 14px rgba(0,0,0,.10);
  &:hover{ background:#f7f7f7; }
`;
const Popover = styled.div`
  position: absolute; right: 0; top: 44px; width: 280px;
  background:#fff; border:1px solid var(--border-color); border-radius:12px;
  box-shadow: 0 18px 40px rgba(0,0,0,.18); padding: 10px; z-index: 5;
`;

const OptionRow = styled.div` display:flex; gap:8px; flex-wrap:wrap; `;
const Opt = styled.button`
  appearance:none; border:1px solid ${p=>p.$active?'#111':'var(--border-color)'}; border-radius:10px;
  padding:8px 10px; background:${p=>p.$active?'#111':'#fff'}; color:${p=>p.$active?'#fff':'#111'};
  font-weight:800; font-size:12px; cursor:pointer;
  box-shadow:${p=>p.$active?'0 3px 10px rgba(0,0,0,.12)':'none'};
`;

function Avatar3D({ bodyColor='#111', hair='bald', hairColor='#111' }) {
  const wrapRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const stickRef = useRef(null);
  const hairRef = useRef(null);

  // Capsule limb helper
  const makeCapsule = useCallback((a, b, r = 0.08, mat) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const L = Math.max(len - 2 * r, 0.001);
    const geo = new THREE.CapsuleGeometry(r, L, 8, 16);
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
    return mesh;
  }, []);

  const rebuildHair = useCallback((group, headCenter, headR, color, style) => {
    while (group.children.length) group.remove(group.children[0]);
    if (style === 'bald') return;

    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 });

    if (style === 'long') {
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 1.06, 24, 18, 0, Math.PI * 2, 0, Math.PI / 1.8),
        mat
      );
      crown.position.copy(headCenter);
      crown.position.y += headR*0.15;
      group.add(crown);

      const back = new THREE.Mesh(
        new THREE.CylinderGeometry(headR*0.9, headR*0.9, headR*1.3, 16, 1, true),
        mat
      );
      back.position.copy(headCenter);
      back.position.y -= headR*0.15;
      back.rotation.x = Math.PI/2.1;
      group.add(back);
    } else if (style === 'cap') {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 1.03, 24, 14, 0, Math.PI * 2, 0, Math.PI / 1.8),
        mat
      );
      dome.position.copy(headCenter);
      dome.position.y += headR*0.15;
      group.add(dome);

      const brim = new THREE.Mesh(new THREE.CylinderGeometry(headR*0.9, headR*0.9, headR*0.12, 24, 1, true), mat);
      brim.position.set(headCenter.x, headCenter.y + headR*0.05, headCenter.z + headR*0.9);
      brim.rotation.x = Math.PI/2;
      group.add(brim);

      const front = new THREE.Mesh(new THREE.BoxGeometry(headR*1.5, headR*0.9, headR*0.15), mat);
      front.position.set(headCenter.x, headCenter.y + headR*0.25, headCenter.z + headR*0.55);
      group.add(front);
    }
  }, []);

  const recolorStick = useCallback((group, color) => {
    group.traverse(obj => {
      if (obj.isMesh && obj.userData.part !== 'hair') {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.color.set(color));
        else obj.material.color.set(color);
      }
    });
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    const w = el.clientWidth;
    const h = el.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    camera.position.set(0, 1.2, 4.4);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(2, 3, 2);
    scene.add(dir);

    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 0.08, 48),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9, metalness: 0 })
    );
    ground.position.y = -1.05;
    scene.add(ground);

    const stick = new THREE.Group();
    scene.add(stick);
    stickRef.current = stick;

    const limbMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.55, metalness: 0.05 });

    const headC = new THREE.Vector3(0, 0.6, 0);
    const headR = 0.28;
    const neck = new THREE.Vector3(0, 0.3, 0);
    const chest = new THREE.Vector3(0, 0.05, 0);
    const hip   = new THREE.Vector3(0, -0.35, 0);
    const lShoulder = new THREE.Vector3(-0.35, 0.12, 0);
    const rShoulder = new THREE.Vector3( 0.35, 0.12, 0);
    const lHand = new THREE.Vector3(-0.75, -0.06, 0);
    const rHand = new THREE.Vector3( 0.75, -0.06, 0);
    const lFoot = new THREE.Vector3(-0.22, -0.95, 0);
    const rFoot = new THREE.Vector3( 0.22, -0.95, 0);

    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 28, 22), new THREE.MeshStandardMaterial({
      color: 0xe8edf3, roughness: 0.8, metalness: 0.02
    }));
    head.position.copy(headC);
    stick.add(head);

    stick.add(makeCapsule(neck, chest, 0.09, limbMat));
    stick.add(makeCapsule(chest, hip, 0.1, limbMat));
    stick.add(makeCapsule(lShoulder, lHand, 0.085, limbMat));
    stick.add(makeCapsule(rShoulder, rHand, 0.085, limbMat));
    stick.add(makeCapsule(hip, lFoot, 0.09, limbMat));
    stick.add(makeCapsule(hip, rFoot, 0.09, limbMat));

    const hairGroup = new THREE.Group();
    hairGroup.userData.part = 'hair';
    stick.add(hairGroup);
    hairRef.current = hairGroup;
    rebuildHair(hairGroup, headC, headR, hairColor, hair);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI/3;
    controls.maxPolarAngle = Math.PI/1.8;
    controls.rotateSpeed = 0.8;
    controlsRef.current = controls;

    const handleResize = () => {
      if (!rendererRef.current) return;
      const w2 = el.clientWidth, h2 = el.clientHeight;
      renderer.setSize(w2, h2);
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(el);

    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      while (el.firstChild) el.removeChild(el.firstChild);
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m=>m.dispose?.());
          else obj.material.dispose?.();
        }
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stickRef.current) recolorStick(stickRef.current, new THREE.Color(bodyColor));
  }, [bodyColor, recolorStick]);
  useEffect(() => {
    if (hairRef.current) {
      const headCenter = new THREE.Vector3(0, 0.6, 0);
      const headR = 0.28;
      rebuildHair(hairRef.current, headCenter, headR, new THREE.Color(hairColor), hair);
    }
  }, [hair, hairColor, rebuildHair]);

  return <div ref={wrapRef} style={{width:'100%', height:'100%'}} aria-label="3D Avatar"/>;
}

/* ------------------- Main Page ------------------- */
export default function Games() {
  const { user } = useContext(AuthContext);
  const { stats, load, addResult } = useGameStats(user?._id);

  const [view, setView] = useState('home');

  // customization state
  const [avatar, setAvatar] = useState({ color:'#111', hair:'bald', hairColor:'#111' });
  const [showAvatarPanel, setShowAvatarPanel] = useState(false);

  const [chessSet, setChessSet] = useState('Classic');
  const [checkersSet, setCheckersSet] = useState('Red/Black');
  const [racer, setRacer] = useState('Sled');
  const [jengaSet, setJengaSet] = useState('Natural');

  useEffect(() => { if (user?._id) load(); }, [user?._id, load]);

  const onResult = async (gameKey, delta, didWin) => {
    try { await addResult(gameKey, delta, didWin); }
    catch (e) { console.error(e); alert('Failed to save result'); }
  };

  const byGame = stats.byGame || {};
  const getGame = (k) => byGame[k] || { trophies:0, wins:0, losses:0 };

  /* ---------- Overall Leaderboard (inline helper) ---------- */
  const OverallLeaderboard = () => {
    const [leaders, setLeaders] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      let alive = true;
      (async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/games/leaderboard/overall?limit=10`);
          const data = await res.json();
          if (!alive) return;
          setLeaders(data?.leaders || []);
        } catch {
          setLeaders([]);
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => { alive = false; };
    }, []);

    return (
      <Card>
        <SectionTitle>Overall Leaderboard</SectionTitle>
        {loading ? (
          <Subtle>Loading…</Subtle>
        ) : leaders.length === 0 ? (
          <Subtle>No data yet.</Subtle>
        ) : (
          <>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, alignItems:'end', marginBottom:8}}>
              {[leaders[1], leaders[0], leaders[2]].map((p, i) => (
                <div key={i} style={{
                  background:'linear-gradient(180deg,#f3f4f6,#e5e7eb)',
                  border:'1px solid var(--border-color)', borderRadius:10,
                  height: i===1 ? 92 : 70, display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center'
                }}>
                  <div style={{fontWeight:800, fontSize:12}}>{p?.username || '-'}</div>
                  <div style={{fontSize:11, color:'#6b7280'}}>{p?.score ?? ''} 🏆</div>
                </div>
              ))}
            </div>
            <div style={{display:'grid', gap:6}}>
              {leaders.slice(3, 10).map((p, idx) => (
                <div key={p.userId || idx} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  fontSize:13, padding:'6px 8px', borderRadius:10, border:'1px solid var(--border-color)', background:'#fff'
                }}>
                  <div><span style={{fontSize:12, color:'#6b7280'}}>#{idx+4}</span> &nbsp; {p.username}</div>
                  <div>{p.score} 🏆</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    );
  };

  /* --------- Home (Dashboard) --------- */
  const Home = (
    <Row>
      {/* LEFT: Customization & Avatar */}
      <Card>
        <SectionTitle>Customization</SectionTitle>

        <AvatarStage>
          <Avatar3D
            bodyColor={avatar.color}
            hair={avatar.hair}
            hairColor={avatar.hairColor}
          />
        </AvatarStage>

        {/* Button and popover BELOW the viewport */}
        <AvatarControlsWrap>
          <CustomizeBtn onClick={()=>setShowAvatarPanel(v=>!v)} aria-haspopup="dialog" aria-expanded={showAvatarPanel}>
            ⚙️ Customize Avatar
          </CustomizeBtn>
          {showAvatarPanel && (
            <Popover role="dialog" aria-label="Avatar customization">
              <div style={{fontWeight:900, marginBottom:6}}>Avatar</div>
              <Subtle style={{marginBottom:6}}>Spin the model by dragging. Pick hair & colors here.</Subtle>

              <div style={{fontWeight:800, marginTop:6}}>Hair</div>
              <OptionRow>
                {[
                  ['Bald','bald'],
                  ['Long Hair','long'],
                  ['Trucker Hat','cap'],
                ].map(([label,val])=>(
                  <Opt key={val} $active={avatar.hair===val} onClick={()=>setAvatar(a=>({...a, hair:val}))}>
                    {label}
                  </Opt>
                ))}
              </OptionRow>

              <div style={{fontWeight:800, marginTop:8}}>Hair Color</div>
              <OptionRow>
                {[
                  ['White','#ffffff'], ['Black','#111111'], ['Red','#ff0000'], ['Blue','#1e3a8a'], ['Yellow','#facc15']
                ].map(([name,val])=>(
                  <Opt key={name} $active={avatar.hairColor===val} onClick={()=>setAvatar(a=>({...a, hairColor:val}))}>
                    {name}
                  </Opt>
                ))}
              </OptionRow>

              <div style={{fontWeight:800, marginTop:8}}>Body Color</div>
              <OptionRow>
                {[
                  ['White','#ffffff'], ['Black','#111111'], ['Red','#ef4444'], ['Blue','#1e3a8a'], ['Yellow','#facc15']
                ].map(([name,val])=>(
                  <Opt key={name} $active={avatar.color===val} onClick={()=>setAvatar(a=>({...a, color:val}))}>
                    {name}
                  </Opt>
                ))}
              </OptionRow>
            </Popover>
          )}
        </AvatarControlsWrap>

        <hr style={{margin:'14px 0'}}/>
        <SectionTitle>Chess Set</SectionTitle>
        <OptionRow>
          {['Classic','Neo','Wood'].map(s=>(
            <Opt key={s} $active={chessSet===s} onClick={()=>setChessSet(s)}>{s}</Opt>
          ))}
        </OptionRow>

        <SectionTitle style={{marginTop:10}}>Checkers Set</SectionTitle>
        <OptionRow>
          {['Red/Black','Cream/Brown','Blue/White'].map(s=>(
            <Opt key={s} $active={checkersSet===s} onClick={()=>setCheckersSet(s)}>{s}</Opt>
          ))}
        </OptionRow>

        <SectionTitle style={{marginTop:10}}>Ice Racer Mount</SectionTitle>
        <OptionRow>
          {['Sled','Inner Tube','Crate'].map(s=>(
            <Opt key={s} $active={racer===s} onClick={()=>setRacer(s)}>{s}</Opt>
          ))}
        </OptionRow>

        <SectionTitle style={{marginTop:10}}>Jenga Set</SectionTitle>
        <OptionRow>
          {['Natural','Midnight','Candy'].map(s=>(
            <Opt key={s} $active={jengaSet===s} onClick={()=>setJengaSet(s)}>{s}</Opt>
          ))}
        </OptionRow>

        <Subtle style={{marginTop:12}}>
          More cosmetics soon. For games without their own sets, your avatar appears in-game.
        </Subtle>
      </Card>

      {/* RIGHT: Overall rank + Your Games + Overall leaderboard */}
      <div style={{ display: 'grid', gap: 12 }}>
        {/* Overall rank card */}
        <Card>
          <SectionTitle>Overall Rank</SectionTitle>
          {(() => {
            const totalTrophies = typeof stats.totalTrophies === 'number'
              ? stats.totalTrophies
              : GAMES.reduce((sum, g) => sum + getGame(g.key).trophies, 0);
            const overallRank = perGameRank(totalTrophies);
            return (
              <>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
                  <RankPill $rank={overallRank} title={`Rank: ${overallRank}`}>{overallRank}</RankPill>
                  <div style={{fontWeight:900}}>🏆 {totalTrophies}</div>
                </div>
                <Subtle style={{marginTop:6}}>Sum of trophies across all games.</Subtle>
              </>
            );
          })()}
        </Card>

        <Card>
          <SectionTitle>Your Games</SectionTitle>
          <Grid>
            {GAMES.map(g => {
              const s = getGame(g.key);
              const rank = perGameRank(s.trophies);
              return (
                <GameCard key={g.key}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                    <div style={{ fontWeight: 900, display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{fontSize:18}} aria-hidden>{g.icon}</span>
                      {g.name}
                    </div>
                    <RankPill $rank={rank} title={`Rank: ${rank}`}>{rank} · 🏆 {s.trophies}</RankPill>
                  </div>
                  <Subtle>Record: <b>{s.wins}</b>-<b>{s.losses}</b></Subtle>
                  <button onClick={() => setView(g.key)} style={{ alignSelf: 'flex-start' }}>Play</button>
                </GameCard>
              );
            })}
          </Grid>
        </Card>

        {/* Overall leaderboard (replaces placeholder) */}
        <OverallLeaderboard />
      </div>
    </Row>
  );

  /* --------- Specific Game View --------- */
  const GameView = (
    <Row>
      {/* LEFT: Game hub (Title • Rank • Leaderboard • Recent games) */}
      <GameSidebar
        gameKey={view}
        title={GAMES.find(g => g.key === view)?.name}
      />

      {/* RIGHT: Active Game Arena */}
      <Card>
        {view === 'chess'    && <ChessArena />}                   {/* Unranked */}
        {view === 'checkers' && <CheckersArena onResult={onResult} />}
        {view === 'iceracer' && <IceRacerArena onResult={onResult} />}
        {view === 'jenga'    && <JengaArena onResult={onResult} />}
        {view === 'arm'      && <ArmArena onResult={onResult} />}
        {view === 'jump'     && <JumpArena onResult={onResult} />}
        {view === 'oddeven'  && <OddEvenArena onResult={onResult} />}
      </Card>
    </Row>
  );

  return (
    <Page>
      <GamesFonts />
      <TopBar role="tablist" aria-label="Games">
        <TitleButton role="tab" aria-selected={view === 'home'} onClick={() => setView('home')} title="Back to Games profile">
          Games
        </TitleButton>
        {GAMES.map(g => (
          <TabButton key={g.key} role="tab" $active={view === g.key} aria-selected={view === g.key} onClick={() => setView(g.key)} title={g.name}>
            {g.name}
          </TabButton>
        ))}
      </TopBar>
      <BarSeparator />
      {view === 'home' ? Home : GameView}
    </Page>
  );
}
