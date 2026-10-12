# E — Provenance (commit f3029a8, AGPL-3.0): data sources and non-UI features

Facts only (endpoints, params, fields, thresholds, method in prose). No code was copied. Probes ran 2026-10-12, sequential, one GET per provider.

## Summary

- **Counts:** 55 keyless (20 camera networks + 35 signal/basemap/reference/market): **27 new**, **9 partial** (OSIRIS has the host or data, not this endpoint), 19 already in. 12 free-key, 1 newly gated (WFP HungerMap returned 401), 0 paid.
- **Top 10 for OSIRIS:**
  1. **adsb.lol `/v2/type/{ICAO types}`:** the whole receiver network in about four requests (200, 463 kB for `A320` alone). OSIRIS `flights/route.ts` has adsb.lol `/v2` written off as empty and sweeps adsb.fi cells instead.
  2. **SWPC OVATION aurora + `noaa-scales.json`:** host already in OSIRIS; adds the aurora oval and G/R/S scales.
  3. **EMSC FDSN earthquakes:** a faster Euro-Med catalogue, with a documented USGS twin rule.
  4. **NHC `CurrentStorms.json`:** active Atlantic/E-Pacific storms; public domain.
  5. **Measured road surface for cameras:** Tark Tee fields plus Digitraffic `weather/v1/stations/data`, joined by the operator's `nearestWeatherStationId`.
  6. **New national camera networks:** Traffic Scotland (~414, OGL) and Estonia Tark Tee (~180).
  7. **ArcGIS DOT camera layers, re-confirmed 200:** Houston 453, VDOT ≥1,000, Lexington 108, SCDOT Iteris 789. Castle Rock net-new is only Nova Scotia 57, New Brunswick 57 and ctroads.org 347 (POST).
  8. **TeleGeography cable map v3 live API:** replaces OSIRIS's static cable file and adds landing points and owners. Probably NC.
  9. **UK FCDO travel advice:** gov.uk Content API, OGL.
  10. **Atlassian Statuspage summaries:** 14 vendors from one adapter.
- **Runners-up:** alerts.com.ua, gpsjam, UNHCR, data.police.uk, Ransomware.live, Launch Library 2, Frankfurter, OpenFreeMap.

## Keyless providers

Data cells end with Provenance's own confidence class in brackets: measured, official, reported, modelled or derived.

### Cameras

