// The plate-reader table for place pages: the licence-plate readers (ALPR) mapped on OpenStreetMap in each city of the
// US and Canada, and in each US county and state, from the `alpr` layer in data/db. Writes data/site/topics/alpr.json,
// keyed by place id, holding only places with a reader.
//
//   npm run import -- seed us-counties deflock-alpr     (after `npx tsx tools/import/fetch.ts us-counties deflock`)
//   npx tsx tools/site/topics/alpr.ts
//
// Reads data/db, so it runs where the database is (the Mac), and data/site/gazetteer.json with
// data/site/us-areas.json (tools/site/build-us-areas.ts). A US city or town with a Census place counts the readers
// inside it; any other city is credited the readers nearest it relative to its size, among those no limits claim.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataLayout, openReader } from '@takip/db';
import type { AlprProps } from '../../import/datasets/deflock';
import { layerFeatures } from '../../import/layers';
import { ALPR_EXTRACTS } from '../../../src/lib/feeds/cameras/alpr-layers';
import { allPlaces } from '../../../src/lib/platform/site/places/gazetteer';
import type { Place } from '../../../src/lib/platform/site/places/place';
import type { TopicTable } from '../../../src/lib/platform/site/places/tables';
import { ALPR_INDEX, alprKm, FLOCK, type AlprMeta, type AlprPick, type AlprRow } from '../../../src/lib/platform/site/places/topics/alpr-data';
import { countyPlaceId, statePlaceId, townGeoid, type UsAreasFile } from '../../../src/lib/platform/site/places/us-areas';

const OUT = 'data/site/topics/alpr.json';
/** The extracts' boxes reach into Mexico and the Bahamas, whose readers the map's tiles don't hold. */
const COUNTRIES = new Set(['US', 'CA', 'PR', 'VI']);
const PICKS = 6;
const AREAS = 25;
const DENSE = 10;
/** Below this a county's few readers make a per-resident figure that says nothing. */
const DENSE_POP = 50_000;

interface Reader { id: number; at: [number, number]; maker?: string; op?: string; dirs?: number[]; county?: string; place?: string }

