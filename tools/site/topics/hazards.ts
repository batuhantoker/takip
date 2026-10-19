// The natural-hazards table for place pages: for every country, and every city where quakes cluster, what the record
// holds for the last ten calendar years, the last hundred and all of it. Writes data/site/topics/hazards.json, keyed
// by GeoNames id (src/lib/platform/site/places/topics/hazards-data.ts).
//
//   nice npx tsx tools/site/topics/hazards.ts [--as-of 2026-10-19]
//
// Two sources, kept apart:
// - USGS ComCat (US public domain) through its FDSN service: M4.5+ for the last ten years, M6+ since 1900. Asked one
//   year at a time, one request after another, and cached in .cache/site/hazards; delete a file to fetch it again.
// - NOAA NCEI's significant earthquakes, tsunamis and eruptions (public domain) as data/db/history.db holds them
//   (tools/import/datasets/noaa.ts), opened read-only, and its tsunami runups, where each wave was measured or seen,
//   from the importer's download (docs/data) or NCEI's API, so a tsunami also counts where it struck.
// A country counts an event whose point is inside it, or at sea within SEA_KM of its coast (so one event can count for
// two neighbours), or further out, up to FAR_SEA_KM, where it is the nearest country; a city, one within CITY_KM, or
// CITY_BIG_KM for a quake of BIG_MAG and up, whose damage reaches that far (Antakya and 6 February 2023). Places are GeoNames' countryInfo and cities15000, filtered as
// tools/site/build-gazetteer.ts does, so the ids match the gazetteer's.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import { TAKIP_USER_AGENT } from '../../../src/lib/core/net/user-agent';
import type { TopicTable } from '../../../src/lib/platform/site/places/tables';
import { HAZARD_RANGES, type HazardEvent, type HazardKind, type HazardMeta, type HazardRange, type HazardRangeId, type HazardRow } from '../../../src/lib/platform/site/places/topics/hazards-data';
import { hazardIndexed } from '../../../src/lib/platform/site/places/topics/hazards-facts';
import { countryBox, Countries, FAR_SEA_KM, km, nearby, SEA_KM, type Lnglat } from './hazards-geo';

const OUT = 'data/site/topics/hazards.json';
const CACHE = join('.cache', 'site', 'hazards');
const FDSN = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const FLOORS: Record<HazardRangeId, number> = { '10y': 4.5, '100y': 6, all: 6 };
const USGS_SINCE = 1900;
const CITY_KM = 100;
const CITY_BIG_KM = 200;
const BIG_MAG = 7;
/**
 * Cities this size and up with at least CITY_MIN_NOAA events on NOAA's lists within CITY_KM, so a city page stands on
 * a history of its own and not only on small quakes; none within SHADOW_KM of a bigger one with a row, whose page it would repeat.
 */
const CITY_MIN_POP = 100_000;
const CITY_MIN_NOAA = 5;
const SHADOW_KM = 25;
/** The importer's rule for one quake in both catalogues (tools/import/datasets/noaa.ts). */
const MATCH_S = 120;
const MATCH_KM = 150;
/** A tsunami reached a place where one of its runups killed or rose this many metres. */
const RUNUP_MIN_M = 1;
const RAW_RUNUPS = join('docs', 'data', 'raw-2026-10-12-more', 'noaa', 'runups.json');
const NCEI = 'https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1';
const PEAK_DAYS = 30;
const PEAK_KM = 150;
const SKIP_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW']);

export interface UsgsQuake { id: string; t: number; at: Lnglat; mag: number; place: string }
export interface NoaaEvent {
  id: number; rec: string; kind: HazardKind; t: number; prec: number; at: Lnglat | null;
  mag: number | null; deaths: number | null; h: number | null; where?: string; wiki?: string;
  /** Event ids this one is 'related' to (a quake's tsunami, a tsunami's eruption). */
  links: number[];
  usgs?: UsgsQuake;
}
/**
 * One place where a tsunami was seen: NCEI's tsunami event id, the deaths there and the water's height. A row without
 * a point ("ALL OF SRI LANKA") is a country's summary, placed by its `country`.
 */