| Provider | Data (what one record is) | Endpoint pattern | Auth | Method | Licence posture | Geo + time | Cadence | OSIRIS overlap | Feeds feature | Probe |
|---|---|---|---|---|---|---|---|---|---|---|
| **SCDOT 511 (Iteris ATIS loader)** | One camera (GeoJSON point).<br>Props: `id`, `name`, `description`, `route`, `direction`, `https_url`/`ios_url` (HLS), `image_url`, `active`, `problem_stream`. | `https://sc.cdn.iteris-atis.com/geojson/icons/metadata/icons.cameras.geojson` (also `icons.rwis.geojson`; SD and MT use the same loader).<br>The thumb `/thumbs/{id}.flv.png` 301s to `/{id}.png` on `scdotsnap.us-east-1.skyvdn.com`; pre-resolve it.<br>HLS: `*.us-east-1.skyvdn.com/rtplive/…` | none (Provenance sends `Referer: https://www.511sc.org/`; HLS needs that Referer) | poll | SCDOT 511 ToU | point (no ts) | 60 s | new (lead in CCTV-handoff.md) | CCTV (stills + HLS) | 200 json 696 kB |
| **Estonia Tark Tee (Transpordiamet)** | One road-weather camera, plus the paired station's surface reading [measured].<br>Attributes: `site_name`, `image_path` (timestamped), `closest_weather_station`, `distance` (km), `air_temp`, `road_temp`, `road_status` (DRY/MOIST/WET), `road_status_aggregate` (OK/COLD_WET_SURFACE/OVER_2_HOURS), `weather_time` (epoch ms). | `https://tarktee.transpordiamet.ee/tarktee/rest/services/tram/road_cameras/MapServer/0/query?where=1=1&outFields=*&outSR=4326&f=json` (the root layer is stale).<br>Image: `https://tarktee.transpordiamet.ee/images/{image_path}`. The path changes every update, so rebuild the URL on each refresh. | none | poll | Transpordiamet open-data ToU | point+ts | 300 s | new | CCTV + road conditions | 200 json 67 kB |
| **Traffic Scotland (Transport Scotland)** | One trunk-road camera.<br>`results[]`: `sid`, `title`, `lat`/`lng` (strings), `roadname`, `region`. ~414 cameras. | `https://www.traffic.gov.scot/tsis/cameras`<br>Image: there is no JPEG URL. The frame is a base64 `data:image/jpeg` URI inside `https://www.traffic.gov.scot/tsis/camerahtml?sid={sid}`; decode it server-side and lazily. | none | poll | OGL | point (no ts) | 120 s | new | CCTV | 200 json 63 kB |
| **Houston TranStar (City of Houston GIS on ArcGIS)** | One camera.<br>Fields: `Name`, `OBJECTID`, `roadway`, `URL` (`http://www.houstontranstar.org/snapshots/cctv/{n}.jpg`; upgrade to https). 453 rows (451 valid). | `https://services.arcgis.com/NummVBqZSIJKUeVR/arcgis/rest/services/Trantar_Camera_Locations/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=json` | none | poll | no licence stated (catalogue: none) | point | 300 s | new (lead in CCTV-handoff.md); Provenance's only admitted "discovered" feed | CCTV | 200 json 219 kB |
| **VDOT (Esri-hosted `CameraLocationVDOT`)** | One camera.<br>Fields: `id`, `descriptio`, `route`, `direction`, `image_url` (`images.skyvdn.com/thumbs/{name}.flv.png`), `rtsp_url`. ≥1,000 (one page is capped at 1,000; the count query returned a 4-digit number). | `https://services.arcgis.com/hRUr1F8lE8Jq2uJo/arcgis/rest/services/CameraLocationVDOT/FeatureServer/0/query?...&f=json` (page with `resultOffset`) | none | poll | no licence stated; Esri-hosted copy, operator is VDOT | point | 300 s | new (handoff lead "VDOT 1.46k") | CCTV | 200 json 14 B (count only) |
| **Lexington-Fayette UCG (ArcGIS)** | One city traffic camera.<br>Fields: `objectid`, `location`, `still_url` (a Wowza thumbnail on `6855e4345af72.streamlock.net:1935/thumbnail?application=lexington-live&streamname=lex-cam-NNN.stream`). 108 rows. | `https://services1.arcgis.com/Mg7DLdfYcSWIaDnu/arcgis/rest/services/Traffic_Camera_Locations_Public_view/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=json` | none | poll | "custom" per catalogue | point | 300 s | new | CCTV | 200 json 49 kB |
| **ACT Puerto Rico (its.act.pr.gov)** | One ITS camera, using the operator's own lat/lon.<br>Rows: `Id`, `Name`, `Latitude`, `Longitude`, relative `ImageUrl` (→ `/images/cameras/{name}.jpg`). 31 cameras; 29 were live on 2026-08-20. | `POST https://its.act.pr.gov/es/Default.aspx/GetCctv`, body `{}`, JSON; answer is inside the ASP.NET `d` envelope.<br>The host sends a malformed header (`Permissions-Policy` with a leading space): Node `fetch` fails, curl tolerates it, HTTP/2 works. | none | poll (POST) | no stated licence | point+ts (Last-Modified) | 60 s | new | CCTV | not probed (POST) |
| **Castle Rock "511" platform** | One camera.<br>`latLng.geography.wellKnownText` is `POINT (lon lat)`, longitude first. Also `roadway`, `direction`, `images[]` with `imageUrl`, `videoUrl`, `isVideoAuthRequired`. | `POST https://{site}/List/GetData/Cameras`. It is a DataTables endpoint: GET returns an empty table; pages are hard-capped at 100 rows (walk with `start=`); `length=-1` returns 500.<br>Snapshot: `https://{site}/map/Cctv/{id}` (no Referer or cookie).<br>Sites: fl511.com, 511ga.org, 511ny.org, 511.idaho.gov, newengland511.org, 511la.org, 511on.ca, 511.alberta.ca, 511.novascotia.ca, 511.gnb.ca. The same software also runs nvroads, drivenc, 511pa, az511.com, ctroads.org and 511.alaska.gov. | none | poll (POST) | 511 DOT traveller-info ToU | point (no ts) | 60 s | partial: OSIRIS has FL/GA/ID/NE/LA/ON/AB/NV/NC/PA/AZ/AK (NY via CARS 511x). **New: 511.novascotia.ca 57, 511.gnb.ca 57, ctroads.org 347** | CCTV | not probed (POST) |
| **Fintraffic Digitraffic** | (a) One weathercam station, using its first active preset's JPEG.<br>(b) One road-weather station's sensor list. `KELI_1..3` carry the surface state as `sensorValueDescriptionEn` text [measured]. | (a) `https://tie.digitraffic.fi/api/weathercam/v1/stations`; per-station detail `/api/weathercam/v1/stations/{id}` carries `nearestWeatherStationId` (the list does not); image `https://weathercam.digitraffic.fi/{presetId}.jpg`.<br>(b) `https://tie.digitraffic.fi/api/weather/v1/stations/data` | none (needs header: `Accept-Encoding: gzip`, else 406; `Digitraffic-User` is requested) | poll | CC BY 4.0 | point+ts | cams 300 s; sensors in minutes | partial: cameras already in (`finland.ts`); the road-weather endpoint and the join are new | CCTV + road conditions | (b) 200 json 365 kB |
| **Caltrans CWWP2** | One camera.<br>`imageData.static.currentImageURL`, `currentImageUpdateFrequency` (minutes), `imageData.streamingVideoURL`, `inService`. | `https://cwwp2.dot.ca.gov/data/d{N}/cctv/cctvStatusD{NN}.json` (per district).<br>HLS on `wzmedia.dot.ca.gov` needs `Referer: https://cwwp2.dot.ca.gov/`. | none | poll | Caltrans ToU | point+ts | per camera (≥30 s) | already in (OSIRIS reads the ArcGIS layer); **the HLS Referer rule is the missing piece for the handoff's HLS upgrade** | CCTV | not probed |
| TfL JamCam | One camera: S3 still under `/jamcams.tfl.gov.uk/` plus an MP4 clip (not live). | `https://api.tfl.gov.uk/Place/Type/JamCam` | none | poll | TfL open data | point | 300 s | already in | CCTV | not probed |
| ODOT TripCheck | One camera (~1,127). The FeatureSet says wkid 3857 and `geometry` is in metres; use `attributes.latitude/longitude` (WGS84) instead. | `https://tripcheck.com/Scripts/map/data/cctvinventory.js` (a JSON body despite the .js name).<br>Image: `https://tripcheck.com/RoadCams/cams/{filename}` (mixed-case extension; URI-encode it). | none | poll | ODOT ToU | point | 60 s | already in | CCTV | not probed |
| DriveBC | One camera (~1,058). `location.coordinates` is `[lon, lat]`; flags `marked_stale`, `marked_delayed`, `is_on`. | `https://www.drivebc.ca/api/webcams/` (flat array).<br>Image: `www.drivebc.ca` + `links.imageDisplay` (drop the `?t=`). | none | poll | OGL-BC | point+ts | 180 s | already in | CCTV (staleness flags) | not probed |
| NZTA Waka Kotahi | One camera (~320). Use the camera's own `latitude`/`longitude`, not `journey` start/end. | `https://trafficnz.info/service/traffic/rest/4/cameras/all`; returns XML unless you send `Accept: application/json`.<br>Image: `/camera/{id}.jpg` | none (needs header: `Accept: application/json`) | poll | NZTA open-data ToU | point | 120 s | already in | CCTV | not probed |
| Vegagerðin (Iceland) | One row per camera view; group by `Maelist_nr` to get one station (~160). `Breidd` = lat, `Lengd` = lon (ignore `PntX`/`PntY` ISN93). `Slod` is the JPEG. | `https://gagnaveita.vegagerdin.is/api/vefmyndavelar2014_1` | none | poll | Vegagerðin open-data ToU | point | 300 s | already in | CCTV | not probed |
| **CET São Paulo** | One corridor camera; 11 are hand-verified, about 10 live. Of the 205 `/cams/{n}/` folders that answer 200, about 195 are frozen stills dated 2017–2025. | `https://cameras.cetsp.com.br/cams/{pasta}/1.jpg`. There is no list API; coordinates come from a hand-made table. | none | scrape (static table + HEAD Last-Modified) | public viewer, no stated licence | point+ts (Last-Modified) | 120 s | new | CCTV | not probed |
| **MUP Serbia border crossings** | One border-crossing HLS stream: 32 streams at 16 crossings, two per crossing, unlabelled. No stills. | Portal HTML: `https://www.mup.gov.rs/wps/portal/sr/kamerе/kamerеGP` (the `е` is Cyrillic, URL-encoded; read the `toggleCamera(...)` calls).<br>Streams: `https://kamere.mup.gov.rs:4443/{Crossing}/{name}.m3u8` (port 4443; no Referer needed). Coordinates come from a hand gazetteer. | none | scrape | no stated licence | point (no ts) | live | new (OSIRIS has only AMSS Gradina, `kamere.amss.org.rs`) | CCTV (HLS) | not probed |
| **JP Putevi Srbije toll plazas** | One toll-plaza camera, entry or exit: 38 cameras at 19 plazas, 30 with defensible coordinates. Poster JPEG + HLS. | Viewer HTML: `https://kamere.toll4all.com/` (`cam-item` elements).<br>Posters: `cam.bitinfo.co.rs/{slug}/index.jpg` and `jpps.bitinfo.co.rs/{slug}/index.jpg`.<br>HLS on `cam.bitinfo.co.rs` returns 403 unless sent `Referer: https://kamere.toll4all.com/` (trailing slash required). Segment URIs are relative. | none (needs header: Referer, HLS only) | scrape | no stated licence | point+ts | live / poster in seconds | new | CCTV (stills + HLS) | not probed |
| **BIHAMK (Bosnia & Herzegovina auto club)** | One road or border camera: 15 listed, 12 with coordinates (9 border crossings). | Portal HTML: `https://bihamk.ba/spi/kamere` (read `videosurveillence/{KEY}.jpg`, the operator's own spelling).<br>Image: `https://video-nadzor.bihamk.ba/videosurveillence/{KEY}.jpg` | none | scrape | no stated licence | point+ts (Last-Modified) | 180 s | new | CCTV | not probed |
| Bellingen Shire flood cameras (AU) | One flood-watch camera (6).<br>Fields: `Site`, `Road_Name`, `Hyperlink` (`public.disasterwatch-iotp.com.au/prospectpublicimages/{n}/…jpeg`). | `https://services7.arcgis.com/kkiBaYsUIhK1wEpz/arcgis/rest/services/Flood_Camera_Network/FeatureServer/0/query?...&f=json` | none | poll | none stated | point | 300 s | new | CCTV / flood | not probed |

#### Camera stream liveness (Provenance's `data/liveness/*`, measured 2026-09-07/08)

- **Open and live HLS** (the playlist advanced between two reads):
  - `s{7,9,51,52,53}.nysdot.skyvdn.com` (511NY, about 1.5k streams)
  - `itsstreamingbr{,2}.dotd.la.gov` (LA)
  - `d{1,2,3}wse{1-5}.its.nv.gov` (NV; `d2wse1` returned 404)
  - `video.dot.state.mn.us/public/{cam}.stream/playlist.m3u8` (MnDOT: 1,246 streams, 95% rolling)
- **Auth-gated by the operator's own `isVideoAuthRequired`:**
  - FL511 on `dis-se*.divas.cloud:8200` (4,381 of 4,382 streams)
  - DriveNC on `*.services.ncdot.gov:8887` (1,062 of 1,084)
  - 511PA on `*.arcadis-ivds.com:8200` (1,267 of 1,275)
- **Unreachable from a UK exit:** CDOT `publicstreamer{1-4}.cotrip.org:443/rtplive/{cam}/playlist.m3u8` (792 streams). Recorded as "unreachable from this network", not as dead.
- **Advertise a player but expose no stream URL:** 511GA, NVRoads and 511Virginia (video.js). OHGO had no stream at all.

### Signals, reference, basemaps and markets

| Provider | Data (what one record is) | Endpoint pattern | Auth | Method | Licence posture | Geo + time | Cadence | OSIRIS overlap | Feeds feature | Probe |
|---|---|---|---|---|---|---|---|---|---|---|
| **EMSC (seismicportal.eu)** | One earthquake: `mag`, `depth`, Flynn region, `unid` [measured]. | `https://www.seismicportal.eu/fdsnws/event/1/query?limit=500&format=json` (GeoJSON).<br>Detail page: `/eventdetails.html?unid={unid}`. A full 500-row page means "at least 500". | none | poll | EMSC terms, attribution (verify) | point+ts | 60 s | new | hazards / quakes | 200 json 271 kB |
| **NOAA NHC** | One active named storm: centre position, intensity (kt), movement, classification [official]. `{activeStorms: []}` in the quiet season. Atlantic + E-Pacific only. | `https://www.nhc.noaa.gov/CurrentStorms.json`. The cone and track are separate GIS files. | none | poll | US public domain | point+ts | 30 min | new (listed in DATA-SOURCES as NWS/NHC) | hazards / cyclones | 200 json 5 kB |
| **NOAA SWPC (more products)** | (a) OVATION: a flat `coordinates` array of `[lon 0–359, lat, aurora %]`, a 360×181 grid of 65,160 cells, plus `Observation Time` / `Forecast Time` [modelled].<br>(b) Planetary Kp [measured].<br>(c) NOAA G/R/S scales. | (a) `https://services.swpc.noaa.gov/json/ovation_aurora_latest.json`<br>(b) `/products/noaa-planetary-k-index.json`<br>(c) `/products/noaa-scales.json` | none | poll | US public domain | polygon+ts (grid) / none | 5 min / 15 min | partial: OSIRIS uses `planetary_k_index_1m.json` + `alerts.json` | space weather, aurora | (a) 200 json 918 kB |
| GDACS (JSON API) | One disaster event: GeoJSON point, `eventtype`, `alertlevel`, `alertscore` 0–3. Area hazards are a centroid [modelled]. | `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype={EQ\|TC\|FL\|VO\|DR\|WF}`. **Exactly one type per request:** no type gave 400 from 2026-08-13; a semicolon list gives 400 since about 2026-08-28. TS is not accepted. | none | poll | EC JRC/UN, attribution | point+ts | 10 min | partial: OSIRIS reads `gdacs.org/xml/rss.xml` | hazards | 200 json 46 kB (EQ) |
| NASA EONET | One natural event; the last element of `geometry[]` is the latest position [official]. | `https://eonet.gsfc.nasa.gov/api/v3/events?status=open`, plus `/api/v3/categories/floods?status=all&limit=200`. Floods are closed within days, so the open feed never contains them. **Flood polygons arrive `[lat, lon]`** (measured on all 60). Do not use `days=`: it filters on the newest geometry and hides open volcanoes. Age limits per category: wildfires 30 d, storms 14 d, floods 60 d, volcanoes none. | none | poll | NASA open | point/polygon+ts | 10 min | already in (`fires`, `weather` routes); the gotchas are new | hazards | not probed |
| USGS | One earthquake; `coordinates` = `[lon, lat, depth km]` [measured]. | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` | none | poll | US public domain | point+ts | 60 s | already in (OSIRIS uses `2.5_day`/`4.5_day`) | hazards | not probed |
| **The Space Devs Launch Library 2** | One upcoming launch at its pad: `net`, status, provider, rocket, `pad.latitude/longitude` (strings); `count` gives the exact total [reported]. | `https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=30&mode=normal`. `mode=list` drops pad coordinates. Fall back to `lldev.thespacedevs.com` (same schema) when throttled; the anonymous limit is a few requests an hour. | none | poll | LL2 ToS (verify) | point+ts | 1 h | listed in DATA-SOURCES | space / launches | 200 json 141 kB |
| **TeleGeography Submarine Cable Map v3** | A cable route (Multi/LineString) and landing points; per-cable `length`, `owners`, `suppliers`, `rfs`/`rfs_year`, `is_planned`, `landing_points[]` [reported]. | `https://www.submarinecablemap.com/api/v3/cable/cable-geo.json`, `/cable/all.json`, `/cable/{id}.json` (~700 files; concurrency 40 finishes in about 11 s), `/landing-point/landing-point-geo.json` | none | poll / bulk | likely CC BY-NC-SA (verify; DATA-SOURCES says "may be NC") | polygon (line) | 24 h | partial: OSIRIS ships a static `public/data/submarine-cables.json` | infrastructure | 200 json 754 kB |
| **gpsjam.org** | One H3 res-4 hex for a day: `hex,count_good_aircraft,count_bad_aircraft`; ratio = bad / total [derived]. Provenance keeps cells with ≥10 aircraft and ratio ≥0.1, capped at 400. | `https://gpsjam.org/data/{YYYY-MM-DD}-h3_4.csv` (gzip CSV). Today's file is usually missing, so walk back up to 4 days. A missing day returns a JSON 404 body. The old `-h3-7.json` path is gone. | none | bulk (daily) | derived from ADS-B Exchange (verify; likely NC) | polygon+ts (day) | daily | new (DATA-SOURCES lists "compute our own") | GNSS interference | 200 csv 191 kB |
| **alerts.com.ua** | Air-raid alert state for one Ukrainian region (24 oblasts + Kyiv): `id`, `name`, `alert` (bool), `changed` (ts). No geometry; anchor it at the oblast's administrative centre [official, via unofficial mirror]. | `https://alerts.com.ua/api/states`. The official `api.ukrainealarm.com` returns 403 without a key; `alerts.in.ua` returns 401. | none | poll | no stated licence (mirror of official state) | point+ts (oblast anchor) | 60 s | new | conflict / alerts | 200 json 3 kB |
| **Atlassian Statuspage (14 vendors)** | One vendor summary: overall status + incidents. Only non-operational vendors become features [official, self-reported]. | `https://{host}/api/v2/summary.json`.<br>Hosts: www.githubstatus.com, www.cloudflarestatus.com, status.openai.com, status.datadoghq.com, status.atlassian.com, status.npmjs.org, status.digitalocean.com, metastatuspage.com, status.discord.com, status.snowflake.com, status.mongodb.com, status.twilio.com, status.sendgrid.com, status.linode.com.<br>Not Statuspage: Anthropic, GCP, Zoom, Hetzner, Heroku, GitLab, AWS, Azure. | none | poll | vendor ToS | none (pin at HQ only) | 5 min | new | cyber / outages | 200 json 9 kB (GitHub) |
| **data.police.uk** | One street-level crime, snapped to an anonymised point, with month and category [official]. England, Wales and NI only, about 2 months behind. | `https://data.police.uk/api/crimes-street/all-crime?lat={}&lng={}` (1-mile radius; omit `date` for the latest month). Also `/api/crime-last-updated`. | none | poll | OGL v3 | point+ts (month) | monthly (6 h cache) | new | crime / civic | 200 json 21 B (`crime-last-updated`) |
| **Ransomware.live** | One claimed victim: country ISO-2, group, sector, date. Provenance aggregates to country [reported, attacker-claimed]. | `https://api.ransomware.live/v2/recentvictims` | none | poll | free API with a PRO tier (verify commercial terms) | country+ts | 30 min | new | cyber | 200 json 81 kB |
| abuse.ch Feodo Tracker | One botnet C2 IP with malware family and IP-geolocated country. Provenance aggregates to country [reported]. | `https://feodotracker.abuse.ch/downloads/ipblocklist.json` | none | poll | CC0 | country+ts | 15 min | already in (`cyber-attacks`, `lib/c2-indicators.ts`) | cyber | not probed |
| **UNHCR population API** | One country-year: `coa_iso` or `coo_iso`, `refugees`, `asylum_seekers`, `idps` [official, annual]. | `https://api.unhcr.org/population/v1/population/?limit=1000&yearFrom={Y}&yearTo={Y}&coa_all=true` (asylum) or `coo_all=true` (origin). The latest year may be unpublished, so fall back one year. | none | poll | CC BY 4.0 (verify) | country+ts (year) | daily cache | new | humanitarian / CII | 200 json 48 kB |
| **adsb.lol** | One aircraft: hex, `t` (ICAO type), `category`, alt, speed, squawk, `dbFlags` [measured]. | `https://api.adsb.lol/v2/type/{T1,T2,…}` (comma list, worldwide) and `/v2/mil`; fallback `https://opendata.adsb.fi/api/v2/mil`. `/v2/all` returns 404. Token bucket: burst 3–5, refill about 1/s. Provenance paces 2 s, backs off on 429 and stops at 20 s. | none | poll | ODbL (verify) | point+ts | 20 s (mil), 240 s snapshot | partial: OSIRIS has the host but marks `/v2` as empty and uses the adsb.fi `lat/lon/dist` sweep | flights | 200 json 463 kB (A320) |
| Overpass API (OSM nuclear plants) | One `power=plant` + `plant:source=nuclear` element with `out center tags`; about 216 named plants [reported]. | `https://overpass-api.de/api/interpreter`, fallback `overpass.kumi.systems`. Often 504 at about 8 s, so serve a committed snapshot and refresh in the background. Reject answers under 100 elements (`overpass.osm.ch` is a regional extract). | none | poll (slow) / bulk snapshot | ODbL | point | 12 h | partial: OSIRIS has a hand-curated list in `infrastructure/route.ts` | infrastructure | not probed |
| OurAirports | One airport row; filter `type=large_airport` (about 1,180 of 85k) [reported]. | `https://davidmegginson.github.io/ourairports-data/airports.csv` (about 12 MB) | none | bulk | public domain | point | 24 h | listed in DATA-SOURCES | reference | not probed |
| IODA (summary endpoint) | One country outage score (`scores.overall`, unitless, observed from 1e3 to 1e11) [measured]. | `https://api.ioda.inetintel.cc.gatech.edu/v2/outages/summary?from={unix}&until={unix}&entityType=country&limit=200` | none | poll | academic (verify) | country+ts | 15 min | already in (OSIRIS uses `/v2/outages/events`) | outages / CII | not probed |
| GDELT 2.0 event export | One CAMEO event row: 61 TSV columns, ActionGeo lat/lon, NumArticles/NumSources [modelled]. | `https://storage.googleapis.com/data.gdeltproject.org/gdeltv2/lastupdate.txt` → `{stamp}.export.CSV.zip`. Use the GCS path: the `data.gdeltproject.org` vanity host fails TLS name checks. GEO 2.0 returns 404; DOC 2.0 has no coordinates and gives 429 on JSON. | none | bulk (15 min) | open, attribution | point/country+ts | 15 min | already in (`lib/gdeltEvents.ts`) | conflict | not probed |
| **Open-Meteo Air Quality (CAMS)** | Modelled AQ for one coordinate: `pm2_5`, `pm10`, `us_aqi`, `european_aqi`, `nitrogen_dioxide`, `ozone` [modelled]. Comma-separated lat/lon lists return an array; one request covers 50 cities. | `https://air-quality-api.open-meteo.com/v1/air-quality?latitude={a,b}&longitude={a,b}&current=…&timezone=GMT`. The forecast API `api.open-meteo.com/v1/forecast?...&current=…&daily=sunrise,sunset&forecast_days=1` is already in OSIRIS. | none | poll | data CC BY 4.0; free API non-commercial (DATA-SOURCES: paid for commercial) | point+ts | 30 min (CAMS hourly) | partial: forecast in; AQ host new | air quality, camera conditions | 200 json 335 B |
| **NASA GIBS** | One true-colour WMTS tile [measured]. | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{YYYY-MM-DD}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`. Use yesterday (UTC) for full coverage. | none | tiles | NASA open | tiles (daily) | daily | listed in DATA-SOURCES | imagery / satellite dossier | 200 jpeg 18 kB |
| **OpenFreeMap** | A vector basemap style (liberty / positron / dark). Liberty carries OpenMapTiles `building.render_height` for 3D. | `https://tiles.openfreemap.org/styles/{liberty\|positron\|dark}`; glyphs `https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf`. Keep the source as a TileJSON `url:` so the attribution comes through. | none | tiles | ODbL (OSM) | tiles | static | new (OSIRIS uses CARTO, which is ToS- and volume-limited) | basemap | 200 json 43 kB |
| **OpenTopoMap** | A raster topo tile, max zoom 17. | `https://{a,b,c}.tile.opentopomap.org/{z}/{x}/{y}.png` | none | tiles | CC BY-SA | tiles | static | new | basemap | 200 png 45 kB |
| Esri World Imagery | A raster imagery tile, max zoom 19. | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` | none | tiles | Esri ToS | tiles | static | already in | basemap | not probed |
| **UK FCDO travel advice** | One country's advice: `details.alert_status[]`, `change_description`, `country{name,slug}`, `public_updated_at` [official]. | `https://www.gov.uk/api/content/foreign-travel-advice/{slug}`; index of 226 countries at `https://www.gov.uk/api/content/foreign-travel-advice` | none | poll | OGL v3 | country+ts | hours | listed in DATA-SOURCES | country dossier | 200 json 102 kB |
| **Frankfurter** | ECB reference FX rates. | `https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP,JPY,CNY,CHF,CAD,AUD,INR` | none | poll | ECB data, open | none | daily (60 s cache) | new | markets | 200 json 98 B |
| CoinGecko | Coin market rows. | `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=…&order=market_cap_desc&price_change_percentage=24h` | none | poll | free (demo) tier; commercial needs a plan | none | 60 s | already in | markets | not probed |
| Yahoo Finance (unofficial) | Chart series for one symbol. | `https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=1d` (and `range=max&interval=1mo` for all-time highs) | none | poll | unofficial; ToS-restricted | none | 60 s | already in | markets | not probed |
| adsbdb | Callsign → route; hex → airframe. A miss is 404 with a string `response`. | `https://api.adsbdb.com/v0/callsign/{cs}`, `/v0/aircraft/{hex}` | none | poll | verify | none | on demand | already in | flight dossier | not probed |
| CelesTrak | TLE triplets per group. | `https://celestrak.org/NORAD/elements/gp.php?GROUP={visual\|stations}&FORMAT=tle` (2 h TTL; the host blocks over-fetchers) | none | poll | OK* | none | 2 h | already in | satellites | not probed |
| Photon (Komoot) | Geocode / reverse geocode, with ISO-2 `countrycode`. Autocomplete is permitted (Nominatim's policy forbids it). | `https://photon.komoot.io/api`, `/reverse` | none | poll | ODbL, fair use | point | on demand | already in | search, news geocoding | not probed |
| Recon set (RIPEstat, crt.sh, Cloudflare DoH, Shodan InternetDB, RDAP) | ASN/prefix/holder, CT subdomains, DNS records, passive ports/CVEs, WHOIS. | `stat.ripe.net/data/{network-info\|prefix-overview\|reverse-dns-ip\|as-overview\|announced-prefixes}/data.json?resource=`; `crt.sh/?q={d}&output=json`; `cloudflare-dns.com/dns-query` (JSON); `internetdb.shodan.io/{ip}`; `rdap.org/…` | none | poll | various | none | on demand | already in (`osint/*`; OSIRIS uses `dns.google` for DoH) | OSINT | not probed |
| Telegram public preview | Posts on a channel's public web page. | `https://t.me/s/{channel}` (Provenance uses `liveuamap`) | none | scrape | channel ToS | none | 5 min | already in | news | not probed |
| Publisher RSS (14 feeds) | Headline items. | 10 are already in OSIRIS. **New:** `independent.co.uk/news/world/rss`, `euronews.com/rss?level=theme&name=news`, `timesofindia.indiatimes.com/rssfeeds/296589292.cms`, `jpost.com/rss/rssfeedsinternational` | none | poll | publisher ToS | none | 5 min | partial | news | 200 xml 8 kB (Sky) |

### Provenance cards (paraphrased from `lib/signals/explain.ts`)

Each layer has a card with what a pin is, method, confidence class, coverage and at least one limitation. The build fails when a card is missing. Below are the facts worth carrying into OSIRIS, as confidence class, coverage, then limits.

- **EMSC** (measured): global, densest in Euro-Med. Overlaps USGS, so the same quake appears twice with slightly different magnitude, depth and epicentre. Early solutions are revised.
- **USGS** (measured): global, with uneven detection thresholds. Early magnitudes are revised by tenths. The layer shows physics, not impact.
- **NHC** (official): Atlantic and E-Pacific only. The most misread layer: an empty W-Pacific means JTWC/JMA basins are out of scope. The pin is the centre, not the cone. The feed is legitimately empty for months.
- **GDACS** (modelled): the alert level is a modelled impact estimate issued within minutes and often revised. Green is not "no harm". Conflict and slow-onset crises are out of scope.
- **EONET:**
  - Wildfires (official): agency-declared events only, not burning pixels.
  - Volcanoes: presence means reported activity, with no VEI or alert level.
  - Floods: a point, not an extent, and reporting lags.
  - Storms: no intensity carried.
- **OVATION aurora** (modelled): a probability of visibility, ignoring cloud and daylight. It is a roughly 30-minute nowcast. The global maximum on a quiet night is about 20%, so a 50% floor shows nothing; Provenance uses ≥5%.
- **Kp / scales** (measured): a 3-hourly planetary average, quantised and saturating at 9. It does not say which systems are affected.
- **Launch Library 2** (reported): dates slip constantly, and some entries are only windows. The pin is the pad.
- **Submarine cables** (reported): routes are schematic, not surveyed. The data is infrastructure, not status: no cut or traffic information. Military and some private cables are absent.
- **gpsjam** (derived): infers interference from aircraft behaviour. Receiver gaps and equipment faults look the same. No aircraft means no data. It cannot separate jamming from spoofing or locate the source.
- **Overpass nuclear** (reported): no operating status. OSM mixes sites and individual reactors, so do not count reactors.
- **OurAirports** (reported): reference data only, with no delays or closures. The "large" cut is a size class.
- **IODA** (measured): sees reachability from outside, so shutdowns and cable faults look alike. Throttling is mostly invisible. The score is unitless and its scale drifts (5.8e10 against a next-worst of 2.9e4), so band it on a log scale and never show the raw number.
- **Statuspage** (official, self-assessed): status pages are slow to go red. The pin at the vendor's HQ is a placement of convenience. AWS, GCP and Azure are not covered.
- **GDELT conflict / protests** (modelled): counts reporting, not incidents; Provenance aggregates to country on purpose.
  - The US dominates by about an order of magnitude because of English-language skew.
  - The time window is GDELT's filing time.
  - About 37% of rows had untyped actors, where a place name was promoted to an actor.
  - Not a substitute for ACLED or UCDP.
- **alerts.com.ua** (official, via mirror): an alert is a warning, not an incident. The dot is an oblast anchor, up to a few hundred km off. Occupied oblasts sit in a permanent alert (Luhansk since 2023-10). A stale mirror read looks like an all-clear.
- **data.police.uk** (official): monthly and historical. Points are deliberately anonymised. It records reported crime only.
- **Ransomware.live** (reported): these are attacker claims, some false or recycled. Victims who paid are absent. Location is the registered HQ.
- **UNHCR** (official): annual, lagging a year or more, country-level only.
- **Open-Meteo AQ** (modelled): grid cells are tens of km. Differs from nearby monitors.
- **Military ADS-B** (reported): transponders can be off or spoofed. Labelling is community-maintained. Gaps are receiver coverage.
- **Feodo C2** (reported): IP-geolocated hosting location, not the operator.
- **ReliefWeb** (official, keyed): a document, not an event.
- **ENTSO-E** (official, keyed): Europe only, values provisional, bidding zones are not countries.
- **AIS** (measured, keyed): a chokepoint sample, not a census. Illicit ships go dark.

## Keyed or gated providers

| Provider | Data | Why keyed | Free key available? |
|---|---|---|---|
| WFP HungerMap (`api.hungermapdata.org/v1/foodsecurity/country`) | FCS prevalence per ISO-3; the CII food factor | Provenance treats it as keyless, but the **2026-10-12 probe returned 401** (26 B JSON) to our survey User-Agent. It could be UA or Referer gating rather than a key; not re-probed under the one-GET rule. If it holds, Provenance's CII silently scores food as 0. | unknown; looks newly gated |
| ReliefWeb API v2 (`api.reliefweb.int/v2/disasters?appname=…&profile=full&limit=100`) | Active humanitarian emergencies per country | `appname` must be pre-approved, otherwise 403 | yes (free, approval) |
| ENTSO-E (`web-api.tp.entsoe.eu/api`) | Total load per bidding zone (XML, one EIC zone per request) | security token | yes: register, then email transparency@entsoe.eu (about 3 working days) |
| NASA FIRMS area CSV | VIIRS active-fire pixels | `FIRMS_MAP_KEY` | yes (OSIRIS already has it) |
| OpenAQ v3 (`/v3/parameters/2/latest?limit=1000`) | Station PM2.5 | `X-API-Key` | yes (OSIRIS already has it) |
| AISStream (WebSocket) | Live vessel positions at chokepoints | API key | yes (OSIRIS already has it) |
| Windy Webcams v3 | About 70.7k webcams | `x-windy-api-key`. Free tier: `limit` ≤50, `offset` ≤1000; image tokens expire in 10–15 min | free tier (Pro is €9,990/yr) |
| YouTube Data API v3 | Channel id → current live video id | quota: `search.list` costs 100 units, 10k units/day | yes |
| Finnhub | Real-time equity quotes (Yahoo is the keyless fallback) | token | free tier |
| FRED | US macro series (Yahoo is the keyless fallback for yields and VIX) | api_key | yes |
| UCDP GED | Geocoded conflict events + fatalities (docs only, not wired) | `x-ucdp-access-token` header | yes (free token) |
| Electricity Maps | Grid mix outside the EU (docs only) | API key | free tier |
| Cloudflare Radar | Second outage vantage point (docs only) | Radar Read token | yes (OSIRIS already uses Radar) |

- ACLED was removed from Provenance on 2026-09-05. The OAuth grant succeeded, then every read returned 403.

## Non-UI features worth adopting

Each item gives the method in prose, then OSIRIS's gap.

1. **Per-camera liveness from frame age, not HTTP status.**
   - Method: every still on CETSP, BIHAMK and ACT-PR returns 200 forever. Each refresh round sends one HEAD per still, reads `Last-Modified`, and marks the camera `available: false` once the frame is older than 60 minutes. A future date is clamped to age 0.
   - Unavailable cameras stay in the list (so "11 known, 10 online"), never silently dropped.
   - DriveBC's `marked_stale`/`marked_delayed`/`is_on` and SCDOT's `active`/`problem_stream` map to the same flag.
   - Gap: OSIRIS's `cctv/stream-status` only detects rtsp.me quota pages. Nothing checks frame age, so frozen 200-OK stills render as live.

2. **HLS liveness verdict.**
   - Method: read the playlist twice, one target duration apart.
     - Live: media-sequence, segment list or body changed.
     - Stalled: unchanged.
     - Recording: `#EXT-X-ENDLIST`.
     - Master playlist: follow a variant, don't judge.
   - Normalise CRLF. Keep "unplayable / blocked from our network" (403 from a VPN exit, unparsable body) separate from "dead", so a bad network never deletes a good operator.
   - Per-host verdicts are recorded from a sample (40 per host); see the liveness facts under the camera table.
   - Gap: none in OSIRIS. Its catalogue has 2,811 HLS rows and no verdicts.

3. **Stream discovery sniffer.**
   - Method: walk any JSON payload, and also the operator's viewer HTML. Classify every string value as hls / dash / mjpeg / rtsp / rtmp by scheme and path extension, ignoring the query string.
   - Refuse bare-IP hosts (leaked private cameras) and relay hosts.
   - Record RTSP/RTMP as findings even though they aren't playable.
   - Gap: OSIRIS adapters read known fields only; the handoff's "Caltrans streamingVideoURL" was found by hand.

4. **Freshness model.**
   - Method: a pure classifier per layer.
     - `down` if the last fetch failed.
     - `unknown` before the first fetch.
     - `stale` at ≥6× the declared cadence.
     - `empty` if OK with zero rows (a first-class "live, none right now").
     - `lagging` at ≥2× cadence.
     - Otherwise `live`.
   - Two timestamps per payload: `at` (when we read it) and `sourceAt` (the age of the data itself). UNHCR is stamped at the end of its year, so it never reads as live.
   - A `basis: compiled` flag covers curated static sets (ports), so they are neither "degraded" nor "stale forever".
   - Camera frames use a cache-buster quantised to the source refresh window: floor(now / refresh). All viewers share one CDN key per window.
   - Gap: OSIRIS `sourceCache` has a TTL, de-duplication and stale-on-error, but no published per-source state or data-age vs read-age distinction.

5. **Failure contract.**
   - Method: adapters still return arrays, but attach a non-enumerable outcome under a global `Symbol.for` key: observed / degraded(reason) / degradedWith(last-good, at) / compiled. A module-local WeakMap was lost when the bundler duplicated the module.
   - A missing outcome means "not declared", never healthy, and a registry-wide test fails the build if any adapter lacks one.
   - The route publishes `ok`, `degradedReason` and age. Empty results are cached for at most 5 min; populated ones for the source's own cadence. Failures are never cached.
   - The camera registry merges per feed:
     - A failed or empty feed keeps its last-good cameras, flagged `stale`.
     - A total cold failure throws instead of caching an empty world.
     - Per-feed timeouts default to 10 s; a measured budget override exists (Castle Rock 60 s, about 143 paged requests).
   - Gap: partial. OSIRIS keeps the last good index per source, but `[]` still means both "quiet" and "broken", and nothing publishes which.

6. **Truncation declaration.**
   - Method: when a layer caps rows, it attaches `{available, returned, capped, cap, availableExact, rule}`.
     - `returned` is always re-measured from the array.
     - `availableExact: false` when the upstream request was itself paged, e.g. EMSC at `limit=500` or UNHCR at 1000.
     - `rule` names the sort order that makes the kept prefix defensible.
     - The record survives mapping to a derived array (H3 cells → polygons).
   - Labels then read "1,500 of 41,203", never "1,500".
   - Gap: OSIRIS reports capped counts as totals (only the news route mentions truncation).

7. **Proportional spatial sampling for capped point sets (aircraft).**
   - Method: partition into 10°×10° cells.
   - Allocate the cap by largest remainder (Hamilton), proportional to each cell's count, so seats sum exactly to the cap. Every non-empty cell keeps at least one, paid for by the largest cells.
   - Within a cell, airborne aircraft come before grounded ones, then order by a stable FNV-1a hash of the id. Hex order would drop the same national registries first.
   - Deterministic, and replaces a prefix cut that drew "two dense discs" (all 1,311 aircraft between 2° and 15° E).
   - Pair it with adsb.lol `/v2/type` batches:
     - Batches: A mainline, B regional, C bizjet, D GA/helo; D is sacrificial under budget.
     - Report the shortfall twice: batches never asked vs batches refused.
     - Throw on failure so the Data Cache keeps the last good snapshot (240 s revalidate).
     - Refuse to serve snapshots older than 15 min.
   - Gap: OSIRIS flights fan out over adsb.fi regional cells and do no spatial sampling of the merged pool.

8. **Closed media proxy.**
   - Method: the still proxy takes only `?id=`. The server looks up the camera, then allowlists the exact host + path prefix + optional suffix + port. The port check closes the `host:22` probing hole: `new URL` normalises default ports to "".
   - It fetches with `redirect: error` (SCDOT thumbs are pre-resolved for this) and caches for exactly the source's refresh interval.
   - A separate HLS allowlist carries a per-host Referer: wzmedia (Caltrans), skyvdn (SCDOT), toll4all with its trailing slash, MUP on port 4443.
   - The camera API never returns the raw stream URL, only `live: true`.
   - Upstream 4xx (a segment that rolled out of the window) is passed through rather than collapsed into 502. Over 80 minutes in prod there were 389 502s; 376 of the 382 distinct upstream URLs behind them were expired Caltrans `.ts` segments.
   - Gap: partial. OSIRIS `cctv/proxy` allowlists by host suffix on a caller-supplied URL. No id binding, no path or port pinning, no per-source TTL.

9. **Road conditions from the nearest station (10 km rule).**
   - Method: only operator-declared pairings are used, never a nearest-neighbour guess.
     - Estonia's camera feed carries station, distance and surface.
     - Fintraffic's `nearestWeatherStationId` comes from the per-station detail endpoint. 762 of 811 stations paired; generated with 813 requests.
   - A reading is shown as the road's state only if all of these hold:
     - no operator fault/stale flag (operator flags outrank our maths);
     - distance known and ≤10 km;
     - observation ≤2 h old, borrowed from Estonia's own OVER_2_HOURS.
   - Distance is printed when it is ≥1 km. Surface vocabulary is passed through verbatim (casing only), because Fintraffic's set grows in winter.
   - For the ~95% of cameras with only air weather, the derived line describes precipitation over the last hour and is banned from using surface words (wet / icy / dry).
   - Measured on Estonia: median distance 0 km, p90 12 km, max 36.8 km; 27 of 180 cameras exceed 10 km.
   - Gap: none in OSIRIS.

10. **Country Instability Index (`lib/signals/instability.ts`).**
    - Weights: conflict 0.40 (GDELT CAMEO 18/19/20, QuadClass 4, article volume), food 0.25 (WFP FCS prevalence), displacement **from** the country 0.25 (UNHCR origin, not asylum), internet outages 0.10 (IODA).
    - Ramps:
      - food: prevalence / 0.5;
      - displacement: log10(1+n) / 7;
      - outages: log10(1+score) / 6;
      - conflict: log10(1+n) / 4.5, **hard-capped at 0.55** so press volume alone can't read as "extreme".
    - Divide by the full weight set, so missing factors pull the score down. Partial coverage is labelled a **floor** ("≥", "N/4 factors", `scoreBasis: floor`). Minimum score 8.
    - Ransomware is excluded (it tracks digital-economy size). Factors and drivers are published per country.
    - The country dossier distinguishes "below threshold" from "feed empty or errored", so a dormant monitor never prints "Stable".
    - Gap: OSIRIS `country-risk` is an editorial baseline plus USGS quakes.
    - Note: HungerMap now returns 401, so a port must handle a dead factor visibly.

11. **Travel advisory (`lib/geo/travelAdvisory.ts`).**
    - Source: the FCDO Content API per slug. The ISO-2 → slug map is generated from the 226-country index; 18 entries are hand-resolved (e.g. Kosovo XK; CK/TK/NU share one page).
    - Four `alert_status` tokens, most severe first, scored 5/4/3/2:
      - avoid all travel, whole country;
      - avoid all travel, parts;
      - avoid all but essential, whole country;
      - avoid all but essential, parts.
    - The worst token wins. An unknown token scores 4, never 0: under-reporting is the dangerous error.
    - An empty list is a genuine green "no warning", distinct from a failed lookup (`advisory: null` plus a `reason`).
    - The issuer is always named.
    - travel-advisory.info is dead; it returned null for every country.
    - Gap: none in OSIRIS.

12. **Capability report: key requirements + upstream evidence (`/api/status`).**
    - A declarative table per capability: env var names only, `required` vs `enhancement`, what you lose without it, and where to get it. Anything not in the table is keyless.
    - States: keyless / configured / refused / locked / upgradable (works keylessly, a key improves it) / enhanced.
    - `refused` is evidence-driven. A one-time `globalThis.fetch` wrapper maps response hostnames to the capability whose credential they receive. A 401, 402 or 403 marks it refused for 24 h unless a later 2xx from the same hosts supersedes it.
    - A second wrapper instruments each layer's fetch for last-fetched time and row count (`flow`).
    - The endpoint makes no upstream calls (about 6 ms) and says evidence is per-process.
    - Gap: OSIRIS `/api/health` is process liveness only, so "no key" and "dead upstream" both render as an empty layer.

13. **Place-precision classes.**
    - Every layer declares `exact | facility | area | country`. Features override where a layer mixes levels; GDACS EQ/TC/VO are exact, the rest area.
    - Country-level figures shade the country outline (`countryIso3`) or draw a dashed ring, never a pin. A name is never read as a point.
    - Gap: OSIRIS declares no precision class per layer, and `world-map.tsx` has no ISO-3 country-fill path.

14. **Mandatory provenance card per layer.** Each layer carries what a pin is, method, confidence (measured / official / reported / modelled / derived), coverage and at least one limitation. A test fails the build when a layer has no card. Gap: partial at most. OSIRIS `app/docs/apiCatalog.ts` describes routes (params and response keys) by hand, with no per-layer confidence or limitations and no enforcement.

15. **Camera-network discovery pipeline (`lib/discovery`).**
    - Searches government catalogues rather than crawling: CKAN `package_search` (data.gov.uk, catalog.data.gov, open.canada.ca, data.gov.ie, opendata.nhs.scot…), Socrata and ArcGIS Hub.
    - Sniffs JSON/ArcGIS endpoints and maps columns to a generic descriptor.
    - Pure gates:
      - fail: relay host (windy, webcamtaxi, earthcam, insecam, opentopia, skylinewebcams, kameresrbije, trafficland, livecamsworld);
      - fail: bare-IP media;
      - checks for media-host, yield, licence, plain-http transport, country-fit, overlap within 60 m of an existing camera, and media-origin (judge the picture host, not arcgis.com).
    - A human samples about 12 cameras per network. Admission writes a committed descriptor, served by one generic adapter.
    - Real outcome: a D4 ArcGIS mirror was rejected as a duplicate of Caltrans (12/12 within 50 m); Houston was admitted.
    - Gap: OSIRIS has hand-written adapters only, and its catalogue includes Skyline and EarthCam, which Provenance treats as relays.

16. **Earthquake twin matching (`quakeTwin`).**
    - Match USGS ↔ EMSC when time is within 120 s, distance within 60 km and magnitude within 0.8. The pair must be mutual nearest, so swarms don't mis-pair.
    - Claim "none" only inside the other list's time span; otherwise say "outside".
    - Show the twin's credited network: 24 of 36 EMSC matches were credited to US networks, so a match is not independent confirmation.
    - Gap: OSIRIS has one catalogue.

17. **GDELT junk-pin filters.**
    - Require a typed actor (Actor*Type codes). Untyped rows are place names promoted to actors and made up 37% of shipped rows.
    - Require NumArticles ≥2. Don't require NumSources ≥2: it erased Gaza, Ukraine and Syria.
    - Window of 16 files (4 h). Round places to 2 dp. Cap at 300.
    - Fan-out rule: if one source URL yields more than 3 distinct places in one 15-min slot, keep only its city-precision pins. 98.4% precision, about 8% recall.
    - Actor-vs-action geography mismatch is useless, because GDELT copies one geocode into all three blocks.
    - Gap: OSIRIS `gdeltEvents.ts` could adopt all three filters.

18. **Edge cache TTL derived from source cadence.**
    - `s-maxage` equals the source's declared refresh, and stale-while-revalidate equals the TTL, so the worst case is two intervals old.
    - Bodies with a relative age (`staleness.ageMs`) need a much shorter TTL; absolute timestamps don't.
    - An origin body cache cut repeated `JSON.stringify` of 3k aircraft. Planes and cameras were 73% of 276 GB served in 5 days.
    - Gap: OSIRIS routes set ad-hoc caching.

19. **Upstream politeness patterns.**
    - CelesTrak: timeout, single-flight per group, failure hold after an error, group allowlist checked before any upstream work.
    - Launch Library 2: prod → dev mirror fallback with a 1 h hard cache.
    - Overpass: snapshot-first with a plausibility floor.
    - Hosts with malformed HTTP/1.1 headers are fetched over HTTP/2 (`lib/http/h2.ts`). OSIRIS hit the same class of bug with THB's DigiEver encoders.

20. **Windy webcam quadtree harvest (keyed, but the method is the finding).**
    - Ask any bbox for its true `total` with `limit=1`.
    - Split boxes over 1,050 rows (the free-tier offset ceiling) into quadrants.
    - The whole planet resolved in 285 probes into 196 fully pageable leaves: 70,698 webcams (100%) for about 1,803 requests.
    - Never store image URLs, because tokens expire.
    - Gap: OSIRIS doesn't use Windy. The same capacity-probe quadtree applies to any capped bbox API, such as ArcGIS `resultRecordCount`.

21. **News processing, all pure and deterministic.**
    - Clustering:
      - Fuse headlines when the IDF-weighted *mass* of shared tokens clears a threshold. Jaccard put 93% of headlines in singletons.
      - Compare against the lead headline, not a growing centroid.
      - Ignore RSS descriptions (they caused false merges).
      - Apply a time window.
    - Velocity: distinct sources within 10 min.
    - Framing: shared vs outlet-distinctive terms.
    - Primary-source tag: link to an official domain, or documentary phrasing.
    - Headline-place gazetteer: about 250 countries and 50 cities. Names that are also common words (Georgia, Jordan, Chad, Guinea) are skipped.
    - Photon geocoding: refuse a result outside the article's named country; at most 12 per cycle.
    - Gap: partial. OSIRIS `news/route.ts` merges Telegram cross-posts by exact text fingerprint. It has no fuzzy headline clustering across RSS outlets, no velocity and no framing.

22. **Operator-asset proximity alerting (`lib/events`).**
    - Rule: hazard type + tier within R km of a user's assets.
    - Coarse impact radius by type, tier and magnitude, explicitly not a shaking or inundation model.
    - Dedup with a persisted `fired` set and a silent first-arm baseline.
    - Webhook or browser notification.
    - Nearby curated logistics hubs (about 50) are listed by haversine only, with no invented impact.
    - Gap: OSIRIS watch areas could reuse the matcher shape.
