// Свободный полёт, карта вершин и съёмка. Камера в этих режимах управляется из приложения:
// джойстик задаёт скорость (вперёд/вбок/вверх), жест — поворот взгляда. Камера не уходит под
// скалы и под облака. Карта — вид сверху на весь мир с маркерами вершин двух хребтов;
// нажатие ищет ближайший маркер на экране. Выход плавно возвращает камеру к обычному ракурсу.
import * as THREE from 'three';
import { heightAt } from './world';

// Места вершин: самые высокие точки дальних хребтов, по семь в своём секторе (запад — дисциплина, восток — постоянство).
export function peakSpots() {
  const pick = (a0, a1, n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const lo = a0 + ((a1 - a0) * i) / n, hi = a0 + ((a1 - a0) * (i + 1)) / n;
      let best = null;
      for (let j = 0; j < 140; j++) {
        const a = lo + (hi - lo) * ((j * 0.618) % 1), r = 88 + ((j * 37) % 120);
        const x = Math.cos(a) * r, z = Math.sin(a) * r, h = heightAt(x, z);
        if (!best || h > best.y) best = { x, y: h, z };
      }
      out.push(best);
    }
    return out;
  };
  return { discipline: pick(Math.PI * 0.6, Math.PI * 1.4, 7), constancy: pick(-Math.PI * 0.4, Math.PI * 0.4, 7) };
}

