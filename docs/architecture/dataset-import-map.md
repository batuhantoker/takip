# Dataset import map

> **Status:** implemented 2026-10-12 in `tools/import/` (`npm run import -- <seed|all|check|dataset…>`); see §6 for where the code departs from this map. This describes how each raw dataset lands in the schema in [`replay-schema.sqlite.sql`](./replay-schema.sqlite.sql). The import pipeline itself is in [`replay-database.md`](./replay-database.md) §7.5.
> Raw files: `docs/data/raw-2026-10-12-new/` (historical, 2.1 GB) and `docs/data/raw-2026-10-12/` (US infrastructure, 2.3 GB). Both are gitignored.

Conventions used below:
- **Table names are written `schema.table`,** matching the Postgres target. In SQLite this is table `schema_table` in the file given in [`replay-database.md`](./replay-database.md) §4.1. For example, `ev.event` is `ev_event` in `history.db`, and `core.entity` is `core_entity` in `catalog.db`.
  - A `geo.feature` row in layer `X` is a row of `feature` in `geo/X@<version>.db`.
  - `stage.*` tables live in the disposable `stage/<dataset>.db`.
- **`prec`** is the time precision (§5 of the main doc). **`geo`** is the geo precision: exact, city, country or approximate.
- **"→ polity(scheme)"** means the value is resolved with `resolve(scheme, value, t_start)`. Values that don't resolve go to `stage.unresolved`.
- **Every importer writes `attrs.t_raw`** whenever it maps a sentinel or a partial date.

## 0. Seeds (load first)

| Seed | Source | Into |
|---|---|---|
| Licences | Hand-written, from `DATA-SOURCES.md`. Every one starts with `commercial_use = null` except PD and CC0. | `meta.licence` |
| Sources | One row per dataset family below, plus every live feed | `meta.source` |
| Modern borders | Natural Earth admin-0, 1:10m and 1:50m (public domain; needs downloading) | `core.entity` (polity) + `core.polity` + `geo.feature` layer `admin0` (+ `feature_gen` per zoom band) |
| Code crosswalk | ISO 3166 (iso3/iso2/isonum), WB codes from WDI `Country.csv`, COW states (ICOW `states.csv` + COW list), Gleditsch-Ward list, GTD codebook, OWID codes. Each with **validity**. | `core.entity_identifier` |
| Historical polities | USSR, Yugoslavia, Czechoslovakia, GDR, FRG, North and South Yemen, South Vietnam, Zaire, Rhodesia, Austria-Hungary, Ottoman Empire, Russian Empire, Prussia, Sardinia, Zanzibar, pre-1871 German and Italian states | `core.polity(kind='historical')` + `core.polity_render` + `core.entity_link(successor_of)` |
| Aliases | Every name variant found in the datasets (`S2` in the profiling notes). Examples: "United States of America", "USA", "DR Congo (Zaire)", "Congo, Dem. Rep.", "Congo - Kinshasa", "Ivory Coast", "Côte d’Ivoire", "Burma", "Swaziland", "Macedonia, FYR", "Viet Nam", "Lao PDR", "Korea, Rep." | `core.entity_name` |
| Region groups | WB regions and income groups, GBD/SDI groups, WHO/SDG regions, World, EU27, Global/ALL, the 5 UNESCO and 12 GTD regions | `core.entity(type=region_group)` + `core.region_member` |
| Event kinds and roles | The lists in the DDL comments | `ev.kind`, `ev.role` |

Polity validity uses COW and GW system-membership dates where they exist. Two codes need special handling:
- **COW `365`:** Russian Empire `[1816, 1917-11)`, USSR `[1922-12, 1991-12-26)`, Russia from then on.
- **The 1914 dataset's `ZWE`:** Rhodesia `[1965-11, 1980-04-18)`, then Zimbabwe.

## 1. Skip list (duplicates found during profiling)

