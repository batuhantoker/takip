import { areaParts, pointInParts, type AreaGeometry, type AreaPart } from './aoi';

/**
 * Outlines for the Areas tool's region pick, finer the further in you zoom.
 *
 * Countries and states/provinces are Natural Earth (public domain), slimmed by
 * tools/build-boundaries.mjs into public/data/boundaries/. Districts and sub-districts are
 * geoBoundaries, served by /api/boundaries/fine with each country's source and licence.
 */

export type BoundaryLevel = 'country' | 'admin1' | 'admin2' | 'admin3';
export type SubLevel = Exclude<BoundaryLevel, 'country'>;
export type FineLevel = Exclude<SubLevel, 'admin1'>;

/** Coarsest first; each level is offered from its zoom on. */
export const LEVELS: readonly { level: BoundaryLevel; minZoom: number }[] = [
  { level: 'country', minZoom: 0 },
  { level: 'admin1', minZoom: 4 },
  { level: 'admin2', minZoom: 7 },
  { level: 'admin3', minZoom: 9 },
];

export const FINE_LEVELS: readonly FineLevel[] = ['admin2', 'admin3'];

export function levelForZoom(zoom: number): BoundaryLevel {
  let level: BoundaryLevel = 'country';
  for (const l of LEVELS) if (zoom >= l.minZoom) level = l.level;
  return level;
}

export interface Boundary {
  id: string;
  level: BoundaryLevel;
  name: string;
  /** Natural Earth ADM0_A3; a country's own id. */
  countryId: string;
  /** Country name, on states and provinces only. */
  country?: string;
  /** ISO alpha-3, on countries only; geoBoundaries is keyed by it. */
  iso3?: string;
  label: [number, number] | null;
  /** Credit line for outlines whose licence asks for one. */
  source?: string;
  geometry: AreaGeometry;
  parts: AreaPart[];
}

interface StoredProps {
  id?: string;
  name?: string;
  country?: string;
  countryId?: string;
  iso3?: string;
  label?: unknown;
}

function validLabel(v: unknown): [number, number] | null {
  return Array.isArray(v) && Number.isFinite(v[0]) && Number.isFinite(v[1]) ? [v[0], v[1]] : null;
}

export function parseBoundaries(fc: { features?: GeoJSON.Feature[] }, level: BoundaryLevel, source?: string): Boundary[] {
  const out: Boundary[] = [];
  for (const f of fc.features ?? []) {
    const g = f.geometry;
    const p = (f.properties ?? {}) as StoredProps;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon') || !p.id || !p.name) continue;
    out.push({
      id: p.id,
      level,
      name: p.name,
      countryId: p.countryId ?? p.id,
      country: p.country,
      iso3: p.iso3,
      label: validLabel(p.label),
      source,
      geometry: g,
      parts: areaParts(g),
    });
  }
  return out;
}

/** MapLibre reports longitudes past ±180 once the map has been panned across the dateline. */
export function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

export function pickBoundary(lng: number, lat: number, boundaries: Boundary[]): Boundary | null {
  const x = wrapLng(lng);
  return boundaries.find(b => pointInParts(x, lat, b.parts)) ?? null;
}

/**
 * A country's outlines at one level around a point: undefined while they load, null when the
 * country has none at that level.
 */
export type BoundaryLookup = (country: Boundary, level: SubLevel, lng: number, lat: number) => Boundary[] | null | undefined;

export interface PickResult {
  boundary: Boundary | null;
  /** The coarser outlines containing it, country first. */
  parents: Boundary[];
  /** Some level is still loading, so `boundary` may not be the finest yet. */
  loading: boolean;
}

/**
 * The finest outline under the point, down to `level`. A level the country lacks, or a sliver
 * between simplified neighbours, leaves the coarser outline in place.
 */
export function resolvePick(lng: number, lat: number, level: BoundaryLevel, countries: Boundary[], lookup: BoundaryLookup): PickResult {
  const x = wrapLng(lng);
  const country = pickBoundary(x, lat, countries);
  if (!country) return { boundary: null, parents: [], loading: false };
  let best = country;
  const parents: Boundary[] = [];
  let loading = false;
  const target = LEVELS.findIndex(l => l.level === level);
  for (let i = 1; i <= target; i++) {
    const list = lookup(country, LEVELS[i].level as SubLevel, x, lat);
    if (list === undefined) {
      loading = true;
      continue;
    }
    const hit = list && pickBoundary(x, lat, list);
    if (hit) {
      parents.push(best);
      best = hit;
    }
  }
  return { boundary: best, parents, loading };
}

/** "Oberbayern, Bavaria, Germany": the outline, then what contains it. */
export function boundaryTitle(b: Pick<Boundary, 'name' | 'country'>, parents: Pick<Boundary, 'name'>[] = []): string {
  const names = [b.name, ...parents.map(p => p.name).reverse()];
  if (!parents.length && b.country) names.push(b.country);
  return names.filter((n, i) => names.indexOf(n) === i).join(', ');
}

/* ── Cells ────────────────────────────────────────────────────────────────── */

/** Districts are served in squares this many degrees wide, so thousands of them arrive a piece at a time. */
export const CELL_DEG = 4;

export function cellOf(lng: number, lat: number): string {
  return `${Math.floor(wrapLng(lng) / CELL_DEG)}_${Math.floor(Math.min(lat, 89.999) / CELL_DEG)}`;
}

export function cellBox(cell: string): { west: number; south: number; east: number; north: number } | null {
  const m = /^(-?\d{1,2})_(-?\d{1,2})$/.exec(cell);
  if (!m) return null;
  const x = Number(m[1]), y = Number(m[2]);
  if (x < Math.floor(-180 / CELL_DEG) || x >= 180 / CELL_DEG || y < Math.floor(-90 / CELL_DEG) || y >= 90 / CELL_DEG) return null;
  return { west: x * CELL_DEG, south: y * CELL_DEG, east: (x + 1) * CELL_DEG, north: (y + 1) * CELL_DEG };
}
