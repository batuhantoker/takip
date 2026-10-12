import { Hono } from 'hono';
import type { AccessEnv } from '../access/middleware';
import type { Usage } from '../access/usage';
import type { Auth } from '../auth/auth';
import { APP_NAME } from '../auth/emails';
import type { AppDb } from '../db/app-db';
import { accountExport } from './export';

/** Mounted at /api/v1: the signed-in user's own data. */
export function privacyRoutes({ db, auth, usage, now = () => Date.now() }: { db: AppDb; auth: Auth; usage: Usage; now?: () => number }) {
  const app = new Hono<AccessEnv>();

  app.get('/account/export', async c => {
    const { principal } = c.var;
    // Never a key: a leaked one must not hand over the account's history.
    if (principal.kind === 'key') return c.json({ error: 'session_required' }, 403);
    if (principal.kind === 'anon') return c.json({ error: 'sign_in_required' }, 401);

    const session = await auth.api.getSession({ headers: c.req.raw.headers, query: { disableCookieCache: true } });
    if (!session) return c.json({ error: 'sign_in_required' }, 401);
    // Same rule as Better Auth's device list, which shows the same addresses.
    const { freshAge } = (await auth.$context).sessionConfig;
    if (freshAge && now() - new Date(session.session.createdAt).getTime() >= freshAge * 1000) {
      return c.json({ error: 'session_not_fresh' }, 403);
    }

    usage.flush();
    const data = accountExport(db, session.user.id, { access: c.var.access, currentSessionId: session.session.id, now: now() });
    if (!data) return c.json({ error: 'sign_in_required' }, 401);
    const filename = `${APP_NAME.toLowerCase()}-account-${new Date(now()).toISOString().slice(0, 10)}.json`;
    return c.body(JSON.stringify(data, null, 2), 200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    });
  });

  return app;
}
