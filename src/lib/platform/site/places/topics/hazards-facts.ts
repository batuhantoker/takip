import type { Translate } from '@/lib/core/i18n/translator';
import type { HazardEvent, HazardMeta, HazardRange, HazardRangeId, HazardRow, HazardWave } from './hazards-data';

/** A hazards page is indexed when its range holds at least this many distinct recorded events. */
export const MIN_EVENTS = 5;
/** How far from the strongest quake its aftershocks are counted (tools/site/topics/hazards.ts PEAK_KM). */
const AFTERSHOCK_KM = 150;

/**
 * Distinct events a range records, counting each once across the two sources: USGS quakes at the range's floor,
 * NOAA's significant quakes that USGS doesn't list at that floor, NOAA's eruptions, and NOAA's tsunamis that no
 * quake or eruption counted here caused.
 */
export const hazardEventCount = (r: HazardRange) => r.usgs + r.quakesUnmatched + r.eruptions + r.tsunamisUnlinked;

/** Whether the page earns a place in search: below MIN_EVENTS it still renders, with noindex, and stays out of the sitemap. */
export const hazardIndexed = (r: HazardRange) => hazardEventCount(r) >= MIN_EVENTS;

/** An event on a page, with what its tsunami's runups record in this place. */
export type HazardEventFact = HazardEvent & { id: string; here?: Omit<HazardWave, 'id'> };

const NCEI_KIND = { q: 'earthquake', t: 'tsunami', v: 'volcano' } as const;

/** The event's pages at its sources: USGS's for a quake it lists, NCEI's for one on NOAA's lists. */
export function hazardLinks(e: HazardEventFact): { usgs?: string; noaa?: string } {
  return {
    ...(!e.id.includes(':') ? { usgs: `https://earthquake.usgs.gov/earthquakes/eventpage/${e.id}` } : {}),
    ...(e.n !== undefined ? { noaa: `https://www.ngdc.noaa.gov/hazel/view/hazards/${NCEI_KIND[e.k]}/event-more-info/${e.n}` } : {}),
  };
}

/**
 * What the quake record looks like, so the page says the thing that matters there: one great quake far above the rest,
 * several of magnitude 7, a run of moderate ones with nothing large, or a handful.
 */
export type QuakeShape = 'none' | 'few' | 'one-great' | 'many-strong' | 'moderate' | 'mixed';

/** How a page names its area: within a city's reach, in a landlocked country, or in a country and off its coast. */
export type HazardScope = 'city' | 'inland' | 'country';

export interface HazardFacts {
  range: HazardRangeId;
  scope: HazardScope;
  from: number;
  to: number;
  asOf: string;
  /** The USGS magnitude floor, and the first year USGS is counted. */
  floor: number;
  usgsFrom: number;
  /** A city's reach, and the further one for its great quakes. */
  km: number;
  bigKm: number;
  bigMag: number;
  events: number;
  index: boolean;
  usgs: number;
  m7: number;
  quakes: number;
  /** Distinct quakes across the two lists. */
  quakeEvents: number;
  shape: QuakeShape;
  /** Below this the record is "moderate": magnitude 6 over ten years of M4.5+, 7 over M6+. */
  cap: number;
  strongest?: HazardEventFact;
  /** When quakes share the top magnitude: how many, and those named (both of two, the latest of more). */
  tie?: { n: number; named: HazardEventFact[] };
  /** The next strongest, when the strongest stands far above it. */
  runnerUp?: HazardEventFact;
  deadliest?: HazardEventFact;
  deaths: number;
  deadly: number;
  /** NOAA's most recent significant quake, when it isn't already the strongest or the deadliest. */
  latest?: HazardEventFact;
  /** The busiest year (10y) or ten years (100y), when it holds a good share of the count. */
  peak?: { label: string; n: number; share: number; main?: HazardEventFact; after: number };
  /** The two five-year halves of a ten-year range, when one holds at least twice the other. */
  halves?: { early: number; late: number; split: number };
  /**
   * The whole record: its oldest event, and how many of NOAA's quakes are from the last hundred years; `thin` when
   * those years hold them at three times the yearly rate of all the years before.
   */
  oldest?: HazardEventFact;
  recent?: { quakes: number; since: number; thin: boolean };
  tsunamis: number;
  /** Of them, those that began elsewhere and reached here. */
  tsunamisFrom: number;
  /**
   * The highest water: what the runups here record, or, for a tsunami that began here with none, the event's own.
   * Deaths only from runups here: NOAA's event tolls include their source quake's.
   */
  tallest?: { e: HazardEventFact; h: number; here: boolean };
  waveDeadliest?: { e: HazardEventFact; deaths: number; away: boolean };
  eruptions: number;
  volcanoes: number;
  largestEruption?: HazardEventFact;
  eruptionDeadliest?: HazardEventFact;
  /** The page's events, newest first. */
  list: HazardEventFact[];
}

