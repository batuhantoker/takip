# TAKIP — Brainstorming Notes

> **Status:** Exploratory ideas, not a committed roadmap  
> **Purpose:** Capture product directions discussed so far: live global data, historical traceability, replay, event correlation, and a possible historical-world simulator.

## 1. Product Direction

TAKIP could evolve from a map that displays live public data into a **spatiotemporal intelligence platform**:

- **Live:** What is happening now?
- **History:** What happened at a place, to an entity, or during a time window?
- **Replay:** Reconstruct the available record of a place, route, event, or period.
- **Analysis:** Identify patterns, changes, anomalies, and relationships across datasets.

The map is the primary interface, but the long-term value would come from the historical archive, cross-source linking, and the ability to query how situations evolved over time.

This is a brainstorming document. The ideas below need validation for data availability, licensing, implementation effort, and user value.

## 2. Potential Data Layers

### 2.1 Moving entities

- **Aircraft:** live positions, historical tracks, airport visits, diversions, holding patterns, and route changes.
- **Vessels:** AIS positions, trails, reported speed and heading, port arrivals/departures, anchorage time, traffic density, and route changes.
- **Satellites:** orbital elements and calculated positions/passes.
- **Public transit:** buses and trains from available GTFS-Realtime feeds.
- **Road traffic:** incidents, closures, work zones, and traffic conditions.
- **Shared mobility:** public bike/scooter availability where GBFS feeds exist.

Coverage will vary by source and geography. Distinguish a missing observation from proof that an entity stopped, disappeared, or intentionally switched off a transmitter.

### 2.2 Weather and environmental conditions

- Weather alerts and warning polygons.
- Historical and current station observations.
- Forecast model output, clearly distinguished from observed conditions.
- Hurricane tracks, severe storms, and weather radar.
- Flood gauges, wildfire perimeters, smoke, air quality, earthquakes, and volcano alerts.
- Ocean conditions and buoy measurements.
- Satellite imagery and Earth-observation products.

Possible use cases:
- Overlay weather on aircraft, vessel, road, or historical-event tracks.
- Identify infrastructure intersecting a hazard footprint.
- Replay the evolution of a storm alongside relevant events.
- Compare historical atmospheric conditions with documented operations.

### 2.3 Public cameras and imagery

- Public traffic cameras and government environmental cameras.
- National park, volcano, wildfire, and research-network cameras where terms permit.
- Satellite imagery from public Earth-observation programs.
- Camera-derived aggregate observations, such as traffic counts, visible flooding, snow cover, or congestion.

Keep camera metadata separate from image observations. Record source, location, capture time, feed availability, and applicable terms. Do not assume that a publicly viewable camera permits continuous recording or redistribution. Prefer aggregate counts and environmental observations over identifying people.

### 2.4 Infrastructure and places

- Airports, ports, runways, bridges, dams, roads, and rail infrastructure.
- Power plants, pipelines, mines, steel plants, and other industrial facilities.
- Data centers, internet exchanges, submarine cable routes, and telecommunications infrastructure where open data is available.
- Geographic boundaries, land use, population grids, and settlement data.
- Charging stations and other public services.

Potential analysis:
- Which assets intersect a flood, wildfire, or storm footprint?
- Which routes or facilities could be affected by a reported outage?
- What changed around a facility over time?
- How does traffic near a port, airport, or transport corridor change over time?

### 2.5 News, public records, and event intelligence

- Geolocated news and public announcements.
- Government advisories and official incident reports.
- Sanctions lists and company registries.
- Public conflict and humanitarian datasets, subject to their terms.
- Wikipedia article summaries, references, and images.
- Wikidata entities and structured relationships.
- Public economic, trade, energy, health, and cybersecurity datasets.

Potential feature: merge multiple reports about the same incident into one event while retaining each source and explaining why they were linked. A news report or model inference is evidence to assess, not automatic proof that an event occurred as described.

## 3. Historical Traceability: Core Concept

A major direction is to preserve historical observations instead of retaining only the latest state.

This would support:
- Entity history pages.
- Track replay and time-travel queries.
- Historical maps and density heatmaps.
- Before/after comparisons.
- Event timelines.
- Route and activity comparisons.
- Retrospective event correlation.
- Reproducible analytical results.

### Important distinction

Keep these concepts separate:

