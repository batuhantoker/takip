# Data licences

The MIT licence in [`LICENSE`](../LICENSE) covers TAKIP's code. The data, pictures and models in this repository keep
their own licences, listed here: everything under `data/`, `public/data/`, `public/vendor/`, and the `*.generated.ts`
files that hold third-party lists. If you reuse one of them, follow its licence, not MIT's.

## Kept out of this repository

takip.dev serves some data whose terms don't allow redistributing it. Those files are gitignored and copied to the server
by `tools/deploy-nuc.sh` (`PRIVATE`); a checkout without them simply has fewer cameras, measures and pictures.

| File | Source | Why it isn't here |
|---|---|---|
| `data/private/cameras/openwebcamdb.json` | OpenWebcamDB | Non-commercial; aggregators and redistribution excluded |
| `data/private/cameras/skyline.json` | SkylineWebcams | No copying of their content, in whole or in part |
| `data/site/topics/indicators.json` | History's measures (SIPRI, IMF, IHME-derived series and others) | SIPRI allows no reproduction of more than 10% without permission |
| `public/data/submarine-cables.json` | TeleGeography | CC BY-NC-SA |
| `public/data/sky/deep/{lmc,smc,m31,m33,m87}*.jpg` | DSS2 via CDS hips2fits | Non-commercial use only |

## Share-alike

These files are derived from share-alike sources and are under those licences, not MIT:

| File | Licence | Attribution |
|---|---|---|
| `data/site/topics/alpr.json`, the ALPR counts in `data/site/us-areas.json` | ODbL 1.0 | © OpenStreetMap contributors, via DeFlock |
| `data/site/topics/hiking.json` | ODbL 1.0 | © OpenStreetMap contributors, via Waymarked Trails |
| `scratch/public-webcams-places.json` | ODbL 1.0 | © OpenStreetMap contributors (Nominatim) |
| `src/lib/feeds/aviation/airlines.generated.ts` | ODbL 1.0 | OpenFlights `airlines.dat` |
| `data/site/topics/muslim-share.json` | CC BY-SA 4.0 | Wikipedia, "Islam by country" (oldid 1375390081) |
| `data/site/topics/jewish-communities.json` | CC BY-SA 4.0 | Wikipedia, "Jewish population by city" (oldid 1378686172) |

## Attribution

- **Places:** GeoNames (CC BY 4.0) for `data/site/gazetteer.json`, `towns.json`, the topic tables keyed by GeoNames id,
  and `tools/import/datasets/capitals.csv`. Wikidata (CC0) for names and `data/site/topics/attractions.json`.
- **Boundaries:** Natural Earth (public domain), `public/data/boundaries/`, `world-land.generated.ts`.
- **US government (public domain):** USGS ComCat (`data/site/earthquakes.json`), NOAA NCEI hazards and IGRF-14
  (`topics/hazards.json`, `topics/aurora.json`), NGA World Port Index (`topics/ports.json`), OurAirports and NOAA
  (`topics/flights.json`, `topics/weather.json`), the US Census (`us-areas.json`).
- **Transit:** Transitland Atlas (CC BY 4.0) and the Mobility Database (`feeds.generated.ts`). Stop graphs and timetables
  keep each agency's GTFS licence, named in each feed's `license` field: Etalab 2.0, ODbL (Île-de-France Mobilités,
  Toulouse), CC BY (VBB and others), the MTA's data feed agreement, "Powered by TfL Open Data" (contains OS data ©
  Crown copyright), and İBB's open data licence (`schedules.generated.ts`).
- **Cameras:** Fintraffic Digitraffic, CC BY 4.0 (`digitraffic-pairs.generated.ts`). The other camera lists hold ids,
  names and positions published by each road authority.
- **Deep-sky pictures:** ESA/Webb, ESA/Hubble, ESO and NOIRLab/AURA, CC BY 4.0; each picture's credit is in
  `src/lib/space/deep/deep-sky.generated.ts`.
- **Stars:** "This work has made use of data from the European Space Agency (ESA) mission Gaia, processed by the Gaia
  Data Processing and Analysis Consortium (DPAC)", credit ESA/Gaia/DPAC (`galactic-stars.bin`). Hipparcos-2 (van Leeuwen
  2007) and the Yale Bright Star Catalogue (Hoffleit & Warren 1991, CDS V/50).
- **Sky:** NASA SVS Deep Star Maps 2020 (public domain), `milky-way-sky.jpg`; NASA/JPL-Caltech/R. Hurt,
  `milky-way-face-on.jpg`; Planck 2015 SMICA, ESA and the Planck Collaboration, `cosmos/cmb.jpg`.
- **Large-scale structure:** 2MRS (Huchra et al. 2012), SDSS DR17 (the SDSS-IV acknowledgement), NED and SIMBAD, VizieR
  catalogues (Douglass 2023, Einasto 1994, Arsenov 2025, Pustilnik 2019, Liivamägi 2012, Tempel 2014), Cosmicflows-4
  basins and flows (Dupuy & Courtois 2023; Courtois et al. 2023).
- **Deep time:** Cao et al. 2024 plate model, CC BY 4.0, doi:10.5281/zenodo.13628813 (`paleo/plates.json`); PhanDA,
  Judd et al. 2024, doi:10.1126/science.adk3705 (`paleo/climate.json`).
- **History tables:** Correlates of War Territorial Change v6 (`tools/import/datasets/cow-territorial-rows.csv`), free
  with citation.
- **Models:** NASA 3D Resources (SOHO, STEREO), `public/data/models/`.
- **Basemap style:** OpenMapTiles Dark Matter (design CC BY 4.0, code BSD-3), derived from CARTO; map data © OpenStreetMap
  contributors.
- **Bundled software:** YOLOX (Megvii, Apache-2.0), MapLibre GL (BSD-3), Draco (Google, Apache-2.0),
  mapbox-gl-rtl-text (BSD-2), each in `public/vendor/`.
