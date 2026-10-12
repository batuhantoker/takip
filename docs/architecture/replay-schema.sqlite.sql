-- SQLite schema, readable overview. The migrations that create it are in packages/db/src/schema/, one list per
-- file kind; keep this file in step with them. See replay-database.md §4 (files) and §11 (portability).
-- Times are INTEGER epoch ms UTC. Validity: *_lo NOT NULL (-8640000000000000 = since forever), *_hi NULL = open.
-- Geometry is WKB in BLOB; bounding boxes live in R*Tree tables. Table prefix_name maps to Postgres prefix.name.
-- Precision: 0 unknown, 1 millennium, 2 century, 3 decade, 4 year, 5 month, 6 day, 7 hour, 8 minute, 9 second.
-- Geo precision: 0 none, 1 exact, 2 facility, 3 city, 4 area, 5 country, 6 approximate.
-- R*Tree time dims store the expanded interval; 8.64e15 stands in for "open".

-- Opened with (replay-database.md §10.1):
--   PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;
--   PRAGMA foreign_keys = ON; PRAGMA temp_store = MEMORY; PRAGMA mmap_size = 4294967296;


-- ═══════════════════════════════ catalog.db ═══════════════════════════════

CREATE TABLE meta_licence (
  licence_id      INTEGER PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  url             TEXT,
  commercial_use  INTEGER,                      -- null = unverified
  redistribution  TEXT NOT NULL CHECK (redistribution IN
                    ('none','display','attribution','share_alike','public_domain','unknown')),
  attribution     TEXT,
  verified_at     TEXT
) STRICT;

CREATE TABLE meta_source (
  source_id         INTEGER PRIMARY KEY,
  code              TEXT NOT NULL UNIQUE,       -- 'aisstream', 'opensky', 'gtd', 'cow-interstate', 'wdi'
  name              TEXT NOT NULL,
  owner             TEXT,
  url               TEXT,
  licence_id        INTEGER NOT NULL REFERENCES meta_licence,
  delivery          TEXT NOT NULL CHECK (delivery IN ('stream','poll','bulk','manual')),
  auth              TEXT,
  refresh_ms        INTEGER,
  event_table       TEXT CHECK (event_table IN ('event','stream')),
  track_bit         INTEGER UNIQUE CHECK (track_bit BETWEEN 0 AND 62),  -- bit in trk_segment.source_mask
  recording_since   INTEGER,
  config            TEXT NOT NULL DEFAULT '{}',
  record            INTEGER NOT NULL DEFAULT 1,  -- admin switches (replay-database.md §7.6): write the raw archive
  build             INTEGER NOT NULL DEFAULT 1,  -- derive history from it
  switched_at       INTEGER,
  switched_by       TEXT
) STRICT;

CREATE TABLE meta_dataset (
  dataset_id        INTEGER PRIMARY KEY,
  source_id         INTEGER NOT NULL REFERENCES meta_source,
  version           TEXT NOT NULL,
  as_of             INTEGER,
  files             TEXT NOT NULL,              -- [{path, sha256, bytes, rows, skipped?}]
  licence_id        INTEGER REFERENCES meta_licence,
  t_lo              INTEGER,
  t_hi              INTEGER,
  importer_version  TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'loading'
                      CHECK (status IN ('loading','active','superseded','failed')),
  report            TEXT,
  imported_at       INTEGER NOT NULL,
  UNIQUE (source_id, version)
) STRICT;
CREATE UNIQUE INDEX meta_dataset_one_active ON meta_dataset (source_id) WHERE status = 'active';

CREATE TABLE meta_dataset_gap (
  dataset_id  INTEGER NOT NULL REFERENCES meta_dataset ON DELETE CASCADE,
  t_lo        INTEGER NOT NULL,
  t_hi        INTEGER NOT NULL,
  region      BLOB,
  kind        TEXT NOT NULL CHECK (kind IN ('missing','partial','preliminary')),
  note        TEXT
) STRICT;