1. **Entity:** the thing being described, such as a vessel, aircraft, airport, camera, facility, or historical organization.
2. **Observation:** a source-reported measurement or position at a specific time.
3. **Event:** a reported occurrence, such as a port arrival, battle, road closure, or outage.
4. **Inference:** an interpretation computed from observations or events, such as a likely route deviation or a suspected relationship.
5. **Source:** where the record came from, including its terms, timestamps, and provenance.

Do not overwrite an entity's entire history with its latest state. Keep observations append-only where practical, and record corrections or revised interpretations with version/provenance information.

### Suggested observation fields

- `entity_id`
- `source_id`
- `observed_at` — time the source says the observation occurred
- `ingested_at` — time TAKIP received it
- `latitude`, `longitude` — when applicable
- `source_record_id` — upstream identifier, if available
- `attributes` — speed, heading, altitude, status, weather variables, etc.
- `quality` — accuracy, freshness, or quality flags
- `raw_record_ref` — pointer to retained original payload
- `schema_version` — parsing/schema version where useful

Distinguish source-reported observations from interpolated or reconstructed positions. A gap in reporting is not necessarily evidence of movement, disappearance, or intent.

## 4. Historical Replay

The replay interface could provide:
- A global timeline with play/pause, step forward/back, and playback speed.
- A date/time selector and configurable time window.
- Trails for moving entities.
- Event markers and event-detail panels.
- Layer toggles for tracks, weather, hazards, infrastructure, and historical context.
- Geographic and entity filters.
- Time-aligned source citations and uncertainty indicators.
- A way to compare two dates or replay windows.

Replay should be a query over stored historical data, not a separate data system. Cache common replay windows and return resolution-appropriate data to the browser. The client can simplify geometry for a zoomed-out view while retaining access to detailed records.

Weather needs different treatment by data type:
- Station observations and alerts are time-series/event records.
- Radar and satellite products may be large gridded or raster datasets.
- Forecasts, reanalysis, and actual observations must be visually and semantically distinguished.

## 5. Historical Worlds: World War II Example

An interesting future direction is a historical replay of World War II, combining dated events with weather and other contextual data.

Possible layers:
- Battles and operations.
- Campaigns and theater boundaries.
- Approximate front lines and territorial control over time.
- Documented movements, landings, retreats, and advances.
- Weather fields and available station observations.
- Ports, railways, airfields, roads, and other logistics infrastructure.
- Historical photographs, reports, and citations.
- Civilian impacts and humanitarian events where appropriately sourced.

A user could select a date, press play, inspect an event, and compare it with the surrounding weather and infrastructure.

### Data approach

- **Wikipedia:** narrative context, article discovery, citations, and media where licensed.
- **Wikidata:** structured entities, dates, locations, participants, and relationships where available.
- **Dedicated historical datasets:** battle/event datasets can seed the initial import, but coverage and licensing need review.
- **Historical weather:** NOAA's 20th Century Reanalysis is a possible source for broad atmospheric reconstruction during WWII. It is a reanalysis, not a perfect record of local conditions; resolution and uncertainty must be communicated.
- **Primary and archival sources:** needed for detailed operational timelines, unit movements, and validation.

Do not imply that every animated line is an exact historical movement. Separate sourced facts, approximate geometries, reconstructed trajectories, and hypotheses. Attach citations and confidence/precision metadata to historical records.

### Possible historical schema

- `conflicts`: wars and other conflicts.
- `campaigns`: operations or campaigns associated with a conflict.
- `historical_events`: battles, invasions, declarations, retreats, and other dated events.
- `event_participants`: countries, organizations, armed forces, or other participants.
- `event_geometries`: points, approximate areas, front lines, or territorial boundaries.
- `event_relationships`: part-of, preceded-by, followed-by, and related-to relationships.
- `historical_sources`: citations, source URLs, archive references, and license/provenance.
- `territorial_control`: area, time interval, controlling party, source, and confidence.
- `weather_grid`: references/metadata for time-indexed weather fields.
- `historical_observations`: digitized station observations, ship logs, or other measurements.

Large gridded weather data may be better stored in NetCDF/Zarr files on object storage, with metadata and query indexes in the database.

## 6. Satellite Object Detection in the Browser

> **Status:** Idea only; nothing is built. Added 11 Oct 2026.

### The idea

When a user zooms in on the satellite view, a small detection model runs **in their browser** over the visible imagery tiles. It marks objects such as aircraft on aprons, ships in port, storage tanks and vehicles in large car parks. Users can confirm, reject or relabel a mark with one click.

Detections and corrections are saved. Every session then adds to a shared record of what was seen where, and to training data for the next, better model. The more people use it, the more TAKIP knows.

