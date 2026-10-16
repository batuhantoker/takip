import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Access, type Entitlements, fallbacks } from '@takip/core/entitlements';
import { dataLayout, openWriter, SqliteSeriesStore } from '@takip/db';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AccessEnv } from '../access/middleware';
import { openReplayData, type ReplayData } from './data';
import { replayRoutes } from './routes';
import { shapeSeries, yearsOf } from './series';

/** opensky's licence is viewable by anon in the catalog seed; `secret` is added below with a paid-only one. */
const OPEN = 2;
const SECRET = 99;
const Y = (year: number) => Date.UTC(year, 0, 1);

let dir: string;
let data: ReplayData;

type SeriesBody = {
  metric: { code: string; unit: string | null };
  source: { code: string };
  sources: { code: string }[];
  values: Record<string, unknown[]>;
  names: Record<string, string>;
  years: [number, number] | null;
};
const json = async <T = SeriesBody>(res: Response | Promise<Response>) => (await (await res).json()) as T;

/** Polities 1 RUS, 2 UKR, 3 the USSR (drawn on both, 1922–1991), plus a region group with a series and no shape. */
function seed() {
  const layout = dataLayout(dir);
  const catalog = openWriter(layout.catalog, 'catalog');
  catalog.exec(`
    INSERT INTO meta_licence (licence_id, code, name, redistribution) VALUES (99, 'secret', 'Secret', 'none');
    INSERT INTO meta_access_policy (tier, licence_id, can_view, can_export) VALUES ('paid', 99, 1, 0);
    INSERT INTO meta_source (source_id, code, name, licence_id, delivery) VALUES (${SECRET}, 'secret', 'Secret source', 99, 'bulk');
    INSERT INTO core_id_scheme (scheme_id, code) VALUES (50, 'takip');
    INSERT INTO core_entity (entity_id, type_id, name, updated_at) VALUES
      (1, 10, 'Russia', 0), (2, 10, 'Ukraine', 0), (3, 10, 'Soviet Union', 0), (4, 11, 'World', 0);
    INSERT INTO core_polity (entity_id, kind, valid_lo, valid_hi) VALUES
      (1, 'sovereign', -8640000000000000, NULL), (2, 'sovereign', -8640000000000000, NULL), (3, 'historical', ${Y(1922)}, ${Y(1992)});
    INSERT INTO core_entity_identifier (scheme_id, value, entity_id) VALUES
      (50, 'RUS', 1), (50, 'UKR', 2), (50, 'hist:SUN', 3), (50, 'region:world', 4);
    INSERT INTO core_polity_render (polity_id, render_polity_id, valid_lo, valid_hi) VALUES
      (3, 1, ${Y(1922)}, ${Y(1991) + 359 * 86_400_000}), (3, 2, ${Y(1922)}, ${Y(1991) + 359 * 86_400_000});
  `);
  catalog.close();
  const series = new SqliteSeriesStore(openWriter(layout.history, 'history'));
  const le = series.ensureMetric({ code: 'owid:le_0', name: 'Life expectancy at birth', unit: 'years', granularity: 'year', topic: 'health' });
  const write = (subjectId: number, sourceId: number, points: [number, number][]) =>
    series.writeSeries({ metricId: le, subjectType: 'entity', subjectId, sourceId, datasetId: null, points: points.map(([y, v]) => ({ t: Y(y), v })) });
  write(1, OPEN, [[1985, 67.9], [1995, 64.5]]);
  write(2, OPEN, [[1995, 67.1]]);
  write(3, OPEN, [[1985, 68.123456], [1990, 69]]);
  write(4, OPEN, [[1985, 63]]);
  write(1, SECRET, [[1985, 70]]);
  const monthly = series.ensureMetric({ code: 'fred:UNRATE', name: 'Unemployment', granularity: 'month' });
  series.writeSeries({ metricId: monthly, subjectType: 'entity', subjectId: 1, sourceId: OPEN, datasetId: null, points: [{ t: Y(2020), v: 4 }] });
  series.db.close();
}

