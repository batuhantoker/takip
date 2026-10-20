/*
 * Downloads for the datasets whose places are names or codes the importers geocode, into RAW_MORE (gitignored).
 *   mass-mobilization: Mass Mobilization protests 1990–2020 (Clark & Regan, Harvard Dataverse, CC0), 15 MB.
 *   slave-voyages: the Trans-Atlantic (2019) and Intra-American (1.0) voyage files from slavevoyages.org's downloads
 *     page, plus the site's own place table (codes with coordinates) and code labels from its API.
 */
import { writeFileSync } from 'node:fs';
import { get, out } from './fetch-net';

export const MM_FILE = 'mm.csv';
const MM_DATASET = 'doi:10.7910/DVN/HTTWYL';

type DataverseFile = { dataFile: { id: number; filename: string; originalFileFormat?: string } };
type DataverseVersion = { versionNumber: number; versionMinorNumber: number; files: DataverseFile[] };

/** The latest version's CSV-origin table; its file id changes with each version, so it is read from the dataset. */
export function mmCsv(v: DataverseVersion) {
  const csv = v.files.filter(f => /_csv\.tab$/.test(f.dataFile.filename) && f.dataFile.originalFileFormat === 'text/csv');
  if (csv.length !== 1) throw new Error(`mass-mobilization: expected one CSV table, found ${csv.map(f => f.dataFile.filename).join(', ') || 'none'}`);
  return csv[0].dataFile;
}

export async function massMobilization() {
  const meta = (await (await get(`https://dataverse.harvard.edu/api/datasets/:persistentId/?persistentId=${MM_DATASET}`)).json()) as { data: { latestVersion: DataverseVersion } };
  const v = meta.data.latestVersion;
  const file = mmCsv(v);
  const res = await get(`https://dataverse.harvard.edu/api/access/datafile/${file.id}?format=original`);
  writeFileSync(out('mass-mobilization', MM_FILE), Buffer.from(await res.arrayBuffer()));
  writeFileSync(out('mass-mobilization', 'version.json'), JSON.stringify({ dataset: MM_DATASET, version: `${v.versionNumber}.${v.versionMinorNumber}`, file: file.filename, id: file.id }));
  console.log(`mass-mobilization: ${file.filename} (v${v.versionNumber}.${v.versionMinorNumber})`);
}

const SV = 'https://www.slavevoyages.org';
export const SV_FILES = { tast: 'tastdb-exp-2019.csv', iam: 'I-Am1.0.csv', places: 'geotree.json', labels: 'labels.json' } as const;

/** Every itinerary field, so the place tree holds every code a voyage uses. */
const PLACE_FIELDS = [
  'port_of_departure', 'int_first_port_emb', 'int_second_port_emb', 'int_first_port_dis', 'int_second_port_dis', 'int_third_port_dis', 'int_fourth_port_dis',
  'first_place_slave_purchase', 'second_place_slave_purchase', 'third_place_slave_purchase', 'port_of_call_before_atl_crossing', 'first_landing_place',
  'second_landing_place', 'third_landing_place', 'place_voyage_ended', 'imp_port_voyage_begin', 'principal_place_of_slave_purchase',
  'imp_principal_place_of_slave_purchase', 'principal_port_of_slave_dis', 'imp_principal_port_slave_dis',
].map(f => `voyage_itinerary__${f}__value`);
export const SV_LISTS = ['NationalityList', 'ParticularOutcomeList', 'SlavesOutcomeList', 'VesselCapturedOutcomeList', 'OwnerOutcomeList', 'RigOfVesselList', 'ResistanceList'];

/** The site's own front end carries a public API token in its runtime config. */
export const svToken = (config: string) => {
  const m = config.match(/apiAuthToken:\s*"(Token [0-9a-f]+)"/);
  if (!m) throw new Error('slave-voyages: no API token in runtime-config.js');
  return m[1];
};

export async function slaveVoyages() {
  for (const file of [SV_FILES.tast, SV_FILES.iam]) {
    writeFileSync(out('slave-voyages', file), Buffer.from(await (await get(`${SV}/static/uploads/${file}`)).arrayBuffer()));
    console.log(`slave-voyages ${file}`);
  }
  const auth = { Authorization: svToken(await (await get(`${SV}/runtime-config.js`)).text()) };
  const tree = await get(`${SV}/api/voyage/geotree/`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ geotree_valuefields: PLACE_FIELDS, filter: [] }),
  });
  writeFileSync(out('slave-voyages', SV_FILES.places), await tree.text());
  const labels: Record<string, unknown> = {};
  for (const list of SV_LISTS) labels[list] = await (await get(`${SV}/api/voyage/${list}/`, { headers: auth })).json();
  writeFileSync(out('slave-voyages', SV_FILES.labels), JSON.stringify(labels));
  console.log('slave-voyages: places and labels');
}