### What already exists to build on

Checked against the code on 11 Oct 2026. Today, AI analysis covers **camera frames and text only**. Nothing looks at satellite tiles or the map canvas. No user feedback is captured on any AI output, and no results are saved to disk or a database.

| Existing piece | What it does today | How satellite detection could reuse it |
|---|---|---|
| **Camera Vision** (`src/lib/vision/`, `CameraVision.tsx`) | The AI ANALYZE and WATCH 30S buttons. YOLOX-nano (Apache-2.0, COCO, 416 px) runs in a Web Worker on onnxruntime-web and counts people and vehicles in camera frames. Results are kept in memory only. | The worker, the ONNX runtime, the box overlay and the pure pre- and post-processing code (`detect.ts`). Swap in an aerial-trained model and feed it satellite tiles. |
| **Server-side detection** (`src/lib/vision/server.ts`, `forecast.ts`) | The same model runs in Node so OI Forecast can cite camera counts as evidence. | Batch detection on the server, e.g. re-scanning a place when new imagery arrives. |
| **OI Assist** (`src/lib/oi/assist/`, `O` key) | A chat agent with 14 map tools. It runs on the user's own LLM key and supports OpenAI, Anthropic, Google, OpenRouter and others. Its `camera` tool runs the detector, and vision-capable models also receive up to 2 camera stills (`attach.ts`, `canSeeImages`). Its `scan` tool only counts data points already loaded in view. | Add a `satellite` tool: run the detector on the visible tiles. Optionally send a crop to the user's vision LLM for a description, if the imagery licence allows it. |
| **OI Forecast** (`src/lib/oi/engine.ts`) | Multi-agent forecasts with cited sources. Camera counts are already one kind of source. | Satellite detections become another cited evidence source, e.g. "14 aircraft on the apron in imagery from <date>". |
| **`/api/sentinel`** | Searches Sentinel-1/2 scene catalogues and returns metadata and thumbnail links. No UI uses it yet. | A starting point for an openly licensed imagery source with real capture dates. |

What is missing entirely: a satellite-trained model, a tile-input pipeline, confirm/reject controls, and any persistent store for detections and labels. That store should come from the planned SQLite/Postgres move, not be built separately.

### Why it fits TAKIP

- **Inference costs us almost nothing.** It runs on the user's GPU or CPU, and the server only receives small detection records.
- **Cross-checks.** An aircraft detected at an airport can be compared with ADS-B, and a ship with AIS. An object visible in imagery but missing from tracking is a known signal, e.g. "dark" vessels. The comparison is only valid at the imagery's capture time (see below).
- **It follows the data model in §3.** A detection is an **inference**, not an observation. It carries the model, model version, confidence, imagery source and capture date.

### Constraints to resolve first

1. **Imagery licence (blocking).**
   - **Esri World Imagery** (the current SAT view) is licensed under the Esri Master License Agreement. Its tiles are served with CORS `*`, so reading pixels in the browser works technically. But Esri says the layer is not intended for exporting tiles. Running detection on it, storing the results and training on it all need to be checked against the licence before anything ships.
   - **Candidates with clearer terms** (verify each one):
     - NAIP: US only, about 0.6–1 m, public domain.
     - Sentinel-2: global, 10 m, free and open. Only large objects are visible: ships, airfields, tank farms, land change.
     - OpenAerialMap: CC BY, community uploads, patchy coverage.
     - Maxar/Vantor Open Data: disaster areas only; check its licence.
2. **Resolution decides what can be found.**
   - Cars and small aircraft need about 0.5 m/px or better. Ships and airliners can be found at 1–3 m. At 10 m only large ships and structures show.
   - Web Mercator zoom 18 is about 0.6 m/px at the equator and about 0.46 m/px at 40° latitude. The map currently caps satellite tiles at zoom 18, and the imagery's native resolution varies by place.
3. **Imagery is not live.** Basemap imagery is often months or years old, and capture dates differ from tile to tile.
   - Every detection must carry the capture date where the source provides one.
   - Never present a detection as "now". Compare it with AIS or ADS-B only at the capture time.
