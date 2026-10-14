import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — ALERTCalifornia wildfire cameras (UC San Diego), mostly on ridge-top towers, plus the partner networks its
 * index also serves (UNR, Univ. of Oregon, ALERTWest: Hawaii, Nevada, Oregon, the Rockies, a few in Alberta).
 * Source: the keyless index behind cameras.alertcalifornia.org. About 550 of its live rows carry no location or name;
 * ALERTWest's keyless camera map, which lists the same cameras by hostname, places and names them.
 * Terms: CC BY-NC-ND 4.0, and the credit "ALERTCalifornia | UC San Diego" is required, hence the source label.
 */

const INDEX = 'https://cameras.alertcalifornia.org/public-camera-data/all_cameras-v3.json';
const ALERTWEST = 'https://api.cdn.prod.alertwest.com/api/getCameraDataByLoc';
const IMAGE_BASE = 'https://cameras.alertcalifornia.org/public-camera-data';
const SOURCE = 'ALERTCalifornia | UC San Diego';
const CA_BOUNDS = { minLat: 32.5, maxLat: 42.1, minLng: -124.5, maxLng: -114.0 };
/** Hawaii to Alberta and Colorado: where the partner networks' cameras stand. */
export const ALERTCA_BOUNDS = { minLat: 18.5, maxLat: 56, minLng: -160.5, maxLng: -104.5 };
/** A camera that's off the air keeps serving its last frame from the same URL. */
const MAX_FRAME_AGE_S = 24 * 3600;

const PLACES: Record<string, { city: string; country: string }> = {
  CA: { city: 'California', country: 'US' }, HI: { city: 'Hawaii', country: 'US' },
  NV: { city: 'Nevada', country: 'US' }, OR: { city: 'Oregon', country: 'US' },
  WA: { city: 'Washington', country: 'US' }, ID: { city: 'Idaho', country: 'US' },
  MT: { city: 'Montana', country: 'US' }, WY: { city: 'Wyoming', country: 'US' },
  UT: { city: 'Utah', country: 'US' }, CO: { city: 'Colorado', country: 'US' },
  AZ: { city: 'Arizona', country: 'US' }, NM: { city: 'New Mexico', country: 'US' },
  AB: { city: 'Alberta', country: 'Canada' },
};

export interface AlertCaFeature {
  geometry?: { coordinates?: (number | null)[] | null } | null;
  properties?: {
    id?: string | null;
    name?: string | null;
    /** Unix seconds; 0 when the camera has never reported. */
    last_frame_ts?: number | null;
  } | null;
}

/** One camera as ALERTWest lists it, keyed by its hostname: the index's `id`. */
export interface AlertWestPlace {
  lat: number;
  lng: number;
  /** `Rattlesnake_Peak_1` */
  name?: string;
  /** Two-letter state or province. */
  state?: string;
}

interface AlertWestMap {
  data?: {
    cams?: { data?: Array<{ hn?: string | null; lid?: number | null; cn?: string | null; st?: string | null; pv?: number | null }> | null } | null;
    locs?: { data?: Array<{ id?: number | null; lat?: string | number | null; lon?: string | number | null }> | null } | null;
  } | null;
}

export function alertWestPlaces(json: AlertWestMap | null | undefined): Map<string, AlertWestPlace> {
  const locs = new Map<number, { lat: number; lng: number }>();
  for (const l of json?.data?.locs?.data ?? []) {
    const lat = Number(l?.lat);
    const lng = Number(l?.lon);
    if (typeof l?.id === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) locs.set(l.id, { lat, lng });
  }
  const places = new Map<string, AlertWestPlace>();
  for (const c of json?.data?.cams?.data ?? []) {
    const loc = typeof c?.lid === 'number' ? locs.get(c.lid) : undefined;
    if (!c?.hn || !loc || c.pv) continue;
    places.set(c.hn, { ...loc, name: c.cn ?? undefined, state: c.st ?? undefined });
  }
  return places;
}

/** `place` fills a row the index publishes without a location; without one, only California rows are kept. */
export function mapAlertCaCamera(
  f: AlertCaFeature | null | undefined, nowS = Date.now() / 1000, place?: AlertWestPlace,
): CctvCamera | null {
  const p = f?.properties;
  const id = p?.id?.trim();
  if (!id || !/^[\w-]+$/.test(id)) return null;

  const ts = p?.last_frame_ts;
  if (!ts || !(nowS - ts < MAX_FRAME_AGE_S)) return null;

  const [gLng, gLat] = f?.geometry?.coordinates ?? [];
  const located = typeof gLat === 'number' && typeof gLng === 'number';
  const lat = located ? gLat : place?.lat;
  const lng = located ? gLng : place?.lng;
  const b = place ? ALERTCA_BOUNDS : CA_BOUNDS;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const { city, country } = PLACES[place?.state ?? 'CA'] ?? { city: place?.state || 'California', country: 'US' };
  const name = p?.name?.replace(/\s+/g, ' ').trim() || place?.name?.replace(/[_\s]+/g, ' ').trim();
  return {
    id: `alertca-${id}`,
    lat,
    lng,
    name: name || `ALERTCalifornia ${id}`,
    city,
    country,
    feed_url: `${IMAGE_BASE}/${id}/latest-frame.jpg`,
    stream_type: 'jpg',
    source: SOURCE,
  };
}

async function fetchAlertWestPlaces(): Promise<Map<string, AlertWestPlace>> {
  const res = await stealthFetch(ALERTWEST, {
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`ALERTWest HTTP ${res.status}`);
  return alertWestPlaces(await res.json());
}

export async function fetchAlertCaCameras(): Promise<CctvCamera[]> {
  // Only fills in rows: without it the California cameras still load.
  const places = fetchAlertWestPlaces().catch(e => {
    console.warn(`[TAKIP] ALERTWest places unavailable, California only: ${e?.message ?? e}`);
    return new Map<string, AlertWestPlace>();
  });
  const res = await stealthFetch(INDEX, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`ALERTCalifornia HTTP ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json?.features)) throw new Error('ALERTCalifornia: no features in response');

  const byHost = await places;
  const nowS = Date.now() / 1000;
  const seen = new Map<string, CctvCamera>();
  for (const f of json.features) {
    const cam = mapAlertCaCamera(f, nowS, byHost.get(f?.properties?.id?.trim()));
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Western wildfire cameras — ALERTCalifornia: ${seen.size} of ${json.features.length}`);
  return [...seen.values()];
}
