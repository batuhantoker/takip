// The harbours around each place, for its ports-and-ships page: NGA's World Port Index (Pub. 150, public domain)
// matched to the gazetteer, with the maritime layer's major ports and chokepoints, and how many ships the AIS
// archive heard at each harbour over a sample of hours. Writes data/site/topics/ports.json, keyed by GeoNames id.
//
//   nice npx tsx tools/site/topics/ports.ts [--ais-hours 24] [--cities cities15000.txt]
//
// Places come from data/site/gazetteer.json (tools/site/build-gazetteer.ts), or from a GeoNames cities15000.txt
// before that exists. The Index is cached in .cache/site; the archive is TAKIP_ARCHIVE_DIR or data/archive, and
// without one the table just has no AIS counts. --ais-hours 0 skips it.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hourFile } from '@takip/archive/paths';
import { archivedHours, readSourceHour } from '@takip/archive/reader';
import { CHOKEPOINTS, PORTS } from '../../../src/lib/feeds/maritime/ports';
import type { GazetteerFile } from '../../../src/lib/platform/site/places/place';
import {
  CHOKEPOINT_KM, foldName as fold, MAP_PORT_KM, PORT_KM,
  type HarbourType, type HarbourUse, type MapPortRow, type MapPortType, type PortFacility, type PortRow, type PortsMeta, type PortsRow, type SizeCode,
} from '../../../src/lib/platform/site/places/topics/ports-data';
import type { TopicTable } from '../../../src/lib/platform/site/places/tables';
import { TAKIP_USER_AGENT } from '../../../src/lib/core/net/user-agent';

const OUT = 'data/site/topics/ports.json';
const CACHE = join('.cache', 'site');
// NGA keeps the living database at this key; a new edition may move it (msi.nga.mil/Publications/WPI).
const WPI_URL = 'https://msi.nga.mil/api/publications/download?type=view&key=16920959/SFH00000/UpdatedPub150.csv';
const MAX_PORTS = 5;
const MAP_TYPE_ORDER: MapPortType[] = ['container', 'energy', 'naval'];
/** Sections of a city and abandoned places, which the gazetteer leaves out too. */
const SKIP_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW']);

type Lnglat = [number, number];
interface Candidate { id: number; name: string; names: string[]; at: Lnglat; pop: number }

