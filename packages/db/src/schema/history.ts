/*
 * history.db: curated and revisable events, historical series, documents, timeline aggregates.
 * entity_id, source_id and dataset_id reference catalog.db; integrity is checked by db:check.
 */
export const HISTORY: string[] = [
  `
  CREATE TABLE ev_kind (
    kind_id    INTEGER PRIMARY KEY,
    code       TEXT NOT NULL UNIQUE,
    family     TEXT NOT NULL,
    parent_id  INTEGER REFERENCES ev_kind,
    style      TEXT NOT NULL DEFAULT '{}'
  ) STRICT;

  CREATE TABLE ev_role (
    role_id  INTEGER PRIMARY KEY,
    code     TEXT NOT NULL UNIQUE
  ) STRICT;

  CREATE TABLE ev_event (
    event_id          INTEGER PRIMARY KEY,
    kind_id           INTEGER NOT NULL REFERENCES ev_kind,
    source_id         INTEGER NOT NULL,
    dataset_id        INTEGER,
    source_record_id  TEXT NOT NULL,
    canonical_id      INTEGER,
    parent_id         INTEGER REFERENCES ev_event,
    title             TEXT,
    t_start           INTEGER NOT NULL,
    t_end             INTEGER,
    t_start_prec      INTEGER NOT NULL,
    t_end_prec        INTEGER,
    ongoing           INTEGER NOT NULL DEFAULT 0,
    t_lo              INTEGER NOT NULL,
    t_hi              INTEGER NOT NULL,
    lon               REAL,
    lat               REAL,
    x0 REAL, y0 REAL, x1 REAL, y1 REAL,
    geom              BLOB,
    geo_prec          INTEGER NOT NULL DEFAULT 0,
    magnitude         REAL,
    severity          REAL,
    confidence        REAL NOT NULL DEFAULT 1,
    attrs             TEXT NOT NULL DEFAULT '{}',
    rev               INTEGER NOT NULL DEFAULT 1,
    retracted_at      INTEGER,
    ingested_at       INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL,
    UNIQUE (source_id, source_record_id)
  ) STRICT;
  CREATE INDEX ev_event_kind_t ON ev_event (kind_id, t_lo);
  CREATE INDEX ev_event_canonical ON ev_event (canonical_id);
  CREATE INDEX ev_event_parent ON ev_event (parent_id);

  CREATE VIRTUAL TABLE ev_event_rtree USING rtree(id, min_x, max_x, min_y, max_y, min_t, max_t);

  CREATE TABLE ev_event_history (
    event_id     INTEGER NOT NULL,
    rev          INTEGER NOT NULL,
    replaced_at  INTEGER NOT NULL,
    row_data     TEXT NOT NULL,
    PRIMARY KEY (event_id, rev)
  ) STRICT, WITHOUT ROWID;

  CREATE TRIGGER ev_event_ai AFTER INSERT ON ev_event WHEN NEW.x0 IS NOT NULL BEGIN
    INSERT INTO ev_event_rtree VALUES (NEW.event_id, NEW.x0, NEW.x1, NEW.y0, NEW.y1, NEW.t_lo, NEW.t_hi);
  END;
  -- Only revisions are history; other updates (canonical_id, parent_id) would collide on (event_id, rev).
  CREATE TRIGGER ev_event_rev AFTER UPDATE ON ev_event WHEN NEW.rev <> OLD.rev BEGIN
    INSERT INTO ev_event_history (event_id, rev, replaced_at, row_data) VALUES (
      OLD.event_id, OLD.rev, NEW.updated_at,
      json_object('kind_id', OLD.kind_id, 'title', OLD.title, 't_start', OLD.t_start, 't_end', OLD.t_end,
                  't_start_prec', OLD.t_start_prec, 't_end_prec', OLD.t_end_prec, 'ongoing', OLD.ongoing,
                  'lon', OLD.lon, 'lat', OLD.lat, 'geo_prec', OLD.geo_prec, 'magnitude', OLD.magnitude,
                  'severity', OLD.severity, 'confidence', OLD.confidence, 'attrs', json(OLD.attrs),
                  'retracted_at', OLD.retracted_at, 'dataset_id', OLD.dataset_id));
  END;
  CREATE TRIGGER ev_event_box AFTER UPDATE OF x0, x1, y0, y1, t_lo, t_hi ON ev_event BEGIN
    DELETE FROM ev_event_rtree WHERE id = OLD.event_id;
    INSERT INTO ev_event_rtree
      SELECT NEW.event_id, NEW.x0, NEW.x1, NEW.y0, NEW.y1, NEW.t_lo, NEW.t_hi WHERE NEW.x0 IS NOT NULL;
  END;
  CREATE TRIGGER ev_event_ad AFTER DELETE ON ev_event BEGIN
    DELETE FROM ev_event_rtree WHERE id = OLD.event_id;
  END;

  CREATE VIRTUAL TABLE ev_event_fts USING fts5(
    title, content = 'ev_event', content_rowid = 'event_id', tokenize = 'unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER ev_event_fts_ai AFTER INSERT ON ev_event BEGIN
    INSERT INTO ev_event_fts (rowid, title) VALUES (NEW.event_id, NEW.title);
  END;
  CREATE TRIGGER ev_event_fts_ad AFTER DELETE ON ev_event BEGIN
    INSERT INTO ev_event_fts (ev_event_fts, rowid, title) VALUES ('delete', OLD.event_id, OLD.title);
  END;
  CREATE TRIGGER ev_event_fts_au AFTER UPDATE OF title ON ev_event BEGIN
    INSERT INTO ev_event_fts (ev_event_fts, rowid, title) VALUES ('delete', OLD.event_id, OLD.title);
    INSERT INTO ev_event_fts (rowid, title) VALUES (NEW.event_id, NEW.title);
  END;

  CREATE TABLE ev_event_entity (
    event_id   INTEGER NOT NULL REFERENCES ev_event ON DELETE CASCADE,
    entity_id  INTEGER NOT NULL,
    role_id    INTEGER NOT NULL REFERENCES ev_role,
    side       INTEGER NOT NULL DEFAULT 0,
    spell      INTEGER NOT NULL DEFAULT 1,
    t_lo       INTEGER,
    t_hi       INTEGER,
    attrs      TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (event_id, entity_id, role_id, side, spell)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX ev_event_entity_entity ON ev_event_entity (entity_id, role_id);

  CREATE TABLE ev_event_relation (
    from_id     INTEGER NOT NULL REFERENCES ev_event ON DELETE CASCADE,
    rel         TEXT NOT NULL CHECK (rel IN ('part_of','same_as','follows','related')),
    to_id       INTEGER NOT NULL REFERENCES ev_event ON DELETE CASCADE,
    confidence  REAL NOT NULL DEFAULT 1,
    source_id   INTEGER,
    PRIMARY KEY (from_id, rel, to_id)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX ev_event_relation_to ON ev_event_relation (to_id, rel);

  CREATE TABLE ts_metric (
    metric_id    INTEGER PRIMARY KEY,
    code         TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    unit         TEXT,
    granularity  TEXT NOT NULL CHECK (granularity IN ('year','month','day','hour','minute','irregular')),
    agg          TEXT NOT NULL DEFAULT 'mean' CHECK (agg IN ('sum','mean','last','max','min')),
    topic        TEXT,
    attrs        TEXT NOT NULL DEFAULT '{}'
  ) STRICT;

  CREATE TABLE ts_series (
    series_id     INTEGER PRIMARY KEY,
    metric_id     INTEGER NOT NULL REFERENCES ts_metric,
    subject_type  TEXT NOT NULL CHECK (subject_type IN ('entity','event')),
    subject_id    INTEGER NOT NULL,
    source_id     INTEGER NOT NULL,
    dataset_id    INTEGER,
    attrs         TEXT NOT NULL DEFAULT '{}',
    UNIQUE (metric_id, subject_type, subject_id, source_id)
  ) STRICT;

  CREATE TABLE ts_point (
    series_id  INTEGER NOT NULL REFERENCES ts_series,
    t          INTEGER NOT NULL,
    v          REAL,
    t_prec     INTEGER NOT NULL DEFAULT 4,
    flags      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (series_id, t)
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE ts_note (
    note_id  INTEGER PRIMARY KEY,
    hash     BLOB NOT NULL UNIQUE,
    text     TEXT NOT NULL
  ) STRICT;

  CREATE TABLE ts_point_note (
    series_id  INTEGER NOT NULL,
    t          INTEGER NOT NULL DEFAULT -8640000000000000,
    note_id    INTEGER NOT NULL REFERENCES ts_note,
    PRIMARY KEY (series_id, t, note_id)
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE doc_document (
    doc_id            INTEGER PRIMARY KEY,
    kind              TEXT NOT NULL CHECK (kind IN ('article','post','report','citation','photo','video','dataset_note')),
    source_id         INTEGER NOT NULL,
    dataset_id        INTEGER,
    source_record_id  TEXT NOT NULL,
    url               TEXT,
    title             TEXT,
    summary           TEXT,
    lang              TEXT,
    published_at      INTEGER,
    retrieved_at      INTEGER NOT NULL,
    media_sha256      BLOB,
    attrs             TEXT NOT NULL DEFAULT '{}',
    UNIQUE (source_id, source_record_id)
  ) STRICT;
  CREATE INDEX doc_document_published ON doc_document (published_at);

  CREATE VIRTUAL TABLE doc_document_fts USING fts5(
    title, summary, content = 'doc_document', content_rowid = 'doc_id', tokenize = 'unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER doc_document_ai AFTER INSERT ON doc_document BEGIN
    INSERT INTO doc_document_fts (rowid, title, summary) VALUES (NEW.doc_id, NEW.title, NEW.summary);
  END;
  CREATE TRIGGER doc_document_ad AFTER DELETE ON doc_document BEGIN
    INSERT INTO doc_document_fts (doc_document_fts, rowid, title, summary) VALUES ('delete', OLD.doc_id, OLD.title, OLD.summary);
  END;
  CREATE TRIGGER doc_document_au AFTER UPDATE OF title, summary ON doc_document BEGIN
    INSERT INTO doc_document_fts (doc_document_fts, rowid, title, summary) VALUES ('delete', OLD.doc_id, OLD.title, OLD.summary);
    INSERT INTO doc_document_fts (rowid, title, summary) VALUES (NEW.doc_id, NEW.title, NEW.summary);
  END;

  CREATE TABLE doc_document_link (
    doc_id       INTEGER NOT NULL REFERENCES doc_document ON DELETE CASCADE,
    target_type  TEXT NOT NULL CHECK (target_type IN ('event','entity','feature','series')),
    target_id    INTEGER NOT NULL,
    role         TEXT NOT NULL CHECK (role IN ('reports','depicts','cites','source_of','mentions')),
    confidence   REAL NOT NULL DEFAULT 1,
    PRIMARY KEY (doc_id, target_type, target_id, role)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX doc_document_link_target ON doc_document_link (target_type, target_id);

  CREATE TABLE doc_media_object (
    sha256        BLOB PRIMARY KEY,
    mime          TEXT NOT NULL,
    bytes         INTEGER NOT NULL,
    width         INTEGER,
    height        INTEGER,
    storage_path  TEXT NOT NULL,
    origin_url    TEXT,
    licence_id    INTEGER,
    captured_at   INTEGER
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE agg_timeline_bin (
    layer      TEXT NOT NULL,
    source_id  INTEGER NOT NULL,
    unit       TEXT NOT NULL CHECK (unit IN ('decade','year','month','day','hour')),
    bin        INTEGER NOT NULL,
    n          INTEGER NOT NULL,
    mag_sum    REAL,
    PRIMARY KEY (layer, unit, bin, source_id)
  ) STRICT, WITHOUT ROWID;
  `,
];
