import { Hono } from 'hono';
import type { BillingProvider } from '../billing/provider';
import { RECONCILE_JOB } from '../billing/reconcile';
import type { AppDb } from '../db/app-db';
import { createJobQueue } from '../jobs/queue';
import type { AdminEnv } from './gate';

const RECENT = 50;
const JOB_COLUMNS = `job_id AS id, kind, run_at AS runAt, attempts, max_attempts AS maxAttempts, locked_until AS lockedUntil,
  last_error AS lastError, done_at AS doneAt, failed_at AS failedAt, created_at AS createdAt`;

/** Mounted at /api/admin/billing behind the gate: subscriptions, provider events, the job queue, and a manual reconciliation. */
export function adminBillingRoutes({ db, provider, now = () => Date.now() }: { db: AppDb; provider: BillingProvider | null; now?: () => number }) {
  // Only prepares statements on the shared job table; the runner in index.ts picks the job up.
  const queue = createJobQueue(db, { now });
  const byStatus = db.prepare('SELECT provider, status, count(*) AS count FROM bill_subscription GROUP BY provider, status ORDER BY provider, status');
  const subscriptions = db.prepare(`
    SELECT s.provider, s.provider_sub_id AS providerSubId, s.subject_id AS userId, u.email, s.plan_id AS planId, s.status,
           s.current_period_end AS periodEnd, s.cancel_at AS cancelAt, s.grace_until AS graceUntil, s.updated_at AS updatedAt
    FROM bill_subscription s LEFT JOIN auth_user u ON s.subject_type = 'user' AND u.id = s.subject_id
    ORDER BY s.updated_at DESC LIMIT ${RECENT}`);
  const events = db.prepare(`
    SELECT provider, event_id AS eventId, type, received_at AS receivedAt, processed_at AS processedAt, error
    FROM bill_event ORDER BY received_at DESC LIMIT ${RECENT}`);
  const jobCounts = db.prepare(`
    SELECT coalesce(sum(done_at IS NULL AND failed_at IS NULL), 0) AS pending,
           coalesce(sum(failed_at IS NOT NULL), 0) AS failed, coalesce(sum(done_at IS NOT NULL), 0) AS done
    FROM job`);
  const pendingJobs = db.prepare(`SELECT ${JOB_COLUMNS} FROM job WHERE done_at IS NULL AND failed_at IS NULL ORDER BY run_at, job_id LIMIT ${RECENT}`);
  const failedJobs = db.prepare(`SELECT ${JOB_COLUMNS} FROM job WHERE failed_at IS NOT NULL ORDER BY failed_at DESC LIMIT 20`);
  const doneJobs = db.prepare(`SELECT ${JOB_COLUMNS} FROM job WHERE done_at IS NOT NULL ORDER BY done_at DESC LIMIT 20`);
  const dueReconcile = db.prepare('SELECT job_id FROM job WHERE kind = ? AND done_at IS NULL AND failed_at IS NULL AND run_at <= ? ORDER BY job_id').pluck();
  const audit = db.prepare(`
    INSERT INTO audit_event (at, actor_type, actor_id, action, subject_type, subject_id, data)
    VALUES (?, 'admin', ?, 'billing.reconcile', 'billing', ?, ?)`);
  const app = new Hono<AdminEnv>();

  app.get('/', c => c.json({
    provider: provider?.id ?? null,
    subscriptions: { byStatus: byStatus.all(), recent: subscriptions.all() },
    events: events.all(),
    jobs: { counts: jobCounts.get(), pending: pendingJobs.all(), failed: failedJobs.all(), recent: doneJobs.all() },
  }));

  app.post('/reconcile', c => {
    // With no provider, no runner handles the kind: the job would wait forever.
    if (!provider) return c.json({ error: 'billing_unavailable' }, 501);
    const waiting = dueReconcile.get(RECONCILE_JOB, now()) as number | undefined;
    if (waiting !== undefined) return c.json({ ok: true, jobId: waiting, queued: false });
    // No dedupe key: the daily run's key would refuse a second run on the same day.
    const jobId = queue.enqueue(RECONCILE_JOB, {}, { runAt: now() });
    audit.run(now(), c.var.admin.userId, provider.id, JSON.stringify({ jobId }));
    return c.json({ ok: true, jobId, queued: true });
  });

  return app;
}
