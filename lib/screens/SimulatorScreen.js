// «Симулятор привычек»: сколько спать и сколько ходить — и как это изменило бы возраст тела,
// если держать режим полгода. Пересчёт той же формулой по копии твоих данных (lib/simulate.js).
// «Попробовать в жизни» запускает эксперимент на 7–28 дней; итог — сравнение до и во время.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, Card, Section, Note, Chips, Button, Body } from '../ui';
import { SIZES } from '../theme';
import { useColors } from '../colors';
import { tr } from '../i18n';
import { simulate, currentAverages } from '../simulate';
import { LENGTHS } from '../experiments';
import { signed, fmt } from '../format';

function Stepper({ label, value, onChange, step, min, max, unit, s }) {
  return (
    <View style={s.step}>
      <Text style={s.stepLabel}>{label}</Text>
      <View style={s.stepRow}>
        <Pressable onPress={() => onChange(Math.max(min, value - step))} style={s.stepBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel={label + ' −'}><Text style={s.stepBtnText}>−</Text></Pressable>
        <Text style={s.stepVal}>{unit(value)}</Text>
        <Pressable onPress={() => onChange(Math.min(max, value + step))} style={s.stepBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel={label + ' +'}><Text style={s.stepBtnText}>＋</Text></Pressable>
      </View>
    </View>
  );
}

export function SimulatorScreen({ dataset, profile, onStart, running, onBack }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const cur = useMemo(() => (dataset ? currentAverages(dataset) : { steps: null, sleepH: null }), [dataset]);
  const [sleep, setSleep] = useState(() => Math.round(((cur.sleepH || 7) + 0.5) * 4) / 4);
  const [steps, setSteps] = useState(() => Math.round(((cur.steps || 6000) + 2000) / 500) * 500);
  const [days, setDays] = useState(14);
  const res = useMemo(() => { try { return simulate(dataset, profile, { sleepH: sleep, steps }); } catch (e) { return null; } }, [dataset, profile, sleep, steps]);
  const hm = (h) => Math.floor(h) + ' ' + tr('ч') + ' ' + String(Math.round((h % 1) * 60)).padStart(2, '0') + ' ' + tr('мин');
  return (
    <Screen title={tr('Симулятор привычек')} onBack={onBack}>
      <Body sub>{tr('Сейчас в среднем') + ': ' + (cur.sleepH ? hm(cur.sleepH) : '—') + ' ' + tr('сна') + ', ' + (cur.steps ? fmt(cur.steps) : '—') + ' ' + tr('шагов') + '.'}</Body>
      <Card>
        <Stepper s={s} label={tr('Сон за ночь')} value={sleep} onChange={setSleep} step={0.25} min={5} max={10} unit={hm} />
        <Stepper s={s} label={tr('Шагов в день')} value={steps} onChange={setSteps} step={500} min={2000} max={20000} unit={(v) => fmt(v)} />
      </Card>
      <Section>{tr('Если держать полгода')}</Section>
      <Card>
        {res && Number.isFinite(res.sim) ? (
          <>
            <Text style={s.big}>{fmt(res.sim, 1) + ' ' + tr('лет')}</Text>
            <Text style={s.sub}>{tr('сейчас') + ' ' + fmt(res.base, 1) + ' · ' + signed(res.delta, 1) + ' ' + tr('лет')}</Text>
          </>
        ) : <Text style={s.sub}>{tr('Мало данных для расчёта: нужны хотя бы несколько недель сна и шагов.')}</Text>}
        <Note>{tr('Это оценка той же формулы по твоим данным, а не обещание. Шаги и сон не делают моложе сами по себе — модель лишь показывает, как изменилась бы оценка.')}</Note>
      </Card>
      <Section>{tr('Попробовать в жизни')}</Section>
      <Card>
        <Chips options={LENGTHS.map((n) => [String(n), n + ' ' + tr('дн.')])} value={String(days)} onChange={(v) => setDays(Number(v) || 14)} />
        <Button title={running ? tr('Заменить текущий эксперимент') : tr('Начать эксперимент')} onPress={() => onStart({ days, sleepH: sleep, steps })} />
        <Note>{tr('Хирон будет следить за выполнением и в конце сравнит дни до и во время эксперимента. Остановить можно в любой момент.')}</Note>
      </Card>
    </Screen>
  );
}

const makeStyles = (c) => StyleSheet.create({
  step: { paddingVertical: 8 },
  stepLabel: { color: c.sub, fontSize: SIZES.small, marginBottom: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: c.text, fontSize: SIZES.title },
  stepVal: { color: c.text, fontSize: SIZES.title, fontWeight: '700' },
  big: { color: c.text, fontSize: SIZES.display, fontWeight: '800' },
  sub: { color: c.sub, fontSize: SIZES.body, marginTop: 2 },
});
