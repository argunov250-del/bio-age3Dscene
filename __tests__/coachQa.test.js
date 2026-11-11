// Вопросы кнопками: каталог, движок ответов и подсказок, экран без поля ввода (светлая и тёмная темы).
const React = require('react');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
global.IS_REACT_ACT_ENVIRONMENT = true;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

jest.mock('../lib/health', () => ({}));
jest.mock('../lib/appleHealth', () => ({ importedRecords: () => [], importedTypes: () => [] }));
['sleep', 'activity', 'heart', 'training', 'recovery', 'bodyage', 'nutrition', 'stress', 'cycle', 'app', 'chiron'].forEach((n) => {
  jest.doMock('../lib/coach/qa/' + n, () => ({ __esModule: true, default: require('./fixtures/qaFixture')[n] }));
});

const okM = (value) => ({ status: 'ok', value });
const win = (v) => ({ 7: okM(v), 14: okM(v), 30: okM(v) });
const FULL = {
  chrono: 40, bio: 38, pace: 0.9,
  scores: { sleep: { status: 'ok', score: 80, hours: 7.5, norm: 7.5 }, activity: { status: 'ok', score: 70 }, readiness: { status: 'ok', score: 75 }, recovery: { status: 'ok', score: 70, hrvDev: 2, nightHrDiff: 0 }, load: { level: 'normal' } },
  metrics: { steps: win(8000), sleepDuration: win(7.4), restingHr: win(60), hrv: win(50), activeMinutes: win(200), sleepRegularity: { 14: okM(80) }, exercise: { 7: okM(3), 30: okM(10) }, hrvBaseline: { value: 50 }, vo2max: okM(42) },
};
const POOR = { ...FULL, scores: { ...FULL.scores, sleep: { status: 'ok', score: 45, hours: 5.2, norm: 7.5 } }, metrics: { ...FULL.metrics, sleepDuration: win(5.3) } };

describe('каталог и поиск', () => {
  const idx = require('../lib/coach/qa');
  test('checkQA без ошибок; ловит дубли и битые follow', () => {
    expect(idx.checkQA()).toEqual([]);
    const bad = idx.checkQA([{ ...idx.QA[0] }, { ...idx.QA[0], follow: ['nope'] }]);
    expect(bad.join('|')).toMatch(/дубль id/); expect(bad.join('|')).toMatch(/follow -> нет nope/);
  });
  test('when(env) скрывает вопросы про цикл', () => {
    expect(idx.visible({ profile: {} }).some((x) => x.id === 'cycle_phase')).toBe(false);
    expect(idx.visible({ profile: { sex: 'f', showCycle: true } }).some((x) => x.id === 'cycle_phase')).toBe(true);
  });
  test('поиск по q и tags, ё/е, пустой — все', () => {
    const ids = (q) => idx.search(q, { profile: {} }, true).map((x) => x.id);
    expect(ids('недосып')).toEqual(['sleep_how_much', 'sleep_debt'].filter((x) => ids('недосып').includes(x)));
    expect(ids('недосып')).toContain('sleep_how_much');
    expect(ids('фазы')).toEqual(['sleep_phases']);
    expect(ids('ХИРОН')).toEqual(['chiron_who']);
    expect(ids('вариабельность')).toEqual(['heart_hrv']);
    expect(ids('zzzz')).toEqual([]);
    expect(ids('').length).toBe(idx.visible({ profile: {} }).length);
  });
});

