import { type DataLayout, dataLayout, openWriter, SqliteCatalogStore, SqliteTrackStore } from '@takip/db';

/** Everything a job needs: the worker's single write handle per file (§10.2). */
export type IngestCtx = {
  layout: DataLayout;
  archiveDir: string;
  catalog: SqliteCatalogStore;
  tracks: SqliteTrackStore;
  now: () => number;
  log: (message: string) => void;
  close: () => void;
};

export function openIngest({ dataDir, archiveDir }: { dataDir: string; archiveDir: string }, now = Date.now): IngestCtx {
  const layout = dataLayout(dataDir);
  const catalog = new SqliteCatalogStore(openWriter(layout.catalog, 'catalog'), now);
  const tracks = new SqliteTrackStore(layout, 'write');
  return {
    layout,
    archiveDir,
    catalog,
    tracks,
    now,
    log: message => console.log(`[ingest] ${message}`),
    close: () => {
      tracks.close();
      catalog.db.close();
    },
  };
}
