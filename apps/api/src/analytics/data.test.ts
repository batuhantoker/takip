import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dataLayout, openWriter } from '@takip/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS, isoDay } from '../access/usage';
import { dataAccumulation, historyCounts } from './data';
import { rangeOf } from './range';

const NOW = Date.UTC(2026, 9, 14, 12);
const TODAY = Math.floor(NOW / DAY_MS);
const range = rangeOf({ days: 7, admins: 'include' }, NOW);
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'takip-data-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function seedCatalog() {
  // The catalog migration seeds the sources.
  const db = openWriter(dataLayout(dir).catalog, 'catalog');
  db.exec("UPDATE meta_source SET record = 0 WHERE code = 'usgs'");
  const run = db.prepare(`
    INSERT INTO meta_ingest_run (source_id, started_at, status, records, inserted, bytes, error)
    VALUES ((SELECT source_id FROM meta_source WHERE code = ?), ?, ?, ?, ?, ?, ?)`);
  run.run('opensky', NOW - 20 * DAY_MS, 'ok', 999, 999, 999, null);
  run.run('opensky', NOW - DAY_MS, 'ok', 100, 80, 4000, null);
  run.run('opensky', NOW, 'failed', 0, 0, 0, 'timeout');
  run.run('usgs', NOW, 'ok', 10, 10, 500, null);
  const shard = db.prepare('INSERT INTO meta_shard (path, kind, lod, status, rows, bytes) VALUES (?, ?, ?, ?, ?, ?)');
  shard.run('tracks/l0/2026/10/13.db', 'tracks', 0, 'sealed', 300, 3000);
  shard.run('tracks/l0/2026/10/14.db', 'tracks', 0, 'sealed', 200, 2000);
  shard.run('geo/admin0@1.db', 'geo', null, 'sealed', 242, 4472832);
  db.close();
}

describe('dataAccumulation', () => {
  it('is unavailable before any ingest made catalog.db, and never creates it', () => {
    const data = dataAccumulation(dir, range, []);
    expect(data).toMatchObject({ available: false, since: null, sources: [], shards: [] });
    expect(data.days).toHaveLength(7);
    expect(existsSync(dataLayout(dir).catalog)).toBe(false);
  });

  it('sums ingest runs per source and day in the range, with each source’s last run, and the shards', () => {
    seedCatalog();
    const data = dataAccumulation(dir, range, [{ table: 'ev_event', rows: 4 }]);
    expect(data).toMatchObject({ available: true, today: isoDay(TODAY), since: isoDay(TODAY - 20), history: [{ table: 'ev_event', rows: 4 }] });
    expect(data.sources.slice(0, 2)).toEqual([
      { code: 'opensky', name: expect.any(String), record: true, build: true, runs: 2, failed: 1, records: 100, inserted: 80, bytes: 4000, lastRunAt: NOW, lastStatus: 'failed', lastError: 'timeout' },
      { code: 'usgs', name: expect.any(String), record: false, build: true, runs: 1, failed: 0, records: 10, inserted: 10, bytes: 500, lastRunAt: NOW, lastStatus: 'ok', lastError: null },
    ]);
    expect(data.sources.slice(2).every(s => s.runs === 0 && s.lastRunAt === null)).toBe(true);
    expect(data.days.at(-1)).toEqual({ day: isoDay(TODAY), runs: 2, failed: 1, records: 10, inserted: 10, bytes: 500 });
    expect(data.days.at(-2)).toEqual({ day: isoDay(TODAY - 1), runs: 1, failed: 0, records: 100, inserted: 80, bytes: 4000 });
    expect(data.shards).toEqual([
      { kind: 'geo', lod: null, status: 'sealed', shards: 1, rows: 242, bytes: 4472832 },
      { kind: 'tracks', lod: 0, status: 'sealed', shards: 2, rows: 500, bytes: 5000 },
    ]);
  });
});

describe('historyCounts', () => {
  it('counts history.db tables, not the shadow tables of its R*Tree and full-text index', async () => {
    expect(await historyCounts(dir)).toEqual([]);
    const db = openWriter(dataLayout(dir).history, 'history');
    db.exec("INSERT INTO ev_kind (code, family) VALUES ('quake', 'hazard'), ('fire', 'hazard')");
    db.close();
    const counts = await historyCounts(dir);
    expect(counts[0]).toEqual({ table: 'ev_kind', rows: 2 });
    expect(counts.some(c => /_(node|parent|rowid|data|idx|docsize|config)$/.test(c.table))).toBe(false);
    expect(counts.map(c => c.table)).toContain('ts_point');
  });

  it('counts big tables exactly in slices of their key, rowid or a WITHOUT ROWID primary key', async () => {
    const db = openWriter(dataLayout(dir).history, 'history');
    db.exec(`
      CREATE TEMP TABLE n AS WITH RECURSIVE n(v) AS (SELECT 1 UNION ALL SELECT v + 1 FROM n WHERE v < 70003) SELECT v FROM n;
      CREATE TABLE x_gappy (id INTEGER PRIMARY KEY);
      INSERT INTO x_gappy SELECT v * 7 FROM n WHERE v <= 60001;
      CREATE TABLE x_keyed (k INTEGER, t INTEGER, PRIMARY KEY (k, t)) WITHOUT ROWID;
      INSERT INTO x_keyed SELECT v % 997, v FROM n;
      CREATE TABLE x_named (k TEXT PRIMARY KEY) WITHOUT ROWID;
      INSERT INTO x_named SELECT 'k' || v FROM n WHERE v <= 50001;`);
    db.close();
    const counts = await historyCounts(dir);
    expect(counts.slice(0, 3)).toEqual([{ table: 'x_keyed', rows: 70003 }, { table: 'x_gappy', rows: 60001 }, { table: 'x_named', rows: 50001 }]);
  });
});
