// Общие куски шейдеров: шум, «бумага» и карандаш, свет, туман, ветер.
// Сцена рисуется в линейном цвете и в конце сама переводится в экранный (tone()).
export const COMMON = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uRealR;      // радиус «проявления»: внутри него рисунок уже стал настоящим
uniform float uDraw;       // 0..1 — сколько наброска уже нарисовано карандашом
uniform vec3 uPaper;
uniform vec3 uFogColor;
uniform float uFog;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSkyAmb;
uniform vec3 uGroundAmb;
uniform float uFlash;
uniform float uSnow;
uniform float uWet;
uniform vec2 uWindDir;
uniform float uWind;
uniform float uPx;         // плотность пикселей (штриховка одной толщины на любом экране)

float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise2(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float noise3(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm2(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * noise2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }

// Насколько точка уже «настоящая» (0 — карандаш на бумаге, 1 — живая сцена).
float realAt(vec3 wp){
  float d = length(wp - vec3(0.0, 1.2, 0.0));
  float edge = 1.5 + d * 0.22;
  float n = (noise3(wp * 0.55) - 0.5) * edge * 1.4;
  return smoothstep(0.0, 1.0, (uRealR - d + n) / edge);
}
// Лист бумаги с едва заметным зерном.
vec3 paperAt(vec2 fc){
  float g = noise2(fc / uPx * 0.9) * 0.6 + noise2(fc / uPx * 0.23) * 0.4;
  return uPaper * (0.975 + 0.035 * g);
}
// Графитовый штрих: сила 0..1 → цвет на бумаге, с зерном карандаша.
vec3 pencil(vec2 fc, float k, vec3 lead){
  float grain = 0.72 + 0.28 * noise2(fc / uPx * 1.7);
  return mix(paperAt(fc), lead, clamp(k * grain, 0.0, 1.0));
}
float hatch(vec2 fc, float dir){
  vec2 p = fc / uPx;
  float v = sin((p.x * dir + p.y) * 1.25 + noise2(p * 0.08) * 5.0);
  return smoothstep(0.35, 0.9, v);
}
vec3 lit(vec3 albedo, vec3 n, float ao, float shadow){
  float nl = max(dot(n, uSunDir), 0.0);
  vec3 amb = mix(uGroundAmb, uSkyAmb, n.y * 0.5 + 0.5);
  return albedo * (amb * ao + uSunCol * nl * shadow + vec3(uFlash) * (0.5 + 0.5 * n.y));
}
vec3 fogged(vec3 col, vec3 wp){
  float d = length(wp - cameraPosition);
  return mix(col, uFogColor, 1.0 - exp(-d * uFog));
}
vec3 tone(vec3 c){
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}
`;

// Качание от ветра: w — «гибкость» точки (0 у ствола, 1 на концах веток).
export const SWAY = /* glsl */ `
vec3 sway(vec3 p, float w){
  float g = sin(uTime * 0.9 + p.x * 0.25 + p.z * 0.2) * 0.6 + sin(uTime * 2.1 + p.y * 0.5) * 0.25 + 0.45;
  float a = w * w * uWind * 0.6 * g;
  p.xz += uWindDir * a;
  p.y -= a * 0.22 * w;
  return p;
}
`;
