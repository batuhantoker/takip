/**
 * Lightweight place-name → coordinate dictionary for OSINT geoparsing of
 * unstructured text (news headlines, Telegram posts, RSS items).
 *
 * Coordinates are `[lng, lat]` to match the GeoJSON convention used by the
 * map layer code. Names are matched as whole-word, case-insensitive, against
 * the input text. Multi-word names (e.g. "tel aviv", "san francisco") are
 * checked before single-word names so the longer label wins when both are
 * present in the same sentence.
 *
 * This is intentionally a curated, hand-maintained list rather than a full
 * gazetteer — full geocoding requires an external service (Nominatim,
 * OpenCage) which is out of scope for the keyless OSINT pipeline. The list
 * covers the regions most heavily reported on by the OSINT channels we
 * aggregate (active conflicts, geopolitical hotspots, capitals).
 */

const PLACES: Record<string, [number, number]> = {
  // Ukraine / Russia conflict
  'ukraine': [31.1656, 48.3794],
  'kyiv': [30.5234, 50.4501],
  'kiev': [30.5234, 50.4501],
  'kharkiv': [36.2304, 49.9935],
  'kherson': [32.6175, 46.6354],
  'odesa': [30.7233, 46.4825],
  'odessa': [30.7233, 46.4825],
  'lviv': [24.0297, 49.8397],
  'mariupol': [37.5407, 47.0971],
  'donetsk': [37.8028, 48.0159],
  'luhansk': [39.3344, 48.5740],
  'crimea': [34.1024, 44.9521],
  'sevastopol': [33.5256, 44.6166],
  'zaporizhzhia': [35.1396, 47.8388],
  'avdiivka': [37.7470, 48.1396],
  'bakhmut': [38.0001, 48.5957],
  'belgorod': [36.5853, 50.5972],
  'kursk': [36.1947, 51.7373],
  'rostov': [39.7187, 47.2357],
  'russia': [37.6173, 55.7558],
  'moscow': [37.6173, 55.7558],
  'saint petersburg': [30.3158, 59.9343],
  'st petersburg': [30.3158, 59.9343],

  // Middle East
  'gaza': [34.4668, 31.5017],
  'rafah': [34.2553, 31.2968],
  'khan younis': [34.3026, 31.3470],
  'west bank': [35.2611, 31.9466],
  'jerusalem': [35.2137, 31.7683],
  'tel aviv': [34.7818, 32.0853],
  'haifa': [34.9896, 32.7940],
  'israel': [34.8516, 31.0461],
  'palestine': [35.2332, 31.9522],
  'lebanon': [35.8623, 33.8547],
  'beirut': [35.5018, 33.8938],
  'syria': [38.9968, 34.8021],
  'damascus': [36.2765, 33.5138],
  'aleppo': [37.1343, 36.2021],
  'iran': [53.6880, 32.4279],
  'tehran': [51.3890, 35.6892],
  'iraq': [43.6793, 33.2232],
  'baghdad': [44.3661, 33.3152],
  'yemen': [47.5868, 15.5527],
  "sana'a": [44.2066, 15.3694],
  'sanaa': [44.2066, 15.3694],
  'houthi': [44.2066, 15.3694],
  'red sea': [38.0000, 20.0000],
  'bab el-mandeb': [43.3170, 12.5800],
  'hormuz': [56.2510, 26.5667],
  'jordan': [36.2384, 30.5852],
  'amman': [35.9106, 31.9454],
  'saudi arabia': [45.0792, 23.8859],
  'riyadh': [46.6753, 24.7136],
  'uae': [53.8478, 23.4241],
  'dubai': [55.2708, 25.2048],
  'qatar': [51.1839, 25.3548],
  'doha': [51.5310, 25.2854],

  // Africa
  'sudan': [30.2176, 12.8628],
  'khartoum': [32.5599, 15.5007],
  'darfur': [24.0000, 13.0000],
  'south sudan': [31.3070, 6.8770],
  'libya': [17.2283, 26.3351],
  'tripoli': [13.1913, 32.8872],
  'mali': [-3.9962, 17.5707],
  'niger': [8.0817, 17.6078],
  'burkina faso': [-1.5616, 12.2383],
  'sahel': [4.0000, 16.0000],
  'somalia': [46.1996, 5.1521],
  'mogadishu': [45.3438, 2.0469],
  'ethiopia': [40.4897, 9.1450],
  'tigray': [38.9000, 13.5000],
  'drc': [21.7587, -4.0383],
  'congo': [21.7587, -4.0383],
  'goma': [29.2350, -1.6792],
  'kivu': [28.8500, -1.6800],
  'nigeria': [8.6753, 9.0820],
  'lagos': [3.3792, 6.5244],
  'egypt': [30.8025, 26.8206],
  'cairo': [31.2357, 30.0444],
  'morocco': [-7.0926, 31.7917],

  // Asia
  'china': [116.4074, 39.9042],
  'beijing': [116.4074, 39.9042],
  'shanghai': [121.4737, 31.2304],
  'hong kong': [114.1694, 22.3193],
  'taiwan': [120.9605, 23.6978],
  'taipei': [121.5654, 25.0330],
  'taiwan strait': [119.4500, 24.5000],
  'korea': [127.7669, 35.9078],
  'seoul': [126.9780, 37.5665],
  'pyongyang': [125.7625, 39.0392],
  'dmz': [126.6800, 38.3200],
  'japan': [138.2529, 36.2048],
  'tokyo': [139.6917, 35.6895],
  'okinawa': [127.6809, 26.2125],
  'philippines': [121.7740, 12.8797],
  'manila': [120.9842, 14.5995],
  'south china sea': [114.0000, 14.0000],
  'myanmar': [95.9560, 21.9162],
  'burma': [95.9560, 21.9162],
  'rakhine': [93.5000, 20.0000],
  'thailand': [100.9925, 15.8700],
  'vietnam': [108.2772, 14.0583],
  'india': [78.9629, 20.5937],
  'delhi': [77.2090, 28.6139],
  'pakistan': [69.3451, 30.3753],
  'kashmir': [76.5762, 33.7782],
  'afghanistan': [67.7100, 33.9391],
  'kabul': [69.2075, 34.5553],

  // Americas
  'usa': [-95.7129, 37.0902],
  'us': [-95.7129, 37.0902],
  'washington': [-77.0369, 38.9072],
  'new york': [-74.0060, 40.7128],
  'mexico': [-102.5528, 23.6345],
  'mexico city': [-99.1332, 19.4326],
  'haiti': [-72.2852, 18.9712],
  'port-au-prince': [-72.3074, 18.5944],
  'cuba': [-77.7812, 21.5218],
  'venezuela': [-66.5897, 6.4238],
  'caracas': [-66.9036, 10.4806],
  'colombia': [-74.2973, 4.5709],
  'brazil': [-51.9253, -14.2350],
  'argentina': [-63.6167, -38.4161],

  // Europe
  'germany': [10.4515, 51.1657],
  'berlin': [13.4050, 52.5200],
  'france': [2.2137, 46.2276],
  'paris': [2.3522, 48.8566],
  'uk': [-3.4359, 55.3781],
  'london': [-0.1276, 51.5074],
  'spain': [-3.7492, 40.4637],
  'madrid': [-3.7038, 40.4168],
  'italy': [12.5674, 41.8719],
  'rome': [12.4964, 41.9028],
  'poland': [19.1451, 51.9194],
  'warsaw': [21.0122, 52.2297],
  'baltic': [20.0000, 58.0000],
  'baltic states': [25.0000, 56.0000],
  'finland': [25.7482, 61.9241],
  'helsinki': [24.9384, 60.1699],
  'sweden': [18.6435, 60.1282],
  'norway': [8.4689, 60.4720],
  'romania': [24.9668, 45.9432],
  'bulgaria': [25.4858, 42.7339],
  'turkey': [35.2433, 38.9637],
  'ankara': [32.8541, 39.9334],
  'istanbul': [28.9784, 41.0082],
  'greece': [21.8243, 39.0742],
  'serbia': [21.0059, 44.0165],
  'belgrade': [20.4489, 44.7866],
  'kosovo': [20.9020, 42.6026],
  'bosnia': [17.6791, 43.9159],
  'georgia': [43.3569, 42.3154],
  'tbilisi': [44.7833, 41.7151],
  'armenia': [45.0382, 40.0691],
  'azerbaijan': [47.5769, 40.1431],
  'nagorno-karabakh': [46.7517, 39.8366],

  // ─── Cyrillic (Russian / Ukrainian) — top conflict-zone names ───
  'украина': [31.1656, 48.3794],
  'україна': [31.1656, 48.3794],
  'киев': [30.5234, 50.4501],
  'київ': [30.5234, 50.4501],
  'харьков': [36.2304, 49.9935],
  'харків': [36.2304, 49.9935],
  'херсон': [32.6175, 46.6354],
  'одесса': [30.7233, 46.4825],
  'одеса': [30.7233, 46.4825],
  'львов': [24.0297, 49.8397],
  'львів': [24.0297, 49.8397],
  'мариуполь': [37.5407, 47.0971],
  'маріуполь': [37.5407, 47.0971],
  'донецк': [37.8028, 48.0159],
  'донецьк': [37.8028, 48.0159],
  'луганск': [39.3344, 48.5740],
  'луганськ': [39.3344, 48.5740],
  'крым': [34.1024, 44.9521],
  'крим': [34.1024, 44.9521],
  'севастополь': [33.5256, 44.6166],
  'запорожье': [35.1396, 47.8388],
  'запоріжжя': [35.1396, 47.8388],
  'бахмут': [38.0001, 48.5957],
  'авдеевка': [37.7470, 48.1396],
  'авдіївка': [37.7470, 48.1396],
  'белгород': [36.5853, 50.5972],
  'белгородская': [36.5853, 50.5972],
  'белгородській': [36.5853, 50.5972],
  'курск': [36.1947, 51.7373],
  'россия': [37.6173, 55.7558],
  'росія': [37.6173, 55.7558],
  'москва': [37.6173, 55.7558],
  'санкт-петербург': [30.3158, 59.9343],
  'питер': [30.3158, 59.9343],
  'беларусь': [27.9534, 53.7098],
  'минск': [27.5615, 53.9006],
  'мінськ': [27.5615, 53.9006],

  // ─── Arabic — Middle-East conflict zones ───
  'غزة': [34.4668, 31.5017],
  'فلسطين': [35.2332, 31.9522],
  'إسرائيل': [34.8516, 31.0461],
  'القدس': [35.2137, 31.7683],
  'بيروت': [35.5018, 33.8938],
  'لبنان': [35.8623, 33.8547],
  'دمشق': [36.2765, 33.5138],
  'سوريا': [38.9968, 34.8021],
  'بغداد': [44.3661, 33.3152],
  'العراق': [43.6793, 33.2232],
  'صنعاء': [44.2066, 15.3694],
  'اليمن': [47.5868, 15.5527],
  'طهران': [51.3890, 35.6892],
  'إيران': [53.6880, 32.4279],
  'القاهرة': [31.2357, 30.0444],
  'مصر': [30.8025, 26.8206],
  'الخرطوم': [32.5599, 15.5007],
  'السودان': [30.2176, 12.8628],
};

