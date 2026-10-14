import { gunzipSync } from 'node:zlib';

/*
 * One aircraft's day from adsb.lol's history releases (globe_history_<year>, ODbL 1.0), fetched on
 * its own. A release is one plain tar split into parts, so an entry indexed once by its offset in
 * the joined parts is a range request away. The trace format is readsb's (README-json.md).
 */

export const ADSBLOL_UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';

/** [seconds after timestamp, lat, lon, altitude ft | 'ground' | null, ground speed kn, track °, flags, vertical rate, aircraft details, …] */
export type TracePoint = [number, number, number, number | 'ground' | null, number | null, number | null, number, number | null, { flight?: string } | null, ...unknown[]];

export type Trace = { icao: string; r?: string; t?: string; dbFlags?: number; timestamp: number; trace: TracePoint[] };

/** A release asset; the parts in name order make up the tar. */
export type TracePart = { name: string; size: number; url: string };

/** The inclusive range to ask each part for, to read [offset, offset + size) of the joined parts. */
export function partRanges(parts: TracePart[], offset: number, size: number) {
  const ranges: { url: string; first: number; last: number }[] = [];
  let start = 0;
  for (const part of parts) {
    const lo = Math.max(offset, start);
    const hi = Math.min(offset + size, start + part.size);
    if (lo < hi) ranges.push({ url: part.url, first: lo - start, last: hi - start - 1 });
    start += part.size;
  }
  if (offset + size > start) throw new Error(`bytes ${offset}+${size} run past the release's ${start}`);
  return ranges;
}

/** A trace entry's bytes: gzip JSON, or plain JSON. */
export function parseTrace(data: Uint8Array): Trace {
  const json = data[0] === 0x1f && data[1] === 0x8b ? gunzipSync(data) : data;
  return JSON.parse(new TextDecoder().decode(json)) as Trace;
}

/** One indexed entry, with a range request per part it spans (an entry can straddle .tar.aa and .tar.ab). */
export async function fetchTrace(parts: TracePart[], offset: number, size: number, get: typeof fetch = fetch): Promise<Trace> {
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const { url, first, last } of partRanges(parts, offset, size)) {
    const res = await get(url, { headers: { 'User-Agent': ADSBLOL_UA, Range: `bytes=${first}-${last}` } });
    // A 200 is the whole part, up to 2 GB: refuse it rather than read it.
    if (res.status !== 206) {
      await res.body?.cancel();
      throw new Error(`${url}: HTTP ${res.status} to a range request`);
    }
    const chunk = new Uint8Array(await res.arrayBuffer());
    if (chunk.length !== last - first + 1) throw new Error(`${url}: ${chunk.length} bytes for a ${last - first + 1}-byte range`);
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return parseTrace(bytes);
}
