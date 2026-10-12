import { Hono } from 'hono';
import type { Logger } from 'pino';
import { clientIp, ipTrust, type IpTrust } from './access/client-ip';
import { rateLimit } from './access/limits';
import { withAccess } from './access/middleware';
import type { AccessResolver } from './access/resolver';
import { accessRoutes } from './access/routes';
import { createUsage, meter, type Usage } from './access/usage';
import { usageRoutes } from './access/usage-routes';
import { createAdminGate } from './admin/gate';
import { adminRoutes } from './admin/routes';
import type { Auth } from './auth/auth';
import { authRoutes } from './auth/routes';
import type { AppDb } from './db/app-db';
import { requestLogger, silentLogger } from './obs/logger';
import { createMetrics, httpMetrics, metricsEndpoint, type Metrics } from './obs/metrics';
import { requestId } from './obs/request-id';
import type { ReplayData } from './replay/data';
import { replayRoutes } from './replay/routes';
import type { SourceSwitchboard } from './replay/sources';
import { v1Routes } from './v1/openapi';

export type AppObs = { logger?: Logger; metrics?: Metrics; metricsAllow?: readonly string[] };

export function createApp({ auth, access, db, replay, switchboard, obs = {}, trust = ipTrust(), usage = createUsage(db), enforceLimits = true }: {
  auth: Auth; access: AccessResolver; db: AppDb; replay?: ReplayData; switchboard?: SourceSwitchboard;
  obs?: AppObs; trust?: IpTrust; usage?: Usage; enforceLimits?: boolean;
}) {
  const { logger = silentLogger, metrics = createMetrics(), metricsAllow = [] } = obs;
  const app = new Hono();
  // Registered before every route: Hono runs handlers in registration order.
  app.use(httpMetrics(metrics), requestId(), requestLogger(logger));
  app.get('/metrics', metricsEndpoint(metrics, metricsAllow));
  app.get('/health', c => c.json({ ok: true }));
  // Before the auth routes: Better Auth records the address it resolves.
  app.use('/api/*', clientIp(trust));
  // Before the access middleware, so sign-in traffic never pays for a plan lookup.
  app.route('/api', authRoutes(auth));
  app.use('/api/v1/*', withAccess(auth, access));
  app.use('/api/v1/*', rateLimit(usage, { enforce: enforceLimits }), meter(usage));
  app.route('/api/v1', accessRoutes(access));
  app.route('/api/v1', usageRoutes(usage));
  app.route('/api/v1', v1Routes());
  if (replay) {
    app.use('/api/replay/*', withAccess(auth, access));
    app.route('/api/replay', replayRoutes(replay));
  }
  app.route('/api/admin', adminRoutes({ auth, db, access, gate: createAdminGate(auth, db), switchboard }));
  return app;
}
