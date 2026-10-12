import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { isEnvelope } from '@takip/archive/envelope';
import { readSourceHour } from '@takip/archive/reader';
import { HOUR_MS } from '@takip/core/time';
import { lonLatToTile, tileBbox } from '@takip/core/tiles';
import { AIRCRAFT_CATEGORIES, TrackClass } from '@takip/core/tracks';
import { decodeChunk, decodeTrk1 } from '@takip/core/trk';
import { dataLayout, SqliteTrackStore } from '@takip/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adsblolHistory } from '../connectors/adsblol-history';
import { type IngestCtx, openIngest } from '../context';
import { sealOrQueue } from '../jobs/seal-hours';
import { lockPath } from '../lock';
import { tick } from '../worker';
import { backfillDay, dayRelease, type Trace, traceHours } from './adsblol-history';
import { backfillOpenSky, RESERVE_CREDITS } from './opensky';
import { tar } from './tar-fixture';

const DAY = Date.parse('2026-10-11T00:00:00Z');
const H = DAY + 13 * HOUR_MS;
const enc = new TextEncoder();

/** A Cessna at San Jose: points every 2 s from 13:00 for 20 minutes, a new leg at 13:10, then one point at 15:00. */
const cessna: Trace = {
  icao: 'ad66e9', r: 'N9627H', t: 'C172', dbFlags: 0, timestamp: DAY / 1000,
  trace: [
    ...Array.from({ length: 600 }, (_, i) => {
      const s = 13 * 3600 + i * 2;
      const details = i === 5 ? { flight: 'N9627H  ' } : null;
      return [s, 37.3 + i * 1e-4, -121.8, i < 3 ? 'ground' : 3500, 95, 270, i === 300 ? 2 : 0, null, details] as Trace['trace'][number];
    }),
    [15 * 3600, 37.5, -121.7, 4500, 100, 90, 0, null, null],
  ],
};

describe('adsb.lol history', () => {
  it('thins a trace to 30 s, keeps leg starts, and splits it by hour', () => {
    const hours = traceHours(cessna);
    expect([...hours.keys()]).toEqual([H, H + 2 * HOUR_MS]);
    const points = hours.get(H)!.points;
    // 20 minutes at 30 s is 40 points, plus the leg start at 13:10 that falls between them.
    expect(points.length).toBeGreaterThanOrEqual(40);
    expect(points.length).toBeLessThanOrEqual(42);
    expect(points.some(p => p[0] === DAY / 1000 + 13 * 3600 + 600)).toBe(true);
    // The callsign appears in a point's details once and is carried forward.
    expect(points[0][6]).toBeNull();
    expect(points.at(-1)![6]).toBe('N9627H');
  });

  it('maps an hour body to fixes, metres and the shared aircraft categories', () => {
    const body = traceHours(cessna).get(H)!;
    const fixes = [...adsblolHistory.map({ v: 1, src: 'adsblol-history', at: Date.now(), for: H, body })];
    expect(fixes[0]).toMatchObject({ key: 'ad66e9', t: DAY + 13 * HOUR_MS, alt: 0, speed: 95, heading: 270 });
    expect(fixes.at(-1)).toMatchObject({ alt: 3500 * 0.3048, label: 'N9627H', category: 'private' });
  });

  it('finds the prod release, falling back to staging, and orders the parts', async () => {
    const get = (async (url: string | URL | Request) => {
      if (String(url).includes('-prod-0')) return new Response('{}', { status: 404 });
      return Response.json({
        html_url: 'https://github.com/adsblol/globe_history_2026/releases/tag/v2026.10.11-planes-readsb-staging-0',
        assets: [
          { name: 'v2026.10.11-planes-readsb-staging-0.tar.ab', size: 2, browser_download_url: 'https://x/ab' },
          { name: 'v2026.10.11-planes-readsb-staging-0.tar.aa', size: 1, browser_download_url: 'https://x/aa' },
          { name: 'RELEASE.md', size: 9, browser_download_url: 'https://x/md' },
        ],
      });
    }) as typeof fetch;
    const release = await dayRelease('2026-10-11', get);
    expect(release.tag).toBe('v2026.10.11-planes-readsb-staging-0');
    expect(release.assets.map(a => a.url)).toEqual(['https://x/aa', 'https://x/ab']);
    await expect(dayRelease('11/10/2026', get)).rejects.toThrow(/expected a day/);
  });
});

