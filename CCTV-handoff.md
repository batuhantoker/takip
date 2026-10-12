# CCTV catalogue: hand-off

_Written 2026-10-11 against commit `83b8cd1` plus uncommitted work. The uncommitted work adds Kayseri, KYTC, nine 511 states and the Skyline fixes._

## TL;DR

- **We have 46,513 cameras today**, from 157 sources across 65 of 66 regions. That is roughly 11.7 MB of JSON (1.47 MB gzipped), and every visitor downloads all of it. The map draws every camera at every zoom level. That works at 46k but won't at 150k or more.
- **Proposal:**
  - Make **SQLite the system of record**.
  - Move all fetching out of the request path into an **ingest job**.
  - **Serve map tiles by zoom level**:
    - zoomed out: a cell grid with counts;
    - mid zoom: the best-ranked cameras per cell;
    - zoomed in: every camera in view, with details loaded on click.
- **None of the five repos below should be bulk-imported.** All are frozen snapshots, and three contain private or credentialed cameras. They are valuable as **leads for live adapters**. Argus is also useful as a **reference design**.
- **Realistic net-new from all leads is about 60–80k cameras.** Most of that comes from widening the OpenCCTV feed OSIRIS already uses, which now lists about 141k ids. Plan for 250k, with headroom to 1M.

---

## 1. Where we are now (measured 2026-10-11)

How I counted: I called `GET /api/cctv?region=all` in-process with the disk snapshot turned off and polled until the region fetches settled. Script: `$TMPDIR/opencode/count.ts`; output saved as `catalogue.json`.

| Metric | Value |
|---|---|
| Rows | **46,513** |
| Unique ids | 46,465. 48 ids are reused, from `nl-rws-*` (Rijkswaterstaat), DGT, Live Traffic and three OpenCCTV feeds. The client merges by id, so those cameras silently disappear. |
| Sources (`source` label) | 157 |
| Regions | 65 of 66 answer. `us-central` (IDOT Illinois) returns 0: `travelmidwest.com/lmiga/cameraReport.json` now sends an empty object, and the region still takes up a pool slot until it times out. |
| By type | jpg 40,958 · hls 2,811 · mp4 1,655 · link-only 753 · iframe 242 · mjpeg 94 |
| Payload | 11.67 MB JSON, 1.47 MB gzipped, about 249 B per camera |
| Bad or zero coordinates | 0 |
| Plain-http media | 20 |

**Largest sources:**

| Source | Cameras |
|---|---|
| FDOT | 4,965 |
| TxDOT | 4,354 |
| GDOT | 4,330 |
| THB (Taiwan) | 2,216 |
| UDOT | 2,082 |
| Caltrans | 2,000 |
| DGT | 1,937 |
| ASFINAG | 1,828 |
| MnDOT | 1,511 |
| PennDOT | 1,355 |
| ODOT TripCheck | 1,141 |
| NCDOT | 1,020 |
| HK Transport | 1,013 |
| Autostrade | 975 |
| TfL | 890 |

OpenCCTV contributes 2,577 cameras across about 100 sub-sources, and only for Asia.

### Duplicates already in the catalogue

| Kind | Count | Where |
|---|---|---|
| Same media URL in more than one row | 232 extra rows | 165 are **HK Transport and OpenCCTV/hongkong**; 58 are OpenCCTV twipcam and taiwan-freeway; the rest are RWS, MDOT and Nebraska repeats within one source |
| Cross-source pairs within 30 m | 288 | 189 HK; 21 twipcam vs THB; Skyline vs Samui (15); ITD vs ODOT (8); Iowa vs WisDOT (5, the Lansing ferry) |
| Rows sharing exact coordinates | 2,193 | Mostly legitimate: several views mounted on one pole. **Never treat this alone as a duplicate.** |

### How it works today, and why it won't scale

