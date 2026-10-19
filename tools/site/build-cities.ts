// The cities that get a public page at /city/<slug>, and what each page can truthfully say about them:
// its transit operators and how their vehicles are placed, the cameras around it, its airports and METAR
// stations, and whether RainViewer's radar mosaic reaches it. Writes src/lib/platform/site/cities/cities.generated.ts.
//
//   nice npx tsx tools/site/build-cities.ts
//
// Reads public/data/transit/cities.json (tools/transit/build-feeds.ts), the camera catalogue the running app
// saved to .cache/cctv-catalog.json, the boundaries in public/data/boundaries, and two downloads cached in
// .cache/site: NOAA's station list and RainViewer's coverage tiles.
import { gunzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { getAllAirports } from '../../packages/connectors/src/airports';
import { TRANSIT_FEEDS } from '../../src/lib/feeds/transit/catalog';
import { sortModes, type TransitCities, type TransitMode } from '../../src/lib/feeds/transit/modes';
import type { TransitFeed } from '../../src/lib/feeds/transit/select';
import { CITY_RULES, citySlugBase, type CityRecord, type OperatorHow } from '../../src/lib/platform/site/cities/city-record';
import { TAKIP_USER_AGENT } from '../../src/lib/core/net/user-agent';

const OUT = 'src/lib/platform/site/cities/cities.generated.ts';
const CACHE = join('.cache', 'site');
const STATIONS_URL = 'https://aviationweather.gov/data/cache/stations.cache.json.gz';
// Black where no radar reaches, white where one does.
const COVERAGE_URL = (z: number, x: number, y: number) => `https://tilecache.rainviewer.com/v2/coverage/0/256/${z}/${x}/${y}/0/0_0.png`;
const COVERAGE_ZOOM = 6;

type Lnglat = [number, number];
type Ring = Lnglat[];
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };

function km([lng1, lat1]: Lnglat, [lng2, lat2]: Lnglat): number {
  const r = Math.PI / 180;
  const x = (lng2 - lng1) * r * Math.cos(((lat1 + lat2) / 2) * r);
  return 6371 * Math.hypot(x, (lat2 - lat1) * r);
}

