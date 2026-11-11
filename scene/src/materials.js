// Материалы сцены. У каждого два «лица»: карандашный набросок на бумаге и настоящая
// поверхность со светом; между ними — плавный переход по realAt() (см. glsl.js).
import * as THREE from 'three';
import { COMMON, SWAY } from './glsl';

const mat = (U, own, vertexShader, fragmentShader, extra) => new THREE.ShaderMaterial({
  uniforms: { ...U, ...own }, vertexShader: COMMON + SWAY + vertexShader, fragmentShader: COMMON + fragmentShader, ...extra,
});

// Кора: ствол и ветви.
export const barkMaterial = (U) => mat(U, {}, /* glsl */ `
attribute float aT; attribute float aBend;
varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vT; varying vec3 vO;
void main(){
  vec3 p = sway(position, aBend);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz; vO = position; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; vT = aT;
  gl_Position = projectionMatrix * viewMatrix * w;
}`, /* glsl */ `
varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vT; varying vec3 vO;
void main(){
  if (vT > uDraw) discard;
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float a = vUv.x * 6.2831853;
  // борозды коры вдоль ствола (без шва по окружности)
  float ridge = noise3(vec3(cos(a) * 3.2, sin(a) * 3.2, vUv.y * 0.9));
  float fine = noise3(vec3(cos(a) * 9.0, sin(a) * 9.0, vUv.y * 3.5));
  float crack = smoothstep(0.42, 0.6, ridge * 0.7 + fine * 0.3);
  vec3 albedo = mix(vec3(0.022, 0.014, 0.01), vec3(0.13, 0.085, 0.055), crack);
  albedo = mix(albedo, vec3(0.2, 0.17, 0.14), smoothstep(0.6, 0.9, fine) * 0.3);
  // мох у основания с подветренной стороны
  float moss = smoothstep(2.4, 0.4, vO.y) * smoothstep(0.45, 0.7, noise3(vO * 2.3)) * (1.0 - uSnow);
  albedo = mix(albedo, vec3(0.12, 0.2, 0.06), moss * 0.7);
  albedo *= 1.0 - uWet * 0.3;
  n = normalize(n + (vec3(ridge, fine, ridge * fine) - 0.5) * 0.55);
  float ao = 0.55 + 0.45 * smoothstep(0.0, 2.5, vO.y) * (0.75 + 0.25 * crack);
  vec3 col = lit(albedo, n, ao, 0.9);
  // снег лежит на верхней стороне веток
  float sn = smoothstep(0.25, 0.6, n.y + (fine - 0.5) * 0.5) * uSnow;
  col = mix(col, lit(vec3(0.92, 0.95, 1.0), vec3(0.0, 1.0, 0.0), 1.0, 1.0), sn);
  col += uSkyAmb * pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.07;
  col = tone(fogged(col, vW));

  // набросок: контур по краю формы и штриховка в тени
  float fres = 1.0 - abs(dot(normalize(vN), v));
  float line = smoothstep(0.5, 0.82, fres + (noise2(gl_FragCoord.xy / uPx * 0.35) - 0.5) * 0.25);
  float shade = 1.0 - max(dot(normalize(vN), normalize(vec3(-0.5, 0.7, 0.5))), 0.0);
  float h = hatch(gl_FragCoord.xy, 1.0) * smoothstep(0.55, 0.95, shade) * 0.55;
  float tip = smoothstep(uDraw - 0.02, uDraw, vT) * 0.6; // кончик карандаша темнее
  vec3 sk = pencil(gl_FragCoord.xy, max(max(line * 0.9, h), tip), vec3(0.16, 0.16, 0.18));
  gl_FragColor = vec4(mix(sk, col, realAt(vW)), 1.0);
}`);

