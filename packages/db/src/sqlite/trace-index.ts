import type { DataLayout } from '../layout';
import { type Db, openReader, openWriter } from '../open';
import type { TraceEntry, TraceIndex, TraceRelease } from '../stores';

const DAY_MS = 86_400_000;

const icaoNumber = (icao: string) => {
  if (!/^[0-9a-f]{6}$/i.test(icao)) throw new Error(`not an ICAO 24-bit address: ${icao}`);
  return parseInt(icao, 16);
};

type ReleaseRow = { day: number; tag: string; page: string; parts: string; entries: number; indexedAt: number };
const releaseOf = (r: ReleaseRow): TraceRelease => ({ ...r, parts: JSON.parse(r.parts) });

const RELEASE_SQL = 'SELECT day, tag, page, parts, entries, indexed_at AS indexedAt FROM trace_release WHERE day = ?';

/** The adsb.lol release index, one file per year (layout.traceIndex). A missing file in read mode is retried on the next call. */
export class SqliteTraceIndex implements TraceIndex {
  private readonly handles = new Map<string, Db>();

  constructor(private readonly layout: DataLayout, private readonly mode: 'read' | 'write', private readonly now = Date.now) {}

  private db(day: number) {
    const path = this.layout.traceIndex(day);
    let db = this.handles.get(path);
    if (!db) {
      db = this.mode === 'write' ? openWriter(path, 'traces') : openReader(path);
      if (db) this.handles.set(path, db);
    }
    return db;
  }

  putDay(release: Omit<TraceRelease, 'entries' | 'indexedAt'>, entries: TraceEntry[]) {
    if (this.mode !== 'write') throw new Error('the trace index was opened read-only');
    if (release.day % DAY_MS !== 0) throw new Error(`a release day starts at 00:00 UTC, not ${new Date(release.day).toISOString()}`);
    const db = this.db(release.day)!;
    const insert = db.prepare('INSERT OR REPLACE INTO trace_entry (day, icao, byte_offset, byte_size) VALUES (?, ?, ?, ?)');
    db.transaction(() => {
      db.prepare('DELETE FROM trace_entry WHERE day = ?').run(release.day);
      for (const e of entries) insert.run(release.day, icaoNumber(e.icao), e.offset, e.size);
      db.prepare('INSERT OR REPLACE INTO trace_release (day, tag, page, parts, entries, indexed_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(release.day, release.tag, release.page, JSON.stringify(release.parts), entries.length, this.now());
    })();
  }

  release(day: number) {
    const start = Math.floor(day / DAY_MS) * DAY_MS;
    const row = this.db(start)?.prepare(RELEASE_SQL).get(start) as ReleaseRow | undefined;
    return row && releaseOf(row);
  }

  entry(day: number, icao: string) {
    const start = Math.floor(day / DAY_MS) * DAY_MS;
    const release = this.release(start);
    if (!release) return undefined;
    const row = this.db(start)!
      .prepare('SELECT byte_offset AS offset, byte_size AS size FROM trace_entry WHERE day = ? AND icao = ?')
      .get(start, icaoNumber(icao)) as { offset: number; size: number } | undefined;
    return row && { icao: icao.toLowerCase(), ...row, release };
  }

  close() {
    for (const db of this.handles.values()) db.close();
    this.handles.clear();
  }
}
