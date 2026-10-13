import { matchQuakeTwins } from '@/lib/hazards/quake-twin';

/**
 * TAKIP — the two earthquake catalogues behind /api/earthquakes, merged.
 *
 * USGS (US public domain) and EMSC (seismicportal.eu FDSN; credit EMSC, terms not yet verified).
 * EMSC is often faster in the Euro-Med region. The same quake usually appears in both, so twins
 * are folded into the USGS record; a twin credited to a US network is not independent confirmation.
 */

export const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
export const EMSC_LIMIT = 500;

export function emscUrl(now: number): string {
  const start = new Date(now - 24 * 3600_000).toISOString().slice(0, 19);
  return `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minmag=2.5&limit=${EMSC_LIMIT}&starttime=${start}`;
}

export interface Quake {
  id: string;
  lat: number;
  lng: number;
  depth: number;
  magnitude: number;
  place: string;
  time: number;
  url: string;
  source: 'USGS' | 'EMSC';
  /** The network credited with the solution (USGS `net`, EMSC `auth`). */
  network?: string;
  tsunami?: number;
  type?: string;
  felt?: number | null;
  alert?: string | null;
  twin?: { source: 'EMSC'; id: string; magnitude: number; network?: string; url: string };
}

interface GeoFeature<P> {
  id?: string;
  geometry?: { coordinates?: number[] } | null;
  properties?: P | null;
}

export type UsgsFeature = GeoFeature<{
  mag?: number | null;
  place?: string | null;
  time?: number | null;
  url?: string | null;
  tsunami?: number | null;
  type?: string | null;
  felt?: number | null;
  alert?: string | null;
  net?: string | null;
}>;

export type EmscFeature = GeoFeature<{
  unid?: string | null;
  time?: string | null;
  lat?: number | null;
  lon?: number | null;
  depth?: number | null;
  mag?: number | null;
  flynn_region?: string | null;
  evtype?: string | null;
  auth?: string | null;
}>;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const onEarth = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export function mapUsgsQuake(f: UsgsFeature | null | undefined): Quake | null {
  const p = f?.properties;
  const [lng, lat, depth] = f?.geometry?.coordinates ?? [];
  if (!f?.id || !p || !finite(lat) || !finite(lng) || !onEarth(lat, lng) || !finite(p.mag) || !finite(p.time)) return null;
  return {
    id: f.id,
    lat,
    lng,
    depth: finite(depth) ? depth : 0,
    magnitude: p.mag,
    place: p.place || 'Unknown location',
    time: p.time,
    url: p.url || `https://earthquake.usgs.gov/earthquakes/eventpage/${f.id}`,
    source: 'USGS',
    network: p.net ?? undefined,
    tsunami: p.tsunami ?? 0,
    type: p.type ?? undefined,
    felt: p.felt ?? null,
    alert: p.alert ?? null,
  };
}

const SMALL_WORDS = new Set(['of', 'the', 'and', 'off', 'near', 'in']);

/** Flynn region names arrive upper-case ("NEAR COAST OF NORTHERN CHILE"). */
export function regionName(region: string): string {
  return region.toLowerCase().replace(/[a-z']+/g, (word, offset: number) =>
    offset > 0 && SMALL_WORDS.has(word) ? word : word[0].toUpperCase() + word.slice(1));
}

/** `ke` known and `se` suspected earthquakes; blasts and other event types are dropped. */
const QUAKE_TYPES = new Set(['ke', 'se', '']);

export function mapEmscQuake(f: EmscFeature | null | undefined): Quake | null {
  const p = f?.properties;
  const unid = p?.unid || f?.id;
  if (!p || !unid || !QUAKE_TYPES.has(p.evtype ?? '')) return null;
  const time = p.time ? Date.parse(p.time) : NaN;
  if (!finite(p.lat) || !finite(p.lon) || !onEarth(p.lat, p.lon) || !finite(p.mag) || !finite(time)) return null;
  return {
    id: `emsc-${unid}`,
    lat: p.lat,
    lng: p.lon,
    depth: finite(p.depth) ? Math.abs(p.depth) : 0,
    magnitude: p.mag,
    place: p.flynn_region ? regionName(p.flynn_region) : 'Unknown location',
    time,
    url: `https://www.seismicportal.eu/eventdetails.html?unid=${encodeURIComponent(unid)}`,
    source: 'EMSC',
    network: p.auth ?? undefined,
  };
}

/** USGS records stay canonical; an EMSC twin is attached, and only unmatched EMSC events are added. */
export function mergeCatalogues(usgs: Quake[], emsc: Quake[]): { quakes: Quake[]; twins: number } {
  const pairs = matchQuakeTwins(usgs, emsc);
  const emscById = new Map(emsc.map(q => [q.id, q]));
  const twinned = new Set(pairs.values());

  const quakes = usgs.map(q => {
    const twin = emscById.get(pairs.get(q.id) ?? '');
    return twin
      ? { ...q, twin: { source: 'EMSC' as const, id: twin.id, magnitude: twin.magnitude, network: twin.network, url: twin.url } }
      : q;
  });
  for (const q of emsc) if (!twinned.has(q.id)) quakes.push(q);
  quakes.sort((a, b) => b.time - a.time);
  return { quakes, twins: pairs.size };
}

export function parseFeatures<T>(json: unknown, label: string): T[] {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) throw new Error(`${label}: unexpected response`);
  return features as T[];
}
