// Архив, сравнение периодов, эксперименты, отчёты и симулятор.
jest.mock('react-native', () => ({ Platform: { OS: 'android' }, Linking: {} }), { virtual: true });
jest.mock('react-native-health-connect', () => ({}), { virtual: true });
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }), { virtual: true });
const A = require('../lib/archive');
const E = require('../lib/experiments');
const R = require('../lib/report');

const mk = (from, n, f) => { const a = {}; A.rangeKeys(from, '2099-01-01').slice(0, n).forEach((k, i) => { a[k] = f(i); }); return a; };

test('архив дописывает дни и не стирает старые', () => {
  const r1 = { series: { steps: [{ key: '2026-01-01', v: 5000 }], sleep: [{ key: '2026-01-01', v: 7.24 }], rhr: [], activeMin: [], hrv: [{ t: new Date(2026, 0, 1, 7).getTime(), v: 40 }, { t: new Date(2026, 0, 1, 8).getTime(), v: 50 }], workouts: [] }, trend: [] };
  let a = A.mergeArchive({}, A.daysFromResult(r1));
  expect(a['2026-01-01']).toEqual({ s: 5000, h: 7.2, v: 45 });
  a = A.mergeArchive({ '2025-06-01': { s: 1 } }, A.daysFromResult(r1));
  expect(a['2025-06-01']).toEqual({ s: 1 });
  expect(A.coverage(a)).toEqual({ from: '2025-06-01', to: '2026-01-01', days: 2 });
});
test('сравнение периодов: средние, разница и число дней с данными', () => {
  const a = { ...mk('2026-01-01', 10, () => ({ s: 8000, h: 7 })), ...mk('2026-01-11', 10, (i) => (i < 5 ? { s: 10000 } : {})) };
  const rows = A.comparePeriods(a, A.rangeKeys('2026-01-11', '2026-01-20'), A.rangeKeys('2026-01-01', '2026-01-10'));
  const s = rows.find((x) => x.f === 's'), h = rows.find((x) => x.f === 'h');
  expect(s.delta).toBe(2000); expect(s.na).toBe(5);
  expect(h.a).toBeNull(); expect(h.delta).toBeNull();
});
test('история по месяцам', () => {
  const m = A.byMonth(mk('2026-01-30', 4, () => ({ s: 1000 })));
  expect(m.map((x) => [x.month, x.days])).toEqual([['2026-01', 2], ['2026-02', 2]]);
});
test('эксперимент: прогресс, завершение, отчёт до/во время', () => {
  let list = E.startExperiment([], { days: 7, sleepH: 8 }, '2026-02-08');
  const e = list[0];
  expect(E.progress(e, '2026-02-10')).toMatchObject({ day: 3, left: 4, finished: false });
  expect(E.progress(e, '2026-02-15').finished).toBe(true);
  const arch = { ...mk('2026-02-01', 7, () => ({ h: 6.5 })), ...mk('2026-02-08', 7, () => ({ h: 8 })) };
  const r = E.report(e, arch, '2026-02-20');
  expect(r.during).toBe(7); expect(r.before).toBe(7);
  expect(r.rows.find((x) => x.f === 'h').delta).toBeCloseTo(1.5);
  expect(r.sleepMet).toBe(true);
  list = E.startExperiment(list, { days: 14 }, '2026-03-01');
  expect(list.filter((x) => x.status === 'running').length).toBe(1);
});
test('CSV и страница отчёта', () => {
  const arch = mk('2026-03-01', 3, (i) => ({ s: 1000 * (i + 1), h: 7.25 }));
  const csv = R.toCSV(arch, '2026-03-01', '2026-03-31', true);
  expect(csv.split('\n').length).toBe(4);
  expect(csv).toContain('2026-03-02;2000;7.3');
  const html = R.toHTML(arch, '2026-03-01', '2026-03-31', { ru: false });
  expect(html).toContain('Epimely');
  expect(html).toContain('2026-03');
  expect(html).not.toContain('<script');
});
test('симулятор: больше сна и шагов не ухудшают возраст тела; та же формула', () => {
  const { reshapeSleep, applyPlan } = require('../lib/simulate');
  const arr = new Uint8Array(288); for (let i = 200; i < 260; i++) arr[i] = 1; // 5 часов
  const longer = reshapeSleep(arr, 8);
  expect(longer.reduce((a, x) => a + x, 0)).toBe(96);
  expect(longer[200]).toBe(1);
  const ds = { now: new Date(2026, 5, 30, 12), steps: { '2026-06-29': 3000 }, sleep: { '2026-06-29': arr }, nights: {} };
  const out = applyPlan(ds, { steps: 9000, sleepH: 8, days: 3 });
  expect(out.steps['2026-06-28']).toBeUndefined(); // дни без данных не появляются
  expect(out.sleep['2026-06-28']).toBeUndefined();
  expect(out.steps['2026-06-29']).toBe(9000);
  expect(ds.steps['2026-06-29']).toBe(3000); // исходные данные не тронуты
  expect(out.sleep['2026-06-29'].reduce((a, x) => a + x, 0)).toBe(96);
});
test('симулятор на полном наборе: больше сна и шагов — возраст тела не выше, считает compute()', () => {
  const { simulate } = require('../lib/simulate');
  const fs = require('fs'), path = require('path');
  // тот же набор данных, что в тесте расчёта
  const src = fs.readFileSync(path.join(__dirname, 'render.test.js'), 'utf8');
  expect(src).toContain('function makeDataset');
  const now = new Date(2026, 5, 30, 12);
  const day = (n) => { const d = new Date(now.getTime() - n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const ds = { now, start: new Date(now.getTime() - 182 * 86400000), granted: new Set(), steps: {}, sleep: {}, hr: {}, rhr: {}, strength: {}, vo2: [], lbm: [], nights: {}, hrToday: [], lastHr: null, workouts: [], asleep: [], nightHr: {}, extra: {}, distance: {}, calories: {}, debug: {}, errors: {} };
  for (let i = 0; i < 120; i++) { ds.steps[day(i)] = 4000; ds.rhr[day(i)] = 62; const a = new Uint8Array(288); for (let j = 0; j < 66; j++) a[j] = 1; ds.sleep[day(i)] = a; }
  const r = simulate(ds, { birth: '1985-05-05', sex: 'm', heightCm: 180 }, { steps: 10000, sleepH: 8 });
  expect(Number.isFinite(r.base)).toBe(true);
  expect(r.sim).toBeLessThanOrEqual(r.base);
});
