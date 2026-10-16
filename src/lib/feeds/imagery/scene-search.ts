import { searchPolygon, type ImageryArea } from './area';
import { COLLECTIONS, IMAGERS, parseScenes, type Scene } from './passes';

const STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
export const SEARCH_DAYS = 60;
/** Planetary Computer's page cap; a 400 km box holds over a thousand Sentinel-2 tiles in 60 days. */
const LIMIT = 1000;
// Only what a row and its drawing read: a whole STAC item runs to tens of kB.
const FIELDS = {
  include: ['id', 'collection', 'geometry', 'properties.datetime', 'properties.platform', 'properties.eo:cloud_cover', 'assets.tilejson.href', 'assets.rendered_preview.href'],
  exclude: ['links'],
};

export interface SceneSearch {
  scenes: Scene[];
  /** Collections whose search failed, so the list can say what it is missing. */
  failed: string[];
  /** Collections that filled a page before reaching back SEARCH_DAYS, and the oldest time each reached. */
  truncated: { collection: string; since: number }[];
}

/** The last two months of scenes over an area from every imager. */
export async function searchScenes(area: ImageryArea, signal: AbortSignal, now = Date.now()): Promise<SceneSearch> {
  const datetime = `${new Date(now - SEARCH_DAYS * 86_400_000).toISOString()}/${new Date(now).toISOString()}`;
  const results = await Promise.allSettled(COLLECTIONS.map(async collection => {
    const res = await fetch(STAC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        collections: [collection],
        intersects: searchPolygon(area),
        datetime,
        limit: LIMIT,
        sortby: [{ field: 'properties.datetime', direction: 'desc' }],
        fields: FIELDS,
      }),
    });
    if (!res.ok) throw new Error(`${collection}: ${res.status}`);
    const body = await res.json();
    return { scenes: parseScenes(body, collection), full: (body.features?.length ?? 0) >= LIMIT };
  }));
  signal.throwIfAborted();
  const ok = results.flatMap((r, i) => (r.status === 'fulfilled' ? [{ collection: COLLECTIONS[i] as string, ...r.value }] : []));
  return {
    scenes: ok.flatMap(r => r.scenes),
    failed: COLLECTIONS.filter((_, i) => results[i].status === 'rejected'),
    truncated: ok.filter(r => r.full && r.scenes.length).map(r => ({ collection: r.collection, since: Math.min(...r.scenes.map(s => s.time)) })),
  };
}

export interface ImagerElements {
  line1: string;
  line2: string;
  lat: number;
  lng: number;
  altKm: number;
}

/** The imaging satellites' element sets and where they are now, keyed by NORAD number. */
export async function fetchImagerElements(signal: AbortSignal): Promise<Map<string, ImagerElements>> {
  const norad = Object.values(IMAGERS).map(i => i.norad).join(',');
  const res = await fetch(`/api/satellites?tle=1&norad=${norad}`, { signal });
  if (!res.ok) throw new Error(`satellites: ${res.status}`);
  const body = await res.json() as { satellites?: { noradId: string; line1?: string; line2?: string; lat: string | number; lng: string | number; alt: string | number }[] };
  const out = new Map<string, ImagerElements>();
  for (const s of body.satellites ?? []) {
    if (!s.line1 || !s.line2) continue;
    out.set(s.noradId.padStart(5, '0'), { line1: s.line1, line2: s.line2, lat: Number(s.lat), lng: Number(s.lng), altKm: Number(s.alt) });
  }
  return out;
}