export interface Runup { ts: number; at: Lnglat | null; country: string; deaths: number; h: number | null }

const yearOf = (t: number) => new Date(t).getUTCFullYear();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function usgsFile(file: string, start: string, end: string, minMag: number): Promise<UsgsQuake[]> {
  const path = join(CACHE, file);
  if (!existsSync(path)) {
    const q = new URLSearchParams({ format: 'csv', eventtype: 'earthquake', starttime: start, endtime: end, minmagnitude: String(minMag), orderby: 'time-asc' });
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(`${FDSN}?${q}`, { headers: { 'User-Agent': TAKIP_USER_AGENT }, signal: AbortSignal.timeout(180_000) }).catch(() => null);
      if (res?.ok) { writeFileSync(path, await res.text()); break; }
      if (attempt >= 3) throw new Error(`USGS ${file}: ${res ? `HTTP ${res.status} ${(await res.text()).slice(0, 200)}` : 'no answer'}`);
      await sleep(15_000 * attempt);
    }
    console.log(`  fetched ${file}`);
    await sleep(2000);
  }
  const [head, ...rows] = csvRows(readFileSync(path, 'utf8'));
  const [ti, la, lo, ma, id, pl] = ['time', 'latitude', 'longitude', 'mag', 'id', 'place'].map(c => head.indexOf(c));
  return rows.filter(r => r.length === head.length).map(r => ({
    id: r[id], t: Date.parse(r[ti]), at: [Number(r[lo]), Number(r[la])] as Lnglat, mag: Math.round(Number(r[ma]) * 10) / 10, place: r[pl],
  })).filter(q => Number.isFinite(q.t) && Number.isFinite(q.mag) && Math.abs(q.at[1]) <= 90 && Math.abs(q.at[0]) <= 180);
}

