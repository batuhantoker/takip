# Inspiration

Projects to learn from and take ideas from.

**Licence rule:**
- Ideas, designs and facts (endpoint URLs, field names, how a source behaves) are free to use. Facts aren't copyrightable.
- Code is only free to use under its licence. Code from an AGPL-3.0 project can be copied only if TAKIP's own code is AGPL-3.0 too, with the original copyright notice kept. The hosted product's source must then be offered to its users under the AGPL, which affects the paid tier (`TODO.md` §1, licence decision).

## World Monitor

- **Repo:** https://github.com/koala73/worldmonitor
- **Live:**
  - https://worldmonitor.app
  - Variants at `tech.`, `finance.`, `commodity.`, `happy.` and `energy.worldmonitor.app`.
- **Licence:**
  - AGPL-3.0-only for the code.
  - The CLI and SDKs (`cli/`, `sdk/`) are MIT.
  - A separate commercial source licence is sold to teams that want non-AGPL terms.
  - The hosted plans have their own EULA.
  - Branding needs separate trademark permission.
- **Looked at:** 2026-10-11, commit `968eac6`.
  - About 88,000 stars and 13,500 forks. Created 2026-01-08; latest release v2.10.0 (2026-09-08).
  - The author, Elie Habib (koala73), has about 7,600 commits; the next contributor has 84.
  - Wired has covered it.
- **Size:** about 7,900 files: 2,550 test files, 950 in `src/`, 515 in `server/`, and 330 Protocol Buffers contract files in `proto/`.
- **What it is:** a "real-time global intelligence dashboard":
  - AI-summarised news, geopolitical monitoring and infrastructure tracking.
  - It is built around panels; the map sits among about 109 panel types.
  - Markets, prediction markets and supply-chain analysis carry as much weight as the map.

### Business model: the closest match to our free/paid plan

| Plan | Monthly | What it adds |
|---|---|---|
| Free | $0 | Core panels, global news feed, earthquake and weather alerts, basic map, 3 dashboard tabs |
| Pro | $39.99 | Personal licence. Adds:<br>• uncapped panels and sources<br>• AI analyst chat; stock analysis and backtesting<br>• supply-chain stress tests<br>• historical search and timelines ("intel memory")<br>• scheduled AI digest and alert rules<br>• MCP and SDK access (50 calls/day)<br>• custom widgets, 10 dashboards |
| Pro Business | $49.99 | Commercial use, CSV/JSON/PDF export, 25 dashboards, 250 MCP calls/day, priority support |
| API Starter | $99.99 | REST API and SDKs, real-time streams, 60 requests/min and 1,000/day, webhooks |
| API Business | $299.99 | Redistribution rights for customer-facing products, 300 requests/min and 10,000/day, 5 Pro seats |
| Enterprise | Custom | Team deployments, private MCP servers, TV apps |

- Annual billing is about 25% cheaper. Bring-your-own keys always work.
- What they sell is the AI layer, delivery (digests and alerts), history, API quotas and commercial rights, not the code.
- **The lesson:** AGPL code and a paid hosted service coexist. The code stays open, and the money comes from running it. This is the model to weigh for our licence decision (`TODO.md` §1).

### Architecture

- **Frontend:**
  - Vanilla TypeScript and Vite, no framework.
  - Two map engines share one layer catalogue: deck.gl over MapLibre for the flat map, and globe.gl/Three.js for the 3D globe.
  - Every panel extends one `Panel` base class.
  - State is one central mutable `AppContext`, much like our `dataRef`.
- **Browser ML in web workers:**
  - Transformers.js/ONNX for embeddings (MiniLM), sentiment, summarisation and named entities.
  - An IndexedDB vector store for headline memory.
  - News clustering and cross-domain correlation in a separate analysis worker.
- **Backend:**
  - Vercel Edge Functions serve the API.
  - Railway runs the long-lived work:
    - the AIS ship-tracking WebSocket relay;
    - "seed" loops that pre-fetch and cache sources (markets, aviation, GPS jamming, risk scores, UCDP);
    - an RSS proxy and Israeli rocket-alert polling;
    - Playwright scrapers for consumer prices.
  - Upstash Redis is the cache, with stampede protection, per-source freshness metadata and rate limits.
  - Convex handles billing (Dodo Payments), users, API keys and email. It also holds the historical "intel memory", searched with vector search.
  - A Cloudflare Worker handles CORS on `api.worldmonitor.app`.
- **API contracts:**
  - Defined in Protocol Buffers, with HTTP annotations (sebuf) and a generated OpenAPI spec.
  - About 39 domains: aviation, maritime, military, cyber, supply chain, trade, resilience, forecast and more.
