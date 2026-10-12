import type { AccessResolver } from '../access/resolver';
import type { AppDb } from '../db/app-db';
import type { BillingEvent, ProviderId } from './provider';
import type { Subscriptions } from './subscriptions';

/**
 * Applies each webhook event once (backend.md §7.3). The bill_event row, the subscription change and its
 * audit row commit together. A failed event keeps its row with the error but no processed_at, so the
 * provider's retry applies it instead of being taken for a replay.
 */
export function createEventReceiver(db: AppDb, subscriptions: Subscriptions, access: AccessResolver, { now = () => Date.now() } = {}) {
  const insert = db.prepare(`
    INSERT INTO bill_event (provider, event_id, type, received_at, payload) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (provider, event_id) DO NOTHING`);
  const processedAt = db.prepare('SELECT processed_at FROM bill_event WHERE provider = ? AND event_id = ?').pluck();
  const markProcessed = db.prepare('UPDATE bill_event SET processed_at = ?, error = NULL WHERE provider = ? AND event_id = ?');
  const recordError = db.prepare(`
    INSERT INTO bill_event (provider, event_id, type, received_at, payload, error) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (provider, event_id) DO UPDATE SET error = excluded.error`);

  const applyOnce = db.transaction((provider: ProviderId, event: BillingEvent, payload: string): 'applied' | 'duplicate' => {
    const fresh = insert.run(provider, event.eventId, event.type, now(), payload).changes > 0;
    if (!fresh && processedAt.get(provider, event.eventId) !== null) return 'duplicate';
    subscriptions.apply(provider, event, { type: 'provider', id: provider });
    markProcessed.run(now(), provider, event.eventId);
    return 'applied';
  });

  return {
    receive(provider: ProviderId, event: BillingEvent, payload: string) {
      try {
        const outcome = applyOnce(provider, event, payload);
        if (outcome === 'applied') access.invalidate();
        return outcome;
      } catch (err) {
        recordError.run(provider, event.eventId, event.type, now(), payload, err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
  };
}

export type EventReceiver = ReturnType<typeof createEventReceiver>;
