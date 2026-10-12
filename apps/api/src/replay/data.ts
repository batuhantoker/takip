import { dataLayout, openReader, SqliteCatalogStore, SqliteEventStore, SqliteSeriesStore, SqliteTrackStore } from '@takip/db';

/** Read-only handles on the data platform (replay-database.md §10.2). The ingest worker is the writer. */
export type ReplayData = {
  /** Undefined until the ingest worker has created catalog.db. */
  catalog(): SqliteCatalogStore | undefined;
  /** Undefined until the importers have created history.db (`npm run import`). */
  history(): SqliteEventStore | undefined;
  /** Historical series, on history()'s connection. */
  series(): SqliteSeriesStore | undefined;
  tracks: SqliteTrackStore;
  now: () => number;
  close(): void;
};

export function openReplayData(dataDir: string, now: () => number = Date.now): ReplayData {
  const layout = dataLayout(dataDir);
  const tracks = new SqliteTrackStore(layout, 'read');
  let catalog: SqliteCatalogStore | undefined;
  let history: SqliteEventStore | undefined;
  let series: SqliteSeriesStore | undefined;
  const openHistory = () => {
    if (!history) {
      const db = openReader(layout.history);
      if (db) history = new SqliteEventStore(db);
    }
    return history;
  };
  return {
    catalog() {
      if (!catalog) {
        const db = openReader(layout.catalog);
        if (db) catalog = new SqliteCatalogStore(db, now);
      }
      return catalog;
    },
    history: openHistory,
    series() {
      if (!series) {
        const db = openHistory()?.db;
        if (db) series = new SqliteSeriesStore(db);
      }
      return series;
    },
    tracks,
    now,
    close() {
      tracks.close();
      catalog?.db.close();
      history?.db.close();
    },
  };
}
