import { type DataLayout, dataLayout, openWriter, SqliteCatalogStore, SqliteEventStore, SqliteTraceIndex, SqliteTrackStore } from '@takip/db';

/** Everything a job needs: the worker's single write handle per file (§10.2). */
export type IngestCtx = {
  layout: DataLayout;
  archiveDir: string;
  catalog: SqliteCatalogStore;
  tracks: SqliteTrackStore;
  /** Where each aircraft's full trace sits in adsb.lol's releases; a year's file opens on first use. */
  traces: SqliteTraceIndex;
  /** history.db, opened on first use; the importers write it too, so writes queue on SQLite's lock. */
  events: () => SqliteEventStore;
  now: () => number;
  log: (message: string) => void;
  close: () => void;
};

export function openIngest({ dataDir, archiveDir }: { dataDir: string; archiveDir: string }, now = Date.now): IngestCtx {
  const layout = dataLayout(dataDir);
  const catalog = new SqliteCatalogStore(openWriter(layout.catalog, 'catalog'), now);
  const tracks = new SqliteTrackStore(layout, 'write');
  const traces = new SqliteTraceIndex(layout, 'write', now);
  let events: SqliteEventStore | undefined;
  return {
    layout,
    archiveDir,
    catalog,
    tracks,
    traces,
    events: () => (events ??= new SqliteEventStore(openWriter(layout.history, 'history'))),
    now,
    log: message => console.log(`[ingest] ${message}`),
    close: () => {
      events?.db.close();
      traces.close();
      tracks.close();
      catalog.db.close();
    },
  };
}
