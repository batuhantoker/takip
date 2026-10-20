import type { Bbox } from '@/lib/map/embed/spec';

/**
 * USGS ComCat earthquakes as the place pages counted them, data/site/earthquakes.json (tools/site/topics/hazards.ts),
 * so the embed's windows over those pages answer from disk: ComCat takes 10–30 s a windowed query and sometimes 502s.
 * Each tier holds every quake of its floor and up from its first day to `until`.
 */
export interface QuakeArchive {
  generated: string;
  /** The first day not held, YYYY-MM-DD. */
  until: string;
  tiers: { floor: number; since: string }[];
  /** In time order, so a rebuild's diff is the new quakes and the revised ones. */
  rows: QuakeArchiveRow[];
}

/** Epoch ms, [lon, lat] to three places, depth in km, magnitude to one place as the pages count it, USGS's network. */
export type QuakeArchiveRow = [id: string, time: number, lon: number, lat: number, depth: number, mag: number, place: string, net: string];

/** The archive ready to ask: its tiers as epoch ms, and the rows strongest first. */
export interface QuakeIndex { until: number; tiers: { floor: number; since: number }[]; byMag: QuakeArchiveRow[] }

export function indexArchive(a: QuakeArchive): QuakeIndex {
  return {
    until: Date.parse(a.until),
    tiers: a.tiers.map(t => ({ floor: t.floor, since: Date.parse(t.since) })),
    byMag: [...a.rows].sort((x, y) => y[5] - x[5] || y[1] - x[1]),
  };
}

/** Whether the archive holds every quake of `minMag` and up over [from, to). */
export const archiveCovers = (ix: QuakeIndex, from: number, to: number, minMag: number) =>
  to <= ix.until && ix.tiers.some(t => minMag >= t.floor && from >= t.since);

/** Across the antimeridian, west lies above east, as the embed's bbox has it. */
const inBox = (lon: number, lat: number, [w, s, e, n]: Bbox) =>
  lat >= s && lat <= n && (w <= e ? lon >= w && lon <= e : lon >= w || lon <= e);

/** The `limit` largest quakes in the window, and how many there are in all; null when the archive doesn't cover it. */
export function archiveRange(ix: QuakeIndex, from: number, to: number, minMag: number, bbox: Bbox | undefined, limit: number) {
  if (!archiveCovers(ix, from, to, minMag)) return null;
  const rows: QuakeArchiveRow[] = [];
  let total = 0;
  for (const r of ix.byMag) {
    if (r[5] < minMag) break;
    if (r[1] < from || r[1] >= to || (bbox && !inBox(r[2], r[3], bbox))) continue;
    total++;
    if (rows.length < limit) rows.push(r);
  }
  return { rows, total };
}
