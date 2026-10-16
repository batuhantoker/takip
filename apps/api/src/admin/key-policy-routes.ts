import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { KeyPolicy } from '../access/key-policy';
import { utcDay, type Usage } from '../access/usage';
import type { AppDb } from '../db/app-db';
import type { AdminEnv } from './gate';

const WEEK_DAYS = 7;
const switchBody = z.object({ keyRequired: z.boolean() }).strict();

type Week = { keys: number; accounts: number; anonymous: number; refused: number };
const NO_TRAFFIC: Week = { keys: 0, accounts: 0, anonymous: 0, refused: 0 };

/** Mounted at /api/admin/key-policy behind the gate: which route groups need an API key, with the last week of their traffic. */
export function keyPolicyRoutes({ db, policy, usage, now = () => Date.now() }: { db: AppDb; policy: KeyPolicy; usage: Usage; now?: () => number }) {
  const week = db.prepare(`
    SELECT route_group AS "group",
           coalesce(sum(CASE WHEN key_id != '' THEN requests END), 0) AS keys,
           coalesce(sum(CASE WHEN key_id = '' AND subject_type = 'user' THEN requests END), 0) AS accounts,
           coalesce(sum(CASE WHEN subject_type = 'anon' THEN requests END), 0) AS anonymous,
           coalesce(sum(denied), 0) AS refused
    FROM usage_counter WHERE day >= ? GROUP BY route_group`);
  const app = new Hono<AdminEnv>();

  app.get('/', c => {
    // Counters reach the table every 10 s; flushing first includes the last few seconds.
    usage.flush();
    const rows = week.all(utcDay(now()) - WEEK_DAYS + 1) as (Week & { group: string })[];
    const traffic = new Map(rows.map(({ group, ...counts }) => [group, counts]));
    return c.json({ groups: policy.list().map(g => ({ ...g, week: traffic.get(g.group) ?? NO_TRAFFIC })) });
  });

  async function update(c: Context<AdminEnv>, groups: string[] | null) {
    const parsed = switchBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    if (!policy.set(groups, parsed.data.keyRequired, c.var.admin.userId)) return c.json({ error: 'not_found' }, 404);
    return c.json({ ok: true });
  }

  app.put('/', c => update(c, null));
  app.put('/:group', c => update(c, [c.req.param('group')]));

  return app;
}
