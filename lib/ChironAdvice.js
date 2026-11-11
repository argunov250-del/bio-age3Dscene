// Карточка Хирона с действиями: короткий совет, «Почему?» (на чём он основан и что предлагается)
// и ответ — принять, отложить или отклонить. Хирон ничего не меняет сам: он только предлагает.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Card, Bullet, Subhead } from './ui';
import { Orb } from './CoachCard';
import { SIZES } from './theme';
import { useColors } from './colors';
import { tr } from './i18n';
import { fit } from './fit';

export function ChironAdvice({ tip, accepted, onAnswer, onMore }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [why, setWhy] = useState(false);
  if (!tip) return null;
  const Btn = ({ title, onPress, strong }) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [s.btn, strong && s.btnStrong, pressed && { opacity: 0.7 }]}>
      <Text {...fit(1, 0.75)} style={[s.btnText, strong && s.btnStrongText]}>{title}</Text>
    </Pressable>
  );
  return (
    <Card>
      <View style={s.head}>
        <Orb mood={accepted ? 'happy' : 'ok'} />
        <View style={{ flex: 1 }}>
          <Text {...fit(1, 0.7)} style={s.name}>{tr('Хирон')}</Text>
          <Text style={s.meta} numberOfLines={1}>{tip.area}</Text>
        </View>
        <Pressable onPress={() => setWhy(!why)} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('Почему?')}>
          <Text style={s.why}>{why ? tr('Скрыть') : tr('Почему?')}</Text>
        </Pressable>
      </View>
      <Text style={s.lead}>{tip.title}</Text>
      {why ? (
        <View>
          <Subhead>{tr('Почему я так советую')}</Subhead>
          {(tip.why || []).map((x, i) => <Bullet key={'w' + i}>{x}</Bullet>)}
          <Subhead>{tr('Что я предлагаю сделать')}</Subhead>
          {(tip.actions || []).map((x, i) => <Bullet key={'a' + i}>{x}</Bullet>)}
          {onMore ? <Pressable onPress={onMore} hitSlop={8}><Text style={s.more}>{tr('Все советы на сегодня')} ›</Text></Pressable> : null}
        </View>
      ) : null}
      {accepted ? (
        <Text style={s.done}>✓ {tr('Принято. Это твой шаг на сегодня.')}</Text>
      ) : (
        <View style={s.row}>
          <Btn strong title={tr('Принять')} onPress={() => onAnswer && onAnswer(tip.id, 'accepted')} />
          <Btn title={tr('Позже')} onPress={() => onAnswer && onAnswer(tip.id, 'later')} />
          <Btn title={tr('Не подходит')} onPress={() => onAnswer && onAnswer(tip.id, 'declined')} />
        </View>
      )}
    </Card>
  );
}

const makeStyles = (c) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  name: { color: c.text, fontSize: SIZES.text, fontWeight: '700' },
  meta: { color: c.sub, fontSize: SIZES.tiny + 1 },
  why: { color: c.accent, fontSize: SIZES.small, fontWeight: '700' },
  lead: { color: c.text, fontSize: SIZES.text - 1, lineHeight: 22, fontWeight: '600', marginBottom: 6 },
  more: { color: c.sub, fontSize: SIZES.small, marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { flex: 1, height: SIZES.chip, borderRadius: SIZES.chip / 2, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  btnStrong: { backgroundColor: c.primary, borderColor: c.primary },
  btnText: { color: c.text, fontSize: SIZES.small, fontWeight: '600' },
  btnStrongText: { color: c.onPrimary },
  done: { color: c.good, fontSize: SIZES.small, fontWeight: '700', marginTop: 8 },
});
