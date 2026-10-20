import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Prec } from '@takip/core/time';
import { GeoPrec } from '@takip/db';
import { type Ctx, importDataset, type Reporter, sourceId } from '../context';
import { utc } from '../dates';
import { EventBatch } from '../events';
import {
  AIR_CLASSES, CONTINENT_TYPES, COUNTRY_TYPES, CROWD_CLASSES, EPIDEMIC_CLASSES, EXPLOSION_CLASSES, FAMINE_CLASSES, INDUSTRIAL_CLASSES,
  MINING_CLASSES, MURDER_CLASSES, PROTEST_CLASSES, RAIL_CLASSES, RIOT_CLASSES, ROAD_CLASSES, SHOOTING_CLASSES, STRIKE_CLASSES, UPRISING_CLASSES,
  WILDFIRE_CLASSES,
} from '../fetch-events';
import { enwikiTitle, otherArticle } from '../wiki';
import { middle } from './gdis';
import { classes, DIR, read, start, url, wdPoint, wdTime, type Row } from './wikidata';
import { deathToll, massMurderReject } from './wikidata-conflict';
import { type Dated, loadRecovery, type Place as WikidataPlace, type Recovery, recoverFiles, VAST } from './wikidata-recover';
import { textYear } from './wikidata-years';

/* History beyond war from Wikidata (CC0), fetch.ts `events`: disasters, unrest, accidents, military operations, crimes. */

const AS_OF = '2026-10-20';
const SITELINKS = join(DIR, 'events-sitelinks.json');
const file = (name: string) => join(DIR, `${name}.json`);
/** Files the older Wikidata sources import from; an item they hold stays theirs. */
const HELD = ['battles', 'politics', 'attacks', 'wars', 'revolutions', 'massacres', 'displacements'];

/** Classes other sources own, by why: an item with any of them is left to that source. */
const OWNED: [reason: string, classes: string[]][] = [
  ['a massacre, pogrom, expulsion or persecution (wikidata-massacres, -displacements)', [
    'Q177716', 'Q3199915', 'Q5533440', 'Q124612203', 'Q41397', 'Q154278', 'Q379693', 'Q285701', 'Q837556', 'Q15589476', 'Q56514238',
    'Q851824', 'Q48136', 'Q61927259', 'Q112651297', 'Q878794', 'Q188494', 'Q494497',
  ]],
  // All under terrorist attack, so wikidata-attacks has them outside GTD's years; suicide attacks and hijackings aren't, and stay.
  ['an attack or bombing (GTD, wikidata-attacks)', ['Q2223653', 'Q891854', 'Q18493502', 'Q20893947', 'Q25917154', 'Q61037469', 'Q19354904', 'Q18711682', 'Q897797', 'Q28934204']],
  ['a nuclear test (sipri-nuclear)', ['Q210112', 'Q3058675', 'Q98607365', 'Q4367188', 'Q2656967', 'Q3780403', 'Q98391050']],
  // Drought is left out: a famine typed drought too is still the famine, which neither GDIS nor NOAA holds.
  ['a natural hazard (noaa-hazards, gdis)', ['Q7944', 'Q8070', 'Q7692360', 'Q8068', 'Q8092', 'Q81054', 'Q167903', 'Q215864']],
];

export function ownedElsewhere(cls: Set<string>): string | null {
  return OWNED.find(([, cs]) => cs.some(c => cls.has(c)))?.[0] ?? null;
}

const has = (cls: Set<string>, list: string[]) => list.some(c => cls.has(c));
const CITY_FIRE = ['Q838718', 'Q3149858'];

export function disasterKind(cls: Set<string>): string {
  if (has(cls, FAMINE_CLASSES)) return 'disaster.famine';
  if (has(cls, EPIDEMIC_CLASSES)) return 'disaster.epidemic';
  if (!has(cls, CITY_FIRE) && has(cls, WILDFIRE_CLASSES)) return 'disaster.wildfire';
  return 'disaster.fire';
}

/** By class in this order of precedence, unless the English title names one of the others. */
const UNREST: [kind: string, classes: string[], title: RegExp][] = [
  ['politics.riot', RIOT_CLASSES, /\briots?\b|\bunrest\b|\bdisturbances?\b/i],
  ['politics.strike', STRIKE_CLASSES, /\bstrikes?\b|\blockout\b/i],
  ['conflict.rebellion', UPRISING_CLASSES, /\brevolts?\b|\buprisings?\b|\brebellion\b|\brising\b|\binsurrection\b|\bikki\b/i],
  ['politics.protest', PROTEST_CLASSES, /\bprotests?\b|\bdemonstrations?\b|\bmarch\b|\brally\b|\bsit-in\b|\boccupation\b/i],
];

