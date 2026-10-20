import { GeoPrec } from '@takip/db';
import { normName } from '../names';
import { cluster, type Context, decide, type Features, km, median, middle, score, type Tagged } from './candidates';
import { type ArticlePoint, type GeoIndex, itemKind, type Point } from './geo-index';
import { descriptionPlaces, type NameMatch, placeNames } from './names';

/*
 * Places an event from whatever it carries, best evidence first: its own coordinates, the places Wikidata links,
 * its own Wikipedia articles' coordinates in any language, a place a source field or its title names, the middle of
 * related events, its country. Every result says how it was placed. docs/architecture/geolocation.md has the
 * benchmark that set the precisions below.
 */

export type Method = 'own' | 'place-item' | 'article' | 'named-place' | 'title-name' | 'description-name' | 'related' | 'country';

export type Evidence = {
  /** The source's own coordinates. */
  coords?: Point | null;
  /** Places Wikidata links (P276 location, P706 terrain feature, P131 admin area, P17 country), as Q-ids. */
  places?: { qid: string; prop: string }[];
  /** The event's own item: its Wikipedia articles' coordinates count. Its own P625 never does (that is `coords`). */
  qid?: string | null;
  /** The event's own articles where no item is known. */
  articles?: { wiki: string; title: string }[];
  /** Places a source field names (GTD's city), with the division and country it gives. */
  named?: { name: string; admin1?: string | null; country?: string | null; lang?: string }[];
  /** Titles and labels, with their language where known. */
  titles?: { text: string; lang?: string }[];
  description?: string | null;
  /** Astronomical year of the start. */
  year?: number | null;
  /** ISO 3166-1 alpha-2 codes, or country names in any language. */
  countries?: string[];
  countryPoint?: Point | null;
  /** Points of related events (the other battles of its war). */
  related?: Point[];
  naval?: boolean;
};

export type Resolved = Point & {
  geoPrec: GeoPrec;
  method: Method;
  /** For the popup's "Placed at the {place}." */
  placedAt?: string;
  /** Share of benchmark events this method and precision put within its precision's reach (`CONFIDENCE`). */
  confidence: number;
  /** The kind of place it was put at (settlement, river, admin1…), for name and item methods. */
  kind?: string;
  /** What beyond the name pointed there: country, admin1, related, era, primary, names, hint; or alone. */
  evidence?: string[];
  /** Human-readable: the matched name and gazetteer key. */
  detail?: string;
  /** Name methods: the numbers the decision was made on. */
  features?: Features;
};

export type Options = {
  /** Only these methods, for measuring each on its own. */
  methods?: Method[];
  margin?: number;
  /** Take the best-scoring place even without enough evidence (benchmark only). */
  permissive?: boolean;
};

const LANG_NAME: Record<string, string> = {
  en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', ru: 'Russian', pl: 'Polish', uk: 'Ukrainian', tr: 'Turkish', ar: 'Arabic', fa: 'Persian',
  zh: 'Chinese', ja: 'Japanese', pt: 'Portuguese', nl: 'Dutch', sv: 'Swedish', el: 'Greek', hy: 'Armenian', az: 'Azerbaijani', sr: 'Serbian', hu: 'Hungarian',
  ro: 'Romanian', cs: 'Czech', he: 'Hebrew', ko: 'Korean', id: 'Indonesian', vi: 'Vietnamese', hi: 'Hindi',
};
const KIND_WORD: Record<string, string> = {
  settlement: 'town', fort: 'fort', site: 'site', pass: 'pass', cape: 'cape', mountain: 'mountain', island: 'island', lake: 'lake', bay: 'waters', sea: 'sea',
  river: 'river', terrain: 'area', admin3: 'district', admin2: 'district', admin1: 'region', region: 'region', country: 'country', admin: 'region',
};
const word = (kind: string) => KIND_WORD[kind] ?? 'place';

/** Gazetteer kinds by how precisely they place an event: the benchmark's errors per kind (geolocation.md §3). */
const KIND_PREC: Record<string, GeoPrec> = {
  settlement: GeoPrec.city, fort: GeoPrec.city, site: GeoPrec.city, pass: GeoPrec.city, mountain: GeoPrec.area, island: GeoPrec.area, admin3: GeoPrec.area,
  lake: GeoPrec.area, admin2: GeoPrec.area, cape: GeoPrec.area, bay: GeoPrec.area, terrain: GeoPrec.area, region: GeoPrec.area,
  river: GeoPrec.approximate, admin1: GeoPrec.approximate, admin: GeoPrec.approximate, sea: GeoPrec.approximate, country: GeoPrec.country,
};
/** A description's "in X" names a town reliably, anything larger only roughly. */
const DESCRIPTION_PREC: Record<string, GeoPrec> = { settlement: GeoPrec.city, fort: GeoPrec.city, site: GeoPrec.city, pass: GeoPrec.city, country: GeoPrec.country };
const kindPrec = (kind: string) => KIND_PREC[kind] ?? GeoPrec.approximate;

