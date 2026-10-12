import { Hono } from 'hono';
import type { Logger } from 'pino';
import { withAccess } from './access/middleware';
import type { AccessResolver } from './access/resolver';
import { accessRoutes } from './access/routes';
import { createAdminGate } from './admin/gate';
import { adminRoutes } from './admin/routes';
import type { Auth } from './auth/auth';
import { authRoutes } from './auth/routes';
import type { AppDb } from './db/app-db';
import { requestLogger, silentLogger } from './obs/logger';
import { createMetrics, httpMetrics, metricsEndpoint, type Metrics } from './obs/metrics';
import { requestId } from './obs/request-id';

export type AppObs = { logger?: Logger; metrics?: Metrics; metricsAllow?: readonly string[] };

export function createApp({ auth, access, db, obs = {} }: { auth: Auth; access: AccessResolver; db: AppDb; obs?: AppObs }) {
  const { logger = silentLogger, metrics = createMetrics(), metricsAllow = [] } = obs;
  const app = new Hono();
  // Registered before every route: Hono runs handlers in registration order.
  app.use(httpMetrics(metrics), requestId(), requestLogger(logger));
  app.get('/metrics', metricsEndpoint(metrics, metricsAllow));
  app.get('/health', c => c.json({ ok: true }));
  // Before the access middleware, so sign-in traffic never pays for a plan lookup.
  app.route('/api', authRoutes(auth));
  app.use('/api/v1/*', withAccess(auth, access));
  app.route('/api/v1', accessRoutes(access));
  app.route('/api/admin', adminRoutes({ auth, db, access, gate: createAdminGate(auth, db) }));
  return app;
}
