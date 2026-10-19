import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Ctx, importDataset } from '../context';
import { csvRecords } from '../csv';
import { US_PLACES_DIR } from '../fetch-places';
import { readShapefile } from '../shp';
import { buildLayer } from './geo';

/*
 * US places from the Census Bureau, public domain: every incorporated city, town, village and borough, and the
 * census-designated places (CDPs) that stand for unincorporated communities. 2024 cartographic boundaries at 1:500k,
 * the place gazetteer's names and interior points, and the Vintage 2024 population estimates, which cover
 * incorporated places only. Inactive places are left out.
 */

const SHAPES = join(US_PLACES_DIR, 'cb_2024_us_place_500k');
const GAZETTEER = join(US_PLACES_DIR, '2024_Gaz_place_national.txt');
const POPULATION = join(US_PLACES_DIR, 'sub-est2024.csv');

export type UsPlaceProps = {
  geoid: string;
  /** "Atlanta", without the Census' "city", "town" or "CDP". */
  name: string;
  /** "Atlanta city", "Abanda CDP". */
  fullName: string;
  /** Postal code, "GA". */
  state: string;
  /** Incorporated, with a government of its own; a CDP is not. */
  incorporated: boolean;
  /** July 2024 estimate; null for CDPs. */
  pop: number | null;
  /** Land area, square miles. */
  sqmi: number;
  /** The Census interior point, [lon, lat]. */
  at: [number, number];
};

/** The Census' kinds of place, as they end its names: "Nashville-Davidson metropolitan government (balance)". */
const KIND = /\s+(?:city|town|village|borough|municipality|CDP|comunidad|zona urbana|urban county|consolidated government|metropolitan government|metro government|unified government|city and borough|corporation|plantation|charter township|township)(?:\s+\(balance\))?$/i;

export const shortPlaceName = (fullName: string) => fullName.replace(/\s+\(balance\)$/i, '').replace(KIND, '').trim();

function gazetteer(): Map<string, Omit<UsPlaceProps, 'geoid' | 'pop' | 'name'> & { status: string }> {
  const [head, ...lines] = readFileSync(GAZETTEER, 'utf8').split('\n').filter(l => l.trim());
  const col = Object.fromEntries(head.split('\t').map((h, i) => [h.trim(), i]));
  return new Map(lines.map(l => l.split('\t').map(s => s.trim())).map(f => [f[col.GEOID], {
    fullName: f[col.NAME], state: f[col.USPS], incorporated: f[col.FUNCSTAT] !== 'S', status: f[col.FUNCSTAT],
    sqmi: Number(f[col.ALAND_SQMI]), at: [Number(f[col.INTPTLONG]), Number(f[col.INTPTLAT])] as [number, number],
  }]));
}

export async function importUsPlaces(ctx: Ctx) {
  await importDataset(ctx, {
    source: 'us-places', version: '2024', asOf: '2024-07-01',
    files: [`${SHAPES}.shp`, `${SHAPES}.dbf`, GAZETTEER, POPULATION], importerVersion: '3',
  }, async ds => {
    const places = gazetteer();
    const pop = new Map<string, number>();
    for await (const r of csvRecords(POPULATION)) if (r.SUMLEV === '162') pop.set(`${r.STATE}${r.PLACE}`, Number(r.POPESTIMATE2024));
    await buildLayer(ctx, ds, { code: 'us-places', geomKind: 'polygon', timeMode: 'static', tileProps: ['geoid', 'name', 'state'], keepSmall: true, maxzoom: 14 }, async w => {
      // The .dbf is UTF-8, which readShapefile would misread as Windows-1252; names come from the gazetteer instead.
      for (const { geometry, props } of readShapefile(SHAPES)) {
        ds.report.rows++;
        const geoid = props.GEOID;
        const found = places.get(geoid);
        if (!geometry || !found) {
          ds.report.reject(geometry ? 'not in the place gazetteer' : 'no shape', geoid);
          continue;
        }
        const { status, ...place } = found;
        if (status === 'I') {
          ds.report.reject('inactive', place.fullName);
          continue;
        }
        const p: UsPlaceProps = { geoid, name: shortPlaceName(place.fullName), ...place, pop: pop.get(geoid) ?? null };
        if (p.incorporated && p.pop === null) ds.report.miss(`population: ${place.state}`);
        w.add({ sourceRecordId: geoid, props: p, geom: geometry });
      }
    });
    return {};
  });
}
