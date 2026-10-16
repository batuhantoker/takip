# Data sources: candidates

Public data we could add. **The licence notes are from memory and have not been verified.** Check each one before it ships, especially in the paid product. Sources TAKIP already uses are marked "(already in)".

The keyless sources and features found in World Monitor, Provenance and Argus (surveyed and probed 2026-10-12) are in [`docs/inspiration-sources/`](inspiration-sources/README.md).

**Licence key:**
- **OK:** public domain, CC0, CC BY or OGL.
- **OK\*:** allowed with conditions (attribution, share-alike or registration).
- **NC:** non-commercial only.
- **Paid:** needs a commercial licence.
- **Verify:** unknown; check first.

## How to choose a source

A source is worth adding if most of these hold:

1. **Commercially usable:** public domain, CC0, CC BY, OGL or ODbL.
2. **Has a location and a timestamp.**
3. **Live, or updated often.**
4. **Links to an entity:** a vessel, aircraft, company, facility or place. Linking is what makes it more than a map.
5. **Worth keeping history for.** Most live feeds discard their history, and an archive is something we can charge for.

## Keyless starter set (streaming first)

None of these needs an API key. Several stream natively, which suits the live-first plan in `docs/architecture/README.md`.

| Source | What we ingest | Access | Notes |
|---|---|---|---|
| OurAirports | Airports, runways, identifiers, metadata | CSV downloads; public domain | Static reference; refresh daily |
| Wikidata | Companies, facilities, infrastructure, landmarks, relationships | SPARQL endpoint; dumps | The query service has timeouts and rate limits and asks for a descriptive User-Agent. Use dumps for bulk loads. |
| NOAA NEXRAD | Live and archived weather radar | Public AWS S3 buckets, anonymous access | Level II files are raw binary and need decoding. For a map layer, rendered radar tiles (NOAA nowCOAST, Iowa Environmental Mesonet) are simpler; check their terms. |
| Fintraffic Digitraffic | Finnish ship positions (AIS), train locations, road incidents, weather cameras | REST APIs and MQTT streams; CC BY 4.0 | Streams natively. Send the `Digitraffic-User` header they ask for. |
| Natural Earth | Borders, coastlines, administrative geography, base-map data | Bulk downloads; public domain | Static reference. In use: countries (50m) and states/provinces (10m) for the Areas region pick, built by `tools/build-boundaries.mjs` into `public/data/boundaries/` |
| geoBoundaries (gbOpen) | Districts and sub-districts (ADM2/ADM3) for the Areas region pick | REST API pointing at GitHub LFS files; keyless. Licence varies by country (public domain, ODbL, OGL, Etalab, DL-DE…) and most require attribution | In use: `/api/boundaries/fine` fetches a country on first use and caches it. The credit is shown in the draw HUD and exported as `region_source` |
| Wikipedia | Pageviews and live edits: shifts in public attention | EventStreams (server-sent events); pageviews API | Streams natively. A User-Agent is required. |
| NWS / NHC | Weather warnings, hurricane tracks, hazard polygons | `api.weather.gov`; NHC GIS feeds; public domain | `api.weather.gov` requires a User-Agent |
| NIFC / EFFIS | Wildfire perimeters and activity | ArcGIS services (NIFC); EFFIS services | Check the terms of each endpoint |
| CISA KEV | Vulnerabilities being actively exploited | JSON and CSV feed; public domain | Not geolocated; links to vendors and products, not places |

## Critical infrastructure (for the dependency map)

Facilities and networks become entities. Outages become events linked to the facilities and regions they affect.

