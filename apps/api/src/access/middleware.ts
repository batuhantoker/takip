import { createMiddleware } from 'hono/factory';
import type { Auth } from '../auth/auth';
import type { Access, BoolEntitlement } from '@takip/core/entitlements';
import type { ApiKeys } from '../keys/api-keys';
import { bearerToken } from '../keys/token';
import { clientIpOf } from './client-ip';
import { subjectOf, type Principal } from './principal';
import type { AccessResolver } from './resolver';

export type { Principal } from './principal';
export type AccessEnv = { Variables: { principal: Principal; access: Access } };

const entitlementRequired = (key: BoolEntitlement) => ({ error: 'entitlement_required', entitlement: key, upgrade_url: '/pricing' });

/**
 * Who is calling and what their plan allows (backend.md §5.1–5.2): an API key, else the session, else a visitor.
 * With `keys`, a bearer credential must be a live key: it never falls back to the session or to anonymous.
 */
export function withAccess(auth: Auth, access: AccessResolver, keys?: ApiKeys) {
  return createMiddleware<AccessEnv>(async (c, next) => {
    const ip = clientIpOf(c);
    const token = bearerToken(c.req.header('authorization'));
    let principal: Principal;
    if (keys && token !== undefined) {
      const verified = keys.verify(token, ip);
      if (!verified.ok && verified.status === 429) {
        return c.json({ error: verified.error, retry_after: verified.retryAfterS }, 429, { 'Retry-After': String(verified.retryAfterS) });
      }
      if (!verified.ok) {
        return c.json({ error: verified.error }, verified.status, verified.status === 401 ? { 'WWW-Authenticate': 'Bearer error="invalid_token"' } : {});
      }
      const { id, userId, scopes } = verified.key;
      principal = { kind: 'key', keyId: id, userId, ip, scopes };
    } else {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      const impersonatedBy = session?.session.impersonatedBy ?? undefined;
      principal = session ? { kind: 'user', userId: session.user.id, ip, ...(impersonatedBy && { impersonatedBy }) } : { kind: 'anon', ip };
    }
    c.set('principal', principal);
    c.set('access', access.resolve(subjectOf(principal)));
    if (principal.kind === 'key' && !c.var.access.entitlements['api.enabled']) return c.json(entitlementRequired('api.enabled'), 403);
    await next();
  });
}

/** Refuses the request unless the caller's plan turns `key` on; the web app shows an upgrade prompt. */
export function requires(key: BoolEntitlement) {
  return createMiddleware<AccessEnv>(async (c, next) => {
    if (!c.var.access.entitlements[key]) return c.json(entitlementRequired(key), 403);
    await next();
  });
}
