// 3D-сцена фона Epimely: выдуманное дерево в каменном кольце.
// Запуск: белый лист → дерево рисуется карандашом → рисунок становится живым → приложение.
// Всё это один непрерывный кадр: камера и свет не «перескакивают», меняются только числа.
// Управление — window.SCENE (его вызывает приложение через WebView, см. lib/Scene3D.js).
import * as THREE from 'three';
import { buildTree, buildFoliage, buildRing, buildGround, buildGrass } from './tree';
import { barkMaterial, stoneMaterial, foliageMaterial, groundMaterial, grassMaterial, skyMaterial, fallMaterial } from './materials';
import { envFor, DEFAULT_STATE } from './env';

const INIT = window.__INIT || {};
const lite = !!INIT.lite;
const TABS = INIT.tabs || 5;
const post = (type, data) => { try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data })); } catch (e) {} };

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: !lite, powerPreference: 'high-performance', alpha: false });
} catch (e) {
  post('error', { message: String(e && e.message) });
  throw e;
}
const DPR = Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.75);
renderer.setPixelRatio(DPR);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // цвет переводят сами шейдеры
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.3, 400);
const PAPER = new THREE.Vector3(0.965, 0.957, 0.933);

// Общие числа для всех материалов (один объект на всех — меняется сразу везде).
const U = {
  uTime: { value: 0 }, uRealR: { value: 0 }, uDraw: { value: 0 }, uPaper: { value: PAPER }, uPx: { value: DPR },
  uFogColor: { value: new THREE.Color() }, uFog: { value: 0.006 },
  uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() }, uSunCol: { value: new THREE.Color() },
  uSkyAmb: { value: new THREE.Color() }, uGroundAmb: { value: new THREE.Color() },
  uFlash: { value: 0 }, uSnow: { value: 0 }, uWet: { value: 0 },
  uWindDir: { value: new THREE.Vector2(0.8, 0.6) }, uWind: { value: 0.3 },
};
const uRealSky = { value: 0 };
const grassU = { uGrassA: { value: new THREE.Color() }, uGrassB: { value: new THREE.Color() } };

// ---- объекты ----
const tree = buildTree({ lite });
scene.add(new THREE.Mesh(tree.geometry, barkMaterial(U)));
scene.add(new THREE.Mesh(buildRing(tree.rand), stoneMaterial(U)));

const leafU = { uAmount: { value: 1 }, uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() }, uGlow: { value: 0 } };
const bloomU = { uAmount: { value: 1 }, uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() }, uGlow: { value: 0 } };
const leaves = new THREE.Mesh(buildFoliage(tree.anchors, lite ? 3200 : 11000, tree.rand, { size: 0.25, spread: 0.62 }), foliageMaterial(U, leafU, false));
const blooms = new THREE.Mesh(buildFoliage(tree.anchors, lite ? 260 : 620, tree.rand, { size: 0.2, spread: 0.55, bloom: true }), foliageMaterial(U, bloomU, true));
leaves.frustumCulled = false; blooms.frustumCulled = false;
scene.add(leaves, blooms);

const ground = new THREE.Mesh(buildGround(lite), groundMaterial(U, grassU));
scene.add(ground);
if (!lite) {
  const grass = new THREE.Mesh(buildGrass(9000, tree.rand), grassMaterial(U, grassU));
  grass.frustumCulled = false;
  scene.add(grass);
}

const skyU = { uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uCloudCol: { value: new THREE.Color() }, uDisc: { value: new THREE.Color() }, uCloud: { value: 0.2 }, uStars: { value: 0 }, uRealSky };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), skyMaterial(U, skyU));
sky.frustumCulled = false; sky.renderOrder = -10;
scene.add(sky);

