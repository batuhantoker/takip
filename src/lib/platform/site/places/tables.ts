import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_DATA } from './gazetteer';

/**
 * A topic's data, keyed by GeoNames id, as its builder in tools/site/topics wrote it to data/site/topics/<name>.json.
 * `meta` holds what applies to every row, such as the day it was counted.
 */
export interface TopicTable<R, M = Record<string, string>> { generated: string; meta?: M; rows: Record<string, R> }

const loaded = new Map<string, TopicTable<unknown, unknown>>();

/** The table, read once per process; an empty one when the file is missing, so its topic simply has no pages. */
export function topicTable<R, M = Record<string, string>>(name: string): TopicTable<R, M> {
  let table = loaded.get(name);
  if (!table) {
    const file = join(SITE_DATA, 'topics', `${name}.json`);
    table = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as TopicTable<unknown, unknown> : { generated: '', rows: {} };
    loaded.set(name, table);
  }
  return table as TopicTable<R, M>;
}

export const tableRow = <R>(name: string, id: number): R | undefined => topicTable<R>(name).rows[String(id)];
