// 3D-сцена фона Epimely: горный мир над облаками (по мотивам Эльбруса и Кавказа).
// Один непрерывный кадр от запуска до вкладок: камера выходит из облаков, пролетает
// к вершине и дальше медленно парит; при смене вкладки — плавный облёт к новому ракурсу.
// Погода, время суток и сезон меняют мир без переключений: числа плавно перетекают.
// Управление — window.SCENE (его вызывает приложение через WebView, см. lib/Scene3D.js).
import * as THREE from 'three';
import { buildTerrain, buildCloudSea, CLOUD_Y } from './world';
import { terrainMaterial, cloudSeaMaterial, skyMaterial, fallMaterial } from './materials';
import { envFor, DEFAULT_STATE } from './env';
import { makeSound } from './sound';

const INIT = window.__INIT || {};
const lite = !!INIT.lite;
const TABS = INIT.tabs || 4;
const post = (type, data) => { try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data })); } catch (e) {} };

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: !lite, powerPreference: 'high-performance', alpha: false });
} catch (e) {
  post('error', { message: String(e && e.message) });
  throw e;
}
// Качество подстраивается под телефон: если кадры идут медленно, разрешение снижается само.
let DPR = Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.75);
renderer.setPixelRatio(DPR);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // цвет переводят сами шейдеры
document.body.appendChild(renderer.domElement);
// Белая пелена облаков поверх холста: из неё камера выходит при запуске.
const veil = document.createElement('div');
veil.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;background:#F6F4EE;pointer-events:none';
document.body.appendChild(veil);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 2500);

const U = {
  uTime: { value: 0 }, uFogColor: { value: new THREE.Color() }, uFog: { value: 0.002 },
  uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() }, uSunCol: { value: new THREE.Color() },
  uSkyAmb: { value: new THREE.Color() }, uGroundAmb: { value: new THREE.Color() },
  uFlash: { value: 0 }, uSnow: { value: 0 }, uWet: { value: 0 },
  uWindDir: { value: new THREE.Vector2(0.8, 0.6) }, uWind: { value: 0.3 },
  uCloudY: { value: CLOUD_Y }, uCloudCol: { value: new THREE.Color() },
};
const grassU = { uGrassA: { value: new THREE.Color() }, uGrassB: { value: new THREE.Color() } };

scene.add(new THREE.Mesh(buildTerrain(lite), terrainMaterial(U, grassU)));
const sea = new THREE.Mesh(buildCloudSea(lite), cloudSeaMaterial(U, {}));
sea.frustumCulled = false;
scene.add(sea);
const skyU = { uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uHighCloud: { value: new THREE.Color() }, uDisc: { value: new THREE.Color() }, uCloud: { value: 0.2 }, uStars: { value: 0 } };
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
    uBox: { value: new THREE.Vector3(...box) }, uCenter: { value: new THREE.Vector3() }, uSpeed: { value: speed }, uSize: { value: size },
    uDrift: { value: drift }, uScale: { value: 1 }, uColor: { value: new THREE.Color('#ffffff') }, uOpacity: { value: 0 }, uKind: { value: kind },
  };
  const m = new THREE.Points(g, fallMaterial(U, u));
  m.frustumCulled = false; m.visible = false; m.renderOrder = 5;
  scene.add(m);
  return { m, u };
}
const rain = makeFall(lite ? 700 : 2400, 0, [18, 14, 18], 17, 110, 5);
const snowfall = makeFall(lite ? 500 : 1500, 1, [22, 14, 22], 1.4, 15, 2.2);