- **Distribution:**
  - A Tauri 2 desktop app for macOS, Windows and Linux, with a Node sidecar. Also a PWA and a multi-arch Docker image.
  - Six site variants from one codebase: world, tech, finance, commodity, happy, energy.
  - A UI in many languages, including right-to-left scripts.
  - Local AI through Ollama, so it runs with no keys.
- **For AI agents:** an MCP server with Agent Skills, `llms.txt`, a `.well-known` API catalogue, a CLI (`npx worldmonitor`), and SDKs for Python, Ruby and Go.
- **Data:**
  - 578+ upstream hosts observed.
  - `docs/data-sources.mdx` lists the provider, feed tier, licence posture and collection method of each source.
  - News feeds are tiered by credibility: Tier 1 is wire services and official bodies, Tier 2 major outlets, and so on.

### Algorithms worth studying (`docs/algorithms.mdx`)

- **Country Instability Index:** live scores, bands and 24-hour movement for 31 tier-1 countries.
- **Hotspots and risk:**
  - hotspot escalation scoring;
  - geographic convergence (several signal types clustering in one place);
  - a strategic risk score;
  - population exposure estimates.
- **Military:** theatre posture assessment, surge and foreign-presence detection, USNI fleet tracking, aircraft enrichment.
- **Infrastructure cascade modelling.** This is our planned dependency map, already built:
  - A weighted dependency graph links undersea cables, pipelines, ports, chokepoints and countries.
  - A disruption propagates breadth-first to depth 3, with strength = edge weight × disruption level × (1 − redundancy).
  - It answers questions like "if Hormuz closes, which countries face energy shortages within 30 days?".
- **News and entities:**
  - news geolocation;
  - an entity index with cross-referencing;
  - headline scoring;
  - trending-keyword spikes;
  - anomaly detection against a temporal baseline;
  - a breaking-news alert pipeline.
- **Cross-stream correlation:**
  - signals aggregated across military, economic, disaster and escalation streams;
  - a GDELT tension index;
  - the "PizzINT" monitor of activity near the Pentagon.

### What it means for TAKIP

- It already does much of what our roadmap plans:
  - free and paid tiers;
  - MCP and API access;
  - alerts and digests;
  - history ("intel memory");
  - the dependency map;
  - AI analysis.

  Competing head-on as a general world dashboard means competing with 88,000 stars and 13,500 forks.
- Where we could differ (verify by running it):
  - **Geospatial-first, with full observation history.** Their history appears to centre on news, not on a replayable archive of tracks, cameras and sensors.
  - **Cameras and vision at scale.** We have 46,500 cameras and in-browser counting. Check how large their webcam grid is.
  - **Trust for every data point**, the Provenance-style card.
  - **A vertical or region they don't serve well**, such as physical-asset risk, or Türkiye and its region in Turkish.
- If our code is AGPL-3.0, we can reuse their code as long as their copyright notices stay. That is a large shortcut.

### Patterns to adopt

- [ ] **Freshness and gaps:** per-source freshness metadata and an "intelligence gap" badge, so a stale or missing source is flagged instead of an empty layer looking calm.
- [ ] **A seed/relay split:** long-running workers pre-fetch and cache sources, and the web API only reads the cache. This matches our ingest-job plan.
- [ ] **API contracts as schemas** (protobuf or zod), with a generated OpenAPI spec. SDKs and the CLI are thin MIT clients.
- [ ] **Agent discovery:** `llms.txt`, a `.well-known` API catalogue, MCP Agent Skills.
- [ ] **A public data-sources catalogue** with licence posture and collection method per source. Our source registry, published.
- [ ] **Tiered news credibility.**
- [ ] **Vertical variants from one codebase** (finance, energy, …). Layer definitions declare renderer support, premium status and variant.
- [ ] **Delivery channels:** digests and alert rules sent to Slack, Discord, Telegram, email and webhooks.
- [ ] **Plan enforcement** with per-plan quotas: requests per minute and per day, with an MCP call counting as 2–3.
- [ ] **Later:** a desktop app (Tauri), and offline AI (Ollama, browser ML).

### Don't take, or check first

- **Their non-commercial or paid sources.** ACLED, OpenSky, Yahoo Finance and Finnhub feed their paid tier; they may hold licences we don't. Read the licence posture they publish for each source before assuming it's allowed for us.
- **Their branding**, which needs trademark permission even under the AGPL.
- **Any code**, unless our code becomes AGPL-3.0.

## Provenance

- **Repo:** https://github.com/011-sam-110/Provenance
- **Live:** https://provenance-online.com
- **Licence:** AGPL-3.0-only. Take ideas and endpoint facts, not code (see the rule above).
- **Looked at:** 2026-10-11, commit `f3029a8`. 92 stars, 15 forks, created 2026-06-26, actively developed.
- **What it is:** "A live map of the world's open data, where every dot says who published it and how it knows."
  - About 20,000 official road cameras, aircraft, satellites, and 35 signal layers such as earthquakes, fires, cables and outages.
  - A console at `/app` for analysts.
