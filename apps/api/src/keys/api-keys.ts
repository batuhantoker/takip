import type { AppDb } from '../db/app-db';
import { createFailedLookups } from './failed-lookups';
import type { Scope } from './scopes';
import { keyStore, type KeyActor, type StoredKey } from './store';
import { hashKey, isWellFormed, sameHash } from './token';

const MAX_CACHED = 10_000;
const TOUCH_EVERY_MS = 60_000;

export type Verified =
  | { ok: true; key: StoredKey }
  | { ok: false; status: 401; error: 'invalid_api_key' }
  | { ok: false; status: 403; error: 'account_banned' }
  | { ok: false; status: 429; error: 'rate_limited'; retryAfterS: number };

const INVALID = { ok: false, status: 401, error: 'invalid_api_key' } as const;

/**
 * API keys (backend.md §8). Lookups are cached for `ttlMs`, unknown keys included, so a revocation made
 * elsewhere applies within that time; revocations made here apply at once. last_used_at is written at
 * most once a minute per key. Database lookups that find no live key are throttled per client address.
 */
export function createApiKeys(db: AppDb, { ttlMs = 30_000, now = () => Date.now(), failedLookupsPerMinute = 10 } = {}) {
  const store = keyStore(db);
  const cache = new Map<string, { at: number; key: StoredKey | null }>();
  const touched = new Map<string, number>();
  const failures = createFailedLookups({ perMinute: failedLookupsPerMinute, now });

  function cached(id: string) {
    const hit = cache.get(id);
    return hit && now() - hit.at < ttlMs ? hit : undefined;
  }

  function load(id: string, hash: Buffer) {
    if (cache.size >= MAX_CACHED) cache.clear();
    const key = store.find(hash);
    cache.set(id, { at: now(), key });
    return key;
  }

  function touch(key: StoredKey, at: number) {
    if (at - (touched.get(key.id) ?? key.lastUsedAt ?? 0) < TOUCH_EVERY_MS) return;
    if (touched.size >= MAX_CACHED) touched.clear();
    touched.set(key.id, at);
    try {
      store.touch(key.id, at);
    } catch (err) {
      // Only the "last used" column: never fail the request over it.
      console.error('[keys] last_used_at write failed', err);
    }
  }

  function forget(match: (key: StoredKey) => boolean) {
    for (const [id, hit] of cache) if (hit.key && match(hit.key)) cache.delete(id);
  }

  return {
    /** `ip` is the caller's resolved address, for the failed-lookup throttle. */
    verify(token: string, ip: string): Verified {
      if (!isWellFormed(token)) return INVALID;
      const hash = hashKey(token);
      const id = hash.toString('base64url');
      const hit = cached(id);
      const waitS = hit ? 0 : failures.waitS(ip);
      if (waitS) return { ok: false, status: 429, error: 'rate_limited', retryAfterS: waitS };
      const key = hit ? hit.key : load(id, hash);
      const at = now();
      if (!key || !sameHash(key.hash, hash) || key.revokedAt !== null || (key.expiresAt !== null && key.expiresAt <= at)) {
        if (!hit) failures.record(ip);
        return INVALID;
      }
      // Better Auth lifts an expired ban only at sign-in, so the end date is checked here.
      if (key.banned && (key.banExpires === null || key.banExpires > at)) return { ok: false, status: 403, error: 'account_banned' };
      touch(key, at);
      return { ok: true, key };
    },

    list: store.list,

    listAll: (p: Omit<Parameters<typeof store.listAll>[0], 'now'>) => store.listAll({ ...p, now: now() }),

    create: (p: { userId: string; name: string; scopes: Scope[]; expiresAt: number | null; max: number }) => store.create({ ...p, at: now() }),

    revoke(userId: string, keyId: string, actor: KeyActor) {
      const revoked = store.revoke(userId, keyId, actor, now());
      if (revoked) forget(key => key.id === keyId);
      return revoked;
    },

    /** Drops a user's cached keys, so a ban or unban reaches them at once. */
    forgetUser: (userId: string) => forget(key => key.userId === userId),
  };
}

export type ApiKeys = ReturnType<typeof createApiKeys>;
