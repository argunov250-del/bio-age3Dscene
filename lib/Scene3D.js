// 3D-сцена на фоне: горный мир над облаками (three.js в WebView, без интернета — код сцены
// вшит в lib/scene3d/sceneHtml.js, исходники в scene/). Один и тот же холст живёт от
// экрана запуска (выход из облаков и пролёт к вершине) до вкладок: без склеек.
// Управление — через ref: tab(i), drag(d), release(), reveal(), skip().
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SCENE_HTML } from './scene3d/sceneHtml';

export const PAPER = '#F6F4EE'; // цвет облаков: системная заставка и фон до первого кадра

export const Scene3D = forwardRef(function Scene3D({ state, tab = 0, tabs = 4, paused, lite, quick, onEvent }, ref) {
  const web = useRef(null);
  const loaded = useRef(false);
  const run = (js) => { try { if (web.current && loaded.current) web.current.injectJavaScript('try{' + js + '}catch(e){}true;'); } catch (e) {} };
  // Начальное состояние уходит в страницу до её запуска — первый кадр сразу верный.
  const init = useMemo(() => 'window.__INIT=' + JSON.stringify({ state, tab, tabs, lite: !!lite, quick: !!quick }) + ';true;', []);
  useImperativeHandle(ref, () => ({
    tab: (i, instant) => run('SCENE.tab(' + i + ',' + (instant ? 'true' : 'false') + ')'),
    drag: (d) => run('SCENE.drag(' + (Math.round(d * 1000) / 1000) + ')'),
    release: () => run('SCENE.release()'),
    reveal: (long) => run('SCENE.reveal(' + (long ? 'true' : 'false') + ')'),
    skip: () => run('SCENE.skip()'),
  }));
  const json = JSON.stringify(state || {});
  useEffect(() => { run('SCENE.set(' + json + ')'); }, [json]);
  useEffect(() => { run('SCENE.tab(' + tab + ')'); }, [tab]);
  useEffect(() => { run('SCENE.pause(' + (paused ? 'true' : 'false') + ')'); }, [paused]);
  const onMessage = (e) => {
    let m = null;
    try { m = JSON.parse(e.nativeEvent.data); } catch (err) { return; }
    if (!m || !m.type) return;
    if (m.type === 'loaded') {
      loaded.current = true;
      // всё, что изменилось, пока страница грузилась
      run('SCENE.set(' + json + ');SCENE.tab(' + tab + ',true);SCENE.pause(' + (paused ? 'true' : 'false') + ')');
    }
    if (onEvent) onEvent(m.type, m);
  };
  const fail = () => { if (onEvent) onEvent('error', {}); };
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: PAPER }]} pointerEvents="none">
      <WebView
        ref={web}
        source={{ html: SCENE_HTML, baseUrl: 'about:blank' }}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={init}
        onMessage={onMessage}
        onError={fail}
        onRenderProcessGone={fail}
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        textZoom={100}
        style={{ flex: 1, backgroundColor: PAPER }}
      />
    </View>
  );
});