export function makeExplore({ scene, camera, cur }) {
  const spots = peakSpots();
  let markers = []; // { id, pos, unlocked, next, ridge }
  const g = new THREE.BufferGeometry();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    vertexShader: `attribute float aState; attribute float aRidge; uniform float uScale; uniform float uTime; varying float vS; varying float vR;
      void main(){ vS = aState; vR = aRidge; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = uScale * (aState > 1.5 ? 44.0 + 8.0 * sin(uTime * 3.0) : aState > 0.5 ? 34.0 : 26.0); }`,
    fragmentShader: `varying float vS; varying float vR;
      void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard;
        vec3 col = vR > 0.5 ? vec3(1.0, 0.78, 0.4) : vec3(0.45, 0.9, 1.0);
        float core = smoothstep(0.24, 0.16, d), ring = smoothstep(0.5, 0.44, d) * smoothstep(0.3, 0.38, d);
        float rim = smoothstep(0.5, 0.46, d) * smoothstep(0.4, 0.46, d);
        // открытые — яркое ядро и кольцо цвета хребта; закрытые — тёмный круг в светлом кольце (видны на облаках)
        vec3 c = vS > 0.5 ? mix(col, vec3(1.0), core * 0.5) : mix(vec3(0.12, 0.14, 0.18), vec3(0.95), ring);
        float a = vS > 0.5 ? max(core, ring) : max(ring, smoothstep(0.3, 0.2, d) * 0.75);
        gl_FragColor = vec4(mix(c, vec3(0.05), rim * 0.6), a); }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.visible = false; pts.renderOrder = 20; pts.frustumCulled = false;
  scene.add(pts);

  function setPeaks(list) {
    markers = [];
    const pos = [], st = [], rd = [];
    (list || []).forEach((p) => {
      const arr = p.ridge === 'constancy' ? spots.constancy : spots.discipline;
      const i = Math.max(0, Math.min(6, p.index || 0));
      const s = arr[i];
      if (!s) return;
      const v = new THREE.Vector3(s.x, s.y + 2.5, s.z);
      markers.push({ id: p.id, pos: v, unlocked: !!p.unlocked, next: !!p.next });
      pos.push(v.x, v.y, v.z); st.push(p.next ? 2 : p.unlocked ? 1 : 0); rd.push(p.ridge === 'constancy' ? 1 : 0);
    });
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aState', new THREE.Float32BufferAttribute(st, 1));
    g.setAttribute('aRidge', new THREE.Float32BufferAttribute(rd, 1));
  }

  // состояние полёта
  let mode = null; // null | 'fly' | 'map'
  let k = 0; // 0 — обычная камера, 1 — режим
  const pos = new THREE.Vector3(), saved = new THREE.Vector3(), savedLook = new THREE.Vector3();
  let yaw = 0, pitch = -0.12, vel = [0, 0, 0], turn = 0;
  let mapAz = 0.6, mapDist = 260, flyTarget = null, flyT = 0;
  const look = new THREE.Vector3(), tmp = new THREE.Vector3();

  function begin(m, basePos, baseLook) {
    if (!mode) { saved.copy(basePos); savedLook.copy(baseLook); pos.copy(basePos); const d = tmp.copy(baseLook).sub(basePos); yaw = Math.atan2(d.z, d.x); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); }
    mode = m; flyTarget = null;
  }
  const floor = (x, z) => Math.max(heightAt(x, z) + 2.5, cur.cloudY + 1.5);

  return {
    setPeaks,
    get active() { return mode != null || k > 0.001; },
    get mode() { return mode; },
    get mapK() { return mode === 'map' ? k : 0; },
    fly() { if (mode === 'fly') return; begin('fly', camera.position, look.copy(camera.position).add(camera.getWorldDirection(tmp).multiplyScalar(10))); },
    map() { if (mode === 'map') return; begin('map', camera.position, look.copy(camera.position).add(camera.getWorldDirection(tmp).multiplyScalar(10))); },
    exit() { mode = null; vel = [0, 0, 0]; turn = 0; flyTarget = null; },
    move(f, s, u) { vel = [f, s, u].map((x) => Math.max(-1, Math.min(1, Number(x) || 0))); },
    look(dx, dy) {
      if (mode === 'map') { mapAz -= dx * 2.2; mapDist = Math.max(120, Math.min(360, mapDist * (1 + dy))); return; }
      yaw += dx * 2.4; pitch = Math.max(-1.2, Math.min(0.9, pitch - dy * 1.6));
    },
    turn(v) { turn = Math.max(-1, Math.min(1, Number(v) || 0)); },
    flyTo(id) {
      const m = markers.find((x) => x.id === id);
      if (!m) return false;
      if (mode !== 'fly') this.fly();
      const dir = tmp.set(m.pos.x, 0, m.pos.z).normalize();
      flyTarget = { from: pos.clone(), to: new THREE.Vector3(m.pos.x + dir.x * 26, m.pos.y + 10, m.pos.z + dir.z * 26), at: m.pos.clone() };
      flyT = 0;
      return true;
    },
    // ближайший к точке экрана маркер (в долях экрана 0..1)
    pick(sx, sy, w, h) {
      let best = null, bd = 1e9;
      for (const m of markers) {
        const p = tmp.copy(m.pos).project(camera);
        if (p.z > 1) continue;
        const dx = (p.x * 0.5 + 0.5 - sx) * w, dy = (-p.y * 0.5 + 0.5 - sy) * h;
        const d = Math.hypot(dx, dy);
        if (d < bd) { bd = d; best = m; }
      }
      return best && bd < 48 ? best.id : null;
    },
    // вызывается каждый кадр после обычной расстановки камеры: смешивает с режимом
    update(dt, t, scale) {
      mat.uniforms.uTime.value = t; mat.uniforms.uScale.value = scale;
      k += ((mode ? 1 : 0) - k) * (1 - Math.exp(-dt * 2.2));
      pts.visible = mode === 'map' || (mode === 'fly' && k > 0.5);
      if (k < 0.001) return;
      let tp, tl;
      if (mode === 'map' || (!mode && !flyTarget && saved.y > 1e5)) {
        tp = tmp.set(Math.cos(mapAz) * mapDist, mapDist * 0.62, Math.sin(mapAz) * mapDist).clone();
        tl = new THREE.Vector3(0, 8, 0);
        pos.lerp(tp, 1 - Math.exp(-dt * 2.5));
        look.lerp(tl, 1 - Math.exp(-dt * 2.5));
      } else if (flyTarget) {
        flyT = Math.min(1, flyT + dt / 5);
        const e = flyT * flyT * (3 - 2 * flyT);
        pos.lerpVectors(flyTarget.from, flyTarget.to, e);
        pos.y += Math.sin(Math.PI * e) * 30;
        look.lerp(flyTarget.at, 1 - Math.exp(-dt * 3));
        const d = tmp.copy(look).sub(pos); yaw = Math.atan2(d.z, d.x); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
        if (flyT >= 1) flyTarget = null;
      } else if (mode === 'fly') {
        yaw += turn * dt * 1.1;
        const speed = 22;
        const fx = Math.cos(yaw), fz = Math.sin(yaw);
        pos.x += (fx * vel[0] - fz * vel[1]) * speed * dt;
        pos.z += (fz * vel[0] + fx * vel[1]) * speed * dt;
        pos.y += vel[2] * speed * 0.6 * dt;
        const r = Math.hypot(pos.x, pos.z);
        if (r > 380) { pos.x *= 380 / r; pos.z *= 380 / r; }
        pos.y = Math.max(floor(pos.x, pos.z), Math.min(160, pos.y));
        look.set(pos.x + Math.cos(yaw) * Math.cos(pitch) * 10, pos.y + Math.sin(pitch) * 10, pos.z + Math.sin(yaw) * Math.cos(pitch) * 10);
      }
      if (!mode) { // возвращение: от позиции режима к обычной камере
        const base = camera.position.clone(), bl = camera.position.clone().add(camera.getWorldDirection(tmp).multiplyScalar(10));
        camera.position.lerpVectors(base, pos, k);
        camera.lookAt(bl.lerp(look, k));
        return;
      }
      camera.position.lerp(pos, Math.min(1, k * 1.2));
      camera.lookAt(look);
    },
  };
}
