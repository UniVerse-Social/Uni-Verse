// client/src/pages/IceRacerArena.jsx
import React, { useContext, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { AuthContext } from '../App';
import { useMatchmaking } from '../games/useMatchmaking';
import { API_BASE_URL } from '../config';

/* -------------------------------- UI (same sizing vibe as Chess) ------------------------------- */
const Wrap = styled.div`display:grid; grid-template-columns: 480px 1fr; gap:16px; align-items:start;`;
const Panel = styled.div`border:1px solid var(--border-color); background:var(--container-white); border-radius:12px; padding:12px;`;
const Button = styled.button`
  padding: 8px 12px; border-radius: 10px; border: 1px solid #111; cursor: pointer;
  background: ${p=>p.$primary ? '#111' : '#fff'}; color: ${p=>p.$primary ? '#fff' : '#111'};
`;
const Alert = styled.div`
  margin-top: 10px; padding: 8px 10px; border-radius: 10px;
  border: 1px solid #e5e7eb; background: #f9fafb; color: #111827; font-size: 13px;
`;
const CanvasWrap = styled.div`
  position: relative; width: 456px; height: 342px;  /* 4:3 — matches chess board width */
  border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,.08);
`;
const Overlay = styled.div`
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none;
  background: radial-gradient(transparent 60%, rgba(0,0,0,.15));
`;
const Title = styled.div`
  text-align:center; color:#fff; font-weight:800; letter-spacing:.5px;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
  > div:first-child { font-size: 28px; }
  > div:last-child { font-size: 12px; color:#374151; font-weight:600; margin-top: 2px; }
`;

/* -------------------------------- helpers -------------------------------- */
const now = () => (performance.now ? performance.now() : Date.now());
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function seeded(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
async function loadThree() {
  if (window.THREE) return window.THREE;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/three@0.155.0/build/three.min.js';
    s.onload = res; s.onerror = () => rej(new Error('Failed to load three.js'));
    document.head.appendChild(s);
  });
  return window.THREE;
}
async function postResult(userId, delta) {
  try {
    await fetch(`${API_BASE_URL}/api/games/result`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, gameKey: 'iceracer', delta }),
    });
  } catch {}
}

/* ------------------------- track building (ribbon + walls) ------------------------- */
function buildRibbon(THREE, curve, width = 10, segments = 700) {
  const positions = new Float32Array(segments * 2 * 3);
  const uvs = new Float32Array(segments * 2 * 2);
  const idx = [];
  const half = width / 2;

  const tmpPos = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const left = new THREE.Vector3();

  const pts = [];
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1);
    curve.getPointAt(t, tmpPos);
    curve.getTangentAt(t, tangent);
    left.crossVectors(new THREE.Vector3(0, 1, 0), tangent).normalize();

    const L = tmpPos.clone().add(left.clone().multiplyScalar(half));
    const R = tmpPos.clone().add(left.clone().multiplyScalar(-half));
    pts.push({ t, L, R });

    const i2 = i * 2;
    positions.set([L.x, 0.02, L.z], i2 * 3);
    positions.set([R.x, 0.02, R.z], (i2 + 1) * 3);

    uvs.set([0, t * 20], i2 * 2);
    uvs.set([1, t * 20], (i2 + 1) * 2);

    if (i < segments - 1) {
      const a = i2, b = i2 + 1, c = i2 + 2, d = i2 + 3;
      idx.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 1 }));
  road.receiveShadow = true;

  const wallGroup = new THREE.Group();
  const wallGeo = new THREE.BoxGeometry(0.5, 1.2, 2.0);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.05, roughness: 0.9 });

  for (let i = 0; i < pts.length; i += 3) {
    const p = pts[i];
    for (const P of [p.L, p.R]) {
      const w = new THREE.Mesh(wallGeo, wallMat);
      w.position.set(P.x, 0.6, P.z);
      wallGroup.add(w);
    }
  }

  function nearestU(uGuess, x, z) {
    let bestU = uGuess, bestD = Infinity;
    for (let i = -20; i <= 20; i++) {
      let u = uGuess + i * (1 / segments) * 4;
      while (u < 0) u += 1;
      while (u >= 1) u -= 1;
      const pt = curve.getPointAt(u);
      const dx = pt.x - x, dz = pt.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; bestU = u; }
    }
    return bestU;
  }

  return { road, walls: wallGroup, nearestU, halfWidth: half };
}

