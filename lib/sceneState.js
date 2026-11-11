// Вид 3D-сцены (горный мир над облаками) по календарю и погоде: числа для scene/src/env.js.
// Без интернета — только календарь (северное полушарие, как lib/ambience.js); с включённой
// погодой — как за окном, с плавным переходом при каждом обновлении.
//  • зима — горы в снегу до самых облаков; снег идёт, только если он идёт за окном;
//  • весна — граница снега поднимается, проступают скалы и луга;
//  • лето — снег только на вершинах, зелёные альпийские луга; осень — луга рыжеют;
//  • дождь, гроза с молниями, снегопад (в любой месяц), туман, облака, ветер, день и ночь.
import { periodOf } from './ambience';

const clamp = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, k) => a + (b - a) * clamp(k);
// Точки [месяц (1–12, дробный), значение] → значение на дату; год замкнут.
function curve(points, m) {
  const pts = [[points[points.length - 1][0] - 12, points[points.length - 1][1]], ...points, [points[0][0] + 12, points[0][1]]];
  for (let i = 0; i < pts.length - 1; i++) {
    if (m >= pts[i][0] && m <= pts[i + 1][0]) return lerp(pts[i][1], pts[i + 1][1], (m - pts[i][0]) / (pts[i + 1][0] - pts[i][0] || 1));
  }
  return points[0][1];
}

const SNOW = [[1, 1], [3, 1], [5, 0.35], [6.5, 0], [9.5, 0], [11, 0.5], [12, 1]]; // 1 — всё в снегу, 0 — снег только на вершинах
const TONE = [[1, 3], [3.4, 3], [3.5, 0], [5, 0], [6.2, 1], [9, 1], [10, 2], [11, 3]]; // луга: 0 весна · 1 лето · 2–3 осень
const GRASS = [[1, 0.15], [3, 0.2], [4.5, 0.8], [5.5, 1], [9, 0.95], [10.5, 0.6], [11.8, 0.3]];

// km/h → 0..1 (штиль … сильный ветер)
export const windLevel = (kmh) => clamp(0.12 + (kmh || 0) / 45);

export function sceneState(date = new Date(), weather = null, opts = {}) {
  const dim = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const m = date.getMonth() + 1 + (date.getDate() - 1) / dim;
  const live = weather && !weather.stale ? weather : null;
  const kind = live ? live.kind : null;
  let snow = curve(SNOW, m);
  const autumn = m >= 9.5 && m < 12;
  const hourPeriod = periodOf(date.getHours());
  const period = opts.period || (live ? (live.day ? (hourPeriod === 'night' ? 'day' : hourPeriod) : 'night') : hourPeriod);
  const precip = kind === 'snow' ? 'snow' : kind === 'rain' || kind === 'storm' ? 'rain' : null;
  if (precip === 'snow') snow = 1; // снегопад — горы в снегу в любой месяц
  const wind = live && live.wind != null ? windLevel(live.wind) : autumn ? 0.42 : 0.26;
  return {
    dark: !!opts.dark, period,
    snow, tone: curve(TONE, m), grass: curve(GRASS, m),
    precip, storm: kind === 'storm',
    fog: kind === 'fog' ? 1 : 0,
    cloud: kind === 'clouds' ? 0.7 : kind === 'fog' ? 0.6 : precip ? 0.95 : 0.15,
    wind: kind === 'storm' ? Math.max(wind, 0.8) : wind,
    live: !!live, // false — погода смоделирована по сезону (нет сети или погода выключена)
  };
}
