/*
 * fetch.ts `recover`: what Wikidata and Wikipedia say about the event items the Wikidata importers would drop for
 * want of a label, a date or a place, into RAW_MORE/wikidata/recover.json (datasets/wikidata-recover.ts reads it).
 * Entity and GeoData APIs only, one call at a time: WDQS is left alone. Resumable: progress is saved as it goes and
 * a rerun fetches only what is missing.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAW_MORE } from './context';
import { get } from './fetch-net';
import { COUP, classes, politicsDate, politicsPlace, read, start, wdPoint, type Row } from './datasets/wikidata';
import { battleMiddles, wdPlace } from './datasets/wikidata-conflict';
import { eventPlace, ownedElsewhere, textDate } from './datasets/wikidata-events';
import { type ItemRec, pickName, type PlaceRec, RECOVER, type RecoverData } from './datasets/wikidata-recover';
import { enwikiTitle } from './wiki';

const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const FILES = ['battles', 'politics', 'attacks', 'wars', 'revolutions', 'massacres', 'displacements', 'disasters', 'unrest', 'accidents', 'operations', 'crimes'];
const CONFLICT = new Set(['wars', 'revolutions', 'massacres', 'displacements']);
/** fetch.ts `events` files: their rows name locations, areas and countries by id (datasets/wikidata-events.ts). */
const EVENTS = new Set(['disasters', 'unrest', 'accidents', 'operations', 'crimes']);
const QID = /^Q\d+$/;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export type Wants = { label: boolean; date: boolean; place: boolean };

/**
 * What an importer can't find in a row by itself, by its own label, date and place rules. A conflict row placed only
 * at its country is wanted too: recovery tries closer places first, and drops a dissolved or vast country.
 */
export function wants(file: string, r: Row, middles?: Map<string, unknown>): Wants {
  if (EVENTS.has(file)) {
    const title = r.label ?? r.otherLabel;
    // An events row placed only at its country isn't fetched: the offline resolver comes before the country there.
    return { label: !title, date: !(start(r, r.inception) ?? (title && textDate(r, title))), place: !eventPlace(r) };
  }
  const coup = classes(r).has(COUP);
  const date = file === 'politics' ? politicsDate(r, coup) : start(r);
  const place = file === 'politics' ? politicsPlace(r, coup) : CONFLICT.has(file) ? (wdPlace(r, undefined, false) ?? middles?.get(r.item) ?? wdPoint(r.fromCoord)) : (wdPoint(r.coord) ?? wdPoint(r.locCoord));
  return { label: !(r.label ?? r.otherLabel), date: !date, place: !place };
}

type Value = { id?: string; time?: string; precision?: number; calendarmodel?: string; latitude?: number; longitude?: number; globe?: string };
type Snak = { snaktype: string; datavalue?: { value: Value } };
type Statement = { mainsnak: Snak; rank: 'preferred' | 'normal' | 'deprecated'; qualifiers?: Record<string, Snak[]> };
type Entity = { id?: string; missing?: string; labels?: Record<string, { value: string }>; sitelinks?: Record<string, { title: string }>; claims?: Record<string, Statement[]> };

/** Julian to proleptic Gregorian through the Julian day number; astronomical years. */
export function julianToGregorian(y: number, m: number, d: number): [number, number, number] {
  const a = Math.floor((14 - m) / 12);
  const jy = y + 4800 - a;
  const jm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * jm + 2) / 5) + 365 * jy + Math.floor(jy / 4) - 32083;
  const b = jdn + 32044;
  const c = Math.floor((4 * b + 3) / 146097);
  const e = b - Math.floor((146097 * c) / 4);
  const f = Math.floor((4 * e + 3) / 1461);
  const g = e - Math.floor((1461 * f) / 4);
  const h = Math.floor((5 * g + 2) / 153);
  return [100 * c + f - 4800 + Math.floor(h / 10), h + 3 - 12 * Math.floor(h / 10), g - Math.floor((153 * h + 2) / 5) + 1];
}