export function unrestKind(cls: Set<string>, title = ''): string {
  const hits = UNREST.filter(([, cs]) => has(cls, cs));
  return ((hits.length > 1 && hits.find(([, , re]) => re.test(title))) || hits[0])?.[0] ?? 'politics.protest';
}

const ACCIDENTS: [kind: string, classes: string[]][] = [
  ['accident.aviation', AIR_CLASSES],
  ['accident.rail', RAIL_CLASSES],
  ['accident.road', ROAD_CLASSES],
  ['accident.mining', MINING_CLASSES],
  ['accident.crowd', CROWD_CLASSES],
  ['accident.industrial', INDUSTRIAL_CLASSES],
  ['accident.explosion', EXPLOSION_CLASSES],
];

export const accidentKind = (cls: Set<string>) => ACCIDENTS.find(([, cs]) => has(cls, cs))?.[0] ?? 'accident.explosion';
export const crimeKind = (cls: Set<string>) => (has(cls, SHOOTING_CLASSES) ? 'crime.shooting' : 'crime.murder');

type Point = { lon: number; lat: number };
type Place = WikidataPlace;
type Entry = { id: string; type: string; point: Point };

/** "Qid point" or "Qid type point" entries, "|"-joined, one per item (the first statement's). */
function entries(v: string | undefined, typed: boolean): Entry[] {
  const seen = new Map<string, Entry>();
  for (const s of v?.split('|') ?? []) {
    const [id, ...rest] = s.split(' ');
    const type = typed ? rest.shift()! : '-';
    const point = wdPoint(rest.join(' '));
    if (!point) continue;
    const prev = seen.get(id);
    if (!prev || (prev.type === '-' && type !== '-')) seen.set(id, { id, type, point });
  }
  return [...seen.values()];
}

