// Горный мир: собственная география по мотивам Эльбруса и Кавказа — двуглавая снежная
// вершина над морем облаков, вокруг скалистые хребты. Никаких построек: только скалы,
// снег, облака и небо. Рельеф строится процедурно из одного «зерна» — мир всегда один и тот же.
import * as THREE from 'three';

const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  let fx = x - xi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
function fbm(x, z, oct) { let a = 0.5, s = 0; for (let i = 0; i < oct; i++) { s += a * noise(x, z); x = x * 2.03 + 11.7; z = z * 2.03 + 5.3; a *= 0.5; } return s; }
// «Гребневой» шум: острые хребты и ущелья.
function ridged(x, z, oct) {
  let a = 0.5, s = 0, w = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(noise(x, z) * 2 - 1);
    n *= n * w; w = Math.min(1, n * 2.2);
    s += a * n; x = x * 2.07 + 3.1; z = z * 2.07 + 7.9; a *= 0.5;
  }
  return s;
}
const dome = (A, d, s) => A / Math.pow(1 + (d / s) * (d / s), 1.15);
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const SUMMIT_W = { x: -6.2, z: 0 }, SUMMIT_E = { x: 6.6, z: 1.5 };
export const CLOUD_Y = 7;

export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  const d1 = Math.hypot(x - SUMMIT_W.x, z - SUMMIT_W.z), d2 = Math.hypot(x - SUMMIT_E.x, z - SUMMIT_E.z);
  const m1 = dome(24, d1, 10.5), m2 = dome(22.4, d2, 10);
  const twin = Math.log(Math.exp(m1 / 2.5) + Math.exp(m2 / 2.5)) * 2.5; // мягкий максимум: седловина между вершинами
  const shoulder = dome(15, r, 40);
  const massif = twin + shoulder;
  // у подножия массива — контрфорсы и ущелья, купола остаются гладкими (ледник)
  const rough = sstep(31, 13, massif) * sstep(6, 20, r);
  const but = (ridged(x * 0.05 + 2, z * 0.05 + 9, 5) - 0.4) * 15 * rough;
  // дальние хребты Кавказа: зубчатые гребни, уходящие за горизонт
  const far = sstep(40, 95, r);
  const range = Math.pow(ridged(x * 0.013 + 5, z * 0.013 + 1, 6), 1.7) * 62 * far * (0.45 + 0.75 * fbm(x * 0.004 + 8, z * 0.004, 2));
  const valley = -9 * sstep(30, 70, r);
  const fine = (fbm(x * 0.35, z * 0.35, 3) - 0.5) * 0.9 * (rough + far);
  // ледниковые кулуары и рёбра на куполах: вымоины сверху вниз, ближе к вершине мельче
  const domeZone = sstep(9, 20, massif) * (1 - sstep(23.5, 25, massif) * 0.6);
  const gully = (ridged(x * 0.11 + 31, z * 0.11 + 17, 4) - 0.45) * 3.2 * domeZone;
  return massif + but + range + valley + fine + gully;
}

export function buildTerrain(lite) {
  const R = 460, rings = lite ? 100 : 180, seg = lite ? 150 : 280;
  const pos = new Float32Array((rings + 1) * (seg + 1) * 3), idx = [];
  let k = 0;
  for (let i = 0; i <= rings; i++) {
    const d = R * Math.pow(i / rings, 1.75);
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      pos[k++] = x; pos[k++] = heightAt(x, z); pos[k++] = z;
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Море облаков: плоскость, которую шейдер поднимает волнами.
export function buildCloudSea(lite) {
  const R = 900, rings = lite ? 50 : 90, seg = lite ? 80 : 140;
  const pos = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const d = R * Math.pow(i / rings, 1.6);
    for (let j = 0; j <= seg; j++) { const a = (j / seg) * Math.PI * 2; pos.push(Math.cos(a) * d, 0, Math.sin(a) * d); }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

// Карта высот массива для шейдера: половинная точность (линейная фильтрация есть в WebGL2 всегда).
export function buildHeightTexture(quality) {
  const size = quality >= 2 ? 1024 : quality === 1 ? 512 : 256;
  const ext = 130;
  const data = new Uint16Array(size * size);
  for (let j = 0; j < size; j++) {
    const z = ((j + 0.5) / size * 2 - 1) * ext;
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) / size * 2 - 1) * ext;
      data[j * size + i] = THREE.DataUtils.toHalfFloat(heightAt(x, z));
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { tex, ext, texel: (2 * ext) / size };
}