/**
 * Share of benchmark events each method and precision put within that precision's reach of the truth: exact 10 km,
 * city 25 km, area 100 km, approximate 300 km, country 1000 km (geolocation.md §3). The article method's figure is
 * flattered: most P625 coordinates were copied from those articles.
 */
export const CONFIDENCE: Partial<Record<Method, Partial<Record<GeoPrec, number>>>> = {
  own: { [GeoPrec.exact]: 1 },
  article: { [GeoPrec.exact]: 0.99, [GeoPrec.area]: 0.99, [GeoPrec.approximate]: 0.99 },
  'named-place': { [GeoPrec.city]: 0.98, [GeoPrec.area]: 0.95 },
  'title-name': { [GeoPrec.city]: 0.91, [GeoPrec.area]: 0.85, [GeoPrec.approximate]: 0.89, [GeoPrec.country]: 0.91 },
  'description-name': { [GeoPrec.city]: 0.88, [GeoPrec.approximate]: 0.85 },
  related: { [GeoPrec.approximate]: 0.9 },
};
const confidence = (method: Method, prec: GeoPrec, fallback: number) => CONFIDENCE[method]?.[prec] ?? fallback;

const qn = (q: string | null | undefined) => {
  const m = q?.match(/^Q(\d+)$/);
  return m ? Number(m[1]) : null;
};
const valid = (p: Point | null | undefined): p is Point => !!p && Number.isFinite(p.lon) && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 && !(p.lon === 0 && p.lat === 0);

/** Wikidata location properties, most specific first. */
const PROP_ORDER = ['P276', 'P706', 'P131', 'P17'];
const PROP_PHRASE: Record<string, string> = { P276: 'Wikidata gives as its location', P706: 'Wikidata says it was on', P131: 'Wikidata says it was in', P17: 'Wikidata gives as its country' };

function placeItem(index: GeoIndex, ev: Evidence): Resolved | null {
  const places = [...(ev.places ?? [])].sort((a, b) => PROP_ORDER.indexOf(a.prop) - PROP_ORDER.indexOf(b.prop));
  for (const p of places) {
    const q = qn(p.qid);
    if (q === null) continue;
    const item = index.item(q);
    // P276 sometimes points at another event (a battle "located in" a campaign).
    if (item?.kind === 'event') continue;
    const at = item ?? articleConsensus(index.articles(q))?.point;
    if (!at) continue;
    const kind = p.prop === 'P17' ? 'country' : itemKind(item?.kind ?? null);
    const prec = p.prop === 'P17' ? GeoPrec.country : kind === 'unknown' ? GeoPrec.area : kindPrec(kind);
    return { lon: at.lon, lat: at.lat, geoPrec: prec, method: 'place-item', placedAt: `${word(kind)} ${PROP_PHRASE[p.prop] ?? 'Wikidata links'}`, confidence: confidence('place-item', prec, 0.5), kind, detail: `${p.prop}=${p.qid}` };
  }
  return null;
}

const WIKI_ORDER = ['en', 'de', 'fr', 'ru', 'es', 'it', 'pl', 'uk', 'pt', 'nl', 'sv', 'tr', 'ja', 'zh'];
const wikiRank = (w: string) => {
  const i = WIKI_ORDER.indexOf(w);
  return i < 0 ? WIKI_ORDER.length : i;
};

/** The point most of an item's articles agree on (within 25 km); one article alone counts, a split vote does not. */
export function articleConsensus(arts: ArticlePoint[]): { point: ArticlePoint; agree: number; total: number } | null {
  if (!arts.length) return null;
  const sorted = [...arts].sort((a, b) => wikiRank(a.wiki) - wikiRank(b.wiki));
  let best: { point: ArticlePoint; agree: number } | null = null;
  for (const a of sorted) {
    const agree = sorted.filter(b => km(a, b) <= 25).length;
    if (!best || agree > best.agree) best = { point: a, agree };
  }
  if (!best || (sorted.length > 1 && best.agree * 2 <= sorted.length)) return null;
  return { ...best, total: sorted.length };
}