const km = (a: Point, b: Point) => {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** One place as is; several at their middle, approximate once they sprawl past 1,000 km. */
function spread(ps: Entry[], geoPrec: GeoPrec, what: string): Place {
  if (ps.length === 1) return { ...ps[0].point, geoPrec };
  const [lon, lat] = middle(ps.map(p => [p.point.lon, p.point.lat]));
  const far = Math.max(...ps.map(p => km({ lon, lat }, p.point))) > 1000;
  return { lon, lat, geoPrec: far ? GeoPrec.approximate : geoPrec, placedAt: `middle of the ${ps.length} ${what} Wikidata lists` };
}

/** Countries whose point says something: not the USSR's in Siberia or a dissolved state's (wikidata-recover.ts). */
type Usable = (country: string) => boolean;
const notVast: Usable = q => !VAST.has(q);

/**
 * Its own point, else its locations', else its administrative areas', else its countries'. A location that is a
 * country counts as a country, and a continent as approximate, so neither passes for an area. Without `country`,
 * the caller tries the resolver and the recovery before eventCountry.
 */
export function eventPlace(r: Row, usable: Usable = notVast, country = true): Place | null {
  const own = wdPoint(r.coord);
  if (own) return { ...own, geoPrec: GeoPrec.exact };
  const locs = entries(r.locs, true);
  const places = locs.filter(l => l.type === '-');
  if (places.length) return spread(places, GeoPrec.area, 'places');
  const admins = entries(r.admins, false);
  if (admins.length) return spread(admins, GeoPrec.area, 'areas');
  return country ? eventCountry(r, usable) : null;
}

/** Its countries' point, else its continents'. */
export function eventCountry(r: Row, usable: Usable = notVast): Place | null {
  const locs = entries(r.locs, true);
  const countries = [...locs.filter(l => COUNTRY_TYPES.includes(l.type)), ...entries(r.countries, false)].filter((c, i, cs) => cs.findIndex(x => x.id === c.id) === i && usable(c.id));
  if (countries.length) return countries.length === 1 ? { ...countries[0].point, geoPrec: GeoPrec.country } : spread(countries, GeoPrec.country, 'countries');
  const continents = locs.filter(l => CONTINENT_TYPES.includes(l.type));
  if (!continents.length) return null;
  const at = spread(continents, GeoPrec.approximate, 'continents');
  return { ...at, geoPrec: GeoPrec.approximate, placedAt: at.placedAt ?? 'middle of the continent Wikidata lists' };
}

/** A region's or town's own page of the COVID-19 pandemic; OWID's series has it by country, and Wikidata holds thousands. */
export const localCovid = (r: Row, title: string) => r.item !== 'Q81068910' && (/COVID-19|SARS-CoV-2/i.test(title) || /COVID-19|SARS-CoV-2/i.test(r.cause ?? ''));

/** For an item with no date statement: the year its description or name gives, said in attrs.date_from as wikidata-recover says it. */
export function textDate(r: Row, title: string) {
  for (const [text, as, from] of [[r.desc, 'description', 'year in its Wikidata description'], [title, 'label', 'year in its name']] as const) {
    const y = textYear(text, as);
    if (y) return { t: utc(y.from), prec: y.prec, end: y.to === undefined ? null : { t: utc(y.to), prec: Prec.year }, from };
  }
  return null;
}

const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const yearOf = (t: number) => new Date(t).getUTCFullYear();
export const titleYear = (title: string, t: number) => `${norm(title)}|${yearOf(t)}`;

/** Items the older Wikidata sources import. Mass murders wikidata-massacres turns away as private crimes stay here. */
function heldItems() {
  const held = new Set<string>();
  for (const name of HELD) {
    if (!existsSync(file(name))) continue;
    for (const r of read<Row[]>(file(name))) if (name !== 'massacres' || !massMurderReject(r)) held.add(r.item);
  }
  return held;
}

/** Battles' and wars' titles with their start year, for operations Wikidata keeps as a second item. */
function battleTitles() {
  const out = new Set<string>();
  for (const name of ['battles', 'wars']) {
    if (!existsSync(file(name))) continue;
    for (const r of read<Row[]>(file(name))) {
      const title = r.label ?? r.otherLabel;
      const at = start(r);
      if (title && at) out.add(titleYear(title, at.t));
    }
  }
  return out;
}

/** GTD's years; an accident or crime GTD records that day within 25 km is GTD's. */
const GTD_YEARS = [1970, 2017];
const DAY_MS = 86_400_000;

/**
 * What a GTD record within 25 km must name to be the same accident, unless it is within 2 km: a plane crash and a
 * bombing across Manila that day are two events. Any attack that day and place is the same crime.
 */
export const GTD_WORDS: Record<string, RegExp> = {
  'accident.aviation': /flight|plane|aircraft|airliner|airline|helicopter|\bjet\b|airport|hijack/i,
  'accident.rail': /train|rail|metro|subway|\btram|express|locomotive/i,
  'accident.road': /\bbus\b|\bcar\b|vehicle|truck|lorry|\broad\b/i,
  'accident.mining': /\bmines?\b|miners?\b|colliery|\bcoal\b/i,
  'accident.explosion': /explo|blast|bomb/i,
  'accident.crowd': /stampede|crowd|crush/i,
  'accident.industrial': /plant|factory|station|refinery|explo|chemical|\bdam\b/i,
};

type Gtd = Point & { text: string };
export type GtdNear = (t: number, p: Point, kind: string) => boolean;

export function gtdMatcher(rows: (Gtd & { t: number })[]): GtdNear {
  const days = new Map<number, Gtd[]>();
  for (const r of rows) {
    const day = Math.floor(r.t / DAY_MS);
    days.set(day, [...(days.get(day) ?? []), r]);
  }
  return (t, p, kind) =>
    (days.get(Math.floor(t / DAY_MS)) ?? []).some(g => {
      const d = km(g, p);
      return d <= 2 || (d <= 25 && (!GTD_WORDS[kind] || GTD_WORDS[kind].test(g.text)));
    });
}

function gtdNear(ctx: Ctx): GtdNear {
  const rows = ctx.history.prepare(`SELECT t_start AS t, lon, lat, coalesce(title, '') || ' ' || coalesce(json_extract(attrs, '$.summary'), '') AS text
    FROM ev_event WHERE source_id = ? AND t_start_prec = ? AND lon IS NOT NULL AND retracted_at IS NULL`).all(sourceId(ctx, 'gtd'), Prec.day) as (Gtd & { t: number })[];
  return gtdMatcher(rows);
}

type Spec = {
  source: string;
  name: string;
  kindOf: (cls: Set<string>, title: string) => string;
  /** Files before this one in fetch-events' EVENT_FILES, whose items this source leaves to theirs. */
  after: string[];
  /** Deaths as magnitude; the disaster family's magnitude counts the places GDIS says a disaster hit, so there they go in attrs. */
  deathsAsMagnitude: boolean;
  gtd?: boolean;
  battles?: boolean;
  /** Items with no Wikipedia article in any language are left out: mostly one photographer's or one bot's stubs. */
  needsArticle?: (kind: string) => boolean;
  /** Items this source leaves to a later one, which then doesn't count them as held. */
  yields?: (cls: Set<string>) => string | null;
};

const centuryOf = (t: number) => {
  const y = yearOf(t);
  return y > 0 ? `${Math.floor((y - 1) / 100) + 1}` : `${Math.floor(-y / 100) + 1} BCE`;
};
const PREC_NAME: Record<number, string> = { 1: 'exact', 2: 'city', 3: 'area', 4: 'approximate', 5: 'country' };
const tally = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);