/**
 * An entity-JSON time as the SPARQL rows carry it ("<xsd time>/<precision>"): the JSON counts 1 BCE as -1 where RDF
 * uses 0, and RDF turns Julian dates of day precision into Gregorian ones.
 */
export function jsonTime(v: Value | undefined): string | null {
  const m = v?.time?.match(/^([+-])(\d+)-(\d{2})-(\d{2})T/);
  if (!m || typeof v?.precision !== 'number') return null;
  let year = Number(m[2]) * (m[1] === '-' ? -1 : 1);
  if (year < 0) year += 1;
  let month = Number(m[3]) || 1;
  let day = Number(m[4]) || 1;
  if (v.precision >= 11 && v.calendarmodel?.endsWith('/Q1985786')) [year, month, day] = julianToGregorian(year, month, day);
  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  return `${year < 0 ? '-' : ''}${pad(Math.abs(year), 4)}-${pad(month, 2)}-${pad(day, 2)}T00:00:00Z/${v.precision}`;
}

/** Preferred statements when there are any, else the normal ones; never deprecated (as wdt: reads them). */
const best = (st: Statement[] = []) => {
  const live = st.filter(s => s.rank !== 'deprecated');
  const preferred = live.filter(s => s.rank === 'preferred');
  return preferred.length ? preferred : live;
};
const values = (st: Statement[] | undefined) => best(st).map(s => (s.mainsnak.snaktype === 'value' ? s.mainsnak.datavalue?.value : undefined));
const ids = (st: Statement[] | undefined) => [...new Set(values(st).map(v => v?.id).filter((v): v is string => !!v))];
const times = (st: Statement[] | undefined) => values(st).map(jsonTime).filter((v): v is string => !!v);
const coord = (st: Statement[] | undefined): [number, number] | undefined => {
  const v = values(st).find(v => v?.globe?.endsWith('/Q2') && typeof v.latitude === 'number' && typeof v.longitude === 'number');
  return v ? [Math.round(v.longitude! * 1e6) / 1e6, Math.round(v.latitude! * 1e6) / 1e6] : undefined;
};
/** Earliest or latest date, as statements or qualifying a time statement (often "unknown value" with bounds). */
const bound = (claims: Record<string, Statement[]>, p: string) => {
  const qualified = ['P585', 'P580', 'P571'].flatMap(t => (claims[t] ?? []).filter(s => s.rank !== 'deprecated').flatMap(s => s.qualifiers?.[p] ?? []));
  return [...times(claims[p]), ...qualified.map(q => (q.snaktype === 'value' ? jsonTime(q.datavalue?.value) : null)).filter((v): v is string => !!v)];
};

/** Sitelinks that aren't Wikipedias, as fetch-wikidata.ts skips them. */
const NOT_WIKIPEDIA = new Set(['commons', 'species', 'meta', 'mediawiki', 'wikidata', 'sources', 'outreach', 'wikimania', 'incubator', 'foundation', 'wikifunctions', 'abstract']);

const prune = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length))) as T;

/** The statements recovery reads, and the item's Wikipedia articles and best name. */
export function compactItem(e: Entity): ItemRec {
  const c = e.claims ?? {};
  const sites: Record<string, string> = {};
  for (const [site, link] of Object.entries(e.sitelinks ?? {})) {
    const code = site.match(/^([a-z_]+)wiki$/)?.[1];
    if (code && !NOT_WIKIPEDIA.has(code)) sites[code.replace(/_/g, '-')] = link.title;
  }
  const labels = Object.fromEntries(Object.entries(e.labels ?? {}).map(([l, v]) => [l, v.value]));
  return prune({
    name: pickName(labels, sites) ?? undefined,
    sites: Object.keys(sites).length ? sites : undefined,
    coord: coord(c.P625),
    P276: ids(c.P276),
    P131: ids(c.P131),
    P706: ids(c.P706),
    P17: ids(c.P17),
    P1071: ids(c.P1071),
    parts: [...new Set([...ids(c.P361), ...ids(c.P607)])],
    P585: times(c.P585),
    P580: times(c.P580),
    P582: times(c.P582),
    P571: times(c.P571),
    P1319: bound(c, 'P1319'),
    P1326: bound(c, 'P1326'),
  });
}

