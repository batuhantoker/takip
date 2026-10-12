import { httpJson, optional } from '@takip/connectors/http-json';
import { nominatim } from '@takip/connectors/nominatim';
import { cachedSource } from '@takip/connectors/source-cache';
import type { GeoKind, GeoResult } from './schemas';

/*
 * Photon (Komoot's prefix- and typo-tolerant index over OSM) leads, because Nominatim is a geocoder that
 * needs near-complete input. Nominatim supplements it for phrasings Photon ranks poorly.
 */
const PHOTON = 'https://photon.komoot.io/api';

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
}

interface NominatimRow {
  display_name?: string;
  lat?: string;
  lon?: string;
  class?: string;
  type?: string;
  name?: string;
  importance?: number;
}

// Photon ranks lexically ("heathrow" puts the Florida town first); Nominatim scores the airport 0.606, the town 0.352.
const PROMINENT = 0.5;

/** Roughly 100 m: two hits this close with the same name are one place. */
const DEDUPE_DEG = 0.001;

/** Below this many Photon hits, Nominatim is asked as well. */
const ENOUGH_FROM_PHOTON = 3;

const CACHE_TTL_MS = 10 * 60 * 1000;

/** Collapses OSM class/value pairs into the kinds the UI has icons for. */
export function classifyKind(key?: string, value?: string): GeoKind {
  if (!key) return 'place';
  if (key === 'place' && ['country'].includes(value || '')) return 'country';
  if (key === 'place' && ['state', 'region', 'province', 'county'].includes(value || '')) return 'region';
  if (key === 'place' && ['city', 'town', 'village', 'hamlet', 'municipality'].includes(value || '')) return 'city';
  if (key === 'boundary') return 'region';
  if (key === 'highway' || key === 'street') return 'street';
  if (key === 'building' || key === 'address' || value === 'house') return 'address';
  if (['amenity', 'tourism', 'shop', 'leisure', 'historic', 'office', 'railway', 'aeroway', 'natural', 'man_made'].includes(key)) {
    return 'poi';
  }
  return 'place';
}

export function normalizePhoton(f: PhotonFeature): GeoResult | null {
  const c = f?.geometry?.coordinates;
  const p = f?.properties;
  if (!c || c.length < 2 || !p) return null;
  const [lng, lat] = c;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Photon splits an address across name/housenumber/street.
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const name = p.name || street || p.city || p.country || 'Unnamed place';
  const context = [p.name && street ? street : null, p.district, p.city, p.state, p.country]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3)
    .join(', ');

  return { name, context, lat, lng, kind: classifyKind(p.osm_key, p.osm_value), source: 'photon' };
}

export function normalizeNominatim(r: NominatimRow): GeoResult | null {
  const lat = parseFloat(r?.lat || '');
  const lng = parseFloat(r?.lon || '');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const parts = (r.display_name || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    name: r.name || parts[0] || 'Unnamed place',
    context: parts.slice(1, 4).join(', '),
    lat,
    lng,
    kind: classifyKind(r.class, r.type),
    source: 'nominatim',
    score: typeof r.importance === 'number' ? r.importance : undefined,
  };
}

/**
 * Photon's ordering, with globally prominent Nominatim hits promoted above it, and anything the other
 * provider already covers at the same coordinate and name dropped.
 */
export function mergeResults(primary: GeoResult[], secondary: GeoResult[], limit = 8): GeoResult[] {
  const out: GeoResult[] = [];

  const isDuplicate = (r: GeoResult) =>
    out.some(
      (o) =>
        Math.abs(o.lat - r.lat) < DEDUPE_DEG &&
        Math.abs(o.lng - r.lng) < DEDUPE_DEG &&
        o.name.toLowerCase() === r.name.toLowerCase(),
    );

  const prominent = secondary
    .filter((r) => (r.score ?? 0) >= PROMINENT)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const rest = secondary.filter((r) => (r.score ?? 0) < PROMINENT);

  for (const r of [...prominent, ...primary, ...rest]) {
    if (out.length >= limit) break;
    if (!isDuplicate(r)) out.push(r);
  }
  return out;
}

async function searchPhoton(q: string, lat?: number, lng?: number): Promise<GeoResult[]> {
  let url = `${PHOTON}/?q=${encodeURIComponent(q)}&limit=8&lang=en`;
  if (Number.isFinite(lat) && Number.isFinite(lng)) url += `&lat=${lat}&lon=${lng}`;
  const json = await httpJson<{ features?: PhotonFeature[] }>(url, { timeoutMs: 8000 });
  return (json.features || []).map(normalizePhoton).filter((r): r is GeoResult => r !== null);
}

async function searchNominatim(q: string): Promise<GeoResult[]> {
  const json = await nominatim<NominatimRow[]>('search', { q, limit: '6', addressdetails: '0' });
  return (Array.isArray(json) ? json : []).map(normalizeNominatim).filter((r): r is GeoResult => r !== null);
}

/** Places matching `q`, biased toward lat/lng when both are finite, cached for ten minutes. */
export function searchPlaces(q: string, lat: number, lng: number): Promise<GeoResult[]> {
  // Rounded so panning slightly still reuses the cached search.
  const biasKey = Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(1)},${lng.toFixed(1)}` : 'global';
  return cachedSource<GeoResult>(
    `geosearch:${q.toLowerCase()}|${biasKey}`,
    async () => {
      const photon = (await optional(searchPhoton(q, lat, lng))) || [];
      // Nominatim's public instance allows one request a second for all its users, so ask only when needed.
      if (photon.length >= ENOUGH_FROM_PHOTON) return mergeResults(photon, []);
      const supplement = (await optional(searchNominatim(q))) || [];
      return mergeResults(photon, supplement);
    },
    CACHE_TTL_MS,
  )();
}
