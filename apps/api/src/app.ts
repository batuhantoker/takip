import { Hono } from 'hono';
import { withAccess } from './access/middleware';
import type { AccessResolver } from './access/resolver';
import { accessRoutes } from './access/routes';
import { createAdminGate } from './admin/gate';
import { adminRoutes } from './admin/routes';
import type { Auth } from './auth/auth';
import { authRoutes } from './auth/routes';
import type { AppDb } from './db/app-db';

export function createApp({ auth, access, db }: { auth: Auth; access: AccessResolver; db: AppDb }) {
  const app = new Hono();
  app.get('/health', c => c.json({ ok: true }));
  // Before the access middleware, so sign-in traffic never pays for a plan lookup.
  app.route('/api', authRoutes(auth));
  app.use('/api/v1/*', withAccess(auth, access));
  app.route('/api/v1', accessRoutes(access));
  app.route('/api/admin', adminRoutes({ auth, db, access, gate: createAdminGate(auth, db) }));
  return app;
}