4. **The model.**
   - The COCO-trained YOLOX used for cameras sees scenes from street level and will do poorly on top-down imagery. We need an aerial-trained detector, ideally with oriented boxes, since aircraft and ships sit at any angle.
   - Public aerial datasets include DOTA, xView, DIOR, iSAID and SpaceNet. Several are research-only or non-commercial (xView is CC BY-NC-SA, as far as we know), and pretrained weights inherit those terms. Framework licences matter too: Ultralytics YOLO is AGPL-3.0.
   - A commercially clean path may mean training our own small model on openly licensed imagery and labels.
   - Size budget: a nano-class model (a few MB as ONNX) should run interactively on 512–1024 px tiles with WebGPU, falling back to WASM.
5. **Saving user-generated data.**
   - **Store detections, not pixels:** tile z/x/y, imagery source and capture date, class, box, confidence, model version and time. Keep image crops only if the imagery licence allows it.
   - **Opt-in**, and link records to user identity only as much as abuse prevention needs.
   - **Corrections are labels and need vetting.** Mistakes and spam happen, so require agreement between several users or a review queue before a correction enters training data.
   - **Deduplicate.** Many users will detect the same object on the same tile, so key detections on tile + imagery date + location.
6. **Sensitive sites and people.**
   - Detecting military aircraft or vehicles at bases is legally and ethically sensitive in some jurisdictions. Decide which classes and areas are in scope.
   - Never detect or track people.

### The learning loop

1. **v0:** a small pretrained aerial detector for a few classes (aircraft, ships, storage tanks, large vehicles), behind an opt-in toggle. It runs on visible satellite tiles from zoom 16.
2. Users see the boxes and confirm, reject or relabel them.
3. The server stores detections and votes, append-only.
4. Periodically, vetted labels are used to fine-tune the model. Each new version is evaluated on a fixed held-out set and shipped as a new model version. Old detections are never overwritten; each record names the model that produced it.
5. Over time this builds a per-place history, e.g. aircraft counted on one apron across imagery dates. When newer imagery arrives, it also enables change detection.

### Suggested first experiment

- **Use one class: aircraft at airports.** They are large and distinctively shaped. Airports are known locations (OurAirports), and ADS-B gives an independent cross-check.
- **Use imagery whose licence clearly allows this**, e.g. NAIP over a handful of US airports, rather than Esri.
- **Measure** precision and recall against hand labels, plus per-tile latency in the browser (WebGPU vs WASM) on a mid-range laptop. Do this before building any UI.
- **Decide go/no-go** on target thresholds agreed before the experiment starts.

## 7. Data Sources to Investigate

The following are candidates, not a verified guarantee that every endpoint is keyless, commercially usable, or suitable for redistribution. Re-check authentication, rate limits, coverage, attribution, retention, and licensing before integration.

### Potentially useful public/keyless sources

- **NWS API:** US weather alerts, forecasts, and related products.
- **USGS Water Data:** water gauges and observations; verify current API/version and limits.
- **CelesTrak:** satellite orbital data.
- **GDELT:** global news/event data; already listed as integrated in the source notes.
- **OurAirports:** downloadable airport and runway reference data.
- **Wikidata Query Service:** structured entity discovery and relationships.
- **NOAA datasets:** historical climate, radar, satellite, and reanalysis data, depending on product.
- **Natural Earth:** geographic boundaries and base-map datasets.
- **CISA KEV:** known exploited vulnerability catalog.
- **Regional traffic and maritime feeds:** for example, Finland's Digitraffic where its coverage is useful.

### Sources requiring special caution

- **Aircraft:** ADS-B providers vary in historical coverage, terms, and commercial redistribution rights. Verify before building a product dependency.
- **Vessels:** regional public AIS feeds are useful, but global historical AIS may require licensing. Public accessibility does not automatically authorize redistribution.
- **Weather:** station data, alerts, model forecasts, reanalysis, and imagery have different update rates, formats, and storage costs.
- **Cameras:** public viewing does not necessarily permit archiving or republishing.
- **Conflict datasets:** licensing can range from open to non-commercial or paid. Check each dataset individually.
- **Social platforms:** public content may still have API, retention, and redistribution constraints.

Maintain a source registry with:
- Source name and owner.
- Endpoint/download method.
- Geographic and temporal coverage.
- Authentication requirements.
- Rate limits and update cadence.
- License and attribution requirements.
- Whether storage, derived data, and redistribution are allowed.
- Last verification date and operational status.

## 8. Architecture Ideas

Start simple and scale based on observed data volume.

### Initial architecture

- **PostgreSQL + PostGIS:** entities, event metadata, source registry, spatial queries, and moderate-volume observation history.
- **Object storage:** raw snapshots and older historical batches; use compressed columnar formats such as Parquet where appropriate.
- **Scheduled ingestion workers:** polling, parsing, validation, deduplication, and persistence.
- **Replay/query API:** retrieves records by time range, entity, geography, and layer.
- **Browser-based map:** renders current state, trails, events, historical layers, and the time slider.

