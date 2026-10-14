import { CATALOG } from './catalog';
import { HISTORY } from './history';
import { CACHE, GEO, STREAM, TLE, TRACES, TRACKS } from './shards';

export type FileKind = 'catalog' | 'history' | 'stream' | 'tracks' | 'tle' | 'traces' | 'cache' | 'geo';

export const MIGRATIONS: Record<FileKind, string[]> = {
  catalog: CATALOG,
  history: HISTORY,
  stream: STREAM,
  tracks: TRACKS,
  tle: TLE,
  traces: TRACES,
  cache: CACHE,
  geo: GEO,
};
