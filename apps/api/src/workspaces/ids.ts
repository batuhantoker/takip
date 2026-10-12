import { randomBytes } from 'node:crypto';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A ULID: 48 bits of epoch ms then 80 random bits, Crockford base32, so ids sort by creation time. */
export function ulid(now = Date.now(), random: Uint8Array = randomBytes(10)) {
  let time = '';
  for (let t = now, i = 0; i < 10; i++, t = Math.floor(t / 32)) time = CROCKFORD[t % 32] + time;
  let rest = '';
  let bits = 0;
  let value = 0;
  for (const byte of random) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      rest += CROCKFORD[(value >> bits) & 31];
    }
    value &= (1 << bits) - 1;
  }
  return time + rest;
}

export const isUlid = (id: string) => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id);

/** 96 random bits: a share link can't be guessed, only handed out. */
export const newSlug = () => randomBytes(12).toString('base64url');

export const isSlug = (slug: string) => /^[A-Za-z0-9_-]{16}$/.test(slug);
