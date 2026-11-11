// Звуки природы без файлов: ветер, дождь и гром синтезируются из шума (WebAudio).
// Громкость следует за сценой: сильнее ветер — громче гул, пошёл дождь — слышен дождь,
// вспышка молнии — через мгновение раскат. Музыки нет. Выключается из приложения.
export function makeSound() {
  let ctx = null, wind = null, windFilter = null, rain = null, master = null, on = false;
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
  const loop = (c, buffer, filterType, freq, q) => {
    const src = c.createBufferSource(); src.buffer = buffer; src.loop = true;
    const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(master); src.start();
    return { g, f };
  };
  function start() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const w = loop(ctx, noiseBuffer(ctx, 4, true), 'bandpass', 420, 0.6);
    wind = w.g; windFilter = w.f;
    rain = loop(ctx, noiseBuffer(ctx, 3, false), 'highpass', 2600, 0.4).g;
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
    // каждый кадр: ветер 0..1, дождь 0..1, время (порывы)
    update(windLevel, rainLevel, t) {
      if (!ctx || !on) return;
      const gust = 0.65 + 0.35 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1.7);
      wind.gain.setTargetAtTime((0.05 + windLevel * 0.42) * gust, ctx.currentTime, 0.4);
      windFilter.frequency.setTargetAtTime(300 + windLevel * 500 + gust * 120, ctx.currentTime, 0.5);
      rain.gain.setTargetAtTime(rainLevel * 0.2, ctx.currentTime, 0.8);
    },
    thunder(strength) {
      if (!ctx || !on) return;
      try {
        const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, 3.5, true);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
        const g = ctx.createGain(); const t0 = ctx.currentTime + 0.35 + Math.random() * 1.2; // звук приходит позже вспышки
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1.6 * strength, t0 + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t0 + 3.2);
        src.connect(f); f.connect(g); g.connect(master); src.start(t0); src.stop(t0 + 3.4);
      } catch (e) {}
    },
  };
}
