# Map detail and ownership

> **Researched 2026-10-13.** How the bare map can show much more, and how a click can answer "who owns or runs this?". Companion to [`data-roadmap.md`](./data-roadmap.md) (live and historical data) and [`data-inventory.md`](./data-inventory.md). ✓ marks claims checked against the repo or the provider's page. Licences and limits are quoted from each provider's own page.

## 0. Fix first

| Issue | Evidence | Fix | Effort |
|---|---|---|---|
| **The dams layer shows private individuals' names** | ✓ `popupHtml` (`src/lib/reference/view.ts:24`) prints every property. NID `ownerNames` is one of them. 60,297 of 92,602 dams have owner type 1 (Private), and many of those are personal names ("Last, First"). | Show the owner type (codes 1–7) and hide the names of private owners. The same rule then applies to every owner field we add. | S |
| **Our basemap use breaks CARTO's terms** | ✓ [Terms](https://carto.com/legal/basemap-terms), updated 2026-09-29: §9.c.3 forbids "proxying or caching the content on the server side", and §3.b requires an API key. `/api/proxy-tiles` caches CARTO tiles for a year, and `src/lib/map/create.ts` sends no key. With ads, "Commercial Use" has a fair-use cap of 1M tiles a month. | **Done 2026-10-13:** OpenFreeMap is the default, CARTO an option in Map options (browser-direct, with `NEXT_PUBLIC_CARTO_API_KEY`), and the proxy is gone. Self-hosting (§2 #6) stays for later. | — |
| **Esri imagery is used without a key or credit** | ✓ `src/app/page.tsx:72` and `use-basemap.ts:124` call `server.arcgisonline.com` directly, with no "Powered by Esri" credit | A Location Platform key and the credit (2M free tiles, then $0.15 per 1,000), or NASA GIBS | S |
| **Other terms flagged in passing** | TeleGeography's cable data is "restricted to paying subscribers", and we ship `submarine-cables.json`. OpenSanctions is CC BY-NC, which affects `/api/osint/sanctions`. | Licence decision | — |

## 1. Detail we already download but don't draw

The CARTO tiles use the OpenMapTiles schema, the same one OpenFreeMap uses. Eight decoded tiles (Istanbul, Manhattan, the Ruhr, Ramstein, the Alps, Europe, the world) carry all of this. None of it is clickable today; clicking bare ground does nothing (`clickable-layers.ts`).

| Source-layer | Contents | Drawn today |
|---|---|---|
| `mountain_peak` | name, height, rank | never |
| `aerodrome_label` | name, IATA, ICAO, class, including military ("Ramstein Air Base") | never |
| `poi` | 5.6–6.3k per city tile at zoom 14, ranked: stations, ferry terminals, hospitals, police, courts, government offices, embassies, places of worship | stadiums and parks only, zoom 15+ |
| `landuse` | **military**, industrial, railway, hospital, university, quarry | residential, cemetery, stadium |
| `landcover` | glacier, rock, sand, wetland, farmland | wood, grass |
| `park` | named protected areas | fills only, no names |
| `transportation` | rail from zoom 8, subway, tram, **ferries** | rail from zoom 13 |
| `transportation_name` | route shields | street names only |
| `building` | `render_height`, colour | flat fill unless 3D is on |
| `boundary` | `disputed`, `claimed_by` | plain lines |
| `housenumber` | house numbers | from zoom 17, not clickable |

## 2. Map detail, ranked

