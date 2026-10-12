import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Access, type Entitlements, fallbacks } from '@takip/core/entitlements';
import { Prec } from '@takip/core/time';
import { dataLayout, type EventInput, GeoPrec, openWriter, SqliteEventStore } from '@takip/db';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AccessEnv } from '../access/middleware';
import { openReplayData, type ReplayData } from './data';
import { boxes } from './history';
import { replayRoutes } from './routes';

const SOMME = Date.parse('1916-07-01T00:00:00Z');
const S = (iso: string) => Date.parse(iso) / 1000;
/** opensky's licence is viewable by anon in the catalog seed; `secret` is added below with an paid-only one. */
const OPEN = 2;
const SECRET = 99;

let dir: string;
let data: ReplayData;

const event = (sourceId: number, id: string, over: Partial<EventInput> = {}): EventInput => ({
  kind: 'battle', sourceId, datasetId: null, sourceRecordId: id, title: id,
  tStart: SOMME, tStartPrec: Prec.day, lon: 2.7, lat: 50, geoPrec: GeoPrec.exact, ...over,
});

function seed(events: EventInput[]) {
  const layout = dataLayout(dir);
  const catalog = openWriter(layout.catalog, 'catalog');
  catalog.exec(`
    INSERT INTO meta_licence (licence_id, code, name, redistribution) VALUES (99, 'secret', 'Secret', 'none');
    INSERT INTO meta_access_policy (tier, licence_id, can_view, can_export) VALUES ('paid', 99, 1, 0);
    INSERT INTO meta_source (source_id, code, name, licence_id, delivery) VALUES (${SECRET}, 'secret', 'Secret source', 99, 'bulk');
  `);
  catalog.close();
  const history = new SqliteEventStore(openWriter(layout.history, 'history'));
  history.ensureKinds([{ code: 'battle', family: 'conflict' }, { code: 'attack.terror', family: 'terror' }]);
  history.upsertEvents(events);
  history.db.close();
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

type Collection = { binS: number; counts: Record<string, number>; features: { geometry: { coordinates: number[] }; properties: Record<string, number | string | null> }[] };

const get = async (hono: Hono<AccessEnv>, query: string) => {
  const res = await hono.request(`/api/replay/history/events?${query}`);
  return { res, body: (await res.json()) as Collection };
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'history-'));
  data = openReplayData(dir);
});
afterEach(() => {
  data.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('/api/replay/history', () => {
  it('is not ready before the importers have run', async () => {
    const res = await app().request(`/api/replay/history/events?bbox=-180,-90,180,90&from=0&to=1`);
    expect(res.status).toBe(503);
  });

  it('sends sparse events one by one in epoch seconds, gated by licence and not by lookback', async () => {
    seed([event(OPEN, 'Somme', { magnitude: 1e6 }), event(SECRET, 'Hidden')]);
    const { res, body } = await get(app(), `bbox=-10,40,20,60&from=${S('1916-01-01')}&to=${S('1917-01-01')}&z=4`);
    expect(res.status).toBe(200);
    expect(body.features).toHaveLength(1);
    expect(body.features[0].geometry.coordinates).toEqual([2.7, 50]);
    expect(body.features[0].properties).toMatchObject({ kind: 'battle', family: 'conflict', title: 'Somme', t0: SOMME / 1000, t1: SOMME / 1000 + 86_400, magnitude: 1e6 });

    const paid = await get(app({ 'data.licence_tier': 'paid' }), `bbox=-10,40,20,60&from=${S('1916-01-01')}&to=${S('1917-01-01')}`);
    expect(paid.body.features.map(f => f.properties.title).sort()).toEqual(['Hidden', 'Somme']);

    const before = await get(app(), `bbox=-10,40,20,60&from=${S('1915-01-01')}&to=${S('1916-01-01')}`);
    expect(before.body.features).toHaveLength(0);
  });

  it('merges a dense family into counted cells and keeps sparse ones as events', async () => {
    const attacks = Array.from({ length: 2001 }, (_, i) =>
      event(OPEN, `a${i}`, { kind: 'attack.terror', tStart: Date.parse('2014-01-01') + (i % 300) * 86_400_000, lon: 44 + (i % 2) * 0.01, lat: 33, magnitude: 1 }));
    seed([...attacks, event(OPEN, 'Mosul', { tStart: Date.parse('2014-06-10'), lon: 43.1, lat: 36.3 })]);
    const { body } = await get(app(), `bbox=30,20,60,45&from=${S('2014-01-01')}&to=${S('2015-01-01')}&z=3`);
    expect(body.counts).toEqual({ terror: 2001, conflict: 1 });
    const cells = body.features.filter(f => f.properties.cell);
    expect(cells.every(f => f.properties.family === 'terror')).toBe(true);
    expect(cells.reduce((n, f) => n + Number(f.properties.n), 0)).toBe(2001);
    expect(cells.reduce((m, f) => m + Number(f.properties.magnitude), 0)).toBe(2001);
    expect(cells.every(f => Number(f.properties.t1) - Number(f.properties.t0) <= body.binS)).toBe(true);
    expect(body.features.filter(f => !f.properties.cell).map(f => f.properties.title)).toEqual(['Mosul']);
  });

  it('splits a view across the antimeridian', async () => {
    expect(boxes(170, -10, 190, 10)).toEqual([{ w: 170, s: -10, e: 180, n: 10 }, { w: -180, s: -10, e: -170, n: 10 }]);
    expect(boxes(-200, -95, 200, 95)).toEqual([{ w: -180, s: -90, e: 180, n: 90 }]);
    seed([event(OPEN, 'east', { lon: 175, lat: 0 }), event(OPEN, 'west', { lon: -175, lat: 0 }), event(OPEN, 'far', { lon: 0, lat: 0 })]);
    const { body } = await get(app(), `bbox=170,-10,190,10&from=${S('1916-01-01')}&to=${S('1917-01-01')}`);
    expect(body.features.map(f => f.properties.title).sort()).toEqual(['east', 'west']);
  });

  it('serves one event in full, and hides it from tiers that may not see its source', async () => {
    seed([event(OPEN, 'Somme', { attrs: { outcome: 'Stalemate' } }), event(SECRET, 'Hidden')]);
    const [somme, hidden] = (await get(app({ 'data.licence_tier': 'paid' }), `bbox=-10,40,20,60&from=${S('1916-01-01')}&to=${S('1917-01-01')}`))
      .body.features.sort((a, b) => String(b.properties.title).localeCompare(String(a.properties.title)));
    const res = await app().request(`/api/replay/history/events/${somme.properties.id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ title: 'Somme', tStart: SOMME / 1000, attrs: { outcome: 'Stalemate' }, source: { code: 'opensky' } });
    expect((await app().request(`/api/replay/history/events/${hidden.properties.id}`)).status).toBe(404);
  });

  it('rejects a missing or inverted window', async () => {
    seed([]);
    expect((await app().request(`/api/replay/history/events?bbox=0,0,1,1`)).status).toBe(400);
    expect((await app().request(`/api/replay/history/events?bbox=0,0,1,1&from=10&to=5`)).status).toBe(400);
  });
});