CREATE TABLE meta_ingest_run (
  run_id       INTEGER PRIMARY KEY,
  source_id    INTEGER NOT NULL REFERENCES meta_source,
  started_at   INTEGER NOT NULL,
  finished_at  INTEGER,
  status       TEXT NOT NULL CHECK (status IN ('running','ok','partial','failed','short')),
  records      INTEGER, inserted INTEGER, changed INTEGER, bytes INTEGER,
  archive_ref  TEXT,
  error        TEXT
) STRICT;
CREATE INDEX meta_ingest_run_src ON meta_ingest_run (source_id, started_at DESC);
CREATE INDEX meta_ingest_run_ref ON meta_ingest_run (source_id, archive_ref);

CREATE TABLE meta_coverage (
  source_id  INTEGER NOT NULL REFERENCES meta_source,
  t_lo       INTEGER NOT NULL,
  t_hi       INTEGER,                           -- null = interval still open
  status     TEXT NOT NULL CHECK (status IN ('ok','degraded','down','not_recording')),
  note       TEXT,
  PRIMARY KEY (source_id, t_lo)
) STRICT, WITHOUT ROWID;

CREATE TABLE meta_layer_version (
  layer       TEXT PRIMARY KEY,                 -- 'tracks:vessel', 'events:conflict', 'geo:dams'
  version     INTEGER NOT NULL DEFAULT 1,
  changed_at  INTEGER NOT NULL
) STRICT, WITHOUT ROWID;

