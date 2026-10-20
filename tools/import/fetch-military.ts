/*
 * Downloads behind the military series, into RAW_MORE (gitignored); fetch.ts lists them.
 *   sipri-milex: the SIPRI Military Expenditure Database workbook linked from its page.
 *   cow-nmc: Correlates of War National Material Capabilities v7.0 (1816–2022): the abridged CSV and the codebook.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAW_MORE } from './context';
import { get } from './fetch-places';

export const SIPRI_DIR = join(RAW_MORE, 'sipri-milex');
export const SIPRI_PAGE = 'https://www.sipri.org/databases/milex';
export const COW_NMC_DIR = join(RAW_MORE, 'cow-nmc');
/** v7.0 supersedes the v6.0 (1816–2016) file; NMC_Documentation-6.0.zip on the same page holds v6. */
const COW_NMC_ZIP = 'https://correlatesofwar.org/wp-content/uploads/NMCv7.zip';
export const COW_NMC_CSV = 'NMC-70-abridged.csv';

/** The workbook's link on the database page: SIPRI-Milex-data-1949-2025_v1.2.xlsx, renamed every release. */
export function sipriWorkbookUrl(html: string) {
  const href = /href="([^"]*SIPRI-Milex-data-[^"]*\.xlsx)"/.exec(html)?.[1];
  return href ? new URL(href, SIPRI_PAGE).toString() : null;
}

export async function sipriMilex() {
  const page = (await get(SIPRI_PAGE)).toString('utf8');
  const url = sipriWorkbookUrl(page);
  if (!url) throw new Error(`sipri-milex: no workbook link on ${SIPRI_PAGE}`);
  mkdirSync(SIPRI_DIR, { recursive: true });
  // The importer reads the one workbook here; an older release would otherwise be read too.
  for (const f of readdirSync(SIPRI_DIR)) rmSync(join(SIPRI_DIR, f));
  const name = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1));
  writeFileSync(join(SIPRI_DIR, name), await get(url));
  console.log(`sipri-milex: ${name}`);
}

export async function cowNmc() {
  mkdirSync(COW_NMC_DIR, { recursive: true });
  const zip = join(COW_NMC_DIR, 'NMCv7.zip');
  writeFileSync(zip, await get(COW_NMC_ZIP));
  execFileSync('unzip', ['-o', '-q', '-j', zip, 'NMCv7/NMC-v7-abridged.zip', 'NMCv7/NMC_Documentation_v7.pdf', '-d', COW_NMC_DIR]);
  execFileSync('unzip', ['-o', '-q', '-j', join(COW_NMC_DIR, 'NMC-v7-abridged.zip'), COW_NMC_CSV, '-d', COW_NMC_DIR]);
  console.log(`cow-nmc: ${COW_NMC_CSV} and the codebook in ${COW_NMC_DIR}`);
}
