// Текущий эксперимент на «Прогрессе»: день N из M, цели, а в конце — сравнение до и во время.
// Кнопки: «Закрепить» (добавляет привычки сна и шагов), «Повторить», «Завершить».
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, Section, Button, Note } from './ui';
import { Orb } from './CoachCard';
import { SIZES } from './theme';
import { useColors } from './colors';
import { tr, RU } from './i18n';
import { progress, report } from './experiments';
import { LABELS } from './archive';
import { fmt } from './format';

const v = (f, x) => (x == null ? '—' : f === 'h' ? fmt(x, 1) : fmt(x));

export function ExperimentCard({ experiment, archive, todayKey, onKeep, onRepeat, onStop, onOpen }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  if (!experiment) return null;
  const p = progress(experiment, todayKey);
  const r = report(experiment, archive, todayKey);
  const goals = [experiment.sleepH != null ? tr('сон') + ' ' + fmt(experiment.sleepH, 2) + ' ' + tr('ч') : null, experiment.steps != null ? fmt(experiment.steps) + ' ' + tr('шагов') : null].filter(Boolean).join(' · ');
  const rows = r.rows.filter((x) => x.f === 'h' || x.f === 's' || x.f === 'r' || x.f === 'v');
  return (
    <>
      <Section right={tr('Симулятор')} onRight={onOpen}>{tr('Эксперимент')}</Section>
      <Card>
        <View style={s.head}><Orb mood={p.finished ? 'happy' : 'ok'} /><Text style={s.title}>{p.finished ? tr('Эксперимент завершён') : tr('День') + ' ' + p.day + ' ' + tr('из') + ' ' + experiment.days}</Text></View>
        <Text style={s.goals}>{goals}</Text>
        {rows.map((x) => (
          <View key={x.f} style={s.row}>
            <Text style={s.name}>{LABELS[x.f][RU ? 0 : 1]}</Text>
            <Text style={s.val}>{v(x.f, x.b) + ' → ' + v(x.f, x.a)}</Text>
          </View>
        ))}
        <Note>{tr('До и во время, дней с данными') + ': ' + (rows[0] ? rows[0].nb + ' / ' + rows[0].na : '0') + '. ' + tr('Совпадение по времени — ещё не доказательство причины.')}</Note>
        {p.finished ? (
          <>
            <Button title={tr('Закрепить привычки')} onPress={onKeep} />
            <Button secondary title={tr('Повторить')} onPress={onRepeat} />
            <Button ghost title={tr('Завершить')} onPress={onStop} />
          </>
        ) : <Button ghost title={tr('Остановить эксперимент')} onPress={onStop} />}
      </Card>
    </>
  );
}

const makeStyles = (c) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  title: { color: c.text, fontSize: SIZES.text, fontWeight: '700' },
  goals: { color: c.accent, fontSize: SIZES.small, fontWeight: '700', marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  name: { color: c.sub, fontSize: SIZES.small },
  val: { color: c.text, fontSize: SIZES.small, fontWeight: '600' },
});
