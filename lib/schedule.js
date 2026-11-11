// Свой календарь работы и отдыха. Работает и для обычной недели, и для смен, и для вахты:
//  • week  — рабочие дни недели (5/2 и любые другие);
//  • cycle — повторяющийся цикл «N рабочих / M выходных» от даты начала (2/2, сутки/трое, вахта 30/30, 45/15, свой);
//  • overrides — ручные правки отдельных дней: work (рабочий), off (выходной), rest (день отдыха).
// День отдыха — нейтральный: серию не прерывает и не продлевает. Выходной — обычный день.
// «Биологические сутки» (dayStart, 0–12 ч): при ночных сменах всё, что раньше этого часа,
// относится к предыдущему дню. Сдвиг касается только графика, привычек и вершин — не расчёта возраста.
const pad = (n) => String(n).padStart(2, '0');
export const keyOf = (x) => { const d = new Date(x); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const shiftKey = (key, days) => { const [y, m, d] = key.split('-').map(Number); return keyOf(new Date(y, m - 1, d + days, 12)); };
const utc = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
export const weekdayOf = (k) => (new Date(utc(k)).getUTCDay() + 6) % 7; // 0 — понедельник

// Пресеты из настроек: week — пн…вс; cycle — [работа, выходные].
export const PRESETS = [
  { id: '5_2', kind: 'week', week: [1, 1, 1, 1, 1, 0, 0], label: ['5/2', '5/2'] },
  { id: '2_2', kind: 'cycle', cycle: [2, 2], label: ['2/2', '2/2'] },
  { id: '1_3', kind: 'cycle', cycle: [1, 3], label: ['Сутки/трое', '24h/3 off'] },
  { id: '15_15', kind: 'cycle', cycle: [15, 15], label: ['Вахта 15/15', 'Rotation 15/15'] },
  { id: '30_30', kind: 'cycle', cycle: [30, 30], label: ['Вахта 30/30', 'Rotation 30/30'] },
  { id: '45_15', kind: 'cycle', cycle: [45, 15], label: ['Вахта 45/15', 'Rotation 45/15'] },
  { id: 'custom', kind: 'cycle', cycle: [4, 4], label: ['Свой цикл', 'Custom cycle'] },
  { id: 'none', kind: 'none', label: ['Без графика', 'No schedule'] },
];

export const DEFAULT_SCHEDULE = { preset: 'none', kind: 'none', week: [1, 1, 1, 1, 1, 0, 0], cycle: [2, 2], start: null, dayStart: 0, night: false, restOnOff: false, overrides: {} };

export function normalize(s) {
  const x = { ...DEFAULT_SCHEDULE, ...(s && typeof s === 'object' ? s : {}) };
  x.week = Array.isArray(x.week) && x.week.length === 7 ? x.week.map((v) => (v ? 1 : 0)) : DEFAULT_SCHEDULE.week;
  const cy = Array.isArray(x.cycle) ? x.cycle.map((v) => Math.max(0, Math.min(90, Math.round(Number(v) || 0)))) : [2, 2];
  x.cycle = cy[0] + cy[1] > 0 ? cy : [2, 2];
  x.dayStart = Math.max(0, Math.min(12, Math.round(Number(x.dayStart) || 0)));
  x.overrides = x.overrides && typeof x.overrides === 'object' ? { ...x.overrides } : {};
  return x;
}

export function applyPreset(s, id, todayKey) {
  const p = PRESETS.find((q) => q.id === id) || PRESETS[PRESETS.length - 1];
  const x = normalize(s);
  x.preset = p.id; x.kind = p.kind;
  if (p.week) x.week = [...p.week];
  if (p.cycle && p.id !== 'custom') x.cycle = [...p.cycle];
  if (p.kind === 'cycle' && !x.start) x.start = todayKey;
  return x;
}

// Ключ «биологических суток»: до dayStart часов — ещё вчера.
export function bioKey(sched, t = Date.now()) {
  const s = normalize(sched);
  return keyOf(new Date(t).getTime() - s.dayStart * 3600000);
}

// Тип дня по графику без ручных правок: 'work' | 'off' | null (графика нет).
export function baseType(sched, key) {
  const s = normalize(sched);
  if (s.kind === 'week') return s.week[weekdayOf(key)] ? 'work' : 'off';
  if (s.kind === 'cycle' && s.start) {
    const len = s.cycle[0] + s.cycle[1];
    const i = ((daysBetween(s.start, key) % len) + len) % len;
    return i < s.cycle[0] ? 'work' : 'off';
  }
  return null;
}

// Тип дня с правками: 'work' | 'off' | 'rest' | null.
export function dayType(sched, key) {
  const s = normalize(sched);
  const o = s.overrides[key];
  if (o === 'work' || o === 'off' || o === 'rest') return o;
  const b = baseType(s, key);
  if (b === 'off' && s.restOnOff) return 'rest';
  return b;
}
export const isRest = (sched, key) => dayType(sched, key) === 'rest';
export const isWork = (sched, key) => dayType(sched, key) === 'work';

// Нажатие на день в календаре: по кругу «как в графике → рабочий → выходной → отдых».
export function cycleOverride(sched, key) {
  const s = normalize(sched);
  const order = [undefined, 'work', 'off', 'rest'];
  const cur = s.overrides[key];
  const next = order[(order.indexOf(cur) + 1) % order.length];
  const o = { ...s.overrides };
  if (next) o[key] = next; else delete o[key];
  return { ...s, overrides: o };
}
export const setOverride = (sched, key, type) => {
  const s = normalize(sched);
  const o = { ...s.overrides };
  if (type) o[key] = type; else delete o[key];
  return { ...s, overrides: o };
};

// Сколько рабочих дней подряд до этого дня включительно (для усталости и «после вахты»).
export function workRun(sched, key) {
  let n = 0;
  for (let k = key; n < 120 && isWork(sched, k); k = shiftKey(k, -1)) n++;
  return n;
}
// Сколько дней назад закончился рабочий блок (0 — сегодня рабочий) и его длина.
export function sinceWorkBlock(sched, key) {
  if (isWork(sched, key)) return { days: 0, length: workRun(sched, key) };
  let k = key, d = 0;
  while (d < 60 && !isWork(sched, k)) { k = shiftKey(k, -1); d++; }
  if (d >= 60) return { days: null, length: 0 };
  return { days: d, length: workRun(sched, k) };
}

// Месяц для календаря: недели × 7 (пн…вс), за пределами месяца — null.
export function monthGrid(year, month) {
  const first = keyOf(new Date(year, month, 1, 12));
  const days = new Date(year, month + 1, 0).getDate();
  const lead = weekdayOf(first);
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(keyOf(new Date(year, month, d, 12)));
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