const yearOfDate = (d: string) => Number(/^-?\d+/.exec(d)?.[0]);
/** Strongest first; on a tie, a measured magnitude before an estimate. */
const byMag = (a: HazardEventFact, b: HazardEventFact) => (b.m ?? -1) - (a.m ?? -1) || Number(a.id.includes(':')) - Number(b.id.includes(':')) || a.d.localeCompare(b.d);
const max = <T>(list: T[], score: (x: T) => number) => list.reduce<T | undefined>((best, x) => (best === undefined || score(x) > score(best) ? x : best), undefined);
/** ISO-like dates sort as text only within one sign; BCE years go first. */
const newestFirst = (a: HazardEventFact, b: HazardEventFact) => yearOfDate(b.d) - yearOfDate(a.d) || b.d.localeCompare(a.d);

/**
 * The quakes sharing the strongest's magnitude, or undefined when it stands alone. `ties` is the builder's count over
 * all of them; the page holds both of two, and the latest of more.
 */
export function quakeTie(byStrength: HazardEventFact[], ties?: number): HazardFacts['tie'] {
  const m = byStrength[0]?.m;
  const tied = byStrength.filter(e => e.m === m && m !== undefined).sort(newestFirst);
  const n = Math.max(ties ?? 0, tied.length);
  if (n < 2) return undefined;
  return { n, named: n === 2 ? tied.slice(0, 2).reverse() : tied.slice(0, 1) };
}

/** One place × one range, as the facts its page states; undefined when the table has nothing for it. */
export function hazardFacts(row: HazardRow, range: HazardRangeId, meta: HazardMeta, kind: 'country' | 'city'): HazardFacts | undefined {
  const r = row[range];
  if (!r) return undefined;
  const scope: HazardScope = kind === 'city' ? 'city' : row.inland ? 'inland' : 'country';
  const ev = (id: string): HazardEventFact | undefined => (meta.events[id] ? { ...meta.events[id], id } : undefined);
  const waves = new Map((r.waves ?? []).map(({ id, ...here }) => [id, here]));
  const top = r.top.map(ev).filter((e): e is HazardEventFact => !!e).map(e => (waves.has(e.id) ? { ...e, here: waves.get(e.id) } : e));
  const quakes = top.filter(e => e.k === 'q').sort(byMag);
  const floor = meta.floors[range];
  const cap = floor < 5 ? 6 : 7;
  const strongest = quakes[0]?.m !== undefined ? quakes[0] : undefined;
  const second = quakes[1];
  const quakeEvents = r.usgs + r.quakesUnmatched;
  const oneGreat = !!strongest && strongest.m! >= 7 && !r.ties && (!second || strongest.m! - (second.m ?? 0) >= 1);
  const shape: QuakeShape = quakeEvents === 0 ? 'none'
    : quakeEvents < MIN_EVENTS ? 'few'
      : oneGreat ? 'one-great'
        : r.m7 >= 3 ? 'many-strong'
          : strongest && strongest.m! < cap ? 'moderate'
            : 'mixed';
  const tie = strongest ? quakeTie(quakes, r.ties) : undefined;
  const deadliest = max(top.filter(e => e.k === 'q' && e.deaths), e => e.deaths!);
  const latest = top.filter(e => e.k === 'q' && e.n !== undefined).sort(newestFirst)[0];

  let peak: HazardFacts['peak'];
  let halves: HazardFacts['halves'];
  if (r.by && r.usgs >= 10) {
    const n = Math.max(...r.by);
    const i = r.by.indexOf(n);
    const span = range === '10y' ? 1 : 10;
    const share = n / r.usgs;
    if (share >= 0.25) {
      const main = r.peak ? ev(r.peak.id) : undefined;
      peak = { label: span === 1 ? String(r.from + i) : `${r.from + i * span}–${r.from + i * span + span - 1}`, n, share, main, after: r.peak?.after ?? 0 };
    }
    if (range === '10y' && !peak) {
      const early = r.by.slice(0, 5).reduce((s, x) => s + x, 0);
      const late = r.by.slice(5).reduce((s, x) => s + x, 0);
      if (Math.max(early, late) >= 2 * Math.min(early, late) && Math.abs(early - late) >= 10) halves = { early, late, split: r.from + 5 };
    }
  }

  const century = row['100y'];
  const recent = range === 'all' && century && r.quakes >= MIN_EVENTS && r.quakes > century.quakes && century.from > r.from ? {
    quakes: century.quakes, since: century.from,
    thin: century.quakes / (r.to - century.from + 1) >= 3 * ((r.quakes - century.quakes) / (century.from - r.from)),
  } : undefined;
  const tsunamis = top.filter(e => e.k === 't');
  const eruptions = top.filter(e => e.k === 'v');
  return {
    range, scope, from: r.from, to: r.to, asOf: meta.asOf, floor, usgsFrom: range === 'all' ? meta.usgsSince : r.from,
    km: meta.cityKm, bigKm: meta.cityBigKm, bigMag: meta.bigMag,
    events: hazardEventCount(r), index: hazardIndexed(r),
    usgs: r.usgs, m7: r.m7, quakes: r.quakes, quakeEvents, shape, cap,
    strongest, tie, runnerUp: shape === 'one-great' ? second : undefined,
    deadliest, deaths: r.deaths, deadly: r.deadly,
    latest: latest && latest.id !== strongest?.id && latest.id !== deadliest?.id ? latest : undefined,
    peak, halves,
    oldest: range === 'all' ? [...top].filter(e => e.n !== undefined).sort((a, b) => yearOfDate(a.d) - yearOfDate(b.d) || a.d.localeCompare(b.d))[0] : undefined,
    recent,
    tsunamis: r.tsunamis, tsunamisFrom: r.tsunamisFrom ?? 0,
    tallest: (() => {
      const here = max(tsunamis.filter(e => e.here?.h), e => e.here!.h!);
      if (here) return { e: here, h: here.here!.h!, here: true };
      const own = max(tsunamis.filter(e => e.h && !e.here?.away), e => e.h!);
      return own ? { e: own, h: own.h!, here: false } : undefined;
    })(),
    waveDeadliest: (() => {
      const e = max(tsunamis.filter(e => e.here?.deaths), e => e.here!.deaths!);
      return e ? { e, deaths: e.here!.deaths!, away: !!e.here!.away } : undefined;
    })(),
    eruptions: r.eruptions, volcanoes: r.volcanoes,
    largestEruption: max(eruptions.filter(e => e.m !== undefined), e => e.m!), eruptionDeadliest: max(eruptions.filter(e => e.deaths), e => e.deaths!),
    list: [...top].sort(newestFirst),
  };
}

