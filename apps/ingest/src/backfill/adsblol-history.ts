import { GB, Recorder } from '@takip/archive/recorder';
import { ADSBLOL_UA as UA, parseTrace, type Trace } from '@takip/connectors/adsblol-trace';
import { HOUR_MS } from '@takip/core/time';
import type { TraceEntry, TraceIndex } from '@takip/db';
import { tarEntries } from './tar';

/*
 * adsb.lol publishes each day of its readsb history as a GitHub release (globe_history_<year>,
 * ODbL 1.0): one tar split into parts, about 3 GB a day, holding a gzip JSON trace per aircraft.
 * The trace format is readsb's (wiedehopf/readsb README-json.md). The archive keeps a thinned
 * extract filed by hour; the release itself stays the as-received raw, named in each line's url,
 * and the trace index records where each full trace sits in it.
 */

export const HISTORY_SOURCE = 'adsblol-history';

/** Seconds between kept points: L1 keeps one per 30 s anyway, and readsb's ~2 s would be 15× the bytes. */
export const THIN_S = 30;

const FLAG_STALE = 1;
const FLAG_NEW_LEG = 2;

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

/**
 * Streams a day's release into the archive, one line per aircraft per hour, filed under that hour;
 * `index` learns where each trace sits. `indexOnly` skips the archive, for a day backfilled already:
 * the recorder appends, so streaming it again would archive every line twice.
 */
export async function backfillDay(
  archiveDir: string,
  day: string,
  { get = fetch, now = Date.now, log = console.log, index, indexOnly = false }:
    { get?: typeof fetch; now?: () => number; log?: (m: string) => void; index?: TraceIndex; indexOnly?: boolean } = {},
) {
  if (indexOnly && !index) throw new Error('indexOnly needs an index to write');
  const release = await dayRelease(day, get);
  const total = release.assets.reduce((n, a) => n + a.size, 0);
  log(`${release.tag}: ${release.assets.map(a => a.name).join(' + ')}, ${(total / GB).toFixed(2)} GiB to stream`);
  const rec = indexOnly ? undefined : new Recorder({ dir: archiveDir, maxQueuedBytes: 512 * 1024 * 1024, log });
  const hours = new Set<number>();
  const entries: TraceEntry[] = [];
  let aircraft = 0;
  let points = 0;
  for await (const { name, data, offset } of tarEntries(download(release.assets, get))) {
    // '~' addresses are non-ICAO (TIS-B) and the pattern skips them, as the live mappers do.
    const icao = TRACE_RE.exec(name)?.[1];
    if (!icao) continue;
    entries.push({ icao, offset, size: data.length });
    if (!rec) {
      if (entries.length % 5000 === 0) log(`  ${entries.length} traces indexed`);
      continue;
    }
    const trace = parseTrace(data);
    for (const [hour, body] of traceHours(trace)) {
      rec.recordValue(HISTORY_SOURCE, { at: now(), for: hour, url: `${release.page}#${name.replace(/^\.\//, '')}` }, body);
      hours.add(hour);
      points += body.points.length;
    }
    if (++aircraft % 5000 === 0) log(`  ${aircraft} aircraft, ${points} points`);
    await rec.settle();
  }
  // flush, not close: close would write a heartbeat into today's hour, which says nothing about a backfill.
  await rec?.flush();
  index?.putDay({ day: Date.parse(`${day}T00:00:00Z`), tag: release.tag, page: release.page, parts: release.assets }, entries);
  return { day, tag: release.tag, aircraft: rec ? aircraft : entries.length, points, hours: [...hours].sort((a, b) => a - b) };
}