CREATE TABLE meta_access_policy (
  tier        TEXT NOT NULL,                    -- 'anon','free','paid','internal'
  licence_id  INTEGER NOT NULL REFERENCES meta_licence,
  can_view    INTEGER NOT NULL,
  can_export  INTEGER NOT NULL,
  PRIMARY KEY (tier, licence_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE meta_shard (
  path        TEXT PRIMARY KEY,                 -- relative to data/db or data/cold
  kind        TEXT NOT NULL CHECK (kind IN ('tracks','stream','geo','tle')),
  lod         INTEGER,
  layer       TEXT,
  t_lo        INTEGER,
  t_hi        INTEGER,
  status      TEXT NOT NULL CHECK (status IN ('open','sealed','cold','superseded')),
  rows        INTEGER,
  bytes       INTEGER,
  sha256      BLOB,
  sealed_at   INTEGER
) STRICT, WITHOUT ROWID;
CREATE INDEX meta_shard_kind ON meta_shard (kind, lod, t_lo);

-- One row per sealed bucket: what replay can serve, and the version its URLs carry (sealed_at).
CREATE TABLE trk_sealed_bucket (
  lod            INTEGER NOT NULL,
  bucket         INTEGER NOT NULL,
  segments       INTEGER NOT NULL,
  points         INTEGER NOT NULL,
  build_version  INTEGER NOT NULL,
  sealed_at      INTEGER NOT NULL,
  PRIMARY KEY (lod, bucket)
) STRICT, WITHOUT ROWID;

CREATE TABLE trk_dirty_bucket (
  lod        INTEGER NOT NULL,
  bucket     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  queued_at  INTEGER NOT NULL,
  PRIMARY KEY (lod, bucket)
) STRICT, WITHOUT ROWID;

CREATE TABLE core_entity_type (
  type_id  INTEGER PRIMARY KEY,
  code     TEXT NOT NULL UNIQUE                 -- vessel, aircraft, satellite, camera, airport, port, facility,
                                                -- heritage_site, waterbody, polity, region_group, org,
                                                -- instrument, person_public, settlement
) STRICT;

CREATE TABLE core_entity (
  entity_id            INTEGER PRIMARY KEY,
  type_id              INTEGER NOT NULL REFERENCES core_entity_type,
  name                 TEXT,
  lon                  REAL,
  lat                  REAL,
  first_seen           INTEGER,
  last_seen            INTEGER,
  identity_confidence  REAL NOT NULL DEFAULT 1,
  attrs                TEXT NOT NULL DEFAULT '{}',
  updated_at           INTEGER NOT NULL
) STRICT;
CREATE INDEX core_entity_type_idx ON core_entity (type_id);

CREATE TABLE core_id_scheme (
  scheme_id  INTEGER PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE               -- mmsi, imo, icao24, registration, callsign, norad, iata, icao,
                                                -- wikidata, osm, iso3, iso2, isonum, wb, cow, gw, gtd, owid,
                                                -- ucdp_actor, wac, ticker, iso4217, native:<source>
) STRICT;

-- No-overlap of validity per (scheme, value) is enforced by the writer and db:check.
CREATE TABLE core_entity_identifier (
  scheme_id   INTEGER NOT NULL REFERENCES core_id_scheme,
  value       TEXT NOT NULL,
  valid_lo    INTEGER NOT NULL DEFAULT -8640000000000000,
  valid_hi    INTEGER,
  entity_id   INTEGER NOT NULL REFERENCES core_entity,
  source_id   INTEGER REFERENCES meta_source,
  confidence  REAL NOT NULL DEFAULT 1,
  PRIMARY KEY (scheme_id, value, valid_lo)
) STRICT, WITHOUT ROWID;
CREATE INDEX core_entity_identifier_entity ON core_entity_identifier (entity_id);

-- resolve(scheme, value, at):
--   SELECT entity_id FROM core_entity_identifier
--   WHERE scheme_id = ? AND value = ? AND valid_lo <= :at AND (valid_hi IS NULL OR valid_hi > :at);

CREATE TABLE core_entity_name (
  name_id    INTEGER PRIMARY KEY,
  entity_id  INTEGER NOT NULL REFERENCES core_entity ON DELETE CASCADE,
  name       TEXT NOT NULL,
  norm       TEXT NOT NULL,                     -- lower-case, diacritics removed (done in TS)
  lang       TEXT,
  kind       TEXT NOT NULL DEFAULT 'alias' CHECK (kind IN ('official','short','alias','historical')),
  valid_lo   INTEGER NOT NULL DEFAULT -8640000000000000,
  valid_hi   INTEGER,
  source_id  INTEGER REFERENCES meta_source
) STRICT;
CREATE INDEX core_entity_name_norm ON core_entity_name (norm);
CREATE INDEX core_entity_name_entity ON core_entity_name (entity_id);

CREATE VIRTUAL TABLE core_entity_name_fts USING fts5(
  name, content = 'core_entity_name', content_rowid = 'name_id',
  tokenize = 'trigram remove_diacritics 1'
);
CREATE TRIGGER core_entity_name_ai AFTER INSERT ON core_entity_name BEGIN
  INSERT INTO core_entity_name_fts (rowid, name) VALUES (NEW.name_id, NEW.name);
END;
CREATE TRIGGER core_entity_name_ad AFTER DELETE ON core_entity_name BEGIN
  INSERT INTO core_entity_name_fts (core_entity_name_fts, rowid, name) VALUES ('delete', OLD.name_id, OLD.name);
END;
CREATE TRIGGER core_entity_name_au AFTER UPDATE OF name ON core_entity_name BEGIN
  INSERT INTO core_entity_name_fts (core_entity_name_fts, rowid, name) VALUES ('delete', OLD.name_id, OLD.name);
  INSERT INTO core_entity_name_fts (rowid, name) VALUES (NEW.name_id, NEW.name);
END;

CREATE TABLE core_entity_version (
  entity_id   INTEGER NOT NULL REFERENCES core_entity ON DELETE CASCADE,
  valid_lo    INTEGER NOT NULL,
  valid_hi    INTEGER,
  geom        BLOB,
  attrs       TEXT NOT NULL,
  attrs_hash  BLOB NOT NULL,
  source_id   INTEGER REFERENCES meta_source,
  run_id      INTEGER,
  PRIMARY KEY (entity_id, valid_lo)
) STRICT, WITHOUT ROWID;
CREATE INDEX core_entity_version_current ON core_entity_version (entity_id) WHERE valid_hi IS NULL;

CREATE TABLE core_link_rel (
  rel_id  INTEGER PRIMARY KEY,
  code    TEXT NOT NULL UNIQUE                  -- part_of, located_in, operates, successor_of, same_as,
                                                -- feeds, connects, serves
) STRICT;

CREATE TABLE core_entity_link (
  from_id     INTEGER NOT NULL REFERENCES core_entity,
  rel_id      INTEGER NOT NULL REFERENCES core_link_rel,
  to_id       INTEGER NOT NULL REFERENCES core_entity,
  valid_lo    INTEGER NOT NULL DEFAULT -8640000000000000,
  valid_hi    INTEGER,
  confidence  REAL NOT NULL DEFAULT 1,
  source_id   INTEGER REFERENCES meta_source,
  PRIMARY KEY (from_id, rel_id, to_id, valid_lo)
) STRICT, WITHOUT ROWID;
CREATE INDEX core_entity_link_to ON core_entity_link (to_id, rel_id);

CREATE TABLE core_polity (
  entity_id  INTEGER PRIMARY KEY REFERENCES core_entity,
  kind       TEXT NOT NULL CHECK (kind IN ('sovereign','historical','dependency','subnational','disputed')),
  valid_lo   INTEGER NOT NULL DEFAULT -8640000000000000,
  valid_hi   INTEGER
) STRICT;

-- How a polity is drawn on the borders layer valid at the same time (USSR -> 15 successor shapes).
CREATE TABLE core_polity_render (
  polity_id         INTEGER NOT NULL REFERENCES core_polity,
  render_polity_id  INTEGER NOT NULL REFERENCES core_polity,
  valid_lo          INTEGER NOT NULL DEFAULT -8640000000000000,
  valid_hi          INTEGER,
  PRIMARY KEY (polity_id, render_polity_id, valid_lo)
) STRICT, WITHOUT ROWID;

CREATE TABLE core_region_member (
  group_id   INTEGER NOT NULL REFERENCES core_entity,
  member_id  INTEGER NOT NULL REFERENCES core_entity,
  source_id  INTEGER NOT NULL REFERENCES meta_source,
  valid_lo   INTEGER NOT NULL DEFAULT -8640000000000000,
  valid_hi   INTEGER,
  PRIMARY KEY (group_id, member_id, source_id, valid_lo)
) STRICT, WITHOUT ROWID;

CREATE TABLE geo_layer (
  layer_id    INTEGER PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,             -- 'admin0', 'dams', 'glwd-lakes', 'unesco-whc', 'highway-planning'
  source_id   INTEGER NOT NULL REFERENCES meta_source,
  file        TEXT NOT NULL,                    -- current geo/<code>@<version>.db
  version     INTEGER NOT NULL,
  geom_kind   TEXT NOT NULL CHECK (geom_kind IN ('point','line','polygon','mixed')),
  minzoom     INTEGER NOT NULL DEFAULT 0,
  maxzoom     INTEGER NOT NULL DEFAULT 14,
  time_mode   TEXT NOT NULL DEFAULT 'static' CHECK (time_mode IN ('static','valid')),
  tile_props  TEXT NOT NULL DEFAULT '[]',
  style       TEXT NOT NULL DEFAULT '{}'
) STRICT;

CREATE TABLE cam_camera_version (
  version_id    INTEGER PRIMARY KEY,
  entity_id     INTEGER NOT NULL REFERENCES core_entity,
  source_id     INTEGER NOT NULL REFERENCES meta_source,
  native_id     TEXT NOT NULL,
  valid_lo      INTEGER NOT NULL,
  valid_hi      INTEGER,
  lon           REAL NOT NULL,
  lat           REAL NOT NULL,
  name          TEXT,
  city          TEXT,
  country       TEXT,
  feed_url      TEXT,
  stream_url    TEXT,
  stream_type   TEXT,
  external_url  TEXT,
  hash          BLOB NOT NULL,
  run_id        INTEGER
) STRICT;
CREATE UNIQUE INDEX cam_camera_current ON cam_camera_version (source_id, native_id) WHERE valid_hi IS NULL;
CREATE INDEX cam_camera_entity ON cam_camera_version (entity_id, valid_lo);

CREATE VIRTUAL TABLE cam_camera_rtree USING rtree(id, min_x, max_x, min_y, max_y, min_t, max_t);
CREATE TRIGGER cam_camera_version_ai AFTER INSERT ON cam_camera_version BEGIN
  INSERT INTO cam_camera_rtree VALUES
    (NEW.version_id, NEW.lon, NEW.lon, NEW.lat, NEW.lat, NEW.valid_lo, coalesce(NEW.valid_hi, 8.64e15));
END;
CREATE TRIGGER cam_camera_version_au AFTER UPDATE OF valid_hi ON cam_camera_version BEGIN
  UPDATE cam_camera_rtree SET max_t = coalesce(NEW.valid_hi, 8.64e15) WHERE id = NEW.version_id;
END;

CREATE TABLE cam_blocklist (
  pattern   TEXT PRIMARY KEY,                   -- host, URL prefix, or source:native_id
  reason    TEXT NOT NULL,
  added_at  INTEGER NOT NULL
) STRICT, WITHOUT ROWID;

CREATE TABLE cam_tombstone (
  media_key   TEXT PRIMARY KEY,
  entity_id   INTEGER,
  removed_at  INTEGER NOT NULL,
  reason      TEXT
) STRICT, WITHOUT ROWID;


-- ═══════════════════════════════ history.db ═══════════════════════════════
-- entity_id, source_id and dataset_id reference catalog.db; integrity is checked by db:check.

CREATE TABLE ev_kind (
  kind_id    INTEGER PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,              -- war.interstate, conflict.armed, battle, attack.terror,
                                                -- claim.territorial, change.territorial, econ.tariff,
                                                -- hazard.quake, hazard.fire, alert.weather, outage.internet,
                                                -- cyber.c2, news.report, gdelt.event, status.in_danger
  family     TEXT NOT NULL,
  parent_id  INTEGER REFERENCES ev_kind,
  style      TEXT NOT NULL DEFAULT '{}'
) STRICT;

CREATE TABLE ev_role (
  role_id  INTEGER PRIMARY KEY,
  code     TEXT NOT NULL UNIQUE                 -- participant, side_a, side_b, supporter, initiator, location,
                                                -- perpetrator, target, target_nationality, gaining, losing,
                                                -- imposing, targeted, claimant, subject
) STRICT;

CREATE TABLE ev_event (
  event_id          INTEGER PRIMARY KEY,
  kind_id           INTEGER NOT NULL REFERENCES ev_kind,
  source_id         INTEGER NOT NULL,
  dataset_id        INTEGER,
  source_record_id  TEXT NOT NULL,
  canonical_id      INTEGER,                    -- same_as cluster representative; equals event_id if none
  parent_id         INTEGER REFERENCES ev_event,
  title             TEXT,
  t_start           INTEGER NOT NULL,
  t_end             INTEGER,
  t_start_prec      INTEGER NOT NULL,
  t_end_prec        INTEGER,
  ongoing           INTEGER NOT NULL DEFAULT 0,
  t_lo              INTEGER NOT NULL,
  t_hi              INTEGER NOT NULL,           -- 8640000000000000 when ongoing
  lon               REAL,                       -- display anchor
  lat               REAL,
  x0 REAL, y0 REAL, x1 REAL, y1 REAL,           -- bbox; equals the anchor for points
  geom              BLOB,                       -- only for lines and polygons
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

-- Upsert that only writes when something changed:
--   INSERT INTO ev_event (...) VALUES (...)
--   ON CONFLICT (source_id, source_record_id) DO UPDATE SET
--     title = excluded.title, t_start = excluded.t_start, ..., rev = rev + 1, updated_at = excluded.ingested_at
--   WHERE title IS NOT excluded.title OR t_start IS NOT excluded.t_start OR ... OR attrs IS NOT excluded.attrs;

CREATE TRIGGER ev_event_ai AFTER INSERT ON ev_event WHEN NEW.x0 IS NOT NULL BEGIN
  INSERT INTO ev_event_rtree VALUES (NEW.event_id, NEW.x0, NEW.x1, NEW.y0, NEW.y1, NEW.t_lo, NEW.t_hi);
END;
-- Only revisions are history: an update that keeps rev (canonical_id, parent_id) would collide on (event_id, rev).
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
  spell      INTEGER NOT NULL DEFAULT 1,        -- COW side-switchers and second spells
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
  code         TEXT NOT NULL UNIQUE,            -- 'wdi:SP.DYN.LE00.IN', 'ucdp:bd_best', 'px:close', 'owid:le_0'
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

-- flags bits: 1 preliminary, 2 estimated, 4 imputed_by_source, 8 footnoted
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
  t          INTEGER NOT NULL DEFAULT -8640000000000000,   -- sentinel = applies to the whole series
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
  summary           TEXT,                       -- headline + summary only; never full article text
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
  storage_path  TEXT NOT NULL,                  -- data/media/ab/cd/<hex>
  origin_url    TEXT,
  licence_id    INTEGER,
  captured_at   INTEGER
) STRICT, WITHOUT ROWID;

CREATE TABLE agg_timeline_bin (
  layer      TEXT NOT NULL,                     -- same keys as meta_layer_version
  source_id  INTEGER NOT NULL,
  unit       TEXT NOT NULL CHECK (unit IN ('decade','year','month','day','hour')),
  bin        INTEGER NOT NULL,
  n          INTEGER NOT NULL,
  mag_sum    REAL,
  PRIMARY KEY (layer, unit, bin, source_id)
) STRICT, WITHOUT ROWID;

-- Extension tables (x_gtd_incident, x_icow_claim_year, x_wdi_series_meta) are created by their importers.


-- ═══════════════════════════════ geo/<layer>@<version>.db ═══════════════════════════════
-- One file per layer version; built by the importer, published by rename, read-only afterwards.

CREATE TABLE layer_meta (
  key    TEXT PRIMARY KEY,                      -- code, version, source, licence, tile_props, built_at
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
  geom              BLOB NOT NULL               -- canonical WKB, EPSG:4326
) STRICT;
CREATE INDEX feature_entity ON feature (entity_id);

-- Tile-ready pieces: zband 0 = z0-4, 1 = z5-7, 2 = z8-10, 3 = z11+ (full detail, subdivided).
CREATE TABLE feature_gen (
  gen_id      INTEGER PRIMARY KEY,
  feature_id  INTEGER NOT NULL REFERENCES feature,
  zband       INTEGER NOT NULL,
  part        INTEGER NOT NULL DEFAULT 0,
  geom        BLOB NOT NULL,                    -- WKB, simplified for the band, <= 256 vertices
  UNIQUE (feature_id, zband, part)
) STRICT;

CREATE VIRTUAL TABLE gen_rtree USING rtree(id, min_x, max_x, min_y, max_y, min_t, max_t, min_zb, max_zb);

-- Tile query:
--   SELECT f.feature_id, f.props, f.valid_lo, f.valid_hi, g.geom
--   FROM gen_rtree r JOIN feature_gen g ON g.gen_id = r.id JOIN feature f USING (feature_id)
--   WHERE r.min_x <= :e AND r.max_x >= :w AND r.min_y <= :n AND r.max_y >= :s
--     AND r.min_zb <= :zb AND r.max_zb >= :zb AND f.tier <= :maxTier;


-- ═══════════════════════════════ stream/YYYY-MM.db ═══════════════════════════════

CREATE TABLE ev_event_stream (
  stream_id    INTEGER PRIMARY KEY,
  t            INTEGER NOT NULL,
  t_hour       INTEGER NOT NULL,                -- t / 3600000
  kind_id      INTEGER NOT NULL,
  source_id    INTEGER NOT NULL,
  record_key   BLOB NOT NULL,                   -- 16-byte hash of source_record_id
  cell         INTEGER NOT NULL,                -- z14 Morton code; a tile at z <= 14 is one contiguous range
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
  z         INTEGER NOT NULL,                   -- aggregation zoom; cell = 64x64 grid inside a tile at z
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
  t          INTEGER NOT NULL,                  -- valid time
  kind       TEXT NOT NULL CHECK (kind IN ('forecast','analysis','observation','reanalysis')),
  issued_at  INTEGER NOT NULL,
  source_id  INTEGER NOT NULL,
  payload    BLOB NOT NULL,                     -- Float32 per variable per grid point
  PRIMARY KEY (grid_id, t, kind, issued_at)
) STRICT, WITHOUT ROWID;


-- ═══════════════════════════════ tracks/l{0,1,2}/….db ═══════════════════════════════
-- Written only by seal jobs: a bucket is replaced in one transaction (delete rows + rtree, insert).

CREATE TABLE shard_meta (
  key    TEXT PRIMARY KEY,                      -- lod, period, build_version, sealed_at
  value  TEXT NOT NULL
) STRICT, WITHOUT ROWID;

CREATE TABLE trk_segment (
  segment_id     INTEGER PRIMARY KEY,
  bucket         INTEGER NOT NULL,              -- bucket start, epoch ms
  entity_id      INTEGER NOT NULL,
  part           INTEGER NOT NULL DEFAULT 0,    -- pieces left by gap and antimeridian splits within one bucket
  class          INTEGER NOT NULL,              -- vessel, aircraft
  category       INTEGER NOT NULL,              -- military, cargo, tanker, commercial, private, …
  label          TEXT,
  source_mask    INTEGER NOT NULL,              -- bits from meta_source.track_bit
  t_first        INTEGER NOT NULL,
  t_last         INTEGER NOT NULL,
  n              INTEGER NOT NULL,
  points         BLOB NOT NULL,                 -- TRK1 (replay-database.md §8.3)
  flags          INTEGER NOT NULL DEFAULT 0,
  build_version  INTEGER NOT NULL,
  UNIQUE (bucket, entity_id, part)
) STRICT;
-- Coarser LODs are built one entity at a time from this; it also serves an entity's history.
CREATE INDEX trk_segment_entity ON trk_segment (entity_id, bucket, part);

-- R*Tree stores 32-bit floats: epoch ms round outward to ~2 min, so exact filters go on trk_segment.
CREATE VIRTUAL TABLE trk_segment_rtree USING rtree(id, min_x, max_x, min_y, max_y, min_t, max_t);

-- Chunk query (t_first..t_last in the R*Tree time dims):
--   SELECT s.entity_id, s.part, s.class, s.category, s.label, s.points
--   FROM trk_segment_rtree r JOIN trk_segment s ON s.segment_id = r.id
--   WHERE r.min_x <= :e AND r.max_x >= :w AND r.min_y <= :n AND r.max_y >= :s
--     AND r.min_t < :bucket_end AND r.max_t >= :bucket
--     AND s.bucket = :bucket AND s.class = :class AND (s.source_mask & ~:allowed) = 0
--   ORDER BY s.entity_id, s.part;

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


-- ═══════════════════════════════ tracks/tle.db ═══════════════════════════════

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

-- TLE set valid at T (cached per day):
--   SELECT norad_id, name, line1, line2 FROM (
--     SELECT *, row_number() OVER (PARTITION BY norad_id ORDER BY epoch DESC) AS rn
--     FROM trk_tle WHERE epoch <= :t AND epoch > :t - 30 * 86400000
--   ) WHERE rn = 1;


-- ═══════════════════════════════ cache.db (disposable) ═══════════════════════════════

CREATE TABLE kv (
  ns       TEXT NOT NULL,                       -- 'nominatim', 'flight-route', …
  key      TEXT NOT NULL,
  value    TEXT NOT NULL,
  expires  INTEGER NOT NULL,
  PRIMARY KEY (ns, key)
) STRICT, WITHOUT ROWID;
CREATE INDEX kv_expires ON kv (expires);
