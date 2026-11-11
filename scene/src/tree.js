// Выдуманное дерево по рисунку: изогнутый ствол растёт из каменного кольца, длинные
// ветви расходятся дугами и свисают; на ветках листья и красные цветы.
// Всё строится процедурно из одного «зерна» — дерево каждый раз одно и то же.
import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

class Builder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.t = []; this.bend = []; this.idx = []; }
  // Трубка вдоль кривой: радиус r0→r1, порядок рисования t0→t1, гибкость b0→b1.
  tube(curve, segs, radial, r0, r1, t0, t1, b0, b1, flare = 0) {
    const base = this.pos.length / 3;
    const pts = curve.getSpacedPoints(segs);
    const fr = curve.computeFrenetFrames(segs, false);
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      let r = r0 + (r1 - r0) * Math.pow(u, 0.85);
      r *= 1 + flare * Math.exp(-u * 9);
      if (i === segs) r *= 0.35;
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const nx = Math.cos(a) * fr.normals[i].x + Math.sin(a) * fr.binormals[i].x;
        const ny = Math.cos(a) * fr.normals[i].y + Math.sin(a) * fr.binormals[i].y;
        const nz = Math.cos(a) * fr.normals[i].z + Math.sin(a) * fr.binormals[i].z;
        // у основания ствола — неровные «корни»
        const k = r * (1 + flare * 0.35 * Math.exp(-u * 12) * Math.sin(a * 5 + 1.3));
        this.pos.push(pts[i].x + nx * k, pts[i].y + ny * k, pts[i].z + nz * k);
        this.nor.push(nx, ny, nz);
        this.uv.push(j / radial, u * curve.getLength());
        this.t.push(t0 + (t1 - t0) * u);
        this.bend.push(b0 + (b1 - b0) * u);
      }
    }
    const row = radial + 1;
    for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
      const a = base + i * row + j, b = a + row;
      this.idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(this.t, 1));
    g.setAttribute('aBend', new THREE.Float32BufferAttribute(this.bend, 1));
    g.setIndex(this.idx);
    return g;
  }
}

// Дуга ветви: поднимается, уходит в сторону и свисает на конце.
function arc(p0, out, len, rise, droop, r) {
  const side = v3(-out.z, 0, out.x);
  const wob = () => (r() - 0.5) * len * 0.12;
  return new THREE.CatmullRomCurve3([
    p0.clone(),
    p0.clone().addScaledVector(out, len * 0.26).addScaledVector(UP, len * rise * 0.75).addScaledVector(side, wob()),
    p0.clone().addScaledVector(out, len * 0.6).addScaledVector(UP, len * rise).addScaledVector(side, wob()),
    p0.clone().addScaledVector(out, len * 0.9).addScaledVector(UP, len * (rise - droop * 0.45)).addScaledVector(side, wob()),
    p0.clone().addScaledVector(out, len * 1.08).addScaledVector(UP, len * (rise - droop)),
  ]);
}