// Камни кольца.
export const stoneMaterial = (U) => mat(U, {}, /* glsl */ `
attribute float aT;
varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vT;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; vT = aT;
  gl_Position = projectionMatrix * viewMatrix * w;
}`, /* glsl */ `
varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vT;
void main(){
  if (vT > uDraw) discard;
  vec3 n = normalize(vN);
  float big = noise3(vW * 1.7), fine = noise3(vW * 9.0);
  vec3 albedo = mix(vec3(0.07, 0.07, 0.072), vec3(0.26, 0.245, 0.22), big * 0.6 + fine * 0.4);
  float moss = smoothstep(0.5, 0.75, noise3(vW * 2.6 + 4.0)) * smoothstep(-0.2, 0.6, n.y) * (1.0 - uSnow);
  albedo = mix(albedo, vec3(0.16, 0.26, 0.08), moss * 0.75);
  albedo *= 1.0 - uWet * 0.35;
  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float ao = 0.5 + 0.5 * smoothstep(0.0, 0.16, edge);
  n = normalize(n + (vec3(big, fine, big * fine) - 0.5) * 0.4);
  vec3 col = lit(albedo, n, ao * smoothstep(-0.1, 0.9, vW.y) , 0.9);
  float sn = smoothstep(0.45, 0.8, n.y + (fine - 0.5) * 0.4) * uSnow;
  col = mix(col, lit(vec3(0.92, 0.95, 1.0), vec3(0.0, 1.0, 0.0), 1.0, 1.0), sn);
  col = tone(fogged(col, vW));

  float line = 1.0 - smoothstep(0.015, 0.06, edge + (noise2(gl_FragCoord.xy / uPx * 0.3) - 0.5) * 0.03);
  float h = hatch(gl_FragCoord.xy, -1.0) * smoothstep(0.3, -0.5, normalize(vN).y) * 0.4;
  vec3 sk = pencil(gl_FragCoord.xy, max(line * 0.85, h), vec3(0.16, 0.16, 0.18));
  gl_FragColor = vec4(mix(sk, col, realAt(vW)), 1.0);
}`);

