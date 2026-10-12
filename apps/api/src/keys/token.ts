import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** `tk_` and 32 random bytes in base64url. High entropy, so a fast hash is enough to store it. */
export const KEY_PREFIX = 'tk_';
const SECRET_BYTES = 32;
const WELL_FORMED = /^tk_[A-Za-z0-9_-]{43}$/;
const SHOWN_CHARS = 8;

export const hashKey = (key: string) => createHash('sha256').update(key).digest();
export const isWellFormed = (token: string) => WELL_FORMED.test(token);
export const sameHash = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

/** A new key, its hash, and the prefix its owner sees in lists (`tk_ab12cd34`). */
export function newKey() {
  const key = KEY_PREFIX + randomBytes(SECRET_BYTES).toString('base64url');
  return { key, hash: hashKey(key), prefix: key.slice(0, KEY_PREFIX.length + SHOWN_CHARS) };
}

export const newKeyId = () => randomBytes(9).toString('base64url');

/** The credential of `Authorization: Bearer …`; undefined when the header isn't a bearer one. */
export function bearerToken(header: string | undefined): string | undefined {
  const match = header === undefined ? null : /^Bearer(?:\s+(.*))?$/i.exec(header.trim());
  return match ? (match[1] ?? '').trim() : undefined;
}
