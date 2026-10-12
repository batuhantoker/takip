import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AccessEnv } from '../access/middleware';
import type { ApiKeys } from './api-keys';
import { SCOPES } from './scopes';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

const createBody = z.object({
  name: z.string().trim().min(1).max(64),
  scopes: z.array(z.enum(SCOPES)).max(SCOPES.length).optional(),
  // "YYYY-MM-DD", like the admin console's dates: the key works until the end of that day (UTC).
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform(day => Date.parse(`${day}T23:59:59.999Z`)).nullish(),
});

/** The signed-in user; a key never manages keys, so a leaked one can't mint more or lock its owner out. */
function sessionUser(c: Context<AccessEnv>): string | Response {
  const { principal } = c.var;
  if (principal.kind === 'user') return principal.userId;
  if (principal.kind === 'key') return c.json({ error: 'session_required' }, 403);
  return c.json({ error: 'sign_in_required' }, 401);
}

/** Mounted at /api/v1: the caller's own keys (Account → API keys). */
export function keyRoutes(keys: ApiKeys, now = () => Date.now()) {
  const app = new Hono<AccessEnv>();

  app.get('/keys', c => {
    const userId = sessionUser(c);
    if (userId instanceof Response) return userId;
    return c.json({ keys: keys.list(userId) }, 200, NO_STORE);
  });

  app.post('/keys', async c => {
    const userId = sessionUser(c);
    if (userId instanceof Response) return userId;
    const parsed = createBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    const { name, scopes = [], expiresAt = null } = parsed.data;
    if (expiresAt !== null && expiresAt <= now()) return c.json({ error: 'invalid_request', message: 'expiresAt is in the past' }, 400);

    const { entitlements } = c.var.access;
    if (!entitlements['api.enabled']) return c.json({ error: 'entitlement_required', entitlement: 'api.enabled', upgrade_url: '/pricing' }, 403);
    const max = entitlements['api.keys.max'];
    const created = keys.create({ userId, name, scopes: [...new Set(scopes)], expiresAt, max });
    if (!created) return c.json({ error: 'limit_reached', entitlement: 'api.keys.max', limit: max, upgrade_url: '/pricing' }, 403);
    return c.json(created, 201, NO_STORE);
  });

  app.delete('/keys/:id', c => {
    const userId = sessionUser(c);
    if (userId instanceof Response) return userId;
    const revoked = keys.revoke(userId, c.req.param('id'), { type: 'user', id: userId });
    return revoked ? c.json({ ok: true }) : c.json({ error: 'not_found' }, 404);
  });

  return app;
}
