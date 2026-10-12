import { Hono } from 'hono';
import type { AdminEnv } from '../admin/gate';
import type { ApiKeys } from './api-keys';

/** Mounted at /api/admin/users behind the gate: a user's keys, revoked ones included, and revoking one. */
export function adminKeyRoutes(keys: ApiKeys) {
  const app = new Hono<AdminEnv>();

  app.get('/:id/keys', c => c.json({ keys: keys.list(c.req.param('id'), { revoked: true }) }));

  app.delete('/:id/keys/:keyId', c => {
    const revoked = keys.revoke(c.req.param('id'), c.req.param('keyId'), { type: 'admin', id: c.var.admin.userId });
    return revoked ? c.json({ ok: true }) : c.json({ error: 'not_found' }, 404);
  });

  return app;
}