- **Fetching is tied to requests.** `src/lib/cctv/catalog/registry.ts` registers 66 region fetchers. Each one is cached in memory for 30 minutes (`lib/sourceCache`), run four at a time, with a 12 s budget and a 5-minute backoff. The whole catalogue is saved to `.cache/cctv-catalog.json`.
- **The client downloads everything.** It loads `region=all` once (`lib/camera-catalog.ts`). `components/map/world-map.tsx:2346` turns every camera into one GeoJSON source with no clustering. Labels appear from zoom 10 and preview tiles from zoom 13 (`components/cameras/cctv-previews.tsx`).
- **Other code reads the catalogue too:**
  - `lib/vision/frames.ts` (lookup by id, `stillsNear`)
  - `/api/cctv/frame`
  - OI Assist
  - spotlight search

  All of them have to move to the new store.
- **Duplicates are only half-handled.** The server joins regions without removing duplicates; the client removes them by id only. Cross-source duplicates are handled ad hoc: `COVERED_ELSEWHERE` in `opencctv.ts` and per-source bounds boxes.
- **The Docker container has no volume.** `.cache/` is lost on every rebuild (`docker-compose.yml`).
- **What breaks at 250k cameras:** the JSON would be about 60 MB per visitor, MapLibre would parse it all into a single GeoJSON source, and every region would still be refetched every 30 minutes inside the web process.

---

## 2. The repos

Research subagents assessed each repo. They cloned it, counted its records, probed samples for liveness and grepped OSIRIS for overlap. Their scratch files are in `$TMPDIR/opencode/repos/`.