describe('backfilling', () => {
  let dir: string;
  let ctx: IngestCtx;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'backfill-'));
    ctx = openIngest({ dataDir: dir, archiveDir: join(dir, 'archive') }, () => Date.parse('2026-10-12T20:00:00Z'));
    ctx.log = () => {};
  });
  afterEach(() => {
    ctx.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('streams a split release into the archive by hour and seals it into tracks', async () => {
    const bytes = tar([
      { name: './traces/e9/trace_full_ad66e9.json', data: gzipSync(JSON.stringify(cessna)) },
      { name: './traces/e9/trace_full_~290ee9.json', data: gzipSync(JSON.stringify({ ...cessna, icao: '~290ee9' })) },
      { name: './heatmap/26.bin.ttf', data: enc.encode('not a trace') },
    ]);
    // Split mid-header, as .aa/.ab are.
    const parts = { 'https://x/aa': bytes.subarray(0, 700), 'https://x/ab': bytes.subarray(700) };
    const get = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.startsWith('https://api.github.com/')) {
        return Response.json({
          html_url: 'https://github.com/adsblol/globe_history_2026/releases/tag/v2026.10.11-planes-readsb-prod-0',
          assets: [
            { name: 'v.tar.aa', size: 700, browser_download_url: 'https://x/aa' },
            { name: 'v.tar.ab', size: bytes.length - 700, browser_download_url: 'https://x/ab' },
          ],
        });
      }
      return new Response(parts[u as keyof typeof parts]);
    }) as typeof fetch;

    const r = await backfillDay(ctx.archiveDir, '2026-10-11', { get, log: () => {} });
    expect(r).toMatchObject({ aircraft: 1, hours: [H, H + 2 * HOUR_MS] });
    const [line] = (await (async () => {
      const out = [];
      for await (const l of readSourceHour(ctx.archiveDir, 'adsblol-history', H)) out.push(l);
      return out;
    })()).filter(isEnvelope);
    expect(line).toMatchObject({ for: H, url: expect.stringContaining('#traces/e9/trace_full_ad66e9.json') });

    const sealed = await sealOrQueue(ctx, r.hours, 'test', { lods: false });
    expect(sealed.queued).toBe(0);
    // A bulk source writes coverage only for hours it has data in.
    expect(ctx.catalog.coverage(H, H + HOUR_MS).find(c => c.source === 'adsblol-history')?.status).toBe('ok');
    expect(ctx.catalog.coverage(H + HOUR_MS, H + 2 * HOUR_MS).find(c => c.source === 'adsblol-history')).toBeUndefined();

    const { x, y } = lonLatToTile(-121.8, 37.32, 7);
    const store = new SqliteTrackStore(dataLayout(dir), 'read');
    const chunk = decodeChunk(store.chunk({ cls: TrackClass.aircraft, lod: 0, bucket: H, bbox: tileBbox(7, x, y), allowedMask: 0b11111 }));
    expect(chunk.records.map(r => [r.label, AIRCRAFT_CATEGORIES[r.category]])).toEqual([['N9627H', 'private']]);
    expect(decodeTrk1(chunk.records[0].blob).n).toBeGreaterThan(30);
    // Its own source bit, so licence gating can treat it separately from the live feed.
    expect(decodeChunk(store.chunk({ cls: TrackClass.aircraft, lod: 0, bucket: H, bbox: tileBbox(7, x, y), allowedMask: 0b01111 })).records).toEqual([]);
    store.close();
  });

  it('hands hours to a running worker instead of sealing them itself, and the worker drains them', async () => {
    writeFileSync(lockPath(ctx), String(process.pid));
    const r = await sealOrQueue(ctx, [H, H + HOUR_MS], 'backfill', { lods: true });
    expect(r.queued).toBe(2);
    expect(ctx.catalog.dirtyBuckets(0, 10)).toEqual([H, H + HOUR_MS]);
    rmSync(lockPath(ctx));
    await tick(ctx);
    expect(ctx.catalog.dirtyBuckets(0, 10)).toEqual([]);
    expect(ctx.catalog.sealedBucket(0, H)).toBeDefined();
  });
});

describe('OpenSky history', () => {
  const NOW = Date.parse('2026-10-12T20:00:00Z');
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'opensky-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('needs an account', async () => {
    await expect(backfillOpenSky(dir, NOW - HOUR_MS, NOW, { env: {}, now: () => NOW, log: () => {} })).rejects.toThrow(/OPENSKY_CLIENT_ID/);
  });

  it('reaches back one hour at most, files lines by the time asked for, and stops before the live budget', async () => {
    const asked: number[] = [];
    let credits = RESERVE_CREDITS + 8;
    const get = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/token')) return Response.json({ access_token: 'tok' });
      asked.push(Number(new URL(u).searchParams.get('time')));
      credits -= 4;
      return new Response(JSON.stringify({ time: asked.at(-1), states: [] }), { headers: { 'x-rate-limit-remaining': String(credits) } });
    }) as typeof fetch;
    const logs: string[] = [];
    const r = await backfillOpenSky(dir, NOW - 3 * HOUR_MS, NOW, {
      get, now: () => NOW, log: m => logs.push(m), env: { OPENSKY_CLIENT_ID: 'id', OPENSKY_CLIENT_SECRET: 'secret' },
    });
    expect(asked[0]).toBe(Math.floor((NOW - HOUR_MS + 60_000) / 1000));
    expect(r.calls).toBe(3);
    expect(logs.join('\n')).toMatch(/last hour[\s\S]*credits left/);
    const lines = [];
    for await (const l of readSourceHour(dir, 'opensky', NOW - HOUR_MS)) lines.push(l);
    expect(lines.filter(isEnvelope).map(l => l.for)).toEqual(asked.map(t => t * 1000));
  });
});
