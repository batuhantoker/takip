// US states, counties and towns as places for the public pages: data/site/us-areas.json, merged into the gazetteer
// by lib/platform/site/places/gazetteer.ts. From the us-counties, us-places and alpr layers in data/db (Census 2024
// boundaries, gazetteers and estimates; `npm run import -- seed us-counties us-places deflock-alpr`), so it runs
// where the database is.
//
//   npx tsx tools/site/build-us-areas.ts
//
// Also finds, for each US city of data/site/gazetteer.json, the county it lies in (its breadcrumbs) and the Census
// place that is the city (its limits). Towns are the incorporated places with no such city and something to show:
// a plate reader inside, the one topic that covers towns. Puerto Rico's municipios have no estimate and are left out.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataLayout, openReader } from '@takip/db';
import type { AlprProps } from '../import/datasets/deflock';
import type { CountyProps } from '../import/datasets/us-counties';
import type { UsPlaceProps } from '../import/datasets/us-places';
import { layerFeatures, polygonLocator, type LayerFeature } from '../import/layers';
import { placeSlugBase, type GazetteerFile, type Place } from '../../src/lib/platform/site/places/place';
import { countyPlaceId, statePlaceId, townPlaceId, type UsAreasFile } from '../../src/lib/platform/site/places/us-areas';

const OUT = 'data/site/us-areas.json';
const GAZETTEER = 'data/site/gazetteer.json';
const KM2_PER_SQMI = 2.589988;
/** How far a city's GeoNames point may sit from the Census place of the same name: Sunrise, Florida's is 15.5 km off. */
const SAME_NAME_KM = 20;

function layers(): Record<'counties' | 'places' | 'readers', LayerFeature[]> {
  const layout = dataLayout(join(process.cwd(), 'data'));
  const catalog = openReader(layout.catalog);
  if (!catalog) throw new Error('no data/db/catalog.db; run the imports first');
  try {
    const get = (code: string) => {
      const f = layerFeatures(layout, catalog, code);
      if (!f) throw new Error(`no ${code} layer; run \`npm run import -- seed us-counties us-places deflock-alpr\``);
      return f;
    };
    return { counties: get('us-counties'), places: get('us-places'), readers: get('alpr') };
  } finally {
    catalog.close();
  }
}

const km = ([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) =>
  Math.hypot((lng2 - lng1) * 111.32 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180)), (lat2 - lat1) * 110.574);
const round = (n: number) => Number(n.toFixed(4));

const { counties: countyFeatures, places: placeFeatures, readers } = layers();
const gazetteer = JSON.parse(readFileSync(GAZETTEER, 'utf8')) as GazetteerFile;
const counties = countyFeatures.map(f => f.props as CountyProps).filter(c => c.pop !== null);
const knownCounty = new Map(counties.map(c => [c.geoid, c]));
const censusPlaces = placeFeatures.map(f => f.props as UsPlaceProps);
const countyAt = polygonLocator<CountyProps>(countyFeatures);
const placeAt = polygonLocator<UsPlaceProps>(placeFeatures);

const states = new Map<string, CountyProps[]>();
for (const c of counties) states.set(c.geoid.slice(0, 2), [...(states.get(c.geoid.slice(0, 2)) ?? []), c]);

const places: Place[] = [];
for (const [fips, list] of states) {
  const { state, stateName } = list[0];
  const pop = list.reduce((s, c) => s + c.pop!, 0);
  const admin1 = `US.${state}`;
  places.push({
    id: statePlaceId(fips), kind: 'state', slug: placeSlugBase(stateName), name: stateName,
    ...(gazetteer.regions?.[admin1] ? { names: gazetteer.regions[admin1] } : {}),
    cc: 'US', region: stateName, admin1, regionCode: state,
    // Where its people are, so the map opens on them rather than on Alaska's empty middle.
    at: [round(list.reduce((s, c) => s + c.at[0] * c.pop!, 0) / pop), round(list.reduce((s, c) => s + c.at[1] * c.pop!, 0) / pop)],
    pop, area: Math.round(list.reduce((s, c) => s + c.sqmi, 0) * KM2_PER_SQMI),
  });
}
for (const c of counties) {
  const name = placeSlugBase(c.name);
  const state = placeSlugBase(c.stateName);
  places.push({
    id: countyPlaceId(c.geoid), kind: 'county', slug: name === state ? name : `${name}-${state}`, name: c.name,
    cc: 'US', region: c.stateName, admin1: `US.${c.state}`, regionCode: c.state,
    at: [round(c.at[0]), round(c.at[1])], pop: c.pop!, area: Math.round(c.sqmi * KM2_PER_SQMI),
    parents: [statePlaceId(c.geoid.slice(0, 2))],
  });
}

