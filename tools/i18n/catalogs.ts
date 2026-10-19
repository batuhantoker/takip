import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { messageVariables } from '../../src/lib/core/i18n/message';

export const CATALOG_DIR = 'src/lib/core/i18n/catalogs';

export type Catalog = Record<string, string>;

export const catalogPath = (root: string, locale: string) => join(root, CATALOG_DIR, `${locale}.json`);

export function readCatalog(root: string, locale: string): Catalog {
  return JSON.parse(readFileSync(catalogPath(root, locale), 'utf8')) as Catalog;
}

/** Sorted, one entry per line, LF: diffs stay small when several sessions add strings. */
export function writeCatalog(root: string, locale: string, catalog: Catalog) {
  const sorted = Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  writeFileSync(catalogPath(root, locale), `${JSON.stringify(sorted, null, 2)}\n`);
}

/** Why a translation can't stand in for its source, or null when it can. */
export function translationProblem(source: string, translation: unknown): string | null {
  if (typeof translation !== 'string' || !translation.trim()) return 'empty';
  const want = messageVariables(source).join(',');
  const got = messageVariables(translation).join(',');
  return want === got ? null : `reads {${got}} but the source reads {${want}}`;
}
