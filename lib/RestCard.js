// Предложение Хирона облегчить день или отдохнуть (lib/restAdvisor.js). Ничего не меняется само:
// «Сделать днём отдыха» помечает сегодня днём отдыха в календаре, «Не сейчас» скрывает до завтра.
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Card } from './ui';
import { Orb } from './CoachCard';
import { SIZES } from './theme';
import { useColors } from './colors';
import { tr, RU } from './i18n';
import { fit } from './fit';

export function RestCard({ suggestion, onAccept, onDismiss }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  if (!suggestion) return null;
  const rest = suggestion.kind === 'rest';
  return (
    <Card>
      <View style={s.head}>
        <Orb mood="tired" />
        <Text style={s.name}>{tr('Хирон')}</Text>
      </View>
      <Text style={s.text}>{suggestion.reason[RU ? 0 : 1]}</Text>
      <View style={s.row}>
        {rest ? (
          <Pressable onPress={onAccept} style={[s.btn, s.strong]} accessibilityRole="button" accessibilityLabel={tr('Сделать днём отдыха')}>
            <Text {...fit(1, 0.75)} style={[s.btnText, { color: c.onPrimary }]}>{tr('Сделать днём отдыха')}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onDismiss} style={s.btn} accessibilityRole="button" accessibilityLabel={rest ? tr('Не сейчас') : tr('Понятно')}>
          <Text {...fit(1, 0.75)} style={s.btnText}>{rest ? tr('Не сейчас') : tr('Понятно')}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const makeStyles = (c) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  name: { color: c.text, fontSize: SIZES.text, fontWeight: '700' },
  text: { color: c.text, fontSize: SIZES.body, lineHeight: SIZES.lineHeight },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1, height: SIZES.chip, borderRadius: SIZES.chip / 2, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  strong: { backgroundColor: c.primary, borderColor: c.primary },
  btnText: { color: c.text, fontSize: SIZES.small, fontWeight: '600' },
});
