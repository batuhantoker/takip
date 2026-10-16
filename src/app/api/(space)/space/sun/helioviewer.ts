import sharp from 'sharp';
import type { SunChannel } from '@/lib/space/bodies/sun';

/**
 * TAKIP — Helioviewer API (https://api.helioviewer.org/docs/v2/), no key.
 * SDO's own "latest" JPEGs on sdo.gsfc.nasa.gov stopped updating on
 * 2026-09-21, so frames come from Helioviewer, which has them within the hour.
 */

const API = 'https://api.helioviewer.org/v2';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const TTL_MS = 10 * 60_000;

const frameTimes = new Map<number, { at: number; time: string | null }>();
const images = new Map<string, Promise<Buffer>>();

/** Helioviewer's "2026-10-12 19:02:21" (UTC) as ISO. */
function iso(date: string): string | null {
  const t = Date.parse(`${date.replace(' ', 'T')}Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export async function closestFrame(channel: SunChannel): Promise<string | null> {
  const hit = frameTimes.get(channel.sourceId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.time;
  const res = await fetch(`${API}/getClosestImage/?date=${new Date().toISOString().slice(0, 19)}Z&sourceId=${channel.sourceId}`, {
    headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Helioviewer HTTP ${res.status}`);
  const json = await res.json() as { date?: string };
  const time = json.date ? iso(json.date) : null;
  frameTimes.set(channel.sourceId, { at: Date.now(), time });
  return time;
}

/** A 1024 px JPEG of the frame at `time`, cached per channel and frame. */
export function frameImage(channel: SunChannel, time: string): Promise<Buffer> {
  const key = `${channel.key}@${time}`;
  let hit = images.get(key);
  if (!hit) {
    hit = (async () => {
      const q = new URLSearchParams({
        date: `${time.slice(0, 19)}Z`,
        imageScale: String(channel.imageScale),
        layers: `[${channel.sourceId},1,100]`,
        x0: '0', y0: '0', width: '1024', height: '1024',
        display: 'true', watermark: 'false',
      });
      const res = await fetch(`${API}/takeScreenshot/?${q}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) throw new Error(`Helioviewer screenshot HTTP ${res.status}`);
      return sharp(Buffer.from(await res.arrayBuffer())).flatten({ background: '#000' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    })();
    hit.catch(() => images.delete(key));
    images.set(key, hit);
    // Old frames are never asked for again once a newer one exists.
    for (const k of images.keys()) if (k.startsWith(`${channel.key}@`) && k !== key) images.delete(k);
  }
  return hit;
}
