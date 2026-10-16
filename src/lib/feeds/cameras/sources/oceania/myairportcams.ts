import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — Aus Web Cams aviation weather cameras, AU/NZ/PG (~530): myairportcams.com's own map list, no key.
 * Terms: images © Aus Web Cams; use or reproduction "strictly prohibited without prior written consent" — not yet asked.
 *
 * The list also links other operators' cameras (Airservices, skycam.net.au, home cams); only stills on
 * Aus Web Cams' own hosts are kept, and only at aviation sites.
 */

const API = 'https://myairportcams.com/data.csv';
const OWN_STILL = [
  { tag: 'mac', re: /^https?:\/\/view\.myairportcams\.com\/([\w-]+)\/([\w-]+)\.(?:php|jpe?g)$/i },
  { tag: 'owc', re: /^https?:\/\/view\.onlyweathercams\.com\/engine\/airports\/([\w-]+)\/([\w-]+)\.(?:php|jpe?g)$/i },
];
/** ICAO (Y… Australia, NZ… New Zealand, AY… PNG) or an Australian unlisted-airstrip OZ… code. */
const SITE_CODE = /\b(Y[A-Z]{3}|NZ[A-Z]{2}|AY[A-Z]{2}|OZ[A-Z]{3})\b/;
const AIRFIELD = /\b(airport|airfield|aerodrome|airstrip|airpark|aero)\b/i;
const COUNTRY: Record<string, string> = { Y: 'Australia', O: 'Australia', N: 'New Zealand', A: 'Papua New Guinea' };

export const MYAIRPORTCAMS_BOUNDS = { minLat: -48, maxLat: -1, minLng: 95, maxLng: 180 };

/** One CSV row: `id,site,lat,lng,label,url,label,url,…`. Several stills per site, one camera each. */
export function mapMyAirportCamsRow(line: string): CctvCamera[] {
  // Blank cells are dropped before pairing, as the site's own map does.
  const [, site, latRaw, lngRaw, ...pairs] = line.split(',').map(s => s.trim()).filter(Boolean);
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!site || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return [];
  const b = MYAIRPORTCAMS_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return [];

  const cams: CctvCamera[] = [];
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const [label, url] = [pairs[i], pairs[i + 1]];
    const own = OWN_STILL.map(o => ({ tag: o.tag, m: url.match(o.re) })).find(o => o.m);
    if (!own?.m) continue;
    const [, code, still] = own.m;
    const siteCode = `${code.toUpperCase()} ${site}`.match(SITE_CODE)?.[1];
    if (!siteCode && !AIRFIELD.test(site)) continue;

    cams.push({
      id: `myairportcams-${own.tag}-${code}-${still}`,
      lat,
      lng,
      name: `${site} — ${label}`,
      city: '',
      country: siteCode ? COUNTRY[siteCode[0]] : '',
      // Two rows still say http; both hosts serve the same still over https.
      feed_url: url.replace(/^http:/i, 'https:'),
      external_url: 'https://myairportcams.com/',
      source: 'Aus Web Cams',
    });
  }
  return cams;
}

export async function fetchMyAirportCamsCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`myairportcams HTTP ${res.status}`);
  const text = await res.text();

  const seen = new Map<string, CctvCamera>();
  for (const line of text.split(/\r?\n/)) {
    for (const cam of mapMyAirportCamsRow(line)) if (!seen.has(cam.id)) seen.set(cam.id, cam);
  }
  if (!seen.size) throw new Error('myairportcams: unexpected response');
  console.log(`[TAKIP] myairportcams cameras — Aus Web Cams: ${seen.size}`);
  return [...seen.values()];
}
