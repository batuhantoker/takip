import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Access, type Entitlements, fallbacks } from '@takip/core/entitlements';
import { lonLatToTile } from '@takip/core/tiles';
import { TrackClass } from '@takip/core/tracks';
import { decodeChunk, encodeTrk1 } from '@takip/core/trk';
import { dataLayout, openWriter, SqliteCatalogStore, SqliteTrackStore } from '@takip/db';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AccessEnv } from '../access/middleware';
import { openReplayData, type ReplayData } from './data';
import { replayRoutes } from './routes';

const H = Date.parse('2026-10-12T13:00:00Z');
const NOW = H + 3 * 3_600_000;
const SEALED_AT = H + 2 * 3_600_000 + 300_000;

let dir: string;
let data: ReplayData;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'replay-'));
  data = openReplayData(dir, () => NOW);
});
afterEach(() => {
  data.close();
  rmSync(dir, { recursive: true, force: true });
});

function seal(bucket: number) {
  const layout = dataLayout(dir);
  const tracks = new SqliteTrackStore(layout, 'write');
  const points = encodeTrk1([{ t: bucket / 1000 + 60, lon: 29, lat: 41 }, { t: bucket / 1000 + 120, lon: 29.01, lat: 41 }]);
  const seg = (entityId: number, sourceMask: number) => ({
    entityId, part: 0, cls: TrackClass.vessel, category: 2, label: `V${entityId}`, sourceMask,
    tFirst: bucket + 60_000, tLast: bucket + 120_000, n: 2, points, flags: 0, bbox: { w: 29, s: 41, e: 29.01, n: 41 },
  });
  tracks.sealBucket(0, bucket, [seg(1, 0b001), seg(2, 0b010)], 1);
  tracks.insertTles([{ noradId: 25544, epoch: H - 3_600_000, line1: '1 25544U', line2: '2 25544', name: 'ISS', sourceId: 4, fetchedAt: H }]);
  tracks.close();
  const catalog = new SqliteCatalogStore(openWriter(layout.catalog, 'catalog'), () => NOW);
  catalog.markSealed(
    { lod: 0, bucket, segments: 2, points: 4, buildVersion: 1, sealedAt: SEALED_AT },
    { path: 'tracks/l0/2026/10/12.db', kind: 'tracks', lod: 0, tLo: H, tHi: H + 86_400_000, status: 'open', rows: 2, bytes: 1 },
    ['tracks:vessel'],
  );
  catalog.setCoverage(1, bucket, bucket + 3_600_000, 'ok');
  return catalog;
}

function app(over: Partial<Entitlements> = {}) {
  const access: Access = {
    plan: { id: 'anon', name: 'Anonymous' },
    entitlements: { ...fallbacks(), 'data.licence_tier': 'anon', 'replay.lookback_days': 1, 'replay.window_hours': 6, ...over },
    subscription: null,
  };
  const hono = new Hono<AccessEnv>();
  hono.use('*', async (c, next) => {
    c.set('principal', { kind: 'anon', ip: '127.0.0.1' });
    c.set('access', access);
    await next();
  });
  hono.route('/api/replay', replayRoutes(data));
  return hono;
}

const tile = lonLatToTile(29, 41, 7);
const chunkUrl = (bucket: number, query: string, lod = 0, z = 7) => `/api/replay/tracks/vessel/${lod}/${z}/${tile.x}/${tile.y}/${bucket / 1000}.bin?${query}`;

type Manifest = {
  token: string;
  from: number;
  limits: { earliest: number };
  tracks: { lods: { lod: number; buckets: [number, number][] }[] };
  coverage: { source: string; status: string }[];
  recorded: { vessel: [number, number | null][]; aircraft: [number, number | null][] };
  attribution: string[];
};