| Skip | Reason | Import instead |
|---|---|---|
| `wars/war_list_1816_2010_long_format.csv`, `wars/wars_with_approximate_location.csv` | Byte-identical to `war_list_1816_2010.csv` | `war_list_1816_2010.csv` |
| `wars/territorial_changes_since_1945.csv`, `conquests_since_1816.csv`, `conquests_since_1945.csv` | Exact subsets of `territorial_changes_since_1816.csv` | The 1816 file. Conquests are `type = Conquest`. |
| `World War 1 Battles/WW1_DataEncoded.csv` | The same file with a BOM added | `WW1_Data.csv` |
| `life-expectancy/1- life-expectancy.csv` | The first 4 columns of file 3 | Files 3 and 2 |
| `country-development notes/database.sqlite` | The same data as the CSVs | The CSVs (stream-friendly) |
| `country-development notes/hashes.txt` | Build artefact | — |

The importer records each skipped file's checksum in `meta.dataset.files` as `skipped: duplicate_of`, so a later download that differs gets noticed.

## 2. Events

### 2.1 Global Wars & Armed Conflicts, 1914–2026 → source `wac1914`

| File | Into | Mapping |
|---|---|---|
| `conflicts.csv` (106) | `ev.event` | Key `conflict_id`. Kind from `conflict_type`, with the 33 free-text values mapped to `war.interstate`, `war.civil`, `war.world`, `conflict.armed`, `war.independence`, … through a checked-in table. `start_date` day prec. `end_date = ONGOING` → `ongoing`. Anchor = `latitude/longitude`, geo approximate. `magnitude = total_casualties_estimate`. `-1` → null (the `*_reported` flags go into attrs). `cities` → `attrs.cities[]`, queued for the gazetteer. Region, status, outcome and side text → attrs. |
| `conflict_participants.csv` | `ev.event_entity` role `participant` (the file has no side) | `country_id` → polity(wac). `side_a`/`side_b` text in the conflict row is matched to participants by name where possible, upgrading the role to `side_a`/`side_b`. |
| `countries_reference.csv` | identifiers scheme `wac` | `ZWE` is split by validity, as described in §0. `RUS-CHEC` (Chechnya) becomes a subnational polity. |
| `sources.csv` (45) | `doc.document(kind=citation)` + `doc.document_link(role=source_of)` | From the `source_ids` pipe list |
| `data_dictionary.csv` | `meta.dataset.report.dictionary` | — |

### 2.2 COW Inter-State Wars v4 → sources `cow-interstate` and `cow-extra`

From `wars/war_list_1816_2010.csv` (340 participant rows, 98 wars):

- **One `ev.event` per `WarNum`,** kind `war.interstate`.
  - Start is the earliest participant start; end is the latest participant end. Day prec, or month/year where a day or month is `-9`.
  - Anchor = the war's `lat/lng`, geo approximate.
  - `attrs`: `WhereFought`, `total_battle_deaths`.
- **Each participant row → `ev.event_entity`:**
  - `ccode` → polity(cow) at the participant's start date. `Side` 1/2 → `side_a`/`side_b`. `Initiator = 1` adds a second row with role `initiator`.
  - The second spell (`StartYear2 ≠ -8`) gets `spell = 2` with its own `period`. Side-switchers keep both rows. The key is `(WarNum, ccode, Side, spell)`.
  - `BatDeath = -9` → null. `Outcome`, `TransFrom` and `TransTo` → attrs.
- **The three added rows** (WarNum `99999`, `999999`, `99999900`) go to source `cow-extra` with `confidence 0.5`.
  - The 2022 Russo-Ukraine row's coordinates point into Iran, so its geometry is dropped (`stage.manual_fix`) and it falls back to the country centroid.
- **Links:**
  - WWI (WarNum 106) and WWII (139) are linked `same_as` to WAC `CNF-0001` and `CNF-0013`. (`CNF-0002` is the Russian Civil War.)
  - About 15 other matches (Chaco, Korea, Six-Day, Yom Kippur, Iran-Iraq, Falklands, Gulf, Kosovo, Kargil, Football War, …) come from a checked-in mapping table. They are not fuzzy-matched at runtime.
  - The resolution job sets `canonical_id` to the WAC row, because it is newer and covers civilians.

