import { GeoPrec } from '@takip/db';
import type { GeoIndex } from '../geo/geo-index';
import { type Resolved, resolveEvent } from '../geo/resolve';
import { normName } from '../names';

/* Where a Mass Mobilization protest happened, from its free-text `location`: a town, several, a landmark, or "nationwide". */

/** Countries the gazetteer can't read from MM's name (states since split up), and ones whose places GeoNames files elsewhere. */
const COUNTRY_CODES: Record<string, string[]> = {
  USSR: ['RU', 'UA', 'BY', 'MD', 'GE', 'AM', 'AZ', 'KZ', 'KG', 'UZ', 'TM', 'TJ', 'LT', 'LV', 'EE'],
  Yugoslavia: ['RS', 'ME', 'XK', 'HR', 'SI', 'BA', 'MK'],
  'Serbia and Montenegro': ['RS', 'ME', 'XK'],
  Serbia: ['RS', 'XK'],
  Czechoslovakia: ['CZ', 'SK'],
  'Germany East': ['DE'],
  'Germany West': ['DE'],
  'United Arab Emirate': ['AE'],
  China: ['CN', 'HK', 'MO'],
  France: ['FR', 'PF', 'NC', 'GP', 'MQ', 'RE', 'GF', 'YT'],
  Denmark: ['DK', 'GL', 'FO'],
  Ethiopia: ['ET', 'ER'],
  Sudan: ['SD', 'SS'],
  Indonesia: ['ID', 'TL'],
  Morocco: ['MA', 'EH'],
  'United Kingdom': ['GB', 'FK', 'GI'],
};

export function countryCodes(geo: GeoIndex, country: string): string[] {
  return COUNTRY_CODES[country] ?? [geo.country(normName(country))?.iso2].filter((c): c is string => !!c);
}

/** Misspellings and characters the file lost ("S  o Paulo"), by normName; each use is counted on import. */
export const FIXES: Record<string, string> = {
  beruit: 'Beirut', 'phnom phen': 'Phnom Penh', 'phmon phen': 'Phnom Penh', 'phnom phem': 'Phnom Penh', tegucigapa: 'Tegucigalpa',
  timosoara: 'Timișoara', buchrest: 'Bucharest', capetown: 'Cape Town', kwangju: 'Gwangju', lapaz: 'La Paz', 'chi in u': 'Chișinău',
  's o paulo': 'São Paulo', yaound: 'Yaoundé', 'chaing mai': 'Chiang Mai', chittadong: 'Chittagong', sevastapol: 'Sevastopol',
  svestapool: 'Sevastopol', szekesfeherva: 'Székesfehérvár', cochambamba: 'Cochabamba', aracuju: 'Aracaju', tauton: 'Taunton',
  notingham: 'Nottingham', chesire: 'Cheshire', cohh: 'Cobh', camayagua: 'Comayagua', julgalpa: 'Juigalpa', guerreo: 'Guerrero',
  'norte de santande': 'Norte de Santander', 'santa barara': 'Santa Bárbara', 'concepci n': 'Concepción', 'foz do igua u': 'Foz do Iguaçu',
  'culiac n': 'Culiacán', 'l zaro c rdenas': 'Lázaro Cárdenas', 'chimalhuac n': 'Chimalhuacán', 'malec n': 'Malecón', solol: 'Sololá',
  'm rida': 'Mérida',
};

const NATIONWIDE = /^(?:the\s+)?(?:national(?:\s+level)?|nationally|nat(?:io|oi)n\s*-?\s*wide|country\s*-?\s*wide|all over the country|(?:across|throughout|around)(?: the)? country)$/i;
/** "national level, mainly in Montevideo": nationwide, with a place named. A bare "national" needs a separator after it ("National Assembly" isn't). */
const NATIONWIDE_THEN = /^(?:national\s+level|nation\s*-?\s*wide|country\s*-?\s*wide|national(?=\s*[,:]))\s*[,:-]?\s*(?:(?:mainly|mostly|including|especially|particularly|notably|incl\.?)\s+)?(?:in\s+)?(.*)$/i;
const SEVERAL = /^(?:in\s+|at\s+)?(?:several|various|multiple|many|numerous|some|other|major|different|half a dozen|a dozen|dozens of|\d+|two|three|four|five|six|seven|eight|nine|ten)\s+(?:other\s+|major\s+|large\s+|big\s+|different\s+)?(?:cities|towns|places|regions|provinces|states|districts|locations|areas|villages|universities|campuses|counties|prisons)\b|^(?:in\s+)?(?:cities|towns|streets)\s+(?:nationwide|across|throughout|in major)|^region(?:al)?\s+(?:wide|level)/i;
const UNGIVEN = /^(?:unspecified|unknown|undefined|not specified|n\/?a|\.|-)?$/i;
const FILLER = /^(?:downtown|central|centre of|center of|from|including|mainly in|in front of(?: the)?|outside(?: of)?(?: the)?|near(?: the)?|around(?: the)?|at(?: the)?|in(?: the)?|the|city of|town of|state of|province of|region of|streets of)\s+/i;
const DIRECTION = /^(?:north|south|east|west|northern|southern|eastern|western|north\s*-?\s*(?:east|west)(?:ern)?|south\s*-?\s*(?:east|west)(?:ern)?|central|upper|lower)\s+/i;
const DIVISION_WORD = /\s+(?:region|province|state|district|county|governorate|department|municipality|prefecture|oblast|township|city|area|capital region|town|village)$/i;
const ACTION_WORD = /\s+(?:demonstrations?|strikes?|protests?|march|rally|riots?)$/i;
const AFTER = /^.+?\s+(?:in|of|at|near|across|throughout|around|outside|inside|towards?|through)\s+(?:the\s+)?(.+)$/i;
/** Words never looked up on their own when trying a long location word by word. */
const STOP = new Set('the of in at on to from and near city town centre center main street streets road highway square plaza building office offices palace parliament congress assembly ministry court university prison jail station airport north south east west northern southern eastern western central district region province state national'.split(' '));