describe('/api/replay', () => {
  it('answers 503 until the ingest worker has created the catalogue', async () => {
    const res = await app().request('/api/replay/manifest');
    expect(res.status).toBe(503);
  });

  it('lists sealed buckets, coverage and attribution within the caller window', async () => {
    seal(H);
    const res = await app().request(`/api/replay/manifest?from=${(H - 86_400_000) / 1000}&to=${NOW / 1000}`);
    expect(res.status).toBe(200);
    const m = (await res.json()) as Manifest;
    // A 6 hour window ends at now, whatever was asked for.
    expect(m.from).toBe((NOW - 6 * 3_600_000) / 1000);
    // Sealed at H+2:05, so final rather than provisional.
    expect(m.tracks.lods[0].buckets).toEqual([[H / 1000, SEALED_AT, 0]]);
    expect(m.coverage).toEqual([expect.objectContaining({ source: 'aisstream', status: 'ok' })]);
    // Recorded spans reach past the window, back to the lookback.
    expect(m.recorded).toEqual({ vessel: [[H / 1000, H / 1000 + 3600]], aircraft: [] });
    expect(m.attribution).toContain('The OpenSky Network, https://opensky-network.org');
    expect(m.token).toMatch(/^[0-9a-f]{12}$/);
  });

  it('serves a sealed chunk, immutable at its version, filtered by the caller licence mask', async () => {
    const catalog = seal(H);
    const { token } = (await (await app().request('/api/replay/manifest')).json()) as Manifest;
    const res = await app().request(chunkUrl(H, `v=${SEALED_AT}&p=${token}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(decodeChunk(new Uint8Array(await res.arrayBuffer())).records.map(r => r.entity)).toEqual([1, 2]);

    // Without the version it may change on a rebuild, so it is cached briefly.
    expect((await app().request(chunkUrl(H, `p=${token}`))).headers.get('cache-control')).toBe('public, max-age=60');

    // Turning OpenSky (bit 1) off for anon changes the token and the content.
    catalog.db.exec(`UPDATE meta_access_policy SET can_view = 0 WHERE tier = 'anon' AND licence_id = 2`);
    const fresh = openReplayData(dir, () => NOW + 120_000);
    const later = new Hono<AccessEnv>();
    later.use('*', async (c, next) => {
      c.set('principal', { kind: 'anon', ip: '127.0.0.1' });
      c.set('access', { plan: { id: 'anon', name: 'Anonymous' }, entitlements: { ...fallbacks(), 'data.licence_tier': 'anon', 'replay.lookback_days': 1 }, subscription: null });
      await next();
    });
    later.route('/api/replay', replayRoutes(fresh));
    expect((await later.request(chunkUrl(H, `p=${token}`))).status).toBe(409);
    const { token: anonToken } = (await (await later.request('/api/replay/manifest')).json()) as Manifest;
    const narrowed = await later.request(chunkUrl(H, `p=${anonToken}`));
    expect(decodeChunk(new Uint8Array(await narrowed.arrayBuffer())).records.map(r => r.entity)).toEqual([1]);
    fresh.close();
  });

  it('refuses wrong zooms, unaligned buckets, missing tokens, unsealed hours and buckets past the lookback', async () => {
    seal(H);
    const { token } = (await (await app().request('/api/replay/manifest')).json()) as Manifest;
    expect((await app().request(chunkUrl(H, `p=${token}`, 0, 8))).status).toBe(400);
    expect((await app().request(chunkUrl(H + 1000, `p=${token}`))).status).toBe(400);
    expect((await app().request(chunkUrl(H, ''))).status).toBe(409);
    const unsealed = await app().request(chunkUrl(H + 3_600_000, `p=${token}`));
    expect(unsealed.status).toBe(404);
    expect(unsealed.headers.get('cache-control')).toBe('no-store');
    const old = await app().request(chunkUrl(H - 2 * 86_400_000, `p=${token}`));
    expect(old.status).toBe(403);
    expect(await old.json()).toMatchObject({ entitlement: 'replay.lookback_days' });
  });

  it('serves the TLE set valid at a time', async () => {
    seal(H);
    const { token } = (await (await app().request('/api/replay/manifest')).json()) as Manifest;
    const res = await app().request(`/api/replay/tle?at=${H / 1000}&p=${token}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ count: 1, tles: [{ norad: 25544, name: 'ISS' }] });
  });
});
