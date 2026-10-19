/*
 * Downloads behind the place pages' reference layers, into RAW_MORE (gitignored); fetch.ts lists them.
 *   deflock: DeFlock's region files, the licence-plate readers mapped on OpenStreetMap (ODbL), worldwide.
 *   us-counties, us-places: the Census Bureau's 2024 boundaries (1:500k), gazetteer and population estimates for
 *   counties and for incorporated places and CDPs (public domain).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAW_MORE } from './context';

const UA = 'TAKIP-history-import/0.1 (+https://takip.dev)';

async function get(url: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } }).catch(() => null);
    if (res?.ok) return Buffer.from(await res.arrayBuffer());
    if (attempt >= 4 || (res && res.status !== 429 && res.status < 500)) throw new Error(`${res?.status ?? 'network error'} ${url}`);
    await new Promise(r => setTimeout(r, 5000 * attempt));
  }
}

export const DEFLOCK_DIR = join(RAW_MORE, 'deflock');
export const US_COUNTIES_DIR = join(RAW_MORE, 'us-counties');
export const US_PLACES_DIR = join(RAW_MORE, 'us-places');

/** One 20° square at a time; the index's version names when DeFlock last read OpenStreetMap. */
export async function deflock() {
  const base = 'https://cdn.deflock.me/regions';
  mkdirSync(DEFLOCK_DIR, { recursive: true });
  const indexBody = await get(`${base}/index.json`);
  const index = JSON.parse(indexBody.toString('utf8')) as { regions: string[]; tile_url: string };
  const version = /[?&]v=(\d+)/.exec(index.tile_url)?.[1];
  // A region that left the index would otherwise be imported again from its old file.
  for (const f of readdirSync(DEFLOCK_DIR)) rmSync(join(DEFLOCK_DIR, f));
  writeFileSync(join(DEFLOCK_DIR, 'index.json'), indexBody);
  let readers = 0;
  for (const region of index.regions) {
    const body = await get(`${base}/${region}.json${version ? `?v=${version}` : ''}`);
    readers += (JSON.parse(body.toString('utf8')) as unknown[]).length;
    writeFileSync(join(DEFLOCK_DIR, `${region.replace('/', '_')}.json`), body);
  }
  console.log(`deflock: ${index.regions.length} regions, ${readers} readers, version ${version}`);
}

async function census(dir: string, urls: string[]) {
  mkdirSync(dir, { recursive: true });
  for (const url of urls) {
    const path = join(dir, url.slice(url.lastIndexOf('/') + 1));
    writeFileSync(path, await get(url));
    if (path.endsWith('.zip')) execFileSync('unzip', ['-o', '-q', path, '-d', dir]);
  }
  console.log(`${urls.length} files in ${dir}`);
}

export const usCounties = () => census(US_COUNTIES_DIR, [
  'https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_500k.zip',
  'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip',
  'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv',
]);

export const usPlaces = () => census(US_PLACES_DIR, [
  'https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_place_500k.zip',
  'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip',
  'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv',
]);
