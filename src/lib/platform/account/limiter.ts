/** `limit` uses per account, refilled evenly over `windowMs`. */
export type Allowance = { limit: number; windowMs: number };

const MAX_TRACKED = 10_000;

/**
 * Token buckets per account and family. They live in this process's memory, so a restart forgives
 * everyone and each server instance counts on its own.
 */
export function createAccountLimiter<F extends string>(allowances: Record<F, Allowance>) {
  const buckets = new Map<string, { family: F; tokens: number; at: number }>();

  const refilled = (family: F, tokens: number, at: number, now: number) => {
    const { limit, windowMs } = allowances[family];
    return Math.min(limit, tokens + ((now - at) * limit) / windowMs);
  };

  function makeRoom(now: number) {
    for (const [key, b] of buckets) {
      if (refilled(b.family, b.tokens, b.at, now) >= allowances[b.family].limit) buckets.delete(key);
    }
    if (buckets.size >= MAX_TRACKED) buckets.clear();
  }

  /** Spends one use of `family` for the account: 0 when allowed, else the seconds until the next use. */
  function take(family: F, subjectId: string, now = Date.now()): number {
    const key = `${family}:${subjectId}`;
    const held = buckets.get(key);
    const tokens = held ? refilled(family, held.tokens, held.at, now) : allowances[family].limit;
    if (tokens < 1) {
      const { limit, windowMs } = allowances[family];
      return Math.max(1, Math.ceil(Math.round(((1 - tokens) * windowMs) / limit) / 1000));
    }
    if (!held && buckets.size >= MAX_TRACKED) makeRoom(now);
    buckets.set(key, { family, tokens: tokens - 1, at: now });
    return 0;
  }

  return { take };
}
