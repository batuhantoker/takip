import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — CamStreamer live streams worldwide (~1,800 Axis cameras on YouTube): camstreamer.com/live/map, no key.
 * Terms: none published for the gallery (no terms page; the EULA covers the camera app); streams are the
 * operators' own YouTube broadcasts, and each stream page offers this embed for reuse. Permission not yet asked.
 *
 * The stream is CamStreamer's embed URL, which 302s to the YouTube video live now, so a restarted
 * broadcast keeps working; resolving 1,800 redirects here would pin ids that die on restart.
 */

const BASE = 'https://camstreamer.com';
const API = `${BASE}/live/update-search-map`;
/** sweden.ts already carries these, and the catalogue does not dedupe across regions. */
const SWEDEN_API = `${API}?country%5B0%5D=Sweden`;
const SWEDEN_BOX = { minLat: 55.0, maxLat: 69.2, minLng: 10.5, maxLng: 24.3 };
const EMBED = /^https:\/\/camstreamer\.com\/embed\/[A-Za-z0-9]{10,64}(?:\/S-\d{1,9})?$/;
const DETAIL = /^\/live\/stream\/(\d{1,12})-[\w-]*$/;
const TEST = /\btest\b/i;
const RESIDENTIAL = /\bbackyard\b|\bhome rental\b|\bmy (?:house|home|garden|yard)\b/i;

export const CAMSTREAMER_BOUNDS = { minLat: -60, maxLat: 80, minLng: -180, maxLng: 180 };

export interface CamStreamerVideo {
  name?: string | null;
  iframe_url?: string | null;
  lat?: number | null;
  lng?: number | null;
  detail_link?: string | null;
}

/** "[LIVE] Key West…" → "Key West…", "Copy: Copy: The Birds MUMA" → "The Birds MUMA". */
function cleanName(raw: string): string {
  return raw.replace(/^(?:\s*(?:\[LIVE\]|🔴|Copy:))+\s*/i, '').trim();
}

export function mapCamStreamerVideo(v: CamStreamerVideo | null | undefined): CctvCamera | null {
  const embed = v?.iframe_url?.trim();
  const detail = v?.detail_link?.trim().match(DETAIL);
  if (!embed || !EMBED.test(embed) || !detail) return null;

  const raw = v?.name?.trim() ?? '';
  if (TEST.test(raw) || RESIDENTIAL.test(raw)) return null;

  const { lat, lng } = v ?? {};
  if (typeof lat !== 'number' || typeof lng !== 'number' || (lat === 0 && lng === 0)) return null;
  const b = CAMSTREAMER_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;

  return {
    id: `camstreamer-${detail[1]}`,
    lat,
    lng,
    name: cleanName(raw) || 'CamStreamer live camera',
    city: '',
    country: '',
    stream_url: embed,
    stream_type: 'iframe',
    external_url: `${BASE}${detail[0]}`,
    source: 'CamStreamer',
  };
}

async function videos(url: string): Promise<CamStreamerVideo[]> {
  const res = await stealthFetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`CamStreamer map HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.videos)) throw new Error('CamStreamer map: unexpected response');
  return data.videos;
}

export async function fetchCamStreamerCameras(): Promise<CctvCamera[]> {
  const [all, sweden] = await Promise.all([videos(API), videos(SWEDEN_API).catch(() => null)]);
  const swedish = new Set((sweden ?? []).map(v => v?.detail_link));
  const inSwedenBox = (c: CctvCamera) =>
    c.lat >= SWEDEN_BOX.minLat && c.lat <= SWEDEN_BOX.maxLat && c.lng >= SWEDEN_BOX.minLng && c.lng <= SWEDEN_BOX.maxLng;

  const seen = new Map<string, CctvCamera>();
  for (const v of all) {
    const cam = mapCamStreamerVideo(v);
    if (!cam || seen.has(cam.id)) continue;
    // Without the Swedish list, drop sweden.ts's whole box: it costs ~25 Norwegian and Finnish streams.
    if (inSwedenBox(cam) && (!sweden || swedish.has(v.detail_link))) continue;
    seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] CamStreamer cameras — CamStreamer: ${seen.size}`);
  return [...seen.values()];
}
