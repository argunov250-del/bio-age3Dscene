// Долгий архив по дням: шаги, сон, пульс покоя, HRV, активные минуты, тренировки и возраст тела.
// Health Connect отдаёт полгода, импорт тоже ограничен полугодием — поэтому каждый расчёт
// дописывает дни в архив, и со временем он накапливает годы. Хранится только на телефоне.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'archive.v1';
const FIELDS = ['s', 'h', 'r', 'v', 'a', 'w'];
export const LABELS = { s: ['Шаги', 'Steps'], h: ['Сон, ч', 'Sleep, h'], r: ['Пульс покоя', 'Resting HR'], v: ['HRV, мс', 'HRV, ms'], a: ['Активные минуты', 'Active minutes'], w: ['Тренировки', 'Workouts'] };

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const r1 = (x) => Math.round(x * 10) / 10;

// Дни из результата расчёта (result.series) -> { key: { s, h, r, v, a, w } }
export function daysFromResult(result) {
  const se = (result && result.series) || {};
  const out = {};
  const put = (k, f, v) => { if (v == null || !(v > 0)) return; (out[k] || (out[k] = {}))[f] = v; };
  (se.steps || []).forEach((x) => put(x.key, 's', Math.round(x.v)));
  (se.sleep || []).forEach((x) => put(x.key, 'h', x.v >= 1 ? r1(x.v) : null));
  (se.rhr || []).forEach((x) => put(x.key, 'r', Math.round(x.v)));
  (se.activeMin || []).forEach((x) => put(x.key, 'a', Math.round(x.v)));
  const hrv = {};
  (se.hrv || []).forEach((x) => { const k = keyOf(x.t); (hrv[k] || (hrv[k] = [])).push(x.v); });
  Object.entries(hrv).forEach(([k, l]) => put(k, 'v', Math.round(l.reduce((a, b) => a + b, 0) / l.length)));
  (se.workouts || []).forEach((w) => { if (w && isFinite(w.start)) { const k = keyOf(w.start); (out[k] || (out[k] = {})).w = ((out[k] && out[k].w) || 0) + 1; } });
  // возраст тела по неделям (trend) — в день конца недели
  (result && result.trend || []).forEach((x) => { (out[keyOf(x.t)] || (out[keyOf(x.t)] = {})).b = r1(x.v); });
  return out;
}

// Слить: новые значения дополняют и уточняют, но не стирают старые дни.
export function mergeArchive(arch, days) {
  const a = { ...(arch || {}) };
  for (const [k, d] of Object.entries(days || {})) a[k] = { ...(a[k] || {}), ...d };
  return a;
}

// Средние по полю за список ключей: { value, n } (n — дней с данными).
export function avg(arch, keys, f) {
  let s = 0, n = 0;
  for (const k of keys) { const d = arch[k]; if (d && d[f] != null) { s += d[f]; n++; } }
  if (f === 'w') return { value: n ? s : 0, n: keys.length }; // тренировки — сумма за период
  return { value: n ? s / n : null, n };
}

export function rangeKeys(from, to) {
  const out = [];
  const [y, m, d] = from.split('-').map(Number);
  for (let i = 0; i < 4000; i++) { const k = keyOf(new Date(y, m - 1, d + i, 12)); if (k > to) break; out.push(k); }
  return out;
}

// Сравнить два периода по всем полям: [{ f, a, b, delta, na, nb }]
export function comparePeriods(arch, keysA, keysB) {
  return FIELDS.map((f) => {
    const A = avg(arch, keysA, f), B = avg(arch, keysB, f);
    return { f, a: A.value, b: B.value, na: A.n, nb: B.n, delta: A.value != null && B.value != null ? A.value - B.value : null };
  });
}

// История по месяцам: [{ month: 'YYYY-MM', s, h, r, v, a, w, b, days }]
export function byMonth(arch) {
  const m = {};
  for (const k of Object.keys(arch || {})) (m[k.slice(0, 7)] || (m[k.slice(0, 7)] = [])).push(k);
  return Object.keys(m).sort().map((mon) => {
    const keys = m[mon];
    const row = { month: mon, days: keys.length };
    for (const f of [...FIELDS, 'b']) { const x = avg(arch, keys, f); row[f] = x.value; }
    return row;
  });
}

export const coverage = (arch) => { const k = Object.keys(arch || {}).sort(); return k.length ? { from: k[0], to: k[k.length - 1], days: k.length } : null; };

export async function loadArchive() { try { const raw = await AsyncStorage.getItem(KEY); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; } }
export async function updateArchive(result) {
  const next = mergeArchive(await loadArchive(), daysFromResult(result));
  try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch (e) {}
  return next;
}
export { FIELDS };
