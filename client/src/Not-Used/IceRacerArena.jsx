import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
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

/* ------------------------- visual helpers ------------------------- */
function makeCheckerTexture(THREE, cells = 8, light = '#ffffff', dark = '#000000') {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size; const ctx = c.getContext('2d');
  const cell = size / cells;
  for (let y=0;y<cells;y++) for (let x=0;x<cells;x++) {
    ctx.fillStyle = (x+y)%2===0 ? light : dark; ctx.fillRect(x*cell,y*cell,cell,cell);
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  return tex;
}

function makeNoiseTexture(THREE, {size=256, base='#888', accent='#aaa', speck='#666'}={}){
  const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0,0,size,size);
  ctx.globalAlpha = 0.25; ctx.fillStyle = accent;
  for (let i=0;i<1200;i++){
    const w = 1 + Math.random()*3, h = 1 + Math.random()*3;
    ctx.fillRect(Math.random()*size, Math.random()*size, w, h);
  }
  ctx.globalAlpha = 0.15; ctx.fillStyle = speck;
  for (let i=0;i<800;i++) ctx.fillRect(Math.random()*size, Math.random()*size, 1, 1);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8; return tex;
}

function makeStripedTexture(THREE, {size=256, bands=8, a='#00e6ff', b='#b3f4ff'}={}){
  const c = document.createElement('canvas'); c.width = size; c.height = size; const ctx = c.getContext('2d');
  const h = size / bands;
  for (let i=0;i<bands;i++){
    ctx.fillStyle = (i%2===0)?a:b; ctx.fillRect(0, i*h, size, h);
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8; return tex;
}

function addStartFinishGate(THREE, scene, curve, width, opts={}){
  const u = 0; // start at curve parameter 0
  const P = curve.getPointAt(u);
  const T = curve.getTangentAt(u);
  const L = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), T).normalize();
  const gateOffset = (opts.gateOffset != null ? opts.gateOffset : 0);
  const center = P.clone().addScaledVector(T, gateOffset);

  // Posts
  const postH = 3.2; const postW = 0.25;
  const postGeo = new THREE.BoxGeometry(postW, postH, postW);
  const postMat = new THREE.MeshStandardMaterial({ color: opts.postColor || 0x222222, metalness:0.1, roughness:0.6 });
  const leftPost = new THREE.Mesh(postGeo, postMat);
  const rightPost = new THREE.Mesh(postGeo, postMat);
  const span = width * 0.95; // inside the track
  leftPost.position.copy(center).addScaledVector(L, span*0.5).setY(postH*0.5);
  rightPost.position.copy(center).addScaledVector(L, -span*0.5).setY(postH*0.5);
  scene.add(leftPost, rightPost);

  // Banner
  const bannerGeo = new THREE.BoxGeometry(span*0.9, 0.4, 0.12);
  const bannerMat = new THREE.MeshStandardMaterial({ color: opts.bannerColor || 0x111111, metalness:0.2, roughness:0.5 });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  const up = new THREE.Vector3(0,1,0);
  banner.position.copy(center).addScaledVector(up, postH - 0.2);
  banner.lookAt(center.clone().add(T)); // orient along road
  scene.add(banner);

  // Chequered line on the ground
  const lineW = width * 0.98; const lineL = 1.6;
  const planeGeo = new THREE.PlaneGeometry(lineW, lineL);
  const chk = makeCheckerTexture(THREE, 10, '#f7f7f7', '#1a1a1a'); chk.repeat.set(6,1);
  const planeMat = new THREE.MeshBasicMaterial({ map: chk, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI/2;
  const groundCenter = center.clone(); groundCenter.y = 0.021; // slightly above road to avoid z-fight
  plane.position.copy(groundCenter);
  // rotate plane to be perpendicular to road
  const ang = Math.atan2(T.x, T.z); // road forward angle
  plane.rotation.y = ang; // align long side with tangent; but we want perpendicular -> add 90deg
  plane.rotation.y += Math.PI/2;
  scene.add(plane);

  // Return objects so caller can keep refs if needed
  return { leftPost, rightPost, banner, plane };
}

function addCenterDashes(THREE, scene, curve, opts={}){
  const dashLen = opts.dashLen || 1.5; // world units
  const dashGap = opts.dashGap || 1.2;
  const dashW = opts.dashW || 0.12;
  const mat = new THREE.MeshBasicMaterial({ color: opts.color || 0xffffff });
  const geo = new THREE.PlaneGeometry(dashW, dashLen);
  for (let u=0; u<1; u += (dashLen+dashGap)/200) {
    const P = curve.getPointAt(u);
    const T = curve.getTangentAt(u);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI/2;
    m.position.set(P.x, 0.021, P.z);
    m.rotation.y = Math.atan2(T.x, T.z);
    scene.add(m);
  }
}

function addEdgeProps(THREE, scene, curve, width, mkMesh, everyU=0.04, offset=0.65){
  const placeOne = (u, sign) => {
    const P = curve.getPointAt(u);
    const T = curve.getTangentAt(u);
    const L = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), T).normalize();
    const pos = P.clone().addScaledVector(L, sign * width * offset); pos.y = 0.02;
    const obj = mkMesh(); obj.position.copy(pos);
    obj.lookAt(P.clone().add(T));
    scene.add(obj);
  };
  for (let u=0; u<1; u+=everyU){ placeOne(u, 1); placeOne(u, -1); }
}

