// Ответы на советы Хирона (lib/chironFeedback.js): принять, отложить, отклонить.
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } }), { virtual: true });
const { pickTip, isHidden, isAccepted, saveFeedback, DECLINE_DAYS } = require('../lib/chironFeedback');

const rec = { main: { id: 'a' }, others: [{ id: 'b' }, { id: 'c' }] };
const T = new Date(2026, 5, 10, 12).getTime(), DAY = 86400000;

test('без ответов — главный совет', () => { expect(pickTip(rec, {}, T).id).toBe('a'); expect(pickTip(null, {}, T)).toBeNull(); });
test('отклонённый не повторяется 30 дней, потом возвращается', async () => {
  const m = await saveFeedback({}, 'a', 'declined', T);
  expect(pickTip(rec, m, T + DAY).id).toBe('b');
  expect(isHidden(m, 'a', T + (DECLINE_DAYS - 1) * DAY)).toBe(true);
  expect(pickTip(rec, m, T + (DECLINE_DAYS + 1) * DAY).id).toBe('a');
});
test('отложенный скрыт только до завтра', async () => {
  const m = await saveFeedback({}, 'a', 'later', T);
  expect(pickTip(rec, m, T + 3600000).id).toBe('b');
  expect(pickTip(rec, m, T + DAY).id).toBe('a');
});
test('принятый остаётся на карточке сегодня и помечен принятым', async () => {
  const m = await saveFeedback({}, 'a', 'accepted', T);
  expect(pickTip(rec, m, T).id).toBe('a');
  expect(isAccepted(m, 'a', T)).toBe(true);
  expect(isAccepted(m, 'a', T + DAY)).toBe(false);
});
test('все отклонены — карточки нет', async () => {
  let m = await saveFeedback({}, 'a', 'declined', T); m = await saveFeedback(m, 'b', 'declined', T); m = await saveFeedback(m, 'c', 'declined', T);
  expect(pickTip(rec, m, T)).toBeNull();
});
