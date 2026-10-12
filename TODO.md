# TODO

Goal: one source for all public data, built in public, with a free and a paid version.
Positioning: an open-source Palantir alternative for public data.
Docs: `ARCHITECTURE.md` (design), `DATA-SOURCES.md` (sources), `INSPIRATION.md` (projects to learn from).

## 1. Decisions (blocking)

- [ ] **Name.** Keep TAKIP or pick a new one. Check the domain, GitHub org, npm, X handle and trademark.
- [ ] **Rebuild vs refactor in place, or start from World Monitor** (AGPL; see `INSPIRATION.md`). Decide after the code review and the World Monitor scoop (§2).
- [ ] **License for the open core.** Options:
  - AGPL-3.0 plus a commercial license. World Monitor and Provenance both use this, and it would let us reuse their code. World Monitor shows AGPL code and a paid hosted service working together.
  - MIT.
  - FSL/BSL.

  Ported upstream code keeps its MIT notice in `LICENSE`.
- [ ] **Positioning against World Monitor** (about 88,000 stars, with free and paid tiers already). Pick what we do that it doesn't; candidates are in `INSPIRATION.md`.
- [ ] **Free vs paid split** (draft in §5).
- [ ] **Satalite view can show day/night view!
- [ ] **When the repo goes public.** Only after §2, §3 and §7 are done.
- [ ] **"Palantir alternative" wording.** Use it only as a comparison; no Palantir name or marks in the product name or logo.
- [ ] **Raw archive from day one, or wait for phase 2?** Live feeds can't be backfilled. See `ARCHITECTURE.md`, "Build order". Leaning yes: start saving now (§6, "Saving data").

## 2. Code review (read-only)

Output: one report with P0–P3 findings, a keep/rewrite/delete verdict per module, and a refactor vs rebuild recommendation.

- [ ] **Security and API boundary**
  - [ ] Check for SSRF in every route that fetches a URL: `cctv/proxy`, `proxy-tiles`, `arcgis`, `cctv/resolve`, `cctv/stream-status`, `cctv/frame`, `entity/expand`, `osint/*`.
  - [ ] Check auth on `sdk/ingest`, `github-webhook`, `mcp`, `oi/*` and `ai/*`.
  - [ ] Check whether anonymous users can burn the server's Gemini keys, and whether rate limits exist.
  - [ ] Check `innerHTML` interpolation in the map popups (`OsirisMap.tsx`) for XSS.
  - [ ] Check how bring-your-own API keys are handled, and the CSP and CORS settings.
  - [ ] Review `nginx/nginx.conf` and `intel/server.js`.
- [ ] **Architecture and maintainability**
  - [ ] Review /src/components, use kebab  case and have a better improved engine. The codebase is scattered. Interface is poor. Features need to be revised and improved. Draw feature can be the hitting.
  - [ ] Break up the god files: `OsirisMap.tsx` (3,490 lines), `page.tsx` (2,364), `OsintPanel.tsx` (1,653), `cctv/route.ts` (1,068).
  - [ ] Replace the `dataRef` + `dataVersion` global state pattern.
  - [ ] Reduce `any` and `eslint-disable` usage.
  - [ ] Find a shared contract for the ~52 duplicated CCTV adapters.
  - [ ] Check for dead code: `lib/sdk` (Polybolos/Lattice), `intel/`, `engine/__pycache__`.
  - [ ] Find static data that is presented as live (conflict zones, ports).
  - [ ] Decide whether `lib/sdk/types.ts` or `intel/` is a usable base for a unified entity model.