function km([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const x = (lng2 - lng1) * 111.32 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot(x, (lat2 - lat1) * 110.574);
}

const inExtract = ([lng, lat]: [number, number]) => ALPR_EXTRACTS.some(({ bounds: [w, s, e, n] }) => lng >= w && lng <= e && lat >= s && lat <= n);

function tally(values: (string | undefined)[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const pick = (r: Reader, within?: number): AlprPick => ({
  id: r.id,
  at: [Number(r.at[0].toFixed(5)), Number(r.at[1].toFixed(5))],
  ...(r.maker ? { maker: r.maker } : {}),
  ...(r.op ? { op: r.op } : {}),
  ...(r.dirs?.length ? { dirs: r.dirs } : {}),
  ...(within ? { within } : {}),
});

function readers(): { readers: Reader[]; asOf: string } {
  const layout = dataLayout(join(process.cwd(), 'data'));
  const catalog = openReader(layout.catalog);
  if (!catalog) throw new Error('no data/db/catalog.db; run the imports first');
  try {
    const features = layerFeatures(layout, catalog, 'alpr');
    if (!features) throw new Error('no alpr layer; run `npm run import -- seed us-counties deflock-alpr`');
    const version = catalog.prepare(`
      SELECT d.version FROM meta_dataset d JOIN meta_source s USING (source_id) WHERE s.code = 'deflock-alpr' AND d.status = 'active'
    `).pluck().get() as string;
    return {
      asOf: new Date(Number(version) * 1000).toISOString(),
      readers: features.flatMap(f => {
        if (f.geom.type !== 'Point') return [];
        const p = f.props as AlprProps;
        const at = f.geom.coordinates as [number, number];
        return [{ id: Number(f.sourceRecordId?.replace('node/', '')), at, maker: p.maker, op: p.operator, dirs: p.dirs, county: p.county, place: p.place }];
      }),
    };
  } finally {
    catalog.close();
  }
}

function row(list: Reader[], picks: Reader[] | undefined, extra: Partial<AlprRow>, within?: (r: Reader) => number | undefined): AlprRow {
  return {
    n: list.length,
    flock: list.filter(r => r.maker === FLOCK).length,
    dir: list.filter(r => r.dirs?.length).length,
    makers: tally(list.map(r => r.maker)),
    opN: list.filter(r => r.op).length,
    ops: tally(list.map(r => r.op)),
    rank: 0,
    of: 0,
    ...extra,
    ...(picks ? { picks: picks.slice(0, PICKS).map(r => pick(r, within?.(r))) } : {}),
  };
}

/** Ranks rows among their peers, most readers first, the more populous first on a tie. */
function rank(rows: Record<string, AlprRow>, groups: Map<string, Place[]>) {
  for (const peers of groups.values()) {
    const ranked = peers.filter(p => rows[p.id]).sort((a, b) => rows[b.id].n - rows[a.id].n || b.pop - a.pop);
    ranked.forEach((p, i) => Object.assign(rows[p.id], { rank: i + 1, of: ranked.length }));
  }
}

const newestFirst = (list: Reader[]) => [...list].sort((a, b) => b.id - a.id);
const byCount = (m: Map<number, number>): [number, number][] => [...m].sort((a, b) => b[1] - a[1]).slice(0, AREAS);

function main() {
  const { readers: all, asOf } = readers();
  const places = allPlaces();
  const byId = new Map(places.map(p => [p.id, p]));
  const { limits } = JSON.parse(readFileSync('data/site/us-areas.json', 'utf8')) as UsAreasFile;
  const byGeoid = new Map<string, number>([
    ...Object.entries(limits).map(([id, l]): [string, number] => [l.geoid, Number(id)]),
    ...places.filter(p => p.kind === 'town').map((p): [string, number] => [townGeoid(p.id), p.id]),
  ]);
  const bound = (id: number): AlprRow['bound'] => (byId.get(id)?.kind === 'town' ? 'limits' : limits[id] ? (limits[id].cdp ? 'cdp' : 'limits') : undefined);
  const cities = places.filter(p => p.kind === 'city');
  const cell = (lng: number, lat: number) => `${Math.floor(lng * 2)},${Math.floor(lat * 2)}`;
  const grid = new Map<string, Place[]>();
  for (const p of cities) grid.set(cell(...p.at), [...(grid.get(cell(...p.at)) ?? []), p]);
  // Half-degree cells: one ring out covers the 25 km reach as far north as 60°.
  const around = ([lng, lat]: [number, number]) => {
    const out: Place[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(...(grid.get(cell(lng + dx / 2, lat + dy / 2)) ?? []));
    return out;
  };

  const byCity = new Map<number, { r: Reader; d: number }[]>();
  const byCounty = new Map<number, Reader[]>();
  const byState = new Map<number, Reader[]>();
  const byCountry = new Map<string, Reader[]>();
  let abroad = 0;
  for (const r of all) {
    if (!inExtract(r.at)) continue;
    const near = around(r.at).map(place => ({ place, d: km(r.at, place.at) })).sort((a, b) => a.d - b.d);
    // In the US and Puerto Rico the county boundary says where a reader is; elsewhere the nearest town does.
    const cc = r.county ? (r.county.startsWith('72') ? 'PR' : 'US') : near[0]?.place.cc;
    if (!cc || !COUNTRIES.has(cc)) {
      abroad++;
      continue;
    }
    byCountry.set(cc, [...(byCountry.get(cc) ?? []), r]);
    const county = r.county && byId.get(countyPlaceId(r.county));
    if (county) {
      byCounty.set(county.id, [...(byCounty.get(county.id) ?? []), r]);
      const state = byId.get(statePlaceId(r.county!.slice(0, 2)));
      if (state) byState.set(state.id, [...(byState.get(state.id) ?? []), r]);
    }
    const within = r.place ? byGeoid.get(r.place) : undefined;
    if (within) {
      byCity.set(within, [...(byCity.get(within) ?? []), { r, d: km(r.at, byId.get(within)!.at) }]);
      continue;
    }
    let best: { place: Place; d: number } | undefined;
    for (const c of near) {
      const reach = alprKm(c.place.pop);
      // A city with limits has its readers already; the radius is for the rest.
      if (c.place.cc !== cc || limits[c.place.id] || c.d > reach) continue;
      if (!best || c.d / reach < best.d / alprKm(best.place.pop)) best = c;
    }
    if (best) byCity.set(best.place.id, [...(byCity.get(best.place.id) ?? []), { r, d: best.d }]);
  }

  const rows: Record<string, AlprRow> = {};
  const cityOfReader = new Map<number, number>();
  for (const [id, list] of byCity) {
    const place = byId.get(id)!;
    for (const { r } of list) cityOfReader.set(r.id, id);
    const nearest = [...list].sort((a, b) => a.d - b.d).map(x => x.r);
    const b = bound(id);
    rows[id] = row(list.map(x => x.r), list.length >= ALPR_INDEX[place.kind] ? nearest : undefined, b ? { bound: b } : { r: alprKm(place.pop) });
  }
  const townOf = (r: Reader) => cityOfReader.get(r.id);
  const placeOf = (r: Reader) => townOf(r) ?? (r.county && byId.has(countyPlaceId(r.county)) ? countyPlaceId(r.county) : undefined);
  /** The cities and towns that hold the most of `list`; a city counted by reach can take readers over a state line. */
  const citiesOf = (list: Reader[], admin1?: string) => {
    const counts = new Map<number, number>();
    for (const r of list) {
      const city = townOf(r);
      if (city && (!admin1 || byId.get(city)!.admin1 === admin1)) counts.set(city, (counts.get(city) ?? 0) + 1);
    }
    return byCount(counts);
  };
  const denseOf = (areas: Map<number, number>, floor: number): [number, number][] => [...areas]
    .filter(([id]) => (byId.get(id)?.pop ?? 0) >= floor)
    .sort((a, b) => b[1] / byId.get(b[0])!.pop - a[1] / byId.get(a[0])!.pop)
    .slice(0, DENSE);
  for (const [id, list] of byCounty) {
    const towns = new Map<number, number>();
    for (const r of list) {
      const city = townOf(r);
      if (city) towns.set(city, (towns.get(city) ?? 0) + 1);
    }
    rows[id] = row(list, list.length >= ALPR_INDEX.county ? newestFirst(list) : undefined, { areas: byCount(towns) }, townOf);
  }
  for (const [id, list] of byState) {
    const counties = new Map<number, number>();
    for (const r of list) counties.set(countyPlaceId(r.county!), (counties.get(countyPlaceId(r.county!)) ?? 0) + 1);
    rows[id] = row(list, newestFirst(list), { areas: byCount(counties), cities: citiesOf(list, byId.get(id)!.admin1), dense: denseOf(counties, DENSE_POP) }, placeOf);
  }
  for (const [cc, list] of byCountry) {
    const country = places.find(p => p.kind === 'country' && p.cc === cc);
    if (!country) continue;
    const states = new Map<number, number>();
    for (const r of list) {
      const state = r.county && byId.get(statePlaceId(r.county.slice(0, 2)));
      if (state) states.set(state.id, (states.get(state.id) ?? 0) + 1);
    }
    const parts = states.size ? { areas: [...states].sort((a, b) => b[1] - a[1]), dense: denseOf(states, 1) } : {};
    rows[country.id] = row(list, newestFirst(list), { ...parts, cities: citiesOf(list) }, placeOf);
  }

  const groupBy = (kind: Place['kind'], key: (p: Place) => string) => {
    const g = new Map<string, Place[]>();
    for (const p of places) if (p.kind === kind) g.set(key(p), [...(g.get(key(p)) ?? []), p]);
    return g;
  };
  rank(rows, groupBy('city', p => p.cc));
  rank(rows, groupBy('town', p => p.cc));
  rank(rows, groupBy('county', p => p.cc));
  rank(rows, groupBy('state', p => p.cc));
  rank(rows, groupBy('country', () => 'all'));

  mkdirSync('data/site/topics', { recursive: true });
  const table: TopicTable<AlprRow, AlprMeta> = { generated: new Date().toISOString().slice(0, 10), meta: { asOf }, rows };
  const text = `${JSON.stringify(table)}\n`;
  writeFileSync(OUT, text);
  const kinds = Object.keys(rows).map(id => byId.get(Number(id))!.kind);
  const indexed = Object.entries(rows).filter(([id, r]) => r.n >= ALPR_INDEX[byId.get(Number(id))!.kind]).length;
  console.log(`${all.length} readers; ${abroad} in the extracts' boxes but abroad`);
  console.log(`rows: ${['city', 'town', 'county', 'state', 'country'].map(k => `${kinds.filter(x => x === k).length} ${k}`).join(', ')}; ${indexed} indexed`);
  console.log(`wrote ${OUT} (${(text.length / 1e6).toFixed(1)} MB), DeFlock as of ${asOf}`);
}

main();
