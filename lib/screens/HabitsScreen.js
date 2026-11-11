// «Привычки»: каталог готовых и свои; для каждой — обязательная или дополнительная и дни
// (каждый день, рабочие, выходные или дни недели). Сколько дополнительных нужно для успешного дня.
// Изменения сохраняются сразу; уже прошедшие успешные дни не пересчитываются.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, Card, Section, Note, Chips, Field, Button, SwitchRow, Body } from '../ui';
import { SIZES } from '../theme';
import { useColors } from '../colors';
import { tr, RU } from '../i18n';
import { CATALOG, normalizeHabits, addHabit, updateHabit, removeHabit, habitTitle, autoOf } from '../habits';

const WD = () => (RU ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
const DAY_OPTS = () => [['all', tr('Каждый день')], ['work', tr('Рабочие')], ['off', tr('Выходные')], ['wd', tr('Дни недели')]];

export function HabitsScreen({ habits, onSave, onBack, suggested }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const h = normalizeHabits(habits);
  const [title, setTitle] = useState('');
  const [open, setOpen] = useState(null);
  const free = CATALOG.filter((x) => !h.list.some((q) => q.catalogId === x.id));
  return (
    <Screen title={tr('Привычки')} onBack={onBack}>
      <Body sub>{tr('Успешный день — выполнены все обязательные привычки этого дня и нужное число дополнительных. Шаги, сон, вода, дыхание и тренировка засчитываются сами по данным.')}</Body>
      <Section>{tr('Мои привычки')}</Section>
      <Card>
        {h.list.length ? h.list.map((q) => {
          const days = Array.isArray(q.days) ? 'wd' : q.days || 'all';
          const isOpen = open === q.id;
          return (
            <View key={q.id} style={s.item}>
              <Pressable onPress={() => setOpen(isOpen ? null : q.id)} style={s.row} accessibilityRole="button" accessibilityLabel={habitTitle(q, RU)}>
                <Text style={s.name} numberOfLines={2}>{habitTitle(q, RU)}</Text>
                <Text style={[s.tag, q.required && { color: c.accent }]}>{q.required ? tr('обязательная') : tr('дополнительная')}</Text>
              </Pressable>
              {autoOf(q) ? <Text style={s.auto}>{tr('засчитывается сама')}</Text> : null}
              {isOpen ? (
                <View style={{ gap: 8, marginTop: 6 }}>
                  <SwitchRow label={tr('Обязательная')} value={!!q.required} onChange={(on) => onSave(updateHabit(h, q.id, { required: on }))} />
                  <Chips options={DAY_OPTS()} value={days} onChange={(v) => onSave(updateHabit(h, q.id, { days: v === 'wd' ? [0, 1, 2, 3, 4] : v || 'all' }))} />
                  {Array.isArray(q.days) ? (
                    <View style={s.week}>
                      {WD().map((n, i) => {
                        const on = q.days.includes(i);
                        return (
                          <Pressable key={n} onPress={() => onSave(updateHabit(h, q.id, { days: on ? q.days.filter((x) => x !== i) : [...q.days, i].sort() }))}
                            style={[s.wd, on && { backgroundColor: c.primary, borderColor: c.primary }]} accessibilityRole="button" accessibilityLabel={n}>
                            <Text style={[s.wdText, on && { color: c.onPrimary }]}>{n}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                  <Button ghost compact title={tr('Удалить привычку')} onPress={() => { setOpen(null); onSave(removeHabit(h, q.id)); }} />
                </View>
              ) : null}
            </View>
          );
        }) : <Body sub>{tr('Пока нет привычек: успешный день считается по заданиям дня (3 и больше).')}</Body>}
      </Card>

      {h.list.some((q) => !q.required) ? (
        <>
          <Section>{tr('Дополнительных в день')}</Section>
          <Card><Chips options={[0, 1, 2, 3, 4].map((n) => [String(n), String(n)])} value={String(h.minOptional)} onChange={(v) => onSave({ ...h, minOptional: Number(v) || 0 })} /></Card>
        </>
      ) : null}

      {suggested && suggested.length ? (
        <>
          <Section>{tr('Хирон предлагает')}</Section>
          <Card>
            {suggested.filter((x) => free.some((f) => f.id === x)).map((id) => {
              const cat = CATALOG.find((x) => x.id === id);
              return <Button key={id} secondary compact title={'＋ ' + cat.title[RU ? 0 : 1]} onPress={() => onSave(addHabit(h, { catalogId: id }))} style={{ marginBottom: 6 }} />;
            })}
            <Note>{tr('Ничего не добавляется само — только по нажатию.')}</Note>
          </Card>
        </>
      ) : null}

      <Section>{tr('Каталог')}</Section>
      <Card>
        <View style={s.cat}>
          {free.map((x) => (
            <Pressable key={x.id} onPress={() => onSave(addHabit(h, { catalogId: x.id }))} style={s.chip} accessibilityRole="button" accessibilityLabel={x.title[RU ? 0 : 1]}>
              <Text style={s.chipText}>{'＋ ' + x.title[RU ? 0 : 1]}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Section>{tr('Своя привычка')}</Section>
      <Card>
        <Field label={tr('Название')} value={title} onChange={setTitle} placeholder={tr('Например: зарядка утром')} />
        <Button title={tr('Добавить')} disabled={!title.trim()} onPress={() => { onSave(addHabit(h, { title: title.trim().slice(0, 60) })); setTitle(''); }} />
      </Card>
    </Screen>
  );
}

const makeStyles = (c) => StyleSheet.create({
  item: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: c.text, fontSize: SIZES.text, fontWeight: '600' },
  tag: { color: c.sub, fontSize: SIZES.tiny + 1 },
  auto: { color: c.muted, fontSize: SIZES.tiny + 1, marginTop: 2 },
  week: { flexDirection: 'row', gap: 6 },
  wd: { flex: 1, height: 34, borderRadius: 10, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  wdText: { color: c.text, fontSize: SIZES.small, fontWeight: '700' },
  cat: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: c.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: c.text, fontSize: SIZES.small },
});
