// Материалы горного мира: скалы и снег, море облаков, небо, осадки.
import * as THREE from 'three';
import { COMMON } from './glsl';

const mat = (U, own, vertexShader, fragmentShader, extra) => new THREE.ShaderMaterial({
  uniforms: { ...U, ...own }, vertexShader: COMMON + vertexShader, fragmentShader: COMMON + fragmentShader, ...extra,
});

// Рельеф. Высоты массива запечены в текстуру (world.js → buildHeightTexture): по ней в каждом
// пикселе считаются нормаль, затенение впадин и тень от гор (луч к солнцу по карте высот) —
// поэтому скалы рельефные, а склоны отбрасывают тени. Поверх — мелкий рельеф камня и наста.
// Снег — по высоте и крутизне (граница зависит от сезона), луга на пологих склонах летом, лёд на перегибах.
export const terrainMaterial = (U, own) => mat(U, own, /* glsl */ `
varying vec3 vW; varying vec3 vN;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`, /* glsl */ `
uniform vec3 uGrassA; uniform vec3 uGrassB;
uniform sampler2D uHeight; uniform float uHExt; uniform float uHTexel; uniform float uShadowSteps;
varying vec3 vW; varying vec3 vN;
float hAt(vec2 xz){ return texture2D(uHeight, xz / (2.0 * uHExt) + 0.5).r; }
float inMap(vec2 xz){ vec2 q = abs(xz) / uHExt; return smoothstep(1.0, 0.9, max(q.x, q.y)); }
// мелкий рельеф камня: гребни и трещины (производные шума — без лишних выборок)
float rockH(vec2 p){ float a = abs(noise2(p) * 2.0 - 1.0); float b = abs(noise2(p * 2.7 + 5.1) * 2.0 - 1.0); return (1.0 - a) * 0.65 + (1.0 - b) * 0.35; }
void main(){
  float dist = length(vW - cameraPosition);
  float near = smoothstep(260.0, 30.0, dist);
  float m = inMap(vW.xz);
  // нормаль по карте высот (центральные разности), за её пределами — вершинная
  float e = uHTexel;
  float hL = hAt(vW.xz - vec2(e, 0.0)), hR = hAt(vW.xz + vec2(e, 0.0)), hD = hAt(vW.xz - vec2(0.0, e)), hU = hAt(vW.xz + vec2(0.0, e));
  vec3 mapN = normalize(vec3(hL - hR, 2.0 * e, hD - hU));
  vec3 gN = normalize(mix(normalize(vN), mapN, m));
  // впадины темнее: высота против среднего вокруг
  float r = e * 6.0;
  float around = (hAt(vW.xz + vec2(r, 0.0)) + hAt(vW.xz - vec2(r, 0.0)) + hAt(vW.xz + vec2(0.0, r)) + hAt(vW.xz - vec2(0.0, r))) * 0.25;
  float cav = clamp((vW.y - around) * 0.35 + 0.5, 0.0, 1.0);
  float ao = mix(0.62 + 0.38 * smoothstep(-4.0, 22.0, vW.y), 0.35 + 0.65 * smoothstep(0.0, 0.75, cav), m);

  // тень от гор: шаги по лучу к солнцу; мягкая по ближайшему промаху
  float sh = 1.0;
  if (m > 0.01 && uSunDir.y > 0.02) {
    vec3 L = normalize(uSunDir);
    float t = e * 2.0;
    for (int i = 0; i < 24; i++) {
      if (float(i) >= uShadowSteps) break;
      vec3 q = vW + L * t;
      float d = q.y - hAt(q.xz);
      sh = min(sh, clamp(6.0 * d / t, 0.0, 1.0));
      t *= 1.45;
      if (q.y > 70.0 || sh < 0.02) break;
    }
    sh = mix(1.0, sh, m);
  }

  float n1 = fbm2(vW.xz * 0.11), n2 = fbm2(vW.xz * 0.7 + 3.0), n3 = noise3(vW * 2.6) * 0.6 + noise3(vW * 7.3) * 0.4;
  // камень: слои вдоль склона, тёплые и холодные породы, лишайник
  float strata = sin(vW.y * 2.3 + n1 * 6.0 + dot(vW.xz, vec2(0.05, 0.03))) * 0.5 + 0.5;
  vec3 rock = mix(vec3(0.035, 0.032, 0.033), vec3(0.17, 0.14, 0.115), n1 * 0.75 + strata * 0.15 + n3 * 0.1);
  rock = mix(rock, vec3(0.23, 0.2, 0.17), smoothstep(0.58, 0.86, n2) * 0.45);
  rock = mix(rock, vec3(0.13, 0.14, 0.08), smoothstep(0.62, 0.8, noise3(vW * 1.3 + 7.0)) * smoothstep(0.4, 0.8, gN.y) * 0.4);
  // мелкий рельеф камня — в нормаль
  vec2 rp = vW.xz * 1.7 + vec2(vW.y * 0.6, 0.0);
  float r0 = rockH(rp), rx = rockH(rp + vec2(0.07, 0.0)), rz = rockH(rp + vec2(0.0, 0.07));
  vec3 rN = normalize(gN + vec3(r0 - rx, 0.0, r0 - rz) * 5.0 * near + vec3(n2 - 0.5, 0.0, n1 - 0.5) * 0.35);
  rock *= 0.7 + 0.5 * r0 * near + 0.25 * (1.0 - near);
  // луга: пологие склоны ниже границы снега
  float line = mix(17.0, -9.0, uSnow);
  float meadow = smoothstep(0.78, 0.93, gN.y) * smoothstep(line - 2.0, line - 8.0, vW.y + (n1 - 0.5) * 8.0) * smoothstep(0.35, 0.6, n1);
  vec3 grass = mix(uGrassA, uGrassB, n2) * (0.55 + 0.3 * n3);
  vec3 albedo = mix(rock, grass, meadow * 0.85);
  albedo *= 1.0 - uWet * 0.3;
  vec3 n = normalize(mix(rN, normalize(gN + vec3(n3 - 0.5, 0.0, n2 - 0.5) * 0.25), meadow));
  vec3 col = lit(albedo, n, ao, sh);

  // снег: выше границы, держится на пологом, с крутых стен сдувается; надувы по ветру
  float hold = smoothstep(0.42, 0.7, gN.y + (n2 - 0.5) * 0.3 + (r0 - 0.5) * 0.15 * near);
  float sn = smoothstep(line - 3.0, line + 4.0, vW.y + (n1 - 0.5) * 9.0) * hold;
  sn = max(sn, uSnow * hold * 0.92);
  float drift = fbm2(vW.xz * 0.9 + 11.0);
  vec3 sN = normalize(gN + vec3(drift - 0.5, 0.0, n1 - 0.5) * 0.28 + vec3(n3 - 0.5, 0.0, 0.0) * 0.1 * near);
  vec3 snowAlb = vec3(0.6, 0.64, 0.7) * (0.95 + 0.06 * n3);
  float ice = smoothstep(0.64, 0.5, gN.y) * smoothstep(14.0, 24.0, vW.y);
  snowAlb = mix(snowAlb, vec3(0.24, 0.38, 0.5), ice * 0.6);
  vec3 snowCol = lit(snowAlb, sN, 0.7 + 0.3 * ao, sh);
  // в тени снег голубой (свет неба), а не серый
  snowCol += snowAlb * uSkyAmb * (1.0 - sh) * 0.35;
  vec3 v = normalize(cameraPosition - vW);
  snowCol += uSunCol * pow(max(dot(reflect(-uSunDir, sN), v), 0.0), 28.0) * 0.2 * sh;
  snowCol += uSunCol * step(0.986, noise3(vW * 9.0)) * near * max(dot(sN, uSunDir), 0.0) * 0.6 * sh;
  col = mix(col, snowCol, sn);

  // подножие тонет в море облаков
  float cf = cloudField(vW.xz);
  float sink = smoothstep(uCloudY + 4.2, uCloudY - 0.6, vW.y - (cf - 0.5) * 5.2 + (n2 - 0.5) * 1.5);
  vec3 cloud = lit(uCloudCol, vec3(0.0, 1.0, 0.0), 0.9, 0.9);
  col = mix(col, cloud, sink);
  gl_FragColor = vec4(tone(fogged(col, vW)), 1.0);
}`);

