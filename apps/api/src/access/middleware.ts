import { createMiddleware } from 'hono/factory';
import type { Auth } from '../auth/auth';
import type { Access, BoolEntitlement } from '@takip/core/entitlements';
import { clientIpOf } from './client-ip';
import { subjectOf, type Principal } from './principal';
import type { AccessResolver } from './resolver';

export type { Principal } from './principal';
export type AccessEnv = { Variables: { principal: Principal; access: Access } };

/** Who is calling and what their plan allows (backend.md §5.1–5.2). API keys join here later. */
export function withAccess(auth: Auth, access: AccessResolver) {
  return createMiddleware<AccessEnv>(async (c, next) => {
    const ip = clientIpOf(c);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const principal: Principal = session ? { kind: 'user', userId: session.user.id, ip } : { kind: 'anon', ip };
    c.set('principal', principal);
    c.set('access', access.resolve(subjectOf(principal)));
    await next();
  });
}

/** Refuses the request unless the caller's plan turns `key` on; the web app shows an upgrade prompt. */
export function requires(key: BoolEntitlement) {
  return createMiddleware<AccessEnv>(async (c, next) => {
    if (!c.var.access.entitlements[key]) {
      return c.json({ error: 'entitlement_required', entitlement: key, upgrade_url: '/pricing' }, 403);
    }
    await next();
  });
}