function app(over: Partial<Entitlements> = {}) {
  const access: Access = {
    plan: { id: 'anon', name: 'Anonymous' },
    entitlements: { ...fallbacks(), 'data.licence_tier': 'anon', ...over },
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

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'series-'));
  data = openReplayData(dir);
});
afterEach(() => {
  data.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('/api/replay/history/series', () => {
  it('is not ready before the importers have run', async () => {
    expect((await app().request('/api/replay/history/series/owid:le_0')).status).toBe(503);
  });

  it('paints a historical polity on its successor shapes, and a shape keeps its own value', async () => {
    seed();
    const res = await app().request(`/api/replay/history/series/${encodeURIComponent('owid:le_0')}`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.metric).toMatchObject({ code: 'owid:le_0', unit: 'years' });
    expect(body.source.code).toBe('opensky');
    expect(body.values).toEqual({
      RUS: [[1985, 67.9], [1990, 69, 'hist:SUN'], [1995, 64.5]],
      UKR: [[1985, 68.123, 'hist:SUN'], [1990, 69, 'hist:SUN'], [1995, 67.1]],
    });
    expect(body.names).toEqual({ 'hist:SUN': 'Soviet Union' });
    expect(body.years).toEqual([1985, 1995]);
  });

  it('hides sources the tier may not see, and picks one source at a time', async () => {
    seed();
    const paid = app({ 'data.licence_tier': 'paid' });
    const both = await json(paid.request('/api/replay/history/series/owid:le_0'));
    expect(both.sources.map(s => s.code).sort()).toEqual(['opensky', 'secret']);
    expect(both.source.code).toBe('opensky');
    const secret = await json(paid.request('/api/replay/history/series/owid:le_0?source=secret'));
    expect(secret.values).toEqual({ RUS: [[1985, 70]] });
    expect((await app().request('/api/replay/history/series/owid:le_0?source=secret')).status).toBe(404);
  });

  it('lists yearly metrics that cover enough polities, and refuses to map the rest', async () => {
    seed();
    const series = new SqliteSeriesStore(openWriter(dataLayout(dir).history, 'history'));
    const sparse = series.ensureMetric({ code: 'owid:sparse', name: 'Two countries', granularity: 'year' });
    for (const subjectId of [1, 2]) series.writeSeries({ metricId: sparse, subjectType: 'entity', subjectId, sourceId: OPEN, datasetId: null, points: [{ t: Y(2000), v: 1 }] });
    const le = series.metric('owid:le_0')!.metricId;
    for (let subjectId = 10; subjectId < 16; subjectId++) {
      series.writeSeries({ metricId: le, subjectType: 'entity', subjectId, sourceId: OPEN, datasetId: null, points: [{ t: Y(2000), v: 1 }] });
    }
    series.db.close();
    const { metrics } = await json<{ metrics: unknown[] }>(app().request('/api/replay/history/series'));
    expect(metrics).toEqual([{ code: 'owid:le_0', name: 'Life expectancy at birth', unit: 'years', topic: 'health', subjects: 10, years: [1985, 2000] }]);
    expect((await app().request('/api/replay/history/series/fred:UNRATE')).status).toBe(422);
    expect((await app().request('/api/replay/history/series/nope')).status).toBe(404);
  });

  it('maps a weekly series at its dates, as fractional years', async () => {
    seed();
    const series = new SqliteSeriesStore(openWriter(dataLayout(dir).history, 'history'));
    const weekly = series.ensureMetric({ code: 'owid:covid_weekly_deaths_pm', name: 'Weekly deaths', granularity: 'day' });
    const days = ['2020-03-29', '2020-04-05', '2020-04-12'].map(d => Date.parse(`${d}T00:00:00Z`));
    series.writeSeries({ metricId: weekly, subjectType: 'entity', subjectId: 1, sourceId: OPEN, datasetId: null, points: days.map((t, i) => ({ t, v: i })) });
    series.db.close();
    const body = await json<SeriesBody & { step?: string }>(app().request('/api/replay/history/series/owid:covid_weekly_deaths_pm'));
    expect(body.step).toBe('day');
    expect(body.values).toEqual({ RUS: [[2020.24044, 0], [2020.25956, 1], [2020.27869, 2]] });
    expect(body.years).toEqual([2020.24044, 2020.27869]);
    const yearly = await json<SeriesBody & { step?: string }>(app().request('/api/replay/history/series/owid:le_0'));
    expect('step' in yearly).toBe(false);
  });
});

describe('shapeSeries', () => {
  it('drops region groups and polities without a shape', () => {
    const rows = [
      { seriesId: 1, subjectType: 'entity' as const, subjectId: 4, sourceId: 1, t: Y(2000), v: 1, prec: 4, flags: 0 },
      { seriesId: 2, subjectType: 'entity' as const, subjectId: 5, sourceId: 1, t: Y(2000), v: 2, prec: 4, flags: 0 },
      { seriesId: 3, subjectType: 'entity' as const, subjectId: 6, sourceId: 1, t: Y(2000), v: null, prec: 4, flags: 0 },
    ];
    const polities = [{ entityId: 5, key: 'hist:ABK', name: 'Abkhazia', kind: 'disputed' }, { entityId: 6, key: 'FRA', name: 'France', kind: 'sovereign' }];
    expect(shapeSeries(rows, polities, [])).toEqual({ values: {}, names: {}, years: null });
  });
});

describe('yearsOf', () => {
  it('reports calendar years, fractional ones for a weekly metric, and nothing without points', () => {
    expect(yearsOf(Date.UTC(1960, 0, 1), Date.UTC(2024, 0, 1), 'year')).toEqual([1960, 2024]);
    expect(yearsOf(Date.parse('2020-03-29T00:00:00Z'), Date.parse('2020-04-12T00:00:00Z'), 'day')).toEqual([2020.24044, 2020.27869]);
    expect(yearsOf(null, null, 'year')).toBeNull();
  });
});