export function compactPlace(e: Entity): PlaceRec {
  const c = e.claims ?? {};
  const labels = Object.fromEntries(Object.entries(e.labels ?? {}).map(([l, v]) => [l, v.value]));
  return prune({ name: pickName(labels) ?? undefined, P276: ids(c.P276), P131: ids(c.P131), P706: ids(c.P706), P36: ids(c.P36), P17: ids(c.P17), dissolved: e.claims ? best(c.P576).length > 0 : undefined });
}

class ApiError extends Error {}
const TRANSIENT = /^(maxlag|ratelimited|readonly|internal_api_error)/;

/** get() gives up after about 30 s, and the network here drops for up to a minute under load. */
async function api<T>(url: string, params: Record<string, string>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await get(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params }),
      });
      const body = (await res.json()) as T & { error?: { code: string; info: string } };
      if (body.error) throw new (TRANSIENT.test(body.error.code) ? Error : ApiError)(`${body.error.code}: ${body.error.info}`);
      await sleep(1000);
      return body;
    } catch (e) {
      if (attempt >= 8 || e instanceof ApiError) throw e;
      console.log(`  ${String(e).slice(0, 160)}; again in ${30 * attempt} s`);
      await sleep(30_000 * attempt);
    }
  }
}

const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

function load(): RecoverData {
  if (!existsSync(RECOVER)) return { items: {}, places: {}, articles: {} };
  return JSON.parse(readFileSync(RECOVER, 'utf8')) as RecoverData;
}

function save(data: RecoverData) {
  writeFileSync(`${RECOVER}.tmp`, JSON.stringify(data));
  renameSync(`${RECOVER}.tmp`, RECOVER);
}

/** Entities 50 at a time; a redirected id is kept under the id asked for, a deleted one as empty. */
async function entities(list: string[], props: string, each: (id: string, e: Entity) => void, extra: Record<string, string> = {}, saveEvery?: () => void) {
  let n = 0;
  for (const chunk of chunks(list, 50)) {
    const body = await api<{ entities?: Record<string, Entity & { redirects?: { from: string } }> }>(WIKIDATA, { action: 'wbgetentities', ids: chunk.join('|'), props, ...extra });
    const got = new Map(Object.entries(body.entities ?? {}).map(([k, e]) => [e.redirects?.from ?? k, e]));
    for (const id of chunk) each(id, got.get(id) ?? {});
    if (++n % 10 === 0) {
      saveEvery?.();
      console.log(`  ${Math.min(n * 50, list.length)}/${list.length}`);
    }
  }
  saveEvery?.();
}

/** Places' coordinates from Wikidata's GeoData index of P625, 50 a call. */
async function placeCoords(list: string[]) {
  const out = new Map<string, [number, number]>();
  for (const chunk of chunks(list, 50)) {
    const body = await api<{ query?: { pages?: { title: string; coordinates?: { lat: number; lon: number; globe?: string }[] }[] } }>(WIKIDATA, {
      action: 'query', prop: 'coordinates', coprimary: 'primary', colimit: 'max', titles: chunk.join('|'),
    });
    for (const p of body.query?.pages ?? []) {
      const c = p.coordinates?.find(c => (c.globe ?? 'earth') === 'earth');
      if (c) out.set(p.title, [Math.round(c.lon * 1e6) / 1e6, Math.round(c.lat * 1e6) / 1e6]);
    }
  }
  return out;
}

const LABEL_LANGS = 'en|mul|fr|de|es|it|pt|pl|ru';
/** Steps from an item's place to what that place lies in, when the place has no coordinates of its own. */
const HOPS = 3;

