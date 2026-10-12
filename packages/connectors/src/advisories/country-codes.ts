/**
 * TAKIP — country name → ISO 3166-1 alpha-2 for feeds that publish names only
 * (State Department, Smartraveller, WHO, CDC, ECDC).
 * English names come from Intl.DisplayNames, the same source fcdo.ts uses. The aliases cover the
 * spellings those feeds actually use, checked against each feed on 2026-10-12.
 * Matching ignores case, accents, punctuation, "and"/"&", "the" and "St."/"Saint".
 */

/** Codes ICU still names that are deprecated, exceptionally reserved or not countries. */
const NOT_COUNTRIES = new Set(
  'AC AN BU CP CQ CS DD DG DY EA EU EZ FX HV IC NH QO RH SU TA TP UK UN VD XA XB YD YU ZR ZZ'.split(' '),
);

export const COUNTRY_ALIASES: Record<string, string> = {
  Burma: 'MM', Myanmar: 'MM',
  'Democratic Republic of the Congo': 'CD', 'DR Congo': 'CD', DRC: 'CD', 'Congo, Democratic Republic': 'CD',
  'Congo, Democratic Republic of the': 'CD', 'Congo (Kinshasa)': 'CD', 'Congo-Kinshasa': 'CD',
  'Republic of the Congo': 'CG', Congo: 'CG', 'Congo, Republic of the': 'CG', 'Congo (Brazzaville)': 'CG', 'Congo-Brazzaville': 'CG',
  "Côte d'Ivoire": 'CI', 'Ivory Coast': 'CI',
  'Holy See': 'VA', Vatican: 'VA', 'Holy See and Vatican City': 'VA',
  Turkey: 'TR', Türkiye: 'TR',
  'Russian Federation': 'RU',
  'Hong Kong': 'HK', Macau: 'MO', Macao: 'MO',
  Palestine: 'PS', 'West Bank': 'PS', Gaza: 'PS', 'Gaza Strip': 'PS', 'West Bank and Gaza': 'PS',
  'Occupied Palestinian Territory': 'PS', 'State of Palestine': 'PS',
  'Kyrgyz Republic': 'KG',
  'Kingdom of Denmark': 'DK',
  'Czech Republic': 'CZ',
  'Brunei Darussalam': 'BN',
  'Cabo Verde': 'CV',
  Swaziland: 'SZ',
  'East Timor': 'TL',
  'Federated States of Micronesia': 'FM',
  'United States of America': 'US', USA: 'US',
  UK: 'GB', 'Great Britain': 'GB', England: 'GB', Scotland: 'GB', Wales: 'GB', 'Northern Ireland': 'GB',
  'Republic of Korea': 'KR', 'Korea, South': 'KR', 'Korea, Republic of': 'KR',
  "Democratic People's Republic of Korea": 'KP', 'Korea, North': 'KP',
  'Lao PDR': 'LA', "Lao People's Democratic Republic": 'LA',
  'Islamic Republic of Iran': 'IR', 'Syrian Arab Republic': 'SY', 'Viet Nam': 'VN',
  'United Republic of Tanzania': 'TZ', 'Tanzania, United Republic of': 'TZ', Zanzibar: 'TZ',
  'Republic of Moldova': 'MD', 'Moldova, Republic of': 'MD', Macedonia: 'MK',
  'Republic of South Sudan': 'SS',
  'Kingdom of Saudi Arabia': 'SA', UAE: 'AE',
  Bonaire: 'BQ', Saba: 'BQ', 'Sint Eustatius': 'BQ', 'Saba and Sint Eustatius': 'BQ',
  'French Saint Martin': 'MF', 'Sao Tome': 'ST',
  'Bosnia-Herzegovina': 'BA',
  Azores: 'PT', Madeira: 'PT', 'Madeira Islands': 'PT', 'Canary Islands': 'ES', 'Easter Island': 'CL',
  'Galapagos Islands': 'EC',
};

/** Same-length fold: accents dropped, lower case, anything else a space, so match offsets map back. */
function fold(s: string): string {
  return s.split('').map(c => {
    const f = c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    return f.length === 1 && /[a-z0-9]/.test(f) ? f : ' ';
  }).join('');
}

const FILLER = new Set(['and', 'the']);

function words(s: string): string[] {
  return fold(s).split(' ').filter(w => w && !FILLER.has(w)).map(w => (w === 'st' ? 'saint' : w));
}

export const nameKey = (s: string) => words(s).join(' ');

const stripParens = (s: string) => s.replace(/\([^)]*\)/g, ' ').trim();

let table: Map<string, string> | null = null;
let scanner: RegExp | null = null;

function names(): Map<string, string> {
  if (table) return table;
  const map = new Map<string, string>();
  const regions = new Intl.DisplayNames(['en'], { type: 'region' });
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (NOT_COUNTRIES.has(code)) continue;
      let name: string | undefined;
      try {
        name = regions.of(code);
      } catch {
        continue;
      }
      if (name && name !== code) map.set(nameKey(stripParens(name)), code);
    }
  }
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) map.set(nameKey(alias), code);
  map.delete('');
  return (table = map);
}

/** Every ISO code a name can resolve to. */
export function knownCountryCodes(): Set<string> {
  return new Set(names().values());
}

/** Exact lookup; falls back to the bracketed part, as in "Azores (Portugal)". */
export function iso2ForName(name: string | null | undefined): string | null {
  if (!name) return null;
  const map = names();
  const direct = map.get(nameKey(stripParens(name)));
  if (direct) return direct;
  for (const m of name.matchAll(/\(([^)]*)\)/g)) {
    const inner = map.get(nameKey(m[1]));
    if (inner) return inner;
  }
  return null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function scanRegex(): RegExp {
  if (scanner) return scanner;
  const keys = [...names().keys()].sort((a, b) => b.length - a.length);
  const alts = keys.map(k => k.split(' ')
    .map(w => (w === 'saint' ? '(?:saint|st)' : escapeRe(w)))
    .join(' +(?:(?:and|the) +)*'));
  return (scanner = new RegExp(`(?<![a-z0-9])(?:${alts.join('|')})(?![a-z0-9])`, 'g'));
}

export interface CountryMention {
  iso2: string;
  /** As written in the text. */
  name: string;
}

/**
 * Country names mentioned anywhere in free text, longest name first ("Equatorial Guinea" before "Guinea").
 * A match must start with a capital, so "turkey farms" is not Türkiye.
 */
export function findCountries(text: string): CountryMention[] {
  const folded = fold(text);
  const re = scanRegex();
  const out: CountryMention[] = [];
  const seen = new Set<string>();
  for (const m of folded.matchAll(re)) {
    const start = m.index ?? 0;
    const first = text[start];
    if (first !== first.toUpperCase()) continue;
    const name = text.slice(start, start + m[0].length).trim();
    const iso2 = names().get(nameKey(name));
    if (!iso2 || seen.has(iso2)) continue;
    seen.add(iso2);
    out.push({ iso2, name });
  }
  return out;
}
