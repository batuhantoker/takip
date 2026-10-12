import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from './cars';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — state DOTs on Iteris ATIS (SD511, 511MT). Each deployment publishes keyless GeoJSON layers at
 * `{st}.cdn.iteris-atis.com/geojson/icons/metadata/icons.{layer}.geojson`: one feature per site, its views in `cameras[]`.
 * Terms: MDT allows copying for informational use if unmodified; sd511.org states none.
 * SCDOT's terms require its written permission to display its content: pending, not yet granted.
 */

export interface IterisSource {
  /** The CDN subdomain, e.g. `sd`. */
  st: string;
  idPrefix: string;
  source: string;
  state: string;
  bounds: Bounds;
  /** `cameras` is the DOT's camera sites, `rwis` its weather stations with their views. */
  layers: ('cameras' | 'rwis')[];
  /** 511SC lists one camera per feature instead of a site with `cameras[]`. */
  flat?: boolean;
}

export const SDDOT: IterisSource = {
  st: 'sd', idPrefix: 'sddot', source: 'SDDOT', state: 'South Dakota',
  bounds: { minLat: 42.4, maxLat: 46.0, minLng: -104.1, maxLng: -96.4 },
  layers: ['cameras', 'rwis'],
};

export const MDT: IterisSource = {
  st: 'mt', idPrefix: 'mdt', source: 'MDT', state: 'Montana',
  bounds: { minLat: 44.3, maxLat: 49.05, minLng: -116.1, maxLng: -104.0 },
  // MDT's `cameras` layer only republishes its neighbours' cameras (WYDOT, ITD, NDDOT, Alberta, park gates).
  layers: ['rwis'],
};

export const SCDOT: IterisSource = {
  st: 'sc', idPrefix: 'scdot', source: 'SCDOT', state: 'South Carolina',
  bounds: { minLat: 31.9, maxLat: 35.3, minLng: -83.45, maxLng: -78.45 },
  // Its `rwis` layer answers 403.
  layers: ['cameras'],
  flat: true,
};

export interface IterisView {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  image?: string | null;
}

export interface IterisSite {
  id?: string | number | null;
  geometry?: { coordinates?: (number | null)[] | null } | null;
  properties?: {
    id?: string | number | null;
    name?: string | null;
    description?: string | null;
    cameras?: IterisView[] | null;
    jurisdiction?: string | null;
    image_url?: string | null;
    https_url?: string | null;
    active?: boolean | null;
    problem_stream?: boolean | null;
  } | null;
}

const NATIVE_ID = /^[\w-]+$/;

function clean(s: string | null | undefined): string {
  return s?.replace(/\s+/g, ' ').trim() ?? '';
}

function stillUrl(raw: string | null | undefined): string | null {
  try {
    const url = new URL(raw ?? '');
    // SDDOT points dead views at one shared "camera unavailable" frame.
    return url.protocol === 'https:' && !/\/camera_unavailable\.jpg$/i.test(url.pathname) ? url.href : null;
  } catch {
    return null;
  }
}

/** SDDOT's view `name` is a direction and MDT's `description` is; either way the shorter one labels the view. */
function viewLabel(v: IterisView): string {
  return [clean(v.name), clean(v.description)].filter(Boolean).sort((a, b) => a.length - b.length)[0] ?? '';
}

export function mapIterisView(site: IterisSite | null | undefined, view: IterisView | null | undefined, cfg: IterisSource): CctvCamera | null {
  const siteId = String(site?.id ?? site?.properties?.id ?? '').trim();
  const viewId = clean(view?.id);
  if (!view || !NATIVE_ID.test(siteId) || !NATIVE_ID.test(viewId)) return null;

  const [lng, lat] = site?.geometry?.coordinates ?? [];
  const b = cfg.bounds;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const feed = stillUrl(view.image);
  if (!feed) return null;

  const place = clean(site?.properties?.name) || clean(site?.properties?.description);
  const name = [place, viewLabel(view)].filter(Boolean).join(': ');

  return {
    id: `${cfg.idPrefix}-${siteId}-${viewId}`,
    lat,
    lng,
    name: name || `${cfg.source} Camera ${siteId}-${viewId}`,
    city: cfg.state,
    country: 'US',
    feed_url: feed,
    stream_type: 'jpg',
    source: cfg.source,
  };
}

/** A 511SC camera: the still is `/thumbs/{name}.flv.png`, which 301s to `/{name}.png`, and `https_url` is its HLS. */
export function mapIterisFlatCamera(site: IterisSite | null | undefined, cfg: IterisSource): CctvCamera | null {
  const p = site?.properties;
  const id = String(p?.id ?? '').trim();
  if (!p || p.active === false || !NATIVE_ID.test(id)) return null;

  const [lng, lat] = site?.geometry?.coordinates ?? [];
  const b = cfg.bounds;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const feed = stillUrl(p.image_url?.replace(/\/thumbs\/([^/]+)\.flv\.png$/i, '/$1.png'));
  const hls = !p.problem_stream && /^https:\/\/[^/]+\/.+\.m3u8$/i.test(p.https_url ?? '') ? p.https_url! : undefined;
  if (!feed && !hls) return null;

  return {
    id: `${cfg.idPrefix}-${id}`,
    lat,
    lng,
    name: clean(p.description) || clean(p.name) || `${cfg.source} Camera ${id}`,
    city: clean(p.jurisdiction) || cfg.state,
    country: 'US',
    ...(feed ? { feed_url: feed } : {}),
    ...(hls ? { stream_url: hls, stream_type: 'hls' as const } : {}),
    source: cfg.source,
  };
}

async function fetchLayer(cfg: IterisSource, layer: string): Promise<IterisSite[]> {
  const res = await stealthFetch(`https://${cfg.st}.cdn.iteris-atis.com/geojson/icons/metadata/icons.${layer}.geojson`, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${cfg.source} ${layer} HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json?.features)) throw new Error(`${cfg.source} ${layer}: no features in response`);
  return json.features;
}

export async function loadIterisCameras(cfg: IterisSource): Promise<CctvCamera[]> {
  const layers = await Promise.all(cfg.layers.map(layer => fetchLayer(cfg, layer)));
  const seen = new Map<string, CctvCamera>();
  for (const site of layers.flat()) {
    const cams = cfg.flat
      ? [mapIterisFlatCamera(site, cfg)]
      : (site?.properties?.cameras ?? []).map(view => mapIterisView(site, view, cfg));
    for (const cam of cams) {
      if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
    }
  }
  console.log(`[TAKIP] ${cfg.state} cameras — ${cfg.source}: ${seen.size}`);
  return [...seen.values()];
}

export const fetchSddotCameras = () => loadIterisCameras(SDDOT);
export const fetchMdtCameras = () => loadIterisCameras(MDT);
export const fetchScdotCameras = () => loadIterisCameras(SCDOT);
