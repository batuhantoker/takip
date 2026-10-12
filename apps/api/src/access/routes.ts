import { Hono } from 'hono';
import type { AccessEnv } from './middleware';
import { subjectOf } from './principal';
import type { AccessResolver } from './resolver';

export function accessRoutes(access: AccessResolver) {
  const app = new Hono<AccessEnv>();
  app.get('/me/access', c => c.json({ ...c.var.access, subject: subjectOf(c.var.principal) }, 200, { 'Cache-Control': 'private, no-store' }));
  app.get('/plans', c => c.json({ plans: access.publicPlans() }, 200, { 'Cache-Control': 'public, max-age=60' }));
  return app;
}
