import { dataLayout, openReader, SqliteCatalogStore, SqliteTrackStore } from '@takip/db';

/** Read-only handles on the data platform (replay-database.md §10.2). The ingest worker is the writer. */
export type ReplayData = {
  /** Undefined until the ingest worker has created catalog.db. */
  catalog(): SqliteCatalogStore | undefined;
  tracks: SqliteTrackStore;
  now: () => number;
  close(): void;
};

export function openReplayData(dataDir: string, now: () => number = Date.now): ReplayData {
  const layout = dataLayout(dataDir);
  const tracks = new SqliteTrackStore(layout, 'read');
  let catalog: SqliteCatalogStore | undefined;
  return {
    catalog() {
      if (!catalog) {
        const db = openReader(layout.catalog);
        if (db) catalog = new SqliteCatalogStore(db, now);
      }
      return catalog;
    },
    tracks,
    now,
    close() {
      tracks.close();
      catalog?.db.close();
    },
  };
}
