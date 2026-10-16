import { ROUTE_MODES } from '../generated/route-modes.generated';
import type { TransitMode } from '../modes';
import type { TransitFeed } from '../select';

/** A feed that runs more than one mode: the one most of its routes run, and the routes that run something else. */
export interface RouteModes {
  main: TransitMode;
  other: Partial<Record<TransitMode, string[]>>;
}

const lookups = new WeakMap<RouteModes, Map<string, TransitMode>>();

function lookup(modes: RouteModes): Map<string, TransitMode> {
  let m = lookups.get(modes);
  if (!m) {
    m = new Map(Object.entries(modes.other).flatMap(([mode, routes]) => routes.map(r => [r, mode as TransitMode] as const)));
    lookups.set(modes, m);
  }
  return m;
}

/** What a vehicle on `route` is, from its feed's routes.txt; undefined when the feed never said. */
export function vehicleMode(feed: Pick<TransitFeed, 'id' | 'modes'>, route: string | undefined, table: Record<string, RouteModes> = ROUTE_MODES): TransitMode | undefined {
  const modes = table[feed.id];
  if (!modes) return feed.modes?.length === 1 ? feed.modes[0] : undefined;
  return (route && lookup(modes).get(route)) || modes.main;
}

/** The table entry for one feed's [route_id, mode] pairs, or null when it runs a single mode. */
export function routeModes(routes: readonly [string, TransitMode][]): RouteModes | null {
  const count = new Map<TransitMode, number>();
  for (const [, m] of routes) count.set(m, (count.get(m) ?? 0) + 1);
  if (count.size < 2) return null;
  const main = [...count].sort((a, b) => b[1] - a[1])[0][0];
  const other: RouteModes['other'] = {};
  for (const [r, m] of routes) if (m !== main) (other[m] ??= []).push(r);
  return { main, other };
}
