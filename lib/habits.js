// Привычки: каталог готовых, свои, расписание и отметка выполнения.
// Каждая привычка: обязательная или дополнительная; дни — каждый день, рабочие, выходные или дни недели.
// Успешный день = все обязательные привычки этого дня выполнены и дополнительных не меньше minOptional.
// Измеримые привычки (шаги, сон, вода, дыхание, тренировка) засчитываются сами по данным дня;
// остальные отмечаются вручную. Один день засчитывается один раз, двойного зачёта нет.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayType, weekdayOf } from './schedule';

const KEY = 'habits.v1';

// auto — из какого задания роста засчитывается сам (lib/growth.js: met/got).
export const CATALOG = [
  { id: 'steps', auto: 'steps', title: ['Цель по шагам', 'Steps goal'] },
  { id: 'sleep', auto: 'sleep', title: ['Сон по норме', 'Sleep to your norm'] },
  { id: 'water', auto: 'water', title: ['Вода по норме', 'Water goal'] },
  { id: 'breath', auto: 'breath', title: ['Дыхание 5 минут', '5 minutes of breathing'] },
  { id: 'workout', auto: 'workout', title: ['Тренировка', 'Workout'] },
  { id: 'walk', title: ['Прогулка на воздухе', 'Walk outdoors'] },
  { id: 'stretch', title: ['Растяжка 10 минут', '10 minutes of stretching'] },
  { id: 'screens', title: ['Без экранов за час до сна', 'No screens an hour before bed'] },
  { id: 'bedtime', title: ['Лечь вовремя', 'Go to bed on time'] },
  { id: 'veg', title: ['Овощи в каждом приёме пищи', 'Vegetables with every meal'] },
  { id: 'nosugar', title: ['Без сладкого', 'No sweets'] },
  { id: 'noalc', title: ['Без алкоголя', 'No alcohol'] },
  { id: 'calm', title: ['Побыть в горах', 'Stay in the mountains'] },
  { id: 'read', title: ['Чтение 20 минут', '20 minutes of reading'] },
  { id: 'cold', title: ['Контрастный душ', 'Contrast shower'] },
  { id: 'posture', title: ['Разминка спины на смене', 'Back warm-up during the shift'] },
];

export const DAYS = ['all', 'work', 'off']; // либо массив дней недели [0..6], 0 — пн
export const emptyHabits = () => ({ v: 1, list: [], minOptional: 0, log: {} });

export function normalizeHabits(h) {
  const x = { ...emptyHabits(), ...(h && typeof h === 'object' ? h : {}) };
  x.list = Array.isArray(x.list) ? x.list.filter((q) => q && q.id) : [];
  x.minOptional = Math.max(0, Math.min(10, Math.round(Number(x.minOptional) || 0)));
  x.log = x.log && typeof x.log === 'object' ? x.log : {};
  return x;
}

export const habitTitle = (q, ru) => {
  if (q.title && typeof q.title === 'string') return q.title;
  const c = CATALOG.find((x) => x.id === q.catalogId);
  return c ? c.title[ru ? 0 : 1] : '';
};
export const autoOf = (q) => { const c = CATALOG.find((x) => x.id === q.catalogId); return c && c.auto ? c.auto : null; };

// Нужна ли привычка в этот день (по её дням и графику работы).
export function dueOn(q, key, sched) {
  const d = q.days || 'all';
  if (Array.isArray(d)) return d.includes(weekdayOf(key));
  if (d === 'all') return true;
  const t = dayType(sched, key);
  if (d === 'work') return t === 'work';
  if (d === 'off') return t === 'off' || t === 'rest' || t == null;
  return true;
}

// Выполнено ли автоматически по записи роста за день.
function autoDone(auto, rec) {
  if (!auto || !rec) return false;
  if (auto === 'steps') return !!(rec.met && rec.met.steps);
  return Number(rec.got && rec.got[auto]) > 0;
}

export function isDone(h, q, key, growthRec) {
  const log = (h.log && h.log[key]) || {};
  if (log[q.id]) return 'manual';
  if (autoDone(autoOf(q), growthRec)) return 'auto';
  return null;
}

// Итог дня: { configured, due, required, optional, doneRequired, doneOptional, success }
export function daySummary(hRaw, key, sched, growthRec) {
  const h = normalizeHabits(hRaw);
  const due = h.list.filter((q) => dueOn(q, key, sched));
  const req = due.filter((q) => q.required), opt = due.filter((q) => !q.required);
  const dr = req.filter((q) => isDone(h, q, key, growthRec)).length;
  const dopt = opt.filter((q) => isDone(h, q, key, growthRec)).length;
  const need = Math.min(h.minOptional, opt.length);
  return {
    configured: h.list.length > 0, due: due.length, required: req.length, optional: opt.length,
    doneRequired: dr, doneOptional: dopt, needOptional: need,
    success: due.length > 0 && dr === req.length && dopt >= need,
  };
}

export const addHabit = (hRaw, q) => {
  const h = normalizeHabits(hRaw);
  const id = q.id || (q.catalogId && !h.list.some((x) => x.id === q.catalogId) ? q.catalogId : 'h' + Date.now().toString(36));
  return { ...h, list: [...h.list, { days: 'all', required: false, ...q, id }] };
};
export const updateHabit = (hRaw, id, patch) => { const h = normalizeHabits(hRaw); return { ...h, list: h.list.map((q) => (q.id === id ? { ...q, ...patch } : q)) }; };
export const removeHabit = (hRaw, id) => { const h = normalizeHabits(hRaw); return { ...h, list: h.list.filter((q) => q.id !== id) }; };
export function toggleDone(hRaw, id, key) {
  const h = normalizeHabits(hRaw);
  const day = { ...(h.log[key] || {}) };
  if (day[id]) delete day[id]; else day[id] = 1;
  const log = { ...h.log, [key]: day };
  // держим год истории отметок
  const keys = Object.keys(log).sort();
  while (keys.length > 400) delete log[keys.shift()];
  return { ...h, log };
}

export async function loadHabits() { try { const raw = await AsyncStorage.getItem(KEY); return normalizeHabits(raw ? JSON.parse(raw) : null); } catch (e) { return emptyHabits(); } }
export async function saveHabits(h) { try { await AsyncStorage.setItem(KEY, JSON.stringify(normalizeHabits(h))); } catch (e) {} }