/** Each Wikipedia's article coordinates for the titles given, "lang:title" → [lon, lat, type] or 0. */
async function articleCoords(data: RecoverData, titles: Map<string, Set<string>>) {
  let calls = 0;
  for (const [lang, set] of [...titles].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const todo = [...set].filter(t => data.articles[`${lang}:${t}`] === undefined);
    const host = lang === 'be-x-old' ? 'be-tarask' : lang;
    for (const chunk of chunks(todo, 50)) {
      type Page = { title: string; coordinates?: { lat: number; lon: number; globe?: string; type?: string }[] };
      const body = await api<{ query?: { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[]; pages?: Page[] } }>(`https://${host}.wikipedia.org/w/api.php`, {
        action: 'query', prop: 'coordinates', coprimary: 'primary', coprop: 'type|globe', colimit: 'max', redirects: '1', titles: chunk.join('|'),
      });
      const q = body.query ?? {};
      const moved = new Map([...(q.normalized ?? []), ...(q.redirects ?? [])].map(r => [r.from, r.to]));
      const pages = new Map((q.pages ?? []).map(p => [p.title, p]));
      for (const t of chunk) {
        const normal = moved.get(t) ?? t;
        const c = pages.get(moved.get(normal) ?? normal)?.coordinates?.find(c => (c.globe ?? 'earth') === 'earth');
        data.articles[`${lang}:${t}`] = c ? (c.type ? [c.lon, c.lat, c.type] : [c.lon, c.lat]) : 0;
      }
      if (++calls % 10 === 0) {
        save(data);
        console.log(`  articles: ${calls} calls, at ${lang}`);
      }
    }
  }
  save(data);
}