// Море облаков под вершиной.
export const cloudSeaMaterial = (U, own) => mat(U, own, /* glsl */ `
varying vec3 vW; varying float vH;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  float h = cloudField(w.xz);
  w.y = uCloudY + (h - 0.5) * 5.2;
  vW = w.xyz; vH = h;
  gl_Position = projectionMatrix * viewMatrix * w;
}`, /* glsl */ `
varying vec3 vW; varying float vH;
void main(){
  float e = 2.2;
  float h0 = cloudField(vW.xz), hx = cloudField(vW.xz + vec2(e, 0.0)), hz = cloudField(vW.xz + vec2(0.0, e));
  float fine = fbm2(vW.xz * 0.16 + uWindDir * uTime * 0.02);
  vec3 n = normalize(vec3((h0 - hx) * 22.0 + (fine - 0.5) * 0.9, 1.0, (h0 - hz) * 22.0 + (fbm2(vW.xz * 0.16 + 7.0) - 0.5) * 0.9));
  float ao = 0.35 + 0.65 * smoothstep(0.3, 0.68, h0 + (fine - 0.5) * 0.3);
  vec3 col = lit(uCloudCol, n, ao, ao);
  // край облака светится, когда солнце низко
  vec3 v = normalize(cameraPosition - vW);
  col += uSunCol * pow(max(dot(-v, uSunDir), 0.0), 5.0) * 0.22 * ao;
  col += vec3(0.7, 0.78, 1.0) * uFlash * smoothstep(0.45, 0.75, fbm2(vW.xz * 0.01 + uTime * 0.3)) * 1.5; // молния внутри туч
  gl_FragColor = vec4(tone(fogged(col, vW)), 1.0);
}`);