const parentsOf = (county: CountyProps | undefined) =>
  county && knownCounty.has(county.geoid) ? [statePlaceId(county.geoid.slice(0, 2)), countyPlaceId(county.geoid)] : undefined;

// A city is the Census place around its point that bears its name ("Nashville-Davidson", "Urban Honolulu"), or failing
// that one of the same name nearby: GeoNames' point sometimes sits just outside the limits.
const base = (s: string) => placeSlugBase(s).replace(/(^|-)saint(?=-|$)/g, '$1st').replace(/-city$/, '');
const bears = (whole: string, part: string) => `-${whole}-`.includes(`-${part}-`);
const parents: Record<string, number[]> = {};
const limits: UsAreasFile['limits'] = {};
const taken = new Set<string>();
let unplaced = 0;
for (const city of gazetteer.places) {
  if (city.kind !== 'city' || city.cc !== 'US') continue;
  const up = parentsOf(countyAt(city.at));
  if (up) parents[city.id] = up;
  else unplaced++;
  const name = base(city.name);
  const around = placeAt(city.at);
  const nearby = censusPlaces.filter(p => p.state === city.regionCode && km(p.at, city.at) <= SAME_NAME_KM && bears(base(p.name), name))
    .sort((a, b) => Number(base(b.name) === name) - Number(base(a.name) === name) || km(a.at, city.at) - km(b.at, city.at));
  const match = around && city.regionCode === around.state && bears(base(around.name), name) ? around : nearby[0];
  if (!match || taken.has(match.geoid)) continue;
  taken.add(match.geoid);
  limits[city.id] = { geoid: match.geoid, ...(match.incorporated ? {} : { cdp: true as const }) };
}

const withReaders = new Set(readers.map(r => (r.props as AlprProps).place).filter(Boolean));
const townSlugs = new Set<string>();
let towns = 0;
for (const p of [...censusPlaces].sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0))) {
  if (!p.incorporated || p.pop === null || taken.has(p.geoid) || !withReaders.has(p.geoid)) continue;
  const county = countyAt(p.at);
  const up = parentsOf(county);
  const stateName = states.get(p.geoid.slice(0, 2))?.[0].stateName ?? p.state;
  // Two towns of one name in a state: the more populous keeps the plain slug, the other adds its county.
  let slug = `${placeSlugBase(p.name)}-${placeSlugBase(stateName)}`;
  if (townSlugs.has(slug)) slug = `${placeSlugBase(p.name)}-${placeSlugBase(county?.name ?? p.geoid)}-${placeSlugBase(stateName)}`;
  townSlugs.add(slug);
  places.push({
    id: townPlaceId(p.geoid), kind: 'town', slug, name: p.name,
    cc: 'US', region: stateName, admin1: `US.${p.state}`, regionCode: p.state,
    at: [round(p.at[0]), round(p.at[1])], pop: p.pop, area: Math.round(p.sqmi * KM2_PER_SQMI * 10) / 10,
    ...(up ? { parents: up } : {}),
  });
  towns++;
}

const slugs = new Set<string>();
for (const p of places) {
  const key = `${p.kind}/${p.slug}`;
  if (slugs.has(key)) throw new Error(`two places at ${key}`);
  slugs.add(key);
}

const file: UsAreasFile = { generated: new Date().toISOString().slice(0, 10), places, parents, limits };
writeFileSync(OUT, `${JSON.stringify(file)}\n`);
console.log(`wrote ${states.size} states, ${counties.length} counties and ${towns} towns to ${OUT}`);
console.log(`US cities: ${Object.keys(parents).length} placed in a county (${unplaced} not), ${Object.keys(limits).length} matched to their Census place`);
