// Горный режим спокойствия: интерфейс уходит, остаются горы, облака и звуки природы.
// Время — 3, 5, 10, 15 минут или без ограничения; завершить можно в любой момент.
// После сеанса — необязательный вопрос о самочувствии (хранится только на телефоне).
// Никаких обещаний лечебного эффекта и никаких наград за «правильный» отдых.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from './ui';
import { Orb } from './CoachCard';
import { SIZES } from './theme';
import { useColors } from './colors';
import { tr } from './i18n';
import { fit } from './fit';

export const CALM_CHOICES = [3, 5, 10, 15, 0]; // минут; 0 — без ограничения
const KEY = 'calm.log.v1';
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export async function saveCalm(entry) {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = [...(Array.isArray(list) ? list : []), entry].slice(-200);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {}
}

export function CalmMode({ onClose }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState('pick'); // pick → run → rate
  const [total, setTotal] = useState(0);
  const [left, setLeft] = useState(0);
  const started = useRef(0);
  useEffect(() => {
    if (stage !== 'run') return undefined;
    const id = setInterval(() => {
      const passed = Date.now() - started.current;
      if (total > 0) {
        setLeft(total - passed);
        if (passed >= total) setStage('rate');
      } else setLeft(passed);
    }, 500);
    return () => clearInterval(id);
  }, [stage, total]);
  const begin = (min) => { started.current = Date.now(); setTotal(min * 60000); setLeft(min * 60000); setStage('run'); };
  const finish = (feel) => {
    const min = Math.round((Date.now() - started.current) / 60000);
    if (started.current) saveCalm({ at: Date.now(), min, feel: feel || null });
    onClose();
  };
  const Choice = ({ title, onPress }) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [s.choice, pressed && { opacity: 0.7 }]}>
      <Text {...fit(1, 0.7)} style={s.choiceText}>{title}</Text>
    </Pressable>
  );

  if (stage === 'run') {
    return (
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'space-between', paddingTop: insets.top + SIZES.pad, paddingBottom: insets.bottom + SIZES.pad * 2 }]} accessibilityLabel="calm-run">
        <Text style={s.timer}>{total > 0 ? mmss(left) : mmss(left)}</Text>
        <Pressable onPress={() => setStage('rate')} accessibilityRole="button" accessibilityLabel={tr('Завершить')} style={s.stop}>
          <Text style={s.stopText}>{tr('Завершить')}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={[StyleSheet.absoluteFill, s.wrap, { paddingBottom: insets.bottom + SIZES.pad * 2 }]} accessibilityLabel={'calm-' + stage}>
      <View style={s.card}>
        <View style={s.head}>
          <Orb mood="ok" />
          <Text style={s.title}>{stage === 'pick' ? tr('Побыть в горах') : tr('Как самочувствие после отдыха?')}</Text>
        </View>
        {stage === 'pick' ? (
          <>
            <Text style={s.sub}>{tr('Интерфейс уйдёт, останутся горы и ветер. Сколько времени побыть здесь?')}</Text>
            <View style={s.row}>
              {CALM_CHOICES.map((m) => <Choice key={m} title={m ? m + ' ' + tr('мин') : '∞'} onPress={() => begin(m)} />)}
            </View>
            <Button ghost title={tr('Не сейчас')} onPress={onClose} />
          </>
        ) : (
          <>
            <View style={s.row}>
              <Choice title={tr('Лучше')} onPress={() => finish('better')} />
              <Choice title={tr('Так же')} onPress={() => finish('same')} />
              <Choice title={tr('Хуже')} onPress={() => finish('worse')} />
            </View>
            <Button ghost title={tr('Пропустить')} onPress={() => finish(null)} />
          </>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: { justifyContent: 'flex-end', paddingHorizontal: SIZES.pad },
  card: { backgroundColor: c.card, borderRadius: SIZES.radius, borderWidth: c.border, borderColor: c.line, padding: SIZES.pad * 1.25, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, color: c.text, fontSize: SIZES.text + 1, fontWeight: '700' },
  sub: { color: c.sub, fontSize: SIZES.body, lineHeight: SIZES.lineHeight },
  row: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, height: SIZES.field, borderRadius: SIZES.radiusSmall, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  choiceText: { color: c.text, fontSize: SIZES.body, fontWeight: '700' },
  timer: { alignSelf: 'center', color: c.text, opacity: 0.75, fontSize: SIZES.title, fontWeight: '600', backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, overflow: 'hidden' },
  stop: { alignSelf: 'center', backgroundColor: c.card, borderRadius: 22, paddingHorizontal: 22, height: 44, justifyContent: 'center', borderWidth: c.border, borderColor: c.line },
  stopText: { color: c.text, fontSize: SIZES.body, fontWeight: '700' },
});