- [ ] **Data sources and licensing.** Inventory every external endpoint: provider, keyed or keyless, live or static, and whether commercial use is allowed. Verify these first:
  - [ ] Flights: OpenSky, adsb.lol, adsb.fi, adsbdb.
  - [ ] OpenSanctions. The README says CC BY 4.0; it may be CC BY-NC.
  - [ ] Yahoo Finance.
  - [ ] Camera and video embeds: Skyline, EarthCam, Windy, YouTube. Also re-hosting their images through `cctv/proxy`.
  - [ ] Nominatim and the OSM tile servers.
  - [ ] Terms of each 511 portal.
  - [ ] Telegram `t.me/s` scraping.
  - [ ] Cyber sources: Hudson Rock, Shodan, abuse.ch, Cloudflare Radar.
  - [ ] DeepState map.
  - [ ] Weather: Open-Meteo's free API is non-commercial only, so the paid product needs one of their API plans. RainViewer: free tiles stop at zoom 7; check its commercial terms.
  - [ ] aisstream.io: redistribution and commercial use.
- [ ] **Delivery, dependencies, tests and lifecycle**
  - [ ] CI only publishes the Docker image; it has no lint, typecheck or test gate.
  - [ ] Docker has no volume, so `.cache/` is lost on every rebuild.
  - [ ] `deploy.sh` runs `git add -A` and has the server address hardcoded.
  - [ ] Find unused dependencies and run `npm audit`.
  - [ ] Bound the in-memory caches.
  - [ ] Review the semantics of `/api/health`.
  - [ ] Replace `[OSIRIS] console.*` with structured logging.
- [ ] **Scoop World Monitor** (koala73/worldmonitor; notes in `INSPIRATION.md`)
  - [ ] Run it locally (`npm install && npm run dev`, no keys needed) and go through every layer, panel and variant.
  - [ ] Read their `ARCHITECTURE.md`, `docs/algorithms.mdx` and `docs/data-sources.mdx`. The last lists licence posture per source.
  - [ ] Check what "intel memory" stores: news only, or tracks and sensor data too.
  - [ ] Check the size and sources of their webcam grid against our 46,500 cameras.
  - [ ] List their sources we lack, with the licence posture of each.
  - [ ] Study the infrastructure cascade model and the Country Instability Index for our dependency map and analysis phase.
  - [ ] Try the MCP server, CLI and API to see how they gate free vs paid.
  - [ ] Compare features with our roadmap and write down where we differ.
  - [ ] Decide whether to reuse their code. That requires AGPL (§1).

## 3. Known issues (found so far)

- [ ] `OSIRIS_CCTV_SNAPSHOT=off` turns off reading the snapshot but not writing it, so the catalogue is saved to a file literally named `off` (`src/lib/cctv-snapshot.ts`). Delete the stray `off` file.
- [ ] Two tests also fail on upstream `83b8cd1`:
  - [ ] `src/lib/oi/context.test.ts`: "carries on without a source that fails"
  - [ ] `src/app/api/cctv/route.test.ts`: "serves an already-cached region without going upstream again"
- [ ] The README says 17,000+ cameras; the catalogue has 46.5k.
- [ ] `docker-publish.yml` runs on every push to `master`, which uses Actions minutes and publishes to GHCR.
- [ ] Quick fixes from `CCTV-handoff.md` §8: opentopia cameras, HK duplicates, reused ids, `us-central`, the Kansas box, MassDOT, Caltrans HLS.
- [ ] Key docs are out of date (`.env.example`, README, DOCKER.md, `apiCatalog.ts`, `DocsClient.tsx`):
  - [ ] They say the AIS and OpenSky keys are unused; both are read.
  - [ ] FIRMS and N2YO keys are listed but never read.
  - [ ] Etherscan and Helius keys are read but change nothing.
  - [ ] The Gemini "bring your own key" option has no UI.
- [ ] `/api/air-quality` calls OpenAQ v2, which may have been retired (unverified).

## 4. Rebrand (after §1)

