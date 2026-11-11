// Вершины за регулярность (lib/peaks.js): два хребта — дисциплины (серия дней подряд)
// и постоянства (всего успешных дней). Открытые вершины остаются навсегда.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet } from 'react-native';
import { Card, Section, Button } from './ui';
import { SIZES } from './theme';
import { useColors } from './colors';
import { tr, RU } from './i18n';
import { TASKS_FOR_DAY } from './peaks';
import { reduceMotion } from './motion';
import { fit } from './fit';

export const peakName = (p) => (p && p.name ? p.name[RU ? 0 : 1] : '');

function Ridge({ title, hint, value, list, s, c }) {
  const [open, setOpen] = useState(null);
  const next = list.find((p) => !p.unlocked);
  const prevNeed = (() => { const done = list.filter((p) => p.unlocked); return done.length ? done[done.length - 1].need : 0; })();
  const k = next ? Math.max(0, Math.min(1, (value - prevNeed) / Math.max(1, next.need - prevNeed))) : 1;
  return (
    <View style={s.ridge}>
      <View style={s.ridgeHead}>
        <Text style={s.ridgeTitle}>{title}</Text>
        <Text style={s.ridgeValue}>{value}</Text>
      </View>
      <Text style={s.hint}>{hint}</Text>
      <View style={s.peaks}>
        {list.map((p) => (
          <Pressable key={p.id} onPress={() => setOpen(open === p.id ? null : p.id)} hitSlop={4} accessibilityRole="button" accessibilityLabel={peakName(p)}
            style={[s.peak, p.unlocked && { backgroundColor: c.accent, borderColor: c.accent }, next && p.id === next.id && { borderColor: c.accent }]}>
            <Text style={[s.peakText, p.unlocked && { color: c.onAccent }]}>{p.unlocked ? '▲' : p.need}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.track}><View style={[s.fill, { width: Math.round(k * 100) + '%' }]} /></View>
      {open ? (() => {
        const p = list.find((x) => x.id === open);
        return (
          <Text style={s.detail}>
            {peakName(p) + ' · ' + p.need + ' ' + tr('дн.') + ' · ' + (p.unlocked ? tr('открыта') + ' ' + p.at : tr('осталось') + ' ' + p.left + ' ' + tr('дн.'))}
          </Text>
        );
      })() : (
        <Text style={s.detail}>{next ? tr('Следующая вершина') + ': ' + peakName(next) + ' · ' + tr('осталось') + ' ' + next.left + ' ' + tr('дн.') : tr('Все вершины хребта открыты')}</Text>
      )}
    </View>
  );
}

export function PeaksCard({ peaks }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  if (!peaks) return null;
  return (
    <>
      <Section>{tr('Вершины')}</Section>
      <Card>
        <Ridge s={s} c={c} title={tr('Хребет дисциплины')} hint={tr('Серия успешных дней подряд. Лучшая серия') + ': ' + peaks.best} value={peaks.streak} list={peaks.discipline} />
        <View style={s.sep} />
        <Ridge s={s} c={c} title={tr('Хребет постоянства')} hint={tr('Всего успешных дней, даже если серия прерывалась.')} value={peaks.total} list={peaks.constancy} />
        <Text style={s.rule}>
          {tr('Успешный день — выполнено заданий') + ': ' + TASKS_FOR_DAY + '+. ' + tr('День отдыха серию не прерывает. Открытые вершины остаются навсегда.')}
          {peaks.haze > 0 ? ' ' + tr('Дальние хребты затянула дымка: один успешный день — и она рассеется.') : ''}
        </Text>
      </Card>
    </>
  );
}

// Момент открытия вершины: сцена делает пролёт, поверх — название. Можно пропустить.
export function PeakUnlock({ peak, onClose }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const v = useRef(new Animated.Value(reduceMotion() ? 1 : 0)).current;
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration: reduceMotion() ? 0 : 900, delay: reduceMotion() ? 0 : 1800, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [v]);
  if (!peak) return null;
  return (
    <View style={[StyleSheet.absoluteFill, s.unlock]} accessibilityLabel="peak-unlock">
      <Animated.View style={[s.unlockCard, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
        <Text style={s.unlockKicker}>{peak.ridge === 'discipline' ? tr('Хребет дисциплины') : tr('Хребет постоянства')}</Text>
        <Text {...fit(2, 0.7)} style={s.unlockName}>{peakName(peak)}</Text>
        <Text style={s.unlockSub}>{tr('Новая вершина открыта') + ' · ' + peak.need + ' ' + tr('дн.')}</Text>
        <Button title={tr('Дальше')} onPress={onClose} />
      </Animated.View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  ridge: { gap: 6 },
  ridgeHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  ridgeTitle: { color: c.text, fontSize: SIZES.text, fontWeight: '700' },
  ridgeValue: { color: c.text, fontSize: SIZES.stat, fontWeight: '800' },
  hint: { color: c.sub, fontSize: SIZES.small },
  peaks: { flexDirection: 'row', gap: 6, marginTop: 4 },
  peak: { flex: 1, height: 34, borderRadius: 10, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  peakText: { color: c.sub, fontSize: SIZES.tiny + 1, fontWeight: '700' },
  track: { height: 4, borderRadius: 2, backgroundColor: c.line, overflow: 'hidden', marginTop: 4 },
  fill: { height: 4, borderRadius: 2, backgroundColor: c.accent },
  detail: { color: c.sub, fontSize: SIZES.small },
  sep: { height: 1, backgroundColor: c.line, marginVertical: 14 },
  rule: { color: c.muted, fontSize: SIZES.tiny + 1, lineHeight: 17, marginTop: 14 },
  unlock: { justifyContent: 'flex-end', padding: SIZES.pad, paddingBottom: SIZES.pad * 4 },
  unlockCard: { backgroundColor: c.card, borderRadius: SIZES.radius, borderWidth: c.border, borderColor: c.line, padding: SIZES.pad * 1.25, gap: 8, alignItems: 'stretch' },
  unlockKicker: { color: c.accent, fontSize: SIZES.small, fontWeight: '700', textAlign: 'center', letterSpacing: 0.4 },
  unlockName: { color: c.text, fontSize: SIZES.pageTitle, fontWeight: '800', textAlign: 'center' },
  unlockSub: { color: c.sub, fontSize: SIZES.body, textAlign: 'center', marginBottom: 6 },
});