/** A name to look up and, for "Town, Region", the region; `from` is the source's spelling when FIXES corrected it; `loose` for single words of a longer location. */
type Candidate = { name: string; admin1?: string; from?: string; loose?: boolean; piece?: number };

export type Where = {
  /** Place names to look up, best first. */
  candidates: Candidate[];
  /** How many places the location names. */
  named: number;
  nationwide: boolean;
  /** "several cities" and the like. */
  several: boolean;
  /** Only the country, or a part of it: "southern Brazil". */
  part: boolean;
  given: boolean;
};

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Names a piece could stand for, best first: as written, without filler or trailing words, the place after "in"/"of", then its words. */
function names(raw: string): Candidate[] {
  const out: Candidate[] = [];
  const add = (s: string, loose = false) => {
    const t = tidy(s.replace(/^[\s,.:()-]+|[\s,.:()-]+$/g, ''));
    const fix = FIXES[normName(t)];
    const c: Candidate = { name: fix ?? t, ...(fix && { from: t }), ...(loose && { loose }) };
    if (t && !out.some(o => o.name === c.name)) out.push(c);
  };
  const p = tidy(raw);
  add(p);
  let q = p;
  while (FILLER.test(q)) q = q.replace(FILLER, '');
  add(q);
  const d = q.replace(DIRECTION, '');
  for (const x of [q, d]) {
    add(x.replace(ACTION_WORD, ''));
    add(x.replace(DIVISION_WORD, ''));
  }
  add(d);
  const after = q.match(AFTER);
  if (after) add(after[1]);
  // A double space is often where the file lost a comma: "Congress Building  Caracas".
  const gap = raw.trim().split(/\s{2,}/);
  if (gap.length > 1) for (const g of [gap[gap.length - 1], ...gap.slice(0, -1)]) add(g.replace(FILLER, ''));
  const words = q.split(' ').filter(w => !/^\d+$/.test(w));
  if (words.length > 1 && words.length <= 8) {
    for (const n of [2, 1]) {
      for (let i = words.length - n; i >= 0; i--) {
        const gram = words.slice(i, i + n);
        if (gram.every(w => !STOP.has(w.toLowerCase()))) add(gram.join(' '), true);
      }
    }
  }
  return out;
}

/** `country` says whether a name is the protest's own country. */
export function parseLocation(raw: string, country: (s: string) => boolean): Where {
  const where: Where = { candidates: [], named: 0, nationwide: false, several: false, part: false, given: !UNGIVEN.test(raw.trim()) };
  if (!where.given) return where;
  for (const segment of raw.split(';')) {
    let s = segment;
    const t = tidy(s);
    if (!t) continue;
    const across = t.match(/^(?:across|throughout|all over|around)\s+(?:the\s+)?(.+)$/i);
    if (NATIONWIDE.test(t) || (across && country(across[1]))) {
      where.nationwide = true;
      continue;
    }
    const then = t.match(NATIONWIDE_THEN);
    if (then) {
      where.nationwide = true;
      s = then[1];
      if (!s.trim()) continue;
    }
    const pieces = s.split(/,|\s+and\s+|\s+&\s+|\/|\s+to\s+/i).filter(x => x.trim());
    for (const [i, piece] of pieces.entries()) {
      const pt = tidy(piece);
      if (SEVERAL.test(pt) || /^(?:other|others|elsewhere|etc\.?|other cities)$/i.test(pt)) {
        where.several = true;
        continue;
      }
      if (NATIONWIDE.test(pt)) {
        where.nationwide = true;
        continue;
      }
      if (country(pt.replace(DIRECTION, ''))) {
        where.part = true;
        continue;
      }
      // "Conakry, Conakry Region" names one place: the region is its context, and the fallback when the town isn't found.
      if (i === 1 && pieces.length === 2 && DIVISION_WORD.test(` ${pt}`) && where.named) {
        where.candidates.push(...names(piece).filter(c => !c.loose).map(c => ({ ...c, piece: where.named - 1 })));
        continue;
      }
      where.named++;
      const admin1 = pieces.length === 2 && i === 0 ? tidy(pieces[1]) : undefined;
      // The country itself ("University of Nicaragua", "towns around Britain") is no place in it.
      const all = names(piece);
      const own = all.filter(c => !country(c.name)).map(c => ({ ...c, piece: where.named - 1 }));
      if (own.length < all.length) where.part = true;
      if (admin1) where.candidates.push(...own.filter(c => !c.loose).map(c => ({ ...c, admin1 })));
      where.candidates.push(...own);
    }
  }
  return where;
}

