# History and replay database

> **Status:** phase 0 built; phases 1a, 1c and 2 started (§13 "Where it stands"). Written 2026-10-12 and revised the same day to **SQLite first, PostgreSQL later**.
> Companion files:
> - [`replay-schema.sqlite.sql`](./replay-schema.sqlite.sql): the schema to build now.
> - [`replay-schema.postgres.sql`](./replay-schema.postgres.sql): the migration target.
> - [`dataset-import-map.md`](./dataset-import-map.md): how each raw dataset lands.
> - [`backend.md`](./backend.md): services, auth, plans and entitlements, public API, admin, and the migration of the legacy routes.
>
> Builds on `ARCHITECTURE.md` (entity and observation formats, the seven rules), `TODO.md` §1 and §6, and `CCTV-handoff.md` §3, which already chose SQLite for cameras.

## 1. Decisions

| Topic | Decision |
|---|---|
| Engine now | **SQLite 3 in WAL mode, through `better-sqlite3`.** Several database files on local disk. No database server. |
| Engine later | PostgreSQL + PostGIS (+ TimescaleDB), when one of the triggers in §12 is hit. Ids, track blobs, API and tile URLs stay the same. |
| Portability | All SQL lives behind six store interfaces in `src/lib/db/`. The schema uses a subset that both engines support (§11), and one export command moves everything (§11.3). |
| Raw archive | Hourly `ndjson.zst` per source, starting in phase 0. **This is the source of truth.** |
| Spatial | R\*Tree, with time as an extra dimension, plus WKB geometry blobs. Clipping, simplification and MVT encoding are done in TypeScript. **No SpatiaLite** (a native extension that's hard to package on Alpine). |
| Search | FTS5. The trigram tokenizer handles names and aliases. |
| Analysis | DuckDB, optional and later. It reads SQLite files and `ndjson.zst` directly, so nothing needs exporting. |
| Unchanged from the first design | Self-hosted on a NUC (≤16 GB, ~1 TB); one timeline from 10,000 BCE to now; tiered track retention; camera catalogue history; places and infrastructure with validity; licence gating per tier; smooth playback with trails; TypeScript everywhere; recording starts now; a few users. |

## 2. Why SQLite now, and its limits

- **It fits the workload.**
  - There is one host, one writer process (the ingest worker) and several readers (the web app). That is exactly what WAL mode is designed for.
  - With no server, nothing has to be configured, upgraded or held in memory. The NUC's RAM goes to the OS page cache instead.
  - **A file is the unit of everything:** retention means deleting a file, a backup is a copy, and migration reads one file at a time.
- **The write load is small.** The database never sees individual positions (§7.3). Tracks arrive as sealed hourly segments, about 30k rows per hour. Everything else adds up to a few hundred rows per second at peak.
- **What it can't do,** each of which is a reason to move later (§12):
  - writers on more than one host;
  - spatial analysis beyond bounding boxes (polygon intersections over large sets, buffers);
  - built-in compression;
  - many concurrent queries that miss the cache.

## 3. Principles

1. **The raw archive is the source of truth, and the database is derived from it.** Track segments are a pure function of the archive's hours, so live sealing and rebuilds run the same code.
2. **Every source maps to one or more of five shapes:**

   | Shape | What it holds | Tables |
   |---|---|---|
   | Track | Moving entities: ships, aircraft. Satellites are stored as orbits, not positions. | `trk_*` |
   | Event | Something that happened at a time, optionally at a place; an instant or an interval | `ev_*` |
   | Series | Numbers over time for one subject: country-year indicators, conflict-year deaths, prices | `ts_*` |
   | Feature | Geometry with a validity period: places, infrastructure, lakes, borders | `geo/*` files, plus `core_entity` for features with an identity |
   | Document | Text or media that serves as evidence for events and entities | `doc_*` |

   Catalogues are current state plus versioned history. They apply to cameras (`cam_*`), slowly changing entity attributes (`core_entity_version`) and track state (`trk_state`).
3. **Store data in the format it's served in.** A track chunk is the stored blobs concatenated together. Sealed time buckets never change, so their responses can be cached forever.
4. **Filter time in the browser.** Tiles carry `t0`/`t1` properties, so scrubbing changes a filter or a GPU uniform without making a request.
5. **Missing is never zero.** Each source has coverage intervals, and each imported dataset declares its gaps. The timeline shows both.
6. **Canonical core, full-fidelity extensions.** Core tables hold the fields that cross datasets. Wide datasets keep their other columns in typed extension tables, such as `x_gtd_incident`.
7. **Files are partitions.**
   - Data that has a time axis and a retention period goes into time-sharded files.
   - Each static layer version is one file.
   - Sealing, dropping, backing up and migrating are all file operations.

## 4. Files and topology

Service names and the API layer are defined in [`backend.md`](./backend.md). Replay, tiles and live data are served by `api` (Hono), not by the Next app.

```text
                         ┌───────────────────────────────── NUC ─────────────────────────────────┐
 upstreams ──► ingest (TS worker)                                                                │
  AIS ws,      ├─ connectors ─► recorder ─► data/archive/raw/{src}/YYYY/MM/DD/HH.ndjson.zst      │
  OpenSky,     ├─ map + resolve ids (in-memory id cache)                                         │
  CCTV, …      ├─ batch writer ─────► data/db/catalog.db, history.db, stream/*.db                │
               ├─ seal jobs (read the archive) ─► data/db/tracks/**.db                           │
               └─ live state + open-hour tracks (memory) ──internal WS/HTTP──┐                    │
                                                                             ▼                    │
 browser ◄── nginx (cache) ◄── api (Hono: read-only handles + worker-thread pool) ◄── data/db    │
            └── web (Next.js UI) ── calls api                                                     │
 importers (npm run import <dataset>) ─► data/db/stage/<dataset>.db ─► history.db, geo/*.db      │
                         └───────────────────────────────────────────────────────────────────────┘
```

### 4.1 File layout

```text
data/
  archive/raw/{source}/YYYY/MM/DD/HH.ndjson.zst   raw envelopes, 90 days
  db/
    catalog.db                  meta_*, core_*, cam_*, geo_layer        small, mutable
    history.db                  ev_* (curated), ts_* (historical), doc_*, agg_timeline_bin, x_*
    geo/{layer}@{version}.db    one file per reference layer version    read-only once built
    stream/YYYY-MM.db           ev_event_stream, ts_point_hf, ts_grid_frame, agg_event_cell
    tracks/l0/YYYY/MM/DD.db     segments for 1 day at full resolution, plus trk_state
    tracks/l1/YYYY-MM.db        segments for 1 month at L1
    tracks/l2/YYYY.db           segments for 1 year at L2
    tracks/tle.db               full TLE history
    cache.db                    disposable: geocoder answers, HTTP caches
    stage/{dataset}.db          disposable: importer staging
  cold/tracks/l0/...            L0 shards older than 14 days: kept, not served
  media/ab/cd/{sha256}          content-addressed media
  tiles/{layer}@{version}.mbtiles   optional pre-baked tiles (MBTiles is SQLite)
  cache/                        nginx response cache
```

`catalog.meta_shard` lists every sharded file: its path, kind, LOD, period, status (`open`, `sealed`, `cold`), byte count, row count and checksum. The API uses it to find files, and backups and migrations use it as their manifest.

### 4.2 Who writes what

| File | Writers | Readers |
|---|---|---|
| `catalog.db` | Ingest worker (entities, cameras, runs, coverage) and importers (polities, organisations, datasets). All transactions are short. | api, worker |
| `history.db` | Importers, and the worker for live events that get revised (quakes, alerts, C2 servers, outages) | api |
| `geo/*.db` | Importers only. They build a new file, then publish by renaming it. | api |
| `stream/*.db` | Worker | api |
| `tracks/**` | Worker seal jobs | api |
| `cache.db` | api | api |
| `app.db` (accounts, billing, workspaces; [`backend.md`](./backend.md) §12) | api | api |

- **Each file has at most one writer at a time.** Writes to `catalog.db` from both the worker and an importer are serialised by `busy_timeout`, and every transaction there stays under about 50 ms.
- **Bulk loads never touch `catalog.db` in one long transaction.** Importers stage into their own file, then write in batches of about 5k rows.
- **SQLite gives no atomicity across files.** Writers therefore follow a fixed order: entities first, facts second, publication flag last. Every step is idempotent, so a failed run is simply run again.

### 4.3 Docker

- **`./data` is bind-mounted into `api`, `ingest` and `web`,** owned by uid 1001. Nothing may write inside `/app`, which is owned by root.
- **WAL needs a local filesystem shared by processes on the same host.** A bind mount on the NUC's disk works. NFS and SMB do not. On macOS, run development natively rather than over Docker Desktop bind mounts.
- **`better-sqlite3` is a native module.**
  - `api`, `ingest` and `cli` load it directly.
  - Next only needs it during the phase-0 to 1a transition, through `serverExternalPackages`.
  - Check that its musl prebuild installs on `node:22-alpine`. If it doesn't, add `python3 make g++` to the builder stage.
- **Memory:** there is no database container any more. The per-service budget is in [`backend.md`](./backend.md) §15. It totals about 5.3 GB, which leaves about 10 GB for the OS page cache that SQLite reads through.

## 5. Time model

Every row that has a time uses the same columns.

| Column | Type | Meaning |
|---|---|---|
| `t_start`, `t_end` | `INTEGER` | The stated time, as epoch milliseconds UTC. BCE dates are negative; 10,000 BCE is about −3.8e14, well inside JS's ±8.64e15. A null `t_end` means an instant. |
| `t_start_prec`, `t_end_prec` | `INTEGER` | 0 unknown, 1 millennium, 2 century, 3 decade, 4 year, 5 month, 6 day, 7 hour, 8 minute, 9 second |
| `ongoing` | `INTEGER` 0/1 | Still open at the dataset's `as_of` date |
| `t_lo`, `t_hi` | `INTEGER` | The **expanded** interval the record covers. A `1917-05` start with month precision has `t_lo = 1917-05-01`, and its `t_hi` is the end of May. When `ongoing` is set, `t_hi` is 8.64e15. These are the columns indexed in the R\*Tree. |
| `valid_lo`, `valid_hi` | `INTEGER` | Validity of versions and identifiers. `valid_hi` null means still valid; `valid_lo = −8.64e15` means valid since forever. |

Rules:
- **Sentinels never become fake dates.** GTD month and day `0`, ICOW `00` and `200199`, COW `-8`/`-9`, `ONGOING`, `-1` and `DAM_YEAR 0` become null or a lower precision, and the original goes into `attrs.t_raw`.
- **Each dataset has an `as_of` date.**
- **Observation, publication, ingest and validity times are kept separate.** Ships carry only the time we received each message, so their rows get `flags.t_is_receive`.
- **On the wire, times are epoch seconds as float64.** Inside a TRK1 blob the first time is absolute and the rest are deltas (§8.3), so a blob means the same thing outside its chunk.

## 6. Identity model

Follows `ARCHITECTURE.md` "Entities". The tables are in `catalog.db`.

- **`core_entity` holds every identifiable thing:** vessel, aircraft, satellite, camera, airport, port, facility, heritage site, waterbody, polity, region group, organisation, instrument, public person.
- **`core_entity_identifier(scheme, value, valid_lo, valid_hi)`** has the primary key `(scheme_id, value, valid_lo)`.
  - **Identifier reuse has a time dimension.** That covers MMSI reuse, re-registered ICAO24 addresses and country codes. For example, COW code `365` maps to the Russian Empire before 1917, the USSR from 1922 to 1991, and Russia after that.
  - **The writer refuses overlapping validity periods,** and `npm run db:check` checks for them. Postgres would enforce this with an `EXCLUDE` constraint.
- **One resolver:** `resolve(scheme, value, at)`. The ingest worker keeps a hot in-memory copy (about 300k ids, about 30 MB). Importers resolve with SQL joins against the staging file attached with `ATTACH`. Anything unresolved goes to the staging file's `unresolved` table and is reported.
- **Names:** `core_entity_name` holds every name, plus a normalised column (lower-case, diacritics removed in TS) and a trigram FTS5 index. Aliases are seeded from every variant found in the datasets.
- **Polities and borders:**
  - Modern borders come from Natural Earth admin-0, as layer `admin0` in `geo/`.
  - Historical polities are drawn through `core_polity_render`: the USSR colours its 15 successor shapes.
  - Historical borders (CShapes) can be added later as time-valid features.
  - **Aggregates are region groups, not polities.** `core_region_member` lists their members.
- **Links:** `core_entity_link` holds part-of, located-in, operates and successor-of, the dependency relations feeds, connects and serves, and same-as.

## 7. Ingest

### 7.1 Phase 0: record now, before any database

This runs inside the existing Next process, because that is where the payloads are today. A second poller would also double the OpenSky quota.

- **`record(source, meta, raw)` in `@takip/archive/recorder`, with a bounded queue** (64 MB).
  - A single writer appends to `data/archive/raw/{source}/YYYY/MM/DD/HH.ndjson.zst`, choosing the hour by receive time. It writes one zstd frame per file every 10 s.
  - The frames are independent, so a reader can decode a file that's still open.
  - It uses `node:zlib` zstd (Node 22.15 or later), falling back to gzip.
  - It is enabled by `TAKIP_ARCHIVE_DIR`, and is off by default in development. One recorder per process, kept on `globalThis` so dev reloads don't start a second writer.
  - **Gotcha:** `node:zlib`'s zstd decoder, sync and streaming alike, silently stops after the first frame of a multi-frame file. The reader (`@takip/archive/reader`) therefore splits frames itself by parsing frame and block headers, which also detects a last frame that is still being written. The `zstd` CLI reads the files normally.
- **Envelope:** `{"v":1,"src":"opensky","at":<ms>,"url":"<keys stripped>","status":200,"etag":null,"ms":812,"sha256":"…","err":"…","body":{…}}`. For AIS, each WebSocket frame is one line, with no url or status.
  - A single-line JSON body is spliced in as received, not re-serialised. Multi-line JSON is re-serialised onto one line, and text bodies (TLEs) are stored as JSON strings.
  - A failed request is recorded too, with `body: null` and its status or `err`. Coverage (§7.4) is built from these lines.
  - Query parameters whose names look like credentials (`key`, `token`, `secret`, `auth`, …) are stripped from `url`.
- **Taps** (*built:* the first four):

  | Tap | Source(s) |
  |---|---|
  | `flights/route.ts`: the OpenSky, adsb.fi `/mil` (now a fallback) and regional-sweep fetches; `flights/adsb-lol.ts` `getAc` | OpenSky (full `states/all`, **keeping `time_position`/`last_contact`**), adsb.fi, adsb.lol (`/v2/mil` and `/v2/type` batches, recorded as `adsblol`) |
  | `maritime/route.ts`: the socket's `message` handler | aisstream frames |
  | `satellites/celestrak.ts` `downloadDue` | CelesTrak TLE sets, one line per group fetched |
  | `src/lib/cctv/catalog/refresh.ts` `REGION_FETCHERS` (`archived()`) | Per-region camera lists, on every upstream refresh |
  | `cachedSource` fetcher (`lib/sourceCache.ts:49`) | Weather events, news/Telegram, markets |
  | `gdeltEvents.ts` export fetch | GDELT 15-minute exports |
  | `fires`, `earthquakes`, `cloudflare-radar`, `cyber-attacks`, `malware` polls | FIRMS, USGS, Radar, Feodo, URLhaus |
  | `weather-grid` `fetchForecast` | Open-Meteo |

- **The routes only poll when asked,** and the AIS socket opens on the first `/api/maritime` request. Recording would otherwise follow visitor traffic. While the feeds still poll from inside Next, the ingest worker asks for them on a schedule (`apps/ingest/src/jobs/keepalive.ts`, enabled by `TAKIP_WEB_URL`). Next stays the only upstream poller, so the OpenSky quota isn't doubled.
- **Upstream limits at 24/7 cadence** (checked 2026-10-12). The keep-alive turns visitor-driven polling into round-the-clock polling, so each source's rules apply in full. The keep-alive skips a route whose sources are all switched off: the Record switch alone stops archiving, not polling.

  | Source | Their rule | What we do |
  |---|---|---|
  | CelesTrak | One download per 2-hour update; 50 HTTP errors per 2 h or over 100 MB/day can end in the firewall; stop on any non-200 ([usage policy](https://celestrak.org/usage-policy.php)) | `satellites/celestrak.ts`: 5 groups (`active`, `visual` and three debris fields), not 43. Each group at most once per update, with the schedule kept across restarts. "Not updated since" means no change. A 404 retires the group. Any other refusal pauses every download for 6 h and logs for a person. About 25 MB/day. |
  | OpenSky | Daily credits per account, or per IP when anonymous; `/states/all` costs 4 | Paced from `X-Rate-Limit-Remaining` over the rest of the UTC day, so a shared budget (a second copy of the app, a laptop behind the same router) slows down instead of running dry. A 429 waits `X-Rate-Limit-Retry-After-Seconds`. Each environment should still have its own API client. |
  | OpenCCTV | Terms forbid bulk download; robots.txt disallows `/api/` | Fetched at most once a day (24 h cache). Whether to keep it at all is an open licensing question. |
  | adsb.lol | Dynamic limits; an API key, obtained by feeding, is planned | Stops at the first 429. Feeding a receiver would secure access before keys become mandatory. |
  | adsb.fi | 1 request/s on the public API | Now a fallback only |
  | aisstream | 3 connections per account and per IP; bandwidth limits on uncompressed connections | One socket, compressed (the `ws` client negotiates permessage-deflate). Don't run more than three copies with the same key or on the same IP. |

  The API sources are fetched with an honest User-Agent (`src/lib/user-agent.ts`), not `stealthFetch`'s rotating fake identities. The camera sources still use `stealthFetch`.
- **Nothing is dropped silently.**
  - Lines beyond the queue bound are counted, and the next heartbeat writes a `_recorder` drop line: `{"src":"_recorder","drop":{"src","n","reason"}}`, where `reason` is `queue_full`, `disk` or `write_failed`.
  - Each source writes a heartbeat once a minute, `{"hb":{"n","dropped","paused","off"}}`, which tells "source alive but empty" apart from "recorder down". It describes the minute that just ended.
  - **Disk guard:** below `TAKIP_ARCHIVE_MIN_FREE_GB` (default 50) of free disk the recorder pauses AIS, below 80 % of it OpenSky as well, and below 60 % every source. Each change is logged.
- **Before recording event sources,** replace the unstable ids (`gdacs-N`, `osint-live-N`, `gdelt-pt-N`) with the providers' own ids. *Not done yet:* no event source is recorded so far.

### 7.2 Phase 1: the ingest worker

The connector interface and pipeline are unchanged from the first design:

```ts
interface Connector {
  source: string;                                      // meta_source.code
  run(ctx: ConnectorCtx): AsyncIterable<RawEnvelope>;   // stream or poll loop
  map(env: RawEnvelope): Iterable<Observation>;         // pure; tested against recorded envelopes
}

type Observation =
  | { shape: 'track';    key: IdKey; t: number; lon: number; lat: number; alt?: number; speed?: number; course?: number; heading?: number; flags: number; state?: TrackState }
  | { shape: 'event';    sourceRecordId: string; kind: string; tStart: number; tEnd?: number; prec: Prec; geom?: Geo; attrs: object; links?: EntityLink[]; stream?: boolean }
  | { shape: 'series';   metric: string; subject: IdKey; t: number; v: number; prec?: Prec }
  | { shape: 'catalog';  key: IdKey; fields: object }
  | { shape: 'document'; sourceRecordId: string; url: string; title: string; publishedAt: number; links?: DocLink[] }
  | { shape: 'tle';      norad: number; epoch: number; line1: string; line2: string };
```

For each envelope, the worker archives it, maps it, resolves ids, buffers it, then writes it to the destination below. Positions go nowhere near the database at this stage:

| Destination | How it's written |
|---|---|
| Live state and open-hour fixes | Kept in memory: the latest fix per entity, plus the last 3 hours of fixes, about 90 MB |
| Entities, versions, cameras | Upserts in `catalog.db`, as short transactions |
| Revisable events | `INSERT … ON CONFLICT DO UPDATE … WHERE changed` into `history.db`. A trigger copies the old row into `ev_event_history` and bumps `rev`. |
| Stream events, high-frequency series, grid frames | Batched every 2 s into the current `stream/YYYY-MM.db` |
| TLEs | Into `tracks/tle.db`, ignoring duplicates |

- **Positions are deduplicated in memory:** a fix is kept only if its `t` is newer than the entity's last fix (for OpenSky, `time_position`).
- **On restart,** the worker rebuilds its in-memory window by re-reading the last 3 hours of the archive, which takes a few seconds.
- **The worker serves live state and provisional chunks for the open hour** to `api` over an internal WebSocket and HTTP (`backend.md` §9). This replaces `globalThis.shipsCache` and the flights module variables.
- **Catalogue diffs** (cameras and reference places) work per successful run:
  - The worker hashes each record's meaningful fields. A changed hash closes the old version and opens a new one.
  - **A run that comes back more than 5% short counts as failed and changes nothing.**
  - A record that is missing from 3 complete runs in a row, or for more than 3 days, has its version closed.

### 7.3 Sealing and jobs

All jobs run inside the worker, with a lock file guaranteeing a single instance.

| Job | When | Does |
|---|---|---|
| `seal-tracks` | Every hour, for the hour that ended about 1 h ago (H is sealed at H+2:05) | Reads archive hours H and H+1, keeps the fixes whose observed time falls in H, and runs the same `map()`. Builds the L0 segments and writes them to the day's shard, in one transaction that replaces the bucket. Every 6 h it also builds L1, and once a day L2, both from L0. Updates `agg_track_bin` and bumps `meta_layer_version`. |
| `rebuild` | When asked | Re-seals any hour that is still in the archive. This covers parser fixes and late data (`trk_dirty_bucket`). |
| `finalise-shard` | Daily, for the previous day | Runs `ANALYZE` and `VACUUM INTO` a compact copy, swaps it in, records its checksum in `meta_shard`, and marks it `sealed` (read-only from then on) |
| `cool-shards` | Daily | Moves L0 shards older than 14 days to `cold/` (kept, not served). Deletes L1 shards older than 90 days. |
| `aggregate-events` | Every hour | `agg_event_cell` and `agg_timeline_bin` for the sealed hours of the stream |
| `coverage` | Every 5 min | Extends or closes `meta_coverage` intervals from runs and heartbeats |
| `prune-raw` | Daily | Deletes archive hours older than 90 days, but only if their L0 shard and stream shard are sealed |
| `optimize` | Every 6 h | `PRAGMA optimize` and `wal_checkpoint(TRUNCATE)` on every file that has a writer |

- **The 2-hour seal delay covers late fixes.** For example, OpenSky can report a `time_position` that belongs to the previous hour just after the boundary. Until an hour is sealed, its chunks come from the worker's memory.

*Built* (`apps/ingest`, run as `npm run ingest -- worker`):
- **The worker** takes `data/db/ingest.lock` (a lock left by a dead process is taken over) and ticks every minute:
  - It seals every archived hour that is 2:05 old and not sealed yet, at most 6 per tick.
  - It builds the L1 and L2 buckets of the last 3 days whose L0 hours are all sealed, and rebuilds them when an L0 hour is newer.
  - It loads settled CelesTrak hours into `tracks/tle.db`, tracked in `meta_ingest_run`.
  - It keeps `control.json` in step with the source switches (§7.6).
- **`seal-tracks`:** connectors' pure `map()` per source (`apps/ingest/src/connectors/`, tested against recorded payloads).
  - **Identity:** entities and identifiers are created for unseen MMSI or ICAO24 values. An identifier seen before its `valid_lo` (a rebuild of an older hour) is extended back, never duplicated.
  - **Fixes:** one per second, with sources merged into `source_mask`.
  - **Categories:** the same classifiers as the live map (`@takip/core/aircraft`, `@takip/core/vessel`). A vessel's last stated type is kept in `core_entity.attrs`, for hours without static data.
  - **Shard:** checkpointed after each bucket, so `meta_shard.bytes` is real.
  - **Order:** entities, then facts, then the publication rows (`trk_sealed_bucket`, `meta_shard`, `meta_layer_version`), per §4.2.
- **The CLI** covers the rest: `seal` and `rebuild` take a range and ignore the delay, so an open hour can be sealed during development. It also has `lod`, `tle`, `status`, `sources` and `source <code> <record|build> <on|off>`.
- **Not built:** `finalise-shard`, `cool-shards`, `aggregate-events`, `prune-raw`, `optimize`, `agg_track_bin`, `trk_state`, the 5-minute `coverage` job (coverage is written per hour at sealing), and the open hour served from memory.
- **Measured** on one live OpenSky poll plus adsb.fi `/mil` (2026-10-12): 12,039 aircraft sealed in well under a second, and 2.3 MB for the hour's shard. A z7 chunk over Frankfurt took about 7 ms, cold.
- **L0 shards in `cold/` are a lossless, normalised position archive kept forever,** at about 55 GB a year. They replace the Parquet tier of the first design, so no DuckDB or Parquet is needed now.

### 7.4 Coverage

- `meta_coverage(source, t_lo, t_hi, status)` holds continuous intervals with status `ok`, `degraded`, `down` or `not_recording`. The writer replaces whatever the new interval covers and merges neighbours with the same status, so a rebuild can heal an outage.
- *Built:* each sealed hour gets one status per track source, read from that hour's archive lines:

  | Status | When |
  |---|---|
  | `ok` | Payloads arrived and none failed |
  | `degraded` | Some requests failed, or the recorder dropped or paused lines |
  | `down` | Only failures; or no payloads while the recorder was paused or dropping |
  | `not_recording` | Nothing was polled, or the source is switched off (§7.6) |
- `meta_dataset_gap` holds the gaps that datasets declare: GTD has no 1993, and UCDP's 2025 data is preliminary.
- The replay manifest returns both. The timeline greys those spans out, and tracks are never interpolated across an outage.

### 7.5 Importers

Command: `npm run import <dataset> [--version] [--dry-run]`. Each importer has a manifest listing its files, checksums, licence, source and parser options. Steps:

1. **Register.** Hash the files; if `meta_dataset` already has the same checksums, skip. Otherwise insert the dataset with status `loading`.
2. **Stage.** Stream the CSV into `data/db/stage/<dataset>.db` with every column as text. Decoding tries UTF-8 per field, then falls back to cp1252. BOMs, `\xa0` and `[n]` markers are stripped.
3. **Transform.** SQL in `tools/import/<dataset>/*.sql` runs with `history.db` and `catalog.db` attached. It upserts on `(source_id, source_record_id)`. Rows missing from a new version get `retracted_at` set and are not deleted, so ids stay stable.
4. **Apply manual fixes.** `tools/import/manual-fixes.csv` is checked in, for example the WW1 Aisne date of 2024 that should be 1917.
5. **Publish.** Write the gaps, set the dataset to `active` and the previous version to `superseded`, and bump `meta_layer_version`.
   - For a geo layer, publishing means building `geo/<layer>@<v>.db` and renaming it into place.
6. **Report.** Write row counts, rejects, unresolved values and mapped sentinels to `meta_dataset.report`. Then delete the staging file.

The per-dataset mapping is in [`dataset-import-map.md`](./dataset-import-map.md).

### 7.6 Source switches

The admin console's Sources page (`/admin/sources`) turns two switches per source. The CLI has the same: `npm run ingest -- source <code> <record|build> <on|off>`.

| Switch | Off means | Undo |
|---|---|---|
| **Record** | The recorder skips the source. Its heartbeats say `off`, and the timeline shows the time as not recorded. | None: time not archived is gone. The page asks before turning it off. |
| **Build** | The archive keeps the source, but no history is derived from it. | Turn it on, then `npm run ingest -- rebuild <from> <to>`. |

- **They live in `catalog.db` `meta_source`** (`record`, `build`, `switched_at`, `switched_by`), and every change is written to `audit_event` (`source.switch`).
- **The recorder never opens SQLite:** it re-reads `data/archive/control.json` once a minute when the file changes. The api writes that file when an admin flips a switch, and the worker rewrites it from `catalog.db` on every tick.
- **The page also shows each source's latest coverage,** so "on but not flowing" is visible.
- **Sources not in `meta_source`** are recorded by default.

### 7.7 Backfill from upstream history

Some upstreams publish their own history, which can fill time before recording started or an outage. A backfill writes envelopes into the archive filed under the hour the data describes (`for`), with `at` still the real receive time. The same `map()` and sealing as live data then turn them into history, so the archive stays the one source of truth.

```text
npm run ingest -- backfill adsblol-history <day> [last day]   whole UTC days, ~3 GB each to stream
npm run ingest -- backfill opensky <from> [to]                up to 1 h back; needs an OpenSky account
npm run ingest -- backfill usgs <from> [to] [min magnitude]   earthquakes since 1900 into history.db (default M2.5)
```

- **Provisional hours:** besides final sealing at H+2:05, the worker seals the hours that aren't final yet every 5 minutes, along with their incomplete L1 and L2 buckets. So replay reaches to within minutes of now. A provisional bucket (`isProvisional` in `@takip/core/tracks`, and flagged in the manifest) is sealed again once final, with a new version.
- **Who seals:** a backfill seals its hours itself when no worker is running. Otherwise it queues them in `trk_dirty_bucket`, and the worker reseals about 6 hours a minute and rebuilds their L1 and L2. Two processes creating entities at once would each miss the other's identifiers and duplicate them, so `seal` and `rebuild` follow the same rule.
- **Bulk sources** (`delivery = 'bulk'`) write coverage only for hours they have data in. They're also left out of the worker's own range, so one backfilled day in January doesn't make the worker seal every hour since.
- *Built:*
  - **adsb.lol history** (`apps/ingest/src/backfill/adsblol-history.ts`, source `adsblol-history`, ODbL, track bit 4):
    - The day's release comes from the GitHub API (prod, else staging). Its `.tar.aa`/`.tar.ab` parts are streamed through a tar reader without touching disk, and each `traces/xx/trace_full_<hex>.json` (gzip, readsb's documented trace format) is read in turn.
    - Traces are thinned to one point per 30 s, keeping leg starts and points after silences, and written as one line per aircraft per hour.
    - **The archive holds a thinned extract, not the bytes as received.** That's the one exception to §3 rule 1: the immutable GitHub release is the raw, and each line's `url` names the release and the entry.
    - Checked on the first 4 MB of 2026-10-11: 96 aircraft, 162,209 points thinned to 30,404. The whole day, run on 2026-10-12, streamed 3.16 GiB into 55,469 aircraft and 18.95 M points over 25 hours: 383 MB of archive, 256 MB of L0, and about 125 MB of L1 and 45 MB of L2.
  - **USGS earthquakes** (`backfill/usgs.ts`, `connectors/usgs.ts`, source `usgs`, public domain): the first event pipeline.
    - **Live:** the worker fetches the source itself; it isn't a Next tap. It reads the CDN summary feed (`2.5_day.geojson`) every 10 minutes, and once a day runs an FDSN `updatedafter` query over the last 30 days to pick up reviews and magnitude changes. On start, it fills the gap since the last archived hour from the FDSN query; on a first run, that's 30 days.
    - **Backfill:** FDSN queries in 30-day windows at M2.5+ (1-day windows below). A window over the 20,000-event limit is refused with 400 and asked again in halves. There's a 1 s pause between requests.
    - **Loading:** `jobs/ingest-events.ts` maps archived hours to `hazard.quake` events and upserts them into `history.db` on `(source, USGS id)`. A revision bumps `rev`. It then rebuilds the `hazard` timeline bins. An open hour is loaded again after each poll; a settled one is recorded in `meta_ingest_run` and not read again. The CLI backfill loads its hours itself: event upserts are transactional, so unlike sealing they don't need the worker.
    - **Row:** `magnitude` = mag, `geoPrec` exact, `tStartPrec` second. `attrs` holds depth_km, place, mag_type, alert, tsunami, felt, sig, status, net, ids and url. `severity` is left empty.
    - **Renamed events:** USGS sometimes changes an event's preferred id early on. The connector passes the event's other ids as `supersedes`. Within an hour the newest fetch wins, and the ids it replaced are retracted with `EventStore.retract` rather than upserted, since an upsert would revive them.
    - *Not handled yet:* deleted events are never retracted. The timeline rebuild covers the whole family, which is cheap at 30 days but not after a decades-long backfill.
  - **OpenSky** (`backfill/opensky.ts`): accounts can ask `states/all?time=` up to an hour back; anonymous requests ignore `time`. It steps at the live cadence (90 s) and stops with 1,000 credits left for the live map. *Untested against the live API:* no account is configured yet.
- **No history offered:** aisstream, adsb.fi, CelesTrak (its GP data has no history) and the camera feeds.
- **Satellites need no recording for recent replay:** SGP4 runs backwards as well as forwards. `tleAt` falls back to the oldest set after `t` (within 30 days), and `/api/satellites?at=` propagates today's cached sets to any time. Accuracy falls off over days, and objects launched since then show up early.
- **Candidates not built** (terms to verify first):

  | Data | Upstream history | Notes |
  |---|---|---|
  | Satellites | Space-Track `gp_history` | Free account; its user agreement limits redistribution |
  | Vessels | Danish Maritime Authority and NOAA MarineCadastre AIS files | Only their own waters; large daily files |
  | GDELT events | GDELT 2.0 raw files | Every 15 minutes since 2015 |
  | Weather | Open-Meteo historical API (ERA5) | Hourly grids; free for non-commercial use |
  | Fires | NASA FIRMS archive | Needs a `MAP_KEY` |

## 8. Replay serving

### 8.1 What the browser receives

| Shape | Transport | Time handling | Cache |
|---|---|---|---|
| Feature (places, infrastructure, lakes, borders, camera catalogue) | MVT `/api/tiles/{layer}/{z}/{x}/{y}.mvt?v=` | `t0`/`t1` properties, filtered in the browser | Immutable per `v` |
| Event, curated (wars, battles, GTD, claims, tariffs, quakes, alerts) | MVT `/api/tiles/events/{group}/{bucket}/{z}/{x}/{y}.mvt?v=` | `t0`/`t1` plus precision, filtered in the browser | Immutable per `v` |
| Event, stream (fires, GDELT, news) | Same, in day or hour buckets, aggregated at low zoom | Same | Sealed buckets immutable |
| Track (ships, aircraft) | Binary `/api/replay/tracks/{class}/{lod}/{z}/{x}/{y}/{bucket}.bin?v=` | Per-point times; the GPU interpolates | Sealed buckets immutable |
| Satellites | JSON `/api/replay/tle?at=` | SGP4 in the browser (`satellite.js`) | Per day |
| Series / choropleth | Binary `/api/replay/series/{metric}` | The whole series once; `feature-state` changes per frame | Immutable per `v` |
| Documents | JSON `/api/replay/docs?event=` or `?entity=` | On click | Short |
| Histogram | JSON `/api/replay/histogram?layers=&from=&to=&bins=` | Density bars and gap shading on the scrubber | Per `v` |
| Manifest | JSON `/api/replay/manifest?from=&to=` | Layers, LODs, coverage, gaps, versions, attributions | Short |
| Entity at a time | JSON `/api/replay/entity/{id}?at=` | Version, state and last fix at that time | Short |

**Live is replay pinned to now:** the open bucket comes from the worker's memory, so live and replay share one code path.

### 8.2 Time buckets

| Layer kind | Bucket |
|---|---|
| Sparse history (wars, claims, territorial changes, the 1914–2026 conflicts, UNESCO) | `all` |
| Medium (GTD) | Decade below z6, year from z6; `all` for WW1 and tariffs |
| Stream | Day below z7 (served from aggregates), hour from z7 |
| Tracks | Set by LOD (§8.3) |

The client loads buckets that overlap the visible timeline window and prefetches 2 buckets ahead in the play direction. It keeps them in an LRU capped at about 300 MB.

### 8.3 Tracks

| LOD | Map zoom | Fetched as tiles at | Bucket | Shard file | Simplification | Longest gap inside a segment | Served for |
|---|---|---|---|---|---|---|---|
| L0 | ≥ 8 | z7 | 1 h | one per day | None (dedup only) | ships 15 min, aircraft 4 min | 14 days (then `cold/`, kept) |
| L1 | 5–7 | z4 | 6 h | one per month | SED ≤ 100 m, at most one point per 30 s | 30 min | 90 days |
| L2 | ≤ 4 | z1 | 1 day | one per year | SED ≤ 2 km, at least one point per 10 min while moving | 60 min | forever |

- **SED simplification** keeps the time-interpolated position within the tolerance, so animation timing stays correct. Gaps longer than the limit split the segment, and the sealed data keeps that split.
- **The client may bridge a short silence** (up to 20 min) between two segments of the same entity. It draws the bridge as a straight run, dimmer than measured track, so sparse polling (anonymous OpenSky every 15 min, adsb.lol every 10) and hour boundaries don't read as teleporting. Longer gaps stay gaps, and after its last fix an entity is held, fading, for 15 min.
- **Aircraft get 4 minutes rather than 2.** OpenSky is polled every 90 s, so one missed poll leaves a 3-minute gap.
- **Segments that cross the antimeridian** are split into two segments.
- **Segment row:** `(bucket, entity_id, part)` → `class`, `category`, `label`, `source_mask`, `n`, `points`, `flags`. `part` numbers the pieces that gap and antimeridian splits leave in one bucket. A 3-D R\*Tree indexes `(lon, lat, t)`, with exact filters on the row: the R\*Tree stores 32-bit floats, so epoch ms round outward to about 2 minutes.
- **Chunk query:** a single R\*Tree probe, a join, and `(source_mask & ~allowed) = 0`. The server then writes the blobs one after another. About 720k L0 rows are written per day, across 24 buckets in that day's shard.
- **`points` encoding (TRK1):** little-endian, columnar varint-delta, about 6–9 bytes per point:

  ```text
  varint n | u8 flags | f64 t_first (epoch s)
  dt       uvarint ×(n-1)       seconds
  lon, lat zigzag varint delta  round(deg·1e5), first absolute  (1e4 if flags.coarse)
  alt      zigzag varint delta  10 m          if flags.has_alt
  speed    uvarint              0.1 kn        if flags.has_speed
  heading  u8                   360/256 °     if flags.has_heading
  gaps     bitset ⌈n/8⌉ bytes    if flags.has_gaps; 1 = do not interpolate into this point

  flags: 1 has_alt · 2 has_speed · 4 has_heading · 8 has_gaps · 16 coarse · 32 t_is_receive
  ```

  The flags sit in the blob, so a decoder needs nothing from the row or the chunk. A point missing an optional value carries the previous one forward.
- **Chunk response:** `"TRKC" | u8 version 1 | f64 bucket (epoch s) | u8 lod | varint count | (entity varint, part varint, class u8, category u8, label (varint length + UTF-8), varint length, blob)*`. Duplicates across tile edges are removed by the client on `(entity, bucket, part)`.
- **URLs:** `/api/replay/tracks/{class}/{lod}/{z}/{x}/{y}/{bucket}.bin?v={v}&p={token}`. `z` must be the LOD's fetch zoom, and `bucket` is aligned epoch seconds.
  - `v` is the bucket's `sealed_at`, from the manifest. With it the response is `immutable`; without it, it's cached for 60 s. A global layer version would have changed every old bucket's URL on each hourly seal.
  - `p` is explained in §8.7.
  - An hour that isn't sealed yet answers `404 not_sealed`, until the worker serves the open hour.
- *Built:* the codecs (`@takip/core/trk`, browser-safe), the store and the routes (`apps/api/src/replay/`), and the client below.
- **Sizes:**
  - A busy z7 tile for one hour at L0 is about 0.3–1 MB.
  - The whole world for one day at L2 is about 6–10 MB.
  - For comparison, today's live `/api/flights` sends about 3 MB of JSON per poll.
- **Client:** decodes into typed arrays. A custom MapLibre layer (`src/lib/replay/track-layer.ts`, using the same projection prelude as `sat-3d`) draws trails over `[T − trail, T]`.
  - *As built,* positions are interpolated on the CPU, a binary search per entity into a reused `Float32Array`. They're drawn as instanced quads shaped in the fragment shader: planes, ship arrows, and ship dots below zoom 6.
  - Trail vertices carry times as offsets from a per-buffer base, because float32 can't hold epoch seconds.
  - The first version redrew GeoJSON 8 times a second and froze a tab at about 40k points. This one leaves the renderer near idle.
  - Interpolating in the vertex shader remains an option if the CPU pass ever shows up in a profile.

### 8.4 Event tiles

- **Curated events.** The R\*Tree `ev_event_rtree(lon, lat, t)` returns the candidates for the tile envelope and the bucket's time range. The query then filters on `kind`, `source_id`, `retracted_at` and `event_id = canonical_id`.
- **Stream events** use the index `(kind_id, t_hour, cell)`, where `cell` is a z14 Morton code. Every tile at z ≤ 14 is one contiguous `cell` range, so an hour-bucket tile is a single index range scan.
- **Low zoom.** When a tile has more than 2,000 points, it gets features aggregated by cell (a 64×64 grid per tile) and by sub-bucket. Each aggregate carries `t0`/`t1`, `n` and `mag_sum`, so browser-side time filtering still works.
  - Stream aggregates are precomputed in `agg_event_cell`.
  - Curated layers are aggregated on demand and cached.
- **Encoding.** Candidates are converted to tile coordinates and clipped. Simplification only happens for lines and polygons, and those come pre-simplified from `feature_gen`. Tiles are encoded with `vt-pbf`. Encoding runs in the worker-thread pool (§10.2).

### 8.5 Features

- **Each `geo/<layer>@<v>.db` holds three things:**
  - `feature`, with the canonical WKB geometry, properties and validity;
  - `feature_gen`, with tile-ready pieces for each zoom band, simplified and cut to at most 256 vertices at import;
  - `gen_rtree(lon, lat, t, zband)`.
- **A tile is one R\*Tree probe for the zoom band,** followed by clipping and MVT encoding.
- **Heavy layers can be pre-baked** into `tiles/<layer>@<v>.mbtiles` for z0–z10 at import time. The highway planning network, with 626k lines, is the obvious candidate.
- **This implements the existing `ReferenceStore` seam** in `src/lib/reference/file-store.ts`, so `/api/reference` keeps working.

### 8.6 Series and choropleths

- **The client fetches a metric's whole series once.** For WDI that is about 15k values, roughly 120 KB.
- **Yearly and `day` metrics are mapped.** A `day` payload (the weekly COVID-19 series) carries `step: 'day'` and its points' x are fractional years, the point's date; a payload without `step` is yearly. COVID deaths are about 86k points, 1.3 MB of uncompressed JSON.
- **The server resolves render polities as it writes the response:** a USSR value for 1985 is sent once for each of the 15 successor shapes, tagged `via`.
- **The `admin0` tiles use `promoteId = entity_id`.** Scrubbing calls `setFeatureState` on about 250 features.

### 8.7 Licence gating and caching

- **Each tier has a set of allowed source ids,** with an allowed bitmask for track sources. They are computed once per tier and kept in memory.
- **Every query filters on `source_id`,** and track chunks on `source_mask`.
- **Cache keys include a policy hash,** so only a few variants exist.
  - *Built:* the manifest returns `token`, a hash over the caller's licence policy and `replay.lookback_days`. Chunk and TLE URLs must carry it as `p`, or they get `409 policy_mismatch`. A URL is therefore only ever answered for one policy and one lookback.
  - **Before nginx caches `/api/replay/`, make the token an HMAC.** Today it's derived from public data, so someone could forge a richer tier's token and be served that tier's cached response without the api checking.
  - Requests older than the caller's lookback get the standard `403 entitlement_required` (`replay.lookback_days`). The manifest's span is capped by `replay.window_hours`.
- **The manifest returns attribution text.**
- **Exports are gated separately** (`can_export`).
- **nginx caches `/api/tiles/` and `/api/replay/`** under the key `$uri$is_args$args`, honouring `immutable`, with a 20 GB cap.

## 9. Storage estimates (year 1, today's volumes)

| Store | Daily | Retention | Size |
|---|---|---|---|
| Raw `ndjson.zst` (AIS 0.4, OpenSky + adsb.fi 0.35, others 0.1 GB/day) | ~0.85 GB | 90 days | ~77 GB |
| `tracks/l0` served | ~0.15 GB | 14 days | ~2 GB |
| `cold/tracks/l0` | | forever, deletable | ~55 GB/yr |
| `tracks/l1` / `l2` | 0.03 / 0.015 GB | 90 days / forever | ~3 GB / ~6 GB per yr |
| `tracks/tle.db` | ~5 MB | forever | ~2 GB/yr |
| `stream/*.db` (~300k events/day, uncompressed, with index) | ~45 MB | forever | ~16 GB/yr |
| `history.db` (imports, revisable live events, documents) | small | forever | ~2 GB + ~1 GB/yr |
| `catalog.db` (entities, identifiers, camera history) | small | forever | ~1 GB |
| `geo/*.db` (US infrastructure, GLWD, admin0, with generalised pieces) | once | | ~5–7 GB |
| `tiles/`, nginx cache | | capped | ≤ 20 GB |
| **Total** | | | **~190 GB after year 1, then ~80 GB/yr** |

That fits in 1 TB for about 5 years. The cold L0 shards and the raw archive are the two settings to turn down if disk gets tight.

*Measured 2026-10-12:* one backfilled adsb.lol day added about 125 MB to L1 and 45 MB to L2, 3–4× the daily figures above. A backfilled day is denser than live polling, so check L1 and L2 against a week of live data before relying on them.

## 10. Performance

### 10.1 SQLite settings

| Setting | Value | Why |
|---|---|---|
| `journal_mode` | `WAL` | Readers never block the writer |
| `synchronous` | `NORMAL` | Durable at checkpoints. A power cut can lose the last transactions, and the archive replays them. |
| `busy_timeout` | `5000` | Serialises the occasional second writer |
| `cache_size` | writer `-131072` (128 MB), reader `-32768` | |
| `mmap_size` | `4294967296` | Reads go through the OS page cache with no copies |
| `temp_store` | `MEMORY` | |
| `page_size` (set at creation) | 16384 for tracks, stream and geo; 4096 for catalog and history | Large pages suit blob- and R\*Tree-heavy files |
| `wal_autocheckpoint` | `0` on the writer, which then runs `PASSIVE` every 30 s and `TRUNCATE` every 6 h | Keeps checkpoints off the ingest path |
| `journal_size_limit` | 64 MB | |
| `foreign_keys` | `ON` (only within a file) | |

Sealed shards are `VACUUM INTO`'d, `ANALYZE`d and then opened read-only.

### 10.2 Connections and threads

- **Worker:** one write connection per file, with prepared statements and batched transactions.
- **api:**
  - Read-only handles are opened lazily, with an LRU of at most 64 open shard handles.
  - **`better-sqlite3` is synchronous.** Route handlers only run indexed lookups that take under 5 ms.
  - Tile encoding, chunk assembly over several shards, and histograms run in a `worker_threads` pool (`piscina`, 3 threads). Each thread has its own read-only handles.
- **Importers:** run in their own process at `nice 10`, with at most 4 workers, as the project memory notes require.

### 10.3 Budgets

| Path | Target |
|---|---|
| Ingest | 2,000 fixes/s into memory plus the archive, at under 15% of one core. One hour seals in under 60 s. |
| Upstream → live | p95 under 5 s. Sealed history follows about 2 h later. |
| Scrubbing loaded buckets | No network; under 4 ms per frame |
| Cached tile or chunk | p95 under 20 ms (nginx) |
| Cold MVT tile | p95 under 300 ms |
| Cold track chunk | p95 under 100 ms (one R\*Tree probe plus copying bytes) |
| Track payload | ≤ 1 MB per z7 tile-hour at L0; ≤ 10 MB per world-day at L2 |
| Web and api process memory | Under 1 GB each once live state moves to the worker |

## 11. Portability: staying ready for Postgres

### 11.1 Rules

1. **Table names map mechanically:** `prefix_name` becomes `prefix.name` (`ev_event` → `ev.event`). Layer files map to `geo.feature` with a `layer_id`, and shards map to hypertable chunks.
2. **Only four column types:** `INTEGER`, `REAL`, `TEXT` and `BLOB`. Tables are `STRICT`, so SQLite enforces types the way Postgres does.
3. **Times are epoch milliseconds as `INTEGER`.** Validity uses `_lo`/`_hi` pairs: a null `_hi` means open, and `_lo = −8.64e15` means since forever.
4. **Geometry is WKB in a `BLOB`,** plus `lon`/`lat` columns for points and bounding boxes in the R\*Tree. Nothing relies on SQLite-only geometry functions.
5. **JSON is stored as `TEXT`.** Only `json_extract` and `->>` are used, and only inside the store layer.
6. **Only SQL both engines run:** `ON CONFLICT … DO UPDATE … WHERE`, `RETURNING`, CTEs, window functions, partial indexes and `UPSERT`-style idempotency.
   - Never `INSERT OR REPLACE`: it deletes and re-inserts, which changes the rowid.
   - Never rely on type affinity, and never use an implicit rowid except as the R\*Tree join key.
7. **Engine-specific code stays inside `src/lib/db/sqlite/`:** R\*Tree, FTS5, sharding and `ATTACH`. A lint rule forbids SQL strings outside `src/lib/db/**`.
8. **Ids allocated in SQLite are kept in Postgres;** the identity sequences restart above the maximum.
9. **Constraints Postgres would enforce** (validity periods that don't overlap, cross-file references) are enforced by the writers and checked by `npm run db:check`.

### 11.2 Store interfaces (the only callers of SQL)

```ts
interface CatalogStore  { resolve(scheme: string, value: string, at: number): EntityId | undefined; upsertEntities(rows: EntityRow[]): void; applyCatalogDiff(source: SourceId, run: RunId, records: CatalogRecord[]): DiffResult; cameraTile(z: number, x: number, y: number, at?: number): Uint8Array }
interface EventStore    { upsert(rows: EventRow[]): void; appendStream(rows: StreamRow[]): void; tile(q: EventTileQuery): Uint8Array; histogram(q: HistogramQuery): Bin[] }
interface TrackStore    { sealBucket(lod: Lod, bucket: number, segments: Segment[]): void; chunk(q: TrackChunkQuery): Uint8Array; tleAt(t: number): Tle[] }
interface SeriesStore   { upsertPoints(rows: PointRow[]): void; metric(metricId: number, allowed: SourceSet): SeriesPayload }
interface FeatureStore extends ReferenceStore { tile(layer: string, z: number, x: number, y: number): Uint8Array; publishLayer(layer: string, file: string): void }
interface DocStore      { upsert(rows: DocRow[]): void; link(rows: DocLink[]): void; forTarget(type: TargetType, id: number): DocRow[]; search(q: string): DocHit[] }
```

`TAKIP_DB=sqlite` (the default) selects the SQLite implementations. A Postgres set implements the same interfaces later, and nothing outside `packages/db` changes.

*Built:* `packages/db` (`@takip/db`):
- **`CatalogStore`:** sources and switches, `resolve` and `ensureIdentities` with the in-memory id cache, sealed buckets and shards, coverage, ingest runs, and the per-tier `policy`.
- **`TrackStore`:** `sealBucket`, `chunk`, `segmentsByEntity`, `insertTles` and `tleAt`, with an LRU of up to 64 read handles.
- **Shared code:** `openWriter` and `openReader` (the §10.1 pragmas), the data layout, and a migration list per file kind in `src/schema/`, tracked with `PRAGMA user_version`. These are TypeScript strings rather than `.sql` files, as `apps/api` does it, and are append-only.

The other interfaces go into `src/history-stores.ts` with the importers (§7.5).

### 11.3 Type mapping and the move

| SQLite now | Postgres later |
|---|---|
| `INTEGER PRIMARY KEY` | `bigint GENERATED … AS IDENTITY` (sequence set above the maximum) |
| `INTEGER` epoch ms | `timestamptz` (via `to_timestamp(ms / 1000.0)`) |
| `t_lo`/`t_hi`, `valid_lo`/`valid_hi` + R\*Tree time dimension | `tstzrange` + GiST |
| WKB `BLOB` + R\*Tree bbox | `geometry` + GiST |
| `TEXT` JSON | `jsonb` |
| FTS5 (trigram) | `tsvector` + GIN, and `pg_trgm` |
| Time-sharded files | Hypertables (or native partitions) |
| `geo/<layer>@<v>.db` | `geo.feature` partition per layer |
| `source_mask INTEGER` | `smallint[]` (or keep the mask) |
| Overlap checks in the writer | `EXCLUDE USING gist` |
| `ATTACH 'x.db' AS x` | Schema `x` |

Steps to move:

1. Create [`replay-schema.postgres.sql`](./replay-schema.postgres.sql).
2. Run `npm run db:export --to postgres://…`. For each table and shard (listed in `meta_shard`), it streams rows with `COPY` and converts types as in the table above. R\*Tree and FTS tables are rebuilt as GiST and GIN.
3. Compare row counts and checksums per table and shard.
4. Set `TAKIP_DB=postgres` and bump layer versions so caches roll over. The API, wire formats and tile URLs stay the same.
5. Keep the SQLite files read-only for a while as a rollback.

**A partial move is also valid.** `catalog.db`, `history.db` and the stream can go to Postgres while the sealed track shards stay as files. They are blobs looked up by key, and Postgres adds little for them.

## 12. When to move to Postgres

Move when **any** of these is true:

- **A second host or process has to write:** ingest on another machine, or several web replicas behind a load balancer.
- **Analysis goes beyond bounding boxes:** polygon × polygon over large sets (hazard areas × infrastructure, impact analysis), buffers or network queries.
- **Write contention shows up:** `busy_timeout` waits on `catalog.db` during normal operation.
- **Read load outgrows the cache:** more than about 50 concurrent users with cache-missing queries, or a cold tile p95 over 300 ms after caching.
- **User accounts and collaborative data arrive with the paid tier:** annotations, team workspaces, saved replays.
- **A single hot file grows past about 100 GB** (`history.db` or a stream shard), making `VACUUM` and backups painful.

## 13. Build order

| Phase | Scope | Unblocks |
|---|---|---|
| **0, now** | `./data` volumes and ownership. The recorder and its taps (§7.1). Stop dropping OpenSky `time_position`. Stable GDACS and conflict ids. Disk guard. | Starts recording live history |
| **1a** | `src/lib/db` with the store interfaces and SQLite implementation. A migration runner: numbered `.sql` files per file kind, tracked with `PRAGMA user_version`. Seeds: licences, sources, Natural Earth admin-0, code crosswalk, aliases. **Move today's file caches into SQLite:** `.cache/cctv-catalog.json` → `catalog.db` cameras (camera catalogue history starts), `.next/cache/satellites-tle-cache.json` → `tracks/tle.db` (orbit history starts), `.cache/nominatim.json` → `cache.db`. | Everything below |
| **1b** | Importers → `history.db` and `geo/*.db`. `ReferenceStore` on SQLite. | The historical atlas, which needs no live data |
| **1c** | `takip-ingest`: AIS, OpenSky and CCTV connectors moved out of Next, seal jobs, stream shards, coverage | Replay over recorded days |
| **2** | `/api/replay/*` and `/api/tiles/*`, the timeline UI (one time controller with an adapter per shape), the GPU track layer, the nginx cache | The replay feature |
| **3** | FIRMS, GDELT and news streams; documents; aggregates; density maps; correlation. Postgres once a §12 trigger is hit. | `ARCHITECTURE.md` phase 3 |

**Where it stands (2026-10-12):**
- **Phase 0, built:**
  - The recorder (`packages/archive`), with its frame-splitting reader, heartbeats, drop lines and disk guard.
  - Taps for OpenSky, adsb.fi, AIS, CelesTrak and the camera catalogue (§7.1).
  - Recording on in `docker-compose.yml`, and the worker's keep-alive.
- **1a, partly built:** `packages/db` with every file kind's schema (the fixes are listed in `replay-schema.sqlite.sql`), seeds for licences, sources, entity types, identifier schemes and link relations, and the two stores (§11.2).
  - The TLE cache move became archive-derived: `tracks/tle.db` is filled from recorded CelesTrak payloads.
  - *Deferred:* the camera catalogue → `catalog.db` cameras, nominatim → `cache.db`, and the remaining seeds, which go with the importers.
- **1c, partly built:** `apps/ingest` with the worker, connectors' `map()`, L0 sealing, L1 and L2, TLE loading, coverage and the source switches (§7.3, §7.6). Connectors still poll from Next.
- **2, partly built:** `/api/replay/manifest`, `/tracks/…` and `/tle` in `apps/api`, plus the admin Sources page, and the client.
  - **Client:** a clock button under the zoom controls; a timeline bar in place of the status bar while replaying, with play, speeds from 1× to 1 year/s, a jump box ("1916", "2003-03-20", "500 BCE"), ranges from 24 h to all of history, and "not recorded" shading; and the WebGL track layer.
  - *Not built:* event and feature tiles (the importer session is building the history route and layer), histogram, series, docs, entity-at-time, picking a replayed track, and the nginx rules.
- **Recording is on (2026-10-12 20:58 UTC)** in development: `TAKIP_ARCHIVE_DIR` and `TAKIP_WEB_URL` are in `.env.local`, and the worker runs beside `npm run dev`. Backfill is built for adsb.lol history, OpenSky and USGS (§7.7).
- **Earthquakes recorded since 2026-10-12** (USGS, M2.5+, with the 30 days before filled on first start). They replay through the importer session's history layer, which follows the `earthquakes` toggle; ships and aircraft follow their own toggles.
- **Next:** historical events on the same timeline (importer session), clicking a replayed ship or aircraft, and the replay rate-limit bucket (backend session).

## 14. Risks and open questions

- **No backups.** All of this sits on one disk. SQLite makes backups cheap once wanted:
  - sealed shards never change, so plain `rsync` is enough;
  - the live files can be copied nightly with `VACUUM INTO`;
  - Litestream can stream WAL to S3 later.
- **No atomicity across files.** Writers follow the fixed order and idempotency of §4.2.
- **Constraints are enforced by writers and checks,** not by the engine (§11.1 rule 9).
- **WAL needs a local disk on one host.** This is the main reason a multi-host setup forces the move.
- **`better-sqlite3` packaging:** it must work in Next's standalone output and on musl Alpine. Verify both in phase 1a.
- **The driver is synchronous.** Anything heavy belongs in the thread pool (§10.2), or it will stall the web server.
- **Licences are unverified:** GTD is non-commercial; OpenSky and Yahoo restrict redistribution. Gating is built in, but each tier's policy needs a decision.
- **AIS only has receive time.** If aisstream exposes per-message timestamps, use them.
- **OpenSky quota:** keep a single poller until the worker owns it.
- **Recording depends on the keep-alive** until connectors move to the worker. If `TAKIP_WEB_URL` isn't set and nobody has the map open, the archive has gaps. Coverage shows them as `not_recording`.
- **Anonymous OpenSky** refreshes only every 15 minutes, so aircraft tracks are sparse without `OPENSKY_CLIENT_ID`. The 4-minute L0 gap then splits each fix into its own segment, at about 22 bytes per point instead of 6–9.
- **GTD keys are synthetic,** stable for the same file. An official GTD export would become a new source, linked as same-as.
- **Free-text places need a gazetteer** (GeoNames `cities15000`, CC BY). Until then those events fall back to the polity centroid.
- **Historical borders are deferred.** When a value is drawn through the render map (`via` is set), the UI has to say so.
