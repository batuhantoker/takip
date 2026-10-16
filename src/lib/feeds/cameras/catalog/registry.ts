import {
  fetchTfLCameras,
  fetchCanadaCameras,
  fetchUSEastCameras,
  fetchEuropeCameras,
  fetchAsiaCameras,
  fetchMiddleEastCameras,
} from './sources';
import { fetchNetherlandsCameras } from '@/lib/feeds/cameras/sources/europe/netherlands';
import { fetchBulgariaCameras } from '@/lib/feeds/cameras/sources/europe/bulgaria';
import { fetchGreeceCameras } from '@/lib/feeds/cameras/sources/europe/greece';
import { fetchSerbiaCameras } from '@/lib/feeds/cameras/sources/europe/serbia';
import { fetchMacedoniaCameras } from '@/lib/feeds/cameras/sources/europe/macedonia';
import { fetchTurkeyCameras } from '@/lib/feeds/cameras/sources/turkey/turkey';
import { fetchRomaniaCameras } from '@/lib/feeds/cameras/sources/europe/romania';
import { fetchAustraliaCameras } from '@/lib/feeds/cameras/sources/oceania/australia';
import { fetchItalyCameras } from '@/lib/feeds/cameras/sources/europe/italy';
import { fetchCzechiaCameras } from '@/lib/feeds/cameras/sources/europe/czechia';
import { fetchSlovakiaCameras } from '@/lib/feeds/cameras/sources/europe/slovakia';
import { fetchGermanyCameras } from '@/lib/feeds/cameras/sources/europe/germany';
import { fetchFranceCameras } from '@/lib/feeds/cameras/sources/europe/france';
import { fetchSpainCameras } from '@/lib/feeds/cameras/sources/europe/spain';
import { fetchPolandCameras } from '@/lib/feeds/cameras/sources/europe/poland';
import { fetchJapanCameras } from '@/lib/feeds/cameras/sources/asia/japan';
import { fetchSwitzerlandCameras } from '@/lib/feeds/cameras/sources/europe/switzerland';
import { fetchFinlandCameras } from '@/lib/feeds/cameras/sources/europe/finland';
import { fetchSwedenCameras } from '@/lib/feeds/cameras/sources/europe/sweden';
import { fetchHongKongCameras } from '@/lib/feeds/cameras/sources/asia/hongkong';
import { fetchUtahCameras } from '@/lib/feeds/cameras/sources/us/utah';
import { fetchIcelandCameras } from '@/lib/feeds/cameras/sources/europe/iceland';
import { fetchTaiwanCameras } from '@/lib/feeds/cameras/sources/asia/taiwan';
import { fetchThailandCameras } from '@/lib/feeds/cameras/sources/asia/thailand';
import { fetchAsiaLiveCameras } from '@/lib/feeds/cameras/sources/asia/asia-live';
import { fetchNewZealandCameras } from '@/lib/feeds/cameras/sources/oceania/newzealand';
import { fetchLithuaniaCameras } from '@/lib/feeds/cameras/sources/europe/lithuania';
import { fetchEdmontonCameras } from '@/lib/feeds/cameras/sources/canada/edmonton';
import { fetchOregonCameras } from '@/lib/feeds/cameras/sources/us/oregon';
import { fetchWsdotCameras } from '@/lib/feeds/cameras/sources/us/wsdot';
import { fetchCaltransCameras } from '@/lib/feeds/cameras/sources/us/caltrans';
import { fetchMichiganCameras } from '@/lib/feeds/cameras/sources/us/michigan';
import { fetchIndianaCameras } from '@/lib/feeds/cameras/sources/us/indiana';
import { fetchKentuckyCameras } from '@/lib/feeds/cameras/sources/us/kentucky';
import { fetchNycCameras } from '@/lib/feeds/cameras/sources/us/nyc';
import { STATE_FEEDS } from '@/lib/feeds/cameras/sources/platforms/us-511';
import { FEEDS } from './feeds';
import { fetchNevadaCameras } from '@/lib/feeds/cameras/sources/us/nevada';
import { fetchLouisianaCameras } from '@/lib/feeds/cameras/sources/us/louisiana';
import { fetchFloridaCameras } from '@/lib/feeds/cameras/sources/us/florida';
import { fetchGeorgiaCameras } from '@/lib/feeds/cameras/sources/us/georgia';
import { fetchNorthCarolinaCameras } from '@/lib/feeds/cameras/sources/us/northcarolina';
import { fetchArizonaCameras } from '@/lib/feeds/cameras/sources/us/arizona';
import { fetchTexasCameras } from '@/lib/feeds/cameras/sources/us/texas';
import { fetchEastAsiaCameras, fetchSeAsiaCameras, fetchWestAsiaCameras } from '@/lib/feeds/cameras/sources/global/opencctv';
import {
  fetchLatamLiveCameras,
  fetchAfricaLiveCameras,
  fetchEuropeLiveCameras,
} from '@/lib/feeds/cameras/sources/global/world-live';
import {
  fetchNlPublicWebcams,
  fetchEuropePublicWebcams,
  fetchAmericasPublicWebcams,
  fetchRestPublicWebcams,
} from '@/lib/feeds/cameras/sources/global/public-webcams';

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