function makeFall(count, kind, box, speed, size, drift) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3), r = new Float32Array(count);
  for (let i = 0; i < count; i++) { p[i * 3] = Math.random(); p[i * 3 + 1] = Math.random(); p[i * 3 + 2] = Math.random(); r[i] = Math.random(); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('aRand', new THREE.BufferAttribute(r, 1));
  const u = {
    uBox: { value: new THREE.Vector3(...box) }, uCenter: { value: new THREE.Vector3(0, box[1] / 2 - 0.5, 0) }, uSpeed: { value: speed }, uSize: { value: size },
    uDrift: { value: drift }, uScale: { value: 1 }, uColor: { value: new THREE.Color('#ffffff') }, uOpacity: { value: 0 }, uKind: { value: kind }, uRealSky,
  };
  const m = new THREE.Points(g, fallMaterial(U, u));
  m.frustumCulled = false; m.visible = false; m.renderOrder = 5;
  scene.add(m);
  return { m, u };
}
const rain = makeFall(lite ? 700 : 2400, 0, [18, 14, 18], 17, 110, 5);
const snowfall = makeFall(lite ? 500 : 1500, 1, [22, 14, 22], 1.4, 15, 2.2);
const drift = makeFall(lite ? 50 : 110, 2, [20, 10, 20], 0.5, 15, 1.2);

// ---- окружение: текущие значения плавно догоняют целевые ----
let state = { ...DEFAULT_STATE, ...(INIT.state || {}) };
let target = envFor(state);
const cur = envFor(state);
const NUMS = ['fog', 'cloud', 'stars', 'snow', 'wet', 'leaf', 'bloom', 'wind', 'glow', 'rain', 'snowfall', 'drift'];
const COLS = ['zenith', 'horizon', 'fogColor', 'sunCol', 'disc', 'skyAmb', 'groundAmb', 'cloudCol', 'leafA', 'leafB', 'bloomA', 'bloomB', 'grassA', 'grassB', 'driftCol'];
function applyEnv(k) {
  NUMS.forEach((n) => { cur[n] += (target[n] - cur[n]) * k; });
  COLS.forEach((n) => { cur[n].lerp(target[n], k); });
  cur.sunDir.lerp(target.sunDir, k).normalize();
  U.uFogColor.value.copy(cur.fogColor); U.uFog.value = cur.fog;
  U.uSunDir.value.copy(cur.sunDir); U.uSunCol.value.copy(cur.sunCol);
  U.uSkyAmb.value.copy(cur.skyAmb); U.uGroundAmb.value.copy(cur.groundAmb);
  U.uSnow.value = cur.snow; U.uWet.value = cur.wet; U.uWind.value = cur.wind;
  leafU.uAmount.value = cur.leaf; leafU.uColA.value.copy(cur.leafA); leafU.uColB.value.copy(cur.leafB);
  bloomU.uAmount.value = cur.bloom; bloomU.uColA.value.copy(cur.bloomA); bloomU.uColB.value.copy(cur.bloomB); bloomU.uGlow.value = cur.glow;
  grassU.uGrassA.value.copy(cur.grassA); grassU.uGrassB.value.copy(cur.grassB);
  skyU.uZenith.value.copy(cur.zenith); skyU.uHorizon.value.copy(cur.horizon); skyU.uCloudCol.value.copy(cur.cloudCol); skyU.uDisc.value.copy(cur.disc);
  skyU.uCloud.value = cur.cloud; skyU.uStars.value = cur.stars;
  rain.u.uOpacity.value = cur.rain; rain.m.visible = cur.rain > 0.01;
  rain.u.uColor.value.setRGB(state.dark ? 0.6 : 0.82, state.dark ? 0.68 : 0.88, state.dark ? 0.8 : 0.96);
  snowfall.u.uOpacity.value = cur.snowfall * 0.95; snowfall.m.visible = cur.snowfall > 0.01;
  snowfall.u.uColor.value.setRGB(state.dark ? 0.8 : 1.1, state.dark ? 0.85 : 1.1, state.dark ? 0.95 : 1.1);
  drift.u.uOpacity.value = cur.drift * 0.9; drift.m.visible = cur.drift > 0.01;
  drift.u.uKind.value = target.driftKind; drift.u.uColor.value.copy(cur.driftCol);
  drift.u.uSize.value = target.driftKind === 3 ? 22 : 15;
}