async function loadUsgs(asOf: string): Promise<UsgsQuake[]> {
  const year = yearOf(Date.parse(asOf));
  const first = year - 9;
  const out = await usgsFile(`m6-${USGS_SINCE}-${first - 1}.csv`, `${USGS_SINCE}-01-01`, `${first}-01-01`, FLOORS.all);
  for (let y = first; y <= year; y++) {
    out.push(...await usgsFile(y < year ? `m4.5-${y}.csv` : `m4.5-${y}-to-${asOf}.csv`, `${y}-01-01`, y < year ? `${y + 1}-01-01` : asOf, FLOORS['10y']));
  }
  return out.sort((a, b) => a.t - b.t);
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function loadNoaa(): NoaaEvent[] {
  const catalog = new Database('data/db/catalog.db', { readonly: true, fileMustExist: true });
  const source = catalog.prepare(`SELECT source_id FROM meta_source WHERE code = 'noaa-hazards'`).pluck().get() as number;
  catalog.close();
  const db = new Database('data/db/history.db', { readonly: true, fileMustExist: true });
  const rows = db.prepare(`
    SELECT e.event_id AS id, k.code AS kind, e.source_record_id AS rec, e.title, e.t_start AS t, e.t_start_prec AS prec,
           e.lon, e.lat, e.magnitude AS mag, e.attrs
    FROM ev_event e JOIN ev_kind k USING (kind_id)
    WHERE e.source_id = ? AND k.code IN ('hazard.quake', 'hazard.tsunami', 'hazard.volcano') AND e.retracted_at IS NULL
  `).all(source) as { id: number; kind: string; rec: string; title: string; t: number; prec: number; lon: number | null; lat: number | null; mag: number | null; attrs: string }[];
  const links = new Map<number, number[]>();
  for (const { a, b } of db.prepare(`SELECT from_id AS a, to_id AS b FROM ev_event_relation WHERE rel = 'related' AND source_id = ?`).all(source) as { a: number; b: number }[]) {
    links.set(a, [...(links.get(a) ?? []), b]);
    links.set(b, [...(links.get(b) ?? []), a]);
  }
  db.close();
  return rows.map(r => {
    const a = JSON.parse(r.attrs) as Record<string, unknown>;
    const kind: HazardKind = r.kind === 'hazard.quake' ? 'q' : r.kind === 'hazard.tsunami' ? 't' : 'v';
    // "Earthquake — Turkey:  Duzce" → "Duzce"; "Eruption of Kolumbo" → "Kolumbo".
    const name = r.title.replace(/^(Earthquake|Tsunami) — /, '').replace(/^Eruption of /, '');
    // A tsunami's location is often a sea ("Off W. Coast Of Northern Sumatra") with no country before it.
    const where = kind === 'v' ? name : name.includes(':') ? name.slice(name.indexOf(':') + 1).replace(/\s+/g, ' ').trim() : kind === 't' ? name : undefined;
    return {
      id: r.id, rec: r.rec, kind, t: r.t, prec: r.prec,
      at: r.lon !== null && r.lat !== null ? [r.lon, r.lat] as Lnglat : null,
      mag: kind === 'v' ? num(a.vei) : kind === 't' ? num(a.source_quake_magnitude) : r.mag,
      deaths: num(a.deaths), h: num(a.max_water_height_m),
      ...(where ? { where } : {}),
      ...(typeof a.wiki === 'string' ? { wiki: a.wiki } : {}),
      links: links.get(r.id) ?? [],
    };
  });
}

/** NCEI's runups that count as a tsunami reaching a place; the importer's copy when there is one, so they match history.db. */
async function loadRunups(): Promise<Runup[]> {
  let path = RAW_RUNUPS;
  if (!existsSync(path)) {
    path = join(CACHE, 'runups.json');
    if (!existsSync(path)) {
      const items: unknown[] = [];
      for (let page = 1, pages = 1; page <= pages; page++) {
        const res = await fetch(`${NCEI}/tsunamis/runups?itemsPerPage=200&page=${page}`, { headers: { 'User-Agent': TAKIP_USER_AGENT }, signal: AbortSignal.timeout(60_000) });
        if (!res.ok) throw new Error(`NCEI runups page ${page}: HTTP ${res.status}`);
        const d = (await res.json()) as { items: unknown[]; totalPages: number };
        items.push(...d.items);
        pages = d.totalPages;
        await sleep(500);
      }
      writeFileSync(path, JSON.stringify(items));
    }
  }
  return (JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>[]).flatMap(r => {
    const ts = num(r.tsunamiEventId), lon = num(r.longitude), lat = num(r.latitude);
    const deaths = num(r.deaths) ?? 0, h = num(r.runupHt);
    return ts !== null && (deaths > 0 || (h ?? 0) >= RUNUP_MIN_M)
      ? [{ ts, at: lon !== null && lat !== null ? [lon, lat] as Lnglat : null, country: String(r.country ?? ''), deaths, h }] : [];
  });
}

/** Pairs each instrumental NOAA quake timed to the minute with the nearest USGS quake within MATCH_S and MATCH_KM. */
export function matchNoaa(noaa: NoaaEvent[], usgs: UsgsQuake[]): number {
  const sorted = [...usgs].sort((a, b) => a.t - b.t);
  let matched = 0;
  for (const q of noaa) {
    if (q.kind !== 'q' || !q.at || q.prec < 8 || yearOf(q.t) < USGS_SINCE) continue;
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid].t < q.t - MATCH_S * 1000) lo = mid + 1; else hi = mid;
    }
    let best: { u: UsgsQuake; d: number } | null = null;
    for (let i = lo; i < sorted.length && sorted[i].t <= q.t + MATCH_S * 1000; i++) {
      const d = km(q.at, sorted[i].at);
      if (d <= MATCH_KM && (!best || d < best.d)) best = { u: sorted[i], d };
    }
    if (best) { q.usgs = best.u; matched++; }
  }
  return matched;
}

// ── One place, one range ────────────────────────────────────────────────────────────────────────────────────────

