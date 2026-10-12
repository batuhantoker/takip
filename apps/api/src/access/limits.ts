import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { addressBlock } from './client-ip';
import type { AccessEnv } from './middleware';
import type { Principal } from './principal';
import { createTokenBuckets, type TokenBuckets } from './token-buckets';
import { DAY_MS, routeGroup, utcDay, type Usage } from './usage';

// A map view fires several data calls at once (Flight Watch cards, tile chunks); keys keep one second, per plan.
const WEB_BURST_SECONDS = 3;

const bucketKey = (p: Principal) =>
  p.kind === 'key' ? `key:${p.keyId}` : p.kind === 'user' ? `user:${p.userId}` : `ip:${addressBlock(p.ip)}`;

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
 * Requests per second from the caller's plan (`api.rps` for keys, `web.rps` otherwise) and, for keys, the
 * owner's `api.requests_per_day`, which resets at UTC midnight (backend.md §5.3). Admitted requests are
 * counted here, before the handler, so concurrent requests can't overshoot the quota.
 */
export function rateLimit(
  usage: Usage,
  { buckets = createTokenBuckets(), now = () => Date.now(), enforce = true }: { buckets?: TokenBuckets; now?: () => number; enforce?: boolean } = {},
) {
  return createMiddleware<AccessEnv>(async (c, next) => {
    const { principal, access } = c.var;
    const group = routeGroup(c);
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

    const rate = access.entitlements[principal.kind === 'key' ? 'api.rps' : 'web.rps'];
    const taken = buckets.take(bucketKey(principal), rate, principal.kind === 'key' ? rate : rate * WEB_BURST_SECONDS);
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
