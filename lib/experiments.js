// Личные эксперименты: «две недели ложусь раньше и хожу больше — что изменится?».
// План пользователь задаёт сам (из симулятора), отменить можно в любой момент. Итог —
// сравнение тех же дней до эксперимента и во время него по архиву, с числом дней с данными.
// Совпадение по времени — не доказательство причины; так и пишем.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rangeKeys, comparePeriods } from './archive';

const KEY = 'experiments.v1';
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const shiftKey = (key, days) => { const [y, m, d] = key.split('-').map(Number); return keyOf(new Date(y, m - 1, d + days, 12)); };

export const LENGTHS = [7, 14, 21, 28];

export function startExperiment(list, plan, todayKey) {
  const e = { id: 'e' + Date.now().toString(36), start: todayKey, days: plan.days || 14, sleepH: plan.sleepH ?? null, steps: plan.steps ?? null, status: 'running' };
  return [...(list || []).map((x) => (x.status === 'running' ? { ...x, status: 'stopped', end: todayKey } : x)), e];
}
export const stopExperiment = (list, id, todayKey, status = 'stopped') => (list || []).map((x) => (x.id === id ? { ...x, status, end: todayKey } : x));

// Состояние: { day, left, finished } — finished, когда прошли все дни.
export function progress(e, todayKey) {
  const end = shiftKey(e.start, e.days - 1);
  const keys = rangeKeys(e.start, todayKey < end ? todayKey : end);
  return { day: Math.min(e.days, keys.length), left: Math.max(0, e.days - keys.length), finished: todayKey > end, end };
}

// Итог: те же поля до и во время эксперимента.
export function report(e, arch, todayKey) {
  const p = progress(e, todayKey);
  const during = rangeKeys(e.start, p.finished ? p.end : todayKey);
  const before = rangeKeys(shiftKey(e.start, -during.length), shiftKey(e.start, -1));
  const rows = comparePeriods(arch || {}, during, before);
  const hit = (f, goal) => { const r = rows.find((x) => x.f === f); return goal == null || !r || r.a == null ? null : r.a >= goal * 0.95; };
  return { rows, during: during.length, before: before.length, sleepMet: hit('h', e.sleepH), stepsMet: hit('s', e.steps) };
}

export async function loadExperiments() { try { const raw = await AsyncStorage.getItem(KEY); const l = raw ? JSON.parse(raw) : []; return Array.isArray(l) ? l : []; } catch (e) { return []; } }
export async function saveExperiments(list) { try { await AsyncStorage.setItem(KEY, JSON.stringify((list || []).slice(-30))); } catch (e) {} }
