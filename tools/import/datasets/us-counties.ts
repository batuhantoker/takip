import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Ctx, importDataset } from '../context';
import { csvRecords } from '../csv';
import { US_COUNTIES_DIR } from '../fetch-places';
import { readShapefile } from '../shp';
import { buildLayer } from './geo';

/*
 * US counties (and county equivalents: parishes, boroughs, Connecticut's planning regions) from the Census Bureau,
 * public domain: 2024 cartographic boundaries at 1:500k, the county gazetteer's names and interior points, and the
 * Vintage 2024 population estimates. Puerto Rico's municipios have boundaries but no estimate in that file.
 */

const SHAPES = join(US_COUNTIES_DIR, 'cb_2024_us_county_500k');
const GAZETTEER = join(US_COUNTIES_DIR, '2024_Gaz_counties_national.txt');
const POPULATION = join(US_COUNTIES_DIR, 'co-est2024-alldata.csv');

export type CountyProps = {
  geoid: string;
  /** "Fulton County", "Orleans Parish". */
  name: string;
  /** Postal code, "GA". */
  state: string;
  stateName: string;
  /** July 2024 estimate; null where the file has none. */
  pop: number | null;
  /** Land area, square miles. */
  sqmi: number;
  /** The Census interior point, [lon, lat]. */
  at: [number, number];
};

function gazetteer(): Map<string, { state: string; name: string; sqmi: number; at: [number, number] }> {
  const [head, ...lines] = readFileSync(GAZETTEER, 'utf8').split('\n').filter(l => l.trim());
  const col = Object.fromEntries(head.split('\t').map((h, i) => [h.trim(), i]));
  return new Map(lines.map(l => l.split('\t').map(s => s.trim())).map(f => [f[col.GEOID], {
    state: f[col.USPS], name: f[col.NAME], sqmi: Number(f[col.ALAND_SQMI]), at: [Number(f[col.INTPTLONG]), Number(f[col.INTPTLAT])],
  }]));
}

export async function importUsCounties(ctx: Ctx) {
  await importDataset(ctx, {
    source: 'us-counties', version: '2024', asOf: '2024-07-01',
    files: [`${SHAPES}.shp`, `${SHAPES}.dbf`, GAZETTEER, POPULATION], importerVersion: '1',
  }, async ds => {
    const places = gazetteer();
    const pop = new Map<string, number>();
    const stateNames = new Map<string, string>();
    for await (const r of csvRecords(POPULATION)) {
      if (r.SUMLEV === '050') pop.set(`${r.STATE}${r.COUNTY}`, Number(r.POPESTIMATE2024));
      if (r.SUMLEV === '040') stateNames.set(r.STATE, r.STNAME);
    }
    await buildLayer(ctx, ds, { code: 'us-counties', geomKind: 'polygon', timeMode: 'static', tileProps: ['geoid', 'name', 'state'], keepSmall: true, maxzoom: 12 }, async w => {
      // The .dbf is UTF-8, which readShapefile would misread as Windows-1252; names come from the gazetteer instead.
      for (const { geometry, props } of readShapefile(SHAPES)) {
        ds.report.rows++;
        const geoid = props.GEOID;
        const place = places.get(geoid);
        if (!geometry || !place) {
          ds.report.reject(geometry ? 'not in the county gazetteer' : 'no shape', geoid);
          continue;
        }
        const p: CountyProps = {
          geoid, name: place.name, state: place.state, stateName: stateNames.get(geoid.slice(0, 2)) ?? place.state,
          pop: pop.get(geoid) ?? null, sqmi: place.sqmi, at: place.at,
        };
        if (p.pop === null) ds.report.miss(`population: ${place.state}`);
        w.add({ sourceRecordId: geoid, props: p, geom: geometry });
      }
    });
    return {};
  });
}
