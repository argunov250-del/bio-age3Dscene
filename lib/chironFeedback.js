// Ответы на советы Хирона: «принять», «позже», «не подходит». Хранятся только на телефоне.
// Отклонённый совет не повторяется 30 дней, отложенный — до завтра; историю можно сбросить.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'chiron.feedback.v1';
const DAY = 86400000;
export const DECLINE_DAYS = 30;
const dayOf = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };

// map: { [tipId]: { s: 'accepted' | 'later' | 'declined', at } }
export function isHidden(map, id, now = Date.now()) {
  const f = map && map[id];
  if (!f) return false;
  if (f.s === 'declined') return now - f.at < DECLINE_DAYS * DAY;
  if (f.s === 'later') return dayOf(f.at) === dayOf(now);
  return false;
}
export const isAccepted = (map, id, now = Date.now()) => !!(map && map[id] && map[id].s === 'accepted' && dayOf(map[id].at) === dayOf(now));

// Главный совет с учётом ответов: первый не скрытый из [main, ...others].
export function pickTip(rec, map, now = Date.now()) {
  if (!rec || !rec.main) return null;
  const list = [rec.main, ...(rec.others || [])];
  return list.find((t) => t && !isHidden(map, t.id, now)) || null;
}

export async function loadFeedback() {
  try { const raw = await AsyncStorage.getItem(KEY); const m = raw ? JSON.parse(raw) : {}; return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; }
}
export async function saveFeedback(map, id, s, now = Date.now()) {
  const next = { ...(map || {}), [id]: { s, at: now } };
  try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch (e) {}
  return next;
}
export async function clearFeedback() {
  try { await AsyncStorage.removeItem(KEY); } catch (e) {}
  return {};
}
