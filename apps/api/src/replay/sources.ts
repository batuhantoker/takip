import { writeControl } from '@takip/archive/control';
import { type CoverageRow, dataLayout, openWriter, SqliteCatalogStore, type SourceRow } from '@takip/db';

const WEEK_MS = 7 * 86_400_000;

/** A source's switches, plus its latest coverage interval: whether data is actually flowing (§7.4). */
export type SourceState = SourceRow & { coverage: Pick<CoverageRow, 'status' | 'tLo' | 'tHi'> | null };

/**
 * The admin console's Sources page: per-source record and build switches (replay-database.md §7.6).
 * catalog.db holds them; control.json is rewritten at once so the recorder in the web app picks
 * a change up within a minute, without waiting for the ingest worker.
 */
export type SourceSwitchboard = {
  list(): SourceState[];
  set(code: string, switches: { record?: boolean; build?: boolean }, by: string): SourceState | undefined;
  close(): void;
};

export function openSourceSwitchboard({ dataDir, archiveDir }: { dataDir: string; archiveDir: string }, now: () => number = Date.now): SourceSwitchboard {
  let catalog: SqliteCatalogStore | undefined;
  // Opened on first use: a writer creates catalog.db, and the api shouldn't do that at boot.
  const store = () => (catalog ??= new SqliteCatalogStore(openWriter(dataLayout(dataDir).catalog, 'catalog'), now));
  const list = (): SourceState[] => {
    const s = store();
    const latest = new Map<string, CoverageRow>();
    for (const row of s.coverage(now() - WEEK_MS, now())) latest.set(row.source, row);
    return s.sources().map(src => {
      const c = latest.get(src.code);
      return { ...src, coverage: c ? { status: c.status, tLo: c.tLo, tHi: c.tHi } : null };
    });
  };
  return {
    list,
    set(code, switches, by) {
      if (!store().setSourceSwitches(code, switches, by)) return undefined;
      const sources = list();
      writeControl(archiveDir, Object.fromEntries(sources.map(r => [r.code, { record: r.record }])), now());
      return sources.find(r => r.code === code);
    },
    close: () => catalog?.db.close(),
  };
}