// Pre-sort keys longest-first so multi-word labels match before substrings.
const SORTED_KEYS = Object.keys(PLACES).sort((a, b) => b.length - a.length);

export interface GeoMatch {
  /** Place name as it appears in the dictionary. */
  place: string;
  /** `[lng, lat]` (GeoJSON order). */
  coords: [number, number];
}

/**
 * Returns the first place from the dictionary mentioned in `text`, or `null`
 * when nothing matches. Whole-word, case-insensitive. Longer multi-word
 * labels take precedence over shorter ones (e.g. "tel aviv" beats "israel"
 * if both appear).
 *
 * Applies small random jitter (`±jitter` degrees, default 0) so multiple
 * events that all map to the same capital don't stack into a single pixel.
 */
export function geoparse(text: string, jitter = 0): GeoMatch | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const key of SORTED_KEYS) {
    // Escape regex metacharacters in the key. ASCII `\b` doesn't work for
    // Cyrillic/Arabic, so we use Unicode-aware lookarounds: the match must
    // be preceded and followed by something that is *not* a letter in any
    // script (the `u` flag makes `\p{L}` Unicode-aware).
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^\\p{L}])${escaped}(?=[^\\p{L}]|$)`, 'iu');
    if (re.test(lower)) {
      const [lng, lat] = PLACES[key];
      const jLng = jitter ? (Math.random() - 0.5) * 2 * jitter : 0;
      const jLat = jitter ? (Math.random() - 0.5) * 2 * jitter : 0;
      return { place: key, coords: [lng + jLng, lat + jLat] };
    }
  }
  return null;
}

/**
 * Conflict / OSINT-relevant keyword set. Used to filter raw feeds down to
 * posts likely to be reporting on incidents rather than off-topic chatter.
 */
export const CONFLICT_KEYWORDS = [
  // English
  'attack', 'strike', 'missile', 'drone', 'war', 'troops', 'military',
  'protest', 'riot', 'police', 'clash', 'bomb', 'killed', 'forces',
  'shelling', 'artillery', 'airstrike', 'casualties', 'wounded', 'siege',
  'invasion', 'offensive', 'frontline', 'ceasefire', 'sanctions', 'sanctioned',
  // Cyrillic (RU/UA)
  'удар', 'обстрел', 'обстріл', 'ракет', 'дрон', 'война', 'війна',
  'погиб', 'загину', 'войск', 'військ', 'атак', 'наступ', 'фронт',
  // Arabic
  'هجوم', 'ضربة', 'صاروخ', 'حرب', 'قصف', 'قتل', 'جنود',
];

export function hasConflictKeyword(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CONFLICT_KEYWORDS.some((kw) => lower.includes(kw));
}
