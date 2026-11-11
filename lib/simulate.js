// Симулятор привычек: «что если спать на час дольше и ходить больше». Ничего не придумывает —
// меняет копию твоих же данных за полгода и пересчитывает той же формулой (lib/compute.js).
// Это оценка модели, а не обещание: реальный результат зависит от многого, чего в данных нет.
import { compute } from './compute';
import { HISTORY_DAYS, dayKey, addDays, startOfDay } from './metrics';

// Сон за день — массив 5-минутных отрезков (1 — спал). Меняем длину сна, сохраняя время засыпания.
export function reshapeSleep(arr, hours) {
  const n = arr ? arr.length : 288;
  const out = new Uint8Array(n);
  const want = Math.max(0, Math.min(n, Math.round(hours * 12)));
  let start = -1;
  if (arr) for (let i = 0; i < n; i++) if (arr[i]) { start = i; break; }
  if (start < 0) start = Math.max(0, Math.floor(n / 2) - want);
  for (let i = 0; i < want; i++) out[(start + i) % n] = 1;
  return out;
}

const sleepH = (arr) => (arr ? arr.reduce((a, x) => a + x, 0) * 5 / 60 : 0);

// plan = { sleepH: часы или null, steps: шаги или null, days: сколько последних дней менять (по умолчанию полгода) }
export function applyPlan(ds, plan) {
  const p = plan || {};
  const days = p.days || HISTORY_DAYS;
  const today = startOfDay(ds.now);
  const steps = { ...ds.steps }, sleep = { ...ds.sleep };
  for (let i = 0; i < days; i++) {
    const k = dayKey(addDays(today, -i));
    // меняются только дни, где данные есть: покрытие то же, отличие — только в привычках
    if (p.steps != null && Number(steps[k]) > 0) steps[k] = Math.max(Number(steps[k]), p.steps);
    if (p.sleepH != null && sleep[k] && sleepH(sleep[k]) >= 1) {
      const cur = sleepH(sleep[k]);
      if (cur < p.sleepH) sleep[k] = reshapeSleep(sleep[k], p.sleepH);
    }
  }
  return { ...ds, steps, sleep, nights: ds.nights };
}

// -> { base, sim, delta } возраст тела сейчас и по плану (годы)
export function simulate(ds, profile, plan) {
  if (!ds || !profile) return null;
  const base = compute(ds, profile);
  const sim = compute(applyPlan(ds, plan), profile);
  return { base: base.bio, sim: sim.bio, delta: sim.bio - base.bio, chrono: base.chrono };
}

// Сегодняшние средние для ползунков: сон и шаги за 30 дней.
export function currentAverages(ds) {
  const today = startOfDay(ds.now);
  let s = 0, sn = 0, h = 0, hn = 0;
  for (let i = 1; i <= 30; i++) {
    const k = dayKey(addDays(today, -i));
    if (ds.steps[k] > 0) { s += ds.steps[k]; sn++; }
    const x = sleepH(ds.sleep[k]);
    if (x >= 1) { h += x; hn++; }
  }
  return { steps: sn ? Math.round(s / sn) : null, sleepH: hn ? h / hn : null };
}
