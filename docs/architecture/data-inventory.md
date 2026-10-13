# Data inventory

> **Snapshot:** 2026-10-12, about 20:00 EDT (2026-10-13 00:00 UTC). The counts were read from the files under `data/` and will drift. The live record is `catalog.meta_source` (sources), `catalog.meta_dataset` (imports), `catalog.meta_coverage` (recording) and `catalog.meta_shard` (files).
> **2026-10-13:** the `tradewar` source (tariff timeline, stock, currency and trade series) was removed; the counts below are after the removal.
> Related: [`replay-database.md`](./replay-database.md) (design, retention), [`dataset-import-map.md`](./dataset-import-map.md) (how each dataset maps to tables), [`backend.md`](./backend.md) (app data), [`data/reference/README.md`](../../data/reference/README.md) (reference files), [`DATA-SOURCES.md`](../../DATA-SOURCES.md) (candidates, not what we use).

## 1. Where data lives

| Path | What | Size | Written by |
|---|---|---:|---|
| `data/db/catalog.db` | Entities and identifiers, polities, plus the registry: sources, datasets, licences, coverage, shards | 15 MB | importers, ingest |
| `data/db/history.db` | Events, time series and documents | 585 MB | importers, ingest (USGS) |
| `data/db/geo/<layer>@<v>.db` | Map layers, generalised per zoom band: `admin0`, `unesco-whc`, `glwd-lakes`, `ww2-europe` | 83 MB | importers |
| `data/db/tracks/l0/YYYY/MM/DD.db` | Aircraft and ship tracks at full resolution, one file per day | 294 MB | ingest (`seal-tracks`) |
| `data/db/tracks/l1/YYYY-MM.db`, `l2/YYYY.db` | The same tracks simplified, one file per month and per year | 156 MB + 122 MB | ingest |
| `data/db/tracks/tle.db` | Satellite orbital elements (TLEs) | 4 MB | ingest |
| `data/archive/raw/<source>/` | Raw upstream replies as received (hourly `.ndjson.zst`), kept so tracks can be rebuilt | 511 MB | web app (`packages/archive`), backfill CLI |
| `data/db/app.db` | Users, sessions, plans, subscriptions, API keys, workspaces, usage, jobs, audit. **Holds personal data.** | 0.5 MB | `apps/api` |
| `data/backups/` | Daily `app.db` snapshots, newest 14 kept ([runbook](../runbooks/app-db-restore.md)) | 0.2 MB | `apps/api` |
| `data/reference/` | 20 slimmed US infrastructure and airport files, served by `/api/reference` when installed (gitignored) | 308 MB | `tools/slim-geodata.py` |
| `docs/data/raw-2026-10-12*/` | Raw downloads the imports and reference files were built from (gitignored) | 5.2 GB | by hand |

**Bundled with the web app** (static files, shipped in the build):

| Path | What | Records | Size | Source, licence |
|---|---|---:|---:|---|
| `src/lib/cctv/generated/*.generated.ts` | Camera lists scraped once (generators in `scratch/scrape_*.js`) | ~8,800 across 9 files | 0.9 MB | OpenWebcamDB 1,372 (**API terms are non-commercial**), SkylineWebcams 609, public operator webcams 300, Japan MLIT rivers 4,312, SANRAL 1,239, Fintraffic 764 (CC BY 4.0), WYDOT 172; most licences unknown |
| `src/lib/cctv/sources/**` | Hand-coded camera lists (Poland, Spain, France, Japan, Italy) | ~200 | small | per operator |
| `public/data/boundaries/` | Countries (50m) and states/provinces (10m) | 242 + 4,580 | 8.3 MB | Natural Earth, public domain |
| `public/data/submarine-cables.json` | Submarine cables | 717 | 0.6 MB | TeleGeography; **verify, may be non-commercial**. `submarine-cables-filtered.json` is a byte-identical copy |
| `public/data/sky/bright-stars.json` | Stars to magnitude 5.5 | 2,887 | 80 KB | Yale Bright Star Catalogue |
| `public/data/sky/nearby-stars.json`, `milky-way-*.jpg` | 3D nearby stars, Milky Way sky and face-on images | 12,807 stars | 1.4 MB | Gaia DR3 + Hipparcos (credit), NASA SVS (PD), NASA/JPL-Caltech (credit) |
| `public/data/cosmos/` | Galaxies and quasars in 3D, CMB map | 43,463 + 299,001 | 6 MB | 2MASS Redshift Survey, SDSS DR17 (acknowledgement required), WMAP (PD) |
| `public/data/paleo/` | Plate rotations 1.8 Ga → now; temperature and CO₂ per stage | 1,212 plates, 85 rows | 0.9 MB | Müller et al. 2025 (CC BY 4.0); PhanDA (no licence stated) |