| Layer | Sources | Use |
|---|---|---|
| Power plants, substations, transmission lines | OSM (`power=*`), Global Energy Monitor, WRI, US EIA | OK\* (OSM is ODbL) / OK |
| Pipelines | OSM (`man_made=pipeline`), Global Energy Monitor | OK\* / OK |
| Rail networks | OSM, US NTAD | OK\* / OK |
| Ports, airports | World Port Index, OurAirports, OSM | OK |
| Bridges, dams | US National Bridge Inventory, US National Inventory of Dams, GRanD, OSM | OK / Verify (GRanD) |
| Internet exchanges, data centres | PeeringDB, OSM | Verify / OK\* |
| Submarine cables | TeleGeography submarine cable map | Verify (may be NC) |
| Outages and disruptions | IODA, Cloudflare Radar (already in), EIA, ENTSO-E | Verify |
| US infrastructure layers | HIFLD | Verify; availability of the open portal has changed |

Open data rarely includes true network topology, such as which substation feeds which area. Dependencies we infer should be labelled "possible exposure", with a confidence score, and never shown as fact.

## Military installations

| Sources | Use |
|---|---|
| OSM (`landuse=military`, `military=*`), Wikidata, US DoD MIRTA dataset | OK\* / OK / OK |

- Publishing these is legal in most countries. Some countries restrict photographing, filming or drawing military zones; Turkey's Law No. 2565 on military forbidden and security zones is one example. Check whether that covers a published map layer before including those countries.
- Republish only what the sources already show. Don't derive new sensitive detail; the Strava heatmap revealing bases is the cautionary example.
- Avoid pattern-of-life views that combine bases with live military flight tracking.

## Add these first

| # | Data | Sources | Why |
|---|---|---|---|
| 1 | Entity backbone | Wikidata (CC0), GLEIF company IDs (CC0), OSM / Overture Maps, GeoNames | Ties every layer to real entities: company ↔ facility ↔ ship ↔ place |
| 2 | Aircraft and airport registries | FAA aircraft registry, OurAirports (both public domain) | Replaces adsbdb and adsb.fi, whose terms are a risk |
| 3 | Sanctions lists from the source | OFAC, EU, UK OFSI, UN | Replaces OpenSanctions, which is likely non-commercial |
| 4 | Hazard areas | NWS warning polygons, NHC hurricane tracks and cones (already in), NIFC fire perimeters (already in), USGS river gauges, GOES lightning | Public domain, and exactly what alerts on watched sites need |
| 5 | Real ship positions (AIS) | Finland Digitraffic (CC BY 4.0), Norway Kystverket, NOAA MarineCadastre for history | Actual ships instead of the static port list |
| 6 | Aviation disruptions | FAA NOTAMs, flight restrictions (TFRs), FAA delay status, METAR/TAF airport weather | Airport closures and delays as events |
| 7 | Road events | Incidents, closures and work zones from the 511 APIs we already call; WZDx; NDW / DATEX II | A new layer from existing integrations |
| 8 | Energy and internet infrastructure | Global Energy Monitor (CC BY 4.0), PeeringDB, IODA outages, EIA grid data | Facilities and outages that other data can link to |

## By domain

### Ships, aircraft, ground transport

