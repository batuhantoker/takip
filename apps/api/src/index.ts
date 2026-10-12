import { serve } from '@hono/node-server';
import { createTransport } from 'nodemailer';
import { createAccess } from './access/resolver';
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

const metrics = createMetrics({ defaults: true });
const app = createApp({ auth, access: createAccess(db), db, obs: { logger, metrics, metricsAllow: env.METRICS_ALLOW } });

const server = serve({ fetch: app.fetch, hostname: env.API_HOST, port: env.API_PORT }, info => {
  logger.info(`listening on http://${info.address}:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