// Орёл: изредка проходит над склонами — часть мира, не награда и не задание.
const eagle = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, 0, 0, -0.45, -2.2, 0, -0.15, 0, 0, 0.5, 2.2, 0, -0.15, 0, 0, -0.45], 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x15171a, side: THREE.DoubleSide }));
  m.visible = false; m.frustumCulled = false;
  scene.add(m);
  let next = 40 + Math.random() * 80, t0 = -1, az0 = 0, dir = 1;
  return (t) => {
    if (t0 < 0) { if (t > next) { t0 = t; az0 = Math.random() * 6.28; dir = Math.random() < 0.5 ? 1 : -1; m.visible = true; } return; }
    const k = (t - t0) / 34;
    if (k >= 1) { t0 = -1; next = t + 120 + Math.random() * 180; m.visible = false; return; }
    const a = az0 + dir * k * 2.2, r = 46 + Math.sin(k * 3.1) * 10;
    m.position.set(Math.cos(a) * r, 27 + Math.sin(k * 5) * 3, Math.sin(a) * r);
    m.rotation.set(0, -a - (dir > 0 ? 0 : Math.PI), dir * 0.25);
    const flap = Math.sin(t * 2.2) * 0.35 * (0.3 + 0.7 * Math.max(0, Math.sin(t * 0.4))); // больше парит, чем машет
    const p = g.getAttribute('position');
    p.setY(2, flap); p.setY(4, flap); p.needsUpdate = true;
  };
})();
const sound = makeSound();

// ---- окружение: текущие значения плавно догоняют целевые ----
let state = { ...DEFAULT_STATE, ...(INIT.state || {}) };
let target = envFor(state);
const cur = envFor(state);
const NUMS = ['fog', 'cloud', 'cloudY', 'stars', 'snow', 'wet', 'wind', 'rain', 'snowfall'];
const COLS = ['zenith', 'horizon', 'fogColor', 'sunCol', 'disc', 'skyAmb', 'groundAmb', 'cloudCol', 'highCloud', 'grassA', 'grassB'];
function applyEnv(k) {
  NUMS.forEach((n) => { cur[n] += (target[n] - cur[n]) * k; });
  COLS.forEach((n) => { cur[n].lerp(target[n], k); });
  cur.sunDir.lerp(target.sunDir, k).normalize();
  U.uFogColor.value.copy(cur.fogColor); U.uFog.value = cur.fog;
  U.uSunDir.value.copy(cur.sunDir); U.uSunCol.value.copy(cur.sunCol);
  U.uSkyAmb.value.copy(cur.skyAmb); U.uGroundAmb.value.copy(cur.groundAmb);
  U.uSnow.value = cur.snow; U.uWet.value = cur.wet; U.uWind.value = cur.wind;
  U.uCloudY.value = cur.cloudY; U.uCloudCol.value.copy(cur.cloudCol);
  grassU.uGrassA.value.copy(cur.grassA); grassU.uGrassB.value.copy(cur.grassB);
  skyU.uZenith.value.copy(cur.zenith); skyU.uHorizon.value.copy(cur.horizon); skyU.uHighCloud.value.copy(cur.highCloud); skyU.uDisc.value.copy(cur.disc);
  skyU.uCloud.value = cur.cloud; skyU.uStars.value = cur.stars;
  rain.u.uOpacity.value = cur.rain; rain.m.visible = cur.rain > 0.01;
  rain.u.uColor.value.setRGB(state.dark ? 0.6 : 0.82, state.dark ? 0.68 : 0.88, state.dark ? 0.8 : 0.96);
  snowfall.u.uOpacity.value = cur.snowfall * 0.95; snowfall.m.visible = cur.snowfall > 0.01;
  snowfall.u.uColor.value.setRGB(state.dark ? 0.8 : 1.1, state.dark ? 0.85 : 1.1, state.dark ? 0.95 : 1.1);
}