| Source | Adds | Use |
|---|---|---|
| Digitraffic, Kystverket, MarineCadastre | Live and historical AIS ship positions | OK / OK\* |
| Global Fishing Watch | Fishing activity, ships with AIS switched off | NC |
| World Port Index (NGA) | Every port, with attributes | OK |
| Mobility Database, Transitland Atlas (already in) | Live bus, tram and train positions: ~800 keyless GTFS-RT feeds, the Buses & Trains layer (`/api/transit`). Trains given by stop alone (NYC's subway) or by trip updates alone (BART, Paris, Berlin, Toulouse) are placed on a stop graph from the static GTFS and drawn as estimates. Atlas is CC BY 4.0; Transitland's own API needs a key, and its "history" is past timetables, not positions | Varies per feed |
| Metro sources outside the catalogues (already in) | TfL tube arrivals (keyless, ~50 calls/min anonymous); LA Metro Rail's keyless WebSocket; the CTA Train Tracker map JSON (undocumented, outside CTA's API licence); Toei Subway on ODPT's public endpoint (CC BY 4.0); FGC Barcelona open data; HAFAS JourneyGeoPos for Copenhagen, Vienna, Munich, Hamburg and Frankfurt (undocumented app endpoints, no licence) | Per source; see `src/lib/feeds/transit/sources/extra-feeds.ts` |
| İBB public transport GTFS; Metro İzmir and Tram İzmir GTFS (Mobility Database) (already in) | Timetables for Istanbul's metro, Marmaray, trams and funiculars and İzmir's metro and tram, run as scheduled trains since neither city publishes live rail data. The İBB files are separate Windows-1254 CSVs and their calendar ended 2024-12-31, so services are matched by weekday | İBB Open Data Licence; MDB per feed |
| İETT fleet service (already in) | Every Istanbul bus with a fix, ~6,000, no key; no routes | İBB open data, terms not read |
| USDOT NTD GTFS weblinks (used by the transit catalogue build) | Static timetables for ~1,200 US agencies with their NTD modes; no live feeds. The build reads it for US agency names that Atlas lacks. Every Avail InfoPoint host in it that serves vehicles is already in the catalogue (checked 2026-10-15) | PD |
| NDW travel times, DATEX II v3 (already in) | Measured speed against the usual on ~60,000 Dutch road segments, every minute: the Road Traffic layer (`/api/traffic`). Lines come from NDW's Meetvakken shapefile (`tools/traffic/build-ndw.ts`), which NDW stops publishing on 2027-02-09 | Verify (no licence on opendata.ndw.nu; NDW sets on data.overheid.nl are CC0) |
| TomTom Traffic Flow vector tiles (already in, keyed) | Every road TomTom measures, worldwide, as speed against free flow; the Road Traffic layer draws them when `TOMTOM_API_KEY` is set, through `/api/traffic/flow` with a 6,000-tile daily cap (free tier: 200,000 a month) | Verify (free tier is described as evaluation) |
| Rennes Métropole, Nantes Métropole traffic state (already in) | Road segments with speed and the provider's own traffic class, every 3–5 min, on Opendatasoft (keyless, CORS `*`) | OK (ODbL) |
| Other keyless road-speed feeds (not in yet) | Segments: Strasbourg, Grenoble, València (class only), Hong Kong (speed only; lines need a GDAL build). Points: Digitraffic TMS (with free-flow speed), Madrid, Bison Futé, CITA Luxembourg, Flanders MIV, MnDOT. Reported jams: Autobahn GmbH. Probed 2026-10-15; WebTRIS, Chicago, Paris and NYC are stale or gone | Varies |
| GBFS feeds | Shared bike and scooter availability | Mostly OK |
| Open Charge Map, NREL AFDC | EV charging stations | OK\* / OK |
| adsb.lol (already in) | Live flight positions | OK\* (ODbL, verify) |
| OpenSky (already in) | Live flight positions | NC |
| ADS-B Exchange | Live flight positions | Paid |

### Weather and hazards

| Source | Adds | Use |
|---|---|---|
| NWS, NHC, NDBC buoys, NOAA tides | Warnings, hurricanes, sea conditions | OK |
| ECMWF open data, NOAA GFS (already in: temperature, 10 m wind)/HRRR | Weather forecast models | OK |
| Open-Meteo | Weather forecast API | Paid for commercial use |
| NOAA NEXRAD (on AWS) | Weather radar | OK |
| GOES lightning (GLM) | Lightning | OK |
| NOAA nowCOAST lightning density (already in) | Lightning strikes per 15 min from NLDN and GLD360, the Americas and the Pacific | OK (NOAA Level 5 derived product) |
| Blitzortung | Lightning | NC |
| USGS water gauges, volcano alerts | Floods, eruptions | OK |
| Smithsonian GVP | Weekly volcano reports | Verify |
| NIFC (already in), EFFIS | Wildfire perimeters (US, Europe) | OK |
| OpenAQ | Air quality | OK\* |
| Safecast | Radiation measurements | OK (CC0) |
| EURDEP | European radiation network | Restricted |

