/*
 * Second chances for the Wikidata rows the importers would drop for want of a label, a date or a place: the offline
 * geolocation resolver (tools/import/geo), the item's other statements and its Wikipedia articles' coordinates
 * (fetch.ts `recover`), the year its description or label states, and the battles beside it. Each fallback says what it
 * used in attrs.placed_at or attrs.date_from, and the report counts each method as a sentinel.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { RAW_MORE, type Reporter } from '../context';
import { utc } from '../dates';
import { validLonLat } from '../events';
import { type GeoIndex, openGeoIndex } from '../geo/geo-index';
import { type Method, resolveEvent } from '../geo/resolve';
import { rowEvidence, warPointsOf } from '../geo/wikidata-evidence';
import { enwikiTitle } from '../wiki';
import { read, readSitelinks, start, wdPoint, wdTime, type Row } from './wikidata';
import { textYear } from './wikidata-years';

const DIR = join(RAW_MORE, 'wikidata');
export const RECOVER = join(DIR, 'recover.json');
export const recoverFiles = () => (existsSync(RECOVER) ? [RECOVER] : []);
/** The Wikidata event files; a parent war's date and place come from whichever holds it. */
export const RAW_NAMES = ['battles', 'politics', 'attacks', 'wars', 'revolutions', 'massacres', 'displacements', 'disasters', 'unrest', 'accidents', 'operations', 'crimes'];
const EVENTS_SITELINKS = join(DIR, 'events-sitelinks.json');

type LonLat = [lon: number, lat: number];
/** An item's best-ranked statements as fetch.ts `recover` keeps them; times as wdTime reads them. */
export type ItemRec = {
  name?: string;
  /** Wikipedia code → article title. */
  sites?: Record<string, string>;
  coord?: LonLat;
  P276?: string[];
  P131?: string[];
  P706?: string[];
  P17?: string[];
  P1071?: string[];
  /** Part of (P361) and conflict (P607). */
  parts?: string[];
  P585?: string[];
  P580?: string[];
  P582?: string[];
  P571?: string[];
  /** Earliest and latest date, as statements or as qualifiers of P585, P580 and P571. */
  P1319?: string[];
  P1326?: string[];
};
/** A place an item points to; claims only for places with no coordinates of their own, and whether a country has ended (P576). */
export type PlaceRec = { name?: string; coord?: LonLat; P276?: string[]; P131?: string[]; P706?: string[]; P36?: string[]; P17?: string[]; dissolved?: boolean };
/** articles: "lang:title" → [lon, lat, GeoData type], or 0 when the article has no primary coordinates. */
export type RecoverData = { items: Record<string, ItemRec>; places: Record<string, PlaceRec>; articles: Record<string, [number, number, string?] | 0> };

/** Battles may take their siblings' middle; treaties their place of signing. */
export type Kind = 'battle' | 'treaty' | 'other';
/** `method` and `confidence` when the geolocation resolver placed it (attrs.geo_method, attrs.geo_confidence). */
export type Place = { lon: number; lat: number; geoPrec: GeoPrec; placedAt?: string; method?: Method; confidence?: number };
export type Dated = { t: number; prec: Prec; end?: { t: number; prec: Prec } | null; from?: string };

/** Name languages: English, the importers' SPARQL fallbacks, then other Latin scripts before the rest. */
const NAME_LANGS = ['en', 'en-gb', 'en-ca', 'en-us', 'mul', 'fr', 'de', 'es', 'it', 'pt', 'pl', 'ru', 'nl', 'ca', 'sv', 'da', 'nb', 'no', 'cs', 'sk', 'hu', 'ro', 'hr', 'sl', 'sh', 'bs', 'tr', 'fi', 'et', 'lv', 'lt', 'id', 'ms', 'vi', 'eu', 'gl', 'eo', 'la', 'uk', 'be', 'bg', 'sr', 'mk', 'el'];
/** Article languages tried for coordinates, as wiki.ts orders them; then the rest by code. */
const ARTICLE_LANGS = ['en', 'fr', 'de', 'es', 'it', 'pt', 'pl', 'ru'];

