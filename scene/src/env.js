// Состояние сцены (сезон, погода, время суток, тема) → цвета и числа для шейдеров.
// На вход — то, что считает приложение (lib/sceneState.js):
// { dark, period, snow, leaf, tone, bloom, grass, precip, storm, fog, cloud, wind, night }
import * as THREE from 'three';

const C = (hex) => new THREE.Color(hex);
const mixC = (a, b, k) => a.clone().lerp(b, Math.max(0, Math.min(1, k)));

// Небо: яркость задаёт тема приложения (чтобы текст поверх читался), оттенок — время суток.
const SKY = {
  light: {
    morning: { zen: '#A9CDEF', hor: '#FFE6D2', sun: '#FFD9B0', si: 1.9, amb: '#C9DCF2', elev: 0.32, az: -0.9 },
    day: { zen: '#5C9FE3', hor: '#E4F1FB', sun: '#FFF3DC', si: 1.7, amb: '#CFE2F7', elev: 0.95, az: 0.5 },
    evening: { zen: '#B5B1E4', hor: '#FFD6B8', sun: '#FFB580', si: 1.9, amb: '#D2CBEA', elev: 0.26, az: 2.3 },
    night: { zen: '#8E9DD0', hor: '#D3D9EE', sun: '#DCE6FF', si: 1.1, amb: '#BFC9E8', elev: 0.7, az: 1.2 },
  },
  dark: {
    morning: { zen: '#232C4A', hor: '#6A5068', sun: '#FFB088', si: 1.1, amb: '#39405C', elev: 0.3, az: -0.9 },
    day: { zen: '#1E3346', hor: '#3D5C6E', sun: '#D6E8FF', si: 0.7, amb: '#33485A', elev: 0.9, az: 0.5 },
    evening: { zen: '#241E40', hor: '#70404A', sun: '#FF9060', si: 1.1, amb: '#3A3050', elev: 0.24, az: 2.3 },
    night: { zen: '#0C1124', hor: '#1E2A46', sun: '#9FB4FF', si: 0.75, amb: '#222C48', elev: 0.75, az: 1.2 },
  },
};

// Листва по сезону: tone 0 — весенняя, 1 — летняя, 2 — жёлтая, 3 — красно-бурая.
const LEAF = [['#6FB83A', '#A9D455'], ['#1F5E20', '#4E9230'], ['#E0A21C', '#F2C83A'], ['#B8431C', '#7A2E14']];
const BLOOM = [['#F04A5A', '#FF8FA0'], ['#D8262C', '#F0503A'], ['#C8281E', '#E2562A'], ['#B01818', '#D43A2A']];

function ramp(list, t) {
  const i = Math.max(0, Math.min(list.length - 1.001, t));
  const a = Math.floor(i), k = i - a;
  return [mixC(C(list[a][0]), C(list[a + 1][0]), k), mixC(C(list[a][1]), C(list[a + 1][1]), k)];
}

export function envFor(s) {
  const sky = SKY[s.dark ? 'dark' : 'light'][s.period] || SKY.light.day;
  const gloom = Math.max(s.cloud * 0.55, s.fog * 0.8, s.precip === 'rain' ? 0.7 : 0, s.precip === 'snow' ? 0.6 : 0, s.storm ? 0.9 : 0);
  const grey = s.dark ? C(s.storm ? '#12151B' : '#1B2028') : C(s.precip === 'snow' ? '#AEB9C8' : s.storm ? '#4E5662' : '#8F99A6');
  const zen = mixC(C(sky.zen), grey.clone().multiplyScalar(s.dark ? 0.8 : 0.92), gloom);
  const hor = mixC(C(sky.hor), grey, gloom);
  const sunK = sky.si * (1 - gloom * 0.72);
  const [leafA, leafB] = ramp(LEAF, s.tone);
  const [bloomA, bloomB] = ramp(BLOOM, s.tone);
  // трава: от бурой прошлогодней к зелёной
  const dry = [C('#6E6436'), C('#8C7E48')], green = [C('#2A5E1E'), C('#55862A')];
  const el = sky.elev;
  return {
    zenith: zen, horizon: hor,
    fogColor: mixC(hor, zen, 0.15),
    sunCol: C(sky.sun).multiplyScalar(sunK),
    disc: C(sky.sun).multiplyScalar(s.dark ? 0.9 : 1.0),
    skyAmb: mixC(C(sky.amb), grey, gloom * 0.6).multiplyScalar(s.dark ? 0.5 : 0.5 + gloom * 0.3),
    groundAmb: mixC(C(s.dark ? '#1A1C1E' : '#6E6A5C'), C(s.dark ? '#3A4254' : '#B9C4D6'), s.snow).multiplyScalar(s.dark ? 0.5 : 0.4),
    cloudCol: s.dark ? mixC(C('#39425A'), C('#1C2029'), gloom) : mixC(C('#FFFFFF'), C('#9AA2AE'), gloom * 0.9),
    sunDir: new THREE.Vector3(Math.cos(sky.az) * Math.cos(el), Math.sin(el), Math.sin(sky.az) * Math.cos(el)).normalize(),
    leafA, leafB, bloomA, bloomB,
    grassA: mixC(dry[0], green[0], s.grass), grassB: mixC(dry[1], green[1], s.grass),
    fog: 0.005 + s.fog * 0.04 + (s.precip ? 0.006 : 0) + s.cloud * 0.003,
    cloud: Math.max(s.cloud, gloom * 0.95, 0.18),
    stars: s.period === 'night' ? (s.dark ? 1 : 0.25) : 0,
    snow: s.snow, wet: s.precip === 'rain' ? 1 : 0,
    leaf: s.leaf, bloom: s.bloom,
    wind: s.wind,
    glow: s.dark ? (s.period === 'night' ? 0.5 : 0.22) : 0,
    rain: s.precip === 'rain' ? (s.storm ? 1 : 0.7) : 0,
    snowfall: s.precip === 'snow' ? 1 : 0,
    drift: s.drift ? 1 : 0, driftKind: s.drift === 'firefly' ? 3 : 2,
    driftCol: s.drift === 'firefly' ? C('#FFE9A0') : s.drift === 'petal' ? C('#FFC2CC') : s.drift === 'leaf' ? C('#E08A2A') : C('#E04A3A'),
    storm: s.storm ? 1 : 0,
  };
}

export const DEFAULT_STATE = { dark: false, period: 'day', snow: 0, leaf: 1, tone: 1, bloom: 0.4, grass: 1, precip: null, storm: false, fog: 0, cloud: 0.2, wind: 0.3, drift: 'spark' };
