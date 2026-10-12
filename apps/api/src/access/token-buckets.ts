const SWEEP_EVERY_MS = 10_000;
// A plan with no allowance at all: ask again in a minute, in case an operator raises it.
const NO_ALLOWANCE_RETRY_S = 60;

export type Take = { allowed: boolean; limit: number; remaining: number; resetS: number; retryAfterS: number };

type Bucket = { tokens: number; at: number; rate: number };

/** One bucket per key, holding one second of burst and refilling continuously at `rate` per second. */
export function createTokenBuckets({ now = () => Date.now(), maxBuckets = 100_000 } = {}) {
  // Insertion order is last use, so the first entry is the least recently used.
  const buckets = new Map<string, Bucket>();
  let sweptAt = now();

  const tokensAt = (b: Bucket, at: number, rate: number) => Math.min(rate, b.tokens + ((at - b.at) / 1000) * rate);

  function sweep(at: number) {
    sweptAt = at;
    // A full bucket is the same as none.
    for (const [key, b] of buckets) if (tokensAt(b, at, b.rate) >= b.rate) buckets.delete(key);
  }

  function take(key: string, rate: number): Take {
    const at = now();
    if (at - sweptAt >= SWEEP_EVERY_MS) sweep(at);
    if (rate <= 0) return { allowed: false, limit: 0, remaining: 0, resetS: NO_ALLOWANCE_RETRY_S, retryAfterS: NO_ALLOWANCE_RETRY_S };

    const prev = buckets.get(key);
    const tokens = prev ? tokensAt(prev, at, rate) : rate;
    const allowed = tokens >= 1;
    const left = allowed ? tokens - 1 : tokens;
    buckets.delete(key);
    buckets.set(key, { tokens: left, at, rate });
    if (buckets.size > maxBuckets) buckets.delete(buckets.keys().next().value!);
    return {
      allowed,
      limit: rate,
      remaining: Math.floor(left),
      resetS: Math.ceil((rate - left) / rate),
      retryAfterS: allowed ? 0 : Math.max(1, Math.ceil((1 - left) / rate)),
    };
  }

  return { take, size: () => buckets.size };
}

export type TokenBuckets = ReturnType<typeof createTokenBuckets>;
