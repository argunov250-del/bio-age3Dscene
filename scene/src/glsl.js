// Общие куски шейдеров: шум, свет, воздушная перспектива.
// Сцена считается в линейном цвете и в конце сама переводится в экранный (tone()).
export const COMMON = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3 uFogColor;
uniform float uFog;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSkyAmb;
uniform vec3 uGroundAmb;
uniform float uFlash;
uniform float uSnow;      // 0 — лето (снег только на вершинах), 1 — всё в снегу
uniform float uWet;
uniform vec2 uWindDir;
uniform float uWind;
uniform float uCloudY;    // высота моря облаков
uniform vec3 uCloudCol;

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
// Облака моря: медленно плывут по ветру.
float cloudField(vec2 p){
  vec2 q = p * 0.018 + uWindDir * uTime * (0.004 + uWind * 0.012);
  return fbm2(q) * 0.7 + fbm2(q * 3.1 + 4.0) * 0.3;
}
vec3 lit(vec3 albedo, vec3 n, float ao, float shadow){
  float nl = max(dot(n, uSunDir), 0.0);
  vec3 amb = mix(uGroundAmb, uSkyAmb, n.y * 0.5 + 0.5);
  return albedo * (amb * ao + uSunCol * nl * shadow + vec3(uFlash) * (0.5 + 0.5 * n.y));
}
// Воздушная перспектива: дальние хребты тают в дымке.
vec3 fogged(vec3 col, vec3 wp){
  float d = length(wp - cameraPosition);
  float f = 1.0 - exp(-d * uFog);
  float glow = pow(max(dot(normalize(wp - cameraPosition), uSunDir), 0.0), 6.0);
  return mix(col, uFogColor + uSunCol * glow * 0.12, f);
}
vec3 tone(vec3 c){
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}
`;
