import {
  fetchTfLCameras,
  fetchCanadaCameras,
  fetchUSEastCameras,
  fetchEuropeCameras,
  fetchAsiaCameras,
  fetchMiddleEastCameras,
} from './sources';
import { fetchNetherlandsCameras } from '@/lib/cctv/sources/europe/netherlands';
import { fetchBulgariaCameras } from '@/lib/cctv/sources/europe/bulgaria';
import { fetchGreeceCameras } from '@/lib/cctv/sources/europe/greece';
import { fetchSerbiaCameras } from '@/lib/cctv/sources/europe/serbia';
import { fetchMacedoniaCameras } from '@/lib/cctv/sources/europe/macedonia';
import { fetchTurkeyCameras } from '@/lib/cctv/sources/turkey/turkey';
import { fetchRomaniaCameras } from '@/lib/cctv/sources/europe/romania';
import { fetchAustraliaCameras } from '@/lib/cctv/sources/oceania/australia';
import { fetchItalyCameras } from '@/lib/cctv/sources/europe/italy';
import { fetchCzechiaCameras } from '@/lib/cctv/sources/europe/czechia';
import { fetchSlovakiaCameras } from '@/lib/cctv/sources/europe/slovakia';
import { fetchGermanyCameras } from '@/lib/cctv/sources/europe/germany';
import { fetchFranceCameras } from '@/lib/cctv/sources/europe/france';
import { fetchSpainCameras } from '@/lib/cctv/sources/europe/spain';
import { fetchPolandCameras } from '@/lib/cctv/sources/europe/poland';
import { fetchJapanCameras } from '@/lib/cctv/sources/asia/japan';
import { fetchSwitzerlandCameras } from '@/lib/cctv/sources/europe/switzerland';
import { fetchFinlandCameras } from '@/lib/cctv/sources/europe/finland';
import { fetchSwedenCameras } from '@/lib/cctv/sources/europe/sweden';
import { fetchHongKongCameras } from '@/lib/cctv/sources/asia/hongkong';
import { fetchUtahCameras } from '@/lib/cctv/sources/us/utah';
import { fetchIcelandCameras } from '@/lib/cctv/sources/europe/iceland';
import { fetchTaiwanCameras } from '@/lib/cctv/sources/asia/taiwan';
import { fetchThailandCameras } from '@/lib/cctv/sources/asia/thailand';
import { fetchAsiaLiveCameras } from '@/lib/cctv/sources/asia/asia-live';
import { fetchNewZealandCameras } from '@/lib/cctv/sources/oceania/newzealand';
import { fetchLithuaniaCameras } from '@/lib/cctv/sources/europe/lithuania';
import { fetchEdmontonCameras } from '@/lib/cctv/sources/canada/edmonton';
import { fetchOregonCameras } from '@/lib/cctv/sources/us/oregon';
import { fetchWsdotCameras } from '@/lib/cctv/sources/us/wsdot';
import { fetchCaltransCameras } from '@/lib/cctv/sources/us/caltrans';
import { fetchMichiganCameras } from '@/lib/cctv/sources/us/michigan';
import { fetchIndianaCameras } from '@/lib/cctv/sources/us/indiana';
import { fetchKentuckyCameras } from '@/lib/cctv/sources/us/kentucky';
import { fetchNycCameras } from '@/lib/cctv/sources/us/nyc';
import { STATE_FEEDS } from '@/lib/cctv/sources/platforms/us-511';
import { FEEDS } from './feeds';
import { fetchNevadaCameras } from '@/lib/cctv/sources/us/nevada';
import { fetchLouisianaCameras } from '@/lib/cctv/sources/us/louisiana';
import { fetchFloridaCameras } from '@/lib/cctv/sources/us/florida';
import { fetchGeorgiaCameras } from '@/lib/cctv/sources/us/georgia';
import { fetchNorthCarolinaCameras } from '@/lib/cctv/sources/us/northcarolina';
import { fetchArizonaCameras } from '@/lib/cctv/sources/us/arizona';
import { fetchTexasCameras } from '@/lib/cctv/sources/us/texas';
import { fetchEastAsiaCameras, fetchSeAsiaCameras, fetchWestAsiaCameras } from '@/lib/cctv/sources/global/opencctv';
import {
  fetchLatamLiveCameras,
  fetchAfricaLiveCameras,
  fetchEuropeLiveCameras,
} from '@/lib/cctv/sources/global/world-live';
import {
  fetchNlPublicWebcams,
  fetchEuropePublicWebcams,
  fetchAmericasPublicWebcams,
  fetchRestPublicWebcams,
} from '@/lib/cctv/sources/global/public-webcams';

