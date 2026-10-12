import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';
import { createPool } from '@/lib/fetch-pool';

/**
 * TAKIP — MLIT road cameras (~1,900) from 道路情報提供システム (www.road-info-prvs.mlit.go.jp), no key.
 * Terms: all rights reserved, no reuse without MLIT's permission; links only to the top page, not to images.
 *
 * Each regional bureau's image page embeds its camera list as JSON in a hidden input, with every camera's
 * latest 15-minute still. Stills are kept for about an hour, so a URL outlives the 30-minute catalogue
 * TTL but not a run of failed refreshes.
 */

const BASE = 'https://www.road-info-prvs.mlit.go.jp/roadinfo';
const TOP_PAGE = `${BASE}/`;
/** Regional bureaus, Hokkaido (81) to Okinawa (90). */
const BUREAUS = ['81', '82', '83', '84', '85', '86', '87', '88', '89', '90'];
/** The full still is the thumbnail without `s_`, and keeps its extension: `.jpg` and `.jpeg` are not interchangeable. */
const THUMB = /^(\d{14})\/s_([0-9A-Za-z]+)\.(jpe?g)$/;

export const MLIT_ROAD_BOUNDS = { minLat: 24, maxLat: 46, minLng: 122.5, maxLng: 146.5 };

export interface RoadImageRecord {
  doro_gazo_joho_kanri_id?: string | null;
  /** `[lng, lat]`, as strings. */
  gis_point?: (string | null)[] | null;
  teikyo_rosen_mei?: string | null;
  kansoku_chiten_mei?: string | null;
  cities_name?: string | null;
  /** Newest first. A camera with no picture lists `s_no_data.jpeg` and an empty status. */
  fileList?: { kiki_jotai_cd?: number | string | null; file?: string | null }[] | null;
}

/** No DOM parser in the server bundle; the JSON sits in one single-quoted attribute. */
export function parseRoadImagePage(html: string): RoadImageRecord[] {
  const m = html.match(/id="kokudoJson"\s+value='([\s\S]*?)'\s*\/>/);
  if (!m) throw new Error('MLIT road: no kokudoJson in page');
  const routes = JSON.parse(m[1]);
  if (!routes || typeof routes !== 'object') throw new Error('MLIT road: unexpected kokudoJson');

  const out: RoadImageRecord[] = [];
  for (const rows of Object.values(routes)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row && typeof row === 'object') out.push(...(Object.values(row) as RoadImageRecord[]));
    }
  }
  return out;
}

const clean = (s: string | null | undefined) => s?.replace(/\s+/g, ' ').trim() || '';

export function mapRoadImage(r: RoadImageRecord | null | undefined): CctvCamera | null {
  const id = r?.doro_gazo_joho_kanri_id;
  const latest = r?.fileList?.[0];
  if (!id || latest?.kiki_jotai_cd !== 1) return null;
  const thumb = latest.file?.match(THUMB);
  if (!thumb || thumb[2] !== id) return null;

  const lng = Number(r?.gis_point?.[0] ?? NaN);
  const lat = Number(r?.gis_point?.[1] ?? NaN);
  const b = MLIT_ROAD_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const [, ts, , ext] = thumb;
  return {
    id: `mlit-road-${id}`,
    lat,
    lng,
    name: [clean(r?.teikyo_rosen_mei), clean(r?.kansoku_chiten_mei)].filter(Boolean).join(' ') || `Road camera ${id}`,
    city: clean(r?.cities_name),
    country: 'Japan',
    feed_url: `${BASE}/img/doro_gazo/pc/${ts}/${id}.${ext}`,
    external_url: TOP_PAGE,
    source: 'MLIT 道路情報提供システム',
  };
}

async function fetchBureau(bureau: string): Promise<RoadImageRecord[]> {
  const res = await stealthFetch(`${BASE}/pc/pcImage_${bureau}_1.html`, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'text/html' },
  });
  if (!res.ok) throw new Error(`MLIT road ${bureau} HTTP ${res.status}`);
  return parseRoadImagePage(await res.text());
}

export async function fetchMlitRoadCameras(): Promise<CctvCamera[]> {
  const pool = createPool(4);
  const results = await Promise.allSettled(BUREAUS.map(b => pool.run(() => fetchBureau(b))));
  const answered = results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
  if (!answered.length) throw new Error('MLIT road cameras: no bureau answered');

  const seen = new Map<string, CctvCamera>();
  for (const r of answered.flat()) {
    const cam = mapRoadImage(r);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] MLIT road cameras — 道路情報提供システム: ${seen.size}`);
  return [...seen.values()];
}
