import { fetchPixels, heldPromises, mercatorTile, nearestDrawn, throttle, tileAt, type Hit, type Pixels } from './pixels';

/**
 * Rain or snow near a point on RainViewer's newest radar frame (../radar.ts). Tiles are shared by every point under
 * them and kept per frame, well inside RainViewer's 500 tiles a minute for this server's one address.
 */

export const RAIN_RADIUS_KM = 50;
/** Within this, the radar shows it falling on the point itself. */
export const RAIN_OVER_KM = 3;

export type RainNow =
  | { covered: false }
  /** `at` is the radar frame; `nearest` the closest rain or snow within the radius. */
  | { covered: true; at: number; nearest: Hit | null };

const MAPS_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const COVERAGE = (z: number, x: number, y: number) => `https://tilecache.rainviewer.com/v2/coverage/0/256/${z}/${x}/${y}/0/0_0.png`;
const COVERAGE_ZOOM = 6;
/** The deepest free zoom, about 1.2 km a pixel at the equator. */
const ZOOM = 7;
const SIZE = 256;
const FRAMES_TTL_MS = 2 * 60_000;
const STALE_MS = 40 * 60_000;

const wait = throttle(6);
const tiles = heldPromises<Pixels | null>(1500);
let frames: { at: number; newest: Promise<{ time: number; base: string } | null> } | null = null;

function newestFrame() {
  if (frames && Date.now() - frames.at < FRAMES_TTL_MS) return frames.newest;
  const newest = fetch(MAPS_URL, { cache: 'no-store', signal: AbortSignal.timeout(8_000) })
    .then(r => (r.ok ? r.json() : null))
    .then((b: { host?: string; radar?: { past?: { time?: number; path?: string }[] } } | null) => {
      const last = b?.host && b.radar?.past?.filter(f => Number.isFinite(f.time) && f.path).at(-1);
      return last ? { time: last.time! * 1000, base: `${b!.host}${last.path}` } : null;
    })
    .catch(() => null);
  frames = { at: Date.now(), newest };
  return newest;
}

function tile(url: string): Promise<Pixels | null> {
  return tiles(url, () => wait().then(() => fetchPixels(url, AbortSignal.timeout(8_000))));
}

/** Whether a ground radar in RainViewer's mosaic reaches the point: its coverage tiles are white there, black elsewhere. */
async function radarReaches(at: [number, number]): Promise<boolean | null> {
  const [fx, fy] = tileAt(at, COVERAGE_ZOOM);
  const px = await tile(COVERAGE(COVERAGE_ZOOM, Math.floor(fx), Math.floor(fy))).catch(() => null);
  if (!px) return null;
  const i = (Math.floor((fy % 1) * px.height) * px.width + Math.floor((fx % 1) * px.width)) * 4;
  return px.data[i] > 127;
}

/** Null when the radar couldn't be read just now. */
export async function rainNear(at: [number, number], now = Date.now()): Promise<RainNow | null> {
  if (Math.abs(at[1]) > 84) return { covered: false };
  const reaches = await radarReaches(at);
  if (reaches === null) return null;
  if (!reaches) return { covered: false };
  const frame = await newestFrame();
  if (!frame || now - frame.time > STALE_MS) return null;
  // The 2×2 tiles with the point in their middle half, so the whole radius is inside them.
  const [fx, fy] = tileAt(at, ZOOM);
  const x0 = Math.floor(fx) - (fx % 1 < 0.5 ? 1 : 0);
  const y0 = Math.floor(fy) - (fy % 1 < 0.5 ? 1 : 0);
  const n = 2 ** ZOOM;
  const block = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => [(x0 + dx + n) % n, y0 + dy]).filter(([, y]) => y >= 0 && y < n);
  const hits = await Promise.all(block.map(async ([x, y]) => {
    const px = await tile(`${frame.base}/${SIZE}/${ZOOM}/${x}/${y}/2/0_0.png`).catch(() => null);
    return px ? nearestDrawn(px, at, RAIN_RADIUS_KM, mercatorTile(ZOOM, x, y, SIZE)) : undefined;
  }));
  if (hits.includes(undefined)) return null;
  return { covered: true, at: frame.time, nearest: hits.reduce<Hit | null>((a, b) => (b && (!a || b.km < a.km) ? b : a), null) };
}