// Листья (bloom: false) и цветы (bloom: true). В наброске — точки карандашом.
export const foliageMaterial = (U, own, bloom) => mat(U, own, /* glsl */ `
attribute vec3 aOff; attribute vec4 aQuat; attribute vec4 aMisc;
uniform float uAmount;
varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying float vRand; varying float vDepth; varying float vReal;
vec3 rot(vec3 v, vec4 q){ return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main(){
  vec3 base = (modelMatrix * vec4(aOff, 1.0)).xyz;
  float real = realAt(base);
  // по сезону видна только часть листьев; в наброске — редкие точки
  float show = smoothstep(aMisc.x - 0.08, aMisc.x, uAmount * 1.08);
  float dotted = step(fract(aMisc.x * 7.31), ${bloom ? '0.7' : '0.1'});
  float drawn = smoothstep(0.86, 1.0, uDraw - fract(aMisc.x * 3.7) * 0.12 + 0.12) ;
  float size = aMisc.y * show * mix(dotted * drawn * ${bloom ? '0.9' : '0.8'}, 1.0, real);
  float flutter = sin(uTime * (3.0 + aMisc.x * 4.0) + aMisc.x * 40.0) * uWind * 0.35;
  vec3 p = position;
  p.x += flutter * p.y * 0.4;
  vec3 local = rot(p * size, aQuat);
  vec3 w = sway(aOff, aMisc.z) + local;
  vec4 wp = modelMatrix * vec4(w, 1.0);
  vW = wp.xyz; vUv = uv; vRand = aMisc.x; vDepth = aMisc.w; vReal = real;
  vN = normalize(mat3(modelMatrix) * rot(vec3(0.0, 0.0, 1.0), aQuat));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`, /* glsl */ `
uniform vec3 uColA; uniform vec3 uColB; uniform float uGlow;
varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying float vRand; varying float vDepth; varying float vReal;
void main(){
  vec2 p = vUv - vec2(0.5, 0.5);
  float inDot = step(length(p), 0.2);
  ${bloom ? /* glsl */ `
  float ang = atan(p.y, p.x);
  float rr = length(p);
  float inShape = step(rr, 0.3 + 0.16 * cos(ang * 5.0 + vRand * 6.0));
  float vein = smoothstep(0.0, 0.3, rr);` : /* glsl */ `
  float y = vUv.y;
  float wdt = 0.36 * sin(3.14159 * pow(y, 0.75)) + 0.012;
  float inShape = step(abs(p.x), wdt) * step(0.02, y);
  float vein = smoothstep(0.0, 0.05, abs(p.x)) * 0.25 + 0.75;`}
  if (mix(inDot, inShape, step(0.3, vReal)) < 0.5) discard;
  vec3 v = normalize(cameraPosition - vW);
  vec3 n = normalize(vN); if (dot(n, v) < 0.0) n = -n;
  vec3 albedo = mix(uColA, uColB, fract(vRand * 5.3)) * (0.82 + 0.36 * fract(vRand * 11.7));
  ${bloom ? 'albedo = mix(albedo * 1.25 + vec3(0.25, 0.18, 0.05), albedo, vein);' : 'albedo *= vein * (0.75 + 0.25 * vUv.y);'}
  albedo *= 1.0 - uWet * 0.15;
  float ao = 0.22 + 0.78 * pow(1.0 - vDepth * 0.9, 1.6);
  n = normalize(mix(n, normalize(vW - vec3(0.0, 4.5, 0.0)), 0.6)); // свет ложится по форме кроны // мягкий общий свет по кроне
  vec3 col = lit(albedo, n, ao, ao);
  // просвет: лист светится, если солнце за ним
  col += albedo * uSunCol * pow(max(dot(-v, uSunDir), 0.0), 3.0) * 0.55 * ao;
  col = mix(col, lit(vec3(0.92, 0.95, 1.0), vec3(0.0, 1.0, 0.0), 1.0, 1.0), uSnow * smoothstep(0.55, 0.9, vUv.y) * ${bloom ? '0.0' : '0.6'});
  col += albedo * uGlow;
  col = tone(fogged(col, vW));
  vec3 lead = ${bloom ? 'vec3(0.86, 0.2, 0.18)' : 'vec3(0.35, 0.35, 0.38)'};
  vec3 sk = pencil(gl_FragCoord.xy, 0.9, lead);
  gl_FragColor = vec4(mix(sk, col, vReal), 1.0);
}`, { side: THREE.DoubleSide });

// Земля: трава, тропа у кольца, снег пятнами (оттепель) или сплошь, тень кроны.
export const groundMaterial = (U, own) => mat(U, own, /* glsl */ `
varying vec3 vW; varying vec3 vN;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`, /* glsl */ `
uniform vec3 uGrassA; uniform vec3 uGrassB;
varying vec3 vW; varying vec3 vN;
void main(){
  float d = length(vW.xz);
  float n1 = fbm2(vW.xz * 0.35), n2 = fbm2(vW.xz * 2.4 + 7.0), n3 = noise2(vW.xz * 14.0);
  vec3 albedo = mix(uGrassA, uGrassB, n1) * (0.78 + 0.3 * n2 + 0.12 * n3);
  vec3 soil = mix(vec3(0.16, 0.11, 0.07), vec3(0.3, 0.23, 0.16), n2);
  float bare = smoothstep(3.9, 2.9, d + n2 * 0.9) + smoothstep(0.62, 0.75, n1) * 0.35;
  albedo = mix(albedo, soil, clamp(bare, 0.0, 1.0));
  albedo *= 1.0 - uWet * 0.3;
  vec3 n = normalize(vN + vec3(n2 - 0.5, 0.0, n3 - 0.5) * 0.25);
  // тень кроны с солнечными пятнами, которые шевелит ветер
  vec2 sp = vW.xz - uSunDir.xz / max(uSunDir.y, 0.25) * 5.0;
  float dapple = fbm2(sp * 0.9 + uWindDir * sin(uTime * 0.8) * uWind * 0.4);
  float sh = smoothstep(7.5, 2.0, length(sp)) * (0.55 + 0.45 * smoothstep(0.35, 0.65, dapple));
  float contact = smoothstep(3.6, 2.2, d) * 0.5;
  float shadow = 1.0 - clamp(sh * 0.75, 0.0, 1.0);
  vec3 col = lit(albedo, n, 1.0 - contact, shadow);
  // снег: при неполном покрове лежит пятнами, под деревом тает первым
  float cover = uSnow * 1.25 - (1.0 - uSnow) * smoothstep(8.0, 2.5, d) * 0.5;
  float sn = smoothstep(0.0, 0.18, cover - (1.0 - n1 * 0.6 - n2 * 0.4) * 0.9);
  vec3 snowCol = lit(vec3(0.9, 0.94, 1.0) * (0.93 + 0.07 * n3), normalize(vN + vec3(n2 - 0.5, 0.0, n1 - 0.5) * 0.12), 1.0 - contact * 0.6, 1.0 - (1.0 - shadow) * 0.75);
  snowCol += uSunCol * pow(n3, 14.0) * 0.5 * shadow; // искры
  col = mix(col, snowCol, sn);
  col = tone(fogged(col, vW));
  gl_FragColor = vec4(mix(paperAt(gl_FragCoord.xy), col, realAt(vW)), 1.0);
}`);