function km([lng1, lat1]: Lnglat, [lng2, lat2]: Lnglat): number {
  const r = Math.PI / 180;
  return 6371 * Math.hypot((lng2 - lng1) * r * Math.cos(((lat1 + lat2) / 2) * r), (lat2 - lat1) * r);
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Points bucketed by whole degree, for "what is within r km" without scanning everything. */
class Grid<T> {
  private cells = new Map<string, { at: Lnglat; v: T }[]>();
  add(at: Lnglat, v: T) {
    const key = `${Math.floor(at[0])},${Math.floor(at[1])}`;
    (this.cells.get(key) ?? this.cells.set(key, []).get(key)!).push({ at, v });
  }
  near(at: Lnglat, r: number): { v: T; km: number }[] {
    const dy = Math.ceil(r / 111), dx = Math.ceil(r / (111 * Math.max(0.05, Math.cos((at[1] * Math.PI) / 180))));
    const out: { v: T; km: number }[] = [];
    for (let x = Math.floor(at[0]) - dx; x <= Math.floor(at[0]) + dx; x++) {
      for (let y = Math.floor(at[1]) - dy; y <= Math.floor(at[1]) + dy; y++) {
        for (const p of this.cells.get(`${x},${y}`) ?? []) {
          const d = km(at, p.at);
          if (d <= r) out.push({ v: p.v, km: d });
        }
      }
    }
    return out.sort((a, b) => a.km - b.km);
  }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function cached(file: string, url: string): Promise<string> {
  const path = join(CACHE, file);
  if (!existsSync(path)) {
    mkdirSync(CACHE, { recursive: true });
    const res = await fetch(url, { headers: { 'User-Agent': TAKIP_USER_AGENT } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(path, 'utf8').replace(/^﻿/, '');
}

function candidates(citiesFile?: string): Candidate[] {
  if (!citiesFile && existsSync('data/site/gazetteer.json')) {
    const file = JSON.parse(readFileSync('data/site/gazetteer.json', 'utf8')) as GazetteerFile;
    return file.places.filter(p => p.kind === 'city').map(p => ({ id: p.id, name: p.name, names: [p.name, ...Object.values(p.names ?? {})], at: p.at, pop: p.pop }));
  }
  if (!citiesFile) throw new Error('No data/site/gazetteer.json: run tools/site/build-gazetteer.ts, or pass --cities cities15000.txt');
  return readFileSync(citiesFile, 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'))
    .filter(c => !SKIP_CODES.has(c[7]))
    .map(c => ({ id: Number(c[0]), name: c[1], names: [c[1], c[2]], at: [Number(c[5]), Number(c[4])] as Lnglat, pop: Number(c[14]) }));
}

const SIZE: Record<string, SizeCode> = { Large: 'L', Medium: 'M', Small: 'S', 'Very Small': 'V' };
const TYPE: Record<string, HarbourType> = {
  'Coastal (Natural)': 'coastal', 'Coastal (Breakwater)': 'breakwater', 'Coastal (Tide Gates)': 'tide-gates',
  'River (Natural)': 'river', 'River (Basins)': 'river-basins', 'River (Tide Gates)': 'river-tide-gates',
  'Canal or Lake': 'canal-lake', 'Open Roadstead': 'roadstead', 'Typhoon Harbor': 'typhoon',
};
const USE: Record<string, HarbourUse> = { Cargo: 'cargo', Fishing: 'fishing', Ferry: 'ferry', Military: 'military' };
const FACILITY: [string, PortFacility][] = [
  ['Facilities - Container', 'container'], ['Facilities - Ro-Ro', 'roro'], ['Facilities - Solid Bulk', 'dry-bulk'],
  ['Facilities - Liquid Bulk', 'liquid-bulk'], ['Facilities - Oil Terminal', 'oil'], ['Facilities - LNG Terminal', 'lng'],
  ['Facilities - Breakbulk', 'breakbulk'],
];

interface WpiPort { no: number; names: string[]; row: Omit<PortRow, 'h'> }

function worldPorts(csv: string): WpiPort[] {
  const [head, ...rows] = parseCsv(csv);
  const col = (name: string) => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error(`World Port Index: no column "${name}"`);
    return i;
  };
  const get = (r: string[], name: string) => (r[col(name)] ?? '').trim();
  const yes = (r: string[], name: string) => get(r, name) === 'Yes';
  const metres = (r: string[], name: string) => {
    const v = Number(get(r, name));
    return v > 0 ? v : undefined;
  };
  return rows.filter(r => r.length > 1).map(r => {
    const facilities = FACILITY.filter(([c]) => yes(r, c)).map(([, f]) => f);
    if (get(r, 'Repairs') === 'Major') facilities.push('repairs');
    if (['Large', 'Medium'].includes(get(r, 'Dry Dock'))) facilities.push('dry-dock');
    const row: Omit<PortRow, 'h'> = {
      n: get(r, 'Main Port Name'),
      s: SIZE[get(r, 'Harbor Size')],
      t: TYPE[get(r, 'Harbor Type')],
      u: USE[get(r, 'Harbor Use')],
      f: facilities.length ? facilities : undefined,
      d: metres(r, 'Channel Depth (m)'),
      l: metres(r, 'Maximum Vessel Length (m)'),
      i: yes(r, 'Entrance Restriction - Ice') ? 1 : undefined,
      v: yes(r, 'Vessel Traffic Service') ? 1 : undefined,
      at: [round4(Number(get(r, 'Longitude'))), round4(Number(get(r, 'Latitude')))],
    };
    return { no: Number(get(r, 'World Port Index Number')), names: [row.n, ...get(r, 'Alternate Port Name').split(';').map(n => n.trim())].filter(Boolean), row };
  }).filter(p => p.no && Number.isFinite(p.row.at[0]) && Number.isFinite(p.row.at[1]));
}

function round4(v: number) {
  return Math.round(v * 1e4) / 1e4;
}

const bears = (place: Candidate, name: string) => {
  const p = fold(name);
  return !!p && place.names.some(n => {
    const f = fold(n);
    return f.length >= 3 && (p === f || ` ${p} `.includes(` ${f} `));
  });
};

/**
 * Who a harbour is credited to: the nearest place within reach that bears its name, else the strongest pull,
 * population over distance squared. Without this every district of Istanbul would lead with the Port of Istanbul,
 * and plain population would give Gibraltar's harbour to Algeciras.
 */
function claimant(names: string[], at: Lnglat, places: Grid<Candidate>, nameKm: number, popKm: number): number | undefined {
  const byName = places.near(at, nameKm).find(({ v }) => names.some(n => bears(v, n)));
  if (byName) return byName.v.id;
  const pull = (x: { v: Candidate; km: number }) => x.v.pop / Math.max(1, x.km) ** 2;
  return places.near(at, popKm).sort((a, b) => pull(b) - pull(a))[0]?.v.id;
}

/** Different ships heard within PORT_KM of each harbour, over the `hours` fullest archived hours of the last week. */
async function aisHeard(ports: Map<number, Lnglat>, hours: number) {
  const dir = process.env.TAKIP_ARCHIVE_DIR || process.env.OSIRIS_ARCHIVE_DIR || join('data', 'archive');
  // The newest hour is usually still being written.
  const done = (await archivedHours(dir, 'aisstream')).slice(0, -1);
  if (!done.length || hours <= 0) return null;
  const last = done[done.length - 1];
  // The recorder runs only while the app does, so many hours hold a few minutes; a full one is ~300k frames.
  const size = (h: number) => {
    try {
      return statSync(hourFile(dir, 'aisstream', h, 'zstd')).size;
    } catch {
      return 0;
    }
  };
  const picked = done.filter(h => h > last - 7 * 24 * 3_600_000)
    .map(h => ({ h, bytes: size(h) }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, hours)
    .map(x => x.h)
    .sort((a, b) => a - b);
  const grid = new Grid<number>();
  for (const [no, at] of ports) grid.add(at, no);
  const heard = new Map<number, Set<number>>();
  for (const [n, hour] of picked.entries()) {
    let frames = 0;
    for await (const line of readSourceHour(dir, 'aisstream', hour)) {
      const msg = (line as { body?: { MetaData?: { MMSI?: number }; MessageType?: string; Message?: { PositionReport?: { Latitude: number; Longitude: number } } } }).body;
      const report = msg?.MessageType === 'PositionReport' ? msg.Message?.PositionReport : undefined;
      const mmsi = msg?.MetaData?.MMSI;
      if (!report || !mmsi || Math.abs(report.Latitude) > 90 || Math.abs(report.Longitude) > 180) continue;
      frames++;
      for (const { v } of grid.near([report.Longitude, report.Latitude], PORT_KM)) {
        (heard.get(v) ?? heard.set(v, new Set()).get(v)!).add(mmsi);
      }
    }
    console.log(`AIS ${n + 1}/${picked.length}: ${new Date(hour).toISOString().slice(0, 13)}h, ${frames} position reports`);
  }
  return {
    counts: new Map([...ports.keys()].map(no => [no, heard.get(no)?.size ?? 0])),
    sample: { hours: picked.length, from: new Date(picked[0]).toISOString(), to: new Date(picked[picked.length - 1] + 3_600_000).toISOString() },
  };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const places = candidates(arg('cities'));
  const placeGrid = new Grid<Candidate>();
  for (const p of places) placeGrid.add(p.at, p);

  const wpi = worldPorts(await cached('wpi-pub150.csv', WPI_URL));
  const portGrid = new Grid<WpiPort>();
  for (const p of wpi) portGrid.add(p.row.at, p);

  const mapPorts: MapPortRow[] = PORTS.map(p => ({ n: p.name, t: p.type, v: p.volume, r: p.rank, f: p.fleet, at: [p.lng, p.lat], h: 0 }));
  for (const m of mapPorts) m.h = claimant([m.n.replace(/\(.*\)/, ''), /\((.*)\)/.exec(m.n)?.[1] ?? ''], m.at, placeGrid, 40, MAP_PORT_KM) ?? 0;
  const mapGrid = new Grid<number>();
  mapPorts.forEach((m, i) => mapGrid.add(m.at, i));
  const chokepoints = CHOKEPOINTS.map(c => ({ n: c.name, at: [c.lng, c.lat] as Lnglat }));
  const chokeGrid = new Grid<number>();
  chokepoints.forEach((c, i) => chokeGrid.add(c.at, i));

  const rows: Record<string, PortsRow> = {};
  const used = new Map<number, WpiPort>();
  for (const place of places) {
    const homeOfMap = mapPorts.some(m => m.h === place.id);
    const near = portGrid.near(place.at, homeOfMap ? MAP_PORT_KM : PORT_KM);
    if (!near.length) continue;
    const kept = near.length > MAX_PORTS
      ? [...near].sort((a, b) => 'LMSV'.indexOf(a.v.row.s ?? 'V') - 'LMSV'.indexOf(b.v.row.s ?? 'V') || a.km - b.km).slice(0, MAX_PORTS).sort((a, b) => a.km - b.km)
      : near;
    const row: PortsRow = { p: kept.map(({ v, km }) => [v.no, round1(km)]) };
    // Qingdao claims both its container port and the naval base; the page leads with the one it is known for.
    const major = mapGrid.near(place.at, MAP_PORT_KM)
      .map(x => ({ ...x, rank: mapPorts[x.v].h === place.id ? MAP_TYPE_ORDER.indexOf(mapPorts[x.v].t) : 9 }))
      .sort((a, b) => a.rank - b.rank || a.km - b.km)[0];
    if (major) row.m = [major.v, round1(major.km)];
    const choke = chokeGrid.near(place.at, CHOKEPOINT_KM)[0];
    if (choke) row.c = [choke.v, Math.round(choke.km)];
    rows[place.id] = row;
    for (const { v } of kept) used.set(v.no, v);
  }

  const ports: Record<string, PortRow> = {};
  const byId = new Map(places.map(p => [p.id, p]));
  for (const [no, p] of used) {
    const h = claimant(p.names, p.row.at, placeGrid, PORT_KM, PORT_KM) ?? 0;
    const home = byId.get(h);
    // "Bur Sa'id" reads as Port Said on Port Said's page, as the Index's alternate name has it.
    const alt = home && !bears(home, p.names[0]) ? p.names.slice(1).find(n => bears(home, n)) : undefined;
    const n = alt ?? p.row.n;
    ports[no] = { ...p.row, n, h };
  }

  const hours = Number(arg('ais-hours') ?? 24);
  // Major ports go in under negative keys: the map counts its own ships around their coordinates, not the Index's.
  const points = new Map<number, Lnglat>([...[...used].map(([no, p]) => [no, p.row.at] as const), ...mapPorts.map((m, i) => [-1 - i, m.at] as const)]);
  const ais = await aisHeard(points, hours);
  if (ais) {
    for (const [key, n] of ais.counts) {
      if (key >= 0) ports[key].a = n;
      else mapPorts[-1 - key].a = n;
    }
  }

  const downloaded = statSync(join(CACHE, 'wpi-pub150.csv')).mtime.toISOString().slice(0, 10);
  const meta: PortsMeta = { wpi: downloaded, ais: ais?.sample, ports, map: mapPorts, chokepoints };
  const table: TopicTable<PortsRow, PortsMeta> = { generated: new Date().toISOString().slice(0, 10), meta, rows };
  mkdirSync('data/site/topics', { recursive: true });
  const json = `${JSON.stringify(table)}\n`;
  writeFileSync(OUT, json);
  console.log(`wrote ${Object.keys(rows).length} places and ${used.size} harbours to ${OUT} (${Math.round(json.length / 1024)} KB)${ais ? `, AIS from ${ais.sample.hours} hours` : ', no AIS sample'}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
