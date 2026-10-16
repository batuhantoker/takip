# Free data sources and features from the inspiration projects

_Surveyed 2026-10-12. World Monitor at commit `968eac6`, Provenance at `f3029a8`, Argus at `7a56f8d`. Probes were single sequential GETs made on 2026-10-12._

The goal: every **keyless** data source these projects use, plus their non-UI features, mapped onto TAKIP. UI was out of scope.

**Licence rule** (from `INSPIRATION.md`): World Monitor and Provenance are AGPL-3.0, so these files record facts only: endpoints, parameters, fields, and methods in prose. No code was copied. Argus is MIT, so its scraper code may be ported with attribution.

**Auth and licence are separate columns.** "Keyless" does not mean "licence-clear". Most World Monitor rows say "terms-review", and each source still needs the check in `docs/data-sources.md` before it ships in the paid product.

## Files

| File | What it covers | Providers | Keyless |
|---|---|---|---|
| [wm-geo-signals.md](wm-geo-signals.md) | Conflict, disasters, weather alerts, aviation, maritime, radiation, outbreaks, outages, status pages, GPS jamming | 164 | 133 (about 55 are real geo signals) |
| [wm-macro-finance.md](wm-macro-finance.md) | Central banks, statistics offices, energy, trade, procurement, sanctions, prediction markets, China, tech | 202 | 164 |
| [wm-news-osint.md](wm-news-osint.md) | 768 RSS/Atom URLs by region and topic, 71 Telegram channels, 91 live-video slots, the credibility-tier scheme | 396 hosts | all but X and MTProto |
| [wm-features.md](wm-features.md) | 38 derived-signal features, ranked by value ÷ effort, with the method in prose and the gap in TAKIP | — | — |
| [provenance.md](provenance.md) | Provenance's camera, signal, basemap and market sources; its provenance cards; 22 non-UI patterns | 68 | 55 (27 new to TAKIP) |
| [argus-cameras.md](argus-cameras.md) | Argus camera sources turned into live-adapter leads, and how far OpenCCTV can be widened | — | — |
| [gods-eye-view.md](gods-eye-view.md) | God's Eye View (MIT, surveyed 2026-10-15): features, about 60 sources and 70 voice/MCP tools, each against TAKIP with port class, effort and value | ~60 | most |
| [nasa-worldview.md](nasa-worldview.md) | NASA Worldview and GIBS (surveyed 2026-10-15): 1,330 dated imagery layers in 3857, the 25 best for a live map, Esri Wayback, and Worldview's timeline, compare and events features against TAKIP | 1,330 layers | all (CORS `*`) |

The five repos under "To review" in `INSPIRATION.md` are already assessed in `CCTV-handoff.md` §2. Argus is revisited here for its full source list.

