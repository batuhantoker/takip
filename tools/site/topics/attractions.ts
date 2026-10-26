// The things-to-do table for place pages: museums, castles, palaces, cathedrals, zoos, gardens, parks, squares,
// monuments, fountains, statues, landmarks and World Heritage sites from Wikidata (CC0), read through QLever's endpoint
// (WDQS rate-limits this IP under load). Each has coordinates and articles in at least three Wikipedias (five for
// squares, fountains and statues), and is credited to one city: the strongest pull, population over distance squared,
// within 30 km, as tools/site/topics/ports.ts does for harbours, so a district doesn't repeat its city's list. A
// country lists its own (P17) by notability. Writes data/site/topics/attractions.json keyed by GeoNames id; the
// items sit once in its meta.
//
//   nice npx tsx tools/site/topics/attractions.ts [--offline]
//
// Every QLever answer is cached in .cache/site/attractions, so a rerun resumes and --offline rebuilds from the cache.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { qlever } from '../../import/fetch-events';
import type { Locale } from '../../../src/lib/core/i18n/locales';
import type { GazetteerFile, Place } from '../../../src/lib/platform/site/places/place';
import type { TopicTable } from '../../../src/lib/platform/site/places/tables';
import {
  KINDS, WORLD_HERITAGE, type AttractionItem, type AttractionKind, type AttractionsMeta, type AttractionsRow,
} from '../../../src/lib/platform/site/places/topics/attractions-data';

const OUT = 'data/site/topics/attractions.json';
const GAZETTEER = 'data/site/gazetteer.json';
const CACHE = '.cache/site/attractions';
const LANGS: readonly Locale[] = ['en', 'tr', 'es', 'pt', 'fr', 'de', 'ru', 'ar', 'zh', 'ja'];
const CITY_KM = 30;
const PER_CITY = 40;
const PER_COUNTRY = 40;
const CHUNK = 400;
const offline = process.argv.includes('--offline');

