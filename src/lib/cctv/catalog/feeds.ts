import type { StateFeed } from '@/lib/cctv/sources/platforms/us-511';
import { SDDOT, MDT, SCDOT, fetchSddotCameras, fetchMdtCameras, fetchScdotCameras } from '@/lib/cctv/sources/platforms/iteris';
import { fetchSeattleCameras } from '@/lib/cctv/sources/us/seattle';
import { fetchAlertCaCameras } from '@/lib/cctv/sources/us/alertcalifornia';
import { VDOT_BOUNDS, fetchVdotCameras } from '@/lib/cctv/sources/us/vdot';
import { AUSTIN_BOUNDS, fetchAustinCameras } from '@/lib/cctv/sources/us/austin';
import { LEXINGTON_BOUNDS, fetchLexingtonCameras } from '@/lib/cctv/sources/us/lexington';
import { OHGO_BOUNDS, fetchOhgoCameras } from '@/lib/cctv/sources/us/ohgo';
import { DELDOT_BOUNDS, fetchDeldotCameras } from '@/lib/cctv/sources/us/deldot';
import { NJTA_BOUNDS, fetchNjtaCameras } from '@/lib/cctv/sources/us/njta';
import { ODH_BOUNDS, fetchOpenDataHubCameras } from '@/lib/cctv/sources/europe/opendatahub';
import { ESTONIA_BOUNDS, fetchEstoniaCameras } from '@/lib/cctv/sources/europe/estonia';
import { MADRID_BOUNDS, fetchMadridCameras } from '@/lib/cctv/sources/europe/madrid';
import { PHENOCAM_BOUNDS, fetchPhenoCamCameras } from '@/lib/cctv/sources/global/phenocam';
import { MLIT_RIVER_BOUNDS, fetchMlitRiverCameras } from '@/lib/cctv/sources/asia/mlit-river';
import { MLIT_ROAD_BOUNDS, fetchMlitRoadCameras } from '@/lib/cctv/sources/asia/mlit-road';
import { FAA_BOUNDS, fetchFaaCameras } from '@/lib/cctv/sources/us/faa-weathercams';
import { HIVIS_BOUNDS, fetchHivisCameras } from '@/lib/cctv/sources/us/usgs-hivis';
import { ASHCAM_BOUNDS, fetchAshcamCameras } from '@/lib/cctv/sources/us/usgs-ashcam';
import { NYS_MESONET_BOUNDS, fetchNysMesonetCameras } from '@/lib/cctv/sources/us/nys-mesonet';
import { GOAKAMAI_BOUNDS, fetchGoAkamaiCameras } from '@/lib/cctv/sources/us/goakamai';
import { ALGO_BOUNDS, fetchAlgoCameras } from '@/lib/cctv/sources/us/algotraffic';
import { CALGARY_BOUNDS, fetchCalgaryCameras } from '@/lib/cctv/sources/canada/calgary';
import { YORK_REGION_BOUNDS, fetchYorkRegionCameras } from '@/lib/cctv/sources/canada/york-region';
import { TAIWAN_WRA_BOUNDS, fetchTaiwanWraCameras } from '@/lib/cctv/sources/asia/taiwan-wra';
import { BUSAN_BOUNDS, fetchBusanCameras } from '@/lib/cctv/sources/asia/busan';
import { ULSAN_BOUNDS, fetchUlsanCameras } from '@/lib/cctv/sources/asia/ulsan';
import { DAEGU_BOUNDS, fetchDaeguCameras } from '@/lib/cctv/sources/asia/daegu';
import { SEOUL_TOPIS_BOUNDS, fetchSeoulTopisCameras } from '@/lib/cctv/sources/asia/seoul-topis';
import { ILLINOIS_BOUNDS, fetchIllinoisCameras } from '@/lib/cctv/sources/us/illinois';
import { TII_BOUNDS, fetchTiiCameras } from '@/lib/cctv/sources/europe/tii';
import { CAMSTREAMER_BOUNDS, fetchCamStreamerCameras } from '@/lib/cctv/sources/global/camstreamer';
import { SIATA_BOUNDS, fetchSiataCameras } from '@/lib/cctv/sources/latin-america/siata';
import { MYAIRPORTCAMS_BOUNDS, fetchMyAirportCamsCameras } from '@/lib/cctv/sources/oceania/myairportcams';
import { QLDTRAFFIC_BOUNDS, fetchQldTrafficCameras } from '@/lib/cctv/sources/oceania/qldtraffic';
import { FOTO_WEBCAM_BOUNDS, fetchFotoWebcamCameras } from '@/lib/cctv/sources/europe/foto-webcam';
import { PANOMAX_BOUNDS, fetchPanomaxCameras } from '@/lib/cctv/sources/europe/panomax';
import { WEBCAMERA_PL_BOUNDS, fetchWebcameraPlCameras } from '@/lib/cctv/sources/europe/webcamera-pl';
import { BAYERNINFO_BOUNDS, fetchBayernInfoCameras } from '@/lib/cctv/sources/europe/bayerninfo';
import { ITRAFFIC_BOUNDS, fetchITrafficCameras } from '@/lib/cctv/sources/africa/i-traffic';
import { TRAFIROUTES_BOUNDS, fetchTrafiroutesCameras } from '@/lib/cctv/sources/europe/trafiroutes';
import { OSM_WEBCAMS_BOUNDS, fetchOsmWebcams } from '@/lib/cctv/sources/global/osm-webcams';
import { KAHRAMANMARAS_BOUNDS, fetchKahramanmarasCameras } from '@/lib/cctv/sources/turkey/kahramanmaras';
import { ISTANBUL_IBB_BOUNDS, fetchIstanbulIbbCameras } from '@/lib/cctv/sources/turkey/istanbul-ibb';
import { CAMBASI_BOUNDS, fetchCambasiCameras } from '@/lib/cctv/sources/turkey/cambasi';
import { ULUDAG_BOUNDS, fetchUludagCameras } from '@/lib/cctv/sources/turkey/uludag';
import { MDCHART_BOUNDS, fetchMdChartCameras } from '@/lib/cctv/sources/us/mdchart';
import { MODOT_BOUNDS, fetchModotCameras } from '@/lib/cctv/sources/us/modot';
import { NDDOT_BOUNDS, fetchNddotCameras } from '@/lib/cctv/sources/us/nddot';
import { RIDOT_BOUNDS, fetchRidotCameras } from '@/lib/cctv/sources/us/ridot';
import { NMDOT_BOUNDS, fetchNmdotCameras } from '@/lib/cctv/sources/us/nmdot';
import { WV511_BOUNDS, fetchWv511Cameras } from '@/lib/cctv/sources/us/wv511';
import { OKTRAFFIC_BOUNDS, fetchOkTrafficCameras } from '@/lib/cctv/sources/us/oktraffic';
import { VEGVESEN_BOUNDS, fetchVegvesenCameras } from '@/lib/cctv/sources/europe/vegvesen';
import { MDOTTRAFFIC_BOUNDS, fetchMdotTrafficCameras } from '@/lib/cctv/sources/us/mdottraffic';
import { ARDOT_BOUNDS, fetchArdotCameras } from '@/lib/cctv/sources/us/ardot';
import { WYDOT_BOUNDS, fetchWydotCameras } from '@/lib/cctv/sources/us/wydot';
import { BELLINGEN_BOUNDS, fetchBellingenCameras } from '@/lib/cctv/sources/oceania/bellingen';
import { ACT_PR_BOUNDS, fetchActPrCameras } from '@/lib/cctv/sources/latin-america/act-pr';
import { TRAFFIC_SCOTLAND_BOUNDS, fetchTrafficScotlandCameras } from '@/lib/cctv/sources/europe/traffic-scotland';
import { BIHAMK_BOUNDS, fetchBihamkCameras } from '@/lib/cctv/sources/europe/bihamk';
import { MUP_SERBIA_BOUNDS, fetchMupSerbiaCameras } from '@/lib/cctv/sources/europe/mup-serbia';
import {
  OWDB_AMERICAS, OWDB_AMERICAS_BOUNDS, OWDB_EMEA, OWDB_EMEA_BOUNDS, OWDB_APAC, OWDB_APAC_BOUNDS,
} from '@/lib/cctv/generated/openwebcamdb.generated';

