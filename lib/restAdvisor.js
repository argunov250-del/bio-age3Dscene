// Хирон предлагает облегчить день или отдохнуть — только предлагает; решение за человеком.
// Поводы: долгая серия рабочих смен с недосыпом или высокой нагрузкой, тяжёлые дни подряд,
// первые дни после длинной вахты. Сегодняшний день отдыха по графику — предложений нет.
import { isRest, isWork, workRun, sinceWorkBlock, dayType } from './schedule';

/**
 * ctx = { sched, key, tired (bool), sleepPoor (bool), poorNights (число ночей недосыпа подряд), dismissed (key|null) }
 * -> null | { kind: 'rest' | 'light' | 'recover', reason: [ru, en] }
 */
export function restSuggestion(ctx) {
  const c = ctx || {};
  const key = c.key;
  if (!key || c.dismissed === key || isRest(c.sched, key)) return null;
  const run = workRun(c.sched, key);
  const after = sinceWorkBlock(c.sched, key);
  const work = isWork(c.sched, key);
  if (!work && after.days != null && after.days >= 1 && after.days <= 3 && after.length >= 7) {
    return { kind: 'recover', reason: [`Позади ${after.length} рабочих дней. Первые дни дома — восстановление: сон и спокойная прогулка, без тяжёлых тренировок.`, `${after.length} work days are behind you. The first days at home are for recovery: sleep and an easy walk, no hard training.`] };
  }
  if (c.tired && (c.poorNights >= 2 || run >= 5)) {
    return { kind: 'rest', reason: [run >= 5 ? `${run} рабочих дней подряд и признаки усталости. Сделаем сегодня днём отдыха? Серия сохранится.` : 'Несколько ночей недосыпа и признаки усталости. Сделаем сегодня днём отдыха? Серия сохранится.', run >= 5 ? `${run} work days in a row and signs of fatigue. Make today a rest day? Your streak stays.` : 'Several short nights and signs of fatigue. Make today a rest day? Your streak stays.'] };
  }
  if (work && (c.tired || c.sleepPoor)) {
    return { kind: 'light', reason: ['Рабочий день после короткого сна. Сегодня хватит лёгкой активности — тренировку можно перенести.', 'A work day after short sleep. Light activity is enough today; the workout can wait.'] };
  }
  return null;
}
export { dayType };