## Act on these first: breakage and risk found during the survey

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 1 | **Ontario and Alberta 511 cameras are failing.** Both hosts have required a key since 2026-09-24 (ON) and 2026-08-19 (AB). | `src/app/api/(feeds)/cctv/route.ts:179` and `:181`; unkeyed `/api/v2/get/cameras` returns **400** on both | **Fixed 2026-10-13, no key:** both load from the keyless `/List/GetData/Cameras` list behind their own camera pages, as `ibi()` feeds (`platforms/us-511.ts`, `canada/alberta.ts`). The keyed path and its env vars are gone. The other `/api/v2/get/` hosts (GA, IN, LA, PA, WI, AZ, ID, AK) may follow, and the same list is the way round. |
| 2 | **adsb.lol is not empty.** `/v2/mil` and `/v2/type/{types}` work worldwide. | `flights/route.ts:116` says adsb.lol `/v2` always returns an empty `ac[]`; `/v2/mil` returns 200 with 79 kB, `/v2/type/A320` 200 with 479 kB | Use adsb.lol (ODbL) for military and type pulls instead of adsb.fi (non-commercial). Provenance gets about 9.7k aircraft from four paced requests. Pace 2 s and back off on 429. |
| 3 | **UCDP's API needs a token.** | `gedevents/25.1` returns **401**: "Add header: x-ucdp-access-token" | Free token by email; the bulk CSV downloads are the fallback. |
| 4 | **The Yahoo Finance terms bar redistribution.** | `/api/markets` and `ai` call the same Yahoo endpoints that World Monitor is retiring for this reason | Plan a replacement before the paid tier ships. |
| 5 | **OpenSanctions is non-commercial, and its API now returns 401.** | probe | Build the sanctions list from **OFAC SLS** (public domain; includes vessels by IMO) and the EU, UK and UN lists. |
| 6 | **Caltrans HLS needs a `Referer` header.** | `Referer: https://cwwp2.dot.ca.gov/` | The missing piece for the HLS upgrade in `CCTV-handoff.md` §8.7. |
| 7 | **Newly gated sources.** | probes | ReliefWeb needs a pre-approved `appname`. IOM DTM needs a free subscription key. WFP HungerMap returned 401, possibly because of our survey User-Agent; re-check. road511 now needs a key too. |
| 8 | **`opencctv.ts` serves cameras we must not carry**: about 330 hosted by Windy, 3 Opentopia, and 2 `bondowoso` ZoneMinder URLs with `user=`/`pass=` in the query. | `.cache/cctv-catalog.json` (2026-10-11): 329 Windy, 3 Opentopia, 2 bondowoso | **Fixed 2026-10-12:** `opencctv.ts` drops windy.com and opentopia.com hosts and any URL carrying a login. |
| 9 | **WSDOT returns 0 cameras.** | `route.ts:94`: `data.wsdot.wa.gov/log/public/cameras.json` returns **404** | **Fixed 2026-10-12:** `wsdot.ts` reads the keyless ArcGIS layer `TravelInfoCamerasWeather/FeatureServer/0` (1,641 cameras; TripCheck-hosted ones are left to `oregon.ts`). |
| 10 | **Caltrans stops at 2,000 cameras.** | `route.ts:108` queries ArcGIS without `resultOffset` paging; Argus has 3,304 | **Fixed 2026-10-12:** `caltrans.ts` pages the query (2,936 cameras). The per-district JSON with HLS is still open (`argus-cameras.md`, top 10 #7). |
| 11 | **Montreal and DriveBC also return 0 cameras.** | Argus's DriveBC URL variant returns 1,067 | Check both adapters. |

## Top keyless sources to add

New to TAKIP unless the "TAKIP" column says otherwise. The detail files have the full endpoint, fields and probe result for each.

### Hazards and environment

| Source | What one record is | Endpoint | Licence | TAKIP |
|---|---|---|---|---|
| WMO SWIC | An official CAP warning from any WMO member | `severeweather.wmo.int/json/wmo_all.json` | WMO/member CAP; review | New; `weather` alerts are NWS-only |
| ECCC alerts | A Canadian alert polygon | `api.weather.gc.ca/collections/weather-alerts/items?f=json&status_en=issued` | ECCC open licence | New |
| NOAA NHC | Active storm, cone and track | `www.nhc.noaa.gov/CurrentStorms.json`; NHC MapServer for the polygons | Public domain | New |
| GDACS volcanoes | A volcano event | `gdacsapi/api/events/geteventlist/SEARCH?eventlist=VO` (the MAP endpoint returns 404 for VO) | EC JRC/UN; attribution | `gdacs.org` already in; VO is new |
| EMSC | An earthquake, often faster in Euro-Med | `www.seismicportal.eu/fdsnws/event/1/query?limit=500&format=json` | Attribution; verify | New; dedup with USGS at 120 s / 60 km / 0.8 magnitude |
| NOAA SWPC | Aurora oval grid and G/R/S scales | `services.swpc.noaa.gov/json/ovation_aurora_latest.json`, `/products/noaa-scales.json` | Public domain | Host in `space-weather`; products new |
| EPA RadNet | An hourly gamma reading at a fixed monitor | `radnet.epa.gov/cdx-radnet-rest/api/rest/csv/{year}/fixed/{STATE}/{CITY}` | Public domain | New |
| Safecast | A crowd radiation reading | `api.safecast.org/measurements.json?distance=&latitude=&longitude=` | CC0 | Listed in docs/data-sources.md; coverage sparse |
| CWFIS (NRCan) | An active, prescribed or reported Canadian fire | `geoserver.cwfif.nrcan.gc.ca/geoserver/ows?service=WFS…typeNames=public:cwfif_national_activefires` | OGL-Canada | New; complements FIRMS |
| BC Wildfire | A current BC fire point | `openmaps.gov.bc.ca/geo/pub/ows?…PROT_CURRENT_FIRE_PNTS_SP` | OGL-BC | New |

### Conflict, security and humanitarian

| Source | What one record is | Endpoint | Licence | TAKIP |
|---|---|---|---|---|
| NGA MSI | A navigational warning: live fire, hazards, cable repair (coordinates in the text, as DMS) | `msi.nga.mil/api/publications/broadcast-warn?output=json&status=A` | Public domain | New |
| Tzeva Adom | An Israeli siren alert (cities, threat type) | `api.tzevaadom.co.il/notifications` + pikud-haoref `cities.json` | Unofficial; no terms | New |
| alerts.com.ua | Air-raid state per Ukrainian oblast | `alerts.com.ua/api/states` | No stated licence | New |
| Official Telegram alert channels | Home Front Command, BMKG tsunami, Ukraine's air force and emergency service, Saudi Civil Defense | `t.me/s/{handle}` (handles in `wm-news-osint.md` §3) | Channel terms | Should fit the existing `osint` reader; untested via `t.me/s/` |
| UNHCR | Refugee stock per origin→asylum pair per year | `api.unhcr.org/population/v1/population/?year=&coo_all=true&coa_all=true` | CC BY 4.0; verify | New |
| HDX HAPI | Monthly conflict events and fatalities per admin area | `hapi.humdata.org/api/v2/coordination-context/conflict-events` with a self-made `X-HDX-HAPI-APP-IDENTIFIER` | ACLED-derived; verify | New |
| UK FCDO | Travel-advice status per country | `www.gov.uk/api/content/foreign-travel-advice/{slug}` | OGL v3 | Listed in docs/data-sources.md |
| data.police.uk | A street-level crime (anonymised point, month) | `data.police.uk/api/crimes-street/all-crime?lat=&lng=` | OGL v3 | New |
| Ransomware.live | A claimed victim (country, group, sector) | `api.ransomware.live/v2/recentvictims` | Free tier; verify commercial use | New |

### Aviation, maritime, space

| Source | What one record is | Endpoint | Licence | TAKIP |
|---|---|---|---|---|
| adsb.lol | Aircraft worldwide, by military flag or ICAO type | `api.adsb.lol/v2/mil`, `/v2/type/{T1,T2,…}` | ODbL | Host already in; endpoints unused (see finding 2) |
| FAA NAS Status | A ground stop or delay programme | `nasstatus.faa.gov/api/airport-status-information` (XML) | Public domain | Listed in docs/data-sources.md |
| IMF PortWatch | Daily chokepoint transits, daily port calls, disruption events | ArcGIS `services9.arcgis.com/weJ1QsnbMYJlCHdG/…` (layer ids in `wm-geo-signals.md`) | Verify | New; upgrades the static ports |
| Launch Library 2 | An upcoming launch at its pad | `ll.thespacedevs.com/2.2.0/launch/upcoming/?mode=normal` | Verify; anonymous limit of a few requests an hour | Listed in docs/data-sources.md |
| gpsjam.org | Daily GPS-interference ratio per H3 hex | `gpsjam.org/data/manifest.csv` → `/data/{date}-h3_4.csv` | No licence; derived from ADS-B Exchange | Use short-term; compute it ourselves from adsb.lol NIC/NACp later |

### Infrastructure, outages, energy

| Source | What one record is | Endpoint | Licence | TAKIP |
|---|---|---|---|---|
| Statuspage v2 | One vendor's status and incidents (one adapter covers 14–18 vendors) | `{host}/api/v2/summary.json` | Self-reported | New; host list in `wm-geo-signals.md` |
| GCP and AWS health | A cloud-region incident | GCP `incidents.json`; AWS health feed | Self-reported | New |
| Spain MINETUR | About 12k fuel stations, with price and coordinates | `sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/` | Open (Spain) | New; Mexico CRE is a sibling |
| Ember | Country × month electricity generation and demand | GCS `emb-prod-bkt-publicdata/…/monthly_full_release_long_format.csv` | CC BY 4.0 | New |
| JODI | Country × month oil and gas production, demand and stocks | `jodidata.org` annual CSVs | Verify | New |
| DoD MIRTA | US installations (points and boundaries) | `services7.arcgis.com/n1YM8pTrFmm7L4hs/arcgis/rest/services/mirta/FeatureServer` | Public domain | Listed in docs/data-sources.md |
| OpenFreeMap | Vector basemap with building heights | `tiles.openfreemap.org/styles/{liberty,positron,dark}` | ODbL | New; an alternative to CARTO |

### Companies, money, country context

| Source | What one record is | Endpoint | Licence | TAKIP |
|---|---|---|---|---|
| OFAC SLS | A sanctioned party, vessel (IMO/MMSI) or aircraft | `sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/sdn_advanced.xml` | Public domain | Replaces OpenSanctions (finding 5) |
| SEC EDGAR | A live 8-K; ticker→CIK; company HQ address | `www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom`, `data.sec.gov/submissions/CIK{10}.json` | Public domain; send a declared User-Agent | Listed in docs/data-sources.md |
| INFORM Risk (EC JRC) | Country risk score and components | `drmkc.jrc.ec.europa.eu/inform-index/API/InformAPI/countries/Scores/` | Attribution | New; a data-backed baseline for `country-risk` |
| World Bank WDI | Country × year indicator | `api.worldbank.org/v2/country/{iso}/indicator/{id}?format=json` | CC BY 4.0 | Listed in docs/data-sources.md; for `region-dossier` |
| Procurement | A tender notice (buyer, country, CPV) | TED v3 `POST api.ted.europa.eu/v3/notices/search`; UK Contracts Finder OCDS; World Bank notices; CanadaBuys CSV | Mostly open | Listed (TED) |
| USGS MCS + BGS | Mine and refinery share by country and commodity | ScienceBase MCS files | Public domain / BGS terms | New; for `scm-suppliers` |
| Kalshi | A prediction-market event with prices | `api.elections.kalshi.com/trade-api/v2/events?status=open` | Review | New; sits beside Polymarket and Manifold in `ai` |
| Frankfurter | ECB reference FX rates | `api.frankfurter.dev/v1/latest` | ECB, open | New |

### News

- **768 keyless feed URLs**, 634 of them new to TAKIP, grouped by region and topic in `wm-news-osint.md` §2. Strongest additions:
  - **Analysis:** IAEA, WHO, Crisis Group CrisisWatch, ISW, Oryx.
  - **Investigations:** OCCRP, Bellingcat, DFRLab.
  - **Defence and maritime press:** gCaptain, USNI.
  - **Official US releases:** Fed, SEC, CISA.
  - **Local newsrooms** in the Sahel, the Horn, Yemen and Central Asia.
- **Google News `site:` RSS queries** are a keyless stand-in for outlets with no usable feed (Reuters, AP, Janes).
- **Broadcaster HLS streams** (DW, NHK, Al Jazeera, TRT World, France 24) for `live-news`, as display only.

### Cameras (from Argus and Provenance)

**Argus funnel** (`argus-cameras.md`):
- 229,308 rows, of which 92,446 are excluded (91,778 hosted by Windy, plus Opentopia, credentials and device paths).
- That leaves 136,862 usable; 62,724 are already in TAKIP, so 74,138 are net-new in the snapshot.
- Re-checked against OpenCCTV's live index (139,362 ids): **about 67.9k are net-new after deduplication, about 86% directly playable, realistically 45–55k live.** Liveness still needs the batch fetch.
- Per-sub-source numbers are in [argus-opencctv-subsources.csv](argus-opencctv-subsources.csv).

| # | Lead | Net-new | Note |
|---|---|---|---|
| 1 | Lift the Asia caps in `opencctv.ts` | ~23.1k | MLIT river cameras 10.3k, Taiwan 5.0k, Korean city systems |
| 2 | Widen OpenCCTV beyond Asia, with owned-host and exclusion lists | ~44.8k | National Highways 2.4k, VDOT 1.6k…; needs the ingest job (~1.4k batch calls) |
| 3 | ALERTCalifornia GeoJSON | 2,272 | Keyless |
| 4 | Open Data Hub `WebcamInfo` | 1,991 | Keyless |
| 5 | FAA WeatherCams, incl. NAV CANADA | 3,255 | One image call per camera |
| 6 | CDOT COtrip | ~1,000 | One config line |
| 7 | Caltrans per-district JSON | +~940, plus ~2.8k HLS | Port `caltrans.py:fetch`; HLS needs the `Referer` (finding 6) |
| 8 | DriveBC | +1,045 | Port `drivebc.py:fetch` |
| 9 | PhenoCam | 1,086 | Keyless |
| 10 | SCDOT/SDDOT Iteris loader | ~920 | One loader for several states |

- **Next in line:** Seattle 658, i-traffic (South Africa) 657, Austin 571, DelDOT 362, Madrid 357, and Connecticut 347 (one line in `ibi511.ts`).
- **Corrections to `CCTV-handoff.md`:**
  - Houston TranStar is not a 1.5k lead: about 85% of its cameras are TxDOT's.
  - Castle Rock's net-new is only Nova Scotia 57, New Brunswick 57 and ctroads.org 347 (`provenance.md`).
- **Also from Provenance:** Traffic Scotland (~414, OGL) and Estonia Tark Tee (~180, with measured road surface).
- **Argus code worth porting** (MIT; keep "Copyright (c) 2026 Jeremy Hou" in the file header):
  - `ipcamlive_resolver.py:resolve`;
  - `host_prober.py:probe_image_host` and `probe_iframe_host`;
  - `store.py:dedupe_prefer_native`.

## Top features

From `wm-features.md` and `provenance.md`. Effort/value: S/M/L and H/M/L.

1. **Geographic convergence (S/H):** a 1° cell over 24 h; alert when 3+ independent kinds co-occur. Every input is already fetched.
2. **Thermal escalation (S/H):** cluster FIRMS detections within 20 km and score each 0.5° cell against its own 7-day history, plus an explosion-like test.
3. **Chokepoint transit anomalies (S/H):** compare PortWatch transits over 7 days with the previous ~90 days; flag 3 days in a row below 85 %.
4. **Alert fusion and cooldowns (S/H):** merge within 2 h and 200 km, use per-type dedup windows, and emit only on band crossings. `lib/places/areas/watch.ts` emits raw enter/leave events.
5. **Provenance claims and a licence gate (S/H):** known/unknown/not-applicable claims, four time roles, two confidences; raw values served only from cleared sources. Cheap while the observation format in `docs/architecture/README.md` is still open.
6. **Freshness and intelligence-gap tracker (S/H):** a staleness budget per source; transport freshness kept apart from content freshness.
7. **Military air surge and theatre posture (S/H):** per-theatre baselines (2×/3×/4×) and tanker + AWACS + fighter package tests. Licence-clean once finding 2 lands.
8. **Sanctioned vessels and aircraft on the map (S/H):** diff the OFAC lists and match IMO, MMSI and registration against AIS and ADS-B.
9. **Event → nearby critical infrastructure (S/H):** assets within 600 km, up to 3 per type. The sweep in `lib/places/areas/aoi.ts` does most of it.
10. **Temporal baseline anomaly engine (M/H):** Welford statistics per region × kind, bucketed by weekday and month, with z bands at 1.5/2/3. Needs the raw archive started now; live ADS-B and AIS can't be backfilled.

Also worth taking:
- **From Provenance:** measured road surface next to cameras (the nearest operator station, only within 10 km and 2 h), an HLS liveness check that reads the playlist twice, junk-pin filters for GDELT, and edge-cache lifetimes tied to each source's refresh rate.
- **From World Monitor:** news credibility scoring, made of a 1–4 source tier and a separate state-affiliation/propaganda flag, with state media capped.

## Not keyless (for completeness)

- **No keyless option at all:**
  - NOTAMs (ICAO key);
  - AIS (aisstream.io free key, already in);
  - IMD cyclones (key; non-commercial only);
  - Manitoba 511;
  - OpenSky (OAuth);
  - the X API (paid);
  - Telegram MTProto (free key, but `t.me/s/` needs none).
- **Keyless but blocked or fragile:**
  - JMA and JTWC (World Monitor blocks both in code);
  - OREF (needs an Israeli IP);
  - ThinkGlobalHealth outbreak points (parsed from a JS bundle);
  - the TeleGeography cable API (proprietary data).
