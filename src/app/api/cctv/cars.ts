import type { CctvCamera } from './types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * OSIRIS — helpers for the CARS 511 platform (Castle Rock), which several state DOTs run behind their own domains.
 * Every deployment answers the same GraphQL map query, so a state is a host and a bounding box. Indiana adds its own
 * HLS rebuild on top (./indiana); the rest show the still each camera's view carries.
 */

export interface Bounds { minLat: number; maxLat: number; minLng: number; maxLng: number }

export interface CarsSource {
  /** e.g. `511mn.org` */
  host: string;
  idPrefix: string;
  source: string;
  state: string;
  bounds: Bounds;
}

/**
 * A view's `url` lives on CameraView, not on the interface `views` returns, so
 * it has to come through an inline fragment. Selecting it bare validates as an
 * error and the server answers those with a 400, not a message.
 */
const QUERY = `query MapFeatures($input: MapFeaturesArgs!) {
  mapFeaturesQuery(input: $input) {
    mapFeatures {
      title
      uri
      features { geometry }
      __typename
      ... on Camera { active views(limit: 1) { category ... on CameraView { url } } }
    }
    error { message }
  }
}`;

export interface CarsFeature {
  title?: string | null;
  uri?: string | null;
  features?: Array<{ geometry?: { coordinates?: [number, number] } | null }> | null;
  __typename?: string | null;
  active?: boolean | null;
  views?: Array<{ url?: string | null; category?: string | null }> | null;
}

/** Every map feature the deployment returns for a box. */
export async function queryCarsFeatures(host: string, b: Bounds): Promise<CarsFeature[]> {
  const res = await stealthFetch(`https://${host}/api/graphql`, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Referer: `https://${host}/` },
    body: JSON.stringify({
      query: QUERY,
      /* `zoom` decides clustering, so it has to be high enough that the server returns cameras and not clusters. */
      variables: {
        input: {
          north: b.maxLat,
          south: b.minLat,
          east: b.maxLng,
          west: b.minLng,
          zoom: 16,
          layerSlugs: ['normalCameras'],
          nonClusterableUris: null,
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`${host} HTTP ${res.status}`);

  const json = await res.json();
  const feats = json?.data?.mapFeaturesQuery?.mapFeatures;
  if (!Array.isArray(feats)) throw new Error(`${host} returned no mapFeatures`);
  return feats;
}

/** A live camera's position inside the box, or null. GeoJSON order: `[lng, lat]`. */
export function featurePoint(f: CarsFeature, b: Bounds): { lat: number; lng: number } | null {
  if (f?.__typename !== 'Camera' || f.active === false) return null;
  const coords = f.features?.[0]?.geometry?.coordinates;
  if (!coords) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;
  return { lat, lng };
}

export function featureId(f: CarsFeature): string | null {
  return f.uri?.match(/camera\/(\d+)/)?.[1] ?? null;
}

/** The camera's page on the deployment's own map. */
export function featurePage(host: string, f: CarsFeature, p: { lat: number; lng: number }): string {
  return `https://${host}/@${p.lat},${p.lng},14?show=${encodeURIComponent(f.uri || '')}`;
}

/** The view's still, minus the cache-buster the server stamps on (it is frozen for as long as the catalogue is cached). */
export function snapshotUrl(raw: string | null | undefined): string | null {
  let url: URL;
  try {
    url = new URL(raw ?? '');
  } catch {
    return null; // Cameras that are down carry a relative placeholder icon.
  }
  if (url.protocol !== 'https:') return null;
  if (/^\?\d+$/.test(url.search)) url.search = '';
  return url.href;
}

export function mapCarsSnapshot(f: CarsFeature, cfg: CarsSource): CctvCamera | null {
  const p = featurePoint(f, cfg.bounds);
  if (!p) return null;
  const id = featureId(f);
  if (!id) return null;
  const feed = snapshotUrl(f.views?.[0]?.url);
  if (!feed) return null;

  return {
    id: `${cfg.idPrefix}-${id}`,
    lat: p.lat,
    lng: p.lng,
    name: f.title?.replace(/\s+/g, ' ').trim() || `${cfg.source} Camera ${id}`,
    city: cfg.state,
    country: 'US',
    feed_url: feed,
    stream_type: 'jpg',
    external_url: featurePage(cfg.host, f, p),
    source: cfg.source,
  };
}

export async function loadCarsCameras(cfg: CarsSource): Promise<CctvCamera[]> {
  const seen = new Map<string, CctvCamera>();
  for (const f of await queryCarsFeatures(cfg.host, cfg.bounds)) {
    const cam = mapCarsSnapshot(f, cfg);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[OSIRIS] ${cfg.source} cameras: ${seen.size}`);
  return [...seen.values()];
}
