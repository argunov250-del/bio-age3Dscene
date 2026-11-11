import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StatusBar, View, AppState, Appearance, Linking, Animated, Easing, PanResponder, Dimensions, StyleSheet } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBoundary } from './lib/ErrorScreen';
import { applyTheme, resolveTheme } from './lib/theme';
import { ColorsContext } from './lib/colors';
import { tr, RU, setLang } from './lib/i18n';
import { loadProfile, saveProfile, loadResult, saveResult, purgeLabs, loadEntries, saveEntries, loadUnlocks, saveUnlocks, addOpen, loadDevMode, saveDevMode } from './lib/storage';
import { planEntries, lastPlanNight } from './lib/sleepPlan';
import { applyManual } from './lib/manual';
import { sdkStatus, init, grantedTypes, askPermissions, askBackground, RECORD_TYPES, EXTRA_TYPES, CYCLE_TYPES } from './lib/health';
import { loadDataset } from './lib/metrics';
import { compute } from './lib/compute';
import { buildDetail } from './lib/details';
import { TabBar, FadeIn } from './lib/ui';
import { ScreenIn } from './lib/motion';
import { IconHome, IconActivity, IconProfile, IconGrowth } from './lib/icons';
import { LaunchScreen } from './lib/screens/LaunchScreen';
import { SceneLaunch } from './lib/screens/SceneLaunch';
import { Scene3D, PAPER } from './lib/Scene3D';
import { sceneState } from './lib/sceneState';
import { loadPeaks, updatePeaks } from './lib/peaks';
import { PeakUnlock } from './lib/PeaksCard';
import { loadFeedback, saveFeedback, pickTip, isAccepted } from './lib/chironFeedback';
import { CalmMode } from './lib/CalmMode';
import { ExploreMode } from './lib/ExploreMode';
import { collect, saveAndShare } from './lib/media';
import { Shield } from './lib/Shield';
import { unlock, setScreenGuard } from './lib/appLock';
import { normalize as normSchedule, bioKey, isRest as schedIsRest, setOverride } from './lib/schedule';
import { loadHabits, saveHabits, toggleDone } from './lib/habits';
import { restSuggestion } from './lib/restAdvisor';
import { ScheduleScreen } from './lib/screens/ScheduleScreen';
import { HabitsScreen } from './lib/screens/HabitsScreen';
import { HistoryScreen } from './lib/screens/HistoryScreen';
import { SimulatorScreen } from './lib/screens/SimulatorScreen';
import { loadArchive, updateArchive } from './lib/archive';
import { loadExperiments, saveExperiments, startExperiment, stopExperiment } from './lib/experiments';
import { addHabit, normalizeHabits } from './lib/habits';
import { reduceMotion } from './lib/motion';
import { SetupScreen } from './lib/screens/SetupScreen';
import { PermissionsScreen } from './lib/screens/PermissionsScreen';
import { NoHealthConnectScreen } from './lib/screens/NoHealthConnectScreen';
import { HomeScreen } from './lib/screens/HomeScreen';
import { GrowthScreen } from './lib/screens/GrowthScreen';
import { updateGrowth, loadGrowth, awardEvent } from './lib/growth';
import { loadActivities, subscribe as subscribeActivities } from './lib/activities';
import { useWater } from './lib/useWater';
import { useDayPlan } from './lib/useDayPlan';
import { MetricsScreen } from './lib/screens/MetricsScreen';
import { WorkoutsScreen } from './lib/screens/WorkoutsScreen';
import { ProfileScreen } from './lib/screens/ProfileScreen';
import { DetailScreen } from './lib/screens/DetailScreen';
import { TipsScreen } from './lib/screens/TipsScreen';
import { SleepScheduleScreen } from './lib/screens/SleepScheduleScreen';
import { LogScreen } from './lib/screens/LogScreen';
import { CycleScreen } from './lib/screens/CycleScreen';
import { AboutDataScreen } from './lib/screens/AboutDataScreen';
import { ImportScreen } from './lib/screens/ImportScreen';
import { AchievementsScreen } from './lib/screens/AchievementsScreen';
import { evaluate, withUnlocks } from './lib/achievements';
import { RecapScreen } from './lib/screens/RecapScreen';
import { weekRecap } from './lib/recap';
import { ambienceAt, DAY } from './lib/ambience';
import { scheduleReminders, askNotifications } from './lib/reminders';
import { checkGoals, notifyRankUp } from './lib/notify';
import { applyIcon } from './lib/appIcon';

// Фоновая задача: defineTask должен выполниться при загрузке бандла (в т.ч. при «безголовом» запуске
// системой), но сбой нативного модуля не должен убить старт приложения — поэтому require в try/catch.
// Фоновая задача временно выключена: сборка с expo-task-manager/expo-background-task падала при запуске.
// Чтобы включить: вернуть пакеты в CI и строку `background = require('./lib/background')` в try/catch.
const background = null;
const syncGoalsTask = (p) => { try { return background ? background.syncGoalsTask(p) : undefined; } catch (e) { return undefined; } };
// Виджеты домашнего экрана: задача регистрируется при загрузке бандла (она же работает при «безголовом» запуске
// от системы). Нативный модуль подключается в try/catch: его сбой не должен ломать запуск приложения.
try { require('./lib/widgets/register').registerWidgets(); } catch (e) {}
import { setHaptics, light, success } from './lib/haptics';
import { setLite, OLD_ANDROID } from './lib/perf';
import { getWeather } from './lib/weather';
import { setCoachWeather } from './lib/coachBrain';
import { loadImported, saveImported, dumpStore, restoreStore } from './lib/importer';
import { dayKey } from './lib/metrics';
import { recommend } from './lib/recommend';
import { setChironOpener } from './lib/chiron';
import { DebugScreen } from './lib/screens/DebugScreen';

