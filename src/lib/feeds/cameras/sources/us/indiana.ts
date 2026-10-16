import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { cachedSource } from '@/lib/core/net/source-cache';
import { featureId, featurePage, featurePoint, queryCarsFeatures, type CarsFeature } from '@/lib/feeds/cameras/sources/platforms/cars';

/**
 * TAKIP — Indiana CCTV Cameras (INDOT TrafficWise / 511in.org)
 * Source: https://511in.org/api/graphql — the CARS 511 platform's map query (./cars)
 * ~730 statewide traffic cameras — NO API KEY NEEDED.
 *
 * Every INDOT camera is video. The API hands back a poster frame
 * (`…/INDOT_528_sdRf2LeZp7VYFgcF.flv.png`) that does refresh, but only about
 * once a minute. The live feed is HLS, keyed by the same `INDOT_{id}_{token}`
 * the poster URL carries, which is what `streamUrl` rebuilds — the API never
 * gives out the playlist address itself.
 *
 * The stream starts cold: the first request gets a short `PreRoll` filler loop
 * while the encoder session spins up, and real segments follow within ~20s. A
 * tile sits in LINKING until then.
 */

const HOST = '511in.org';

/** Indiana bounding box — drops any stray/placeholder coordinates. */
const IN_BOUNDS = { minLat: 37.7, maxLat: 41.9, minLng: -88.2, maxLng: -84.6 };

/**
 * The streaming edge, and it has to be this one. skysfs1 and skysfs2 answer
 * every request with HTTP 200, which reads as healthy, but what they serve is
 * the two-segment `PreRoll` placeholder loop and never anything else — polled
 * for two minutes straight a camera there never reaches a `media_*.ts`
 * segment. Only skysfs4 hands over the real feed.
 */
const STREAM_HOST = 'https://skysfs4.trafficwise.org';

/** Pulls the poster URL apart; the token half is what the stream is keyed by. */
const POSTER = /\/cameras\/IN\/(INDOT_\d+_[A-Za-z0-9_-]+)\.flv\.png$/;

export type IndotFeature = CarsFeature;

/** The HLS playlist for a camera token. Exported for tests. */
export function streamUrl(token: string): string {
  return `${STREAM_HOST}/preroll/${token}/playlist.m3u8`;
}

/**
 * INDOT titles read `I-94: 1-094-035-8-1 E OF US421` — a route, then an
 * internal asset number, then the actual place. The asset number is noise on a
 * map label, so it goes.
 *
 * Only when it is cleanly delimited, though. Fifty-odd titles have the place
 * glued straight onto the number (`1-094-041-0-2NORTH OF WARNKE RD`), and
 * nothing says where the number ends — so those keep their original title
 * rather than get cut down to `-2NORTH OF WARNKE RD`.
 */
export function cleanTitle(title: string): string {
  return title
    .replace(/(^|:\s*)\d+(?:-[0-9a-z_]+)*\s+/, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Map one map feature to a camera, or null if unusable. Exported for tests. */
export function mapFeature(f: IndotFeature): CctvCamera | null {
  const p = featurePoint(f, IN_BOUNDS);
  if (!p) return null;

  /* Cameras that are down come back with an icon in place of a feed. */
  const token = (f.views?.[0]?.url || '').match(POSTER)?.[1];
  if (!token) return null;

  const id = featureId(f);
  if (!id) return null;

  return {
    id: `indot-${id}`,
    lat: p.lat,
    lng: p.lng,
    name: cleanTitle(f.title || '') || `INDOT Camera ${id}`,
    city: 'Indiana',
    country: 'US',
    stream_url: streamUrl(token),
    stream_type: 'hls',
    external_url: featurePage(HOST, f, p),
    source: 'INDOT TrafficWise',
  };
}

async function loadIndianaCameras(): Promise<CctvCamera[]> {
  const cams: CctvCamera[] = [];
  const seen = new Set<string>();
  for (const f of await queryCarsFeatures(HOST, IN_BOUNDS)) {
    const cam = mapFeature(f);
    if (!cam || seen.has(cam.id)) continue;
    seen.add(cam.id);
    cams.push(cam);
  }

  console.log(`[TAKIP] Indiana cameras — INDOT TrafficWise: ${cams.length}`);
  return cams;
}

export const fetchIndianaCameras = cachedSource('indiana', loadIndianaCameras);
