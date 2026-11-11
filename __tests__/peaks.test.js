// Вершины за регулярность (lib/peaks.js): серии, общий счёт, отдых, дымка, «навсегда».
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }), { virtual: true });
const { computePeaks, dayDone, shiftKey, TASKS_FOR_DAY } = require('../lib/peaks');

const ok = { got: { sleep: 12, water: 6, log: 4 }, met: {} };
const weak = { got: { water: 6 }, met: { steps: true } };
const run = (from, n, rec = ok) => { const d = {}; for (let i = 0; i < n; i++) d[shiftKey(from, i)] = rec; return d; };

test('успешный день — не меньше трёх заданий; шаги считаются только при выполненной цели', () => {
  expect(TASKS_FOR_DAY).toBe(3);
  expect(dayDone(ok)).toBe(true);
  expect(dayDone(weak)).toBe(false);
  expect(dayDone({ got: { steps: 5, water: 6, log: 4 }, met: {} })).toBe(false);
  expect(dayDone({ got: { steps: 12, water: 6, log: 4 }, met: { steps: true } })).toBe(true);
  expect(dayDone(null)).toBe(false);
});

test('7 дней подряд открывают первую вершину дисциплины, 10 дней всего — первую вершину постоянства', () => {
  let r = computePeaks(null, run('2026-01-01', 6), '2026-01-06');
  expect(r.peaks.streak).toBe(6);
  expect(r.fresh).toEqual([]);
  expect(r.peaks.nextDiscipline.left).toBe(1);
  r = computePeaks(r.state, run('2026-01-07', 1), '2026-01-07');
  expect(r.fresh.map((p) => p.id)).toEqual(['d7']);
  r = computePeaks(r.state, run('2026-01-08', 3), '2026-01-10');
  expect(r.fresh.map((p) => p.id)).toEqual(['c10']);
  expect(r.peaks.total).toBe(10);
});

test('незавершённое сегодня серию не рвёт; пропущенный день — рвёт, но вершины и общий счёт остаются', () => {
  let r = computePeaks(null, run('2026-01-01', 7), '2026-01-07');
  r = computePeaks(r.state, {}, '2026-01-08');
  expect(r.peaks.streak).toBe(7);
  r = computePeaks(r.state, {}, '2026-01-10');
  expect(r.peaks.streak).toBe(0);
  expect(r.peaks.best).toBe(7);
  expect(r.peaks.total).toBe(7);
  expect(r.peaks.discipline[0].unlocked).toBe(true);
  expect(r.fresh).toEqual([]); // вершина не открывается повторно
});

test('день отдыха серию не продлевает и не прерывает', () => {
  let r = computePeaks(null, run('2026-01-01', 3), '2026-01-03');
  r = computePeaks(r.state, {}, '2026-01-04', true);
  expect(r.peaks.todayRest).toBe(true);
  expect(r.peaks.streak).toBe(3);
  r = computePeaks(r.state, run('2026-01-05', 1), '2026-01-05');
  expect(r.peaks.streak).toBe(4);
});

test('дымка: нет при коротком перерыве, растёт при долгом, уходит после успешного дня', () => {
  let r = computePeaks(null, run('2026-01-01', 3), '2026-01-03');
  expect(r.peaks.haze).toBe(0);
  r = computePeaks(r.state, {}, '2026-01-05');
  expect(r.peaks.haze).toBe(0);
  r = computePeaks(r.state, {}, '2026-01-12');
  expect(r.peaks.haze).toBeGreaterThan(0.3);
  r = computePeaks(r.state, {}, '2026-02-20');
  expect(r.peaks.haze).toBe(1);
  r = computePeaks(r.state, run('2026-02-21', 1), '2026-02-21');
  expect(r.peaks.haze).toBe(0);
});

test('успешный день остаётся успешным, даже если запись роста позже исчезла', () => {
  let r = computePeaks(null, run('2026-01-01', 5), '2026-01-05');
  r = computePeaks(r.state, {}, '2026-01-05');
  expect(r.peaks.total).toBe(5);
});
