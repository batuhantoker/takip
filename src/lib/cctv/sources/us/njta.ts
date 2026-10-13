import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';
import { decodeHtmlEntities } from '@/lib/telegram';

/**
 * TAKIP — New Jersey Turnpike Authority cameras (~136): the Turnpike and the Garden State Parkway. Live HLS only, no stills.
 * There is no camera API; the list page embeds the whole set as JSON in its map block's `data-block-config`.
 */

const PAGE = 'https://www.njta.gov/travel-resources/camera-list/';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const NJTA_BOUNDS: Bounds = { minLat: 38.9, maxLat: 41.4, minLng: -75.6, maxLng: -73.85 };

export type NjtaRoad = 'turnpike' | 'parkway';
const ROAD_NAME: Record<NjtaRoad, string> = { turnpike: 'NJ Turnpike', parkway: 'Garden State Pkwy' };

export interface NjtaCamera {
  id?: number | null;
  lat?: number | null;
  lng?: number | null;
  mile_marker?: number | null;
  /** `north` / `south` / empty: which side of `relative_text` the camera sits. */
  relative_direction?: string | null;
  /** A landmark, usually with the town in trailing parentheses: `NJ 73 (Mount Laurel Twp)`. */
  relative_text?: string | null;
  video_url?: string | null;
  type?: string | null;
}

/** Text that already says where it is, so "North of" would garble it. */
const POSITIONED = /^(MM\b|North\b|South\b|[NS]\.? of\b|NB\b|SB\b|Northbound\b|Southbound\b|Entering\b|Exiting\b)/i;

function cameraLabel(road: NjtaRoad, r: NjtaCamera): { name: string; town: string | null } {
  const text = r.relative_text?.replace(/\s+/g, ' ').trim() ?? '';
  const paren = text.match(/\(([^()]+)\)(?!.*\()/);
  const town = paren?.[1].trim() || null;
  const place = (paren ? text.replace(paren[0], '') : text).replace(/\s+/g, ' ').trim();

  const mm = Number(r.mile_marker);
  const showMm = r.mile_marker != null && Number.isFinite(mm) && !/\bMM \d/.test(place);
  const head = showMm ? `${ROAD_NAME[road]} MM ${Number(mm.toFixed(1))}` : ROAD_NAME[road];

  const dir = r.relative_direction?.trim().toLowerCase();
  const side = (dir === 'north' || dir === 'south') && place && !POSITIONED.test(place)
    ? `${dir[0].toUpperCase()}${dir.slice(1)} of ${place}`
    : place;
  return { name: side ? `${head} · ${side}` : head, town };
}

export function mapNjtaCamera(r: NjtaCamera | null | undefined, road: NjtaRoad): CctvCamera | null {
  if (r?.type !== 'camera' || !Number.isInteger(r.id)) return null;

  const lat = Number(r.lat);
  const lng = Number(r.lng);
  const b = NJTA_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  let stream: URL;
  try {
    stream = new URL(r.video_url ?? '');
  } catch {
    return null;
  }
  if (stream.protocol !== 'https:') return null;

  const { name, town } = cameraLabel(road, r);
  return {
    id: `njta-${r.id}`,
    lat,
    lng,
    name,
    city: town ?? 'New Jersey',
    country: 'US',
    stream_url: stream.href,
    stream_type: 'hls',
    source: 'NJTA',
  };
}

/** Both roads' raw rows from the camera-list page; throws if the embedded map config is missing or empty. */
export function parseNjtaPage(html: string): Record<NjtaRoad, NjtaCamera[]> {
  for (const m of html.matchAll(/data-block-config="([^"]*)"/g)) {
    let cfg: { mode?: string; initialData?: { cameras?: Partial<Record<NjtaRoad, unknown>> } } | null;
    try {
      cfg = JSON.parse(decodeHtmlEntities(m[1]));
    } catch {
      continue;
    }
    const cams = cfg?.initialData?.cameras;
    if (cfg?.mode !== 'traffic-cameras' || !cams) continue;
    if (!Array.isArray(cams.turnpike) || !cams.turnpike.length || !Array.isArray(cams.parkway) || !cams.parkway.length) {
      throw new Error('NJTA cameras: a road is missing from the map config');
    }
    return { turnpike: cams.turnpike as NjtaCamera[], parkway: cams.parkway as NjtaCamera[] };
  }
  throw new Error('NJTA cameras: no traffic-cameras map config on the page');
}

export async function fetchNjtaCameras(): Promise<CctvCamera[]> {
  const res = await fetch(PAGE, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`NJTA cameras HTTP ${res.status}`);

  const roads = parseNjtaPage(await res.text());
  const seen = new Map<string, CctvCamera>();
  for (const road of ['turnpike', 'parkway'] as const) {
    for (const row of roads[road]) {
      const cam = mapNjtaCamera(row, road);
      if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
    }
  }
  console.log(`[TAKIP] New Jersey cameras — NJTA: ${seen.size}`);
  return [...seen.values()];
}