- [x] Display text renamed OSIRIS → TAKIP: UI, metadata, AI prompts.
- [ ] Docs: README, DOCKER.md, SECURITY.md, `.env.example`.
- [ ] Config: `package.json` name, `docker-compose.yml` (service names, CasaOS metadata), `deploy.sh`.
- [ ] Env vars `OSIRIS_*` → new prefix, reading the old names as a fallback.
- [ ] Storage keys `osiris.*`: migrate them so users keep their settings.
- [ ] Identifiers: `OsirisMap`, `window.osirisWatchFlight`, terrain source ids, the AOI export filename, the `[OSIRIS]` log prefix.
- [ ] User-Agent strings `OSIRIS/5.0 (+https://osirisai.live)`: switch to our own domain and contact.
- [ ] Assets: logo SVG, splash, favicons, `og-image`, CasaOS icon.
- [ ] Links: `SITE_URL`, `@simplifaisoul` handles, Patreon, Discord, Merch.
- [ ] Credit upstream in the README and `LICENSE`; don't claim their work.
- [ ] Layout redesign, moving away from the military HUD look.

## 5. Product: free vs paid (draft)

- **Free:** the map and every public layer, AI with your own key, a rate-limited API and MCP server, self-hosting.
- **Paid:**
  - Alerts on watched areas and assets (email, Slack, webhook).
  - A historical archive of public data.
  - Higher API quotas.
  - Team workspaces.
  - Connecting your own data and linking it to public entities.
  - Reports.
  - SSO.
- [ ] Accounts, auth, Stripe billing, usage metering.

## 6. Data platform: one source for all public data

Design: `ARCHITECTURE.md`. Sources: `DATA-SOURCES.md`.

### Backend layer

Today every feed runs inside the Next.js web process. The AIS WebSocket and every cache live in `globalThis`: they are lost on each restart, can't be shared between replicas, and each user's request can spend upstream quota. The backend takes collecting and serving data out of the request path.

- [ ] An always-on ingest service, separate from the web app. One connector per upstream (AIS, OpenSky, Open-Meteo, RainViewer, Cloudflare Radar, …) writes observations to the stream (phase 1); routes read from it instead of calling upstreams.
- [ ] Serve users only through our own API:
  - [ ] Accounts and auth on every data route.
  - [ ] Per-user rate limits and quotas.
  - [ ] Usage metering (§5).
- [ ] Keep upstream keys server-side, spent once per refresh rather than once per user.
- [ ] Push live layers (ships, flights) to subscribers by viewport and filter, replacing the 10 s full-snapshot polling.
- [ ] Choose the stack and hosting once the cost analysis below is done.

### Saving data

- [ ] Start the raw archive now (§1): compressed NDJSON, one file per source per hour. AIS, flights and the weather grid first.
- [ ] Choose a sampling rate per feed before storing positions: e.g. one fix per vessel or aircraft per minute, the weather grid hourly. Rough size for ships alone: ~18k × 1/min ≈ 26M rows/day.
- [ ] Storage path: files and SQLite first. Move to Postgres with PostGIS or TimescaleDB, or Parquet in object storage, once volume needs it.

### Cost and capacity

Measured locally on 11 Oct 2026 (one dev server, one tab):

| Feed | Upstream | What we send the browser |
|---|---|---|
| AIS (aisstream.io, whole globe) | ~90 msg/s, ~48 KB/s in (~4 GB/day) | `/api/maritime`: ~2.9 MB of JSON per 10 s poll, per tab; ~18k ships |
| Flights (OpenSky account + adsb.fi) | 4,000 OpenSky credits/day, one call per 90 s | `/api/flights`: ~3.1 MB per poll; ~11.6k aircraft |
| Open-Meteo grid (510 points) | ~4,000 of the 10,000 free calls/day | `/api/weather-grid`: ~52 KB |
| RainViewer radar | Free, tiles up to zoom 7 | Nothing: the browser loads the tiles from RainViewer |
| Cloudflare Radar | Free token | Small |

- [ ] Measure egress per active user per hour for typical layer sets, with gzip on.
- [ ] Estimate storage per day for each feed at the chosen sampling, and how it grows with retention.
- [ ] Price compute, storage and egress for 10, 100 and 1,000 concurrent users on two or three hosting options. Turn that into a cost per user for the free/paid split (§5).
- [ ] Shrink payloads before scaling: filter by viewport and vessel type on the server, use a compact encoding, serve vector tiles.
- [ ] Track upstream quota use per key and alert before a limit is reached.

