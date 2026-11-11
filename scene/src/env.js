// Состояние сцены (сезон, погода, время суток, тема) → цвета и числа для шейдеров.
// На вход — то, что считает приложение (lib/sceneState.js):
// { dark, period, snow, grass, tone, precip, storm, fog, cloud, wind }
import * as THREE from 'three';

const C = (hex) => new THREE.Color(hex);
const mixC = (a, b, k) => a.clone().lerp(b, Math.max(0, Math.min(1, k)));

// Небо: яркость задаёт тема приложения (чтобы текст поверх читался), оттенок — время суток.
const SKY = {
  light: {
    morning: { zen: '#5E95D6', hor: '#FFE6D2', sun: '#FFD9B0', si: 1.9, amb: '#C9DCF2', elev: 0.32, az: -0.9 },
    day: { zen: '#2F6FC4', hor: '#E4F1FB', sun: '#FFF3DC', si: 1.5, amb: '#CFE2F7', elev: 0.62, az: 0.5 },
    evening: { zen: '#6F6CC0', hor: '#FFD6B8', sun: '#FFB580', si: 1.9, amb: '#D2CBEA', elev: 0.26, az: 2.3 },
    night: { zen: '#8E9DD0', hor: '#D3D9EE', sun: '#DCE6FF', si: 1.1, amb: '#BFC9E8', elev: 0.7, az: 1.2 },
  },
  dark: {
    morning: { zen: '#232C4A', hor: '#6A5068', sun: '#FFB088', si: 1.1, amb: '#39405C', elev: 0.3, az: -0.9 },
    day: { zen: '#1E3346', hor: '#3D5C6E', sun: '#D6E8FF', si: 0.7, amb: '#33485A', elev: 0.9, az: 0.5 },
    evening: { zen: '#241E40', hor: '#70404A', sun: '#FF9060', si: 1.1, amb: '#3A3050', elev: 0.24, az: 2.3 },
    night: { zen: '#0C1124', hor: '#1E2A46', sun: '#9FB4FF', si: 0.75, amb: '#222C48', elev: 0.75, az: 1.2 },
  },
};

export function envFor(s) {
  const sky = SKY[s.dark ? 'dark' : 'light'][s.period] || SKY.light.day;
  const gloom = Math.max(s.cloud * 0.55, s.fog * 0.8, s.precip === 'rain' ? 0.7 : 0, s.precip === 'snow' ? 0.6 : 0, s.storm ? 0.9 : 0);
  const grey = s.dark ? C(s.storm ? '#12151B' : '#1B2028') : C(s.precip === 'snow' ? '#AEB9C8' : s.storm ? '#4E5662' : '#8F99A6');
  const zen = mixC(C(sky.zen), grey.clone().multiplyScalar(s.dark ? 0.8 : 0.92), gloom);
  const hor = mixC(C(sky.hor), grey, gloom);
  const sunK = sky.si * (1 - gloom * 0.72);
  // луга: весной свежая зелень, летом густая, осенью рыжеют (tone 0 → 3), ранней весной и зимой — бурые
  const dry = [C('#6A5E38'), C('#84744A')], green = [C('#33502A'), C('#587238')], rust = [C('#7A4A1E'), C('#A8742A')];
  const au = Math.max(0, Math.min(1, (s.tone - 1) / 1.5));
  const gA = mixC(mixC(dry[0], green[0], s.grass), rust[0], au), gB = mixC(mixC(dry[1], green[1], s.grass), rust[1], au);
  const el = sky.elev;
  const cloudCol = s.dark ? mixC(C('#59647E'), C('#262B36'), gloom) : mixC(C('#C9CDD6'), C('#6A717C'), gloom * 0.9);
  return {
    zenith: zen, horizon: hor,
    fogColor: mixC(hor, zen, 0.2),
    sunCol: C(sky.sun).multiplyScalar(sunK),
    disc: C(sky.sun).multiplyScalar(s.dark ? 0.9 : 1.0),
    skyAmb: mixC(C(sky.amb), grey, gloom * 0.6).multiplyScalar(s.dark ? 0.5 : 0.4 + gloom * 0.3),
    groundAmb: mixC(C(s.dark ? '#1A1C1E' : '#6E6A5C'), C(s.dark ? '#3A4254' : '#B9C4D6'), 0.6).multiplyScalar(s.dark ? 0.5 : 0.42),
    cloudCol, highCloud: s.dark ? mixC(C('#39425A'), C('#1C2029'), gloom) : mixC(C('#FFFFFF'), C(s.storm ? '#3F4650' : '#8A929E'), gloom * 0.95),
    sunDir: new THREE.Vector3(Math.cos(sky.az) * Math.cos(el), Math.sin(el), Math.sin(sky.az) * Math.cos(el)).normalize(),
    grassA: gA, grassB: gB,
    // туман поднимает море облаков к вершине и сгущает дымку
    fog: 0.0013 + s.fog * 0.02 + (s.precip ? 0.004 : 0) + s.cloud * 0.0012,
    cloudY: 7 + s.fog * 9 + (s.precip ? 2.5 : 0),
    cloud: Math.max(s.cloud, gloom * 0.95, 0.05),
    stars: s.period === 'night' ? (s.dark ? 1 : 0.25) : 0,
    snow: s.snow, wet: s.precip === 'rain' ? 1 : 0,
    wind: s.wind,
    rain: s.precip === 'rain' ? (s.storm ? 1 : 0.7) : 0,
    snowfall: s.precip === 'snow' ? 1 : 0,
    storm: s.storm ? 1 : 0,
  };
}

export const DEFAULT_STATE = { dark: false, period: 'day', snow: 0, grass: 1, tone: 1, precip: null, storm: false, fog: 0, cloud: 0.2, wind: 0.3 };
