// Экран запуска поверх 3D-сцены. Сама картинка — в сцене (lib/Scene3D.js): камера выходит
// из облаков и летит к вершине. Здесь только подписи и порядок шагов: сцена готова и данные
// прочитаны → пролёт (первый запуск — долгий, кинематографичный; дальше — быстрое возвращение
// в мир) → на его середине под запуском открывается главный экран → запуск убирается.
// Холст один и тот же — без склеек. При первом запуске после пролёта — приветствие и «Начать».
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fit } from '../fit';
import { SIZES } from '../theme';
import { useColors } from '../colors';
import { tr } from '../i18n';

const GRAPHITE = '#2B2B30';

// phase: loading → sketch → sketched → revealing → half → real (события сцены)
export function SceneLaunch({ phase, ready, firstRun, reveal, onReveal, onDone }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const texts = useRef(new Animated.Value(0)).current;
  const hello = useRef(new Animated.Value(0)).current;
  const [left, setLeft] = useState(false);
  const step = useRef({ revealed: false, shown: false, done: false }).current;
  const at = (p) => ['loading', 'sketch', 'sketched', 'revealing', 'half', 'real'].indexOf(phase) >= ['loading', 'sketch', 'sketched', 'revealing', 'half', 'real'].indexOf(p);

  useEffect(() => {
    if (at('sketch') && !at('revealing')) Animated.timing(texts, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    if (at('revealing')) Animated.timing(texts, { toValue: 0, duration: 500, useNativeDriver: true }).start();
    if (at('sketched') && ready && !step.revealed) { step.revealed = true; reveal(firstRun); }
    if (firstRun) {
      if (at('real')) Animated.timing(hello, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      return;
    }
    if (at('half') && ready && !step.shown) { step.shown = true; if (onReveal) onReveal(); }
    if (at('real') && ready && !step.done) { step.done = true; if (!step.shown) { step.shown = true; if (onReveal) onReveal(); } if (onDone) onDone(); }
  }, [phase, ready, firstRun]);

  const start = () => {
    if (left) return;
    setLeft(true);
    if (onReveal) onReveal();
    if (onDone) onDone();
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={firstRun ? 'auto' : 'none'}>
      <Animated.View style={[s.texts, { bottom: insets.bottom + 72, opacity: texts }]}>
        <Text style={s.name}>Epimely</Text>
        <Text style={s.motto}>{tr('забота о себе')}</Text>
      </Animated.View>
      {firstRun && ready ? (
        <Animated.View style={[s.bottom, { paddingBottom: insets.bottom + 40, opacity: hello }]}>
          <View style={s.plate}>
            <Text style={s.welcome}>{tr('Всё считается на телефоне, данные о здоровье никуда не отправляются.')}</Text>
          </View>
          <Pressable onPress={start} style={({ pressed }) => [s.btn, pressed && s.pressed]}>
            <Text {...fit(1, 0.7)} style={s.btnText}>{tr('Начать')}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  texts: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 4 },
  name: { color: GRAPHITE, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  motto: { color: GRAPHITE, opacity: 0.6, fontSize: SIZES.body, letterSpacing: 0.4 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: SIZES.pad * 1.5, alignItems: 'center', gap: SIZES.pad },
  plate: { backgroundColor: c.card, borderRadius: SIZES.radiusSmall, paddingVertical: 10, paddingHorizontal: 14 },
  welcome: { color: c.sub, fontSize: SIZES.body, textAlign: 'center', lineHeight: SIZES.lineHeight },
  btn: { alignSelf: 'stretch', height: SIZES.button + 4, borderRadius: (SIZES.button + 4) / 2, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  btnText: { color: c.onPrimary, fontSize: SIZES.text + 1, fontWeight: '800' },
});
