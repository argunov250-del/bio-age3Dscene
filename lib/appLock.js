// Защита личных данных: разблокировка биометрией или кодом телефона (expo-local-authentication)
// и запрет снимков экрана вместе со скрытием в списке недавних приложений (expo-screen-capture).
// Оба модуля подключаются в try/catch: без них приложение просто работает без блокировки.
let LA = null, SC = null;
try { LA = require('expo-local-authentication'); } catch (e) { LA = null; }
try { SC = require('expo-screen-capture'); } catch (e) { SC = null; }

// Есть ли на телефоне способ разблокировки (отпечаток, лицо или код экрана).
export async function canLock() {
  try {
    if (!LA || typeof LA.getEnrolledLevelAsync !== 'function') return false;
    return Number(await LA.getEnrolledLevelAsync()) > 0;
  } catch (e) { return false; }
}

// true — человек подтвердил себя. Если способа нет вовсе — не запираем его снаружи.
export async function unlock(promptMessage) {
  try {
    if (!(await canLock())) return true;
    const r = await LA.authenticateAsync({ promptMessage, cancelLabel: undefined, disableDeviceFallback: false });
    return !!(r && r.success);
  } catch (e) { return false; }
}

export function setScreenGuard(on) {
  try {
    if (!SC) return;
    if (on) SC.preventScreenCaptureAsync('epimely'); else SC.allowScreenCaptureAsync('epimely');
  } catch (e) {}
}
