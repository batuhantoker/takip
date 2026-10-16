import { HISTORY_FAMILIES } from '@/lib/history/popup';
import { WAR_LAYERS } from '@/lib/history/war-layers';
import { WORLD_BORDERS } from '@/lib/history/world-borders';
import { needsLive } from '@/lib/map/layers/past';
import type { OffAction, RowSwatch, ShowingRow } from './showing-rows';
import { DATA_LAYERS, partOfView, type ShowingMode } from './showing-state';

/** Something the person had on and has since switched off, with what it takes to put it back. */
export type RecentItem = { id: string; label: string; swatch: RowSwatch; off: OffAction };

/** What the chip showed at one moment: the mode and its rows. */
export type ShownAt = { mode: ShowingMode; rows: ShowingRow[] };

export const RECENT_KEY = 'takip.showing.recent';
export const MAX_RECENT = 5;

const LAYER_KEYS = new Set(DATA_LAYERS.map(l => l.key));
const BORDER_CODES = new Set([WORLD_BORDERS.code, ...WAR_LAYERS.map(w => w.code)]);
const FAMILIES = new Set(Object.keys(HISTORY_FAMILIES));

/** Whether an item can still be put back: its layer, family or border layer exists, and an ArcGIS layer is still added. */
export function exists(off: OffAction, arcgisIds: ReadonlySet<string>): boolean {
  switch (off.kind) {
    case 'layer': return LAYER_KEYS.has(off.key);
    case 'family': return FAMILIES.has(off.family);
    case 'borders': return BORDER_CODES.has(off.code);
    case 'countries': return !!off.code;
    case 'arcgis': return arcgisIds.has(off.id);
    default: return false;
  }
}

/** Whether switching it on fits the map shown: History's own items in History, and only the layers each past view keeps. */
export function appliesIn(off: OffAction, mode: ShowingMode): boolean {
  switch (off.kind) {
    case 'layer': return mode === 'live' || (partOfView(off.key, mode) && !needsLive(off.key, mode === 'replay' ? 'replay' : 'history'));
    case 'arcgis': return true;
    case 'family':
    case 'borders':
    case 'countries': return mode === 'history';
    default: return false;
  }
}

/**
 * The recent list after the chip's rows change from `before` to `now`. Rows gone within one mode were switched
 * off, wherever that happened; a change of mode hides rows without anyone switching them off, so it records nothing.
 * Newest first, one entry per item, at most MAX_RECENT; anything on again or gone for good drops out.
 */
export function step(list: RecentItem[], before: ShownAt | null, now: ShownAt, arcgisIds: ReadonlySet<string>): RecentItem[] {
  const on = new Set(now.rows.map(r => r.id));
  const gone = before && before.mode === now.mode
    ? before.rows.flatMap(r => (r.off && r.off.kind !== 'deep' && !on.has(r.id) ? [{ id: r.id, label: r.label, swatch: r.swatch, off: r.off }] : []))
    : [];
  const seen = new Set<string>();
  const next = [...gone, ...list].filter(i => {
    if (seen.has(i.id) || on.has(i.id) || !exists(i.off, arcgisIds)) return false;
    seen.add(i.id);
    return true;
  }).slice(0, MAX_RECENT);
  return next.length === list.length && next.every((i, n) => i.id === list[n].id) ? list : next;
}

/** The recent items worth offering on this map, leaving out any already listed above them. */
export const recentFor = (list: RecentItem[], mode: ShowingMode, listed: ReadonlySet<string>) =>
  list.filter(i => appliesIn(i.off, mode) && !listed.has(i.id));

const OFF_KINDS = new Set(['layer', 'family', 'borders', 'countries', 'arcgis']);
const isItem = (v: unknown): v is RecentItem => {
  const i = v as RecentItem;
  return !!i && typeof i.id === 'string' && typeof i.label === 'string'
    && !!i.swatch && (i.swatch.kind === 'layer' || (i.swatch.kind === 'mark' && Array.isArray(i.swatch.colors)))
    && !!i.off && OFF_KINDS.has(i.off.kind);
};

/** The stored list, ignoring anything malformed. */
export function parseRecent(raw: string | null): RecentItem[] {
  try {
    const v: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter(isItem).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}
