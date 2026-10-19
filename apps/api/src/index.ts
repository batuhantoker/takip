import { serve } from '@hono/node-server';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTransport } from 'nodemailer';
import { ipTrust } from './access/client-ip';
import { createMapTime } from './access/map-time';
import { createAccess } from './access/resolver';
import { createUsage } from './access/usage';
import { schedulePruneUsage, usageJobs } from './access/usage-prune';
import { auditJobs, schedulePruneAudit } from './audit/audit-prune';
import { createApp } from './app';
import { createAuth } from './auth/auth';
import { billingJobs, scheduleReconcile } from './billing/reconcile';
import { billingProviderFor } from './billing/registry';
import { openAppDb } from './db/app-db';
import { backupJobs, scheduleBackup } from './db/backup';
import { migrateAppSchema } from './db/migrations';
import { jobQueueJobs, schedulePruneJobs } from './jobs/jobs-prune';
import { createJobQueue } from './jobs/queue';
import { createJobRunner } from './jobs/runner';
import { createApiKeys } from './keys/api-keys';
import { createMailQueue } from './mail/mail-queue';
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
const billing = billingProviderFor(env);
const jobs = createJobQueue(db);
const mail = createMailQueue(jobs, email, { logger });
const auth = await createAuth(db, env, mail.sender, { billingPortal: billing !== null, logger });

const replay = openReplayData(env.TAKIP_DATA_DIR);
const switchboard = openSourceSwitchboard({ dataDir: env.TAKIP_DATA_DIR, archiveDir: env.TAKIP_ARCHIVE_DIR ?? join(env.TAKIP_DATA_DIR, 'archive') });
const usage = createUsage(db, { logger });
const keys = createApiKeys(db, { logger });
// A stable salt keeps visitors' map minutes across restarts.
const mapTime = createMapTime(db, env.BETTER_AUTH_SECRET ? { salt: env.BETTER_AUTH_SECRET } : {});
const stopUsage = usage.start();
const trust = ipTrust({ trustedProxies: env.TRUSTED_PROXIES, cloudflare: env.CLOUDFLARE_EDGE });

const access = createAccess(db);
if (billing) scheduleReconcile(jobs, Date.now());
schedulePruneUsage(jobs, Date.now());
schedulePruneAudit(jobs, Date.now());
schedulePruneJobs(jobs, Date.now());
scheduleBackup(jobs, Date.now());
const retention = { days: env.USAGE_RETENTION_DAYS, anonDays: env.USAGE_ANON_RETENTION_DAYS, activityDays: env.ACTIVITY_RETENTION_DAYS };
const stopJobs = createJobRunner(jobs, {
  ...billingJobs({ db, access, provider: billing, queue: jobs, logger }),
  ...usageJobs({ db, queue: jobs, retention, logger }),
  ...auditJobs({ db, queue: jobs, days: env.AUDIT_RETENTION_DAYS, logger }),
  ...jobQueueJobs({ db, queue: jobs, days: env.JOB_RETENTION_DAYS, logger }),
  ...backupJobs({ db, queue: jobs, dir: env.APP_BACKUP_DIR, keep: env.APP_BACKUP_KEEP, logger }),
}, { logger }).start();
const stopMail = mail.start();

const metrics = createMetrics({ defaults: true });
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const analytics = {
  startedAt: Date.now() - process.uptime() * 1000,
  dirs: {
    root: repoRoot,
    dataDir: env.TAKIP_DATA_DIR,
    archiveDir: env.TAKIP_ARCHIVE_DIR ?? join(env.TAKIP_DATA_DIR, 'archive'),
    backupDir: env.APP_BACKUP_DIR,
    // The web app's file caches: the camera catalogue, vessels, geocoder and the like.
    cacheDir: join(repoRoot, '.cache'),
    appDbPath: env.APP_DB_PATH,
  },
};
const app = createApp({ auth, access, db, replay, switchboard, billing, obs: { logger, metrics, metricsAllow: env.METRICS_ALLOW }, trust, usage, keys, mapTime, analytics });

const server = serve({ fetch: app.fetch, hostname: env.API_HOST, port: env.API_PORT }, info => {
  logger.info(`listening on http://${info.address}:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await stopJobs();
      await stopMail();
      stopUsage();
      db.close();
      replay.close();
      switchboard.close();
      process.exit(0);
    });
  });
}
