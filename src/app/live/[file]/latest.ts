import sharp from 'sharp';
import { drawDisk } from '@/lib/feeds/imagery/full-disk';
import { MTG_CAPABILITIES, MTG_WMS } from '@/lib/feeds/imagery/geosat-protocol';
import { wmsLatestTime } from '@/lib/feeds/imagery/geostationary';
import { LIVE_IMAGES, type LiveImageId } from '@/lib/platform/site/live-images';
import { ownOrigin } from '@/lib/platform/site/live/own-api';

/** The latest picture per id, asked for upstream at most every 10 minutes; the last good one stands in meanwhile and when that fails. */

export interface Picture { jpeg: Buffer; taken: string }

const TTL_MS = 10 * 60_000;
const RETRY_MS = 2 * 60_000;

async function get(url: string, timeoutMs: number): Promise<Response> {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.slice(0, 80)}`);
  return res;
}

// Over loopback, so the frame comes out of /api/space/sun's own cache rather than a second Helioviewer client.
async function sun(prev: Picture | null): Promise<Picture> {
  const { frames } = await (await get(`${ownOrigin()}/api/space/sun`, 20_000)).json() as { frames: { key: string; frameTime: string | null }[] };
  const taken = frames.find(f => f.key === 'aia171')?.frameTime;
  if (!taken) throw new Error('no SDO frame');
  if (prev?.taken === taken) return prev;
  const res = await get(`${ownOrigin()}/api/space/sun/aia171?t=${encodeURIComponent(taken)}`, 40_000);
  return { jpeg: Buffer.from(await res.arrayBuffer()), taken };
}

/** Meteosat-12's view from 0°; its GeoColour layer reaches about 81° from there. */
const MTG_REACH = 81.3;
const MTG_PIXELS = 1400;

async function earth(prev: Picture | null): Promise<Picture> {
  const taken = wmsLatestTime(await (await get(MTG_CAPABILITIES, 20_000)).text());
  if (!taken) throw new Error('no Meteosat frame time');
  if (prev?.taken === taken) return prev;
  // WMS 1.3.0 orders an EPSG:4326 box latitude first.
  const box = [-MTG_REACH, -MTG_REACH, MTG_REACH, MTG_REACH].join(',');
  const res = await get(`${MTG_WMS}?service=WMS&version=1.3.0&request=GetMap&layers=rgb_geocolour&styles=&format=image/jpeg&bgcolor=0x000000&crs=EPSG:4326&width=${MTG_PIXELS}&height=${MTG_PIXELS}&bbox=${box}&time=${taken}`, 60_000);
  // EUMETSAT answers a bad request with a 200 XML error.
  if (!res.headers.get('content-type')?.startsWith('image/')) throw new Error('Meteosat answered without an image');
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const size = LIVE_IMAGES.earth.size;
  const disk = drawDisk({ data, width: info.width, height: info.height, channels: info.channels, west: -MTG_REACH, east: MTG_REACH, south: -MTG_REACH, north: MTG_REACH }, 0, size);
  const jpeg = await sharp(disk, { raw: { width: size, height: size, channels: 3 } }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return { jpeg, taken };
}

const FETCH: Record<LiveImageId, (prev: Picture | null) => Promise<Picture>> = { sun, earth };

const held = new Map<LiveImageId, { until: number; pending: Promise<Picture | null>; good: Picture | null }>();

/** The held picture straight away while a newer one is fetched behind it; only the very first asks wait. */
export function latestPicture(id: LiveImageId): Promise<Picture | null> {
  const now = Date.now();
  let cur = held.get(id);
  if (!cur || now >= cur.until) {
    const entry = { until: now + TTL_MS, pending: FETCH[id](cur?.good ?? null) as Promise<Picture | null>, good: cur?.good ?? null };
    entry.pending = entry.pending.then(p => (entry.good = p), e => {
      console.warn(`[TAKIP] live image ${id}:`, e instanceof Error ? e.message : e);
      entry.until = Date.now() + RETRY_MS;
      return null;
    });
    held.set(id, (cur = entry));
  }
  const { good, pending } = cur;
  return good ? Promise.resolve(good) : pending;
}
