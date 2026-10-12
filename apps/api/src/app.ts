import { Hono } from 'hono';
import type { Logger } from 'pino';
import { clientIp, ipTrust, type IpTrust } from './access/client-ip';
import { rateLimit, REPLAY_GROUP, replayRateLimit } from './access/limits';
import { withAccess } from './access/middleware';
import type { AccessResolver } from './access/resolver';
import { accessRoutes } from './access/routes';
import { createUsage, meter, type Usage } from './access/usage';
import { usageRoutes } from './access/usage-routes';
import { createAdminGate } from './admin/gate';
import { adminRoutes } from './admin/routes';
import type { Auth } from './auth/auth';
import { authRoutes } from './auth/routes';
import type { BillingProvider } from './billing/provider';
import { billingRoutes } from './billing/routes';
import type { AppDb } from './db/app-db';
import { createApiKeys, type ApiKeys } from './keys/api-keys';
import { keyRoutes } from './keys/routes';
import { requiresScope } from './keys/scopes';
import { requestLogger, silentLogger } from './obs/logger';
import { createMetrics, httpMetrics, metricsEndpoint, type Metrics } from './obs/metrics';
import { requestId } from './obs/request-id';
import { unhandledError } from './obs/unhandled-error';
import { privacyRoutes } from './privacy/routes';
import type { ReplayData } from './replay/data';
import { replayRoutes } from './replay/routes';
import type { SourceSwitchboard } from './replay/sources';
import { v1Routes } from './v1/openapi';

export type AppObs = { logger?: Logger; metrics?: Metrics; metricsAllow?: readonly string[] };

export function createApp({ auth, access, db, replay, switchboard, billing = null, obs = {}, trust = ipTrust(), usage = createUsage(db), keys = createApiKeys(db), enforceLimits = true }: {
  auth: Auth; access: AccessResolver; db: AppDb; replay?: ReplayData; switchboard?: SourceSwitchboard; billing?: BillingProvider | null;
  obs?: AppObs; trust?: IpTrust; usage?: Usage; keys?: ApiKeys; enforceLimits?: boolean;
}) {
  const { logger = silentLogger, metrics = createMetrics(), metricsAllow = [] } = obs;
  const app = new Hono();
  app.onError(unhandledError(logger));
  // Registered before every route: Hono runs handlers in registration order.
  app.use(httpMetrics(metrics), requestId(), requestLogger(logger));
  app.get('/metrics', metricsEndpoint(metrics, metricsAllow));
  app.get('/health', c => c.json({ ok: true }));
  // Before the auth routes: Better Auth records the address it resolves.
  app.use('/api/*', clientIp(trust));
  // Before the access middleware, so sign-in traffic never pays for a plan lookup.
  app.route('/api', authRoutes(auth));
  app.use('/api/v1/*', withAccess(auth, access, keys));
  app.use('/api/v1/*', rateLimit(usage, { enforce: enforceLimits }), meter(usage));
  app.route('/api/v1', accessRoutes(access));
  app.route('/api/v1', usageRoutes(usage));
  app.route('/api/v1', keyRoutes(keys));
  app.route('/api/v1', privacyRoutes({ db, auth, usage }));
  app.route('/api/v1', v1Routes({ db }));
  if (replay) {
    app.use('/api/replay/*', withAccess(auth, access, keys));
    app.use('/api/replay/*', replayRateLimit(usage, { enforce: enforceLimits }), meter(usage, REPLAY_GROUP), requiresScope('read:tracks'));
    app.route('/api/replay', replayRoutes(replay));
  }
  app.route('/api/billing', billingRoutes({ db, auth, access, provider: billing }));
  app.route('/api/admin', adminRoutes({ auth, db, access, gate: createAdminGate(auth, db), switchboard, keys, usage, billing }));
  return app;
}
