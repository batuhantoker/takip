/* The sharded and single-purpose files: stream, tracks, tle, cache and geo layers. */

export const STREAM: string[] = [
  `
  CREATE TABLE ev_event_stream (
    stream_id    INTEGER PRIMARY KEY,
    t            INTEGER NOT NULL,
    t_hour       INTEGER NOT NULL,
    kind_id      INTEGER NOT NULL,
    source_id    INTEGER NOT NULL,
    record_key   BLOB NOT NULL,
    cell         INTEGER NOT NULL,
    lon          REAL,
    lat          REAL,
    geom         BLOB,
    geo_prec     INTEGER NOT NULL DEFAULT 1,
    magnitude    REAL,
    severity     REAL,
    title        TEXT,
    entity_id    INTEGER,
    doc_id       INTEGER,
    attrs        TEXT,
    ingested_at  INTEGER NOT NULL,
    UNIQUE (source_id, record_key)
  ) STRICT;
  CREATE INDEX ev_event_stream_tile ON ev_event_stream (kind_id, t_hour, cell);

  CREATE TABLE agg_event_cell (
    kind_id   INTEGER NOT NULL,
    z         INTEGER NOT NULL,
    unit      TEXT NOT NULL CHECK (unit IN ('day','hour')),
    bin       INTEGER NOT NULL,
    cell      INTEGER NOT NULL,
    n         INTEGER NOT NULL,
    mag_sum   REAL,
    sev_max   REAL,
    PRIMARY KEY (kind_id, z, unit, bin, cell)
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE ts_point_hf (
    series_id  INTEGER NOT NULL,
    t          INTEGER NOT NULL,
    v          REAL,
    flags      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (series_id, t)
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE ts_grid_frame (
    grid_id    INTEGER NOT NULL,
    t          INTEGER NOT NULL,
    kind       TEXT NOT NULL CHECK (kind IN ('forecast','analysis','observation','reanalysis')),
    issued_at  INTEGER NOT NULL,
    source_id  INTEGER NOT NULL,
    payload    BLOB NOT NULL,
    PRIMARY KEY (grid_id, t, kind, issued_at)
  ) STRICT, WITHOUT ROWID;
  `,
];

/** Written only by seal jobs: a bucket is replaced in one transaction. */
export const TRACKS: string[] = [
  `
  CREATE TABLE shard_meta (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  ) STRICT, WITHOUT ROWID;

  -- part: an entity's track inside one bucket is split at long gaps and at the antimeridian.
  CREATE TABLE trk_segment (
    segment_id     INTEGER PRIMARY KEY,
    bucket         INTEGER NOT NULL,
    entity_id      INTEGER NOT NULL,
    part           INTEGER NOT NULL DEFAULT 0,
    class          INTEGER NOT NULL,
    category       INTEGER NOT NULL,
    label          TEXT,
    source_mask    INTEGER NOT NULL,
    t_first        INTEGER NOT NULL,
    t_last         INTEGER NOT NULL,
    n              INTEGER NOT NULL,
    points         BLOB NOT NULL,
    flags          INTEGER NOT NULL DEFAULT 0,
    build_version  INTEGER NOT NULL,
    UNIQUE (bucket, entity_id, part)
  ) STRICT;
  -- Coarser LODs are built one entity at a time from this; also serves an entity's history.
  CREATE INDEX trk_segment_entity ON trk_segment (entity_id, bucket, part);

  -- R*Tree stores 32-bit floats: epoch ms round to ~2 min, always outward. Exact filters go on trk_segment.
  CREATE VIRTUAL TABLE trk_segment_rtree USING rtree(id, min_x, max_x, min_y, max_y, min_t, max_t);

  -- L0 shards only: slow-changing per-track state for that day.
  CREATE TABLE trk_state (
    entity_id    INTEGER NOT NULL,
    valid_lo     INTEGER NOT NULL,
    valid_hi     INTEGER,
    callsign     TEXT,
    squawk       TEXT,
    destination  TEXT,
    nav_status   INTEGER,
    category     INTEGER,
    attrs        TEXT,
    source_id    INTEGER NOT NULL,
    PRIMARY KEY (entity_id, valid_lo)
  ) STRICT, WITHOUT ROWID;
  `,
];

export const TLE: string[] = [
  `
  CREATE TABLE trk_tle (
    norad_id    INTEGER NOT NULL,
    epoch       INTEGER NOT NULL,
    line1       TEXT NOT NULL,
    line2       TEXT NOT NULL,
    name        TEXT,
    source_id   INTEGER NOT NULL,
    fetched_at  INTEGER NOT NULL,
    PRIMARY KEY (norad_id, epoch)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX trk_tle_epoch ON trk_tle (epoch);
  `,
];

/** Where each aircraft's trace sits in adsb.lol's history releases, recorded as a day streams (§7.7). One file per year. */
export const TRACES: string[] = [
  `
  CREATE TABLE trace_release (
    day         INTEGER PRIMARY KEY,
    tag         TEXT NOT NULL,
    page        TEXT NOT NULL,
    parts       TEXT NOT NULL,
    entries     INTEGER NOT NULL,
    indexed_at  INTEGER NOT NULL
  ) STRICT;

  -- byte_offset: where the entry's data starts in the release's parts read as one stream.
  CREATE TABLE trace_entry (
    day          INTEGER NOT NULL,
    icao         INTEGER NOT NULL,
    byte_offset  INTEGER NOT NULL,
    byte_size    INTEGER NOT NULL,
    PRIMARY KEY (day, icao)
  ) STRICT, WITHOUT ROWID;
  `,
];

export const CACHE: string[] = [
  `
  CREATE TABLE kv (
    ns       TEXT NOT NULL,
    key      TEXT NOT NULL,
    value    TEXT NOT NULL,
    expires  INTEGER NOT NULL,
    PRIMARY KEY (ns, key)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX kv_expires ON kv (expires);
  `,
];

/** One file per reference layer version; built by the importer, published by rename. */
export const GEO: string[] = [
  `
  CREATE TABLE layer_meta (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE feature (
    feature_id        INTEGER PRIMARY KEY,
    entity_id         INTEGER,
    source_record_id  TEXT,
    valid_lo          INTEGER NOT NULL DEFAULT -8640000000000000,
    valid_hi          INTEGER,
    t_prec            INTEGER NOT NULL DEFAULT 0,
    tier              INTEGER NOT NULL DEFAULT 0,
    props             TEXT NOT NULL DEFAULT '{}',
    geom              BLOB NOT NULL
  ) STRICT;
  CREATE INDEX feature_entity ON feature (entity_id);

  CREATE TABLE feature_gen (
    gen_id      INTEGER PRIMARY KEY,
    feature_id  INTEGER NOT NULL REFERENCES feature,
    zband       INTEGER NOT NULL,
    part        INTEGER NOT NULL DEFAULT 0,
    geom        BLOB NOT NULL,
    UNIQUE (feature_id, zband, part)
  ) STRICT;

  CREATE VIRTUAL TABLE gen_rtree USING rtree(id, min_x, max_x, min_y, max_y, min_t, max_t, min_zb, max_zb);
  `,
];
