/* Keyless record files that already carry coordinates: launches, fireballs, pre-1900 European quakes, ancient wrecks. */
import { writeFileSync } from 'node:fs';
import { get, out } from './fetch-net';

const GCAT = 'https://planet4589.org/space/gcat/tsv';
/** GCAT's launch log and the tables it points into: sites, pads (launch points) and organisations. */
export const GCAT_FILES = { launches: 'launch.tsv', sites: 'sites.tsv', pads: 'lp.tsv', orgs: 'orgs.tsv' } as const;

/** Jonathan McDowell's General Catalog of Artificial Space Objects (CC BY 4.0): every launch since 1942, 14 MB. */
export async function gcat() {
  const paths = { 'launch.tsv': 'launch/launch.tsv', 'sites.tsv': 'tables/sites.tsv', 'lp.tsv': 'tables/lp.tsv', 'orgs.tsv': 'tables/orgs.tsv' };
  for (const file of Object.values(GCAT_FILES)) {
    writeFileSync(out('gcat', file), await (await get(`${GCAT}/${paths[file]}`)).text());
    console.log(`gcat ${file}`);
  }
}

/** CNEOS fireballs (NASA JPL, public domain), all of them: rows without a location are counted as rejects on import. */
export async function fireballs() {
  const body = (await (await get('https://ssd-api.jpl.nasa.gov/fireball.api')).json()) as { count: string };
  writeFileSync(out('cneos', 'fireballs.json'), JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), ...body }));
  console.log(`fireballs: ${body.count}`);
}

/** EPICA v1.1, the European preinstrumental earthquake catalogue 1000–1899 (INGV, CC BY 4.0). */
export async function epica() {
  writeFileSync(out('epica', 'EPICA_v1.1.xlsx'), Buffer.from(await (await get('https://www.emidius.eu/epica/data/EPICA_v1.1.xlsx')).arrayBuffer()));
  console.log('epica: done');
}

export const OXREP_FILE = 'oxrep-shipwrecks-database-2.1-march-2017.xlsx';

/** OxREP Shipwrecks database v2.1 (Strauss, Wilson and Flohr 2017). */
export async function oxrep() {
  writeFileSync(out('oxrep', OXREP_FILE), Buffer.from(await (await get(`https://oxrep.web.ox.ac.uk/sitefiles/${OXREP_FILE}`)).arrayBuffer()));
  console.log('oxrep: done');
}
