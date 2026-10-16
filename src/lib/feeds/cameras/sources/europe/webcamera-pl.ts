import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — webcamera.pl tourist cameras (~430 across Poland), from the marker list embedded in the site's own map
 * page, no key.
 * Terms: all rights to the site's content reserved to Webcamera Media sp. z o.o. or third parties; no reuse licence
 * (webcamera.pl regulamin 2023-01-23, §16).
 *
 * The still is the 1080p frame the site's own cards use. The live player's URL carries a per-camera hash the
 * map list doesn't give, so there is no stream here.
 */

const PAGE = 'https://www.webcamera.pl/mapa';
const MARKERS_PREFIX = 'var MAP_MARKERS = ';
const SOURCE = 'webcamera.pl';

export const WEBCAMERA_PL_BOUNDS = { minLat: 48.9, maxLat: 55, minLng: 14, maxLng: 24.2 };

export interface WebcameraPlMarker {
  cam?: string | null;
  url?: string | null;
  name?: string | null;
  is_inactive?: boolean | null;
  /** Decimal strings. */
  lat?: string | number | null;
  lng?: string | number | null;
}

/** The JSON value right after `prefix`, read up to its matching bracket. */
function embeddedJson(html: string, prefix: string): unknown {
  const start = html.indexOf(prefix);
  if (start < 0) return null;
  const from = start + prefix.length;
  let depth = 0;
  let inString = false;
  for (let i = from; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      if (--depth === 0) return JSON.parse(html.slice(from, i + 1));
    }
  }
  return null;
}

export function extractMarkers(html: string): WebcameraPlMarker[] | null {
  let markers: unknown;
  try {
    markers = embeddedJson(html, MARKERS_PREFIX);
  } catch {
    return null;
  }
  return markers && typeof markers === 'object' && !Array.isArray(markers)
    ? Object.values(markers as Record<string, WebcameraPlMarker>)
    : null;
}

function ownPage(url: string | null | undefined): string | null {
  try {
    const u = new URL(url ?? '');
    return u.protocol === 'https:' && (u.hostname === 'webcamera.pl' || u.hostname.endsWith('.webcamera.pl')) ? u.href : null;
  } catch {
    return null;
  }
}

export function mapWebcameraPlMarker(m: WebcameraPlMarker): CctvCamera | null {
  const slug = m?.cam?.trim();
  if (!slug || !/^[a-z0-9-]+$/.test(slug) || m.is_inactive !== false) return null;

  const lat = Number(m.lat);
  const lng = Number(m.lng);
  if (m.lat == null || m.lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  const b = WEBCAMERA_PL_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;

  return {
    id: `webcamerapl-${slug}`,
    lat,
    lng,
    name: m.name?.replace(/\s+/g, ' ').trim() || slug,
    city: '',
    country: 'Poland',
    feed_url: `https://imageserver.webcamera.pl/miniaturki/${slug}.jpg`,
    external_url: ownPage(m.url) ?? `https://${slug}.webcamera.pl/`,
    source: SOURCE,
  };
}

export async function fetchWebcameraPlCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(PAGE, { signal: AbortSignal.timeout(12000), headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error(`webcamera.pl HTTP ${res.status}`);
  const markers = extractMarkers(await res.text());
  if (!markers) throw new Error('webcamera.pl: no MAP_MARKERS on the map page');

  const seen = new Map<string, CctvCamera>();
  for (const m of markers) {
    const cam = mapWebcameraPlMarker(m);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Polish cameras — ${SOURCE}: ${seen.size}`);
  return [...seen.values()];
}
