// Every GeoNames place of 1,000 people or more (CC BY 4.0), for naming the point under the map's pointer without
// queueing for Nominatim (apps/api/src/v1/geo/nearest-place.ts). Writes data/site/towns.json: one town a line, its
// region by index into `regions`, coordinates to about 100 m.
//
//   npx tsx tools/site/build-towns.ts

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'data/site/towns.json';
const CACHE = join('.cache', 'site');
const GEONAMES = 'https://download.geonames.org/export/dump';
const UA = 'TAKIP-site-pages/0.1 (https://takip.dev; hello@takip.dev)';
/** Sections of a city, historical and abandoned places: never what a point is called. */
const SKIP_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW']);

async function cached(file: string): Promise<string> {
  const path = join(CACHE, file);
  if (!existsSync(path)) {
    const res = await fetch(`${GEONAMES}/${file}`, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} ${file}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return path;
}

const tsv = (text: string) => text.split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));
const round = (v: string) => Math.round(Number(v) * 1000) / 1000;

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const rows = tsv(execFileSync('unzip', ['-p', await cached('cities1000.zip')], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8'));
  const admin1 = new Map(tsv(readFileSync(await cached('admin1CodesASCII.txt'), 'utf8')).map(r => [r[0], r[1]]));

  const regions: string[] = [];
  const regionIndex = new Map<string, number>();
  const indexOf = (name: string | undefined) => {
    if (!name) return -1;
    if (!regionIndex.has(name)) regionIndex.set(name, regions.push(name) - 1);
    return regionIndex.get(name)!;
  };
  const towns = rows
    .filter(r => !SKIP_CODES.has(r[7]) && Number(r[14]) > 0)
    .map(r => [r[1], indexOf(admin1.get(`${r[8]}.${r[10]}`)), r[8], round(r[4]), round(r[5]), Number(r[14])] as const)
    .sort((a, b) => b[5] - a[5]);

  const head = { generated: new Date().toISOString().slice(0, 10), source: 'GeoNames cities1000 (CC BY 4.0)', regions };
  const body = towns.map(t => JSON.stringify(t)).join(',\n');
  writeFileSync(OUT, `${JSON.stringify(head).slice(0, -1)},"towns":[\n${body}\n]}\n`);
  console.log(`${towns.length} towns, ${regions.length} regions → ${OUT}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
