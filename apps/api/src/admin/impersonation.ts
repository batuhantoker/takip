import type { Context } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import type { Auth } from '../auth/auth';
import type { AppDb } from '../db/app-db';
import type { AdminEnv } from './gate';

const startBody = z.object({ reason: z.string().trim().min(1).max(500) });

type Target = { role: string | null; banned: number | null; banExpires: string | null };

/** Better Auth sets its cookies on its own context; the browser only sees what reaches ours. */
function forwardCookies(c: Context, headers: Headers) {
  for (const line of headers.getSetCookie()) c.header('Set-Cookie', line, { append: true });
}

/**
 * "View as" a user through the admin plugin, called server-side like ban and unban. Start sits behind the
 * gate; stop can't, because the session asking is the user's. Both are audited with `impersonator` set.
 */
export function impersonation({ auth, db, now = () => Date.now() }: { auth: Auth; db: AppDb; now?: () => number }) {
  const target = db.prepare('SELECT role, banned, banExpires FROM auth_user WHERE id = ?');
  const audit = db.prepare(`
    INSERT INTO audit_event (at, actor_type, actor_id, impersonator, action, subject_type, subject_id, data)
    VALUES (?, 'admin', ?, ?, ?, 'user', ?, ?)`);
  const record = (adminId: string, action: string, userId: string, data: object) =>
    audit.run(now(), adminId, adminId, action, userId, JSON.stringify(data));

  return {
    async start(c: Context<AdminEnv>) {
      const parsed = startBody.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
      const userId = c.req.param('id')!;
      const row = target.get(userId) as Target | undefined;
      if (!row) return c.json({ error: 'not_found' }, 404);
      // Covers the admin themselves too.
      if (row.role === 'admin') return c.json({ error: 'cannot_impersonate_admin' }, 403);
      // Better Auth gives a banned user no new session, impersonated ones included.
      if (row.banned === 1 && (!row.banExpires || Date.parse(row.banExpires) > now())) return c.json({ error: 'cannot_impersonate_banned' }, 409);

      const { headers, response } = await auth.api.impersonateUser({ headers: c.req.raw.headers, body: { userId }, returnHeaders: true });
      forwardCookies(c, headers);
      const expiresAt = new Date(response.session.expiresAt).getTime();
      record(c.var.admin.userId, 'impersonation.start', userId, { reason: parsed.data.reason, sessionId: response.session.id, expiresAt });
      return c.json({ ok: true, expiresAt });
    },

    async stop(c: Context) {
      const headers = c.req.raw.headers;
      const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
      if (!session) return c.json({ error: 'sign_in_required' }, 401);
      const adminId = session.session.impersonatedBy;
      if (!adminId) return c.json({ error: 'not_impersonating' }, 400);

      const back = await auth.api.stopImpersonating({ headers, returnHeaders: true }).then(r => r.headers, () => null);
      if (back) {
        forwardCookies(c, back);
        // Left over from the impersonated session, it would turn the admin's own into a "don't remember me" one.
        const { name, attributes } = (await auth.$context).authCookies.dontRememberToken;
        if (!back.getSetCookie().some(line => line.startsWith(`${name}=`))) deleteCookie(c, name, { path: attributes.path ?? '/', secure: attributes.secure });
      } else {
        // The admin's own session ended meanwhile: this one ends anyway, signed out.
        forwardCookies(c, (await auth.api.signOut({ headers, returnHeaders: true })).headers);
      }
      const restored = back !== null;
      record(adminId, 'impersonation.stop', session.user.id, { sessionId: session.session.id, restored });
      return c.json({ ok: true, userId: session.user.id, restored }, 200, { 'Cache-Control': 'no-store' });
    },
  };
}