### 2.3 COW Territorial Change → source `cow-territorial`

From `wars/territorial_changes_since_1816.csv` (842 rows):

- **One `ev.event` per row,** kind `change.territorial`.
  - Key: `sha1(year, gaining, losing, type, area)` plus an ordinal. One exact duplicate (1904 France←UK) collapses into one row.
  - Year prec. Embedded newlines in `type` are removed, and the type goes in `attrs.process` (conquest, cession, secession, unification, …).
  - `pop`/`area` of `.` → null.
- **`event_entity`:** roles `gaining` and `losing`.
  - Resolved by `iso3c_*` where present. `NA` (historical states) is resolved by name through aliases.
- **Geometry:** none. It renders at the losing polity's anchor, geo country.

### 2.4 ICOW Territorial Claims 1816–2001 → source `icow`

| File | Into | Mapping |
|---|---|---|
| `states.csv` | identifiers scheme `cow` (names → aliases) | Only adds codes missing from the crosswalk |
| `territories.csv` (837 claim-dyads, 372 claims) | `ev.event` ×2 levels | **Parent:** one event per `claim_id`, kind `claim.territorial`, named from the most common `name`. **Child:** one event per `claimstates_id`, `parent_id` → the claim. `start_claim`/`end_claim` are YYYYMM; month `00` gives year prec; `200199` → `ongoing`, with `attrs.censored_at = 2001-12`. `event_entity`: `state1`/`state2` → role `claimant`. `claim_resolution`, `claim_violence` and the salience fields → attrs. No geometry; renders at the claimants' midpoint, geo approximate, until the gazetteer resolves the territory name. |
| `years.csv` (13,673 dyad-years) | `x_icow.claim_year` (typed, all 39 columns) + `ts.series` for numeric salience (`icow:salience`, `icow:salience_s1`, `icow:salience_s2`) with subject = the child event | Rename `insterstate_war` → `interstate_war` |

### 2.5 UCDP Battle-Related Deaths → source `ucdp-brd`

From `battledeaths_global_1946_2025.csv` (1,591 conflict-years, actually 1989–2025):

- **One `ev.event` per `conflict_id`,** kind `conflict.armed`.
  - Start = the first year, end = the last year, year prec. `attrs.incompatibility`, `type_of_conflict` and `territory_name`.
  - Anchor = the centroid of the `gwno_loc` polities, geo country.
- **Series** (subject = the event): `ucdp:bd_best`, `ucdp:bd_low`, `ucdp:bd_high` per year. Rows with `version = 26.0` for 2025 are flagged `preliminary`, and a `meta.dataset_gap(kind='preliminary')` is written.
- **`event_entity`** comes from splitting the comma lists:
  - `gwno_loc` → `location`
  - `gwno_a` → `side_a`
  - `gwno_b` → `side_b`
  - `gwno_*_2nd` → `supporter`, using polity(gw)
  - Non-state `side_b` actors → `core.entity(type=org)` with scheme `ucdp_actor` (from `side_b_id`).
- **Dyads:** `dyad_id` lists → `attrs.dyads[]`.

### 2.6 GTD → source `gtd` (licence: non-commercial)

From `globalterrorism.csv` (181,691 rows × 135 columns):

- **Decoding:** each field is tried as UTF-8 first, then cp1252.
- **Key:** `row:<sha1(iyear,imonth,iday,country,provstate,city,latitude,longitude,attacktype1,targtype1,target1,gname,nkill,nwound)>:<ordinal within identical rows>`. The same file always produces the same keys. **`eventid` and `related` are kept raw in `x_gtd.incident`,** but nothing is linked on them.
- **Core `ev.event`:**
  - Kind `attack.terror`.
  - Time: `iyear/imonth/iday`. `0` lowers the precision (month, then year).
  - Duration: when `extended = 1` and `resolution` parses as `m/d/yyyy`, that is `t_end`. Ambiguous `xx-xx-yyyy` dates stay in `attrs.t_raw`.
  - Anchor = `latitude/longitude`. The precision comes from `specificity`: 1 → exact, 2 → city, 3–4 → area, 5 → country. When `specificity = 5`, or coordinates are null, the anchor is null and the event renders at the country centroid.
  - **Rows with out-of-range coordinates** (the −86,185,896 longitude) get a null anchor and a `stage.manual_fix` entry.
  - `magnitude = nkill`. `severity` is derived from nkill + nwound. `title` = `attacktype1_txt — city`.
