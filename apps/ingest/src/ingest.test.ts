import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GB, Recorder } from '@takip/archive/recorder';
import { HOUR_MS } from '@takip/core/time';
import { lonLatToTile, tileBbox } from '@takip/core/tiles';
import { AIRCRAFT_CATEGORIES, isProvisional, TrackClass, TrkFlag, VESSEL_CATEGORIES } from '@takip/core/tracks';
import { decodeChunk, decodeTrk1 } from '@takip/core/trk';
import { dataLayout, SqliteTrackStore } from '@takip/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adsbfi } from './connectors/adsbfi';
import { aisstream, parseAisTime } from './connectors/aisstream';
import { noradId, parseTleText, tleEpoch } from './connectors/celestrak';
import { opensky } from './connectors/opensky';
import { type IngestCtx, openIngest } from './context';
import { buildLod, lodDue } from './jobs/build-lod';
import { ingestTleHour } from './jobs/ingest-tle';
import { sealHour } from './jobs/seal-tracks';
import { sedKeep, simplify } from './tracks/simplify';
import { dedupe, splitRuns } from './tracks/segments';
import { tick } from './worker';

const H = Date.parse('2026-10-12T13:00:00Z');
const s = (ms: number) => ms / 1000;

const ISS = `ISS (ZARYA)
1 25544U 98067A   24146.40251785  .00015505  00000-0  27885-3 0  9997
2 25544  51.6402 189.7042 0004381 334.8091 106.8778 15.50091157455243`;

const aisTime = (t: number) => `${new Date(t).toISOString().replace('T', ' ').replace('Z', '')}456789 +0000 UTC`;
const position = (mmsi: number, t: number, lon: number, lat: number) => JSON.stringify({
  MessageType: 'PositionReport',
  MetaData: { MMSI: mmsi, ShipName: 'KOCAELI   ', latitude: lat, longitude: lon, time_utc: aisTime(t) },
  Message: { PositionReport: { Latitude: lat, Longitude: lon, Sog: 12.3, Cog: 90, TrueHeading: 91 } },
});
const staticData = (mmsi: number, t: number, type: number) => JSON.stringify({
  MessageType: 'ShipStaticData',
  MetaData: { MMSI: mmsi, ShipName: 'KOCAELI', time_utc: aisTime(t) },
  Message: { ShipStaticData: { Name: 'KOCAELI@@@@', Destination: 'IZMIT', Type: type } },
});
const states = (time: number, rows: [string, string, number, number, number][]) => JSON.stringify({
  time: s(time),
  states: rows.map(([icao, callsign, t, lon, lat]) => [icao, callsign, 'X', s(t), s(t) + 1, lon, lat, 10_668, false, 230.5, 90.2, 0, null, 10_900, '1000', false, 0, 0]),
});

describe('connectors', () => {
  it('maps OpenSky state vectors on time_position, skipping ones without a position', () => {
    const fixes = [...opensky.map({ v: 1, src: 'opensky', at: H, body: JSON.parse(states(H, [['4B1805', 'SWR123  ', H - 5000, 8.55, 47.45]])) })];
    expect(fixes).toEqual([expect.objectContaining({ key: '4b1805', t: H - 5000, lon: 8.55, alt: 10_668, label: 'SWR123', category: 'commercial' })]);
    expect(fixes[0].shape === 'track' && fixes[0].speed).toBeCloseTo(448.07, 1);
    const none = { v: 1 as const, src: 'opensky', at: H, body: { time: 1, states: [['abc', null, 'X', null, 1, null, null]] } };
    expect([...opensky.map(none)]).toEqual([]);
  });

  it('maps adsb.fi aircraft with seen_pos ages and drops non-ICAO addresses', () => {
    const body = { now: H, ac: [{ hex: 'AE1234', flight: 'RCH123 ', t: 'C17', lat: 50, lon: 8, alt_baro: 30_000, gs: 420, track: 270, seen_pos: 2.5, dbFlags: 1 }, { hex: '~abc', lat: 1, lon: 1 }] };
    expect([...adsbfi.map({ v: 1, src: 'adsbfi', at: H + 999, body })]).toEqual([
      expect.objectContaining({ key: 'ae1234', t: H - 2500, alt: 9144, category: 'military', label: 'RCH123' }),
    ]);
  });

  it('maps AIS frames to fixes on aisstream time and to static state', () => {
    const t = H + 245_123;
    expect(parseAisTime(aisTime(t))).toBe(t);
    const [fix] = aisstream.map({ v: 1, src: 'aisstream', at: H + 999_999, body: JSON.parse(position(271000001, t, 29, 41)) });
    expect(fix).toMatchObject({ shape: 'track', key: '271000001', t, heading: 91, tIsReceive: true, label: 'KOCAELI' });
    const [state] = aisstream.map({ v: 1, src: 'aisstream', at: t, body: JSON.parse(staticData(271000001, t, 80)) });
    expect(state).toMatchObject({ shape: 'state', name: 'KOCAELI', category: 'tanker', destination: 'IZMIT' });
  });

  it('parses TLE epochs and Alpha-5 catalogue numbers', () => {
    const [iss] = parseTleText(ISS);
    expect(iss).toMatchObject({ norad: 25544, name: 'ISS (ZARYA)' });
    expect(new Date(tleEpoch(iss.line1)!).toISOString()).toBe('2024-05-25T09:39:37.542Z');
    expect(noradId('1 A0001U 24001A')).toBe(100_001);
  });
});

