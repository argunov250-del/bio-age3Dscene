// Экран поверх горного мира, когда личные данные закрыты:
//  • lock — приложение заблокировано: нужен отпечаток, лицо или код телефона;
//  • guest — гостевой режим: телефон можно дать в руки, видны только горы.
// Показатели здоровья и советы Хирона в это время не рисуются вовсе.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './ui';
import { SIZES } from './theme';
import { useColors } from './colors';
import { tr } from './i18n';

export function Shield({ mode, onUnlock }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const guest = mode === 'guest';
  return (
    <View style={[StyleSheet.absoluteFill, s.wrap, { paddingBottom: insets.bottom + SIZES.pad * 2 }]} accessibilityLabel={'shield-' + mode}>
      <View style={s.card}>
        <Text style={s.title}>{guest ? tr('Гостевой режим') : 'Epimely'}</Text>
        <Text style={s.sub}>{guest ? tr('Показатели и советы скрыты. Видны только горы.') : tr('Данные о здоровье закрыты.')}</Text>
        <Button title={guest ? tr('Выйти из гостевого режима') : tr('Разблокировать')} onPress={onUnlock} />
      </View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: { justifyContent: 'flex-end', paddingHorizontal: SIZES.pad },
  card: { backgroundColor: c.card, borderRadius: SIZES.radius, borderWidth: c.border, borderColor: c.line, padding: SIZES.pad * 1.25, gap: 10 },
  title: { color: c.text, fontSize: SIZES.title, fontWeight: '800', textAlign: 'center' },
  sub: { color: c.sub, fontSize: SIZES.body, textAlign: 'center', lineHeight: SIZES.lineHeight, marginBottom: 4 },
});
