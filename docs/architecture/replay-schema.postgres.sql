-- Migration target, not the schema in use: SQLite comes first (replay-schema.sqlite.sql).
-- PostgreSQL 17 + PostGIS 3.5 + TimescaleDB 2.x. Mapping rules: replay-database.md §11.
-- When migrating: ms INTEGER -> timestamptz; *_lo/*_hi -> tstzrange; WKB -> geometry; source_mask -> sources[];
-- trk.position is optional here: segments are built from the raw archive, as in the SQLite design.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

CREATE SCHEMA meta;
CREATE SCHEMA core;
CREATE SCHEMA geo;
CREATE SCHEMA ev;
CREATE SCHEMA trk;
CREATE SCHEMA ts;
CREATE SCHEMA cam;
CREATE SCHEMA doc;
CREATE SCHEMA agg;
CREATE SCHEMA stage;

-- Precision: 0 unknown, 1 millennium, 2 century, 3 decade, 4 year, 5 month, 6 day, 7 hour, 8 minute, 9 second.
-- Geo precision: 0 none, 1 exact, 2 facility, 3 city, 4 area, 5 country, 6 approximate.

CREATE FUNCTION core.norm(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, $1)) $$;

-- ───────────────────────────── meta ─────────────────────────────

CREATE TABLE meta.licence (
  licence_id      smallint PRIMARY KEY,
  code            text NOT NULL UNIQUE,
  name            text NOT NULL,
  url             text,
  commercial_use  boolean,                      -- null = unverified
  redistribution  text NOT NULL CHECK (redistribution IN
                    ('none','display','attribution','share_alike','public_domain','unknown')),
  attribution     text,
  verified_at     date
);

CREATE TABLE meta.source (
  source_id         smallint PRIMARY KEY,
  code              text NOT NULL UNIQUE,       -- 'aisstream', 'opensky', 'gtd', 'cow-interstate', 'wdi'
  name              text NOT NULL,
  owner             text,
  url               text,
  licence_id        smallint NOT NULL REFERENCES meta.licence,
  delivery          text NOT NULL CHECK (delivery IN ('stream','poll','bulk','manual')),
  auth              text,
  refresh_interval  interval,
  event_table       text CHECK (event_table IN ('event','stream')),
  recording_since   timestamptz,
  config            jsonb NOT NULL DEFAULT '{}',
  record            boolean NOT NULL DEFAULT true,   -- admin switches (replay-database.md §7.6)
  build             boolean NOT NULL DEFAULT true,
  switched_at       timestamptz,
  switched_by       text
);

CREATE TABLE meta.dataset (
  dataset_id        int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id         smallint NOT NULL REFERENCES meta.source,
  version           text NOT NULL,
  as_of             date,
  files             jsonb NOT NULL,             -- [{path, sha256, bytes, rows}]
  licence_id        smallint REFERENCES meta.licence,
  temporal_extent   tstzrange,
  importer_version  text NOT NULL,
  status            text NOT NULL DEFAULT 'loading'
                      CHECK (status IN ('loading','active','superseded','failed')),
  report            jsonb,
  imported_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, version)
);
CREATE UNIQUE INDEX dataset_one_active ON meta.dataset (source_id) WHERE status = 'active';

CREATE TABLE meta.dataset_gap (
  dataset_id  int NOT NULL REFERENCES meta.dataset ON DELETE CASCADE,
  period      tstzrange NOT NULL,
  region      geometry(MultiPolygon, 4326),
  kind        text NOT NULL CHECK (kind IN ('missing','partial','preliminary')),
  note        text
);

CREATE TABLE meta.ingest_run (
  run_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id    smallint NOT NULL REFERENCES meta.source,
  started_at   timestamptz NOT NULL,
  finished_at  timestamptz,
  status       text NOT NULL CHECK (status IN ('running','ok','partial','failed','short')),
  records      int, inserted int, changed int, bytes bigint,
  archive_ref  text,
  error        text
);
CREATE INDEX ON meta.ingest_run (source_id, started_at DESC);

CREATE TABLE meta.coverage (
  source_id  smallint NOT NULL REFERENCES meta.source,
  period     tstzrange NOT NULL,
  status     text NOT NULL CHECK (status IN ('ok','degraded','down','not_recording')),
  note       text,
  EXCLUDE USING gist (source_id WITH =, period WITH &&)
);

CREATE TABLE meta.layer_version (
  layer       text PRIMARY KEY,                 -- 'tracks:vessel', 'events:conflict', 'geo:dams'
  version     int NOT NULL DEFAULT 1,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE meta.access_policy (
  tier        text NOT NULL,                    -- 'anon','free','paid','internal'
  licence_id  smallint NOT NULL REFERENCES meta.licence,
  can_view    boolean NOT NULL,
  can_export  boolean NOT NULL,
  PRIMARY KEY (tier, licence_id)
);

CREATE FUNCTION meta.allowed_sources(p_tier text) RETURNS TABLE (source_id smallint)
  LANGUAGE sql STABLE AS $$
  SELECT s.source_id FROM meta.source s
  JOIN meta.access_policy p ON p.licence_id = s.licence_id AND p.tier = p_tier
  WHERE p.can_view
$$;

-- ───────────────────────────── core ─────────────────────────────

CREATE TABLE core.entity_type (
  type_id  smallint PRIMARY KEY,
  code     text NOT NULL UNIQUE                 -- vessel, aircraft, satellite, camera, airport, port, facility,
                                                -- heritage_site, waterbody, polity, region_group, org,
                                                -- instrument, person_public, settlement
);

CREATE TABLE core.entity (
  entity_id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type_id              smallint NOT NULL REFERENCES core.entity_type,
  name                 text,
  anchor               geometry(Point, 4326),
  first_seen           timestamptz,
  last_seen            timestamptz,
  identity_confidence  real NOT NULL DEFAULT 1,
  attrs                jsonb NOT NULL DEFAULT '{}',
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON core.entity (type_id);
CREATE INDEX ON core.entity USING gist (anchor);

CREATE TABLE core.id_scheme (
  scheme_id  smallint PRIMARY KEY,
  code       text NOT NULL UNIQUE               -- mmsi, imo, icao24, registration, callsign, norad, iata, icao,
                                                -- wikidata, osm, iso3, iso2, isonum, wb, cow, gw, gtd, owid,
                                                -- ucdp_actor, wac, native:<source>
);

CREATE TABLE core.entity_identifier (
  scheme_id   smallint NOT NULL REFERENCES core.id_scheme,
  value       text NOT NULL,
  entity_id   bigint NOT NULL REFERENCES core.entity,
  valid       tstzrange NOT NULL DEFAULT '(,)',
  source_id   smallint REFERENCES meta.source,
  confidence  real NOT NULL DEFAULT 1,
  EXCLUDE USING gist (scheme_id WITH =, value WITH =, valid WITH &&)
);
CREATE INDEX ON core.entity_identifier (entity_id);

CREATE FUNCTION core.resolve(p_scheme text, p_value text, p_at timestamptz) RETURNS bigint
  LANGUAGE sql STABLE AS $$
  SELECT i.entity_id FROM core.entity_identifier i
  JOIN core.id_scheme s USING (scheme_id)
  WHERE s.code = p_scheme AND i.value = p_value AND i.valid @> p_at
$$;

CREATE TABLE core.entity_name (
  entity_id  bigint NOT NULL REFERENCES core.entity ON DELETE CASCADE,
  name       text NOT NULL,
  norm       text GENERATED ALWAYS AS (core.norm(name)) STORED,
  lang       text,
  kind       text NOT NULL DEFAULT 'alias' CHECK (kind IN ('official','short','alias','historical')),
  valid      tstzrange NOT NULL DEFAULT '(,)',
  source_id  smallint REFERENCES meta.source
);
CREATE INDEX ON core.entity_name USING gin (norm gin_trgm_ops);
CREATE INDEX ON core.entity_name (norm);

CREATE TABLE core.entity_version (
  entity_id   bigint NOT NULL REFERENCES core.entity ON DELETE CASCADE,
  valid       tstzrange NOT NULL,
  geom        geometry(Geometry, 4326),
  attrs       jsonb NOT NULL,
  attrs_hash  bytea NOT NULL,
  source_id   smallint REFERENCES meta.source,
  run_id      bigint,
  EXCLUDE USING gist (entity_id WITH =, valid WITH &&)
);
CREATE INDEX entity_version_current ON core.entity_version (entity_id) WHERE upper_inf(valid);

CREATE TABLE core.link_rel (
  rel_id  smallint PRIMARY KEY,
  code    text NOT NULL UNIQUE                  -- part_of, located_in, operates, successor_of, same_as,
                                                -- feeds, connects, serves
);

CREATE TABLE core.entity_link (
  from_id     bigint NOT NULL REFERENCES core.entity,
  rel_id      smallint NOT NULL REFERENCES core.link_rel,
  to_id       bigint NOT NULL REFERENCES core.entity,
  valid       tstzrange NOT NULL DEFAULT '(,)',
  confidence  real NOT NULL DEFAULT 1,
  source_id   smallint REFERENCES meta.source,
  EXCLUDE USING gist (from_id WITH =, rel_id WITH =, to_id WITH =, valid WITH &&)
);
CREATE INDEX ON core.entity_link (to_id, rel_id);

CREATE TABLE core.polity (
  entity_id  bigint PRIMARY KEY REFERENCES core.entity,
  kind       text NOT NULL CHECK (kind IN ('sovereign','historical','dependency','subnational','disputed')),
  valid      tstzrange NOT NULL DEFAULT '(,)'
);

-- How a polity is drawn on the borders layer valid at the same time (USSR → 15 successor shapes).
CREATE TABLE core.polity_render (
  polity_id         bigint NOT NULL REFERENCES core.polity,
  render_polity_id  bigint NOT NULL REFERENCES core.polity,
  valid             tstzrange NOT NULL DEFAULT '(,)',
  PRIMARY KEY (polity_id, render_polity_id)
);

CREATE TABLE core.region_member (
  group_id   bigint NOT NULL REFERENCES core.entity,
  member_id  bigint NOT NULL REFERENCES core.entity,
  valid      tstzrange NOT NULL DEFAULT '(,)',
  source_id  smallint REFERENCES meta.source,
  PRIMARY KEY (group_id, member_id, source_id)
);

-- ───────────────────────────── geo ─────────────────────────────

CREATE TABLE geo.layer (
  layer_id     smallint PRIMARY KEY,
  code         text NOT NULL UNIQUE,            -- 'admin0', 'dams', 'glwd-lakes', 'unesco-whc', 'highway-planning'
  source_id    smallint NOT NULL REFERENCES meta.source,
  geom_kind    text NOT NULL CHECK (geom_kind IN ('point','line','polygon','mixed')),
  minzoom      smallint NOT NULL DEFAULT 0,
  maxzoom      smallint NOT NULL DEFAULT 14,
  time_mode    text NOT NULL DEFAULT 'static' CHECK (time_mode IN ('static','valid')),
  tile_props   text[] NOT NULL DEFAULT '{}',    -- props copied into MVT; everything else is fetched on click
  style        jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE geo.feature (
  layer_id    smallint NOT NULL,
  feature_id  bigint NOT NULL,
  entity_id   bigint,
  source_record_id text,
  valid       tstzrange NOT NULL DEFAULT '(,)',
  t_prec      smallint NOT NULL DEFAULT 0,
  tier        smallint NOT NULL DEFAULT 0,      -- zoom tier: 0 = shown from minzoom, higher = needs more zoom
  props       jsonb NOT NULL DEFAULT '{}',
  geom        geometry(Geometry, 4326) NOT NULL,
  geom_3857   geometry(Geometry, 3857) GENERATED ALWAYS AS (ST_Transform(geom, 3857)) STORED,
  PRIMARY KEY (layer_id, feature_id)
) PARTITION BY LIST (layer_id);
CREATE INDEX ON geo.feature USING gist (geom_3857);
CREATE INDEX ON geo.feature (entity_id);
-- Importers create one partition per layer: CREATE TABLE geo.feature_12 PARTITION OF geo.feature FOR VALUES IN (12);

CREATE TABLE geo.feature_gen (
  layer_id    smallint NOT NULL,
  zband       smallint NOT NULL,                -- 0: z0-4, 1: z5-7, 2: z8-10; z11+ uses geo.feature
  feature_id  bigint NOT NULL,
  part        smallint NOT NULL DEFAULT 0,      -- ST_Subdivide piece
  geom_3857   geometry(Geometry, 3857) NOT NULL,
  PRIMARY KEY (layer_id, zband, feature_id, part)
) PARTITION BY LIST (layer_id);
CREATE INDEX ON geo.feature_gen USING gist (geom_3857);

-- ───────────────────────────── ev ─────────────────────────────

CREATE TABLE ev.kind (
  kind_id    smallint PRIMARY KEY,
  code       text NOT NULL UNIQUE,              -- war.interstate, conflict.armed, battle, attack.terror,
                                                -- claim.territorial, change.territorial, econ.tariff,
                                                -- hazard.quake, hazard.fire, hazard.storm, alert.weather,
                                                -- outage.internet, cyber.c2, news.report, gdelt.event
  family     text NOT NULL,                     -- conflict, violence, political, economic, hazard, cyber, news
  parent_id  smallint REFERENCES ev.kind,
  style      jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE ev.role (
  role_id  smallint PRIMARY KEY,
  code     text NOT NULL UNIQUE                 -- participant, side_a, side_b, supporter, initiator, location,
                                                -- perpetrator, target, target_nationality, gaining, losing,
                                                -- imposing, targeted, claimant, subject
);

CREATE TABLE ev.event (
  event_id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind_id           smallint NOT NULL REFERENCES ev.kind,
  source_id         smallint NOT NULL REFERENCES meta.source,
  dataset_id        int REFERENCES meta.dataset,
  source_record_id  text NOT NULL,
  canonical_id      bigint,                     -- representative of a same_as cluster; self if none
  parent_id         bigint REFERENCES ev.event,
  title             text,
  t_start           timestamptz NOT NULL,
  t_end             timestamptz,
  t_start_prec      smallint NOT NULL,
  t_end_prec        smallint,
  ongoing           boolean NOT NULL DEFAULT false,
  t_lo              timestamptz NOT NULL,       -- expanded by precision, as in SQLite
  t_hi              timestamptz,                -- null when ongoing
  period            tstzrange GENERATED ALWAYS AS (tstzrange(t_lo, t_hi, '[]')) STORED,
  geom              geometry(Geometry, 4326),
  anchor            geometry(Point, 4326),
  geo_prec          smallint NOT NULL DEFAULT 0,
  magnitude         real,                       -- kind-specific headline number: deaths, Mw, FRP
  severity          real,                       -- 0..1, normalised per kind for styling and aggregation
  confidence        real NOT NULL DEFAULT 1,
  attrs             jsonb NOT NULL DEFAULT '{}',
  rev               int NOT NULL DEFAULT 1,
  retracted_at      timestamptz,
  ingested_at       timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, source_record_id)
);
CREATE INDEX ON ev.event USING gist (period, anchor);
CREATE INDEX ON ev.event (kind_id, t_start);
CREATE INDEX ON ev.event (canonical_id);
CREATE INDEX ON ev.event (parent_id);

CREATE TABLE ev.event_history (
  event_id     bigint NOT NULL,
  rev          int NOT NULL,
  replaced_at  timestamptz NOT NULL DEFAULT now(),
  row_data     jsonb NOT NULL,
  PRIMARY KEY (event_id, rev)
);

CREATE FUNCTION ev.keep_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- period is generated, so it is still null in NEW here
  IF (to_jsonb(NEW) - '{rev,updated_at,ingested_at,period}'::text[])
     = (to_jsonb(OLD) - '{rev,updated_at,ingested_at,period}'::text[]) THEN
    RETURN NULL;                                -- unchanged re-ingest: skip the write
  END IF;
  INSERT INTO ev.event_history (event_id, rev, row_data) VALUES (OLD.event_id, OLD.rev, to_jsonb(OLD));
  NEW.rev := OLD.rev + 1;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER event_history BEFORE UPDATE ON ev.event FOR EACH ROW EXECUTE FUNCTION ev.keep_history();

CREATE TABLE ev.event_entity (
  event_id   bigint NOT NULL REFERENCES ev.event ON DELETE CASCADE,
  entity_id  bigint NOT NULL REFERENCES core.entity,
  role_id    smallint NOT NULL REFERENCES ev.role,
  side       smallint NOT NULL DEFAULT 0,
  spell      smallint NOT NULL DEFAULT 1,       -- COW side-switchers and second spells
  period     tstzrange,
  attrs      jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (event_id, entity_id, role_id, side, spell)
);
CREATE INDEX ON ev.event_entity (entity_id, role_id);

CREATE TABLE ev.event_relation (
  from_id     bigint NOT NULL REFERENCES ev.event ON DELETE CASCADE,
  rel         text NOT NULL CHECK (rel IN ('part_of','same_as','follows','related')),
  to_id       bigint NOT NULL REFERENCES ev.event ON DELETE CASCADE,
  confidence  real NOT NULL DEFAULT 1,
  source_id   smallint REFERENCES meta.source,
  PRIMARY KEY (from_id, rel, to_id)
);
CREATE INDEX ON ev.event_relation (to_id, rel);

-- Immutable, instant, high-volume: FIRMS, GDELT, geolocated news.
CREATE TABLE ev.event_stream (
  t            timestamptz NOT NULL,
  kind_id      smallint NOT NULL,
  source_id    smallint NOT NULL,
  record_key   bytea NOT NULL,                  -- 16-byte hash of source_record_id
  cell         int NOT NULL,                    -- z12 Morton code of (lon, lat); tiles are contiguous ranges
  lon          real,
  lat          real,
  geom         geometry(Geometry, 4326),        -- only for non-point records
  geo_prec     smallint NOT NULL DEFAULT 1,
  magnitude    real,
  severity     real,
  title        text,
  entity_id    bigint,
  doc_id       bigint,
  attrs        jsonb,
  ingested_at  timestamptz NOT NULL DEFAULT now()
);
SELECT create_hypertable('ev.event_stream', by_range('t', INTERVAL '7 days'));
CREATE INDEX ON ev.event_stream (source_id, record_key, t);
ALTER TABLE ev.event_stream SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'kind_id',
  timescaledb.compress_orderby   = 'cell, t'
);
SELECT add_compression_policy('ev.event_stream', INTERVAL '7 days');

CREATE VIEW ev.v_event AS
  SELECT event_id, kind_id, source_id, t_start, t_end, t_start_prec, ongoing, period,
         coalesce(anchor, ST_PointOnSurface(geom)) AS anchor, geo_prec, magnitude, severity, title, canonical_id
  FROM ev.event WHERE retracted_at IS NULL
  UNION ALL
  SELECT NULL, kind_id, source_id, t, NULL, 9, false, tstzrange(t, t, '[]'),
         ST_SetSRID(ST_MakePoint(lon, lat), 4326), geo_prec, magnitude, severity, title, NULL
  FROM ev.event_stream;

-- ───────────────────────────── trk ─────────────────────────────

-- flags bits: 1 on_ground, 2 t_is_receive, 4 interpolated_by_source, 8 emergency, 16 position_doubtful
CREATE TABLE trk.position (
  t          timestamptz NOT NULL,
  entity_id  bigint NOT NULL,
  source_id  smallint NOT NULL,
  lon        real NOT NULL,
  lat        real NOT NULL,
  alt        real,
  speed      real,
  course     real,
  heading    real,
  vrate      real,
  flags      smallint NOT NULL DEFAULT 0,
  lag_ms     int
);
SELECT create_hypertable('trk.position', by_range('t', INTERVAL '1 day'));
CREATE INDEX ON trk.position (entity_id, t DESC);
ALTER TABLE trk.position SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'entity_id',
  timescaledb.compress_orderby   = 't'
);
SELECT add_compression_policy('trk.position', INTERVAL '2 days');
SELECT add_retention_policy('trk.position', INTERVAL '14 days');

-- Slow-changing per-track state: callsign, squawk, destination, nav status, category.
CREATE TABLE trk.state (
  entity_id    bigint NOT NULL,
  valid        tstzrange NOT NULL,
  callsign     text,
  squawk       text,
  destination  text,
  nav_status   smallint,
  category     smallint,
  attrs        jsonb,
  source_id    smallint NOT NULL,
  EXCLUDE USING gist (entity_id WITH =, valid WITH &&)
);

-- Points are TRK1 blobs (replay-database.md §8.3), served as-is.
CREATE TABLE trk.segment_l0 (
  bucket         timestamptz NOT NULL,
  entity_id      bigint NOT NULL,
  part           smallint NOT NULL DEFAULT 0,   -- pieces left by gap and antimeridian splits
  class          smallint NOT NULL,             -- vessel, aircraft
  category       smallint NOT NULL,             -- military, cargo, tanker, commercial, private, …
  label          text,
  sources        smallint[] NOT NULL,           -- every source that contributed a fix; gating uses sources <@ allowed
  t_first        timestamptz NOT NULL,
  t_last         timestamptz NOT NULL,
  n              int NOT NULL,
  bbox           geometry(Polygon, 3857) NOT NULL,
  points         bytea NOT NULL,
  flags          smallint NOT NULL DEFAULT 0,
  build_version  smallint NOT NULL,
  PRIMARY KEY (bucket, entity_id, part)
);
CREATE TABLE trk.segment_l1 (LIKE trk.segment_l0 INCLUDING ALL);
CREATE TABLE trk.segment_l2 (LIKE trk.segment_l0 INCLUDING ALL);
SELECT create_hypertable('trk.segment_l0', by_range('bucket', INTERVAL '1 day'));
SELECT create_hypertable('trk.segment_l1', by_range('bucket', INTERVAL '7 days'));
SELECT create_hypertable('trk.segment_l2', by_range('bucket', INTERVAL '30 days'));
CREATE INDEX ON trk.segment_l0 USING gist (bbox);
CREATE INDEX ON trk.segment_l1 USING gist (bbox);
CREATE INDEX ON trk.segment_l2 USING gist (bbox);
SELECT add_retention_policy('trk.segment_l0', INTERVAL '14 days');
SELECT add_retention_policy('trk.segment_l1', INTERVAL '90 days');

CREATE TABLE trk.dirty_bucket (
  lod        smallint NOT NULL,
  bucket     timestamptz NOT NULL,
  reason     text NOT NULL,
  queued_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lod, bucket)
);

CREATE TABLE trk.tle (
  norad_id    int NOT NULL,
  epoch       timestamptz NOT NULL,
  line1       text NOT NULL,
  line2       text NOT NULL,
  name        text,
  source_id   smallint NOT NULL,
  fetched_at  timestamptz NOT NULL,
  PRIMARY KEY (norad_id, epoch)
);

-- ───────────────────────────── ts ─────────────────────────────

CREATE TABLE ts.metric (
  metric_id    int PRIMARY KEY,
  code         text NOT NULL UNIQUE,            -- 'wdi:SP.DYN.LE00.IN', 'ucdp:bd_best', 'px:close', 'owid:le_birth'
  name         text NOT NULL,
  unit         text,
  granularity  text NOT NULL CHECK (granularity IN ('year','month','day','hour','minute','irregular')),
  agg          text NOT NULL DEFAULT 'mean' CHECK (agg IN ('sum','mean','last','max','min')),
  topic        text,
  attrs        jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE ts.series (
  series_id     int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  metric_id     int NOT NULL REFERENCES ts.metric,
  subject_type  text NOT NULL CHECK (subject_type IN ('entity','event')),
  subject_id    bigint NOT NULL,
  source_id     smallint NOT NULL REFERENCES meta.source,
  dataset_id    int REFERENCES meta.dataset,
  attrs         jsonb NOT NULL DEFAULT '{}',
  UNIQUE (metric_id, subject_type, subject_id, source_id)
);

-- flags bits: 1 preliminary, 2 estimated, 4 imputed_by_source, 8 footnoted
CREATE TABLE ts.point (
  series_id  int NOT NULL REFERENCES ts.series,
  t          timestamptz NOT NULL,
  v          double precision,
  t_prec     smallint NOT NULL DEFAULT 4,
  flags      smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (series_id, t)
) WITH (fillfactor = 100);

CREATE TABLE ts.point_hf (
  series_id  int NOT NULL,
  t          timestamptz NOT NULL,
  v          double precision,
  flags      smallint NOT NULL DEFAULT 0
);
SELECT create_hypertable('ts.point_hf', by_range('t', INTERVAL '7 days'));
CREATE UNIQUE INDEX ON ts.point_hf (series_id, t);
ALTER TABLE ts.point_hf SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'series_id',
  timescaledb.compress_orderby   = 't'
);
SELECT add_compression_policy('ts.point_hf', INTERVAL '7 days');

CREATE TABLE ts.note (
  note_id  int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  hash     bytea NOT NULL UNIQUE,
  text     text NOT NULL
);

CREATE TABLE ts.point_note (
  series_id  int NOT NULL,
  t          timestamptz,                       -- null = applies to the whole series
  note_id    int NOT NULL REFERENCES ts.note
);
CREATE INDEX ON ts.point_note (series_id, t);

CREATE TABLE ts.grid_frame (
  grid_id    smallint NOT NULL,
  t          timestamptz NOT NULL,              -- valid time
  kind       text NOT NULL CHECK (kind IN ('forecast','analysis','observation','reanalysis')),
  issued_at  timestamptz NOT NULL,
  source_id  smallint NOT NULL,
  payload    bytea NOT NULL,                    -- Float32 per variable per grid point
  PRIMARY KEY (grid_id, t, kind, issued_at)
);

-- ───────────────────────────── cam ─────────────────────────────

CREATE TABLE cam.camera_version (
  version_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id     bigint NOT NULL REFERENCES core.entity,
  source_id     smallint NOT NULL REFERENCES meta.source,
  native_id     text NOT NULL,
  valid         tstzrange NOT NULL,
  lon           double precision NOT NULL,
  lat           double precision NOT NULL,
  geom_3857     geometry(Point, 3857) GENERATED ALWAYS AS
                  (ST_Transform(ST_SetSRID(ST_MakePoint(lon, lat), 4326), 3857)) STORED,
  name          text,
  city          text,
  country       text,
  feed_url      text,
  stream_url    text,
  stream_type   text,
  external_url  text,
  hash          bytea NOT NULL,
  run_id        bigint,
  EXCLUDE USING gist (entity_id WITH =, valid WITH &&)
);
CREATE INDEX camera_current ON cam.camera_version USING gist (geom_3857) WHERE upper_inf(valid);
CREATE INDEX ON cam.camera_version USING gist (geom_3857, valid);
CREATE UNIQUE INDEX ON cam.camera_version (source_id, native_id) WHERE upper_inf(valid);

CREATE TABLE cam.blocklist (
  pattern  text PRIMARY KEY,                    -- host, URL prefix or (source, native_id)
  reason   text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cam.tombstone (
  media_key   text PRIMARY KEY,
  entity_id   bigint,
  removed_at  timestamptz NOT NULL,
  reason      text
);

-- ───────────────────────────── doc ─────────────────────────────

CREATE TABLE doc.document (
  doc_id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind              text NOT NULL CHECK (kind IN ('article','post','report','citation','photo','video','dataset_note')),
  source_id         smallint NOT NULL REFERENCES meta.source,
  dataset_id        int REFERENCES meta.dataset,
  source_record_id  text NOT NULL,
  url               text,
  title             text,
  summary           text,                       -- headline + summary only; never full text of articles
  lang              text,
  published_at      timestamptz,
  retrieved_at      timestamptz NOT NULL,
  media_sha256      bytea,
  attrs             jsonb NOT NULL DEFAULT '{}',
  tsv               tsvector GENERATED ALWAYS AS (
                      to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, ''))
                    ) STORED,
  UNIQUE (source_id, source_record_id)
);
CREATE INDEX ON doc.document USING gin (tsv);
CREATE INDEX ON doc.document (published_at);

CREATE TABLE doc.document_link (
  doc_id       bigint NOT NULL REFERENCES doc.document ON DELETE CASCADE,
  target_type  text NOT NULL CHECK (target_type IN ('event','entity','feature','series')),
  target_id    bigint NOT NULL,
  role         text NOT NULL CHECK (role IN ('reports','depicts','cites','source_of','mentions')),
  confidence   real NOT NULL DEFAULT 1,
  PRIMARY KEY (doc_id, target_type, target_id, role)
);
CREATE INDEX ON doc.document_link (target_type, target_id);

CREATE TABLE doc.media_object (
  sha256        bytea PRIMARY KEY,
  mime          text NOT NULL,
  bytes         bigint NOT NULL,
  width         int,
  height        int,
  storage_path  text NOT NULL,                  -- data/media/ab/cd/<hex>
  origin_url    text,
  licence_id    smallint REFERENCES meta.licence,
  captured_at   timestamptz
);

-- ───────────────────────────── agg ─────────────────────────────

CREATE TABLE agg.timeline_bin (
  layer      text NOT NULL,                     -- same keys as meta.layer_version
  source_id  smallint NOT NULL,
  unit       text NOT NULL CHECK (unit IN ('year','month','day','hour')),
  bin        timestamptz NOT NULL,
  n          int NOT NULL,
  mag_sum    real,
  PRIMARY KEY (layer, unit, bin, source_id)
);

CREATE TABLE agg.track_bin (
  class       smallint NOT NULL,
  hour        timestamptz NOT NULL,
  n_entities  int NOT NULL,
  n_points    int NOT NULL,
  PRIMARY KEY (class, hour)
);

CREATE TABLE agg.event_cell (
  kind_id   smallint NOT NULL,
  z         smallint NOT NULL,                  -- aggregation zoom (cell = 64×64 grid inside a tile at z)
  cell      bigint NOT NULL,
  unit      text NOT NULL,
  bin       timestamptz NOT NULL,
  n         int NOT NULL,
  mag_sum   real,
  sev_max   real,
  PRIMARY KEY (kind_id, z, unit, bin, cell)
);

-- ───────────────────────────── stage ─────────────────────────────

CREATE TABLE stage.unresolved (
  dataset_id  int NOT NULL,
  scheme      text NOT NULL,
  value       text NOT NULL,
  at          timestamptz,
  n_rows      int NOT NULL,
  PRIMARY KEY (dataset_id, scheme, value)
);

CREATE TABLE stage.manual_fix (
  source_code       text NOT NULL,
  source_record_id  text NOT NULL,
  field             text NOT NULL,
  old_value         text,
  new_value         text,
  reason            text NOT NULL,
  PRIMARY KEY (source_code, source_record_id, field)
);

-- ───────────────────────────── query shapes ─────────────────────────────

-- Track chunk: one index scan, then the server concatenates the blobs.
--   SELECT entity_id, class, category, label, points
--   FROM trk.segment_l0
--   WHERE bucket = $bucket AND bbox && ST_TileEnvelope($z, $x, $y)
--     AND sources <@ $allowed;

-- Curated event tile for a bucket:
--   SELECT ST_AsMVT(q, 'events', 4096, 'g') FROM (
--     SELECT event_id AS id, kind_id, magnitude, severity, geo_prec, t_start_prec,
--            extract(epoch FROM lower(period)) AS t0,
--            coalesce(extract(epoch FROM upper(period)), 'Infinity') AS t1,
--            ST_AsMVTGeom(ST_Transform(anchor, 3857), ST_TileEnvelope($z, $x, $y), 4096, 64) AS g
--     FROM ev.event
--     WHERE period && $bucket_range
--       AND anchor && ST_Transform(ST_TileEnvelope($z, $x, $y, margin => 0.015625), 4326)
--       AND kind_id = ANY($kinds) AND source_id = ANY($allowed) AND retracted_at IS NULL
--       AND event_id = canonical_id
--   ) q;

-- Catalogue as of T:
--   SELECT … FROM cam.camera_version WHERE valid @> $T AND geom_3857 && ST_TileEnvelope($z, $x, $y);

-- Choropleth series for a metric:
--   SELECT r.render_polity_id, extract(year FROM p.t)::int AS y, p.v, s.subject_id AS via
--   FROM ts.series s JOIN ts.point p USING (series_id)
--   JOIN core.polity_render r ON r.polity_id = s.subject_id AND r.valid @> p.t
--   WHERE s.metric_id = $metric AND s.source_id = ANY($allowed);
