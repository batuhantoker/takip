import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';
import { markMissingMedia } from '@/lib/feeds/cameras/liveness';

/**
 * TAKIP — Uludağ ski resort cameras (Bursa), read from the webcam list in uludaginfo.com's own /tr/webcam page
 * (Next.js flight data). Site run by DYB Yazılım Danışmanlık A.Ş. Terms: unknown — its only published terms cover ticket sales.
 * Live video is not replayed: the player mints a token per view (/v2/webcams/<slug>/stream-token) and the bare
 * live.dgn.net.tr playlists 404. So each camera is its CORS-open still, refreshed while the camera runs, and links out.
 */

const SITE = 'https://www.uludaginfo.com';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
// Stills elsewhere (Monte Baia's) are third-party copies, stale for over a year.
const SNAPSHOT_HOST = 'live.dgn.net.tr';
export const ULUDAG_BOUNDS: Bounds = { minLat: 40.07, maxLat: 40.14, minLng: 29.08, maxLng: 29.22 };
// OSM "Uludağ Kayak Merkezi", for cameras without a lift of their own below.
const RESORT: [number, number] = [40.1040161, 29.1328614];

// Upstream latitude/longitude are null; these are each camera's lift in OSM, where the name matches exactly one.
const LIFTS: Record<string, [number, number]> = {
  alkoclar: [40.1005373, 29.1328764],
  karinna: [40.1078441, 29.1457009],
  'agaoglu-gondola': [40.1038337, 29.1378036],
  kirkgozler: [40.104492, 29.1481695],
  maden: [40.1016286, 29.1623441],
  kusaklikaya: [40.0956183, 29.1424052],
  'fahri-telesiyej': [40.1039681, 29.1270956],
  'tutyeli-alt': [40.095299, 29.1399343],
  'tutyeli-vadi': [40.095299, 29.1399343],
  'italyan-pisti': [40.1006202, 29.1369853],
  'yazici-pist': [40.1027424, 29.1284217],
  'agaoglu-belvu': [40.1014825, 29.133844],
};

export interface UludagWebcam {
  slug?: string | null;
  name?: string | null;
  snapshotUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function mapUludagWebcam(w: UludagWebcam | null | undefined): CctvCamera | null {
  const slug = w?.slug?.trim();
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null;
  const key = slug.replace(/^uludag-/, '');

  let feed: URL;
  try {
    feed = new URL(w?.snapshotUrl ?? '');
  } catch {
    return null;
  }
  if (feed.protocol !== 'https:' || feed.hostname !== SNAPSHOT_HOST) return null;

  const upstream = w?.latitude != null && w?.longitude != null;
  const [lat, lng] = upstream ? [Number(w.latitude), Number(w.longitude)] : LIFTS[key] ?? RESORT;
  const b = ULUDAG_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  return {
    id: `tr-uludag-${key}`,
    lat,
    lng,
    name: w?.name?.replace(/\s+/g, ' ').trim() || `Uludağ ${key}`,
    city: 'Bursa',
    country: 'Turkey',
    feed_url: feed.href,
    stream_type: 'jpg',
    external_url: `${SITE}/tr/webcam/${slug}`,
    source: 'Uludaginfo',
  };
}

const PUSH = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;

/** The page's React flight payload, joined back from its script chunks. */
function flightData(html: string): string {
  let out = '';
  for (const [, chunk] of html.matchAll(PUSH)) {
    try {
      out += JSON.parse(`"${chunk}"`);
    } catch {
      // A chunk that isn't a plain string literal can't hold the list.
    }
  }
  return out;
}

/** The JSON value opening at `from`, cut where its brackets close (ignoring brackets inside strings). */
function sliceJson(s: string, from: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '[' || c === '{') depth++;
    else if ((c === ']' || c === '}') && --depth === 0) return s.slice(from, i + 1);
  }
  return null;
}

export function parseUludagWebcamPage(html: string): CctvCamera[] {
  const data = flightData(html);
  const key = '"webcams":';
  const at = data.indexOf(key + '[');
  if (at < 0) return [];
  const raw = sliceJson(data, at + key.length);
  if (!raw) return [];

  let rows: unknown;
  try {
    rows = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];

  const seen = new Map<string, CctvCamera>();
  for (const row of rows as (UludagWebcam | null)[]) {
    const cam = mapUludagWebcam(row);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  return [...seen.values()];
}

export async function fetchUludagCameras(): Promise<CctvCamera[]> {
  const res = await fetch(`${SITE}/tr/webcam`, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Uludağ webcams HTTP ${res.status}`);

  const listed = parseUludagWebcamPage(await res.text());
  if (!listed.length) throw new Error('Uludağ webcams: no cameras found in the page');
  // The list keeps stills that 404.
  const cams = await markMissingMedia(listed);
  console.log(`[TAKIP] Uludağ cameras — Uludaginfo: ${cams.length}`);
  return cams;
}
