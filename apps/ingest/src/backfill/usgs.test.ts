import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isEnvelope } from '@takip/archive/envelope';
import { readSourceHour } from '@takip/archive/reader';
import { Recorder } from '@takip/archive/recorder';
import { DAY_MS, HOUR_MS, Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { quakeEvent, usgs, usgsQuery } from '../connectors/usgs';
import { type IngestCtx, openIngest } from '../context';
import { eventRef, ingestEventHours } from '../jobs/ingest-events';
import { tick } from '../worker';
import { backfillUsgs } from './usgs';

const NOW = Date.parse('2026-10-12T20:03:00Z');

const quake = (id: string, time: number, mag: number, extra: Record<string, unknown> = {}) => ({
  type: 'Feature',
  id,
  geometry: { type: 'Point', coordinates: [27.1, 38.4, 10.2] },
  properties: {
    mag, place: '5 km N of Izmir, Turkey', time, updated: time + 60_000, url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
    felt: 12, alert: 'green', status: 'reviewed', tsunami: 0, sig: 400, net: 'us', ids: `,${id},`, magType: 'mww', type: 'earthquake',
    title: `M ${mag} - 5 km N of Izmir, Turkey`, ...extra,
  },
});
const collection = (...features: unknown[]) => JSON.stringify({ type: 'FeatureCollection', features });

describe('USGS connector', () => {
  it('maps a feature to a hazard.quake event', () => {
    expect(quakeEvent(quake('us7000abcd', NOW - HOUR_MS, 5.1))).toEqual({
      shape: 'event', kind: 'hazard.quake', sourceRecordId: 'us7000abcd', title: 'M 5.1 - 5 km N of Izmir, Turkey',
      tStart: NOW - HOUR_MS, tStartPrec: Prec.second, lon: 27.1, lat: 38.4, geoPrec: GeoPrec.exact, magnitude: 5.1, supersedes: [],
      attrs: {
        depth_km: 10.2, place: '5 km N of Izmir, Turkey', mag_type: 'mww', alert: 'green', tsunami: false, felt: 12, sig: 400,
        status: 'reviewed', net: 'us', ids: ',us7000abcd,', url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd',
      },
    });
  });

  it('skips blasts, missing positions and failed answers', () => {
    const blast = quake('uu1', NOW, 2.6, { type: 'quarry blast' });
    const nowhere = { ...quake('uu2', NOW, 3), geometry: null };
    const body = JSON.parse(collection(blast, nowhere, quake('uu3', NOW, 3)));
    expect([...usgs.map({ v: 1, src: 'usgs', at: NOW, status: 200, body })].map(e => e.shape === 'event' && e.sourceRecordId)).toEqual(['uu3']);
    expect([...usgs.map({ v: 1, src: 'usgs', at: NOW, status: 503, body })]).toEqual([]);
  });

  it('builds FDSN queries in UTC', () => {
    expect(usgsQuery({ from: Date.parse('1990-01-01T00:00:00Z'), to: Date.parse('1990-01-31T00:00:00Z'), minMag: 4.5 })).toBe(
      'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventtype=earthquake&orderby=time-asc&minmagnitude=4.5'
      + '&starttime=1990-01-01T00%3A00%3A00&endtime=1990-01-31T00%3A00%3A00',
    );
  });
});

describe('USGS recording', () => {
  let dir: string;
  let ctx: IngestCtx;
  let clock: number;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'takip-usgs-'));
    clock = NOW;
    ctx = openIngest({ dataDir: dir, archiveDir: join(dir, 'archive') }, () => clock);
    ctx.log = () => {};
  });
  afterEach(() => {
    ctx.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('halves a window FDSN refuses as too large, and stops on an error', async () => {
    const rec = new Recorder({ dir: ctx.archiveDir, log: () => {}, freeBytes: () => Infinity });
    const asked: string[] = [];
    const get = (async (url: string | URL | Request) => {
      const u = new URL(String(url));
      asked.push(`${u.searchParams.get('starttime')}→${u.searchParams.get('endtime')}`);
      const span = Date.parse(`${u.searchParams.get('endtime')}Z`) - Date.parse(`${u.searchParams.get('starttime')}Z`);
      if (span > 10 * DAY_MS) return new Response('Error 400: 20001 matching events exceeds search limit of 20000.', { status: 400 });
      if (asked.length > 3) return new Response('busy', { status: 503 });
      return new Response(collection(quake(`q${asked.length}`, Date.parse(`${u.searchParams.get('starttime')}Z`), 4)));
    }) as typeof fetch;
    const from = Date.parse('2011-03-01T00:00:00Z');
    const r = await backfillUsgs(rec, from, from + 30 * DAY_MS, { get, now: () => clock, log: () => {}, wait: async () => {} });
    expect(asked).toEqual([
      '2011-03-01T00:00:00→2011-03-31T00:00:00',
      '2011-03-01T00:00:00→2011-03-16T00:00:00',
      '2011-03-01T00:00:00→2011-03-08T12:00:00',
      '2011-03-08T12:00:00→2011-03-16T00:00:00',
    ]);
    expect(r).toMatchObject({ calls: 4, failed: true, hours: [from, from + 7.5 * DAY_MS] });
    const lines = [];
    for await (const line of readSourceHour(ctx.archiveDir, 'usgs', from)) if (isEnvelope(line)) lines.push(line);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ for: from, status: 200 });
  });

  it('fills 30 days, polls the feed every 10 minutes and loads quakes into history.db', async () => {
    const rec = new Recorder({ dir: ctx.archiveDir, log: () => {}, freeBytes: () => Infinity });
    let mag = 5.1;
    const asked: string[] = [];
    const get = (async (url: string | URL | Request) => {
      const u = new URL(String(url));
      asked.push(u.pathname.includes('summary') ? 'feed' : u.searchParams.has('updatedafter') ? 'review' : 'fill');
      if (u.pathname.includes('summary')) return new Response(collection(quake('us1', NOW - HOUR_MS, mag)));
      return new Response(collection(quake('us0', NOW - 10 * DAY_MS, 6.2), quake('us1', NOW - HOUR_MS, mag)));
    }) as typeof fetch;

    await tick(ctx, { rec, get });
    expect(asked).toEqual(['fill', 'feed', 'review']);
    const events = ctx.events();
    const row = () => events.db.prepare(`SELECT magnitude, rev, json_extract(attrs, '$.depth_km') AS depth FROM ev_event WHERE source_record_id = 'us1'`).get();
    expect(events.db.prepare(`SELECT count(*) FROM ev_event`).pluck().get()).toBe(2);
    expect(row()).toEqual({ magnitude: 5.1, rev: 1, depth: 10.2 });
    expect(events.family('hazard.quake')).toBe('hazard');
    expect(events.db.prepare(`SELECT sum(n) FROM agg_timeline_bin WHERE layer = 'hazard'`).pluck().get()).toBeGreaterThanOrEqual(2);
    // The fill landed 30 days back and is settled, so it counts as loaded; the open hour does not yet.
    const usgsId = ctx.catalog.source('usgs')!.sourceId;
    expect(ctx.catalog.hasRun(usgsId, eventRef('usgs', Date.parse('2026-09-12T20:00:00Z')))).toBe(true);
    expect(ctx.catalog.hasRun(usgsId, eventRef('usgs', Date.parse('2026-10-12T20:00:00Z')))).toBe(false);

    clock += 5 * 60_000;
    await tick(ctx, { rec, get });
    expect(asked).toHaveLength(3);

    mag = 5.3;
    clock += 6 * 60_000;
    await tick(ctx, { rec, get });
    expect(asked.slice(3)).toEqual(['feed']);
    expect(row()).toEqual({ magnitude: 5.3, rev: 2, depth: 10.2 });

    ctx.catalog.setSourceSwitches('usgs', { record: false }, 'test');
    clock += 11 * 60_000;
    await tick(ctx, { rec, get });
    expect(asked).toHaveLength(4);
  });

  it('retracts an id USGS replaced, and keeps it retracted when the hour is loaded again', async () => {
    const rec = new Recorder({ dir: ctx.archiveDir, log: () => {}, freeBytes: () => Infinity });
    const hour = Date.parse('2026-10-12T20:00:00Z');
    const t = NOW - 30 * 60_000;
    rec.record('usgs', { at: hour + 60_000, status: 200 }, collection(quake('us7000a', t, 4.4)));
    await rec.flush();
    await ingestEventHours(ctx, 'usgs', [hour]);
    rec.record('usgs', { at: hour + 120_000, status: 200 }, collection(quake('ci4001', t, 4.5, { ids: ',us7000a,ci4001,' })));
    await rec.flush();
    expect(await ingestEventHours(ctx, 'usgs', [hour])).toEqual({ records: 1, inserted: 1, changed: 0, retracted: 1 });
    expect(await ingestEventHours(ctx, 'usgs', [hour])).toEqual({ records: 1, inserted: 0, changed: 0, retracted: 0 });
    const rows = ctx.events().db.prepare(`SELECT source_record_id AS id, retracted_at IS NOT NULL AS gone, rev FROM ev_event ORDER BY id`).all();
    expect(rows).toEqual([{ id: 'ci4001', gone: 0, rev: 1 }, { id: 'us7000a', gone: 1, rev: 2 }]);
  });
});
