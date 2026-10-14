# Roadmap

Open work only. Merged on 2026-10-13 from the old `TODO.md` and `BACKEND-handoff.md`, then reordered with the user the same day around what TAKIP is for now: a personal tool, with the release decision open. Delete items once they're done; don't tick them. The backend build log (what was built, the user's answers, working rules) is [`architecture/backend-log.md`](architecture/backend-log.md). Data research with its own fix lists: [`architecture/data-roadmap.md`](architecture/data-roadmap.md) and [`architecture/map-detail.md`](architecture/map-detail.md); this file sets the order.

## Decided

Older docs cite these by pointing at this file.

- **Personal use for now.** Whether TAKIP goes public is open (§3). Until it's answered, the work in §5 is frozen: kept working, not extended.
- **Focus:** wars and history first, then flights and ships, then weather and disasters. Space and cameras are parked (§6); no new camera regions.
- **A good database without storing a lot:** record what upstreams forget, and only when it changes; fetch on demand what upstreams keep (`architecture/replay-database.md` §7.8); keep the curated data (events, borders, series, coarse tracks) forever; delete raw files and fine track detail after a retention period (§3).
- **Refactor in place, not a rebuild:** the monorepo in `apps/` and `packages/` (`architecture/backend.md`). No World Monitor fork.
- **Raw archive from day one:** `data/archive/` (`architecture/replay-database.md` §7.1), with a retention period (1.3).
- **Recon and people-search tools:** kept, behind an account, with per-account limits by family (`src/lib/recon/gate.ts`): breach 20 an hour, people 30 an hour, scan 30 an hour, network 15 a minute, reference 30 a minute.
- **Hosted AI:** gated behind `ai.hosted` (on for `pro`); bring-your-own key stays free. The other product answers are in `architecture/backend-log.md` §6.

## 1. Action items

In order. "(you)" marks the user's own steps.

### 1.1 History you can trust, wars first
The history data has known wrong placements and unlinked duplicates (`architecture/data-roadmap.md` §4).
1. GTD `eventid` is Excel-mangled (`1.97E+11`), so it can't join a fresh START copy or Wikidata P4089.
2. Wikipedia references for the rest (`architecture/dataset-import-map.md` §6): GTD attacks through P4089 once 1 lands; ICOW claims in other languages, which first needs each claim's Wikidata item; the 10 UCDP conflicts and COW war 60 left blank.

### 1.2 Fix-it pass, Route first
The user hit Route problems ("not all locations show up straight") and remembers other issues all over without specifics.
1. (you) Write down three Route failures: what you typed, what you expected, what you got.
2. Diagnose Route against them. Directions go through public demo servers (`router.project-osrm.org`, `valhalla1.openstreetmap.de`; `apps/api/src/v1/directions/`) that rate-limit and drop requests; place search is Photon (`photon.komoot.io`, `apps/api/src/v1/geo/geocoders.ts`).
3. Walk every tool in a browser (Layers, Alerts, Areas, History, Replay, Space, Route, Recon, ArcGIS, TI, Markets, and phone width) and log each problem in §4.
4. Satellites catalogued since 2026-07-11 are missing: CelesTrak ran out of 5-digit catalog numbers and TLE text can't carry the new ones. Fetch `FORMAT=json` (OMM) instead of `FORMAT=tle` (`src/app/api/satellites/celestrak.ts:18`), parse it with satellite.js `json2satrec` (`packages/connectors/src/orbit.ts`), store OMM in `tle.db`, and keep the TLE parser for the SatNOGS fallback (data-roadmap §0).
5. Fix what §4 collects, in one batch.

### 1.3 Record around the clock, with cleanup
Replay has tracks only for 11–12 Oct 2026: nothing has been sealed since, because `npm run dev` doesn't start the worker. Raw files still land (~0.5 GB a day, ships ~400 MB of it) and nothing deletes them.
1. (you) Start the recorder: `npm start -w @takip/ingest`. Decide whether `npm run dev` (`tools/dev.mjs`) should start it too.
2. (you) `npm run plan -- grant <your email> pro`. Replay looks back by plan (`replay.lookback_days`: anon 1, free 7, pro 3650), so signed out it hides your own recordings.
3. Complete the Docker setup so TAKIP runs on a NUC, a cloud server or any machine left on. `docker-compose.yml` runs only the web app, nginx and `intel` today:
   - an api image (a tsup bundle or `tsx`), and an `api` service with `API_INTERNAL_URL=http://api:4100` at web build time;
   - an `ingest` service for the recorder;
   - volumes for `data/db` (`history.db` alone is 615 MB), `data/archive`, `data/backups` and `.cache/` (the camera catalogue, lost on every rebuild today);
   - its own OpenSky API client (`OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET`): one client per environment (`architecture/replay-database.md` §7.1).
4. `/api/v1/satellites/orbit` reads the TLE cache the web app writes (`.next/cache/satellites-tle-cache.json`). Switch it to ingest's TLE before the api runs in its own container.
5. Client level fallback: draw the next coarser level when a finer bucket is missing. Without it an evicted L0 hour shows nothing from zoom 8, so this comes before step 6.
6. Retention jobs: `cool-shards` and `prune-raw` (cold L0 3 months, L1 90 days, L2 forever, raw files per §3), and dropping a backfilled day's archive and L0 once it is indexed.
7. `recordIfChanged`: the recorder hashes every body (`packages/archive/src/recorder.ts`) but never compares the hashes. Then record the feeds whose upstream keeps no history: FAA airport status, war alerts, NWS and WMO alerts, SWPC, FIRMS (data-roadmap §1 #4; don't record IODA or liveuamap).
8. Choose a sampling rate per feed before storing more positions (ships alone: ~18k × 1/min ≈ 26M rows a day).

### 1.4 Flights and ships done well
Needs 1.3.
1. Fix the adsb.lol history CLI (`apps/ingest/src/backfill/adsblol-history.ts`): accept plain `.tar` releases (505 in 2023, 124 in 2024), try the `prod-1` variant, and look in both years' repos around New Year (data-roadmap §0).
2. Index the backfilled day: `npm run ingest -- backfill adsblol-history 2026-10-11 --index-only` (streams 3.2 GB again).
3. Run adsb.lol daily history as a scheduled worker job. A day holds ~55k aircraft against ~17k from live polling, fills our own outages, and takes load off OpenSky, which uses ~75% of its daily credits.
4. Add the missing aircraft types to `TYPE_BATCHES` (`src/app/api/flights/adsb-lol.ts`): the batches reach 13,956 of 18,064 aircraft. Missing: E75L 347, E145 48, AT75 32, S92 29, E545 28, H25B 27, DHC6 24.
5. Trace route in `apps/api` (through the backend lead): one aircraft's full trace for a day as TRK1, cached; then clicking a replayed aircraft draws it.
6. A second ship source: Digitraffic AIS (data-roadmap §1 #6). AISStream allows 3 open connections, has no SLA, and reconnected 3 times in one hour.
7. Days built on demand: `202 building` with `Retry-After` from the chunk route while the worker streams a release, one build per day; the timeline marks such days as fetchable.

### 1.5 Finish the half-built pieces

**Mount the workspaces chip (saved views).** The workspaces api, client library and UI have landed; the chip isn't mounted (`WorkspaceHost`/`WorkspaceChip` appear nowhere in the shell).
1. `src/app/page.tsx`: `<WorkspaceHost />` (from `@/components/workspaces/workspace-host`), right after `<AccountDialog />`.
2. Desktop, `search-spotlight.tsx`: `<WorkspaceChip />` beside `<SearchTrigger>` in one flex row, at the trigger's current position and width.
3. Phone, `mobile-shell.tsx`: after `<AppHeader … isMobile />`, add `<div data-hud className="absolute top-4 right-4 z-[210]"><WorkspaceChip align="right" /></div>`.
4. Register the map state in `page.tsx` with `useWorkspacePart` (from `@/components/workspaces/use-workspace`; adapters in `@/lib/workspaces/adapters`):
   - `basemap`: `mapStyle`/`mapProjection`.
   - `layers`: `activeLayers`, set with `layersOver`.
   - `viewport`: `mapCenter` and `mapView.zoom`, set through `setFlyToLocation`.
   - `areas`: `areas.drawnPolygons`, through `storedAreas`/`areasFrom`.
   - `tool`: `activeTool`/`openTool`.
   - `time`: needs `useReplay` to expose `openAt(t)`, `close()` and an `anchor` that changes only on open, seek or pause.
5. Skip `useStartup`'s IP auto-locate when `localStorage['takip.workspaces.current']` is set.
6. Plan copy: add `'workspaces.max', 'workspaces.share'` to `BUILT` in `src/components/site/account/settings/plan-highlights.ts`, and rewrite its "leaves out saved workspaces" test.
7. Browser check: signed out ("Save view"); autosave states; a conflict from a second tab; share, rotate and revoke; `/w/<slug>?t=`; the one-time import; phone width.

**Finish the region-dossier switch.** `GET /api/v1/region-dossier` has landed and matches the legacy route in parity tests, but `use-region-dossier.ts` still calls `/api/region-dossier`.
- Add `{ source: '/api/region-dossier', destination: \`${api}/api/v1/region-dossier\` }` to `next.config.ts` (a mixed-CRLF file), or point `use-region-dossier.ts` at `/api/v1/region-dossier`.
- Delete `src/app/api/region-dossier/` and `apps/api/src/v1/testing/legacy.ts`. Turn the parity cases into contract tests, move the old unit tests to `v1/region-dossier/{place,wikidata}.test.ts`, and update `src/components/site/docs/api-catalog.ts`.

**Make CI green.**
- `src/lib/oi/context.test.ts` "carries on without a source that fails" fails: the one failure in `npm test` (checked 2026-10-13; 3,353 pass).
- Lint is scoped to `apps packages tools`. Widen it as the web app's lint errors are cleared.

## 2. After the action items

- **Weather and disasters** (data-roadmap §1): FIRMS NOAA-20 and NOAA-21 fire files next to S-NPP and MODIS (`src/app/api/fires/route.ts`); the GDACS API with polygons, and USGS volcano alert levels; aviationweather.gov international SIGMETs (including volcanic ash) and METARs; the EMSC earthquake WebSocket; NWS / NHC alerts into ingest; MeteoAlarm; river levels and flood warnings; tsunami.gov CAP.
- **More history** (data-roadmap §2): IBTrACS cyclone tracks; fix the timeline rebuild (it redoes the whole quake family on every load), then backfill USGS ComCat at M4.5+ and re-run `noaa-hazards --force`; the GDACS archive and NOAA Storm Events.
- **More history on demand:** GDELT raw files, FIRMS, ERA5, and OpenSky `/tracks/all` for the last 30 days.
- **GDELT stories:** the live layer works; the ingest connector and history wait on §3.4 (`architecture/gdelt.md`).

## 3. Decisions waiting on the user

1. **Personal or public,** and when to decide (suggested: after §1). The answer unfreezes or drops §5. The name follows from it: TAKIP is the working name and `https://takip.example` the placeholder. "Takip" is an everyday Turkish word (crowded search results, hard to get a domain), and in Turkish it can also mean following a person.
2. **Where it runs and how the phone reaches it:** a NUC, a cloud server, or the Mac left on; reached privately (Tailscale, your devices only) or at a public address. A public address needs the hosting and security work in §5 first.
3. **How long to keep data, and a disk budget.** Proposed: fine track detail (L0) 3 months, L1 90 days, L2 forever. How long raw files are kept is open.
4. **History:** whether the plan lookback limit applies to History at all (recommended: no, for personal use); and GDELT history as one entry per story per day, or news intensity per country (`architecture/gdelt.md`).
5. **Cameras as their own product:** later.

## 4. Known issues

The fix-it pass (1.2) adds to this list.
- A war's History popup lists 8 of its battles in relation order, not the first 8 by date: `GET /api/replay/history/events/:id` returns relations as bare ids (`event()` in `packages/db/src/sqlite/event-store.ts`), so ordering needs the other event's date in the response.
- Key docs disagree with the code (`.env.example`, README, `self-hosting.md`, `api-catalog.ts`, `docs-client.tsx`): they say the AIS and OpenSky keys are unused (both are read); FIRMS and N2YO keys are listed but never read; Etherscan and Helius keys are read but change nothing; the Gemini bring-your-own-key option has no UI.
- Static data presented as live: conflict zones, ports and chokepoints.
- Region dossier: a failed data.police.uk lookup reads as "no data", and missing `lat`/`lng` isn't refused (kept for parity).
- Rebrand leftovers: the `SITE_URL` placeholder, the `@simplifaisoul` handles in `src/app/layout.tsx`, the upstream Ko-fi link in `more-menu.tsx`, Discord.

## 5. Parked until the release decision

Built or designed for other people using TAKIP. Frozen until §3.1 is answered.

### Hosting in public
- Cloudflare Tunnel or nginx with TLS.
- nginx routing `/api/{auth,v1,admin,billing,replay}` to the api with a proper `X-Forwarded-For`, plus `TRUSTED_PROXIES`. Until nginx is in front, a client of `npm run dev` or of the web image can choose the api's view of its IP.
- Litestream with a bucket; nginx caching sealed replay chunks.

### Accounts, billing and email
- **Billing provider and legal entity:** the real adapter behind `apps/api/src/billing/`:
  - register it, with its keys and webhook secret in `env.ts`;
  - map its events to the three `BillingEvent` types and its statuses to ours;
  - pass the user id through checkout metadata;
  - verify signatures over the raw body, with a timestamp tolerance;
  - `fetchSubscription` returns canceled/expired rather than throwing;
  - time out every provider call;
  - re-fetch state on each event, because deliveries arrive out of order;
  - price ids go in `bill_plan.prices[provider].{monthly,yearly}`;
  - an "Upgrade" action in the Plan section, a way to set `bill_plan.prices`, reconciliation that lists subscriptions by customer (so a lost first webhook is caught), and rate limits on checkout and portal.
- **Email provider:** `SMTP_URL` and `MAIL_FROM` are required in production. Shutdown waits for in-flight mail, so a hung SMTP connection delays SIGTERM until nodemailer's timeout.
- **Privacy text:** rewrite [`privacy-draft.md`](privacy-draft.md) (14 `TODO(user)`) into `/privacy` before accounts launch.
- **Free vs paid (draft).** Free: the map and every public layer, AI with your own key, a rate-limited API and MCP server, self-hosting. Paid: alerts on watched areas and assets (email, Slack, webhook); a historical archive of public data; higher API quotas; team workspaces; connecting your own data and linking it to public entities; reports; SSO. Accounts, plans, entitlements and usage metering are built.
- **Key scopes:** OSINT can't check scopes because `me/access` doesn't expose them (add an `osint` scope); workspaces refuse scoped keys (add a workspaces scope).
- **Workspaces:** the state schema exists twice (`apps/api/src/workspaces/state.ts`, `src/lib/workspaces/state.ts`; move it to `packages/core`); nothing purges soft-deleted rows; a share link survives a plan that loses `workspaces.share`; closing a tab saves only states under ~60 KB.
- **Impersonation:** an expired window isn't audited and leaves the admin signed out; the "30 minutes" in the copy isn't read from `IMPERSONATION_S`; `impersonation-guard.ts` relies on a Better Auth internal, so re-check it on upgrades.
- **Usage:** response bytes are counted only when `Content-Length` is set; replay chunks aren't metered in bytes.
- **Still to check in a browser:** the Keys and Usage admin pages (404 until `npm run dev` restarts); the impersonation banner at phone width; the recon "Sign in to use recon tools" notice; the delete-account refusal while a paid subscription is active.

### Legacy routes still in the web app (`architecture/backend.md` §13)
- **Live feeds** (flights, maritime, satellites, cctv, quakes, fires, weather, news and so on): fetching moves to `apps/ingest` connectors, serving to `/api/v1` and a live API (SSE or WebSockets) that pushes ships and flights by viewport, replacing the 10 s full-snapshot polling.
- **Media proxies** (cctv proxy, frame, resolve, stream-status): move to the api as a closed proxy that takes ids, never URLs.
- **AI and OI** (`ai/*`, `oi/*`, `mcp`): move to the api. Drop the deprecated `Authorization: Bearer <model key>` form one release after the change.
- **OSINT and recon** (`osint/*`): move to the api.
- **Platform** (`sdk/ingest`, `sdk/stream`, `github-webhook`, `health`, `stats`, `reference`): move to the api. `sdk/ingest` should take API keys with a `write:entities` scope instead of `SDK_INGEST_KEY`.

### Security
- Review every route that fetches a URL, for SSRF: `cctv/proxy`, `arcgis`, `cctv/resolve`, `cctv/stream-status`, `cctv/frame`, `entity/expand`, `osint/*`. The closed media proxy removes the largest surface.
- Check auth on `sdk/ingest`, `github-webhook`, `mcp` and `oi/*`.
- Check `innerHTML` interpolation in the map popups (`src/lib/map/popups/layer-popups.ts`) for XSS.
- Review how bring-your-own API keys are handled, and the CSP and CORS settings; review `nginx/nginx.conf` and `intel/server.js`.
- Recon leftovers: the sweep's own limiter keys on a header the client writes, and several OSINT routes share one bare-IP bucket.
- `stealthFetch` still sends fake browser user agents and `X-Forwarded-For` for about 60 CCTV adapters and `/api/{conflicts,gdelt,weather}`. The aviation lookups are already honest; the CCTV owners decide the rest.

### Cost and capacity
Measured locally on 11 Oct 2026 (one dev server, one tab):

| Feed | Upstream | What we send the browser |
|---|---|---|
| AIS (aisstream.io, whole globe) | ~90 msg/s, ~48 KB/s in (~4 GB/day) | `/api/maritime`: ~2.9 MB of JSON per 10 s poll, per tab; ~18k ships |
| Flights (OpenSky account + adsb.fi) | 4,000 OpenSky credits/day, one call per 90 s | `/api/flights`: ~3.1 MB per poll; ~11.6k aircraft |
| Open-Meteo grid (510 points) | ~4,000 of the 10,000 free calls/day | `/api/weather-grid`: ~52 KB |
| RainViewer radar | Free, tiles up to zoom 7 | Nothing: the browser loads the tiles from RainViewer |
| Cloudflare Radar | Free token | Small |

- Measure egress per active user per hour for typical layer sets, with gzip on.
- Estimate storage per day for each feed at the chosen sampling, and how it grows with retention.
- Price compute, storage and egress for 10, 100 and 1,000 concurrent users on two or three hosting options, and turn that into a cost per user for the free/paid split.
- Shrink payloads before scaling: filter by viewport and vessel type on the server, use a compact encoding, serve vector tiles.
- Track upstream quota use per key and alert before a limit is reached.

### Launch
- **Licences:** not a concern while TAKIP is for personal use. Before a public or paid launch: pick the open-core licence (AGPL-3.0 plus commercial, MIT, or FSL/BSL; ported upstream code keeps its MIT notice), and check commercial terms for the sources flagged in `data-sources.md`, `architecture/data-roadmap.md` §3 and `architecture/map-detail.md` (OpenSky, OpenSanctions, Open-Meteo, aisstream.io, adsb.fi, GTD, COW, SIPRI, camera embeds and the `cctv/proxy` re-hosting, 511 portals, Telegram scraping, cyber sources, imagery).
- **Positioning against World Monitor** (free and paid tiers already); the survey is in [`inspiration-sources/`](inspiration-sources/README.md). Use "Palantir alternative" only as a comparison, never in the name or logo.
- Scan git history for secrets (gitleaks) and rotate the AIS, Cloudflare and OpenSky keys that were pasted into chat sessions.
- Rewrite the README; add CONTRIBUTING, CODE_OF_CONDUCT, a security contact and issue templates.
- Domain, landing page, X and Discord; a public roadmap (this file) and a changelog.
- Never import other people's camera snapshots; keep the privacy blocklist.

## 6. Parked

- **Space:** what is left in [`space-view.md`](space-view.md); Space-Track SATCAT, TLE history and the CelesTrak fallback (data-roadmap §1 #8, §2 #8); day and night on the satellite view (the `day_night` layer draws the terminator, `src/lib/basemap/solar-terminator.ts`; check how it reads over SAT imagery and whether night needs city lights). The missing-satellites fix stays in 1.2.
- **Cameras:** no new regions. Known fixes from the removed `CCTV-handoff.md` §8: opentopia cameras, HK duplicates, reused ids, `us-central`, the Kansas box, MassDOT, Caltrans HLS. The catalogue is still a JSON file (`.cache/cctv-catalog.json`); planned: a SQLite store, an ingest job outside the request path, vector tiles by zoom, deduplication, admission rules and a health checker.
- **Analysis:** density and trend maps, event correlation, anomaly detection, impact analysis (`architecture/README.md`, phase 3); the dependency map over infrastructure.
- **Bulk history:** adsb.lol `globe_history` 2023–26 beyond one day a week, NOAA MarineCadastre AIS, the FIRMS archive, the OpenHistoricalMap planet file (data-roadmap §2).
- **Live data outside the focus:** Digitraffic trains, Wikipedia EventStreams, GTFS-RT vehicle positions, the power grid, measured air quality, the World Port Index, critical infrastructure and military installation layers, and the rest of [`data-sources.md`](data-sources.md).
- **Code health:** replace the `dataRef` + `dataVersion` global state pattern (still in 3 files); reduce `any` and `eslint-disable`; dead code in `src/lib/sdk` (Polybolos/Lattice; nothing imports it), and decide whether `intel/` stays; unused dependencies and `npm audit`; bound the in-memory caches; settle the semantics of `/api/health`; structured logging in the web app (the api uses `pino`, the web app `[TAKIP] console.*`); named migrations instead of positional `user_version` (a `schema_migration` table seeded from the current version), since concurrent sessions have collided on a slot; `docker-publish.yml` publishes to GHCR after every green push to `master`.
- **Satellite object detection (idea):** a small model runs in the browser on the satellite view and marks aircraft, ships, tanks and vehicles; users confirm or correct the marks, and the corrections improve the dataset.
  - Imagery terms: can we run detection on it, store the results and train on it? Esri World Imagery (the current SAT view), NAIP, Sentinel-2 (`/api/sentinel` already searches it), OpenAerialMap.
  - Shortlist an aerial detector and dataset: DOTA, xView, DIOR, SpaceNet. Ultralytics YOLO is AGPL-3.0.
  - Spike: aircraft at a few airports, reusing camera vision (`src/lib/vision/`: worker, onnxruntime-web, overlay). Measure precision and recall against hand labels, and per-tile latency with WebGPU vs WASM.
  - Design the detection record (tile, imagery date, class, box, confidence, model version), opt-in, vetting and dedup rules for corrections, and the store.
  - Give OI Assist a `satellite` tool next to `camera`; make detections a cited evidence source in OI Forecast.
  - Decide which classes and areas are off-limits: military sites, people.
