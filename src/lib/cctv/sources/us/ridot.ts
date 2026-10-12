import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';

/**
 * TAKIP — Rhode Island DOT cameras (~139): the camera layer of RIDOT's Rhodeways map on risegis.ri.gov, no key.
 * Stills only: the cameras' HLS is Referer-gated. A few listed stills redirect to the RIDOT home page instead.
 * Terms: RI.gov's copyright notice calls its information public and free to distribute or copy; credit requested.
 */

const LAYER = 'https://risegis.ri.gov/hosting/rest/services/RIDOT/Rhodeways/MapServer/6/query';
const FIELDS = 'EquipmentID,Description,Latitude,Longitude,Enabled,CCVEWebURL';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const RIDOT_BOUNDS: Bounds = { minLat: 41.1, maxLat: 42.05, minLng: -71.95, maxLng: -71.1 };
/** About 60% of today's 139: fewer is a broken read, not a smaller network. */
const MIN_CAMERAS = 80;
/** The layer also lists the TMC's own building cameras (`RIDOT TMC Entrance Security Camera`, `TMC-CCVE`). */
const INDOOR = /\bTMC\b|\bsecurity\b/i;

export interface RidotCamera {
  EquipmentID?: number | null;
  /** Mostly a route and mile code: `95_42.4_N_CAM - Broadway (Pawt)`. */
  Description?: string | null;
  Latitude?: number | null;
  Longitude?: number | null;
  Enabled?: number | null;
  /** Often http://, sometimes with a trailing tab, with raw spaces in the file name. */
  CCVEWebURL?: string | null;
}

/** `<route>_<mile>[_<dir>]_CAM[ -] <place>` */
const MILE_CODE = /^(\d{1,3})_(\d+(?:\.\d+)?)(?:_([A-Z]{1,2}))?_CAM\b\s*(?:-\s*)?/;
/** Route 1 and I-195 cameras lead with a sequence number instead: `1-10 Rt 1 N @ Rt 78 Westerly`. */
const SEQUENCE = /^\d{1,3}-\d{1,2}\s+(?=(?:Rt|I-)\s?\d)/;

/** `95_42.4_N_CAM - Broadway (Pawt)` → `I-95 N MM 42.4 – Broadway (Pawt)`. */
export function ridotCameraName(raw: string | null | undefined): string | null {
  const name = raw?.replace(/\s+/g, ' ').trim();
  if (!name) return null;
  const m = name.match(MILE_CODE);
  if (!m) return name.replace(SEQUENCE, '');

  const [, route, mile, dir] = m;
  const road = /^[12]?95$/.test(route) ? `I-${route}` : `Rt ${route}`;
  // The codes also use M and SM, which aren't a direction of travel.
  const head = [road, /^[NSEW]$/.test(dir ?? '') ? dir : '', `MM ${mile.replace(/^0+(?=\d)/, '')}`].filter(Boolean).join(' ');
  const place = name.slice(m[0].length).trim();
  return place ? `${head} – ${place}` : head;
}

function stillUrl(raw: string | null | undefined): string | null {
  let url: URL;
  try {
    url = new URL(raw?.trim() ?? '');
  } catch {
    return null;
  }
  // Most are listed as http://; all of them serve over https too.
  if (url.hostname === 'www.dot.ri.gov') url.protocol = 'https:';
  return url.protocol === 'https:' ? url.href : null;
}

export function mapRidotCamera(a: RidotCamera | null | undefined): CctvCamera | null {
  if (a?.Enabled !== 1 || !Number.isInteger(a.EquipmentID)) return null;
  if (INDOOR.test(a.Description ?? '')) return null;

  const lat = Number(a.Latitude);
  const lng = Number(a.Longitude);
  const b = RIDOT_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const feed = stillUrl(a.CCVEWebURL);
  if (!feed) return null;

  return {
    id: `ridot-${a.EquipmentID}`,
    lat,
    lng,
    name: ridotCameraName(a.Description) || `RIDOT Camera ${a.EquipmentID}`,
    city: 'Rhode Island',
    country: 'US',
    feed_url: feed,
    stream_type: 'jpg',
    source: 'RIDOT',
  };
}

export async function fetchRidotCameras(): Promise<CctvCamera[]> {
  const params = new URLSearchParams({ where: '1=1', outFields: FIELDS, returnGeometry: 'false', f: 'json' });
  const res = await fetch(`${LAYER}?${params}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`RIDOT cameras HTTP ${res.status}`);

  const json = await res.json();
  // ArcGIS reports query errors as HTTP 200 with an error body.
  if (json?.error) throw new Error(`RIDOT cameras: ${json.error.message ?? 'query error'}`);
  if (!Array.isArray(json?.features)) throw new Error('RIDOT cameras: no features in response');

  const seen = new Map<string, CctvCamera>();
  for (const f of json.features) {
    const cam = mapRidotCamera(f?.attributes);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  if (seen.size < MIN_CAMERAS) throw new Error(`RIDOT cameras short read: ${seen.size}`);
  console.log(`[TAKIP] Rhode Island cameras — RIDOT: ${seen.size}`);
  return [...seen.values()];
}
