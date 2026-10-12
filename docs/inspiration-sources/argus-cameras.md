# F-argus: camera sources harvested from GoSlowPoke168/Argus

Repo: [GoSlowPoke168/Argus](https://github.com/GoSlowPoke168/Argus) at `7a56f8d` (2026-08-27). MIT, code only, "Copyright (c) 2026 Jeremy Hou". Any ported function needs that notice in the file header. Data date: `cameras.geojson` was generated **2026-07-24T20:07Z** and `cameras.core.json` 2026-07-25.
Compared against the OpenCCTV live index (`/api/cameras/markers`, fetched once, 2026-10-12 13:15 UTC, 139,362 ids) and the TAKIP catalogue `.cache/cctv-catalog.json` (built 2026-10-11 18:42 UTC, 49,212 rows, 46,635 of them from native adapters).
The per-sub-source table for all 395 OpenCCTV subs is in [argus-opencctv-subsources.csv](argus-opencctv-subsources.csv).

## Summary

**Funnel (Argus rows):** 229,308 rows across 390 sources: 382 OpenCCTV sub-sources (150,087), the Windy plugin (72,019) and 7 native plugins (7,202). The `road511_usa` plugin contributed 0 rows.

**Excluded: 92,446.** Each row is counted once, under the first rule it hit.

| Reason | Rows |
|---|---|
| windy.com-hosted | 91,778 (Windy plugin 72,019, `opencctv_windy` 11,925, `windy-providers` 4,246, `swisswebcams` 2,985, `dars` 600, 3 others) |
| Opentopia | 636 |
| Credentials in URL | 19 (18 `bondowoso`) |
| Residential device path | 6 |
| Dynamic-DNS host | 5 |
| Insecam-style (raw IP + device path) | 2 |
| RFC1918/loopback | 0 |

**Argus dataset by country and media (all rows → after exclusions):** 174 countries → 149.

| Country | Rows |
|---|---|
| US | 110,912 → 73,901 |
| JP | 15,127 → 13,278 |
| CA | 10,884 → 5,624 |
| GB | 7,829 → 5,381 |
| IT | 7,071 → 2,336 |
| AT | 6,539 → 3,098 |
| TW | 6,305 → 6,196 |
| DE | 6,093 → 1,777 |
| ES | 5,530 → 3,467 |
| FR | 5,209 → 2,505 |
| CH | 4,816 → 359 |
| FI | 3,398 → 615 |
| AU | 3,324 → 1,372 |
| NO | 3,093 → 1,182 |
| ID | 2,963 → 1,516 |
| CZ | 2,849 → 485 |

| Media | Rows |
|---|---|
| jpg | 187,080 → 94,896 |
| hls | 21,411 → 21,411 |
| needs resolver | 8,014 → 8,014 |
| iframe | 4,042 → 3,805 |
| youtube | 2,882 → 2,882 |
| jpg+hls (natives) | 2,820 → 2,820 |
| mjpeg | 1,396 → 1,371 |
| mp4 | 884 → 884 |
| jpg+mp4 (TfL) | 779 → 779 |

By source group: OpenCCTV 150,087 → 129,660, Windy 72,019 → 0, natives 7,202 → 7,202. The per-sub-source counts are in the CSV.

544 rows on raw public IPs remain. They are Korean and Turkish municipal ITS servers (Incheon, Goyang, Wonju, Kahramanmaraş), flagged for review rather than excluded.

From there:

- **136,862 usable leads.** 8,014 of them are placeholder URLs that need a resolver: `txdot://` 3,792, `faa-weathercam://` 3,269, `weatherbug://` 587 and smaller schemes.
- **62,724 already in TAKIP.** A row counts as in TAKIP if its host is owned by a native adapter or an TAKIP native camera sits within 150 m (61,451), or if `opencctv.ts` already serves it (1,273).
- **74,138 net-new in the frozen snapshot.**

**Live check.** Only 92,429 of Argus's 150,087 OpenCCTV ids are still in the index. The rest were mostly re-keyed: castlerock, arcgis, ny511, alertca and state511 now use hashed or new ids. 46,933 live ids are new since July. Applying the same rules to the **live** index:

| Step | Ids |
|---|---|
| OpenCCTV ids | 139,362 |
| Excluded | −21,529 |
| Owned by TAKIP native adapters | −39,292 |
| Already served by `opencctv.ts` | −2,198 |
| Behind an TAKIP adapter that returns 0 rows (WSDOT, DriveBC, 511 Ontario, 511 Alberta, IDOT) | −4,958 |
| **Net-new listed** | **71,385** |
| **Net-new after merging cross-sub duplicates** (same media, or a different sub within 30 m) | **67,881** |

About 86% of the net-new is directly playable (jpg/hls/mjpeg/mp4). About 7% is iframe or YouTube, and 7% needs a resolver.

Native upstreams add cameras OpenCCTV doesn't list: ALERTCalifornia +~1,000, Open Data Hub +~950, Seattle +~320 and Caltrans' ~2.8k HLS upgrades. **Realistic live net-new is ≈ 45–55k.** That assumes 15–30% of direct cameras are dead or stale, which is the range in the handoff's uptime data. Liveness itself was not measured, because that needs the batch fetch.

**Corrections to CCTV-handoff.md:**
- **Houston TranStar is not a 1.5k lead.** 880 of its 1,031 cameras sit within 150 m of TAKIP TxDOT cameras (TxDOT's Houston district), leaving about 150 net-new.
- **TAKIP Caltrans is truncated.** It is capped at 2,000 because `route.ts` doesn't paginate the ArcGIS query. Argus's per-district JSON has 3,304 cameras.
- **WSDOT, DriveBC, 511 Alberta, 511 Ontario and Montreal return 0 rows** in the 2026-10-11 catalogue (511 Ontario returns only its 3 curated fallback rows).
  - WSDOT's URL now returns 404.
  - Alberta answers "Invalid Key".
  - DriveBC: Argus's URL variant returns 1,067 cameras. TAKIP's own variant (`drivebc.ca/api/webcams`, no `www.`, no trailing slash, no `format=json`) was not probed. The URL difference is the likely cause; also check the 10 s `subSource` timeout against a 1.24 MB body.
- **TAKIP is serving 333 Windy-hosted cameras, 3 Opentopia cameras and 2 credentialed `bondowoso` URLs** through `opencctv.ts` right now.

**Top 10 picks** (full ranking at the end):
1. Lift `opencctv.ts`'s Asia caps (+23k).
2. Widen OpenCCTV beyond Asia with owns_hosts and exclusions (+45k).
3. ALERTCalifornia (2,272, keyless).
4. Open Data Hub WebcamInfo (1,991, keyless).
5. FAA WeatherCams (3,255).
6. CDOT COtrip (~1,000, one line).
7. Caltrans via cwwp2 (+~940 cameras and 2.8k HLS).
8. DriveBC fix: likely the URL variant (+1,045).
9. PhenoCam (~900–1,086).
10. SC/SD Iteris (~920).

## Sources (one row per upstream, sorted by net-new)

**Column key:**
- **Argus:** rows in the Argus snapshot.
- **Live:** OpenCCTV ids now, plus the upstream count where probed.
- **Net-new:** cameras TAKIP lacks, after exclusions and ownership.
- **Overlap:** TAKIP rows owned or nearby.
- **Port:** `bridge` means `scripts/scrapers/opencctv_bridge.py` (`_get_ids`, `_post_batch`, `_direct_eligible`, `_to_feature`). TAKIP already has the equivalent fetch in `opencctv.ts`; what's worth taking from Argus is the 429 backoff, the `force_direct` / `proxy_zone` / `geo_allow` admission and the ipcamlive resolver.

| Source | Country/region | Argus | Live now | Net-new | Endpoint pattern | Auth | Media | TAKIP overlap | Port from | Probe |
|---|---|---|---|---|---|---|---|---|---|---|
| MLIT river cams (`rivergojp`) | JP | 10,628 | 10,837 | 10,292 | `cam.river.go.jp/…jpg`; index = OpenCCTV | none | jpg | 33 curated + 534 in the `opencctv.ts` sample (host match is misleading here) | bridge (Asia uncap) | not probed (OpenCCTV is the index) |
| twipcam relay + Freeway Bureau (`twipcam`) | TW | 6,013 | 5,874 | 5,015 | `c01.twipcam.com/cam/snapshot/wra-{id}.jpg` (WRA river cams); `cctv{n,c,s}.freeway.gov.tw/abs2mjpg/bmjpg?camera={id}` | none | jpg 4,775 / mjpeg 1,237 | 322 near THB; 536 sampled | bridge | `tisvcloud.freeway.gov.tw/history/motc20/CCTV.xml`: timeout |
| FAA WeatherCams (+NAV CANADA, whose 671 Argus rows left OpenCCTV) | US 2,700, CA 578 | 3,269 | 3,278 | 3,255 | placeholder `faa-weathercam://{id}` → native `weathercams.faa.gov/api/cameras`, then one image call per camera | none | jpg (resolver) | none | write native (Argus never resolved it) | not probed; verified keyless 2026-10-11 (handoff) |
| National Highways England (`trafficengland`) | GB | 2,307 | 2,440 | 2,438 | `public.highwaystrafficcameras.co.uk/cctvpublicaccess/images/{id}.jpg`; no keyless index known (NTIS DATEX needs registration) | none (media) | jpg | none | bridge | not probed |
| OpenTrafficCam aggregator (`opentrafficcam`) | US: OH ~970, CA ~620, CO ~318, DE ~284 | 2,684 | 4,686 | 2,216 | `itscameras.dot.state.oh.us/images/{dist}/{cam}.jpg`; `wzmedia.dot.ca.gov/D{n}/{cam}.stream/playlist.m3u8`; `video.deldot.gov/live/{cam}.stream/playlist.m3u8`; `cocam.carsprogram.org/…jpg` | none | hls 1,686 / jpg 998 | 2,470 owned (Caltrans, ADOT, NYSDOT) | bridge; better as natives (OH, DE, CO, Caltrans) | DelDOT `tmc.deldot.gov/json/videocamera.json`: 200 json 185 kB, 362 cams (355 Active); `urls.m3u8s` is https HLS |
| ALERTCalifornia | US-CA | 1,245 | 1,277 OCC / **2,272** upstream | ~2,200 | `cameras.alertcalifornia.org/public-camera-data/all_cameras-v3.json` (GeoJSON, `id` like `Axis-MtVaca1`, `state`, `county`, `last_frame_ts`, fov fields); image `…/public-camera-data/{id}/latest-frame.jpg` | none | jpg | 5 near | native (no Argus scraper) | 200 json 2.78 MB, 2,272 features |
| Open Data Hub Südtirol (`opendatahub`, feratel thumbnails) | IT 699, AT 120, DE 115 | 1,026 | 1,046 OCC / **1,991** upstream | ~1,900 | `tourism.api.opendatahub.com/v1/WebcamInfo?pagesize=&pagenumber=` → `Webcamurl`, `Previewurl`, `Streamurl`, `GpsInfo`, `Active`; media `wtvthmb.feratel.com/thumbnails/{id}.jpeg?dcsdesign=…` | none (check per-item licence) | jpg (some streams) | none | native | 200 json, TotalResults 1,991 |
| OSM-tagged webcams (`osm-webcams`) | ES, FR, NO, EE, GB… | 2,197 | 2,269 | 1,904 (458 embed) | mixed: `informo.madrid.es` 331, `ristmikud.tallinn.ee` 236, `data.nottinghamtravelwise.org.uk` 229, `foto-webcam.eu` 205 | none | jpg 1,449 / iframe 702 | 355 owned; ~500 duplicate other subs (Madrid, foto-webcam) | bridge | not probed |
| ArcGIS aggregator (`arcgis_cams`) | US: TN 527, MO 488, DE 334, ND 180, HI 143, WA 58; IL 897 | 7,668 | 3,816 | 1,752 + 897 behind IDOT | per-state ArcGIS layers; media e.g. `sfs02-traveler.modot.mo.gov/rtplive/MODOT_CAM_{n}/playlist.m3u8`, `cctv.cdn.goakamai.org/SnapShot/…`, `video{n}.iowadot.gov/…m3u8` | none | jpg / hls | 1,167 owned (Iowa, TripCheck) | bridge | not probed |
| NDAWN (`ndawn`, new since July) | US ND/MN 1,648, CA 56 | 0 | 1,704 | 1,704 | ids `ndawn-{station}-{n}`; upstream host only visible through a batch call | ? | ? | none | bridge | not probed |
| MLIT road images (`road-info-prvs`) | JP | 1,320 | 1,757 | 1,673 | `www.road-info-prvs.mlit.go.jp/roadinfo/img/doro_gazo/pc/{timestamp}/{id}.jpeg`: a **`{timestamp}` template**, resolve at view time | none | jpg (template) | 83 sampled | bridge + template resolver | not probed |
| VDOT (`virginia`) | US-VA | 1,469 | 1,564 | 1,563 | `media-sfs{n}.vdotcameras.com/rtplive/{cam}/playlist_sfm4s.m3u8`; native index not found | none | hls | none | bridge | guessed `511.vdot.virginia.gov/services/map/layers/map/cams`: 404 |
| Castle Rock aggregator (`castlerock`) | US: CO 965, MA 158, IE 214 (TII); MN/IN/KS owned | 4,798 | 4,237 | 1,475 | `video.dot.state.mn.us/public/{cam}.stream/playlist.m3u8`; `kdot-sfs{n}.us-east-1.skyvdn.com/rtplive/…`; `skysfs3.trafficwise.org/…` | none | hls 4,212 / jpg 586 | 2,762 owned. These are **HLS upgrades** for MnDOT, INDOT and KDOT, which TAKIP shows as stills | bridge; CO via the `cars511x` one-liner (handoff) | not probed |
| WSDOT (`wsdot`). **Fix** | US-WA | 33 | 1,539 | 1,467 (fix) | TAKIP `route.ts` calls `data.wsdot.wa.gov/log/public/cameras.json` → 404; media `images.wsdot.wa.gov/{region}/{id}.jpg` | WSDOT Traveler API: free AccessCode | jpg | adapter exists, 0 rows | bridge, or WSDOT API | TAKIP URL: 404 text/html |
| CamStreamer YouTube (`camstreamer`) | US, JP, GB… | 1,784 | 1,567 | 1,453 (embed) | YouTube embed ids | none | youtube | TAKIP CamStreamer has 49 | bridge | not probed |
| OpenSnow (`opensnow`) | US, CA, FR | 1,251 | 1,292 | 1,238 | `webcams.opensnow.com/current/{id}.jpg`; index unknown | none (media) | jpg | 52 near | bridge | not probed |
| IBI 511 aggregator (`state511`) | US: SC 767, CT 346 net; the other states are owned | 26,194 (18,160 are UT rows, apparently duplicates) | 13,634 | 1,130 | `{511 host}/map/Cctv/{id}`; CT through the existing `ibi511.ts` (`ctroads.org/List/GetData/Cameras`) | none | jpg | 12,503 owned (UDOT, GDOT, NDOT, FDOT, PennDOT, ITD, LADOTD, ADOT, AK) | `ibi511.ts` config line (CT) | CT: 200 json, recordsTotal 347 (`isVideoAuthRequired` → stills only) |
| Airport webcams (`airportwebcams`) | global | 1,131 | 1,056 | 1,050 (792 embed) | mixed (`weathercams.faa.gov` 275, `cam-aero.eu`, `aero.webcam`…) | none | iframe 834 / jpg 285 | — | bridge + `host_prober.py:probe_iframe_host` | not probed |
| DriveBC (Argus native + OpenCCTV `drivebc`). **Fix** | CA-BC | 1,048 | **1,067** (1,045 `is_on`) | 1,045 (fix) | `www.drivebc.ca/api/webcams/?format=json` → list with `id`, `name`, `location.coordinates`, `links.imageDisplay` (`/images/{id}.jpg?t=`), `is_on`, `marked_stale` | none | jpg | TAKIP DriveBC returns 0 rows. It calls `drivebc.ca/api/webcams` (no www, no slash, no format); that variant was not probed, so the URL is the likely cause, not a verified one | `scrapers/canada/bc/drivebc.py:fetch` | 200 json 1.24 MB |
| Caltrans (Argus native, OpenCCTV `caltrans`, otcm-CA) | US-CA | 3,304 (+248) | D7 alone: 592 rows, 478 in service, 401 with HLS | ~940 cameras + ~2.8k HLS | `cwwp2.dot.ca.gov/data/d{n}/cctv/cctvStatusD{nn}.json`, n = 1…12 → `cctv.location.*`, `inService`, `imageData.static.currentImageURL`, `imageData.streamingVideoURL` (`wzmedia.dot.ca.gov` HLS) | none | jpg + hls | TAKIP Caltrans has 2,000: the ArcGIS cap, no `resultOffset` paging | `scrapers/usa/california/caltrans.py:fetch` | D7: 200 json 1.85 MB |
| PhenoCam | US 694, FR, ES… | 891 | 916 OCC / **1,086** upstream (incl. inactive) | ~913 | `phenocam.nau.edu/api/cameras/?format=json&limit=&offset=` (DRF: `Sitename`, `Lat`, `Lon`, `active`, `date_last`); image `phenocam.nau.edu/data/latest/{site}.jpg` | none | jpg (30-min stills) | none | native | 200 json 1.4 kB, count 1,086 |
| USGS HIVIS (`hivis`) | US (AK-heavy) | 857 | 916 | 912 | `usgs-nims-images.s3.amazonaws.com/{n}/{cam}/{cam}_newest.jpg`; index unknown | none | jpg | none | bridge | not probed |
| OpenWebcamDB (`openwebcamdb`) | global | 894 | 948 | 815 (767 embed) | YouTube / tvkur embeds | none (don't use their API; see the leaked-token note in the handoff) | youtube | 88 sampled | bridge | not probed |
| SCDOT (`scdot`) | US-SC | 743 | 774 | 772 (the same cameras as `s511-SC`) | `s{18-20}.us-east-1.skyvdn.com/rtplive/{id}/playlist.m3u8` | none | hls | none | Iteris loader (handoff: `sc.cdn.iteris-atis.com/geojson/icons/metadata/icons.cameras.geojson`) | not probed (verified by handoff) |
| 511 Ontario (`ontario`). **Fix** | CA-ON | 898 | 869 | 754 (fix) | TAKIP calls `511on.ca/api/v2/get/cameras`; media `511on.ca/map/Cctv/{id}` | ? | jpg | 3 curated fallback rows | — | not probed |
| Trafikverket weather-station cams (`trafikverket`) | SE | 1,489 | 1,497 | 724 (VViS road-weather cams) | `api.trafikinfo.trafikverket.se/…` images | media keyless; the official list API needs a free key | jpg | 773 owned (TAKIP Sweden via Kolla Trafiken) | bridge | not probed |
| Statens vegvesen (`vegvesen`) | NO | 710 | 702 | 702 | `kamera.atlas.vegvesen.no/api/images/{id}`; DATEX list needs an account | media keyless | jpg | none | bridge | not probed |
| Skaping (`skaping`) | FR | 800 | 688 | 685 (embed) | `www.skaping.com/{site}/{cam}` | none | iframe | none | `probe_iframe_host` | not probed |
| WYDOT (`wyoroad`, new since July) | US-WY | 0 | 693 | 680 | ids `wyoroad-{site}-{n}`; host not seen | ? | ? | 13 near | bridge | not probed |
| i-traffic (`itraffic`) | ZA | 569 | 657 | 657 | `www.i-traffic.co.za/map/Cctv/{id}--{n}`: an IBI path, so `/List/GetData/Cameras` probably works with `ibi511.ts` | none | jpg | none | `ibi511.ts` candidate | not probed |
| Seattle SDOT (`sdot`) | US-WA | 337 | 339 OCC / **658** upstream | ~650 | `web.seattle.gov/Travelers/api/Map/Data?zoomId=13&type=2` → `Features[].Cameras[]`; image `www.seattle.gov/trafficcams/images/{name}.jpg` | none | jpg | none | native | 200 json 93 kB, 314 features / 658 cams |
| HCMC traffic (`vietnam-traffic`) | VN | 734 | 695 | 610 | `giaothong.hochiminhcity.gov.vn/…?id=` | none | jpg | 85 sampled | bridge (Asia) | not probed |
| ALGO Traffic (`algotraffic`) | US-AL | 678 | 607 | 607 | `api.algotraffic.com/v{n}/Cameras/{id}/snapshot.jpg` | ? | jpg | none | bridge | guessed `/v3.0/Cameras`: 404 |
| Időkép (`idokep`) | HU 556 | 1 | 601 | 601 | `cam.idokep.hu/…` | ? (check terms) | jpg | none | bridge | not probed |
| Panomax | AT, IT, DE | 601 | 603 | 599 | `live-image.panomax.com/cams/{id}/recent_reduced.jpg` | none | jpg | — | bridge | not probed |
| Austin (`socrata`) | US-TX | 475 | 634 | 571 | Socrata `data.austintexas.gov/resource/b4k4-adkb.json`; image `cctv.austinmobility.io/image/{id}.jpg` | none | jpg | 63 near TxDOT | native | verified by handoff |
| webcamtaxi | global | 13 | 556 | 523 (embed) | YouTube | none | youtube | 23 | bridge | not probed |
| myairportcams / Airservices | AU, NZ, PG | 514 | 501 | 501 | `view.myairportcams.com/…`, `weathercams.airservicesaustralia.com/wp-content/uploads/airports/{n}/{n}_{n}.jpg` | none | jpg | none | bridge | not probed |
| MD CHART (`mdchart`) | US-MD | 541 | 474 | 474 | `strmr{n}.sha.maryland.gov/rtplive/{hex}/playlist.m3u8` | none | hls | none | bridge | not probed |
| Seoul TOPIS (`topis-seoul`) | KR | 500 | 493 | 467 | `topiscctv1.eseoul.go.kr/…m3u8` | none | hls | 23 sampled | bridge (Asia) | not probed |
| 511 Alberta (`alberta`). **Fix** | CA-AB | 447 | 450 | 450 (fix) | TAKIP calls `511.alberta.ca/api/v2/get/cameras` | **now needs a key** | jpg | adapter exists, 0 rows | — | 400 xml "Invalid Key" |
| OKTraffic (`oktraffic`) | US-OK | 31 | 440 | 440 | `stream.oktraffic.org/delay-stream/{id}.stream/playlist.m3u8` | none | hls | none | bridge | not probed |
| Jogja province (`jogjaprov`) | ID | 543 | 499 | 434 | `cctv.jogjaprov.go.id/…m3u8` | none | hls | 63 sampled | bridge (Asia) | not probed |
| webcamera.pl | PL | 460 | 429 | 418 | `imageserver.webcamera.pl/miniaturki/{slug}.jpg` | none | jpg | 11 near | bridge | not probed |
| feratel (direct) | AT, DE, IT | 856 | 410 | 410 (≈ the same spots as Open Data Hub: 408 within 30 m) | `wtvpict.feratel.com/picture/{n}/{id}.jpeg` | none (feratel terms) | jpg | none | bridge | not probed |
| Bayern Info (`bayerninfo`) | DE ~370 (`/cam/bi/`), AT 461 (`/cam/asfinag/`, owned) | 838 | 843 | 397 | `map.bayerninfo.de/cam/{bi\|asfinag}/{id}` | none | jpg | 446 owned (ASFINAG) | bridge | not probed |
| York Region (`yorkmaps`) | CA-ON | 386 | 390 | 390 | `ww{n}.yorkmaps.ca/webtrafficimages/loc{id}.jpg` | none | jpg | none | bridge | not probed |
| IDOT / travelmidwest. **Fix** | US-IL | 412 | 348 (+897 `arcgis-IL`) | 348 + 897 (fix) | TAKIP `travelmidwest.com/lmiga/cameraReport.json` now returns empty; media `cctv.travelmidwest.com/…jpg` | none | jpg | adapter exists, 0 rows | bridge | not probed (handoff: empty) |
| Madrid Informo | ES | 352 | 352 OCC / **357** upstream | ~335 (also inside `osm-webcams`) | `informo.madrid.es/informo/tmadrid/CCTV.kml`; image `informo.madrid.es/cameras/Camara{n}.jpg` | none | jpg | 17 near | native | 200 kml 239 kB, 357 placemarks |
| **Long tail**: 298 more OpenCCTV subs (Busan 336, AVAMET 316, KKR 308, NE Travel Data 304, foto-webcam 303, ipcamlive 277, Arlington 266, QLDTraffic 252, USGS ashcam 240, Calgary 213, Traffic Wales 213, Siata 187, NMRoads 171…) | EU 5.4k, Asia boxes 4.1k, US 3.7k, rest 2.2k | 29,500 | 28,007 | 15,407 (14,428 direct) | see CSV | mostly none | mixed | 12,008 owned | bridge | not probed |
| Iowa DOT (Argus native) | US-IA | 846 | 1,260 (ArcGIS count) | ~14 + HLS upgrade | `services.arcgis.com/8lRhdTsQyJpO52F1/ArcGIS/rest/services/Traffic_Cameras_View/FeatureServer/0/query` → `ImageURL`, `VideoURL` | none | jpg + hls | TAKIP Iowa DOT 861 (CARS stills) | `scrapers/usa/iowa/iowa511.py:fetch` (VideoURL) | 200 json, count 1,260 |
| NYC DOT, TfL, NZTA, LTA Singapore (Argus natives) | US / GB / NZ / SG | 968 / 779 / 249 / 8 | — | 0 | `webcams.nyctmc.org/api/cameras`, `api.tfl.gov.uk/Place/Type/JamCam`, `trafficnz.info/service/traffic/rest/4/cameras/all`, `api.data.gov.sg/v1/transport/traffic-images` | none | jpg (TfL also mp4) | in TAKIP (982 / 890 / 248 / 8) | — | not probed (live in TAKIP) |
| Owned OpenCCTV subs (TxDOT 2,422, digitraffic 2,148, DGT 1,806, ny511 1,500, ASFINAG 1,081, Autostrade 951, nycdot 941 (US-geo-gated), TfL 890, HK 814 + 152 served, MiDrive 634, New England 317, Eismoinfo 308…) | — | — | — | ~0 | — | — | — | owned by native adapters; add these hosts to owns_hosts | `txdot_resolver.py` not needed (TAKIP has TxDOT) | — |
| Road511 (`road511_usa` plugin) | US, 20 states | 0 | — | 0 | `api.road511.com/api/v1/features?type=cameras&jurisdiction={ST}` | **now keyed** | — | — | don't port | 401 json "API key required" |
| Windy (plugin + 4 OpenCCTV subs) | global | 91,775 | 21,333 OCC | excluded | `imgproxy.windy.com`, `images-webcams.windy.com` | free key, 10-min image tokens | jpg | TAKIP serves 333 via `opencctv.ts` (remove) | don't port | not probed |

## OpenCCTV widening (live index, 2026-10-12)

How the columns were computed:
- **Owned:** an TAKIP native camera within 150 m, or the media host belongs to a native adapter. Excluded are two hosts TAKIP covers only partly: river.go.jp (33 curated) and 511 Ontario (fallback).
- **Excluded:** the sub-source exclusions (Windy ×4, Opentopia) plus per-row URL rules. Ids Argus never saw take their sub-source's rate.
- **Box:** `opencctv.ts`'s three boxes. They also reach Turkey, the Middle East and parts of eastern Europe east of 25°E.

| Region | ids | owned elsewhere | served today | excluded | fix TAKIP adapter | net-new (listed) | net-new after cross-sub merge | of net: direct / embed / resolver |
|---|---|---|---|---|---|---|---|---|
| Inside `opencctv.ts` boxes (JP 14.7k, TW 6.0k, KR 2.4k, VN 1.3k, ID 1.5k, TR…) | 29,042 | 1,289 | 2,198 | 2,395 | 0 | 23,160 | **23,108** | 20,921 / 566 / 1,673 (template) |
| North America: US | 58,212 | 27,218 | 0 | 2,946 | 2,694 | 25,354 | **23,091** | 21,093 / 1,715 / 2,546 (FAA) |
| Europe | 41,458 | 9,338 | 0 | 14,617 (Windy) | 0 | 17,503 | **16,362** | 14,986 / 2,516 / 1 |
| North America: Canada | 5,523 | 769 | 0 | 431 | 2,264 | 2,059 | **2,049** | 1,425 / 98 / 536 (FAA) |
| Oceania | 2,812 | 665 | 0 | 752 | 0 | 1,395 | **1,362** | 1,191 / 111 / 93 |
| Africa | 1,074 | 1 | 0 | 100 | 0 | 973 | **972** | 876 / 97 / 0 |
| Latin America & Caribbean | 1,185 | 12 | 0 | 277 | 0 | 896 | **892** | 556 / 130 / 210 |
| Antarctica / satellite / unknown | 56 | 0 | 0 | 11 | 0 | 45 | **45** | 43 / 2 / 0 |
| **Total** | **139,362** | **39,292** | **2,198** | **21,529** | **4,958** | **71,385** | **67,881** | 61,091 / 5,235 / 5,059 |

Where the ownership and exclusions fall: the sub-sources that owns_hosts and the exclusion list remove.

| Sub-source | ids | owned elsewhere | excluded | net-new |
|---|---|---|---|---|
| windy | 15,443 | 0 | 15,443 | 0 |
| state511 (IBI: UT, GA, NV, FL, PA, ID, LA, AZ, AK) | 13,634 | 12,503 | 0 | 1,130 (SC, CT) |
| castlerock (MN, IN, KS HLS) | 4,237 | 2,762 | 0 | 1,475 (CO, MA, IE) |
| opentrafficcam | 4,686 | 2,470 | 0 | 2,216 |
| windy-providers | 3,974 | 0 | 3,974 | 0 |
| txdot (`txdot://` placeholders) | 2,448 | 2,422 | 0 | 26 |
| digitraffic | 2,154 | 2,148 | 0 | 6 |
| dgt | 1,810 | 1,806 | 0 | 4 |
| swisswebcams (Windy-hosted) | 1,545 | 0 | 1,545 | 0 |
| ny511 | 1,508 | 1,500 | 0 | 8 |
| arcgis_cams | 3,816 | 1,167 | 0 | 1,752 (+897 IL fix) |
| asfinag | 1,081 | 1,081 | 0 | 0 |
| autostrade | 955 | 951 | 0 | 4 |
| nycdot (946 `geo`: US-only) | 946 | 941 | 0 | 5 |
| tfl | 890 | 890 | 0 | 0 |
| houstontranstar | 1,031 | 880 | 0 | 151 |
| hongkong | 966 | 814 (+152 served) | 0 | 0 |
| trafikverket | 1,497 | 773 | 0 | 724 |
| bayerninfo | 843 | 446 | 0 | 397 |
| dars (Windy-hosted) | 371 | 0 | 371 | 0 |
| opentopia | 164 | 0 | 164 | 0 |
| bondowoso (credentials) | 19 | 0 | 19 | 0 |

### Notes for building the widening

- **The marker index carries enough to pre-filter before any batch POST.** The codes below were inferred by crosstab against Argus:
  - `fts`: 0 image, 1 mjpeg, 2 m3u8, 3 iframe, 5 mp4.
  - `cats`: 0 traffic, 1 beach/water/port, 2 weather, 3 ski, 4 nature/volcano/science, 5 aviation, 6 satellite.
  - `geo`: 946 ids, all `nycdot`, US-only.

  Ids also carry a sub-source prefix (`s511-SC-…`, `arcgis-TN-…`, `cr-…`), so wholly owned or excluded subs (Windy ×4, Opentopia, TxDOT, DGT, digitraffic, ASFINAG, TfL…) can be dropped before fetching. Owned and excluded together are about 61k of the 139k; partly owned subs (state511, castlerock, arcgis, opentrafficcam) need the batch call and then the owns_hosts and 150 m checks.
- **Batch cost.** All of the net-new is about 1,430 POSTs of 50 ids each. The Asia boxes alone take about 460. That's ingest-job territory, not the 12 s request path. Argus's bridge uses 5 workers with a 10 s sleep on 429.
- **Only add a host to owns_hosts when the native adapter carries at least as many cameras as the aggregator.** Counter-examples today:
  - Caltrans: 2,000 vs 3,304.
  - Trafikverket: 837 vs 1,497.
  - river.go.jp: 33 vs 10.8k.
  - 511 Ontario: 3 vs 869.
- **The 150 m spatial rule is needed.** Host match misses operator-equivalent feeds such as TranStar = TxDOT, `wzmedia` HLS = Caltrans, and `/cam/asfinag/` = ASFINAG. Against host ownership, 50 m and 150 m give nearly identical results (12,465 vs 12,538 agreed).

## Top 10 adapters to build first (net-new ÷ effort)

Effort scale:
- **1:** a keyless documented index, or a config line in an existing TAKIP loader.
- **2:** a new adapter with per-camera calls or a resolver, or OpenCCTV batch volume that needs the ingest job.
- **3:** scrape or keyed.

The net-new figures are measured above.

| # | Adapter | Net-new | Effort | Score | Why / how |
|---|---|---|---|---|---|
| 1 | `opencctv.ts`: lift the Asia caps, add exclusions (windy*, opentopia, swisswebcams, dars, bondowoso) and owns_hosts (`tdcctv.data.one.gov.hk`, `thb.gov.tw`) | ~23,100 (20.9k direct) | 1 | 23k | Existing adapter. MLIT river 10.3k, twipcam 5.0k, KR city ITS 2k, VN, ID. `road-info-prvs` needs its `{timestamp}` resolved |
| 2 | `opencctv.ts` beyond Asia (new boxes + owns_hosts list above) | ~44,800 unique (≈38k direct) | 2 | 22k | NH England 2.4k, VDOT 1.6k, OH/DE/MO/TN/HI/ND, OpenSnow, HIVIS, Vegvesen, Bayern… Natives below should own their hosts once built |
| 3 | ALERTCalifornia | ~2,200 | 1 | 2.2k | One keyless GeoJSON; ~1,000 more than OpenCCTV lists |
| 4 | Open Data Hub `WebcamInfo` | ~1,900 | 1 | 1.9k | Keyless and paged; covers feratel South Tyrol; check per-item licence |
| 5 | FAA WeatherCams (+NAV CANADA) | 3,255 | 2 | 1.6k | Keyless, but the latest image is one call per camera |
| 6 | CDOT COtrip (`cars511x` line, `api-511x-co.carsprogram.org`) | ~1,000 (castlerock CO 965 + otcm CO, merged) | 1 | 1.0k | One config line (handoff) |
| 7 | Caltrans → cwwp2 per-district JSON | ~940 + ~2,800 HLS | 1 | 0.9k+ | Port `scripts/scrapers/usa/california/caltrans.py:fetch` (12 GETs, `inService` filter, `streamingVideoURL`). Fixes the 2,000 cap |
| 8 | DriveBC fix | 1,045 | 1 | 1.0k | Port `scripts/scrapers/canada/bc/drivebc.py:fetch` (`www.` + trailing slash + `format=json`). Argus's variant verified at 1,067; TAKIP's variant not probed, so also check the 10 s timeout |
| 9 | PhenoCam | ~913 active (1,086 total) | 1 | 0.9k | Keyless DRF API |
| 10 | Iteris loader: SCDOT + SDDOT (+MDT) | ~920 (772 + 153, + MT) | 1 | 0.9k | One shared loader (handoff endpoint); SC HLS + stills |

Next in line:
- Seattle SDOT 658 (1)
- i-traffic ZA 657 (1, if IBI `List/GetData` answers)
- Austin 571 (1)
- Madrid 357 (1)
- DelDOT 362 (1, https HLS)
- CT 347 (1, `ibi511.ts` line)
- WSDOT 1,467 (2: free AccessCode or OpenCCTV)
- 511 Alberta 450 and 511 Ontario 754 (2, now keyed or unclear)

Also worth porting from Argus (MIT, with notice):
- `scripts/scrapers/ipcamlive_resolver.py:resolve`: `player.php?alias=` → `address` + `streamid` → `/streams/{id}/stream.m3u8`.
- `scripts/scrapers/host_prober.py:probe_image_host` and `probe_iframe_host`: magic-byte and MJPEG-aware image checks, XFO/CSP frame-ancestors checks, and verdicts applied per host. These feed the health checker and iframe admission.
- `scripts/store.py:_feed_key` and `dedupe_prefer_native`.

## Argus storage and dedup design (brief; the handoff covers it)

1. `store.py:export_compact` writes three tiers from a SQLite store: core, labels and detail.
2. `cameras.core.json` holds parallel `lon`/`lat`/`de`/`live`/`src`/`cc`/`ft` arrays with `srcDict`/`ccDict`/`ftDict`: 7 MB for 229k cameras. `cameras.labels.json` holds names plus a city dictionary.
3. `cameras.detail/{n}.json` holds 1,000 cameras per chunk (id, feed, stream, route, update rate), fetched when a camera is opened.
4. `dedupe_prefer_native` drops `opencctv_*` rows whose `_feed_key` (host + lowercased path, query dropped) matches a native row. Dropping the query is unsafe for query-keyed feeds (`bmjpg?camera=`, `ImageHandler.ashx?id=`); keep non-cache-buster params.
5. Upserts are keyed on `{source}_{native id}` with no tombstones. The 18,160 duplicated UT rows show what happens when the upstream re-keys.

## Method and caveats

- **Probes.** One GET each, sequential, using the brief's curl. There were 16: 3 TAKIP-diagnostic (WSDOT, Alberta, DriveBC variant), 3 guessed endpoints that 404'd or timed out (VDOT, ALGO, Taiwan tisvcloud), and the rest listed in the table. The OpenCCTV marker index was the only OpenCCTV request, with no batch POSTs.
- **Unknown upstreams.** NDAWN, WYDOT and the other ids Argus never saw (46,933) were mapped to sub-sources by id prefix. Their hosts and liveness are unknown until a batch fetch.
- **Countries for new ids** were assigned by the nearest Argus point (0.5° grid).
- **Spatial matching is conservative.** It merges distinct cameras on the same tower; for example, ALERTCalifornia vs FAA (343) and FAA vs USGS ashcam (122) are counted as duplicates.
- **Licence (a separate axis from auth).** Rows marked Auth `none` are keyless, not licence-free. For Panomax, foto-webcam, OpenSnow, Időkép, EarthCam, Skaping, webcamera.pl, feratel/ODH, myairportcams and CamStreamer/YouTube, check the platform's terms before embedding. Government DOT and agency feeds are generally public, but attribution is still expected.
- **Token expiry.** None of the top sources' media URLs carry expiring tokens. The exceptions are Windy (10-minute image tokens; excluded) and IBI video where `isVideoAuthRequired` is set (CT, GA, FL, NC: stills only). ipcamlive stream servers rotate, so re-resolve each sync. `road-info-prvs` needs `{timestamp}` filled in. DriveBC's `?t=` is a cache-buster.
- **No URLs of excluded cameras are listed anywhere** in this file or the CSV. The CSV holds hosts and counts only.
