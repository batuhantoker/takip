import type { UsageAction } from '@takip/core/usage';

const pending = new Map<UsageAction, number>();

/** Counts one use of a feature for the admin's usage statistics: the name only, sent with the map's next minute tick. */
export function countAction(action: UsageAction) {
  pending.set(action, (pending.get(action) ?? 0) + 1);
}

/** The counts since the last take, emptied; undefined when there are none. */
export function takeActions(): Partial<Record<UsageAction, number>> | undefined {
  if (!pending.size) return undefined;
  const counts = Object.fromEntries(pending) as Partial<Record<UsageAction, number>>;
  pending.clear();
  return counts;
}

/** Puts counts back after a send failed, so they go with the next one. */
export function restoreActions(counts: Partial<Record<UsageAction, number>> | undefined) {
  for (const [action, n] of Object.entries(counts ?? {}) as [UsageAction, number][]) pending.set(action, (pending.get(action) ?? 0) + n);
}