The sky, cosmos and Milky Way files are not committed yet. Mission notes (71 craft), landing sites (38) and deep-time chapters (14) are hand-written TypeScript.

## 2. Data model

| Store | Tables | Holds |
|---|---|---|
| catalog | `core_entity`, `core_entity_identifier`, `core_entity_name` (FTS), `core_entity_link`, `core_polity`, `core_region_member` | Things that persist: aircraft, vessels, countries (with validity periods), organisations, places. One entity can carry many identifiers (`icao24`, `mmsi`, `iso3`, `cow`, `gw`, …). |
| catalog | `meta_source`, `meta_dataset`, `meta_licence`, `meta_access_policy`, `meta_coverage`, `meta_dataset_gap`, `meta_shard`, `meta_layer_version`, `meta_ingest_run` | Where each row came from, under which licence, who may see or export it, and which hours were recorded. |
| history | `ev_event` (+ R\*Tree on space and time, FTS on title, `ev_event_history` for revisions), `ev_event_entity`, `ev_event_relation` | Things that happened: a time or range with a precision, a point or shape, magnitude and severity. Linked to entities by role (attacker, location, …). |
| history | `ts_series`, `ts_point`, `ts_note` | Numbers over time: one series per metric × subject × source. |
| history | `doc_document`, `doc_document_link` | Articles and citations attached to events. |
| geo | `feature`, `feature_gen` (+ R\*Tree) | Polygons and points with a validity period, pre-generalised per zoom band. |
| tracks | `trk_segment`, `trk_state` | Movement: one row per entity per time bucket, the points packed in a blob, with a `source_mask` for licence gating. `trk_state` keeps callsign, squawk, destination and status over time. `class` 1 = vessel, 2 = aircraft. |
| tle | `trk_tle` | Orbital elements per NORAD id and epoch. |
| app | `auth_*`, `bill_*`, `api_key`, `ws_workspace`, `usage_counter`, `job`, `audit_event`, `admin_unlock` | Accounts and the product, not data we publish. |

## 3. What we hold

**Entities (catalog):** 95,948

| Type | Count | Main identifier |
|---|---:|---|
| aircraft | 63,013 | `icao24` |
| vessel | 23,614 | `mmsi` |
| org | 3,996 | GTD and UCDP actor ids |
| waterbody | 3,721 | `glwd` |
| heritage_site | 1,155 | `unesco` |
| polity | 284 | `iso3`, `cow`, `gw`, `wb` |
| region_group | 165 | WB, WHO, UNESCO and GTD regions |

**Events (history):** 217,449, all but 317 with a location. GTD alone is 181,691 (84%).

| Kind | Count | | Kind | Count |
|---|---:|---|---|---:|
| attack.terror | 181,691 | | change.territorial | 921 |
| battle | 13,520 | | hazard.volcano | 903 |
| hazard.quake | 8,527 | | politics.coup | 460 |
| battle.siege | 3,635 | | conflict.armed | 215 |
| hazard.tsunami | 2,327 | | war.* (interstate, civil, independence, world) | 195 |
| nuclear.test | 2,049 | | status.in_danger | 89 |
| politics.treaty | 1,706 | | nuclear.combat | 2 |
| claim.territorial | 1,209 | | | |

**Time series (history):** 246,424 series, 6.38 M points, 1,396 metrics. World Bank WDI is 233,200 series and 5.66 M points; the rest is OWID, UCDP, ICOW and the IQ compilation.

