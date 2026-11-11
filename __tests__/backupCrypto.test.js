// Зашифрованная копия: шифрование и расшифровка, неверный пароль, подмена, генератор случайных чисел.
const nodeCrypto = require('crypto');
jest.mock('expo-crypto', () => ({ getRandomBytes: (n) => new Uint8Array(require('crypto').randomBytes(n)) }), { virtual: true });
const { encryptBackup, decryptBackup, isEncrypted, toB64, fromB64 } = require('../lib/backupCrypto');

const data = { app: 'Epimely', kind: 'backup', v: 2, exportedAt: '2026-11-12T00:00:00Z', profile: { birth: '1985-05-05' }, store: { 'peaks.v1': '{"unlocked":{"d7":"2026-01-07"}}' }, note: 'Привет ✓' };

test('base64 туда и обратно', () => {
  for (const n of [0, 1, 2, 3, 31, 100]) {
    const b = new Uint8Array(nodeCrypto.randomBytes(n));
    expect(Array.from(fromB64(toB64(b)))).toEqual(Array.from(b));
    expect(toB64(b)).toBe(Buffer.from(b).toString('base64'));
  }
});
test('шифрует и расшифровывает правильным паролем; в файле нет открытых данных', async () => {
  const env = await encryptBackup(data, 'горы-над-облаками');
  expect(isEncrypted(env)).toBe(true);
  expect(JSON.stringify(env)).not.toContain('1985-05-05');
  expect(await decryptBackup(env, 'горы-над-облаками')).toEqual(data);
}, 30000);
test('неверный пароль и подмена заголовка или данных — badPassword', async () => {
  const env = await encryptBackup(data, 'password-123');
  await expect(decryptBackup(env, 'password-124')).rejects.toThrow('badPassword');
  await expect(decryptBackup({ ...env, exportedAt: '2020-01-01' }, 'password-123')).rejects.toThrow('badPassword');
  const d = fromB64(env.data); d[5] ^= 1;
  await expect(decryptBackup({ ...env, data: toB64(d) }, 'password-123')).rejects.toThrow('badPassword');
}, 60000);
test('короткий пароль не принимается; соль и nonce каждый раз новые', async () => {
  await expect(encryptBackup(data, '123')).rejects.toThrow('shortPassword');
  const a = await encryptBackup(data, 'password-123'), b = await encryptBackup(data, 'password-123');
  expect(a.kdf.salt).not.toBe(b.kdf.salt);
  expect(a.nonce).not.toBe(b.nonce);
}, 60000);
test('без генератора случайных чисел — ошибка, а не слабая соль', async () => {
  await expect(encryptBackup(data, 'password-123', () => new Uint8Array(0))).rejects.toThrow('noRandom');
});
test('UTF-8 совпадает с системной реализацией', () => {
  const { utf8, unutf8 } = require('../lib/backupCrypto');
  const str = 'Эльбрус ⛰️ 𝔄 é ✓ ' + 'x'.repeat(3);
  expect(Array.from(utf8(str))).toEqual(Array.from(new TextEncoder().encode(str)));
  expect(unutf8(new TextEncoder().encode(str))).toBe(str);
});