function inRing([x, y]: Lnglat, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inGeometry(p: Lnglat, g: Geometry): boolean {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polys.some(([outer, ...holes]) => inRing(p, outer) && !holes.some(h => inRing(p, h)));
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

/** Each state or province, for telling Columbus, Ohio from Columbus, Georgia. */
function regionFinder() {
  const countries = JSON.parse(readFileSync('public/data/boundaries/countries.json', 'utf8')) as { features: { properties: { iso2?: string; iso3?: string } }[] };
  const iso3 = new Map(countries.features.filter(f => f.properties.iso2).map(f => [f.properties.iso2!, f.properties.iso3!]));
  const loaded = new Map<string, { name: string; iso?: string; geometry: Geometry }[]>();
  return (cc: string, at: Lnglat) => {
    const code = iso3.get(cc);
    if (!code) return null;
    if (!loaded.has(code)) {
      const file = `public/data/boundaries/admin1/${code}.json`;
      const fc = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as { features: { properties: { name: string; iso?: string }; geometry: Geometry }[] } : { features: [] };
      loaded.set(code, fc.features.map(f => ({ name: f.properties.name, iso: f.properties.iso, geometry: f.geometry })));
    }
    const hit = loaded.get(code)!.find(r => inGeometry(at, r.geometry));
    if (!hit) return null;
    const short = /^[A-Z]{2}-([A-Z0-9]{1,3})$/.exec(hit.iso ?? '')?.[1];
    return { name: hit.name, code: short };
  };
}

/** Whether RainViewer's coverage tile is lit at the point. */
function radarFinder() {
  const tiles = new Map<string, Promise<{ data: Buffer; width: number; channels: number } | null>>();
  const tile = (x: number, y: number) => {
    const key = `${COVERAGE_ZOOM}-${x}-${y}`;
    if (!tiles.has(key)) {
      tiles.set(key, cached(`coverage-${key}.png`, COVERAGE_URL(COVERAGE_ZOOM, x, y))
        .then(png => sharp(png).raw().toBuffer({ resolveWithObject: true }))
        .then(({ data, info }) => ({ data, width: info.width, channels: info.channels }))
        .catch(e => { console.warn(`  coverage ${key}: ${e}`); return null; }));
    }
    return tiles.get(key)!;
  };
  return async ([lng, lat]: Lnglat): Promise<boolean | null> => {
    const n = 2 ** COVERAGE_ZOOM;
    const fx = ((lng + 180) / 360) * n;
    const r = (lat * Math.PI) / 180;
    const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
    const t = await tile(Math.floor(fx), Math.floor(fy));
    if (!t) return null;
    const px = Math.floor((fx % 1) * t.width), py = Math.floor((fy % 1) * t.width);
    const i = (py * t.width + px) * t.channels;
    return t.data[i] > 127;
  };
}

/** How a feed's vehicles get onto the map, as the transit layer labels them. */
function howOf(feeds: TransitFeed[]): OperatorHow {
  if (feeds.every(f => f.kind === 'scheduled')) return 'timetable';
  if (feeds.every(f => f.kind === 'hafas' || f.kind === 'tfl')) return 'estimated';
  if (feeds.some(f => f.graph || f.kind === 'hafas' || f.kind === 'tfl')) return 'partly';
  return 'live';
}

const cleanCameraName = (name: string) => name.replace(/,\s*\d+$/, '').replace(/\s+/g, ' ').trim();

interface Camera { name: string; lat: number; lng: number; source: string; offline?: boolean }

function cameraGrid(path: string) {
  const regions = (JSON.parse(readFileSync(path, 'utf8')) as { regions: Record<string, Camera[]> }).regions;
  const grid = new Map<string, Camera[]>();
  const key = (lat: number, lng: number) => `${Math.floor(lat * 2)},${Math.floor(lng * 2)}`;
  for (const cams of Object.values(regions)) for (const c of cams) {
    const lat = Number(c.lat), lng = Number(c.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const k = key(lat, lng);
    grid.set(k, [...(grid.get(k) ?? []), { ...c, lat, lng }]);
  }
  return ([lng, lat]: Lnglat, radiusKm: number) => {
    const out: (Camera & { km: number })[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      for (const c of grid.get(key(lat + dy / 2, lng + dx / 2)) ?? []) {
        const d = km([lng, lat], [c.lng, c.lat]);
        if (d <= radiusKm) out.push({ ...c, km: d });
      }
    }
    return out;
  };
}

interface Station { icaoId: string | null; iataId: string | null; site: string; lat: number; lon: number; siteType: string[] }

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const transit = JSON.parse(readFileSync('public/data/transit/cities.json', 'utf8')) as TransitCities;
  const camerasNear = cameraGrid('.cache/cctv-catalog.json');
  const stations = (JSON.parse(gunzipSync(await cached('stations.cache.json.gz', STATIONS_URL)).toString('utf8')) as Station[])
    .filter(s => s.icaoId && s.siteType?.includes('METAR'));
  const airports = getAllAirports();
  const regionAt = regionFinder();
  const radarAt = radarFinder();
  const counted = new Date().toISOString().slice(0, 10);

  const candidates = transit.cities.filter(c => c.vehicles >= CITY_RULES.minVehicles && c.modes.length);
  const records: CityRecord[] = [];
  for (const c of candidates) {
    const at = c.at;
    const cams = camerasNear(at, CITY_RULES.cameraKm);
    const onAir = cams.filter(x => !x.offline);
    const nearAirports = airports
      .map(a => ({ iata: a.iata, icao: a.icao, name: a.name, km: Math.round(km(at, [a.lng, a.lat])) }))
      .filter(a => a.km <= CITY_RULES.airportKm).sort((a, b) => a.km - b.km);
    if (onAir.length < CITY_RULES.minCameras && !nearAirports.length) continue;

    const operators = c.operators.map(name => {
      const feeds = TRANSIT_FEEDS.filter(f => f.name === name && at[0] >= f.bbox[0] - 0.5 && at[0] <= f.bbox[2] + 0.5 && at[1] >= f.bbox[1] - 0.5 && at[1] <= f.bbox[3] + 0.5);
      const modes = sortModes(feeds.flatMap(f => f.modes ?? []));
      const license = feeds.find(f => f.license?.startsWith('http'))?.license;
      return { name, how: feeds.length ? howOf(feeds) : 'live' as OperatorHow, modes, ...(license ? { license } : {}) };
    });

    const bySource = new Map<string, number>();
    for (const x of onAir) bySource.set(x.source, (bySource.get(x.source) ?? 0) + 1);
    const seen = new Set<string>();
    const picks = onAir.sort((a, b) => a.km - b.km).filter(x => {
      const name = cleanCameraName(x.name);
      if (!name || seen.has(name.toLowerCase())) return false;
      seen.add(name.toLowerCase());
      return true;
    }).slice(0, CITY_RULES.cameraPicks).map(x => ({ name: cleanCameraName(x.name), at: [Number(x.lng.toFixed(5)), Number(x.lat.toFixed(5))] as Lnglat, source: x.source }));

    const metar = stations
      .map(s => ({ icao: s.icaoId!, name: s.site, km: Math.round(km(at, [s.lon, s.lat])) }))
      .filter(s => s.km <= CITY_RULES.stationKm).sort((a, b) => a.km - b.km).slice(0, 4);

    const region = regionAt(c.cc, at);
    records.push({
      slug: '',
      name: c.name,
      cc: c.cc,
      ...(region ? { region: region.name, ...(region.code ? { regionCode: region.code } : {}) } : {}),
      at,
      transit: { vehicles: c.vehicles, modes: sortModes(c.modes as TransitMode[]), operators },
      cameras: {
        onAir: onAir.length,
        offAir: cams.length - onAir.length,
        sources: [...bySource].sort((a, b) => b[1] - a[1]),
        picks,
      },
      airports: nearAirports.slice(0, 3),
      metar,
      radar: await radarAt(at),
    });
  }

  // A plain name when it is the only city of that name with transit; otherwise the state or country goes on.
  const names = new Map<string, number>();
  for (const c of transit.cities) names.set(citySlugBase(c.name), (names.get(citySlugBase(c.name)) ?? 0) + 1);
  for (const r of records) {
    const base = citySlugBase(r.name) || citySlugBase(`${r.cc}-${r.at.join("-")}`);
    r.slug = names.get(base)! > 1 ? `${base}-${citySlugBase(r.regionCode ?? r.region ?? r.cc)}` : base;
  }
  const slugs = new Set<string>();
  for (const r of records) {
    if (slugs.has(r.slug)) throw new Error(`two cities would be /city/${r.slug}`);
    slugs.add(r.slug);
  }
  records.sort((a, b) => b.transit.vehicles - a.transit.vehicles);

  writeFileSync(OUT, [
    `// Generated by tools/site/build-cities.ts on ${counted}; transit seen ${transit.generated}. Do not edit; rerun the tool.`,
    `import type { CityRecord } from './city-record';`,
    '',
    `export const CITIES_COUNTED = '${counted}';`,
    `export const TRANSIT_SEEN = '${transit.generated}';`,
    '',
    'export const CITY_RECORDS: CityRecord[] = [',
    ...records.map(r => `  ${JSON.stringify(r)},`),
    '];',
    '',
  ].join('\n'));
  console.log(`wrote ${records.length} cities to ${OUT} (${candidates.length} with ${CITY_RULES.minVehicles}+ vehicles)`);
}

main().catch(e => { console.error(e); process.exit(1); });