**Documents:** 354 (309 WW1 battle articles, 45 citations from the 1914–2026 wars compilation).

**Map layers (geo):**

| Layer | Features | Geometry | Time |
|---|---:|---|---|
| `admin0` (Natural Earth) | 242 | polygon | static |
| `unesco-whc` | 1,155 | point | valid from inscription |
| `glwd-lakes` | 3,721 | polygon | static |
| `ww2-europe` (v4) | 290 | polygon | 1938-03-13 → 1945-05-09 |

**Tracks:**

| Shard | Segments | Vessels | Aircraft | Points |
|---|---:|---:|---:|---:|
| `l0/2026/10/11` | 465,140 | 0 | 55,469 | 18.95 M |
| `l0/2026/10/12` | 152,139 | 23,614 | 26,000 | 1.04 M |
| `l1/2026-10` | 289,490 | 23,614 | 63,013 | 10.45 M |
| `l2/2026` | 203,797 | 23,614 | 63,013 | 3.05 M |

**TLEs:** 18,737 element sets for 18,737 objects, epochs 2026-09-13 → 2026-10-12, all fetched on 2026-10-12. One snapshot so far, no history yet.

## 4. APIs we use

101 routes under `src/app/api/` call about 40 provider groups. **Only seven are stored:** AISStream, OpenSky, adsb.fi, adsb.lol, CelesTrak and the camera catalogue go into the raw archive, and the ingest worker records USGS itself (§5.2). Everything else is held in a memory cache (`packages/connectors/src/source-cache.ts`, serves a stale copy on error) or passed straight through.

Limits are as written in our code comments or `DATA-SOURCES.md`; they haven't been re-checked against the providers' docs. "n.d." means nothing is written down.