// ---- камера: облёт дерева, у каждой вкладки свой ракурс ----
const STEP = (Math.PI * 2) / TABS;
const POSES = [
  { r: 21.5, h: 3.6, look: 3.3 }, { r: 19.0, h: 2.3, look: 3.6 }, { r: 17.5, h: 5.0, look: 3.7 }, { r: 20.5, h: 7.4, look: 3.2 }, { r: 23.0, h: 3.0, look: 3.5 },
];
const INTRO = { r: 20.5, h: 4.2, look: 3.9 }; // на листе дерево стоит по центру
let rot = INIT.tab || 0, rotTarget = rot, dragBase = null;
let introK = 0; // 0 — ракурс наброска, 1 — ракурс вкладки
const smooth = (x) => x * x * (3 - 2 * x);
function poseAt(x) {
  const m = ((x % TABS) + TABS) % TABS;
  const a = Math.floor(m), b = (a + 1) % TABS, k = smooth(m - a);
  const A = POSES[a % POSES.length], B = POSES[b % POSES.length];
  return { r: A.r + (B.r - A.r) * k, h: A.h + (B.h - A.h) * k, look: A.look + (B.look - A.look) * k };
}
function placeCamera(t) {
  const p = poseAt(rot), k = smooth(introK);
  const aspect = camera.aspect;
  const wide = aspect > 1 ? 0.72 : 1; // на широком экране ближе
  const r = (INTRO.r + (p.r - INTRO.r) * k) * wide, h = INTRO.h + (p.h - INTRO.h) * k, look = INTRO.look + (p.look - INTRO.look) * k;
  const breathe = INIT.still ? 0 : Math.sin(t * 0.13) * 0.035;
  const az = rot * STEP + 0.9 + breathe;
  camera.position.set(Math.cos(az) * r, h + Math.sin(t * 0.17) * 0.08 * k, Math.sin(az) * r);
  camera.lookAt(0, look, 0);
  [rain, snowfall, drift].forEach((f) => { f.u.uCenter.value.x = camera.position.x * 0.45; f.u.uCenter.value.z = camera.position.z * 0.45; });
}

function resize() {
  const w = window.innerWidth || 360, h = window.innerHeight || 640;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
  camera.aspect = w / h;
  camera.fov = w / h < 0.75 ? 52 : 40;
  camera.updateProjectionMatrix();
  const sc = h * DPR * 0.9;
  [rain, snowfall, drift].forEach((f) => { f.u.uScale.value = sc / 600; });
}
window.addEventListener('resize', resize);
resize();

// ---- запуск: набросок → проявление ----
const quick = !!INIT.quick; // «убрать анимацию» в системе: без рисования
const DRAW_MS = lite ? 2000 : 2700, REAL_MS = lite ? 2000 : 2600, REAL_MAX = 230;
let phase = quick ? 'real' : 'sketch';
let phaseT = 0, sentHalf = false, paused = false, busyUntil = 0;
if (quick) { U.uDraw.value = 1.2; U.uRealR.value = REAL_MAX; uRealSky.value = 1; introK = 1; }
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

// ---- молнии ----
let nextFlash = 3, flash = 0;

