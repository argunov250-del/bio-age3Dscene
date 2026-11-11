// «Рабочий график и отдых»: свой календарь смен и вахт. Пресет (5/2, 2/2, сутки/трое, вахты),
// свой цикл и дата начала, ночные смены («биологические сутки»), выходные как дни отдыха.
// Календарь месяца: нажатие на день меняет его по кругу «как в графике → рабочий → выходной → отдых».
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen, Card, Section, Note, SwitchRow, Chips, Field, FieldRow, Body } from '../ui';
import { SIZES } from '../theme';
import { useColors } from '../colors';
import { tr, RU } from '../i18n';
import { PRESETS, normalize, applyPreset, dayType, cycleOverride, monthGrid, keyOf } from '../schedule';

const WD = () => (RU ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);

export function ScheduleScreen({ schedule, onSave, onBack }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const sched = normalize(schedule);
  const today = keyOf(Date.now());
  const [ym, setYm] = useState(() => { const d = new Date(); return [d.getFullYear(), d.getMonth()]; });
  const set = (next) => onSave(normalize(next));
  const color = (t) => (t === 'work' ? c.text : t === 'rest' ? c.accent : t === 'off' ? c.muted : 'transparent');
  const monthName = new Date(ym[0], ym[1], 1).toLocaleDateString(RU ? 'ru-RU' : 'en-US', { month: 'long', year: 'numeric' });
  const shift = (d) => setYm(([y, m]) => { const x = new Date(y, m + d, 1); return [x.getFullYear(), x.getMonth()]; });
  return (
    <Screen title={tr('Рабочий график и отдых')} onBack={onBack}>
      <Section>{tr('График')}</Section>
      <Card>
        <Chips options={PRESETS.map((p) => [p.id, p.label[RU ? 0 : 1]])} value={sched.preset} onChange={(v) => set(applyPreset(sched, v || 'none', today))} />
        {sched.kind === 'week' ? (
          <View style={s.week}>
            {WD().map((n, i) => (
              <Pressable key={n} onPress={() => { const w = [...sched.week]; w[i] = w[i] ? 0 : 1; set({ ...sched, week: w }); }}
                style={[s.wd, sched.week[i] && { backgroundColor: c.primary, borderColor: c.primary }]} accessibilityRole="button" accessibilityLabel={n}>
                <Text style={[s.wdText, sched.week[i] && { color: c.onPrimary }]}>{n}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {sched.kind === 'cycle' ? (
          <>
            <FieldRow>
              <Field half numeric label={tr('Рабочих дней')} value={String(sched.cycle[0])} onChange={(v) => set({ ...sched, preset: 'custom', cycle: [Number(v) || 0, sched.cycle[1]] })} />
              <Field half numeric label={tr('Выходных дней')} value={String(sched.cycle[1])} onChange={(v) => set({ ...sched, preset: 'custom', cycle: [sched.cycle[0], Number(v) || 0] })} />
            </FieldRow>
            <Field label={tr('Первый рабочий день цикла (ГГГГ-ММ-ДД)')} value={sched.start || ''} onChange={(v) => set({ ...sched, start: /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : sched.start })} placeholder={today} />
          </>
        ) : null}
        <SwitchRow label={tr('Выходные — дни отдыха (серия не прерывается и не растёт)')} value={!!sched.restOnOff} onChange={(on) => set({ ...sched, restOnOff: on })} />
      </Card>

      <Section>{tr('Ночные смены')}</Section>
      <Card>
        <SwitchRow label={tr('Работаю ночью')} value={!!sched.night} onChange={(on) => set({ ...sched, night: on, dayStart: on ? Math.max(sched.dayStart, 6) : 0 })} />
        <Body sub>{tr('Начало моих суток') + ': ' + String(sched.dayStart).padStart(2, '0') + ':00. ' + tr('Привычки и вершины до этого часа относятся к предыдущему дню; расчёт возраста не меняется.')}</Body>
        <Chips options={[0, 3, 6, 9, 12].map((h) => [String(h), String(h).padStart(2, '0') + ':00'])} value={String(sched.dayStart)} onChange={(v) => set({ ...sched, dayStart: Number(v) || 0 })} />
      </Card>

      <Section>{tr('Календарь')}</Section>
      <Card>
        <View style={s.monthRow}>
          <Pressable onPress={() => shift(-1)} hitSlop={12} accessibilityRole="button" accessibilityLabel="prev"><Text style={s.arrow}>‹</Text></Pressable>
          <Text style={s.month}>{monthName}</Text>
          <Pressable onPress={() => shift(1)} hitSlop={12} accessibilityRole="button" accessibilityLabel="next"><Text style={s.arrow}>›</Text></Pressable>
        </View>
        <View style={s.gridRow}>{WD().map((n) => <Text key={n} style={s.head}>{n}</Text>)}</View>
        {monthGrid(ym[0], ym[1]).map((w, i) => (
          <View key={i} style={s.gridRow}>
            {w.map((k, j) => {
              if (!k) return <View key={j} style={s.cell} />;
              const t = dayType(sched, k);
              const edited = !!sched.overrides[k];
              return (
                <Pressable key={k} onPress={() => set(cycleOverride(sched, k))} style={[s.cell, k === today && s.today]} accessibilityRole="button" accessibilityLabel={k + ' ' + (t || '')}>
                  <Text style={s.num}>{Number(k.slice(8))}</Text>
                  <View style={[s.dot, { backgroundColor: color(t) }, edited && s.dotEdited]} />
                </Pressable>
              );
            })}
          </View>
        ))}
        <Note>{tr('● рабочий  ● выходной  ● отдых. Нажми на день, чтобы изменить его; обведённая точка — ручная правка. Прошедшие дни в вершинах не пересчитываются.')}</Note>
      </Card>
    </Screen>
  );
}

const makeStyles = (c) => StyleSheet.create({
  week: { flexDirection: 'row', gap: 6, marginTop: 10 },
  wd: { flex: 1, height: 36, borderRadius: 10, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  wdText: { color: c.text, fontSize: SIZES.small, fontWeight: '700' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  month: { color: c.text, fontSize: SIZES.text, fontWeight: '700', textTransform: 'capitalize' },
  arrow: { color: c.text, fontSize: SIZES.title, paddingHorizontal: 8 },
  gridRow: { flexDirection: 'row' },
  head: { flex: 1, textAlign: 'center', color: c.sub, fontSize: SIZES.tiny, marginBottom: 4 },
  cell: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  today: { borderWidth: 1, borderColor: c.accent },
  num: { color: c.text, fontSize: SIZES.small },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 3 },
  dotEdited: { borderWidth: 1.5, borderColor: c.text },
});