| Provider | What | Routes | Key (env) | Upstream limit | Our cache or poll | Stored? |
|---|---|---|---|---|---|---|
| OpenSky | Aircraft state vectors | `/api/flights` | `OPENSKY_CLIENT_ID/SECRET` (optional) | 4,000 credits/day with an account, 400 anonymous; 4 per call. Non-commercial | 90 s (about 15 min anonymous); reads `x-rate-limit-remaining`. ~720–770 calls/day measured, about 75% of the budget | **raw archive** |
| adsb.fi | Fallback only: called when adsb.lol `/v2/mil` returns nothing | `/api/flights` | — | ~1 req/s; over it returns an empty list, not an error. Terms: "personal, non-commercial use only" | 1.1 s between calls | **raw archive** |
| adsb.lol | Military aircraft, by type | `/api/flights` | — | "dynamic and tight"; honours Retry-After | batches 5 s apart, every 10 min | **raw archive** |
| AISStream | Ships worldwide: 10 chokepoint boxes plus a whole-world box (WebSocket) | `/api/maritime` | `AIS_API_KEY` | 3 open connections per IP and per account ([docs](https://aisstream.io/documentation#limits)); terms n.d. | held in memory, 5 s snapshot; the live map is capped at 20,000 ships, the archive is not | **raw archive** |
| CelesTrak | TLEs, 5 groups | `/api/satellites` | — | data updates every 2 h and a repeat download gets 403; 50 errors in 2 h or >100 MB/day gets us firewalled. **We fetch `FORMAT=tle`, which has no objects catalogued since 2026-07-11 (6-digit ids)** | one download per group per 2 h; disk copy in `.next/cache/` | **raw archive + `tle.db`** |
| SatNOGS | TLE fallback | `/api/satellites` | — | n.d. | only when CelesTrak returns nothing | raw archive (empty so far) |
| ~115 camera indexes (511 services, Digitraffic, MLIT, TOPIS, …) | Camera lists | `/api/cctv` | `ONTARIO_511_KEY`, `ALBERTA_511_KEY` | n.d. | 30 min; disk `.cache/cctv-catalog.json` | **raw archive** (lists, not frames) |
| Camera frames and streams | Images, HLS | `/api/cctv/{proxy,frame,resolve,…}` | — | n.d. | 4–60 s | no |
| USGS, EMSC | Earthquakes | `/api/earthquakes` | — | FDSN caps a request at 20k events | 60 s | no (the worker records USGS) |
| FAA NAS | Airport delays | `/api/airport-status` | — | n.d. | 2 min | cache |
| IMF PortWatch, NGA MSI | Chokepoint transits, navigation warnings | `/api/chokepoints`, `/api/nav-warnings` | — | n.d. | 6 h | cache |
| Launch Library 2 | Launches | `/api/launches` | — | "a few requests an hour" anonymous | 1 h | cache |
| JPL Horizons, MPC, NASA Exoplanet, Helioviewer, NASA Trek/GIBS, MMGIS | Space views | `/api/space/*` | — | Horizons: don't flood, 2 slots; others n.d. | 10 min – 24 h; textures 30 d | cache |
| NOAA SWPC | Kp, alerts, flares, aurora | `/api/space-weather`, `/api/aurora` | — | n.d. | aurora cached | cache / no |
| EONET, NWS, GDACS, NHC, WMO, ECCC, HKO, Canadian provinces | Weather and hazard alerts | `/api/weather`, `/api/gdelt` (GDACS RSS) | — | NWS needs a User-Agent | 3–5 min | cache |
| NASA FIRMS, EONET, CWFIS, BC Wildfire | Fires | `/api/fires` | — | n.d. | 30 min | cache |
| Open-Meteo | Forecast grid, air quality | `/api/weather-grid`, `/api/air-quality` | — | n.d.; **commercial use needs a paid plan** | 5–30 min | cache |
| UCAR THREDDS (GFS) | Weather fields | `/api/weather-field` | — | n.d. | CDN 10 min | no |
| EPA RadNet, Safecast | Radiation | `/api/radiation` | — | n.d. | 15–60 min | cache |
| WHO, ECDC, CDC, US State Dept, FCDO, Smartraveller | Outbreaks, travel advisories | `/api/outbreaks`, `/api/advisories` | — | n.d. | 15 min | cache |
| liveuamap, BBC, DeepStateMap, GDELT | Conflict, front lines | `/api/conflicts`, `/api/frontlines`, `/api/gdelt-events` | — | n.d. | CDN 5–30 min | no |
| RSS wires, Telegram, Nominatim | News, geocoding | `/api/news` | — | Nominatim 1 req/s | 3–5 min | cache |
| Tzeva Adom, ukrainealarm | Air-raid alerts | `/api/war-alerts` | — | n.d. | 20 s | cache |
| Cloudflare Radar, IODA | Internet outages | `/api/cloudflare-radar`, `/api/radar` | `CLOUDFLARE_API_TOKEN` | n.d. | CDN 5 min | no |
| Statuspage vendors | Service status | `/api/service-status` | — | n.d. | short | cache |
| abuse.ch, ip-api, Shadowserver, CISA KEV, NVD, DefiLlama | Cyber threats, malware, chain stats | `/api/cyber-*`, `/api/malware`, `/api/chain/daily` | — | ip-api 15 batches/min × 100 | 5–30 min | cache |
| Yahoo Finance, Frankfurter, CoinGecko | Markets, FX, crypto | `/api/markets`, `/api/crypto` | — | n.d. | 60 s | cache |
| Earth Search, Copernicus STAC | Imagery | `/api/sentinel` | — | n.d. | 5 min | no |
| OpenFreeMap (default), CARTO (option) | Basemap vector tiles, fonts, symbols | loaded by the browser, no route | CARTO: `NEXT_PUBLIC_CARTO_API_KEY` | OpenFreeMap: none stated ([site](https://openfreemap.org/)); CARTO: commercial free up to 1M tiles a month ([terms](https://carto.com/legal/basemap-terms)) | browser only (CARTO forbids server caching) | no |
| Wikipedia | Article lead for a clicked place | `/api/map/wiki` | — | Wikimedia asks for a User-Agent and a gentle rate; we cap callers at 30/min | 24 h | cache |
| geoBoundaries, Waymarked Trails | Fine boundaries, hiking routes | `/api/boundaries/fine`, `/api/hiking/routes/[id]` | — | WMT "moderate rates" | 30 d / 6 h | cache |
| Photon, Wikipedia, Wikidata, Nominatim, police.uk, UNHCR | Region dossier | `/api/region-dossier` | — | Nominatim 1 req/s; Wikidata rate-limited | 24 h; Nominatim disk `.cache/nominatim.json` | cache |
| ipapi.co, freeipapi, ip-api | Visitor location | `/api/geo` | — | ipapi.co 1,000/day | none | no |
| ~15 OSINT services (RIPEstat, crt.sh, RDAP, Shodan InternetDB, OTX, OpenSanctions, explorers, …) | Lookups | `/api/osint/*`, `/api/scanner` | `ETHERSCAN_API_KEY`, `HELIUS_API_KEY`, `SCANNER_URL/KEY` | n.d. (we cap callers at 3–30 req/min per IP) | mostly none | no |
| Gemini, OpenAI, Anthropic, OpenRouter, Groq, DeepSeek, Mistral | AI | `/api/ai/*`, `/api/oi/*`, `/api/mcp` | `GEMINI_API_KEY_n` or the user's own key | n.d. | none | no |

## 5. Historical data

### 5.1 Imported (bulk)

All imported on 2026-10-12, all `active`.

| Source | What | Covers | Rows |
|---|---|---|---|
| `wikidata-battles` | Battles and sieges | 3239 BCE → 2026 | 16,846 events |
| `noaa-hazards` | Significant earthquakes, tsunamis, eruptions (NCEI) | 4360 BCE → 2026 | 9,927 events |
| `wikidata-politics` | Treaties and coups | 1300 BCE → 2026 | 2,166 events |
| `gtd` | Global Terrorism Database | 1970 → 2017 | 181,691 events |
| `sipri-nuclear` | Nuclear explosions | 1945 → 1998 | 2,051 events |
| `icow` | Territorial claims | 1816 → 2001 | 1,209 events, 2,511 series |
| `cow-territorial` | Territorial changes | 1816 → 2016 | 840 events |
| `cow-interstate`, `cow-extra` | Inter-state wars | 1823 → 2023 | 98 events |
| `ww1-wiki` | WW1 battles | 1914 → 1918 | 309 events, 309 docs |
| `wac1914` | Wars and armed conflicts | 1914 → 2026 | 106 events, 45 docs |
| `ucdp-brd` | Battle-related deaths | 1989 → 2025 | 206 events, 618 series |
| `ww2-borders` | European borders in WW2 (Stanford) | 1938 → 1945 | 81 events, 290 polygons |
| `unesco-whc` | World Heritage List 2021 | 1988 → 2022 | 1,155 sites, 89 "in danger" events |
| `wdi` | World Development Indicators | 1960 → 2015 | 233,200 series |
| `owid-*` (8 datasets) | Conflict deaths, life expectancy, education, water, mental health, COVID, long-run indicators | year 1 → 2026-08 | 9,847 series |
| `iq-2023` | IQ compilation | 2023 | 248 series |
| `naturalearth`, `glwd` | Modern borders, lakes and wetlands | static | 242 + 3,721 features |

**Known gaps** (`meta_dataset_gap`): GTD has no 1993 records (lost by the publisher); UCDP's 2025 rows are the preliminary version 26.0.

### 5.2 Recording (live)

The web app does the fetching: `record()` (`packages/archive/src/recorder.ts`) writes each upstream reply to `data/archive/raw/<source>/YYYY/MM/DD/HH.ndjson.zst` when `TAKIP_ARCHIVE_DIR` is set. The ingest worker keeps the routes warm (`apps/ingest/src/jobs/keepalive.ts`: flights and ships every 60 s, satellites and cameras every 30 min), seals the raw hours into track shards, and polls USGS itself (every 10 min, plus a daily 30-day pass). Per-source on/off switches are in `meta_source` and mirrored to `data/archive/control.json`. Below 50 GB of free disk the recorder pauses AISStream first, then OpenSky, adsb.lol and adsb.fi.

| Source | Recording since (UTC) | Raw archive | Built into | Status at snapshot |
|---|---|---:|---|---|
| AISStream (ships) | 2026-10-12 20:00 | 95 MB | tracks, class 1 | ok |
| OpenSky (aircraft) | 2026-10-12 20:00 | 23 MB | tracks, class 2 | ok (degraded 21:00–22:00) |
| adsb.lol (aircraft) | 2026-10-12 20:00 | 13 MB | tracks, class 2 | ok (degraded 20:00–22:00) |
| adsb.fi (aircraft) | 21:00–22:00 only | 16 KB | tracks, class 2 | idle: a fallback, so it has nothing to record while adsb.lol answers |
| CelesTrak (TLEs) | 2026-10-12 22:00 | 1.1 MB | `tle.db` (append-only) | ok |
| Camera catalogue | 2026-10-12 21:00 | 2.8 MB | nothing yet: `cam_camera_version` is empty | raw only |
| USGS (earthquakes) | 2026-10-12 22:00 | 0.2 MB | `history.ev_event` | 1,830 quakes, 2026-09-12 → 10-12 |
| SatNOGS (TLE fallback) | — | — | — | used only when CelesTrak fails; nothing yet |
| adsb.lol daily history (backfill, CLI) | — | 377 MB | tracks, class 2 | 2026-10-11 00:00 → 10-12 01:00: 55,469 aircraft, 18.95 M points |

Live recording is about four hours old. Everything in the tracks before 2026-10-12 20:00 UTC is the one backfilled adsb.lol day, which has no ships. OpenSky can backfill only about an hour, and needs an account.

**The ingest worker stopped at about 23:20 UTC.** `npm run dev` (`tools/dev.mjs`) starts only the web app and `apps/api`. Since then USGS polling and track sealing have stopped. The raw archive still grows, but only while something else calls the routes.

**Retention is not implemented: nothing is deleted today.** The plan ([`replay-database.md`](./replay-database.md) §7.3, §8.3) is below; `servedDays` is defined in `packages/core/src/tracks.ts`, but the `cool-shards` and `prune-raw` jobs haven't been written.

| Data | Served for | Then |
|---|---|---|
| L0 tracks (full resolution, 1 h buckets) | 14 days | moved to `cold/`, kept forever (~55 GB a year) |
| L1 tracks (≤ 100 m error, 6 h buckets) | 90 days | deleted |
| L2 tracks (≤ 2 km error, 1 day buckets) | forever | — |
| Raw archive hours | 90 days | deleted once their L0 shard is sealed |

`app.db` does prune (defaults in `apps/api/src/env.ts`): daily usage counters 400 days for accounts and 35 for anonymous visitors (stored as a salted hash), audit events 30 days, finished jobs 7 days.

## 6. Licences and access

From `meta_licence` and `meta_access_policy`. `commercial_use` is blank where it hasn't been checked; no licence has a `verified_at` date yet.

| Licence | Used by | Commercial use | Redistribution |
|---|---|---|---|
| public-domain | naturalearth, usgs, noaa-hazards, takip-seed | yes | public domain |
| cc0-1.0 | wikidata-battles, wikidata-politics | yes | public domain |
| adsblol-odbl | adsblol, adsblol-history | yes | share-alike |
| satnogs-cc-by-sa | satnogs | yes | share-alike |
| cc-by-4.0 | wdi, ucdp-brd, owid-* | not set | attribution |
| cc-by-sa-4.0 | ww1-wiki | not set | share-alike |
| cc-by-sa-3.0-igo | unesco-whc | not set | share-alike |
| cow-terms | cow-interstate, cow-territorial, icow | not set (the COW page says **no**: "not to be used for any commercial activity", and no redistribution without written permission) | attribution |
| opensky-terms | opensky | **no** | none |
| gtd-terms | gtd | **no**; public display also needs written permission from START | none |
| glwd-terms | glwd | **no** | attribution |
| stanford-shl-nc | ww2-borders | **no** | attribution |
| aisstream-terms, adsbfi-terms, celestrak-terms, cctv-mixed | the matching source | not set | unknown |
| unknown | wac1914, cow-extra, iq-2023, sipri-nuclear | not set (SIPRI requires authorisation for commercial use) | unknown |

**Access:** every tier (`anon`, `free`, `paid`, `internal`) can view data under all 17 licences, and export is off for all of them.
