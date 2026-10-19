# Code map

What each folder holds and who uses it. Built from the import graph on 2026-10-16, after the third
src/lib reorganisation (Wikipedia in `core/`, `map/style/`, `feeds/aviation-weather/`, `places/labels/`). Folder rules are in `CLAUDE.md` (Layout). Regenerate
the "used by" columns from imports rather than by guessing.

src/lib has nine groups. A group holds domain folders, plus a few single-file modules at its root;
`ai/`, `space/` and `history/` are one domain each.

## core

| Domain | Holds | Used by |
|---|---|---|
| `net/` | HTTP helpers: `http-json`, `source-cache`, `stealth-fetch`, `ssrf-guard`, `http2`, `fetch-pool`, `remote-zip`, `user-agent` (most re-export `@takip/connectors`) | almost every API route; lib feeds/cameras, intel/recon, intel/cyber, feeds/traffic, ai; tools/transit, tools/traffic, tools/import |
| `wikipedia/` | Everything Wikipedia that isn't tied to one tab: the server client (`client.ts`), `WikiSummary` and `trimExtract` (`summary.ts`), stored article refs such as "fr:Titre" (`refs.ts`), the reader's Wikipedia and language names (`language.ts`) | api/map, api/history, api/space; map/layers, map/interaction, panels/space, shell/settings; lib history, places/labels, ai |
| `i18n/` | The UI's languages: which one a visitor gets (`pick-locale.ts`, `country-languages.ts`, `request.ts`), the message format (`message.ts`), translators (`translator.ts`, browser-only `active.ts`) and one catalog per language (`catalogs/`); `tools/i18n` checks and merges them | app/layout, every translated component through `components/ui/use-t`; lib map, wikipedia |
| `geodesic.ts` | Geodesic maths | places/areas, feeds/cameras, feeds/hazards, intel/vision, ai; panels/areas, shell/search |

## platform

| Domain | Holds | Used by |
|---|---|---|
| `account/` | Server-side access checks, API keys, billing portal, impersonation, data export, account links | site/account, site/admin, workspaces; api/ai (plan gate); recon gate |
| `workspaces/` | Saved workspaces: state, session, autosave, API client | components/workspaces |
| `reports/` | Issue reports: the view snapshot a report carries, its summary for the console, the API client | site/report, site/admin; app page |
| `sdk/` | Polybolos client and Lattice adapter | nothing in the app imports it |
| `site/` | Public pages and search: the site's address (`SITE_URL` or the request), its copy and JSON-LD, the page catalogue (`catalog/`, one file per section) and its copy in nine languages (`translations/`, through `copy.ts` and `text.ts`), what a shared map link previews as (`share-view.ts`), map links that keep the base layers, the live lines (`live/`, over loopback to the app's own routes), per-language URLs and metadata (`locale-path.ts`, `meta.ts`, used by `src/proxy.ts`), the pictures of the map (`shots.ts`, taken by `tools/site/shots.ts`), share-card fonts and the world outline for preview cards | site/pages, panels/layers (coverage test); app page, map, about, og, robots, sitemap, layout; lib ai (`publicOrigin`) |
| `ads.ts`, `app-version.ts`, `visitor.ts`, `usage-actions.ts` | AdSense slots, the build version, the browser's visitor id and the action counter for usage statistics | shell/ads, site pages; shell/more; site/account (map time); panels and shell (`countAction`) |

## map

