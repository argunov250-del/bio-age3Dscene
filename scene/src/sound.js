// Звук мира без файлов (WebAudio): ветер, дождь, гром и музыка особых моментов.
// Пространство: ветер слышен с той стороны, откуда дует относительно взгляда камеры, а при
// повороте камеры перетекает между ушами; гром приходит с разных сторон и позже вспышки.
// Музыка — только в особые моменты (первый пролёт, новая вершина): медленный аккордовый фон.
export function makeSound() {
  let ctx = null, master = null, music = null, on = false;
  let wind = null, windFilter = null, windPan = null, gustPan = null, gust = null, rain = null;
  const noiseBuffer = (c, seconds, brown) => {
    const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  };
  const panner = (c) => (c.createStereoPanner ? c.createStereoPanner() : null);
  const loop = (c, buffer, filterType, freq, q) => {
    const src = c.createBufferSource(); src.buffer = buffer; src.loop = true;
    const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    const p = panner(c);
    src.connect(f); f.connect(g);
    if (p) { g.connect(p); p.connect(master); } else g.connect(master);
    src.start();
    return { g, f, p };
  };
  function start() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = 0.0; music.connect(master);
    const w = loop(ctx, noiseBuffer(ctx, 4, true), 'bandpass', 420, 0.6);
    wind = w.g; windFilter = w.f; windPan = w.p;
    const gs = loop(ctx, noiseBuffer(ctx, 5, true), 'bandpass', 900, 1.4); // свист порывов — второй источник
    gust = gs.g; gustPan = gs.p;
    rain = loop(ctx, noiseBuffer(ctx, 3, false), 'highpass', 2600, 0.4).g;
  }
  // медленная последовательность аккордов (ре минор → си-бемоль → фа → до), мягкие синусы с атакой
  function chords(seconds) {
    if (!ctx) return;
    const seq = [[146.8, 220, 293.7, 349.2], [116.5, 233.1, 293.7, 349.2], [174.6, 220, 261.6, 349.2], [130.8, 196, 261.6, 329.6]];
    const t0 = ctx.currentTime + 0.1, step = seconds / seq.length;
    music.gain.cancelScheduledValues(t0); music.gain.setValueAtTime(0, t0); music.gain.linearRampToValueAtTime(0.32, t0 + 2.5);
    music.gain.setValueAtTime(0.32, t0 + seconds - 3); music.gain.linearRampToValueAtTime(0, t0 + seconds);
    seq.forEach((ch, i) => ch.forEach((f, j) => {
      const o = ctx.createOscillator(); o.type = j === 0 ? 'triangle' : 'sine'; o.frequency.value = f;
      o.detune.value = (j - 1.5) * 4;
      const g = ctx.createGain(); const a = t0 + i * step, z = a + step + 1.2;
      g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(j === 0 ? 0.16 : 0.09, a + 1.4); g.gain.linearRampToValueAtTime(0, z);
      const p = panner(ctx); if (p) p.pan.value = (j - 1.5) * 0.35;
      o.connect(g); if (p) { g.connect(p); p.connect(music); } else g.connect(music);
      o.start(a); o.stop(z + 0.1);
    }));
  }
  return {
    enable(v) {
      on = !!v;
      try {
        if (on) { start(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
        if (ctx) master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.6);
      } catch (e) {}
    },
    suspend(v) { try { if (ctx) { if (v) ctx.suspend(); else if (on) ctx.resume(); } } catch (e) {} },
    // каждый кадр: ветер и дождь 0..1, время, куда смотрит камера и откуда дует ветер (радианы)
    update(windLevel, rainLevel, t, camAz = 0, windAz = 0) {
      if (!ctx || !on) return;
      const g = 0.65 + 0.35 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1.7);
      wind.gain.setTargetAtTime((0.05 + windLevel * 0.42) * g, ctx.currentTime, 0.4);
      windFilter.frequency.setTargetAtTime(300 + windLevel * 500 + g * 120, ctx.currentTime, 0.5);
      gust.gain.setTargetAtTime(Math.max(0, g - 0.75) * windLevel * 0.5, ctx.currentTime, 0.3);
      // ветер дует из windAz+π; сторона относительно взгляда: синус разности углов
      const side = Math.sin(windAz + Math.PI - camAz);
      if (windPan) windPan.pan.setTargetAtTime(Math.max(-0.85, Math.min(0.85, -side * 0.8)), ctx.currentTime, 0.3);
      if (gustPan) gustPan.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, -side * 0.9 + Math.sin(t * 0.7) * 0.2)), ctx.currentTime, 0.3);
      rain.gain.setTargetAtTime(rainLevel * 0.2, ctx.currentTime, 0.8);
    },
    thunder(strength) {
      if (!ctx || !on) return;
      try {
        const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, 3.5, true);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
        const g = ctx.createGain(); const t0 = ctx.currentTime + 0.35 + Math.random() * 1.2;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1.6 * strength, t0 + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t0 + 3.2);
        const p = panner(ctx); if (p) p.pan.value = Math.random() * 1.6 - 0.8;
        src.connect(f); f.connect(g); if (p) { g.connect(p); p.connect(master); } else g.connect(master);
        src.start(t0); src.stop(t0 + 3.4);
      } catch (e) {}
    },
    music(kind) { if (!ctx || !on) return; try { chords(kind === 'intro' ? 22 : 14); } catch (e) {} },
  };
}