### Satellite imagery and cameras

| Source | Adds | Use |
|---|---|---|
| Sentinel-1/2, Landsat, NASA GIBS | Satellite imagery | OK |
| GOES | Near-live imagery of the Americas | OK |
| Himawari | Near-live imagery of Asia-Pacific | Verify |
| FAA WeatherCams, NPS, USGS volcano cams | Government cameras | OK |
| ALERTCalifornia, HPWREN | Wildfire cameras | Verify |
| DeFlock (OpenStreetMap `surveillance:type=ALPR`) | Licence-plate reader locations, US and Canada, as hourly vector tiles: the Plate Readers layer (in use) | OK (ODbL; credit OpenStreetMap contributors and DeFlock) |

### Infrastructure and energy

| Source | Adds | Use |
|---|---|---|
| Global Energy Monitor | Power plants, pipelines, mines, steel plants | OK |
| WRI Global Power Plant Database | Power plants (not updated since 2021) | OK |
| EIA | US electricity grid | OK |
| ENTSO-E | European electricity grid | Verify |
| PeeringDB | Data centres, internet exchanges | Verify |
| OpenCelliD | Cell towers | OK\* |
| IODA | Internet outages | Verify |
| US National Inventory of Dams, National Bridge Inventory | Dams, bridges | OK |

### Companies, money, trade

| Source | Adds | Use |
|---|---|---|
| SEC EDGAR, UK Companies House | Company filings | OK |
| OpenCorporates | Company registries worldwide | OK\* data, paid API |
| USAspending, EU TED | Government contracts | OK |
| World Bank | Economic indicators | OK |
| UN Comtrade, FRED | Trade data, US economic data | Verify |
| IMF PortWatch | Port activity and trade disruption | Verify |

### Geopolitics, security, humanitarian

| Source | Adds | Use |
|---|---|---|
| UCDP | Conflict events | OK |
| ACLED | Conflict events | Paid |
| Global Terrorism Database | Terrorist attacks | NC |
| Stanford Spatial History Lab, European Borders WWII (already in) | Every European polity's borders and war status at each month's end, Feb 1938 – May 1945, plus 81 dated annexations; the History tab's wartime borders. Commercial use prohibited; inform the authors of changes | NC |
| Seshat's Cliopatria (already in) | The world's polities year by year, 3400 BCE to 2024, with Wikipedia and Wikidata links and the empire each belongs to; the History tab's world borders. Replaced André Ourednik's historical-basemaps (54 maps), which drew the Treaty of Sèvres as enacted and cut 1930s Turkey at 39°E. World scale only. CC BY 4.0 | OK |
| Wikidata battles and sieges (already in) | 17k dated battles and sieges with coordinates, 3000 BCE to today; WWI and WWII battles link to their war. CC0 | OK |
| Wikidata treaties and coups (already in) | 1.7k treaties at their signing place and 460 coups at the capital. CC0 | OK |
| NOAA NCEI Natural Hazards (already in) | Significant earthquakes (2150 BCE on), tsunamis and volcanic eruptions, with deaths and damage. US government, public domain | OK |
| SIPRI nuclear explosions 1945–1998, via TidyTuesday (already in) | 2,051 nuclear tests and the two wartime uses, with site and yield. No licence stated | Verify |
| Our World in Data long-run series (already in) | Maddison GDP per person from 1 CE, V-Dem democracy and human rights from 1789, child mortality, literacy, schooling, CO₂ and fertility. CC BY 4.0 | OK |
| ReliefWeb | Humanitarian reports | OK\* |
| HDX | Humanitarian datasets | Varies |
| US State Dept, UK FCDO | Travel advisories | OK |

