import type { Logger } from 'pino';
import type { AccessResolver } from '../access/resolver';
import { DAY_MS, utcDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import type { JobHandlers } from '../jobs/runner';
import type { JobQueue } from '../jobs/queue';
import { silentLogger } from '../obs/logger';
import type { BillingProvider } from './provider';
import { createSubscriptions, type BillingActor } from './subscriptions';

export const RECONCILE_JOB = 'billing.reconcile';
const RECONCILER: BillingActor = { type: 'system', id: RECONCILE_JOB };
const RUN_HOUR_MS = 3 * 60 * 60_000;

/** At most one run per UTC day, however often the api restarts. */
export function scheduleReconcile(queue: JobQueue, runAt: number) {
  return queue.enqueue(RECONCILE_JOB, {}, { runAt, dedupeKey: `${RECONCILE_JOB}@${utcDay(runAt)}` });
}

type Deps = { db: AppDb; provider: BillingProvider; access: AccessResolver; now?: () => number; logger?: Logger };

/**
 * Re-reads every live subscription of the configured provider, catching webhooks that never arrived
 * (backend.md §7.3). One subscription failing doesn't stop the rest.
 */
export async function reconcile({ db, provider, access, now = () => Date.now(), logger = silentLogger }: Deps) {
  const subscriptions = createSubscriptions(db, { now });
  const live = db.prepare(`
    SELECT provider_sub_id FROM bill_subscription
    WHERE provider = ? AND NOT (status IN ('canceled', 'expired') AND COALESCE(cancel_at, current_period_end, 0) <= ?)`,
  ).pluck().all(provider.id, now()) as string[];

  let changed = 0;
  const failed: string[] = [];
  for (const providerSubId of live) {
    try {
      const snapshot = await provider.fetchSubscription(providerSubId);
      if (db.transaction(() => subscriptions.upsert(provider.id, { ...snapshot, providerSubId }, RECONCILER))()) changed++;
    } catch (err) {
      failed.push(providerSubId);
      logger.warn({ err, providerSubId }, 'reconcile: subscription not refreshed');
    }
  }
  if (changed) access.invalidate();
  return { checked: live.length, changed, failed };
}

/** The job handlers billing needs; none when no provider is configured. */
export function billingJobs({ queue, provider, ...deps }: Omit<Deps, 'provider'> & { queue: JobQueue; provider: BillingProvider | null }): JobHandlers {
  if (!provider) return {};
  const now = deps.now ?? (() => Date.now());
  return {
    async [RECONCILE_JOB]() {
      // Tomorrow's run is queued first, so a day whose run keeps failing doesn't end the schedule.
      scheduleReconcile(queue, (utcDay(now()) + 1) * DAY_MS + RUN_HOUR_MS);
      const { checked, failed } = await reconcile({ ...deps, provider, now });
      if (failed.length) throw new Error(`${failed.length} of ${checked} subscriptions not refreshed: ${failed.join(', ')}`);
    },
  };
}