export function buildTree({ lite }) {
  const r = rng(20261110);
  const b = new Builder();
  const anchors = []; // точки, где растут листья: { p, bend, out }
  const radial = lite ? 5 : 7;

  const trunk = new THREE.CatmullRomCurve3([v3(0, -0.3, 0), v3(0.22, 1.2, 0.1), v3(-0.22, 2.6, -0.12), v3(0.16, 3.9, 0.14), v3(0.02, 5.0, 0.0)]);
  b.tube(trunk, lite ? 14 : 22, lite ? 8 : 12, 0.66, 0.3, 0, 0.3, 0, 0.12, 0.95);

  const BOUGHS = 9;
  for (let i = 0; i < BOUGHS; i++) {
    const top = i >= BOUGHS - 3;
    const u = top ? 0.97 : 0.5 + (i / (BOUGHS - 3)) * 0.42;
    const p0 = trunk.getPointAt(Math.min(u, 0.99));
    const az = i * 2.39996 + 0.5;
    const out = v3(Math.cos(az), 0, Math.sin(az));
    const len = 4.3 + r() * 1.7;
    const rise = top ? 0.5 + r() * 0.12 : 0.26 + r() * 0.14;
    const bough = arc(p0, out, len, rise, 0.3 + r() * 0.16, r);
    const tS = 0.24 + i * 0.022;
    const r0 = 0.24 - (i / BOUGHS) * 0.05;
    b.tube(bough, lite ? 10 : 16, radial, r0, 0.035, tS, tS + 0.26, 0.12, 1);
    for (let k = 0; k < 6; k++) anchors.push({ p: bough.getPointAt(0.5 + k * 0.1), bend: 0.55 + k * 0.09, out });

    const SUBS = 4;
    for (let s = 0; s < SUBS; s++) {
      const su = 0.3 + (s / (SUBS - 1)) * 0.58 + (r() - 0.5) * 0.06;
      const sp = bough.getPointAt(su);
      const sign = s % 2 ? 1 : -1;
      const ang = sign * (0.55 + r() * 0.7);
      const tan = bough.getTangentAt(su); tan.y = 0; tan.normalize();
      const sout = tan.clone().applyAxisAngle(UP, ang).normalize();
      const slen = (1.5 + r() * 1.3) * (1.15 - su * 0.4);
      const sub = arc(sp, sout, slen, 0.22 + r() * 0.2, 0.42 + r() * 0.3, r);
      const st = tS + 0.24 + su * 0.1;
      const bw = 0.12 + (1 - 0.12) * su;
      b.tube(sub, lite ? 6 : 9, lite ? 4 : 5, r0 * (1 - su) * 0.55 + 0.03, 0.014, st, st + 0.16, bw, Math.min(1.15, bw + 0.35));
      for (let k = 0; k < 5; k++) anchors.push({ p: sub.getPointAt(0.3 + k * 0.17), bend: bw + 0.08 * k, out: sout });

      const TW = lite ? 1 : 2;
      for (let w = 0; w < TW; w++) {
        const tu = 0.4 + r() * 0.45;
        const tp = sub.getPointAt(tu);
        const tout = sout.clone().applyAxisAngle(UP, (r() - 0.5) * 2.2).normalize();
        const twig = arc(tp, tout, 0.6 + r() * 0.6, 0.15 + r() * 0.25, 0.5 + r() * 0.3, r);
        b.tube(twig, 5, 4, 0.02, 0.008, st + 0.12, st + 0.2, bw + 0.2, Math.min(1.2, bw + 0.45));
        for (let k = 0; k < 3; k++) anchors.push({ p: twig.getPointAt(0.35 + k * 0.3), bend: Math.min(1.2, bw + 0.3 + 0.07 * k), out: tout });
      }
    }
  }
  return { geometry: b.geometry(), anchors, rand: r };
}

// Листья и цветы: много маленьких квадратов (форму вырезает шейдер), у каждого своё
// место, поворот, размер и «номер» для появления по сезону.
export function buildFoliage(anchors, count, r, { size, spread, bloom }) {
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.translate(0, 0.5, 0); // растёт от черешка
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index;
  g.setAttribute('position', quad.getAttribute('position'));
  g.setAttribute('uv', quad.getAttribute('uv'));
  const off = new Float32Array(count * 3), quat = new Float32Array(count * 4), misc = new Float32Array(count * 4);
  const q = new THREE.Quaternion(), e = new THREE.Euler(), c = v3(0, 6.2, 0);
  for (let i = 0; i < count; i++) {
    const a = anchors[Math.floor(r() * anchors.length)];
    const rad = spread * Math.cbrt(r());
    const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
    const p = v3(a.p.x + rad * Math.sin(ph) * Math.cos(th), a.p.y + rad * Math.cos(ph) * (bloom ? 0.8 : 0.7) - (bloom ? 0 : 0.12), a.p.z + rad * Math.sin(ph) * Math.sin(th));
    off.set([p.x, p.y, p.z], i * 3);
    // лист смотрит вверх-наружу и слегка свисает
    e.set((r() - 0.5) * 1.6 + (bloom ? 0 : 0.9), r() * Math.PI * 2, (r() - 0.5) * 1.2);
    q.setFromEuler(e);
    quat.set([q.x, q.y, q.z, q.w], i * 4);
    const depth = 1 - Math.min(1, p.distanceTo(c) / 6.5); // глубина в кроне — для затенения
    misc.set([r(), size * (0.7 + r() * 0.6), Math.min(1.2, a.bend + 0.12), depth], i * 4);
  }
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
  g.setAttribute('aQuat', new THREE.InstancedBufferAttribute(quat, 4));
  g.setAttribute('aMisc', new THREE.InstancedBufferAttribute(misc, 4));
  g.instanceCount = count;
  g.boundingSphere = new THREE.Sphere(v3(0, 5, 0), 12);
  return g;
}

