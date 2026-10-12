import { Hono } from 'hono';
import type { Auth } from './auth';

/** Where the web app explains a deletion link that didn't work (src/lib/account-links.ts). */
export const DELETE_FAILED = '/?account=delete-failed';

/** Mounted at /api. */
export function authRoutes(auth: Auth) {
  const app = new Hono();
  // The admin plugin's own endpoints would skip the console's 2FA gate; the console calls the plugin server-side.
  app.all('/auth/admin/*', c => c.notFound());
  // Better Auth answers a link opened without the account's session, or a spent one, with JSON; land on the map instead.
  app.get('/auth/delete-user/callback', async c => {
    const res = await auth.handler(c.req.raw);
    if (res.status < 400 || res.status >= 500) return res;
    const { code } = (await res.json().catch(() => ({}))) as { code?: unknown };
    return c.redirect(`${DELETE_FAILED}&error=${encodeURIComponent(typeof code === 'string' ? code : 'UNKNOWN')}`);
  });
  app.on(['GET', 'POST'], '/auth/*', c => auth.handler(c.req.raw));
  app.get('/v1/auth/providers', c =>
    c.json({ providers: Object.keys(auth.options.socialProviders ?? {}) }, 200, { 'Cache-Control': 'public, max-age=60' }));
  return app;
}