let last = performance.now(), acc = 0, time = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (paused) { last = now; return; }
  const dtRaw = Math.min(0.1, (now - last) / 1000);
  // В покое хватает 30 кадров в секунду (на слабых телефонах — 20): бережём батарею.
  const active = phase !== 'real' || now < busyUntil || Math.abs(rotTarget - rot) > 0.002;
  acc += dtRaw; last = now;
  const minStep = active ? 0 : lite ? 1 / 20 : 1 / 30;
  if (acc < minStep - 0.002) return;
  const dt = acc; acc = 0;
  time += dt;
  U.uTime.value = time;

  if (phase === 'sketch') {
    phaseT += dt * 1000;
    U.uDraw.value = easeInOut(Math.min(1, phaseT / DRAW_MS)) * 1.14;
    if (phaseT >= DRAW_MS + 150) { phase = 'sketched'; post('sketched'); if (!window.ReactNativeWebView || INIT.auto) api.reveal(); }
  } else if (phase === 'reveal') {
    phaseT += dt * 1000;
    const k = Math.min(1, phaseT / REAL_MS);
    U.uRealR.value = Math.pow(k, 2.6) * REAL_MAX;
    uRealSky.value = smooth(Math.min(1, Math.max(0, (k - 0.45) / 0.45)));
    introK = easeInOut(Math.min(1, k * 1.05));
    if (!sentHalf && k > 0.55) { sentHalf = true; post('half'); }
    if (k >= 1) { phase = 'real'; U.uRealR.value = REAL_MAX; uRealSky.value = 1; introK = 1; busyUntil = now + 600; post('real'); }
  }

  // вкладки: поворот догоняет цель; под пальцем — сразу
  const dr = rotTarget - rot;
  rot += dr * (dragBase != null ? Math.min(1, dt * 22) : 1 - Math.exp(-dt * 4.2));
  if (Math.abs(rotTarget - rot) < 0.0005) rot = rotTarget;

  applyEnv(phase === 'real' ? 1 - Math.exp(-dt / 0.9) : 1);

  if (cur.rain > 0.5 && target.storm) {
    nextFlash -= dt;
    if (nextFlash <= 0) { flash = 1; nextFlash = 2.5 + Math.random() * 7; if (Math.random() < 0.5) setTimeout(() => { flash = 0.8; }, 140); }
  }
  flash = Math.max(0, flash - dt * 5.5);
  U.uFlash.value = flash * (state.dark ? 1.6 : 0.5) * (uRealSky.value);

  placeCamera(time);
  renderer.render(scene, camera);
}

// ---- управление из приложения ----
const api = {
  // Новое состояние (сезон, погода, тема): сцена плавно перетекает в него.
  set(s) { state = { ...state, ...s }; target = envFor(state); busyUntil = performance.now() + 2500; },
  // Перейти к вкладке i: кратчайшим поворотом, а с последней на первую — дальше по кругу.
  tab(i, instant) {
    const base = Math.round((rot - i) / TABS) * TABS + i;
    rotTarget = base; dragBase = null;
    if (instant) rot = base;
  },
  // Палец тянет: d — доля ширины экрана (влево — отрицательная), сцена поворачивается следом.
  drag(d) { if (dragBase == null) dragBase = rotTarget; rotTarget = dragBase - d; },
  release() { if (dragBase != null) { rotTarget = dragBase; dragBase = null; } },
  reveal() { if (phase === 'reveal' || phase === 'real') return; phase = 'reveal'; phaseT = 0; U.uDraw.value = 1.2; post('revealing'); },
  skip() { phase = 'real'; U.uDraw.value = 1.2; U.uRealR.value = REAL_MAX; uRealSky.value = 1; introK = 1; post('real'); },
  pause(b) { paused = !!b; },
  // для проверки в браузере
  debug: { get: () => ({ phase, rot, rotTarget, state }), seek(draw, real) { phase = 'hold'; U.uDraw.value = draw; U.uRealR.value = real; uRealSky.value = real > 100 ? 1 : 0; introK = real > 100 ? 1 : 0; } },
};
window.SCENE = api;
document.addEventListener('visibilitychange', () => { last = performance.now(); });

applyEnv(1);
placeCamera(0);
renderer.render(scene, camera);
requestAnimationFrame((t) => { last = t; frame(t); });
post('loaded', { lite });
if (quick) { post('half'); post('real'); }

// Просмотр в браузере: стрелки — вкладки, параметры в адресе (#dark=1&precip=snow&snow=1…).
if (!window.ReactNativeWebView) {
  const h = new URLSearchParams(location.hash.slice(1));
  const s = {};
  h.forEach((v, k) => { s[k] = v === 'true' || v === 'false' ? v === 'true' : isNaN(+v) ? v : +v; });
  if (Object.keys(s).length) { api.set(s); applyEnv(1); }
  let tabI = 0;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') api.tab(tabI = (tabI + 1) % TABS);
    if (e.key === 'ArrowLeft') api.tab(tabI = (tabI + TABS - 1) % TABS);
  });
}
