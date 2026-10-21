import { classifySatellite } from './classify';
import { propagateTLE } from './orbit';

/**
 * The map's satellites as their element sets alone: names and TLE lines, as columns. Everything else the
 * JSON route adds (position, mission, colour, category) the browser works out from these (decodeElements),
 * so the answer only changes when CelesTrak's sets do, and can be cached and revalidated.
 *
 * Each TLE line is cut at its fixed field boundaries and every field kept as a column of strings, which
 * gzip packs far better than whole lines. The cuts cover the line end to end, so joining them gives it back
 * byte for byte, malformed lines included.
 */

export interface ElementColumns {
  format: 'elements';
  names: string[];
  line1: string[][];
  /** Line 2 by the same cuts; null in the catalogue-number column where it repeats line 1's. */
  line2: (string | null)[][];
}

export type SatelliteRow = {
  name: string; lat: number; lng: number; alt: number; mission: string; color: string; category: string;
  noradId: string; line1: string; line2: string;
};

const CUTS_1 = [0, 2, 7, 9, 18, 33, 44, 53, 62, 64, 68];
const CUTS_2 = [0, 2, 7, 8, 17, 26, 34, 43, 52, 63, 68];
/** Characters 2–7 of both lines: the catalogue number. */
const NUMBER = 1;

const cut = (line: string, at: number[]) => at.map((a, i) => line.slice(a, at[i + 1]));

export function encodeElements(sets: readonly { name: string; line1: string; line2: string }[]): ElementColumns {
  const line1 = CUTS_1.map(() => [] as string[]);
  const line2 = CUTS_2.map(() => [] as (string | null)[]);
  for (const s of sets) {
    const one = cut(s.line1, CUTS_1);
    const two: (string | null)[] = cut(s.line2, CUTS_2);
    if (two[NUMBER] === one[NUMBER]) two[NUMBER] = null;
    one.forEach((v, i) => line1[i].push(v));
    two.forEach((v, i) => line2[i].push(v));
  }
  return { format: 'elements', names: sets.map(s => s.name), line1, line2 };
}

export function isElementColumns(v: unknown): v is ElementColumns {
  const e = v as ElementColumns | null;
  return !!e && e.format === 'elements' && Array.isArray(e.names) && Array.isArray(e.line1) && Array.isArray(e.line2)
    && e.line1.length === CUTS_1.length && e.line2.length === CUTS_2.length
    && [...e.line1, ...e.line2].every(column => Array.isArray(column) && column.length === e.names.length);
}

/** The element sets' TLE lines, rebuilt exactly. */
export function elementLines(e: ElementColumns): { name: string; line1: string; line2: string }[] {
  return e.names.map((name, i) => {
    const one = e.line1.map(column => column[i]);
    return { name, line1: one.join(''), line2: e.line2.map((column, k) => column[i] ?? (k === NUMBER ? one[NUMBER] : '')).join('') };
  });
}

/** The rows the JSON route gives, placed at `when`; a set SGP4 declines is left out, as the route does. */
export function decodeElements(e: ElementColumns, when: Date = new Date()): { satellites: SatelliteRow[]; category_counts: Record<string, number> } {
  const satellites: SatelliteRow[] = [];
  const category_counts: Record<string, number> = {};
  for (const { name, line1, line2 } of elementLines(e)) {
    const p = propagateTLE(line1, line2, when);
    if (!p) continue;
    const { mission, color, category } = classifySatellite(name);
    category_counts[category] = (category_counts[category] ?? 0) + 1;
    satellites.push({
      name, mission, color, category, line1, line2,
      lat: Math.round(p.lat * 10000) / 10000,
      lng: Math.round(p.lng * 10000) / 10000,
      alt: Math.round(p.altKm),
      noradId: line1.substring(2, 7).trim(),
    });
  }
  return { satellites, category_counts };
}

export const SATELLITE_ELEMENTS_URL = '/api/satellites?format=elements';

/** What a fetched answer adds to the page's data, placed at `when`; nothing when it isn't element sets. */
export function satelliteData(answer: unknown, when: Date = new Date()): { satellites?: SatelliteRow[]; category_counts?: Record<string, number>; satellites_at?: string } {
  if (!isElementColumns(answer)) return {};
  return { ...decodeElements(answer, when), satellites_at: when.toISOString() };
}