type Binding = Record<string, { value: string; 'xml:lang'?: string }>;
type Raw = { id: string; kind: AttractionKind; at: [number, number]; links: number; cc?: string };

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function cached(key: string, query: string): Promise<Binding[]> {
  const file = join(CACHE, `${createHash('sha1').update(key).digest('hex').slice(0, 16)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as Binding[];
  if (offline) throw new Error(`not cached: ${key.slice(0, 80)}`);
  for (let attempt = 1; ; attempt++) {
    try {
      const rows = (await qlever(query)) as Binding[];
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(file, JSON.stringify(rows));
      return rows;
    } catch (e) {
      if (attempt >= 6) throw e;
      console.log(`  ${(e as Error).message.slice(0, 120)}; again in ${10 * attempt} s`);
      await sleep(10_000 * attempt);
    }
  }
}

const qid = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1);
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

function point(wkt: string): [number, number] | null {
  const m = /POINT\(\s*([-\d.eE]+)\s+([-\d.eE]+)\s*\)/i.exec(wkt);
  const lng = Number(m?.[1]);
  const lat = Number(m?.[2]);
  return m && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [round(lng, 4), round(lat, 4)] : null;
}

function km([aLng, aLat]: [number, number], [bLng, bLat]: [number, number]) {
  const rad = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * rad) / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(((bLng - aLng) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Cities by 1° cell, for "which are within 30 km". */
class Grid {
  private cells = new Map<string, Place[]>();
  constructor(places: Place[]) {
    for (const p of places) {
      const key = `${Math.floor(p.at[0])}:${Math.floor(p.at[1])}`;
      this.cells.set(key, [...(this.cells.get(key) ?? []), p]);
    }
  }
  near(at: [number, number], r: number): { p: Place; km: number }[] {
    const out: { p: Place; km: number }[] = [];
    const span = Math.ceil(r / 111 / Math.max(0.2, Math.cos((at[1] * Math.PI) / 180)));
    for (let dx = -span; dx <= span; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const p of this.cells.get(`${Math.floor(at[0]) + dx}:${Math.floor(at[1]) + dy}`) ?? []) {
          const d = km(at, p.at);
          if (d <= r) out.push({ p, km: d });
        }
      }
    }
    return out;
  }
}

async function kindItems({ kind, classes, minLinks }: (typeof KINDS)[number]): Promise<Raw[]> {
  const rows = await cached(`items:${kind}:${classes.join(',')}:${minLinks}`, `SELECT ?item ?coord ?links ?cc WHERE {
    VALUES ?class { ${classes.map(c => `wd:${c}`).join(' ')} }
    ?item wdt:P31/wdt:P279* ?class .
    ?item wikibase:sitelinks ?links . FILTER(?links >= ${minLinks})
    ?item wdt:P625 ?coord .
    OPTIONAL { ?item wdt:P17 ?country . ?country wdt:P297 ?cc . }
  }`);
  return rows.flatMap(r => {
    const at = point(r.coord.value);
    return at ? [{ id: qid(r.item.value), kind, at, links: Number(r.links.value), cc: r.cc?.value }] : [];
  });
}

async function worldHeritage(): Promise<{ ids: Set<string>; raw: Raw[] }> {
  const rows = await cached('heritage', `SELECT ?item ?coord ?links ?cc WHERE {
    ?item wdt:P1435 wd:${WORLD_HERITAGE} .
    ?item wikibase:sitelinks ?links . FILTER(?links >= 3)
    ?item wdt:P625 ?coord .
    OPTIONAL { ?item wdt:P17 ?country . ?country wdt:P297 ?cc . }
  }`);
  const raw = rows.flatMap(r => {
    const at = point(r.coord.value);
    return at ? [{ id: qid(r.item.value), kind: 'landmark' as const, at, links: Number(r.links.value), cc: r.cc?.value }] : [];
  });
  return { ids: new Set(raw.map(r => r.id)), raw };
}

/**
 * Towns, prefectures and other settlements and administrative areas that are on the World Heritage List or called
 * tourist attractions ("Spa", "Kyoto Prefecture"): places to go, but not things to do in a city.
 */
async function notSights(): Promise<Set<string>> {
  const areas = 'VALUES ?c { wd:Q486972 wd:Q56061 } ?item wdt:P31/wdt:P279* ?c .';
  const heritage = await cached('not-sights:heritage', `SELECT DISTINCT ?item WHERE { ?item wdt:P1435 wd:${WORLD_HERITAGE} . ${areas} }`);
  const attractions = await cached('not-sights:attractions', `SELECT DISTINCT ?item WHERE { ?item wdt:P31/wdt:P279* wd:Q570116 . ${areas} }`);
  return new Set([...heritage, ...attractions].map(r => qid(r.item.value)));
}

async function details(ids: string[]) {
  const names = new Map<string, Partial<Record<Locale, string>>>();
  const wikis = new Map<string, Set<string>>();
  const langs = LANGS.map(l => `"${l}"`).join(',');
  const sites = LANGS.map(l => `<https://${l}.wikipedia.org/>`).join(',');
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const values = `VALUES ?item { ${chunk.map(id => `wd:${id}`).join(' ')} }`;
    const labels = await cached(`labels:${chunk.join(',')}`, `SELECT ?item ?label WHERE { ${values} ?item rdfs:label ?label . FILTER(LANG(?label) IN (${langs})) }`);
    for (const r of labels) {
      const lang = r.label['xml:lang'] as Locale | undefined;
      if (!lang) continue;
      const m = names.get(qid(r.item.value)) ?? {};
      m[lang] = r.label.value;
      names.set(qid(r.item.value), m);
    }
    const links = await cached(`wikis:${chunk.join(',')}`, `SELECT ?item ?wiki WHERE { ${values} ?article schema:about ?item ; schema:isPartOf ?wiki . FILTER(?wiki IN (${sites})) }`);
    for (const r of links) {
      const lang = /^https:\/\/([a-z]+)\.wikipedia\.org\/$/.exec(r.wiki.value)?.[1];
      if (!lang) continue;
      const s = wikis.get(qid(r.item.value)) ?? new Set();
      s.add(lang);
      wikis.set(qid(r.item.value), s);
    }
    if ((i / CHUNK) % 20 === 0) console.log(`  details ${Math.min(i + CHUNK, ids.length)} of ${ids.length}`);
  }
  return { names, wikis };
}

