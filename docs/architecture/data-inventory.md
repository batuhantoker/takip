# Data inventory

> **Snapshot:** 2026-10-15, about 23:30 UTC (§1–3 and §5; §4 and §6 are as of 2026-10-13). The counts were read from the files under `data/` and will drift. The live record is `catalog.meta_source` (sources), `catalog.meta_dataset` (imports), `catalog.meta_coverage` (recording) and `catalog.meta_shard` (files).
> **2026-10-13:** the `tradewar` source (tariff timeline, stock, currency and trade series) was removed; the counts below are after the removal.
> Related: [`replay-database.md`](./replay-database.md) (design, retention), [`dataset-import-map.md`](./dataset-import-map.md) (how each dataset maps to tables), [`backend.md`](./backend.md) (app data), [`data/reference/README.md`](../../data/reference/README.md) (reference files), [`data-sources.md`](../data-sources.md) (candidates, not what we use).

## 1. Where data lives

| Path | What | Size | Written by |
|---|---|---:|---|
| `data/db/catalog.db` | Entities and identifiers, polities, plus the registry: sources, datasets, licences, coverage, shards | 16 MB | importers, ingest |
| `data/db/history.db` | Events, time series and documents | 839 MB | importers, ingest (USGS) |
| `data/db/geo/<layer>@<v>.db` | Map layers, generalised per zoom band: `admin0`, `unesco-whc`, `glwd-lakes`, `ww2-europe`, `world-borders`. Superseded versions are not deleted yet: 12 files, of which the live five are ~350 MB | 730 MB | importers |
| `data/db/tracks/l0/YYYY/MM/DD.db` | Aircraft and ship tracks at full resolution, one file per day | 280 MB | ingest (`seal-tracks`) |
| `data/db/tracks/l1/YYYY-MM.db`, `l2/YYYY.db` | The same tracks simplified, one file per month and per year | 149 MB + 118 MB | ingest |
| `data/db/tracks/tle.db` | Satellite orbital elements (TLEs) | 4 MB | ingest |
| `data/archive/raw/<source>/` | Raw upstream replies as received (hourly `.ndjson.zst`), kept so tracks can be rebuilt | 1.7 GB | web app (`packages/archive`), backfill CLI |
| `data/db/app.db` | Users, sessions, plans, subscriptions, API keys, workspaces, usage, jobs, audit. **Holds personal data.** | 0.2 MB | `apps/api` |
| `data/backups/` | Daily `app.db` snapshots, newest 14 kept ([runbook](../runbooks/app-db-restore.md)) | 0.7 MB | `apps/api` |
| `data/traffic/ndw-sites.json` | Road lines for NDW's travel-time sites, for the Road Traffic layer (gitignored) | 7.5 MB | `tools/traffic/build-ndw.ts` |
| `data/reference/` | 20 slimmed US infrastructure and airport files, served by `/api/reference` when installed (gitignored) | 308 MB | `tools/slim-geodata.py` |
| `docs/data/raw-2026-10-12*/` | Raw downloads the imports and reference files were built from (gitignored) | 5.2 GB | by hand |

**Bundled with the web app** (static files, shipped in the build):

| Path | What | Records | Size | Source, licence |
|---|---|---:|---:|---|
| `src/lib/feeds/cameras/generated/*.generated.ts` | Camera lists scraped once (generators in `scratch/scrape_*.js`) | ~8,800 across 9 files | 0.9 MB | OpenWebcamDB 1,372 (**API terms are non-commercial**), SkylineWebcams 609, public operator webcams 300, Japan MLIT rivers 4,312, SANRAL 1,239, Fintraffic 764 (CC BY 4.0), WYDOT 172; most licences unknown |
| `src/lib/feeds/cameras/sources/**` | Hand-coded camera lists (Poland, Spain, France, Japan, Italy) | ~200 | small | per operator |
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
| app | `auth_*`, `bill_*`, `api_key`, `ws_workspace`, `issue_report`, `usage_counter`, `job`, `audit_event`, `admin_unlock` | Accounts and the product, not data we publish. |

## 3. What we hold

**Entities (catalog):** 95,976

| Type | Count | Main identifier |
|---|---:|---|
| aircraft | 63,013 | `icao24` |
| vessel | 23,614 | `mmsi` |
| org | 4,009 | GTD and UCDP actor ids |
| waterbody | 3,721 | `glwd` |
| heritage_site | 1,155 | `unesco` |
| polity | 284 | `iso3`, `cow`, `gw`, `wb` |
| region_group | 180 | WB, WHO, UNESCO and GTD regions |

**Events (history):** 234,597, all but one with a location, from 9,000 years ago (prehistoric massacre sites) to now. GTD alone is 181,691 (77%).