- **`event_entity`:**
  - `country` → polity(gtd), role `location`.
  - `gname`, `gname2`, `gname3` → `org` entities (scheme `native:gtd`, name normalised), role `perpetrator`. The value `Unknown` is skipped, and Excel-damaged names (`09-Feb`, `01-May`) go to `stage.unresolved`.
  - `natlty1-3` → polity(gtd), role `target_nationality`.
- **`x_gtd.incident`:** every other column, typed. That covers target, weapon, claim, property and hostage groups, `summary`, `motive`, `scite1-3`, `dbsource` and the `INT_*` flags. Sentinels −9/−99 → null.
- **Gaps:** `meta.dataset_gap`, 1993 missing. GTD coverage ends in 2017.

### 2.7 WW1 battles → source `ww1-wiki`

From `World War 1 Battles/WW1_Data.csv` (309 rows):

- **One `ev.event` per row,** kind `battle`, key = `URL`.
- **Time:** `StartDate_clean`/`EndDate_clean`, day prec. Second Battle of the Aisne: `stage.manual_fix` 2024 → 1917.
- **Coordinates:** parsed from `Location` text with a regex for `dd.dddd°N dd.dddd°E` (139 rows), geo exact. The rest go to the gazetteer queue, falling back to approximate.
- **Free text:** belligerents, strengths and casualties stay in attrs, with `[n]` markers stripped. `casualties_dict_*` is parsed into `attrs.casualties`.
- **Relations:** `part_of` → WAC `CNF-0001` (canonical WWI).
- **Wikipedia URL** → `doc.document(kind=citation)` + link `source_of`.

### 2.8 Tariff timeline → source `tradewar`

From `Global Trade War 2018 - Present /tariff_timeline.csv` (141 rows):

- **Kind `econ.tariff`,** day prec, key `sha1(date, imposing, target, sector, rate)`.
- **`event_entity`:** `imposing_country` → `imposing`, `target_country` → `targeted`. `EU`, `EU27`, `Global` and `ALL` resolve to region groups.
- **The 99 rows with `type = 'NewsAPI'`** get `confidence 0.3` and `attrs.unverified = true`. The default layer filter hides them.
- **Geometry:** none. Renders at the imposing polity's anchor.

## 3. Series

