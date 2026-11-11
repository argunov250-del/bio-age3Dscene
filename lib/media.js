// Сборка кусков снимка или ролика из сцены (base64) в файл и «Поделиться».
// Кадр — без интерфейса и без данных о здоровье: только горы.
import { fromB64 } from './backupCrypto';

const parts = {};
// Принять кусок: { id, i, n, part, mime }. -> null, пока не все куски; иначе { id, mime, b64 }.
export function collect(m) {
  if (!m || !m.id) return null;
  const p = parts[m.id] || (parts[m.id] = { n: m.n, got: 0, list: [] });
  if (p.list[m.i] == null) { p.list[m.i] = m.part || ''; p.got++; }
  if (m.mime) p.mime = m.mime;
  if (p.got < p.n) return null;
  delete parts[m.id];
  return { id: m.id, mime: p.mime || 'image/jpeg', b64: p.list.join('') };
}

export async function saveAndShare({ mime, b64 }, name) {
  const { File, Paths } = require('expo-file-system');
  const Sharing = require('expo-sharing');
  const ext = mime === 'video/webm' ? 'webm' : 'jpg';
  const f = new File(Paths.cache, `${name}.${ext}`);
  if (f.exists) f.delete();
  f.create();
  f.writeSync(fromB64(b64));
  await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: 'Epimely' });
  return f.uri;
}