| Kind | Count | | Kind | Count |
|---|---:|---|---|---:|
| attack.terror | 182,283 | | change.territorial | 921 |
| battle | 13,507 | | hazard.volcano | 903 |
| hazard.quake | 8,527 | | politics.coup | 460 |
| battle.siege | 3,625 | | conflict.armed | 211 |
| hazard.tsunami | 2,329 | | war, war.* (interstate, civil, independence, world) | 1,959 |
| nuclear.test | 2,049 | | status.in_danger | 89 |
| conflict.massacre | 3,324 | | conflict.rebellion | 1,185 |
| politics.assassination | 159 | | politics.revolution | 131 |
| conflict.genocide | 90 | | | |
| politics.treaty | 1,706 | | nuclear.combat | 2 |
| claim.territorial | 1,209 | | disaster.* (`gdis`: floods 4,263, storms 2,838, quakes 1,074, …) | 9,928 |

**Time series (history):** 383,179 series, 15.77 M points (2026-10-16). World Bank WDI is 294,460 series, 9.05 M points and 1,498 metrics (the 2026-10-08 release, imported 2026-10-14); the rest is OWID, UN WPP and WUP, the World Bank's climate portal (CCKP), UCDP, ICOW and the IQ compilation. Projections (WPP and CMIP6 to 2100, WUP to 2050) are the only values after today.

**Documents:** 354 (309 WW1 battle articles, 45 citations from the 1914–2026 wars compilation).

**Map layers (geo):**

| Layer | Features | Geometry | Time |
|---|---:|---|---|
| `admin0` (Natural Earth) | 242 | polygon | static |
| `unesco-whc` (v3) | 1,155 | point | valid from inscription |
| `glwd-lakes` | 3,721 | polygon | static |
| `ww2-europe` (v7) | 288 | polygon | Feb 1938 → May 1945, month by month |
| `world-borders` (v3) | 11,079 | polygon | year by year, 3400 BCE → 2024 (Cliopatria) |

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

Limits are as written in our code comments or `docs/data-sources.md`; they haven't been re-checked against the providers' docs. "n.d." means nothing is written down.