### Deep time

| Source | Adds | Use |
|---|---|---|
| Cao et al. 2024 plate model, *Geoscience Frontiers* (doi:10.5281/zenodo.13628813) | Plate rotations in a paleomagnetic frame, 1.8 Ga to now, with today's coastlines and continental crust cut by plate; History's deep time turns the continents with them. Built into `public/data/paleo/plates.json` by `tools/build-deep-time.mjs` from the GPlates plate-model repository. CC BY 4.0 | OK |
| PhanDA, Judd et al. 2024, *Science* (doi:10.1126/science.adk3705) | Global mean surface temperature and CO₂ percentiles per stage, 485 Ma to now, into `public/data/paleo/climate.json`. The EJJudd/PhanDA repository states no licence; published as the paper's data | Verify |

### Health

| Source | Adds | Use |
|---|---|---|
| CDC, including wastewater surveillance | US disease data | OK |
| WHO disease outbreak news | Outbreaks | NC |
| WOAH WAHIS | Animal disease outbreaks | Verify |

### Social signals and news

| Source | Adds | Use |
|---|---|---|
| Bluesky firehose | Real-time public posts to geoparse, as we do for Telegram | Verify |
| Wikipedia pageviews and live edits | What the world is reading about right now | OK |
| GDELT (already in) | News events | OK |
| Reddit API | Posts | Paid |

### Space

| Source | Adds | Use |
|---|---|---|
| CelesTrak (already in) | Satellite orbits | OK\* |
| Launch Library 2 (already in) | Rocket launches | Verify |
| Space-Track | Satellite catalogue | Redistribution needs approval |
| JPL Horizons API (already in) | Sun, Moon, planets and every spacecraft with a live ephemeris (`/api/space/sky`, `/api/space/fleet`); orbiter ground tracks and sub-solar points over the Moon and Mars (`/api/space/surface`). Keyless; JPL asks only that it not be flooded, so calls share two slots | OK |
| NASA Trek WMTS (already in) | LRO WAC Moon mosaic, Viking Mars mosaic, stitched into globe textures (`/api/space/texture`) | OK |
| NASA GIBS (already in) | Blue Marble and Black Marble Earth textures for the space view | OK |
| Helioviewer API (already in) | Latest SDO/AIA, SDO/HMI and SOHO/LASCO frames (`/api/space/sun`); SDO's own "latest" JPEGs stopped updating on 2026-09-21 | OK |
| NASA MMGIS rover maps (already in) | Perseverance and Curiosity positions and drive paths; public JSON behind NASA's "Where is the rover?" pages, but undocumented | Verify |
| Yale Bright Star Catalogue, CDS V/50 (already in) | 2,887 stars to magnitude 5.5, built into `public/data/sky/bright-stars.json` by `tools/build-bright-stars.mjs` | OK |
| ESA Gaia archive TAP (already in) | Gaia DR3 stars within 100 ly and Hipparcos-2 (`public.hipparcos_newreduction`) distances for the bright stars, built into `public/data/sky/nearby-stars.json` by `tools/build-nearby-stars.mjs`. Gaia data: ESA/Gaia/DPAC, credit required | OK |
| NASA Exoplanet Archive TAP (already in) | Every confirmed planet with a distance, by host star (`/api/space/exoplanets`, table `pscomppars`). Keyless; acknowledgement requested | OK |
| Minor Planet Center `Distant.txt` (already in) | Orbits of ~8,300 centaurs and trans-Neptunian objects, placed today (`/api/space/outer`) | OK |
| NASA SVS Deep Star Maps 2020 (already in) | Starless Milky Way sky, `public/data/sky/milky-way-sky.jpg` via `tools/build-milky-way-sky.mjs`; public domain | OK |
| Wikipedia REST API (already in) | Lead paragraph and picture for whatever the space view's card shows (`/api/space/wiki`); pictures are Wikimedia Commons files under their own licences, linked to their articles | OK |
| 2MASS Redshift Survey, CDS J/ApJS/199/26 (already in) | 43,463 galaxies with redshifts, all-sky, in 3D (`public/data/cosmos/local-galaxies.bin`, `tools/build-cosmos.mjs`); cite Huchra et al. 2012 and 2MASS | OK |
| SDSS DR17 SkyServer SQL (already in) | A thinned sample of 179k galaxies and 120k quasars with redshifts (`public/data/cosmos/deep-galaxies.bin`); keyless; SDSS asks for its acknowledgement text | OK |
| NASA WMAP via LAMBDA (already in) | 9-year ILC microwave-background map, reprojected to `public/data/cosmos/cmb.jpg` by `tools/build-cmb.mjs`; public domain, credit NASA/WMAP Science Team | OK |
| NASA/JPL-Caltech/R. Hurt face-on Milky Way (already in) | `ssc2008-10a1` / PIA10748, the Galaxy stop's disc, labelled illustration; Spitzer image policy: any use with credit, no implied endorsement | OK |
| JPL SBDB close-approach API | Asteroids passing Earth | OK |