/* ---------- track-side set pieces & gameplay objects (arches, pads, hazards, particles) ---------- */
function addRoadArch(THREE, scene, curve, width, u, style='truss', color=0x444444){
  const P = curve.getPointAt(u); const T = curve.getTangentAt(u);
  const L = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), T).normalize();
  const span = width*0.95;
  const h = style==='ice' ? 4.2 : style==='crystal' ? 4.6 : style==='vine' ? 4.0 : 3.6;
  const postGeo = new THREE.CylinderGeometry(0.18,0.18,h, 8);
  const mat = new THREE.MeshStandardMaterial({ color, metalness: style==='truss'?0.6:0.2, roughness: style==='truss'?0.4:0.7, emissive: (style==='crystal')?0x5b2a91:0x000000, emissiveIntensity:(style==='crystal')?0.4:0 });
  const left = new THREE.Mesh(postGeo, mat); left.position.copy(P).addScaledVector(L, span*0.5); left.position.y = h/2; scene.add(left);
  const right = new THREE.Mesh(postGeo, mat); right.position.copy(P).addScaledVector(L, -span*0.5); right.position.y = h/2; scene.add(right);
  let top;
  if (style==='truss') {
    top = new THREE.Mesh(new THREE.BoxGeometry(span*0.9, 0.3, 0.3), mat);
  } else if (style==='ice') {
    top = new THREE.Mesh(new THREE.ConeGeometry(span*0.48, 1.2, 6), new THREE.MeshStandardMaterial({ color:0x9ad4ff, emissive:0x3a9fff, emissiveIntensity:0.2, roughness:0.35 }));
  } else if (style==='crystal') {
    top = new THREE.Mesh(new THREE.ConeGeometry(span*0.45, 1.6, 6), new THREE.MeshStandardMaterial({ color:0xc08cff, emissive:0x6a2fb0, emissiveIntensity:0.5 }));
  } else if (style==='vine') {
    top = new THREE.Mesh(new THREE.TorusGeometry(span*0.45, 0.12, 8, 24), new THREE.MeshStandardMaterial({ color:0x2e7d32, roughness:0.9 }));
  }
  top.position.copy(P); top.position.y = h - 0.25; top.lookAt(P.clone().add(T)); scene.add(top);
}

function addSpeedPads(THREE, scene, curve, width, uList, color=0x00e6ff){
  const pads = [];
  const tex = makeStripedTexture(THREE, { bands: 10, a:'#00e6ff', b:'#b8f7ff' }); tex.repeat.set(3,1);
  for (const u of uList){
    const P = curve.getPointAt(u); const T = curve.getTangentAt(u);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width*0.92, 2.2), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.35, metalness:0.4, roughness:0.35 }));
    plane.rotation.x = -Math.PI/2; plane.position.set(P.x, 0.021, P.z); plane.rotation.y = Math.atan2(T.x, T.z) + Math.PI/2; scene.add(plane);
    pads.push({ u0: (u-0.015+1)%1, u1: (u+0.015)%1, mesh: plane, type:'boost', strength: 12 });
  }
  return pads;
}

function addHazardPatches(THREE, scene, curve, width, uList, theme='slush'){
  const patches = [];
  const tone = theme==='slush'?0x8ab6c9: theme==='puddle'?0x556b7a: theme==='mud'?0x6b4f37: 0x4b3b5c;
  const mat = new THREE.MeshStandardMaterial({ color:tone, transparent:true, opacity:0.85, roughness:0.95, metalness:0.05 });
  for (const u of uList){
    const P = curve.getPointAt(u); const T = curve.getTangentAt(u);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(width*0.8, 2.6), mat);
    g.rotation.x = -Math.PI/2; g.position.set(P.x,0.019,P.z); g.rotation.y = Math.atan2(T.x,T.z)+Math.PI/2; scene.add(g);
    patches.push({ u0:(u-0.018+1)%1, u1:(u+0.018)%1, mesh:g, type:'slow', strength: 0.6 });
  }
  return patches;
}