/** GeoData sizes: an article about a region or country is placed at its middle, not at a site. */
function articlePrec(a: ArticlePoint): GeoPrec {
  const t = a.type?.split(':')[0].toLowerCase();
  if (t === 'country' || t === 'satellite' || (a.dim ?? 0) >= 500_000) return GeoPrec.country;
  if (t === 'adm1st' || t === 'state' || t === 'river' || (a.dim ?? 0) >= 100_000) return GeoPrec.approximate;
  if (t === 'adm2nd' || t === 'adm3rd' || t === 'isle' || t === 'waterbody' || t === 'forest' || t === 'glacier' || (a.dim ?? 0) >= 20_000) return GeoPrec.area;
  return GeoPrec.exact;
}

function ownArticle(index: GeoIndex, ev: Evidence): Resolved | null {
  const q = qn(ev.qid);
  let arts = q !== null ? index.articles(q) : [];
  if (!arts.length) arts = (ev.articles ?? []).map(a => index.articleByTitle(a.wiki, a.title)).filter((a): a is ArticlePoint => !!a);
  const c = articleConsensus(arts);
  if (!c) return null;
  const prec = articlePrec(c.point);
  const lang = LANG_NAME[c.point.wiki] ?? c.point.wiki;
  return {
    lon: c.point.lon, lat: c.point.lat, geoPrec: prec, method: 'article',
    placedAt: `coordinates of its ${c.total > 1 ? `Wikipedia articles (${c.agree} of ${c.total} languages agree)` : `${lang} Wikipedia article`}`,
    confidence: confidence('article', prec, 0.9), detail: `${c.point.wiki}:${c.point.title ?? ''}`,
  };
}

/** Country codes for context: ISO codes as given, names looked up in any language. */
function countryCodes(index: GeoIndex, names: string[] | undefined): string[] {
  const out = new Set<string>();
  for (const n of names ?? []) {
    const c = /^[A-Z]{2}$/.test(n) ? index.country(n) : index.country(normName(n));
    if (c) out.add(c.iso2);
  }
  return [...out];
}

/** "CC.code" of the first-level divisions a name could be, within the given countries. */
function admin1Codes(index: GeoIndex, name: string, countries: string[]): string[] {
  const norm = normName(name);
  if (!norm) return [];
  const hits = index.places(norm).filter(h => h.source === 'geonames' && (h.kind === 'admin1' || h.kind === 'admin2') && h.country && h.admin1);
  return [...new Set(hits.filter(h => !countries.length || countries.includes(h.country!)).map(h => `${h.country}.${h.admin1}`))];
}

function lookup(index: GeoIndex, matches: NameMatch[], exclude: number | null): Tagged[] {
  const hits: Tagged[] = [];
  matches.forEach((m, i) => {
    const seen = new Set<string>();
    for (const norm of m.norms) {
      for (const h of index.places(norm)) {
        if (seen.has(h.key) || (exclude !== null && h.qid === exclude) || h.kind === 'event') continue;
        // A guessed nominative of an inflected form must be a name in that language, or it matches too much.
        if (m.inflected && norm !== m.norms[0] && h.lang !== m.lang) continue;
        seen.add(h.key);
        hits.push({ ...h, match: i, hint: m.hint, nameLang: m.lang });
      }
    }
  });
  return hits;
}

/** Context from comma qualifiers ("Lexington, Missouri") and description places that are countries or regions. */
function contextFrom(index: GeoIndex, matches: NameMatch[], ctx: Context) {
  for (const m of matches) {
    const country = index.country(m.norms[0]);
    if (country) ctx.countries = [...new Set([...(ctx.countries ?? []), country.iso2])];
    else ctx.admin1s = [...new Set([...(ctx.admin1s ?? []), ...admin1Codes(index, m.name, ctx.countries ?? [])])];
  }
}

function byName(index: GeoIndex, matches: NameMatch[], ctx: Context, ev: Evidence, method: Method, phrase: string, opts: Options): Resolved | null {
  const main = matches.filter(m => !m.head.endsWith(':context'));
  if (!main.length) return null;
  const c = { ...ctx };
  contextFrom(index, matches.filter(m => m.head.endsWith(':context')), c);
  const names = dedupe(main);
  const hits = lookup(index, names, qn(ev.qid));
  if (!hits.length) return null;
  const d = decide(score(cluster(hits), c), opts.margin, opts.permissive);
  if (!d) return null;
  const k = d.cluster.kind;
  const prec = method === 'description-name' ? (DESCRIPTION_PREC[k] ?? GeoPrec.approximate) : kindPrec(k);
  const name = names[d.cluster.best.match]?.name ?? d.cluster.best.name;
  return {
    lon: d.cluster.lon, lat: d.cluster.lat, geoPrec: prec, method,
    placedAt: `${word(k)} ${phrase}, ${name}`,
    confidence: confidence(method, prec, d.contexted ? 0.7 : 0.5),
    kind: k,
    evidence: [...d.cluster.evidence, ...(d.alone ? ['alone'] : [])],
    features: d.features,
    detail: `${name} → ${d.cluster.best.key} [${d.cluster.evidence.join(',') || (d.alone ? 'alone' : '-')}] margin ${Number.isFinite(d.margin) ? d.margin.toFixed(1) : '∞'}`,
  };
}