- **Stack:** Next.js 15, MapLibre v5, zod, h3-js, Vitest (about 4,264 tests), Playwright. Production runs as one Node process on AWS Lightsail, behind Caddy and Cloudflare.
- **How we differ:**
  - It is live only, and its angle is trust in each data point.
  - Ours is history, entities, analysis and the dependency map (`ARCHITECTURE.md`).

### Patterns to adopt

- [ ] **A provenance card for every layer.** Fields:
  - what a single pin is;
  - the method behind it;
  - a confidence class: measured, official, reported, modelled or derived;
  - coverage;
  - limitations, which may never be empty.

  A test fails the build if a layer has no card. Fold this into our source registry.
- [ ] **Declare truncation.** A capped response says how many rows the upstream had, how many it returned, and how the survivors were chosen.
- [ ] **A failure contract.** A failing upstream returns an empty set, or its last good data marked stale. Never a 5xx, never invented data.
- [ ] **A closed media proxy.** It takes a camera id, never a URL, checks the host against an allowlist, and caches at each source's own refresh rate. This fixes the SSRF risk in our `cctv/proxy?url=` (`TODO.md` §2).
- [ ] **One adapter, one registry entry and one fixture test per source.**
  - The normalised output is validated with zod.
  - Each feed gets its own time budget. Their uniform 10 s timeout silently removed a slow feed; our 12 s region budget can fail the same way.
- [ ] **Proportional spatial sampling when capping.** Aircraft are capped at 3,000 of about 4,100, and every region keeps its share.
- [ ] **One long-running process, not serverless.** On Vercel each instance kept its own cache, so camera counts differed from request to request.
- [ ] **Console UX ideas:**
  - A ⌘K command palette that turns "quakes in the USA last 24h" into filter chips for layer, place and time.
  - A widget grid with presets, and layouts shareable as a URL.
  - Country dossiers.
  - CSV and GeoJSON export from every widget.
  - "Open this spot in" links: Google Earth, Google Maps, Copernicus Browser, OpenStreetMap.
- [ ] **Honest derived data.** Camera "conditions" refuse a road-weather reading from a station more than 10 km away, or one the operator flags as stale. Otherwise they say "from air" and report rain, never "wet road".
- [ ] **Build-in-public practice.**
  - Every figure in the README is dated and pinned to a commit.
  - Numbers on the landing page are read from committed data files, never typed in.
- [ ] **h3 hexagons** for zoomed-out aggregates and density maps.

### Sources they have and we may not

Check overlap and terms before adding each one.

- **Cameras:**
  - SCDOT.
  - Castle Rock 511. Its New York, Nova Scotia and New Brunswick systems are new to us.
  - Estonia, Traffic Scotland, CET-SP (São Paulo).
  - MUP Srbije border crossings and JP Putevi Srbije toll plazas. We already have a Serbia source; check overlap.
  - BIHAMK (Bosnia and Herzegovina), ACT (Puerto Rico), Houston TranStar.
- **Signals:**
  - Hazards: EMSC earthquakes, volcanoes and storms from NASA EONET, tropical cyclones, aurora.
  - Space and infrastructure: rocket launches (The Space Devs), cable landing stations.
  - Disruption: GPS jamming (gpsjam.org), IODA internet outages, cloud-provider outages.
  - Crime and cyber: UK street crime (data.police.uk), Ransomware.live.
  - Humanitarian and conflict: UNHCR displacement, ReliefWeb, Ukraine air-raid alerts (alerts.com.ua), UK FCDO travel advice.
  - Energy and money: ENTSO-E grid load, Frankfurter/ECB exchange rates, CoinGecko.
- **Basemaps:**
  - OpenFreeMap (vector tiles, no key), OpenTopoMap, AWS terrain tiles.
  - Esri World Imagery (check its terms).

### Don't take

- Their 70,698 Windy webcams, harvested into static files. Windy's terms don't allow it, and our rule is never to store Windy URLs.
- Their photo geolocation (`/locate`, using GeoCLIP). Geolocating photos can locate people, so only consider it with tight limits.
- Any code, unless TAKIP's code becomes AGPL-3.0.

## To review

- The five repos assessed in `CCTV-handoff.md` §2: Argus, Prime3vil/CCTV, openCAM, traffic-camera-sources, Live-Environment-Streams.

## Surveyed

- 2026-10-12: keyless data sources and non-UI features from World Monitor, Provenance and Argus, in [`docs/inspiration-sources/`](docs/inspiration-sources/README.md).