function addSwingGate(THREE, scene, curve, width, u, registerAnimator, opts={}){
  const P = curve.getPointAt(u); const T = curve.getTangentAt(u);
  const pivot = new THREE.Object3D(); pivot.position.set(P.x, 1.8, P.z); scene.add(pivot);
  const barLen = width*0.9; const mat = new THREE.MeshStandardMaterial({ color: opts.color || 0xffcc00, metalness:0.4, roughness:0.5, emissive:0x331a00, emissiveIntensity:0.12 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(barLen, 0.25, 0.25), mat); pivot.add(bar);
  pivot.rotation.y = Math.atan2(T.x,T.z);
  const speed = opts.speed || 1.2; const amp = opts.amp || Math.PI/3;
  registerAnimator((dt,t)=>{ pivot.rotation.y = Math.atan2(T.x,T.z) + Math.sin(t*0.001*speed)*amp; });
  return { type:'obstacle', u };  
}

function addParticles(THREE, scene, kind='snow', registerAnimator){
  const count = kind==='snow'? 700 : kind==='fireflies'? 200 : 300;
  const area = 380;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count*3);
  for (let i=0;i<count;i++){
    pos[i*3+0] = (Math.random()-0.5)*area;
    pos[i*3+1] = Math.random()*30 + 4;
    pos[i*3+2] = (Math.random()-0.5)*area;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const mat = new THREE.PointsMaterial({ size: kind==='snow'? 0.12 : 0.08, transparent:true, opacity: (kind==='embers')?0.9:0.8, color: kind==='snow'?0xffffff : kind==='fireflies'?0xb6ff66 : 0xffcc66 });
  const points = new THREE.Points(geo, mat); scene.add(points);
  if (kind==='snow'){
    registerAnimator((dt)=>{
      const a = points.geometry.attributes.position; const arr = a.array;
      for (let i=0;i<count;i++){
        arr[i*3+1] -= (0.5 + Math.random()*0.5) * dt * 8;
        if (arr[i*3+1] < 0) arr[i*3+1] = 34;
      }
      a.needsUpdate = true;
    });
  } else if (kind==='fireflies'){
    registerAnimator((dt,t)=>{
      const a = points.geometry.attributes.position; const arr = a.array;
      for (let i=0;i<count;i++){
        arr[i*3+0] += Math.sin((t*0.001) + i)*0.02;
        arr[i*3+2] += Math.cos((t*0.0012) + i)*0.02;
      }
      a.needsUpdate = true;
    });
  } else if (kind==='embers'){
    registerAnimator((dt)=>{
      const a = points.geometry.attributes.position; const arr = a.array;
      for (let i=0;i<count;i++){
        arr[i*3+1] += dt * 3.5; if (arr[i*3+1] > 36) arr[i*3+1] = 4;
      }
      a.needsUpdate = true;
    });
  }
}

/* ------------------------- track building (ribbon + walls) ------------------------- */
function buildRibbon(THREE, curve, width = 10, segments = 900, opts={}) {
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

  const roadMat = new THREE.MeshStandardMaterial({ color: opts.roadColor || 0xcccccc, roughness: opts.roughness ?? 0.9, metalness: opts.metalness ?? 0.2 });
  if (opts.roadTexture) { roadMat.map = opts.roadTexture; roadMat.map.needsUpdate = true; roadMat.map.wrapS = roadMat.map.wrapT = THREE.RepeatWrapping; roadMat.map.repeat.set(2, 120); }
  const road = new THREE.Mesh(geo, roadMat);
  road.receiveShadow = true;

  const wallGroup = new THREE.Group();
  const wallGeo = new THREE.BoxGeometry(0.5, 1.2, 2.0);
  const wallMatA = new THREE.MeshStandardMaterial({ color: opts.wallColorA || 0x333333, metalness: 0.05, roughness: 0.9 });
  const wallMatB = new THREE.MeshStandardMaterial({ color: opts.wallColorB || 0x555555, metalness: 0.1, roughness: 0.85 });

  for (let i = 0; i < pts.length; i += 3) {
    const p = pts[i];
    let toggle = false;
    for (const P of [p.L, p.R]) {
      const w = new THREE.Mesh(wallGeo, toggle ? wallMatA : wallMatB);
      w.position.set(P.x, 0.6, P.z);
      wallGroup.add(w); toggle = !toggle;
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
  const mk = (arr) => new THREE.CatmullRomCurve3(arr.map(a => new V(...a)), true, 'centripetal'); // smoother turns

  const themes = {
    snowy: {
      name: 'Glacier Loop',
      sky: 0x87b6d8, ground: 0xe9f2f9, roadColor: 0xffffff, wallColor: 0x556677,
      trackWidth: 11, segments: 950,
      fog: { color: 0xcfe8f6, density: 0.008 },
      points: [
        [-150,0,-30], [-100,0,-80], [-20,0,-95], [60,0,-80], [120,0,-30],
        [150,0,40], [110,0,85], [40,0,100], [-40,0,90], [-110,0,50],
        [-150,0,0], [-150,0,-30]
      ],
      deco: (scene, curve, width, ctx) => {
        // perimeter pines and snow mounds
        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.6, 2);
        const coneGeo = new THREE.ConeGeometry(2.2, 6, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color:0x8b5a2b });
        const pineMat = new THREE.MeshStandardMaterial({ color:0x2f6b3b, roughness:0.95 });
        for (let i=0;i<160;i++){
          const t = Math.random()*2*Math.PI; const r = 180 + Math.random()*140;
          const x = Math.cos(t)*r, z = Math.sin(t)*r;
          const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.set(x,1, z);
          const top = new THREE.Mesh(coneGeo, pineMat); top.position.set(x,4, z);
          scene.add(trunk, top);
        }
        // ice pylons
        const iceMat = new THREE.MeshStandardMaterial({ color:0x9ad4ff, emissive:0x3a9fff, emissiveIntensity:0.18, roughness:0.3, metalness:0.1 });
        const mkPylon = () => new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 6), iceMat);
        addEdgeProps(THREE, scene, curve, width, mkPylon, 0.05, 0.62);
        // arches & pads & hazards
        if (ctx){
          addRoadArch(THREE, scene, curve, width, 0.04, 'ice');
          addRoadArch(THREE, scene, curve, width, 0.52, 'ice');
          ctx.boostZones.push(...addSpeedPads(THREE, scene, curve, width, [0.12, 0.58], 0x7fdfff));
          ctx.slowZones.push(...addHazardPatches(THREE, scene, curve, width, [0.32, 0.77], 'slush'));
          addParticles(THREE, scene, 'snow', ctx.registerAnimator);
        }
      }
    },
    city: {
      name: 'Downtown Dash',
      sky: 0xaad0ff, ground: 0xdadada, roadColor: 0x2f2f2f, wallColor: 0x777777,
      trackWidth: 10, segments: 900,
      fog: { color: 0xbcd3e6, density: 0.006 },
      points: [
        [-140,0,-60], [-60,0,-95], [40,0,-95], [130,0,-60], [150,0,-10],
        [110,0,40], [40,0,70], [-30,0,70], [-90,0,35], [-140,0,-5],
        [-140,0,-60]
      ],
      deco: (scene, curve, width, ctx) => {
        // buildings scatter
        const box = (w,h,d,c,x,z)=>{
          const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshStandardMaterial({color:c, roughness:.85}));
          m.position.set(x,h/2,z); scene.add(m);
        };
        for (let i=0;i<90;i++){
          const t = Math.random()*2*Math.PI;
          const r = 200 + Math.random()*140;
          const x = Math.cos(t)*r, z = Math.sin(t)*r;
          box(8+Math.random()*14, 14+Math.random()*48, 8+Math.random()*14, 0x8088a0, x, z);
        }
        // street lights along the edge
        const poleGeo = new THREE.CylinderGeometry(0.08,0.08,2.6,10);
        const headGeo = new THREE.SphereGeometry(0.16, 16, 12);
        const poleMat = new THREE.MeshStandardMaterial({ color:0x333333, metalness:0.5, roughness:0.4 });
        const headMat = new THREE.MeshStandardMaterial({ color:0xffffcc, emissive:0x444400, emissiveIntensity:0.35 });
        const mkLamp = () => {
          const g = new THREE.Group();
          const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.y = 1.3; g.add(pole);
          const bulb = new THREE.Mesh(headGeo, headMat); bulb.position.y = 2.7; g.add(bulb);
          return g;
        };
        addEdgeProps(THREE, scene, curve, width, mkLamp, 0.06, 0.70);
        addCenterDashes(THREE, scene, curve, { dashLen:1.6, dashGap:1.2, dashW:0.2, color:0xf2f2f2 });
        if (ctx){
          // overpasses & dynamic barrier
          addRoadArch(THREE, scene, curve, width, 0.15, 'truss', 0x555555);
          addRoadArch(THREE, scene, curve, width, 0.55, 'truss', 0x666666);
          addSwingGate(THREE, scene, curve, width, 0.30, ctx.registerAnimator, { color:0xff9900, speed:1.5, amp:Math.PI/4 });
          ctx.boostZones.push(...addSpeedPads(THREE, scene, curve, width, [0.22, 0.66], 0x00e6ff));
          ctx.slowZones.push(...addHazardPatches(THREE, scene, curve, width, [0.41], 'puddle'));
        }
      }
    },
    geode: {
      name: 'Crystal Circuit',
      sky: 0x301040, ground: 0x3a1f5f, roadColor: 0x5b2a91, wallColor: 0x9b59b6,
      trackWidth: 10.5, segments: 900,
      fog: { color: 0x1c0c2f, density: 0.015 },
      points: [
        [-120,0,0], [-80,0,50], [-20,0,90], [50,0,70], [110,0,10],
        [80,0,-50], [20,0,-90], [-60,0,-80], [-120,0,-20], [-120,0,0]
      ],
      deco: (scene, curve, width, ctx) => {
        const crystalMat = new THREE.MeshStandardMaterial({ color:0xc08cff, emissive:0x6a2fb0, emissiveIntensity:0.55, roughness:0.45, metalness:0.2 });
        const mkCrystal = () => new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.4 + Math.random()*0.8, 6), crystalMat);
        addEdgeProps(THREE, scene, curve, width, mkCrystal, 0.045, 0.60);
        // scattered spires farther out
        for (let i=0;i<110;i++){
          const g = new THREE.ConeGeometry(1+Math.random()*2, 3+Math.random()*5, 6);
          const m = new THREE.Mesh(g, crystalMat);
          const t = Math.random()*2*Math.PI, r = 170 + Math.random()*160;
          m.position.set(Math.cos(t)*r, 0.5, Math.sin(t)*r); scene.add(m);
        }
        if (ctx){
          addRoadArch(THREE, scene, curve, width, 0.12, 'crystal');
          addRoadArch(THREE, scene, curve, width, 0.68, 'crystal');
          ctx.boostZones.push(...addSpeedPads(THREE, scene, curve, width, [0.18, 0.73], 0xd9a6ff));
          ctx.slowZones.push(...addHazardPatches(THREE, scene, curve, width, [0.41], 'shards'));
          addParticles(THREE, scene, 'embers', ctx.registerAnimator);
        }
      }
    },
    jungle: {
      name: 'Temple Runway',
      sky: 0x87d89e, ground: 0xa6e1a4, roadColor: 0x7b5e57, wallColor: 0x3f5b2b,
      trackWidth: 11.5, segments: 950,
      fog: { color: 0x6ec18c, density: 0.01 },
      points: [
        [-150,0,-40], [-90,0,-90], [-10,0,-95], [70,0,-70], [120,0,-10],
        [110,0,50], [60,0,90], [-10,0,95], [-80,0,70], [-130,0,20],
        [-150,0,-10], [-150,0,-40]
      ],
      deco: (scene, curve, width, ctx) => {
        // jungle trees
        const trunkMat = new THREE.MeshStandardMaterial({ color:0x8b5a2b });
        const leafMat = new THREE.MeshStandardMaterial({ color:0x2e7d32, roughness:.95 });
        for (let i=0;i<160;i++){
          const x = (Math.random()-.5)*520, z = (Math.random()-.5)*520;
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.7,3), trunkMat);
          trunk.position.set(x,1.5,z); scene.add(trunk);
          const crown = new THREE.Mesh(new THREE.SphereGeometry(2.4,14,12), leafMat);
          crown.position.set(x,3.9,z); scene.add(crown);
        }
        // tiki torches along the edge
        const poleGeo = new THREE.CylinderGeometry(0.08,0.1,1.2,8);
        const flameGeo = new THREE.SphereGeometry(0.15, 10, 10);
        const poleMat = new THREE.MeshStandardMaterial({ color:0x8b5a2b, roughness:0.8 });
        const flameMat = new THREE.MeshStandardMaterial({ color:0xffe0a3, emissive:0xff6600, emissiveIntensity:0.6, roughness:0.2 });
        const mkTorch = () => { const g = new THREE.Group(); const p = new THREE.Mesh(poleGeo, poleMat); p.position.y=0.6; g.add(p); const f = new THREE.Mesh(flameGeo, flameMat); f.position.y=1.3; g.add(f); return g; };
        addEdgeProps(THREE, scene, curve, width, mkTorch, 0.055, 0.68);
        if (ctx){
          addRoadArch(THREE, scene, curve, width, 0.26, 'vine');
          addSwingGate(THREE, scene, curve, width, 0.33, ctx.registerAnimator, { color:0x8b5a2b, speed:1.0, amp:Math.PI/5 });
          ctx.boostZones.push(...addSpeedPads(THREE, scene, curve, width, [0.14, 0.72], 0xa8ff90));
          ctx.slowZones.push(...addHazardPatches(THREE, scene, curve, width, [0.52], 'mud'));
          addParticles(THREE, scene, 'fireflies', ctx.registerAnimator);
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
  const [notice] = useState('');
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

  const clearScene = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    if (stopFns.current) { stopFns.current.forEach(fn => { try { fn(); } catch {} }); }
    stopFns.current = [];
    if (sceneRef.current) {
      while (sceneRef.current.children.length) sceneRef.current.remove(sceneRef.current.children[0]);
    }
  }, []);

  const ensureRenderer = useCallback(async () => {
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
  }, []);

  /* -------------------- PREVIEW: rotating themed backdrop with gentle motion -------------------- */
  const startPreview = useCallback(async () => {
    const THREE = await ensureRenderer();
    clearScene();

    const themes = ['snowy','city','geode','jungle'];
    const themeName = themes[previewThemeIndex.current % themes.length];
    const theme = makeTheme(THREE, themeName);

    sceneRef.current.background = new THREE.Color(theme.sky);
    if (theme.fog) sceneRef.current.fog = new THREE.FogExp2(theme.fog.color, theme.fog.density);

    const amb = new THREE.AmbientLight(0xffffff, 0.9); sceneRef.current.add(amb);
    const sun = new THREE.DirectionalLight(0xffffff, 0.85); sun.position.set(40,80,20); sceneRef.current.add(sun);

    const groundTex = makeNoiseTexture(THREE, { base:'#cfe6f4', accent:'#e8f3fb', speck:'#d6ecf9' }); groundTex.repeat.set(10,10);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(800,800),
      new THREE.MeshLambertMaterial({ color: theme.ground, map: groundTex })
    );
    ground.rotation.x = -Math.PI/2; sceneRef.current.add(ground);

    const ribbon = buildRibbon(THREE, theme.curve, theme.trackWidth || 10, theme.segments || 900, { roadColor: theme.roadColor, wallColorA: theme.wallColor, wallColorB: (theme.wallColor+0x222222)&0xffffff });
    // optional subtle road grain
    const tRoad = makeNoiseTexture(THREE, { base:'#bcbcbc', accent:'#d0d0d0', speck:'#9e9e9e' }); tRoad.repeat.set(2, 120);
    ribbon.road.material.map = tRoad;
    ribbon.walls.children.forEach(w => w.material.color.setHex(theme.wallColor));
    sceneRef.current.add(ribbon.road, ribbon.walls);

    // start/finish + center dashes where appropriate
    addStartFinishGate(THREE, sceneRef.current, theme.curve, theme.trackWidth || 10, { postColor: theme.wallColor });
    if (themeName === 'city') addCenterDashes(THREE, sceneRef.current, theme.curve, { color:0xf0f0f0 });

    theme.deco(sceneRef.current, theme.curve, theme.trackWidth || 10);

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
  }, [ensureRenderer, clearScene]);

  /* -------------------- GAME: full race -------------------- */
  const startRace = useCallback(async ({ practice, roster, themeName, seed, startAt, roomId }) => {
    const THREE = await ensureRenderer();
    clearScene();
    setStatus(practice ? 'Practice: finish 2 laps!' : 'Matched! Starting…');

    const theme = makeTheme(THREE, themeName);
    const scene = sceneRef.current;

    scene.background = new THREE.Color(theme.sky);
    if (theme.fog) scene.fog = new THREE.FogExp2(theme.fog.color, theme.fog.density);
    const amb = new THREE.AmbientLight(0xffffff, 0.88); scene.add(amb);
    const sun = new THREE.DirectionalLight(0xffffff, 0.82); sun.position.set(40,80,20); scene.add(sun);

    const groundTex = makeNoiseTexture(THREE, { base:'#c8d8c8', accent:'#dde8dd', speck:'#b0c4b0' }); groundTex.repeat.set(10,10);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800,800), new THREE.MeshLambertMaterial({ color: theme.ground, map: groundTex }));
    ground.rotation.x = -Math.PI/2; scene.add(ground);

    const ribbon = buildRibbon(THREE, theme.curve, theme.trackWidth || 10, theme.segments || 900, { roadColor: theme.roadColor, wallColorA: theme.wallColor, wallColorB: (theme.wallColor+0x222222)&0xffffff });
    const tRoad = makeNoiseTexture(THREE, { base:'#bcbcbc', accent:'#d0d0d0', speck:'#9e9e9e' }); tRoad.repeat.set(2, 120);
    ribbon.road.material.map = tRoad;
    ribbon.walls.children.forEach(w => w.material.color.setHex(theme.wallColor));
    scene.add(ribbon.road); scene.add(ribbon.walls);

    // Start/finish gate and optional center dashes per theme
    addStartFinishGate(THREE, scene, theme.curve, theme.trackWidth || 10, { postColor: theme.wallColor });
    if (themeName === 'city') addCenterDashes(THREE, scene, theme.curve, { color:0xf0f0f0 });

    // Gameplay helpers & animators
    const animators = [];
    const registerAnimator = (fn)=> animators.push(fn);
    const ctx = { boostZones: [], slowZones: [], registerAnimator };

    // Themed scenery & gameplay elements
    theme.deco(scene, theme.curve, theme.trackWidth || 10, ctx);

    const racers = roster.map((p, i) => ({
      id: p.id, isBot: !!p.isBot, skill: p.isBot ? (p.skill || 4) : 5,
      username: p.username || (p.isBot ? `BOT-${i}` : 'Player'),
      node: avatarMesh(THREE, p.isBot ? '#444':'#111'),
      u: (i * 0.02) % 1, lap: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(0,0,0),
    }));
    racers.forEach(r => scene.add(r.node));

    // choose "me" (first non-bot)
    const me = racers.find(r => !r.isBot) || racers[0];

    // position on start grid
    for (let i=0;i<racers.length;i++){
      const u0 = i * 0.02;
      const pt0 = theme.curve.getPointAt(u0);
      racers[i].u = u0;
      racers[i].pos.copy(pt0); racers[i].pos.y = 0.02;
      racers[i].node.position.copy(racers[i].pos);
      racers[i].node.lookAt(theme.curve.getPointAt((u0+0.01)%1));
    }

    const nearestU = ribbon.nearestU;
    const halfWidth = ribbon.halfWidth;
    const laps = 2;
    const ACCEL = 18, FRICTION = 2, MAX_SPEED = 22; // shared physics
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
      return { u, tan, lateral };
    }

    // inputs
    const input = { accel:false, left:false, right:false };
    const onKey = (e,d)=>{ if(e.key==='ArrowUp')input.accel=d; if(e.key==='ArrowLeft')input.left=d; if(e.key==='ArrowRight')input.right=d; };
    const kd = e=>onKey(e,true), ku=e=>onKey(e,false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    stopFns.current.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); });

    function inZone(u, lateral, zones){
      for (const z of zones){
        const wrap = z.u0 > z.u1; // handles 0..1 wrap
        const inside = wrap ? (u >= z.u0 || u <= z.u1) : (u>=z.u0 && u<=z.u1);
        if (inside && Math.abs(lateral) < halfWidth*0.35) return z;
      }
      return null;
    }

    function advanceBot(R, dt) {
      // project to track & compute forward direction
      const proj = nearestAndClamp(R);
      const fwd = new THREE.Vector3(proj.tan.x, 0, proj.tan.z).normalize();
      const rightVec = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), fwd).normalize();

      // Desired offset from center: less wander at higher skill
      if (R._wanderPhase == null) { R._wanderPhase = Math.random() * Math.PI * 2; }
      if (R._wanderAmp == null) { R._wanderAmp = 0.25 * (6 - R.skill) * 0.12; } // meters
      R._wanderPhase += dt * (0.6 + R.skill * 0.2);
      const desiredOffset = clamp(Math.sin(R._wanderPhase) * R._wanderAmp, -halfWidth*0.25, halfWidth*0.25);

      // Pathing correction proportional to cross-track error; stronger with skill
      const k = 3 + R.skill * 1.7;
      const error = proj.lateral - desiredOffset;
      R.vel.addScaledVector(rightVec, -error * k * dt);

      // Same acceleration model as the player
      R.vel.addScaledVector(fwd, ACCEL * dt);

      // Zone effects
      const z = inZone(R.u, proj.lateral, ctx.boostZones) || inZone(R.u, proj.lateral, ctx.slowZones);
      if (z) {
        if (z.type === 'boost') R.vel.addScaledVector(fwd, (z.strength||12) * dt);
        else if (z.type === 'slow') R.vel.multiplyScalar(0.96);
      }

      // Friction & clamp
      R.vel.multiplyScalar(1 - FRICTION * dt);
      const sp = R.vel.length();
      if (sp > MAX_SPEED) R.vel.multiplyScalar(MAX_SPEED / sp);

      // Integrate and update lap
      R.pos.addScaledVector(R.vel, dt);
      const newU = nearestU(R.u, R.pos.x, R.pos.z);
      if (newU < 0.02 && R._lastU > 0.8) {
        R.lap += 1;
        if (R.lap >= laps && !finished.has(R.id)) { finished.add(R.id); order.push(R); if (R===me) onFinish(order); }
      }
      R._lastU = newU; R.u = newU;

      // Visuals
      R.pos.y = 0.02;
      R.node.position.copy(R.pos);
      R.node.lookAt(new THREE.Vector3().addVectors(R.pos, R.vel));
    }

    function advanceMe(R, dt) {
      const proj = nearestAndClamp(R);
      const forward = new THREE.Vector3(proj.tan.x,0,proj.tan.z).normalize();
      const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (steer !== 0) {
        const rightVec = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), forward).normalize();
        R.vel.addScaledVector(rightVec, -steer * 6 * dt);
      }
      if (input.accel) R.vel.addScaledVector(forward, ACCEL*dt);
      // base friction
      R.vel.multiplyScalar(1 - FRICTION*dt);
      const speed = R.vel.length();
      if (speed > MAX_SPEED) R.vel.multiplyScalar(MAX_SPEED/speed);
      R.pos.addScaledVector(R.vel, dt);
      R.pos.y = 0.02;
      R.node.position.copy(R.pos);
      R.node.lookAt(new THREE.Vector3().set(R.pos.x + R.vel.x, 0.02, R.pos.z + R.vel.z));

      // zone effects
      const z = inZone(R.u, proj.lateral, ctx.boostZones) || inZone(R.u, proj.lateral, ctx.slowZones);
      if (z){
        if (z.type==='boost') {
          R.vel.addScaledVector(forward, (z.strength||12) * dt);
        } else if (z.type==='slow') {
          R.vel.multiplyScalar(0.96);
        }
      }

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
        for (const R of racers) { if (R === me) advanceMe(R, dt); else if (R.isBot) advanceBot(R, dt); }
        const meDir = me.vel.clone().normalize();
        const offset = meDir.length() ? meDir.clone().multiplyScalar(-8) : theme.curve.getTangentAt(me.u).multiplyScalar(-8);
        const targetCam = new THREE.Vector3().copy(me.pos).add(offset); targetCam.y = 5;
        camRef.current.position.lerp(targetCam, 0.1);
        camRef.current.lookAt(me.pos.x, 1.6, me.pos.z);
      }

      // run animators (particles, moving gates, etc.)
      for (const fn of animators) fn(dt, t);

      rendRef.current.render(sceneRef.current, camRef.current);
      animRef.current = requestAnimationFrame(frame);
    };
    frame();
  }, [ensureRenderer, clearScene, mm, user]);

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
    if (mode !== 'online') return undefined;
    mm.queue();
    setStatus('Looking for opponents…');
    const off = mm.on((type/*, payload*/) => {
      if (type === 'pos') { /* position sync handled in startRace */ }
    });
    return off;
  }, [mode, mm]);

  useEffect(() => {
    if (mode !== 'online' || !mm.raceMeta || !mm.roster) return;
    const themeName = ['snowy','city','geode','jungle'][mm.raceMeta.mapId % 4];
    setRaceInfo({ themeName, laps: mm.raceMeta.laps, mapId: mm.raceMeta.mapId });
    startRace({ practice:false, roster:mm.roster, startAt:mm.raceMeta.startAt, seed:mm.seed, roomId:mm.roomId, themeName });
  }, [mode, mm.raceMeta, mm.roster, mm.roomId, mm.seed, startRace]);

  /* ------------------------ lifecycle: preview on idle ------------------------ */
  useEffect(() => {
    if (mode === null) startPreview();
    return () => { cancelAnimationFrame(animRef.current); if (previewTimer.current) clearInterval(previewTimer.current); };
  }, [mode, startPreview]);

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
