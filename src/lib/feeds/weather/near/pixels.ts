import sharp from 'sharp';

/** A decoded image, four channels a pixel. */
export interface Pixels { data: Uint8Array; width: number; height: number }

/** How far and which way, from the point asked about. */
export interface Hit { km: number; bearing: number }

const RAD = Math.PI / 180;

/** The image at `url`, or null when the answer isn't one (a WMS error comes back as XML with a 200). */
export async function fetchPixels(url: string, signal?: AbortSignal): Promise<Pixels | null> {
  const res = await fetch(url, { signal, cache: 'no-store' });
  if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) return null;
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Distance and bearing on a plane tangent at `from`; within a hundred kilometres it is out by well under one. */
export function hitFrom([lng0, lat0]: [number, number], [lng, lat]: [number, number]): Hit {
  const dx = (lng - lng0) * Math.cos(((lat + lat0) / 2) * RAD);
  const dy = lat - lat0;
  return { km: 111.32 * Math.hypot(dx, dy), bearing: ((Math.atan2(dx, dy) / RAD) + 360) % 360 };
}

/**
 * The nearest pixel with anything drawn in it (alpha above 0), no further than `maxKm`; null when there is none.
 * `lngLat` places a pixel's centre.
 */
export function nearestDrawn(px: Pixels, at: [number, number], maxKm: number, lngLat: (x: number, y: number) => [number, number]): Hit | null {
  let best: Hit | null = null;
  for (let y = 0; y < px.height; y++) {
    for (let x = 0; x < px.width; x++) {
      if (px.data[(y * px.width + x) * 4 + 3] === 0) continue;
      const hit = hitFrom(at, lngLat(x + 0.5, y + 0.5));
      if (hit.km <= maxKm && (!best || hit.km < best.km)) best = hit;
    }
  }
  return best && { km: Math.round(best.km), bearing: Math.round(best.bearing) };
}

/** A picture's pixel in a [w, s, e, n] box drawn in degrees (CRS:84). */
export const degreeBox = ([w, s, e, n]: [number, number, number, number], width: number, height: number) =>
  (x: number, y: number): [number, number] => [w + (x / width) * (e - w), n - (y / height) * (n - s)];

/** A pixel of the Web Mercator tile z/x/y, `size` pixels a side. */
export const mercatorTile = (z: number, tx: number, ty: number, size: number) => (x: number, y: number): [number, number] => {
  const n = 2 ** z;
  const lng = ((tx + x / size) / n) * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + y / size)) / n))) / RAD;
  return [lng, lat];
};

/** The Web Mercator tile under a point at zoom z, as fractions: the integer part is the tile, the rest the spot in it. */
export function tileAt([lng, lat]: [number, number], z: number): [number, number] {
  const n = 2 ** z;
  const r = lat * RAD;
  return [((lng + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n];
}

/** Keeps the newest `max` promises by key; a failed one is dropped so the next call tries again. */
export function heldPromises<T>(max: number) {
  const held = new Map<string, Promise<T>>();
  return (key: string, make: () => Promise<T>): Promise<T> => {
    const found = held.get(key);
    if (found) return found;
    const p = make();
    held.set(key, p);
    p.catch(() => held.delete(key));
    if (held.size > max) held.delete(held.keys().next().value!);
    return p;
  };
}

/**
 * Spaces one feed's upstream requests `perSecond` apart, shared by every caller: a request waits its turn, and is
 * refused when that turn is more than `maxWaitMs` away.
 */
export function throttle(perSecond: number, maxWaitMs = 3_000) {
  let free = 0;
  return async () => {
    const now = Date.now();
    const turn = Math.max(now, free);
    if (turn - now > maxWaitMs) throw new Error('busy');
    free = turn + 1000 / perSecond;
    if (turn > now) await new Promise(res => setTimeout(res, turn - now));
  };
}