export const grassMaterial = (U, own) => mat(U, own, /* glsl */ `
attribute vec4 aOff;
uniform vec3 uGrassA; uniform vec3 uGrassB;
varying vec3 vW; varying float vH; varying float vR; varying float vReal;
void main(){
  float real = realAt(aOff.xyz);
  float rnd = aOff.w;
  float h = (0.22 + 0.4 * rnd) * (1.0 - smoothstep(0.1, 0.85, uSnow)) * real;
  float a = rnd * 6.2831853;
  vec3 p = vec3(position.x * 0.045 * cos(a), position.y * h, position.x * 0.045 * sin(a));
  float g = sin(uTime * 1.8 + aOff.x * 0.7 + aOff.z * 0.6) * 0.5 + 0.5;
  p.xz += uWindDir * position.y * position.y * h * (0.25 + uWind * 1.1) * (0.3 + g) + vec2(cos(a * 3.0), sin(a * 3.0)) * position.y * h * 0.25;
  vec4 w = modelMatrix * vec4(aOff.xyz + p, 1.0);
  vW = w.xyz; vH = position.y; vR = rnd; vReal = real;
  gl_Position = projectionMatrix * viewMatrix * w;
}`, /* glsl */ `
uniform vec3 uGrassA; uniform vec3 uGrassB;
varying vec3 vW; varying float vH; varying float vR; varying float vReal;
void main(){
  if (vReal < 0.02) discard;
  vec3 albedo = mix(uGrassA, uGrassB, vR) * (0.55 + 0.75 * vH) * (1.0 - uWet * 0.2);
  vec2 sp = vW.xz - uSunDir.xz / max(uSunDir.y, 0.25) * 5.0;
  float shadow = 1.0 - smoothstep(7.5, 2.0, length(sp)) * 0.6;
  vec3 col = lit(albedo, vec3(0.0, 1.0, 0.0), 0.6 + 0.4 * vH, shadow);
  col = tone(fogged(col, vW));
  gl_FragColor = vec4(mix(paperAt(gl_FragCoord.xy), col, vReal), 1.0);
}`, { side: THREE.DoubleSide });

