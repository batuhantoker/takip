import type { ShowingGroup, ShowingRow } from './showing-rows';

/** A row seen since the panel opened, with the group it belongs to. */
export type SeenRow = { group: string; title: string; row: ShowingRow };
export type ShownRow = ShowingRow & { on: boolean };
export type ShownGroup = { id: string; title: string; rows: ShownRow[] };

/** rowsFor's group order. */
const GROUP_ORDER = ['deep', 'events', 'borders', 'countries', 'layers', 'arcgis', 'areas'];

export const NOTHING_SEEN: SeenRow[] = [];

/** Adds rows not seen before, in the order they appear; the same array back when none are new. */
export function remember(seen: SeenRow[], current: ShowingGroup[]): SeenRow[] {
  const known = new Set(seen.map(s => s.row.id));
  const fresh = current.flatMap(g => g.rows.filter(r => !known.has(r.id)).map(row => ({ group: g.id, title: g.title, row })));
  return fresh.length ? [...seen, ...fresh] : seen;
}

/**
 * Every row seen while the panel is open, on while it is still drawn. A row switched off stays where it was,
 * so it can be switched back on; one with no switch (drawn areas) simply goes.
 */
export function shownGroups(seen: SeenRow[], current: ShowingGroup[]): ShownGroup[] {
  const drawn = new Map(current.flatMap(g => g.rows.map(r => [r.id, r] as const)));
  const groups = new Map<string, ShownGroup>();
  for (const s of seen) {
    const now = drawn.get(s.row.id);
    if (!now && !s.row.off) continue;
    const g = groups.get(s.group) ?? { id: s.group, title: s.title, rows: [] };
    groups.set(s.group, g);
    g.rows.push(now ? { ...now, on: true } : { ...s.row, on: false });
  }
  return GROUP_ORDER.flatMap(id => groups.get(id) ?? []);
}
