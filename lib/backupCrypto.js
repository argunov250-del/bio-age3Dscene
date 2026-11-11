// Зашифрованная резервная копия: ключ из пароля — scrypt (N=2^14, r=8, p=1), шифр —
// XChaCha20-Poly1305 (проверенные библиотеки @noble/hashes и @noble/ciphers, чистый JS).
// Соль и одноразовое число — из системного генератора случайных чисел (expo-crypto),
// никогда не из Math.random. Без пароля данные не прочитать; неверный пароль — ошибка badPassword.
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { scryptAsync } from '@noble/hashes/scrypt';

export const ENC_KIND = 'backup-enc';
const KDF = { name: 'scrypt', N: 16384, r: 8, p: 1 };

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toB64(u8) {
  let out = '';
  for (let i = 0; i < u8.length; i += 3) {
    const n = (u8[i] << 16) | ((u8[i + 1] || 0) << 8) | (u8[i + 2] || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < u8.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < u8.length ? B64[n & 63] : '=');
  }
  return out;
}
export function fromB64(s) {
  const clean = String(s).replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}
// UTF-8 без TextEncoder/TextDecoder (их может не быть в движке Hermes).
export function utf8(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.codePointAt(i);
    if (c > 0xffff) i++;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}
export function unutf8(b) {
  let s = '';
  for (let i = 0; i < b.length;) {
    const x = b[i++];
    let c;
    if (x < 0x80) c = x;
    else if (x < 0xe0) c = ((x & 31) << 6) | (b[i++] & 63);
    else if (x < 0xf0) c = ((x & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else c = ((x & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(c);
  }
  return s;
}

function randomBytes(n) {
  const C = require('expo-crypto');
  return C.getRandomBytes(n);
}
const checked = (rand) => (n) => { const b = rand(n); if (!b || b.length !== n) throw new Error('noRandom'); return b; };

const key = (password, salt, k = KDF) => scryptAsync(utf8(String(password).normalize('NFKC')), salt, { N: k.N, r: k.r, p: k.p, dkLen: 32 });

// data — любой объект копии; -> объект-конверт для записи в файл.
export async function encryptBackup(data, password, rand = randomBytes) {
  if (!password || String(password).length < 6) throw new Error('shortPassword');
  const r = checked(rand);
  const salt = r(16), nonce = r(24);
  const k = await key(password, salt);
  const header = { app: 'Epimely', kind: ENC_KIND, v: 1, exportedAt: data && data.exportedAt ? data.exportedAt : new Date().toISOString() };
  const aad = utf8(JSON.stringify(header)); // заголовок тоже защищён от подмены
  const ct = xchacha20poly1305(k, nonce, aad).encrypt(utf8(JSON.stringify(data)));
  return { ...header, kdf: { ...KDF, salt: toB64(salt) }, alg: 'xchacha20poly1305', nonce: toB64(nonce), data: toB64(ct) };
}

export const isEncrypted = (o) => !!(o && o.app === 'Epimely' && o.kind === ENC_KIND);

export async function decryptBackup(env, password) {
  if (!isEncrypted(env) || env.v !== 1 || env.alg !== 'xchacha20poly1305' || !env.kdf || env.kdf.name !== 'scrypt') throw new Error('notBackup');
  const k = await key(password || '', fromB64(env.kdf.salt), env.kdf);
  const header = { app: env.app, kind: env.kind, v: env.v, exportedAt: env.exportedAt };
  let plain;
  try { plain = xchacha20poly1305(k, fromB64(env.nonce), utf8(JSON.stringify(header))).decrypt(fromB64(env.data)); } catch (e) { throw new Error('badPassword'); }
  return JSON.parse(unutf8(plain));
}
