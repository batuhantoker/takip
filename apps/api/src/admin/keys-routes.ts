import { Hono } from 'hono';
import { z } from 'zod';
import type { ApiKeys } from '../keys/api-keys';
import type { AdminEnv } from './gate';

const listQuery = z.object({
  state: z.enum(['active', 'expired', 'revoked']).optional(),
  q: z.string().max(200).default(''),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Mounted at /api/admin/keys behind the gate: every user's keys. Revoking goes through /users/:id/keys/:keyId. */
export function allKeysRoutes(keys: ApiKeys) {
  const app = new Hono<AdminEnv>();

  app.get('/', c => {
    const parsed = listQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    return c.json(keys.listAll(parsed.data));
  });

  return app;
}
