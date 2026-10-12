# Architecture

TAKIP makes publicly available data available to everyone, from one place.

## Three modes

1. **Live:** what is happening now. Built first.
2. **History:** what happened at a given place or time.
3. **Analysis:** patterns, correlations and changes derived from the historical record.

## Build order

1. **Live (streaming).**
   - Connectors fetch or subscribe to sources and turn every record into an observation (below).
   - Observations go onto a stream. The map and the API subscribe to it.
   - Current state, such as the camera catalogue, is kept for serving. Observations are not stored yet.
2. **History (storage).** The same observations are appended to a store, following the rules below.
3. **Analysis.** Built on top of the history.

The entity and observation formats are fixed in phase 1. Storage then becomes one more consumer of the stream and needs no rework.

**Open decision:** live feeds can't be backfilled, so a day that isn't recorded is lost for good. A cheap raw archive from day one avoids that: compressed newline-delimited JSON, one file per source per hour, with nothing that queries it yet. The alternative is to start capturing in phase 2. See `TODO.md` §1.

## Entities

The things being tracked: vessels, aircraft, satellites, cameras, airports, ports, facilities (power, transport, internet, military, …) and geographic places.

| Field | Purpose |
|---|---|
| `entity_id` | Stable internal identifier |
| `type` | What kind of entity it is |
| `names` | Name and aliases |
| `identifiers` | External ids: ICAO24, registration, MMSI, IMO, NORAD id, ICAO/IATA codes, LEI, Wikidata QID, OSM id, the source's own id |
| `geometry` | Point, line or polygon |
| `source_refs` | The sources that describe this entity |
| `identity_confidence` | How sure we are that these records describe one real thing |

Each identifier has a `valid_from` and a `valid_to`, because identifiers get reassigned: MMSIs are reused, and an ICAO24 address moves when an aircraft is re-registered. Without those dates, history would merge different vessels or aircraft into one.

## Observations

Every record from every source becomes one observation.

| Field | Purpose |
|---|---|
| `observation_id` | Derived from `source_id` + `source_record_id` + `observed_at`, so the same upstream record always produces the same id |
| `entity_id` | Internal stable entity identifier |
| `source_id` | The feed or provider that supplied the observation |
| `kind` | What was observed: position, status, event, measurement |
| `observed_at` | When the measurement was made |
| `ingested_at` | When TAKIP received it |
| `latitude`, `longitude` | Position, if applicable |
| `geometry` | Line or polygon, for observations that aren't a point, such as hazard areas or fire perimeters |
| `source_record_id` | The upstream identifier, if there is one |
| `attributes` | Speed, heading, altitude, status, etc. |
| `quality` | Reported accuracy, freshness or quality flags |
| `raw_record_ref` | Reference to the original payload |
| `schema_version` | The version of this format |

## Rules (design for history from the start)

1. **Append, don't overwrite.** Corrections are versioned, or recorded as corrections with their provenance.
2. **Idempotent ingestion.** Reprocessing the same upstream record must not create a duplicate observation.
3. **Track source freshness and coverage.** A missing vessel or aircraft report is not evidence that the entity disappeared.
4. **Keep raw payloads.** Store them in compressed batches where practical, with the source, retrieval time, schema version and a checksum.
5. **Version derived events.** Record the algorithm version and the supporting observation ids, so a historical result can be reproduced.
6. **Set retention per data type.** Positions, camera images, weather grids and static reference data differ widely in storage cost and licensing constraints.
7. **Preserve licensing and provenance.** Store the source URL, licence, retrieval time and redistribution restrictions with every dataset and feed.

## Source registry

For every source, record:
- id and owner;
- URL;
- licence, and whether commercial use is allowed;
- redistribution limits and the required attribution text;
- auth: keyless or key;
- rate limits and User-Agent requirements;
- delivery: polled, streamed or bulk;
- refresh interval and coverage.

## Dependency map

- Infrastructure (power, transport, internet) is stored as entities, with links between them: feeds, connects, serves.
- An outage becomes an event linked to the facilities and regions it affects.
- Open data rarely includes real topology, so inferred dependencies are shown as possible exposure, with a confidence score.

## Analysis features (phase 3)

- **Historical replay.** Pick a time window and replay the world as the data recorded it:
  - a global timeline, speed controls, track trails and event markers;
  - missing data is shown, never interpolated silently.
- **Density and trend maps.** Recurring corridors, seasonal activity, airport traffic patterns, congestion hotspots and changing hazard exposure, at configurable spatial and time resolution.
- **Event correlation.** Combine an incident report with nearby tracks, camera-derived traffic counts and weather. Show overlap in time and space, the supporting evidence and a confidence; never assert causation.
- **Anomaly detection.** Compare an entity with its own past behaviour or a relevant baseline: route deviations, unusually long stops, sharp changes in traffic volume. Account for sensor coverage and missing data before flagging anything.
- **Impact analysis.** Reconstruct which roads, ports, airports and facilities fell inside a hazard area during a given period, using historical weather, infrastructure geometry and available operational records.
