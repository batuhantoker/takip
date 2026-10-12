import { join, relative } from 'node:path';
import { LODS, type Lod } from '@takip/core/tracks';

const pad = (n: number) => String(n).padStart(2, '0');

/** Where every file of the data platform lives (replay-database.md §4.1). */
export function dataLayout(dataDir: string) {
  const db = join(dataDir, 'db');
  return {
    dataDir,
    dbDir: db,
    archiveDir: join(dataDir, 'archive'),
    coldDir: join(dataDir, 'cold'),
    catalog: join(db, 'catalog.db'),
    history: join(db, 'history.db'),
    cache: join(db, 'cache.db'),
    tle: join(db, 'tracks', 'tle.db'),
    /** The shard holding bucket `t` at `lod`: l0/YYYY/MM/DD.db, l1/YYYY-MM.db, l2/YYYY.db. */
    trackShard(lod: Lod, t: number) {
      const d = new Date(t);
      const [y, m, day] = [d.getUTCFullYear(), pad(d.getUTCMonth() + 1), pad(d.getUTCDate())];
      const shard = LODS[lod].shard;
      const name = shard === 'day' ? join(String(y), m, `${day}.db`) : shard === 'month' ? `${y}-${m}.db` : `${y}.db`;
      return join(db, 'tracks', `l${lod}`, name);
    },
    streamShard(t: number) {
      const d = new Date(t);
      return join(db, 'stream', `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}.db`);
    },
    /** meta_shard.path: relative to data/db. */
    shardKey(path: string) {
      return relative(db, path).split('\\').join('/');
    },
    shardPath(key: string) {
      return join(db, key);
    },
  };
}

export type DataLayout = ReturnType<typeof dataLayout>;

/** The period a shard covers, [lo, hi). */
export function shardPeriod(lod: Lod, t: number): { lo: number; hi: number } {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  switch (LODS[lod].shard) {
    case 'day': {
      const lo = Date.UTC(y, m, d.getUTCDate());
      return { lo, hi: lo + 86_400_000 };
    }
    case 'month':
      return { lo: Date.UTC(y, m, 1), hi: Date.UTC(y, m + 1, 1) };
    default:
      return { lo: Date.UTC(y, 0, 1), hi: Date.UTC(y + 1, 0, 1) };
  }
}
