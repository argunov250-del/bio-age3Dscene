// Свободный полёт и карта вершин поверх 3D-мира. Интерфейс приложения уходит.
//  • полёт: джойстик слева — вперёд/назад и вбок, кнопки ▲▼ — высота, жест справа — поворот взгляда;
//  • карта: вид сверху на оба хребта, нажатие на маркер — карточка вершины и «Пролететь»;
//  • снимок и ролик: только горы, без данных о здоровье.
import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, PanResponder, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SIZES } from './theme';
import { useColors } from './colors';
import { tr } from './i18n';
import { peakName } from './PeaksCard';

const R = 54; // радиус джойстика

function Joystick({ onMove, s }) {
  const [knob, setKnob] = useState([0, 0]);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => {
      const d = Math.hypot(g.dx, g.dy), k = d > R ? R / d : 1;
      const x = g.dx * k, y = g.dy * k;
      setKnob([x, y]);
      onMove(-y / R, x / R);
    },
    onPanResponderRelease: () => { setKnob([0, 0]); onMove(0, 0); },
    onPanResponderTerminate: () => { setKnob([0, 0]); onMove(0, 0); },
  }), [onMove]);
  return (
    <View style={s.joy} {...pan.panHandlers} accessibilityLabel="joystick">
      <View style={[s.knob, { transform: [{ translateX: knob[0] }, { translateY: knob[1] }] }]} />
    </View>
  );
}

export function ExploreMode({ mode, peaks, scene, canRecord, busy, onMode, onShot, onClip, onClose }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const [sel, setSel] = useState(null);
  const up = useRef(0), mv = useRef([0, 0]);
  // в сцену — не чаще 20 раз в секунду; остановка уходит сразу
  const sent = useRef(0);
  const send = () => {
    const now = Date.now(), stop = !mv.current[0] && !mv.current[1] && !up.current;
    if (!stop && now - sent.current < 50) return;
    sent.current = now;
    if (scene) scene.move(mv.current[0], mv.current[1], up.current);
  };
  const box = useRef({ w: 1, h: 1 });
  const look = useMemo(() => {
    let last = [0, 0], moved = false;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { last = [0, 0]; moved = false; },
      onPanResponderMove: (_, g) => {
        const dx = (g.dx - last[0]) / box.current.w, dy = (g.dy - last[1]) / box.current.h;
        last = [g.dx, g.dy];
        if (Math.abs(g.dx) + Math.abs(g.dy) > 8) moved = true;
        if (scene) scene.look(dx, dy);
      },
      onPanResponderRelease: (e) => {
        if (moved || !scene) return;
        // короткое нажатие — выбрать маркер вершины
        scene.pick(e.nativeEvent.pageX / box.current.w, e.nativeEvent.pageY / box.current.h);
      },
    });
  }, [scene]);
  const all = peaks ? [...peaks.discipline, ...peaks.constancy] : [];
  const picked = sel ? all.find((p) => p.id === sel) : null;
  ExploreMode.onPick = (id) => setSel(id); // сцена прислала выбранный маркер
  const Btn = ({ title, onPress, wide, on }) => (
    <Pressable onPress={onPress} style={[s.btn, wide && { paddingHorizontal: 16 }, on && { backgroundColor: c.primary }]} accessibilityRole="button" accessibilityLabel={title} hitSlop={6}>
      <Text style={[s.btnText, on && { color: c.onPrimary }]}>{title}</Text>
    </Pressable>
  );
  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => { box.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }} accessibilityLabel={'explore-' + mode}>
      <View style={StyleSheet.absoluteFill} {...look.panHandlers} />
      <View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Btn wide title={tr('Полёт')} on={mode === 'fly'} onPress={() => onMode('fly')} />
        <Btn wide title={tr('Карта вершин')} on={mode === 'map'} onPress={() => onMode('map')} />
        <View style={{ flex: 1 }} />
        <Btn title="✕" onPress={onClose} />
      </View>
      {picked ? (
        <View style={[s.card, { bottom: insets.bottom + (mode === 'fly' ? 170 : 90) }]}>
          <Text style={s.kicker}>{picked.ridge === 'discipline' ? tr('Хребет дисциплины') : tr('Хребет постоянства')}</Text>
          <Text style={s.name}>{peakName(picked)}</Text>
          <Text style={s.sub}>{picked.need + ' ' + tr('дн.') + ' · ' + (picked.unlocked ? tr('открыта') + ' ' + picked.at : tr('осталось') + ' ' + picked.left + ' ' + tr('дн.') + ' · ' + tr('скрыта облаками'))}</Text>
          <View style={s.row}>
            <Btn wide title={tr('Пролететь')} onPress={() => { if (scene) scene.flyTo(picked.id); onMode('fly', true); }} />
            <Btn title={tr('Закрыть')} onPress={() => setSel(null)} />
          </View>
        </View>
      ) : null}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        {mode === 'fly' ? <Joystick s={s} onMove={(f, sd) => { mv.current = [f, sd]; send(); }} /> : <View />}
        <View style={s.side} pointerEvents="box-none">
          {mode === 'fly' ? (
            <>
              <Pressable onPressIn={() => { up.current = 1; send(); }} onPressOut={() => { up.current = 0; send(); }} style={s.btn} accessibilityRole="button" accessibilityLabel={tr('Выше')}><Text style={s.btnText}>▲</Text></Pressable>
              <Pressable onPressIn={() => { up.current = -1; send(); }} onPressOut={() => { up.current = 0; send(); }} style={s.btn} accessibilityRole="button" accessibilityLabel={tr('Ниже')}><Text style={s.btnText}>▼</Text></Pressable>
            </>
          ) : null}
          <Btn title={busy === 'shot' ? '…' : tr('Снимок')} onPress={onShot} />
          {canRecord ? <Btn title={busy === 'clip' ? tr('Запись…') : tr('Ролик')} onPress={onClip} /> : null}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', gap: 8, paddingHorizontal: SIZES.pad },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: SIZES.pad },
  side: { gap: 8, alignItems: 'flex-end' },
  btn: { minWidth: 44, height: 40, borderRadius: 20, paddingHorizontal: 12, backgroundColor: c.card, borderWidth: c.border, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: c.text, fontSize: SIZES.small, fontWeight: '700' },
  joy: { width: R * 2 + 24, height: R * 2 + 24, borderRadius: R + 12, backgroundColor: c.card + 'AA', borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  knob: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.primary, opacity: 0.85 },
  card: { position: 'absolute', left: SIZES.pad, right: SIZES.pad, backgroundColor: c.card, borderRadius: SIZES.radius, borderWidth: c.border, borderColor: c.line, padding: SIZES.pad, gap: 4 },
  kicker: { color: c.accent, fontSize: SIZES.small, fontWeight: '700' },
  name: { color: c.text, fontSize: SIZES.title, fontWeight: '800' },
  sub: { color: c.sub, fontSize: SIZES.small },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
