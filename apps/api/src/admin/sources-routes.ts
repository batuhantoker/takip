import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDb } from '../db/app-db';
import type { SourceSwitchboard } from '../replay/sources';
import type { AdminEnv } from './gate';

const switches = z
  .object({ record: z.boolean().optional(), build: z.boolean().optional() })
  .strict()
  .refine(b => b.record !== undefined || b.build !== undefined, { message: 'set record, build or both' });

/** Mounted at /api/admin/sources behind the gate: turn recording and history building on or off per source. */
export function sourcesRoutes({ db, switchboard }: { db: AppDb; switchboard: SourceSwitchboard }) {
  const app = new Hono<AdminEnv>();

  app.get('/', c => c.json({ sources: switchboard.list() }));

  app.put('/:code', async c => {
    const parsed = switches.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    const code = c.req.param('code');
    const source = switchboard.set(code, parsed.data, `admin:${c.var.admin.userId}`);
    if (!source) return c.json({ error: 'not_found' }, 404);
    db.prepare(`
      INSERT INTO audit_event (at, actor_type, actor_id, action, subject_type, subject_id, data)
      VALUES (?, 'admin', ?, 'source.switch', 'source', ?, ?)`,
    ).run(Date.now(), c.var.admin.userId, code, JSON.stringify({ code, record: source.record, build: source.build }));
    return c.json({ ok: true, source });
  });

  return app;
}