// ---- камера: у каждой вкладки своя часть одного мира ----
// Главная — панорама двуглавой вершины; Здоровье — скалы и ледник вблизи;
// Прогресс — бескрайние хребты с высоты; Профиль — тихая долина над самыми облаками.
const STEP = (Math.PI * 2) / TABS;
const POSES = [
  { r: 92, h: 22, look: [0, 23, 0], off: 0 },
  { r: 50, h: 16, look: [0, 27, 0], off: 0.25 },
  { r: 112, h: 50, look: [0, 16, 0], off: -0.1 },
  { r: 128, h: 12, look: [0, 22, 0], off: 0.15 },
];
const BASE_AZ = 1.25;
let rot = INIT.tab || 0, rotTarget = rot, dragBase = null;
let introK = 0; // 0 — в облаках у подножия, 1 — ракурс вкладки
let celebT = -1; // пролёт в честь новой вершины: -1 — нет, иначе секунды от начала
const CELEB_S = 9;
const smooth = (x) => x * x * (3 - 2 * x);
function poseAt(x) {
  const m = ((x % TABS) + TABS) % TABS;
  const a = Math.floor(m), b = (a + 1) % TABS, k = smooth(m - a);
  const A = POSES[a % POSES.length], B = POSES[b % POSES.length];
  const L = (p, q) => p + (q - p) * k;
  return { r: L(A.r, B.r), h: L(A.h, B.h), off: L(A.off, B.off), look: [L(A.look[0], B.look[0]), L(A.look[1], B.look[1]), L(A.look[2], B.look[2])] };
}
const fwd = new THREE.Vector3();
function placeCamera(t) {
  const p = poseAt(rot), k = smooth(introK);
  const wide = camera.aspect > 1 ? 0.8 : 1;
  // медленное величественное парение: едва заметный облёт и дыхание высоты
  const drift = INIT.still ? 0 : Math.sin(t * 0.045) * 0.07 + Math.sin(t * 0.021 + 1.3) * 0.05;
  // новая вершина: камера поднимается над облаками, облетает массив и возвращается на место
  const ck = celebT < 0 ? 0 : celebT / CELEB_S, cs = Math.sin(Math.PI * ck);
  const az = rot * STEP + BASE_AZ + p.off + drift * k - (1 - k) * 0.55 + ck * ck * (3 - 2 * ck) * Math.PI * 2;
  const r = (p.r * (1 + (1 - k) * 0.35) + cs * 40) * wide;
  const h = cur.cloudY + 0.5 + (Math.max(p.h, cur.cloudY + 3.5) - cur.cloudY - 0.5) * k + Math.sin(t * 0.06) * 0.5 * k + cs * 34;
  camera.position.set(Math.cos(az) * r, h, Math.sin(az) * r);
  camera.lookAt(p.look[0], p.look[1] - (1 - k) * 6, p.look[2]);
  camera.getWorldDirection(fwd);
  [rain, snowfall].forEach((f) => { f.u.uCenter.value.copy(camera.position).addScaledVector(fwd, 7); });
}

function resize() {
  const w = window.innerWidth || 360, h = window.innerHeight || 640;
  renderer.setPixelRatio(DPR);
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
  camera.aspect = w / h;
  camera.fov = w / h < 0.75 ? 50 : 38;
  camera.updateProjectionMatrix();
  const sc = (h * DPR * 0.9) / 600;
  [rain, snowfall].forEach((f) => { f.u.uScale.value = sc; });
}
window.addEventListener('resize', resize);
resize();

// ---- запуск: выход из облаков и пролёт к вершине ----
const quick = !!INIT.quick; // «убрать анимацию» в системе или сцену включили заново: сразу на месте
let phase = quick ? 'real' : 'wait';
let phaseT = 0, flyMs = 1700, sentHalf = false, paused = false, busyUntil = 0;
if (quick) { introK = 1; veil.style.opacity = '0'; }
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