/** Levenshtein distance, for a capital the source misspells. */
export function distance(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return d[b.length];
}

export type Capital = { city: string; lon: number; lat: number };

export type Placement = {
  lon: number;
  lat: number;
  geoPrec: GeoPrec;
  placedAt: string;
  method: string;
  confidence?: number;
  /** The name as the source wrote it, for the title. */
  name?: string;
  fixed?: string;
};

/** The protest's place, or why it has none. `capital` is the country's seat of government on the day. */
export function placeProtest(geo: GeoIndex, where: Where, countries: string[], capital: Capital | undefined, raw: string): Placement | { reject: string } {
  if (!where.given) return { reject: 'no location given' };
  const more = (piece = 0) => (where.named > 1 ? ` (${piece ? 'one' : 'the first'} of ${where.named} places it names)` : '');
  const scope = where.nationwide ? '; the source also gives it as nationwide' : '';
  const seen = new Set<string>();
  let wholeCountry = false;
  // Within one piece the finest match wins ("Cayenne  French Guiana" is Cayenne); the first piece that matches is used.
  let best: { p: Placement; piece?: number } | null = null;
  for (const c of where.candidates) {
    if (best && c.piece !== best.piece) break;
    const key = `${normName(c.name)}|${c.admin1 ?? ''}`;
    if (seen.has(key) || !normName(c.name)) continue;
    seen.add(key);
    const r = resolveEvent(geo, { named: [{ name: c.name, admin1: c.admin1 ?? null }], countries }, { methods: ['named-place'] });
    let p: Placement | null = null;
    // "southern Brazil" names only the country. A lone place of that name abroad (Plymouth Harbor for Plymouth) isn't it.
    if (r?.kind === 'country') wholeCountry = true;
    else if (r?.evidence?.some(e => e === 'country' || e === 'admin1')) {
      p = { ...fromResolved(r, c.name, `${c.from ? ` (the source spells it “${c.from}”)` : ''}${more(c.piece)}${scope}`), fixed: c.from };
    } else if (capital && near(c.name, capital.city)) {
      const spelt = c.from ?? (normName(c.name) === normName(capital.city) ? undefined : c.name);
      p = {
        lon: capital.lon, lat: capital.lat, geoPrec: GeoPrec.city, method: 'capital-name', name: capital.city, fixed: spelt,
        placedAt: `capital, ${capital.city}${spelt ? ` (the source spells it “${spelt}”)` : ''}${more(c.piece)}${scope}`,
      };
    }
    if (p && p.geoPrec <= GeoPrec.city) return p;
    if (p && (!best || p.geoPrec < best.p.geoPrec)) best = { p, piece: c.piece };
  }
  if (best) return best.p;
  if (where.candidates.length) {
    const r = resolveEvent(geo, { description: raw, countries }, { methods: ['description-name'] });
    if (r) return fromResolved(r, null, `${more()}${scope}`);
  }
  const vague = where.nationwide || where.several || where.part || wholeCountry;
  if (vague && capital) {
    const why = where.nationwide ? 'the source gives the protest as nationwide' : where.several ? 'the source names no single place' : 'the source names only the country or a part of it';
    return { lon: capital.lon, lat: capital.lat, geoPrec: GeoPrec.country, method: 'capital', placedAt: `capital at the time (${capital.city}): ${why}` };
  }
  if (vague) return { reject: 'nationwide, and no capital known for the country' };
  return { reject: 'location names no place the gazetteer finds' };
}

const near = (name: string, city: string) => {
  const [a, b] = [normName(name), normName(city)];
  return a === b || (b.length >= 5 && distance(a, b) <= Math.min(2, Math.floor(b.length / 4)));
};

function fromResolved(r: Resolved, name: string | null, tail: string): Placement {
  return { lon: r.lon, lat: r.lat, geoPrec: r.geoPrec, method: r.method, confidence: r.confidence, name: name ?? r.detail?.split(' → ')[0], placedAt: `${r.placedAt}${tail}` };
}
