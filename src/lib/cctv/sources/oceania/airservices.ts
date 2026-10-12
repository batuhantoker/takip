import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — Airservices Australia aerodrome weather cameras (~37 sites): weathercams.airservicesaustralia.com, no key.
 * Terms: no reuse terms published; the site says it republishes supplied images (largely the Bureau of
 * Meteorology's) and that they must not be relied on for flight planning. Permission not yet asked.
 *
 * The list is a WordPress AJAX action that wants the public nonce the homepage prints for every visitor.
 * It carries one view per site; the other three are only in a per-airport call, which is not made here.
 */

const SITE = 'https://weathercams.airservicesaustralia.com/';
const AJAX = `${SITE}wp-admin/admin-ajax.php`;
const NONCE = /asa_airports_public_var\s*=\s*\{[^}]*"nonce"\s*:\s*"([a-f0-9]{6,20})"/;
const STILL = /^(https:\/\/weathercams\.airservicesaustralia\.com\/wp-content\/uploads\/airports\/[\w-]+\/[\w-]+\.jpe?g)(?:\?v=\d+)?$/i;

export const AIRSERVICES_BOUNDS = { minLat: -45, maxLat: -9, minLng: 104, maxLng: 169 };

export interface AirservicesAirport {
  title?: string | null;
  name?: string | null;
  thumbnail?: string | null;
  lat?: string | number | null;
  long?: string | number | null;
}

export function mapAirservicesAirport(a: AirservicesAirport | null | undefined): CctvCamera | null {
  const slug = a?.name?.trim();
  // Offline sites point at a shared "Camera-Unavailable.png" instead.
  const still = a?.thumbnail?.trim().match(STILL)?.[1];
  if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug) || !still) return null;

  const lat = a?.lat === '' || a?.lat == null ? NaN : Number(a.lat);
  const lng = a?.long === '' || a?.long == null ? NaN : Number(a.long);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  const b = AIRSERVICES_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;

  const name = a?.title?.trim() || slug;
  return {
    id: `airservices-${slug}`,
    lat,
    lng,
    name,
    city: name,
    country: 'Australia',
    feed_url: still,
    external_url: `${SITE}?airport=${slug}`,
    source: 'Airservices Australia',
  };
}

export async function fetchAirservicesCameras(): Promise<CctvCamera[]> {
  const page = await stealthFetch(SITE, { signal: AbortSignal.timeout(12000) });
  if (!page.ok) throw new Error(`Airservices weathercams HTTP ${page.status}`);
  const nonce = (await page.text()).match(NONCE)?.[1];
  if (!nonce) throw new Error('Airservices weathercams: no nonce on the homepage');

  const query = new URLSearchParams({ action: 'get_airports_list', filter: 'all', type: 'map', filter_type: 'normal', nonce });
  const res = await stealthFetch(`${AJAX}?${query}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Airservices weathercams list HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.airport_list)) throw new Error('Airservices weathercams: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const a of data.airport_list) {
    const cam = mapAirservicesAirport(a);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Airservices cameras — Airservices Australia: ${seen.size}`);
  return [...seen.values()];
}
