import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';
import { createPool } from '@/lib/core/net/fetch-pool';

/**
 * TAKIP — Mississippi DOT cameras (~1,070 live of 1,189 views at 456 sites): mdottraffic.com's map, no key. HLS + still.
 * The site list has no views, so each site's map bubble is read for its stream ids and Wowza host.
 * Terms: MDOT Web Portal terms; non-commercial use, credit "Source: Mississippi Department of Transportation".
 */

const BASE = 'https://www.mdottraffic.com';
const LIST = `${BASE}/default.aspx/LoadCameraData`;
const SITE_PAGE = `${BASE}/mapbubbles/camerasite.aspx?site=`;
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const MDOTTRAFFIC_BOUNDS: Bounds = { minLat: 30.1, maxLat: 35.05, minLng: -91.7, maxLng: -88.05 };

const STREAM_ID = /^[A-Za-z0-9-]+$/;
// Offline views point at www.MDOTtraffic.com/images/novideo.jpg instead, so they fail this.
const SNAPSHOT = /^https:\/\/(streaming[a-z]+\d+\.mdottraffic\.com)\/thumbnail\?application=rtplive&streamname=([A-Za-z0-9-]+)\.stream(?:&|$)/;
const VIEW = /switchImage\('([^']*)',\s*'([^']*)',\s*'((?:[^'\\]|\\.)*)'/g;

/** A row of `LoadCameraData`'s `d`: one camera site, which holds one or more views. */
export interface MdotTrafficSite {
  /** `camsite_<n>`. */
  markerid?: string | null;
  tooltip?: string | null;
  lat?: number | string | null;
  lon?: number | string | null;
}

/** One camera view in a site's map bubble. */
export interface MdotTrafficView {
  snapshot: string;
  streamId: string;
  title: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };

function decode(s: string): string {
  return s
    .replace(/\\(.)/g, '$1')
    .replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/\s+/g, ' ')
    .trim();
}

function inBounds(lat: number, lng: number): boolean {
  const b = MDOTTRAFFIC_BOUNDS;
  return lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng;
}

/** The site number in `camsite_<n>`, or null. */
export function siteNumber(r: MdotTrafficSite | null | undefined): string | null {
  return r?.markerid?.trim().match(/^camsite_(\d+)$/)?.[1] ?? null;
}

/** The views in a camerasite.aspx page, or null when the page has no camera list at all. */
export function parseSiteViews(html: string | null | undefined): MdotTrafficView[] | null {
  const block = html?.match(/<p\s+id="camViews"[^>]*>([\s\S]*?)<\/p>/i)?.[1];
  if (block == null) return null;
  return [...block.matchAll(VIEW)].map(([, snapshot, streamId, title]) => ({ snapshot, streamId, title: decode(title) }));
}

export function mapMdotTrafficCamera(
  site: MdotTrafficSite | null | undefined,
  view: MdotTrafficView | null | undefined,
): CctvCamera | null {
  const sid = view?.streamId?.trim();
  if (!site || !sid || !STREAM_ID.test(sid)) return null;

  const snap = view?.snapshot?.match(SNAPSHOT);
  if (!snap || snap[2] !== sid) return null;
  const host = snap[1];

  const lat = Number(site.lat);
  const lng = Number(site.lon);
  if (!inBounds(lat, lng)) return null;

  return {
    id: `msdot-${sid}`,
    lat,
    lng,
    name: view?.title || site.tooltip?.replace(/\s+/g, ' ').trim() || `MDOTtraffic Camera ${sid}`,
    city: 'Mississippi',
    country: 'US',
    feed_url: `https://${host}/thumbnail?application=rtplive&streamname=${sid}.stream&size=352x240&format=jpg&fitmode=stretch`,
    stream_url: `https://${host}/rtplive/${sid}.stream/playlist.m3u8`,
    stream_type: 'hls',
    source: 'MDOTtraffic',
  };
}

async function fetchSiteViews(site: string): Promise<MdotTrafficView[] | null> {
  const res = await fetch(`${SITE_PAGE}${site}`, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) {
    void res.body?.cancel();
    return null;
  }
  return parseSiteViews(await res.text());
}

export async function fetchMdotTrafficCameras(): Promise<CctvCamera[]> {
  // An ASP.NET page method: anything but a JSON POST 302s to the HTML page.
  const res = await fetch(LIST, {
    method: 'POST',
    headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8' },
    body: '{}',
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`MDOTtraffic cameras HTTP ${res.status}`);
  const json = (await res.json()) as { d?: unknown } | null;
  if (!Array.isArray(json?.d)) throw new Error('MDOTtraffic cameras: unexpected response');

  const sites = new Map<string, MdotTrafficSite>();
  for (const row of json.d as MdotTrafficSite[]) {
    const n = siteNumber(row);
    if (n && !sites.has(n) && inBounds(Number(row.lat), Number(row.lon))) sites.set(n, row);
  }
  if (!sites.size) throw new Error('MDOTtraffic cameras: no camera sites listed');

  const ids = [...sites.keys()];
  const views = new Map<string, MdotTrafficView[]>();
  const pool = createPool(10);
  for (let pass = 0; pass < 2 && views.size < ids.length; pass++) {
    const todo = ids.filter(id => !views.has(id));
    const pages = await Promise.all(todo.map(id => pool.run(() => fetchSiteViews(id).catch(() => null))));
    todo.forEach((id, i) => {
      const v = pages[i];
      if (v) views.set(id, v);
    });
  }
  if (views.size < ids.length * 0.95) {
    throw new Error(`MDOTtraffic cameras: short read, ${views.size} of ${ids.length} sites`);
  }

  const out = new Map<string, CctvCamera>();
  let total = 0;
  for (const id of ids) {
    for (const view of views.get(id) ?? []) {
      total++;
      const cam = mapMdotTrafficCamera(sites.get(id), view);
      if (cam && !out.has(cam.id)) out.set(cam.id, cam);
    }
  }
  if (!out.size) throw new Error('MDOTtraffic cameras: no live views');
  console.log(`[TAKIP] Mississippi cameras — MDOTtraffic: ${out.size} of ${total} views at ${views.size} sites`);
  return [...out.values()];
}
