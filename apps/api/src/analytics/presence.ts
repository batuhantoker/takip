import type { IpPlace } from '../geoip/ip-location';
import type { Agent } from './user-agent';

// The map ticks once a minute while it's visible; a public page sends one view as it opens and nothing after.
const MAP_TTL_MS = 150_000;
const PAGE_TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 5000;
const MAX_ACTIONS = 6;

export type PresenceKind = 'map' | 'page';

/** The last thing one browser (or account, or anonymous address block) did on the site. */
export type PresenceNote = {
  key: string;
  kind: PresenceKind;
  visitorId: string | null;
  userId: string | null;
  /** The page's English path; '/' on the map. */
  path: string;
  /** The map's features at its last tick (map-time-input.ts); empty on a page. */
  features: readonly string[];
  /** Actions taken since the tick before (packages/core usage.ts), by name. */
  actions?: readonly string[];
  referrer: string | null;
  place: IpPlace | null;
  agent: Agent | null;
  at: number;
};

/**
 * `since` is when this stay began: notes closer together than their kind's time-to-live are one stay. `actions` are
 * the stay's latest, newest first, each with the tick that reported it.
 */
export type PresenceEntry = Omit<PresenceNote, 'actions'> & { since: number; actions: { action: string; at: number }[] };

const ttl = (kind: PresenceKind) => (kind === 'map' ? MAP_TTL_MS : PAGE_TTL_MS);

/**
 * Who is on the site right now, for Admin → Analytics → Live. Held in memory only: a restart empties it, and an
 * entry drops once its kind's time-to-live passes without a new note.
 */
export function createPresence(now = () => Date.now()) {
  const live = new Map<string, PresenceEntry>();
  const alive = (e: PresenceEntry, at: number) => at - e.at <= ttl(e.kind);

  function note(n: PresenceNote) {
    const kept = live.get(n.key);
    const still = kept && alive(kept, n.at) ? kept : null;
    live.delete(n.key);
    live.set(n.key, {
      ...n,
      referrer: n.referrer ?? still?.referrer ?? null,
      place: n.place ?? still?.place ?? null,
      agent: n.agent ?? still?.agent ?? null,
      actions: [...(n.actions ?? []).map(action => ({ action, at: n.at })), ...(still?.actions ?? [])].slice(0, MAX_ACTIONS),
      since: still?.since ?? n.at,
    });
    // Oldest first in a Map's order, since each note re-inserts its key.
    if (live.size > MAX_ENTRIES) live.delete(live.keys().next().value!);
  }

  /** Everyone here now, most recently active first. */
  function list(): PresenceEntry[] {
    const at = now();
    for (const [key, e] of live) if (!alive(e, at)) live.delete(key);
    return [...live.values()].sort((a, b) => b.at - a.at);
  }

  return { note, list };
}

export type Presence = ReturnType<typeof createPresence>;
