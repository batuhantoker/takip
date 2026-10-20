// The country pairs that get indexed comparison pages (/compare/<a>-vs-<b>): neighbours across a land border (GeoNames'
// countryInfo), every pair among the biggest countries by people or economy, and pairs of big countries in one World
// Bank region. Writes data/site/compare-pairs.json, keyed by GeoNames id (src/lib/platform/site/compare/pairs-data.ts).
//
//   nice npx tsx tools/site/compare-pairs.ts
//
// Reads data/site/gazetteer.json, .cache/site/countryInfo.txt (tools/site/build-gazetteer.ts fetches it), and
// data/db read-only for the regions and GDP, so it runs where the database is.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { ComparePairsFile, PairReason, WorldRegion } from '../../src/lib/platform/site/compare/pairs-data';
import type { GazetteerFile, Place } from '../../src/lib/platform/site/places/place';

const OUT = 'data/site/compare-pairs.json';
/** The biggest this many by people, and by GDP, are all compared with each other. */
const MAJOR = 30;
/** Countries this populous are compared with every other one in their region. */
const REGION_POP = 10_000_000;
const REGIONS: Record<string, WorldRegion> = {
  'Europe & Central Asia (all income levels)': 'eca',
  'Sub-Saharan Africa (all income levels)': 'ssa',
  'Latin America & Caribbean (all income levels)': 'lac',
  'East Asia & Pacific (all income levels)': 'eap',
  'Middle East & North Africa (all income levels)': 'mena',
  'South Asia': 'sas',
  'North America': 'nam',
};

const tsv = (text: string) => text.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));

function neighbours(): [string, string][] {
  return tsv(readFileSync(join('.cache', 'site', 'countryInfo.txt'), 'utf8'))
    .flatMap(r => (r[17] ? r[17].split(',').map(n => [r[0], n] as [string, string]) : []));
}

/** Each country's region by ISO2, and its latest GDP in current US$. */
function fromDb(): { regions: Map<string, WorldRegion>; gdp: Map<string, number> } {
  const catalog = new Database('data/db/catalog.db', { readonly: true, fileMustExist: true });
  const iso2 = new Map((catalog.prepare(`SELECT entity_id AS id, value FROM core_entity_identifier WHERE scheme_id = 12`).all() as { id: number; value: string }[]).map(r => [r.id, r.value]));
  const regions = new Map<string, WorldRegion>();
  for (const r of catalog.prepare(`
    SELECT n.name, m.member_id AS member FROM core_region_member m JOIN core_entity_name n ON n.entity_id = m.group_id
    WHERE m.valid_hi IS NULL
  `).all() as { name: string; member: number }[]) {
    const region = REGIONS[r.name];
    const cc = iso2.get(r.member);
    if (region && cc) regions.set(cc, region);
  }
  catalog.close();
  const history = new Database('data/db/history.db', { readonly: true, fileMustExist: true });
  const gdp = new Map<string, number>();
  for (const r of history.prepare(`
    SELECT s.subject_id AS id, p.v FROM ts_metric m JOIN ts_series s USING (metric_id) JOIN ts_point p USING (series_id)
    WHERE m.code = 'wdi:NY.GDP.MKTP.CD' AND s.subject_type = 'entity' ORDER BY p.t
  `).iterate() as Iterable<{ id: number; v: number }>) {
    const cc = iso2.get(r.id);
    if (cc && Number.isFinite(r.v)) gdp.set(cc, r.v);
  }
  history.close();
  return { regions, gdp };
}

export function choosePairs(countries: Place[], borders: [string, string][], regions: Map<string, WorldRegion>, gdp: Map<string, number>): ComparePairsFile['pairs'] {
  const byCc = new Map(countries.map(c => [c.cc, c]));
  const why = new Map<string, { a: number; b: number; why: Set<PairReason> }>();
  const add = (x: Place, y: Place, reason: PairReason) => {
    if (x.id === y.id) return;
    const [a, b] = x.id < y.id ? [x.id, y.id] : [y.id, x.id];
    const key = `${a}-${b}`;
    if (!why.has(key)) why.set(key, { a, b, why: new Set() });
    why.get(key)!.why.add(reason);
  };
  for (const [x, y] of borders) {
    const a = byCc.get(x), b = byCc.get(y);
    if (a && b) add(a, b, 'border');
  }
  const top = (score: (c: Place) => number) => [...countries].filter(c => score(c) > 0).sort((a, b) => score(b) - score(a)).slice(0, MAJOR);
  const major = [...new Set([...top(c => c.pop), ...top(c => gdp.get(c.cc) ?? 0)])];
  for (const [i, a] of major.entries()) for (const b of major.slice(i + 1)) add(a, b, 'major');
  const big = countries.filter(c => c.pop >= REGION_POP && regions.has(c.cc));
  for (const [i, a] of big.entries()) for (const b of big.slice(i + 1)) if (regions.get(a.cc) === regions.get(b.cc)) add(a, b, 'region');
  const order: PairReason[] = ['border', 'major', 'region'];
  return [...why.values()].sort((x, y) => x.a - y.a || x.b - y.b).map(p => [p.a, p.b, order.filter(r => p.why.has(r))]);
}

function main() {
  const gazetteer = JSON.parse(readFileSync('data/site/gazetteer.json', 'utf8')) as GazetteerFile;
  const countries = gazetteer.places.filter(p => p.kind === 'country');
  const { regions, gdp } = fromDb();
  const pairs = choosePairs(countries, neighbours(), regions, gdp);
  const file: ComparePairsFile = {
    generated: new Date().toISOString().slice(0, 10),
    regions: Object.fromEntries([...regions].filter(([cc]) => countries.some(c => c.cc === cc)).sort()),
    pairs,
  };
  writeFileSync(OUT, `${JSON.stringify(file)}\n`);
  const count = (r: PairReason) => pairs.filter(p => p[2].includes(r)).length;
  console.log(`wrote ${pairs.length} pairs (border ${count('border')}, major ${count('major')}, region ${count('region')}) to ${OUT}`);
}

if (process.argv[1]?.endsWith('compare-pairs.ts')) main();
