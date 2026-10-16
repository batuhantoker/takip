import type { CctvCamera } from '@/lib/feeds/cameras/types';

/** Kentucky (KYTC) traffic cameras: the public feature layer behind maps.kytc.ky.gov/trafficcameras. */

const LAYER = 'https://services2.arcgis.com/CcI36Pduqd0OR4W9/arcgis/rest/services/trafficCamerasCur_Prd/FeatureServer/0/query';
const FIELDS = 'id,status,state,county,description,snapshot,latitude,longitude';
const PAGE_SIZE = 1000; // the layer's maxRecordCount
const MAX_PAGES = 10;
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const KY_BOUNDS = { minLat: 36.4, maxLat: 39.2, minLng: -89.6, maxLng: -81.9 };

export interface KytcCamera {
  id?: number | null;
  status?: string | null;
  state?: string | null;
  county?: string | null;
  description?: string | null;
  snapshot?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** An https still URL, or null. A few TRIMARC stills are listed as http://; all of them serve over https too. */
export function snapshotUrl(raw: string | null | undefined): string | null {
  let url: URL;
  try {
    url = new URL(raw ?? '');
  } catch {
    return null;
  }
  if (url.hostname === 'www.trimarc.org') url.protocol = 'https:';
  return url.protocol === 'https:' ? url.href : null;
}

export function mapKytcCamera(a: KytcCamera | null | undefined): CctvCamera | null {
  // The layer also lists TRIMARC's Indiana cameras across the river, which indiana.ts already carries.
  if (a?.state !== 'Kentucky' || a.status !== 'Online') return null;
  if (!Number.isInteger(a.id)) return null;

  const lat = Number(a.latitude);
  const lng = Number(a.longitude);
  if (!(lat > KY_BOUNDS.minLat && lat < KY_BOUNDS.maxLat && lng > KY_BOUNDS.minLng && lng < KY_BOUNDS.maxLng)) return null;

  const feed = snapshotUrl(a.snapshot);
  if (!feed) return null;

  return {
    id: `ky-kytc-${a.id}`,
    lat,
    lng,
    name: a.description?.trim() || `KYTC Camera ${a.id}`,
    city: a.county ? `${a.county} County` : 'Kentucky',
    country: 'US',
    feed_url: feed,
    stream_type: 'jpg',
    source: 'KYTC',
  };
}

export async function fetchKentuckyCameras(): Promise<CctvCamera[]> {
  const cams: CctvCamera[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: FIELDS,
      orderByFields: 'OBJECTID',
      resultOffset: String(page * PAGE_SIZE),
      resultRecordCount: String(PAGE_SIZE),
      returnGeometry: 'false',
      f: 'json',
    });
    const res = await fetch(`${LAYER}?${params}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`KYTC cameras HTTP ${res.status}`);

    const json = await res.json();
    // ArcGIS reports query errors as HTTP 200 with an error body.
    if (json?.error) throw new Error(`KYTC cameras: ${json.error.message ?? 'query error'}`);
    if (!Array.isArray(json?.features)) throw new Error('KYTC cameras: no features in response');

    for (const f of json.features) {
      const cam = mapKytcCamera(f?.attributes);
      if (!cam || seen.has(cam.id)) continue;
      seen.add(cam.id);
      cams.push(cam);
    }
    if (!json.exceededTransferLimit) break;
  }

  return cams;
}
