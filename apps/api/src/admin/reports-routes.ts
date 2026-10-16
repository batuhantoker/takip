import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDb } from '../db/app-db';
import { REPORT_STATUSES, reportStore } from '../reports/store';
import type { AdminEnv } from './gate';

const listQuery = z.object({
  status: z.enum(REPORT_STATUSES).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const statusBody = z.object({ status: z.enum(REPORT_STATUSES) });
const reportId = z.coerce.number().int().positive();

/** Mounted at /api/admin/reports behind the gate: issue reports, newest first, and resolving or reopening one. */
export function adminReportRoutes({ db, now = () => Date.now() }: { db: AppDb; now?: () => number }) {
  const store = reportStore(db);
  const audit = db.prepare(`
    INSERT INTO audit_event (at, actor_type, actor_id, action, subject_type, subject_id, data)
    VALUES (?, 'admin', ?, ?, 'report', ?, ?)`);
  const app = new Hono<AdminEnv>();

  app.get('/', c => {
    const parsed = listQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    return c.json(store.list(parsed.data));
  });

  app.put('/:id/status', async c => {
    const parsed = statusBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    const id = reportId.safeParse(c.req.param('id'));
    if (!id.success) return c.json({ error: 'not_found' }, 404);
    const { status } = parsed.data;
    const adminId = c.var.admin.userId;
    const before = db.transaction(() => {
      const at = now();
      const previous = store.setStatus(id.data, status, adminId, at);
      if (previous && previous !== status) {
        audit.run(at, adminId, status === 'resolved' ? 'report.resolve' : 'report.reopen', String(id.data), JSON.stringify({ report: id.data, from: previous, to: status }));
      }
      return previous;
    })();
    if (!before) return c.json({ error: 'not_found' }, 404);
    return c.json({ ok: true, status });
  });

  return app;
}
