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

describe('свои привычки и график', () => {
  const { computePeaks: cp } = require('../lib/peaks');
  const S = require('../lib/schedule');
  const H = require('../lib/habits');
  let h = H.addHabit(null, { catalogId: 'walk', required: true });
  h = H.addHabit(h, { catalogId: 'read' });
  h = H.addHabit(h, { catalogId: 'steps' });
  h = { ...h, minOptional: 1 };
  test('успешный день: все обязательные + нужное число дополнительных; шаги засчитываются сами', () => {
    let x = H.toggleDone(h, 'walk', '2026-03-01');
    expect(H.daySummary(x, '2026-03-01', null, null).success).toBe(false);
    expect(H.daySummary(x, '2026-03-01', null, { met: { steps: true }, got: {} }).success).toBe(true);
    x = H.toggleDone(x, 'read', '2026-03-02');
    expect(H.daySummary(x, '2026-03-02', null, null).success).toBe(false); // нет обязательной
    const r = cp(null, { '2026-03-01': { met: { steps: true }, got: {} } }, '2026-03-01', false, { habits: x });
    expect(r.peaks.streak).toBe(1);
  });
  test('привычка «только в рабочие дни» не требуется в выходной', () => {
    const s = S.applyPreset(null, '5_2', '2026-11-02');
    const y = H.updateHabit(h, 'walk', { days: 'work' });
    const sat = H.toggleDone(y, 'read', '2026-11-07');
    expect(H.daySummary(sat, '2026-11-07', s, null).success).toBe(true);
  });
  test('дни отдыха по графику не рвут серию; правка графика задним числом прошлое не меняет', () => {
    const okRec = { got: { sleep: 12, water: 6, log: 4 }, met: {} };
    const sched = S.setOverride(S.DEFAULT_SCHEDULE, '2026-04-03', 'rest');
    let r = cp(null, { '2026-04-01': okRec, '2026-04-02': okRec }, '2026-04-02', false, { sched });
    r = cp(r.state, { '2026-04-04': okRec }, '2026-04-04', false, { sched });
    expect(r.peaks.streak).toBe(3);
    const later = S.setOverride(sched, '2026-04-03', null); // отменили отдых задним числом
    r = cp(r.state, {}, '2026-04-05', false, { sched: later });
    expect(r.peaks.streak).toBe(3);
  });
});
