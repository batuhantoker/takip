import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openAppDb, type AppDb } from '../db/app-db';
import { cachedAsync, scanStorage } from './storage';

const NOW = Date.UTC(2026, 9, 14, 12);
let root: string;
let db: AppDb;

const put = (path: string, bytes: number) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), Buffer.alloc(bytes));
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'takip-storage-'));
  db = openAppDb(':memory:');
  db.exec("CREATE TABLE thing (id INTEGER PRIMARY KEY); INSERT INTO thing VALUES (1), (2), (3); CREATE VIRTUAL TABLE note USING fts5(body);");
  put('data/db/app.db', 100);
  put('data/db/app.db-wal', 10);
  put('data/db/catalog.db', 50);
  put('data/db/catalog.db-wal', 5);
  put('data/db/geo/world@1.db', 30);
  put('data/db/geo/world@1.db-wal', 3);
  put('data/db/geo/lakes@1.db', 20);
  put('data/db/tracks/l0/2026/10/14.db', 40);
  put('data/db/tracks/tle.db', 10);
  put('data/db/stray.txt', 7);
  put('data/archive/raw/opensky/2026/10/14/10.ndjson.zst', 100);
  put('data/archive/raw/opensky/2026/10/13/23.ndjson.zst', 50);
  put('data/archive/raw/cctv/2026/10/14/09.ndjson.zst', 25);
  put('data/archive/raw/.DS_Store', 6000);
  put('data/archive/control.json', 4);
  put('data/backups/app-2026-10-14.db', 60);
  put('data/reference/x.json', 9);
  put('cache/cctv-catalog.json', 11);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

const dirs = () => ({
  root,
  dataDir: join(root, 'data'),
  backupDir: join(root, 'data/backups'),
  cacheDir: join(root, 'cache'),
  appDbPath: join(root, 'data/db/app.db'),
});

describe('scanStorage', () => {
  it('sizes every group, merges databases with their -wal, and covers the rest of the data directory', async () => {
    const s = await scanStorage(db, dirs(), NOW);
    const groups = Object.fromEntries(s.groups.map(g => [g.id, g]));
    expect(s.groups.map(g => g.id)).toEqual(['app-db', 'catalog', 'geo', 'tracks', 'archive', 'backups', 'camera-cache', 'other']);
    expect(groups['app-db']).toEqual({ id: 'app-db', label: 'Accounts database', path: 'data/db/app.db', bytes: 110, files: 2, items: [{ name: 'app.db', bytes: 110, files: 2 }] });
    expect(groups.catalog).toMatchObject({ bytes: 55, files: 2 });
    expect(groups.geo.items).toEqual([{ name: 'world@1.db', bytes: 33, files: 2 }, { name: 'lakes@1.db', bytes: 20, files: 1 }]);
    expect(groups.tracks.items).toEqual([{ name: 'l0', bytes: 40, files: 1 }, { name: 'tle.db', bytes: 10, files: 1 }]);
    expect(groups.archive).toMatchObject({ path: 'data/archive', bytes: 179, files: 4 });
    expect(groups.archive.items.map(i => i.name)).toEqual(['raw/opensky', 'raw/cctv', 'control.json']);
    expect(groups.backups).toMatchObject({ bytes: 60, files: 1 });
    expect(groups['camera-cache']).toMatchObject({ path: 'cache', bytes: 11 });
    expect(groups.other.items).toEqual([{ name: 'reference', bytes: 9, files: 1 }, { name: 'db/stray.txt', bytes: 7, files: 1 }]);
    expect(s.total).toBe(110 + 55 + 53 + 50 + 179 + 60 + 11 + 16);
    expect(s.disk!.total).toBeGreaterThan(0);
  });

  it('tells each archive source apart by its hour files, with bytes per day for the last 30', async () => {
    const { archive } = await scanStorage(db, dirs(), NOW);
    expect(archive.sources).toEqual([
      { source: 'opensky', bytes: 150, files: 2, firstHour: '2026-10-13T23:00:00.000Z', lastHour: '2026-10-14T10:00:00.000Z' },
      { source: 'cctv', bytes: 25, files: 1, firstHour: '2026-10-14T09:00:00.000Z', lastHour: '2026-10-14T09:00:00.000Z' },
    ]);
    expect(archive.days).toHaveLength(30);
    expect(archive.days.at(-1)).toEqual({ day: '2026-10-14', bytes: { opensky: 100, cctv: 25 } });
    expect(archive.days.at(-2)).toEqual({ day: '2026-10-13', bytes: { opensky: 50 } });
  });

  it('counts the rows of app.db tables, leaving out virtual tables and their shadows', async () => {
    const { appTables } = await scanStorage(db, {}, NOW);
    expect(appTables).toEqual([{ table: 'thing', rows: 3 }]);
  });

  it('leaves out what is missing', async () => {
    const s = await scanStorage(db, { dataDir: join(root, 'nowhere') }, NOW);
    expect(s).toMatchObject({ groups: [], total: 0, archive: { sources: [] } });
  });
});

describe('cachedAsync', () => {
  it('shares one run for the ttl, and runs again when asked or once it lapses', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    let runs = 0;
    const get = cachedAsync(async () => ++runs, 60_000);
    expect(await Promise.all([get(), get()])).toEqual([1, 1]);
    expect(await get(true)).toBe(2);
    vi.setSystemTime(Date.now() + 60_000);
    expect(await get()).toBe(3);
    vi.useRealTimers();
  });
});
