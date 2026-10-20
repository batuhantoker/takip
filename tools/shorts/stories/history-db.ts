/** Read-only access to the History events in data/db/history.db (gitignored: this Mac only). */
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PATH = join(resolve(import.meta.dirname, '../../..'), 'data/db/history.db');

export interface EventRow {
  title: string;
  /** Epoch ms. */
  t: number;
  lat: number;
  lon: number;
  magnitude: number | null;
  attrs: Record<string, unknown>;
}

let db: Database.Database | null = null;

/** Every located event of these kinds that starts in [from, to), as epoch ms. */
export function eventsIn(kinds: string[], from: number, to: number): EventRow[] {
  if (!existsSync(PATH)) throw new Error(`events stories need ${PATH} (npm run import -- seed)`);
  db ??= new Database(PATH, { readonly: true, fileMustExist: true });
  const rows = db.prepare(`
    SELECT e.title, e.t_start AS t, e.lat, e.lon, e.magnitude, e.attrs
    FROM ev_event e JOIN ev_kind k ON k.kind_id = e.kind_id
    WHERE k.code IN (${kinds.map(() => '?').join(',')}) AND e.t_start >= ? AND e.t_start < ?
      AND e.lat IS NOT NULL AND e.lon IS NOT NULL AND e.retracted_at IS NULL
    ORDER BY e.t_start`).all(...kinds, from, to) as (Omit<EventRow, 'attrs'> & { attrs: string | null })[];
  return rows.map(r => ({ ...r, attrs: r.attrs ? JSON.parse(r.attrs) : {} }));
}
