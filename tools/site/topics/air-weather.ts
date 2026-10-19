// The flights and weather tables for place pages: the airports with scheduled flights near each place, its METAR
// stations, and whether RainViewer's radar mosaic reaches it. Writes data/site/topics/flights.json and weather.json,
// keyed by GeoNames id.
//
//   nice npx tsx tools/site/topics/air-weather.ts
//
// NOAA's station list and RainViewer's coverage tiles are cached in .cache/site; tiles are fetched one at a time,
// well under RainViewer's 500 a minute.
import { gunzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { TAKIP_USER_AGENT } from '../../../src/lib/core/net/user-agent';
import type { GazetteerFile } from '../../../src/lib/platform/site/places/place';
import type { TopicTable } from '../../../src/lib/platform/site/places/tables';
import type { FlightsRow, WeatherMeta, WeatherRow } from '../../../src/lib/platform/site/places/topics/air-weather-data';

const CACHE = join('.cache', 'site');
const STATIONS_URL = 'https://aviationweather.gov/data/cache/stations.cache.json.gz';
// Opaque black where no radar reaches, clear white where one does.
const COVERAGE_URL = (z: number, x: number, y: number) => `https://tilecache.rainviewer.com/v2/coverage/0/256/${z}/${x}/${y}/0/0_0.png`;
const COVERAGE_ZOOM = 6;
const AIRPORT_KM = 50;
const STATION_KM = 30;

interface Station { icaoId: string | null; iataId: string | null; site: string; lat: number; lon: number; siteType?: string[]; priority: number | null }

/** NOAA ranks its stations; 0 to 3 are the hubs down to regional airports with scheduled flights. */
const isAirport = (s: Station) => !!s.iataId && s.priority != null && s.priority <= 3 && !!s.siteType?.includes('TAF');

function km([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const r = Math.PI / 180;
  return 6371 * Math.hypot((lng2 - lng1) * r * Math.cos(((lat1 + lat2) / 2) * r), (lat2 - lat1) * r);
}

async function cached(file: string, url: string): Promise<Buffer> {
  const path = join(CACHE, file);
  if (existsSync(path)) return readFileSync(path);
  const res = await fetch(url, { headers: { 'User-Agent': TAKIP_USER_AGENT } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(path, buf);
  return buf;
}

function radarFinder() {
  const tiles = new Map<string, { data: Buffer; width: number; channels: number } | null>();
  return async ([lng, lat]: [number, number]): Promise<boolean | null> => {
    const n = 2 ** COVERAGE_ZOOM;
    const fx = ((lng + 180) / 360) * n;
    const r = (lat * Math.PI) / 180;
    const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
    const key = `${COVERAGE_ZOOM}-${Math.floor(fx)}-${Math.floor(fy)}`;
    if (!tiles.has(key)) {
      const fresh = !existsSync(join(CACHE, `coverage-${key}.png`));
      const tile = await cached(`coverage-${key}.png`, COVERAGE_URL(COVERAGE_ZOOM, Math.floor(fx), Math.floor(fy)))
        .then(png => sharp(png).raw().toBuffer({ resolveWithObject: true }))
        .then(({ data, info }) => ({ data, width: info.width, channels: info.channels }))
        .catch(e => { console.warn(`  coverage ${key}: ${e}`); return null; });
      tiles.set(key, tile);
      if (fresh) await new Promise(res => setTimeout(res, 250));
    }
    const t = tiles.get(key);
    if (!t) return null;
    const i = (Math.floor((fy % 1) * t.width) * t.width + Math.floor((fx % 1) * t.width)) * t.channels;
    return t.data[i] > 127;
  };
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync('data/site/topics', { recursive: true });
  const gazetteer = JSON.parse(readFileSync('data/site/gazetteer.json', 'utf8')) as GazetteerFile;
  const stations = (JSON.parse(gunzipSync(await cached('stations.cache.json.gz', STATIONS_URL)).toString('utf8')) as Station[])
    .filter(s => s.icaoId && s.siteType?.includes('METAR'));
  const grid = new Map<string, Station[]>();
  for (const s of stations) {
    const k = `${Math.floor(s.lat)},${Math.floor(s.lon)}`;
    grid.set(k, [...(grid.get(k) ?? []), s]);
  }
  const around = ([lng, lat]: [number, number]) => {
    const out: Station[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) out.push(...grid.get(`${Math.floor(lat) + dy},${Math.floor(lng) + dx}`) ?? []);
    return out;
  };
  const radarAt = radarFinder();
  const generated = new Date().toISOString().slice(0, 10);

  const flights: Record<string, FlightsRow> = {};
  const weather: Record<string, WeatherRow> = {};
  const names: Record<string, string> = {};
  const cities = gazetteer.places.filter(p => p.kind === 'city');
  for (const [i, p] of cities.entries()) {
    const near = around(p.at).map(s => ({ s, km: Math.round(km(p.at, [s.lon, s.lat])) }));
    const airports = near.filter(x => isAirport(x.s) && x.km <= AIRPORT_KM).sort((a, b) => a.km - b.km).slice(0, 3);
    if (airports.length) flights[p.id] = { airports: airports.map(({ s, km }) => ({ iata: s.iataId!, icao: s.icaoId!, km })) };
    const metar = near.filter(x => x.km <= STATION_KM).sort((a, b) => a.km - b.km).slice(0, 4);
    for (const { s } of [...airports, ...metar]) names[s.icaoId!] = s.site;
    weather[p.id] = { metar: metar.map(({ s, km }) => [s.icaoId!, km]), radar: await radarAt(p.at) };
    if (i % 5000 === 0) console.log(`  ${i}/${cities.length}`);
  }

  const write = <R, M>(name: string, rows: Record<string, R>, meta?: M) => {
    const table: TopicTable<R, M> = { generated, ...(meta ? { meta } : {}), rows };
    writeFileSync(`data/site/topics/${name}.json`, `${JSON.stringify(table)}\n`);
    console.log(`wrote ${Object.keys(rows).length} places to data/site/topics/${name}.json`);
  };
  write<FlightsRow, WeatherMeta>('flights', flights, { stations: names });
  write<WeatherRow, WeatherMeta>('weather', weather, { stations: names });
}

main().catch(e => { console.error(e); process.exit(1); });
