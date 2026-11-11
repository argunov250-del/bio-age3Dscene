// Вид 3D-сцены по календарю и погоде (числа для scene/src/env.js). Без интернета — только
// календарь (северное полушарие, как lib/ambience.js); с включённой погодой — как за окном.
//  • зима по календарю — сцена снежная; снег идёт только если он идёт за окном;
//  • март — оттепель: снег тает пятнами; апрель–май — листья распускаются, дерево цветёт;
//  • лето — густая зелень; осень — листва желтеет, краснеет и опадает;
//  • дождь, гроза с молниями, снегопад, туман, облака, ветер — по погоде.
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

const SNOW = [[1, 1], [3, 1], [4, 0], [11.5, 0], [12, 1]]; // 1 марта начинает таять, к апрелю сошёл
const LEAF = [[1, 0], [3.5, 0], [4, 0.12], [5, 0.75], [5.7, 1], [9.5, 1], [10.5, 0.8], [11.5, 0.3], [12, 0.04]];
const TONE = [[1, 3], [3.4, 3], [3.5, 0], [5, 0], [6.2, 1], [9, 1], [10, 2], [11, 3]]; // 0 весна · 1 лето · 2 жёлтая · 3 бурая
const BLOOM = [[1, 0.12], [3.5, 0.12], [4.3, 0.9], [5.5, 1], [6.5, 0.4], [9, 0.3], [11, 0.15]];
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
  const spring = m >= 4 && m < 6;
  const summer = m >= 6 && m < 9;
  const period = opts.period || (live ? (live.day ? (periodOf(date.getHours()) === 'night' ? 'day' : periodOf(date.getHours())) : 'night') : periodOf(date.getHours()));
  const night = period === 'night';
  const precip = kind === 'snow' ? 'snow' : kind === 'rain' || kind === 'storm' ? 'rain' : null;
  if (precip === 'snow') snow = 1; // снегопад — сцена снежная в любой месяц
  const wind = live && live.wind != null ? windLevel(live.wind) : autumn ? 0.42 : 0.26;
  // Что летает в воздухе, когда нет осадков.
  let drift = null;
  if (!precip) drift = autumn ? 'leaf' : spring ? 'petal' : summer && night ? 'firefly' : snow < 0.5 ? 'spark' : null;
  return {
    dark: !!opts.dark, period,
    snow, leaf: curve(LEAF, m), tone: curve(TONE, m), bloom: curve(BLOOM, m), grass: curve(GRASS, m),
    precip, storm: kind === 'storm',
    fog: kind === 'fog' ? 1 : 0,
    cloud: kind === 'clouds' ? 0.7 : kind === 'fog' ? 0.6 : precip ? 0.95 : 0.2,
    wind: kind === 'storm' ? Math.max(wind, 0.8) : wind,
    drift,
  };
}