/** Rows to events; exported for the test. */
export function addEvents(batch: EventBatch, rep: Reporter, rows: Row[], spec: Spec, ctx: { taken: Set<string>; titles?: Set<string>; gtd?: GtdNear; sitelinks: Record<string, Record<string, string>>; now: number; recovery?: Recovery }) {
  const recovery = ctx.recovery;
  const usable: Usable = recovery ? q => recovery.usable(q) : notVast;
  const by = { kind: {} as Record<string, number>, place: {} as Record<string, number>, century: {} as Record<string, number> };
  for (const r of rows) {
    rep.rows++;
    if (ctx.taken.has(r.item)) {
      rep.reject('held by another Wikidata source', r.item);
      continue;
    }
    const cls = classes(r);
    const owned = ownedElsewhere(cls);
    if (owned) {
      rep.reject(owned, r.item);
      continue;
    }
    const title = r.label ?? r.otherLabel ?? recovery?.label(r, rep);
    if (!title) {
      rep.reject('no label', r.item);
      continue;
    }
    const yielded = spec.yields?.(cls);
    if (yielded) {
      rep.reject(yielded, r.item);
      continue;
    }
    const kind = spec.kindOf(cls, title);
    if (spec.needsArticle?.(kind) && !(Number(r.wikis) > 0)) {
      rep.reject('no Wikipedia article in any language', `${r.item} ${title}`);
      continue;
    }
    if (kind === 'disaster.epidemic' && localCovid(r, title)) {
      rep.reject("a place's page of the COVID-19 pandemic (owid-covid)", `${r.item} ${title}`);
      continue;
    }
    const stated = start(r, r.inception);
    const worded: Dated | null = stated ? null : recovery ? recovery.date(r, 'other', rep, title) : textDate(r, title);
    const at = stated ?? worded;
    if (!at) {
      rep.reject('no date', r.item);
      continue;
    }
    if (at.t > ctx.now) {
      rep.reject('starts in the future', `${r.item} ${title}`);
      continue;
    }
    const country = eventCountry(r, usable);
    const place = eventPlace(r, usable, !recovery) ?? recovery?.place(r, 'other', rep, country, yearOf(at.t), !country && !!eventCountry(r, () => true));
    if (!place) {
      rep.reject('no place', r.item);
      continue;
    }
    if (ctx.titles?.has(titleYear(title, at.t))) {
      rep.reject('same title and year as a Wikidata battle or war', `${r.item} ${title}`);
      continue;
    }
    const year = yearOf(at.t);
    if (ctx.gtd && at.prec >= Prec.day && year >= GTD_YEARS[0] && year <= GTD_YEARS[1] && place.geoPrec <= GeoPrec.area && ctx.gtd(at.t, place, kind)) {
      rep.reject('GTD has it (an attack that day within 25 km)', `${r.item} ${title}`);
      continue;
    }
    if (worded && !recovery) rep.sentinel(`date from the ${worded.from}`);
    const end = wdTime(r.t1) ?? worded?.end ?? null;
    const toll = deathToll(r.deaths);
    const count = (v: string | undefined) => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : undefined);
    batch.add({
      kind,
      sourceRecordId: r.item,
      title,
      tStart: at.t,
      tStartPrec: at.prec,
      tEnd: end && end.t >= at.t ? end.t : null,
      tEndPrec: end && end.t >= at.t ? end.prec : null,
      lon: place.lon,
      lat: place.lat,
      geoPrec: place.geoPrec,
      magnitude: spec.deathsAsMagnitude ? (toll?.deaths ?? null) : null,
      attrs: {
        description: r.desc ?? null,
        ...(!spec.deathsAsMagnitude && toll && { deaths: toll.deaths, ...(toll.range && { deaths_range: toll.range }) }),
        injured: count(r.injured),
        participants: count(r.participants),
        cause: r.cause ? r.cause.split('|').slice(0, 3).join(', ') : undefined,
        ...(place.placedAt && { placed_at: place.placedAt }),
        ...(worded?.from && { date_from: worded.from }),
        ...(place.method && { geo_method: place.method, geo_confidence: place.confidence }),
        ...(spec.deathsAsMagnitude && toll?.range && { magnitude_range: toll.range }),
        ids: { wikidata: r.item },
        url: url(r),
        wiki: enwikiTitle(r.article) ?? otherArticle(ctx.sitelinks[r.item]),
      },
    });
    tally(by.kind, kind);
    tally(by.place, PREC_NAME[place.geoPrec]);
    tally(by.century, centuryOf(at.t));
  }
  rep.extra.by = by;
}