/**
 * TAKIP — camera sources with their own adapter. As with STATE_FEEDS, an entry here is the whole wiring:
 * route.ts registers the region and loads it for any view inside `bounds`.
 */
export const FEEDS: StateFeed[] = [
  { region: 'southdakota', idPrefix: SDDOT.idPrefix, bounds: SDDOT.bounds, fetch: fetchSddotCameras },
  { region: 'montana', idPrefix: MDT.idPrefix, bounds: MDT.bounds, fetch: fetchMdtCameras },
  // Shown before SCDOT's written permission, which its terms require, has been granted.
  { region: 'southcarolina', idPrefix: SCDOT.idPrefix, bounds: SCDOT.bounds, fetch: fetchScdotCameras },
  {
    region: 'seattle', idPrefix: 'seattle', fetch: fetchSeattleCameras,
    bounds: { minLat: 47.48, maxLat: 47.75, minLng: -122.45, maxLng: -122.22 },
  },
  // CC BY-NC-ND: non-commercial use only.
  {
    region: 'alertcalifornia', idPrefix: 'alertca', fetch: fetchAlertCaCameras,
    bounds: { minLat: 32.5, maxLat: 42.1, minLng: -124.5, maxLng: -114.0 },
  },
  { region: 'virginia', idPrefix: 'vdot', bounds: VDOT_BOUNDS, fetch: fetchVdotCameras },
  { region: 'austin', idPrefix: 'austin', bounds: AUSTIN_BOUNDS, fetch: fetchAustinCameras },
  { region: 'lexington', idPrefix: 'lexky', bounds: LEXINGTON_BOUNDS, fetch: fetchLexingtonCameras },
  // The keyless list ohgo.com's own map reads; the documented publicapi.ohgo.com needs a key.
  { region: 'ohio', idPrefix: 'ohgo', bounds: OHGO_BOUNDS, fetch: fetchOhgoCameras },
  { region: 'delaware', idPrefix: 'deldot', bounds: DELDOT_BOUNDS, fetch: fetchDeldotCameras },
  // njta.gov's disclaimer sets no reuse terms ("© New Jersey Turnpike Authority" only): permission not yet asked.
  { region: 'njta', idPrefix: 'njta', bounds: NJTA_BOUNDS, fetch: fetchNjtaCameras },
  // feratel stills are CC0 per ODH, but feratel's own terms are not yet cleared; idm rows carry no licence.
  { region: 'opendatahub', idPrefix: 'odh', bounds: ODH_BOUNDS, fetch: fetchOpenDataHubCameras },
  { region: 'estonia', idPrefix: 'tarktee', bounds: ESTONIA_BOUNDS, fetch: fetchEstoniaCameras },
  { region: 'madrid', idPrefix: 'madrid', bounds: MADRID_BOUNDS, fetch: fetchMadridCameras },
  // Sites span every continent, so this region loads for any view.
  { region: 'phenocam', idPrefix: 'phenocam', bounds: PHENOCAM_BOUNDS, fetch: fetchPhenoCamCameras },
  // 政府標準利用規約 2.0 (CC BY 4.0 compatible), credit "出典：国土交通省 川の防災情報"; the site asks tools not to poll it.
  { region: 'mlit-river', idPrefix: 'mlit-river', bounds: MLIT_RIVER_BOUNDS, fetch: fetchMlitRiverCameras },
  // All rights reserved; MLIT's terms allow links to the top page only, not to images. Permission not yet asked.
  { region: 'mlit-road', idPrefix: 'mlit-road', bounds: MLIT_ROAD_BOUNDS, fetch: fetchMlitRoadCameras },
  // FAA imagery is public domain, but ~65% of sites are third-party and NAV CANADA's are Crown copyright.
  { region: 'faa', idPrefix: 'faa', bounds: FAA_BOUNDS, fetch: fetchFaaCameras },
  { region: 'hivis', idPrefix: 'hivis', bounds: HIVIS_BOUNDS, fetch: fetchHivisCameras },
  { region: 'ashcam', idPrefix: 'ashcam', bounds: ASHCAM_BOUNDS, fetch: fetchAshcamCameras },
  // Copyrighted; the Mesonet's terms forbid redistribution without written consent. Permission not yet asked.
  { region: 'nysmesonet', idPrefix: 'nysm', bounds: NYS_MESONET_BOUNDS, fetch: fetchNysMesonetCameras },
  // Index answers 403 without goakamai.org's fixed vendor header and Origin, sent as the site sends them.
  // Terms need HDOT and Honolulu DTS written permission to display: not yet asked.
  { region: 'hawaii', idPrefix: 'hdot', bounds: GOAKAMAI_BOUNDS, fetch: fetchGoAkamaiCameras },
  // Real-time viewing only, non-commercial; transmitting images needs ALDOT's permission: not yet asked.
  { region: 'alabama', idPrefix: 'aldot', bounds: ALGO_BOUNDS, fetch: fetchAlgoCameras },
  { region: 'calgary', idPrefix: 'calgary', bounds: CALGARY_BOUNDS, fetch: fetchCalgaryCameras },
  { region: 'yorkregion', idPrefix: 'yorkregion', bounds: YORK_REGION_BOUNDS, fetch: fetchYorkRegionCameras },
  // Open Government Data License v1.0; credit 經濟部水利署 (data.gov.tw 36687).
  { region: 'taiwan-wra', idPrefix: 'tw-wra', bounds: TAIWAN_WRA_BOUNDS, fetch: fetchTaiwanWraCameras },
  // The site reserves all rights to the Busan Transportation Information Center: permission not yet asked.
  { region: 'busan', idPrefix: 'kr-busan', bounds: BUSAN_BOUNDS, fetch: fetchBusanCameras },
  // The site reserves all rights to Ulsan Metropolitan City: permission not yet asked.
  { region: 'ulsan', idPrefix: 'kr-ulsan', bounds: ULSAN_BOUNDS, fetch: fetchUlsanCameras },
  // No KOGL mark, and Daegu's own player stops after 30 s; its policy asks for prior consultation: not yet asked.
  { region: 'daegu', idPrefix: 'kr-daegu', bounds: DAEGU_BOUNDS, fetch: fetchDaeguCameras },
  // No published feed terms (content reserved to Seoul); TOPIS's own player runs on a viewing timer. Not yet asked.
  { region: 'seoul-topis', idPrefix: 'kr-topis', bounds: SEOUL_TOPIS_BOUNDS, fetch: fetchSeoulTopisCameras },
  // Layer CC BY-SA 2.0, credit IDOT. Lake County PASSAGE stills only: cctv.travelmidwest.com 403s a foreign Referer.
  { region: 'illinois', idPrefix: 'idot', bounds: ILLINOIS_BOUNDS, fetch: fetchIllinoisCameras },
  // TII re-use policy is CC BY 4.0; traffic.tii.ie's own terms are unread and permission is not yet asked.
  { region: 'ireland', idPrefix: 'tii', bounds: TII_BOUNDS, fetch: fetchTiiCameras },
  // No gallery terms published; streams are operators' own YouTube broadcasts via CamStreamer's embed. Not yet asked.
  { region: 'camstreamer', idPrefix: 'camstreamer', bounds: CAMSTREAMER_BOUNDS, fetch: fetchCamStreamerCameras },
  // No terms published by SIATA (Área Metropolitana del Valle de Aburrá); permission not yet asked.
  { region: 'siata', idPrefix: 'siata', bounds: SIATA_BOUNDS, fetch: fetchSiataCameras },
  // Images © Aus Web Cams; reuse "strictly prohibited without prior written consent": not yet asked.
  { region: 'myairportcams', idPrefix: 'myairportcams', bounds: MYAIRPORTCAMS_BOUNDS, fetch: fetchMyAirportCamsCameras },
  // CC BY 4.0 AU, credit TMR; TMR decides display permission case by case: not yet asked.
  { region: 'queensland', idPrefix: 'qld', bounds: QLDTRAFFIC_BOUNDS, fetch: fetchQldTrafficCameras },
  // Copying or distributing the stills needs the operators' written consent: not yet asked.
  { region: 'fotowebcam', idPrefix: 'fotowebcam', bounds: FOTO_WEBCAM_BOUNDS, fetch: fetchFotoWebcamCameras },
  // Personal use only; reproduction needs Panomax GmbH's consent and framing is prohibited (stills only): not yet asked.
  { region: 'panomax', idPrefix: 'panomax', bounds: PANOMAX_BOUNDS, fetch: fetchPanomaxCameras },
  // All rights reserved to Webcamera Media sp. z o.o., no reuse licence: permission not yet asked.
  { region: 'webcamerapl', idPrefix: 'webcamerapl', bounds: WEBCAMERA_PL_BOUNDS, fetch: fetchWebcameraPlCameras },
  // Personal, non-commercial use only; republishing needs the Bavarian ministry's consent: not yet asked.
  { region: 'bavaria', idPrefix: 'bayerninfo', bounds: BAYERNINFO_BOUNDS, fetch: fetchBayernInfoCameras },
  // i-traffic's terms forbid republication without SANRAL's written consent: not yet asked.
  { region: 'southafrica', idPrefix: 'itraffic', bounds: ITRAFFIC_BOUNDS, fetch: fetchITrafficCameras },
  // Reusing Trafiroutes images needs SPW's prior authorisation: not yet asked.
  { region: 'wallonia', idPrefix: 'trafiroutes', bounds: TRAFIROUTES_BOUNDS, fetch: fetchTrafiroutesCameras },
  // ODbL, credit "© OpenStreetMap contributors". Overpass is slow, so the first request after a restart misses it.
  { region: 'osm-webcams', idPrefix: 'osm', bounds: OSM_WEBCAMS_BOUNDS, fetch: fetchOsmWebcams },
  // No published terms ("Tüm Hakları Saklıdır" only); permission pending.
  { region: 'kahramanmaras', idPrefix: 'tr-kahramanmaras', bounds: KAHRAMANMARAS_BOUNDS, fetch: fetchKahramanmarasCameras },
  // No published terms for the UYM camera API ("all rights İBB Trafik Müdürlüğü"); permission pending.
  { region: 'istanbul-ibb', idPrefix: 'tr-ibb', bounds: ISTANBUL_IBB_BOUNDS, fetch: fetchIstanbulIbbCameras },
  // CC BY 4.0 per Restreamer channel, except channel 1: CC BY-NC 4.0. Attribute ORBEL A.Ş.
  { region: 'cambasi', idPrefix: 'tr-cambasi', bounds: CAMBASI_BOUNDS, fetch: fetchCambasiCameras },
  // No webcam terms published (only ticket-sale terms); permission pending.
  { region: 'uludag', idPrefix: 'tr-uludag', bounds: ULUDAG_BOUNDS, fetch: fetchUludagCameras },
  // CHART's public "Data Feeds"; no licence stated.
  { region: 'maryland', idPrefix: 'mdsha', bounds: MDCHART_BOUNDS, fetch: fetchMdChartCameras },
  // No terms found on modot.org or the traveler map.
  { region: 'missouri', idPrefix: 'modot', bounds: MODOT_BOUNDS, fetch: fetchModotCameras },
  // nd.gov disclaimer only.
  { region: 'northdakota', idPrefix: 'nddot', bounds: NDDOT_BOUNDS, fetch: fetchNddotCameras },
  // RI.gov: public information, may be distributed; credit requested.
  { region: 'rhodeisland', idPrefix: 'ridot', bounds: RIDOT_BOUNDS, fetch: fetchRidotCameras },
  // nmroads.com disclaimer only.
  { region: 'newmexico', idPrefix: 'nmdot', bounds: NMDOT_BOUNDS, fetch: fetchNmdotCameras },
  // WV.gov disclaimer only.
  { region: 'westvirginia', idPrefix: 'wvdot', bounds: WV511_BOUNDS, fetch: fetchWv511Cameras },
  // "For transportation purposes only, unless otherwise approved."
  { region: 'oklahoma', idPrefix: 'okdot', bounds: OKTRAFFIC_BOUNDS, fetch: fetchOkTrafficCameras },
  // NLOD: free to use; credit Statens vegvesen.
  { region: 'norway', idPrefix: 'vegvesen', bounds: VEGVESEN_BOUNDS, fetch: fetchVegvesenCameras },
  // MDOT terms: non-commercial use "only in the manner presented by MDOT"; commercial terms via MDOT's CIO, not yet asked.
  { region: 'mississippi', idPrefix: 'msdot', bounds: MDOTTRAFFIC_BOUNDS, fetch: fetchMdotTrafficCameras },
  // IDrive's terms prohibit embedding or linking to camera images: permission not yet asked.
  { region: 'arkansas', idPrefix: 'ardot', bounds: ARDOT_BOUNDS, fetch: fetchArdotCameras },
  // wyoroad.info's disclaimer sets no reuse limit, but WYDOT hides its 511 map feed: ask wyoroad@wyo.gov before commercial use.
  { region: 'wyoming', idPrefix: 'wydot', bounds: WYDOT_BOUNDS, fetch: fetchWydotCameras },
  // No licence on the council's layer; permission not yet asked.
  { region: 'bellingen', idPrefix: 'bellingen', bounds: BELLINGEN_BOUNDS, fetch: fetchBellingenCameras },
  // No licence stated by ACT (Autoridad de Carreteras y Transportación); permission not yet asked.
  { region: 'puertorico', idPrefix: 'actpr', bounds: ACT_PR_BOUNDS, fetch: fetchActPrCameras },
  // Traffic Scotland asks that camera images are not linked directly; we re-serve frames: permission not yet asked.
  { region: 'scotland', idPrefix: 'trafficscot', bounds: TRAFFIC_SCOTLAND_BOUNDS, fetch: fetchTrafficScotlandCameras },
  // No licence stated by BIHAMK; permission not yet asked.
  { region: 'bosnia-bihamk', idPrefix: 'bihamk', bounds: BIHAMK_BOUNDS, fetch: fetchBihamkCameras },
  // No licence stated by the Serbian Interior Ministry; permission not yet asked.
  { region: 'serbia-borders', idPrefix: 'mup', bounds: MUP_SERBIA_BOUNDS, fetch: fetchMupSerbiaCameras },
  // OpenWebcamDB's terms are non-commercial and exclude aggregators; permission not yet asked for.
  { region: 'owdb-americas', idPrefix: 'owdb', bounds: OWDB_AMERICAS_BOUNDS, fetch: async () => OWDB_AMERICAS },
  { region: 'owdb-emea', idPrefix: 'owdb', bounds: OWDB_EMEA_BOUNDS, fetch: async () => OWDB_EMEA },
  { region: 'owdb-apac', idPrefix: 'owdb', bounds: OWDB_APAC_BOUNDS, fetch: async () => OWDB_APAC },
];