### Phase 1: Live (streaming)

- [ ] Fix the entity model and the observation format before writing any connector.
- [ ] A connector interface: fetch or subscribe → normalize → observations onto a stream. Idempotent.
- [ ] A source registry recording each source's licence, commercial use, auth and limits. Sources that don't allow commercial use stay out of the paid product.
- [ ] A live API using server-sent events or WebSockets, plus current-state tiles. The map subscribes to it.
- [ ] First streaming connectors:
  - [ ] Digitraffic: ships and trains (MQTT).
  - [ ] Wikipedia EventStreams.
  - [ ] NWS / NHC alerts.
  - [ ] Existing flights.
- [ ] Reference loaders: OurAirports, Natural Earth, World Port Index, Wikidata.
- [ ] Critical infrastructure and military installation layers (`DATA-SOURCES.md`).
- [ ] Current-state store for the camera catalogue, from `CCTV-handoff.md`:
  - [ ] SQLite.
  - [ ] An ingest job outside the request path.
  - [ ] Vector tiles served by zoom level.
  - [ ] Deduplication, admission rules and a health checker.
- [ ] Add the rest of `DATA-SOURCES.md`, starting with "Add these first", after verifying each one's licence.

### Phase 2: History

- [ ] An append-only observation store following the rules in `ARCHITECTURE.md`.
- [ ] Retention per data type.

### Phase 3: Analysis

- [ ] Replay, density and trend maps, event correlation, anomaly detection, impact analysis.
- [ ] The dependency map over infrastructure.

### Satellite object detection (investigate)

Idea, existing pieces and constraints: `docs/brain-storming.md` §6. A small model runs in the user's browser on the satellite view and marks aircraft, ships, tanks and vehicles. Users confirm or correct the marks. Detections and corrections are saved, so each use improves the dataset and the next model.

- [ ] **Imagery licence (blocking).** Can we run detection on it, store the results and train on it? Check Esri World Imagery (the current SAT view; Esri Master License Agreement), NAIP, Sentinel-2 (`/api/sentinel` already searches it) and OpenAerialMap.
- [ ] **Model and dataset licences.** Shortlist an aerial detector and dataset that allow commercial use: DOTA, xView (likely non-commercial), DIOR, SpaceNet. Ultralytics YOLO is AGPL-3.0.
- [ ] **Spike: aircraft at a few airports**, reusing camera vision (`src/lib/vision/`: worker, onnxruntime-web, overlay). Measure precision and recall against hand labels, and per-tile latency with WebGPU vs WASM.
- [ ] **Data and feedback design.** No AI output is stored or rated anywhere today. Design:
  - the detection record: tile, imagery date, class, box, confidence, model version;
  - opt-in;
  - vetting and dedup rules for user corrections;
  - the store, on top of the SQLite/Postgres move.
- [ ] **Hooks into existing AI.** Give OI Assist a `satellite` tool next to `camera`. Make detections a cited evidence source in OI Forecast.
- [ ] **Scope.** Decide which classes and areas are off-limits: military sites, people.

## 7. Scope cuts and risk

- [ ] Decide whether to remove or quarantine the people-search and breach tools:
  - [ ] Username, phone and fingerprint search.
  - [ ] `leaks` and Hudson Rock infostealer lookups.
  - [ ] Shodan.
  - [ ] Port scanner.
- [ ] Never import other people's camera snapshots. Keep the privacy blocklist from `CCTV-handoff.md` §5.

## 8. Build in public

- [ ] Before going public:
  - [ ] Scan git history for secrets (gitleaks).
  - [ ] Rotate the AIS, Cloudflare and OpenSky keys that were pasted into chat sessions.
  - [ ] Settle the license (§1).
  - [ ] Rewrite the README.
  - [ ] Add CONTRIBUTING, CODE_OF_CONDUCT, a SECURITY contact and issue templates.
- [ ] CI that gates on lint, typecheck and tests; publish Docker images to our own GHCR.
- [ ] Domain, landing page, X and Discord. A public roadmap (this file) and a changelog.
