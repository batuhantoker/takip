import { Hono } from 'hono';
import { z } from 'zod';
import { DAY_MS, isoDay, utcDay, type Usage } from '../access/usage';
import type { AppDb } from '../db/app-db';
import type { AdminEnv } from './gate';

type Counts = { requests: number; denied: number };

const seriesQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(30) });
const topQuery = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/** Mounted at /api/admin/usage behind the gate: usage_counter summed over everyone. Anonymous callers are daily salted hashes. */
export function adminUsageRoutes({ db, usage, now = () => Date.now() }: { db: AppDb; usage: Usage; now?: () => number }) {
  const byDayAndGroup = db.prepare(`
    SELECT day, route_group AS "group", SUM(requests) AS requests, SUM(denied) AS denied
    FROM usage_counter WHERE day >= ? GROUP BY day, route_group`);
  const consumers = db.prepare(`
    SELECT c.subject_type AS subjectType, c.subject_id AS subjectId, c.key_id AS keyId,
           SUM(c.requests) AS requests, SUM(c.denied) AS denied, SUM(c.bytes) AS bytes,
           json_group_object(c.route_group, c.requests) AS groups,
           u.email, u.name, k.prefix AS keyPrefix, k.name AS keyName
    FROM usage_counter c
    LEFT JOIN auth_user u ON c.subject_type = 'user' AND u.id = c.subject_id
    LEFT JOIN api_key k ON c.key_id != '' AND k.key_id = c.key_id
    WHERE c.day = ?
    GROUP BY c.subject_type, c.subject_id, c.key_id
    ORDER BY requests DESC, denied DESC LIMIT ?`);
  const app = new Hono<AdminEnv>();

  // Counters reach the table every 10 s; flushing first includes the last few seconds.
  app.use('*', async (_c, next) => {
    usage.flush();
    await next();
  });

  /** Requests and refusals per UTC day and route group, oldest first, every day present. */
  app.get('/', c => {
    const parsed = seriesQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    const today = utcDay(now());
    const first = today - parsed.data.days + 1;
    const days = Array.from({ length: parsed.data.days }, (_, i) => ({ day: isoDay(first + i), requests: 0, denied: 0, groups: {} as Record<string, Counts> }));
    const totals = new Map<string, number>();
    for (const row of byDayAndGroup.all(first) as ({ day: number; group: string } & Counts)[]) {
      const entry = days[row.day - first];
      if (!entry) continue;
      entry.requests += row.requests;
      entry.denied += row.denied;
      entry.groups[row.group] = { requests: row.requests, denied: row.denied };
      totals.set(row.group, (totals.get(row.group) ?? 0) + row.requests + row.denied);
    }
    const groups = [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([group]) => group);
    return c.json({ today: isoDay(today), groups, days });
  });

  /** The biggest callers on one day (today by default): each user's session, each key, each anonymous address block. */
  app.get('/top', c => {
    const parsed = topQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    const day = parsed.data.day ? Math.floor(Date.parse(`${parsed.data.day}T00:00:00Z`) / DAY_MS) : utcDay(now());
    const rows = consumers.all(day, parsed.data.limit) as (Counts & { groups: string } & Record<string, unknown>)[];
    return c.json({ day: isoDay(day), consumers: rows.map(row => ({ ...row, groups: JSON.parse(row.groups) as Record<string, number> })) });
  });

  return app;
}