describe('движок ответов', () => {
  const E = require('../lib/coach/qaEngine');
  const { emptyMemory } = require('../lib/coach/memory');
  const env = (result, profile) => ({ ...E.makeEnv({ result, profile: profile || {}, tone: 'balanced' }), ru: true });
  test('ответ: короткий текст с данными, more, источники resolved, follow', () => {
    const a = E.answerQuestion('sleep_how_much', env(FULL), emptyMemory());
    expect(a.text.join(' ')).toMatch(/7 ч 24 мин/);
    expect(a.more).toContain('Подробный разбор');
    expect(a.sources[0]).toEqual(expect.objectContaining({ text: expect.stringMatching(/7–9/), source: expect.any(String) }));
    expect(a.sources[1]).toEqual({ title: 'WHO: Physical activity guidelines', year: 2020 });
    expect(a.follow).toEqual(['sleep_debt', 'sleep_phases']);
    expect(E.answerQuestion('nope', env(FULL), emptyMemory())).toBeNull();
  });
  test('нет данных: переменная опускается, чисто и без нулей', () => {
    const a = E.answerQuestion('sleep_how_much', env(null), emptyMemory());
    const t = a.text.join(' ');
    expect(t).not.toMatch(/\{|undefined|NaN| 0 ч/);
    expect(t.trim()).toBe(t);
    const vars = E.buildQaVars(env(null));
    expect(vars.sleepAvgLine).toBeUndefined();
    expect(vars.stepGoal).toBe('8 000');
    expect(E.fill('А {x} Б {sleepAvgLine}.', {})).toBe('А Б.');
  });
  test('ротация вариантов: LRU через память', () => {
    let m = emptyMemory();
    const seen = [];
    for (let i = 0; i < 4; i++) { const a = E.answerQuestion('sleep_how_much', env(FULL), m); m = a.memory; seen.push(a.text.join(' ').startsWith('Второй') ? 2 : 1); }
    expect(seen).toEqual([1, 2, 1, 2]);
    expect(m.qaAsked).toEqual(['sleep_how_much']);
  });
  test('юмор: никогда при выключенном режиме, защитной паузе и humorOk=false', () => {
    const CAT = [{ id: 'h1', variants: ['Шутка'], variantsEn: ['Joke'], priority: 10, matchingIntents: ['sleep_how_much', 'chiron_who'], contextualTriggers: [], blockedContexts: [], cooldownAssistantMessages: 1 }];
    jest.isolateModules(() => {
      jest.doMock('../lib/humor/catalog', () => ({ CATALOG: CAT, MEMES: CAT, JABS: [] }));
      const E2 = require('../lib/coach/qaEngine');
      const mem = require('../lib/coach/memory');
      const e = (tone) => ({ ...E2.makeEnv({ result: FULL, profile: {}, tone }), ru: true });
      expect(E2.answerQuestion('sleep_how_much', e('playful'), mem.emptyMemory()).humorId).toBe('h1');
      expect(E2.answerQuestion('sleep_how_much', e('off'), mem.emptyMemory()).humorId).toBeNull();
      expect(E2.answerQuestion('sleep_how_much', e('playful'), { ...mem.emptyMemory(), hold: { kind: 'red', turn: 0 } }).humorId).toBeNull();
      expect(E2.answerQuestion('chiron_who', e('playful'), mem.emptyMemory()).humorId).toBeNull();
    });
  });
  test('подсказки: по данным (плохой сон -> сон), без повторов, 4–6, продолжения последнего', () => {
    const e = env(POOR);
    const a = E.suggestions(e, emptyMemory(), null);
    expect(a.length).toBeGreaterThanOrEqual(4); expect(a.length).toBeLessThanOrEqual(6);
    expect(new Set(a).size).toBe(a.length);
    expect(a.slice(0, 2).every((id) => id.startsWith('sleep_'))).toBe(true);
    expect(a).not.toContain('cycle_phase');
    expect(a.every((id) => id !== 'sleep_phases')).toBe(true); // pro только после pro-вопроса
    let m = emptyMemory();
    m = E.answerQuestion('sleep_how_much', e, m).memory;
    const b = E.suggestions(e, m, 'sleep_how_much');
    expect(b).not.toContain('sleep_how_much');
    expect(b[0]).toBe('sleep_debt');
    m = E.answerQuestion('sleep_phases', e, m).memory; // спросил pro
    const c = E.suggestions(e, m, 'sleep_phases');
    expect(c).not.toContain('sleep_phases'); expect(c).not.toContain('sleep_how_much');
    expect(c.some((id) => id === 'heart_hrv')).toBe(true); // один pro предлагается
  });
});
