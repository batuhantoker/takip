import {
  fetchTfLCameras,
  fetchCanadaCameras,
  fetchUSCentralCameras,
  fetchUSEastCameras,
  fetchEuropeCameras,
  fetchAsiaCameras,
  fetchMiddleEastCameras,
} from './catalog-sources';
import { fetchNetherlandsCameras } from './netherlands';
import { fetchBulgariaCameras } from './bulgaria';
import { fetchGreeceCameras } from './greece';
import { fetchSerbiaCameras } from './serbia';
import { fetchMacedoniaCameras } from './macedonia';
import { fetchTurkeyCameras } from './turkey';
import { fetchRomaniaCameras } from './romania';
import { fetchAustraliaCameras } from './australia';
import { fetchItalyCameras } from './italy';
import { fetchCzechiaCameras } from './czechia';
import { fetchSlovakiaCameras } from './slovakia';
import { fetchGermanyCameras } from './germany';
import { fetchFranceCameras } from './france';
import { fetchSpainCameras } from './spain';
import { fetchPolandCameras } from './poland';
import { fetchJapanCameras } from './japan';
import { fetchSwitzerlandCameras } from './switzerland';
import { fetchFinlandCameras } from './finland';
import { fetchSwedenCameras } from './sweden';
import { fetchHongKongCameras } from './hongkong';
import { fetchUtahCameras } from './utah';
import { fetchIcelandCameras } from './iceland';
import { fetchTaiwanCameras } from './taiwan';
import { fetchThailandCameras } from './thailand';
import { fetchAsiaLiveCameras } from './asia-live';
import { fetchNewZealandCameras } from './newzealand';
import { fetchLithuaniaCameras } from './lithuania';
import { fetchEdmontonCameras } from './edmonton';
import { fetchOregonCameras } from './oregon';
import { fetchWsdotCameras } from './wsdot';
import { fetchCaltransCameras } from './caltrans';
import { fetchMichiganCameras } from './michigan';
import { fetchIndianaCameras } from './indiana';
import { fetchKentuckyCameras } from './kentucky';
import { fetchNycCameras } from './nyc';
import { STATE_FEEDS } from './us-511';
import { FEEDS } from './feeds';
import { fetchNevadaCameras } from './nevada';
import { fetchLouisianaCameras } from './louisiana';
import { fetchFloridaCameras } from './florida';
import { fetchGeorgiaCameras } from './georgia';
import { fetchNorthCarolinaCameras } from './northcarolina';
import { fetchArizonaCameras } from './arizona';
import { fetchTexasCameras } from './texas';
import { fetchEastAsiaCameras, fetchSeAsiaCameras, fetchWestAsiaCameras } from './opencctv';
import {
  fetchLatamLiveCameras,
  fetchAfricaLiveCameras,
  fetchEuropeLiveCameras,
} from './world-live';
import {
  fetchNlPublicWebcams,
  fetchEuropePublicWebcams,
  fetchAmericasPublicWebcams,
  fetchRestPublicWebcams,
} from './public-webcams';

// ═══ REGION MAPPING ═══
/** Camera records are shaped per source; only `source` is read back here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RegionFetcher = () => Promise<any[]>;

export const RAW_REGION_FETCHERS: Record<string, RegionFetcher> = {
  'middle-east': fetchMiddleEastCameras,
  'uk': fetchTfLCameras,
  'us-west': async () => { const [w, c] = await Promise.all([fetchWsdotCameras(), fetchCaltransCameras()]); return [...w, ...c]; },
  'us-east': fetchUSEastCameras,
  'us-central': fetchUSCentralCameras,
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
