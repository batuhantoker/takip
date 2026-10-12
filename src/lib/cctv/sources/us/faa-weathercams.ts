import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — FAA WeatherCams (~3,550 cameras at ~980 sites, ~645 of them NAV CANADA), no key.
 * Terms: FAA's own imagery is a US federal work; ~65% of sites are third-party (`operatedBy`), and
 * NAV CANADA's are Crown copyright. FAA marks all of it advisory, not for regulatory use.
 *
 * An image URL embeds its capture time in ms, which no index carries, so the still is our own
 * `faa/snapshot` route: it asks for the camera's newest frame and redirects there.
 */

const API = 'https://weathercams.faa.gov/api/sites';
const LATEST = (id: number) => `https://weathercams.faa.gov/api/cameras/${id}/images/last/1`;
const IMAGE_HOST = 'images.wcams-static.faa.gov';
/** The API answers 401 without a weathercams.faa.gov Referer. */
const REFERER = 'https://weathercams.faa.gov/';
const MAX_AGE_DAYS = 7;

export const FAA_BOUNDS = { minLat: 18, maxLat: 75, minLng: -180, maxLng: -52 };

export interface FaaCamera {
  cameraId?: number | null;
  cameraDirection?: string | null;
  cameraLastSuccess?: string | null;
  cameraInMaintenance?: boolean | null;
  cameraOutOfOrder?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface FaaSite {
  siteId?: number | null;
  siteName?: string | null;
  siteArea?: string | null;
  siteActive?: boolean | null;
  siteInMaintenance?: boolean | null;
  country?: string | null;
  state?: string | null;
  operatedBy?: string | null;
  cameras?: FaaCamera[] | null;
}

export function mapFaaCamera(site: FaaSite, cam: FaaCamera | null | undefined, now: number = Date.now()): CctvCamera | null {
  if (site?.siteActive !== true || site.siteInMaintenance === true) return null;
  // ALERTCalifornia's towers; alertcalifornia.ts carries them with stills.
  if (site.operatedBy === 'UCSD') return null;
  if (!cam || cam.cameraInMaintenance === true || cam.cameraOutOfOrder === true) return null;

  const id = cam.cameraId;
  const siteId = site.siteId;
  if (!Number.isInteger(id) || !Number.isInteger(siteId)) return null;

  const last = Date.parse(cam.cameraLastSuccess ?? '');
  if (!Number.isFinite(last) || now - last > MAX_AGE_DAYS * 86_400_000) return null;

  const lat = cam.latitude;
  const lng = cam.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  const b = FAA_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;

  const siteName = site.siteName?.trim() || `FAA Site ${siteId}`;
  const direction = cam.cameraDirection?.trim();
  const country = site.country === 'CA' ? 'Canada' : site.country === 'US' ? 'US' : site.country?.trim() || '';

  return {
    id: `faa-${id}`,
    lat,
    lng,
    name: direction ? `${siteName} — ${direction}` : siteName,
    city: site.state?.trim() || '',
    country,
    feed_url: `/api/cctv/faa/snapshot?id=${id}`,
    external_url: `https://weathercams.faa.gov/map/${lng},${lat},11/cameraSite/${siteId}/details/camera/${id}`,
    source: site.operatedBy === 'NAV CANADA' ? 'NAV CANADA via FAA WeatherCams' : 'FAA WeatherCams',
  };
}

export async function fetchFaaCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json', Referer: REFERER },
  });
  if (!res.ok) throw new Error(`FAA WeatherCams HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json?.payload)) throw new Error('FAA WeatherCams: no payload in response');

  const now = Date.now();
  const seen = new Map<string, CctvCamera>();
  for (const site of json.payload as FaaSite[]) {
    for (const c of site?.cameras ?? []) {
      const cam = mapFaaCamera(site, c, now);
      if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
    }
  }
  console.log(`[TAKIP] FAA cameras — FAA WeatherCams: ${seen.size}`);
  return [...seen.values()];
}

/** The newest frame's URL from `/api/cameras/{id}/images/last/1`, or null if it is not an FAA image. */
export function parseLatestImage(json: unknown, id: number): string | null {
  const row = (json as { payload?: { cameraId?: unknown; imageUri?: unknown }[] } | null)?.payload?.[0];
  if (row?.cameraId !== id || typeof row.imageUri !== 'string') return null;
  try {
    const url = new URL(row.imageUri);
    return url.protocol === 'https:' && url.hostname === IMAGE_HOST ? url.href : null;
  } catch {
    return null;
  }
}

export async function fetchLatestFaaImage(id: number): Promise<string | null> {
  const res = await stealthFetch(LATEST(id), {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: 'application/json', Referer: REFERER },
  });
  if (!res.ok) throw new Error(`FAA WeatherCams image HTTP ${res.status}`);
  return parseLatestImage(await res.json(), id);
}
