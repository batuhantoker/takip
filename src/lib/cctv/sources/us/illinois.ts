import { proxiedImageUrl, type CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';

/**
 * TAKIP — Illinois cameras from IDOT's "Illinois Gateway Traffic Cameras" ArcGIS layer (~3,010 views), no key:
 * ~1,557 at Lake County PASSAGE intersections, and ~1,455 from IDOT (Chicago and statewide, Metro East included),
 * DuPage and Kane counties and the Tollway on cctv.travelmidwest.com.
 * Travel Midwest answers 403 to a foreign Referer, so its stills go through /api/cctv/proxy.
 * Terms: the layer is CC BY-SA 2.0, credit Illinois Department of Transportation; Lake County PASSAGE publishes none.
 * Travel Midwest asks that republishing go through IDOT's Gateway data-request form: not yet filed.
 */

const LAYER = 'https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/TrafficCamerasTM_Public/FeatureServer/0/query';
const FIELDS = 'OBJECTID,ImgPath,CameraLocation,CameraDirection,y,x,SnapShot,TooOld';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const PASSAGE_HOST = 'www.lakecountypassage.com';
const MIDWEST_HOST = 'cctv.travelmidwest.com';
/** The layer's maxRecordCount. */
const PAGE = 1000;
const MAX_PAGES = 5;
/** About 60% of today's 3,012: fewer is a broken read, not a smaller network. */
const MIN_CAMERAS = 1800;
const NATIVE_ID = /^IL-([A-Z]+\d*)-[\w-]+$/;
/** By the id's agency segment. */
const AGENCIES: Record<string, string> = {
  LAKECOUNTY: 'IDOT / Lake County PASSAGE',
  IDOTD1: 'IDOT',
  IDOTD4: 'IDOT',
  DUPAGECOUNTY: 'DuPage County DOT',
  KANECOUNTY: 'Kane County DOT',
  ISTHA: 'Illinois Tollway',
};
/** `IL-IDOTD4_5_St-Clair_SEB_I-64_…jpg`: the third segment is the county. */
const MIDWEST_COUNTY = /^IL-[A-Z]+\d*_\d+_([A-Za-z-]+)_/;
const DIRECTIONS: Record<string, string> = {
  N: 'North', S: 'South', E: 'East', W: 'West', NE: 'Northeast', NW: 'Northwest', SE: 'Southeast', SW: 'Southwest',
};

export const ILLINOIS_BOUNDS: Bounds = { minLat: 36.9, maxLat: 42.6, minLng: -91.6, maxLng: -87.4 };

export interface IllinoisCamera {
  /** travelmidwest.com/showCamera?id=<camera>&direction=<view>: the only stable id the layer carries. */
  ImgPath?: string | null;
  CameraLocation?: string | null;
  CameraDirection?: string | null;
  y?: number | null;
  x?: number | null;
  SnapShot?: string | null;
  /** "true" once the still is over 30 minutes old. */
  TooOld?: string | null;
}

function midwestCounty(still: URL): string {
  const county = still.pathname.split('/').pop()?.match(MIDWEST_COUNTY)?.[1];
  return county ? `${county.replace(/^St-/, 'St. ').replace(/-/g, ' ')} County, Illinois` : 'Illinois';
}

export function mapIllinoisCamera(a: IllinoisCamera | null | undefined): CctvCamera | null {
  if (!a || a.TooOld === 'true') return null;

  let still: URL;
  let page: URL;
  try {
    still = new URL(a.SnapShot ?? '');
    page = new URL(a.ImgPath ?? '');
  } catch {
    return null;
  }
  const passage = still.hostname === PASSAGE_HOST;
  if (still.protocol !== 'https:' || !(passage || still.hostname === MIDWEST_HOST)) return null;

  // Tollway ids are base64, whose `+` arrives as a space.
  const camera = page.searchParams.get('id')?.replace(/[^\w-]/g, '_');
  const agency = camera?.match(NATIVE_ID)?.[1];
  // Kane County's pages carry no direction; the row still does.
  const dir = page.searchParams.get('direction') ?? a.CameraDirection;
  if (!camera || !agency || !dir || !(dir === 'NONE' || Object.hasOwn(DIRECTIONS, dir))) return null;

  const lat = a.y;
  const lng = a.x;
  const b = ILLINOIS_BOUNDS;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const place = a.CameraLocation?.replace(/\s+/g, ' ').trim() || camera;
  return {
    id: dir === 'NONE' ? `idot-${camera}` : `idot-${camera}-${dir}`,
    lat,
    lng,
    name: dir === 'NONE' ? place : `${place} – ${DIRECTIONS[dir]}`,
    city: passage ? 'Lake County, Illinois' : midwestCounty(still),
    country: 'US',
    feed_url: passage ? still.href : proxiedImageUrl(still.href),
    stream_type: 'jpg',
    external_url: page.href,
    source: AGENCIES[agency] ?? 'Travel Midwest',
  };
}

function pageUrl(offset: number): string {
  const params = new URLSearchParams({
    where: `SnapShot LIKE 'https://${PASSAGE_HOST}/%' OR SnapShot LIKE 'https://${MIDWEST_HOST}/%'`,
    outFields: FIELDS,
    returnGeometry: 'false',
    orderByFields: 'OBJECTID',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    f: 'json',
  });
  return `${LAYER}?${params}`;
}

export async function fetchIllinoisCameras(): Promise<CctvCamera[]> {
  const seen = new Map<string, CctvCamera>();
  for (let p = 0; p < MAX_PAGES; p++) {
    const res = await fetch(pageUrl(p * PAGE), {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`IDOT cameras HTTP ${res.status}`);

    const json = await res.json();
    // ArcGIS reports query errors as HTTP 200 with an error body.
    if (json?.error) throw new Error(`IDOT cameras: ${json.error.message ?? 'query error'}`);
    if (!Array.isArray(json?.features)) throw new Error('IDOT cameras: no features in response');

    for (const f of json.features) {
      const cam = mapIllinoisCamera(f?.attributes);
      if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
    }
    if (json.features.length < PAGE) break;
  }
  if (seen.size < MIN_CAMERAS) throw new Error(`IDOT cameras short read: ${seen.size}`);
  console.log(`[TAKIP] Illinois cameras — IDOT, Lake County PASSAGE, Travel Midwest: ${seen.size}`);
  return [...seen.values()];
}
