import { Hono } from 'hono';
import type { Auth } from './auth';

/** Mounted at /api. */
export function authRoutes(auth: Auth) {
  const app = new Hono();
  // The admin plugin's own endpoints would skip the console's 2FA gate; the console calls the plugin server-side.
  app.all('/auth/admin/*', c => c.notFound());
  app.on(['GET', 'POST'], '/auth/*', c => auth.handler(c.req.raw));
  app.get('/v1/auth/providers', c =>
    c.json({ providers: Object.keys(auth.options.socialProviders ?? {}) }, 200, { 'Cache-Control': 'public, max-age=60' }));
  return app;
}
