// Сборка снимка и ролика из кусков сцены (lib/media.js).
jest.mock('expo-crypto', () => ({}), { virtual: true });
const { collect } = require('../lib/media');
const { fromB64 } = require('../lib/backupCrypto');

test('куски в любом порядке собираются в исходные байты; повтор куска не ломает сборку', () => {
  const bytes = Buffer.from(Array.from({ length: 1000 }, (_, i) => (i * 7) % 256));
  const b64 = bytes.toString('base64');
  const SIZE = 400; // кратно 4
  const n = Math.ceil(b64.length / SIZE);
  const msgs = Array.from({ length: n }, (_, i) => ({ id: 'x', i, n, part: b64.slice(i * SIZE, (i + 1) * SIZE), ...(i === n - 1 ? { mime: 'image/jpeg' } : {}) }));
  const order = [...msgs.keys()].reverse(); // последний кусок первым
  let done = null;
  order.forEach((i, j) => {
    const r = collect(msgs[i]);
    if (j === 0) expect(collect(msgs[i])).toBeNull(); // повтор того же куска
    if (j < order.length - 1) expect(r).toBeNull(); else done = r;
  });
  expect(done.mime).toBe('image/jpeg');
  expect(Buffer.from(fromB64(done.b64)).equals(bytes)).toBe(true);
});
