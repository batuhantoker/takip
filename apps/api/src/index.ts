import { serve } from '@hono/node-server';
import { createTransport } from 'nodemailer';
import { ipTrust } from './access/client-ip';
import { createAccess } from './access/resolver';
import { createUsage } from './access/usage';
import { createApp } from './app';
import { createAuth } from './auth/auth';
import { openAppDb } from './db/app-db';
import { migrateAppSchema } from './db/migrations';
import { consoleSender, smtpSender } from './mail/sender';
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

const usage = createUsage(db);
const stopUsage = usage.start();
const trust = ipTrust({ trustedProxies: env.TRUSTED_PROXIES, cloudflare: env.CLOUDFLARE_EDGE });

const metrics = createMetrics({ defaults: true });
const app = createApp({ auth, access: createAccess(db), db, obs: { logger, metrics, metricsAllow: env.METRICS_ALLOW }, trust, usage });

const server = serve({ fetch: app.fetch, hostname: env.API_HOST, port: env.API_PORT }, info => {
  logger.info(`listening on http://${info.address}:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      stopUsage();
      db.close();
      process.exit(0);
    });
  });
}