| Provider | What | Routes | Key (env) | Upstream limit | Our cache or poll | Stored? |
|---|---|---|---|---|---|---|
| OpenSky | Aircraft state vectors | `/api/flights` | `OPENSKY_CLIENT_ID/SECRET` (optional) | 4,000 credits/day with an account, 400 anonymous; 4 per call. Non-commercial | 90 s (about 15 min anonymous); reads `x-rate-limit-remaining`. ~720–770 calls/day measured, about 75% of the budget | **raw archive** |
| adsb.fi | Fallback only: called when adsb.lol `/v2/mil` returns nothing | `/api/flights` | — | ~1 req/s; over it returns an empty list, not an error. Terms: "personal, non-commercial use only" | 1.1 s between calls | **raw archive** |
| adsb.lol | Military aircraft, by type; aircraft within 250 nm of the view | `/api/flights`, `/api/flights/nearby` | — | "dynamic and tight"; honours Retry-After | batches 5 s apart, every 10 min; the view's read 12 s per 0.25° anchor, reads 5 s apart, none while the batches run | **raw archive** |
| AISStream | Ships worldwide: 10 chokepoint boxes plus a whole-world box (WebSocket) | `/api/maritime` | `AIS_API_KEY` | 3 open connections per IP and per account ([docs](https://aisstream.io/documentation#limits)); terms n.d. | held in memory, 5 s snapshot; the live map is capped at 20,000 ships, the archive is not | **raw archive** |
| CelesTrak | TLEs, 5 groups | `/api/satellites` | — | data updates every 2 h and a repeat download gets 403; 50 errors in 2 h or >100 MB/day gets us firewalled. **We fetch `FORMAT=tle`, which has no objects catalogued since 2026-07-11 (6-digit ids)** | one download per group per 2 h; disk copy in `.next/cache/` | **raw archive + `tle.db`** |
| SatNOGS | TLE fallback | `/api/satellites` | — | n.d. | only when CelesTrak returns nothing | raw archive (empty so far) |
| ~115 camera indexes (511 services, Digitraffic, MLIT, TOPIS, …) | Camera lists | `/api/cctv` | — | n.d. | 30 min; disk `.cache/cctv-catalog.json` | **raw archive** (lists, not frames) |
| Camera frames and streams | Images, HLS | `/api/cctv/{proxy,frame,resolve,…}` | — | n.d. | 4–60 s | no |
| USGS, EMSC | Earthquakes | `/api/earthquakes` | — | FDSN caps a request at 20k events | 60 s | no (the worker records USGS) |
| FAA NAS | Airport delays | `/api/airport-status` | — | n.d. | 2 min | cache |
| NDW, Rennes Métropole, Nantes Métropole | Measured road speeds (NDW: % of usual) and city traffic classes | `/api/traffic` | — | Rennes 7,000 calls/day per IP; NDW n.d. | NDW 90 s, cities 4 min, each only while a view covers it; NDW lines from `data/traffic/ndw-sites.json` (gitignored, `tools/traffic/build-ndw.ts`) | no |
| aviationweather.gov | METARs worldwide (flight category), international SIGMETs | `/api/aviation-weather` | — | 100/min ([docs](https://aviationweather.gov/data/api/)) | 5 min | cache |
| ~800 GTFS-RT feeds (Mobility Database, Transitland Atlas), İETT; metros from TfL arrivals, LA Metro's WebSocket, the CTA Train Tracker map, Toei (ODPT), FGC and five HAFAS radars (Copenhagen, Vienna, Munich, Hamburg, Frankfurt) | Bus, tram, train and metro positions; underground trains without GPS placed between stops as estimates; Istanbul's and İzmir's metros, which publish nothing live, run from their timetables and labelled scheduled | `/api/transit` | — (Entur gets an `ET-Client-Name` header) | per agency, n.d. | each feed at most every 15 s (İETT, TfL, CTA, FGC and HAFAS 30 s), only the feeds of the ≤ 8 systems covering the asked box; a failing feed backs off to 10 min. The catalogue (`src/lib/feeds/transit/generated/`, with the stop graphs that place NYC's, BART's and Paris's trains) and `public/data/transit/cities.json` come from `tools/transit/build-feeds.ts`. A tracked vehicle's route shape (`/api/transit/shape`) comes from its feed's static GTFS, ≤ 3 feeds' trips.txt and shapes.txt held compressed; bus feeds without shapes route between fixes on OSRM's public demo (`/api/transit/path`, ≤ 1 call/s) | no |
| IMF PortWatch, NGA MSI | Chokepoint transits, navigation warnings | `/api/chokepoints`, `/api/nav-warnings` | — | n.d. | 6 h | cache |
| Launch Library 2 | Launches | `/api/launches` | — | "a few requests an hour" anonymous | 1 h | cache |
| JPL Horizons, MPC, NASA Exoplanet, Helioviewer, NASA Trek/GIBS, MMGIS | Space views | `/api/space/*` | — | Horizons: don't flood, 2 slots; others n.d. | 10 min – 24 h; textures 30 d | cache |
| NOAA SWPC | Kp, alerts, flares, aurora | `/api/space-weather`, `/api/aurora` | — | n.d. | aurora cached | cache / no |
| EONET, NWS, GDACS, NHC, WMO, ECCC, HKO, Canadian provinces | Weather and hazard alerts; NHC forecast cones, tracks and points (NOAA tropical MapServer layers 5–7) | `/api/weather`, `/api/weather/nhc-forecast`, `/api/gdelt` (GDACS RSS) | — | NWS needs a User-Agent | 3–5 min | cache |
| NASA FIRMS, EONET, CWFIS, BC Wildfire, NIFC WFIGS | Fires: VIIRS hotspots from S-NPP, NOAA-20 and NOAA-21 merged (MODIS when none answers); US perimeters | `/api/fires`, `/api/fires/perimeters` | — | n.d.; each FIRMS file is ~9 MB | FIRMS and CWFIS 30 min, WFIGS 10 min | cache |
| Open-Meteo | Forecast grid, air quality | `/api/weather-grid`, `/api/air-quality` | — | n.d.; **commercial use needs a paid plan** | 5–30 min | cache |
| UCAR THREDDS (GFS) | Weather fields: 2 m temperature at 0.25°, 10 m wind at 0.5° | `/api/weather-field`, `/api/weather-field/wind` | — | n.d. | one read per 3-hour step; CDN 10 min | no |
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
| RainViewer, NOAA nowCOAST | Rain radar (the last 2 h of frames, looped or at Replay's time); lightning strike density every 15 min, the last ~6 h, the Americas and the Pacific (WMS `observations/lightning_detection`, CORS `*`) | loaded by the browser, no route | — | RainViewer tiles stop at z7; nowCOAST n.d. | radar frame list 5 min; lightning capabilities 5 min | no |
| DeFlock | ALPR camera locations: an hourly OpenStreetMap extract as vector tiles (`tiles.dontgetflocked.com/cameras-{us,ca}-hourly`), z0–8 attribute-less density, details from z9 | loaded by the browser, no route | — | n.d. (Cloudflare, `max-age=300`) | browser only; tiles from z3 | no |
| NASA GIBS, EUMETSAT | Satellite Live: the geostationary ring every 10 min, about 40 min behind. GOES-East and West GeoColor (GIBS), Meteosat MTG GeoColor (EUMETSAT WMS `view.eumetsat.int`, terms to check), and Himawari infrared and visible cloud over Blue and Black Marble (GIBS; a tile missing from a frame steps back up to 20 min), each cut to its own longitudes by the `geosat://` protocol. Also and Satellite Daily (VIIRS NOAA-20 true colour, MODIS Terra before 2018, back to 2000-02-24) | loaded by the browser, no route; DescribeDomains for the newest frame (`src/lib/feeds/imagery/gibs.ts`) | — | none published; CORS `*`; dated tiles are `no-store` | newest frame every 5 min; History and Replay move it at most once a second | no |
| Microsoft Planetary Computer | Satellite images of one place: Sentinel-2 L2A, Sentinel-1 RTC and Landsat C2 L2 scenes over a point (STAC search), and their XYZ tiles and previews | loaded by the browser, no route (`src/lib/feeds/imagery/scene-search.ts`); orbits from `/api/satellites?tle=1&norad=…` | — | none published; CORS `*`; Copernicus and USGS data allow commercial use with credit, PC's own terms to check | on demand, last 60 days, 15 per collection | no |
| OpenHistoricalMap | Dated borders down to duchies and free cities under History's world borders, from z7 (`vtiles.openhistoricalmap.org/maps/ohm`, layers `land_ohm_lines`, `land_ohm_centroids`), filtered to the clock on `start_decdate`/`end_decdate` | loaded by the browser, no route | — | none stated; a volunteer server, so nothing below z7 (a z5 tile over Europe is ~2 MB) | browser only (`max-age=60`) | no |
| Wikipedia | Article lead for a clicked place | `/api/map/wiki` | — | Wikimedia asks for a User-Agent and a gentle rate; we cap callers at 30/min | 24 h | cache |
| geoBoundaries, Waymarked Trails | Fine boundaries, hiking routes | `/api/boundaries/fine`, `/api/hiking/routes/[id]` | — | WMT "moderate rates" | 30 d / 6 h | cache |
| Photon, Wikipedia, Wikidata, Nominatim, police.uk, UNHCR | Region dossier | `/api/region-dossier` | — | Nominatim 1 req/s; Wikidata rate-limited | 24 h; Nominatim disk `.cache/nominatim.json` | cache |
| ipapi.co, freeipapi, ip-api | Visitor location | `/api/geo` | — | ipapi.co 1,000/day | none | no |
| ~15 OSINT services (RIPEstat, crt.sh, RDAP, Shodan InternetDB, OTX, OpenSanctions, explorers, …) | Lookups | `/api/osint/*` | `ETHERSCAN_API_KEY`, `HELIUS_API_KEY` (both optional) | n.d. (we cap callers at 3–30 req/min per IP) | mostly none | no |
| Gemini, OpenAI, Anthropic, OpenRouter, Groq, DeepSeek, Mistral | AI | `/api/ai/*`, `/api/mcp` | `GEMINI_API_KEY_n` or the user's own key | n.d. | none | no |

## 5. Historical data

### 5.1 Imported (bulk)

All imported on 2026-10-12, all `active`.

| Source | What | Covers | Rows |
|---|---|---|---|
| `wikidata-battles` | Battles and sieges | 3239 BCE → 2026 | 16,846 events |
| `noaa-hazards` | Significant earthquakes, tsunamis, eruptions (NCEI) | 4360 BCE → 2026 | 9,929 events |
| `wikidata-politics` | Treaties and coups | 1300 BCE → 2026 | 2,166 events |
| `gtd` | Global Terrorism Database | 1970 → 2017 | 181,691 events |
| `wikidata-attacks` | Terrorist attacks outside GTD's years, imported 2026-10-14 | 44 BCE → 2026 | 592 events |
| `wikidata-wars` | Wars (civil, independence, colonial, religious, proxy, world) and rebellions, imported 2026-10-16. 130 are duplicates of WAC/COW wars and hide behind them; 225 sit at the middle of their battles (138 Wikidata places nowhere else, 87 it places only at one of several countries); 7,267 battles link `part_of` their war | 2600 BCE → 2026 | 2,949 events (2,819 shown) |
| `wikidata-revolutions` | Revolutions and assassinations, imported 2026-10-16 | 509 BCE → 2026 | 290 events |
| `wikidata-massacres` | Massacres (including prehistoric sites) and genocides that are not terrorist attacks, imported 2026-10-16 | 7500 BCE → 2026 | 3,414 events |
| `sipri-nuclear` | Nuclear explosions | 1945 → 1998 | 2,051 events |
| `gdis` | Where EM-DAT disasters struck (GDIS), imported 2026-10-14 | 1960 → 2018 | 9,928 events from 39,953 places |
| `icow` | Territorial claims | 1816 → 2001 | 1,209 events, 2,511 series |
| `cow-territorial` | Territorial changes | 1816 → 2016 | 840 events |
| `cow-interstate`, `cow-extra` | Inter-state wars | 1823 → 2023 | 98 events |
| `ww1-wiki` | WW1 battles | 1914 → 1918 | 309 events, 309 docs |
| `wac1914` | Wars and armed conflicts | 1914 → 2026 | 106 events, 45 docs |
| `ucdp-brd` | Battle-related deaths (BRD 26.1, placed by GED 26.1) | 1989 → 2025 | 202 events, 606 series |
| `ww2-borders` | European borders in WW2 (Stanford) | 1938 → 1945 | 81 events, 290 polygons |
| `cliopatria` | World polities year by year (Seshat) | 3400 BCE → 2024 | 11,079 polygons from 12,064 rows |
| `unesco-whc` | World Heritage List 2021 | 1988 → 2022 | 1,155 sites, 89 "in danger" events |
| `wdi` | World Development Indicators (2026-10-08 release, imported 2026-10-14) | 1960 → 2025 | 294,460 series |
| `owid-*` (8 datasets) | Conflict deaths, life expectancy, education, water, mental health, COVID, long-run indicators (population from year 0 since 2026-10-16) | year 0 → 2026-08 | 9,847 series |
| `iq-2023` | IQ compilation | 2023 | 248 series |
| `wpp-2024` | UN World Population Prospects 2024, imported 2026-10-16: 22 indicators for 237 countries and the world, plus three age-structure series summed from its five-year age groups (medium variant only). Estimates to 2023; projections 2024–2100 as `<code>.proj` (medium variant), `.proj.high`, `.low`, `.constant-fertility` and `.zero-migration`, and the 95% prediction interval as `.proj.lo` / `.proj.hi`. Togo from the January 2026 update (its other variants skipped, as the update revised only the medium); each country's coverage footnote ("excluding Kosovo") as a note | 1950 → 2100 (projected from 2024) | 41,524 series, 3.18 M points |
| `wup-2025` | UN World Urbanization Prospects 2025: urban share and urban population (national definitions), and the share in cities, towns and rural areas (degree of urbanisation), 237 countries | 1950 → 2050 (projected from 2026) | 2,370 series, 119,685 points |
| `census-idb` | US Census Bureau International Database (December 2025): population, fertility, life expectancy, infant mortality and median age for 225 countries; years after each country's last revision are `.proj` | 1950 → 2100 (projected from 2008–2025, by country) | 2,237 series, 137,075 points |
| `oecd-lt-eo117` | OECD Economic Outlook 117 long-term scenarios: GDP per person (constant PPP) and gross CO₂, 48 countries; 2024 on as `.proj` (BAU1) and `.proj.bau2`, `.et1`–`.et4` | 1990 → 2100 (scenario from 2024) | 679 series, 48,058 points |
| `imf-weo` | IMF World Economic Outlook (October 2026), from the CSV the user downloads by hand: GDP growth, GDP per person, inflation, unemployment, government debt and population, 196 economies; years after each series' last actual year are `.proj` | 1980 → 2031 | 2,153 series, 48,800 points |
| `wb-gep` | World Bank Global Economic Prospects (June 2026): real GDP growth, 2025 an estimate, 2026–2028 forecasts (`.proj`) | 2023 → 2028 | 314 series, 939 points |
| `wb-cckp` | World Bank Climate Change Knowledge Portal: 8 climate variables (mean temperature, hottest day, days above 35 and 40 °C, tropical nights, precipitation, heavy-rain days, longest dry spell) for 241 countries. `cckp:<v>` is the CMIP6 ensemble median throughout (historical run, then SSP2-4.5 as `.proj` and four other SSPs, with the models' 10th–90th percentile as `.lo` / `.hi`); `era5:<v>` is the observed ERA5 series, kept apart because the models' median sits well off it for counts of days | 1950 → 2100 (all modelled); ERA5 1950 → 2025 | 32,776 series, 2.76 M points |
| `sipri-milex` | SIPRI Military Expenditure Database (1949–2025, v1.2 of 2026-04-27), importer added 2026-10-19: spending in constant 2024 and current US$, per person, and as shares of GDP and of government spending, for up to 172 polities, historical states included (USSR, GDR, West Germany, Czechoslovakia, Serbia and Montenegro). SIPRI's estimates (blue) and highly uncertain figures (red) are flagged; its footnotes are notes | 1949 → 2025 | 846 series, 36,275 points (trial import on a copy) |
| `cow-nmc` | Correlates of War National Material Capabilities v7.0, importer added 2026-10-19: military spending (£ to 1913, US$ from 1914), military personnel, iron and steel, primary energy, population, urban population and the CINC score for 217 states, historical ones on their own polities; North Vietnam (1954–75) is left out, having no polity in the catalog | 1816 → 2022 | 1,609 series, 116,345 points (trial import on a copy) |
| `gvp-eruptions` | Smithsonian GVP Volcanoes of the World: every Holocene eruption (live WFS, newer than v5.3.1), importer added 2026-10-20. VEI in `attrs.vei` as NCEI's rows have it, not as magnitude; GVP's "2 July ± 182 days" and "16th ± 15 days" placeholders read as year and month; a ± in years coarsens the date to decade, century or millennium. 1,173 uncertain eruptions at confidence 0.5. NCEI's eruptions link by GVP volcano number and an overlapping date: 482 `same_as` (NCEI's row stays canonical), 305 `part_of` an eruption that ran over a year or holds several NCEI events, 116 NCEI rows unmatched (mostly lahars and other after-effects GVP doesn't list as eruptions). Continuing eruptions end at GVP's last update (March 2026): the WFS doesn't flag them | 55,500 BCE (one cosmic-ray date) or 9700 BCE → 2026 | 11,089 events, 10,607 shown (trial import on a copy) |
| `plague-outbreaks` | Plague outbreaks by town and year, Biraben's 1975–76 list as Büntgen et al. (2012) digitised it, importer added 2026-10-20. Europe, North Africa and the Levant only, and a record of outbreaks someone wrote down, not of every outbreak: Roosen & Curtis (2018) find France over-represented and some places imprecise. Year only; the file's `Lat_WGS84` column holds the longitude. 80 repeated town-years, 2 rows shifted by a comma in "Eisleben, Lutherstadt" and 1 dated 9999 are dropped | 1347 → 1900 | 6,846 events at 1,170 places (trial import on a copy) |
| `gcat-launches` | GCAT launch log (J. McDowell), importer added 2026-10-20: every launch since 1942 as `space.launch` (orbital, deep-space and near-orbital: 7,440), `space.suborbital` (sounding, weather, test and crewed suborbital rockets: 52,609) and `missile.test` (15,309); orbital and suborbital share the `space` family, missile tests have their own. At the pad when GCAT has its point, else at the site, precise to GCAT's stated error; air launches at the drop point. Left out: 629 launches from sites without coordinates (Soviet ship cruises, a submarine area), 11 from the Moon, 7 entries that are not launches | 1942 → 2026 | 75,358 events (trial import on a copy) |
| `cneos-fireballs` | CNEOS fireballs (NASA JPL), importer added 2026-10-20: `hazard.fireball` at the bolide's peak brightness, to the second; impact and radiated energy, altitude and speed in attrs, no magnitude. 186 reports without a location are left out | 1988 → 2026 | 888 events (trial import on a copy) |
| `epica` | EPICA v1.1, Europe's preinstrumental quakes with intensity ≥ 5 or Mw ≥ 4 (INGV), importer added 2026-10-20: `hazard.quake` with Mw as magnitude. 393 are `same_as` an NCEI quake and hide behind it | 1000 → 1899 | 5,703 events, 5,310 shown (trial import on a copy) |
| `oxrep-shipwrecks` | OxREP Shipwrecks Database v2.1 (Strauss, Wilson & Flohr 2017), importer added 2026-10-20: `accident.shipwreck` spanning the earliest to the latest date its cargo allows, at points the source blurs on purpose (approximate). 234 wrecks without a point and 49 without a date are left out | 2500 BCE → 1600 | 1,535 events (trial import on a copy) |
| `cline-coups` | Cline Center Coup d'État Project v2.2.2, importer added 2026-10-20: successful coups (`politics.coup`, 472), failed attempts (`politics.coup.attempt`, 408) and plots stopped before any attempt (`politics.coup.conspiracy`, 281), dated to the day, at the seat of government at the time (`capitals.csv`, labelled in `placed_at`). Who acted and the leader's fate in attrs. 205 are `same_as` a Wikidata coup and hide behind it | 1945 → 2026 | 1,161 events, 956 shown (trial import on a copy) |
| `pax` | PA-X Peace Agreements v10 (University of Edinburgh; CC BY-NC-SA 4.0 and PA-X terms), importer added 2026-10-20: `politics.peace_agreement` (ceasefires, framework and implementation texts, joint statements), dated to the day. No agreement has a place: 2,001 sit at the middle of the UCDP conflict they address (as `ucdp-brd` placed it, and `related` to it), 250 at the first country's capital. 6 naming no country or conflict are left out; 24 are `same_as` a Wikidata treaty and hide behind it | 1990 → 2025 | 2,251 events, 2,227 shown (trial import on a copy) |
| `ibtracs` | IBTrACS v04r01 (NOAA NCEI), importer added 2026-10-20: one `hazard.storm` per tropical cyclone, from first to last fix, at the fix of peak wind (10,627), else lowest pressure (65), else mid-track (2,641 old storms with no intensity), each labelled in `placed_at`. The 6-hourly track is stored as a LineString in `ev_event.geom`, which nothing draws yet. Peak wind, its agency and averaging, lowest pressure and Saffir–Simpson category in attrs; no magnitude. 292 spur tracks (alternates of a main track) are left out | 1842 → 2026 | 13,333 events from 730,064 fixes (trial import on a copy) |
| `mass-mobilization` | Mass Mobilization Project v5.1 (Clark & Regan, Harvard Dataverse, CC0), importer added 2026-10-20: `politics.protest`, one per protest against a government, dated to the day. Placed from the free-text location with the geolocation index: a town or district the source names 13,330 (city 13,024, area 295, approximate 40; 183 after fixing a misspelling or a character the file lost), a misspelt capital 23, a description's "in X" 6, and nationwide, "several cities" or only the country 1,434 at the capital then, country precision; each says so in `placed_at`. 1,906 country-years with no protest, 418 locations the gazetteer can't place and 28 with none are left out. Participants, demands and state responses in attrs; no magnitude. 124 are `same_as` a Wikidata riot, protest or strike and hide behind it | 1990 → 2020 | 14,793 events (trial import on a copy) |
| `slave-voyages`, `slave-voyages-intra` | SlaveVoyages' Trans-Atlantic (2019) and Intra-American (1.0) databases, importer added 2026-10-20: `slavery.voyage`, one per voyage, dated at departure (the recorded date, else SlaveVoyages' imputed year; Intra-American voyages by their imputed arrival year), at the principal place where captives were bought, on SlaveVoyages' own coordinates: ports at city precision (22,439), rivers, coasts and islands at area (2,507), "<region>, port unspecified" approximate (11,326), places known only by continent or a catch-all ("Africa, port unspecified", the stretches of "Other Africa", "West Indies") country (8,760); 15 places the site gives no point found by name, 576 at their region's point. The port sequence (purchase → port of call → landings) is a LineString in `ev_event.geom` for 33,773 voyages, which nothing draws yet. People embarked as magnitude; disembarked, deaths, flag, captain and outcome in attrs. 2,356 voyages with no place of purchase, 11 "bought" at sea or as prizes and 230 whose place SlaveVoyages gives no point at any level ("Americas, port unspecified") are left out | 1514 → 1866 | 34,421 + 10,611 events (trial import on a copy) |
| `naturalearth`, `glwd` | Modern borders, lakes and wetlands | static | 242 + 3,721 features |

**Known gaps** (`meta_dataset_gap`): GTD has no 1993 records (lost by the publisher).

### 5.2 Recording (live)

The web app does the fetching: `record()` (`packages/archive/src/recorder.ts`) writes each upstream reply to `data/archive/raw/<source>/YYYY/MM/DD/HH.ndjson.zst` when `TAKIP_ARCHIVE_DIR` is set. The ingest worker keeps the routes warm (`apps/ingest/src/jobs/keepalive.ts`: flights and ships every 60 s, satellites and cameras every 30 min), seals the raw hours into track shards, and polls USGS itself (every 10 min, plus a daily 30-day pass). Per-source on/off switches are in `meta_source` and mirrored to `data/archive/control.json`. Below 50 GB of free disk the recorder pauses AISStream first, then OpenSky, adsb.lol and adsb.fi.

| Source | Recording since (UTC) | Raw archive | Hours on file to 10-15 23:00 | Built into | Status at snapshot |
|---|---|---:|---:|---|---|
| AISStream (ships) | 2026-10-12 20:00 | 1.1 GB | 76 of 76 | tracks, class 1 | ok; sealed only to 10-12 |
| OpenSky (aircraft) | 2026-10-12 20:00 | 92 MB | 53 of 76 | tracks, class 2 | gaps while the web app was down (10-14: 17 h, 10-15: 8 h); sealed only to 10-12 |
| adsb.lol (aircraft) | 2026-10-12 20:00 | 60 MB | 53 of 76 | tracks, class 2 | as OpenSky |
| adsb.fi (aircraft) | 2026-10-12 21:00–22:00 only | 0.4 MB | 1 | tracks, class 2 | idle: a fallback, so it has nothing to record while adsb.lol answers |
| CelesTrak (TLEs) | 2026-10-12 22:00 | 18 MB | 71 | `tle.db` (append-only) | raw grows; `tle.db` still holds only the 10-12 snapshot |
| Camera catalogue | 2026-10-12 21:00 | 78 MB | 64 | nothing yet: `cam_camera_version` is empty | raw only |
| USGS (earthquakes) | 2026-10-12 22:00 | 0.2 MB | — | `history.ev_event` | 1,830 quakes, 2026-09-12 → 10-12; stopped with the worker |
| SatNOGS (TLE fallback) | — | — | — | used only when CelesTrak fails; nothing yet |
| adsb.lol daily history (backfill, CLI) | — | 368 MB | 25 | tracks, class 2 | 2026-10-11 00:00 → 10-12 01:00: 55,469 aircraft, 18.95 M points |

Live recording has run for three days, but the tracks stop at 2026-10-12: everything before 2026-10-12 20:00 UTC is the one backfilled adsb.lol day, which has no ships, and nothing after 10-12 has been sealed. OpenSky can backfill only about an hour, and needs an account.

**The ingest worker has not run since 2026-10-12 about 23:20 UTC** (still not running at this snapshot). `npm run dev` (`tools/dev.mjs`) starts only the web app and `apps/api`. Without it, USGS polling and track sealing stop and `tle.db` is not appended; the raw archive still grows, but only while the web app is up and something calls its routes. Sealing the 10-13 → 10-15 hours needs the worker (`npm run ingest -- worker`).

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
| public-domain | naturalearth, usgs, noaa-hazards, takip-seed, cneos-fireballs, ibtracs | yes | public domain |
| cc0-1.0 | wikidata-battles, wikidata-politics, wikidata-attacks, wikidata-wars, wikidata-revolutions, wikidata-massacres, census-idb, mass-mobilization | yes | public domain |
| adsblol-odbl | adsblol, adsblol-history | yes | share-alike |
| satnogs-cc-by-sa | satnogs | yes | share-alike |
| cc-by-4.0 | wdi, ucdp-brd, owid-*, gdis, wb-cckp, wb-gep, gcat-launches, epica, cline-coups | not set | attribution |
| cc-by-sa-4.0 | ww1-wiki | not set | share-alike |
| cc-by-3.0-igo | wpp-2024, wup-2025 | yes | attribution |
| cc-by-sa-3.0-igo | unesco-whc | not set | share-alike |
| cow-terms | cow-interstate, cow-territorial, icow, cow-nmc | not set (the COW page says **no**: "not to be used for any commercial activity", and no redistribution without written permission) | attribution |
| opensky-terms | opensky | **no** | none |
| oecd-terms | oecd-lt-eo117 | yes | attribution, carried into sub-licences |
| imf-terms | imf-weo | **no**: commercial reuse and systematic download need the IMF's written permission | attribution |
| sipri-terms | sipri-milex | **no**: commercial use needs SIPRI's authorisation and licence, and reproducing over 10% of a dataset needs its permission | display: charts and citations with SIPRI's credit line |
| gtd-terms | gtd | **no**; public display also needs written permission from START | none |
| glwd-terms | glwd | **no** | attribution |
| stanford-shl-nc | ww2-borders | **no** | attribution |
| smithsonian-terms | gvp-eruptions | **no**: personal, educational and other non-commercial use, crediting the Smithsonian (GVP's terms page; the user is arranging an agreement) | attribution |
| pax-terms | pax | **no**: CC BY-NC-SA 4.0, and the PA-X terms bar fees, commercial use and re-using the database whole or a substantial part as a similar database; use should credit the University of Edinburgh's copyright and database right and be notified to peacerep@ed.ac.uk | share-alike |
| slavevoyages-terms | slave-voyages, slave-voyages-intra | **no**: SlaveVoyages' Legal page puts data from historical documents in the public domain, but the imputed data (its asterisked variables, which place, date and count most voyages here) is CC BY-NC 3.0 US. Cite the database, its year and the site: "The Trans-Atlantic Slave Trade Database. 2019. SlaveVoyages. https://www.slavevoyages.org" | attribution |
| odbl-1.0 | deflock-alpr, plague-outbreaks | yes | share-alike |
| aisstream-terms, adsbfi-terms, celestrak-terms, cctv-mixed | the matching source | not set | unknown |
| unknown | wac1914, cow-extra, iq-2023, sipri-nuclear, oxrep-shipwrecks | not set (SIPRI requires authorisation for commercial use) | unknown |

**Access:** every tier (`anon`, `free`, `paid`, `internal`) can view data under all 18 licences, and export is off for all of them.