/** One lookup per spelling: the same name from the English and French titles is one piece of evidence, not two. */
function dedupe(matches: NameMatch[]): NameMatch[] {
  const seen = new Set<string>();
  return matches.filter(m => {
    const k = m.norms[0];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Related events as a placement only when they cluster: a war fought across a continent has no useful middle. */
function relatedMiddle(ev: Evidence): Resolved | null {
  const ps = (ev.related ?? []).filter(valid);
  if (ps.length < 3) return null;
  const m = middle(ps);
  const spread = median(ps.map(p => km(p, m)));
  if (spread > 150) return null;
  // Even tightly grouped battles put a war's middle a median ~80 km from where it is placed, so never finer.
  return { ...m, geoPrec: GeoPrec.approximate, method: 'related', placedAt: 'middle of related events', confidence: confidence('related', GeoPrec.approximate, 0.85), detail: `${ps.length} events, spread ${spread.toFixed(0)} km` };
}

function countryOnly(index: GeoIndex, ev: Evidence, codes: string[]): Resolved | null {
  const p = valid(ev.countryPoint) ? ev.countryPoint : codes.length === 1 ? index.country(codes[0])?.point : null;
  return p ? { lon: p.lon, lat: p.lat, geoPrec: GeoPrec.country, method: 'country', confidence: confidence('country', GeoPrec.country, 0) } : null;
}

export function resolveEvent(index: GeoIndex, ev: Evidence, opts: Options = {}): Resolved | null {
  const on = (m: Method) => !opts.methods || opts.methods.includes(m);
  if (on('own') && valid(ev.coords)) return { ...ev.coords, geoPrec: GeoPrec.exact, method: 'own', confidence: 1 };
  if (on('place-item')) {
    const r = placeItem(index, ev);
    if (r && r.geoPrec !== GeoPrec.country) return r;
  }
  if (on('article')) {
    const r = ownArticle(index, ev);
    if (r) return r;
  }
  const countries = countryCodes(index, ev.countries);
  const ctx: Context = { year: ev.year, countries, countryPoint: valid(ev.countryPoint) ? ev.countryPoint : null, related: ev.related?.filter(valid), naval: ev.naval };
  if (on('named-place') && ev.named?.length) {
    for (const n of ev.named) {
      const c: Context = { ...ctx, countries: n.country ? countryCodes(index, [n.country]) : countries };
      if (n.admin1) c.admin1s = admin1Codes(index, n.admin1, c.countries ?? []);
      const norm = normName(n.name);
      if (!norm) continue;
      const r = byName(index, [{ name: n.name, norms: [norm], lang: n.lang ?? '', hint: null, head: 'named', inflected: false }], c, ev, 'named-place', 'the source names', opts);
      if (r) return r;
    }
  }
  const descMatches = on('title-name') || on('description-name') ? descriptionPlaces(ev.description ?? '') : [];
  if (on('title-name')) {
    const matches = (ev.titles ?? []).flatMap(t => placeNames(t.text, t.lang ?? ''));
    // Countries and regions the description names narrow the title's place ("… in Bihar, India").
    const c = { ...ctx };
    contextFrom(index, descMatches.filter(m => index.country(m.norms[0])), c);
    const r = byName(index, matches, c, ev, 'title-name', 'its title names', opts);
    if (r) return r;
  }
  if (on('description-name')) {
    const c = { ...ctx };
    const countryNames = descMatches.filter(m => index.country(m.norms[0]));
    contextFrom(index, countryNames, c);
    const r = byName(index, descMatches.filter(m => !countryNames.includes(m)), c, ev, 'description-name', 'its description names', opts);
    if (r) return r;
  }
  if (on('related')) {
    const r = relatedMiddle(ev);
    if (r) return r;
  }
  if (on('place-item')) {
    const r = placeItem(index, ev);
    if (r) return r;
  }
  return on('country') ? countryOnly(index, ev, countries) : null;
}