/* ----------------------------------- themes ----------------------------------- */
function makeTheme(THREE, themeName) {
  const V = THREE.Vector3;
  const mk = (arr) => new THREE.CatmullRomCurve3(arr.map(a => new V(...a)), true, 'catmullrom', 0.2);

  const themes = {
    snowy: {
      sky: 0x87b6d8, ground: 0xe9f2f9, roadColor: 0xffffff, wallColor: 0x556677,
      points: [[0,0,0],[40,0,60],[100,0,80],[140,0,30],[90,0,-30],[20,0,-50],[-20,0,-10]],
      deco: (scene) => {
        const treeGeo = new THREE.ConeGeometry(2.2, 6, 8);
        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.6, 2);
        const green = new THREE.MeshStandardMaterial({ color:0x2f6b3b, roughness:0.9 });
        const brown = new THREE.MeshStandardMaterial({ color:0x8b5a2b });
        for (let i=0;i<120;i++){
          const t = Math.random()*2*Math.PI;
          const r = 120 + Math.random()*120;
          const x = Math.cos(t)*r, z = Math.sin(t)*r;
          const trunk = new THREE.Mesh(trunkGeo, brown); trunk.position.set(x,1, z);
          const top = new THREE.Mesh(treeGeo, green); top.position.set(x,4, z);
          scene.add(trunk); scene.add(top);
        }
      }
    },
    city: {
      sky: 0xaad0ff, ground: 0xdadada, roadColor: 0x333333, wallColor: 0x777777,
      points: [[0,0,0],[30,0,90],[80,0,110],[140,0,40],[90,0,-60],[20,0,-60],[-40,0,0]],
      deco: (scene) => {
        const box = (w,h,d,c,x,z)=>{
          const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshStandardMaterial({color:c, roughness:.8}));
          m.position.set(x,h/2,z); scene.add(m);
        };
        for (let i=0;i<60;i++){
          const t = Math.random()*2*Math.PI;
          const r = 140 + Math.random()*100;
          const x = Math.cos(t)*r, z = Math.sin(t)*r;
          box(8+Math.random()*10, 10+Math.random()*40, 8+Math.random()*10, 0x8088a0, x, z);
        }
      }
    },
    geode: {
      sky: 0x301040, ground: 0x3a1f5f, roadColor: 0x5b2a91, wallColor: 0x9b59b6,
      points: [[0,0,0],[60,0,30],[100,0,-10],[110,0,-70],[50,0,-90],[-10,0,-60],[-40,0,-10],[-10,0,40]],
      deco: (scene) => {
        const mat = new THREE.MeshStandardMaterial({ color:0xc08cff, emissive:0x4a0e7a, emissiveIntensity:0.5, roughness:0.6 });
        for (let i=0;i<80;i++){
          const g = new THREE.ConeGeometry(1+Math.random()*2, 3+Math.random()*5, 6);
          const m = new THREE.Mesh(g, mat);
          const t = Math.random()*2*Math.PI, r = 100 + Math.random()*100;
          m.position.set(Math.cos(t)*r, 0.5, Math.sin(t)*r);
          scene.add(m);
        }
      }
    },
    jungle: {
      sky: 0x87d89e, ground: 0xa6e1a4, roadColor: 0x7b5e57, wallColor: 0x3f5b2b,
      points: [[0,0,0],[40,0,40],[100,0,50],[140,0,0],[110,0,-50],[50,0,-70],[-20,0,-40],[-20,0,20]],
      deco: (scene) => {
        const trunkMat = new THREE.MeshStandardMaterial({ color:0x8b5a2b });
        const leafMat = new THREE.MeshStandardMaterial({ color:0x2e7d32, roughness:.9 });
        for (let i=0;i<120;i++){
          const x = (Math.random()-.5)*400, z = (Math.random()-.5)*400;
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.7,3), trunkMat);
          trunk.position.set(x,1.5,z); scene.add(trunk);
          const crown = new THREE.Mesh(new THREE.SphereGeometry(2.4,14,12), leafMat);
          crown.position.set(x,3.9,z); scene.add(crown);
        }
      }
    }
  };

  const t = themes[themeName];
  const curve = mk(t.points);
  return { ...t, curve };
}

