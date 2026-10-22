// The flights and weather tables for place pages: the airports with scheduled flights near each place (OurAirports,
// public domain), its METAR stations, and whether RainViewer's radar mosaic reaches it. Writes
// data/site/topics/flights.json and weather.json, keyed by GeoNames id.
//
//   nice npx tsx tools/site/topics/air-weather.ts
//
// OurAirports' and NOAA's lists and RainViewer's coverage tiles are cached in .cache/site; tiles are fetched one at a
// time, well under RainViewer's 500 a minute.
import { gunzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { TAKIP_USER_AGENT } from '../../../src/lib/core/net/user-agent';
import type { GazetteerFile } from '../../../src/lib/platform/site/places/place';
import type { TopicTable } from '../../../src/lib/platform/site/places/tables';
import type { FlightsRow, WeatherMeta, WeatherRow } from '../../../src/lib/platform/site/places/topics/air-weather-data';
import { csvRows } from './hazards';

const CACHE = join('.cache', 'site');
const STATIONS_URL = 'https://aviationweather.gov/data/cache/stations.cache.json.gz';
const AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
// Opaque black where no radar reaches, clear white where one does.
const COVERAGE_URL = (z: number, x: number, y: number) => `https://tilecache.rainviewer.com/v2/coverage/0/256/${z}/${x}/${y}/0/0_0.png`;
const COVERAGE_ZOOM = 6;
const AIRPORT_KM = 50;
const STATION_KM = 30;

interface Station { icaoId: string | null; site: string; lat: number; lon: number; siteType?: string[] }

interface Airport { iata: string; icao: string; name: string; lat: number; lon: number; large: boolean }

/**
 * The large and medium airports with scheduled passenger flights. NOAA's station priority isn't that: it ranks Newark,
 * LaGuardia, Gatwick and London City below small fields, so they went missing from the pages.
 */
async function scheduledAirports(): Promise<Airport[]> {
  const [head, ...rows] = csvRows((await cached('airports.csv', AIRPORTS_URL)).toString('utf8'));
  const [type, name, lat, lon, scheduled, icao, iata, gps, ident] =
    ['type', 'name', 'latitude_deg', 'longitude_deg', 'scheduled_service', 'icao_code', 'iata_code', 'gps_code', 'ident'].map(c => head.indexOf(c));
  return rows
    .filter(r => r[scheduled] === 'yes' && r[iata] && (r[type] === 'large_airport' || r[type] === 'medium_airport'))
    .map(r => ({ iata: r[iata], icao: r[icao] || r[gps] || r[ident], name: r[name], lat: Number(r[lat]), lon: Number(r[lon]), large: r[type] === 'large_airport' }));
}

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
  const gridOf = <T extends { lat: number; lon: number }>(items: T[]) => {
    const grid = new Map<string, T[]>();
    for (const s of items) {
      const k = `${Math.floor(s.lat)},${Math.floor(s.lon)}`;
      grid.set(k, [...(grid.get(k) ?? []), s]);
    }
    return ([lng, lat]: [number, number]) => {
      const out: T[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) out.push(...grid.get(`${Math.floor(lat) + dy},${Math.floor(lng) + dx}`) ?? []);
      return out;
    };
  };
  const around = gridOf(stations);
  const airportsAround = gridOf(await scheduledAirports());
  const radarAt = radarFinder();
  const generated = new Date().toISOString().slice(0, 10);

  const flights: Record<string, FlightsRow> = {};
  const weather: Record<string, WeatherRow> = {};
  const names: Record<string, string> = {};
  const cities = gazetteer.places.filter(p => p.kind === 'city');
  for (const [i, p] of cities.entries()) {
    const near = around(p.at).map(s => ({ s, km: Math.round(km(p.at, [s.lon, s.lat])) }));
    const reach = airportsAround(p.at).map(a => ({ a, km: Math.round(km(p.at, [a.lon, a.lat])) }))
      .filter(x => x.km <= AIRPORT_KM).sort((a, b) => a.km - b.km);
    // The nearest two whatever their size (London City), then the hubs a short list must not lose (JFK behind Teterboro).
    const airports = [...new Set([...reach.slice(0, 2), ...reach.filter(x => x.a.large).slice(0, 3)])].sort((a, b) => a.km - b.km);
    if (airports.length) flights[p.id] = { airports: airports.map(({ a, km }) => ({ iata: a.iata, icao: a.icao, km, large: a.large })) };
    const metar = near.filter(x => x.km <= STATION_KM).sort((a, b) => a.km - b.km).slice(0, 4);
    for (const { s } of metar) names[s.icaoId!] = s.site;
    for (const { a } of airports) names[a.icao] = a.name;
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