| Repo | What it is | Records (claimed → counted) | Data date | License | Private-camera issues | Verdict |
|---|---|---|---|---|---|---|
| [GoSlowPoke168/Argus](https://github.com/GoSlowPoke168/Argus) | React/Deck.GL app + Python scraper → SQLite → static JSON | "200k+" → **229,308** | 2026-07-25 | MIT (code only) | 635 Opentopia (residential: driveways, offices), 172 Windy `playerUrl`s with credentials, about 34 raw device URLs | **Don't import.** 65.5% is an OpenCCTV snapshot and 31.4% is Windy. **Mine it for source leads and its storage design.** |
| [Prime3vil/CCTV](https://github.com/Prime3vil/CCTV) | Leaflet console app (Android/Electron) with a bundled JSON file | "22,000+" → **23,152** | about 2026-09-12 | MIT (code only) | Insecam-sourced cameras with invented labels; 5 leaked Caltrans `rtsp://admin:…@10.x`; a leaked OpenWebcamDB bearer token | **Don't import.** 42% already in OSIRIS; about 4.5–5k playable net-new. Mine for leads. |
| [anaghNathwani/openCAM](https://github.com/anaghNathwani/openCAM) | CLI + web app that **downloads** OpenTrafficCamMap `USA.json` | — → **7,029** (stored 6,729: 300 lost to id collisions) | upstream frozen 2024-10-05 | **none** | 5 Caltrans RTSP URLs with credentials | **Skip.** 62% overlap; about 1,450 live net-new (Ohio, Colorado). |
| [bzsasson/traffic-camera-sources](https://github.com/bzsasson/traffic-camera-sources) | CC BY 4.0 registry of 10 sources + the upstream livetrafficcam.com registry (21) | 24,159 across its upstream | weekly bot (2026-10-05) | CC BY 4.0 | none | **Best leads list.** 6 keyless US sources we lack, all endpoint-tested; uptime data too. |
| [william-ricchiuti/Live-Environment-Streams](https://github.com/william-ricchiuti/Live-Environment-Streams) | GeoJSON export of a private scenic/traffic stream database | — → **5,997** | 2026-06-12; CI broken | **none** | Bulgarian dynamic-DNS host, ~28 home YouTube cams (Davao), scraped session tokens | **Don't import.** Coordinates unreliable (926 on fallback points; median **42 km** off on shared Skyline cams); YouTube only 51% live (468 of 475 are pinned video ids). |

### What to take from each

**Argus**
- **Recommended path:** widen OSIRIS's *live* OpenCCTV integration (`opencctv.ts`, Asia-only and capped at 600–1,200 per sub-region) instead of importing Argus's frozen copy. OpenCCTV lists 141,331 ids today, and only 95k of Argus's OpenCCTV ids still match.
- **Exclusions:** Opentopia and anything windy.com-hosted.
- **Windy:** use it through its API (needs a key; image URL tokens expire after 10 min on the free tier) with attribution. Never store its URLs.
- **Leads we don't have, roughly by size:**
  - Taiwan twipcam/freeway (~5.4k)
  - National Highways England (2.3k)
  - feratel (1.75k)
  - Houston TranStar (1.56k)
  - VDOT (1.46k)
  - OpenSnow (1.25k)
  - ALERTCalifornia (1.25k)
  - NYC DOT (968)
  - PhenoCam (891)
  - Bayern Info, Vegvesen, Ohio, NavCanada, 511NY
- **Design worth copying:**
  - Data is split three ways: `cameras.core.json` (229k cameras in 7 MB as parallel arrays of lon/lat/type/source with dictionaries), labels, and `detail/N.json` chunks of 1,000 fetched on demand.
  - `dedupe_prefer_native`: drop aggregator rows whose host and path match a native adapter.

**Prime3vil/CCTV**
- Official feeds to integrate directly:
  - NYC DOT (975): `webcams.nyctmc.org/api/cameras`
  - Austin (1,005): Socrata `data.austintexas.gov/resource/b4k4-adkb.json`
  - Ohio (1,091): `itscameras.dot.state.oh.us`
  - Indonesia toll roads (~1,086): `data.trafficvision.live/camera-data/bpjt-cameras.json`
  - Colorado (see below)
- Dead in their data: Virginia skyvdn, Alabama Wowza, OKTraffic, Delaware.

**openCAM**
- One lesson: key cameras on **source + native id**, never on a hash of location and description. That is how it lost 300 cameras.
- A side finding we should act on: Caltrans' ArcGIS layer has `streamingVideoURL` for 1,964 cameras. OSIRIS only reads `currentImageURL`. It's a cheap upgrade to HLS; drop the `rtsp:` URLs.

**traffic-camera-sources** (all verified keyless, 2026-10-11)

| Lead | Cameras | Endpoint / notes |
|---|---|---|
| FAA WeatherCams | 3,549 at 980 sites, incl. 645 NAV CANADA | `weathercams.faa.gov/api/cameras`; the latest image needs one call per camera |
| CDOT COtrip | 1,037 cameras / 1,346 views; HLS + PNG | **New** endpoint `api-511x-co.carsprogram.org/cameras/map-features`. The old GraphQL now redirects, so `cars.ts` won't work as-is. |
| SCDOT | 789 | One shared Iteris loader covers SC, SD and MT: `{st}.cdn.iteris-atis.com/geojson/icons/metadata/icons.{cameras,rwis}.geojson` |
| SDDOT | 713 views | same Iteris loader |
| MDT | 464 | same Iteris loader |
| MassDOT | 309 | Works with the existing `cars()` helper: **one line in `us-511.ts`** (`mass511.com`) |
| KC Scout | 72 missing | Missouri-side cameras outside our Kansas box. Also, about 83 Missouri-side cameras *inside* the box are captioned "Kansas": the state line near KC is about −94.61, not −94.5. |

Uptime in their data worth tracking: Las Vegas 347/347 dead, NV 61% dead, GA 27.6% dead and 48.9% stale, CA 23.7% dead, ID 31% dead.

**Live-Environment-Streams**
- About 725 Skyline pages we don't have. Re-geocode them, then run them through the existing resolver.
- About 240 live YouTube ids. Convert them to `/@handle/live` before storing.
- About 300 scenic HLS streams (webcamera.pl, beachcam MEO, mazury24, Central Asian city cams).
- VDOT, MD SHA and NYSDOT as pointers to their official APIs.

### Rough potential

| Bucket | Net-new | Confidence |
|---|---|---|
| OpenCCTV beyond Asia, live and filtered | ~40–50k | medium (Argus cleanup estimate) |
| Official US leads (FAA, CO, SC, SD, MT, MA, NYC, Austin, Ohio, VDOT, Houston, 511NY, CA HLS upgrade) | ~12–15k | high (endpoints tested) |
| International leads (England, feratel, Bayern, Vegvesen, Taiwan twipcam, Indonesia) | ~10–12k | medium |
| Scenic (Skyline extras, YouTube, HLS) | ~1–1.5k | medium |

---

## 3. Storage: SQLite (recommended)

**Why SQLite fits:**
- One writer (the ingest job) and many readers (requests). In WAL mode, readers don't block the writer.
- Built-in R\*Tree for bounding-box and nearby searches, and FTS5 for name search.
- It's a single file that can be backed up and shipped.
- Verified here: Node 24's built-in `node:sqlite` ships SQLite 3.53.3 with R\*Tree and FTS5 working.
- `better-sqlite3` is the safer production choice. It's faster, synchronous and well-trodden, and it has musl prebuilds for the `node:22-alpine` image.

| Option | When |
|---|---|
| **SQLite** (+ R\*Tree, FTS5) | **Default.** Docker or a single host. Needs a **volume** (`/app/data`); today the container has none. |
| PostGIS | Several app instances writing, or heavy spatial SQL (proper deduplication with `ST_DWithin`, geometry types) |
| Turso/libSQL, or a read-only SQLite artifact | Vercel: its filesystem is read-only and every instance is ephemeral. Build the DB in CI or cron, ship or download it, and open it read-only. |
| PMTiles (tippecanoe) | An optional *output* of ingest, for CDN-served tiles. Not a store. |
| DuckDB spatial | Offline analysis of imports. Not for serving. |

### Schema sketch

```sql
-- Who we pull from, and how much we trust them
CREATE TABLE source (
  id TEXT PRIMARY KEY,              -- 'fdot', 'opencctv:hongkong', 'skyline'
  kind TEXT NOT NULL,               -- operator | platform | aggregator | curated
  priority INTEGER NOT NULL,        -- operator 100 > platform 80 > aggregator 40 > curated 20
  owns_hosts TEXT,                  -- JSON ["fl511.com", ...]; aggregator rows on these hosts are dropped
  bounds TEXT,                      -- JSON bbox; rows outside it are rejected
  attribution TEXT, terms_url TEXT, refresh_s INTEGER, last_ok_at INTEGER, last_error TEXT
);

-- Every upstream record exactly as it was seen: the alias table
CREATE TABLE observation (
  source_id TEXT NOT NULL REFERENCES source(id),
  native_id TEXT NOT NULL,          -- the upstream's own id; never a hash of name or coordinates
  camera_id INTEGER NOT NULL REFERENCES camera(id),
  media_key TEXT,                   -- normalised media identity (see §4)
  lat REAL, lng REAL, name TEXT, raw TEXT,
  first_seen INTEGER, last_seen INTEGER,
  PRIMARY KEY (source_id, native_id)
);
CREATE INDEX observation_media ON observation(media_key);

-- The deduplicated camera the map shows
CREATE TABLE camera (
  id INTEGER PRIMARY KEY,           -- rowid; also the R*Tree id
  public_id TEXT UNIQUE NOT NULL,   -- stable external id, e.g. the first (source:native_id)
  lat REAL NOT NULL, lng REAL NOT NULL,
  qk TEXT NOT NULL,                 -- quadkey at z16, for tiles and clusters (§6)
  name TEXT NOT NULL, city TEXT, country TEXT,   -- country as ISO-2
  category TEXT,                    -- traffic | scenic | weather | landmark
  media_type TEXT NOT NULL,         -- jpg | mjpeg | hls | mp4 | iframe | link
  feed_url TEXT, stream_url TEXT, external_url TEXT,
  primary_source TEXT NOT NULL REFERENCES source(id),
  status TEXT NOT NULL DEFAULT 'unknown',  -- live | stale | dead | offline | placeholder | unknown
  rank INTEGER NOT NULL DEFAULT 0,  -- decides who shows at mid zoom (§6)
  checked_at INTEGER, ok_at INTEGER, dead_since INTEGER
);
CREATE INDEX camera_qk ON camera(qk);
CREATE VIRTUAL TABLE camera_rtree USING rtree(id, min_lat, max_lat, min_lng, max_lng);
CREATE VIRTUAL TABLE camera_fts USING fts5(name, city, content='camera', content_rowid='id');

-- Things we never want back
CREATE TABLE blocklist (pattern TEXT PRIMARY KEY, kind TEXT, reason TEXT);  -- host | url_regex | source
CREATE TABLE tombstone (media_key TEXT PRIMARY KEY, reason TEXT, at INTEGER);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);  -- catalogue_version, used in tile URLs and ETags
```

---

## 4. Avoiding duplicates

Run these layers in order at ingest; every merge is recorded through `observation.camera_id`.

1. **Upstream identity.** Use `(source_id, native_id)` as the primary key.
   - Never key on name, coordinates or `hash(url)`. openCAM lost 300 cameras that way, and Prime3vil's `hash()` changes on every run.
   - Ids are always namespaced by source (this already exists: `fdot-`, `mndot-`…). The 48 reused `nl-rws-*` and other ids need fixing in their adapters.
2. **Media key.** Two rows with the same normalised media are the same camera. Normalising means:
   - unwrap `/api/cctv/proxy?url=`;
   - lowercase the host; drop the scheme and default ports;
   - strip cache-busters (`?\d+`, `_t`, `t`, `ts`, `timestamp`, `token`, `bltoken*`);
   - fold case on paths for hosts known to ignore it (Iowa's `Public/` vs `public/`);
   - reduce known platforms to their ids: YouTube → video or channel, Skyline → its numeric id (`liveNNN`/`socialNNN`), Windy → webcam id, EarthCam → stream id (the Roebling and Covington cameras were both stream `25303`).

   This alone fixes the 232 same-URL duplicates measured above.
3. **Host ownership.** Generalise `COVERED_ELSEWHERE` into `source.owns_hosts`: drop aggregator rows on hosts a native adapter owns. That clears HK Transport vs OpenCCTV/hongkong (165), twipcam/taiwan-freeway vs THB, and most of OpenCCTV beyond Asia (which republishes state 511 feeds). It's the same idea as Argus's `dedupe_prefer_native`.
4. **Bounds and cross-border ownership.** Each source has a bounding box, and each border strip has one owner. Examples:
   - KYTC lists Indiana cameras;
   - Idaho lists Nevada's;
   - KDOT includes Missouri;
   - WisDOT carries Iowa's Lansing ferry cameras.
5. **Spatial match, for review only.** For candidates from *different* sources within about 30 m (an R\*Tree query), compare normalised names (token overlap after expanding I-/SR-/US-) and media type.
   - Merge automatically only above a strict threshold. Otherwise flag the pair for review.
   - **Never merge within one source**: several views on one pole are real (2,193 such rows today).
6. **Optional image hash.** For JPEG pairs still ambiguous after step 5, a dHash of one frame settles it cheaply.
7. **Priority and failover.** On a merge, the primary is the highest-priority *live* observation (operator > 511 platform > aggregator > curated). The others are kept as fallbacks, so when the primary dies the camera switches over instead of disappearing.

---

## 5. Keeping it from bloating

**Admission rules at ingest** (cheap, and they reject most of the junk in the five repos):

- **Coordinates:**
  - must be inside the source's bounds;
  - not (0,0), not a country centroid, not the MaxMind "somewhere in the US" point `37.751,-97.822` (59 Opentopia rows sit there);
  - reject **fallback points**, meaning 3 or more differently named cameras on one point;
  - reject coordinates with 2 or fewer decimals unless the source is trusted.
- **URL:**
  - https, or proxied through an allow-listed host;
  - no credentials (`user:pass@`, `pwd=`);
  - no RFC1918 or loopback addresses;
  - no placeholder schemes (`faa-weathercam://`) or `{timestamp}` templates;
  - no expiring tokens. Store the page and resolve the token at view time, as Skyline and Kayseri already do.
- **Privacy blocklist:**
  - Opentopia and Insecam-style lists;
  - device paths on residential or dynamic-DNS hosts (`/axis-cgi/mjpg/video.cgi`, `:8080/video`, `guestimage.html`, `nphMotionJpeg`).
  - **OpenCCTV `opentopia` is in the live catalogue right now: 4 cameras ("Parking Lot", "Security webcam").** Fix now.
- **Never import other people's snapshots.** All five repos are frozen; we want live adapters and re-check everything ourselves. Their `status` and `verified` fields are meaningless (Prime3vil's status is hard-coded `"ONLINE"`).

**Lifecycle**

- **Health checker** (in the background, sampled at about N per minute per host):
  - `live`;
  - `stale`: `Last-Modified` older than 24 h, or a frozen frame;
  - `placeholder`: a known "no feed" image hash. Alaska and Arizona serve the same 15,136-byte PNG with md5 prefix `9c2d059e`;
  - `dead`: N failures in a row;
  - `offline`: the source itself says the camera is off air (the Skyline banner).
- **What happens to dead cameras:**
  - **Hide** cameras that have been dead for more than 3 days.
  - **Delete** after 30 days.
  - Write the media key to a **tombstone**, so a re-import doesn't bring it back.
- **What happens when a source disappears:**
  - Its cameras fail over to fallback observations.
  - Cameras with nothing left are hidden.
  - A run that comes back more than 5% short is a failed run, not a smaller catalogue (`ibi511.ts` already applies this rule).
- **Ranking:** set `rank` from live status, video > snapshot, operator vs aggregator, and recency. Rank decides what's visible at mid zoom, so the map doesn't get noisier as the catalogue grows.
- **Keep rows small:**
  - Raw upstream JSON stays in `observation.raw`, capped or dropped after a week.
  - Tiles carry only `id, type, status, rank`.
  - Everything else is fetched by id on click.

---

## 6. Loading by zoom: close up shows every camera, far away still shows something

**Today:** all 46.5k points are sent and drawn at every zoom.

**Target:** the map asks only for what's in view, at the detail the zoom can show.

| Zoom | What a tile carries | How |
|---|---|---|
| 0–7 (world → country) | **Cell aggregates**: count, a by-type breakdown, and one representative camera. Drawn as bubbles sized by log(count), or as a heatmap. **Never empty**, so distant cameras stay visible. | `SELECT substr(qk,1,z+3) cell, count(*), … WHERE qk BETWEEN :prefix AND :prefix\|\|'~' GROUP BY cell` |
| 8–11 (region → city) | The **top-K cameras per cell by `rank`**, plus a count of the rest. Ordering is deterministic (`rank`, then hash(id)), so points don't shuffle while panning. | the same quadkey prefix query with a window function |
| 12+ (streets) | **Every camera** in the tile with minimal fields. Over-zoom past 14 on the client. Preview tiles (`CctvPreviews`, z≥13) read from the same data. | quadkey prefix range on `camera_qk` |
| click | Full record: feeds, external link, sources and fallbacks | `GET /api/cctv/camera/:public_id` |

- **Endpoint:** `GET /api/cctv/tiles/{z}/{x}/{y}.pbf?v={catalogue_version}`, returning MVT.
  - Generate tiles from the query above. Alternatively, build a `supercluster` index from the DB after each ingest and use `getTile`, then encode with `vt-pbf`.
  - Cache tiles in the existing nginx cache in `docker-compose`, keyed by version, with long `Cache-Control`. The version changes only when ingest commits.
- **Client:**
  - Replace the `cctv` GeoJSON source with a MapLibre **`vector` source** (`maxzoom: 14`). MapLibre then loads only visible tiles, caches them and over-zooms, which is "load as you get closer" without custom code.
  - Cluster bubbles use `point_count`. Single cameras keep the current `cctv-dots` style.
  - Load the world summary (zoom 0–3) first, so the globe shows camera density immediately.
- **Other consumers:**
  - `vision/frames` `stillsNear` becomes an R\*Tree query.
  - The frame route and OI Assist look up by `public_id`.
  - Spotlight search uses FTS5.
- **Alternative if there's no time for tiles yet:** `GET /api/cctv?bbox=…&z=…` returning the same three shapes as GeoJSON, with `setData` on `moveend` (debounced, previous request aborted). It's simpler, but has no tile cache and makes panning less smooth.
- **Fully static option:** at the end of ingest, export PMTiles with tippecanoe (`--cluster-distance`, `--drop-densest-as-needed`) and serve them from a CDN. There's no DB at request time, but status changes need a rebuild.

---

## 7. Ingest pipeline

```
adapters (existing fetchers: mapIbi511Record, mapCarsSnapshot, opencctv, …)
   → normalise to {source_id, native_id, lat, lng, name, media…}
   → admission rules (§5)  → upsert observation
   → dedup/merge (§4)      → upsert camera, rtree, fts
   → rank + status         → bump meta.catalogue_version
   → (optional) rebuild PMTiles / warm the low-zoom tiles
```

- **Where it runs:** a separate process (`npm run ingest`, or a container in `docker-compose`), or a scheduler in instrumentation.
  - The web route reads the DB only.
  - That removes the 12 s budgets, backoff and pool from `GET /api/cctv`.
- **Schedules per source:**
  - DOT index lists every 6–24 h;
  - OpenCCTV index daily, then a batch fetch;
  - the health checker runs continuously.
- **Adapter interface:** `fetch(): AsyncIterable<Observation>`.
  - The existing parsers already produce `CctvCamera`; they need `native_id` added.
  - Keep each adapter's unit tests and verbatim fixtures (the current pattern).
- **Migrating from the current route:**
  1. Run ingest from the existing `RAW_REGION_FETCHERS`.
  2. Have `GET /api/cctv?region=all` serve from the DB, so it's backwards compatible.
  3. Switch the client to tiles.
  4. Remove the region machinery.

---

## 8. Quick fixes found during this audit (independent of the DB)

1. **Remove OpenCCTV `opentopia`**: 4 private cameras are live in the catalogue now. Add a sub-source exclusion in `opencctv.ts`. Also consider `ipcamlive*` (dead) and `windy*` (terms of use).
2. **HK duplicates:** add `tdcctv.data.one.gov.hk` (HK Transport's host) to `COVERED_ELSEWHERE` (165 duplicates). Add `thb.gov.tw` too, but not all of twipcam: most of it is `freeway.gov.tw` and city systems OSIRIS doesn't carry.
3. **Fix the 48 reused ids**: `nl-rws-*`, DGT, Live Traffic and OpenCCTV hk/twipcam/windy.
4. **`us-central` (IDOT):** the upstream returns no cameras and the region still occupies a pool slot. Remove it or replace it with a working Illinois source.
5. **Kansas box:** the east edge is −94.5, but the KC state line is about −94.61, so about 83 Missouri cameras are captioned "Kansas". Tighten the box near KC, or caption by state.
6. **MassDOT:** one line in `us-511.ts`.
7. **Caltrans:** read `streamingVideoURL` (1,964 HLS streams; drop the `rtsp:` ones).
8. **Docker:** add a volume for `.cache/` now, and for the DB later.
9. **README:** it says "17,000+"; the count is 46.5k.

---

## 9. Open questions

- **Deploy target:** if Vercel stays, we need a read-only artifact or Turso. With only Docker, use SQLite on a volume.
- **Windy:** is an API key and its attribution acceptable? It's the largest single scenic source.
- **Policy for scenic and home cameras** (e.g. the Davao house cams on YouTube): allow, review case by case, or block?
- **Re-hosting snapshots:** the proxy currently passes images through only. Do we ever cache frames, and if so, what are the legal and storage limits?