### Possible later additions

- **ClickHouse or TimescaleDB:** evaluate when query volume, time-series workload, and measured performance justify a separate analytical store or extension. Avoid adding both without a demonstrated need.
- **Message queue:** introduce when ingestion volume or replay/reprocessing requirements make it worthwhile.
- **Raster/array serving:** dedicated serving/caching for large weather grids and satellite imagery.
- **Derived-data pipeline:** computes traffic density, route statistics, hazard exposure, and event correlations.

### Design rules

1. Make ingestion idempotent so reprocessing does not create duplicate records.
2. Preserve observation time and ingestion time separately.
3. Keep source provenance attached to data.
4. Version parsing logic and derived-event algorithms.
5. Distinguish measured, reported, estimated, and inferred data.
6. Track source freshness, outages, and missing coverage.
7. Use retention policies appropriate to data type and license.
8. Keep original records where legally permitted so results can be rebuilt as parsers improve.
9. Avoid recording sensitive personal data or private camera feeds.
10. Treat a missing report as missing data, not proof of an event.

## 9. Cost Considerations

Early infrastructure can remain modest if historical coverage is selective.

Illustrative planning ranges, excluding paid data licenses and engineering labor:

- **Prototype:** approximately $30–150/month.
- **Growing archive:** approximately $100–400/month.
- **More substantial analytical deployment:** approximately $300–1,000+/month.

These are rough scenarios, not vendor quotes. High-frequency global vessel/aircraft archives, large weather grids, image retention, heavy replay traffic, and commercial historical-data licenses can materially increase cost.

Storage volume depends on observation frequency and encoding. As an illustrative case, 10,000 entities reporting every 10 seconds generate 86.4 million observations per day. This makes source selection, compression, retention, and spatial/temporal partitioning important. It is not a reason to collect every available point from every feed.

For weather, retain lightweight alerts and station observations broadly, and consider selectively archiving large radar/satellite products. For replay, cache popular windows and send simplified geometry at low zoom levels.

## 10. Possible Development Order

### Phase 1 — Foundation
- Create a source registry and entity/observation/event models.
- Start archiving a small number of live sources.
- Add entity history and 24-hour/7-day replay.
- Preserve timestamps, provenance, and source quality.

### Phase 2 — Historical analysis
- Add longer time windows and object-storage archives.
- Implement spatial/time filtering and replay caching.
- Add weather overlays and event timelines.
- Create density maps and before/after comparisons.

### Phase 3 — Historical worlds
- Prototype WWII with structured events, citations, campaign areas, and historical weather.
- Add approximate territorial-control and front-line layers where credible data exists.
- Provide source inspection and confidence/precision metadata.
- Expand only when the initial dataset provides a useful, defensible reconstruction.

### Phase 4 — Cross-source intelligence
- Correlate events across news, infrastructure, weather, cameras, and tracks.
- Produce derived signals with reproducible methods.
- Add alerting and historical baseline comparisons.
- Evaluate whether a dedicated analytical store or paid source is justified.
- Run the satellite-detection experiment (§6) once an imagery source with suitable terms is chosen.

## 11. Open Questions

These remain product decisions rather than settled requirements:

- Is the first priority a general-purpose global map or a historical replay experience?
- Should the system aim for global breadth at low resolution or high-resolution archives for selected regions and entities?
- Which source categories are most valuable to retain indefinitely?
- Is historical data only for internal analysis, or will users query/export it as a paid feature?
- Which datasets permit redistribution of raw records, and which only permit derived results?
- How much uncertainty can the interface communicate without becoming cluttered?
- Should historical events be curated manually, imported from open datasets, or both?
- What is the target retention window for high-frequency live tracks?
- Which workloads should remain in PostgreSQL/PostGIS, and what measured threshold would justify separate analytics or raster infrastructure?
- Which satellite imagery source lets us run detection, store the results, and train on them (§6)?
- Are user-confirmed labels a free-tier contribution, a paid feature, or both, and who owns the resulting dataset?
- Which object classes and areas are out of scope for satellite detection?

## Working Principle

**Capture what can be retained lawfully, preserve where it came from, and make the past queryable.** Start with a few well-understood sources and a solid time-aware data model. Expand coverage and analytical complexity as real usage and data quality justify it.