/** fetch.ts `recover`. Needs `wikidata`, `attacks`, `conflicts` and `sitelinks` first. */
export async function recover() {
  const dir = join(RAW_MORE, 'wikidata');
  const data = load();
  const rows = new Map<string, Row>();
  const need = new Map<string, Wants>();
  const battles = read<Row[]>(join(dir, 'battles.json'));
  const middles = battleMiddles(battles);
  for (const file of FILES) {
    if (!existsSync(join(dir, `${file}.json`))) continue;
    for (const r of read<Row[]>(join(dir, `${file}.json`))) {
      if (!rows.has(r.item)) rows.set(r.item, r);
      // Lexemes and the like, and rows another source owns, aren't events to recover.
      if (!QID.test(r.item) || (EVENTS.has(file) && ownedElsewhere(classes(r)))) continue;
      const w = wants(file, r, file === 'wars' ? middles : undefined);
      if (!w.label && !w.date && !w.place) continue;
      const had = need.get(r.item);
      need.set(r.item, had ? { label: had.label || w.label, date: had.date || w.date, place: had.place || w.place } : w);
    }
  }
  console.log(`recover: ${need.size} items lack a label, date or place (${[...need.values()].filter(w => w.place).length} a place)`);

  await entities([...need.keys()].filter(q => !data.items[q]), 'claims|labels|sitelinks', (id, e) => (data.items[id] = compactItem(e)), {}, () => save(data));

  // Parent wars and campaigns the raw files don't hold, for a battle's war's place or one-year date.
  const parentsOf = (q: string) => [...(rows.get(q)?.wars?.split('|').filter(Boolean) ?? []), ...(data.items[q]?.parts ?? [])];
  const parents = new Set([...need].filter(([, w]) => w.place || w.date).flatMap(([q]) => parentsOf(q)));
  const missing = [...parents].filter(q => !rows.has(q) && !data.items[q]);
  console.log(`recover: ${missing.length} parent items to fetch`);
  await entities(missing, 'claims|labels|sitelinks', (id, e) => (data.items[id] = compactItem(e)), {}, () => save(data));

  const placed = [...need].filter(([, w]) => w.place).map(([q]) => q);
  // The events files name their countries by id: fetched as places so their end dates get checked below.
  const named = [...new Set([...rows.values()].flatMap(r => r.countries?.split('|').map(e => e.split(' ')[0]) ?? []).filter(q => QID.test(q)))];
  let frontier = new Set<string>(named);
  for (const q of placed) {
    const it = data.items[q];
    for (const p of [...(it?.P276 ?? []), ...(it?.P131 ?? []), ...(it?.P706 ?? []), ...(it?.P17 ?? []), ...(it?.P1071 ?? [])]) frontier.add(p);
    for (const parent of parentsOf(q)) for (const p of data.items[parent]?.P276 ?? []) frontier.add(p);
  }
  for (let hop = 0; hop <= HOPS && frontier.size; hop++) {
    const fresh = [...frontier].filter(q => !data.places[q]);
    console.log(`recover: ${fresh.length} places at step ${hop}`);
    const coords = await placeCoords(fresh);
    const bare = fresh.filter(q => !coords.has(q));
    const withCoords = fresh.filter(q => coords.has(q));
    await entities(withCoords, 'labels', (id, e) => (data.places[id] = { ...compactPlace(e), coord: coords.get(id) }), { languages: LABEL_LANGS }, () => save(data));
    await entities(bare, 'labels|claims', (id, e) => (data.places[id] = compactPlace(e)), { languages: LABEL_LANGS }, () => save(data));
    // A coordless place leads on to where it lies; a country to its capital.
    frontier = new Set([...frontier].flatMap(q => (data.places[q]?.coord ? [] : [...(data.places[q]?.P276 ?? []), ...(data.places[q]?.P131 ?? []), ...(data.places[q]?.P706 ?? []), ...(data.places[q]?.P36 ?? [])])));
  }

  // Whether each country has ended (P576): one property of one entity a call, as countries' full claims run to megabytes.
  const countries = [...new Set([...Object.values(data.items), ...Object.values(data.places)].flatMap(e => e.P17 ?? []).concat(named))].filter(q => data.places[q] && data.places[q].dissolved === undefined);
  console.log(`recover: ${countries.length} countries to check for an end date`);
  for (const [i, q] of countries.entries()) {
    const body = await api<{ claims?: Record<string, Statement[]> }>(WIKIDATA, { action: 'wbgetclaims', entity: q, property: 'P576' }).catch(e => {
      if (!(e instanceof ApiError)) throw e;
      console.log(`  ${q}: ${e.message}`);
      return null;
    });
    if (body) data.places[q].dissolved = best(body.claims?.P576).length > 0;
    if ((i + 1) % 50 === 0) {
      save(data);
      console.log(`  ${i + 1}/${countries.length}`);
    }
  }
  save(data);

  const titles = new Map<string, Set<string>>();
  for (const q of placed) {
    const sites = { ...(data.items[q]?.sites ?? {}) };
    const en = enwikiTitle(rows.get(q)?.article);
    if (en && !sites.en) sites.en = en;
    for (const [lang, title] of Object.entries(sites)) titles.set(lang, (titles.get(lang) ?? new Set()).add(title));
  }
  console.log(`recover: article coordinates from ${titles.size} Wikipedias, ${[...titles.values()].reduce((n, s) => n + s.size, 0)} articles`);
  await articleCoords(data, titles);

  // Drop what no current row needs, so a refetched raw file doesn't leave stale items behind.
  const keepItems = new Set([...need.keys(), ...parents]);
  const keepArticles = new Set([...titles].flatMap(([lang, set]) => [...set].map(t => `${lang}:${t}`)));
  data.items = Object.fromEntries(Object.entries(data.items).filter(([q]) => keepItems.has(q)));
  data.articles = Object.fromEntries(Object.entries(data.articles).filter(([k]) => keepArticles.has(k)));
  save(data);
  const n = (f: (w: Wants) => boolean) => [...need.values()].filter(f).length;
  console.log(`recover: ${Object.keys(data.items).length} items, ${Object.keys(data.places).length} places, ${Object.values(data.articles).filter(a => a).length} article coordinates (labels ${n(w => w.label)}, dates ${n(w => w.date)}, places ${n(w => w.place)} wanted)`);
}