| Domain | Holds | Used by |
|---|---|---|
| `basemap/` | The live layer stack (`base-layers.ts`, its pieces in `bands/`), detail and ground rasters, terminator, basemap provider | map/basemap, map/layers, map/interaction, shell/map-look |
| `layers/` | Layer defaults, saved layers, what past views can show, ArcGIS layers | shell/state, shell/showing, panels/arcgis, lib/platform/workspaces |
| `popups/` | `kit.ts` (`pop()`) and the layer popups | map/interaction; most feeds/* layer modules, history, space |
| `camera/`, `terrain/` | Camera verbs, tracking and globe occlusion; terrain tiles and layer order | map/interaction, map/controls, map/basemap |
| `replay/` | Replay of recorded tracks: clock, sessions, time input, timeline ticks, track maths and layer; `followClock` for dated layers | map/replay, map/layers, panels/history, panels/space, shell/showing |
| `splash/` | The opening globe and its hand-off to the map; `draw/` | shell/splash |
| `style/` | The map's paint: `tokens.ts` (`MAP_INK`, `SERIES_INK`), the palette and its CSS pin, hatch patterns, the style studio | map/* components, panels/layers, panels/markets, shell/map-look, shell/showing; lib map/basemap, feeds/*, history |
| root modules | `create.ts`, projection, clickable layers, touch targets, course; `view-link.ts` (a view as a link path); `view-mode-link.ts` (`?view=` History, deep time, Space or Replay, and `?panel=`) | map/* components, shell/mobile; lib map/basemap, platform/reports |

## feeds

| Domain | Holds | Used by |
|---|---|---|
| `aviation/` | Airports, flight paths and corridor watch, airport delays; emergency squawks; the viewport feed laid over the global snapshot | map/inspect, map/interaction, map/layers; api/airport-status |
| `aviation-weather/` | METAR and international SIGMETs from aviationweather.gov, their map layers and popups | api/aviation-weather; map/layers, map/interaction, panels/layers; lib map/basemap, ai |
| `cameras/` | Camera sources (`catalog/`, `sources/<group>/`, `generated/`), the map catalogue, liveness, previews, SkylineWebcams and YouTube resolvers, ALPR layers | api/cctv; map/cameras, map/interaction, map/layers; lib/intel/vision |
| `hazards/` | Popup and shaping helpers: quake twins, fire incidents and US perimeters, NHC forecast cones, war alerts, outbreaks, GNSS, service status | map/interaction, map/layers; api/earthquakes |
| `hiking/` | Waymarked Trails client, overlay and popup | map/layers; api/hiking |
| `imagery/` | GIBS, geostationary ring, dated rasters, scene search, area images, passes | map/imagery, map/layers |
| `maritime/` | Vessel filters, chokepoint flow | map/layers, panels/layers, map/interaction |
| `reference/` | Reference datasets: catalogue, file store, clipping, map layers | api/reference; panels/layers, map/layers |
| `satellites/` | Propagation (worker and client), filters, motion, chase, sky passes over a place; `gl/` (WebGL points) | map/layers; api/satellites |
| `traffic/` | Road traffic upstreams, TomTom flow tiles, layers; `sources/` | api/traffic; map/interaction, map/layers; tools/traffic |
| `transit/` | Live transit catalogue, selection, upstream; `gtfs/`, `placement/`, `sources/`, `generated/` | api/transit; map/inspect, map/layers; tools/transit |
| `weather/` | Temperature field, labels and unit; radar frames and loop state; lightning frames; the GFS wind field and its streak layer; `clouds/` (the live cloud layer and its worker) | map/layers; api/weather-field; lib/feeds/imagery |
| root modules | `contacts.ts`: the nearest aircraft and ships around one of them | map/inspect |

## intel

| Domain | Holds | Used by |
|---|---|---|
| `alerts/` | News shaping, Telegram parsing, alert digest and places, GDELT events, country risk | panels/alerts; api/news, api/gdelt-events, api/country-risk, api/ai; map layers |
| `recon/` | RECON: account gate, lookups, sanctions; `chain/`, `fingerprint/`, `network/`, `people/`, `username/` | api/osint, api/chain; panels/recon |
| `cyber/` | Feodo C2 indicators; `malware/` (URLhaus store, geolocation, live feed) | api/malware, api/cyber-attacks; map/layers |
| `markets/` | Markets panel helpers, terminal, DonBot embed | panels/markets |
| `vision/` | Camera detector (worker, client, shared look store); `server/` (frames, analysis, forecast) | map/cameras, lib/ai; api/cctv |
| `ai/` | Gemini client and the hosted-AI gate | api/ai; panels/alerts, panels/recon |

## ai, space, history, places

| Domain | Holds | Used by |
|---|---|---|
| `ai/` | TI (code name `ai`): run state, service, MCP; `engine/`, `parse/`, `prompts/`, `providers/`, `quant/`, `research/`, `globe/`, `workspace/`, and `assist/`: every tool defined once in `tool-defs.ts` (`defs/`), run by `tools.ts` (`actions/`) in the page and `serve.ts` for MCP, queried through `query/`, spoken through `live-voice.ts` | panels/ti-agent; api/ai, api/mcp; map/layers (forecast globe) |
| `space/` | Ephemerides, frames, globe match; `bodies/`, `craft/`, `deep/`, `globe/`, `replay/`, and `scene/` (three.js, with its own `bodies/`, `camera/`, `craft/`, `deep/`, `hud/`) | panels/space; api/space; map/basemap, map/interaction |
| `history/` | History tab: sessions, series, world borders, projections, OHM, the Wikipedia article for an event; `countries/` (country view, chart, indicator groups), `paleo/` (deep time: plates, climate, documentary) | panels/history, map/layers, map/country-chart, shell/showing; api/history |
| `places/areas/` | Areas of interest: drawing, watch rules, AOI export, geoBoundaries outlines | panels/areas, map/interaction, shell/showing; api/boundaries; lib platform/workspaces, feeds/imagery |
| `places/route/` | Route planning and turn-by-turn | panels/route |
| `places/labels/` | A labelled place on the base map: matching it to its Wikipedia article, and its popup | map/interaction; api/map |
| `places/` root | Nominatim, country centroids, recent places, landing cities, the place under the pointer (`pointer-place.ts`) | panels/route, shell/search, shell/state, shell/status-bar, map/inspect; api/health, api/outbreaks, api/cloudflare-radar, region-dossier; lib intel, map/splash, platform/workspaces, ai |

## src/components

| Group | Holds | Uses | Used by |
|---|---|---|---|
| `panels/` | One folder per sidebar tab, entry `<tab>-panel.tsx` | ui; lib ai, space, history, intel/recon, intel/alerts, places, intel/markets, map/layers | shell, app pages |
| `map/` | World map, basemap, layers, interaction, inspect, cameras, imagery, replay, windows, controls, dossier, country chart, menu | ui, shell, site/report; lib map, history, feeds/*, space, ai | app pages, panels, shell |
| `shell/` | The frame: the map page itself (`dashboard.tsx`; `app/page.tsx` only adds metadata; `state/use-view-mode-link.ts` opens what a `?view=`/`?panel=` link names), sidebar, status bar, mobile, keyboard, splash, map look, state (feed polling), search, showing, settings, ads, layout (what the person shows or hides and where: model, store, the map's corner slots) | ui, panels, site, map; lib map, map/layers, history | app pages, panels, site, map |
| `site/` | Pages off the map: docs (and the API catalogue), kit, admin, account, the issue report dialog, and the public reading pages (`pages/`: the layer article, the site frame, the share-preview card, the map page's hidden intro) | ui, shell; lib platform/account, platform/ads, platform/reports, platform/site | app pages, workspaces, shell/more, map/menu |
| `ui/` | The kit, flat; imports nothing else in the app | — | every group |
| `workspaces/` | Workspace host, chip, dialogs, shared links | site, ui; lib platform/workspaces | `app/w/[slug]` |

## src/app/api

Route groups mirror lib; the parentheses don't appear in URLs.

| Group | Routes | Lib they use | Called by |
|---|---|---|---|
| `(feeds)` | flights, airport-status, aviation-weather, maritime, chokepoints, nav-warnings, transit, traffic, cctv, satellites, weather, weather-field, weather-grid, air-quality, earthquakes, fires, radiation, outbreaks, sentinel, hiking, reference, infrastructure | core/net, feeds/* | shell/state, map/layers, map/inspect, map/cameras |
| `(intel)` | news, live-news, gdelt, gdelt-events, conflicts, frontlines, war-alerts, country-risk, advisories, markets, crypto, scm-suppliers, cyber-attacks, cyber-threats, malware, osint, chain, radar, cloudflare-radar, service-status, ai | intel/*, core/net, platform/account | shell/state, panels/recon, panels/alerts, map/layers |
| `(space)` | space, launches, space-weather, aurora | space, core/net | panels/space, shell/state |
| `(ai)` | ai, mcp | ai | panels/ti-agent; outside MCP clients |
| `(places)` | boundaries, geo, map | places, core/net | shell/search, panels/route, map/inspect, map/interaction, lib places/areas |
| `(history)` | history | history, places | map/layers |
| `(platform)` | health, stats, github-webhook, sdk | places/nominatim | outside callers |
| ungrouped | region-dossier | core/net, places | map/dossier |

`/api/v1/*`, `/api/auth`, `/api/admin`, `/api/billing` and `/api/replay/*` are rewrites to apps/api
(`next.config.ts`). The public catalogue of these routes is `src/components/site/docs/api-catalog.ts`.

## Pending

- `region-dossier` stays outside the route groups: an apps/api test imports it by path.
- Comments in five apps/api files name old paths; apps/api has one writer, so these go through the backend lead:
  - `src/auth/routes.ts`, `src/auth/auth.ts`, `src/testing/helpers.ts` and `src/auth/account-settings.test.ts` →
    `src/lib/platform/account/links.ts`;
  - `src/workspaces/state.ts` → `src/lib/platform/workspaces/state.ts` and `src/lib/places/areas/aoi-export.ts`.
