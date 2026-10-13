# Reference map data: `data/reference/`

Slimmed reference data for future TAKIP layers:
- most of it from the US DOT/BTS **National Transportation Atlas Database (NTAD)**;
- airports and runways from **OurAirports**;
- one community KML.

The files are gitignored (~320 MB); only this README is tracked. The raw downloads (2.3 GB) are in `docs/data/raw-2026-10-12/` until someone deletes them.

**How the files were slimmed** (`tools/slim-geodata.py`):
- GeoJSON in WGS84, one feature per line.
- Coordinates rounded to 5 decimals (~1 m).
- Only the fields listed below are kept, and empty values are omitted.
- Lines and polygons are simplified with Douglas-Peucker:
  - **10 m** for infrastructure: roads, rail, waterways, ferry routes and boundaries;
  - **50 m** for the overview routes: Amtrak and intercity bus.
- Points and runways are not simplified.

**To refresh:** download the raw files into a folder, keeping either their download names or the names below, then run `python3 tools/slim-geodata.py <download-dir> data/reference`. It takes ~15 s on 4 workers at low priority. Don't raise the worker count: a one-worker-per-core run coincided with the laptop freezing.

**Licence key** (same as `DATA-SOURCES.md`): **OK** public domain / CC0 / CC BY · **OK\*** allowed with conditions · **Verify** unknown, check first. US federal works and OurAirports are public domain; still check each source page before it ships.

## At a glance

| File | What | Geometry | Features | MB (raw → now) | Data vintage | Licence |
|---|---|---|---:|---:|---|---|
| `airports.geojson` | OurAirports, worldwide; closed airports removed | Point | 72,662 | 12.7 → 23.2 | downloaded 2026-10-12 | OK |
| `runways.geojson` | OurAirports runways with both ends located | Line | 14,411 | 4.0 → 3.2 | downloaded 2026-10-12 | OK |
| `spaceports.geojson` | Licensed and federal spaceports | Point | 20 | <0.1 | not stated | OK |
| `military-bases.geojson` | DoD installations, public MIRTA release | Polygon | 824 | 27.1 → 2.1 | not stated | OK |
| `military-bases-worldwide-community.kml` | Community Google Earth file, worldwide (unchanged) | Point | 1,467 | 1.2 | unknown | **Verify** |
| `rail-class-i.geojson` | Rail lines owned by Class I railroads | Line | 84,658 | 140 → 30.5 | not stated | OK |
| `rail-passenger.geojson` | Rail lines with passenger service | Line | 18,214 | 32.0 → 6.5 | not stated | OK |
| `amtrak-routes.geojson` | Amtrak routes, one feature per service | Line | 49 | 25.9 → 0.7 | not stated | OK |
| `highway-freight-network.geojson` | National Highway Freight Network | Line | 12,989 | 56.3 → 5.1 | 2023 release | OK |
| `highway-planning-network.geojson` | National Highway Planning Network | Line | 626,356 | 975 → 165 | **2014 release**, records 2010–12 | OK |
| `tunnels.geojson` | National Tunnel Inventory | Point | 580 | 1.2 → 0.3 | 2025 | OK |
| `intercity-bus-routes.geojson` | Intercity Bus Atlas routes (from carrier GTFS) | Line | 4,075 | 363 → 27.1 | schedules 2026-03 / 2026-07 | OK\* / Verify |
| `intercity-bus-stops.geojson` | Intercity Bus Atlas stops | Point | 3,478 | 3.7 → 1.0 | schedules 2026-03 / 2026-07 | OK\* / Verify |
| `ferry-routes.geojson` | Ferry segments (National Census of Ferry Operators) | Line | 964 | 27.5 → 1.1 | data year 2019 | OK |
| `ferry-terminals.geojson` | Ferry terminals, one per terminal | Point | 569 | 0.5 → 0.2 | data year 2019 | OK |
| `waterway-links.geojson` | USACE navigable waterway network, links | Line | 6,856 | 38.3 → 5.5 | edits mostly 1990s | OK |
| `waterway-nodes.geojson` | USACE waterway network, nodes and ports | Point | 6,255 | 1.9 → 0.8 | edits mostly 1990s | OK |
| `port-statistical-areas.geojson` | USACE port statistical area outlines | Polygon | 370 | 29.8 → 2.9 | 2019–2021 | OK |
| `dams.geojson` | National Inventory of Dams | Point | 92,602 | 217 → 39.1 | updated 2015 → 2026-10-02 | OK |
| `nps-boundaries.geojson` | National Park Service unit boundaries | Polygon | 442 | 108 → 6.8 | edited up to 2026-06-18 | OK |

## Cleanup log (2026-10-12)

**1. Duplicates and derivable files**, ~170 MB, moved to the macOS Trash:

| Removed | Why |
|---|---|
| `NPS_Boundary (1).geojson` | Byte-identical to the NPS file (same MD5) |
| `NTAD_Military_Bases_-5703105149516689712 (1).geojson` | Byte-identical to the military bases file (same MD5) |
| `NTAD_North_American_Rail_Network_Lines_UP_….geojson` | All 22,830 segments are in Class I; filter on `RROWNER1 == 'UP'` instead |
| `NTAD_Military_Bases_6992799511403642507.csv` | The same 824 rows as the military bases GeoJSON, without geometry |
| `Waterway_Networks_1847220756284001675.csv` | The same 6,255 rows as the waterway nodes, with x/y columns instead of geometry |
| `Waterway_Networks_5590553219254820202.csv` | The same 6,859 rows as the waterway links, without geometry |

**2. Datasets dropped**, now only in `raw-2026-10-12/`:
- `counties`, `bikeshare-scooter-systems`: weak fit for TAKIP.
- FAA `aviation-facilities`, FAA `runways`, `faa-regions.csv`: replaced by OurAirports, which covers the whole world rather than only the US.

**3. Every remaining file slimmed** as described at the top. Rows removed or merged along the way:
- **Airports:** 13,574 closed airports, plus their runways.
- **Runways:** 28,785 open runways without coordinates for both ends. Their lengths survive as `longest_runway_ft` on the airport.
- **Dams:** 164 with no location or a placeholder at (0, 0).
- **Null geometry:** 10 highway segments and 3 waterway links.
- **Ferry terminals:** 845 terminal × operator rows merged into 569 terminals, with an `OPERATOR_IDS` list.

The checks run on the output:
- Feature counts match the raw files.
- No line endpoint moved, so rail and waterway connectivity is intact.
- Sampled raw vertices are within about 1 m of the tolerance from the simplified shapes (worst: 10.5 m at 10 m, 51.1 m at 50 m).
- Every polygon ring is closed and has ≥4 points.

**Not removed, on purpose:** `rail-passenger` is **not** a subset of Class I. 3,433 of its segments are owned by Amtrak, commuter agencies (MBTA, LIRR, Metro-North, NJ Transit, SEPTA…) and the Alaska Railroad.

## By group

### Aviation and space

**`airports`** (OurAirports): open airports in 247 countries.

| `type` | Count | MB |
|---|---:|---:|
| `small_airport` | 42,808 | 13.7 |
| `heliport` | 23,238 | 6.8 |
| `medium_airport` | 4,105 | 1.7 |
| `seaplane_base` | 1,273 | 0.4 |
| `large_airport` | 1,175 | 0.5 |
| `balloonport` | 63 | <0.1 |

- **Fields:** `ident` (join key to runways), `type`, `name`, `elevation_ft`, `iso_country`, `iso_region`, `municipality`, `scheduled_service`, `icao_code`, `iata_code`, `gps_code`, `wikipedia_link`, and `longest_runway_ft`. The last one is computed from all open runways, including those without coordinates; 37,210 airports have it.
- `wikipedia_link` (15.4k airports) is a ready-made link to Wikidata for the entity backbone in `DATA-SOURCES.md`.

**`runways`**: one line per runway, from one threshold to the other.
- **Fields:** `airport_ident`, `name` (e.g. `09/27`), `length_ft`, `width_ft`, `surface`, `lighted`.
- Only 1 in 3 open runways has both ends located: 7,960 at small airports and 6,386 at medium or large ones.

**`spaceports`**: 20 points. **Fields:** `Name`, `State`, `License`, `Launch_Type`.

### Military

**`military-bases`**: the public DoD MIRTA release (`isCui` was `no` on every row). This is the source `DATA-SOURCES.md` names for the military layer. **Fields:** `siteName`, `siteReportingComponent` (usaf, usn, armyNationalGuard…), `siteOperationalStatus` (act, care, clsd…), `isJointBase`, `isFirrmaSite`, `stateNameCode`.

**`military-bases-worldwide-community.kml`**: kept as-is by decision (2026-10-12).
- ⚠️ **Verify before shipping.** It's a community-made Google Earth file (internal name `~GE3C8F.kmz`) with no stated source or licence.
- 1,467 placemarks, about 75% outside the US. Only 62 names match NTAD.
- Folders include *Secret bases*, SAM sites, Russian and North Korean forces, and ships. Many descriptions give troop and equipment counts.
- Publishing it as a layer would conflict with `DATA-SOURCES.md`: *republish only what the sources already show*. It works best as a lead list to check against OSM or Wikidata.

### Rail

All three use the FRA North American Rail Network schema. Segments (`FRAARCID`) link nodes (`FRFRANODE` → `TOFRANODE`), so routing is possible.