const ordered = (codes: string[], first: string[]) => [...first.filter(c => codes.includes(c)), ...codes.filter(c => !first.includes(c)).sort()];

/** An item's name from its labels, else its articles' titles, in NAME_LANGS order. */
export function pickName(labels: Record<string, string> = {}, sites: Record<string, string> = {}): string | null {
  for (const lang of ordered(Object.keys(labels), NAME_LANGS)) if (labels[lang]?.trim()) return labels[lang].trim();
  for (const lang of ordered(Object.keys(sites), NAME_LANGS)) if (sites[lang]?.trim()) return sites[lang].trim();
  return null;
}

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
function language(code: string) {
  if (code === 'simple') return 'Simple English';
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** GeoData types that stand for a whole town, region or country rather than a site. */
const ARTICLE_PREC: Record<string, GeoPrec> = {
  city: GeoPrec.city,
  country: GeoPrec.country,
  ...Object.fromEntries(['adm1st', 'adm2nd', 'adm3rd', 'region', 'isle', 'waterbody', 'mountain', 'river', 'glacier', 'forest'].map(t => [t, GeoPrec.area])),
};

const yearOf = (t: number) => new Date(t).getUTCFullYear();
const firstTime = (vs?: string[]) => vs?.map(wdTime).find(t => t) ?? null;

/** Earliest and latest dates as the smallest year, decade or century holding both; wider spans say too little. */
export function bounded(lo: string[] | undefined, hi: string[] | undefined): { t: number; prec: Prec } | null {
  const a = firstTime(lo);
  const b = firstTime(hi);
  if (!a || !b || b.t < a.t) return null;
  const [y0, y1] = [yearOf(a.t), yearOf(b.t)];
  for (const [span, prec] of [[1, Prec.year], [10, Prec.decade], [100, Prec.century]] as const) {
    if (Math.floor(y0 / span) === Math.floor(y1 / span)) return { t: utc(y0), prec };
  }
  return null;
}

const KM = 6371;
const rad = Math.PI / 180;
const distance = (a: LonLat, b: LonLat) => {
  const h = Math.sin(((b[1] - a[1]) * rad) / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(((b[0] - a[0]) * rad) / 2) ** 2;
  return 2 * KM * Math.asin(Math.sqrt(h));
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Sibling battles this close to their middle (four in five) stand for a place; a war spread wider has no one point. */
const TIGHT_KM = 300;
const WIDE_KM = 500;

/** The middle of the battles under each parent with at least three placed, and how far four in five lie from it. */
export function siblingMiddles(battles: Row[]): Map<string, { at: LonLat; spread: number }> {
  const points = new Map<string, LonLat[]>();
  for (const b of battles) {
    const p = wdPoint(b.coord) ?? wdPoint(b.locCoord);
    if (!p) continue;
    for (const war of b.wars?.split('|') ?? []) points.set(war, [...(points.get(war) ?? []), [p.lon, p.lat]]);
  }
  const out = new Map<string, { at: LonLat; spread: number }>();
  for (const [war, ps] of points) {
    if (ps.length < 3) continue;
    const at: LonLat = [median(ps.map(p => p[0])), median(ps.map(p => p[1]))];
    const d = ps.map(p => distance(at, p)).sort((a, b) => a - b);
    out.set(war, { at, spread: d[Math.floor(d.length * 0.8)] });
  }
  return out;
}

/** USSR, Russian Empire, Ottoman Empire, Austria-Hungary: their points lie far from most of what happened in them (the USSR's in Siberia). */
export const VAST = new Set(['Q15180', 'Q34266', 'Q12560', 'Q28513']);
/** The resolver's methods after a row's own data; Wikidata's place statements and the country are this file's. */
const RESOLVER_METHODS: Method[] = ['article', 'title-name', 'description-name', 'related'];
/**
 * A treaty's article coordinates often mark the body it set up (the whaling convention's at the IWC in Cambridge), and
 * the treaties of one process were signed in different places, so neither stands for where it was signed.
 */
const TREATY_METHODS: Method[] = ['title-name', 'description-name'];
/** A related events' middle or a place the description names is a rough guess, whatever the gazetteer kind (geolocation.md §3). */
const ROUGH = new Set<Method>(['related', 'description-name']);

const point = (c: LonLat | undefined) => (c && validLonLat(c[0], c[1]) ? { lon: c[0], lat: c[1] } : null);
const gives = (name: string | undefined, what = 'its place') => (name ? `point Wikidata gives for ${name}` : `point Wikidata gives for ${what}`);

export class Recovery {
  private readonly rows = new Map<string, Row>();
  private readonly countries = new Set<string>();
  private readonly middles: Map<string, { at: LonLat; spread: number }>;

  constructor(
    private readonly data: RecoverData,
    rows: Row[],
    battles: Row[],
    private readonly sitelinks: Record<string, Record<string, string>> = {},
    private readonly geo: { index: GeoIndex; wars: ReturnType<typeof warPointsOf> } | null = null,
  ) {
    for (const r of rows) if (!this.rows.has(r.item)) this.rows.set(r.item, r);
    for (const e of [...Object.values(data.items), ...Object.values(data.places)]) for (const c of e.P17 ?? []) this.countries.add(c);
    // Countries the events files name by id ("Qid point|…"), so their end dates count too.
    for (const r of rows) for (const e of r.countries?.split('|') ?? []) this.countries.add(e.split(' ')[0]);
    this.middles = siblingMiddles(battles);
  }

  /** A name in any language, or an article title, for a row with no label in English or the SPARQL fallbacks. */
  label(r: Row, rep?: Reporter): string | null {
    const fetched = this.data.items[r.item]?.name;
    const name = fetched ?? pickName({}, this.sitelinks[r.item]);
    if (name) rep?.sentinel(`recovered label: ${fetched ? 'any-language label' : 'article title'}`);
    return name;
  }

  private nameOf(q: string) {
    const r = this.rows.get(q);
    return r?.label ?? r?.otherLabel ?? this.data.items[q]?.name ?? this.data.places[q]?.name;
  }

  private parents(r: Row) {
    return [...new Set([...(r.wars?.split('|').filter(Boolean) ?? []), ...(this.data.items[r.item]?.parts ?? [])])].filter(q => q !== r.item);
  }

  /** A parent's start and end, from the raw files or the fetched items. */
  /** `ended` only for an explicit end: a parent's point in time ("dissolution of Gran Colombia", 21 Nov 1830) doesn't bound what was part of it. */
  private span(q: string): { lo: number; hi?: number; ended: boolean } | null {
    const r = this.rows.get(q);
    const rec = this.data.items[q];
    const s = r ? start(r) : (firstTime(rec?.P580) ?? firstTime(rec?.P585));
    if (!s) return null;
    const e = r ? wdTime(r.t1) : firstTime(rec?.P582);
    const point = r ? !r.t0 && !!r.t : !rec?.P580 && !!rec?.P585;
    const ended = !!e && e.t >= s.t;
    return { lo: s.t, hi: ended ? e.t : point ? s.t : undefined, ended };
  }

  /** A stated year must fall within one of the item's parent wars, a year either side, when any has known dates. */
  private fitsParents(r: Row, year: number) {
    const spans = this.parents(r).map(q => this.span(q)).filter(s => s !== null);
    return !spans.length || spans.some(s => year >= yearOf(s.lo) - 1 && (s.hi === undefined || year <= yearOf(s.hi) + 1));
  }

  /** A date for a row with none: fetched statements, then a year its description or label states, then a one-year war. */
  date(r: Row, kind: Kind, rep?: Reporter, label?: string | null): Dated | null {
    const got = this.findDate(r, kind, label, rep);
    if (got) rep?.sentinel(`recovered date: ${got.how}`);
    return got;
  }

  private findDate(r: Row, kind: Kind, label?: string | null, rep?: Reporter): (Dated & { how: string }) | null {
    const rec = this.data.items[r.item];
    if (rec) {
      const at = firstTime(rec.P585);
      const from = firstTime(rec.P580);
      const s = at && from ? (from.prec >= at.prec ? from : at) : (at ?? from);
      const end = firstTime(rec.P582);
      if (s) return { ...s, end, how: 'point in time or start (fetched)' };
      const inception = firstTime(rec.P571);
      if (inception) return { ...inception, end, how: 'inception' };
      const range = bounded(rec.P1319, rec.P1326);
      if (range) return { ...range, from: 'earliest and latest dates on Wikidata', how: 'earliest and latest dates' };
    }
    for (const [text, as, from] of [[r.desc, 'description', 'year in its Wikidata description'], [label ?? r.label ?? r.otherLabel, 'label', 'year in its name']] as const) {
      const y = textYear(text ?? undefined, as, kind === 'battle');
      if (!y) continue;
      if (!this.fitsParents(r, y.from)) {
        rep?.sentinel(`${as} year outside its war, not used`);
        continue;
      }
      return { t: utc(y.from), prec: y.prec, end: y.to === undefined ? null : { t: utc(y.to), prec: Prec.year }, from, how: `${as} year` };
    }
    if (kind !== 'battle') return null;
    for (const q of this.parents(r)) {
      const s = this.span(q);
      if (!s?.ended || yearOf(s.lo) !== yearOf(s.hi!)) continue;
      const name = this.nameOf(q);
      return { t: utc(yearOf(s.lo)), prec: Prec.year, from: name ? `year of ${name}` : 'year of its war', how: 'year of a one-year war' };
    }
    return null;
  }

  /** A country that has ended, or a vast one, says nothing about where in it something happened. */
  usable(q: string) {
    return !VAST.has(q) && !(this.countries.has(q) && this.data.places[q]?.dissolved);
  }

  /**
   * The first of a list of places with coordinates, else (up to `depth` steps) the capital of a place without, else
   * what it lies in or on: Niš sanjak has no point, its capital Niš does, and the Danube Vilayet's is 250 km off.
   */
  private resolve(ids: string[] | undefined, depth: number): { lon: number; lat: number; id: string; hops: number; capitalOf?: string } | null {
    const seen = new Set<string>();
    let frontier = (ids ?? []).map(q => ({ q, capitalOf: undefined as string | undefined }));
    for (let hops = 0; hops <= depth && frontier.length; hops++) {
      frontier.forEach(f => seen.add(f.q));
      frontier = frontier.filter(f => this.usable(f.q));
      for (const f of frontier) {
        const p = point(this.data.places[f.q]?.coord);
        if (p) return { ...p, id: f.q, hops, capitalOf: f.capitalOf };
      }
      const next = (q: string) => {
        const p = this.data.places[q];
        return [...(p?.P36 ?? []).map(c => ({ q: c, capitalOf: q })), ...[...(p?.P276 ?? []), ...(p?.P131 ?? []), ...(p?.P706 ?? [])].map(c => ({ q: c, capitalOf: undefined }))];
      };
      frontier = frontier.flatMap(f => next(f.q)).filter((f, i, fs) => !seen.has(f.q) && fs.findIndex(g => g.q === f.q) === i);
    }
    return null;
  }

  private article(r: Row, rec: ItemRec | undefined): (Place & { how: string }) | null {
    const sites = { ...(rec?.sites ?? this.sitelinks[r.item] ?? {}) };
    const en = enwikiTitle(r.article);
    if (en && !sites.en) sites.en = en;
    for (const lang of ordered(Object.keys(sites), ARTICLE_LANGS)) {
      const hit = this.data.articles[`${lang}:${sites[lang]}`];
      if (!hit || !validLonLat(hit[0], hit[1])) continue;
      const geoPrec = (hit[2] && ARTICLE_PREC[hit[2]]) || GeoPrec.exact;
      return { lon: hit[0], lat: hit[1], geoPrec, placedAt: `point its ${language(lang)} Wikipedia article gives`, how: 'Wikipedia article coordinates' };
    }
    return null;
  }

  /**
   * A place for a row with none, from the closest thing anything sourced says, each labelled: its own fetched point,
   * the offline resolver, then the fetched statements and articles. `sampled` is the row's own country placement,
   * used only when the item wasn't fetched or to pick among several countries; `year` the start, for the resolver's
   * era checks; `dropped` that the row named only dissolved or vast countries.
   */
  place(r: Row, kind: Kind, rep?: Reporter, sampled?: Place | null, year?: number, dropped = false): Place | null {
    const got = this.findPlace(r, kind, sampled, year, dropped, what => rep?.sentinel(what));
    if (got) rep?.sentinel(`recovered place: ${got.how}`);
    return got;
  }

  private geolocate(r: Row, kind: Kind, rec: ItemRec | undefined, sampled: Place | null | undefined, year: number | undefined): (Place & { how: string }) | null {
    if (!this.geo) return null;
    const ev = rowEvidence(r, this.sitelinks, this.geo.wars, true);
    if (year !== undefined) ev.year = year;
    // A dissolved or vast country's point would pull an ambiguous name toward it.
    const countries = rec?.P17 ?? [];
    if (countries.length && !countries.some(q => this.usable(q))) ev.countryPoint = null;
    else if (!ev.countryPoint && sampled?.geoPrec === GeoPrec.country && !sampled.placedAt) ev.countryPoint = { lon: sampled.lon, lat: sampled.lat };
    const hit = resolveEvent(this.geo.index, ev, { methods: kind === 'treaty' ? TREATY_METHODS : RESOLVER_METHODS });
    if (!hit) return null;
    const geoPrec = ROUGH.has(hit.method) ? (Math.max(hit.geoPrec, GeoPrec.approximate) as GeoPrec) : hit.geoPrec;
    return { lon: hit.lon, lat: hit.lat, geoPrec, placedAt: hit.placedAt, method: hit.method, confidence: hit.confidence, how: `resolver ${hit.method}` };
  }

  private findPlace(r: Row, kind: Kind, sampled: Place | null | undefined, year: number | undefined, dropped: boolean, note: (what: string) => void): (Place & { how: string }) | null {
    const rec = this.data.items[r.item];
    const own = point(rec?.coord);
    if (own) return { ...own, geoPrec: GeoPrec.exact, how: 'own coordinates (fetched)' };
    const resolved = this.geolocate(r, kind, rec, sampled, year);
    if (resolved) return resolved;
    const scale = (id: string) => (this.countries.has(id) ? GeoPrec.country : GeoPrec.area);
    const loc = this.resolve(rec?.P276, 0);
    if (loc) return { lon: loc.lon, lat: loc.lat, geoPrec: scale(loc.id), how: 'location (fetched)' };
    const art = kind === 'treaty' ? null : this.article(r, rec);
    if (art) return art;
    const chains: [ids: string[] | undefined, how: string, prec?: GeoPrec][] = [
      ...(kind === 'treaty' ? [[rec?.P1071, 'place of signing', GeoPrec.city] as [string[] | undefined, string, GeoPrec]] : []),
      [rec?.P276, 'location, through what it lies in'],
      [rec?.P131, 'administrative area'],
      [rec?.P706, 'physical feature'],
    ];
    for (const [ids, how, prec] of chains) {
      const hit = this.resolve(ids, 3);
      if (!hit) continue;
      // Past the place Wikidata names, the point stands for something larger than the event, so it is drawn hollow.
      const geoPrec = this.countries.has(hit.id) ? GeoPrec.country : hit.hops > 0 ? GeoPrec.approximate : (prec ?? GeoPrec.area);
      const capitalOf = hit.capitalOf && this.data.places[hit.capitalOf]?.name;
      return { lon: hit.lon, lat: hit.lat, geoPrec, placedAt: capitalOf ? `capital of ${capitalOf}` : gives(this.data.places[hit.id]?.name), how };
    }
    if (kind === 'battle') {
      const near = this.parents(r).map(q => ({ q, m: this.middles.get(q) })).filter(x => x.m && x.m.spread <= TIGHT_KM).sort((a, b) => a.m!.spread - b.m!.spread)[0];
      if (near) {
        const name = this.nameOf(near.q);
        return { lon: near.m!.at[0], lat: near.m!.at[1], geoPrec: GeoPrec.approximate, placedAt: name ? `middle of the other battles of ${name}` : 'middle of the other battles of its war', how: 'middle of sibling battles' };
      }
      // Only a parent's own point (a campaign's, an operation's), not its location item: a war's is a whole region.
      for (const q of this.parents(r)) {
        if ((this.middles.get(q)?.spread ?? 0) > WIDE_KM) continue;
        const row = this.rows.get(q);
        const p = row ? wdPoint(row.coord) : point(this.data.items[q]?.coord);
        if (p) return { lon: p.lon, lat: p.lat, geoPrec: GeoPrec.approximate, placedAt: gives(this.nameOf(q), 'its war'), how: "its war's point" };
      }
    }
    const unplaced = 'place: only a dissolved or vast country, left unplaced';
    if (!rec) {
      if (sampled) return { ...sampled, how: 'its own country (not fetched)' };
      if (dropped) note(unplaced);
      return null;
    }
    const named = [...new Set(rec.P17 ?? [])];
    const countries = named.filter(q => this.usable(q));
    if (named.length && !countries.length) note(unplaced);
    // Picking one of several countries only stands in for the one the source row itself already carried.
    if (countries.length > 1 && !sampled) {
      note('place: several countries and nothing closer, left unplaced');
      return null;
    }
    for (const q of countries) {
      const country = this.data.places[q];
      const several = countries.length > 1 && country?.name ? `, one of the countries it names` : '';
      const c = point(country?.coord);
      if (c) return { ...c, geoPrec: GeoPrec.country, ...(several && { placedAt: `${gives(country?.name)}${several}` }), how: several ? 'one of its countries' : 'country' };
      const capital = this.resolve(country?.P36, 0);
      if (capital) return { lon: capital.lon, lat: capital.lat, geoPrec: GeoPrec.country, placedAt: country?.name ? `capital of ${country.name}` : 'capital of its country', how: "country's capital" };
    }
    return null;
  }
}

/** Recovery over recover.json when fetched and the geolocation index when built, and the raw files and sitelinks either way. */
export function loadRecovery(): Recovery {
  const data = existsSync(RECOVER) ? read<RecoverData>(RECOVER) : { items: {}, places: {}, articles: {} };
  const byFile = RAW_NAMES.filter(f => existsSync(join(DIR, `${f}.json`))).map(f => [f, read<Row[]>(join(DIR, `${f}.json`))] as const);
  const battles = byFile.find(([f]) => f === 'battles')?.[1] ?? [];
  const sitelinks = { ...(existsSync(EVENTS_SITELINKS) ? read<Record<string, Record<string, string>>>(EVENTS_SITELINKS) : {}), ...readSitelinks() };
  const index = openGeoIndex();
  return new Recovery(data, byFile.flatMap(([, rows]) => rows), battles, sitelinks, index && { index, wars: warPointsOf(byFile) });
}