// ── Sentences ───────────────────────────────────────────────────────────────────────────────────────────────────

/** "6 February 2023", "December 1939", "1268", "1450 BCE": as precise as the source is. */
export function hazardDate(d: string, t: Translate): string {
  const m = /^(-?\d+)(?:-(\d\d))?(?:-(\d\d))?$/.exec(d);
  if (!m) return d;
  const year = Number(m[1]);
  if (year <= 0) return t('{year} BCE', { year: String(1 - year) });
  if (!m[2]) return year < 1000 ? t('AD {year}', { year: String(year) }) : String(year);
  const date = new Date(0);
  date.setUTCFullYear(year, Number(m[2]) - 1, Number(m[3] ?? 1));
  return new Intl.DateTimeFormat(t.intl, m[3] ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } : { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

/** The date, and whether it names a day: "on 6 February 2023", "in 1268". */
const when = (d: string, t: Translate) => ({ date: hazardDate(d, t), prec: /^-?\d+-\d\d-\d\d$/.test(d) ? 'day' : 'other' });

/** A ten-year range ends on the day it was counted to; earlier ranges end with their year. */
const until = (f: HazardFacts, t: Translate) => hazardDate(f.asOf, t);

/** NOAA's estimate for a quake before instruments; USGS's own magnitude from 1900. */
const estimated = (e: HazardEventFact) => e.id.includes(':') && yearOfDate(e.d) < 1900;

/** "a magnitude 7.8 on 6 February 2023 (Pazarcik earthquake, Kahramanmaras earthquake sequence)". */
export function quakePhrase(e: HazardEventFact, t: Translate): string {
  const vars = { m: e.m ?? 0, ...when(e.d, t), where: e.where ?? '' };
  if (e.m === undefined) return e.where ? t('an earthquake {prec, select, day {on {date}} other {in {date}}} ({where})', vars) : t('an earthquake {prec, select, day {on {date}} other {in {date}}}', vars);
  if (estimated(e)) return e.where ? t('an estimated magnitude {m} {prec, select, day {on {date}} other {in {date}}} ({where})', vars) : t('an estimated magnitude {m} {prec, select, day {on {date}} other {in {date}}}', vars);
  return e.where ? t('a magnitude {m} {prec, select, day {on {date}} other {in {date}}} ({where})', vars) : t('a magnitude {m} {prec, select, day {on {date}} other {in {date}}}', vars);
}

/** "on 26 December 1939 (20 km NNE of Erzincan, Turkey)". */
const whenWhere = (e: HazardEventFact, t: Translate) =>
  e.where ? t('{prec, select, day {on {date}} other {in {date}}} ({where})', { ...when(e.d, t), where: e.where }) : t('{prec, select, day {on {date}} other {in {date}}}', when(e.d, t));

/** The strongest quake, or those sharing its magnitude: "a magnitude 7.8, twice: on … and on …", "…, three times, most recently on …". */
export function strongestPhrase(f: HazardFacts, t: Translate): string {
  const s = f.strongest!;
  if (!f.tie) return quakePhrase(s, t);
  const [a, b] = f.tie.named;
  return f.tie.n === 2 && b
    ? t('a magnitude {m}, twice: {first} and {second}', { m: s.m!, first: whenWhere(a, t), second: whenWhere(b, t) })
    : t('a magnitude {m}, {n, plural, =3 {three times} =4 {four times} =5 {five times} other {# times}}, most recently {last}', { m: s.m!, n: f.tie.n, last: whenWhere(a, t) });
}

const sentence = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** The page's prose, from its facts: every number and name from the table, each sentence chosen by what the record shows. */
export function hazardSentences(f: HazardFacts, place: string, t: Translate): string[] {
  const out: string[] = [];
  const scope = { scope: f.scope, km: f.km, place };
  const span = { from: String(f.usgsFrom), to: until(f, t) };

  if (f.usgs > 0) {
    out.push(t('From {from} to {to}, USGS recorded {n, plural, one {one earthquake} other {# earthquakes}} of magnitude {floor} or more {scope, select, city {within {km, radius} of {place}, or {bigKm, radius} for magnitude {bigMag} and above} inland {in {place}} other {in or off {place}}}.', { ...scope, ...span, n: f.usgs, floor: f.floor, bigKm: f.bigKm, bigMag: f.bigMag }));
  } else {
    out.push(t('USGS recorded no earthquake of magnitude {floor} or more {scope, select, city {within {km, radius} of {place}} inland {in {place}} other {in or off {place}}} from {from} to {to}.', { ...scope, ...span, floor: f.floor }));
  }

  const noaaCount = () => {
    if (f.quakes === 0) return;
    const first = when(String(f.from), t);
    out.push(f.usgs === 0
      ? f.range === 'all'
        ? t('NOAA’s list of significant earthquakes has {n, plural, one {one} other {#}} {scope, select, city {within {km, radius} of {place}} inland {in {place}} other {in or off {place}}}, back to {from}.', { ...scope, n: f.quakes, from: first.date })
        : t('NOAA’s list of significant earthquakes has {n, plural, one {one} other {#}} {scope, select, city {within {km, radius} of {place}} inland {in {place}} other {in or off {place}}} in these years.', { ...scope, n: f.quakes })
      : f.range === 'all'
        ? t('NOAA’s list of significant earthquakes has {n} here, back to {from}.', { n: f.quakes, from: first.date })
        : t('{n, plural, one {One earthquake here in these years is} other {# earthquakes here in these years are}} on NOAA’s list of significant earthquakes.', { n: f.quakes }));
  };
  if (f.usgs === 0) noaaCount();

  const s = f.strongest;
  if (s && f.quakeEvents === 1) out.push(t('It was {quake}.', { quake: quakePhrase(s, t) }));
  else if (s) {
    const phrase = strongestPhrase(f, t);
    // NOAA's quakes before 1900 aren't among USGS's: "of them" would mix the two lists.
    const either = s.id.includes(':') && f.usgs > 0;
    switch (f.shape) {
      case 'one-great':
        out.push(f.runnerUp?.m !== undefined
          ? t('One stands far above the rest: {quake}. The next strongest reached {m}.', { quake: phrase, m: f.runnerUp.m })
          : t('One stands far above the rest: {quake}.', { quake: phrase }));
        break;
      case 'many-strong':
        out.push(either
          ? t('{n} of them reached magnitude 7 or more; the strongest on either list was {quake}.', { n: f.m7, quake: phrase })
          : t('{n} of them reached magnitude 7 or more; the strongest was {quake}.', { n: f.m7, quake: phrase }));
        break;
      case 'moderate':
        out.push(t('None reached magnitude {cap}: the strongest was {quake}.', { cap: f.cap, quake: phrase }));
        break;
      default:
        out.push(either ? t('The strongest on either list was {quake}.', { quake: phrase }) : t('The strongest was {quake}.', { quake: phrase }));
    }
  }

  const d = f.deadliest;
  if (d && f.tie && d.m === s?.m) {
    out.push(f.tie.named.some(e => e.id === d.id)
      ? t('The one {prec, select, day {on {date}} other {in {date}}} was the deadliest: NOAA records {n, plural, one {one death} other {# deaths}} for it.', { ...when(d.d, t), n: d.deaths! })
      : t('The deadliest of them was {quake}, for which NOAA records {n, plural, one {one death} other {# deaths}}.', { quake: quakePhrase(d, t), n: d.deaths! }));
  } else if (d && d.id === s?.id) out.push(t('It was also the deadliest: NOAA records {n, plural, one {one death} other {# deaths}} for it.', { n: d.deaths! }));
  else if (d) out.push(t('The deadliest was not the strongest: {quake}, for which NOAA records {n, plural, one {one death} other {# deaths}}.', { quake: quakePhrase(d, t), n: d.deaths! }));

  if (f.usgs > 0) noaaCount();
  const tolls = () => {
    if (f.deadly >= 2) out.push(t('NOAA records deaths in {events} of the events here, {n, plural, one {one} other {#}} in all.', { events: f.deadly, n: f.deaths }));
    else if (f.quakes > 0 && f.deaths === 0) out.push(t('{n, plural, one {NOAA records no deaths for it.} other {NOAA records no deaths for any of them.}}', { n: f.quakes }));
  };
  // {prec, select, day {on {date}} other {in {date}}}ith no quakes, the tsunamis and eruptions come first and their toll after them.
  if (f.quakeEvents > 0) tolls();

  if (f.peak) {
    out.push(f.range === '10y'
      ? t('{year} had the most magnitude {floor}+ earthquakes: {n} of the {total}.', { year: f.peak.label, n: f.peak.n, total: f.usgs, floor: f.floor })
      : t('The ten years with the most magnitude {floor}+ earthquakes were {years}, with {n} of the {total}.', { years: f.peak.label, n: f.peak.n, total: f.usgs, floor: f.floor }));
    if (f.peak.main && f.peak.after >= 5 && f.peak.after >= f.peak.n / 4) {
      out.push(f.peak.main.id === s?.id
        ? t('{n} came in the 30 days after the strongest, within {reach, radius} of it.', { n: f.peak.after, reach: AFTERSHOCK_KM })
        : t('{n} came in the 30 days after {quake}, within {reach, radius} of it.', { n: f.peak.after, quake: quakePhrase(f.peak.main, t), reach: AFTERSHOCK_KM }));
    }
  } else if (f.halves) {
    out.push(t('{late} came from {split} on, against {early} in the five years before.', { late: f.halves.late, early: f.halves.early, split: String(f.halves.split) }));
  }

  if (f.latest && f.latest.id !== f.oldest?.id) out.push(t('The latest on NOAA’s list is {quake}.', { quake: quakePhrase(f.latest, t) }));

  if (f.oldest) {
    const vars = { ...when(f.oldest.d, t), where: f.oldest.where ?? '', kind: f.oldest.k };
    out.push(f.oldest.where
      ? t('NOAA’s record here begins {prec, select, day {on {date}} other {in {date}}} with {kind, select, q {an earthquake} t {a tsunami} other {an eruption}} ({where}).', vars)
      : t('NOAA’s record here begins {prec, select, day {on {date}} other {in {date}}} with {kind, select, q {an earthquake} t {a tsunami} other {an eruption}}.', vars));
  }
  if (f.recent) {
    const vars = { recent: f.recent.quakes, older: f.quakes - f.recent.quakes, n: f.quakes, since: String(f.recent.since) };
    out.push(f.recent.thin
      ? t('It grows thinner going back: {recent} of the {n} significant earthquakes NOAA lists here are from {since} on.', vars)
      : t('{older} of the {n} significant earthquakes NOAA lists here came before {since}.', vars));
  }

  if (f.tsunamis > 0) {
    const vars = { ...scope, n: f.tsunamis - f.tsunamisFrom, away: f.tsunamisFrom };
    out.push(vars.n && vars.away
      ? t('NOAA lists {n, plural, one {one tsunami} other {# tsunamis}} that began {scope, select, city {within {km, radius} of {place}} inland {in {place}} other {in or off {place}}}, and {away, plural, one {one} other {#}} from elsewhere that reached it with deaths or a metre of water or more.', vars)
      : vars.n
        ? t('NOAA lists {n, plural, one {one tsunami} other {# tsunamis}} that began {scope, select, city {within {km, radius} of {place}} inland {in {place}} other {in or off {place}}}.', vars)
        : t('NOAA lists {away, plural, one {one tsunami} other {# tsunamis}} from elsewhere that reached {scope, select, city {the coast within {km, radius} of {place}} other {{place}}} with deaths or a metre of water or more.', vars));
    const tall = f.tallest;
    if (tall) out.push(tall.here
      ? t('The highest water NOAA records here was {h} m, {prec, select, day {on {date}} other {in {date}}}.', { h: tall.h, ...when(tall.e.d, t) })
      : t('{n, plural, one {It reached {h} m, {prec, select, day {on {date}} other {in {date}}}.} other {The highest of them reached {h} m, {prec, select, day {on {date}} other {in {date}}}.}}', { n: vars.n, h: tall.h, ...when(tall.e.d, t) }));
    const wd = f.waveDeadliest;
    if (wd) {
      const v = { ...scope, ...when(wd.e.d, t), n: wd.deaths, m: wd.e.m ?? 0, where: wd.e.where ?? '' };
      out.push(!wd.away
        ? t('The deadliest, {prec, select, day {on {date}} other {in {date}}}, killed {n, plural, one {one person} other {# people}} here by NOAA’s runup records.', v)
        : wd.e.m !== undefined && wd.e.where
          ? t('The deadliest here came {prec, select, day {on {date}} other {in {date}}} from a magnitude {m} earthquake ({where}): NOAA’s runup records count {n, plural, one {one death} other {# deaths}} {scope, select, city {within {km, radius} of {place}} other {in {place}}}.', v)
          : wd.e.m !== undefined
            ? t('The deadliest here came {prec, select, day {on {date}} other {in {date}}} from a magnitude {m} earthquake: NOAA’s runup records count {n, plural, one {one death} other {# deaths}} {scope, select, city {within {km, radius} of {place}} other {in {place}}}.', v)
          : wd.e.where
            ? t('The deadliest here came {prec, select, day {on {date}} other {in {date}}} from {where}: NOAA’s runup records count {n, plural, one {one death} other {# deaths}} {scope, select, city {within {km, radius} of {place}} other {in {place}}}.', v)
            : t('The deadliest here came {prec, select, day {on {date}} other {in {date}}}: NOAA’s runup records count {n, plural, one {one death} other {# deaths}} {scope, select, city {within {km, radius} of {place}} other {in {place}}}.', v));
    }
  }

  if (f.eruptions > 0) {
    const big = f.largestEruption;
    out.push(t('NOAA lists {n, plural, one {one significant eruption} other {# significant eruptions}} {v, plural, one {of one volcano} other {of # volcanoes}} {scope, select, city {within {km, radius} of {place}} inland {in {place}} other {in or off {place}}}.', { ...scope, n: f.eruptions, v: f.volcanoes }));
    if (big?.where) out.push(t('The largest was {volcano} {prec, select, day {on {date}} other {in {date}}}, at {vei} on the volcanic explosivity index.', { volcano: big.where, ...when(big.d, t), vei: big.m! }));
    const de = f.eruptionDeadliest;
    if (de?.where) out.push(de.id === big?.id
      ? t('It killed {n, plural, one {one person} other {# people}} by NOAA’s count.', { n: de.deaths! })
      : t('The deadliest was {volcano} {prec, select, day {on {date}} other {in {date}}}, which killed {n, plural, one {one person} other {# people}} by NOAA’s count.', { volcano: de.where, ...when(de.d, t), n: de.deaths! }));
  }

  if (f.quakeEvents === 0) tolls();
  if (!out.length) out.push(t('Neither USGS nor NOAA records an earthquake, tsunami or eruption {scope, select, city {within {km, radius} of {place}} inland {in {place}} other {in or off {place}}} from {from} to {to}.', { ...scope, from: String(f.from), to: until(f, t) }));
  return out.map(sentence);
}
