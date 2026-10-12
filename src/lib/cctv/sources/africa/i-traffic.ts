import type { CctvCamera } from '@/lib/cctv/types';
import { ITRAFFIC_NAMES } from '@/lib/cctv/generated/itraffic-names.generated';

/**
 * TAKIP — SANRAL i-traffic freeway cameras (~1,240 in Gauteng, KwaZulu-Natal, Western and Eastern Cape): the
 * keyless marker list behind www.i-traffic.co.za/map, no key.
 * Terms: i-traffic's terms forbid republishing its content, including on another website, without SANRAL's written
 * consent.
 *
 * The markers carry ids and coordinates only. Names come from itraffic-names.generated.ts, read once from the
 * camera list (`/List/GetData/Cameras`), which is keyless but takes 15–20 s for all rows.
 * About half the stills currently serve SANRAL's "No live camera feed" card (§9 of docs/cctv-adding-sources.md).
 */

const API = 'https://www.i-traffic.co.za/map/mapIcons/Cameras';
const BASE = 'https://www.i-traffic.co.za';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const SOURCE = 'SANRAL i-traffic';
/** About 80% of today's 1,239: fewer is a broken read, not a smaller network. */
const MIN_CAMERAS = 1000;
/** `<camera>--<agency>`: camera numbers restart per agency, so only the pair is unique. */
const ITEM_ID = /^(\d{1,6})--(\d{1,3})$/;
/** Agency ids, as /List/GetData/Cameras reports them. */
const REGIONS: Record<string, string> = {
  '2': 'Gauteng', '3': 'KwaZulu-Natal', '4': 'Western Cape', '14': 'Eastern Cape',
};

export const ITRAFFIC_BOUNDS = { minLat: -35.0, maxLat: -22.0, minLng: 16.3, maxLng: 33.0 };

export interface ITrafficIcon {
  itemId?: string | null;
  /** `[lat, lng]`, latitude first. */
  location?: (number | null)[] | null;
}

export function mapITrafficIcon(
  icon: ITrafficIcon | null | undefined,
  names: Record<string, [string, string]> = ITRAFFIC_NAMES,
): CctvCamera | null {
  const itemId = icon?.itemId?.trim() ?? '';
  const m = ITEM_ID.exec(itemId);
  if (!m) return null;

  const [lat, lng] = icon!.location ?? [];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const b = ITRAFFIC_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;

  const region = REGIONS[m[2]];
  const [name, city] = names[itemId] ?? [];
  return {
    id: `itraffic-${itemId}`,
    lat,
    lng,
    name: name || (region ? `${region} camera ${m[1]}` : `${SOURCE} camera ${itemId}`),
    city: city || region || '',
    country: 'South Africa',
    feed_url: `${BASE}/map/Cctv/${itemId}`,
    external_url: `${BASE}/map#camera-${itemId}`,
    source: SOURCE,
  };
}

export async function fetchITrafficCameras(): Promise<CctvCamera[]> {
  const res = await fetch(API, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`i-traffic HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('i-traffic: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const icon of data as ITrafficIcon[]) {
    const cam = mapITrafficIcon(icon);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  if (seen.size < MIN_CAMERAS) throw new Error(`i-traffic short read: ${seen.size}`);
  const unnamed = [...seen.keys()].filter(id => !ITRAFFIC_NAMES[id.slice('itraffic-'.length)]).length;
  console.log(`[TAKIP] i-traffic cameras — ${SOURCE}: ${seen.size} (${unnamed} without a generated name)`);
  return [...seen.values()];
}