describe('tracks', () => {
  it('keeps one fix per second, merging the sources that reported it', () => {
    const fixes = dedupe([
      { t: H + 1400, lon: 1, lat: 1, mask: 2 },
      { t: H + 1000, lon: 1, lat: 1, mask: 4 },
      { t: H + 3000, lon: 2, lat: 1, mask: 2 },
    ]);
    expect(fixes.map(f => [f.t, f.mask])).toEqual([[H + 1000, 6], [H + 3000, 2]]);
  });

  it('splits at long silences and at the antimeridian', () => {
    const run = (t: number, lon: number) => ({ t: H + t * 1000, lon, lat: 0, mask: 1 });
    expect(splitRuns([run(0, 179.9), run(60, -179.9), run(120, -179.8), run(2000, -179.7)], 900).map(r => r.length)).toEqual([1, 2, 1]);
  });

  it('simplifies a straight constant-speed track to its ends, but keeps a stop', () => {
    const straight = Array.from({ length: 50 }, (_, i) => ({ t: i * 60, lon: i * 0.01, lat: 0 }));
    expect(sedKeep(straight, 100).filter(Boolean)).toHaveLength(2);
    // Same path, but it waits half the time: a path-only simplifier would drop the stop and break timing.
    const stopping = straight.map((p, i) => ({ ...p, lon: i < 25 ? p.lon : 0.24 + (i - 25) * 0.0001 }));
    expect(sedKeep(stopping, 100).filter(Boolean).length).toBeGreaterThan(2);
  });

  it('keeps a point every max interval while moving (L2)', () => {
    const points = Array.from({ length: 121 }, (_, i) => ({ t: i * 60, lon: i * 0.01, lat: 0, speed: 20 }));
    const kept = simplify(points, { sedM: 2000, minIntervalS: 0, maxIntervalS: 600 });
    for (let i = 1; i < kept.length; i++) expect(kept[i].t - kept[i - 1].t).toBeLessThanOrEqual(600);
    expect(kept.length).toBeLessThan(20);
  });
});

