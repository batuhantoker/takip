import { serve } from '@hono/node-server';
import { createTransport } from 'nodemailer';
import { createAccess } from './access/resolver';
import { createApp } from './app';
import { createAuth } from './auth/auth';
import { openAppDb } from './db/app-db';
import { migrateAppSchema } from './db/migrations';
import { consoleSender, smtpSender } from './mail/sender';
import { loadEnv, loadEnvFiles } from './env';

loadEnvFiles();
const env = loadEnv();
const db = openAppDb(env.APP_DB_PATH);
migrateAppSchema(db);
const email = env.SMTP_URL && env.MAIL_FROM ? smtpSender(createTransport(env.SMTP_URL), env.MAIL_FROM) : consoleSender;
const auth = await createAuth(db, env, email);

const app = createApp({ auth, access: createAccess(db), db });

const server = serve({ fetch: app.fetch, hostname: env.API_HOST, port: env.API_PORT }, info => {
  console.log(`[api] listening on http://${info.address}:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => {
    db.close();
    process.exit(0);
  }));
}