**`rail-class-i`**: UP 16.9k segments, BNSF 14.3k, CSXT 13.3k, NS 11.5k, CN 10.1k, CPKC 8.3k. Covers the US, Canada and Mexico. **Fields:** `FRAARCID`, `FRFRANODE`, `TOFRANODE`, `RROWNER1`, `TRKRGHTS1`, `SUBDIV`, `TRACKS`, `NET`, `PASSNGR`, `STRACNET`, `STATEAB`, `MILES`.

**`rail-passenger`**: the same schema, for lines with passenger service (`PASSNGR`: A Amtrak, C commuter, B both…). Same fields minus `NET` and `STRACNET`.

**`amtrak-routes`**: 49 named services (Acela, Auto Train…). **Fields:** `name`, `ROUTE_URL`. Good for labels.

### Roads

**`highway-freight-network`**: designated freight corridors, 2023 release. **Fields:** `ROUTEID`, `SIGN1`, `LNAME`, `NHFN_CODE`, `ST_NAME`, `LENGTH`.

**`highway-planning-network`**: ⚠️ `VERSION 2014.05`, records mostly 2010–2012, so **over a decade old**. **Fields:** `SIGN1`, `SIGNT1`, `LNAME`, `F_SYSTEM`, `FCLASS`, `NHS`, `STRAHNET`, `STFIPS`, `MILES`. Size by road class (`F_SYSTEM`):

| `F_SYSTEM` | Segments | MB |
|---|---:|---:|
| 1 Interstate | 96,868 | 23.8 |
| 2 Other freeway / expressway | 40,040 | 10.0 |
| 3 Other principal arterial | 253,368 | 63.7 |
| 4 Minor arterial | 149,141 | 41.3 |
| 5 Major collector | 67,010 | 19.3 |
| 6–7 Minor collector / local | 1,540 | 0.5 |
| 0 Not coded | 18,389 | 5.7 |

**`tunnels`**: **Fields:** `tunnel_number_i1`, `tunnel_name_i2`, `facility_carried_i10`, `state_code_i3`, `year_built_a1`, `tunnel_length_g1`, `adt_a4`/`adtt_a5` (daily traffic / trucks), `min_vert_clearance_over_tunnel_`, `toll_c4`, `hazardous_material_restriction_`, `under_navigable_waterway_n1`, `number_of_bores_s1`, `owner_c1`. Coded fields need the FHWA tunnel coding guide.

### Intercity bus

**`intercity-bus-routes`**: about 60 carriers (Greyhound, FlixBus, OurBus…), fields follow GTFS. 9.8M raw vertices, simplified at 50 m. **Fields:** `route_id`, `carrier_name`, `route_short_name`, `route_long_name`, `route_color`, `route_url`.

**`intercity-bus-stops`**: **Fields:** `stop_id`, `stop_name`, `carrier_name`, `place_name`, `state_usps`, `stop_timezone`, `wheelchair_boarding`.

Licence: BTS publishes the atlas, but it is built from carriers' GTFS feeds. Check BTS's terms before using it in the paid product.

### Ferries, waterways and ports

**`ferry-routes`**: **Fields:** `segment_id`, `segment_name`, `operator_id`, `operator_name`, `seg_terminal1_id`/`seg_terminal2_id` (→ `TERMINAL_ID`), `average_trip_time`, `trips_per_year`, `segment_season_start`/`end`, `passengers`, `vehicles`, `avg_daily_brd_pax`. Data year 2019.

**`ferry-terminals`**: one feature per terminal. **Fields:** `TERMINAL_ID`, `TERMINAL_NAME`, `TERM_CITY`, `TERM_STATE`, `IN_OPERATION`, `TERMINAL_OPERATED_BY`, `OPERATOR_IDS`.

**`waterway-links`** / **`waterway-nodes`**: the USACE navigable network, routable through `ANODE`/`BNODE` → `NODENUM`.
- **Coverage is worldwide**: it includes ocean links to foreign ports (`STATE = XX` plus a `NON_US` code).
- Only 9% of nodes are ports.
- **Link fields:** `LINKNUM`, `ANODE`, `BNODE`, `LINKNAME`, `RIVERNAME`, `LINKTYPE`, `GEO_CLASS`, `FUNC_CLASS`, `WTWY_TYPE`, `LENGTH`.
- **Node fields:** `NODENUM`, `PORT_ID`, `PORT_NAME`, `STATE`, `NON_US`.

**`port-statistical-areas`**: legal port boundaries; useful as port outlines for ship arrival and departure events. **Fields:** `PORTIDPK` (USACE port code), `FEATURENAME`, `DATA_YEAR`.

### Hazards and critical infrastructure

**`dams`**: 92,602 dams.
- **Fields:** `nidId`, `name`, `ownerNames`, `primaryOwnerTypeId`, `primaryPurposeId`, `primaryDamTypeId`, `publicHazardId`, `conditionAssessId`, `eapId`, `nidHeight`, `nidStorage`, `maxDischarge`, `yearCompleted`, `riverName`, `state`, `county`.
- The `*Id` fields are codes that need the NID data dictionary.
- High-hazard dams × NWS flood polygons is a natural fit for the impact analysis in `ARCHITECTURE.md`.