| Dataset | Source | Metrics | Subject | Notes |
|---|---|---|---|---|
| WDI `Series.csv` | `wdi` | 1,345 × `wdi:<SeriesCode>` (`IC.LGL.PROC` has no data) | — | Definitions, source, topic and licence → `ts.metric.attrs` and `x_wdi.series_meta` |
| WDI `Country.csv` | `wdi` | — | polity(wb); 33 aggregates → region groups | Region, income group and lending category → `core.region_member`; the rest → `core.entity.attrs.wdi` |
| WDI `Indicators.csv` (5.66M) | `wdi` | `wdi:*` | polity(wb) / region group | Year prec. Stream and `COPY`, roughly 10 minutes on the NUC. Aggregates are kept, as series of region groups. |
| WDI `Footnotes.csv`, `CountryNotes.csv`, `SeriesNotes.csv` | `wdi` | — | — | Codes upper-cased (`mdg` → `MDG`, `yr2012` → 2012). Descriptions deduplicated into `ts.note` (the top 5 cover 31% of rows) and linked by `ts.point_note`. |
| Trade war `trade_volume_annual.csv` | `tradewar` | the **same** `wdi:<code>` metrics | polity(iso2) | Separate series, because the source differs. The chart overlays WDI to 2015 with this to 2025. |
| Trade war `stock_market_reaction.csv`, `sector_impact.csv` | `tradewar` | `px:open`, `px:high`, `px:low`, `px:close`, `px:volume` | `core.entity(type=instrument)`, scheme `ticker` | Day prec. Derived columns (returns, MAs, volatility, `indexed_to_100`) are **not stored**; the API computes them. VN-Index's `VNM` ticker is aliased to `native:tradewar:VNINDEX`. |
| Trade war `currency_impact.csv` | `tradewar` | `fx:rate_vs_usd` | instrument, scheme `iso4217` | Derived columns not stored |
| Trade war `inflation_response.csv` | `tradewar` | `fred:<series>` | polity USA | Monthly prec. `era`/`post_tariff_era` are not stored, because they are derived from the date. |
| `countries-in-conflict-data.csv` | `owid-conflict` | `owid:conflict_deaths_all` | polity(iso3 / owid) | Year prec. A complete panel: zeros are real zeros. |
| `life-expectancy/3-…csv` | `owid-le` | `owid:le_0`, `le_10`, `le_25`, `le_45`, `le_65`, `le_80` | polity(iso3/owid); continents → region groups | Year prec; 1543–2021 |
| `life-expectancy/2-…csv` | `owid-le-hmd` | `owid:le_0` | same | A separate source: HMD + UN WPP methodology |
| `global education/1-4` | `owid-edu` | `owid:edu_no_formal`, `edu_some_formal`, `lays`, `oos_male`, `oos_female`, `ger_tertiary_f/m`, `ner_secondary_m/f`, `ner_primary_f/m` | polity / region group | Pivoted to long. Rows with a null `Code` are aggregates. |
| `share-…-drinking-water….csv` | `owid-water` | `owid:water_safely_managed` | resolved by **name** (the file has no code column) | Null values are not stored. "(WHO)" and "(SDG)" aggregates → region groups. |
| Mental health CSV | `owid-mental` | Block 1: 7 prevalence metrics. Block 2: `prev_male`, `prev_female`, `population`. Block 3: `suicide_rate`, `depressive_rate`. Block 4: `depressive_count`. | polity / region group | **Split at the repeated header rows** (6470, 54278, 102086). BCE years (e.g. `10000 BCE`) become negative years with year prec. Population is taken from block 2 only. "Saint Barthlemy" is fixed by an alias. |
| `International_IQ.csv` | `iq-2023` | `iq:average`, `iq:participants` | resolved by name | Undated. `t` = the dataset `as_of` with prec 0. The one row with no country is rejected. Licence and methodology unverified; flagged `internal` in `meta.access_policy` until reviewed. |

## 4. Features and places

