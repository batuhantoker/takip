# D: World Monitor's non-UI features, catalogued for OSIRIS

Based on the World Monitor clone at commit 968eac6 (AGPL-3.0). I read its feature docs, `docs/methodology/`, the named `data-sources.mdx` sections and the derived-signal seed scripts, and restated their methods here in prose. No code was copied. Constants, thresholds and field names appear as facts.

## Implementation status (2026-10-12)

Only the logic that belongs to a single source was built; the cross-source engines (#1, #2, #4–#12, #23 onwards) and the provenance, licence and freshness format (#5–#7) wait on the backend plan. Details in `wm-geo-signals.md`.

- **#3 Chokepoint transit anomalies:** `chokepoints/flow.ts`, as described, plus a 2 vessels/day baseline floor (Kerch read as "disrupted" at ratio 0 without it). The method rates a strait only against its own recent past, so a long closure becomes the baseline (Hormuz since 2026-03); the map lets an active red PortWatch disruption outrank the ratio.
- **#13 Radiation watch:** RadNet station baselines in `radiation/radnet.ts`. Safecast's real-time feed has no history, so its sensors are unrated and corroboration is not built.
- **#14 Natural-hazard fusion:** volcanoes only, GDACS over EONET within 100 km (`weather/dedupe.ts`).
- **#20 Airport disruption severity:** FAA bands in `airport-status/nas-status.ts`; NOTAM closures need the keyed ICAO API and are not built.
- **#26 NGA warnings:** the parser (cable faults vs operations, cable ships, firing areas, DMS positions) is in `nav-warnings/nga-msi.ts`, but the API stopped at 2024-05-10, so no chokepoint score or cable health is derived from it.

## Top picks (summary)

1. **Geographic convergence cells.** Put every geolocated observation in a 1° cell over 24 h and alert when 3+ independent kinds co-occur. Every input is already fetched by OSIRIS without a key. S·H
2. **Thermal escalation.** Cluster FIRMS detections, score each 0.5° cell against its own 7-day history, and flag explosion-like hot spots. The `/api/fires` CSVs are keyless, and the 7-day file bootstraps the baseline. S·H
3. **Chokepoint transit anomalies.** Compare the last 7 days of IMF PortWatch transits with the preceding ~90 and flag 3 days in a row below 85 %. Keyless, and the 180-day history is available on request. S·H
4. **Alert fusion and cooldowns.** Merge alerts within 2 h and 200 km, apply per-type TTLs, and emit only on band crossings. `lib/watch.ts` emits raw enter/leave events today. S·H
5. **Provenance claims plus a licence gate.** Use known/unknown/not-applicable claims, four time roles and two confidences. Serve raw values only from sources whose licence has been cleared. Do it while the observation format in `ARCHITECTURE.md` is still open. S·H
6. **Freshness and intelligence-gap tracker.** Give each source a staleness budget and keep transport freshness apart from content freshness, so a dead feed never reads as a quiet world. S·H
7. **Military air surge and theater posture.** Per-theater baselines (2×/3×/4× bands) and tanker+AWACS+fighter "strike package" tests, on top of the military flag `/api/flights` already sets. S·H, but the licence of the military feed is open.
8. **Sanctioned vessels and aircraft on the map.** Diff the OFAC lists (keyless, from the source) and match IMO, MMSI and registration against AIS and ADS-B. S·H
9. **Event → nearby critical infrastructure.** Rank assets within 600 km of any event, up to 3 per type. `lib/aoi.ts` already does the sweep. S·H
10. **Temporal baseline anomaly engine.** Welford statistics per region × kind, bucketed by weekday and month, with z bands at 1.5/2/3 and a 10-sample minimum. This is the core of `ARCHITECTURE.md` phase 3, and the reason to start the raw archive now. M·H

Close behind (high value, medium effort): GDELT conflict-intensity percentiles (fully backfillable), orbital pass prediction and pass log (on World Monitor's roadmap, nearer for OSIRIS), the GPS-interference grid, cable faults and chokepoint scores from NGA warnings, AIS behaviour (dark gaps, loitering, naval proximity), real population exposure, and an alert ledger scored against control windows.

## How this is ranked

- **Value**, for a geospatial-first product with observation history: H = 3, M = 2, L = 1. A point or polygon with a timestamp, kept as history, outranks a country-level scalar. The CII, resilience and strategic-risk scores therefore rank lower here than World Monitor gives them.
- **Effort** for OSIRIS as it stands: S = 1 (inputs already wired, or one small connector plus pure logic), M = 2 (a new connector, a stored baseline, or several pieces), L = 3 (a graph or model, many new sources, or ongoing curation).
- **Order:** value ÷ effort, then value.
- **Backfillable?** says whether the history a feature needs can be rebuilt later. If not, OSIRIS must start recording now (the raw-archive decision in `ARCHITECTURE.md` and `TODO.md` §1). In general:
  - can be backfilled: GDELT exports, PortWatch, EPA RadNet, Safecast, USGS, GDACS/EONET, historical TLEs;
  - FIRMS open CSVs reach back 7 days;
  - live ADS-B and AIS snapshots cannot be backfilled.
- **Flag sources:**
  - "manifest" means rows of World Monitor's `shared/source-attribution-manifest.json`;
  - an env var named in a World Monitor script means the input is keyed;
  - "DS.md" means OSIRIS's `DATA-SOURCES.md`;
  - "verify" means the point is unsettled.
- **About the "OSIRIS today" notes:** they come from reading `ARCHITECTURE.md`, `TODO.md` and the named routes and libs. Nothing was run.

---

## Ratio 3.0: high value, small effort

### 1. Geographic convergence detector
- **Purpose:** flag places where several independent streams light up at once.
- **Method (WM):**
  - **Grid variant:**
    - observations of distinct kinds (protests, military flights, naval vessels, earthquakes) go into 1°×1° cells over a rolling 24 h;
    - 3 or more distinct kinds in a cell is an alert;
    - score: 25 per distinct kind plus 2 per event (the event part capped at 25), at most 100;
    - critical at 4 kinds or a score of 90 or more, otherwise high;
    - cells are named from the conflict-zone, waterway and hotspot gazetteers.
  - **Correlation-card variant (`seed-correlation.mjs`):** single-linkage union-find clustering within 500 km.
    - The search uses radius-sized grid cells and checks the 3×3 neighbours.
    - Chains can therefore stretch past 500 km.
    - Each signal type's maximum severity is weighted per domain and summed.
    - A diversity bonus adds 12 per type beyond 2, capped at 30.
    - A card is emitted at a score of 20 or more.
  - **Documentation conflicts:**
    - the signal-aggregator doc describes a 200 km version (critical at 4+ kinds, high at 3, medium at 2);
    - the news `convergence` signal is about source *types* on one story, not geography, within 60 min (`algorithms.mdx`) or 30 min (`signal-intelligence.mdx`).
- **Free inputs (all keyless):**
  - GDELT 15-min events (protest and conflict CAMEO roots);
  - USGS GeoJSON;
  - FIRMS open CSVs;
  - IODA outages;
  - military ADS-B (see #8 for the licence issue);
  - AIS: aisstream needs a free key; Digitraffic and Kystverket are keyless regional substitutes.
  - World Monitor's protest input is ACLED (keyed and NC); GDELT substitutes.
- **Backfillable?** Partly. GDELT, USGS and FIRMS (7 days) can be backfilled; flights and AIS only from OSIRIS's own archive.
- **OSIRIS today:** the inputs are fetched (`/api/gdelt-events`, `/api/earthquakes`, `/api/fires`, `/api/flights`, `/api/radar`) but never binned together. `lib/aoi.ts` sweeps a drawn polygon, not a global grid.
- **Effort / value:** S / H. A pure function over the current snapshots. It produces the kind of versioned, derived polygon event that `ARCHITECTURE.md` rule 5 describes. Require at least two source *families* per alert. World Monitor's card variant fires on any two military flights within 500 km, which is noise.

### 2. Thermal escalation (satellite fire clusters)
- **Purpose:** find heat clusters that are unusual for their place: strikes, burning depots, sustained fighting.
- **Method (WM, `seed-thermal-escalation.mjs`):**
  - **Filter:** detections marked prescribed, or not marked as emergencies, are dropped.
  - **Clustering:** greedy, in time order. A detection joins the nearest cluster with the same region label whose running centroid is within 20 km; otherwise it starts a new one.
  - **Baseline:** each cluster maps to a 0.5° cell.
    - The cell keeps 30 days of `{observation count, total FRP, status}` entries.
    - The baseline is the last 7 days: mean count, mean FRP, and the standard deviation of counts (at least 2 entries).
    - z = (count − mean) / σ.
    - Persistence: a prior observation within 18 h extends the span.
  - **Status, checked in this order:**
    - persistent: at least 12 h and (count delta ≥ 3 or total FRP ≥ 80);
    - spike: z ≥ 2.5, or count delta ≥ 6, or FRP delta ≥ 120, or (≥ 8 detections and FRP ≥ 150);
    - elevated: z ≥ 1.5, or count delta ≥ 3, or FRP delta ≥ 50, or (no baseline and ≥ 5 detections);
    - otherwise normal.
  - **Context, relevance and confidence:**
    - "conflict-adjacent" when the region label is on a 20-country list;
    - relevance is high when conflict-adjacent and spike or persistent;
    - confidence is high at ≥ 8 detections, ≥ 2 satellites and ≥ 4 baseline samples.
  - **Flags:** night share ≥ 0.5, multi-satellite, sustained.
  - **Explosion-like rule** (from `seed-cross-source-signals.mjs`): FRP > 80 MW with brightness > 380 K, or brightness > 400 K. Five or more such detections in a region within 24 h is an escalation.
  - **Cadence:** every 3 h, with a 9 h TTL. The infrastructure-proximity field ships empty.
- **Free inputs:**
  - **What World Monitor uses:** the FIRMS area API with `NASA_FIRMS_API_KEY` (a free MAP_KEY), over 9 bounding boxes.
  - **Keyless substitute:** the FIRMS open active-fire CSVs (24 h, 48 h, 7 d; VIIRS and MODIS), which OSIRIS already reads.
  - **Licence:** the manifest marks FIRMS redistribution as "review".
- **Backfillable?** The 7-day CSV gives the full 7-day baseline at startup. The 30-day history comes from OSIRIS's own runs, or from the FIRMS archive (requires an Earthdata login; verify).
- **OSIRIS today:** `/api/fires` loads the global 24 h VIIRS SNPP and MODIS CSVs plus EONET volcanoes. No clustering, no baseline.
- **Effort / value:** S / H. An easy improvement on World Monitor:
  - test conflict adjacency by distance to GDELT conflict points, not by a country label;
  - fill in the infrastructure-proximity field from #10.

### 3. Chokepoint transit anomalies (PortWatch)
- **Purpose:** detect when traffic through a strategic waterway drops below its own norm.
- **Method (WM, `seed-chokepoint-flows.mjs` and `chokepoints.mdx`):**
  - **Registry:** 13 straits (Suez, Malacca, Hormuz, Bab el-Mandeb, Panama, Taiwan, Cape of Good Hope, Gibraltar, Bosporus, Korea, Dover, Kerch, Lombok). Daily PortWatch counts per vessel type, plus tanker DWT capacity, over 180 days.
  - **Flow:**
    - the mean of the last 7 days against the mean of the preceding ~90 (from about day −97 to day −7);
    - tanker DWT is used when at least half the baseline days carry it, otherwise tanker counts;
    - gates: at least 40 days of history, 3 recent days and 20 baseline days, and a non-trivial baseline;
    - the ratio is clamped to 0–1.5;
    - "disrupted" means each of the last 3 days is below 0.85 × baseline.
  - **Oil-flow estimate:** for 7 straits, the ratio × the static EIA 2023 baselines in mb/d (Hormuz 21.0, Malacca 17.2, Suez/SUMED 7.6, Bab el-Mandeb 6.2, Danish Straits 3.0 mapped onto Dover, Turkish Straits 2.9, Panama 0.9).
  - **Hazard annotation:** the nearest active red or orange GDACS/PortWatch alert within 500 km. It never changes the numbers.
  - **Anomaly bonus (feeds the score in #26):** transits against a baseline of days −37 to −8, scaled to 7 days. A drop of 50 % or more counts. It needs 37 days of history and at least 14 transits per 7 days.
- **Free inputs:**
  - PortWatch: the ArcGIS FeatureServer `Daily_Chokepoints_Data` and `portwatch_disruptions_database` on `services9.arcgis.com`. Keyless per the manifest and the scripts; terms are "verify" in both the manifest and DS.md.
  - The EIA table is static public figures.
  - GDACS: keyless.
- **Backfillable?** Yes. PortWatch serves the history on request; the computation needs no state.
- **OSIRIS today:** `/api/maritime` subscribes aisstream to bounding boxes around Hormuz, Suez, Bab el-Mandeb, Panama, Malacca, the Taiwan Strait and Dover. It counts no transits and keeps no history.
- **Effort / value:** S / H. Chokepoint polygons with daily series. PortWatch's disruptions database also gives port-level events (active, or ended within the last 30 days).

### 4. Alert fusion, cooldowns and emission rules
- **Purpose:** turn many module alerts into few composite alerts that don't repeat.
- **Method (WM):**
  - **Merging:** alerts within 2 h of each other merge when they are also within 200 km or in the same country. The merged alert takes the highest priority and concatenates the component summaries.
  - **Queue limits:** inserts drop the oldest alert past 50; the refresh path keeps 100 after a 24 h prune.
  - **Dedup TTL per type:** 6 h for slow market and energy types, 2 h for prediction-market types, 30 min by default.
  - **Dedup key:** the subject (symbol, cell), never the magnitude.
  - **Hotspots:** a 2 h cooldown each. A signal goes out only on an upward whole-band crossing, a rise of at least 0.5, or a first entry into the critical band.
  - **Priority:**
    - critical: a CII-critical country, 4+ convergence types, or a critical cascade;
    - high: a CII-high country, a 30+ point CII move, or a cascade reaching 5+ countries;
    - medium: an elevated CII, a 15+ point move, or a cascade reaching 3+ countries.
  - **Breaking-alert gates:**
    - 30 min dedup per event key;
    - a 60 s global cooldown;
    - items older than 15 min are dropped;
    - tier-3+ sources need a non-keyword classification;
    - an importance floor of 30;
    - a 10 s grace period at startup.
  - **Learning mode:** spike alerts are suppressed for 15 min after a cold start.
  - **Shadow-mode cooldowns in the news digest:**
    - critical-developing 4 h, critical-sustained 24 h, high 18 h, medium 36 h, analysis 7 days;
    - bypassed by 5+ new sources, a new fact, or a severity change.
- **Free inputs:** none. This is logic over OSIRIS's own alerts.
- **Backfillable?** Over stored alerts, yes.
- **OSIRIS today:** `lib/watch.ts` diffs consecutive AOI sweeps into entered and left events, keyed by stable ids, and correctly skips the first sweep. It has no cooldowns, no cross-watch or cross-module merging, and no priority. `lib/alert-digest.ts` threads Telegram reports by keyword and does not fuse them with map signals.
- **Effort / value:** S / H. Paid alerts on watched areas (`TODO.md` §5) need this before anything goes out by email or webhook.

### 5. Provenance claims on every observation
- **Purpose:** every observation or derived signal says explicitly what is known about where it came from, and what is not.
- **Method (WM, `decision-signal-provenance.mdx`):**
  - **Claims:** each claim has exactly one status:
    - `known`, which carries a value;
    - `unknown`, which needs a reason;
    - `not_applicable`, which needs a reason.
  - **Families:** each signal family declares, per dimension, whether the claim is required, may be unknown, or does not apply. Leaving a dimension out is invalid.
  - **Dimensions:**
    - publisher class (government, state media, wire, independent, market, derived), kept separate from confidence;
    - HTTPS source URL and a reference to the original, with an optional SHA-256;
    - language and translation state;
    - four time roles that may not substitute for one another: observation, effective, publication and retrieval, each with a precision;
    - revision vintage and supersession (corrected, cancelled, superseded, with links);
    - extraction confidence and classification confidence, separately;
    - corroboration, listing the ids of the supporting signals;
    - transport freshness, separate from content freshness;
    - derivation, giving the input ids and the method.
  - **Validation:** the same validation runs at cache, API, MCP and UI boundaries.
  - **Related patterns:**
    - point-in-time "vintages" with no lookahead (China nowcast);
    - "fetchedAt = the oldest contributing source time" for composites (defense base, resilience).
- **Free inputs:** none.
- **Backfillable?** Not applicable. It has to be in the format from the first record.
- **OSIRIS today:** the `ARCHITECTURE.md` observation already has `observed_at`, `ingested_at`, `quality` and `raw_record_ref`. Missing: publication and effective times, the unknown-versus-absent distinction, two separate confidences, and derivation. Rule 5 asks for the last of these. Routes already label editorial values (`country-risk` returns `basis: 'editorial'`).
- **Effort / value:** S / H. Settle it in phase 1 ("fix the entity model and the observation format before writing any connector").

### 6. Licence gate on served values
- **Purpose:** make sure the paid product never re-serves data whose licence forbids it.
- **Method (WM, `resilience-indicator-licensing.mdx`):**
  - **Derived scores** are always served, with attribution.
  - **A raw upstream value** is served only when:
    - the row is observed, not imputed;
    - every contributing provider has a completed "allow" review;
    - attribution is attached;
    - the retrieval time is known.
  - **Composites** pass only if every part passes.
  - **Default:** fail closed.
  - **Attribution:** projection or field filtering that would strip it is refused.
  - **Times:** the source year (when the value was measured) is kept apart from the retrieval time.
- **Free inputs:** none.
- **Backfillable?** Not applicable.
- **OSIRIS today:** `ARCHITECTURE.md` plans a source registry with licence and commercial-use fields. `TODO.md` §6 says non-commercial sources stay out of the paid product. Nothing enforces either yet.
- **Effort / value:** S / H. It is what makes the free/paid split (`TODO.md` §5) legally safe with NC inputs (adsb.fi, OpenSky, Open-Meteo free tier, WHO) in the mix.

### 7. Source freshness and intelligence-gap tracker
- **Purpose:** report what the system cannot see, so missing data never reads as calm.
- **Method (WM):**
  - **Status bands:** fresh under 15 min, stale at 2 h, very stale at 6 h, plus no-data, error and disabled.
  - **Required inputs:** sources marked required for a score withhold that score ("insufficient data") rather than let it read low.
  - **Partial coverage:** a score whose input families are partly dark is flagged `COVERAGE_PARTIAL`.
  - **Freshness budgets** (minutes, from the cross-source aggregator):

    | Budget (min) | Sources |
    |---|---|
    | 30 | quakes, radiation, outages, military flights |
    | 45 | weather |
    | 90 | forecasts |
    | 120 | unrest |
    | 240 | cyber |
    | 360 | thermal, wildfire |
    | 720 | sanctions |
    | 2,880 (48 h) | GDELT tone |

  - **Seeder failures:** the last good value is kept with its TTL extended, but its `fetchedAt` is not advanced, so every consumer applies its own age limit.
  - **Health budgets:** about 2× the cron interval. An activation marker keeps a never-yet-run source "pending" rather than critical.
  - **Content age** (the newest observation in the payload) is tracked separately from fetch time.
  - **Publication floors:** a thinner snapshot never replaces a richer one (resilience requires 90 % of countries; the five-factor scorecard needs 180 countries).
  - **Empty results:** "not covered yet" and `upstreamUnavailable` are kept distinct from zero.
- **Free inputs:** none.
- **Backfillable?** Not applicable.
- **OSIRIS today:** `/api/stats` counts the feeds that answered and simply omits the ones that failed. `/api/flights` now reports provider counts, because adsb.lol and airplanes.live failed silently. `/api/health` semantics are open (`TODO.md` §2). `ARCHITECTURE.md` rule 3 states the principle.
- **Effort / value:** S / H. Replay ("missing data is shown, never interpolated"), anomaly detection and alerts all depend on it.

### 8. Military air activity: surge, foreign presence and theater posture
- **Purpose:** detect unusual military air concentrations by theater, and offensive "strike packages".
- **Method (WM; the docs and the script differ):**
  - **Surge, per the docs:**
    - a 48 h baseline per theater per category (transport, fighter, reconnaissance), with at least 6 samples;
    - defaults while that builds: 3, 2 and 1;
    - a surge needs ratio ≥ 2 together with ≥ 5 transports and ≥ 4 fighters (reconnaissance minimum 3);
    - severity: medium at 2×, high at 3×, critical at 4×; below half the baseline is a stand-down.
  - **Surge, per the script:**
    - up to 72 snapshots per theater; the baseline is the mean of up to 12 comparable prior snapshots, with at least 3;
    - fighter surge: ≥ 4 fighters and ≥ 2×;
    - airlift surge: ≥ 5 transports and ≥ 2×;
    - air-activity surge: total ≥ max(6, ceil(1.5 × baseline)) and +40 %;
    - "persistent" when an earlier snapshot also exceeded the threshold.
  - **Foreign presence:**
    - 18 sensitive regions; aircraft are grouped by operator nation, and each operator's home regions are excluded;
    - 2–3 aircraft per operator trigger an alert;
    - named pairs are critical (PLAAF in the Taiwan Strait, Russian VKS in the Arctic, USAF in the Persian Gulf);
    - confidence 0.7–0.95.
  - **Theater posture:**
    - nine bounding boxes with elevated and critical aircraft-count thresholds (e.g. Iran 50/100, Taiwan 30/60, Korea 20/50, Baltic 20/40, Israel/Gaza 10/25);
    - "strike capable" when the tanker, AWACS and fighter minimums are all met (Iran 10/2/30, Taiwan 5/1/20, Korea 4/1/15, Israel 2/1/8);
    - trend at ±10 %.
  - **Classification:** by callsign (RCH/REACH/DUKE …), ICAO hex block, or type code.
  - **Correlation cards:** strike types score severity 80, support types (tanker, AWACS, ISR, EW) 60, others 55. A card containing both strike and support types is titled "strike packaging".
- **Free inputs:**
  - **adsb.lol `/v2/mil`:** World Monitor's documented primary source, keyless and ODbL.
    - **Conflict:** OSIRIS's `/api/flights` records `api.adsb.lol/v2` answering 200 with an empty `ac[]`, and airplanes.live answering 403. Re-check adsb.lol's access model.
  - **adsb.fi `/mil`:** what OSIRIS reads today. Keyless, but personal/non-commercial per the manifest.
  - **OpenSky:** account needed, NC per DS.md.
  - **Wingbits:** keyed.
  - A licence-clean military feed for the paid product is an open gap.
- **Backfillable?** No. The baseline has to come from OSIRIS's own polling.
- **OSIRIS today:** `/api/flights` pulls the adsb.fi `/mil` feed every cycle and sets `category: 'military'` from the emitter category, the adsbdb military flag, type codes and callsigns. No theater counts, no baseline, no package detection.
- **Effort / value:** S / H. Respect the DS.md caution against pattern-of-life views around bases. Theater-level aggregates are the safer product.

### 9. Sanctions pressure and sanctioned-asset matching
- **Purpose:** show which sanctioned vessels and aircraft are moving, and which countries just gained designations.
- **Method (WM):**
  - **Lists:** OFAC SDN, OFAC Consolidated and Canada's SEMA/JVCFOA, each fetched independently.
  - **New entries:** an OFAC id absent from the previous snapshot counts as new.
  - **Aggregates:** designations per country and per program, and counts of vessels and aircraft.
  - **Quarantine:** malformed rows (a bad IMO, no name) are held back with a reason. If more than 1 % of a source's rows are bad, that source is rejected for the run.
  - **Alerts and scoring:** 5 or more new designations is a "sanctions surge". Sanctions feed CII (a boost of up to 14).
- **Free inputs:**
  - `sanctionslistservice.ofac.treas.gov`: keyless per the manifest; US government data.
  - Canada SEMA: keyless.
  - OpenSanctions: "likely NC" per DS.md, so read the source lists directly ("Add these first" #3).
  - Matching keys: IMO and MMSI from AIS static messages; aircraft registration via adsbdb or the FAA registry.
- **Backfillable?** The lists yes; the live matches no.
- **OSIRIS today:** `lib/sanctions.ts` loads the OpenSanctions `us_ofac_sdn` CSV, with Vessel and Aircraft entity types. No diff, and no matching against `/api/maritime` or `/api/flights`.
- **Effort / value:** S / H. The match turns a static list into map events. It is also the input to "ships switching off AIS near sanctioned ports" in DS.md.

### 10. Event → nearby critical infrastructure
- **Purpose:** give every geolocated event its infrastructure context automatically.
- **Method (WM):** assets within 600 km of the event, ranked by Haversine distance, up to 3 per type. The types are pipelines, cables, AI datacentres, military bases (226), nuclear facilities and ports. The same 600 km ring around a country's centroid gives the dossier's "infrastructure exposure".
- **Free inputs:**
  - GEM pipelines (CC BY 4.0 per the manifest; the download is behind a registration form);
  - World Port Index (public domain);
  - OSM `power=*` and `man_made=pipeline` (ODbL);
  - military installations from OSM, Wikidata and MIRTA;
  - cable routes: TeleGeography is proprietary per the manifest, so use OSM submarine cables instead.
- **Backfillable?** Yes (static reference data).
- **OSIRIS today:** `lib/aoi.ts` sweeps every tracked layer inside a polygon, with a bounding-box pre-filter. `/api/infrastructure` holds nuclear sites. Nothing runs the sweep around an event automatically.
- **Effort / value:** S / H. A circle sweep with a top-k per type. It is the first step of "impact analysis" in `ARCHITECTURE.md`, and it fills in thermal clusters' empty `nearbyAssets` field.

---

## Ratio 2.0: medium value, small effort

### 11. Correlation cards (escalation, disaster, military, economic)
- **Purpose:** explainable per-domain cards built from a few keyless families.
- **Method (WM, `seed-correlation.mjs`):**
  - **Clustering:** escalation by country over 48 h; disaster by 500 km union-find over 96 h; military by 500 km over 24 h; economic by keyword entity.
  - **Card score:** the maximum severity per signal type × the domain weight, summed. A diversity bonus adds 12 per type beyond 2 (capped at 30). The total is capped at 100. A card is emitted at 20 or more.
  - **Weights and severities:**

    | Domain | Signal | Weight | Severity |
    |---|---|---|---|
    | Escalation | conflict events | 0.45 | high/medium/low 85/55/30 |
    | Escalation | outages | 0.25 | total/major/partial 90/70/40; kept only where the country also has conflict |
    | Escalation | escalation-keyword news | 0.30 | critical/high/medium 85/65/45 |
    | Disaster | earthquakes | 0.55 | (M − 1.5) × 17, clamped to 10–100 |
    | Disaster | outages | 0.45 | as above |
    | Economic | market moves of ≥ 1.5 % | 0.35 | 10 × % |
    | Economic | sanctions/trade news | 0.30 | — |
    | Economic | commodity spikes | 0.35 | — |

  - **What crosses the threshold:**
    - two high-severity unrest events in one country make a card; news alone never does;
    - two M4.5+ earthquakes within 500 km make a card, so aftershock sequences produce "disaster cascade" cards.
  - **Defined but unused:** weights for AIS gaps and military vessels exist, but nothing collects those signals.
  - **Trend:** always "stable".
- **Free inputs:**
  - conflict: GDELT events (QuadClass 4 / CAMEO 18–20) in place of ACLED (keyed via `ACLED_EMAIL`/`ACLED_PASSWORD`, NC);
  - outages: IODA, keyless (Cloudflare Radar needs `CLOUDFLARE_API_TOKEN`);
  - earthquakes: USGS;
  - news: OSIRIS's RSS and Telegram.
- **Backfillable?** GDELT, IODA and USGS yes; news partly.
- **OSIRIS today:** every input exists (`/api/gdelt-events`, `/api/radar` with IODA, `/api/earthquakes`, `/api/news`). Nothing combines them. The escalation card is a far more defensible "observed" replacement for the editorial `country-risk` base than the earthquake sum it uses now.
- **Effort / value:** S / M. Require several distinct types per card to avoid the single-type noise.

### 12. Cross-source rule library with a theater "composite escalation"
- **Purpose:** a catalogue of simple threshold rules across domains, plus an alarm when 3+ categories fire in one theater.
- **Method (WM, `seed-cross-source-signals.mjs`):**
  - **Rules:** about 22 typed rules, each a base weight × a capped factor. Severity bands: ≥ 3.5 critical, ≥ 2.5 high, ≥ 1.5 medium. The rules most relevant to OSIRIS:
    - thermal spike (z > 2);
    - GPS-jamming theaters;
    - military surge;
    - ≥ 3 unrest events in a theater in 24 h;
    - an earthquake of M ≥ 6.5;
    - a radiation reading at SPIKE (ELEVATED is ignored);
    - ongoing total or major outages;
    - ≥ 5 explosion-like fires in a region;
    - weather alerts of "Extreme" severity (NWS, ECCC, WMO SWIC);
    - media tone falling: 3 GDELT tone points spanning ≥ 24 h, strictly declining, the last below −1.5;
    - ≥ 5 new sanctions designations.
  - **Composite escalation:**
    - fires when the other signals in a theater span ≥ 3 categories (kinetic, electronic warfare, military, civil, natural, radiological, infrastructure, cyber and others);
    - score = 4 × min(3, 1 + categories/3) + 0.2 × the sum of the members' scores, so it is critical by construction;
    - the output is capped at 30 signals.
  - **Theater assignment:** case-insensitive substring matching on labels. Country-coded inputs (e.g. CII) rarely join a theater because of this.
  - **Cadence:** every 15 min, with a 30 min TTL.
  - **Defined but never emitted:** "displacement surge". The upstream data is an annual stock, not a flow.
- **Free inputs:** mostly as above. The keyless weather alert feeds are `api.weather.gov`, ECCC and WMO SWIC. GDELT DOC tone is keyless.
- **Backfillable?** It is stateless over its inputs.
- **OSIRIS today:** none.
- **Effort / value:** S / M. Prefer #1 (geometric cells) over substring theaters. Port the *rules* as a library of per-source thresholds that feed #1 and #4.

### 13. Radiation watch: station baselines with corroboration
- **Purpose:** flag readings that are abnormal for their own station, and say whether another network agrees.
- **Method (WM, `seed-radiation-watch.mjs`):**
  - **EPA RadNet:** the latest reading against the mean and standard deviation of the station's previous 168 readings (a minimum of 48 for σ).
  - **Safecast:** windows of 96 readings (minimum 24), devices within 120 km, a 400-day lookback, and conversion at 350 CPM per µSv/h.
  - **Severity:** spike at a rise of ≥ 15 nSv/h or z ≥ 3; elevated at ≥ 8 nSv/h or z ≥ 2.
  - **Confidence:** medium with an adequate baseline; high when a distinct second source agrees; downgraded on a material conflict.
  - **Outputs:** counts of anomalies, elevated, spikes, corroborated, low-confidence and conflicting.
  - **Cadence:** a 2 h TTL and a 30 min health budget.
- **Free inputs:**
  - EPA RadNet CSV (`radnet.epa.gov/cdx-radnet-rest/api/rest/csv/{year}/fixed/{state}/{site}`): keyless, US government ("reviewed" in the manifest).
  - Safecast API: keyless. DS.md says CC0; the manifest says "verify by endpoint".
  - EURDEP is restricted (DS.md).
- **Backfillable?** Yes. RadNet returns a year per request.
- **OSIRIS today:** none. Safecast is listed in DS.md.
- **Effort / value:** S / M. Also a template for any station network (river gauges, buoys, air quality).

### 14. Natural-hazard fusion (GDACS + EONET)
- **Purpose:** one hazard event per real event, with the best severity and the best geometry.
- **Method (WM):**
  - **Matching:** records within 100 km and 48 h are duplicates.
  - **Merging:** GDACS severity wins (it is human-verified); EONET geometry wins (it is more precise); both sources are credited.
  - **Display filters:** fires under 48 h old, earthquakes M4.5+, storms only when named or warned.
- **Free inputs:** GDACS and NASA EONET v3, both keyless (the manifest notes both as "osiris: host").
- **Backfillable?** Yes.
- **OSIRIS today:** `/api/gdelt` actually reads GDACS RSS, and `/api/fires` reads EONET volcanoes, as separate layers with no deduplication.
- **Effort / value:** S / M. It is the DS.md "event fusion" rule applied to hazards first.

### 15. Travel-advisory levels and floors
- **Purpose:** use official advisories as an expert risk floor that does not depend on news volume.
- **Method (WM):**
  - **Feeds:** US State Department, UK FCDO and Australian Smartraveller feeds, plus CDC, ECDC and WHO health notices, fetched hourly.
  - **Parsing:** RSS and Atom are both parsed and deduplicated by title, with countries mapped through a 265-name alias table.
  - **Levels:** do-not-travel 4, reconsider 3, caution 2, normal 1, info 0.
  - **In CII:**
    - boosts: +15 for do-not-travel, +10 for reconsider, +5 for caution;
    - floors: 60 for do-not-travel, 50 for reconsider;
    - provenance on every score: live, fallback or absent.
- **Free inputs:** `travel.state.gov/_res/rss/TAsTWs.xml`, `gov.uk/foreign-travel-advice.atom` and `smartraveller.gov.au/countries/documents/index.rss`. All keyless per `seed-security-advisories.mjs`; DS.md lists State and FCDO as OK.
- **Backfillable?** No. Poll them and keep the level history.
- **OSIRIS today:** none.
- **Effort / value:** S / M. Country polygons with a dated level history.

### 16. Evidence grading and corroboration ladder
- **Purpose:** keep "an article mentioned this place" apart from "an event happened here", and promote events only on independent corroboration.
- **Method (WM):**
  - **Unrest evidence contract:**
    - a GDELT GKG location is an *unverified media mention*: no event type, no severity, low confidence;
    - its timestamp is the article or collection time, never the incident time;
    - more reports never raise confidence;
    - a GDELT link can never become ACLED evidence.
    - This contract supersedes the older docs' "≥ 5 mentions included, > 30 validated" rule.
  - **ACLED/GDELT deduplication:** a spatial grid with same-day matching; ACLED wins. The docs disagree on the grid size: 0.1° in `data-sources.mdx`, 0.5° in `features.mdx`.
  - **Severity:** high for fatalities or riot/clash terms, medium for an ordinary demonstration.
  - **Regime-aware scaling:** logarithmic in democracies, linear in authoritarian states.
  - **The shortage-alert ladder, a reusable pattern:**
    - "watch" needs one credible source (a regulator, an airline or airport, or a national wire plus one corroborating observation);
    - "confirmed" needs two outlets plus a regulator, or three outlets, or a regulator plus an operational signal;
    - designed decay: confirmed falls back to watch after 7 days without corroboration, and watch is removed after 14 days. World Monitor does not enforce this.
  - **Evidence bundles for pipelines and disruptions:** a status badge is derived from sourced evidence, with regulator and operator ranked above the press. "Stale evidence" after 30 days, never an automatic resolution.
- **Free inputs:**
  - GDELT 2.0 events and GKG: keyless.
  - ACLED: keyed and NC, so drop it.
- **Backfillable?** Yes (GDELT).
- **OSIRIS today:** `/api/conflicts` blends GDELT GEO/DOC points with hand-anchored zones. `/api/gdelt-events` serves ActionGeo points. Neither marks an evidence class. `lib/alert-digest.ts` already reports whether opposing sides carry a story, which is a natural corroboration input.
- **Effort / value:** S / M. Mostly labels and rules. It keeps the map honest, as `lib/country-risk.ts` already tries to do.

### 17. News credibility score (separate from importance)
- **Purpose:** a 0–100 reliability score per item, never mixed into "importance".
- **Method (WM, `news-credibility.mdx`):**
  - **Formula:** 0.50 × propaganda risk + 0.30 × tier + 0.20 × corroboration.
    - Propaganda risk: low 100, medium 50, unknown 35 (fail-closed default), high 12.
    - Tier: 1 → 100, 2 → 75, 3 → 50, 4 or unlisted → 25.
    - Corroboration: 20 per distinct publisher family, up to 5.
  - **Cap:** state-controlled sources are capped at 40.
  - **Excluded:** severity and recency.
- **Free inputs:** OSIRIS's own source tables. Do not copy World Monitor's tier or propaganda tables; they are AGPL data.
- **Backfillable?** Not applicable.
- **OSIRIS today:** `/api/news` already tags each source with `lean` and `bloc` (western, russian, regional). That is half of the input.
- **Effort / value:** S / M. It feeds the provenance "classification confidence" in #5.

### 18. News keyword spikes, velocity and story phases
- **Purpose:** detect a term or story breaking out of its normal volume, and track its lifecycle.
- **Method (WM):**
  - **Keyword spike:**
    - headlines are tokenized, keeping CVE ids, APT and FIN tags and multi-word leader names;
    - 2 h counts are compared with a 7-day baseline refreshed hourly;
    - a spike needs > 5 mentions, > 3× the baseline, ≥ 2 distinct feeds, and a 30 min cooldown per term;
    - the registry holds 10k terms (LRU);
    - each spike carries its evidence (sources, up to 6 articles);
    - the server-side variant uses a 48 h accumulator.
  - **Velocity:** a cluster reaching 6+ tier-1/2 sources per hour.
  - **Story identity:** a SHA-256 of the normalized title, kept for 7 days.
  - **Phases:** breaking (1 mention), developing (2–5 mentions and under 2 h old), sustained. "Fading" was studied and rejected.
  - **Category convergence:** 3+ source categories on one story. "Triangulation" means wire, government and intel all present.
- **Free inputs:** OSIRIS's RSS and Telegram feeds.
- **Backfillable?** From stored headlines only.
- **OSIRIS today:** `lib/alert-digest.ts` threads by theatre and event type. No baselines, no phases.
- **Effort / value:** S / M. Spikes geocoded through `lib/alert-places.ts` become map events.

### 19. Military aircraft identification confidence
- **Purpose:** grade the military call: confirmed, likely, possible or civilian.
- **Method (WM):**
  - **Confirmed:** the owner or operator matches a military branch.
  - **Likely:** a military ICAO operator code (RCH, AIO, RRR, GAF, CNV, DOD) or an exclusively military type.
  - **Possible:** a defence-contractor owner, or a government aircraft in a military area.
  - **Caching and batching:** details cached 24 h, batched by up to 20–50.
  - **Patterns noted:** formations, and holding or reconnaissance orbits on 20-point / 5-minute trails.
- **Free inputs:**
  - Wingbits: keyed (`WINGBITS_API_KEY`).
  - Substitutes: adsbdb and hexdb, both already OSIRIS hosts (DS.md flags adsbdb's terms). The FAA aircraft registry is public domain and is DS.md "Add these first" #2.
- **Backfillable?** Not applicable.
- **OSIRIS today:** `/api/flights` sets a single `category` value, with no tier and no evidence.
- **Effort / value:** S / M.

### 20. Airport disruption severity
- **Purpose:** delays and closures as airport events.
- **Method (WM):**
  - **Disruption types:** ground stop, ground delay, arrival delay, departure delay.
  - **Severity by average delay:** 15–24 min minor, 25–44 moderate, 45–59 major, 60 or more severe.
  - **NOTAM closures:** detected for 46 MENA airports via ICAO.
- **Free inputs:**
  - `nasstatus.faa.gov/api/airport-status-information`: keyless, US only (`seed-aviation.mjs`).
  - ICAO NOTAM data: keyed (`ICAO_API_KEY`).
  - DS.md "Add these first" #6 already plans NOTAMs, TFRs and METAR.
- **Backfillable?** No.
- **OSIRIS today:** none.
- **Effort / value:** S / M.

### 21. Climate-zone anomalies
- **Purpose:** flag regions running unusually hot, cold, wet or dry.
- **Method (WM):**
  - **Normals:** 1991–2020 monthly normals per named zone centroid, refreshed monthly with a 95-day TTL. The docs say 15 zones; the zone file lists about two dozen.
  - **Comparison:** recent ERA5 daily values against that month's normal.
  - **Severity:** extreme at |ΔT| ≥ 5 °C or |ΔP| ≥ 12 mm; moderate at ≥ 3 °C or ≥ 6 mm.
  - **Types:** warm, cold, wet, dry, or mixed (hot and dry together).
  - **Cadence:** about every 2 h, with a 14-day content-age budget (ERA5 lags 5–7 days).
- **Free inputs:**
  - Open-Meteo archive: keyless, but the free tier is NC (manifest, DS.md, `TODO.md`).
  - Substitutes: ERA5 via Copernicus CDS (free key) or NOAA CPC/GHCN (keyless, public domain), both from memory; verify.
- **Backfillable?** Yes.
- **OSIRIS today:** `/api/weather-grid` (Open-Meteo, 510 points) has current conditions only.
- **Effort / value:** S / M. Better computed on OSIRIS's own grid than on zone centroids.

### 22. Disease-outbreak aggregation with geocoding
- **Purpose:** outbreak alerts as dated points.
- **Method (WM):**
  - **Sources:** WHO DON, WHO Geneva briefings, CDC, ECDC, CIDRAP, and ThinkGlobalHealth (ProMED-derived).
  - **Filters:** CDC and CIDRAP items count only when they name a known disease and a country and are under 90 days old.
  - **Placement:** at a named city of 100k+ people or a first-level region (GeoNames, CC BY), otherwise at the country centroid.
  - **Dedup:** the newest item per source × disease × country.
  - **Alert level:** keyword-only. ALERT for outbreak, emergency, epidemic or pandemic; WARNING for warning, spread or "cases increasing"; otherwise WATCH. The doc itself lists the flaws: English only, and a "false outbreak rumor" becomes an ALERT.
- **Free inputs:** WHO DON, CDC and ECDC feeds, all keyless. DS.md marks WHO as NC; verify.
- **Backfillable?** Yes (archives).
- **OSIRIS today:** none.
- **Effort / value:** S / M. Grade by case counts or WHO grading rather than keywords.

---

## Ratio 1.5: high value, medium effort

### 23. Temporal baseline anomaly engine
- **Purpose:** learn what "normal" looks like per place and activity, and flag deviations.
- **Method (WM):**
  - **Welford engine:**
    - a baseline per (event type × region), bucketed by weekday and by month;
    - the event types are military flights, vessels, protests, news velocity, AIS gaps and fires;
    - online mean and variance over 90 days;
    - z bands: ≥ 1.5 medium, ≥ 2 high, ≥ 3 critical;
    - silent until a bucket holds 10 samples;
    - anomalies feed back into convergence.
    - With weekday buckets, that is about 10 weeks per bucket.
  - **EMA variant (`_ema-threat-engine.mjs`):**
    - a rolling 24 h event count per country, sampled hourly into a 24-sample window;
    - an EMA with α 0.3; z = (EMA − window mean) / σ, after at least 6 samples;
    - risk = clamp(50 + 20z) on 0–100; a "velocity spike" at ≥ 75 (z ≥ 1.25);
    - a spike adds 0.08 to a conflict forecast.
    - Its inputs are ACLED and UCDP (both keyed).
    - Overlapping hourly windows make the samples strongly autocorrelated, so this is not a classic count z-score.
  - **Robust variant (physical divergence):**
    - a robust z (0.6745 × deviation from the median / MAD) plus a percentile over the last 250 points, with at least 60;
    - the regime is the worse of an absolute threshold and the percentile ladder (80/95/99);
    - the ladder applies only above a minimum magnitude.
    - Suited to heavy-tailed series.
- **Free inputs:** any OSIRIS feed. GDELT and FIRMS counts can seed baselines from their archives; flights and AIS need OSIRIS's own history.
- **Backfillable?** Only for archival inputs. A strong argument for the day-one raw archive.
- **OSIRIS today:** none. `ARCHITECTURE.md` phase 3 asks to "account for sensor coverage and missing data before flagging". World Monitor does not, so combine this engine with #7.
- **Effort / value:** M / H. One engine for H3 cells, AOIs, airports, ports and chokepoints.

### 24. GDELT conflict intensity and dyad tension
- **Purpose:** relative, history-based tension per country pair, or per place, from GDELT's raw exports with no news API.
- **Method (WM):**
  - **Daily intensity:** per UTC day, the sum over QuadClass 3/4 events of NumMentions × max(0, −Goldstein). Both actor directions count.
  - **Score:**
    - the percentile of the last 7 completed days' mean among the pair's 90 completed daily values, with ties counted at half weight;
    - a flat history scores 50.
  - **Guards:**
    - at least 140 conflict events in those 7 days;
    - all 96 export files present for every day used;
    - missing days are never treated as quiet;
    - a change against a zero prior mean is withheld.
  - **Change and trend:** the 7-day mean against the previous 7, with the trend at ±10 %.
  - **Pairs:** US–RU, RU–UA, US–CN and US–IR. CN–TW and US–VE failed the 20-events-a-day floor.
  - **Repair:** each run rebuilds up to 2 incomplete days from the master file list, checking size and MD5 and backing off failed days for 6 h. An empty 90-day window fills in about 11 h.
- **Free inputs:** `data.gdeltproject.org` exports and the master list. Keyless; DS.md lists GDELT as OK.
- **Backfillable?** Fully. The only World Monitor score that can be built from history on day one.
- **OSIRIS today:** `lib/gdeltEvents.ts` already inflates the 15-min export ZIPs and reads ActionGeo coordinates. No daily history, no intensity.
- **Effort / value:** M / H. Generalize past dyads: the same percentile intensity per country, admin-1 region or H3 cell gives a backfilled conflict-intensity surface.

### 25. GPS/GNSS interference grid
- **Purpose:** map where aircraft lose GPS integrity (jamming or spoofing), daily, with history.
- **Method (WM):**
  - **Cells:** gpsjam.org's daily H3 resolution-4 cells, each with the share of aircraft reporting degraded navigation accuracy.
  - **Levels:** cells with fewer than 3 aircraft are dropped. Under 2 % is low, 2–10 % medium, above 10 % high.
  - **Regions:** cells are tagged to 12 conflict regions.
  - **Scoring uses:**
    - in CII, per country: 5 points per high cell and 2 per medium cell, capped at 35;
    - in the cross-source rules: level high, or average NP below 0.5;
    - in resilience: high cells count ×3, medium ×1.
  - **Cadence:** daily, with a 48 h TTL.
- **Free inputs:**
  - gpsjam.org daily CSVs: keyless. Terms are "verify" in the manifest, and the data derives from ADS-B Exchange.
  - **The clean route,** already in DS.md "Derived data we compute ourselves": compute the grid from NIC/NACp (position-quality) fields in ADS-B records.
    - adsb.lol (ODbL) is the licence-clean source, but see the access conflict in #8.
    - adsb.fi is NC.
- **Backfillable?** gpsjam keeps a long daily archive, licence permitting. A self-computed grid starts with OSIRIS's polling.
- **OSIRIS today:** none.
- **Effort / value:** M (self-computed; S to ingest gpsjam if its terms allow) / H.

### 26. NGA navigational warnings → cable faults and the chokepoint disruption score
- **Purpose:** infer cable faults and maritime hazards from official warnings, and combine them into a 0–100 score per chokepoint.
- **Method (WM):**
  - **Cables:**
    - active NGA warnings containing cable terms are parsed for DMS and decimal coordinates, vessel names, fault terms (FAULT, BREAK, DAMAGE; anything else is maintenance) and repair ETAs;
    - each is matched to the nearest catalogued cable within 555 km (cos-latitude-corrected distance);
    - known cable ships are matched by name, with en route or on station read from keywords;
    - each signal (operator fault, advisory, repair activity) has its own severity, confidence and TTL, and decays linearly with age;
    - the cable's score is the strongest severity × confidence × recency;
    - FAULT at 0.80 or above with an operator-fault signal; DEGRADED at 0.50 or above (or 0.80 with repair activity);
    - health is cached 30 min and the warnings 24 h.
  - **Chokepoint score:**
    - min(100, threat weight + min(15, 5 × active warnings) + min(15, 5 × the maximum AIS congestion level, 1–3) + the anomaly bonus of 10 from #3);
    - threat weights: war zone 70, critical 40, high 30, elevated 15, normal 0. Hormuz and Kerch are war zones, Bab el-Mandeb critical, Suez high, Taiwan and Bosporus elevated;
    - the bonus applies only at war zone or critical;
    - badge: under 20 green, 20–49 yellow, 50 or more red;
    - text keywords decide which chokepoint an event belongs to, with proximity only as the fallback.
- **Free inputs:**
  - NGA MSI (`msi.nga.mil/api/publications/broadcast-warn?output=json&status=A`): keyless, US government.
  - Cable geometry: TeleGeography is proprietary per the manifest ("verify (may be NC)" in DS.md); use OSM submarine cables (ODbL).
  - AIS congestion: aisstream needs a free key, or a keyless regional feed.
- **Backfillable?** Partly. NGA serves active and recent warnings; archive them from now on.
- **OSIRIS today:** none.
- **Effort / value:** M / H. One warning parser serves both the cable and the chokepoint features. World Monitor's threat weights are editorial, so label them as such, as `country-risk` already does.

### 27. AIS behaviour analytics
- **Purpose:** turn vessel positions into behaviour events.
- **Method (WM):**
  - **Dark gaps:** an AIS gap of more than 60 min in a monitored region flags the vessel.
  - **Density:** a 2° grid of vessel counts against a short rolling baseline; a change of ±30 % alerts.
  - **Trails:** 30 points per MMSI, for loitering and circling.
  - **Military vessels:** a known-vessel and hull database first, then the AIS ship type, then the MMSI flag code (150+ countries), naval name prefixes and callsigns.
  - **Proximity:** a flag within 50 km of 12 major naval bases, and when entering chokepoint radii.
  - **Clusters near hotspots:** deployment (a carrier plus 5+ vessels), exercise, or transit.
  - **24 h strait transit counter:**
    - needs both an entry and an exit report for the same vessel;
    - the vessel must spend at least 5 minutes inside and exit within 6 h;
    - health requires crossings at 5 or more of the 13 straits.
  - **USNI merge:** the weekly USNI fleet report is matched to AIS by hull number and name. Unmatched ships get a synthetic position in their reported region.
- **Free inputs:**
  - aisstream: free key (`AISSTREAM_API_KEY`); redistribution is an open question in `TODO.md`.
  - Keyless: Digitraffic (CC BY 4.0, MQTT), Kystverket, and NOAA MarineCadastre for US history.
  - USNI is a scrape (terms-review).
- **Backfillable?** Live AIS no; MarineCadastre yes, for US waters.
- **OSIRIS today:** `/api/maritime` keeps about 18k ships in a recency-ordered cache, with `shipCategory` from the type code and a moving/anchored threshold (`lib/ship-filter.ts`). No gaps, trails or military identification.
- **Effort / value:** M / H. These are the DS.md "shipping signals from AIS". Gaps must respect receiver coverage, because terrestrial AIS is thin offshore.

### 28. Population exposure
- **Purpose:** estimate how many people are inside an event's footprint.
- **Method (WM):**
  - **Radii:** conflict 50 km, earthquake 100 km, flood 100 km, wildfire 30 km.
  - **Population:** taken from a crude 20-country density table, falling back to a synthetic 100 people/km². World Monitor itself says it is "not a live WorldPop lookup".
- **Free inputs:** WorldPop, GHSL or Kontur (all OK in DS.md). Kontur publishes an H3 population grid (from memory; verify), which suits a cell-based design.
- **Backfillable?** Yes (static rasters by year).
- **OSIRIS today:** none.
- **Effort / value:** M / H. Summing a raster or H3 grid over the actual footprint (NWS and NHC polygons, FIRMS clusters) beats World Monitor. Core to "impact analysis".

### 29. Orbital pass prediction, revisit and pass log (World Monitor roadmap, unbuilt)
- **Purpose:** "which imaging or SAR satellites were overhead during this incident, and when are they next?"
- **Method (WM, planned):**
  - **Planned:**
    - next-pass times over watched points;
    - revisit frequency;
    - a historical pass log (24 h, and 30 days at the top tier);
    - imaging-window alerts;
    - sensor-swath cones in place of nadir points;
    - cross-layer correlation: a satellite over a GPS-jam zone, over a conflict zone, or near an AIS gap.
  - **Built today:** about 80–120 reconnaissance satellites from the CelesTrak `military` and `resource` groups, filtered by name patterns (YAOGAN, GAOFEN, COSMOS 24xx/25xx, ICEYE, WORLDVIEW, SENTINEL …), classified by country and sensor, and propagated client-side every 3 s.
- **Free inputs:** CelesTrak GP (keyless, OK\* in DS.md) and the SatNOGS database (already an OSIRIS host). Swath widths from public mission specs.
- **Backfillable?** Yes, if each fetched TLE set is archived (past passes become reproducible).
- **OSIRIS today:** `lib/orbit.ts` (SGP4/SDP4, geodetic output), `/api/satellites` (about 19k objects, classified by mission), the `lib/aoi.ts` sweep, and `/api/sentinel` (Element84 and Copernicus STAC search). OSIRIS is closer to this than World Monitor.
- **Effort / value:** M / H.

### 30. Alert ledger with a hit-rate scorecard
- **Purpose:** measure whether an alert type leads the news, against a fair base rate.
- **Method (WM):**
  - **Ledger:** each emission opens a 6 h window per (type × entity). Repeats increment a sample count instead of adding a row.
  - **Resolution:**
    - HIT when a story first tracked within 6 h has a tier-1/2 source and names the entity;
    - MISS after 6 h without one;
    - VOID when the archive expired before the resolver read it.
  - **Lead time:** emission to first tracking of the matching story.
  - **Base rate:** a control window of the same length, for the same entity, 24 h earlier. It counts only when the archive covers it, no alert for the entity was open during it, and both windows fall on the same side of a weekend.
  - **Scorecard:** paired hit rate against base rate, over 30 days. The median lead time is withheld below 30 hits.
  - **Gaps:** an outage counts as a single tick.
  - **Forecast resolution, a related pipeline:** resolves at 24 h, 7 d, 14 d and 30 d; "hard" resolution against a feed, "judged" against the news archive; Brier and log scores; a 180-day ledger.
- **Free inputs:** OSIRIS's own alerts and news history.
- **Backfillable?** From stored data only.
- **OSIRIS today:** OI scores its statistical price baseline on the instrument's own past (`components/oi/record.tsx`). Nothing scores alerts.
- **Effort / value:** M / H. A defensible "our alerts lead by X h, against a base rate of Y" claim for the history product. The control-window design also tests map alerts, e.g. whether a convergence cell precedes a GDACS or GDELT event there.

---

## Ratio 1.0

### 31. Infrastructure cascade (dependency graph)
- **Purpose:** carry a disruption from one asset through to the countries and assets that depend on it.
- **Method (WM):**
  - **Graph:** 350 nodes (86 cables, 88 pipelines, 62 ports, 9 chokepoints, 105 countries) with weighted edges.
  - **Traversal:** breadth-first, to a depth of at most 3.
  - **Impact:** edge weight × disruption level × (1 − redundancy). Above 0.8 critical, above 0.5 high, above 0.2 medium.
  - **Port weights:** oil/LNG 0.9, container 0.7, naval 0.4.
  - **Hand-set dependency shares:** for example, Hormuz carries 80 % of Japan's oil and Malacca 80 % of China's.
  - **Redundancy:** more landings or routes mean less impact; alternatives are listed with their capacity share.
  - **A related index:** a transit-union exposure 1 − Π(1 − share), with disrupted chokepoints ×1.35 (supply vulnerability).
- **Free inputs:** GEM pipelines, the World Port Index, OSM power and telecom, cable landings (OSM in place of TeleGeography), and EIA chokepoint studies (published reports are keyless; `api.eia.gov` needs `EIA_API_KEY`).
- **Backfillable?** Not applicable (static).
- **OSIRIS today:** none. `ARCHITECTURE.md` "Dependency map" plans exactly this, with inferred edges labelled "possible exposure" and a confidence. World Monitor's weights are editorial and carry no confidence.
- **Effort / value:** L / H.

### 32. Forecast detectors, market blend and calibration
- **Purpose:** rule-based probabilistic forecasts, calibrated against prediction markets and past outcomes.
- **Method (WM, `seed-forecasts.mjs`, structure only):**
  - **Cadence:** hourly.
  - **Nine rule detectors,** e.g.:
    - conflict from CII > 60 and theater posture;
    - supply chain from chokepoint risk, with +0.1 for AIS gaps and +0.05 for GPS jamming;
    - UCDP zones with ≥ 10 events;
    - prediction markets priced 0.60–0.90 are copied as forecasts.
    - Each detector has a domain cap and a horizon.
  - **Market blend:** 0.4 × market + 0.6 × internal. The market must have volume ≥ 5,000 and match on polarity, subject, event class and horizon.
  - **Isotonic calibration** per domain:
    - eligible at ≥ 30 families and ≥ 12 per outcome;
    - switched on only when a scorecard gate (less than 48 h old) shows it is no worse;
    - has a kill switch.
  - **Confidence:** half source diversity, half agreement with the market.
  - **Projections:** curves to 24 h, 7 d and 30 d per domain.
  - **Cascades:** conflict → supply chain 0.6, conflict → market 0.5, and others; capped at 0.8.
  - **Trend:** ±0.05 against the previous run.
  - **Branches:** base, escalatory and contrarian.
  - **LLM enrichment:** narratives, impact expansion and a theater simulation (keyed: `OPENROUTER_API_KEY` or `LLM_API_*`).
  - **Storage:** 200 runs of history; scoring as in #30.
- **Free inputs:** Polymarket gamma (keyless; terms-review; World Monitor reports server-side Cloudflare blocking), Kalshi v2 (keyless per the WM forecast seeder; verify), and the OSIRIS feeds.
- **Backfillable?** From stored runs only.
- **OSIRIS today:** OI (`lib/oi/engine.ts`) runs multi-world actor simulations. It reads Polymarket and Manifold (`lib/oi/markets.ts`), bootstraps a quant baseline from price history (`lib/oi/quant.ts`) and pools worlds (`lib/oi/aggregate.ts`). It has no resolution ledger and no isotonic calibration for non-price questions.
- **Effort / value:** M / M. Worth taking: the resolution spec (hard vs judged), the Brier scorecard and the calibration gate.

### 33. Hotspot escalation score
- **Purpose:** a 1–5 level per named hotspot, mixing structural risk with live movement.
- **Method (WM):**
  - **Inputs:** news 35 %, the host country's CII 25 %, geo-convergence 25 %, and military assets within 200 km 15 %.
  - **Score:** mapped from 0–100 onto 1–5, then 0.30 × an editorial baseline (default 3) + 0.70 × the dynamic score.
  - **Trend:** 48 points of history (24 h at 30 min); a linear-regression slope beyond ±0.1 per interval.
  - **Activity levels:** under 3 matching articles low, 3–6 elevated, above 6 high.
  - **Status:** the emission function exists but nothing calls it.
- **Free inputs:** OSIRIS news, flights and AIS, and #1.
- **Backfillable?** No.
- **OSIRIS today:** `/api/conflicts` has anchored zones with live counts, but no score or trend.
- **Effort / value:** M / M.

### 34. Focal-point detection
- **Purpose:** find the entities that appear in *both* the news and the map signals.
- **Method (WM):**
  - **News part (0–40):** mentions (4 each, up to 20), velocity (up to 10), and match confidence × 10.
  - **Signal part (0–40):** 10 per signal type, 3 per signal (up to 15), and 5 per high-severity signal.
  - **Correlation bonus (0–20):** +10 for appearing in both, +5 when keywords match the signal type, +5 when related entities also have signals.
  - **Urgency:** critical above 70 or with 3+ types; elevated above 50 or with 2+ types.
  - **Entity matching:** word-boundary aliases, with confidence 1.0 for names, 0.85–0.95 for aliases and 0.7 for keywords.
- **Free inputs:** OSIRIS feeds.
- **Backfillable?** From stored data.
- **OSIRIS today:** `lib/alert-places.ts` geolocates reports via OSM, which is better than World Monitor's 217-hub gazetteer. There is no news × map cross-reference.
- **Effort / value:** M / M.

### 35. Prediction-market signals versus news
- **Purpose:** notice a market repricing a story the news isn't carrying.
- **Method (WM):**
  - **`prediction_leads_news`:** a Polymarket move of 5+ points between passes while the matched news activity is below 3. World Monitor notes this does not prove the market moved first.
  - **Market filtering:**
    - ranked by 24 h volume;
    - 100+ sports and entertainment exclusions;
    - a price away from 50 % or volume above $50k;
    - 40+ countries mapped to tag variants.
  - **Dedup:** 2 h.
  - **Declared but never emitted:** `news_leads_markets` and `sector_cascade`.
- **Free inputs:** Polymarket and Manifold (keyless).
- **Backfillable?** Polymarket price history yes.
- **OSIRIS today:** `lib/oi/markets.ts` reads both.
- **Effort / value:** M / M.

### 36. Headline importance scoring and clustering
- **Purpose:** rank news clusters by geopolitical weight.
- **Method (WM; three scorers coexist):**
  - **Same-story test (`_clustering.mjs`):**
    - two 512-dimension feature-hashed vectors per title: word tokens, bigrams and character 4-grams, with the second vector up-weighting capitalized tokens and numbers;
    - similarity is the minimum of the two cosines, with a threshold of 0.615 (tuned on labelled pairs);
    - a containment rescue at ≥ 90 % token overlap;
    - grouping by union-find over an inverted index.
    - The MCP doc still says "Jaccard"; that is the retired method.
  - **Insights score:**
    - +2.2 × the upstream importance score;
    - LLM threat level: critical 220, high 150, medium 80, low 20 (keyword-derived threat counts ×0.35);
    - tier bonus 35/20/8;
    - +12 per publisher family, up to 6;
    - +45 when entities are corroborated;
    - keyword families: violence 50 + 12 per match, military 40 + 10, unrest 35 + 9, flashpoint 30 + 8, diplomacy 35 + 9, crisis 15 + 5;
    - ×1.25 when a flashpoint co-occurs;
    - finance terms ×0.35;
    - recency weight down to ×0.5 over 16 h.
  - **Admission to the top 8:** ≥ 2 publisher families, or corroborated, or an alert, or a score above 100; at most 3 per source.
  - **Digest score:** 0.55 severity + 0.20 tier + 0.15 corroboration + 0.10 recency.
  - **Brief dedupe:** embeddings at cosine 0.60, falling back to Jaccard > 0.55.
- **Free inputs:** OSIRIS feeds. The LLM step is optional.
- **Backfillable?** From stored headlines.
- **OSIRIS today:** `lib/alert-digest.ts`, `/api/ai/briefing` and `/api/ai/overview`.
- **Effort / value:** S / L (for a map-first product).

### 37. Strategic risk roll-up
- **Purpose:** one global headline number.
- **Method (WM):**
  - **Server version:** the top-5 CII scores weighted 1.00/0.85/0.70/0.55/0.40, then × 0.70 + 15, which compresses the range to 15–85. High at 70 or more, medium at 40–69.
  - **Browser fallback:** convergence × 0.30 + CII × 0.50 + infrastructure × 0.20, plus capped boosts for theater (25), breaking news (15), sanctions (10) and radiation (12). Trend at ±3.
- **Free inputs:** see #38.
- **OSIRIS today:** none.
- **Effort / value:** S once #38 exists / L.

---

## Below 1.0

### 38. Country Instability Index, as a keyless "CII-lite"
- **Purpose:** a 0–100 per-country stress score with documented components, floors and a 24 h delta.
- **Method (WM v8):**
  - **Coverage:** 31 curated Tier-1 countries.
  - **Formula:** 0.40 × an editorial baseline (5–50) + 0.60 × an event score. The event score is unrest 25 %, conflict 30 %, security 20 % and information 25 %.
  - **Unrest:** counts are log-damped when a country's multiplier is below 0.7. Boosts for fatalities, for outages (total 30, major 15, partial 5) and for high-severity events (min(20, 10 × n × multiplier)).
  - **Conflict:**
    - battles ×3, explosions ×4 and civilian violence ×5, times the country multiplier (0.3 for the US up to 3.0 for North Korea);
    - log-scaled to at most 70, against a reference of 4,000;
    - fatalities on a square-root curve, up to 40;
    - civilian targeting min(10, 3n);
    - Iran strike boost min(50, 3 × strikes + 5 × high-severity strikes);
    - Israel OREF term 25 + 5 per alert, up to 50.
  - **Security:** flights 3 each (cap 50), vessels 5 each (cap 30), aviation (cap 40), GPS jamming (cap 35); foreign forces count ×2.
  - **Information:** headlines weighted critical 4, high 2, medium 1, low 0.5. The normalization of security and information is undocumented.
  - **Boosts:**
    - earthquakes and other hazards: earthquakes 25, displacement 20 (on a log ramp, 1M ≈ 12), climate 15, wildfires 8;
    - security-related: advisory 15, sanctions 14, cyber 12, AIS 10, news 5.
  - **Floors:**
    - UCDP war (more than 1,000 deaths or 100 events): 70;
    - UCDP minor conflict (more than 10 events): 50;
    - do-not-travel advisory: 60; reconsider: 50.
    - The UCDP window is documented as 2 years, but the seeders keep about 365 days.
  - **Bands:** ≤ 30 low, 31–50 normal, 51–65 elevated, 66–80 high, 81 or more critical.
  - **Trend:** the delta against a snapshot about 24 h old, with a ±1 dead band. "Unspecified" when no prior exists, kept separate from a measured zero.
  - **Degraded modes:** stale, then baseline-only, each flagged.
- **Free inputs:**
  - GDELT in place of ACLED (keyed, NC).
  - UCDP GED (CC BY per its download page; World Monitor's licence doc lists it as "pending"). World Monitor sends `UCDP_ACCESS_TOKEN` when one is set; whether the API answers without it needs checking. The annual and monthly Candidate CSVs are bulk downloads.
  - Already in hand or above: IODA, USGS, FIRMS, military ADS-B (licence caveat), advisories (#15), GPS jamming (#25).
  - HDX HAPI or UNHCR for displacement.
- **Backfillable?** Mostly.
- **OSIRIS today:** `/api/country-risk` and `lib/country-risk.ts`: an editorial base for 20 countries plus summed USGS M4.5+ magnitudes, honestly labelled `basis: 'editorial'`.
- **Effort / value:** L / M. Build it from #11, #15 and #24 rather than porting v8 whole. Keep the provenance per component.

---

## Low priority or skip

| Feature | Why low | Inputs / flags |
|---|---|---|
| Scenario engine: chokepoint closure → HS2 sector → country impact (exposure × disruption % × cost multiplier, top 20; tariff scenarios use a vulnerability index) | Country and sector scalars | UN Comtrade needs `COMTRADE_API_KEYS` (manifest) |
| Route Explorer lanes and bypass corridors | Mostly a workflow; the computation is a chokepoint lookup per lane | Comtrade plus a route graph |
| Country Resilience Index (≈196 countries, 72 indicators, 21 dimensions, 6 domains, 3 pillars; fixed goalposts; coverage-weighted means; imputation classes; min-pillar penalty α 0.5; 30-day trend) | Structural, annual, country-level | Mostly World Bank, WHO, UNHCR and OWID (keyless). BIS and GPI are NC. Comtrade, WTO and GIE need keys |
| Five-factor scorecard (food, energy, demographics, technology, defense; 1–5 bands; bloc aggregation) | Country-level annual | FAOSTAT, World Bank, OWID, WPP, ILOSTAT (keyless). SIPRI is restricted |
| Commodity supply vulnerability (0.45C + 0.25T + 0.20·C·T, with buffers) | Country × commodity scalars | Comtrade (key), USGS, PortWatch |
| Food stocks, mineral HHI, demographics, defense industrial base | Annual country tables | USDA PSD, FAOSTAT, USGS MCS, World Bank (keyless). SIPRI shares are restricted |
| Energy asset registries: pipelines, storage, disruption log with evidence bundles | Valuable geometry, but heavy editorial curation | GEM (form-gated, CC BY), OSM, ENTSOG (keyless), GIE AGSI+ (key) |
| Physical precious-metals divergence (Shanghai premium regimes) | Finance, not spatial | SGE scrape; COMEX via Yahoo (unofficial) |
| China activity nowcast (official release vs 7 proxy families; agreement/divergence states; vintages) | One country. The vintage pattern is folded into #5 | NBS, CCFI scrape, PortWatch |
| Pentagon Pizza Index (busyness ≥ 150 % of usual and ≥ 25 points above forecast, for 3 consecutive readings) | Novelty; paid or scraped data | BestTime (paid), PizzINT (terms-review) |
| News ↔ markets Pearson correlation with a ±6 h lag scan; "move explained" vs "silent divergence" (≥ 2 % moves; entity alias/keyword/related confidence 95/70/60); flow and price divergence | Finance, not spatial | GDELT DOC, Yahoo (terms-review) |
| Fixed theater threshold rules for VIX, commodity shocks, S&P stress, freight rates (> mean + 2σ), regulatory actions | Finance | Yahoo, FRED CSV, regulator RSS |
| OREF siren integration (Israel) | Geo-blocked; needs an Israeli residential proxy | `oref.org.il` |
| 217-hub gazetteer geolocation, "negative-match" country attribution | OSIRIS's `lib/alert-places.ts` already does better | — |
| AI deduction and world brief | OSIRIS OI is already deeper | LLM keys |
| Day/night solar terminator | Pure computation, a display layer (on OSIRIS's TODO) | none |

---

## Reusable patterns (worth adopting regardless of feature)

1. **Missing is never zero.**
   - Explicit state enums: ok, stale, insufficient, missing input; observed, imputed, not applicable, source failure.
   - A per-input freshness budget, and a reason recorded for every input left out.
   - No forward-fill and no interpolation.
   - Imputation classes keep apart three cases: absent from a global list (probably calm), absent from a partial list (unknown), and source down.
2. **Self-baselining with minimum-history gates.**
   - Gates seen: 7 days vs ~90 (flow), 7 vs 30 (transit drop), a 7-day cell baseline (thermal), 168 readings (radiation), 250 points robust (metals), and a delta against 24 h ago (CII).
   - Each has explicit history minimums and "thin baseline" floors.
3. **Hybrid absolute and relative regimes.** Take the worse of an absolute threshold and a percentile ladder, with a minimum magnitude before the ladder applies, and keep the index monotonic with regime floors.
4. **Saturation guards.** Per-term caps on additive boosts; log or square-root curves for counts and fatalities; per-capita rates with a population floor; half-life decay on bursts; external floors (UCDP, advisories).
5. **Importance apart from credibility apart from confidence.** Corroboration counts distinct publisher families, not articles.
6. **Publication hygiene.**
   - Keep the last good value, flagged as retained, with its original timestamp.
   - Never replace a richer snapshot with a thinner one.
   - A composite takes the oldest source time as its own.
   - A durable activation marker for health checks.
7. **Versioning and validation.**
   - A methodology version on every response, bumped on any coefficient change.
   - Matched-pair and cohort gates that catch ranking inversions.
   - Leave-one-out sensitivity, Monte Carlo weight bands, and hand-checked fixtures.