let nextFlash = 3, flash = 0;
let last = performance.now(), acc = 0, time = 0, slow = 0, frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (paused) { last = now; return; }
  const dtRaw = Math.min(0.1, (now - last) / 1000);
  // В покое хватает 30 кадров в секунду (на слабых телефонах — 20): бережём батарею.
  const active = phase === 'fly' || celebT >= 0 || now < busyUntil || Math.abs(rotTarget - rot) > 0.002;
  acc += dtRaw; last = now;
  const minStep = active ? 0 : lite ? 1 / 20 : 1 / 30;
  if (acc < minStep - 0.002) return;
  const dt = acc; acc = 0;
  time += dt;
  U.uTime.value = time;
  // Кадры идут медленно — снижаем разрешение (до 0,75 пикселя на точку), картина остаётся цельной.
  frames++; if (dt > 0.05) slow++;
  if (frames >= 90) { if (slow > 45 && DPR > 0.8) { DPR = Math.max(0.75, DPR * 0.8); resize(); } frames = 0; slow = 0; }

  if (phase === 'wait') {
    phaseT += dt * 1000;
    if (phaseT > 350) { phase = 'ready'; post('sketched'); if (!window.ReactNativeWebView || INIT.auto) api.reveal(true); }
  } else if (phase === 'fly') {
    phaseT += dt * 1000;
    const k = Math.min(1, phaseT / flyMs);
    introK = flyMs > 3000 ? easeInOut(k) : easeOut(k);
    veil.style.opacity = String(Math.max(0, 1 - k * (flyMs > 3000 ? 3.2 : 2.2)));
    if (!sentHalf && k > 0.5) { sentHalf = true; post('half'); }
    if (k >= 1) { phase = 'real'; introK = 1; veil.style.display = 'none'; busyUntil = now + 600; post('real'); }
  }

  // вкладки: поворот догоняет цель плавно; под пальцем — сразу
  const dr = rotTarget - rot;
  rot += dr * (dragBase != null ? Math.min(1, dt * 22) : 1 - Math.exp(-dt * 2.4));
  if (Math.abs(rotTarget - rot) < 0.0005) rot = rotTarget;

  applyEnv(phase === 'real' ? 1 - Math.exp(-dt / 1.6) : 1);

  if (cur.rain > 0.5 && target.storm) {
    nextFlash -= dt;
    if (nextFlash <= 0) { flash = 1; sound.thunder(0.6 + Math.random() * 0.4); nextFlash = 2.5 + Math.random() * 7; if (Math.random() < 0.5) setTimeout(() => { flash = 0.8; }, 140); }
  }
  flash = Math.max(0, flash - dt * 5.5);
  U.uFlash.value = flash * (state.dark ? 1.6 : 0.5);

  if (celebT >= 0) { celebT += dt; if (celebT >= CELEB_S) { celebT = -1; post('celebrated'); } }
  eagle(time);
  sound.update(cur.wind, cur.rain, time);
  placeCamera(time);
  renderer.render(scene, camera);
}

// ---- управление из приложения ----
const api = {
  // Новое состояние (погода, время суток, сезон, тема): мир плавно перетекает в него.
  set(s) { state = { ...state, ...s }; target = envFor(state); busyUntil = performance.now() + 4000; sound.enable(!!state.sound); },
  // Кинематографичный пролёт в честь открытой вершины; stop — прервать (пользователь пропустил).
  celebrate(stop) { if (stop) { if (celebT >= 0) celebT = Math.max(celebT, CELEB_S - 1.2); return; } if (phase === 'real' && celebT < 0) celebT = 0; },
  // Перейти к вкладке i: кратчайшим облётом, а с последней на первую — дальше по кругу.
  tab(i, instant) {
    const base = Math.round((rot - i) / TABS) * TABS + i;
    rotTarget = base; dragBase = null;
    if (instant) rot = base;
  },
  // Палец тянет: d — доля ширины экрана (влево — отрицательная), мир поворачивается следом.
  drag(d) { if (dragBase == null) dragBase = rotTarget; rotTarget = dragBase - d; },
  release() { if (dragBase != null) { rotTarget = dragBase; dragBase = null; } },
  // long — первый запуск: долгий кинематографичный пролёт; иначе быстрое возвращение в мир.
  reveal(long) { if (phase === 'fly' || phase === 'real') return; phase = 'fly'; phaseT = 0; flyMs = long ? (lite ? 4500 : 6500) : 1700; post('revealing'); },
  skip() { phase = 'real'; introK = 1; veil.style.display = 'none'; post('real'); },
  pause(b) { paused = !!b; sound.suspend(paused); },
  debug: { get: () => ({ phase, rot, rotTarget, state, DPR }), seek(k) { phase = 'hold'; introK = k; veil.style.opacity = String(Math.max(0, 1 - k * 3)); } },
};
window.SCENE = api;
document.addEventListener('visibilitychange', () => { last = performance.now(); });

applyEnv(1);
placeCamera(0);
renderer.render(scene, camera);
requestAnimationFrame((t) => { last = t; frame(t); });
post('loaded', { lite });
if (quick) { post('half'); post('real'); }

// Просмотр в браузере: стрелки — вкладки, параметры в адресе (#dark=true&precip=snow&snow=1…).
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
