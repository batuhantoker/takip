const SWEEP_EVERY_MS = 10_000;
// A plan with no allowance at all: ask again in a minute, in case an operator raises it.
const NO_ALLOWANCE_RETRY_S = 60;

export type Take = { allowed: boolean; limit: number; remaining: number; resetS: number; retryAfterS: number };

type Bucket = { tokens: number; at: number; rate: number; burst: number };

/** One bucket per key, holding `burst` tokens (one second's worth by default) and refilling continuously at `rate` per second. */
export function createTokenBuckets({ now = () => Date.now(), maxBuckets = 100_000 } = {}) {
  // Insertion order is last use, so the first entry is the least recently used.
  const buckets = new Map<string, Bucket>();
  let sweptAt = now();

  const tokensAt = (b: Bucket, at: number, rate: number, burst: number) => Math.min(burst, b.tokens + ((at - b.at) / 1000) * rate);

  function sweep(at: number) {
    sweptAt = at;
    // A full bucket is the same as none.
    for (const [key, b] of buckets) if (tokensAt(b, at, b.rate, b.burst) >= b.burst) buckets.delete(key);
  }

  const tokensOf = (key: string, at: number, rate: number, burst: number) => {
    const prev = buckets.get(key);
    return prev ? tokensAt(prev, at, rate, burst) : burst;
  };

  const answer = (allowed: boolean, left: number, rate: number, burst: number): Take => ({
    allowed,
    limit: rate,
    remaining: Math.floor(left),
    resetS: Math.ceil((burst - left) / rate),
    retryAfterS: allowed ? 0 : Math.max(1, Math.ceil((1 - left) / rate)),
  });

  const noAllowance = (): Take => ({ allowed: false, limit: 0, remaining: 0, resetS: NO_ALLOWANCE_RETRY_S, retryAfterS: NO_ALLOWANCE_RETRY_S });

  function take(key: string, rate: number, burst = rate): Take {
    const at = now();
    if (at - sweptAt >= SWEEP_EVERY_MS) sweep(at);
    if (rate <= 0) return noAllowance();

    const tokens = tokensOf(key, at, rate, burst);
    const allowed = tokens >= 1;
    const left = allowed ? tokens - 1 : tokens;
    buckets.delete(key);
    buckets.set(key, { tokens: left, at, rate, burst });
    if (buckets.size > maxBuckets) buckets.delete(buckets.keys().next().value!);
    return answer(allowed, left, rate, burst);
  }

  /** What `take` would answer now, without spending a token. */
  function peek(key: string, rate: number, burst = rate): Take {
    if (rate <= 0) return noAllowance();
    const tokens = tokensOf(key, now(), rate, burst);
    return answer(tokens >= 1, tokens, rate, burst);
  }

  return { take, peek, size: () => buckets.size };
}

export type TokenBuckets = ReturnType<typeof createTokenBuckets>;