// Четыре вкладки. У Хирона своей вкладки нет: он живёт карточками на экранах
// (совет дня, задания, арки) и раскрывается в «Совет на сегодня».
const TABS = [
  { key: 'home', get title() { return tr('Главная'); }, Icon: IconHome },
  { key: 'metrics', get title() { return tr('Здоровье'); }, Icon: IconActivity },
  { key: 'growth', get title() { return tr('Прогресс'); }, Icon: IconGrowth },
  { key: 'profile', get title() { return tr('Профиль'); }, Icon: IconProfile },
];
const TAB_KEYS = TABS.map((t) => t.key);
// 3D-сцена на фоне (горный мир): карточки вкладок — полупрозрачное стекло, а между сценой и интерфейсом —
// дымка в цвет темы, чтобы текст читался при любой погоде.
const SCENE_CARD = { light: '#FFFFFFE3', dark: '#1A1C1FDE' };
const SCENE_CARD_STORM = { light: '#FFFFFFF2', dark: '#1A1C1FF0' }; // гроза и туман: стекло плотнее, текст читается
const SCENE_VEIL = 0.4;
const SCENE_VEIL_CLEAR = 0.06; // «Главная» со свёрнутой панелью: почти чистый пейзаж
const SCENE_LOAD_MS = 6000; // страница сцены не ответила за это время — обычный экран запуска и фон
const SCENE_BUILD_MS = 25000; // страница ответила, но мир не собрался за это время — тоже запасной путь

