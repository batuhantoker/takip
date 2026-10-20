import { GeoPrec } from '@takip/db';
import { km, middle } from '../geo/candidates';
import { type GeoIndex, itemKind, type Point } from '../geo/geo-index';
import { articleConsensus, resolveEvent } from '../geo/resolve';
import { normName } from '../names';

/*
 * Places a year-page bullet from the articles it links: an event article's own coordinates, the place an event
 * title names, the places it links, then its text. Every method is measured on its own (years/bench.ts); the
 * importer takes only those that place as well as the resolver's accepted methods (geolocation.md §3).
 */

export type Method =
  | 'event-article' // the linked event's own coordinates (Wikidata item or its articles)
  | 'place-in' // a place the text puts it in or at ("killed in [[Ra'anana]]")
  | 'event-title' // a place the linked event's title names ("Battle of Kalyan")
  | 'place-link' // the one place it links, or several within a town's reach
  | 'place-links-middle' // the middle of several linked places close together
  | 'context-place' // a place the bullets above it link (Current events: the story line)
  | 'context-event' // the coordinates of the event the bullets above it link
  | 'description-name' // "… in Ra'anana": a place its English text names
  | 'coords-link' // a linked organisation's or object's coordinates (a head office, a ship)
  | 'country-link' // the one country it links
  | 'country-page'; // the country of a "<year> in X" page

export type Linked = {
  title: string;
  qid: number | null;
  role: 'event' | 'place' | 'country' | 'coords' | 'none';
  point?: Point;
  /** Coarse kind (settlement, admin2, river, event…) for places. */
  kind?: string;
  country?: string | null;
  /** GeoData size in metres where an article gives it. */
  dim?: number | null;
  /** The text puts the bullet in or at it. */
  loc?: boolean;
  /** How precisely its point places something there (places). */
  prec?: GeoPrec;
  cls?: number | null;
};

export type Placed = Point & { geoPrec: GeoPrec; method: Method; placedAt: string; kind?: string; detail?: string; country?: string | null };

/** A link title → its Wikidata number, its class (first P31) and GeoNames' kind for it, when the geo index has them. */
export type LinkInfo = { title: string; qid: number | null; cls?: number | null; gnKind?: string | null };

/** Kinds of place by how precisely they place an event (the resolver's KIND_PREC, plus buildings and structures). */
const KIND_PREC: Record<string, GeoPrec> = {
  settlement: GeoPrec.city, fort: GeoPrec.city, site: GeoPrec.city, pass: GeoPrec.city, building: GeoPrec.city, structure: GeoPrec.city,
  mountain: GeoPrec.area, island: GeoPrec.area, admin3: GeoPrec.area, lake: GeoPrec.area, admin2: GeoPrec.area, cape: GeoPrec.area, bay: GeoPrec.area,
  terrain: GeoPrec.area, region: GeoPrec.approximate, river: GeoPrec.approximate, admin1: GeoPrec.approximate, admin: GeoPrec.approximate, sea: GeoPrec.approximate,
  country: GeoPrec.country,
};
const PLACE_KINDS = new Set(Object.keys(KIND_PREC));
const KIND_WORD: Record<string, string> = {
  settlement: 'town', fort: 'fort', site: 'site', building: 'building', structure: 'site', pass: 'pass', cape: 'cape', mountain: 'mountain', island: 'island',
  lake: 'lake', bay: 'waters', sea: 'sea', river: 'river', terrain: 'area', admin3: 'district', admin2: 'district', admin1: 'region', admin: 'region', region: 'region', country: 'country',
};
const word = (kind: string | undefined) => (kind && KIND_WORD[kind]) || 'place';
/** Order from finest to coarsest, for picking among several linked places. */
const RANK = ['building', 'structure', 'site', 'fort', 'settlement', 'pass', 'cape', 'mountain', 'island', 'admin3', 'lake', 'admin2', 'bay', 'terrain', 'region', 'river', 'admin1', 'admin', 'sea'];
const rank = (k: string | undefined) => {
  const i = RANK.indexOf(k ?? '');
  return i < 0 ? RANK.length : i;
};

/** GeoData's size of the thing an article is about, as a precision (the resolver's articlePrec). */
export const sizePrec = (dim: number | null | undefined): GeoPrec =>
  (dim ?? 0) >= 500_000 ? GeoPrec.country : (dim ?? 0) >= 100_000 ? GeoPrec.approximate : (dim ?? 0) >= 20_000 ? GeoPrec.area : GeoPrec.exact;

/** A place's precision, coarsened by its article's size: the Gulf of Aden is a point only roughly. */
export const placePrec = (kind: string | undefined, dim: number | null | undefined): GeoPrec =>
  Math.max((kind ? KIND_PREC[kind] : undefined) ?? GeoPrec.approximate, sizePrec(dim)) as GeoPrec;

