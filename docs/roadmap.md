# Roadmap

Open work only. Merged on 2026-10-13 from the old `TODO.md` and `BACKEND-handoff.md`, then reordered with the user the same day around what TAKIP is for now: a personal tool, with the release decision open. Delete items once they're done; don't tick them. The backend build log (what was built, the user's answers, working rules) is [`architecture/backend-log.md`](architecture/backend-log.md). Data research with its own fix lists: [`architecture/data-roadmap.md`](architecture/data-roadmap.md) and [`architecture/map-detail.md`](architecture/map-detail.md); this file sets the order.
Edited by Batuhan. 2026-10-16. Clear the title number and delete this time next time you read this. I got bored half way thru 

##


## 1. Action items

In order. "(you)" marks the user's own steps.

## Easy win for transit, if we have the route show the user the route. showing the route with the stops

### 1.0 Ads on takip.dev
`/ads.txt` is live with the publisher ID since 2026-10-19 (`NEXT_PUBLIC_ADSENSE_CLIENT` in the NUC's `.env.production.local`).
1. (you) AdSense → Sites: add `takip.dev`, verify it with ads.txt and request review. First turn Auto ads off and publish the European regulations message (Privacy & messaging); `/privacy` promises both.
2. After approval: create two display units, `panel` and `page`, put their ids in `NEXT_PUBLIC_ADSENSE_SLOT_PANEL` and `NEXT_PUBLIC_ADSENSE_SLOT_PAGE` beside the client, and rebuild the NUC.
3. Before ads show: the self-hosted basemap (`architecture/map-detail.md`) and Open-Meteo's commercial terms (`architecture/data-roadmap.md`).



### 1.3 Record around the clock, with cleanup
The recorder runs around the clock on the NUC since 2026-10-18 ([`runbooks/nuc.md`](runbooks/nuc.md)); the Mac's `npm run dev` doesn't start it. Raw files land at ~0.5 GB a day (ships ~400 MB of it) and nothing deletes them.
1. (you) Decide whether `npm run dev` (`tools/dev.mjs`) should start the recorder too. Two recorders share one OpenSky client.
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
4. Add the missing aircraft types to `TYPE_BATCHES` (`src/app/api/(feeds)/flights/adsb-lol.ts`): the batches reach 13,956 of 18,064 aircraft. Missing: E75L 347, E145 48, AT75 32, S92 29, E545 28, H25B 27, DHC6 24.
5. Trace route in `apps/api` (through the backend lead): one aircraft's full trace for a day as TRK1, cached; then clicking a replayed aircraft draws it.
6. A second ship source: Digitraffic AIS (data-roadmap §1 #6). AISStream allows 3 open connections, has no SLA, and reconnected 3 times in one hour.
7. Days built on demand: `202 building` with `Retry-After` from the chunk route while the worker streams a release, one build per day; the timeline marks such days as fetchable.

### 1.5 Finish the half-built pieces

**Mount the workspaces chip (saved views).** The workspaces api, client library and UI have landed; the chip isn't mounted (`WorkspaceHost`/`WorkspaceChip` appear nowhere in the shell).
1. `src/app/page.tsx`: `<WorkspaceHost />` (from `@/components/workspaces/workspace-host`), right after `<AccountDialog />`.
2. Desktop, `search-spotlight.tsx`: `<WorkspaceChip />` beside `<SearchTrigger>` in one flex row, at the trigger's current position and width.
3. Phone, `mobile-shell.tsx`: after `<AppHeader … isMobile />`, add `<div data-hud className="absolute top-4 right-4 z-[210]"><WorkspaceChip align="right" /></div>`.
4. Register the map state in `page.tsx` with `useWorkspacePart` (from `@/components/workspaces/use-workspace`; adapters in `@/lib/platform/workspaces/adapters`):
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
- `src/lib/ai/research/context.test.ts` "carries on without a source that fails" fails: the one failure in `npm test` (checked 2026-10-19; 4,236 pass). `gatherContext` drops news older than a day by `Date.now()`, and the test's news is dated 2026-10-02; pass `now` through, as `selectContext` takes it.
- Lint is scoped to `apps packages tools`. Widen it as the web app's lint errors are cleared.

**Finish the src/lib reorganisation** ([`architecture/code-map.md`](architecture/code-map.md), Pending).
- Put `src/app/api/region-dossier/` in a route group (an apps/api test imports it by path), or finish the switch to `/api/v1/region-dossier` above.
- Backend lead: point the apps/api comments at the new paths (`src/lib/platform/account/links.ts`, `src/lib/platform/workspaces/state.ts`, `src/lib/places/areas/aoi-export.ts`); the list is in the code map.

**Put the name "TI" in one constant.** It is written out in 21 files (~80 strings, the prompt included). Left from the `oi` → `ai` rename (done 2026-10-16).

**Drop the `oi` back-compat** one release after 2026-10-16: the `/api/oi` rewrites in `next.config.ts`, `aiHeader`'s `x-oi-*` fallback (`src/lib/ai/service.ts`), the `oi_*` MCP names (`toolName` in `src/lib/ai/mcp.ts`), the `OI_*` env fallbacks, `?oi=` run links, `src/lib/ai/storage-migration.ts`, and the Style Studio `oiSupport` keys.

### 1.6 From the God's Eye View and Worldview surveys
Chosen by the user on 2026-10-15. Details are in [`inspiration-sources/gods-eye-view.md`](inspiration-sources/gods-eye-view.md) and [`inspiration-sources/nasa-worldview.md`](inspiration-sources/nasa-worldview.md).
1. **Road traffic, what's left.** The layer has NDW (the Netherlands) and Rennes and Nantes (`src/lib/feeds/traffic/`). Still to do:
   - **NDW lines after 2027-02-09,** when NDW stops publishing the Meetvakken shapefile: build them from NWB or a v3 replacement, and rebuild `data/traffic/ndw-sites.json` until then when its `Version.txt` changes. Confirm NDW's licence.
   - **More segment feeds:** Strasbourg and Grenoble once their class codes are confirmed, València (no timestamp), Hong Kong (speed only, so labels rather than tint; lines from the Road Network CENTERLINE in EPSG:2326). Re-test Taiwan's freeway feed from another network.
   - **Germany:** Autobahn GmbH reported jams as their own overlay, not as measured tint (about 100 per-road endpoints per refresh).
   - **Detector pins:** Digitraffic TMS (it has a free-flow speed), Madrid, Bison Futé, CITA Luxembourg, Flanders MIV, MnDOT, drawn as marks at the sensor, never along the road.
   - **TomTom flow tiles** (worldwide behind `TOMTOM_API_KEY`, `/api/traffic/flow`): check TomTom's terms for paid plans (its free tier reads as evaluation); stop drawing them where an open feed measures the same roads (both draw in the Netherlands, Rennes and Nantes today; a mask needs a Netherlands polygon, not `NDW_BBOX`, which spans Brussels and Cologne).
2. **Satellite imagery, what's left.** Satellite Live (the geostationary ring) and Satellite Daily (true colour back to 2000, following History and Replay) are in (`src/lib/feeds/imagery/`). Still to do:
   - **Whole-Earth live view:** done 2026-10-15, with four bands cut at the midpoints (`src/lib/feeds/imagery/geostationary.ts`). Left:
     - Check EUMETSAT's commercial terms for the MTG GeoColor band.
     - Himawari's band is synthesised: infrared cloud, plus visible cloud by day, over Blue and Black Marble. Cold ground at night (Siberia, Tibet) can read as thin cloud; a real Himawari GeoColor source would fix both.
     - Feather the four seams.
   - **Replay:** snap to DescribeDomains, because the 10-minute archive has gaps.
   - **Images of an area:** done 2026-10-15. Right-click → "Satellite images here" (10 km, 50 km, 200 km or the map view, up to 500 km), or "Satellite images" on a shape in Areas (`src/components/map/imagery/`, `src/lib/feeds/imagery/area*.ts`), shows:
     - the last 60 days of Sentinel-2, Sentinel-1 radar and Landsat passes from Planetary Computer, each with how much of the area it covers, drawn on the map when picked;
     - a "clearest mix" when no one pass covers the area: the clearest tiles of several dates;
     - "Save image of the area": a PNG up to 4096 px, cut from PC's crop endpoint in Web Mercator;
     - where the picked pass's satellite is now, with its orbit ahead, and the next overflights.
     Left to do:
     - Before/after compare across two dates.
     - Alert when a new clear image of a watched area arrives (a paid-plan candidate).
     - A georeferenced save (GeoTIFF, or a world file next to the PNG); a 4096 px PNG runs to about 35 MB.
     - The mix ranks tiles by the whole 110 km tile's cloud cover, not the cloud over the area.
     - A phone version: touch long-press still opens the dossier.
     - Check Planetary Computer's terms before paid plans.
     - Polish: close the right-click menu when the map moves; redraw the picked pass and the area outline after a basemap switch (they are dropped now).
   - **Controls:** per-layer opacity, and legends from GIBS colormaps.
   - **Playback:** an in-memory tile cache for preload, since dated tiles are `no-store`.
   - **Compare** across two dates.
   - **More imagery:** Esri Wayback (2014 on; paid use needs an Esri account) and Black Marble night lights.
3. **Map looks:** night vision, thermal, noir and snow, opt-in and on the map only (design rule added 2026-10-15). Later.

### 1.7 Being found
Since 2026-10-19 a shared link previews as what it shows, and there are 66 pages under `/map` (layers, History and deep time, the Space view, Replay and the tools), an `/about` page, and a generated robots.txt and sitemap, each page in ten languages at its own URL (`/tr/map/…`) and leading with a picture of the map ([`architecture/public-pages.md`](architecture/public-pages.md)). Links open History at a year, deep time, Space at a body, Replay or a panel (`?view=…`, `?panel=…`). City and country pages, also since 2026-10-19: `/city/<place>/<topic>` and `/country/<place>/<topic>` for transit, cameras, flights, weather, ports, ISS passes, aurora, hiking and earthquake history (last 10 and 100 years, and the whole record) across 31,762 GeoNames places and 237 countries, about 28k pages indexed, each in ten languages at its own URL ([`architecture/place-pages.md`](architecture/place-pages.md)), plus guides at `/guides` (English only). The pages' live map is `/embed/<slug>`, and any place, layers and period is `/embed?…` ([`architecture/embeds.md`](architecture/embeds.md)), with earthquakes over any area and window.
1. (you) Verify `takip.dev` in Google Search Console and Bing Webmaster Tools, and submit `/sitemap.xml`. `SITE_URL` is set on the NUC.
2. More History pages, one per era people search for (the Cold War, 1492, the Mongol Empire, the British Empire at its height).
3. Camera sources where people search and the catalogue has none. Nevşehir has two on air since 2026-10-19 (Uçhisar, Skyline); its two square cameras are off air with no stated place, and urgup.bel.tr sits behind a Cloudflare challenge.
4. Earthquake pages (`/quakes/<usgs id>`), only if they add what USGS's own page lacks (cameras, flights and ships near the epicentre); otherwise they are thin copies.
5. Embeds, next (`architecture/embeds.md`, Scaling out): a place table (admin-0 and admin-1 boxes and names in ten languages, Natural Earth) for place-and-period pages; more windowed layers (FIRMS, IBTrACS, `history.db`'s events); then other sites (`frame-ancestors` on `/embed` only), which earns links back.
6. Share cards in Arabic: Satori can't lay out Arabic, so `/og` draws them in English.
7. Outreach: Show HN, r/MapPorn, r/space, r/aurora, r/OSINT, and short screen recordings of the globe. Measure with the referrers in Admin → Analytics and Search Console's queries.
8. (you) Visitors from search get the anonymous 15 minutes a day of map time. Decide whether a first visit should get more.
9. Country names inside sentences: German and French need articles ("in der Schweiz", "au Japon"), Russian a case and Turkish a suffix, which a bare `{place}` can't carry, so some country pages read "in Schweiz". A per-language "in <country>" table for the 237 countries, used by the topics' copy.
10. Place earthquake pages open History, which draws NOAA's damaging quakes, so the map shows fewer than the page counts (USGS M4.5+). A windowed USGS layer on the full map, as `/embed` has, would match.
11. Pictures for place pages: `tools/site/shots.ts` shoots the layer pages, and place pages show the world sketch. Shoot the few hundred biggest indexed places, not all 24k.

### 1.8 Languages
Since 2026-10-19 the UI is in ten languages, machine-translated (`docs/design/README.md`, Language).
1. Mirror the shell for Arabic: replace left/right with logical properties (`ps-`, `ms-`, `start-`), then set `dir="rtl"`. Until then Arabic runs right to left inside left-to-right panels.
2. Save the language on the account (apps/api, through the backend lead), so a signed-in person's pick follows them across devices.
3. Have native speakers review the translations, Turkish first.
4. Space Replay's flight events ("Mars flyby", "Arrives at…") are labelled in English by the server (`api/(space)/space/history/collect.ts`). Send the parts and build the label in the browser.
5. TI's action cards and tool summaries stay English, because the model reads them back. Translate them on screen only, keeping the stored text English.
6. Every non-English page load inlines its language's catalog in the HTML: about 120 KB gzipped for Turkish and 145 KB for Russian (2026-10-19), against 17 KB for the whole English page. Serve each catalog as a hashed, cacheable script (`next/script` beforeInteractive) that the provider reads on the client and a per-locale server cache feeds during SSR, so repeat visits skip it.

## 2. After the action items

- **Weather and disasters** (data-roadmap §1): the GDACS API with polygons, and USGS volcano alert levels; aviationweather.gov international SIGMETs (including volcanic ash) and METARs; the EMSC earthquake WebSocket; NWS / NHC alerts into ingest; MeteoAlarm; river levels and flood warnings; tsunami.gov CAP.
- **More history** (data-roadmap §2): IBTrACS cyclone tracks; fix the timeline rebuild (it redoes the whole quake family on every load), then backfill USGS ComCat at M4.5+ and re-run `noaa-hazards --force`; the GDACS archive and NOAA Storm Events.
- **More history on demand:** GDELT raw files, FIRMS, ERA5, and OpenSky `/tracks/all` for the last 30 days.
- **GDELT stories:** the live layer works; the ingest connector and history wait on §3.2 (`architecture/gdelt.md`).
- **TI on live conflicts** (asked 2026-10-16, after the history tools `chronicle` and `past_event`): a read tool over GDELT, alerts and hazards ("what's flaring up near the Red Sea"), then a watch on a region or topic that notifies through alerts.
- **More projections** (`data-sources.md`, Projections): OECD-FAO; Wittgenstein education (decided 2026-10-16: five-yearly values blend between published years, marked "≈", as gaps do; needs an `.rds` reader for the Data Explorer's 1950–2100 files, or Zenodo's counts from 2020). The IMF World Economic Outlook is in from a hand-downloaded CSV (decided 2026-10-16), for personal use until the IMF permits commercial reuse; each new edition is downloaded the same way. Then the window means (Aqueduct, INFORM Climate Change, Human Climate Horizons), which need History to draw a value across its 20- or 30-year window.

## 3. Decisions waiting on the user

1. **How long to keep data, and a disk budget.** BT:TBD, I am not sure, for now just record we will get there can geProposed: fine track detail (L0) 3 months, L1 90 days, L2 forever. How long raw files are kept is open.
2. **History:** whether the plan lookback limit applies to History at all (recommended: no, for personal use); and GDELT history as one entry per story per day, or news intensity per country (`architecture/gdelt.md`).
3. **Cameras as their own product:** later.
4. **Consent for the visitor id (2026-10-19):** the map now keeps a random visitor id in localStorage and sends it with each minute tick (`architecture/backend.md` §8; Admin → Analytics → Visitors). Under ePrivacy, an analytics id like this usually needs consent from visitors in the EU and UK; today it is disclosed on `/privacy` ("What we measure") but not asked. Options: ask first in those regions (and fall back to the daily address hash), or keep it as is.
5. **Long-run country numbers** (researched 2026-10-16; Maddison GDP per person is already in through `owid-longrun`, value for value, and so is OWID's long-run population (HYDE, Gapminder, UN; year 0–2023) on today's countries). Maddison population and total GDP need: whether totals (population, GDP) may be drawn on historical polities like the USSR, which the series API would paint onto each successor's shape (an `apps/api` change); and Maddison's rule to cite its source papers wherever its data is shown.

## 4. Known issues

The fix-it pass (1.2) adds to this list.
- A war's History popup lists 8 of its battles in relation order, not the first 8 by date: `GET /api/replay/history/events/:id` returns relations as bare ids (`event()` in `packages/db/src/sqlite/event-store.ts`), so ordering needs the other event's date in the response.
- Key docs disagree with the code (`.env.example`, README, `self-hosting.md`, `api-catalog.ts`, `docs-client.tsx`): they say the AIS and OpenSky keys are unused (both are read); FIRMS and N2YO keys are listed but never read; Etherscan and Helius keys are read but change nothing; the Gemini bring-your-own-key option has no UI.
- Static data presented as live: conflict zones, ports and chokepoints.
- Region dossier: a failed data.police.uk lookup reads as "no data", and missing `lat`/`lng` isn't refused (kept for parity).
- Rebrand leftovers: the upstream X account (`@soulsimplifai`) in `more-menu.tsx`.
- Global Incidents (`global_incidents`) reads the GDACS feed (`api/(intel)/gdelt/route.ts`), but `use-sdk-entities.ts` labels it "GDELT Project".
- Active Fires adds NASA EONET volcanoes to the FIRMS hotspots with made-up readings (brightness 500 K, FRP 100 MW, `api/(feeds)/fires/route.ts`), and the popup presents them as heat detected by satellite. `/map/wildfires` says so until this is fixed.

## 5. Parked until the release decision

Built or designed for other people using TAKIP. Frozen until the release decision.

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
- **Workspaces:** the state schema exists twice (`apps/api/src/workspaces/state.ts`, `src/lib/platform/workspaces/state.ts`; move it to `packages/core`); nothing purges soft-deleted rows; a share link survives a plan that loses `workspaces.share`; closing a tab saves only states under ~60 KB.
- **Impersonation:** an expired window isn't audited and leaves the admin signed out; the "30 minutes" in the copy isn't read from `IMPERSONATION_S`; `impersonation-guard.ts` relies on a Better Auth internal, so re-check it on upgrades.
- **Usage:** response bytes are counted only when `Content-Length` is set; replay chunks aren't metered in bytes.
- **Still to check in a browser:** the Keys and Usage admin pages (404 until `npm run dev` restarts); the impersonation banner at phone width; the recon "Sign in to use recon tools" notice; the delete-account refusal while a paid subscription is active.

### Legacy routes still in the web app (`architecture/backend.md` §13)
- **Live feeds** (flights, maritime, satellites, cctv, quakes, fires, weather, news and so on): fetching moves to `apps/ingest` connectors, serving to `/api/v1` and a live API (SSE or WebSockets) that pushes ships and flights by viewport, replacing the 10 s full-snapshot polling.
- **Media proxies** (cctv proxy, frame, resolve, stream-status): move to the api as a closed proxy that takes ids, never URLs.
- **AI and TI** (`ai/*`, `mcp`): move to the api. Drop the deprecated `Authorization: Bearer <model key>` form one release after the change.
- **OSINT and recon** (`osint/*`): move to the api.
- **Platform** (`sdk/ingest`, `sdk/stream`, `github-webhook`, `health`, `stats`, `reference`): move to the api. `sdk/ingest` should take API keys with a `write:entities` scope instead of `SDK_INGEST_KEY`.
- **Key policy for the legacy feeds:** Admin → API access only switches `/api/v1` and `/api/replay` groups (`apps/api/src/access/key-policy.ts`); `/api/flights`, `/api/maritime` and the other web-app routes stay keyless and unmetered until they move. Gating them earlier needs a Next `proxy.ts` that asks the api, and `stats`, `markets` and `scm-suppliers` fetch their own `/api/*` server-side, so they would need a way past it.

### Security
- Review every route that fetches a URL, for SSRF: `cctv/proxy`, `arcgis`, `cctv/resolve`, `cctv/stream-status`, `cctv/frame`, `entity/expand`, `osint/*`. The closed media proxy removes the largest surface.
- Check auth on `sdk/ingest`, `github-webhook`, `mcp` and `ai/*`.
- Check `innerHTML` interpolation in the map popups (`layer-popups.ts` and `cyber-popups.ts` in `src/lib/map/popups/`) for XSS.
- Review how bring-your-own API keys are handled, and the CSP and CORS settings; review `nginx/nginx.conf` and the `intel/` service.
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
- Domain and X; a public roadmap (this file) and a changelog.
- Never import other people's camera snapshots; keep the privacy blocklist.

## 6. Parked

- **Space:** what is left in [`space-view.md`](space-view.md); Space-Track SATCAT, TLE history and the CelesTrak fallback (data-roadmap §1 #8, §2 #8); day and night on the satellite view (the `day_night` layer draws the terminator, `src/lib/map/basemap/solar-terminator.ts`; check how it reads over SAT imagery and whether night needs city lights). The missing-satellites fix stays in 1.2.
- **Cameras:** no new regions. Known fixes from the removed `CCTV-handoff.md` §8: opentopia cameras, HK duplicates, reused ids, `us-central`, the Kansas box, MassDOT, Caltrans HLS. The catalogue is still a JSON file (`.cache/cctv-catalog.json`); planned: a SQLite store, an ingest job outside the request path, vector tiles by zoom, deduplication, admission rules and a health checker.
- **Analysis:** density and trend maps, event correlation, anomaly detection, impact analysis (`architecture/README.md`, phase 3); the dependency map over infrastructure.
- **Bulk history:** adsb.lol `globe_history` 2023–26 beyond one day a week, NOAA MarineCadastre AIS, the FIRMS archive, the OpenHistoricalMap planet file (data-roadmap §2).
- **Transit:** feeds behind a free key (Sweden's Trafiklab, SF Bay 511, Île-de-France PRIM, England's BODS); timetable-only cities from static GTFS; rerun `tools/transit/build-feeds.ts` now and then, in daytime for Asia once.
- **Metros still missing** (surveyed 2026-10-15): free-key positions for WMATA, CTA's official `ttpositions` (the keyless map endpoint in use is outside its licence), Sydney, Melbourne, Seoul, Taiwan TDX, Brussels STIB and Lisbon; PATH from `ridepath.json` arrivals; Hong Kong MTR, Taipei and JR West from per-station arrivals; Stockholm SL departures; KTMB and Adelaide trains need a daytime probe. Istanbul and İzmir publish no live metro data, so they run from their timetables, labelled scheduled (the İBB GTFS lapsed on 2024-12-31 and lacks M11 and later lines; Ankara has no public GTFS); other no-live metros with a GTFS could follow, kept few. Estimated trains move in straight lines between stops; snapping them to shapes (NYC's realtime trip ids are the tail of the static ones) is open.
- **Live data outside the focus:** Digitraffic trains, Wikipedia EventStreams, the power grid, measured air quality, the World Port Index, critical infrastructure and military installation layers, and the rest of [`data-sources.md`](data-sources.md).
- **Code health:** replace the `dataRef` + `dataVersion` global state pattern (still in 3 files); reduce `any` and `eslint-disable`; dead code in `src/lib/platform/sdk` (Polybolos/Lattice; nothing imports it), and decide whether `intel/` stays; unused dependencies and `npm audit`; bound the in-memory caches; settle the semantics of `/api/health`; structured logging in the web app (the api uses `pino`, the web app `[TAKIP] console.*`); named migrations instead of positional `user_version` (a `schema_migration` table seeded from the current version), since concurrent sessions have collided on a slot; `docker-publish.yml` publishes to GHCR after every green push to `master`.
- **Satellite object detection (idea):** a small model runs in the browser on the satellite view and marks aircraft, ships, tanks and vehicles; users confirm or correct the marks, and the corrections improve the dataset.
  - Imagery terms: can we run detection on it, store the results and train on it? Esri World Imagery (the current SAT view), NAIP, Sentinel-2 (`/api/sentinel` already searches it), OpenAerialMap.
  - Shortlist an aerial detector and dataset: DOTA, xView, DIOR, SpaceNet. Ultralytics YOLO is AGPL-3.0.
  - Spike: aircraft at a few airports, reusing camera vision (`src/lib/intel/vision/`: worker, onnxruntime-web, overlay). Measure precision and recall against hand labels, and per-tile latency with WebGPU vs WASM.
  - Design the detection record (tile, imagery date, class, box, confidence, model version), opt-in, vetting and dedup rules for corrections, and the store.
  - Give AI Assist a `satellite` tool next to `camera`; make detections a cited evidence source in AI Forecast.
  - Decide which classes and areas are off-limits: military sites, people.
