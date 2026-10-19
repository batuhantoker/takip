// The ISS and aurora tables for place pages, keyed by GeoNames id: every city's time zone, and for the aurora the
// corrected geomagnetic latitude of those far enough toward a pole, each with whether its page is indexed
// (src/lib/platform/site/places/topics/sky-rules.ts). Writes data/site/topics/iss.json and aurora.json.
//
//   nice npx tsx tools/site/topics/sky.ts
//
// Reads data/site/gazetteer.json (tools/site/build-gazetteer.ts), GeoNames cities15000 (CC BY 4.0) for the time
// zones the gazetteer leaves out, and IGRF-14 from NOAA NCEI (public domain). Downloads are cached in .cache/site.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TAKIP_USER_AGENT } from '../../../src/lib/core/net/user-agent';
import type { GazetteerFile } from '../../../src/lib/platform/site/places/place';
import type { TopicTable } from '../../../src/lib/platform/site/places/tables';
import type { AuroraMeta, AuroraRow, IssRow } from '../../../src/lib/platform/site/places/topics/sky-data';
import { magneticLatitude, parseIgrf } from '../../../src/lib/platform/site/places/topics/sky-geomag';
import { SKY_RULES, auroraHasPage, auroraIndexCandidate, issIndexCandidate, thinOut, type Spot } from '../../../src/lib/platform/site/places/topics/sky-rules';

const CACHE = join('.cache', 'site');
const GEONAMES_ZIP = 'https://download.geonames.org/export/dump/cities15000.zip';
const IGRF_URL = 'https://www.ngdc.noaa.gov/IAGA/vmod/coeffs/igrf14coeffs.txt';
/** Poleward of this the magnetic latitude is worked out; nearer the equator it can't reach the aurora's 50°. */
const MLAT_FROM_LAT = 30;

interface Row extends Spot { tz: string; mlat: number | null }

async function cached(file: string, url: string): Promise<string> {
  const path = join(CACHE, file);
  if (!existsSync(path)) {
    const res = await fetch(url, { headers: { 'User-Agent': TAKIP_USER_AGENT } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return path;
}

function decimalYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return d.getUTCFullYear() + (d.getTime() - start) / (Date.UTC(d.getUTCFullYear() + 1, 0, 1) - start);
}

/** GeoNames id → time zone, from the same file the gazetteer was built from. */
async function zones(): Promise<Map<number, string>> {
  const local = join('.cache', 'transit', 'cities15000.zip');
  const zip = existsSync(local) ? local : await cached('cities15000.zip', GEONAMES_ZIP);
  const out = new Map<number, string>();
  for (const line of execFileSync('unzip', ['-p', zip], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8').split('\n')) {
    const r = line.split('\t');
    if (r.length >= 18 && r[17]) out.set(Number(r[0]), r[17]);
  }
  return out;
}

function thresholds(rows: Row[]) {
  for (const t of [50, 55, 58, 60, 65]) {
    const over = rows.filter(r => r.mlat != null && Math.abs(r.mlat) >= t);
    const kept = thinOut(over, SKY_RULES.auroraNeighbourKm).size;
    console.log(`  |mlat| ≥ ${t}°: ${over.length} places (${over.filter(r => r.mlat! < 0).length} south), ${kept} after thinning`);
  }
}

const write = <R, M>(name: string, table: TopicTable<R, M>) => writeFileSync(`data/site/topics/${name}.json`, `${JSON.stringify(table)}\n`);

async function main() {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync('data/site/topics', { recursive: true });
  const now = new Date();
  const year = Math.round(decimalYear(now) * 10) / 10;
  const igrf = parseIgrf(readFileSync(await cached('igrf14coeffs.txt', IGRF_URL), 'utf8'), year);
  const tz = await zones();
  const gazetteer = JSON.parse(readFileSync('data/site/gazetteer.json', 'utf8')) as GazetteerFile;

  const rows: Row[] = [];
  let noZone = 0;
  for (const p of gazetteer.places) {
    if (p.kind !== 'city') continue;
    const zone = tz.get(p.id);
    if (!zone) { noZone++; continue; }
    const [lng, lat] = p.at;
    const mlat = Math.abs(lat) >= MLAT_FROM_LAT ? Math.round(magneticLatitude(igrf, lat, lng) * 10) / 10 : null;
    if (mlat != null && !Number.isFinite(mlat)) throw new Error(`${p.name}: the field line did not close`);
    rows.push({ id: p.id, lat, lng, pop: p.pop, tz: zone, mlat });
  }

  const issIndexed = thinOut(rows.filter(issIndexCandidate), SKY_RULES.issNeighbourKm);
  const auroraRows = rows.filter(r => r.mlat != null && auroraHasPage(r.mlat));
  const auroraIndexed = thinOut(auroraRows.filter(r => auroraIndexCandidate(r.mlat!)), SKY_RULES.auroraNeighbourKm);

  const generated = now.toISOString().slice(0, 10);
  const byId = (a: Row, b: Row) => a.id - b.id;
  write<IssRow, never>('iss', {
    generated,
    rows: Object.fromEntries([...rows].sort(byId).map(r => [r.id, { tz: r.tz, ...(issIndexed.has(r.id) ? { index: true as const } : {}) }])),
  });
  write<AuroraRow, AuroraMeta>('aurora', {
    generated,
    meta: { field: `IGRF-14 at ${year.toFixed(1)}` },
    rows: Object.fromEntries(auroraRows.sort(byId).map(r => [r.id, { tz: r.tz, mlat: r.mlat!, ...(auroraIndexed.has(r.id) ? { index: true as const } : {}) }])),
  });

  console.log(`${rows.length} cities${noZone ? `, ${noZone} without a time zone left out` : ''}`);
  console.log(`ISS: ${rows.length} pages, ${issIndexed.size} indexed (${rows.filter(issIndexCandidate).length} before thinning within ${SKY_RULES.issNeighbourKm} km)`);
  console.log(`aurora: ${auroraRows.length} pages, ${auroraIndexed.size} indexed; by threshold:`);
  thresholds(rows);
  console.log('wrote data/site/topics/iss.json and aurora.json');
}

main().catch(e => { console.error(e); process.exit(1); });