// Каменное кольцо в два ряда, как на рисунке: неровные блоки со сдвинутыми швами.
export function buildRing(r) {
  const parts = [];
  const tiers = [{ n: 13, rad: 2.75, y: 0.26, h: 0.56, d: 0.62 }, { n: 12, rad: 2.6, y: 0.8, h: 0.5, d: 0.56 }];
  tiers.forEach((tier, ti) => {
    for (let i = 0; i < tier.n; i++) {
      const a = ((i + (ti ? 0.5 : 0)) / tier.n) * Math.PI * 2;
      const w = ((Math.PI * 2 * tier.rad) / tier.n) * (0.9 + r() * 0.06);
      const g = new THREE.BoxGeometry(w, tier.h * (0.9 + r() * 0.2), tier.d * (0.9 + r() * 0.2), 4, 2, 2);
      const p = g.getAttribute('position');
      const sx = r() * 10, bendK = w / (2 * tier.rad);
      for (let k = 0; k < p.count; k++) {
        let x = p.getX(k), y = p.getY(k), z = p.getZ(k);
        // блок чуть изогнут по кругу и побит по граням
        z -= (x * x) / (2 * tier.rad) * 1.0 + 0 * bendK;
        const n = Math.sin(x * 7 + sx) * Math.sin(y * 9 + sx * 2) * Math.sin(z * 8 + sx * 3);
        x *= 1 - 0.07 * Math.abs(y / tier.h) + n * 0.03; y += n * 0.035; z += n * 0.04;
        p.setXYZ(k, x, y, z);
      }
      g.rotateY(-a + Math.PI / 2 + (r() - 0.5) * 0.05);
      g.translate(Math.cos(a) * tier.rad, tier.y + (r() - 0.5) * 0.04, Math.sin(a) * tier.rad);
      g.computeVertexNormals();
      const t = new Float32Array(p.count).fill(0.78 + ti * 0.07 + (i / tier.n) * 0.07);
      g.setAttribute('aT', new THREE.BufferAttribute(t, 1));
      parts.push(g);
    }
  });
  return mergeGeometries(parts);
}

export function mergeGeometries(list) {
  const out = new THREE.BufferGeometry();
  const names = Object.keys(list[0].attributes);
  let total = 0;
  list.forEach((g) => { total += g.getAttribute('position').count; });
  names.forEach((n) => {
    const size = list[0].getAttribute(n).itemSize;
    const arr = new Float32Array(total * size);
    let o = 0;
    list.forEach((g) => { arr.set(g.getAttribute(n).array, o); o += g.getAttribute(n).array.length; });
    out.setAttribute(n, new THREE.BufferAttribute(arr, size));
  });
  const idx = [];
  let base = 0;
  list.forEach((g) => {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base);
    base += g.getAttribute('position').count;
  });
  out.setIndex(idx);
  return out;
}

// Высота земли: ровная поляна у дерева, дальше — пологие холмы.
export function groundHeight(x, z) {
  const d = Math.hypot(x, z);
  const k = Math.min(1, Math.max(0, (d - 9) / 40));
  const hills = Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05 - 0.7) * 7 + Math.sin(x * 0.11 + z * 0.09) * 2.2 + Math.sin(z * 0.02 + 2.0) * 5;
  return k * k * (hills + 5) + Math.sin(x * 0.6) * Math.cos(z * 0.5) * 0.06 * Math.min(1, d / 4);
}

export function buildGround(lite) {
  const R = 150, rings = lite ? 44 : 70, seg = lite ? 64 : 110;
  const pos = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const d = R * Math.pow(i / rings, 2.1);
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      pos.push(x, groundHeight(x, z), z);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Травинки на поляне вокруг кольца.
export function buildGrass(count, r) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.12, 0.55, 0, -0.5, 0, 0, 0.12, 0.55, 0, 0, 1, 0], 3));
  const off = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const d = 3.2 + Math.pow(r(), 0.7) * 17, a = r() * Math.PI * 2;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    off.set([x, groundHeight(x, z), z, r()], i * 4);
  }
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  g.instanceCount = count;
  g.boundingSphere = new THREE.Sphere(v3(0, 0, 0), 24);
  return g;
}
