// Привычки на сегодня (вкладка «Прогресс»): отметить выполнение и увидеть итог дня.
// Тип дня по графику (рабочий, выходной, отдых) и подсказка, что ещё нужно для успешного дня.
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Card, Section } from './ui';
import { SIZES } from './theme';
import { useColors } from './colors';
import { tr, RU } from './i18n';
import { normalizeHabits, dueOn, isDone, habitTitle, daySummary } from './habits';
import { dayType } from './schedule';

export function HabitsCard({ habits, schedule, todayKey, growthRec, onToggle, onEdit, onSchedule }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const h = normalizeHabits(habits);
  const t = dayType(schedule, todayKey);
  const due = h.list.filter((q) => dueOn(q, todayKey, schedule));
  const sum = daySummary(h, todayKey, schedule, growthRec);
  const label = t === 'work' ? tr('Рабочий день') : t === 'off' ? tr('Выходной') : t === 'rest' ? tr('День отдыха: серия не прерывается') : null;
  return (
    <>
      <Section right={tr('Изменить')} onRight={onEdit}>{tr('Привычки на сегодня')}</Section>
      <Card>
        <Pressable onPress={onSchedule} accessibilityRole="button" accessibilityLabel={tr('Рабочий график и отдых')}>
          <Text style={s.day}>{label || tr('График не задан — настроить')}</Text>
        </Pressable>
        {due.length ? due.map((q) => {
          const done = isDone(h, q, todayKey, growthRec);
          return (
            <Pressable key={q.id} onPress={() => (done === 'auto' ? null : onToggle(q.id))} style={s.row} accessibilityRole="checkbox" accessibilityState={{ checked: !!done }} accessibilityLabel={habitTitle(q, RU)}>
              <View style={[s.box, done && { backgroundColor: c.accent, borderColor: c.accent }]}>{done ? <Text style={s.tick}>✓</Text> : null}</View>
              <Text style={[s.name, done && { color: c.sub }]} numberOfLines={2}>{habitTitle(q, RU)}</Text>
              <Text style={s.meta}>{done === 'auto' ? tr('по данным') : q.required ? tr('обяз.') : ''}</Text>
            </Pressable>
          );
        }) : <Text style={s.empty}>{h.list.length ? tr('Сегодня привычек по расписанию нет.') : tr('Добавь свои привычки — по ним будет считаться успешный день.')}</Text>}
        {sum.configured && sum.due ? (
          <Text style={[s.sum, sum.success && { color: c.good }]}>
            {sum.success ? tr('День успешный') : tr('Обязательные') + ': ' + sum.doneRequired + '/' + sum.required + (sum.needOptional ? '  ·  ' + tr('дополнительные') + ': ' + sum.doneOptional + '/' + sum.needOptional : '')}
          </Text>
        ) : null}
      </Card>
    </>
  );
}

const makeStyles = (c) => StyleSheet.create({
  day: { color: c.accent, fontSize: SIZES.small, fontWeight: '700', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: c.muted, alignItems: 'center', justifyContent: 'center' },
  tick: { color: c.onAccent, fontWeight: '800', fontSize: 14 },
  name: { flex: 1, color: c.text, fontSize: SIZES.text },
  meta: { color: c.muted, fontSize: SIZES.tiny + 1 },
  empty: { color: c.sub, fontSize: SIZES.body, paddingVertical: 6 },
  sum: { color: c.sub, fontSize: SIZES.small, fontWeight: '700', marginTop: 8 },
});