/** What a place counts: quakes and NOAA events by where they began, and the tsunamis whose runups reached it, with its own toll and highest water. */
export interface Bag { usgs: UsgsQuake[]; noaa: NoaaEvent[]; sea?: number; hits?: Map<NoaaEvent, Hit> }

/** A tsunami's runups in one place: the dead at its points, the dead its summary rows give, the highest water. */
interface Hit { located: number; summary: number; h: number }

export function addRunup(bag: Bag, tsunami: NoaaEvent, r: Runup) {
  bag.hits ??= new Map();
  const cur = bag.hits.get(tsunami) ?? { located: 0, summary: 0, h: 0 };
  bag.hits.set(tsunami, {
    located: cur.located + (r.at ? r.deaths : 0), summary: cur.summary + (r.at ? 0 : r.deaths), h: Math.max(cur.h, r.h ?? 0),
  });
}

/** NCEI's summary rows already hold the dead at the points ("ALL OF INDIA" 16,269 includes Nagapattinam's 6,051), so the larger, not the sum. */
export const hitDeaths = (hit: Hit | undefined) => (hit ? Math.max(hit.located, hit.summary) : 0);

const registry: Record<string, HazardEvent> = {};

function dateOf(t: number, prec: number): string {
  const d = new Date(t);
  const p2 = (n: number) => String(n).padStart(2, '0');
  const y = String(d.getUTCFullYear());
  return prec <= 4 ? y : prec === 5 ? `${y}-${p2(d.getUTCMonth() + 1)}` : `${y}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places;

function register(e: UsgsQuake | NoaaEvent, noaaOf: Map<string, NoaaEvent>): string {
  // One quake, one key: USGS's, wherever both list it.
  if (!('place' in e) && e.usgs) return register(e.usgs, noaaOf);
  const isUsgs = 'place' in e;
  const key = isUsgs ? e.id : e.rec;
  if (registry[key]) return key;
  const noaa = isUsgs ? noaaOf.get(e.id) : e;
  const at = (isUsgs ? e.at : e.at!).map(v => round(v, 2)) as Lnglat;
  const where = isUsgs && !e.place.includes('?') ? e.place : noaa?.where;
  registry[key] = {
    k: isUsgs ? 'q' : e.kind,
    d: isUsgs ? dateOf(e.t, 6) : dateOf(e.t, e.prec),
    ...(isUsgs ? { m: e.mag } : e.mag !== null ? { m: round(e.mag, 1) } : {}),
    // A tsunami's NOAA total includes its source quake's dead, so it isn't given as the tsunami's own.
    ...(noaa?.deaths && noaa.kind !== 't' ? { deaths: noaa.deaths } : {}),
    ...(!isUsgs && e.h !== null ? { h: e.h } : {}),
    at,
    // ComCat stores letters outside Latin-1 as "?" ("Uzunba?"); NOAA's name, or none, rather than a broken one.
    ...(where ? { where } : {}),
    ...(noaa?.wiki ? { wiki: noaa.wiki } : {}),
    ...(noaa ? { n: Number(noaa.rec.slice(3)) } : {}),
  } as HazardEvent;
  return key;
}

/** A city's page lists fewer events than a country's: its quakes are mostly its country's. */
export function rangeStats(bag: Bag, range: HazardRangeId, year: number, noaaOf: Map<string, NoaaEvent>, city = false): HazardRange | null {
  const floor = FLOORS[range];
  const first = range === '10y' ? year - 9 : range === '100y' ? year - 99 : -Infinity;
  const inYears = (t: number) => yearOf(t) >= first && yearOf(t) <= year;
  const usgs = bag.usgs.filter(q => q.mag >= floor && inYears(q.t));
  const noaa = bag.noaa.filter(e => inYears(e.t));
  const began = noaa.filter(e => e.kind === 't');
  const reached = [...(bag.hits?.keys() ?? [])].filter(e => inYears(e.t) && !began.includes(e));
  if (!usgs.length && !noaa.length && !reached.length) return null;
  const from = range === 'all' ? Math.min(...[...noaa, ...reached].map(e => yearOf(e.t)), ...usgs.map(q => yearOf(q.t))) : first;
  const counted = new Set(usgs.map(q => q.id));
  const quakes = noaa.filter(e => e.kind === 'q');
  const unmatched = quakes.filter(e => !e.usgs || !counted.has(e.usgs.id));
  const eruptions = noaa.filter(e => e.kind === 'v');
  const causes = new Set([...quakes, ...eruptions].map(e => e.id));
  const tsunamis = [...began, ...reached];
  const unlinked = tsunamis.filter(e => !e.links.some(id => causes.has(id)));
  const local = (e: NoaaEvent) => bag.hits?.get(e);
  // One toll per disaster: a quake's total already holds its tsunami's dead, and so may an eruption's. A tsunami from
  // elsewhere brings only the dead its runups here record.
  const quakeIds = new Set(quakes.map(e => e.id));
  const tolls = [
    ...[...quakes, ...eruptions.filter(e => !e.links.some(id => quakeIds.has(id)))].map(e => e.deaths ?? 0),
    ...unlinked.map(e => (reached.includes(e) ? hitDeaths(local(e)) : e.deaths ?? 0)),
  ].filter(d => d > 0);

  const span = range === '10y' ? 1 : 10;
  const by = range === 'all' ? undefined : Array.from({ length: 10 }, (_, i) => usgs.filter(q => Math.floor((yearOf(q.t) - first) / span) === i).length);
  let peak: HazardRange['peak'];
  if (by && usgs.length) {
    const i = by.indexOf(Math.max(...by));
    const bucket = usgs.filter(q => Math.floor((yearOf(q.t) - first) / span) === i);
    const main = bucket.reduce((a, b) => (b.mag > a.mag ? b : a));
    const after = usgs.filter(q => q.t > main.t && q.t <= main.t + PEAK_DAYS * 86_400_000 && km(q.at, main.at) <= PEAK_KM).length;
    peak = { id: register(main, noaaOf), after };
  }

  const pool: (UsgsQuake | NoaaEvent)[] = [...usgs, ...unmatched.filter(e => e.at)];
  const magOf = (e: UsgsQuake | NoaaEvent) => ('place' in e ? e.mag : e.mag) ?? -1;
  const deathsOf = (e: UsgsQuake | NoaaEvent) => ('place' in e ? noaaOf.get(e.id)?.deaths : e.deaths) ?? 0;
  const byMag = (a: UsgsQuake | NoaaEvent, b: UsgsQuake | NoaaEvent) => magOf(b) - magOf(a) || Number('place' in b) - Number('place' in a) || a.t - b.t;
  const located = (list: NoaaEvent[]) => list.filter(e => e.at);
  const strongest = pool.length ? Math.max(...pool.map(magOf)) : -1;
  const tied = pool.filter(e => magOf(e) === strongest && strongest >= 0).sort((a, b) => b.t - a.t);
  const localDeaths = (e: NoaaEvent) => hitDeaths(local(e));
  const localH = (e: NoaaEvent) => local(e)?.h ?? 0;
  const picks: (UsgsQuake | NoaaEvent)[] = [
    ...[...pool].sort(byMag).slice(0, city ? 2 : 5),
    // A shared top magnitude: both of two, or the latest of more.
    ...tied.slice(0, 2),
    ...[...pool, ...located(eruptions)].filter(e => deathsOf(e) > 0).sort((a, b) => deathsOf(b) - deathsOf(a)).slice(0, city ? 1 : 3),
    ...[...located(quakes)].sort((a, b) => b.t - a.t).slice(0, 1),
    ...(range === 'all' ? located(noaa).sort((a, b) => a.t - b.t).slice(0, 1) : []),
    ...located(tsunamis).filter(e => localDeaths(e) > 0).sort((a, b) => localDeaths(b) - localDeaths(a)).slice(0, 1),
    ...located(tsunamis).sort((a, b) => localH(b) - localH(a) || (b.h ?? 0) - (a.h ?? 0) || a.t - b.t).slice(0, 1),
    ...located(eruptions).sort((a, b) => (b.mag ?? -1) - (a.mag ?? -1) || a.t - b.t).slice(0, 1),
    ...located(eruptions).sort((a, b) => (b.deaths ?? 0) - (a.deaths ?? 0) || a.t - b.t).slice(0, city ? 0 : 1),
  ];
  const top = [...new Set(picks.map(e => register(e, noaaOf)))];
  const waves = located(tsunamis).filter(e => top.includes(e.rec) && local(e)).map(e => ({
    id: e.rec, ...(localDeaths(e) ? { deaths: localDeaths(e) } : {}), ...(localH(e) ? { h: localH(e) } : {}), ...(reached.includes(e) ? { away: true as const } : {}),
  }));

  return {
    from, to: year,
    usgs: usgs.length, m6: usgs.filter(q => q.mag >= 6).length, m7: usgs.filter(q => q.mag >= 7).length,
    ...(by ? { by } : {}),
    quakes: quakes.length, quakesUnmatched: unmatched.length,
    tsunamis: tsunamis.length, tsunamisFrom: reached.length, tsunamisUnlinked: unlinked.length,
    ...(waves.length ? { waves } : {}),
    ...(tied.length >= 2 ? { ties: tied.length } : {}),
    eruptions: eruptions.length, volcanoes: new Set(eruptions.map(e => e.where ?? e.rec)).size,
    deaths: tolls.reduce((s, d) => s + d, 0), deadly: tolls.length,
    top,
    ...(peak ? { peak } : {}),
  };
}

// ── Places ──────────────────────────────────────────────────────────────────────────────────────────────────────

const tsv = (text: string) => text.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));

interface City { id: number; name: string; cc: string; at: Lnglat; pop: number }

function loadCities(): City[] {
  const zip = join('.cache', 'transit', 'cities15000.zip');
  const rows = tsv(execFileSync('unzip', ['-p', zip], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8'));
  return rows.filter(r => !SKIP_CODES.has(r[7]) && Number(r[14]) > 0)
    .map(r => ({ id: Number(r[0]), name: r[1], cc: r[8], at: [Number(r[5]), Number(r[4])] as Lnglat, pop: Number(r[14]) }));
}

async function main() {
  const asOfArg = process.argv.indexOf('--as-of');
  const asOf = asOfArg > 0 ? process.argv[asOfArg + 1] : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error(`--as-of wants YYYY-MM-DD, not ${asOf}`);
  const year = yearOf(Date.parse(asOf));
  mkdirSync(CACHE, { recursive: true });
  mkdirSync('data/site/topics', { recursive: true });

  const usgs = (await loadUsgs(asOf)).filter(q => q.t < Date.parse(asOf));
  const noaa = loadNoaa().filter(e => e.t < Date.parse(asOf));
  const matched = matchNoaa(noaa, usgs);
  const noaaOf = new Map(noaa.filter(e => e.usgs).map(e => [e.usgs!.id, e]));
  console.log(`USGS ${usgs.length} quakes; NOAA ${noaa.length} events, ${matched} quakes matched to USGS`);

  const ids = new Map(tsv(readFileSync(join('.cache', 'site', 'countryInfo.txt'), 'utf8')).filter(r => r[16]).map(r => [r[0], Number(r[16])]));
  const countries = new Countries(JSON.parse(readFileSync('public/data/boundaries/countries.json', 'utf8')), ids);
  const bags = new Map<number, Bag>(countries.list.map(c => [c.id, { usgs: [], noaa: [], sea: 0 }]));
  let unplaced = 0;
  for (const e of [...usgs, ...noaa]) {
    if (!e.at) { unplaced++; continue; }
    const { hit, sea } = countries.of(e.at);
    if (!hit.length) unplaced++;
    for (const c of hit) {
      const bag = bags.get(c.id)!;
      if ('place' in e) bag.usgs.push(e); else bag.noaa.push(e);
      if (sea) bag.sea!++;
    }
  }
  console.log(`${unplaced} events in no country or more than ${FAR_SEA_KM} km off every coast`);
  const tsunamiOf = new Map(noaa.filter(e => e.kind === 't').map(e => [Number(e.rec.slice(3)), e]));
  const runups = (await loadRunups()).filter(r => tsunamiOf.has(r.ts));
  const unnamed = new Set<string>();
  for (const r of runups) {
    const c = r.at ? countries.at(r.at) : countries.named(r.country);
    if (c) addRunup(bags.get(c.id)!, tsunamiOf.get(r.ts)!, r);
    else if (!r.at) unnamed.add(r.country);
  }
  console.log(`${runups.length} runups with deaths or ${RUNUP_MIN_M} m of water${unnamed.size ? `; summaries for no country here: ${[...unnamed].join(', ')}` : ''}`);

  const rows: Record<string, HazardRow> = {};
  const stats = { country: { pages: 0, indexed: 0 }, city: { pages: 0, indexed: 0 } };
  const keep = (id: number, bag: Bag, kind: 'country' | 'city') => {
    const row: HazardRow = {};
    for (const range of ['10y', '100y', 'all'] as const) {
      const r = rangeStats(bag, range, year, noaaOf, kind === 'city');
      // A country's thin ranges still render, unindexed; a city's would only repeat its country's.
      if (!r || (kind === 'city' && !hazardIndexed(r))) continue;
      row[range] = r;
      stats[kind].pages++;
      if (hazardIndexed(r)) stats[kind].indexed++;
    }
    if (!HAZARD_RANGES.some(r => row[r])) return;
    rows[id] = row;
    if (kind === 'country') {
      row.box = countryBox(countries.list.find(c => c.id === id)!.polygons.map(p => p.box));
      if (!bag.sea) row.inland = true;
    }
  };
  for (const [id, bag] of bags) keep(id, bag, 'country');

  const usgsNear = nearby(usgs, CITY_KM, CITY_BIG_KM, q => q.mag >= BIG_MAG);
  const noaaNear = nearby(noaa, CITY_KM, CITY_BIG_KM, e => e.kind === 'q' && (e.usgs?.mag ?? e.mag ?? 0) >= BIG_MAG);
  const runupsNear = nearby(runups.filter(r => r.at), CITY_KM, CITY_KM, () => false);
  const taken: City[] = [];
  for (const city of loadCities().filter(c => c.pop >= CITY_MIN_POP).sort((a, b) => b.pop - a.pop)) {
    if (taken.some(t => km(t.at, city.at) < SHADOW_KM)) continue;
    const bag: Bag = { usgs: usgsNear(city.at), noaa: noaaNear(city.at) };
    for (const r of runupsNear(city.at)) addRunup(bag, tsunamiOf.get(r.ts)!, r);
    if (bag.noaa.length + (bag.hits?.size ?? 0) < CITY_MIN_NOAA) continue;
    keep(city.id, bag, 'city');
    if (rows[city.id]) taken.push(city);
  }

  const used = new Set(Object.values(rows).flatMap(row => HAZARD_RANGES.flatMap(k => row[k] ? [...row[k].top, ...(row[k].peak ? [row[k].peak.id] : [])] : [])));
  const events = Object.fromEntries(Object.entries(registry).filter(([k]) => used.has(k)));
  const meta: HazardMeta = { asOf, floors: FLOORS, usgsSince: USGS_SINCE, cityKm: CITY_KM, cityBigKm: CITY_BIG_KM, bigMag: BIG_MAG, seaKm: SEA_KM, farSeaKm: FAR_SEA_KM, events };
  const table: TopicTable<HazardRow, HazardMeta> = { generated: new Date().toISOString().slice(0, 10), meta, rows };
  const json = `${JSON.stringify(table)}\n`;
  writeFileSync(OUT, json);
  console.log(`wrote ${Object.keys(rows).length} places (${taken.length} cities), ${Object.keys(events).length} events, ${(json.length / 1024).toFixed(0)} KB to ${OUT}`);
  console.log(`country pages ${stats.country.pages}, indexed ${stats.country.indexed}; city pages ${stats.city.pages}, indexed ${stats.city.indexed}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
