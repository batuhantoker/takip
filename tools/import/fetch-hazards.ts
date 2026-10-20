/* Keyless natural-hazard and epidemic histories, into RAW_MORE (gitignored). */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAW_MORE } from './context';
import { get, out } from './fetch-net';

const GVP_WFS = 'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0&request=GetFeature'
  + '&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Eruptions&outputFormat=application/json';

/** Smithsonian GVP Volcanoes of the World: every Holocene eruption (about 11k, 9 MB) in one WFS request of ~1 min. */
export async function gvp() {
  const body = (await (await get(GVP_WFS)).json()) as { features: unknown[]; totalFeatures?: number; timeStamp?: string };
  if (body.totalFeatures !== undefined && body.features.length !== body.totalFeatures) throw new Error(`gvp: got ${body.features.length} of ${body.totalFeatures}`);
  // The request time would change the file's hash on every fetch.
  delete body.timeStamp;
  writeFileSync(out('gvp', 'holocene-eruptions.json'), JSON.stringify(body));
  console.log(`gvp: ${body.features.length} eruptions`);
}

const PLAGUE_ZIP = 'https://www.envidat.ch/dataset/2a2b8c5f-c60c-4902-871b-564869addd07/resource/2b3fba3b-34e0-4202-8fe4-e3056e6719d0/download/historicalplagueoutbreaks.zip';

/** Plague outbreaks 1347–1900 (Büntgen et al. 2012, EnviDat doi:10.16904/envidat.181): a 48 KB zip of one CSV. */
export async function plague() {
  const zip = out('plague', 'historicalplagueoutbreaks.zip');
  writeFileSync(zip, Buffer.from(await (await get(PLAGUE_ZIP)).arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', zip, '-d', join(RAW_MORE, 'plague')]);
  console.log('plague: done');
}
