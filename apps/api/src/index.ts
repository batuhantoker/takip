import { serve } from '@hono/node-server';
import { join } from 'node:path';
import { createTransport } from 'nodemailer';
import { ipTrust } from './access/client-ip';
import { createAccess } from './access/resolver';
import { createUsage } from './access/usage';
import { schedulePruneUsage, usageJobs } from './access/usage-prune';
import { createApp } from './app';
import { createAuth } from './auth/auth';
import { billingJobs, scheduleReconcile } from './billing/reconcile';
import { billingProviderFor } from './billing/registry';
import { openAppDb } from './db/app-db';
import { migrateAppSchema } from './db/migrations';
import { createJobQueue } from './jobs/queue';
import { createJobRunner } from './jobs/runner';
import { consoleSender, smtpSender } from './mail/sender';
import { openReplayData } from './replay/data';
import { openSourceSwitchboard } from './replay/sources';
import { loadEnv, loadEnvFiles } from './env';
import { createLogger } from './obs/logger';
import { createMetrics } from './obs/metrics';

loadEnvFiles();
const env = loadEnv();
const logger = createLogger(env);
const db = openAppDb(env.APP_DB_PATH);
migrateAppSchema(db);
const email = env.SMTP_URL && env.MAIL_FROM ? smtpSender(createTransport(env.SMTP_URL), env.MAIL_FROM) : consoleSender;
const auth = await createAuth(db, env, email);

const replay = openReplayData(env.TAKIP_DATA_DIR);
const switchboard = openSourceSwitchboard({ dataDir: env.TAKIP_DATA_DIR, archiveDir: env.TAKIP_ARCHIVE_DIR ?? join(env.TAKIP_DATA_DIR, 'archive') });
const usage = createUsage(db, { logger });
const stopUsage = usage.start();
const trust = ipTrust({ trustedProxies: env.TRUSTED_PROXIES, cloudflare: env.CLOUDFLARE_EDGE });

const access = createAccess(db);
const billing = billingProviderFor(env);
const jobs = createJobQueue(db);
if (billing) scheduleReconcile(jobs, Date.now());
schedulePruneUsage(jobs, Date.now());
const retention = { days: env.USAGE_RETENTION_DAYS, anonDays: env.USAGE_ANON_RETENTION_DAYS };
const stopJobs = createJobRunner(jobs, {
  ...billingJobs({ db, access, provider: billing, queue: jobs, logger }),
  ...usageJobs({ db, queue: jobs, retention, logger }),
}, { logger }).start();

const metrics = createMetrics({ defaults: true });
const app = createApp({ auth, access, db, replay, switchboard, billing, obs: { logger, metrics, metricsAllow: env.METRICS_ALLOW }, trust, usage });

const server = serve({ fetch: app.fetch, hostname: env.API_HOST, port: env.API_PORT }, info => {
  logger.info(`listening on http://${info.address}:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await stopJobs();
      stopUsage();
      db.close();
      replay.close();
      switchboard.close();
      process.exit(0);
    });
  });
}
