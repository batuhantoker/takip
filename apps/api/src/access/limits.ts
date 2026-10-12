import type { Entitlements } from '@takip/core/entitlements';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { addressBlock } from './client-ip';
import type { AccessEnv } from './middleware';
import type { Principal } from './principal';
import { createTokenBuckets, type TokenBuckets } from './token-buckets';
import { DAY_MS, routeGroup, utcDay, type Usage } from './usage';

// A map view fires several data calls at once (Flight Watch cards, tile chunks); keys keep one second, per plan.
const WEB_BURST_SECONDS = 3;
// One replay viewport loads 8–150 immutable chunks in a single burst.
const REPLAY_BURST = 200;
export const REPLAY_GROUP = 'replay';

/** The caller a limit is kept against: a key, an account, or an anonymous visitor's address block. */
export const bucketKey = (p: Principal) =>
  p.kind === 'key' ? `key:${p.keyId}` : p.kind === 'user' ? `user:${p.userId}` : `ip:${addressBlock(p.ip)}`;

/** Requests per second the caller's plan allows: `api.rps` for keys, `web.rps` otherwise. */
export const planRate = (e: Entitlements, p: Principal) => e[p.kind === 'key' ? 'api.rps' : 'web.rps'];
const planBurst = (rate: number, p: Principal) => (p.kind === 'key' ? rate : rate * WEB_BURST_SECONDS);

export type RateLimitOptions = {
  buckets?: TokenBuckets;
  now?: () => number;
  enforce?: boolean;
  rate?: (e: Entitlements, p: Principal) => number;
  burst?: (rate: number, p: Principal) => number;
  /** The usage route group; by default the matched /api/v1 route's (routeGroup). */
  group?: string;
};

function setHeaders(c: Context, headers: Record<string, string>) {
  try {
    for (const [name, value] of Object.entries(headers)) c.res.headers.set(name, value);
  } catch {
    // A response passed through from fetch() has immutable headers.
    c.res = new Response(c.res.body, c.res);
    for (const [name, value] of Object.entries(headers)) c.res.headers.set(name, value);
  }
}

/**
 * Requests per second from the caller's plan (`rate`, planRate by default) and, for keys, the owner's
 * `api.requests_per_day`, which resets at UTC midnight (backend.md §5.3). Admitted requests are counted
 * here, before the handler, so concurrent requests can't overshoot the quota.
 */
export function rateLimit(
  usage: Usage,
  { buckets = createTokenBuckets(), now = () => Date.now(), enforce = true, rate = planRate, burst = planBurst, group: fixedGroup }: RateLimitOptions = {},
) {
  return createMiddleware<AccessEnv>(async (c, next) => {
    const { principal, access } = c.var;
    const group = fixedGroup ?? routeGroup(c);
    if (!enforce) {
      usage.admit(principal, group);
      return next();
    }

    if (principal.kind === 'key') {
      const limit = access.entitlements['api.requests_per_day'];
      const used = usage.quotaUsed(principal.userId);
      if (used >= limit) {
        const at = now();
        const resetAt = (utcDay(at) + 1) * DAY_MS;
        const retryAfter = Math.max(1, Math.ceil((resetAt - at) / 1000));
        usage.deny(principal, group);
        return c.json(
          { error: 'quota_exceeded', limit, used, reset_at: new Date(resetAt).toISOString(), retry_after: retryAfter },
          429,
          { 'RateLimit-Limit': String(limit), 'RateLimit-Remaining': '0', 'RateLimit-Reset': String(retryAfter), 'Retry-After': String(retryAfter) },
        );
      }
    }

    const perSecond = rate(access.entitlements, principal);
    const taken = buckets.take(bucketKey(principal), perSecond, burst(perSecond, principal));
    const headers = {
      'RateLimit-Limit': String(taken.limit),
      'RateLimit-Remaining': String(taken.remaining),
      'RateLimit-Reset': String(taken.resetS),
    };
    if (!taken.allowed) {
      usage.deny(principal, group);
      return c.json({ error: 'rate_limited', retry_after: taken.retryAfterS }, 429, { ...headers, 'Retry-After': String(taken.retryAfterS) });
    }
    usage.admit(principal, group);
    await next();
    setHeaders(c, headers);
  });
}

/** /api/replay, on buckets of its own so a viewport never drains the /api/v1 budget: 200 deep, refilled at twice the plan rate. */
export function replayRateLimit(usage: Usage, options: Pick<RateLimitOptions, 'now' | 'enforce'> = {}) {
  return rateLimit(usage, {
    ...options,
    buckets: createTokenBuckets(),
    rate: (e, p) => 2 * planRate(e, p),
    burst: () => REPLAY_BURST,
    group: REPLAY_GROUP,
  });
}
