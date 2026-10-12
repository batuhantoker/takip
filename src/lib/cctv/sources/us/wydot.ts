import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';
import { WYDOT_SITES, type WydotSite } from '@/lib/cctv/generated/wydot-sites.generated';

/**
 * TAKIP — Wyoming DOT cameras (~760 views at 228 sites): wyoroad.info's statewide camera list, one HTML page, no key.
 * The list has no coordinates, so sites come from wydot-sites.generated.ts (route + milepost); unplaced sites are skipped.
 * The 511 map's own camera feed is deliberately obscured and is not used. Stills are `/web-cam/cache?ref=<opaque token>`,
 * kept exactly as the page publishes them.
 */

const BASE = 'https://www.wyoroad.info';
const API = `${BASE}/pls/Browse/WRR.Cameras`;
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const WYDOT_BOUNDS: Bounds = { minLat: 40.95, maxLat: 45.05, minLng: -111.1, maxLng: -104.0 };
/** Today: 228 sites, 210 of them placed with ~700 views. Fewer means a broken page or a stale site table. */
const MIN_SITES = 180;
const MIN_CAMERAS = 560;
/** The ref is base64 of an encrypted blob; anything else is markup drift, not a camera. */
const REF = /^[A-Za-z0-9+/]+=*$/;

export interface WydotView { ref: string; caption: string }

export interface WydotRow {
  route: string;
  town: string;
  name: string;
  milepost: string;
  views: WydotView[];
}

function unescapeHtml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

const text = (s: string) => unescapeHtml(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

/** One row per site: route, nearest town, site name, milepost, and each view's still ref and caption. */
export function parseWydotStatewide(html: string): WydotRow[] {
  return html.split(/<tr>\s*<td class="swroute">/).slice(1).map(row => {
    const cell = (cls: string) => text(row.match(new RegExp(`class="${cls}">([\\s\\S]*?)</td>`))?.[1] ?? '').replace(/^[^:]*:\s*/, '');
    const views = [...row.matchAll(/<a href="\/web-cam\/cache\?ref=([^"&]+(?:&#x3D;)*)"[\s\S]*?class="caption"[^>]*>([\s\S]*?)<\/div>/g)]
      .map(m => ({ ref: unescapeHtml(m[1]), caption: text(m[2]) }));
    return { route: unescapeHtml(row.slice(0, row.indexOf('</td>')).trim()), town: cell('swlocation'), name: cell('swdescription'), milepost: cell('swmilepost'), views };
  });
}

export function wydotSiteKey(row: Pick<WydotRow, 'route' | 'milepost'>): string {
  return `${row.route}|${Number(row.milepost).toFixed(2)}`;
}

/** "I 80 Summit - Bridge Surface" → "bridge-surface"; a lone view without a suffix keeps the bare site id. */
function viewSlug(caption: string): string {
  const i = caption.lastIndexOf(' - ');
  return i < 0 ? '' : caption.slice(i + 3).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function mapWydotCamera(row: WydotRow | null | undefined, view: WydotView | null | undefined, site: WydotSite | null | undefined): CctvCamera | null {
  if (!row || !view || !site || !REF.test(view.ref)) return null;
  const b = WYDOT_BOUNDS;
  if (!(site.lat > b.minLat && site.lat < b.maxLat && site.lng > b.minLng && site.lng < b.maxLng)) return null;
  const suffix = viewSlug(view.caption);

  return {
    id: `wydot-${site.slug.toLowerCase()}${suffix ? `-${suffix}` : ''}`,
    lat: site.lat,
    lng: site.lng,
    name: view.caption || `${row.route} ${row.name}`,
    city: row.town || 'Wyoming',
    country: 'US',
    feed_url: `${BASE}/web-cam/cache?ref=${view.ref}`,
    stream_type: 'jpg',
    external_url: `${BASE}/highway/webcameras/view?site=${encodeURIComponent(site.slug)}`,
    source: 'WYDOT',
  };
}

export async function fetchWydotCameras(): Promise<CctvCamera[]> {
  const res = await fetch(API, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`WYDOT cameras HTTP ${res.status}`);

  const rows = parseWydotStatewide(await res.text());
  if (rows.length < MIN_SITES) throw new Error(`WYDOT cameras: ${rows.length} sites on the statewide page`);

  const seen = new Map<string, CctvCamera>();
  let unplaced = 0;
  let duplicates = 0;
  for (const row of rows) {
    const site = WYDOT_SITES[wydotSiteKey(row)];
    if (!site) { unplaced++; continue; }
    for (const view of row.views) {
      const cam = mapWydotCamera(row, view, site);
      if (!cam) continue;
      if (seen.has(cam.id)) duplicates++;
      else seen.set(cam.id, cam);
    }
  }
  if (seen.size < MIN_CAMERAS) throw new Error(`WYDOT cameras short read: ${seen.size}`);
  console.log(`[TAKIP] Wyoming cameras — WYDOT: ${seen.size} (${unplaced} of ${rows.length} sites not placed, ${duplicates} duplicate ids)`);
  return [...seen.values()];
}
