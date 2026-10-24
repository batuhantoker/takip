/**
 * Finding a country by what a reader types, in the browser and on the server alike: no data read here, so the picker
 * can ship it. Case, accents and punctuation don't count; a code or a name typed in full comes first, then names
 * starting with the text, then names with a word starting with it, then names holding it, and a near miss ("germny")
 * where nothing else matches.
 */

export interface CountryOption {
  slug: string;
  /** In the reader's language. */
  name: string;
  /** The English name, where it differs: shown beside it. */
  also?: string;
  /** Other names it goes by, folded: in the other languages, older or shorter ones ("holland", "burma"). */
  alt?: string[];
  /** Codes that find it only typed in full, folded: "us", "usa", "uk". */
  codes?: string[];
}

/** Codes and names people use that GeoNames and the translations don't, by ISO 3166-1 alpha-2. */
export const COUNTRY_ALIASES: Record<string, { codes?: string[]; alt?: string[] }> = {
  US: { codes: ['us', 'u s', 'u s a'], alt: ['america', 'united states of america', 'the states'] },
  GB: { codes: ['uk', 'u k'], alt: ['britain', 'great britain', 'england', 'scotland', 'wales', 'northern ireland'] },
  AE: { codes: ['uae'], alt: ['emirates', 'dubai', 'abu dhabi'] },
  CD: { codes: ['drc', 'dr congo'], alt: ['congo kinshasa', 'democratic republic of the congo', 'zaire'] },
  CG: { alt: ['congo brazzaville', 'republic of the congo'] },
  KR: { codes: ['rok'], alt: ['korea', 'republic of korea'] },
  KP: { codes: ['dprk'], alt: ['democratic people s republic of korea'] },
  CN: { codes: ['prc'] },
  TW: { codes: ['roc'] },
  SA: { codes: ['ksa'], alt: ['saudi'] },
  CF: { codes: ['car'] },
  NZ: { codes: ['nz'] },
  PG: { codes: ['png'] },
  NL: { alt: ['holland', 'the netherlands'] },
  CZ: { alt: ['czech republic', 'czechia'] },
  CI: { alt: ['ivory coast'] },
  MM: { alt: ['burma'] },
  SZ: { alt: ['swaziland'] },
  MK: { alt: ['macedonia'] },
  TR: { alt: ['turkey', 'turkiye'] },
  CV: { alt: ['cape verde'] },
  TL: { alt: ['east timor'] },
  BA: { alt: ['bosnia', 'herzegovina'] },
  RU: { alt: ['russian federation'] },
  IR: { alt: ['persia'] },
  VA: { alt: ['holy see'] },
  LA: { alt: ['lao'] },
  SY: { alt: ['syrian arab republic'] },
  VN: { alt: ['viet nam'] },
  PS: { alt: ['palestinian territories', 'west bank', 'gaza'] },
  FM: { alt: ['micronesia'] },
  LK: { alt: ['ceylon'] },
  BY: { alt: ['belorussia', 'byelorussia'] },
  MD: { alt: ['moldavia'] },
  KG: { alt: ['kirghizia'] },
  BN: { alt: ['brunei darussalam'] },
};

/** Letters Unicode doesn't split into a base and an accent. */
const LETTERS: Record<string, string> = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', đ: 'd', ð: 'd', þ: 'th', ł: 'l', ı: 'i', ħ: 'h' };

/** "Türkiye" → "turkiye", "Côte d’Ivoire" → "cote d ivoire", "U.S.A." → "u s a"; other scripts are kept, lower-cased. */
export const foldName = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[øæœßđðþłıħ]/g, c => LETTERS[c]).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** How well a name answers the query: 0 it starts with it, 1 a word of it does, 2 it holds it, null not at all. */
function score(name: string, q: string): number | null {
  if (name.startsWith(q)) return 0;
  if (name.split(' ').some(w => w.startsWith(q))) return 1;
  return name.includes(q) ? 2 : null;
}

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

/** A slip of a letter or two at the start of the name or of one of its words: "turky", "germny", "phillipines". */
function near(name: string, q: string): boolean {
  const most = q.length >= 7 ? 2 : 1;
  const starts = [0, ...[...name.matchAll(/ /g)].map(m => m.index + 1)];
  return starts.some(at => [q.length - 1, q.length, q.length + 1].some(n => distance(name.slice(at, at + n), q) <= most));
}

/** The options a query finds, best first and otherwise in their own order; every option for an empty query. */
export function matchCountries<T extends CountryOption>(options: T[], query: string): T[] {
  const q = foldName(query);
  if (!q) return options;
  const own = (o: T) => [foldName(o.name), ...(o.also ? [foldName(o.also)] : []), o.slug.replaceAll('-', ' ')];
  const namesOf = (o: T) => [...own(o), ...(o.alt ?? [])];
  let found = options.flatMap((o, i) => {
    if (o.codes?.includes(q) || namesOf(o).includes(q)) return [{ o, i, s: -1 }];
    // Another name counts from a word's start only: "us" inside "Elfenbeinküste" is noise.
    const s = Math.min(...own(o).map(n => score(n, q) ?? Infinity), ...(o.alt ?? []).map(n => { const v = score(n, q); return v !== null && v < 2 ? v : Infinity; }));
    return Number.isFinite(s) ? [{ o, i, s }] : [];
  });
  if (!found.length && q.length >= 4) found = options.flatMap((o, i) => (namesOf(o).some(n => near(n, q)) ? [{ o, i, s: 3 }] : []));
  return found.sort((x, y) => x.s - y.s || x.i - y.i).map(x => x.o);
}
