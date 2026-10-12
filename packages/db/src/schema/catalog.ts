/*
 * catalog.db: sources, licences, shards, coverage, entities and identifiers, cameras.
 * Ported from docs/architecture/replay-schema.sqlite.sql; that file stays the readable overview.
 */
export const CATALOG: string[] = [
  `
  CREATE TABLE meta_licence (
    licence_id      INTEGER PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    url             TEXT,
    commercial_use  INTEGER,
    redistribution  TEXT NOT NULL CHECK (redistribution IN
                      ('none','display','attribution','share_alike','public_domain','unknown')),
    attribution     TEXT,
    verified_at     TEXT
  ) STRICT;

  CREATE TABLE meta_source (
    source_id         INTEGER PRIMARY KEY,
    code              TEXT NOT NULL UNIQUE,
    name              TEXT NOT NULL,
    owner             TEXT,
    url               TEXT,
    licence_id        INTEGER NOT NULL REFERENCES meta_licence,
    delivery          TEXT NOT NULL CHECK (delivery IN ('stream','poll','bulk','manual')),
    auth              TEXT,
    refresh_ms        INTEGER,
    event_table       TEXT CHECK (event_table IN ('event','stream')),
    track_bit         INTEGER UNIQUE CHECK (track_bit BETWEEN 0 AND 62),
    recording_since   INTEGER,
    config            TEXT NOT NULL DEFAULT '{}'
  ) STRICT;

  CREATE TABLE meta_dataset (
    dataset_id        INTEGER PRIMARY KEY,
    source_id         INTEGER NOT NULL REFERENCES meta_source,
    version           TEXT NOT NULL,
    as_of             INTEGER,
    files             TEXT NOT NULL,
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
    t_hi       INTEGER,
    status     TEXT NOT NULL CHECK (status IN ('ok','degraded','down','not_recording')),
    note       TEXT,
    PRIMARY KEY (source_id, t_lo)
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE meta_layer_version (
    layer       TEXT PRIMARY KEY,
    version     INTEGER NOT NULL DEFAULT 1,
    changed_at  INTEGER NOT NULL
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE meta_access_policy (
    tier        TEXT NOT NULL,
    licence_id  INTEGER NOT NULL REFERENCES meta_licence,
    can_view    INTEGER NOT NULL,
    can_export  INTEGER NOT NULL,
    PRIMARY KEY (tier, licence_id)
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE meta_shard (
    path        TEXT PRIMARY KEY,
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

  -- One row per sealed bucket; which hours replay can serve, and from which build.
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
    code     TEXT NOT NULL UNIQUE
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
    code       TEXT NOT NULL UNIQUE
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

  CREATE TABLE core_entity_name (
    name_id    INTEGER PRIMARY KEY,
    entity_id  INTEGER NOT NULL REFERENCES core_entity ON DELETE CASCADE,
    name       TEXT NOT NULL,
    norm       TEXT NOT NULL,
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
    code    TEXT NOT NULL UNIQUE
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
    code        TEXT NOT NULL UNIQUE,
    source_id   INTEGER NOT NULL REFERENCES meta_source,
    file        TEXT NOT NULL,
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
    pattern   TEXT PRIMARY KEY,
    reason    TEXT NOT NULL,
    added_at  INTEGER NOT NULL
  ) STRICT, WITHOUT ROWID;

  CREATE TABLE cam_tombstone (
    media_key   TEXT PRIMARY KEY,
    entity_id   INTEGER,
    removed_at  INTEGER NOT NULL,
    reason      TEXT
  ) STRICT, WITHOUT ROWID;
  `,
  // Reference rows. Codes are what code looks up; ids are fixed so track bits and joins stay stable.
  `
  INSERT INTO core_entity_type (type_id, code) VALUES
    (1,'vessel'),(2,'aircraft'),(3,'satellite'),(4,'camera'),(5,'airport'),(6,'port'),(7,'facility'),
    (8,'heritage_site'),(9,'waterbody'),(10,'polity'),(11,'region_group'),(12,'org'),(13,'instrument'),
    (14,'person_public'),(15,'settlement');

  INSERT INTO core_id_scheme (scheme_id, code) VALUES
    (1,'mmsi'),(2,'imo'),(3,'icao24'),(4,'registration'),(5,'callsign'),(6,'norad'),(7,'iata'),(8,'icao'),
    (9,'wikidata'),(10,'osm'),(11,'iso3'),(12,'iso2'),(13,'isonum'),(14,'wb'),(15,'cow'),(16,'gw'),(17,'gtd'),
    (18,'owid'),(19,'ucdp_actor'),(20,'wac'),(21,'ticker'),(22,'iso4217');

  INSERT INTO core_link_rel (rel_id, code) VALUES
    (1,'part_of'),(2,'located_in'),(3,'operates'),(4,'successor_of'),(5,'same_as'),(6,'feeds'),(7,'connects'),(8,'serves');

  -- commercial_use NULL = unverified. Every terms check is still open (TODO.md §1, replay-database.md §14).
  INSERT INTO meta_licence (licence_id, code, name, url, commercial_use, redistribution, attribution) VALUES
    (1, 'aisstream-terms', 'aisstream.io terms of use', 'https://aisstream.io', NULL, 'unknown', 'AIS data: aisstream.io'),
    -- Research and non-commercial use; redistribution restricted. Needs written permission for a paid tier.
    (2, 'opensky-terms', 'OpenSky Network terms of use', 'https://opensky-network.org/about/terms-of-use', 0, 'none', 'The OpenSky Network, https://opensky-network.org'),
    (3, 'adsbfi-terms', 'adsb.fi open data terms', 'https://adsb.fi', NULL, 'unknown', 'adsb.fi'),
    -- Derived from Space-Track GP data, whose user agreement limits redistribution.
    (4, 'celestrak-terms', 'CelesTrak / Space-Track GP data', 'https://celestrak.org', NULL, 'unknown', 'Orbital data: CelesTrak'),
    (5, 'satnogs-cc-by-sa', 'SatNOGS DB (CC BY-SA 4.0)', 'https://db.satnogs.org', 1, 'share_alike', 'SatNOGS DB, CC BY-SA 4.0'),
    -- Per-camera publisher terms; several need permission (CCTV-handoff.md, feeds.ts comments).
    (6, 'cctv-mixed', 'Camera publishers (mixed terms)', NULL, NULL, 'unknown', 'Camera images: their publishers'),
    (7, 'public-domain', 'Public domain', NULL, 1, 'public_domain', NULL);

  INSERT INTO meta_source (source_id, code, name, owner, url, licence_id, delivery, refresh_ms, track_bit) VALUES
    (1, 'aisstream', 'aisstream.io AIS stream', 'aisstream.io', 'wss://stream.aisstream.io/v0/stream', 1, 'stream', NULL, 0),
    (2, 'opensky', 'OpenSky Network state vectors', 'OpenSky Network', 'https://opensky-network.org/api/states/all', 2, 'poll', 90000, 1),
    (3, 'adsbfi', 'adsb.fi open data', 'adsb.fi', 'https://opendata.adsb.fi/api/v2', 3, 'poll', 90000, 2),
    (4, 'celestrak', 'CelesTrak GP element sets', 'CelesTrak', 'https://celestrak.org/NORAD/elements/', 4, 'poll', 3600000, NULL),
    (5, 'satnogs', 'SatNOGS DB TLEs', 'Libre Space Foundation', 'https://db.satnogs.org/api/tle/', 5, 'poll', 3600000, NULL),
    (6, 'cctv', 'Camera catalogue (all regions)', NULL, NULL, 6, 'poll', 1800000, NULL);

  -- Every tier may view every source until each licence is verified; exports stay off.
  -- Gating is by row: set can_view = 0 for a tier and the API stops serving that source to it.
  INSERT INTO meta_access_policy (tier, licence_id, can_view, can_export)
    SELECT tier.value, licence_id, 1, 0 FROM meta_licence, json_each('["anon","free","paid","internal"]') AS tier;
  `,
  // Operator switches, edited from the admin console's Sources page.
  // record: the recorder writes the raw archive. build: the seal jobs derive history from it.
  `
  ALTER TABLE meta_source ADD COLUMN record INTEGER NOT NULL DEFAULT 1 CHECK (record IN (0, 1));
  ALTER TABLE meta_source ADD COLUMN build INTEGER NOT NULL DEFAULT 1 CHECK (build IN (0, 1));
  ALTER TABLE meta_source ADD COLUMN switched_at INTEGER;
  ALTER TABLE meta_source ADD COLUMN switched_by TEXT;
  `,
  // adsb.lol: readsb-shaped like adsb.fi, published under ODbL. No fixed ids: importers also add licences and sources.
  `
  INSERT INTO meta_licence (code, name, url, commercial_use, redistribution, attribution)
  VALUES ('adsblol-odbl', 'adsb.lol data (ODbL 1.0)', 'https://www.adsb.lol/docs/open-data/api/', 1, 'share_alike', 'adsb.lol, ODbL 1.0')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO meta_source (code, name, owner, url, licence_id, delivery, refresh_ms, track_bit)
    SELECT 'adsblol', 'adsb.lol open data', 'adsb.lol', 'https://api.adsb.lol/v2', licence_id, 'poll', 240000, 3
    FROM meta_licence WHERE code = 'adsblol-odbl'
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO meta_access_policy (tier, licence_id, can_view, can_export)
    SELECT tier.value, licence_id, 1, 0 FROM meta_licence, json_each('["anon","free","paid","internal"]') AS tier
    WHERE code = 'adsblol-odbl'
  ON CONFLICT DO NOTHING;
  `,
  // adsb.lol's daily history dumps (GitHub releases, ODbL): backfill, not live, with its own track bit.
  `
  INSERT INTO meta_source (code, name, owner, url, licence_id, delivery, track_bit)
    SELECT 'adsblol-history', 'adsb.lol daily history', 'adsb.lol', 'https://github.com/adsblol', licence_id, 'bulk', 4
    FROM meta_licence WHERE code = 'adsblol-odbl'
  ON CONFLICT (code) DO NOTHING;
  `,
  // USGS earthquakes (US federal work, public domain): the worker polls the M2.5+ feed into history.db events.
  `
  INSERT INTO meta_source (code, name, owner, url, licence_id, delivery, refresh_ms, event_table)
    SELECT 'usgs', 'USGS earthquake catalogue', 'U.S. Geological Survey', 'https://earthquake.usgs.gov/fdsnws/event/1/',
      licence_id, 'poll', 600000, 'event'
    FROM meta_licence WHERE code = 'public-domain'
  ON CONFLICT (code) DO NOTHING;
  `,
];