| # | What the user sees | Source | Licence (commercial) | Size | Effort |
|---|---|---|---|---|---|
| 1 | **Done 2026-10-13** (`src/lib/basemap/detail-layers.ts`): peaks with heights, glaciers, rock and sand, named protected areas, **military land** hatched, tints for industry, rail yards and campuses | the tiles in §1 | ODbL data, CC BY style (y) | 0 | S |
| 2 | **Done, except road shields:** rail from country zoom, subway and tram, **ferries**, airport codes, military airfields | same | same | 0 | S |
| 3 | **Done:** points of interest from zoom 14: transport, hospitals, civic buildings, museums and monuments, stadiums, colleges | same | same | 0 | S–M |
| 4 | **Partly done:** clicking a place name opens its Wikipedia lead (`/api/map/wiki`). Still to do, a **"what is here?" card on any click:** what's under the cursor (road, building height, land use, POI, peak), coordinates, elevation | `queryRenderedFeatures`, the terrarium tiles we already use | ODbL, PD / CC BY (y) | 0 | S–M |
| 5 | **The same card, from the server:** admin area, time zone, population within 1 km, land cover, climate, nearest town, place name, nearby Wikipedia articles and photos | Local: geoBoundaries, `geo-tz`, GHS-POP, ESA WorldCover (range reads), Köppen, GeoNames. Upstream: Photon, Wikipedia geosearch, cached for 7 days | CC BY, ODbL, CC BY-SA (y); Photon's public instance: unknown | ~6 GB local | M |
| 6 | **Off CARTO:** the same look from our own tiles, no proxy | OpenFreeMap weekly planet PMTiles (OpenMapTiles 3.16), with self-hosted glyphs and sprite. Protomaps later (139 GB, building heights; needs a new style). | MIT + ODbL (y) | **87 GB**, fits the NUC | M |
| 7 | Hillshade at every zoom, contours from zoom 11 | the terrarium tiles + MapLibre `hillshade` + `maplibre-contour` | PD / CC BY (y) | remote | S |
| 8 | **Infrastructure like OpenInfraMap:** power lines by voltage, substations, plants, wind, masts, data centres, pipelines, wells, dams | our own weekly OSM extract (`osmium` → planetiler, using OpenInfraMap's BSD-3 zoom rules) | ODbL (y) | output ~1–3 GB (est.) | M–L |
| 9 | Power plants, mines, steel, **LNG terminals**, pipelines, current to 2026 | GEM trackers (free, via a form); WRI GPPD (2021) as a stand-in | CC BY 4.0 (y) | 182k power sites | M |
| 10 | Ports worldwide, with size, depth and services | NGA World Port Index API | public domain (inferred) | 1.3 MB | S |
| 11 | Dams and reservoirs worldwide | Global Dam Watch v1.0 | CC BY 4.0 (y), asks that the raw set not be rehosted | 70 MB | S |
| 12 | EEZs, 12 nm limits, maritime boundaries | Marine Regions | CC BY 4.0 (y), "not for legal or navigational purposes" | 122 MB | S–M |
| 13 | Refineries, LNG plants, offshore platforms, mine outlines | OGIM v3.0; Maus mining polygons v2 | CC BY 4.0; CC BY-SA 4.0 (y) | subsets | M |
| 14 | A compliant satellite view, yesterday's Earth, **night lights** | Esri with a key and credit; NASA GIBS VIIRS daily and Black Marble; EOX Sentinel-2 cloudless (terms unresolved, so ask EOX) | GIBS CC0 (y) | remote | S |
| 15 | Denser POIs and buildings from zoom 15 | Overture places + buildings PMTiles | CDLA-P 2.0 / ODbL (y) | 18 + 181 GB | M–L |

**Restrictive terms (sort later):**
- WDPA: non-commercial, and no interactive web maps. The OSM protected areas are already in the tiles.
- PeeringDB: all rights reserved.
- PCH IXPs: CC BY-NC-SA.
- GRanD: non-commercial.

**Not usable:**
- Overpass for per-click lookups: about 10k requests a day.
- A self-hosted Nominatim or Photon: needs 64–128 GB of RAM.

**Zoom ladder.** Each layer gets one zoom band, and within it `rank` and `class` decide what shows.

| Zoom | Show |
|---|---|
| World (0–3) | Faint hillshade, ice, disputed borders dashed, faint EEZ lines; night lights optional |
| Country (4–7) | Top-rank peaks, national parks, ferries, shields, international and military airfields, lines of 220 kV and up, plants of 500 MW and up, large ports and dams, 12 nm limits |
| City (8–12) | All peaks, land-use tints and military hatching, all rail, lines over 24 kV, substations, all ports, dams and mines, contours from 11 |
| Street (13+) | POIs by rank from 14, buildings shaded by height, pylons, house numbers from 17, the full click card |

## 3. Who owns or runs it, ranked

| # | What | Coverage | Owner names | Access | Licence (commercial) | Effort | On the map |
|---|---|---|---|---|---|---|---|
| 1 | **PAD-US 4.1** (USGS) | US public land and easements | Public owner and manager, kept separate | Keyless FeatureServer; 1.5 GB bulk | PD (y) | M | Polygons and a click card |
| 2 | **GEM trackers + Global Energy Ownership Tracker** | Global: power, mines, steel, LNG, gas pipelines | Companies, with % and parent; people anonymised | Form per release (**you submit it**) | CC BY 4.0 (y) | M | Facility → owner → parent |
| 3 | **GLEIF LEI levels 1 and 2** | Global legal entities | Direct and ultimate parents; never people | Keyless API (60/min) and a daily Golden Copy | CC0 (y) | M | Parent chain, from a local table |
| 4 | **US statewide parcels: Connecticut, North Carolina, Wisconsin, Montana** | 1.3M / 5.9M / 3.6M / 0.9M parcels | People, companies, public bodies | Keyless FeatureServers | CT CC0, NC "free and unrestricted", WI free, MT bans mailing lists (y) | S | Click lookup through our server |
| 5 | **France: Etalab cadastre + DGFiP legal-entity owners** | All of France | Companies and public bodies (SIREN); sole traders excluded | Keyless bulk | Licence Ouverte 2.0 (y) | M | Parcels from zoom 15 and an owner card |
| 6 | **Wikidata** owned by / operator / parent (P127, P137, P749) | Global, sparse | Mostly companies | Nightly query extract | CC0 (y) | S–M | Enriches cards |
| 7 | **NID dams** (we already hold it) | 92.6k US dams | Owner types 1–7 | `data/reference` | PD (y) | S | §0 fix |
| 8 | **EIA-860** | US plants of 1 MW or more | Operator and co-owners with % | Keyless ZIP | PD (y) | M | Plant card |
| 9 | **FAA airport records (NASR)** | US airfields | Owner type and names, **plus phone numbers** | Keyless CSV, every 28 days | federal work (unverified) | S | Type, plus names of public and company owners only |
| 10 | **MSHA mines** | US mines | Operator and controller | Keyless, weekly | federal work (unverified) | S | Points |
| 11 | **BLM, USFS, NPS and FWS land** | US federal land | Managing agency | Keyless ArcGIS | federal (y) | S | Detail on the PAD-US card |
| 12 | **OSM `operator=` / `owner=`** | Global | Mixed | Our own extract | ODbL (y) | M | Fallback |
| 13 | **UK Companies House** (persons with significant control) | UK companies | Corporate parents; individuals hidden | Free key, or keyless bulk | No conditions on use (y) | M | Parent chain |
| 14 | **Protected areas: Canada, Australia, Natura 2000** | National | Governance type and manager | Keyless | OGL-Canada / CC BY (y) | S–M | Polygons |
| 15 | **HM Land Registry (England and Wales)** | INSPIRE polygons; company owner lists (CCOD/OCOD) | Companies only, not joinable to polygons in bulk | INSPIRE keyless; CCOD/OCOD free account | INSPIRE OGL (y); CCOD **no** without Royal Mail permission | L | After legal review |

**Not usable, or owner names only under a licence:**
- **Can't use as-is:**
  - Regrid: a 30-day trial only.
  - OpenCorporates: free only for "permitted users", which excludes corporations.
  - LINZ titles: a personal-data licence.
  - Denmark's owner register: needs MitID Erhverv.
- **No open owner names:** the Netherlands (€3.70 a lookup), Spain, Norway, Finland, Australia, British Columbia, Québec.
- **Turkey (TKGM parcel lookup):** don't integrate. Its terms forbid using its web services without permission and ban commercial use, and owner names fall under KVKK.
- **US gaps:**
  - County assessors usually have owner names, but their licences differ county by county.
  - Florida, Massachusetts, Vermont, Arkansas, Minnesota and New York publish owner fields, but their licences are unknown.

## 4. Privacy rule for owner data

Privacy is separate from licensing: a permissive licence doesn't make it fine to show a person's name.

- **Who is named:**
  - Show the owner type everywhere.
  - Name companies and public bodies where the licence allows it.
  - Show **"Private individual"** by default. Show a person's name only where it's public record (US assessor, NID, FAA) and the user opts in on that card.
  - Never show phone numbers or mailing addresses.
- **Click only, served from our server:**
  - No owner names in tiles, search, export, or the public API and MCP.
  - Send `noindex`.
  - Keep caches short, and never store individuals' names as entities.
- **Never combine owner names with:** live tracking, sale prices, or anything that works as a mailing list.
- **On every card:** the source, an as-of date, and a correction/takedown link.
- **Legal footing:** under KVKK and GDPR, TAKIP is the data controller even for US public-record names. Write a legitimate-interest assessment before showing any.

## 5. How ownership fits the model

- **New link relations:**
  - ✓ `core_link_rel` has `operates`, but nothing for ownership. Add `owned_by`, `managed_by` and `consolidated_by` (parent company).
  - `core_entity_link` needs a nullable `share` column for ownership %.
- **New identifier schemes:** `lei`, `gem`, `permid`, `eia_plant`, `eia_utility`, `nid`, `faa_site`, `msha`, `siren`, `uk_company`.
- **Entities:** facilities become `facility` entities and owners become `org` entities. Both types already exist.
- **Where the data lives:**
  - Large polygon sets (PAD-US, French parcels, protected areas) go into PMTiles or `geo/<layer>@v.db`.
  - Point sets (GEM, EIA, MSHA, WPI) fit `/api/reference`.
- **One click route, `/api/ownership?lon&lat`:**
  1. Pick the sources for that place.
  2. Walk the parent chain in the local GLEIF and Wikidata tables.
  3. Apply the privacy rule before replying.

## 6. Build first

1. **§0 fixes:** dam owner names; a CARTO key and no proxy; the Esri key and credit.
2. **Draw what we already download** (§2 #1–3), and the **"what is here?" card** (§2 #4, then the server half of #5).
3. **Hillshade** (§2 #7): the biggest gain at world zoom.
4. **Ownership v1:**
   - `/api/ownership` for the four US states and PAD-US.
   - GLEIF parent chains.
   - Submit the GEM form now, so the global facility → owner → parent layer can follow.
5. **Self-hosted basemap** (§2 #6), before AdSense goes live at the latest.
6. **Worldwide reference points:** World Port Index, Global Dam Watch, GPPD/GEM, then the OSM infrastructure tiles.
