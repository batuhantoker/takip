import { gunzipSync } from 'node:zlib';
import { GB, Recorder } from '@takip/archive/recorder';
import { HOUR_MS } from '@takip/core/time';
import { tarEntries } from './tar';

/*
 * adsb.lol publishes each day of its readsb history as a GitHub release (globe_history_<year>,
 * ODbL 1.0): one tar split into parts, about 3 GB a day, holding a gzip JSON trace per aircraft.
 * The trace format is readsb's (wiedehopf/readsb README-json.md). The archive keeps a thinned
 * extract filed by hour; the release itself stays the as-received raw, named in each line's url.
 */

export const HISTORY_SOURCE = 'adsblol-history';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';

/** Seconds between kept points: L1 keeps one per 30 s anyway, and readsb's ~2 s would be 15× the bytes. */
export const THIN_S = 30;

const FLAG_STALE = 1;
const FLAG_NEW_LEG = 2;

/** [seconds after timestamp, lat, lon, altitude ft | 'ground' | null, ground speed kn, track °, flags, vertical rate, aircraft details, …] */
type TracePoint = [number, number, number, number | 'ground' | null, number | null, number | null, number, number | null, { flight?: string } | null, ...unknown[]];

export type Trace = { icao: string; r?: string; t?: string; dbFlags?: number; timestamp: number; trace: TracePoint[] };

/** One aircraft's hour, as archived: points are [epoch s, lat, lon, alt ft | 'ground' | null, gs, track, flight]. */
export type HourBody = {
  icao: string;
  r?: string;
  t?: string;
  dbFlags?: number;
  points: [number, number, number, number | 'ground' | null, number | null, number | null, string | null][];
};

/** Thins a day's trace and splits it by UTC hour. Leg starts and points after silences are always kept. */
export function traceHours(trace: Trace, thinS = THIN_S): Map<number, HourBody> {
  const hours = new Map<number, HourBody>();
  let flight: string | null = null;
  let lastKept = -Infinity;
  trace.trace.forEach((p, i) => {
    const seen = p[8]?.flight?.trim();
    if (seen) flight = seen;
    const t = trace.timestamp + p[0];
    const keep = i === 0 || i === trace.trace.length - 1 || p[6] & (FLAG_STALE | FLAG_NEW_LEG) || t - lastKept >= thinS;
    if (!keep) return;
    lastKept = t;
    const hour = Math.floor(t / 3600) * HOUR_MS;
    let body = hours.get(hour);
    if (!body) hours.set(hour, (body = { icao: trace.icao, r: trace.r, t: trace.t, dbFlags: trace.dbFlags, points: [] }));
    body.points.push([Math.round(t), p[1], p[2], p[3], p[4], p[5], flight]);
  });
  return hours;
}

type Asset = { name: string; size: number; url: string };
export type Release = { tag: string; page: string; assets: Asset[] };

/** The day's release: prod, or staging when prod is missing (the repository's own advice). */
export async function dayRelease(day: string, get: typeof fetch = fetch): Promise<Release> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`expected a day like 2026-10-11, got ${day}`);
  const repo = `adsblol/globe_history_${day.slice(0, 4)}`;
  for (const variant of ['prod', 'staging']) {
    const tag = `v${day.replaceAll('-', '.')}-planes-readsb-${variant}-0`;
    const res = await get(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': UA },
    });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${tag}`);
    const release = (await res.json()) as { html_url: string; assets: { name: string; size: number; browser_download_url: string }[] };
    const assets = release.assets
      .filter(a => /\.tar\.[a-z]{2}$/.test(a.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(a => ({ name: a.name, size: a.size, url: a.browser_download_url }));
    if (assets.length) return { tag, page: release.html_url, assets };
  }
  throw new Error(`no adsb.lol history release for ${day} in ${repo}`);
}

/** The parts downloaded one after another as one byte stream. */
async function* download(assets: Asset[], get: typeof fetch): AsyncGenerator<Uint8Array> {
  for (const asset of assets) {
    const res = await get(asset.url, { headers: { 'User-Agent': UA } });
    if (!res.ok || !res.body) throw new Error(`${asset.name}: HTTP ${res.status}`);
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) yield chunk;
  }
}

const TRACE_RE = /trace_full_([0-9a-f]{6})\.json$/;

/** Streams a day's release into the archive, one line per aircraft per hour, filed under that hour. */
export async function backfillDay(
  archiveDir: string,
  day: string,
  { get = fetch, now = Date.now, log = console.log }: { get?: typeof fetch; now?: () => number; log?: (m: string) => void } = {},
) {
  const release = await dayRelease(day, get);
  const total = release.assets.reduce((n, a) => n + a.size, 0);
  log(`${release.tag}: ${release.assets.map(a => a.name).join(' + ')}, ${(total / GB).toFixed(2)} GiB to stream`);
  const rec = new Recorder({ dir: archiveDir, maxQueuedBytes: 512 * 1024 * 1024, log });
  const hours = new Set<number>();
  let aircraft = 0;
  let points = 0;
  for await (const { name, data } of tarEntries(download(release.assets, get))) {
    // '~' addresses are non-ICAO (TIS-B) and the pattern skips them, as the live mappers do.
    if (!TRACE_RE.test(name)) continue;
    const json = data[0] === 0x1f && data[1] === 0x8b ? gunzipSync(data) : data;
    const trace = JSON.parse(new TextDecoder().decode(json)) as Trace;
    for (const [hour, body] of traceHours(trace)) {
      rec.recordValue(HISTORY_SOURCE, { at: now(), for: hour, url: `${release.page}#${name.replace(/^\.\//, '')}` }, body);
      hours.add(hour);
      points += body.points.length;
    }
    if (++aircraft % 5000 === 0) log(`  ${aircraft} aircraft, ${points} points`);
    await rec.settle();
  }
  // flush, not close: close would write a heartbeat into today's hour, which says nothing about a backfill.
  await rec.flush();
  return { day, tag: release.tag, aircraft, points, hours: [...hours].sort((a, b) => a - b) };
}
