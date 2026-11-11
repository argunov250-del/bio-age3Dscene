// Вид 3D-сцены по календарю и погоде (lib/sceneState.js).
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }), { virtual: true });
const { sceneState, windLevel } = require('../lib/sceneState');

const at = (m, d, h = 13) => new Date(2026, m - 1, d, h, 0, 0);

describe('сцена по календарю', () => {
  test('зима без погоды: горы в снегу, снег не идёт, погода смоделирована', () => {
    const s = sceneState(at(1, 15));
    expect(s.snow).toBe(1);
    expect(s.precip).toBeNull();
    expect(s.live).toBe(false);
  });
  test('весна: граница снега поднимается', () => {
    const a = sceneState(at(3, 20)).snow, b = sceneState(at(4, 25)).snow;
    expect(a).toBeLessThan(1);
    expect(b).toBeLessThan(a);
    expect(sceneState(at(7, 10)).snow).toBe(0);
  });
  test('лето: снег только на вершинах, зелёные луга', () => {
    const s = sceneState(at(7, 10));
    expect(s.snow).toBe(0);
    expect(s.tone).toBeCloseTo(1, 1);
    expect(s.grass).toBeGreaterThan(0.9);
  });
  test('осень: луга рыжеют, снег возвращается', () => {
    const s = sceneState(at(10, 20));
    expect(s.tone).toBeGreaterThan(1.5);
    expect(s.snow).toBeGreaterThan(0);
  });
  test('год замкнут: 31 декабря и 1 января выглядят одинаково', () => {
    const a = sceneState(at(12, 31)), b = sceneState(at(1, 1));
    expect(Math.abs(a.snow - b.snow)).toBeLessThan(0.05);
    expect(Math.abs(a.grass - b.grass)).toBeLessThan(0.05);
  });
  test('все числа конечны в любой день года', () => {
    for (let d = 0; d < 366; d++) {
      const s = sceneState(new Date(2028, 0, 1 + d, 12));
      for (const k of ['snow', 'tone', 'grass', 'wind', 'cloud', 'fog']) {
        expect(Number.isFinite(s[k])).toBe(true);
        expect(s[k]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('сцена по погоде', () => {
  test('снегопад летом: идёт снег и сцена снежная', () => {
    const s = sceneState(at(7, 10), { kind: 'snow', day: true });
    expect(s.precip).toBe('snow');
    expect(s.snow).toBe(1);
    expect(s.live).toBe(true);
  });
  test('гроза: дождь, молнии, сильный ветер', () => {
    const s = sceneState(at(7, 10), { kind: 'storm', day: true, wind: 5 });
    expect(s.precip).toBe('rain');
    expect(s.storm).toBe(true);
    expect(s.wind).toBeGreaterThanOrEqual(0.8);
  });
  test('ветер из погоды усиливает качание', () => {
    expect(sceneState(at(7, 10), { kind: 'clear', day: true, wind: 40 }).wind).toBeGreaterThan(sceneState(at(7, 10), { kind: 'clear', day: true, wind: 3 }).wind);
    expect(windLevel(500)).toBe(1);
  });
  test('туман и облака', () => {
    expect(sceneState(at(5, 1), { kind: 'fog', day: true }).fog).toBe(1);
    expect(sceneState(at(5, 1), { kind: 'clouds', day: true }).cloud).toBeGreaterThan(0.5);
  });
  test('ночь по погоде, устаревшая погода не учитывается', () => {
    expect(sceneState(at(7, 10, 13), { kind: 'clear', day: false }).period).toBe('night');
    expect(sceneState(at(7, 10), { kind: 'snow', day: true, stale: true }).precip).toBeNull();
  });
  test('тема и «всегда день» передаются в сцену', () => {
    const s = sceneState(at(7, 10, 23), null, { dark: true, period: 'day' });
    expect(s.dark).toBe(true);
    expect(s.period).toBe('day');
  });
});
