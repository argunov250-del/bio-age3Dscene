// Горные вершины за регулярность. Два хребта:
//  • Хребет дисциплины — вершины за непрерывную серию успешных дней;
//  • Хребет постоянства — вершины за общее число успешных дней (серия может прерываться).
// Успешный день — выполнено не меньше трёх заданий дня (см. lib/growth.js). День отдыха,
// который назначил Хирон, серию не продлевает и не прерывает. Открытые вершины остаются
// навсегда; при долгом перерыве дальние хребты в сцене затягивает дымка (haze), и она
// рассеивается, когда ритм возвращается. Импортированная история вершин не открывает.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'peaks.v1';
const GROWTH_KEY = 'growth.v1';
export const TASKS_FOR_DAY = 3;
const TASK_IDS = ['steps', 'sleep', 'water', 'log', 'vitamins', 'breath', 'pause', 'workout'];

// name: [ru, en]
export const DISCIPLINE = [
  { id: 'd7', need: 7, name: ['Первый уступ', 'First Ledge'] },
  { id: 'd14', need: 14, name: ['Твёрдая тропа', 'Firm Trail'] },
  { id: 'd30', need: 30, name: ['Перевал Ритма', 'Rhythm Pass'] },
  { id: 'd60', need: 60, name: ['Гребень Воли', 'Ridge of Will'] },
  { id: 'd100', need: 100, name: ['Пик Стойкости', 'Peak of Resolve'] },
  { id: 'd180', need: 180, name: ['Ледник Терпения', 'Glacier of Patience'] },
  { id: 'd365', need: 365, name: ['Вершина Верности', 'Summit of Devotion'] },
];
export const CONSTANCY = [
  { id: 'c10', need: 10, name: ['Утренний склон', 'Morning Slope'] },
  { id: 'c30', need: 30, name: ['Плечо Упорства', 'Shoulder of Grit'] },
  { id: 'c60', need: 60, name: ['Хребет Привычки', 'Habit Ridge'] },
  { id: 'c100', need: 100, name: ['Купол Сотни', 'Dome of a Hundred'] },
  { id: 'c200', need: 200, name: ['Дальний перевал', 'Far Pass'] },
  { id: 'c365', need: 365, name: ['Пик Года', 'Peak of the Year'] },
  { id: 'c730', need: 730, name: ['Двуглавая вершина', 'Twin Summit'] },
];

const pad = (n) => String(n).padStart(2, '0');
export const keyOf = (x) => { const d = new Date(x); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const shiftKey = (key, days) => {
  const [y, m, d] = key.split('-').map(Number);
  return keyOf(new Date(y, m - 1, d + days, 12));
};
const daysBetween = (a, b) => {
  const p = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(b) - p(a)) / 86400000);
};

// Успешен ли день по записи роста: сколько заданий выполнено.
export function dayDone(rec) {
  if (!rec) return false;
  const got = rec.got || {}, met = rec.met || {}, base = rec.base || [];
  let n = 0;
  for (const id of TASK_IDS) {
    const ok = id === 'steps' ? !!met.steps : Number(got[id]) > 0 || base.includes(id);
    if (ok) n++;
  }
  return n >= TASKS_FOR_DAY;
}

const empty = () => ({ v: 1, days: {}, unlocked: {}, best: 0 });

/**
 * Чистая функция. state — сохранённые вершины; growthDays — дни из lib/growth.js ({ key: rec });
 * rest — сегодня день отдыха. Возвращает { state, peaks, fresh } (fresh — только что открытые).
 */
export function computePeaks(state, growthDays, todayKey, rest = false) {
  const s = state && state.days ? { ...empty(), ...state, days: { ...state.days }, unlocked: { ...(state.unlocked || {}) } } : empty();
  const gd = growthDays || {};
  for (const k of Object.keys(gd)) {
    if (k > todayKey) continue;
    if (dayDone(gd[k])) s.days[k] = 1; // однажды успешный день остаётся успешным
  }
  if (rest && s.days[todayKey] !== 1) s.days[todayKey] = 2;
  // серия: назад от сегодня; незавершённое сегодня её не рвёт, дни отдыха пропускаются
  let streak = 0;
  let k = s.days[todayKey] === 1 ? todayKey : shiftKey(todayKey, -1);
  for (let i = 0; i < 4000; i++, k = shiftKey(k, -1)) {
    if (s.days[k] === 1) streak++;
    else if (s.days[k] === 2) continue;
    else break;
  }
  const keys = Object.keys(s.days).filter((x) => s.days[x] === 1).sort();
  const total = keys.length;
  s.best = Math.max(Number(s.best) || 0, streak);
  const fresh = [];
  const open = (list, value, ridge) => list.map((p) => {
    if (!s.unlocked[p.id] && value >= p.need) { s.unlocked[p.id] = todayKey; fresh.push({ ...p, ridge }); }
    return { ...p, ridge, unlocked: !!s.unlocked[p.id], at: s.unlocked[p.id] || null, left: Math.max(0, p.need - value) };
  });
  const discipline = open(DISCIPLINE, streak, 'discipline');
  const constancy = open(CONSTANCY, total, 'constancy');
  const last = keys.length ? keys[keys.length - 1] : null;
  const breakDays = last ? Math.max(0, daysBetween(last, todayKey) - 1) : 0;
  const nextD = discipline.find((p) => !p.unlocked) || null, nextC = constancy.find((p) => !p.unlocked) || null;
  return {
    state: s, fresh,
    peaks: {
      streak, best: s.best, total, breakDays,
      // дымка на дальних хребтах: появляется после 3 дней перерыва, полная — через две недели
      haze: Math.max(0, Math.min(1, (breakDays - 2) / 12)),
      todayDone: s.days[todayKey] === 1, todayRest: s.days[todayKey] === 2,
      discipline, constancy, nextDiscipline: nextD, nextConstancy: nextC,
      opened: discipline.filter((p) => p.unlocked).length + constancy.filter((p) => p.unlocked).length,
    },
  };
}

let last = null;
export async function loadPeaks(now = Date.now()) {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    last = computePeaks(raw ? JSON.parse(raw) : null, {}, keyOf(now)).peaks;
    return last;
  } catch (e) { return last; }
}

// Пересчитать после обновления роста. -> { peaks, fresh }
export async function updatePeaks(now = Date.now(), rest = false) {
  try {
    let state = null, growth = null;
    try { const raw = await AsyncStorage.getItem(KEY); state = raw ? JSON.parse(raw) : null; } catch (e) { state = null; }
    try { const raw = await AsyncStorage.getItem(GROWTH_KEY); growth = raw ? JSON.parse(raw) : null; } catch (e) { growth = null; }
    const out = computePeaks(state, growth && growth.days, keyOf(now), rest);
    await AsyncStorage.setItem(KEY, JSON.stringify(out.state));
    last = out.peaks;
    return { peaks: out.peaks, fresh: out.fresh };
  } catch (e) {
    return { peaks: last, fresh: [] };
  }
}
