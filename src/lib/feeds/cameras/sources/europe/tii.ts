import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { featureId, featurePage, featurePoint, snapshotUrl, type Bounds, type CarsFeature } from '@/lib/feeds/cameras/sources/platforms/cars';

/**
 * TAKIP — Transport Infrastructure Ireland national-road cameras (~244, 247 views): the CARS GraphQL behind
 * traffic.tii.ie, no key. Stills are on irecam.carsprogram.org, TII's Castle Rock host.
 * Terms: TII's PSI policy releases its information under CC BY 4.0; traffic.tii.ie's own terms page wasn't readable.
 */

const HOST = 'traffic.tii.ie';
const API = `https://${HOST}/api/graphql`;
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
/** About 60% of today's 247: fewer is a broken read, not a smaller network. */
const MIN_CAMERAS = 150;

export const TII_BOUNDS: Bounds = { minLat: 51.3, maxLat: 55.5, minLng: -10.8, maxLng: -5.9 };

/** `zoom` decides clustering: high enough and every camera comes back on its own. */
const QUERY = `query MapFeatures($input: MapFeaturesArgs!) {
  mapFeaturesQuery(input: $input) {
    mapFeatures {
      title
      uri
      features { geometry }
      __typename
      ... on Camera { active views(limit: 5) { category ... on CameraView { url } } }
    }
    error { message }
  }
}`;

/** One camera per view; a few gantry cameras carry two. */
export function mapTiiCamera(f: CarsFeature | null | undefined, view = 0): CctvCamera | null {
  if (!f) return null;
  const p = featurePoint(f, TII_BOUNDS);
  const id = featureId(f);
  if (!p || !id) return null;

  const v = f.views?.[view];
  if (!v || (v.category && v.category !== 'IMAGE')) return null;
  const feed = snapshotUrl(v.url);
  if (!feed) return null;

  const multi = (f.views?.length ?? 0) > 1;
  const title = f.title?.replace(/\s+/g, ' ').trim() || `TII Camera ${id}`;
  return {
    id: view === 0 ? `tii-${id}` : `tii-${id}-${view + 1}`,
    lat: p.lat,
    lng: p.lng,
    name: multi ? `${title} – view ${view + 1}` : title,
    city: 'Ireland',
    country: 'Ireland',
    feed_url: feed,
    stream_type: 'jpg',
    external_url: featurePage(HOST, f, p),
    source: 'TII',
  };
}

export async function fetchTiiCameras(): Promise<CctvCamera[]> {
  const b = TII_BOUNDS;
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        input: {
          north: b.maxLat, south: b.minLat, east: b.maxLng, west: b.minLng,
          zoom: 16, layerSlugs: ['normalCameras'], nonClusterableUris: null,
        },
      },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`TII cameras HTTP ${res.status}`);

  const json = await res.json();
  const feats = json?.data?.mapFeaturesQuery?.mapFeatures;
  if (!Array.isArray(feats)) {
    throw new Error(`TII cameras: ${json?.data?.mapFeaturesQuery?.error?.message ?? 'no mapFeatures in response'}`);
  }

  const seen = new Map<string, CctvCamera>();
  for (const f of feats as CarsFeature[]) {
    for (let i = 0; i < (f?.views?.length ?? 0); i++) {
      const cam = mapTiiCamera(f, i);
      if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
    }
  }
  if (seen.size < MIN_CAMERAS) throw new Error(`TII cameras short read: ${seen.size}`);
  console.log(`[TAKIP] Ireland cameras — TII: ${seen.size}`);
  return [...seen.values()];
}
