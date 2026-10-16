import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';

/**
 * TAKIP — Maryland SHA CHART cameras (~520): the public CHART WEB data feed, no key. Live HLS only, no stills.
 * Terms: CHART publishes these as open "Data Feeds" (chart.maryland.gov/DataFeeds); no licence stated, attribute MDOT SHA.
 */

const API = 'https://chartexp1.sha.maryland.gov/CHARTExportClientService/getCameraMapDataJSON.do';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const MDCHART_BOUNDS: Bounds = { minLat: 37.85, maxLat: 39.75, minLng: -79.5, maxLng: -75.0 };

export interface MdChartCamera {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  lat?: number | null;
  lon?: number | null;
  /** `ONLINE` / `OFFLINE`. */
  commMode?: string | null;
  /** `OK`, `COMM_MARGINAL` or `COMM_FAILURE`. */
  opStatus?: string | null;
  /** The streaming edge, e.g. `strmr5.sha.maryland.gov`. */
  cctvIp?: string | null;
  cameraCategories?: (string | null)[] | null;
}

const STREAM_HOST = /^strmr\d+\.sha\.maryland\.gov$/;
const AREA: Record<string, string> = {
  'Wash. DC': 'Washington DC area',
  'Western MD': 'Western Maryland',
  'Southern MD': 'Southern Maryland',
};

/** About half the rows carry a device number (`710002`) as `name`; their description is the label then. */
export function chartLabel(r: Pick<MdChartCamera, 'name' | 'description'>): string | null {
  const name = r.name?.replace(/\s+/g, ' ').trim();
  if (name && /[A-Za-z]/.test(name)) return name;
  const desc = r.description?.replace(/\(CAM \d+\)\s*$/i, '').replace(/\s+/g, ' ').trim();
  return desc || null;
}

export function mapMdChartCamera(r: MdChartCamera | null | undefined): CctvCamera | null {
  if (!r || r.commMode !== 'ONLINE' || (r.opStatus !== 'OK' && r.opStatus !== 'COMM_MARGINAL')) return null;
  const id = r.id?.trim();
  if (!id || !/^[0-9a-f]{32}$/i.test(id)) return null;
  const host = r.cctvIp?.trim().toLowerCase();
  if (!host || !STREAM_HOST.test(host)) return null;

  const lat = Number(r.lat);
  const lng = Number(r.lon);
  const b = MDCHART_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const area = r.cameraCategories?.[0]?.trim();
  return {
    id: `mdsha-${id}`,
    lat,
    lng,
    name: chartLabel(r) || `MDOT SHA Camera ${id}`,
    city: area ? AREA[area] ?? area : 'Maryland',
    country: 'US',
    // Not in the feed; this is the path CHART's own player builds from cctvIp + id.
    stream_url: `https://${host}/rtplive/${id}/playlist.m3u8`,
    stream_type: 'hls',
    source: 'MDOT SHA',
  };
}

export async function fetchMdChartCameras(): Promise<CctvCamera[]> {
  const res = await fetch(API, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`MD CHART cameras HTTP ${res.status}`);

  const json = await res.json();
  if (json?.success === false || !Array.isArray(json?.data)) throw new Error('MD CHART cameras: unexpected response');
  if (json.data.length < 300) throw new Error(`MD CHART cameras short read: ${json.data.length} rows`);

  const seen = new Map<string, CctvCamera>();
  for (const row of json.data) {
    const cam = mapMdChartCamera(row);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Maryland cameras — MDOT SHA CHART: ${seen.size} of ${json.data.length}`);
  return [...seen.values()];
}
