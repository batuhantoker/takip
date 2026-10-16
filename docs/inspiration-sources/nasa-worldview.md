# NASA Worldview and GIBS: imagery layers and features

_Surveyed 2026-10-15 at [nasa-gibs/worldview](https://github.com/nasa-gibs/worldview) commit `176a21f` (v5.7.0). Paths starting `web/`, `config/` or `tasks/` are in that repo. Tile probes were single GETs made on 2026-10-15._

**Licence.**
- **Worldview's code** is under the NASA Open Source Agreement 1.3, which is file-level copyleft. Its config JSON (measurements, stories, natural events) counts as code too. Shipping it in a minified bundle obliges us to publish the source of those files.
- **So for TAKIP:** copy no Worldview files. Reimplement the techniques, and build the layer catalogue from GIBS GetCapabilities.
- **The imagery** is a different matter, under [NASA's data-use policy](https://www.earthdata.nasa.gov/earth-observation-data/data-use-policy): NASA-mission data is CC0 and allowed commercially. Credit GIBS and NASA Worldview, use no NASA logo, and imply no endorsement. Layer-specific terms are below.

## How Worldview works

- **Stack:** React 19, Redux 5 and OpenLayers 10. All state round-trips to the URL (`web/js/location.js`).
- **Catalogue:** 1,346 layer stubs in `config/default/common/config/wv.json/layers/**`, grouped into 142 measurements.
  - A build step (`tasks/build-options/getCapabilities.js`, `mergeConfigWithWMTS.js`) merges GIBS GetCapabilities into them.
  - Worldview itself uses EPSG:4326, 3413 and 3031, never 3857. TAKIP would read the 3857 endpoint, which Worldview doesn't use.
- **Rendering:** `web/js/map/layerbuilder.js` builds WMTS sources with `?TIME=`.
  - Near the dateline it draws the previous and next day too.
  - It recolours palettes per pixel (`web/js/ol/lookupimagetile.js`).
- **Other services:** EONET v3, CMR granule search, GIBS DescribeDomains, layer metadata, an undocumented `imagestat` service behind charting, the Esri geocoder, EUMETSAT WMS, and HLS through openveda titiler.

## What GIBS serves

Measured 2026-10-15.

- **Layers:** 3857 and 4326 list the same 1,330 layers. 26 more exist only in the polar projections.
- **Template for MapLibre**, verified as 200 for 12 raster layers:
  ```
  https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{LayerId}/default/{Time}/GoogleMapsCompatible_Level{N}/{z}/{y}/{x}.{jpg|png}
  ```
  - Static layers drop `{Time}`.
  - `maxzoom` must equal `N`: one level past it returns **400**. MapLibre overzooms past that.
- **Time:**
  - Daily layers take `YYYY-MM-DD`. Sub-daily layers take `YYYY-MM-DDTHH:MM:SSZ`, rounded down to the interval start.
  - `default` is the GetCapabilities default, **not** the wall clock. For live daily layers use yesterday UTC, or the DescribeDomains end.
- **DescribeDomains** works in 3857: `…/epsg3857/best/1.0.0/{id}/default/GoogleMapsCompatible_Level{N}/all/{start}--{end}.xml`.
  - Sub-daily archives have gaps (`GOES-East` at 2026-07-15T18:00Z returned 404).
  - GetCapabilities lists only the last ~100 sub-daily intervals, so snap times with DescribeDomains.
- **Vector tiles:** 123 MVT layers are advertised in 3857, but every 3857 `.mvt` returned **404**. The same tiles load in 4326, which MapLibre can't use. Re-probe before relying on them.
- **Headers:** CORS is `*`, so no proxy is needed. **Every dated tile is `cache-control: max-age=0, no-store`**; static layers get `max-age=259200`. Animation preloading therefore needs an in-memory cache, such as `maplibregl.addProtocol` with an LRU, or a caching proxy.

## Layers

Counts are unique layer IDs per measurement group. A layer can sit in more than one group.

| Category | Count | Best layer IDs | Projections | Cadence | TAKIP today |
|---|---|---|---|---|---|
| True colour | 31 | `MODIS_Terra_CorrectedReflectance_TrueColor`, `VIIRS_NOAA20_…`, `VIIRS_NOAA21_…`, `MODIS_Terra_CorrectedReflectance_Bands721` | 3857 z9 jpg | P1D; Terra from 2000-02-24. Today's tile is partial until the swaths finish. | **missing** on the map. A space-view texture only (`src/lib/space/worlds.ts:58`); the Esri basemap is undated. Planned in `architecture/map-detail.md:49`. |
| Geostationary | 11 GIBS + 10 EUMETSAT | `GOES-East_ABI_GeoColor`, `GOES-West_ABI_GeoColor`, `Himawari_AHI_Band13_Clean_Infrared` (no Himawari GeoColor). Europe and Africa: EUMETSAT WMS `mtg_fd:rgb_geocolour` on `view.eumetsat.int/geoserver/wms` (3857 GetMap returned 200) | 3857 z6–7 | PT10M, 10–20 min behind; the archive has gaps | **partial**: hourly GMGSI infrared (`src/lib/feeds/weather/clouds/tiles.ts`) |
| Fires | 20 | `GOES-East_ABI_FireTemp`, `GOES-West_ABI_FireTemp` (raster) | raster 3857 z7; MVT is 4326-only | PT10M | **has** FIRMS points (`src/app/api/(feeds)/fires/route.ts`) |
| Night lights | 12 | `VIIRS_SNPP_DayNightBand_At_Sensor_Radiance`, `VIIRS_Black_Marble` | 3857 z8 | P1D from 2020-11-18; Black Marble 2012 and 2016 | **partial**: space texture only |
| Aerosols and dust | 76 | `MODIS_Combined_Value_Added_AOD`, `OMPS_Aerosol_Index`, `GOES-East_ABI_Dust` | 3857 z6–7 | P1D; dust PT10M | **missing** |
| Air quality | 70 | `TROPOMI_L2_Nitrogen_Dioxide_Tropospheric_Column`, `TEMPO_L3_NO2_Vertical_Column_Troposphere` (North America, hourly), `OMI_Nitrogen_Dioxide_Tropo_Column` | 3857 z6–7 | P1D from 2018; TEMPO hourly | **partial**: CAMS city points (`src/app/api/(feeds)/air-quality/route.ts`) |
| Volcanic SO2 | 21 | `TROPOMI_L2_Sulfur_Dioxide_Total_Vertical_Column`, `OMPS_SO2_Planetary_Boundary_Layer` | 3857 z6 | P1D | **missing**; volcano points only |
| Sea surface temperature | 63 | `GHRSST_L4_MUR_Sea_Surface_Temperature`, `…_Anomalies` | 3857 z7 | P1D from 2002 | **missing** |
| Sea ice and snow | 31 + 25 | `GHRSST_L4_MUR_Sea_Ice_Concentration`, `MODIS_Terra_NDSI_Snow_Cover` | 3857 z7–8 | P1D | **missing** |
| Floods | 14 | `VIIRS_Combined_Flood_2-Day`, `OPERA_L3_Dynamic_Surface_Water_Extent-Sentinel-1` (30 m, z12) | 3857 z9 / z12 | P1D | **partial**: flood events as points |
| Precipitation | 41 | `IMERG_Precipitation_Rate_30min`, `IMERG_Precipitation_Rate` | 3857 z6 | PT30M about 6 h behind; daily from 2000-06 | **partial**: RainViewer radar, newest frame only |
| Land surface temperature | 48 | `MODIS_Terra_Land_Surface_Temp_Day` | 3857 z7 | P1D from 2000 | **partial**: GFS 2 m air temperature |
| Vegetation | 74 | `VIIRS_SNPP_NDVI_8Day`, `MODIS_Terra_L3_NDVI_16Day`, `Landsat_WELD_NDVI_Global_Monthly` (1984–2001) | 3857 z8–12 | 8-day / 16-day / monthly | **missing** |
| Reference and orbit tracks | 28 + 74 | `Coastlines_15m`; orbit tracks are MVT | — | static / P1D | not needed: TAKIP has its own basemap and computes tracks from TLEs |

### The 25 most useful for a live map
All are raster, all are in 3857, and all were verified 200 except #25. Each line gives the ID, then level · cadence · first date.

1. `MODIS_Terra_CorrectedReflectance_TrueColor` (L9 · P1D · 2000-02-24)
2. `VIIRS_NOAA20_CorrectedReflectance_TrueColor` (L9 · P1D · 2018-01-05)
3. `VIIRS_NOAA21_CorrectedReflectance_TrueColor` (L9 · P1D · 2023-02-10)
4. `MODIS_Terra_CorrectedReflectance_Bands721` (L9 · P1D · 2000)
5. `GOES-East_ABI_GeoColor` (L7 · PT10M)
6. `GOES-West_ABI_GeoColor` (L7 · PT10M)
7. `Himawari_AHI_Band13_Clean_Infrared` (L6 · PT10M)
8. `GOES-East_ABI_FireTemp` (L7 · PT10M)
9. `GOES-West_ABI_FireTemp` (L7 · PT10M)
10. `VIIRS_SNPP_DayNightBand_At_Sensor_Radiance` (L8 · P1D · 2020-11-18)
11. `VIIRS_Black_Marble` (L8 · P1Y · 2012, 2016)
12. `MODIS_Combined_Value_Added_AOD` (L6 · P1D · 2017)
13. `OMPS_Aerosol_Index` (L6 · P1D · 2012)
14. `GHRSST_L4_MUR_Sea_Surface_Temperature` (L7 · P1D · 2002)
15. `GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies` (L7 · P1D · 2019)
16. `GHRSST_L4_MUR_Sea_Ice_Concentration` (L7 · P1D · 2002)
17. `MODIS_Terra_NDSI_Snow_Cover` (L8 · P1D · 2000)
18. `VIIRS_Combined_Flood_2-Day` (L9 · P1D · 2025-06-03)
19. `IMERG_Precipitation_Rate_30min` (L6 · PT30M)
20. `IMERG_Precipitation_Rate` (L6 · P1D · 2000-06-01)
21. `VIIRS_SNPP_NDVI_8Day` (L8 · daily rolling · 2025-07-01)
22. `TROPOMI_L2_Nitrogen_Dioxide_Tropospheric_Column` (L6 · P1D · 2018-05-06)
23. `TEMPO_L3_NO2_Vertical_Column_Troposphere` (L7 · hourly)
24. `TROPOMI_L2_Sulfur_Dioxide_Total_Vertical_Column` (L6 · P1D · 2018)
25. EUMETSAT `mtg_fd:rgb_geocolour` (WMS · PT10M). Not GIBS; it fills the Europe and Africa gap between GOES and Himawari.

### Historical high-resolution imagery (not GIBS)
Esri World Imagery Wayback holds 197 releases from 2014-02-20 to 2026-09-24.
- **Release list:** `s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json`.
- **Tiles:** `wayback.maptiles.arcgis.com/…/MapServer/tile/{release}/{z}/{y}/{x}`. A request redirects to the release that actually holds that tile. CORS is `*`.
- **Terms:** Esri terms need an Esri account for commercial use. The same is true of the keyless Esri basemap TAKIP already ships.

### Driving History and Replay with imagery by date
- **History** (days to decades):
  - Daily mosaics start 2000-02-24. Before that there is almost nothing (AVHRR SST from 1981, Landsat WELD NDVI 1983–2001), so hide each layer outside its date range.
  - At 1 day/s, swap the daily tiles and preload the next ones.
  - At 1 month/s or faster (`src/components/panels/history/lib/history-timeline-config.ts`), switch to monthly or yearly products, or hide imagery.
- **Replay** (hours to days): 10-minute GOES, Himawari and EUMETSAT, 30-minute IMERG and hourly TEMPO under the replayed tracks. Snap the clock to each layer's period and to its DescribeDomains values.
- **Today**, every TAKIP raster shows current weather during Replay or History, because nothing subscribes to the clock. `src/components/map/layers/use-layer-visibility.ts` hides only live flights and ships.

## Features

| Feature | What it does | Worldview path | Port class | TAKIP today | Effort | Value |
|---|---|---|---|---|---|---|
| Date-driven GIBS layers | WMTS with `TIME` from the selected date; matrix set and date range per layer | `web/js/map/layerbuilder.js:437-512` | data | **missing** on the map | S | H |
| Timeline, including sub-daily | Year to minute scales, custom steps, A/B draggers for compare | `web/js/components/timeline/` | ux | **has**: `src/components/map/replay/timeline-scrubber.tsx`, `src/lib/map/replay/clock.ts` | S | H |
| Layer coverage on the timeline | Bars of each active layer's available dates, from DescribeDomains (computed in a worker) | `web/js/components/timeline/timeline-coverage/`, `web/js/workers/describe-domains.worker.js` | data + ux | **partial**: gaps shaded, but nothing per layer | M | H |
| Animation with preload and loop | Preloads the next N frames | `web/js/components/animation-widget/play-queue.js` | ux | **partial**: play and speed, no loop or preload | M | H |
| GIF export | Steps the map one date at a time, captures each canvas, encodes a GIF | `web/js/containers/gif.js`, `web/js/lib/gifwriter.js` | render | **missing**; no `preserveDrawingBuffer` (`src/lib/map/create.ts`) | M | M (a paid-plan candidate) |
| Snapshot | Captures the view in the browser as PNG, GeoTIFF or KMZ | `web/js/modules/image-download/util.js` | render | **missing** | S for PNG | M |
| Compare: swipe, opacity, spy | Two layer groups at two dates, clipped by a rectangle or a circle, or blended | `web/js/map/compare/{swipe,spy,opacity}.js` | render | **missing**. Swipe needs a second synced map, which means a second WebGL context. | M | H for History |
| Events (EONET) | Picking an event sets the date, flies to it, and turns on that category's imagery | `web/js/modules/natural-events/`, `config/…/naturalEvents.json` | data + ux | **partial**: EONET in Alerts; no date jump | S–M (a new tab is nav-level, so ask) | H |
| Measurements and units | Geodesic distance and area; °C/°F/K | `web/js/components/measure-tool/` | ux | **has**: Areas, the temperature toggle | — | L |
| Distraction-free, kiosk and embed | `df`, `kiosk` and `em` URL keys | `web/js/location.js` | ux | **partial**: F key fullscreen | S | M |
| Permalinks with time | About 45 URL keys, including `t`/`t1` and layers with opacity and palette | `web/js/location.js` | ux | **partial**: `?layers=` only (`src/components/shell/state/use-layer-persistence.ts`); workspace `t` isn't wired up | S–M | H |
| Smart Handoff | Fills Earthdata Search with the collection, time and bbox | `web/js/modules/smart-handoff/` | data | **missing** | S | L (needs an Earthdata login) |
| Charting | Time series of an area, from the undocumented `imagestat` service | `web/js/components/charting/` | data | **partial**: the deep-time chart | M | M (ask NASA before paid use) |
| Granule layers | Each CMR granule becomes a six-minute WMTS layer, with footprint hover | `web/js/workers/cmr.worker.js` | data + render | **partial** | M–L | M |
| Raster hover read-out | Reads the pixel under the cursor and maps it to a legend value | `web/js/map/runningdata.js` | render | **partial**: vector hover only | M | M |
| Legends from colormaps | GIBS colormap XML v1.3 → legend | `tasks/build-options/processColormap.js` | data | **partial**: static swatches (`src/components/panels/layers/lib/layer-legend.ts`) | S | H |
| Per-layer opacity | A slider per layer, kept in the URL | `layerbuilder.js` | ux | **partial**: ArcGIS imports only | S | H (imagery over data is unreadable without it) |
| Tours and stories | 30 stories, each step a permalink plus text | `config/…/stories/**` | ux | **partial**: hard-coded documentary (`src/lib/history/paleo/story.ts`) | M (after time permalinks) | M–H for History |
| Polar projections | EPSG:3413 and 3031 | `config/…/projections/` | render | n/a; MapLibre has globe and mercator only | L | L |

## Top 10 to port

1. **`useGibsLayer`** (S, H).
   - Follow `src/components/map/layers/history/use-history-layer.ts`. Read `clock.time()` and snap it to the layer's period; in live mode use yesterday UTC, or the DescribeDomains end.
   - Change dates with `source.setTiles([url])`, as the weather layers do, and set `maxzoom` to the matrix level.
   - Put it in `src/lib/map/basemap/ground-rasters.ts`.
2. **Generated catalogue** (S, H). A `tools/gibs` script turns GetCapabilities into a TS list of the curated layers: ID, title, extension, maxzoom, period, first date, colormap URL.
3. **Legends from colormap XML** (S, H), using `layer-legend.ts`.
4. **Raster opacity** (S, H). Reuse the ArcGIS slider.
5. **Permalinks with time** (S–M, H). Add `t` next to `?layers=`.
6. **Event → imagery jump** (S–M, H).
   - Locating an EONET or GDACS event seeks to its date and turns on that category's imagery: wildfire → true colour + FireTemp, flood → VIIRS flood + IMERG, volcano → SO2.
   - Query EONET with `status=all&start&end` for past events.
7. **Animation preload and loop** (M, H). Use `addProtocol` with an LRU of ImageBitmaps, because tiles are `no-store`.
8. **Timeline coverage and snapping** (M, H). Add a cached DescribeDomains route.
9. **Compare** (M, H). Do opacity first; swipe and spy later.
10. **Snapshot PNG, then GIF/WebM** (M, M). A natural paid-plan feature.

## Layers with their own terms

Check each of these before paid plans:
- **Copernicus attribution:** TROPOMI, OPERA DSWx-S1 and HLS Sentinel.
- **JMA:** Himawari.
- **EUMETSAT data policy:** may restrict commercial use; verify.
- **Esri terms:** Worldview's Esri layers and Wayback.
- **UNEP-WCMC:** WDPA, believed to be non-commercial.
- **Per-dataset licences:** SEDAC.
- **ODbL:** GIBS's OSM coastlines and labels.
- **Worldview's own services** (`imagestat`, the WVS snapshot) are undocumented. Ask GIBS support before building a paid feature on them.
- **GIBS** publishes no rate limits.
