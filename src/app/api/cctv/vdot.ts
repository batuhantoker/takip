import type { CctvCamera } from './types';
import type { Bounds } from './cars';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * OSIRIS — Virginia DOT cameras (~1,700): the camera layer behind 511.vdot.virginia.gov's map, no key.
 * Terms: VDOT's public 511 data; no licence stated, attribute VDOT.
 * The Esri-hosted CameraLocationVDOT layer is a 2018 copy whose skyvdn media is gone.
 */

const LAYER = 'https://511.vdot.virginia.gov/services/511/map/layers/map/cams';
export const VDOT_BOUNDS: Bounds = { minLat: 36.5, maxLat: 39.5, minLng: -83.7, maxLng: -75.2 };

export interface VdotFeature {
  properties?: {
    id?: string | number | null;
    description?: string | null;
    jurisdiction?: string | null;
    active?: boolean | string | null;
    problem_stream?: boolean | null;
    image_url?: string | null;
    https_url?: string | null;
  } | null;
  geometry?: { coordinates?: (number | null)[] | null } | null;
}

function httpsUrl(raw: string | null | undefined): string | null {
  try {
    const url = new URL(raw ?? '');
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function mapVdotCamera(feature: VdotFeature | null | undefined): CctvCamera | null {
  const p = feature?.properties;
  if (!p || String(p.active) !== 'true' || p.problem_stream === true) return null;
  const id = String(p.id ?? '').trim();
  if (!/^\d+$/.test(id)) return null;

  const [lng, lat] = (feature?.geometry?.coordinates ?? []).map(Number);
  const b = VDOT_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const stream = httpsUrl(p.https_url);
  // The still 301s to snapshot.vdotcameras.com/<name>.png, which <img> follows.
  const feed = httpsUrl(p.image_url);
  if (!stream && !feed) return null;

  return {
    id: `vdot-${id}`,
    lat,
    lng,
    name: p.description?.replace(/\s+/g, ' ').trim() || `VDOT Camera ${id}`,
    city: p.jurisdiction?.trim() || 'Virginia',
    country: 'US',
    ...(feed ? { feed_url: feed } : {}),
    ...(stream ? { stream_url: stream, stream_type: 'hls' as const } : { stream_type: 'jpg' as const }),
    source: 'VDOT',
  };
}

export async function fetchVdotCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(LAYER, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`VDOT cameras HTTP ${res.status}`);

  // Served as text/html.
  const json = JSON.parse(await res.text());
  if (!Array.isArray(json?.features)) throw new Error('VDOT cameras: no features in response');

  const seen = new Map<string, CctvCamera>();
  for (const f of json.features) {
    const cam = mapVdotCamera(f);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[OSIRIS] Virginia cameras — VDOT: ${seen.size}`);
  return [...seen.values()];
}
