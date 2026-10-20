/*
 * Downloads for the coups, peace agreements and tropical cyclones, into RAW_MORE (gitignored); fetch.ts lists them.
 *   cline-coups: Cline Center Coup d'État Project v2.2.2 (CC BY 4.0), from the Illinois Data Bank.
 *   pax: PA-X Peace Agreements v10 (CC BY-NC-SA 4.0 plus PA-X terms; seed/index.ts has them).
 *   ibtracs: IBTrACS v04r01, every storm since 1842 (public domain), 333 MB of CSV kept gzipped.
 */
import { createWriteStream, renameSync, writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import { createGzip } from 'node:zlib';
import { get, out } from './fetch-net';

export const CLINE_FILE = 'coup-data.csv';
export const PAX_FILE = 'pax_data_agreements_v10.csv';
export const IBTRACS_FILE = 'ibtracs.ALL.list.v04r01.csv.gz';

const CLINE_RECORD = 'https://databank.illinois.edu/datasets/IDB-7095878';
// The Data Bank answers 403 to non-browser user agents.
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

type DataBankRecord = { identifier: string; datafiles: { web_id: string; binary_name: string }[] };

/** The record's one CSV; its web_id changes with each version, so it is read from the record. */
export function clineCsv(record: DataBankRecord) {
  const csv = record.datafiles.filter(f => /\.csv$/i.test(f.binary_name));
  if (csv.length !== 1) throw new Error(`cline-coups: expected one CSV in ${record.identifier}, found ${csv.map(f => f.binary_name).join(', ') || 'none'}`);
  return csv[0];
}

export async function clineCoups() {
  const browser = { headers: { 'User-Agent': BROWSER_UA } };
  const record = (await (await get(`${CLINE_RECORD}.json`, browser)).json()) as DataBankRecord;
  const file = clineCsv(record);
  const res = await get(`https://databank.illinois.edu/datafiles/${file.web_id}/download`, browser);
  writeFileSync(out('cline', CLINE_FILE), Buffer.from(await res.arrayBuffer()));
  console.log(`cline-coups: ${file.binary_name} (${record.identifier})`);
}

export async function pax() {
  const res = await get('https://www.peaceagreements.org/cms/documents/3957/pax_data_2257_agreements_v10.csv');
  writeFileSync(out('pax', PAX_FILE), Buffer.from(await res.arrayBuffer()));
  console.log('pax: done');
}

export async function ibtracs() {
  const url = 'https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.ALL.list.v04r01.csv';
  const res = await get(url);
  if (!res.body) throw new Error(`ibtracs: empty body from ${url}`);
  const path = out('ibtracs', IBTRACS_FILE);
  // A dropped connection leaves only the .part, so the importer never hashes a truncated file.
  await pipeline(Readable.fromWeb(res.body as ReadableStream), createGzip(), createWriteStream(`${path}.part`));
  renameSync(`${path}.part`, path);
  console.log('ibtracs: done');
}
