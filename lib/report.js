// Отчёты: таблица CSV (для Excel и врача) и страница для PDF. Только выбранный период и только
// показатели по дням — без советов и без личных записей. Файлы создаются на телефоне.
import { LABELS, rangeKeys, byMonth, avg, FIELDS } from './archive';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, d = 0) => (v == null ? '' : (Math.round(v * 10 ** d) / 10 ** d).toString());

export function toCSV(arch, from, to, ru = true) {
  const head = ['date', ...FIELDS.map((f) => LABELS[f][ru ? 0 : 1]), ru ? 'Возраст тела' : 'Body age'];
  const lines = [head.join(';')];
  for (const k of rangeKeys(from, to)) {
    const d = arch[k];
    if (!d) continue;
    lines.push([k, num(d.s), num(d.h, 1), num(d.r), num(d.v), num(d.a), num(d.w), num(d.b, 1)].join(';'));
  }
  return '﻿' + lines.join('\n'); // BOM: Excel откроет кириллицу
}

export function toHTML(arch, from, to, opts = {}) {
  const ru = opts.ru !== false;
  const keys = rangeKeys(from, to);
  const sub = {};
  keys.forEach((k) => { if (arch[k]) sub[k] = arch[k]; });
  const months = byMonth(sub);
  const totals = FIELDS.map((f) => { const a = avg(arch, keys, f); return `<td>${esc(LABELS[f][ru ? 0 : 1])}</td><td>${num(a.value, f === 'h' ? 1 : 0)}</td><td>${a.n}</td>`; });
  const t = (x) => (ru ? x[0] : x[1]);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,Roboto,sans-serif;color:#111;padding:24px}h1{font-size:22px;margin:0 0 4px}p{color:#555;margin:0 0 16px}
table{border-collapse:collapse;width:100%;margin:12px 0 20px;font-size:12px}td,th{border-bottom:1px solid #ddd;padding:6px 4px;text-align:right}td:first-child,th:first-child{text-align:left}
th{color:#555;font-weight:600}.note{font-size:11px;color:#777}</style></head><body>
<h1>Epimely — ${esc(t(['отчёт о здоровье', 'health report']))}</h1>
<p>${esc(from)} — ${esc(to)}${opts.name ? ' · ' + esc(opts.name) : ''}</p>
<table><tr><th>${esc(t(['Показатель', 'Metric']))}</th><th>${esc(t(['Среднее', 'Average']))}</th><th>${esc(t(['Дней с данными', 'Days with data']))}</th></tr>
${totals.map((r) => '<tr>' + r + '</tr>').join('\n')}</table>
<table><tr><th>${esc(t(['Месяц', 'Month']))}</th>${FIELDS.map((f) => `<th>${esc(LABELS[f][ru ? 0 : 1])}</th>`).join('')}<th>${esc(t(['Возраст тела', 'Body age']))}</th></tr>
${months.map((m) => `<tr><td>${m.month}</td>${FIELDS.map((f) => `<td>${num(m[f], f === 'h' ? 1 : 0)}</td>`).join('')}<td>${num(m.b, 1)}</td></tr>`).join('\n')}</table>
<p class="note">${esc(t(['Данные Health Connect, импорта и ручных записей, посчитаны на телефоне. Тренировки — сумма за период. Не медицинский документ.', 'Data from Health Connect, imports and manual entries, computed on the phone. Workouts are totals for the period. Not a medical document.']))}</p>
</body></html>`;
}

// Сохранить и поделиться: kind 'csv' | 'pdf'. Нативные модули подключаются только здесь.
export async function shareReport(kind, arch, from, to, ru = true) {
  const Sharing = require('expo-sharing');
  if (kind === 'pdf') {
    const Print = require('expo-print');
    const { uri } = await Print.printToFileAsync({ html: toHTML(arch, from, to, { ru }) });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Epimely', UTI: 'com.adobe.pdf' });
    return uri;
  }
  const { File, Paths } = require('expo-file-system');
  const f = new File(Paths.cache, `epimely-${from}_${to}.csv`);
  if (f.exists) f.delete();
  f.create();
  f.writeSync(toCSV(arch, from, to, ru));
  await Sharing.shareAsync(f.uri, { mimeType: 'text/csv', dialogTitle: 'Epimely' });
  return f.uri;
}