/* ==================================== PAGE ==================================== */
export default function IceRacerArena() {
  const { user } = useContext(AuthContext);
  const mm = useMatchmaking('iceracer', user);

  const [mode, setMode] = useState(null); // null | 'bot' | 'online'
  const [status, setStatus] = useState('Pick a mode to start.');
  const [notice] = useState(''); // keep state value for optional future notices (no setter to satisfy eslint)
  const [raceInfo, setRaceInfo] = useState(null); // { themeName, laps, mapId }
  const canvasRef = useRef(null);

  // preview / game shared refs
  const threeRef = useRef(null);
  const sceneRef = useRef(null);
  const camRef = useRef(null);
  const rendRef = useRef(null);
  const animRef = useRef(null);
  const stopFns = useRef([]);
  const previewTick = useRef(0);
  const previewThemeIndex = useRef(0);
  const previewTimer = useRef(null);

  const clearScene = () => {
    cancelAnimationFrame(animRef.current);
    if (stopFns.current) { stopFns.current.forEach(fn => { try { fn(); } catch {} }); }
    stopFns.current = [];
    if (sceneRef.current) {
      while (sceneRef.current.children.length) sceneRef.current.remove(sceneRef.current.children[0]);
    }
  };

  const ensureRenderer = async () => {
    const THREE = await loadThree();
    threeRef.current = THREE;
    if (!rendRef.current) {
      const r = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
      r.setSize(456, 342, false); // fixed, matches Chess board footprint
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      rendRef.current = r;
    }
    if (!sceneRef.current) sceneRef.current = new THREE.Scene();
    if (!camRef.current) {
      const c = new THREE.PerspectiveCamera(60, 4/3, 0.1, 1000);
      c.position.set(0, 6, 10);
      camRef.current = c;
    }
    return THREE;
  };

  /* -------------------- PREVIEW: rotating themed backdrop with gentle motion -------------------- */
  const startPreview = async () => {
    const THREE = await ensureRenderer();
    clearScene();

    const themes = ['snowy','city','geode','jungle'];
    const themeName = themes[previewThemeIndex.current % themes.length];
    const theme = makeTheme(THREE, themeName);

    sceneRef.current.background = new THREE.Color(theme.sky);

    const amb = new THREE.AmbientLight(0xffffff, 0.9); sceneRef.current.add(amb);
    const sun = new THREE.DirectionalLight(0xffffff, 0.85); sun.position.set(40,80,20); sceneRef.current.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(800,800),
      new THREE.MeshLambertMaterial({ color: theme.ground })
    );
    ground.rotation.x = -Math.PI/2; sceneRef.current.add(ground);

    const ribbon = buildRibbon(THREE, theme.curve, 10, 700);
    ribbon.road.material.color.setHex(theme.roadColor);
    ribbon.walls.children.forEach(w => w.material.color.setHex(theme.wallColor));
    sceneRef.current.add(ribbon.road, ribbon.walls);

    theme.deco(sceneRef.current);

    // ghost "camera glide" along the track
    let u = (previewTick.current % 1 + 1) % 1;
    const loop = () => {
      u = (u + 0.0009) % 1;
      previewTick.current = u;
      const pt = theme.curve.getPointAt(u);
      const tan = theme.curve.getTangentAt(u);
      const back = tan.clone().multiplyScalar(-8);
      const camPos = pt.clone().add(back); camPos.y = 4.8;
      camRef.current.position.lerp(camPos, 0.06);
      camRef.current.lookAt(pt.x, 1.6, pt.z);

      rendRef.current.render(sceneRef.current, camRef.current);
      animRef.current = requestAnimationFrame(loop);
    };
    loop();

    // rotate theme every 10s
    if (previewTimer.current) clearInterval(previewTimer.current);
    previewTimer.current = setInterval(() => {
      previewThemeIndex.current = (previewThemeIndex.current + 1) % themes.length;
      startPreview();
    }, 10000);

    // cleanup for this preview run
    stopFns.current.push(() => { if (previewTimer.current) { clearInterval(previewTimer.current); previewTimer.current = null; }});
  };

  /* -------------------- GAME: full race -------------------- */
  const startRace = async ({ practice, roster, themeName, seed, startAt, roomId }) => {
    const THREE = await ensureRenderer();
    clearScene();
    setStatus(practice ? 'Practice: finish 2 laps!' : 'Matched! Starting…');

    const theme = makeTheme(THREE, themeName);
    const scene = sceneRef.current;

    scene.background = new THREE.Color(theme.sky);
    const amb = new THREE.AmbientLight(0xffffff, 0.85); scene.add(amb);
    const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(40,80,20); scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800,800), new THREE.MeshLambertMaterial({ color: theme.ground }));
    ground.rotation.x = -Math.PI/2; scene.add(ground);

    const ribbon = buildRibbon(THREE, theme.curve, 10, 700);
    ribbon.road.material.color.setHex(theme.roadColor);
    ribbon.walls.children.forEach(w => w.material.color.setHex(theme.wallColor));
    scene.add(ribbon.road); scene.add(ribbon.walls);
    theme.deco(scene);

    const racers = roster.map((p, i) => ({
      id: p.id, isBot: !!p.isBot, skill: p.isBot ? (p.skill || 4) : 5,
      username: p.username || (p.isBot ? `BOT-${i}` : 'Player'),
      node: avatarMesh(THREE, p.isBot ? '#444':'#111'),
      u: (i * 0.02) % 1, lap: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(0,0,0),
    }));
    racers.forEach(r => scene.add(r.node));

    // choose "me" (first non-bot)
    const me = racers.find(r => !r.isBot) || racers[0];

    // position on start
    for (let i=0;i<racers.length;i++){
      const u = i * 0.02;
      const pt = theme.curve.getPointAt(u);
      racers[i].u = u;
      racers[i].pos.copy(pt); racers[i].pos.y = 0.02;
      racers[i].node.position.copy(racers[i].pos);
      racers[i].node.lookAt(theme.curve.getPointAt((u+0.01)%1));
    }

    const nearestU = ribbon.nearestU;
    const halfWidth = ribbon.halfWidth;
    const laps = 2;
    const finished = new Set(); const order = [];

    function nearestAndClamp(racer) {
      const prevU = racer.u || 0;
      const u = nearestU(prevU, racer.pos.x, racer.pos.z);
      racer.u = u;
      const pt = theme.curve.getPointAt(u);
      const tan = theme.curve.getTangentAt(u);
      const left = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), tan).normalize();
      const toPt = new THREE.Vector3(racer.pos.x-pt.x,0,racer.pos.z-pt.z);
      const lateral = left.dot(toPt);
      const maxLat = halfWidth * 0.95;
      if (Math.abs(lateral) > maxLat) {
        const corr = clamp(lateral, -maxLat, maxLat) - lateral;
        racer.pos.addScaledVector(left, corr);
        racer.vel.multiplyScalar(0.7);
      }
    }

    // inputs
    const input = { accel:false, left:false, right:false };
    const onKey = (e,d)=>{ if(e.key==='ArrowUp')input.accel=d; if(e.key==='ArrowLeft')input.left=d; if(e.key==='ArrowRight')input.right=d; };
    const kd = e=>onKey(e,true), ku=e=>onKey(e,false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    stopFns.current.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); });

    function advanceBot(R, dt) {
      const targetSpeed = 8 + R.skill * 2.2;
      R.u = (R.u + dt * (targetSpeed / 600)) % 1;
      const P = theme.curve.getPointAt(R.u);
      const T = theme.curve.getTangentAt(R.u);
      const L = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), T).normalize();
      const side = (Math.random() - 0.5) * (6 - R.skill) * 0.3;
      R.pos.set(P.x, 0.02, P.z).addScaledVector(L, side);
      const desired = new THREE.Vector3().copy(T).multiplyScalar(targetSpeed * 0.2);
      R.vel.lerp(desired, 0.5);
      R.node.position.copy(R.pos);
      R.node.lookAt(new THREE.Vector3().addVectors(P, T));
      if (R.u < 0.02 && R._lastU > 0.8) {
        R.lap += 1;
        if (R.lap >= laps && !finished.has(R.id)) { finished.add(R.id); order.push(R); if (R===me) onFinish(order); }
      }
      R._lastU = R.u;
    }

    function advanceMe(R, dt) {
      const near = theme.curve.getTangentAt(R.u);
      const forward = new THREE.Vector3(near.x,0,near.z).normalize();
      const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (steer !== 0) {
        const rightVec = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), forward).normalize();
        R.vel.addScaledVector(rightVec, -steer * 6 * dt);
      }
      if (input.accel) R.vel.addScaledVector(forward, 18*dt);
      R.vel.multiplyScalar(1 - 2*dt);
      const speed = R.vel.length();
      const maxSpeed = 20;
      if (speed > maxSpeed) R.vel.multiplyScalar(maxSpeed/speed);
      R.pos.addScaledVector(R.vel, dt);
      nearestAndClamp(R);
      R.pos.y = 0.02;
      R.node.position.copy(R.pos);
      R.node.lookAt(new THREE.Vector3().set(R.pos.x + R.vel.x, 0.02, R.pos.z + R.vel.z));
      const newU = nearestU(R.u, R.pos.x, R.pos.z);
      if (newU < 0.02 && R._lastU > 0.8) {
        R.lap += 1;
        if (R.lap >= laps && !finished.has(R.id)) { finished.add(R.id); order.push(R); onFinish(order); }
      }
      R._lastU = newU; R.u = newU;
      if (roomId && (Date.now() % 100 < 16)) mm.send('pos', { u: R.u, lap: R.lap });
    }

    function onFinish(orderArr) {
      const place = orderArr.findIndex(x => x.id === me.id) + 1;
      const msg = `Finished! Place: ${place}/${racers.length}`;
      if (practice) {
        setStatus(`${msg} (Practice: no trophies)`);
      } else {
        const deltaByPlace = [15,10,6,3,1];
        const delta = deltaByPlace[Math.min(place, deltaByPlace.length)-1] || 1;
        setStatus(`${msg} (+${delta} trophies)`);
        if (user?._id) postResult(user._id, delta);
      }
    }

    const t0 = startAt ? startAt - Date.now() : 800;
    let startTs = now() + Math.max(0, t0);
    let lastTs = now();

    const frame = () => {
      const t = now();
      const dt = Math.min(50, t - lastTs) / 1000;
      lastTs = t;

      if (Math.max(0, (startTs - t)/1000) <= 0) {
        for (const R of racers) (R === me || !R.isBot) ? advanceMe(me, dt) : advanceBot(R, dt);
        const meDir = me.vel.clone().normalize();
        const offset = meDir.length() ? meDir.clone().multiplyScalar(-8) : theme.curve.getTangentAt(me.u).multiplyScalar(-8);
        const targetCam = new THREE.Vector3().copy(me.pos).add(offset); targetCam.y = 5;
        camRef.current.position.lerp(targetCam, 0.1);
        camRef.current.lookAt(me.pos.x, 1.6, me.pos.z);
      }
      rendRef.current.render(sceneRef.current, camRef.current);
      animRef.current = requestAnimationFrame(frame);
    };
    frame();
  };

  function avatarMesh(THREE, color='#111'){
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color });
       const head = new THREE.Mesh(new THREE.SphereGeometry(1.2,16,16), mat); head.position.y=3.8; g.add(head);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.8,2.3,6,12), mat); body.position.y=2.2; g.add(body);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.4,1.2,6,12), mat);
    const arm2 = arm.clone(); arm.position.set(-1.1,2.3,0.1); arm2.position.set(1.1,2.3,-0.1); g.add(arm,arm2);
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.8,0.25,1.2), new THREE.MeshStandardMaterial({color:'#333'}));
    board.position.y=0.2; g.add(board);
    return g;
  }

  /* ------------------------ matchmaking hooks ------------------------ */
  useEffect(() => {
    if (mode !== 'online') return;
    mm.queue();
    setStatus('Looking for opponents…');
    const off = mm.on((type/*, payload*/) => {
      if (type === 'pos') { /* position sync handled in startRace */ }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode !== 'online' || !mm.raceMeta || !mm.roster) return;
    const themeName = ['snowy','city','geode','jungle'][mm.raceMeta.mapId % 4];
    setRaceInfo({ themeName, laps: mm.raceMeta.laps, mapId: mm.raceMeta.mapId });
    startRace({ practice:false, roster:mm.roster, startAt:mm.raceMeta.startAt, seed:mm.seed, roomId:mm.roomId, themeName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mm.roomId, mm.raceMeta, mm.roster]);

  /* ------------------------ lifecycle: preview on idle ------------------------ */
  useEffect(() => {
    if (mode === null) startPreview();
    return () => { cancelAnimationFrame(animRef.current); if (previewTimer.current) clearInterval(previewTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /* --------------------------------- Actions --------------------------------- */
  const startPractice = async () => {
    setMode('bot');
    const seed = (Math.random()*1e9)|0;
    const r = seeded(seed);
    const bots = Array.from({length:4}).map((_,i)=>({ id:`bot-${i+1}`, isBot:true, skill: 1 + Math.floor(r()*5), username:`BOT-${i+1}` }));
    const roster = [{ id:'me', isBot:false, userId:user?._id, username:user?.username }, ...bots];
    const mapId = Math.floor(r()*4);
    const themeName = ['snowy','city','geode','jungle'][mapId];
    setRaceInfo({ themeName, laps:2, mapId });
    startRace({ practice:true, roster, seed, themeName });
  };

  const leaveOnline = () => {
    mm.leave();
    setMode(null);
    setStatus('Pick a mode to start.');
    setRaceInfo(null);
    startPreview();
  };

  const looking = mode==='online' && !mm.roomId;
  const lobbyStr = looking && (mm.lobbySize || mm.lobbyCount) ? ` (${mm.lobbyCount}/${mm.lobbySize} players)` : '';

  return (
    <Wrap>
      {/* LEFT: game canvas (fixed size to match Chess board visual weight) */}
      <Panel>
        <CanvasWrap>
          <canvas ref={canvasRef} />
          {mode === null && (
            <Overlay>
              <Title>
                <div>Ice Racer</div>
                <div>Choose a mode to start</div>
              </Title>
            </Overlay>
          )}
        </CanvasWrap>
      </Panel>

      {/* RIGHT: controls */}
      <Panel>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <Button onClick={startPractice}>Practice vs Bot</Button>
          {mode !== 'online' ? (
            <Button $primary onClick={()=> setMode('online')}>Play Online</Button>
          ) : (
            <Button onClick={leaveOnline}>Resign</Button>
          )}
        </div>

        <div style={{marginTop:10, color:'#555'}}>
          {mode === 'online'
            ? (looking ? (`Looking for opponents…${lobbyStr}`) : 'Match found. Loading…')
            : status}
        </div>
        {!!notice && <Alert>{notice}</Alert>}

        <div style={{marginTop:12, fontSize:12, color:'#6b7280'}}>
          Wins vs real players grant <b>trophies</b>. Bot games are unranked.
        </div>

        {raceInfo && (
          <div style={{marginTop:12, fontSize:12, color:'#6b7280'}}>
            Theme: <b>{raceInfo.themeName?.toUpperCase()}</b> • Laps: <b>2</b>
          </div>
        )}

        <div style={{marginTop:12, fontSize:12, color:'#6b7280'}}>
          Controls: <b>Up</b> to accelerate • <b>Left/Right</b> to steer
        </div>
      </Panel>
    </Wrap>
  );
}