// Небо: градиент, солнце или луна, облака, звёзды, вспышки молний. До проявления — бумага.
export const skyMaterial = (U, own) => mat(U, own, /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0);
  gl_Position = p.xyww;
}`, /* glsl */ `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uCloudCol; uniform vec3 uDisc;
uniform float uCloud; uniform float uStars; uniform float uRealSky;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float t = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(t, 0.55));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uDisc * (pow(sd, 900.0) * 3.0 + pow(sd, 40.0) * 0.28 + pow(sd, 6.0) * 0.12) * (1.0 - uCloud * 0.8);
  // звёзды
  vec3 g = floor(d * 190.0);
  float st = step(0.9975, hash31(g)) * smoothstep(0.45, 0.1, length(fract(d * 190.0) - 0.5)) * (0.6 + 0.4 * sin(uTime * 2.0 + hash31(g + 3.0) * 30.0));
  col += vec3(st) * 1.5 * uStars * smoothstep(0.02, 0.3, d.y) * (1.0 - uCloud);
  // облака плывут по ветру
  vec2 cp = d.xz / (d.y + 0.22) * 1.3 + uWindDir * uTime * (0.006 + uWind * 0.02);
  float c = fbm2(cp) * 0.65 + fbm2(cp * 2.7 + 3.0) * 0.35;
  float cm = smoothstep(0.78 - uCloud * 0.62, 0.95 - uCloud * 0.45, c) * smoothstep(-0.02, 0.18, d.y);
  col = mix(col, uCloudCol * (0.78 + 0.3 * c), cm * (0.55 + 0.45 * uCloud));
  col += vec3(0.75, 0.8, 1.0) * uFlash * (0.35 + 0.5 * c);
  col = mix(col, uFogColor, smoothstep(0.12, -0.02, d.y));
  col = tone(col);
  float dither = (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(mix(paperAt(gl_FragCoord.xy), col + dither, uRealSky), 1.0);
}`, { side: THREE.BackSide, depthWrite: false, depthTest: false });

// Падающие частицы: дождь (штрихи), снег (хлопья), листья/лепестки/светлячки.
export const fallMaterial = (U, own) => mat(U, own, /* glsl */ `
attribute float aRand;
uniform vec3 uBox; uniform vec3 uCenter; uniform float uSpeed; uniform float uSize; uniform float uDrift; uniform float uScale;
varying float vRand; varying float vFade;
void main(){
  vec3 q = position;
  float sp = uSpeed * (0.7 + 0.6 * aRand);
  q.y = fract(q.y - uTime * sp / uBox.y);
  vec2 w = uWindDir * uWind * uDrift;
  q.xz = fract(q.xz + w * uTime / uBox.xz + vec2(sin(uTime * 0.7 + aRand * 40.0), cos(uTime * 0.6 + aRand * 31.0)) * 0.012 * (1.0 - step(6.0, uSpeed)));
  vec3 wp = uCenter + (q - 0.5) * uBox;
  wp.y = uCenter.y + (q.y - 0.5) * uBox.y;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.6 + 0.8 * aRand) * uScale / max(-mv.z, 0.5);
  vRand = aRand;
  vFade = smoothstep(0.0, 0.08, q.y) * smoothstep(1.0, 0.9, q.y) * smoothstep(1.0, 3.0, -mv.z);
}`, /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; uniform float uKind; uniform float uRealSky; uniform float uSpeed;
varying float vRand; varying float vFade;
void main(){
  vec2 p = gl_PointCoord - 0.5;
  float a;
  if (uKind < 0.5) {            // дождь: косой штрих
    p.x += p.y * uWind * 0.9 * sign(uWindDir.x + 0.001);
    a = smoothstep(0.035, 0.0, abs(p.x)) * smoothstep(0.5, 0.2, abs(p.y)) * 0.55;
  } else if (uKind < 1.5) {     // снег: мягкий хлопок
    a = smoothstep(0.5, 0.1, length(p));
  } else if (uKind < 2.5) {     // лист или лепесток: кружится
    float s = sin(uTime * (2.0 + vRand * 3.0) + vRand * 20.0);
    p = mat2(cos(s), -sin(s), sin(s), cos(s)) * p;
    a = step(length(p * vec2(1.0, 1.9 + s * 0.6)), 0.42);
  } else {                      // светлячок: мерцает
    a = smoothstep(0.5, 0.0, length(p)) * (0.5 + 0.5 * sin(uTime * (1.5 + vRand * 2.0) + vRand * 30.0));
  }
  a *= uOpacity * vFade * uRealSky;
  if (a < 0.01) discard;
  vec3 col = uColor * (0.8 + 0.4 * vRand);
  gl_FragColor = vec4(col, a);
}`, { transparent: true, depthWrite: false });
