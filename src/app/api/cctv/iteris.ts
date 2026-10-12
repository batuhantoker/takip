import type { CctvCamera } from './types';
import type { Bounds } from './cars';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * OSIRIS — state DOTs on Iteris ATIS (SD511, 511MT). Each deployment publishes keyless GeoJSON layers at
 * `{st}.cdn.iteris-atis.com/geojson/icons/metadata/icons.{layer}.geojson`: one feature per site, its views in `cameras[]`.
 * Terms: MDT allows copying for informational use if unmodified; sd511.org states none.
 * 511SC is on it too, but SCDOT's terms forbid displaying its content without written permission.
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
    for (const view of site?.properties?.cameras ?? []) {
      const cam = mapIterisView(site, view, cfg);
      if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
    }
  }
  console.log(`[OSIRIS] ${cfg.state} cameras — ${cfg.source}: ${seen.size}`);
  return [...seen.values()];
}

export const fetchSddotCameras = () => loadIterisCameras(SDDOT);
export const fetchMdtCameras = () => loadIterisCameras(MDT);
