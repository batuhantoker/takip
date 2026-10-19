import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_RECHECK_MS, SITE_DATA } from './gazetteer';

/**
 * A topic's data, keyed by GeoNames id, as its builder in tools/site/topics wrote it to data/site/topics/<name>.json.
 * `meta` holds what applies to every row, such as the day it was counted.
 */
export interface TopicTable<R, M = Record<string, string>> { generated: string; meta?: M; rows: Record<string, R> }

const loaded = new Map<string, { table: TopicTable<unknown, unknown>; mtime: number; checked: number }>();

const mtimeOf = (file: string) => (existsSync(file) ? statSync(file).mtimeMs : 0);

/** The table, read again when a builder rewrites it; an empty one when the file is missing, so its topic simply has no pages. */
export function topicTable<R, M = Record<string, string>>(name: string): TopicTable<R, M> {
  const file = join(SITE_DATA, 'topics', `${name}.json`);
  const now = Date.now();
  let held = loaded.get(name);
  if (held && now - held.checked > DATA_RECHECK_MS) {
    held.checked = now;
    if (mtimeOf(file) !== held.mtime) held = undefined;
  }
  if (!held) {
    const mtime = mtimeOf(file);
    const table = mtime ? JSON.parse(readFileSync(file, 'utf8')) as TopicTable<unknown, unknown> : { generated: '', rows: {} };
    held = { table, mtime, checked: now };
    loaded.set(name, held);
  }
  return held.table as TopicTable<R, M>;
}

export const tableRow = <R>(name: string, id: number): R | undefined => topicTable<R>(name).rows[String(id)];
