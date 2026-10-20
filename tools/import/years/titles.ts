import { existsSync } from 'node:fs';
import { wikiPath } from '../geo/build/sources';
import { commandLines } from '../geo/build/sql-dump';
import type { GeoIndex } from '../geo/geo-index';
import { normName } from '../names';
import { LANGS } from './langs';

/* Which year pages a Wikipedia has, read from the title index of its dump (downloaded for the geo index). */

/** Years after this are plans and forecasts, not history. */
export const LAST_YEAR = new Date().getUTCFullYear();
/** Before this, Wikipedias have millennium pages, not years. */
const FIRST_YEAR = -2999;

/** "<year> in X" pages for places the geo index has no country for, with the countries their events lie in. */
export const COUNTRY_ALIASES: Record<string, string[]> = {
  england: ['GB'], scotland: ['GB'], wales: ['GB'], 'northern ireland': ['GB'], 'great britain': ['GB'], 'the us': ['US'], 'the united states': ['US'],
  'the soviet union': ['RU', 'UA', 'BY', 'KZ', 'UZ', 'GE', 'AM', 'AZ', 'LT', 'LV', 'EE', 'MD', 'KG', 'TJ', 'TM'],
  'the ottoman empire': ['TR', 'GR', 'BG', 'RS', 'RO', 'MK', 'AL', 'BA', 'ME', 'EG', 'SY', 'IQ', 'LB', 'IL', 'PS', 'JO', 'SA', 'LY', 'TN', 'CY', 'HU', 'YE'],
  'the russian empire': ['RU', 'UA', 'BY', 'PL', 'FI', 'LT', 'LV', 'EE', 'GE', 'AM', 'AZ', 'KZ', 'UZ', 'MD'],
  yugoslavia: ['RS', 'HR', 'SI', 'BA', 'ME', 'MK', 'XK'], czechoslovakia: ['CZ', 'SK'], 'east germany': ['DE'], 'west germany': ['DE'], prussia: ['DE', 'PL', 'RU', 'LT'],
  'austria-hungary': ['AT', 'HU', 'CZ', 'SK', 'SI', 'HR', 'BA', 'PL', 'UA', 'RO', 'IT'], 'the austrian empire': ['AT', 'HU', 'CZ', 'SK', 'SI', 'HR', 'PL', 'UA', 'IT'],
  'the holy roman empire': ['DE', 'AT', 'CZ', 'BE', 'NL', 'LU', 'CH', 'IT'], 'the byzantine empire': ['TR', 'GR', 'BG', 'CY', 'IT'], ceylon: ['LK'], burma: ['MM'], siam: ['TH'],
  rhodesia: ['ZW'], 'the dutch republic': ['NL'], 'the mughal empire': ['IN', 'PK', 'BD'], 'the kingdom of great britain': ['GB'], 'the papal states': ['IT'],
  'the confederate states of america': ['US'], 'british india': ['IN', 'PK', 'BD', 'MM'], 'mandatory palestine': ['IL', 'PS', 'JO'], 'the habsburg monarchy': ['AT', 'HU', 'CZ'],
};

/** The countries a "<year> in X" page is about, or null when X isn't a country (poetry, rail transport, Michigan). */
export function pageCountries(index: GeoIndex | null, x: string): string[] | null {
  const key = x.trim().toLowerCase();
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  if (!index) return null;
  const c = index.country(normName(x.replace(/^the /i, '')));
  return c ? [c.iso2] : null;
}

const inRange = (y: number) => y >= FIRST_YEAR && y <= LAST_YEAR;

/**
 * Year, decade and country-year page titles in the dump's title index, and for English every Current events day.
 * Redirects are among them; the fetch follows them and keeps each page once.
 */
export async function listTitles(lang: string, index: GeoIndex | null): Promise<{ titles: string[]; notCountry: Record<string, number> }> {
  const L = LANGS[lang];
  const path = wikiPath(lang, 'pages-articles-multistream-index.txt.bz2');
  if (!existsSync(path)) throw new Error(`${path} is missing: run tools/import/geo/build-index.ts --fetch-only first`);
  const titles = new Set<string>();
  const notCountry: Record<string, number> = {};
  for await (const line of commandLines('bzip2', ['-dc', path])) {
    const a = line.indexOf(':');
    const b = line.indexOf(':', a + 1);
    const title = line.slice(b + 1);
    const pt = L.page(title);
    if (!pt || !inRange(pt.year)) continue;
    if (pt.portal && pt.year > LAST_YEAR) continue;
    if (pt.country !== undefined && !pageCountries(index, pt.country)) {
      notCountry[pt.country] = (notCountry[pt.country] ?? 0) + 1;
      continue;
    }
    titles.add(title);
  }
  return { titles: [...titles].sort(), notCountry };
}
