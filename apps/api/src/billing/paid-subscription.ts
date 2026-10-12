import { isActive } from '../access/resolver';
import type { AppDb } from '../db/app-db';

/** Whether a user is paying a provider right now, by the resolver's rules. A manual grant is not a payment. */
export function paidSubscriptionCheck(db: AppDb) {
  const subscriptions = db.prepare(`
    SELECT provider, plan_id, status, current_period_end, cancel_at, grace_until FROM bill_subscription
    WHERE subject_type = 'user' AND subject_id = ? AND provider != 'manual'`);
  return (userId: string, at = Date.now()) =>
    (subscriptions.all(userId) as Parameters<typeof isActive>[0][]).some(sub => isActive(sub, at));
}
