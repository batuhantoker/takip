import { type DataLayout, dataLayout, openWriter, SqliteCatalogStore, SqliteEventStore, SqliteTrackStore } from '@takip/db';

/** Everything a job needs: the worker's single write handle per file (§10.2). */
export type IngestCtx = {
  layout: DataLayout;
  archiveDir: string;
  catalog: SqliteCatalogStore;
  tracks: SqliteTrackStore;
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
  let events: SqliteEventStore | undefined;
  return {
    layout,
    archiveDir,
    catalog,
    tracks,
    events: () => (events ??= new SqliteEventStore(openWriter(layout.history, 'history'))),
    now,
    log: message => console.log(`[ingest] ${message}`),
    close: () => {
      events?.db.close();
      tracks.close();
      catalog.db.close();
    },
  };
}