function importer(spec: Spec) {
  return async (ctx: Ctx) => {
    const path = file(spec.name);
    await importDataset(ctx, { source: spec.source, version: AS_OF, asOf: AS_OF, files: [path, ...(existsSync(SITELINKS) ? [SITELINKS] : []), ...recoverFiles()], importerVersion: '2' }, async ds => {
      const batch = new EventBatch(ctx, ds);
      const taken = heldItems();
      for (const name of spec.after) {
        const prior = SPECS.find(s => s.name === name);
        if (existsSync(file(name))) for (const r of read<Row[]>(file(name))) if (!prior?.yields?.(classes(r))) taken.add(r.item);
      }
      addEvents(batch, ds.report, read<Row[]>(path), spec, {
        taken,
        titles: spec.battles ? battleTitles() : undefined,
        gtd: spec.gtd ? gtdNear(ctx) : undefined,
        sitelinks: existsSync(SITELINKS) ? read<Record<string, Record<string, string>>>(SITELINKS) : {},
        now: Date.now(),
        recovery: loadRecovery(),
      });
      return batch.finish();
    });
  };
}

/**
 * Without an article: Berlin's per-day demonstration items, and murders that are mostly one project's records of
 * private people (about 800 deaths in California police encounters), Weimar's political murders and France's unsolved ones.
 */
const NEEDS_ARTICLE = new Set(['politics.protest', 'crime.murder']);
const needsArticle = (kind: string) => NEEDS_ARTICLE.has(kind);
const CRIMES = [...MURDER_CLASSES, ...SHOOTING_CLASSES];
/** A road death or explosion Wikidata also calls a homicide is a crime; most are police encounters. */
const homicide = (cls: Set<string>) =>
  ['accident.road', 'accident.explosion'].includes(accidentKind(cls)) && has(cls, CRIMES) ? 'a homicide too (wikidata-crimes)' : null;

export const SPECS: Spec[] = [
  { source: 'wikidata-disasters', name: 'disasters', kindOf: disasterKind, after: [], deathsAsMagnitude: false },
  { source: 'wikidata-unrest', name: 'unrest', kindOf: unrestKind, after: ['disasters'], deathsAsMagnitude: true, needsArticle },
  { source: 'wikidata-accidents', name: 'accidents', kindOf: accidentKind, after: ['disasters', 'unrest'], deathsAsMagnitude: false, gtd: true, yields: homicide },
  { source: 'wikidata-operations', name: 'operations', kindOf: () => 'battle.operation', after: ['disasters', 'unrest', 'accidents'], deathsAsMagnitude: true, battles: true },
  { source: 'wikidata-crimes', name: 'crimes', kindOf: crimeKind, after: ['disasters', 'unrest', 'accidents', 'operations'], deathsAsMagnitude: true, gtd: true, needsArticle },
];

/** Famines, epidemics, great fires and wildfires. */
export const importWikidataDisasters = importer(SPECS[0]);
/** Riots, protests, strikes, and revolts outside the rebellion classes. */
export const importWikidataUnrest = importer(SPECS[1]);
/** Air, rail, road, mining, crowd, industrial accidents and explosions. */
export const importWikidataAccidents = importer(SPECS[2]);
/** Military operations, offensives, invasions, raids and air strikes that aren't a battle or war already. */
export const importWikidataOperations = importer(SPECS[3]);
/** Shootings and murders that aren't GTD's attacks, assassinations or massacres. */
export const importWikidataCrimes = importer(SPECS[4]);
