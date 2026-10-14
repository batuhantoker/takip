# Data roadmap: live and historical

> **Researched 2026-10-12/13.** The current state is in [`data-inventory.md`](./data-inventory.md). Rate limits and licences are quoted from each provider's own page (linked). Claims about our code and data marked ✓ were checked against the repo. "Probed" means a few requests were sent with the TAKIP User-Agent.
> Only free sources are listed: keyless, or a free key or account (marked). Non-commercial sources are still listed, with their terms.

## 0. Broken now

| Issue | Evidence | Fix | Effort |
|---|---|---|---|
| **The ingest worker isn't running** | ✓ There is no process. The last USGS poll was at 23:22 UTC and nothing has been sealed into tracks since 23:17. `tools/dev.mjs` starts only Next and `apps/api`. Raw files still land whenever something calls the routes. | Start it (`npm start -w @takip/ingest`), and decide whether `npm run dev` should start it too | S |
| **Satellites catalogued since 2026-07-11 are missing** | ✓ We fetch `FORMAT=tle` (`src/app/api/satellites/celestrak.ts:18`). CelesTrak ran out of 5-digit catalog numbers on 2026-07-11, and TLE text can't carry the new ones. The probe found 225 objects in the last 30 days, all with ids 100686–100982. | Switch to `FORMAT=json` (OMM) and parse it with satellite.js `json2satrec` (`packages/connectors/src/orbit.ts:39`). Store OMM in `tle.db`, and keep the TLE parser for the SatNOGS fallback. | S |
| **The adsb.lol history CLI can't fetch most older days** | ✓ `/\.tar\.[a-z]{2}$/` (`apps/ingest/src/backfill/adsblol-history.ts:72`) skips releases published as a plain `.tar` (505 in 2023, 124 in 2024). The `prod-1` variant is never tried, and days around New Year sit in the neighbouring year's repo. | Accept `.tar`, try `prod-1`, and look in both years' repos | S |
| **OpenSky is near its daily budget** | We make about 720–770 calls a day × 4 credits, about 75% of the 4,000 credits. A browser polling at the same time can push it to 96%. The licence is "research and non-commercial purposes" only ([docs](https://openskynetwork.github.io/opensky-api/rest.html)). | Lean on adsb.lol history (live #2) and keep OpenSky as a supplement | — |
| **AIS depends on one source** | AISStream allows "3 open connections" per IP and per account, and has no SLA ([docs](https://aisstream.io/documentation#limits)). It reconnected 3 times in one hour. | Add a second source (live #6) | M |

## 1. Live data, ranked

| # | What | Auth | Limit (cited) | Licence | Effort | Record? |
|---|---|---|---|---|---|---|
| 1 | **CelesTrak OMM JSON** (§0) | none | "only download data once per update", which is every 2 h; 50 errors in 2 h gets you firewalled ([policy](https://celestrak.org/usage-policy.php)) | n.d. | S | yes (already) |
| 2 | **adsb.lol daily history as a scheduled worker job**, after the CLI fix. One day holds about 55k aircraft; live polling sees about 17k. It also fills our own outages. | none | GitHub API 60 requests/h unauthenticated; asset downloads n.d. | ODbL | S | yes |
| 3 | **FIRMS NOAA-20 and NOAA-21 fire files** next to S-NPP and MODIS (`src/app/api/fires/route.ts:46`) | none (a free MAP_KEY gives "5000 transactions / 10-minute interval", [docs](https://firms.modaps.eosdis.nasa.gov/api/map_key/)) | n.d. for the keyless files | CC0 | S | new rows |
| 4 | **Record the feeds whose upstream keeps no history:** FAA airport status, war alerts (ubilling keeps none, Tzeva Adom the last 50 waves), NWS (7 days) and WMO alerts, SWPC (rolling windows), FIRMS (24 h). Also add `recordIfChanged`: ✓ the recorder hashes every body (`packages/archive/src/recorder.ts:102`) but never compares the hashes. | — | — | per feed; don't record IODA ("All Rights Reserved") or liveuamap | S–M | yes |
| 5 | **Add missing aircraft types to `TYPE_BATCHES`** (`src/app/api/flights/adsb-lol.ts`). The batches reach 13,956 of 18,064 aircraft. Missing: E75L 347, E145 48, AT75 32, S92 29, E545 28, H25B 27, DHC6 24. | — | adsb.lol: "dynamic"; a key "by feeding" is planned | ODbL | S | yes |
| 6 | **Digitraffic AIS** (northern Baltic): REST, or MQTT over `wss://meri.digitraffic.fi:443/mqtt` | none; send a `Digitraffic-User` header and gzip | without the header 60/min (REST) and 5/min (MQTT); the header raises it, number n.d. ([docs](https://www.digitraffic.fi/en/support/instructions/)) | CC BY 4.0 | M | yes |
| 7 | **aviationweather.gov** international SIGMETs (including volcanic ash) and METARs | none | 100/min ([docs](https://aviationweather.gov/data/api/)) | US government | S | yes (upstream keeps 30 days) |
| 8 | **Space-Track**: whole catalogue, and a fallback for CelesTrak | free account | <30/min and <300/h; GP data once an hour ([docs](https://www.space-track.org/documentation#/api)) | redistribution with citation ([user agreement](https://www.space-track.org/documentation#/user_agree)) | S–M | yes |
| 9 | **EMSC earthquake WebSocket**: pushes instead of 60 s polling, and catches revisions | none | n.d. | CC BY 4.0 | S–M | yes |
| 10 | **MeteoAlarm** European weather warnings (38 country Atom feeds, WebSub) | none | n.d. | CC BY 4.0 with extra redistribution terms (not read: the page needs JavaScript) | M | yes |
| 11 | **River levels and flood warnings:** UK EA, the USGS OGC API (WaterServices shuts down in Q1 2027), Pegelonline, Hub'Eau | none (USGS key optional) | n.d. | OGL v3 with credit / PD / DL-DE Zero / Etalab | M | EA warnings: yes |
| 12 | **Measured air quality:** Sensor.Community (or OpenAQ v3). Replaces Open-Meteo's modelled data for ~50 cities. | none (OpenAQ: free key) | Sensor.Community n.d.; OpenAQ 60/min, 2,000/h ([docs](https://docs.openaq.org/using-the-api/rate-limits)) | ODbL / per provider, and OpenAQ bars competing products | S–M | optional |
| 13 | **USGS volcano alert levels (HANS) and the GDACS API**, which has polygons; today we read only the GDACS RSS | none | GDACS ≤100 records per request ([quickstart](https://www.gdacs.org/Documents/2025/GDACS_API_quickstart_v1.pdf)) | PD / GDACS asks for credit | S | no (both keep history) |
| 14 | **Vehicle positions:** 556 keyless GTFS-RT feeds (Mobility Database), Entur, Digitraffic trains | none (Entur: `ET-Client-Name` header) | per feed | per feed; Entur NLOD; Digitraffic CC BY 4.0 | M–L | yes |
| 15 | **Kystverket AIS** (Norway) over TCP | none | n.d. | NLOD | M | yes (the TCP connection timed out when probed) |
| 16 | **Power grid:** ENTSO-E, EIA | free token / free key | 400/min ([docs](https://transparencyplatform.zendesk.com/hc/en-us/articles/12783148966036-API-Rate-Limit-Part-1)); ~9,000/h ([docs](https://www.eia.gov/opendata/faqs.php)) | CC BY 4.0 / PD | M | low priority |

**Next tier:**
- Global Fishing Watch: free token, CC BY-NC 4.0, 50k requests a day. Covers encounters, loitering and AIS gaps.
- RIPE RIS Live: BGP, keyless. Clearer terms than IODA or Cloudflare Radar.
- GOES-19 lightning.
- NDBC buoys.
- tsunami.gov CAP: keeps only the latest message, so record it.
- alerts.in.ua: a Ukraine fallback.

**Skip:**
- airplanes.live: returns 403 and says to contact them.
- adsb.one: blocked us, and the repo is archived.
- AISHub: feeders only.
- Danish live AIS: paid.
- Blitzortung: participants only.
- RainViewer: personal and educational use only.

## 2. Historical data, ranked

| # | What → target | Coverage | Size | Licence (commercial) | Auth | Effort |
|---|---|---|---|---|---|---|
| 1 | **USGS ComCat backfill** → `ev_event` (hazard.quake). The `backfill usgs` CLI exists. Fix the timeline rebuild first, which redoes the whole quake family on every load, then re-run `noaa-hazards --force` so NOAA quakes link to USGS. | 1900 → now. M4.5+ is 312k events; M2.5+ is 1.08 M | unknown | PD (yes) | none | S |
| 2 | **World Bank WDI refresh** → `ts_series`: done 2026-10-14, the 2026-10-08 bulk CSV through 2025 (`dataset-import-map.md` §3) | 1960–2025, 1,498 indicators | 283 MB | CC BY 4.0 (yes), except 6 SIPRI military series | none | M |
| 3 | **UCDP GED 26.1 and the 2026 Candidate files** as events: declined by the user on 2026-10-14. BRD 26.1 is loaded and GED only places its conflicts (`dataset-import-map.md` §2.5). One-sided violence would be the closest stand-in for GTD after 1989. | 1989 → 2025, Candidate to Aug 2026 | 39 MB | CC BY 4.0 (yes) | none | M |
| 5 | **adsb.lol `globe_history` 2023–26** → track shards, after the CLI fix in §0 | 2023-03-10 → now (2026-05-06 missing) | 1.3–3.2 GiB a day raw. Everything: ~785 GB at ingest, ~292 GB kept. **One day a week: ~112 GB at ingest, ~42 GB kept.** | ODbL (yes) | none | S |
| 6 | **Wikidata terrorist attacks**, and battle → war links: loaded 2026-10-14. Attacks from outside GTD's 1970–2017 as `wikidata-attacks` (592); battles `part_of` 141 WAC and COW wars (`dataset-import-map.md` §6) | varies | 3,084 attacks, 1,427 with coordinates | CC0 (yes) | none | S |
| 7 | **IBTrACS** cyclone tracks → `ev_event`, as a new `hazard.cyclone` kind with a line geometry | 1842 → now | 13,621 storms, 333 MB | WMO Resolution 40 (probably yes) | none | M |
| 8 | **Space-Track SATCAT, and a subset of TLE history** → entities, launch and decay events, `trk_tle` | 1957 → now | >138 M element sets, ~31 GB if all loaded, so load a subset | redistribution with citation (yes) | free account | S (SATCAT) / M |
| 9 | **NOAA MarineCadastre AIS**, as windows → track shards (ships). Our first historical ships. | 2009 → 2026-06, US waters | 80–86 GB a year raw, ~67 GB a year stored | PD (yes) | none | L (a new ship mapper) |
| 10 | **NASA FIRMS archive** → needs the stream store, or a daily-cell aggregate | MODIS 2000 →, VIIRS 2012 → | 32–385 MB a year | CC0 (yes) | none | L |
| 11 | **CShapes 2.0** borders with exact dates, and capitals → `geo` | 1886–2019 | 26 MB | CC BY-NC-SA (**no**) | none | S–M |
| 12 | **GTD from START** (adds 2018–20, and intact ids) | 1970–2020 | unknown | non-commercial; display needs permission (**no**) | request form | S |
| 13 | **OpenHistoricalMap** dated boundaries → `geo` | varies | 1.32 GB planet file | CC0 (yes) | none | L |
| 14 | **GDACS archive** → `ev_event` | ~2000 → now | 158k events | unknown | none | M |
| 15 | **NOAA Storm Events** → `ev_event` | 1950 → now, US | 303 MB | US federal | none | M |

**Not ranked:**
- **Non-commercial or restricted:**
  - ACLED needs a corporate licence.
  - EM-DAT is non-commercial. GDIS, its geocoded subset (places and type, none of EM-DAT's impact figures), is imported as `gdis`.
  - OpenSky history is research-only.
  - AMSA AIS and Berkeley Earth are CC BY-NC.
- **Too big or unclear:**
  - Danish AIS is ~4.2 TB, with an unclear licence.
  - The Open-Meteo historical API needs a paid plan for commercial use.
- **Usable later:**
  - ERA5 ("any purpose … lawful") and UN WPP 2024 (CC BY 3.0 IGO).
  - GHSL, HYDE 3.3 and Hansen forest loss are rasters (CC BY 4.0), and we have no import path for rasters yet.

## 3. Licence corrections (`meta_licence` doesn't reflect these yet)

| Source | What the provider says | Today in `meta_licence` |
|---|---|---|
| COW (`cow-interstate`, `cow-territorial`, `icow`) | "not to be used for any commercial activity"; no redistribution without written permission ([page](https://correlatesofwar.org/data-sets/)) | not set |
| GTD | Non-commercial, and **no public display without written permission** ([terms](https://www.start.umd.edu/gtd-terms)). This applies to the GTD layer we show today. | commercial: no |
| SIPRI nuclear tests | Commercial use needs authorisation ([terms](https://www.sipri.org/about/terms-and-conditions)) | unknown |
| adsb.fi | "personal, non-commercial use only" | unknown |
| Open-Meteo (live grid, air quality) | The free tier is non-commercial, and apps that "display advertisements" count as commercial, so it matters once AdSense is on ([terms](https://open-meteo.com/en/terms)) | not registered |

**Commercially usable replacements:**

| Today | Replacement | Gap |
|---|---|---|
| GTD | UCDP GED one-sided violence + Wikidata attacks | Partial; nothing open covers 1970–88 |
| COW wars | UCDP/PRIO armed conflicts 1946–2025 + Wikidata wars | |
| `ww2-europe` | Cliopatria or OpenHistoricalMap | Coarser |
| GLWD lakes | HydroLAKES (CC BY 4.0) | |
| ICOW | none found | |

## 4. Data-quality fixes

- **Duplicates vanish under licence gating.** ✓ The event query keeps only rows where `event_id = canonical_id` (`packages/db/src/sqlite/event-store.ts`), and `CANONICAL_ORDER` (`tools/import/events.ts:12`) puts `wac1914` and the COW sources first. If a tier loses access to a canonical row's source, its `same_as` duplicates disappear with it. Fix: pick the canonical row per tier, or put commercially usable sources first.
- **Duplicates are linked by checked-in tables:** `WAR_MATCHES` (`ucdp.ts`, UCDP ↔ WAC/COW), `WW2_MATCHES` (`cow.ts`, COW territorial ↔ WW2 borders) and `DUPLICATES` (`wikidata.ts`). Of the 64 groups of Wikidata battles with the same title and year, 23 were one battle; the rest are different battles (Cedar Creek in Florida and in Virginia, 1864). Left open: Battle of Aleppo 1400 (July vs November), Kota Batu 1578 (two enwiki articles), Siege of Janjira, Siege of Riga 1700.
- **GTD `eventid` is Excel-mangled** (`1.97E+11`), so it can't join a fresh START copy or Wikidata P4089.
- **Locations:**
  - UCDP conflicts are placed at the middle of their GED events (2026-10-14); before, they sat at their countries' centroids, and three multi-country ones at sea.
  - NOAA rows without a point borrow their linked quake or tsunami's, then the highest runup (`runups.json`), then their country's centre: 121 sit at country precision, and geocoding `locationName` would place them. One is left: the 1571 Terceira quake (no Azores polity). SIPRI tests without coordinates sit at their site's median, or at the place in `SITE_PLACES`.
  - ICOW claims (`icow-places.csv`) were re-checked on 2026-10-14: none falls back to its claimants' midpoint, and a sample of 30 lands on the territory named.
- **Still waiting on the user:** whether the lookback gate applies to history.

## 5. Suggested order

**This week (all S):**
1. Start the worker.
2. CelesTrak OMM.
3. Fix the adsb.lol CLI, then run it daily and backfill one day a week.
4. FIRMS NOAA-20/21.
5. `recordIfChanged`, then record the feeds that forget.
6. `TYPE_BATCHES`.
7. Licence rows.
8. Fix the timeline rebuild, then backfill ComCat at M4.5+.

**Next 2–4 weeks:**
1. Digitraffic AIS.
2. aviationweather.gov.
3. Space-Track SATCAT and the CelesTrak fallback.
5. IBTrACS.
6. The EMSC socket.

**Later:**
- MeteoAlarm, river levels, air quality and vehicle positions.
- MarineCadastre windows.
- The stream store, then FIRMS history.
- OpenHistoricalMap.
- GDACS and Storm Events.
- A raster import path.
- CShapes and GTD from START, if licences are obtained.