function Main() {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState('intro');
  const [tab, setTab] = useState('home');
  // «Главная» открывается чистым пейзажем; свайп вверх раскрывает панель с показателями.
  const [homeOpen, setHomeOpen] = useState(false);
  // Вершины за регулярность, ответы на советы Хирона, режим спокойствия, блокировка и гостевой режим.
  const [peaks, setPeaks] = useState(null);
  const [peakShow, setPeakShow] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [calm, setCalm] = useState(false);
  const [explore, setExplore] = useState(null); // null | 'fly' | 'map'
  const [shooting, setShooting] = useState(null);
  const [canRecord, setCanRecord] = useState(false);
  const [locked, setLocked] = useState(false);
  const [guest, setGuest] = useState(false);
  const leftAt = useRef(0);
  const [habits, setHabits] = useState(null);
  useEffect(() => { loadHabits().then(setHabits).catch(() => {}); }, []);
  const saveH = useCallback((h) => { setHabits(h); saveHabits(h); }, []);
  // Долгий архив по дням и личные эксперименты.
  const [archive, setArchive] = useState({});
  const [experiments, setExperiments] = useState([]);
  useEffect(() => { loadArchive().then(setArchive).catch(() => {}); loadExperiments().then(setExperiments).catch(() => {}); }, []);
  const saveE = useCallback((l) => { setExperiments(l); saveExperiments(l); }, []);
  useEffect(() => { loadPeaks().then((p) => { if (p) setPeaks((cur) => cur || p); }).catch(() => {}); loadFeedback().then(setFeedback).catch(() => {}); }, []);
  // Подробный экран: { key, arg, from } — палитра берётся от вкладки, с которой открыли.
  const [detail, setDetail] = useState(null);
  const tabIndex = TAB_KEYS.indexOf(tab);
  const [ready, setReady] = useState(false);
  const [splash, setSplash] = useState(true);
  // 3D-сцена: жива с первого кадра запуска; если WebView не смог её показать — прежний запуск и фон.
  const sceneRef = useRef(null);
  const [sceneOk, setSceneOk] = useState(true);
  const [scenePhase, setScenePhase] = useState('loading');
  const [sceneAlive, setSceneAlive] = useState(false); // страница сцены запустилась и строит мир
  const [appActive, setAppActive] = useState(true);
  const uiIn = useRef(new Animated.Value(0)).current; // интерфейс проявляется поверх уже живой сцены
  const swipeX = useRef(new Animated.Value(0)).current;
  const onSceneEvent = useCallback((type, m) => {
    if (type === 'error') { setSceneOk(false); return; }
    if (type === 'alive') { setSceneAlive(true); return; }
    if (type === 'loaded' && m && m.canRecord) setCanRecord(true);
    if (type === 'pick') { if (ExploreMode.onPick && m && m.id) ExploreMode.onPick(m.id); return; }
    if (type === 'shot' || type === 'clip') {
      if (m && m.error) { setShooting(null); return; }
      const done = collect(m);
      if (done) {
        setShooting(null);
        saveAndShare(done, 'epimely-' + (type === 'clip' ? 'video' : 'photo') + '-' + Date.now()).catch(() => {});
      }
      return;
    }
    if (type === 'loaded') setScenePhase((p) => (p === 'loading' ? 'sketch' : p));
    else if (['sketched', 'revealing', 'half', 'real'].includes(type)) setScenePhase(type);
  }, []);
  useEffect(() => {
    if (scenePhase !== 'loading' || !sceneOk) return undefined;
    // страница жива — ждём сборки мира дольше; не ответила вовсе — запасной запуск
    const id = setTimeout(() => setSceneOk(false), sceneAlive ? SCENE_BUILD_MS : SCENE_LOAD_MS);
    return () => clearTimeout(id);
  }, [scenePhase, sceneOk, sceneAlive]);
  useEffect(() => { if (!sceneOk) uiIn.setValue(1); }, [sceneOk, uiIn]);
  const [profile, setProfile] = useState(null);
  // Тема (светлая/тёмная) из профиля: применяется сразу, на всём дереве (ключ ниже перерисовывает экраны).
  const [sysScheme, setSysScheme] = useState(() => { try { return Appearance.getColorScheme(); } catch (e) { return 'light'; } });
  useEffect(() => {
    try {
      const sub = Appearance.addChangeListener(({ colorScheme }) => setSysScheme(colorScheme));
      return () => { try { sub && sub.remove && sub.remove(); } catch (e) {} };
    } catch (e) { return undefined; }
  }, []);
  const themeName = resolveTheme(profile && profile.theme, sysScheme);
  const colors = applyTheme(themeName);
  const [sdk, setSdk] = useState('');
  const [granted, setGranted] = useState(new Set());
  const [dataset, setDataset] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState([]);
  const entriesRef = useRef([]);
  const [logType, setLogType] = useState(null);
  // Пока идёт приветствие, проверки Health Connect уже работают в фоне;
  // куда идти дальше, запоминаем и переходим, когда приветствие закончится.
  const introDone = useRef(false);
  const pendingRoute = useRef('home');
  const go = useCallback((route) => {
    if (introDone.current) setScreen(route);
    else pendingRoute.current = route;
  }, []);

  // Импорт из Apple Health (файл в памяти приложения): дополняет Health Connect.
  const importedRef = useRef(null);
  const [importInfo, setImportInfo] = useState(null);
  // Достижения: считаются из расчёта, открытые запоминаются с датой.
  const [unlocks, setUnlocks] = useState(null); // null — ещё не прочитаны
  // Рост: уровень, опыт и ступень образа; считается после каждого расчёта.
  const [growth, setGrowth] = useState(null);
  useEffect(() => { let alive = true; Promise.resolve(loadGrowth()).then((g) => { if (alive && g) setGrowth((cur) => cur || g); }).catch(() => {}); return () => { alive = false; }; }, []);
  // Новый ранг приходит событием расчёта; запоминаем, пока вставку не увидели на вкладке «Рост»,
  // и шлём одну локальную нотификацию (в лимите уведомлений о целях).
  const [rankUp, setRankUp] = useState(null);
  const takeGrowth = useCallback((g) => {
    if (!g) return;
    setGrowth(g);
    const ev = Array.isArray(g.events) ? g.events.find((e) => e && e.type === 'rankUp' && e.rank) : null;
    if (ev) { setRankUp(ev.rank); notifyRankUp(profileRef.current, ev.rank); }
  }, []);
  // Ежедневные активности (вода, витамины, дыхание, пауза): локальные, пересчёт роста после каждого изменения.
  const [activities, setActivities] = useState({});
  const resultRef = useRef(null);
  const [opens, setOpens] = useState(null);
  const water = useWater(profile);

  // Открытия приложения — для сна по расписанию (открыл ночью = проснулся).
  const opensRef = useRef([]);

  // Отладка скрыта, пока не включён режим разработчика (7 нажатий на версию в профиле) или это dev-сборка.
  const isDevBuild = typeof __DEV__ !== 'undefined' && !!__DEV__;
  const [devSaved, setDevSaved] = useState(false);
  const devMode = isDevBuild || devSaved;
  useEffect(() => { loadDevMode().then(setDevSaved); }, []);
  const setDevMode = useCallback((on) => { setDevSaved(on); saveDevMode(on); }, []);
  const profileRef = useRef(null);

  const load = useCallback(async (prof, g) => {
    setLoading(true);
    setError('');
    try {
      // Ручные записи важнее ночей по расписанию; Health Connect важнее и тех, и других.
      const plan = planEntries(prof && prof.sleepPlan, opensRef.current);
      const ds = applyManual(await loadDataset(g, prof, undefined, importedRef.current), [...entriesRef.current, ...plan]);
      const r = compute(ds, prof);
      setDataset(ds);
      scheduleReminders(prof, ds);
      setResult(r);
      saveResult(r);
      updateArchive(r).then(setArchive).catch(() => {});
    } catch (e) {
      setError(tr('Ошибка: ') + String((e && e.message) || e));
    }
    setLoading(false);
  }, []);

  // Проверка Health Connect и разрешений, затем загрузка.
  const start = useCallback(async (prof) => {
    setLoading(true);
    const st = await sdkStatus();
    setSdk(st);
    // Без Health Connect приложение работает на ручных записях.
    const manualOnly = () => {
      setGranted(new Set());
      go('home');
      load(prof, new Set());
    };
    if (st !== 'ok') {
      if (prof.skipHC) return manualOnly();
      setLoading(false);
      return go('nohc');
    }
    try {
      await init();
      const g = await grantedTypes();
      setGranted(g);
      if (!RECORD_TYPES.some((t) => g.has(t))) {
        if (prof.skipHC) return manualOnly();
        setLoading(false);
        return go('permissions');
      }
      go('home');
      load(prof, g);
    } catch (e) {
      setError(tr('Ошибка: ') + String((e && e.message) || e));
      setLoading(false);
      go('home');
    }
  }, [go, load]);

  // Профиль и последний расчёт — сразу при запуске, пока крутится экран загрузки.
  // Старые результаты анализов (раздел удалён) стираем с телефона.
  useEffect(() => {
    purgeLabs();
    const imp = loadImported();
    importedRef.current = imp;
    if (imp) setImportInfo({ at: imp.at, summary: imp.summary });
    loadUnlocks().then((u) => setUnlocks(u || {}));
    Promise.all([loadProfile(), loadResult(), loadEntries(), addOpen()]).then(([p, r, e, opens]) => {
      opensRef.current = opens;
      setOpens(opens);
      profileRef.current = p;
      if (p) setLang(p.lang); // язык — до первой отрисовки данных профиля
      setProfile(p);
      if (r) setResult(r);
      entriesRef.current = e;
      setEntries(e);
      setReady(true);
      if (p) { start(p); syncGoalsTask(p); }
    });
  }, [start]);

  const achievements = useMemo(
    () => withUnlocks(evaluate(result, profile, entries, { imported: !!importInfo }), unlocks || {}),
    [result, profile, entries, importInfo, unlocks],
  );
  // Атмосфера по времени суток и сезону: пересчитывается раз в 5 минут.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5 * 60000);
    return () => clearInterval(id);
  }, []);
  // Погода (если включена в профиле): раз в 30 минут, с кэшем; без сети — календарь.
  const [weather, setWeather] = useState(null);
  const weatherOn = !!(profile && profile.weather && profile.weather.on);
  useEffect(() => {
    if (!weatherOn) { setWeather(null); return; }
    let alive = true;
    getWeather(profile.weather).then((w) => { if (alive) setWeather(w); });
    return () => { alive = false; };
  }, [weatherOn, profile, now]);
  useEffect(() => { setCoachWeather(weather); }, [weather]);
  const amb = useMemo(() => {
    const p = profile || {};
    const a = p.ambience === 'day' ? DAY : ambienceAt(now);
    const season = a.season || ambienceAt(now).season;
    // Эффект: по погоде за окном, а без неё — по сезону.
    let fx = season;
    if (weather) {
      fx = { rain: 'rain', storm: 'storm', snow: 'snow', fog: 'fog', clouds: 'clouds' }[weather.kind]
        || (!weather.day ? 'stars' : season === 'autumn' ? 'leaves' : season === 'spring' ? 'spring' : null);
    }
    const gloomy = weather && ['rain', 'storm', 'fog', 'clouds'].includes(weather.kind);
    return { ...a, dim: a.dim + (gloomy ? 0.08 : 0), season: p.seasonFx === false ? null : fx };
  }, [profile, now, weather]);
  const recap = useMemo(() => weekRecap(result, achievements.list), [result, achievements]);
  // Главный совет Хирона для карточки на «Здоровье» (правила lib/recommend.js, без модели).
  // Отклонённые и отложенные советы пропускаются (lib/chironFeedback.js).
  const chironTip = useMemo(() => { try { return result ? pickTip(recommend(result, profile), feedback) : null; } catch (e) { return null; } }, [result, profile, feedback]);
  const onTipAnswer = useCallback((id, s) => { if (s === 'accepted') success(); else light(); saveFeedback(feedback, id, s).then(setFeedback); }, [feedback]);
  setLite(profile && profile.lite); // облегчённый режим читается при отрисовке
  useEffect(() => { setHaptics(profile && profile.haptics); }, [profile]);

  useEffect(() => {
    if (!unlocks || !achievements.fresh.length) return; // не перезаписываем даты, пока не прочитаны
    if (Object.keys(unlocks).length) success(); // вибрация на новое достижение (не при первом запуске)
    setUnlocks(achievements.unlocked);
    saveUnlocks(achievements.unlocked);
  }, [achievements, unlocks]);

  // Уведомления о целях: после каждого расчёта (при первом запуске только запоминаем состояние).
  useEffect(() => {
    if (!unlocks || !result) return;
    const fresh = achievements.list.filter((x) => achievements.fresh.includes(x.id)).map((x) => ({ id: x.id, title: x.title }));
    checkGoals(profile, result, fresh);
    Promise.resolve(updateGrowth(result, profile, Date.now(), achievements.fresh)).then(takeGrowth).catch(() => {});
  }, [result, achievements, unlocks]);
  useEffect(() => { resultRef.current = result; }, [result]);
  // Снимок для виджетов: после каждого расчёта и пересчёта роста (с небольшой задержкой, чтобы не дёргать систему подряд).
  useEffect(() => {
    if (!result) return undefined;
    const id = setTimeout(() => {
      try { require('./lib/widgets/sync').syncWidgets({ result, profile, growth, lang: RU ? 'ru' : 'en' }); } catch (e) {}
    }, 1000);
    return () => clearTimeout(id);
  }, [result, growth, profile]);
  // Вода/витамины/дыхание/пауза изменились: обновить карточки и пересчитать опыт (работает и без данных Health Connect).
  useEffect(() => {
    let alive = true;
    let timer = null;
    loadActivities().then((m) => { if (alive) setActivities(m); }).catch(() => {});
    const unsub = subscribeActivities((m) => {
      setActivities(m);
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!alive) return;
        Promise.resolve(updateGrowth(resultRef.current, profileRef.current, Date.now(), [])).then((g) => { if (alive) takeGrowth(g); }).catch(() => {});
      }, 300);
    });
    return () => { alive = false; clearTimeout(timer); unsub(); };
  }, [takeGrowth]);
  // Маркеры вершин в 3D-мире: открытые, следующая цель и закрытые (за облаками).
  useEffect(() => {
    if (!peaks || !sceneRef.current) return;
    const list = [];
    ['discipline', 'constancy'].forEach((r) => (peaks[r] || []).forEach((p, i) => list.push({ id: p.id, ridge: r, index: i, unlocked: p.unlocked, next: !!(r === 'discipline' ? peaks.nextDiscipline && peaks.nextDiscipline.id === p.id : peaks.nextConstancy && peaks.nextConstancy.id === p.id) })));
    sceneRef.current.peaks(list);
  }, [peaks, scenePhase]);
  useEffect(() => { if (explore && sceneRef.current) sceneRef.current.explore(explore); }, [explore]);
  // Блокировка: при запуске и после возвращения из фона (дольше 20 секунд).
  const lockOn = !!(profile && profile.lock);
  const lockArmed = useRef(false);
  useEffect(() => { if (lockOn && !lockArmed.current) { lockArmed.current = true; setLocked(true); } if (!lockOn) { lockArmed.current = false; setLocked(false); } }, [lockOn]);
  useEffect(() => { setScreenGuard(lockOn || !!(profile && profile.noShots)); }, [lockOn, profile]);
  const doUnlock = useCallback(async () => {
    if (lockOn && !(await unlock(tr('Разблокировать')))) return;
    setLocked(false); setGuest(false);
  }, [lockOn]);
  // Свой календарь смен и вахт (профиль) и «биологические сутки».
  const schedule = useMemo(() => normSchedule(profile && profile.schedule), [profile]);
  const todayKey = bioKey(schedule, now.getTime());
  const saveSchedule = useCallback(async (sch) => {
    const p = { ...profileRef.current, schedule: sch };
    profileRef.current = p;
    setProfile(p);
    await saveProfile(p);
  }, []);
  // Совет Хирона отдохнуть или облегчить день: по графику, сну и нагрузке; применяется только после «да».
  const rest = useMemo(() => {
    const sc = result && result.scores;
    const ready = sc && sc.readiness && sc.readiness.status === 'ok' ? sc.readiness.score : null;
    const norm = sc && sc.sleep ? sc.sleep.norm : null;
    const nights = (result && result.series && result.series.sleep) || [];
    let poor = 0;
    for (let i = nights.length - 1; i >= 0 && i >= nights.length - 3; i--) { if (norm && nights[i] && nights[i].v >= 1 && nights[i].v < norm - 0.5) poor++; else break; }
    return restSuggestion({ sched: schedule, key: todayKey, tired: ready != null && ready < 45, sleepPoor: poor > 0, poorNights: poor, dismissed: profile && profile.restDismissed });
  }, [result, schedule, todayKey, profile]);
  const acceptRest = useCallback(() => { success(); saveSchedule(setOverride(schedule, todayKey, 'rest')); }, [schedule, todayKey, saveSchedule]);
  const dismissRest = useCallback(() => { light(); onSettingsRef.current({ restDismissed: todayKey }); }, [todayKey]);
  const onSettingsRef = useRef(null);
  // Текущий эксперимент и действия с ним.
  const experiment = experiments.find((x) => x.status === 'running') || null;
  const experimentAction = useCallback((act) => {
    if (!experiment) return;
    if (act === 'keep') {
      let h = normalizeHabits(habits);
      if (experiment.sleepH != null && !h.list.some((q) => q.catalogId === 'sleep')) h = addHabit(h, { catalogId: 'sleep', required: true });
      if (experiment.steps != null && !h.list.some((q) => q.catalogId === 'steps')) h = addHabit(h, { catalogId: 'steps', required: true });
      saveH(h); success();
      saveE(stopExperiment(experiments, experiment.id, todayKey, 'kept'));
    } else if (act === 'repeat') saveE(startExperiment(experiments, experiment, todayKey));
    else saveE(stopExperiment(experiments, experiment.id, todayKey));
  }, [experiment, experiments, habits, todayKey, saveH, saveE]);
  const dayPlan = useDayPlan({
    result, profile, weather, growth, entries, opens, now, schedRest: schedIsRest(schedule, todayKey),
    onReward: (r) => { Promise.resolve(awardEvent(r.eventId, r.xp, r.journal)).then(takeGrowth).catch(() => {}); },
  });
  // Вершины: пересчёт после каждого обновления роста, отметки привычки или правки графика;
  // новая вершина — пролёт камеры и карточка. День отдыха — по своему календарю или по совету Хирона.
  const restToday = !!(dayPlan.plan && dayPlan.plan.mode === 'rest') || schedIsRest(schedule, todayKey);
  useEffect(() => {
    if (!growth || habits === null) return undefined; // пока привычки не прочитаны — не считаем (иначе правило «3 задания»)
    let alive = true;
    updatePeaks(Date.now(), restToday, { sched: schedule, habits }).then((r) => {
      if (!alive || !r || !r.peaks) return;
      setPeaks(r.peaks);
      if (r.fresh && r.fresh.length) {
        success();
        setPeakShow(r.fresh[r.fresh.length - 1]);
        if (sceneRef.current) sceneRef.current.celebrate();
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [growth, restToday, schedule, habits]);
  const growthView = useMemo(() => {
    if (!growth || !rankUp || (growth.events || []).some((e) => e && e.type === 'rankUp')) return growth;
    return { ...growth, events: [...(growth.events || []), { type: 'rankUp', rank: rankUp }] };
  }, [growth, rankUp]);
  const noData = !(result && result.series && ((result.series.steps || []).length || (result.series.sleep || []).length));

  const onIntroDone = useCallback(() => {
    introDone.current = true;
    setScreen(profile ? pendingRoute.current : 'setup');
    Animated.timing(uiIn, { toValue: 1, duration: reduceMotion() ? 0 : 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [profile, uiIn]);
  // Сцена остаётся фоном вкладок, если её не выключили в профиле.
  const sceneOn = sceneOk && (splash || !profile || profile.scene3d !== false);
  const sceneView = useMemo(() => {
    const p = profile || {};
    const st = sceneState(now, weather, { dark: colors.dark, period: p.ambience === 'day' ? 'day' : undefined });
    const base = p.seasonFx === false ? { ...st, precip: null, storm: false } : st;
    // дымка перерыва на дальних хребтах и звуки природы (выключаются в профиле)
    return { ...base, haze: peaks ? peaks.haze : 0, sound: p.sound !== false && !!profile };
  }, [now, weather, colors.dark, profile, peaks]);
  const tabTheme = useMemo(() => (sceneOn
    ? { ...colors, card: (sceneView.storm || sceneView.fog ? SCENE_CARD_STORM : SCENE_CARD)[colors.dark ? 'dark' : 'light'], shadow: { ...colors.shadow, elevation: 0 } }
    : colors), [colors, sceneOn, sceneView.storm, sceneView.fog]);
  // Свайп по вкладкам: сцена поворачивается за пальцем; с последней вкладки — дальше по кругу, к первой.
  const tabNow = useRef(tabIndex);
  tabNow.current = tabIndex;
  const swipe = useMemo(() => {
    let lastSent = 0;
    const W = () => Dimensions.get('window').width || 400;
    const settle = () => Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
    const cancel = () => { if (sceneRef.current) sceneRef.current.release(); settle(); };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onPanResponderMove: (_, g) => {
        swipeX.setValue(g.dx);
        const t = Date.now();
        if (t - lastSent > 30 && sceneRef.current) { lastSent = t; sceneRef.current.drag(Math.max(-1, Math.min(1, g.dx / W()))); }
      },
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > W() * 0.2 || (Math.abs(g.vx) > 0.45 && Math.abs(g.dx) > 30)) {
          const n = TAB_KEYS.length;
          light();
          swipeX.setValue(0);
          setTab(TAB_KEYS[(tabNow.current + (g.dx < 0 ? 1 : -1) + n) % n]);
        } else cancel();
      },
      onPanResponderTerminate: cancel,
    });
  }, [swipeX]);

  // Открыть вкладку, подробный экран («detail:sleep», «workout:3») или отдельный экран.
  const open = useCallback((key) => {
    if (key === 'debug' && !devMode) return;
    if (key === 'coach') key = 'tips'; // вкладки Хирона больше нет: старые ссылки ведут к его совету
    if (key === 'calm') { setCalm(true); return; }
    if (key === 'explore' || key === 'map') { setExplore(key === 'map' ? 'map' : 'fly'); return; }
    if (key === 'guest') { setGuest(true); return; }
    if (TAB_KEYS.includes(key)) {
      setTab(key);
      setScreen('home');
    } else if (key.startsWith('log')) {
      setLogType(key.split(':')[1] || null);
      setScreen('log');
    } else if (key.startsWith('detail:') || key.startsWith('workout:')) {
      const [kind, arg] = key.split(':');
      setDetail({ key: kind === 'workout' ? 'workout' : arg, arg: kind === 'workout' ? +arg : null, from: tab, back: screen === 'workouts' ? 'workouts' : 'home' });
      setScreen('detail');
    } else setScreen(key);
  }, [tab, screen, devMode]);

  useEffect(() => { setChironOpener(() => open('tips')); return () => setChironOpener(null); }, [open]);

  // Нажатие на виджет: epimely://tab/… или epimely://detail/… (схема задана в CI). Применяем, когда открыт главный экран.
  const [widgetLink, setWidgetLink] = useState(null);
  useEffect(() => {
    let sub = null;
    try {
      Promise.resolve(Linking.getInitialURL()).then((u) => { if (u) setWidgetLink(u); }).catch(() => {});
      sub = Linking.addEventListener('url', (e) => { if (e && e.url) setWidgetLink(e.url); });
    } catch (e) {}
    return () => { try { if (sub && sub.remove) sub.remove(); } catch (e) {} };
  }, []);
  useEffect(() => {
    if (!widgetLink || !profile || screen !== 'home') return;
    let k = null;
    try { k = require('./lib/widgets/links').widgetLinkKey(widgetLink); } catch (e) {}
    if (k && k.startsWith('detail:') && !result) return; // подробный экран нужен расчёт — ждём
    setWidgetLink(null);
    if (k) open(k);
  }, [widgetLink, profile, screen, result, open]);
  // Виджет просит фоновый доступ к Health Connect (флаг ставит его задача при добавлении): спрашиваем один раз.
  useEffect(() => {
    if (screen !== 'home' || !profile) return;
    try { require('./lib/widgets/permission').askBackgroundIfFlagged(); } catch (e) {}
  }, [screen, profile]);

  const goBack = useCallback(() => {
    if (screen === 'detail') {
      setScreen(detail && detail.back === 'workouts' ? 'workouts' : 'home');
      return true;
    }
    if (screen === 'home' && tab !== 'home') {
      setTab('home');
      return true;
    }
    if (screen === 'home' && homeOpen && sceneOn) {
      setHomeOpen(false);
      return true;
    }
    if (['debug', 'tips', 'log', 'sleep', 'cycle', 'about', 'import', 'achievements', 'recap', 'workouts', 'schedule', 'habits', 'history', 'simulator'].includes(screen) || (screen === 'setup' && profile) || (screen === 'permissions' && granted.size)) {
      setScreen('home');
      return true;
    }
    return false;
  }, [screen, tab, detail, profile, granted, homeOpen, sceneOn]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    profileRef.current = profile;
    return () => sub.remove();
  }, [goBack]);

  const onSaveProfile = async (p) => {
    await saveProfile(p);
    setProfile(p);
    setScreen('home');
    start(p);
  };

  // Профиль без перезагрузки данных (единицы измерения).
  const saveQuiet = async (p) => {
    await saveProfile(p);
    setProfile(p);
  };

  const onRequest = async () => {
    setLoading(true);
    try {
      const g = await askPermissions(!!(profile && profile.sex === 'f' && profile.showCycle));
      setGranted(g);
      setLoading(false);
      if (RECORD_TYPES.some((t) => g.has(t))) {
        setScreen('home');
        load(profile, g);
      }
    } catch (e) {
      setLoading(false);
      setError(tr('Ошибка: ') + String((e && e.message) || e));
    }
  };

  const back = granted.size ? () => setScreen('home') : undefined;

  // Ручные записи: сохранить и пересчитать.
  const setAllEntries = (next) => {
    entriesRef.current = next;
    setEntries(next);
    saveEntries(next);
    start(profile);
  };
  const addEntry = (e) => { success(); setAllEntries([...entriesRef.current, e]); };
  // Оформление, вибрация, напоминания — сохраняются сразу, с побочными действиями.
  // Возврат в приложение: запомнить открытие; если сон по расписанию — пересчитать ночь.
  useEffect(() => {
    let prev = AppState.currentState;
    const sub = AppState.addEventListener('change', (st) => {
      setAppActive(st === 'active');
      if (st !== 'active' && prev === 'active') leftAt.current = Date.now();
      if (st === 'active' && prev !== 'active' && profileRef.current && profileRef.current.lock && Date.now() - leftAt.current > 20000) setLocked(true);
      if (st === 'active' && prev !== 'active') {
        addOpen().then((list) => {
          opensRef.current = list;
          setOpens(list);
          const p = profileRef.current;
          if (p && p.sleepPlan && p.sleepPlan.on && introDone.current) start(p);
        });
      }
      prev = st;
    });
    return () => sub.remove();
  }, [start]);
  // Сон по расписанию: сохранить и пересчитать.
  const onSavePlan = async (plan) => {
    const p = { ...profile, sleepPlan: plan };
    await saveProfile(p);
    setProfile(p);
    success();
    start(p);
  };
  // Режим сна (экран «Режим сна»): сохранить без перезагрузки данных и переставить напоминания.
  const onSaveSchedule = async (plan) => {
    const prev = (profile && profile.sleepPlan) || {};
    const p = { ...profile, sleepPlan: { ...prev, ...plan } };
    await saveProfile(p);
    setProfile(p);
    scheduleReminders(p, dataset, { ask: !!(plan.remindWake && !prev.remindWake) });
    if (plan.on || prev.on) start(p);
  };
  const planLast = profile && profile.sleepPlan && profile.sleepPlan.on ? lastPlanNight(profile.sleepPlan, opensRef.current) : null;
  // Взят ли сон этой ночи из Health Connect (часы), а не по расписанию.
  const planFromHC = !!(planLast && dataset && dataset.sleep[planLast.date] && !(dataset.manualKeys && dataset.manualKeys.sleep.has(planLast.date)));
  const onSettings = async (patch) => {
    const p = { ...profile, ...patch };
    await saveProfile(p);
    // Язык: переключаем до setProfile, чтобы перерисовка уже шла на новом языке;
    // тексты расчёта (советы, подписи) пересчитываем, напоминания переставляем.
    if ('lang' in patch) {
      setLang(p.lang);
      if (dataset) { const r = compute(dataset, p); setResult(r); saveResult(r); }
    }
    setProfile(p);
    setHaptics(p.haptics);
    if ('remindSleep' in patch || 'remindMorning' in patch || 'lang' in patch) scheduleReminders(p, dataset, { ask: !!(patch.remindSleep || patch.remindMorning) });
    if (patch.notifyGoals) askNotifications().then(() => (background ? askBackground() : undefined)); // фон: уведомления, затем фоновое чтение Health Connect
    if ('notifyGoals' in patch) syncGoalsTask(p);
    if ('appIcon' in patch) applyIcon(patch.appIcon);
  };
  // Погода: включить/выключить, город или геопозиция — и сразу обновить.
  const onWeather = async (w) => {
    const p = { ...profile, weather: w };
    await saveProfile(p);
    setProfile(p);
    setWeather(w.on ? await getWeather(w, true) : null);
  };
  onSettingsRef.current = onSettings;
  const switchTab = (k) => { if (k !== tab) light(); setTab(k); };
  const deleteEntry = (e) => setAllEntries(entriesRef.current.filter((x) => x.id !== e.id));
  // Импорт: Apple Health, CSV (записи с теми же id заменяются), резервная копия.
  const setImported = (store) => {
    saveImported(store);
    importedRef.current = store;
    setImportInfo(store ? { at: store.at, summary: store.summary } : null);
    start(profile);
  };
  const addCSV = (list) => {
    const ids = new Set(list.map((x) => x.id));
    setAllEntries([...entriesRef.current.filter((x) => !ids.has(x.id)), ...list]);
  };
  // Полная копия: профиль, записи, импорт и всё локальное хранилище (рост, вершины, привычки, график, ответы Хирону).
  const backupData = async () => ({ profile, entries: entriesRef.current, imported: importedRef.current, store: await dumpStore() });
  const restoreBackup = async (data) => {
    if (data.store) {
      await restoreStore(data.store);
      // перечитываем то, что живёт в памяти, — без перезапуска приложения
      loadHabits().then(setHabits).catch(() => {});
      loadPeaks().then((x) => { if (x) setPeaks(x); }).catch(() => {});
      loadFeedback().then(setFeedback).catch(() => {});
      Promise.resolve(loadGrowth()).then((g) => { if (g) setGrowth(g); }).catch(() => {});
      loadUnlocks().then((u) => setUnlocks(u || {})).catch(() => {});
    }
    const p = data.profile || profile;
    if (data.profile) { await saveProfile(p); setProfile(p); }
    if (data.imported !== undefined) {
      saveImported(data.imported);
      importedRef.current = data.imported;
      setImportInfo(data.imported ? { at: data.imported.at, summary: data.imported.summary } : null);
    }
    const list = Array.isArray(data.entries) ? data.entries : entriesRef.current;
    entriesRef.current = list;
    setEntries(list);
    saveEntries(list);
    start(p);
  };
  // Продолжить без Health Connect — только ручные записи.
  const skipHC = async () => {
    const p = { ...profile, skipHC: true };
    await saveProfile(p);
    setProfile(p);
    setScreen('home');
    start(p);
  };
  const wanted = profile && profile.sex === 'f' && profile.showCycle ? [...EXTRA_TYPES, ...CYCLE_TYPES] : EXTRA_TYPES;
  const missingAccess = granted.size > 0 && wanted.some((t) => !granted.has(t));
  const refresh = () => start(profile);
  // Цикл в профиле: показывать ли на главном и режим — с пересчётом.
  const onCycleChange = async (patch) => {
    const p = { ...profile, ...patch };
    await saveProfile(p);
    setProfile(p);
    start(p);
  };

  // Направление перехода: вглубь (подробный экран) — справа, назад к вкладкам — слева;
  // вкладки — со стороны новой вкладки. Считается в момент смены экрана/вкладки.
  const nav = useRef({ screen, tab: tabIndex, dir: 0, tabDir: 0 }).current;
  if (screen !== nav.screen) {
    nav.dir = nav.screen === 'intro' ? 0 : screen === 'home' ? -1 : 1;
    nav.screen = screen;
  }
  if (tabIndex !== nav.tab) {
    nav.tabDir = tabIndex > nav.tab ? 1 : -1;
    nav.tab = tabIndex;
  }
  const W = Dimensions.get('window').width || 400;
  const sceneLaunch = splash && sceneOk;
  const screenKey = screen === 'detail' && detail ? `detail:${detail.key}:${detail.arg}` : screen;
  // Экран запуска лежит поверх: когда логотип долетел до шапки, под ним уже
  // открывается главный экран, а запуск растворяется — без чёрной паузы.
  return (
    <View style={{ flex: 1, backgroundColor: sceneLaunch ? PAPER : colors.bg }}>
      <StatusBar barStyle={colors.dark && !(sceneLaunch && screen === 'intro') ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      {sceneOn ? (
        <Scene3D ref={sceneRef} state={sceneView} tab={tabIndex} tabs={TAB_KEYS.length} lite={OLD_ANDROID || !!(profile && profile.quality === 0)} quick={reduceMotion() || !splash}
          paused={!appActive || (!splash && screen !== 'home' && !calm && !explore && !locked && !guest)} onEvent={onSceneEvent}
          quality={profile && profile.quality != null ? profile.quality : null} />
      ) : null}
      {/* Пока данные закрыты (блокировка, гость) или идёт отдых в горах, экраны не рисуются вовсе */}
      {!splash && (locked || guest) ? (
        <ColorsContext.Provider value={tabTheme}><Shield mode={locked ? 'lock' : 'guest'} onUnlock={doUnlock} /></ColorsContext.Provider>
      ) : !splash && explore && sceneOn ? (
        <ColorsContext.Provider value={tabTheme}>
          <ExploreMode mode={explore} peaks={peaks} scene={sceneRef.current} canRecord={canRecord} busy={shooting}
            onMode={(m) => { setExplore(m); if (sceneRef.current) sceneRef.current.explore(m); }}
            onShot={() => { if (shooting || !sceneRef.current) return; setShooting('shot'); sceneRef.current.snapshot('p' + Date.now()); }}
            onClip={() => { if (shooting || !sceneRef.current) return; setShooting('clip'); sceneRef.current.record('v' + Date.now(), 10); }}
            onClose={() => { setExplore(null); if (sceneRef.current) sceneRef.current.explore(null); }} />
        </ColorsContext.Provider>
      ) : !splash && calm && sceneOn ? (
        <ColorsContext.Provider value={tabTheme}><CalmMode onClose={() => setCalm(false)} /></ColorsContext.Provider>
      ) : (
        <Animated.View style={{ flex: 1, opacity: uiIn }}>
          {screen === 'intro' ? null : <ScreenIn key={screenKey + ':' + (RU ? 'ru' : 'en') + ':' + themeName} dir={nav.dir}>{renderScreen()}</ScreenIn>}
        </Animated.View>
      )}
      {peakShow && !splash && !locked && !guest ? (
        <ColorsContext.Provider value={tabTheme}>
          <PeakUnlock peak={peakShow} onClose={() => { setPeakShow(null); if (sceneRef.current) sceneRef.current.celebrate(true); }} />
        </ColorsContext.Provider>
      ) : null}
      {splash ? (
        <ColorsContext.Provider value={colors}>
          {sceneOk
            ? <SceneLaunch phase={scenePhase} ready={ready} firstRun={ready && !profile} reveal={(long) => sceneRef.current && sceneRef.current.reveal(long)} onReveal={onIntroDone} onDone={() => setSplash(false)} />
            : <LaunchScreen ready={ready} firstRun={ready && !profile} onReveal={onIntroDone} onDone={() => setSplash(false)} />}
        </ColorsContext.Provider>
      ) : null}
    </View>
  );

  function renderScreen() {
    switch (screen) {
      case 'setup':
        return <SetupScreen profile={profile} onSave={onSaveProfile} onBack={profile ? () => setScreen('home') : undefined} />;
      case 'nohc':
        return <NoHealthConnectScreen status={sdk} onRetry={refresh} onSkip={skipHC} />;
      case 'permissions':
        return <PermissionsScreen onRequest={onRequest} onBack={back} busy={loading} granted={[...granted].length} onSkip={granted.size ? undefined : skipHC} />;
      case 'debug':
        if (!devMode) return null;
        return <DebugScreen granted={granted} sdk={sdk} dataset={dataset} onBack={() => setScreen('home')} onHide={isDevBuild ? undefined : () => { setDevMode(false); setScreen('home'); }} />;
      case 'log':
        return (
          <ColorsContext.Provider value={colors}>
            <LogScreen entries={entries} profile={profile} initialType={logType} onSave={addEntry} onDelete={deleteEntry} onBack={goBack}
            plan={profile && profile.sleepPlan} onSavePlan={onSavePlan} />
          </ColorsContext.Provider>
        );
      case 'sleep':
        return (
          <ColorsContext.Provider value={colors}>
            <SleepScheduleScreen profile={profile} dataset={dataset} norm={result && result.scores && result.scores.sleep ? result.scores.sleep.norm : null}
              onSave={onSaveSchedule} onSettings={onSettings} onBack={goBack} />
          </ColorsContext.Provider>
        );
      case 'workouts':
        return (
          <ColorsContext.Provider value={colors}>
            <WorkoutsScreen result={result} loading={loading} onRefresh={refresh} onOpen={open} onBack={goBack} />
          </ColorsContext.Provider>
        );
      case 'recap':
        return recap ? <ColorsContext.Provider value={colors}><RecapScreen recap={recap} onBack={goBack} /></ColorsContext.Provider> : null;
      case 'achievements':
        return <ColorsContext.Provider value={colors}><AchievementsScreen list={achievements.list} onBack={goBack} /></ColorsContext.Provider>;
      case 'import':
        return (
          <ColorsContext.Provider value={colors}>
            <ImportScreen importInfo={importInfo} entriesCount={entries.length} onApple={setImported} onDeleteApple={() => setImported(null)}
              onCSV={addCSV} backupData={backupData} onRestore={restoreBackup} onBack={goBack} />
          </ColorsContext.Provider>
        );
      case 'about':
        return <ColorsContext.Provider value={colors}><AboutDataScreen onBack={goBack} /></ColorsContext.Provider>;
      case 'cycle':
        return (
          <ColorsContext.Provider value={colors}>
            <CycleScreen base={result && result.cycle} onBack={goBack} onLogOther={() => open('log:period')}
              onStartToday={() => addEntry({ id: String(Date.now()), type: 'period', date: dayKey(new Date()), days: (result && result.cycle && result.cycle.periodLen) || 5, t: Date.now() })} />
          </ColorsContext.Provider>
        );
      case 'schedule':
        return <ColorsContext.Provider value={colors}><ScheduleScreen schedule={schedule} onSave={saveSchedule} onBack={goBack} /></ColorsContext.Provider>;
      case 'habits':
        return (
          <ColorsContext.Provider value={colors}>
            <HabitsScreen habits={habits} onSave={saveH} onBack={goBack} suggested={chironTip && chironTip.goal === 'sleep' ? ['bedtime', 'screens', 'sleep'] : ['walk', 'steps', 'stretch', 'sleep']} />
          </ColorsContext.Provider>
        );
      case 'history':
        return <ColorsContext.Provider value={colors}><HistoryScreen archive={archive} schedule={schedule} onBack={goBack} /></ColorsContext.Provider>;
      case 'simulator':
        return (
          <ColorsContext.Provider value={colors}>
            <SimulatorScreen dataset={dataset} profile={profile} running={!!experiment} onBack={goBack}
              onStart={(plan) => { success(); saveE(startExperiment(experiments, plan, todayKey)); setTab('growth'); setScreen('home'); }} />
          </ColorsContext.Provider>
        );
      case 'tips':
        return (
          <ColorsContext.Provider value={colors}>
            <TipsScreen rec={recommend(result, profile)} onBack={goBack} />
          </ColorsContext.Provider>
        );
      case 'detail': {
        const w = detail.key === 'workout' && result && result.series ? result.series.workouts[detail.arg] : null;
        return (
          <ColorsContext.Provider value={colors}>
            <DetailScreen detail={buildDetail(detail.key, result, profile, w)} onBack={goBack} />
          </ColorsContext.Provider>
        );
      }
      default: {
        const theme = tabTheme;
        return (
          <View style={{ flex: 1, backgroundColor: sceneOn ? 'transparent' : colors.bg }} {...swipe.panHandlers}>
            {sceneOn ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, opacity: tab === 'home' && !homeOpen ? SCENE_VEIL_CLEAR : SCENE_VEIL }]} /> : null}
            <ColorsContext.Provider value={theme}>
              <Animated.View style={{ flex: 1, opacity: swipeX.interpolate({ inputRange: [-W, 0, W], outputRange: [0.25, 1, 0.25] }), transform: [{ translateX: Animated.multiply(swipeX, 0.35) }] }}>
              <FadeIn key={tab} dir={nav.tabDir}>
                {tab === 'metrics' ? (
                  <MetricsScreen result={result} profile={profile} loading={loading} onRefresh={refresh} tip={chironTip}
                    tipAccepted={!!(chironTip && isAccepted(feedback, chironTip.id))} onTipAnswer={onTipAnswer}
                    rest={rest} onRestAccept={acceptRest} onRestDismiss={dismissRest}
                    missingAccess={missingAccess} onAskAccess={onRequest} onOpen={open} />
                ) : tab === 'growth' ? (
                  <GrowthScreen growth={growthView} amb={amb} scene={sceneOn} peaks={peaks}
                    habits={habits} schedule={schedule} todayKey={todayKey} onToggleHabit={(id) => { light(); saveH(toggleDone(habits, id, todayKey)); }} onOpen={open}
                    rest={rest} onRestAccept={acceptRest} onRestDismiss={dismissRest}
                    experiment={experiment} archive={archive} onExperiment={experimentAction} plan={dayPlan.plan} activities={activities} water={water} noData={noData}
                    arc={dayPlan.arc} onArcAct={dayPlan.actArc} achievements={achievements.list} />
                ) : tab === 'profile' ? (
                  <ProfileScreen profile={profile} loading={loading} onOpen={open} onReload={refresh}
                    onSaveProfile={saveQuiet} onCycleChange={onCycleChange} onSettings={onSettings} dataset={dataset} oldAndroid={OLD_ANDROID}
                    weather={weather} onWeather={onWeather} water={water}
                    devMode={devMode} onDevUnlock={() => setDevMode(true)} />
                ) : (
                  <HomeScreen result={result} profile={profile} loading={loading} error={error} onOpen={open} onRefresh={refresh}
                    achievements={achievements.list} amb={sceneOn ? null : amb} scene={sceneOn} open={homeOpen || !sceneOn} onToggle={setHomeOpen} peaks={peaks} recap={recap} planLast={planLast} planFromHC={planFromHC} weather={weather} growth={growth} arc={dayPlan.arc} onArcAct={dayPlan.actArc} />
                )}
              </FadeIn>
              </Animated.View>
            </ColorsContext.Provider>
            <TabBar tabs={TABS} active={tab} onChange={switchTab} bottom={insets.bottom} />
          </View>
        );
      }
    }
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <Main />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
