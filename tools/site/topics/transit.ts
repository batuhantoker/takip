// The transit table for place pages: for each place the transit layer lists, its operators, what they run and how
// their vehicles reach the map. Writes data/site/topics/transit.json, keyed by GeoNames id.
//
//   npx tsx tools/site/topics/transit.ts
//
// Reads public/data/transit/cities.json (tools/transit/build-feeds.ts), whose cities are GeoNames places, and
// data/site/gazetteer.json (tools/site/build-gazetteer.ts).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { TRANSIT_FEEDS } from '../../../src/lib/feeds/transit/catalog';
import { sortModes, type TransitCities } from '../../../src/lib/feeds/transit/modes';
import type { TransitFeed } from '../../../src/lib/feeds/transit/select';
import type { GazetteerFile } from '../../../src/lib/platform/site/places/place';
import type { TopicTable } from '../../../src/lib/platform/site/places/tables';
import type { OperatorHow, TransitMeta, TransitRow } from '../../../src/lib/platform/site/places/topics/transit-data';

const OUT = 'data/site/topics/transit.json';

/** How a feed's vehicles get onto the map, as the transit layer labels them. */
function howOf(feeds: TransitFeed[]): OperatorHow {
  if (feeds.every(f => f.kind === 'scheduled')) return 'timetable';
  if (feeds.every(f => f.kind === 'hafas' || f.kind === 'tfl')) return 'estimated';
  if (feeds.some(f => f.graph || f.kind === 'hafas' || f.kind === 'tfl')) return 'partly';
  return 'live';
}

const near = (f: TransitFeed, [lng, lat]: [number, number]) =>
  lng >= f.bbox[0] - 0.5 && lng <= f.bbox[2] + 0.5 && lat >= f.bbox[1] - 0.5 && lat <= f.bbox[3] + 0.5;

const transit = JSON.parse(readFileSync('public/data/transit/cities.json', 'utf8')) as TransitCities;
const gazetteer = JSON.parse(readFileSync('data/site/gazetteer.json', 'utf8')) as GazetteerFile;
const key = (cc: string, [lng, lat]: [number, number]) => `${cc}:${lng.toFixed(3)},${lat.toFixed(3)}`;
const cities = gazetteer.places.filter(p => p.kind === 'city');
const byAt = new Map(cities.map(p => [key(p.cc, p.at), p]));
// GeoNames moves a city's point now and then; the same name close by is the same city.
const sameNear = (name: string, cc: string, [lng, lat]: [number, number]) =>
  cities.find(p => p.cc === cc && p.name === name && Math.abs(p.at[0] - lng) < 0.15 && Math.abs(p.at[1] - lat) < 0.15);

const rows: Record<string, TransitRow> = {};
const missing: string[] = [];
const unmatched: string[] = [];
for (const c of transit.cities) {
  if (!c.operators.length) continue;
  const place = byAt.get(key(c.cc, c.at)) ?? sameNear(c.name, c.cc, c.at);
  if (!place) {
    missing.push(`${c.name} ${c.cc}`);
    continue;
  }
  // An operator whose feed can't be found is left out rather than guessed at: how it is placed is what the page claims.
  const operators = c.operators.flatMap(name => {
    const feeds = TRANSIT_FEEDS.filter(f => f.name === name && near(f, c.at));
    if (!feeds.length) {
      unmatched.push(`${name} @ ${c.name}`);
      return [];
    }
    const license = feeds.find(f => f.license?.startsWith('http'))?.license;
    return [{ name, how: howOf(feeds), modes: sortModes(feeds.flatMap(f => f.modes ?? [])), ...(license ? { license } : {}) }];
  });
  if (!operators.length) continue;
  rows[place.id] = { vehicles: c.vehicles, modes: sortModes(c.modes), operators };
}

mkdirSync('data/site/topics', { recursive: true });
const table: TopicTable<TransitRow, TransitMeta> = { generated: new Date().toISOString().slice(0, 10), meta: { seen: transit.generated }, rows };
writeFileSync(OUT, `${JSON.stringify(table)}\n`);
console.log(`wrote ${Object.keys(rows).length} places to ${OUT}${missing.length ? `; not in the gazetteer: ${missing.join(', ')}` : ''}${unmatched.length ? `; no feed found for: ${unmatched.join(', ')}` : ''}`);