/** GeoData types that say how big a thing is when its size isn't given. */
const TYPE_PREC: Record<string, GeoPrec> = { country: GeoPrec.country, state: GeoPrec.approximate, adm1st: GeoPrec.approximate, adm2nd: GeoPrec.area, river: GeoPrec.approximate };
/** Classes of continents, oceans and parts of the world: no point of theirs says where anything happened. */
const TOO_BIG = new Set([5107, 9430, 855697, 2418896, 137186904]);
/** The continents themselves, whose first class is as often "geographic location" or "region". */
const CONTINENTS = new Set([15, 18, 46, 48, 49, 51, 538, 828, 5401, 3960]);

/**
 * What a linked article is to the map: an event, a place, a country, something else with coordinates, or nothing.
 * Only Wikidata's coordinates make a place: an article about a person or a church can carry a stray one in some
 * language (the Arabic George Washington has his grave's).
 */
export function classify(index: GeoIndex, lang: string, link: LinkInfo, isEvent: (l: LinkInfo) => boolean): Linked {
  const base = { title: link.title, qid: link.qid };
  const item = link.qid !== null ? index.item(link.qid) : null;
  const arts = link.qid !== null ? index.articles(link.qid) : [];
  const own = arts.find(a => a.wiki === lang) ?? arts.find(a => a.wiki === 'en');
  const dim = own?.dim ?? null;
  const type = own?.type?.split(':')[0].toLowerCase() ?? null;
  // A town is a town however its name reads ("Ernakulam" matched an event pattern).
  const place = !!item?.kind && item.kind !== 'event';
  if ((isEvent(link) && !place) || item?.kind === 'event' || (type === 'event' && !place)) {
    const c = item ? null : articleConsensus(arts);
    const point = item ?? c?.point;
    return { ...base, role: 'event', ...(point ? { point: { lon: point.lon, lat: point.lat } } : {}), kind: 'event', country: item?.country ?? null, dim };
  }
  if (!item) {
    const country = index.country(normName(link.title));
    return country && !/\(|,/.test(link.title) ? { ...base, role: 'country', point: country.point, kind: 'country', country: country.iso2 } : { ...base, role: 'none' };
  }
  // Wikidata's "admin" is every level; GeoNames knows a state (admin1) from a county.
  const gn = link.gnKind === 'country' || (item.kind === 'admin' && link.gnKind && /^admin[123]$/.test(link.gnKind)) ? link.gnKind : null;
  const kind = gn ?? (item.kind === 'building' || item.kind === 'structure' ? item.kind : itemKind(item.kind));
  const point = { lon: item.lon, lat: item.lat };
  // An island, mountain or terrain of no stated size may be Great Britain, the Alps or Tibet.
  const unsized = dim === null && (kind === 'island' || kind === 'mountain' || kind === 'terrain') ? GeoPrec.approximate : GeoPrec.exact;
  const prec = Math.max(placePrec(kind, dim), (type ? TYPE_PREC[type] : undefined) ?? GeoPrec.exact, unsized) as GeoPrec;
  if (kind === 'country' || prec === GeoPrec.country || (link.cls != null && TOO_BIG.has(link.cls)) || (link.qid !== null && CONTINENTS.has(link.qid))) return { ...base, role: 'country', point, kind: 'country', country: item.country, dim };
  if (PLACE_KINDS.has(kind)) return { ...base, role: 'place', point, kind, country: item.country, dim, prec };
  return { ...base, role: 'coords', point, kind, country: item.country, dim };
}

/** How far from a place's point something in it can be, by the precision the place gives. */
const REACH_KM: Record<number, number> = { [GeoPrec.exact]: 10, [GeoPrec.city]: 25, [GeoPrec.area]: 100, [GeoPrec.approximate]: 300, [GeoPrec.country]: 1000 };

/** Places close enough to be one: a town and the district around it, two sites in one city. */
const NEAR_KM = 25;
/** Several places further apart than this have no useful middle. */
const SPREAD_KM = 150;

/** One point from several linked places: the finest if they agree, their middle if close, else none. */
export function fromPlaces(places: Linked[], countries: string[] | null, method: 'place' | 'in' | 'context'): Placed | null {
  let ps = places.filter(p => p.role === 'place' && p.point);
  if (!ps.length) return null;
  // The page's country picks among places abroad: "1990 in Turkey" linking Iraq's oil and İskenderun.
  if (countries?.length && ps.length > 1) {
    const inside = ps.filter(p => p.country && countries.includes(p.country));
    if (inside.length) ps = inside;
  }
  const finest = Math.min(...ps.map(p => rank(p.kind)));
  const fine = ps.filter(p => rank(p.kind) === finest);
  const first = fine[0];
  const others = ps.filter(p => p !== first);
  // Coarser places that contain the finest one (its district, its region) don't compete with it.
  const competing = others.filter(p => rank(p.kind) <= rank('island') || km(p.point!, first.point!) <= NEAR_KM);
  const label = { place: 'it links', in: 'its text puts it in', context: 'the story it belongs to links' }[method];
  if (competing.every(p => km(p.point!, first.point!) <= NEAR_KM)) {
    const prec = first.prec ?? placePrec(first.kind, first.dim);
    const m = ({ place: 'place-link', in: 'place-in', context: 'context-place' } as const)[method];
    // Another place it links beyond this one's reach halves the hit rate (54 % against 85 %): refused.
    if (!others.every(o => km(o.point!, first.point!) <= Math.max(NEAR_KM, REACH_KM[o.prec ?? GeoPrec.area]))) return null;
    return { ...first.point!, country: first.country, geoPrec: prec, method: m, placedAt: `${word(first.kind)} ${label}, ${first.title.replace(/\s*\(.*\)$/, '')}`, kind: first.kind, detail: first.title };
  }
  const pts = [first, ...competing].map(p => p.point!);
  const mid = middle(pts);
  const spread = Math.max(...pts.map(p => km(p, mid)));
  if (method === 'place' && spread <= SPREAD_KM) {
    return { ...mid, geoPrec: GeoPrec.approximate, method: 'place-links-middle', placedAt: `middle of the ${pts.length} places it links`, detail: [first, ...competing].map(p => p.title).join(' | ') };
  }
  return null;
}

export type PlaceInput = {
  lang: string;
  text: string;
  year: number;
  /** Own links in order, classified. */
  links: Linked[];
  /** Links of the bullets above it, nearest first. */
  ctx: Linked[];
  /** The page's countries ("<year> in Turkey"). */
  countries: string[] | null;
  /** The main event link to leave out (the benchmark hides it). */
  hide?: number | null;
  /** Keep the hidden link's title for `event-title` (production has it; the strict benchmark doesn't). */
  hideTitle?: boolean;
};

/** Each method on its own; `place` runs them in order. */
export function byMethod(index: GeoIndex, x: PlaceInput, m: Method): Placed | null {
  const hidden = (l: Linked) => x.hide != null && l.qid === x.hide;
  const links = x.links.filter(l => !hidden(l));
  const main = x.links.find(l => l.role === 'event');
  switch (m) {
    case 'event-article': {
      // Only the event it is about: another event it mentions put it 48 % within reach.
      const e = main && !hidden(main) && main.point ? main : null;
      if (!e) return null;
      return { ...e.point!, country: e.country, geoPrec: sizePrec(e.dim), method: m, placedAt: `coordinates of the event it links, ${e.title}`, detail: e.title };
    }
    case 'event-title': {
      if (!main || (hidden(main) && !x.hideTitle)) return null;
      const r = resolveEvent(index, { qid: hidden(main) || main.qid === null ? null : `Q${main.qid}`, titles: [{ text: main.title, lang: x.lang }], year: x.year, countries: x.countries ?? [] }, { methods: ['title-name'] });
      return r ? { lon: r.lon, lat: r.lat, geoPrec: r.geoPrec, method: m, placedAt: r.placedAt?.replace('its title names', 'named in the title of the event it links') ?? 'place named in the title of the event it links', kind: r.kind, detail: r.detail } : null;
    }
    case 'place-in': {
      // The places its text puts it in or at, and finer places it links inside them: "Mount Bromo in [[Indonesia]]".
      const areas = links.filter(l => l.loc && (l.role === 'place' || l.role === 'country') && l.point);
      const inside = (p: Linked) =>
        areas.some(a => a === p || (a.role === 'country' ? !!p.country && p.country === a.country : rank(p.kind) < rank(a.kind) && km(p.point!, a.point!) <= REACH_KM[a.prec ?? GeoPrec.area]));
      return fromPlaces(links.filter(l => l.role === 'place' && l.point && inside(l)), x.countries, 'in');
    }
    case 'place-link':
    case 'place-links-middle': {
      const r = fromPlaces(links, x.countries, 'place');
      return r && r.method === m ? r : null;
    }
    case 'context-place':
      return fromPlaces(x.ctx, x.countries, 'context');
    case 'context-event': {
      const e = x.ctx.find(l => l.role === 'event' && l.point);
      return e ? { ...e.point!, geoPrec: Math.max(GeoPrec.city, sizePrec(e.dim)) as GeoPrec, method: m, placedAt: `coordinates of the story it belongs to, ${e.title}`, detail: e.title } : null;
    }
    case 'description-name': {
      if (x.lang !== 'en') return null;
      const r = resolveEvent(index, { description: x.text, year: x.year, countries: x.countries ?? [] }, { methods: ['description-name'] });
      return r ? { lon: r.lon, lat: r.lat, geoPrec: r.geoPrec, method: m, placedAt: r.placedAt?.replace('its description names', 'its text names') ?? 'place its text names', kind: r.kind, detail: r.detail } : null;
    }
    case 'coords-link': {
      const c = links.find(l => l.role === 'coords' && l.point);
      return c ? { ...c.point!, geoPrec: GeoPrec.city, method: m, placedAt: `coordinates of ${c.title}`, kind: c.kind, detail: c.title } : null;
    }
    case 'country-link': {
      // Only real countries count: a continent linked beside Greece doesn't make Greece ambiguous.
      const cs = [...new Map(links.filter(l => l.role === 'country' && l.point && l.country).map(l => [l.country!, l])).values()];
      return cs.length === 1 ? { ...cs[0].point!, geoPrec: GeoPrec.country, method: m, placedAt: `country it links, ${cs[0].title}`, kind: cs[0].country ?? undefined, detail: cs[0].title } : null;
    }
    case 'country-page': {
      if (x.countries?.length !== 1) return null;
      const c = index.country(x.countries[0]);
      return c ? { ...c.point, geoPrec: GeoPrec.country, method: m, placedAt: 'country of the year page it is listed on', kind: x.countries[0], detail: x.countries[0] } : null;
    }
  }
}

export const METHODS: Method[] = ['event-article', 'place-in', 'event-title', 'place-links-middle', 'description-name', 'place-link', 'context-event', 'context-place', 'coords-link', 'country-link', 'country-page'];

/** The first of `methods` that places it, in `METHODS` order. */
export function place(index: GeoIndex, x: PlaceInput, methods: readonly Method[]): Placed | null {
  for (const m of METHODS) {
    if (!methods.includes(m)) continue;
    const r = byMethod(index, x, m);
    if (r) return r;
  }
  return null;
}

/**
 * Methods that placed bullets about a known event as well as the resolver's accepted ones (geolocation.md §3: 85–91 %
 * within their precision's reach) in this order; docs/architecture/wikipedia-years.md §4 has the numbers. A story
 * line's event or places, a linked organisation's coordinates and a page's country measured 49–76 % and stay out.
 */
export const ACCEPTED: Method[] = ['event-article', 'event-title', 'place-in', 'place-links-middle', 'description-name', 'place-link'];
/**
 * Per wiki, the methods whose points were right only to one level coarser (`rough`: placed after the others failed,
 * English towns from a linked place or a named one were 75–82 % within 25 km but 87–93 % within 300) and those that
 * measured below the bar even so (`refused`). docs/architecture/wikipedia-years.md §4 has each wiki's numbers.
 */
export const LANG_RULES: Record<string, { rough: Method[]; refused?: Method[] }> = {
  en: { rough: ['description-name', 'place-link'] },
  tr: { rough: ['place-link'] },
  de: { rough: ['place-link'] },
  ja: { rough: ['place-link'] },
  // The place a French, Russian, Spanish, Arabic or Chinese bullet puts itself in: 77–83 % within reach, 87–92 % within 300 km.
  fr: { rough: ['place-link', 'place-in'] },
  ru: { rough: ['place-link', 'place-in'] },
  es: { rough: ['place-link', 'place-in'] },
  ar: { rough: ['place-link', 'place-in'] },
  zh: { rough: ['place-link', 'place-in', 'event-title'] },
  // Too few Persian bullets to measure (10–28 a method): all rough, and no country points.
  fa: { rough: ['place-link', 'place-in', 'event-title'], refused: ['country-link'] },
};
const DEFAULT_RULES = { rough: ['description-name', 'place-link'] as Method[] };
/** A linked country's point places a bullet only for a small country: 86 % within 1,000 km under this. */
export const SMALL_COUNTRY_KM2 = 150_000;

/** The accepted cascade, then the one country it links when that country is small. */
export function placeAccepted(index: GeoIndex, x: PlaceInput, areaOf: (iso2: string) => number | null): Placed | null {
  const rules = LANG_RULES[x.lang] ?? DEFAULT_RULES;
  const r = place(index, x, rules.refused ? ACCEPTED.filter(m => !rules.refused!.includes(m)) : ACCEPTED);
  if (r && rules.rough.includes(r.method)) {
    return { ...r, geoPrec: r.geoPrec >= GeoPrec.approximate ? GeoPrec.country : GeoPrec.approximate, placedAt: `area around the ${r.placedAt}` };
  }
  if (r) return r;
  const c = rules.refused?.includes('country-link') ? null : byMethod(index, x, 'country-link');
  return c?.kind && (areaOf(c.kind) ?? Infinity) < SMALL_COUNTRY_KM2 ? c : null;
}
