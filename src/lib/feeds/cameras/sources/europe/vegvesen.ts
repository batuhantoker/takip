import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';

/**
 * TAKIP — Norwegian road cameras (~860 views at ~730 sites) from Statens vegvesen's road-weather-and-view API, no key.
 * Terms: free to use under NLOD (Norsk lisens for offentlige data); credit Statens vegvesen as the source when redistributing.
 * About 130 views also stream HLS from kamera.vegvesen.no, with CORS * on playlist, chunklist and segments.
 */

const SITES = 'https://road-weather-and-view.atlas.vegvesen.no/weather-information/measurement-sites';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const SOURCE = 'Statens vegvesen';
const STILL_HOST = 'kamera.atlas.vegvesen.no';
const VIDEO_HOST = 'kamera.vegvesen.no';
const MIN_CAMERAS = 500;

// Finnmark reaches 31°E, so the box also covers Finland, most of Estonia and Sweden north of Gothenburg.
export const VEGVESEN_BOUNDS: Bounds = { minLat: 57.8, maxLat: 71.5, minLng: 4.0, maxLng: 31.5 };

export interface VegvesenCamera {
  id?: string | null;
  orientationDescription?: string | null;
  stillImageUrl?: string | null;
  videoUrl?: string | null;
  status?: string | null;
}

export interface VegvesenSite {
  name?: string | null;
  location?: {
    geometry?: { coordinates?: (number | null)[] | null } | null;
    county?: { name?: string | null } | null;
  } | null;
  cameras?: (VegvesenCamera | null)[] | null;
}

const NATIVE_ID = /^[\w-]{1,40}$/;

const clean = (s: string | null | undefined) => s?.replace(/\s+/g, ' ').trim() ?? '';

function httpsOn(raw: string | null | undefined, host: string): URL | null {
  try {
    const url = new URL(raw ?? '');
    return url.protocol === 'https:' && url.hostname === host ? url : null;
  } catch {
    return null;
  }
}

/** The site, then the place the view faces: "Aisaroaivi → Skaidi". */
function viewName(site: VegvesenSite, cam: VegvesenCamera, id: string): string {
  const place = clean(site.name) || `${SOURCE} Camera ${id}`;
  const facing = clean(cam.orientationDescription).replace(/^mot\s+/i, '');
  return facing && facing.toLowerCase() !== place.toLowerCase() ? `${place} → ${facing}` : place;
}

export function mapVegvesenCamera(
  site: VegvesenSite | null | undefined,
  cam: VegvesenCamera | null | undefined,
): CctvCamera | null {
  // EXPIRED views serve an "ute av drift" placeholder.
  if (!site || !cam || cam.status !== 'OK') return null;
  const id = clean(cam.id);
  if (!NATIVE_ID.test(id)) return null;

  const [lng, lat] = site.location?.geometry?.coordinates ?? [];
  const b = VEGVESEN_BOUNDS;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const feed = httpsOn(cam.stillImageUrl, STILL_HOST)?.href;
  const video = httpsOn(cam.videoUrl, VIDEO_HOST);
  const stream = video?.pathname.endsWith('.m3u8') ? video.href : undefined;
  if (!feed && !stream) return null;

  return {
    id: `vegvesen-${id}`,
    lat,
    lng,
    name: viewName(site, cam, id),
    city: clean(site.location?.county?.name) || 'Norway',
    country: 'Norway',
    ...(feed ? { feed_url: feed } : {}),
    ...(stream ? { stream_url: stream, stream_type: 'hls' as const } : { stream_type: 'jpg' as const }),
    source: SOURCE,
  };
}

export async function fetchVegvesenCameras(): Promise<CctvCamera[]> {
  const res = await fetch(SITES, {
    // 406 without the vendor media type, 400 without a system id.
    headers: { 'User-Agent': UA, Accept: 'application/vnd.svv.v1+json', 'X-System-ID': 'takip' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Statens vegvesen cameras HTTP ${res.status}`);

  const json = await res.json();
  const sites: unknown = json?.measurementSites;
  if (!Array.isArray(sites)) throw new Error('Statens vegvesen cameras: no measurementSites in response');

  const seen = new Map<string, CctvCamera>();
  for (const site of sites as (VegvesenSite | null)[]) {
    for (const raw of Array.isArray(site?.cameras) ? site.cameras : []) {
      const cam = mapVegvesenCamera(site, raw);
      if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
    }
  }
  if (seen.size < MIN_CAMERAS) throw new Error(`Statens vegvesen cameras: short read (${seen.size})`);
  console.log(`[TAKIP] Norway cameras — Statens vegvesen: ${seen.size}`);
  return [...seen.values()];
}