// Небо: градиент, солнце или луна, высокие облака, звёзды, вспышки молний.
export const skyMaterial = (U, own) => mat(U, own, /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0);
  gl_Position = p.xyww;
}`, /* glsl */ `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uHighCloud; uniform vec3 uDisc;
uniform float uCloud; uniform float uStars;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float t = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(t, 0.5));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uDisc * (pow(sd, 1400.0) * 4.0 + pow(sd, 60.0) * 0.3 + pow(sd, 7.0) * 0.14) * (1.0 - uCloud * 0.85);
  vec3 g = floor(d * 210.0);
  float st = step(0.997, hash31(g)) * smoothstep(0.45, 0.1, length(fract(d * 210.0) - 0.5)) * (0.6 + 0.4 * sin(uTime * 2.0 + hash31(g + 3.0) * 30.0));
  col += vec3(st) * 1.6 * uStars * smoothstep(0.0, 0.25, d.y) * (1.0 - uCloud);
  // высокие облака: перистые в ясную погоду, сплошная пелена в ненастье
  vec2 cp = d.xz / (d.y + 0.2) * 1.2 + uWindDir * uTime * (0.004 + uWind * 0.012);
  float c = fbm2(cp * vec2(1.0, 2.2)) * 0.65 + fbm2(cp * 3.1 + 3.0) * 0.35;
  float cm = smoothstep(0.8 - uCloud * 0.66, 0.97 - uCloud * 0.5, c) * smoothstep(-0.02, 0.2, d.y);
  vec3 cc = uHighCloud * (0.75 + 0.35 * c) + uDisc * pow(sd, 5.0) * 0.25;
  col = mix(col, cc, cm * (0.5 + 0.5 * uCloud));
  col += vec3(0.75, 0.8, 1.0) * uFlash * (0.3 + 0.5 * c);
  col = mix(col, uFogColor, smoothstep(0.1, -0.03, d.y));
  col = tone(col) + (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`, { side: THREE.BackSide, depthWrite: false, depthTest: false });

// Осадки вокруг камеры: дождь (штрихи) и снег (хлопья).
export const fallMaterial = (U, own) => mat(U, own, /* glsl */ `
attribute float aRand;
uniform vec3 uBox; uniform vec3 uCenter; uniform float uSpeed; uniform float uSize; uniform float uDrift; uniform float uScale;
varying float vRand; varying float vFade;
void main(){
  vec3 q = position;
  // частицы привязаны к миру, а не к камере: «коробка» осадков заворачивается вокруг неё
  vec3 world = q * uBox + vec3(uWindDir.x * uWind * uDrift, -uSpeed * (0.7 + 0.6 * aRand), uWindDir.y * uWind * uDrift) * uTime;
  world.xz += vec2(sin(uTime * 0.7 + aRand * 40.0), cos(uTime * 0.6 + aRand * 31.0)) * 0.25 * (1.0 - step(6.0, uSpeed));
  vec3 wp = uCenter + (fract((world - uCenter) / uBox + 0.5) - 0.5) * uBox;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.6 + 0.8 * aRand) * uScale / max(-mv.z, 0.5);
  vRand = aRand;
  vFade = smoothstep(0.6, 2.5, -mv.z);
}`, /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; uniform float uKind;
varying float vRand; varying float vFade;
void main(){
  vec2 p = gl_PointCoord - 0.5;
  float a;
  if (uKind < 0.5) {
    p.x += p.y * uWind * 0.9 * sign(uWindDir.x + 0.001);
    a = smoothstep(0.035, 0.0, abs(p.x)) * smoothstep(0.5, 0.2, abs(p.y)) * 0.55;
  } else {
    a = smoothstep(0.5, 0.1, length(p));
  }
  a *= uOpacity * vFade;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * (0.8 + 0.4 * vRand), a);
}`, { transparent: true, depthWrite: false });
