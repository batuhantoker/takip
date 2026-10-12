import { archivedHours } from '@takip/archive/reader';
import type { Recorder } from '@takip/archive/recorder';
import { DAY_MS, floorTo, HOUR_MS } from '@takip/core/time';
import { MIN_MAG, USGS_FEED, usgsQuery } from '../connectors/usgs';

/*
 * USGS publishes no request limit; the feed is a CDN file and the FDSN query a database search, so
 * the worker reads the feed every 10 minutes and the query only to fill gaps and pick up revisions.
 */

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';

const POLL_MS = 10 * 60_000;
/** Reviews and magnitude changes reach back weeks; a daily query for recent updates picks them up. */
const REVIEW_MS = DAY_MS;
const REVIEW_REACH_MS = 30 * DAY_MS;
/** The feed holds a day; after a longer silence the query fills the gap. */
const FEED_REACH_MS = 20 * HOUR_MS;
const FIRST_RUN_MS = 30 * DAY_MS;
/** Between backfill requests, so a long range doesn't hammer the search service. */
const PAUSE_MS = 1000;

type Deps = { get?: typeof fetch; now?: () => number; log?: (m: string) => void; wait?: (ms: number) => Promise<void> };

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function fetchInto(rec: Recorder, url: string, forT: number | undefined, { get = fetch, now = Date.now }: Deps) {
  const started = now();
  try {
    const res = await get(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(60_000) });
    const text = await res.text();
    return { status: res.status, text, record: () => rec.record('usgs', { at: now(), for: forT, url, status: res.status, ms: now() - started }, res.ok && text ? text : null) };
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    return { status: 0, text: err, record: () => rec.record('usgs', { at: now(), for: forT, url, err, ms: now() - started }, null) };
  }
}

/**
 * FDSN answers over [from, to), filed under each window's start hour. A month of M2.5+ is a few thousand
 * events; a window over the 20,000 limit is refused with 400 and asked again in halves.
 */
export async function backfillUsgs(rec: Recorder, from: number, to: number, { minMag = MIN_MAG, ...deps }: Deps & { minMag?: number } = {}) {
  const { log = console.log, wait = sleep } = deps;
  const step = minMag >= MIN_MAG ? 30 * DAY_MS : DAY_MS;
  const windows: [number, number][] = [];
  for (let t = from; t < to; t += step) windows.push([t, Math.min(to, t + step)]);
  const hours = new Set<number>();
  let calls = 0;
  let failed = false;
  while (windows.length) {
    const [a, b] = windows.shift()!;
    if (calls) await wait(PAUSE_MS);
    const r = await fetchInto(rec, usgsQuery({ from: a, to: b, minMag }), a, deps);
    calls++;
    if (r.status === 400 && /exceeds search limit/i.test(r.text) && b - a > HOUR_MS) {
      const mid = a + Math.floor((b - a) / 2);
      windows.unshift([a, mid], [mid, b]);
      continue;
    }
    r.record();
    hours.add(floorTo(a, HOUR_MS));
    await rec.settle();
    if (r.status < 200 || r.status >= 300) {
      log(`stopped at ${new Date(a).toISOString()}: USGS answered ${r.status || r.text}`);
      failed = true;
      break;
    }
  }
  await rec.flush();
  return { calls, failed, hours: [...hours].sort((x, y) => x - y) };
}

const lastFeed = new Map<string, number>();
const lastReview = new Map<string, number>();

/**
 * The worker's USGS recording: on start, a gap fill (30 days on the first run), then the feed every
 * 10 minutes and a revisions query daily. Returns the hours it wrote to, for the event loader.
 */
export async function pollUsgs(rec: Recorder, archiveDir: string, deps: Deps = {}) {
  const { now = Date.now, log = console.log } = deps;
  const t = now();
  const hours = new Set<number>();
  if (!lastFeed.has(archiveDir)) {
    // A CLI backfill of 1990 is the last hour on disk too; anything older than the first run's reach is ignored.
    const from = Math.max((await archivedHours(archiveDir, 'usgs')).at(-1) ?? -Infinity, t - FIRST_RUN_MS);
    if (t - from > FEED_REACH_MS) {
      log(`USGS: filling ${new Date(from).toISOString().slice(0, 16)} → now from the FDSN query`);
      for (const h of (await backfillUsgs(rec, from, t, deps)).hours) hours.add(h);
    }
  } else if (t - lastFeed.get(archiveDir)! < POLL_MS) {
    return [];
  }
  lastFeed.set(archiveDir, t);
  (await fetchInto(rec, USGS_FEED, undefined, deps)).record();
  hours.add(floorTo(t, HOUR_MS));
  if (t - (lastReview.get(archiveDir) ?? 0) >= REVIEW_MS) {
    lastReview.set(archiveDir, t);
    (await fetchInto(rec, usgsQuery({ from: t - REVIEW_REACH_MS, updatedAfter: t - REVIEW_MS - HOUR_MS }), undefined, deps)).record();
  }
  await rec.flush();
  return [...hours].sort((a, b) => a - b);
}
