// «История и отчёты»: архив по месяцам (сколько лет накопилось), сравнение двух периодов
// (в том числе рабочие дни против выходных по своему графику) и отчёт PDF или CSV.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Card, Note, Segmented, Chips, Button, Body, Msg } from '../ui';
import { SIZES } from '../theme';
import { useColors } from '../colors';
import { tr, RU } from '../i18n';
import { LABELS, FIELDS, byMonth, comparePeriods, rangeKeys, coverage } from '../archive';
import { shareReport } from '../report';
import { dayType, keyOf, shiftKey } from '../schedule';

const fmtV = (f, v) => (v == null ? '—' : f === 'h' ? (Math.round(v * 10) / 10).toString() : Math.round(v).toString());
const sign = (f, d) => (d == null ? '' : (d > 0 ? '+' : d < 0 ? '−' : '±') + fmtV(f, Math.abs(d)));

export function HistoryScreen({ archive, schedule, onBack }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [tab, setTab] = useState('history');
  const [cmp, setCmp] = useState('30');
  const [period, setPeriod] = useState('month');
  const [msg, setMsg] = useState(null);
  const arch = archive || {};
  const today = keyOf(Date.now());
  const cov = coverage(arch);
  const months = useMemo(() => byMonth(arch).reverse(), [arch]);

  const pair = useMemo(() => {
    const last = (n, off = 0) => rangeKeys(shiftKey(today, -n - off + 1), shiftKey(today, -off));
    if (cmp === '30') return { a: last(30), b: last(30, 30), la: tr('последние 30 дней'), lb: tr('30 дней до них') };
    if (cmp === 'month') {
      const d = new Date(); const y = d.getFullYear(), m = d.getMonth();
      const k = (yy, mm, dd) => keyOf(new Date(yy, mm, dd, 12));
      return { a: rangeKeys(k(y, m, 1), today), b: rangeKeys(k(y, m - 1, 1), k(y, m, 0)), la: tr('этот месяц'), lb: tr('прошлый месяц') };
    }
    if (cmp === 'year') return { a: last(365), b: last(365, 365), la: tr('последний год'), lb: tr('год до него') };
    const keys = last(90);
    return { a: keys.filter((k) => dayType(schedule, k) === 'work'), b: keys.filter((k) => dayType(schedule, k) !== 'work'), la: tr('рабочие дни'), lb: tr('выходные и отдых'), work: true };
  }, [cmp, today, schedule]);
  const rows = useMemo(() => comparePeriods(arch, pair.a, pair.b), [arch, pair]);

  const range = () => {
    if (period === 'all') return [cov ? cov.from : today, today];
    const n = { week: 7, month: 30, half: 182, year: 365 }[period];
    return [shiftKey(today, -n + 1), today];
  };
  const share = async (kind) => {
    setMsg(null);
    const [from, to] = range();
    try { await shareReport(kind, arch, from, to, RU); } catch (e) { setMsg(tr('Не получилось создать файл: ') + String((e && e.message) || e)); }
  };

  return (
    <Screen title={tr('История и отчёты')} onBack={onBack}>
      <Segmented options={[['history', tr('История')], ['compare', tr('Сравнение')], ['report', tr('Отчёт')]]} value={tab} onChange={setTab} />
      <Note>{cov ? tr('В архиве') + ': ' + cov.from + ' — ' + cov.to + ' · ' + cov.days + ' ' + tr('дн.') : tr('Архив пока пуст: он пополняется после каждого расчёта.')}</Note>
      <Note>{tr('Health Connect отдаёт последние полгода; архив хранит все дни на телефоне и со временем накапливает годы.')}</Note>

      {tab === 'history' ? (
        <>
          {months.map((m) => (
            <Card key={m.month}>
              <View style={s.mHead}><Text style={s.mTitle}>{m.month}</Text><Text style={s.mDays}>{m.days + ' ' + tr('дн.')}</Text></View>
              <View style={s.grid}>
                {FIELDS.map((f) => (
                  <View key={f} style={s.cell}><Text style={s.val}>{fmtV(f, m[f])}</Text><Text style={s.lbl} numberOfLines={1}>{LABELS[f][RU ? 0 : 1]}</Text></View>
                ))}
                <View style={s.cell}><Text style={s.val}>{m.b == null ? '—' : (Math.round(m.b * 10) / 10).toString()}</Text><Text style={s.lbl}>{tr('Возраст тела')}</Text></View>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {tab === 'compare' ? (
        <>
          <Chips options={[['30', tr('30 дней')], ['month', tr('Месяц')], ['year', tr('Год')], ['work', tr('Работа и отдых')]]} value={cmp} onChange={(v) => setCmp(v || '30')} />
          <Card>
            <View style={s.row}><Text style={[s.cName, s.th]} /><Text style={[s.cVal, s.th]} numberOfLines={2}>{pair.la}</Text><Text style={[s.cVal, s.th]} numberOfLines={2}>{pair.lb}</Text><Text style={[s.cVal, s.th]}>Δ</Text></View>
            {rows.map((r) => (
              <View key={r.f} style={s.row}>
                <Text style={s.cName} numberOfLines={2}>{LABELS[r.f][RU ? 0 : 1]}</Text>
                <Text style={s.cVal}>{fmtV(r.f, r.a)}</Text>
                <Text style={s.cVal}>{fmtV(r.f, r.b)}</Text>
                <Text style={[s.cVal, { color: c.text, fontWeight: '700' }]}>{sign(r.f, r.delta)}</Text>
              </View>
            ))}
            <Note>{tr('Дней с данными') + ': ' + (rows[0] ? rows[0].na + ' / ' + rows[0].nb : '0') + '. ' + tr('Тренировки — сумма за период.') + (pair.work && !pair.a.length ? ' ' + tr('Чтобы сравнить работу и отдых, задай график в профиле.') : '')}</Note>
            <Note>{tr('Разница показывает, что изменилось, но не доказывает причину: условия работы, болезнь или смена часов тоже влияют.')}</Note>
          </Card>
        </>
      ) : null}

      {tab === 'report' ? (
        <Card>
          <Body sub>{tr('Отчёт за период: средние и разбивка по месяцам. Только показатели — без советов и личных записей. Подходит, чтобы показать врачу или тренеру.')}</Body>
          <Chips options={[['week', tr('Неделя')], ['month', tr('Месяц')], ['half', tr('Полгода')], ['year', tr('Год')], ['all', tr('Всё')]]} value={period} onChange={(v) => setPeriod(v || 'month')} />
          <Button title={tr('Отчёт PDF')} onPress={() => share('pdf')} />
          <Button secondary title={tr('Таблица CSV')} onPress={() => share('csv')} />
          {msg ? <Msg bad>{msg}</Msg> : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const makeStyles = (c) => StyleSheet.create({
  mHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  mTitle: { color: c.text, fontSize: SIZES.text, fontWeight: '700' },
  mDays: { color: c.sub, fontSize: SIZES.small },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  cell: { width: '33.3%' },
  val: { color: c.text, fontSize: SIZES.text + 2, fontWeight: '700' },
  lbl: { color: c.sub, fontSize: SIZES.tiny },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.line },
  th: { color: c.sub, fontSize: SIZES.tiny, fontWeight: '600' },
  cName: { flex: 1.4, color: c.text, fontSize: SIZES.small },
  cVal: { flex: 1, color: c.sub, fontSize: SIZES.small, textAlign: 'right' },
});
