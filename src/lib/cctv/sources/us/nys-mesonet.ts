import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — New York State Mesonet station cameras (~126 of 127 stations, one view each), no key.
 * Terms: copyrighted by the Mesonet (University at Albany): "no redistribution, sharing, or selling
 * of the data is allowed" and no graphics may be copied without written consent; permission not yet asked.
 */

const STATIONS = 'https://api.nysmesonet.org/meta/geoinfo/index.php/geojson/nysm';
const LATEST = 'https://api.nysmesonet.org/cam/index.php/multilist/nysm';
const IMAGE_BASE = 'https://api.nysmesonet.org/cam/index.php/image/nysm';
/** Stations photograph every 5 minutes. */
const MAX_AGE_S = 7 * 86_400;

export const NYS_MESONET_BOUNDS = { minLat: 40.4, maxLat: 45.1, minLng: -80, maxLng: -71.7 };

export interface NysmStation {
  geometry?: { coordinates?: (number | null)[] | null } | null;
  properties?: {
    stid?: string | null;
    name?: string | null;
    city?: string | null;
    decommissioned?: number | null;
  } | null;
}

export interface NysmPhoto {
  /** Unix seconds of the capture. */
  timestamp?: number | null;
}

const stidOf = (s: NysmStation | null | undefined) => {
  const stid = s?.properties?.stid?.trim();
  return stid && /^[A-Z0-9]+$/.test(stid) && s!.properties!.decommissioned == null ? stid : null;
};

export function mapNysmStation(
  station: NysmStation | null | undefined,
  photo: NysmPhoto | null | undefined,
  nowS: number = Date.now() / 1000,
): CctvCamera | null {
  const stid = stidOf(station);
  if (!stid) return null;

  const ts = photo?.timestamp;
  if (typeof ts !== 'number' || !(ts > 0) || nowS - ts > MAX_AGE_S) return null;

  const [lng, lat] = station!.geometry?.coordinates ?? [];
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const b = NYS_MESONET_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;

  const p = station!.properties!;
  return {
    id: `nysm-${stid}`,
    lat,
    lng,
    name: p.name?.trim() || stid,
    city: p.city?.trim() || '',
    country: 'US',
    // Always the newest photo; the timestamped URLs from the list endpoint are fixed frames.
    feed_url: `${IMAGE_BASE}/${stid}/latest`,
    stream_type: 'jpg',
    external_url: `https://nysmesonet.org/weather/#?network=nysm&stid=${stid}`,
    source: 'NYS Mesonet',
  };
}

export async function fetchNysMesonetCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(STATIONS, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`NYS Mesonet stations HTTP ${res.status}`);
  const geo = await res.json();
  if (!Array.isArray(geo?.features)) throw new Error('NYS Mesonet: no features in station list');

  const stations = new Map<string, NysmStation>();
  for (const f of geo.features as NysmStation[]) {
    const stid = stidOf(f);
    if (stid && !stations.has(stid)) stations.set(stid, f);
  }
  if (stations.size === 0) return [];

  // One call for every station's newest photo; a station without a camera returns `photos: []`.
  const latestRes = await stealthFetch(`${LATEST}/${[...stations.keys()].join(',')}/latest`, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json' },
  });
  if (!latestRes.ok) throw new Error(`NYS Mesonet photos HTTP ${latestRes.status}`);
  const latest = await latestRes.json();

  const nowS = Date.now() / 1000;
  const cams: CctvCamera[] = [];
  for (const [stid, station] of stations) {
    const photos = latest?.[stid]?.photos;
    const cam = mapNysmStation(station, Array.isArray(photos) ? photos[0] : null, nowS);
    if (cam) cams.push(cam);
  }
  console.log(`[TAKIP] NYS Mesonet cameras — NYS Mesonet: ${cams.length}`);
  return cams;
}
