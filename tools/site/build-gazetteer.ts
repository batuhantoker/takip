// The places that public pages can be about: every town and city of 15,000 people or more from GeoNames
// (CC BY 4.0), and every country, each with its name in TAKIP's languages from Wikidata (CC0) where it differs
// from the English. Writes data/site/gazetteer.json.
//
//   nice npx tsx tools/site/build-gazetteer.ts [--refresh-names]
//
// Downloads are kept in .cache/site. Wikidata is asked one batch at a time: this IP is rate-limited after
// parallel queries.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '../../src/lib/core/i18n/locales';
import { placeSlugBase } from '../../src/lib/platform/site/places/place';
import type { GazetteerFile, Place } from '../../src/lib/platform/site/places/place';

const OUT = 'data/site/gazetteer.json';
const CACHE = join('.cache', 'site');
const GEONAMES = 'https://download.geonames.org/export/dump';
const UA = 'TAKIP-site-pages/0.1 (https://takip.dev; hello@takip.dev)';
const BATCH = 300;
/** Sections of a city, historical and abandoned places: not places a visitor looks up. */
const SKIP_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW']);
/** Wikidata's label languages for ours; Chinese prefers the simplified label. */
const WIKI_LANGS: Record<string, string[]> = { tr: ['tr'], es: ['es'], pt: ['pt-br', 'pt'], fr: ['fr'], de: ['de'], ru: ['ru'], ar: ['ar'], zh: ['zh-hans', 'zh-cn', 'zh'], ja: ['ja'] };

async function get(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...init.headers } }).catch(e => {
      if (attempt >= 4) throw e;
      return null;
    });
    if (res?.ok) return res;
    if (res && (attempt >= 4 || (res.status !== 429 && res.status < 500))) throw new Error(`${res.status} ${url}`);
    await new Promise(r => setTimeout(r, 10_000 * attempt));
  }
}

async function cached(file: string, url: string): Promise<string> {
  const path = join(CACHE, file);
  if (!existsSync(path)) writeFileSync(path, Buffer.from(await (await get(url)).arrayBuffer()));
  return path;
}

const tsv = (text: string) => text.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));