### Boundaries

**`nps-boundaries`**: parks, monuments, historic sites. **Fields:** `UNIT_CODE`, `UNIT_NAME`, `UNIT_TYPE`, `STATE`, `REGION`.

## How the app serves it

**Endpoints** (`src/app/api/reference/`):
- `GET /api/reference`: every dataset, with `available` (file installed on this server), size and update time.
- `GET /api/reference/{id}?bbox=west,south,east,north&zoom=z`: a GeoJSON FeatureCollection of the features touching the box, plus `matched` and `truncated` (capped at 20,000 features).
  - Status codes: 404 unknown id, 400 bad box or zoom, 503 not installed.
  - Responses carry an ETag and `max-age=600`, so the nginx cache and browsers reuse them.

**What keeps responses small** (all set in `src/lib/reference/catalog.ts`):
- **Minimum zoom per dataset:** below it, nothing is served or drawn.
- **Tiers:** the airports and the highway network serve only their major features when zoomed out.
- **Per-request simplification:** lines are thinned to about one screen pixel at the requested zoom.
- **Clipping:** intercity bus routes are cut to the box, because cross-country routes cross every view.

The largest response measured over New York, the densest area, is about 5 MB before compression.

**Storage:** `src/lib/reference/file-store.ts` indexes each file once, keeping a bounding box and byte offset per feature. A query reads only the matching lines from disk, so even the highway network costs about 35 MB of memory. `ReferenceStore` is the seam for moving to PostGIS: implement `stat` and `query` (bbox → `ST_Intersects`, tiers → `WHERE`, simplification → `ST_Simplify`, clipping → `ST_ClipByBox2D`) and the routes and UI stay as they are.

**Map:** `src/lib/reference/map-layers.ts` draws the switched-on datasets and refetches them when the map settles. It requests the view snapped outward to whole tiles, so small pans hit the cache. The layer panel groups are in `src/components/panels/layers/lib/reference-groups.ts`.

**Deploying:** the files are gitignored, and `docker-compose.yml` mounts `./data/reference` read-only into the container. Copy them to the server once and again after each refresh, e.g. `rsync -av data/reference/ root@<server>:/root/takip/data/reference/`. Deployments without the files (including Vercel) report nothing installed, and the layer panel hides these layers.

The community military KML is kept here but is not served (see its section above).

## Original filenames

`tools/slim-geodata.py` accepts either name.

| Now | Downloaded as |
|---|---|
| `airports.geojson` | `airports.csv` (OurAirports) |
| `amtrak-routes.geojson` | `NTAD_Amtrak_Routes_5503594535609073988.geojson` |
| `dams.geojson` | `NTAD_Dams_-8092301822133353470.geojson` |
| `ferry-routes.geojson` | `NTAD_Ferry_Routes_8957517170215480271.geojson` |
| `ferry-terminals.geojson` | `NTAD_Ferry_Terminals_2489563009211191470.geojson` |
| `highway-freight-network.geojson` | `NTAD_National_Highway_Freight_Network_-9069947115351139419.geojson` |
| `highway-planning-network.geojson` | `NTAD_National_Highway_Planning_Network_5862765175788916660.geojson` |
| `intercity-bus-routes.geojson` | `NTAD_Intercity_Bus_Atlas_Routes_3794487008466975906.geojson` |
| `intercity-bus-stops.geojson` | `NTAD_Intercity_Bus_Atlas_Stops_-6979428015416139090.geojson` |
| `military-bases.geojson` | `NTAD_Military_Bases_-5703105149516689712.geojson` |
| `military-bases-worldwide-community.kml` | `Kml Military bases.kml` |
| `nps-boundaries.geojson` | `NPS_Boundary.geojson` |
| `port-statistical-areas.geojson` | `Port_Statistical_Area_-7314225603640107302.geojson` |
| `rail-class-i.geojson` | `NTAD_North_American_Rail_Network_Lines_Class_I_Railroads_9183716066278312263.geojson` |
| `rail-passenger.geojson` | `NTAD_North_American_Rail_Network_Lines_Passenger_Rail_7436473931906075229.geojson` |
| `runways.geojson` | `runways.csv` (OurAirports) |
| `spaceports.geojson` | `NTAD_Spaceports_3338425164416820778.geojson` |
| `tunnels.geojson` | `NTAD_National_Tunnel_Inventory_-8780861037287871283.geojson` |
| `waterway-links.geojson` | `Waterway_Networks_4704106664473752717.geojson` |
| `waterway-nodes.geojson` | `Waterway_Networks_-1399073374797790963.geojson` |
