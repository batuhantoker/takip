/** Read-only access to the History events in data/db/history.db (gitignored: this Mac only). */
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DB = join(resolve(import.meta.dirname, '../../..'), 'data/db');
const PATH = join(DB, 'history.db');

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

/** meta_source ids for source codes, from catalog.db. */
function sourceIds(codes: string[]) {
  const catalog = new Database(join(DB, 'catalog.db'), { readonly: true, fileMustExist: true });
  try {
    const ids = catalog.prepare(`SELECT source_id AS id, code FROM meta_source WHERE code IN (${codes.map(() => '?').join(',')})`).all(...codes) as { id: number; code: string }[];
    const missing = codes.filter(c => !ids.some(r => r.code === c));
    if (missing.length) throw new Error(`no source ${missing.join(', ')} in catalog.db`);
    return ids.map(r => r.id);
  } finally {
    catalog.close();
  }
}

/**
 * Every located event of these kinds from these sources (meta_source codes) that starts in [from, to), as epoch ms.
 * Canonical rows only, as the map shows them; the Wikipedia year pages retell many dataset events without being merged.
 */
export function eventsIn(kinds: string[], sources: string[], from: number, to: number): EventRow[] {
  if (!existsSync(PATH)) throw new Error(`events stories need ${PATH} (npm run import -- seed)`);
  db ??= new Database(PATH, { readonly: true, fileMustExist: true });
  const ids = sourceIds(sources);
  const rows = db.prepare(`
    SELECT e.title, e.t_start AS t, e.lat, e.lon, e.magnitude, e.attrs
    FROM ev_event e JOIN ev_kind k ON k.kind_id = e.kind_id
    WHERE k.code IN (${kinds.map(() => '?').join(',')}) AND e.source_id IN (${ids.map(() => '?').join(',')})
      AND e.t_start >= ? AND e.t_start < ?
      AND e.lat IS NOT NULL AND e.lon IS NOT NULL AND e.retracted_at IS NULL AND e.event_id = e.canonical_id
    ORDER BY e.t_start`).all(...kinds, ...ids, from, to) as (Omit<EventRow, 'attrs'> & { attrs: string | null })[];
  return rows.map(r => ({ ...r, attrs: r.attrs ? JSON.parse(r.attrs) : {} }));
}

/** `prec`: how exactly its start is known (higher is finer), so a dated record beats a year-only one of the same event. */
export interface HistoryEvent { id: number; title: string; kind: string; t: number; prec: number; lat: number; lon: number; magnitude: number | null; attrs: Record<string, unknown> }

const EVENT_COLS = `e.event_id AS id, e.title, k.code AS kind, e.t_start AS t, e.t_start_prec AS prec, e.lat, e.lon, e.magnitude, e.attrs`;
const parsed = (rows: (Omit<HistoryEvent, 'attrs'> & { attrs: string | null })[]) => rows.map(r => ({ ...r, attrs: r.attrs ? JSON.parse(r.attrs) : {} }));

/** Events by id, as the map draws them (canonical, located). */
export function eventsById(ids: number[]): HistoryEvent[] {
  if (!existsSync(PATH)) throw new Error(`History tours need ${PATH} (npm run import -- seed)`);
  db ??= new Database(PATH, { readonly: true, fileMustExist: true });
  return parsed(db.prepare(`SELECT ${EVENT_COLS} FROM ev_event e JOIN ev_kind k ON k.kind_id = e.kind_id
    WHERE e.event_id IN (${ids.map(() => '?').join(',')}) AND e.lat IS NOT NULL AND e.retracted_at IS NULL`).all(...ids) as never);
}

/** Every event the map draws of these kinds starting in [from, to), from any source. */
export function drawnEvents(kinds: string[], from: number, to: number): HistoryEvent[] {
  if (!existsSync(PATH)) throw new Error(`History tours need ${PATH} (npm run import -- seed)`);
  db ??= new Database(PATH, { readonly: true, fileMustExist: true });
  return parsed(db.prepare(`SELECT ${EVENT_COLS} FROM ev_event e JOIN ev_kind k ON k.kind_id = e.kind_id
    WHERE k.code IN (${kinds.map(() => '?').join(',')}) AND e.t_start >= ? AND e.t_start < ? AND e.lat IS NOT NULL
      AND e.retracted_at IS NULL AND e.event_id = e.canonical_id`).all(...kinds, from, to) as never);
}