// ═══ REGION MAPPING ═══
/** Camera records are shaped per source; only `source` is read back here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RegionFetcher = () => Promise<any[]>;

export const RAW_REGION_FETCHERS: Record<string, RegionFetcher> = {
  'middle-east': fetchMiddleEastCameras,
  'uk': fetchTfLCameras,
  // One source failing must not take the other with it.
  'us-west': async () => (await Promise.allSettled([fetchWsdotCameras(), fetchCaltransCameras()]))
    .flatMap(r => (r.status === 'fulfilled' ? r.value : [])),
  'us-east': fetchUSEastCameras,
  'canada': fetchCanadaCameras,
  'europe': fetchEuropeCameras,
  'netherlands': fetchNetherlandsCameras,
  'asia': fetchAsiaCameras,
  'bulgaria': fetchBulgariaCameras,
  'greece': fetchGreeceCameras,
  'serbia': fetchSerbiaCameras,
  'macedonia': fetchMacedoniaCameras,
  'turkey': fetchTurkeyCameras,
  'romania': fetchRomaniaCameras,
  'australia': fetchAustraliaCameras,
  'italy': fetchItalyCameras,
  'czechia': fetchCzechiaCameras,
  'slovakia': fetchSlovakiaCameras,
  'germany': fetchGermanyCameras,
  'france': fetchFranceCameras,
  'spain': fetchSpainCameras,
  'poland': fetchPolandCameras,
  'japan': fetchJapanCameras,
  'switzerland': fetchSwitzerlandCameras,
  'finland': fetchFinlandCameras,
  'sweden': fetchSwedenCameras,
  'hongkong': fetchHongKongCameras,
  'utah': fetchUtahCameras,
  'iceland': fetchIcelandCameras,
  'taiwan': fetchTaiwanCameras,
  'thailand': fetchThailandCameras,
  'asia-live': fetchAsiaLiveCameras,
  'newzealand': fetchNewZealandCameras,
  'lithuania': fetchLithuaniaCameras,
  'edmonton': fetchEdmontonCameras,
  'oregon': fetchOregonCameras,
  'michigan': fetchMichiganCameras,
  'indiana': fetchIndianaCameras,
  'kentucky': fetchKentuckyCameras,
  'nyc': fetchNycCameras,
  'nevada': fetchNevadaCameras,
  'louisiana': fetchLouisianaCameras,
  'florida': fetchFloridaCameras,
  'georgia': fetchGeorgiaCameras,
  'northcarolina': fetchNorthCarolinaCameras,
  'arizona': fetchArizonaCameras,
  'texas': fetchTexasCameras,
  'eastasia': fetchEastAsiaCameras,
  'seasia': fetchSeAsiaCameras,
  'westasia': fetchWestAsiaCameras,
  'latam-live': fetchLatamLiveCameras,
  'africa-live': fetchAfricaLiveCameras,
  'europe-live': fetchEuropeLiveCameras,
  /* Webcams their operators broadcast publicly. Registered here
     only — fetchEuropeCameras must not call these too, or every one of them
     lands on the map twice (GET concatenates regions without deduping on id). */
  'public-webcams-nl': fetchNlPublicWebcams,
  'public-webcams-europe': fetchEuropePublicWebcams,
  'public-webcams-americas': fetchAmericasPublicWebcams,
  'public-webcams-rest': fetchRestPublicWebcams,
};

export const ALL_FEEDS = [...STATE_FEEDS, ...FEEDS];
for (const feed of ALL_FEEDS) {
  // A registry entry must not silently replace a hand-written region.
  if (feed.region in RAW_REGION_FETCHERS) throw new Error(`cctv region '${feed.region}' is registered twice`);
  RAW_REGION_FETCHERS[feed.region] = feed.fetch;
}
