import { lstat, readdir, statfs } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { isoDay, utcDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import { tableCounts } from './data';

/** Where the api's data lives; any of it may be missing, and then its group is left out. */
export type StorageDirs = { root?: string; dataDir?: string; archiveDir?: string; backupDir?: string; cacheDir?: string; appDbPath?: string };

type Item = { name: string; bytes: number; files: number };
type Group = { id: string; label: string; path: string; bytes: number; files: number; items: Item[] };
type SourceStats = { source: string; bytes: number; files: number; firstHour: string | null; lastHour: string | null };

const ARCHIVE_DAYS = 30;
const SKIP = new Set(['.DS_Store']);
const HOUR_FILE = /^(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})\./;
const dbKey = (name: string) => name.replace(/-(wal|shm|journal)$/, '');

/** Every regular file under `path` (or `path` itself), symlinks not followed; a missing path is null. */
async function walk(path: string, onFile?: (rel: string, bytes: number) => void, base = path): Promise<Omit<Item, 'name'> | null> {
  const info = await lstat(path).catch(() => null);
  if (!info) return null;
  if (info.isFile()) {
    onFile?.(relative(base, path).split(sep).join('/'), info.size);
    return { bytes: info.size, files: 1 };
  }
  if (!info.isDirectory()) return { bytes: 0, files: 0 };
  const total = { bytes: 0, files: 0 };
  for (const entry of await readdir(path).catch(() => [] as string[])) {
    if (SKIP.has(entry)) continue;
    const sub = await walk(join(path, entry), onFile, base);
    if (sub) [total.bytes, total.files] = [total.bytes + sub.bytes, total.files + sub.files];
  }
  return total;
}

/** The children of `dir` as items, merged by `keyOf` (a database with its -wal and -shm), biggest first. */
async function itemsOf(dir: string, { keyOf = (n: string) => n, skip = (() => false) as (name: string) => boolean } = {}) {
  const items = new Map<string, Item>();
  for (const name of await readdir(dir).catch(() => [] as string[])) {
    if (SKIP.has(name) || skip(name)) continue;
    const size = await walk(join(dir, name));
    if (!size) continue;
    const item = items.get(keyOf(name)) ?? { name: keyOf(name), bytes: 0, files: 0 };
    [item.bytes, item.files] = [item.bytes + size.bytes, item.files + size.files];
    items.set(item.name, item);
  }
  return [...items.values()].sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
}

/** The archive's raw/<source>/YYYY/MM/DD/HH files: totals, first and last hour, and bytes per day lately. */
async function archiveStats(archiveDir: string, today: number) {
  const raw = join(archiveDir, 'raw');
  const firstDay = today - ARCHIVE_DAYS + 1;
  const days = Array.from({ length: ARCHIVE_DAYS }, (_, i) => ({ day: isoDay(firstDay + i), bytes: {} as Record<string, number> }));
  const sources: SourceStats[] = [];
  for (const source of await readdir(raw).catch(() => [] as string[])) {
    if (SKIP.has(source)) continue;
    let [first, last] = [Infinity, -Infinity];
    const total = await walk(join(raw, source), (rel, bytes) => {
      const m = HOUR_FILE.exec(rel);
      if (!m) return;
      const hour = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4]);
      [first, last] = [Math.min(first, hour), Math.max(last, hour)];
      const entry = days[utcDay(hour) - firstDay];
      if (entry) entry.bytes[source] = (entry.bytes[source] ?? 0) + bytes;
    });
    if (!total?.files) continue;
    const iso = (t: number) => (Number.isFinite(t) ? new Date(t).toISOString() : null);
    sources.push({ source, ...total, firstHour: iso(first), lastHour: iso(last) });
  }
  return { sources: sources.sort((a, b) => b.bytes - a.bytes || a.source.localeCompare(b.source)), days };
}

