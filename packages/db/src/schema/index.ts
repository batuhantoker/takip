import { CATALOG } from './catalog';
import { HISTORY } from './history';
import { CACHE, GEO, STREAM, TLE, TRACKS } from './shards';

export type FileKind = 'catalog' | 'history' | 'stream' | 'tracks' | 'tle' | 'cache' | 'geo';

export const MIGRATIONS: Record<FileKind, string[]> = {
  catalog: CATALOG,
  history: HISTORY,
  stream: STREAM,
  tracks: TRACKS,
  tle: TLE,
  cache: CACHE,
  geo: GEO,
};