describe('sealing from the archive', () => {
  let dir: string;
  let ctx: IngestCtx;
  let now: number;
  let rec: Recorder;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ingest-'));
    now = H + 3 * HOUR_MS;
    rec = new Recorder({ dir: join(dir, 'archive'), freeBytes: () => 500 * GB, log: () => {} });
    ctx = openIngest({ dataDir: dir, archiveDir: join(dir, 'archive') }, () => now);
    ctx.log = () => {};
  });
  afterEach(() => {
    ctx.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const reader = () => new SqliteTrackStore(dataLayout(dir), 'read');
  const tileOf = (lon: number, lat: number, z: number) => {
    const { x, y } = lonLatToTile(lon, lat, z);
    return tileBbox(z, x, y);
  };

  async function recordHour() {
    // A ship: static data, then fixes with a 25 minute silence in the middle.
    rec.record('aisstream', { at: H + 10_000 }, staticData(271000001, H + 10_000, 80));
    for (const [min, lon] of [[1, 29.0], [3, 29.01], [5, 29.02], [30, 29.1], [32, 29.11]] as const) {
      rec.record('aisstream', { at: H + min * 60_000 + 500 }, position(271000001, H + min * 60_000, lon, 41.0));
    }
    // An airliner seen by OpenSky twice in H, and once more by a poll just after the hour.
    rec.record('opensky', { at: H + 60_000, status: 200 }, states(H + 60_000, [['4b1805', 'THY1  ', H + 55_000, 28.9, 41.0]]));
    rec.record('opensky', { at: H + 150_000, status: 200 }, states(H + 150_000, [['4b1805', 'THY1  ', H + 145_000, 28.95, 41.0]]));
    rec.record('opensky', { at: H + HOUR_MS + 30_000, status: 200 }, states(H + HOUR_MS + 30_000, [['4b1805', 'THY1  ', H + HOUR_MS - 10_000, 29.3, 41.0]]));
    // adsb.fi saw the same aircraft once, and failed once.
    rec.record('adsbfi', { at: H + 145_000, status: 200 }, JSON.stringify({ now: H + 145_000, ac: [{ hex: '4b1805', flight: 'THY1', lat: 41.0, lon: 28.95, alt_baro: 35_000, gs: 450, seen_pos: 0 }] }));
    rec.record('adsbfi', { at: H + 200_000, status: 429 }, null);
    rec.record('celestrak', { at: H + 20_000, url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle', status: 200 }, ISS, 'text');
    await rec.flush();
  }

  it('seals an hour into tile-addressed chunks with categories, labels and sources', async () => {
    await recordHour();
    const sealed = await sealHour(ctx, H);
    expect(sealed).toMatchObject({ entities: 2, coverage: { aisstream: 'ok', opensky: 'ok', adsbfi: 'degraded' } });

    const store = reader();
    const z = 7;
    const ships = decodeChunk(store.chunk({ cls: TrackClass.vessel, lod: 0, bucket: H, bbox: tileOf(29.05, 41, z), allowedMask: 0b111 }));
    expect(ships.records.map(r => [r.part, r.label, VESSEL_CATEGORIES[r.category]])).toEqual([[0, 'KOCAELI', 'tanker'], [1, 'KOCAELI', 'tanker']]);
    const first = decodeTrk1(ships.records[0].blob);
    expect([...first.t]).toEqual([s(H + 60_000), s(H + 180_000), s(H + 300_000)]);
    expect(first.flags & TrkFlag.tIsReceive).toBeTruthy();

    const planes = decodeChunk(store.chunk({ cls: TrackClass.aircraft, lod: 0, bucket: H, bbox: tileOf(28.95, 41, z), allowedMask: 0b111 }));
    // The fix from the poll after the hour belongs to this hour, as its own part: 57 minutes is past the gap limit.
    // The two sources' fixes at 145 s are one point.
    expect(planes.records.map(r => [r.part, [...decodeTrk1(r.blob).t].map(t => t - s(H))])).toEqual([[0, [55, 145]], [1, [3590]]]);
    expect(planes.records[0]).toMatchObject({ label: 'THY1', category: AIRCRAFT_CATEGORIES.indexOf('commercial') });

    // A tier that may only see adsb.fi gets nothing: the merged segment also carries OpenSky.
    expect(decodeChunk(store.chunk({ cls: TrackClass.aircraft, lod: 0, bucket: H, bbox: tileOf(28.95, 41, z), allowedMask: 0b100 })).records).toEqual([]);
    store.close();

    expect(ctx.catalog.sealedBucket(0, H)).toMatchObject({ segments: 4 });
    expect(ctx.catalog.coverage(H, H + HOUR_MS).map(c => [c.source, c.status])).toEqual([['adsbfi', 'degraded'], ['adsblol', 'not_recording'], ['aisstream', 'ok'], ['opensky', 'ok']]);
  });

  it('remembers a vessel category for hours without static data, and is idempotent', async () => {
    await recordHour();
    await sealHour(ctx, H);
    rec.record('aisstream', { at: H + HOUR_MS + 60_000 }, position(271000001, H + HOUR_MS + 60_000, 29.2, 41.0));
    await rec.flush();
    await sealHour(ctx, H + HOUR_MS);
    const store = reader();
    const chunk = decodeChunk(store.chunk({ cls: TrackClass.vessel, lod: 0, bucket: H + HOUR_MS, bbox: tileOf(29.2, 41, 7), allowedMask: 0b111 }));
    expect(chunk.records.map(r => VESSEL_CATEGORIES[r.category])).toEqual(['tanker']);
    store.close();
    const again = await sealHour(ctx, H);
    expect(again.segments).toBe(4);
    expect(ctx.catalog.db.prepare(`SELECT count(*) AS n FROM core_entity`).get()).toEqual({ n: 2 });
  });

  it('leaves a source out of history when its build switch is off', async () => {
    await recordHour();
    ctx.catalog.setSourceSwitches('aisstream', { build: false }, 'test');
    const sealed = await sealHour(ctx, H);
    expect(sealed.entities).toBe(1);
    expect(sealed.coverage.aisstream).toBe('not_recording');
  });

  it('builds L1 from six sealed hours', async () => {
    await recordHour();
    const bucket = Date.parse('2026-10-12T12:00:00Z');
    for (let h = bucket; h < bucket + 6 * HOUR_MS; h += HOUR_MS) {
      if (h !== H) expect(lodDue(ctx, 1, bucket)).toBe(false);
      await sealHour(ctx, h);
    }
    expect(lodDue(ctx, 1, bucket)).toBe(true);
    const built = buildLod(ctx, 1, bucket);
    expect(built.segments).toBeGreaterThan(0);
    expect(lodDue(ctx, 1, bucket)).toBe(false);
    const store = reader();
    const chunk = decodeChunk(store.chunk({ cls: TrackClass.vessel, lod: 1, bucket, bbox: tileOf(29.05, 41, 4), allowedMask: 0b111 }));
    // L1 allows 30 minute silences, so the two L0 parts join, and simplification thins the straight line.
    expect(chunk.records).toHaveLength(1);
    expect(decodeTrk1(chunk.records[0].blob).n).toBeLessThan(5);
    store.close();
  });

  it('loads archived TLEs once and serves the set valid at a time', async () => {
    await recordHour();
    expect(await ingestTleHour(ctx, H)).toMatchObject({ records: 1, inserted: 1 });
    expect(await ingestTleHour(ctx, H)).toMatchObject({ inserted: 0 });
    const store = reader();
    expect(store.tleAt(Date.parse('2024-05-26T00:00:00Z')).map(t => t.noradId)).toEqual([25544]);
    store.close();
  });

  it('seals hours nothing was recorded in, so gaps show and L1 still completes', async () => {
    const day = Date.parse('2026-10-12T00:00:00Z');
    rec.record('aisstream', { at: H + 60_000 }, position(271000001, H + 60_000, 29, 41));
    rec.record('aisstream', { at: H + 2 * HOUR_MS + 60_000 }, position(271000001, H + 2 * HOUR_MS + 60_000, 29.1, 41));
    await rec.flush();
    now = Date.parse('2026-10-12T19:05:00Z');
    await tick(ctx);
    const sealed = ctx.catalog.sealedBuckets(0, day, day + 86_400_000);
    // Final from the first recorded day's midnight to 17:00, the last hour 2:05 old; 18:00 and 19:00 provisional.
    const hourOf = (b: { bucket: number }) => new Date(b.bucket).getUTCHours();
    expect(sealed.filter(b => !isProvisional(0, b.bucket, b.sealedAt)).map(hourOf)).toEqual([...Array(18).keys()]);
    expect(sealed.filter(b => isProvisional(0, b.bucket, b.sealedAt)).map(hourOf)).toEqual([18, 19]);
    expect(sealed.find(b => b.bucket === H + HOUR_MS)?.segments).toBe(0);
    expect(ctx.catalog.coverage(H + HOUR_MS, H + 2 * HOUR_MS).find(c => c.source === 'aisstream')?.status).toBe('not_recording');
    // 12:00–18:00 was built in the same tick, now that all six of its hours are sealed.
    expect(ctx.catalog.sealedBucket(1, Date.parse('2026-10-12T12:00:00Z'))).toBeDefined();
  });

  it('runs a worker tick: seals settled hours only, loads TLEs and writes the control file', async () => {
    await recordHour();
    await tick(ctx);
    // H is final; H+1 has a file (the late OpenSky poll) but isn't 2:05 old yet, so it is only provisional.
    const sealed = ctx.catalog.sealedBuckets(0, H, H + 2 * HOUR_MS);
    expect(sealed.map(b => [b.bucket, isProvisional(0, b.bucket, b.sealedAt)])).toEqual([[H, false], [H + HOUR_MS, true]]);
    expect(ctx.catalog.hasRun(4, 'celestrak/2026-10-12T13')).toBe(true);
    const control = JSON.parse(readFileSync(join(dir, 'archive', 'control.json'), 'utf8'));
    expect(control.sources.aisstream).toEqual({ record: true });
    expect(existsSync(join(dir, 'db', 'tracks', 'l0', '2026', '10', '12.db'))).toBe(true);
  });
});