### Cyber

| Source | Adds | Use |
|---|---|---|
| CISA KEV | Vulnerabilities being actively exploited | OK |
| abuse.ch (already in) | Malware and botnet feeds; Recon reads the Feodo botnet C2 list | Verify |
| Shodan InternetDB (already in) | Open ports, software and CVEs Shodan last saw on an IP; Recon's exposed services, vulnerabilities and subnet sweep | NC |
| Shodan CVEDB (already in) | CVSS, EPSS and CISA KEV for one CVE, keyless; Recon's vulnerability scores | Verify |
| GreyNoise Community API (already in) | Whether an IP scans the internet, and benign or malicious; rate-limited | Verify |
| Spamhaus DROP (already in) | Hijacked and do-not-route netblocks | OK\* (free; spamhaus.org/drop/terms) |
| Tor bulk exit list (already in) | Current Tor exit addresses | OK |
| AlienVault OTX (already in) | Threat reports naming an IP or domain, plus allow-lists | Verify |
| crt.sh, SSLMate Cert Spotter, HackerTarget (already in) | Subdomains from certificate logs and passive DNS; Cert Spotter and HackerTarget have small keyless quotas | OK / Verify / Verify |
| RIPEstat (already in) | Prefixes, origin ASNs, peers and registry country | OK\* (attribution) |

### People search

Recon's profile search (`src/lib/intel/recon/people/`). Keyless; behind an account and the `people` and `breach` limits.