/** Wikidata labels by GeoNames id, in our languages. */
async function labels(ids: string[], refresh: boolean): Promise<Record<string, Record<string, string>>> {
  const path = join(CACHE, 'wikidata-labels.json');
  const known: Record<string, Record<string, string>> = !refresh && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const todo = ids.filter(id => !(id in known));
  const langs = [...new Set(Object.values(WIKI_LANGS).flat())].map(l => `"${l}"`).join(',');
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const query = `SELECT ?gn ?label WHERE { VALUES ?gn { ${batch.map(id => `"${id}"`).join(' ')} } ?item wdt:P1566 ?gn . ?item rdfs:label ?label . FILTER(LANG(?label) IN (${langs})) }`;
    const res = await get('https://query.wikidata.org/sparql', {
      method: 'POST',
      headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ query }),
    });
    const rows = ((await res.json()) as { results: { bindings: { gn: { value: string }; label: { value: string; 'xml:lang': string } }[] } }).results.bindings;
    for (const id of batch) known[id] = {};
    for (const r of rows) known[r.gn.value][r.label['xml:lang']] = r.label.value;
    writeFileSync(path, JSON.stringify(known));
    console.log(`  wikidata ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
    await new Promise(r => setTimeout(r, 1500));
  }
  return known;
}

/** Wikidata tells same-named places apart in the label ("Zeytinburnu (ilçe)", "Hatta, Dubai"); the page does that itself. */
function cleanLabel(label: string, english: string): string {
  const bare = label.replace(/\s*[(（][^()（）]*[)）]\s*$/, '');
  return (/[,،，]/.test(english) ? bare : bare.split(/\s*[,،，]\s*/)[0]).trim() || label;
}

/** Our locale → the label, only where it differs from the English name. */
function names(english: string, wiki: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!wiki) return undefined;
  const out: Record<string, string> = {};
  for (const locale of LOCALES) {
    if (locale === 'en') continue;
    const raw = WIKI_LANGS[locale].map(l => wiki[l]).find(Boolean);
    const label = raw && cleanLabel(raw, english);
    if (label && label !== english) out[locale] = label;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The most populous place keeps the plain slug; the others take their region, then their country. */
function assignSlugs(places: Place[], countryNames: Map<string, string>) {
  const taken = new Set<string>();
  const byPop = [...places].sort((a, b) => b.pop - a.pop || a.id - b.id);
  for (const p of byPop) {
    const base = placeSlugBase(p.name) || String(p.id);
    const region = placeSlugBase(p.region ?? '');
    const country = placeSlugBase(countryNames.get(p.cc) ?? p.cc);
    const options = [base, region && region !== base ? `${base}-${region}` : '', `${base}-${country}`, `${base}-${region}-${country}`, `${base}-${p.id}`];
    p.slug = options.find(s => s && !s.endsWith('-') && !s.includes('--') && !taken.has(s))!;
    taken.add(p.slug);
  }
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync('data/site', { recursive: true });
  const refresh = process.argv.includes('--refresh-names');

  const zip = existsSync(join('.cache', 'transit', 'cities15000.zip')) ? join('.cache', 'transit', 'cities15000.zip') : await cached('cities15000.zip', `${GEONAMES}/cities15000.zip`);
  const rows = tsv(execFileSync('unzip', ['-p', zip], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8'));
  const admin1Rows = tsv(readFileSync(await cached('admin1CodesASCII.txt', `${GEONAMES}/admin1CodesASCII.txt`), 'utf8'));
  const admin1 = new Map(admin1Rows.map(r => [r[0], r[1]]));
  const countries = tsv(readFileSync(await cached('countryInfo.txt', `${GEONAMES}/countryInfo.txt`), 'utf8'));

  const cities: Place[] = rows.filter(r => !SKIP_CODES.has(r[7]) && Number(r[14]) > 0).map(r => ({
    id: Number(r[0]), kind: 'city' as const, slug: '', name: r[1], cc: r[8],
    ...(admin1.get(`${r[8]}.${r[10]}`) ? { region: admin1.get(`${r[8]}.${r[10]}`)!, admin1: `${r[8]}.${r[10]}` } : {}),
    ...(/^[A-Z0-9]{1,3}$/.test(r[10]) && r[8] === 'US' ? { regionCode: r[10] } : {}),
    at: [Number(Number(r[5]).toFixed(4)), Number(Number(r[4]).toFixed(4))] as [number, number],
    pop: Number(r[14]),
  }));
  const boundaries = JSON.parse(readFileSync('public/data/boundaries/countries.json', 'utf8')) as { features: { properties: { iso2?: string; label?: [number, number] } }[] };
  const labelAt = new Map(boundaries.features.filter(f => f.properties.iso2 && f.properties.label).map(f => [f.properties.iso2!, f.properties.label!]));
  const countryPlaces: Place[] = countries.filter(r => r[16] && labelAt.has(r[0])).map(r => ({
    id: Number(r[16]), kind: 'country' as const, slug: '', name: r[4], cc: r[0],
    at: labelAt.get(r[0])!.map(v => Number(v.toFixed(4))) as [number, number], pop: Number(r[7]) || 0,
    ...(Number(r[6]) > 0 ? { area: Number(r[6]) } : {}),
  }));

  const used = new Set(cities.map(c => c.admin1).filter(Boolean));
  const regionRows = admin1Rows.filter(r => used.has(r[0]) && r[3]);
  const wiki = await labels([...cities, ...countryPlaces].map(p => String(p.id)).concat(regionRows.map(r => r[3])), refresh);
  for (const p of [...cities, ...countryPlaces]) {
    const n = names(p.name, wiki[String(p.id)]);
    if (n) p.names = n;
  }
  const regions: GazetteerFile['regions'] = {};
  for (const r of regionRows) {
    const n = names(r[1], wiki[r[3]]);
    if (n) regions[r[0]] = n;
  }
  const countryNames = new Map(countryPlaces.map(c => [c.cc, c.name]));
  assignSlugs(cities, countryNames);
  assignSlugs(countryPlaces, countryNames);

  const file: GazetteerFile = { generated: new Date().toISOString().slice(0, 10), regions, places: [...countryPlaces, ...cities] };
  writeFileSync(OUT, `${JSON.stringify(file)}\n`);
  console.log(`wrote ${cities.length} cities and ${countryPlaces.length} countries to ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