async function main() {
  const gazetteer = JSON.parse(readFileSync(GAZETTEER, 'utf8')) as GazetteerFile;
  const cities = gazetteer.places.filter(p => p.kind === 'city');
  const countries = new Map(gazetteer.places.filter(p => p.kind === 'country').map(p => [p.cc, p]));
  const grid = new Grid(cities);

  // Each item once, as the first kind that claims it; World Heritage marks whatever kind it is.
  const all = new Map<string, Raw>();
  for (const k of KINDS) {
    const items = await kindItems(k);
    console.log(`${k.kind}: ${items.length}`);
    for (const r of items) if (!all.has(r.id)) all.set(r.id, r);
  }
  const heritage = await worldHeritage();
  for (const r of heritage.raw) if (!all.has(r.id)) all.set(r.id, r);
  console.log(`items: ${all.size}, of them World Heritage: ${heritage.ids.size}`);

  const byCity = new Map<number, { id: string; km: number }[]>();
  const creditedTo = new Map<string, number>();
  for (const r of all.values()) {
    const pull = (x: { p: Place; km: number }) => x.p.pop / Math.max(1, x.km) ** 2;
    const best = grid.near(r.at, CITY_KM).sort((a, b) => pull(b) - pull(a))[0];
    if (!best) continue;
    creditedTo.set(r.id, best.p.id);
    byCity.set(best.p.id, [...(byCity.get(best.p.id) ?? []), { id: r.id, km: best.km }]);
  }

  const links = (id: string) => all.get(id)!.links;
  const rows: Record<string, AttractionsRow> = {};
  for (const [cityId, items] of byCity) {
    rows[cityId] = { a: items.sort((a, b) => links(b.id) - links(a.id)).slice(0, PER_CITY).map(x => [x.id, round(x.km, 1)]) };
  }
  const byCountry = new Map<string, Raw[]>();
  for (const r of all.values()) if (r.cc) byCountry.set(r.cc, [...(byCountry.get(r.cc) ?? []), r]);
  for (const [cc, items] of byCountry) {
    const country = countries.get(cc);
    if (!country) continue;
    rows[country.id] = { a: items.sort((a, b) => b.links - a.links).slice(0, PER_COUNTRY).map(r => [r.id, creditedTo.get(r.id) ?? 0]) };
  }

  const used = [...new Set(Object.values(rows).flatMap(r => r.a.map(([id]) => id)))].sort();
  console.log(`used: ${used.length} items in ${Object.keys(rows).length} places`);
  const { names, wikis } = await details(used);

  // Dropped after the details are read, so their cached chunks keep their keys.
  const skip = await notSights();
  const items: Record<string, AttractionItem> = {};
  for (const id of used) {
    if (skip.has(id)) continue;
    const r = all.get(id)!;
    const n = names.get(id) ?? {};
    const en = n.en ?? Object.values(n)[0];
    if (!en) continue;
    const shown: Partial<Record<Locale, string>> = { en };
    for (const l of LANGS) if (l !== 'en' && n[l] && n[l] !== en) shown[l] = n[l];
    items[id] = { k: r.kind, ...(heritage.ids.has(id) ? { h: 1 as const } : {}), l: r.links, at: r.at, n: shown, w: LANGS.filter(l => wikis.get(id)?.has(l)).join(' ') };
  }
  // A row only names items that kept a name.
  for (const [key, row] of Object.entries(rows)) {
    row.a = row.a.filter(([id]) => items[id]);
    if (!row.a.length) delete rows[key];
  }

  const table: TopicTable<AttractionsRow, AttractionsMeta> = { generated: new Date().toISOString(), meta: { items, cityKm: CITY_KM }, rows };
  writeFileSync(OUT, `${JSON.stringify(table)}\n`);

  const strong = Object.entries(rows).filter(([id]) => cities.some(c => String(c.id) === id))
    .map(([, r]) => r.a.filter(([id]) => items[id].l >= 5).length).sort((a, b) => b - a);
  const at = (n: number) => strong.filter(x => x >= n).length;
  console.log(`left out ${used.filter(id => skip.has(id)).length} towns and administrative areas`);
  console.log(`wrote ${OUT}: ${Object.keys(items).length} items; cities with 5+ Wikipedias: >=3 ${at(3)}, >=5 ${at(5)}, >=8 ${at(8)}, >=12 ${at(12)}, >=20 ${at(20)}`);
}

void main();