| Source | Adds | Use |
|---|---|---|
| Sherlock site list (already in) | Which of ~480 sites have a username, by each site's own rule; checked against made-up handles and each site's known account | OK (MIT) |
| Platform APIs: GitHub, GitLab, Keybase, Gravatar v3, Lichess, Chess.com, DEV, Bluesky, Mastodon, Hacker News, Docker Hub | Name, bio, location, links and picture for a found profile; Keybase proofs, Mastodon verified fields and Gravatar verified accounts tie profiles together. GitHub allows 60 calls an hour without `GITHUB_TOKEN` | Verify (each platform's API terms) |
| Gravatar, GitHub search, keys.openpgp.org | For an email: a Gravatar profile (by SHA-256 of the address), GitHub accounts and commits under it, a PGP key whose owner proved the address. GitHub search allows 10 calls a minute without a token | Verify |
| XposedOrNot (already in) | Breaches an address is in, with year, size and what leaked | Verify |
| Hudson Rock Cavalier (already in) | Whether an email or phone is in infostealer logs; credentials come back redacted | Verify |

### Reference data and population

| Source | Adds | Use |
|---|---|---|
| Natural Earth | Base map data | OK |
| geoBoundaries | Administrative boundaries | OK |
| WorldPop, GHSL, Kontur | Population density, for "people affected" estimates | OK |
| UN World Population Prospects 2024 (already in) | Estimates 1950–2023 and projections 2024–2100 for 237 countries and the world: 22 indicators (population, growth, natural change, births, deaths, migration, median age, fertility, sex ratios, life expectancy by sex and at 65, mortality) in the medium, high, low, constant-fertility and zero-migration variants, with the 95% prediction interval, plus the share aged 65+, the share under 15 and the old-age dependency ratio (65+ per 100 aged 20–64) summed from its age groups, medium variant only (`wpp-2024`). History runs past today on the projections, hatched and labelled "UN projection (… variant)" | OK (CC BY 3.0 IGO) |
| UN World Urbanization Prospects 2025 (already in) | Urban share and urban population by national definition, and the share in cities, towns and rural areas by the degree of urbanisation, 1950–2025 estimates and projections to 2050 (`wup-2025`) | OK (CC BY 3.0 IGO) |
| Waymarked Trails | Hiking route overlay tiles and route API (click-to-inspect) from OpenStreetMap (in use) | OK (CC BY-SA 3.0 DE; moderate rates, no bulk download) |

### Projections (researched 2026-10-16)

Country-level projections History could run past today on. Each is shown only as its publisher publishes it, labelled with the publisher, scenario and range.

| Source | Adds | Use |
|---|---|---|
| World Bank Climate Change Knowledge Portal (already in) | CMIP6 country means, bias-adjusted to ERA5, 1950–2100 under five SSPs with the models' 10th–90th percentile, and ERA5 observed 1950–2025 (`wb-cckp`). 61 CMIP6 and 96 ERA5 variables exist; 8 are in | OK (CC BY 4.0, per the portal's metadata page; the AWS registry's ODbL listing isn't the portal's own) |
| OECD Economic Outlook long-term scenarios (already in) | GDP per person (constant PPP) and gross CO₂ for 48 countries, yearly to 2100 in six scenarios (`oecd-lt-eo117`). The data marks no history, so 2024 on is treated as the scenario (the scenarios agree to 2026; CO₂ history ends 2023) | OK (OECD data terms allow commercial use with attribution) |
| US Census Bureau International Database (already in) | Population, fertility, life expectancy, infant mortality and median age for 225 countries to 2100 (`census-idb`). Years after each country's last revision (census.gov's countries-and-areas table, 2008–2025) are marked as Census projections; Gaza and the West Bank are left out, as one shape can't show two values | OK (CC0, per the API metadata only); keyless zip, 80 MB |
| Wittgenstein Centre (WIC 2023) | Population by education and mean years of schooling, 200 countries, SSP1–5, **5-yearly** to 2100 | OK (CC BY 4.0 on Zenodo V15); five-yearly values blend between published years, marked "≈". Not in yet: Zenodo's mean-years file isn't in years (values 0–2), its population counts start in 2020 (about 600 MB for five scenarios), and the Data Explorer's 1950–2100 files are R `.rds` |
| World Bank Global Economic Prospects (already in) | Real GDP growth for about 150 economies, 2023–2025 and forecasts 2026–2028 (`wb-gep`; the June 2026 tables mark 2025 an estimate) | OK (CC BY 4.0) |
| OECD-FAO Agricultural Outlook 2026–2035 | Food production and consumption for about 35 countries, yearly to 2035 | OK (OECD data terms); the file doesn't flag projected years |
| WRI Aqueduct 4.0, INFORM Climate Change, UNDP Human Climate Horizons | Water stress (2030/2050/2080), climate risk (2050s/2080s), heat deaths, labour, energy and sea level (20-year means) | OK (CC BY 4.0 / CC BY 4.0 / CC BY 3.0 IGO); window means need a drawing mode first |
| IMF World Economic Outlook (already in, October 2026) | GDP growth, GDP per person, inflation, unemployment, government debt and population for 196 economies to 2031; each series' last actual year is the IMF's own (`imf-weo`; `npx tsx tools/import/fetch.ts imf` says where to get the file) | Needs permission: commercial reuse needs the IMF's written permission, and its terms forbid automated bulk download, so the user downloads the file by hand; personal use only until the IMF agrees |
| IHME forecasts, Climate Action Tracker, IEA World Energy Outlook, UNEP Emissions Gap, NGFS, UNAIDS | Health, emissions and energy pathways | Avoid: non-commercial or restricted, and IHME needs a login |