/** Sizes of everything the api and the data platform keep on disk (GET /api/admin/analytics/storage). */
export async function scanStorage(db: AppDb, dirs: StorageDirs, now = Date.now()) {
  const started = performance.now();
  const shown = (path: string) => (dirs.root && !relative(dirs.root, path).startsWith('..') ? relative(dirs.root, path) || '.' : path);
  const groups: Group[] = [];
  const add = (id: string, label: string, path: string, items: Item[]) => {
    if (!items.length) return;
    const bytes = items.reduce((n, i) => n + i.bytes, 0);
    groups.push({ id, label, path: shown(path), bytes, files: items.reduce((n, i) => n + i.files, 0), items });
  };
  const dbFiles = async (path: string): Promise<Item[]> => {
    const found = (await Promise.all(['', '-wal', '-shm', '-journal'].map(suffix => walk(`${path}${suffix}`)))).filter(s => s !== null);
    return found.length ? [{ name: path.split(sep).at(-1)!, bytes: found.reduce((n, s) => n + s.bytes, 0), files: found.reduce((n, s) => n + s.files, 0) }] : [];
  };

  const appDb = dirs.appDbPath && dirs.appDbPath !== ':memory:' ? resolve(dirs.appDbPath) : undefined;
  if (appDb) add('app-db', 'Accounts database', appDb, await dbFiles(appDb));

  const dataDir = dirs.dataDir && resolve(dirs.dataDir);
  const archiveDir = dirs.archiveDir ? resolve(dirs.archiveDir) : dataDir && join(dataDir, 'archive');
  const backupDir = dirs.backupDir && resolve(dirs.backupDir);
  if (dataDir) {
    const dbDir = join(dataDir, 'db');
    for (const [id, label, name] of [['catalog', 'Catalog', 'catalog.db'], ['history', 'History', 'history.db'], ['cache-db', 'Cache database', 'cache.db']]) {
      add(id, label, join(dbDir, name), await dbFiles(join(dbDir, name)));
    }
    add('geo', 'Geo layers', join(dbDir, 'geo'), await itemsOf(join(dbDir, 'geo'), { keyOf: dbKey }));
    add('tracks', 'Tracks', join(dbDir, 'tracks'), await itemsOf(join(dbDir, 'tracks'), { keyOf: dbKey }));
    add('stream', 'Event stream', join(dbDir, 'stream'), await itemsOf(join(dbDir, 'stream'), { keyOf: dbKey }));
    add('cold', 'Cold storage', join(dataDir, 'cold'), await itemsOf(join(dataDir, 'cold')));
  }
  const archive = archiveDir ? await archiveStats(archiveDir, utcDay(now)) : { sources: [], days: [] };
  if (archiveDir) {
    const rest = await itemsOf(archiveDir, { skip: name => name === 'raw' });
    const sources = archive.sources.map(s => ({ name: `raw/${s.source}`, bytes: s.bytes, files: s.files }));
    add('archive', 'Raw archive', archiveDir, [...sources, ...rest].sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name)));
  }
  if (backupDir) add('backups', 'Backups', backupDir, await itemsOf(backupDir));
  if (dirs.cacheDir) add('camera-cache', 'Web app cache', resolve(dirs.cacheDir), await itemsOf(resolve(dirs.cacheDir)));
  if (dataDir) {
    // Whatever the groups above don't cover, so the total is the whole data directory.
    const claimed = new Set([join(dataDir, 'db'), join(dataDir, 'cold'), archiveDir, backupDir, appDb]);
    const known = new Set(['catalog.db', 'history.db', 'cache.db', 'geo', 'tracks', 'stream']);
    const top = await itemsOf(dataDir, { skip: name => claimed.has(join(dataDir, name)) });
    const inDb = await itemsOf(join(dataDir, 'db'), { keyOf: dbKey, skip: name => known.has(dbKey(name)) || (appDb !== undefined && join(dataDir, 'db', dbKey(name)) === appDb) });
    add('other', 'Other data', dataDir, [...top, ...inDb.map(i => ({ ...i, name: `db/${i.name}` }))].sort((a, b) => b.bytes - a.bytes));
  }

  const disk = dataDir
    ? await statfs(dataDir).then(s => ({ total: s.blocks * s.bsize, free: s.bavail * s.bsize, used: (s.blocks - s.bfree) * s.bsize }), () => null)
    : null;
  return {
    scannedAt: now,
    tookMs: Math.round(performance.now() - started),
    disk,
    total: groups.reduce((n, g) => n + g.bytes, 0),
    groups,
    archive,
    appTables: tableCounts(db),
  };
}

/** Holds a slow async result for `ttlMs`; concurrent callers share one run, and `fresh` forces a new one. */
export function cachedAsync<T>(run: () => Promise<T>, ttlMs = 60_000, now = () => Date.now()) {
  let held: { at: number; value: Promise<T> } | null = null;
  return (fresh = false) => {
    if (fresh || !held || now() - held.at >= ttlMs) {
      const value = run();
      held = { at: now(), value };
      value.catch(() => {
        if (held?.value === value) held = null;
      });
    }
    return held.value;
  };
}