| Dataset | Layer | Entity? | Geometry | Validity | Notes |
|---|---|---|---|---|---|
| UNESCO WHC 2021 (1,155) | `unesco-whc` | yes, `heritage_site`, key = `Name` | Point | `[date_inscribed, ∞)` (year prec). `danger = 1` with `date_end` → `ev.event` kind `status.in_danger` ending at `date_end`. | HTML stripped from `short_description`. The `iso_code` lists become `entity_link(located_in)` to each polity. `0` and empty codes are resolved by name. |
| GLWD level 1 (3,721) | `glwd-lakes` | yes, `waterbody`, key = `GLWD_ID` | MultiPolygon from WKT; `ST_Subdivide(256)` in `feature_gen`; Caspian simplified per zoom band | Reservoirs with `DAM_YEAR > 0`: `[DAM_YEAR, ∞)`. Lakes: static. | Reservoirs then appear on the map in the year they were dammed. `COUNTRY`/`SEC_CNTRY` → `located_in` links, resolving old names (Zaire, Burma, Yugoslavia) at time `DAM_YEAR` or 1990. |
| European Borders WWII (Stanford Spatial History Lab; `raw-2026-10-12-ww2/`, 88 monthly shapefiles + `Territorial_Changes`) | `ww2-europe` | no | MultiPolygon, reprojected from Europe Albers (ED50; the ~100 m datum shift is ignored), simplified to 0.01° | Each polity's run of unchanged months is one feature, `[month end, next month end)` | `Foreign_Po` → alignment (axis, occupied, belligerent, allied, neutral, none); `Belligerent` is Axis for Germany and Italy and "neither bloc" for the USSR in 1939–41. Two manual fixes for Italy (§6). The 81 annexations become `change.territorial` events at their exact dates. Non-commercial. |
| US infrastructure (`raw-2026-10-12/`, 25 files) | One layer per file, as today's `data/reference` catalogue | Airports, ports, dams, military bases, spaceports: yes. Line networks: no. | As in the files. Lines and polygons get `feature_gen` per zoom band (replacing `tools/slim-geodata.py` simplification). | dams `[yearCompleted, ∞)`; tunnels `[year_built_a1, ∞)`; aviation facilities `[ACTIVATION_DATE, ∞)`; bikeshare one feature per system-year `[YEAR, YEAR+1)`; others static | Implements `ReferenceStore` on PostGIS: bbox → `&&`, tiers → `tier`, simplification → `feature_gen`. **`airports.csv`: `NA` means Namibia or North America, not null.** The dams `inspectionDate` 5023 → null. |

## 5. Live sources (for completeness)

| Source | Shape | Table | `source_record_id` / key | Time |
|---|---|---|---|---|
| aisstream | track + state | Sealed into `trk.segment` from the archive, plus `trk.state`; entity vessel | mmsi (+ imo when seen) | receive time, `flags.t_is_receive` |
| OpenSky, adsb.fi | track + state | Sealed into `trk.segment` from the archive, plus `trk.state`; entity aircraft | icao24 (+ registration) | `time_position` |
| CelesTrak | tle | `trk.tle`; entity satellite | norad id + epoch | epoch |
| CCTV (70 regions) | catalogue | `cam.camera_version`; entity camera | `(source, native_id)` | run time |
| USGS | event (revisable) | `ev.event` `hazard.quake` | USGS id | origin time |
| EONET, NWS, GDACS | event (interval, polygons kept) | `ev.event` | provider id (**not** `gdacs-N`) | onset / expires |
| FIRMS | stream | `ev.event_stream` `hazard.fire` | sha1(satellite, lat, lon, acq_date, acq_time) | acquisition time |
| GDELT 2.0 | stream | `ev.event_stream` `gdelt.event` | GLOBALEVENTID | DATEADDED |
| News wires, Telegram | document (+ stream if geolocated) | `doc.document`, `ev.event_stream` `news.report` | md5(url) / `channel/id` | published |
| Feodo C2, URLhaus, Cloudflare Radar, IODA | event (interval) | `ev.event` `cyber.c2`, `outage.internet` | ip:port / URLhaus id / Radar id | first_seen to last_seen |
| Yahoo, CoinGecko, SWPC Kp | series hf | `ts.point_hf` | symbol / index | quote time |
| Open-Meteo grid | grid | `ts.grid_frame` (`kind = forecast`, nowcast hour) | grid + valid time + issued | valid time |
| AOI watch (`lib/watch.ts`) | derived event | `ev.event` with `attrs.algorithm_version` and supporting observation ids | deterministic hash | sweep time |
| `/api/conflicts` static zones, static ports and chokepoints | — | **Not recorded.** They are static data presented as live (`TODO.md` L42). | — | — |

## 6. As built

Where `tools/import/` departs from the map above, and why:

- **No `stage/*.db`.** Transforms are TypeScript over the CSV stream, writing through the stores in `packages/db`. Rejects, unresolved values, mapped sentinels and manual fixes go into `meta_dataset.report`.
- **No typed extension tables yet.** `x_gtd.incident` and `x_icow.claim_year` don't exist. GTD keeps a curated set of columns in `attrs`. ICOW's salience goes to series only.
- **Polity keys** are the `id` of `public/data/boundaries/countries.json` (ADM0_A3), plus `hist:*` for historical polities. Both are stored under the scheme `takip`. Natural Earth 10m is not downloaded yet; that file stands in for `admin0`.
- **Crosswalk files:** `seed/polities.csv`, `seed/identifiers.csv` (cow/gw/wac/owid/wb/gtd with validity) and `seed/aliases.csv`. GW differs from COW at 255/260/678 and for the Pacific microstates (970–973).
- **COW interstate:**
  - 27 wars link `same_as` to WAC, with 10 `part_of` links where COW codes only one phase of a WAC war (`WAC_MATCHES` in `cow.ts`). WAC rows are canonical.
  - Territorial-change iso3 codes are switched to the COW code holder of the year, e.g. Turkey → Ottoman Empire.
- **UCDP:**
  - Code lists and name lists are not in the same order, so they are matched as sets. 32 non-state actor ids that always co-occur can't be told apart; they are named after both actors.
  - The five 2025 rows (version 26.0, conflicts 20001–20005) have sequential ids and invalid GW codes. They are loaded flagged `preliminary`, with names winning over codes, and should be checked against the official release.
- **GTD:**
  - `eventid` and `related` are Excel-mangled (`1.97E+11`) and kept raw only.
  - Northern Ireland and Corsica map to GBR and FRA through the `gtd` scheme only, not as global aliases. OWID publishes them separately.
  - "International", "Multinational" and "CIS" are region groups.
- **WW1:** with no coordinates, a battle is placed by the country its location text names ("present-day Belgium") before the belligerents' midpoint. Otherwise Mons lands mid-Atlantic. Colonies resolve to today's holder of the territory.
- **UNESCO:** the file has no listing dates for the danger list. `danger = 1` becomes an ongoing `status.in_danger` event from the dataset year (2021), and `date_end` alone becomes a "removed from the list" event in that year.
- **OWID:** rows without a code become region groups, including England, Scotland, Wales and Northern Ireland, which aren't separate polities.
- **IQ:** visible to every tier while its terms are pending, like every other source, rather than `internal`.

- **Serving, until the MVT event tiles of replay-database.md §8.4:**
  - `GET /api/replay/history/events?bbox=w,s,e,n&from=&to=&z=&families=` returns GeoJSON in epoch seconds. When a family has more than 2,000 events in the view, it comes back as counted cells: a 12-per-tile grid × 10 time bins, from `EventStore.cells`. GTD is usually the family that gets merged.
  - `GET /api/replay/history/events/:id` returns one event with its source's attribution.
  - Both routes are gated by licence tier only, not by `replay.lookback_days`.
- **History mode** (the History tab, separate from Replay):
  - `GET /api/replay/history/series` lists the 1,374 yearly metrics with entity series; `GET /api/replay/history/series/:metric` returns one metric's points keyed by today's shapes, with historical polities painted on their successors and tagged `via`.
  - `GET /api/replay/history/features/:layer?bbox&z&from&to` returns a time-valid geo layer as GeoJSON. Features are found through the piece index, then sent whole and simplified for the zoom band, so outlines show no piece seams.
  - `ww2-europe`: unchanged months are merged when status and head of state match and the area differs by under 0.01%, because unchanged borders are redigitised slightly every month. A one-month blank status between two equal ones (Sep and Nov 1942) takes that status. Italy is fixed in Jun 1940 (Neutral → Belligerent) and Sep 1941 – Aug 1942 (Allies → Axis). Borders change at month ends: the Anschluss shows from 31 Mar 1938, while its annexation event carries 13 Mar.
- **Map:** `use-history-layer.ts` draws the families the History panel picks, and only recorded quakes in Replay. An empty family list draws nothing. It fetches one view per time bucket, sized from playback speed: a year when slow, up to a decade when fast. A cell's count therefore covers a tenth of the bucket. The clock only moves the layer filter. A mark with `geo_prec` ≥ 4 is hollow, because the source gave no coordinates.
