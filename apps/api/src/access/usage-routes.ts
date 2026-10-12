import { Hono } from 'hono';
import type { AccessEnv } from './middleware';
import { DAY_MS, utcDay, type Usage } from './usage';

export function usageRoutes(usage: Usage, now = () => Date.now()) {
  const app = new Hono<AccessEnv>();
  /** The caller's own requests by route group: today, the last 30 days, and the API-key quota. */
  app.get('/usage', c => {
    const { principal, access } = c.var;
    if (principal.kind === 'anon') return c.json({ error: 'sign_in_required' }, 401);
    const { today, days } = usage.report(principal.userId, 30);
    return c.json(
      {
        day: today,
        today: days.find(d => d.day === today)?.groups ?? {},
        days,
        quota: {
          limit: access.entitlements['api.requests_per_day'],
          used: usage.quotaUsed(principal.userId),
          reset_at: new Date((utcDay(now()) + 1) * DAY_MS).toISOString(),
        },
      },
      200,
      { 'Cache-Control': 'private, no-store' },
    );
  });
  return app;
}
