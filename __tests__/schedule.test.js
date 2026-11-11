// Календарь работы и отдыха (lib/schedule.js) и предложения Хирона (lib/restAdvisor.js).
const S = require('../lib/schedule');
const { restSuggestion } = require('../lib/restAdvisor');

test('5/2: понедельник рабочий, суббота выходной', () => {
  const s = S.applyPreset(null, '5_2', '2026-11-02');
  expect(S.dayType(s, '2026-11-02')).toBe('work'); // пн
  expect(S.dayType(s, '2026-11-07')).toBe('off'); // сб
});
test('вахта 30/30 строит календарь от даты начала на месяцы вперёд и назад', () => {
  const s = S.applyPreset(null, '30_30', '2026-01-01');
  expect(S.dayType(s, '2026-01-30')).toBe('work');
  expect(S.dayType(s, '2026-01-31')).toBe('off');
  expect(S.dayType(s, '2026-03-02')).toBe('work'); // 60 дней спустя — снова работа
  expect(S.dayType(s, '2025-12-31')).toBe('off');
});
test('сутки/трое и 2/2', () => {
  const a = S.applyPreset(null, '1_3', '2026-05-01');
  expect(['2026-05-01', '2026-05-02', '2026-05-05'].map((k) => S.dayType(a, k))).toEqual(['work', 'off', 'work']);
  const b = S.applyPreset(null, '2_2', '2026-05-01');
  expect(['2026-05-02', '2026-05-03', '2026-05-05'].map((k) => S.dayType(b, k))).toEqual(['work', 'off', 'work']);
});
test('ручные правки по кругу и выходные как дни отдыха', () => {
  let s = S.applyPreset(null, '5_2', '2026-11-02');
  s = S.cycleOverride(s, '2026-11-03');
  expect(S.dayType(s, '2026-11-03')).toBe('work');
  s = S.cycleOverride(s, '2026-11-03'); expect(S.dayType(s, '2026-11-03')).toBe('off');
  s = S.cycleOverride(s, '2026-11-03'); expect(S.isRest(s, '2026-11-03')).toBe(true);
  s = S.cycleOverride(s, '2026-11-03'); expect(s.overrides['2026-11-03']).toBeUndefined();
  expect(S.isRest({ ...s, restOnOff: true }, '2026-11-07')).toBe(true);
});
test('биологические сутки: 03:00 при начале дня в 06:00 — ещё вчера', () => {
  const s = { ...S.DEFAULT_SCHEDULE, dayStart: 6 };
  expect(S.bioKey(s, new Date(2026, 10, 12, 3, 0).getTime())).toBe('2026-11-11');
  expect(S.bioKey(s, new Date(2026, 10, 12, 7, 0).getTime())).toBe('2026-11-12');
  expect(S.bioKey(null, new Date(2026, 10, 12, 3, 0).getTime())).toBe('2026-11-12');
});
test('без графика — тип дня неизвестен, отдыха нет', () => {
  expect(S.dayType(null, '2026-11-12')).toBeNull();
  expect(S.isRest(undefined, '2026-11-12')).toBe(false);
});
test('сетка месяца: недели по 7, ноябрь 2026 начинается с воскресенья', () => {
  const g = S.monthGrid(2026, 10);
  expect(g.every((w) => w.length === 7)).toBe(true);
  expect(g[0][6]).toBe('2026-11-01');
});
test('Хирон: после длинной вахты — восстановление; усталость в 5-й смене — отдых; недосып на работе — лёгкий день', () => {
  const s = S.applyPreset(null, '15_15', '2026-01-01');
  expect(restSuggestion({ sched: s, key: '2026-01-17' }).kind).toBe('recover');
  expect(restSuggestion({ sched: s, key: '2026-01-06', tired: true }).kind).toBe('rest');
  expect(restSuggestion({ sched: s, key: '2026-01-02', sleepPoor: true }).kind).toBe('light');
  expect(restSuggestion({ sched: s, key: '2026-01-02' })).toBeNull();
  expect(restSuggestion({ sched: s, key: '2026-01-06', tired: true, dismissed: '2026-01-06' })).toBeNull();
  expect(restSuggestion({ sched: S.setOverride(s, '2026-01-06', 'rest'), key: '2026-01-06', tired: true })).toBeNull();
});
