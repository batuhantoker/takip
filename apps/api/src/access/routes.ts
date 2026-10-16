import { Hono } from 'hono';
import type { KeyPolicy } from './key-policy';
import type { AccessEnv } from './middleware';
import { subjectOf } from './principal';
import type { AccessResolver } from './resolver';

export function accessRoutes(access: AccessResolver, policy: KeyPolicy) {
  const app = new Hono<AccessEnv>();
  app.get('/me/access', c => c.json({ ...c.var.access, subject: subjectOf(c.var.principal) }, 200, { 'Cache-Control': 'private, no-store' }));
  app.get('/plans', c => c.json({ plans: access.publicPlans() }, 200, { 'Cache-Control': 'public, max-age=60' }));
  // Which endpoints answer without a key, for API users; the admin view adds who switched them.
  app.get('/key-policy', c => c.json(
    { groups: policy.list().map(({ group, label, paths, keyRequired }) => ({ group, label, paths, keyRequired })) },
    200,
    { 'Cache-Control': 'public, max-age=30' },
  ));
  return app;
}
