import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';
import { createPool } from '@/lib/fetch-pool';
import { cachedSource } from '@/lib/sourceCache';
import { MLIT_RIVER_CCTV } from '@/lib/cctv/generated/mlit-river-cctv.generated';

/**
 * TAKIP — MLIT river cameras (~11,700 on 川の防災情報, www.river.go.jp/kawabou), no key.
 * Terms: 政府標準利用規約 2.0 (CC BY 4.0 compatible), credit "出典：国土交通省 川の防災情報"; the site asks
 * that tools not poll it periodically and points routine collection at river.or.jp's data service.
 *
 * The index is the map's own per-prefecture GeoJSON. sys_id 1 (simple) and 3 (prefectural) stills are
 * `cam/now/<id>.jpg`. sys_id 2 (MLIT office CCTV) stills have a `cctv_…` name that only the per-camera
 * file carries (their `<id>.jpg` answers 200 with a "no image" placeholder), so those names are harvested
 * once by scratch/scrape_mlit_river.js; an office camera added since then is left out until the next run.
 */

const GJSON = 'https://www.river.go.jp/kawabou/file/gjson/scam';
const IMAGE_BASE = 'https://cam.river.go.jp/cam/now';
const MAP_PAGE = 'https://www.river.go.jp/kawabou/pc/tm';
/** Hokkaido is split into 102–105 (101 is 404); every other prefecture is <JIS code>01 (4701 currently 404s). */
const PREFS = [102, 103, 104, 105, ...Array.from({ length: 46 }, (_, i) => (i + 2) * 100 + 1)];
const USABLE_SYS_IDS = new Set([1, 3]);
/** The site asks tools not to poll it; the index changes rarely and each still URL is stable. */
const INDEX_TTL_MS = 24 * 60 * 60_000;

export const MLIT_RIVER_BOUNDS = { minLat: 24, maxLat: 46, minLng: 122.5, maxLng: 146.5 };

export interface RiverFeature {
  /** `[lng, lat]`. */
  geometry?: { coordinates?: (number | null)[] | null } | null;
  properties?: {
    id?: number | null;
    name?: string | null;
    sys_id?: number | null;
    pause?: number | null;
  } | null;
}

export function mapRiverCamera(f: RiverFeature | null | undefined): CctvCamera | null {
  const p = f?.properties;
  const id = p?.id;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null;
  if (p?.pause !== 0) return null;
  const still = p?.sys_id === 2 ? MLIT_RIVER_CCTV[id] : USABLE_SYS_IDS.has(p?.sys_id as number) ? String(id) : undefined;
  if (!still) return null;

  const [lng, lat] = f?.geometry?.coordinates ?? [];
  const b = MLIT_RIVER_BOUNDS;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  return {
    id: `mlit-river-${id}`,
    lat,
    lng,
    name: p?.name?.replace(/\s+/g, ' ').trim() || `River camera ${id}`,
    city: '',
    country: 'Japan',
    feed_url: `${IMAGE_BASE}/${still}.jpg`,
    external_url: MAP_PAGE,
    source: 'MLIT 川の防災情報',
  };
}

async function fetchPrefecture(pref: number): Promise<RiverFeature[]> {
  const res = await stealthFetch(`${GJSON}/${pref}.json`, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`MLIT river ${pref} HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json?.features)) throw new Error(`MLIT river ${pref}: no features`);
  return json.features;
}

export async function loadMlitRiverCameras(): Promise<CctvCamera[]> {
  const pool = createPool(4);
  const results = await Promise.allSettled(PREFS.map(p => pool.run(() => fetchPrefecture(p))));
  const answered = results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
  if (!answered.length) throw new Error('MLIT river cameras: no prefecture answered');

  const seen = new Map<string, CctvCamera>();
  for (const f of answered.flat()) {
    const cam = mapRiverCamera(f);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] MLIT river cameras — 川の防災情報: ${seen.size}`);
  return [...seen.values()];
}

export const fetchMlitRiverCameras = cachedSource('mlit-river-index', loadMlitRiverCameras, INDEX_TTL_MS);
