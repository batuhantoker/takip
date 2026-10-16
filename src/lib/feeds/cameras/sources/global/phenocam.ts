import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — PhenoCam Network ecology cameras (~1,086 sites, mostly North America), no key.
 * Terms: CC BY 4.0; credit "PhenoCam Network" (phenocam.nau.edu fair-use policy, 3 Mar 2026).
 *
 * The still is `/data/latest/<site>.jpg`, the newest 30-minute frame. A mid-day still has no
 * stable URL: the middayimages API lists a site's whole archive, so it would cost a call per site.
 */

const API = 'https://phenocam.nau.edu/api/cameras/?format=json&limit=2000';
const IMAGE_BASE = 'https://phenocam.nau.edu/data/latest';
/** `active` stays true on sites that stopped uploading years ago; `date_last` is the real signal. */
const MAX_AGE_DAYS = 30;

export const PHENOCAM_BOUNDS = { minLat: -64, maxLat: 72, minLng: -180, maxLng: 180 };

export interface PhenoCamSite {
  Sitename?: string | null;
  Lat?: number | null;
  Lon?: number | null;
  active?: boolean | null;
  date_last?: string | null;
  sitemetadata?: { site_description?: string | null } | null;
}

export function mapSite(site: PhenoCamSite, now: number = Date.now()): CctvCamera | null {
  const name = site?.Sitename?.trim();
  if (!name || !/^[\w.-]+$/.test(name) || /^test|test$/i.test(name) || site.active !== true) return null;

  const last = Date.parse(`${site.date_last}T00:00:00Z`);
  if (!Number.isFinite(last) || now - last > MAX_AGE_DAYS * 86_400_000) return null;

  const lat = site.Lat;
  const lng = site.Lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  const b = PHENOCAM_BOUNDS;
  if (lat! < b.minLat || lat! > b.maxLat || lng! < b.minLng || lng! > b.maxLng) return null;

  return {
    id: `phenocam-${name}`,
    lat: lat!,
    lng: lng!,
    name: site.sitemetadata?.site_description?.trim() || name,
    city: '',
    country: '',
    feed_url: `${IMAGE_BASE}/${name}.jpg`,
    external_url: `https://phenocam.nau.edu/webcam/sites/${name}/`,
    source: 'PhenoCam Network',
  };
}

export async function fetchPhenoCamCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`PhenoCam HTTP ${res.status}`);
  const data = await res.json();

  const now = Date.now();
  const seen = new Map<string, CctvCamera>();
  for (const site of data?.results || []) {
    const cam = mapSite(site, now);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] PhenoCam cameras — PhenoCam Network: ${seen.size}`);
  return [...seen.values()];
}