## Derived data we compute ourselves

Raw public data is free to everyone; signals computed from it are ours.

- **GPS jamming map** from the position-quality fields in ADS-B, the method gpsjam.org uses.
- **Shipping signals from AIS:**
  - port congestion and how long ships wait;
  - ships switching off AIS near sanctioned ports;
  - ships meeting at sea for transfers.
- **Flight disruption index:** diversions and cancellations, found by comparing flight tracks with schedules.
- **Camera counts:** traffic, crowds, snow and flooding, from the existing camera vision.
- **Event fusion:** one incident reported across news, Telegram, Bluesky, cameras and sensors becomes a single event with a confidence score.
- **History for every feed:** time-travel and trend queries. This is the natural paid feature.

## Avoid or handle carefully

- **Data about private individuals:** people search, breach dumps, infostealer logs, home cameras, phone lookups. GDPR and CCPA risk, and the fastest way to get reported while building in public.
- **Feeds that forbid redistribution:** Flightradar24, FlightAware, MarineTraffic, LiveATC, Broadcastify, Space-Track (without approval), and the Reddit API.
- **Non-commercial sources:** ACLED, GTD, Global Fishing Watch, OpenSky, Blitzortung, WHO. Keep them out of the hosted product unless we get a licence.

## a lot of data


-- https://data-usdot.opendata.arcgis.com/search
-- . Access OpenInfraMap's actual map layers
The website itself exposes vector-tile endpoints. Its frontend source defines these layer URLs: 

GitHub



Layer	Tile endpoint
Power	https://openinframap.org/map/power/{z}/{x}/{y}.pbf
Petroleum	https://openinframap.org/map/petroleum/{z}/{x}/{y}.pbf
Telecoms	https://openinframap.org/map/telecoms/{z}/{x}/{y}.pbf
Water	https://openinframap.org/map/water/{z}/{x}/{y}.pbf
Other pipelines	https://openinframap.org/map/other_pipeline/{z}/{x}/{y}.pbf
These are rendering-oriented vector tiles, not a bulk-download API for a complete infrastructure database. You can inspect individual tiles, but extracting the entire world's infrastructure from them would be cumbersome and could run into service restrictions.
The underlying OSM data is a better starting point for bulk retrieval.
3. Example: download power infrastructure
For a quick test, use Overpass Turbo with this query:
[out:json][timeout:60];
(
  nwr["power"="plant"]({{bbox}});
  nwr["power"="substation"]({{bbox}});
  nwr["power"="generator"]({{bbox}});
  nwr["power"="line"]({{bbox}});
  nwr["power"="tower"]({{bbox}});
);
out geom;


Open Overpass Turbo, paste the query, zoom to your desired region, and run it. You can export the results for processing with Python, GeoPandas, or PostGIS.
For a global dataset, download a regional or planet-scale .osm.pbf extract from Geofabrik and filter it locally. Relevant OSM tags include:
- power=plant, power=generator
- power=substation, power=transformer
- power=line, power=cable, power=tower
- man_made=pipeline
- telecom=*
- waterway=* and other water-related tags
The exact tags and coverage vary by infrastructure type. OSM is community-maintained, so completeness and accuracy are not uniform worldwide.


## Next step

- [ ] Verify each source in "Add these first": licence, endpoint, auth, rate limits and update frequency.
