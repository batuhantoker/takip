import { dataLayout, geoLayers, type LayerRow, openReader, SqliteCatalogStore, SqliteEventStore, SqliteFeatureStore, SqliteSeriesStore, SqliteTrackStore } from '@takip/db';

/** Read-only handles on the data platform (replay-database.md §10.2). The ingest worker is the writer. */
export type ReplayData = {
  /** Undefined until the ingest worker has created catalog.db. */
  catalog(): SqliteCatalogStore | undefined;
  /** Undefined until the importers have created history.db (`npm run import`). */
  history(): SqliteEventStore | undefined;
  /** Historical series, on history()'s connection. */
  series(): SqliteSeriesStore | undefined;
  /** A published geo layer's current version; a newer publish is picked up on the next call. */
  features(code: string): { layer: LayerRow; store: SqliteFeatureStore } | undefined;
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
  const layers = new Map<string, { layer: LayerRow; store: SqliteFeatureStore }>();
  const openCatalog = () => {
    if (!catalog) {
      const db = openReader(layout.catalog);
      if (db) catalog = new SqliteCatalogStore(db, now);
    }
    return catalog;
  };
  const openHistory = () => {
    if (!history) {
      const db = openReader(layout.history);
      if (db) history = new SqliteEventStore(db);
    }
    return history;
  };
  return {
    catalog: openCatalog,
    history: openHistory,
    series() {
      if (!series) {
        const db = openHistory()?.db;
        if (db) series = new SqliteSeriesStore(db);
      }
      return series;
    },
    features(code) {
      const cat = openCatalog();
      const layer = cat && geoLayers(cat.db).find(l => l.code === code);
      if (!layer) return undefined;
      const open = layers.get(code);
      if (open?.layer.file === layer.file) return open;
      open?.store.close();
      layers.delete(code);
      const store = SqliteFeatureStore.open(layout, layer);
      if (!store) return undefined;
      const entry = { layer, store };
      layers.set(code, entry);
      return entry;
    },
    tracks,
    now,
    close() {
      tracks.close();
      catalog?.db.close();
      history?.db.close();
      for (const { store } of layers.values()) store.close();
    },
  };
}
