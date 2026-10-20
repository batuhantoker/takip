import { join } from 'node:path';

/* Where the geo index's bulk downloads come from and where they are kept (.cache is gitignored). */

export const CACHE = join('.cache', 'geo-index');
export const DB_PATH = join('data', 'db', 'geo-index.db');

/** Wikipedias whose article coordinates are indexed; ka and bg are left out because they don't use GeoData. */
export const WIKIS = ['en', 'de', 'fr', 'es', 'it', 'ru', 'pl', 'uk', 'tr', 'ar', 'fa', 'zh', 'ja', 'pt', 'nl', 'sv', 'el', 'hy', 'az', 'sr', 'hu', 'ro', 'cs', 'he', 'ko', 'id', 'vi', 'hi'] as const;
export const SKIPPED_WIKIS = { ka: 'geo_tags is empty (1.7 kB)', bg: 'geo_tags is empty (2 kB)' };
export const WIKI_FILES = ['geo_tags.sql.gz', 'page_props.sql.gz', 'pages-articles-multistream-index.txt.bz2'] as const;
export type WikiFile = (typeof WIKI_FILES)[number];

export const wikiUrl = (wiki: string, file: WikiFile) => `https://dumps.wikimedia.org/${wiki}wiki/latest/${wiki}wiki-latest-${file}`;
export const wikiPath = (wiki: string, file: WikiFile) => join(CACHE, 'wikipedia', `${wiki}wiki-${file}`);
/** Namespace names and aliases, to drop File:, Kategorie: and other non-article titles from the dump index. */
export const namespacesUrl = (wiki: string) => `https://${wiki}.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=namespaces%7Cnamespacealiases&format=json&formatversion=2`;
export const namespacesPath = (wiki: string) => join(CACHE, 'wikipedia', `${wiki}wiki-namespaces.json`);

const GEONAMES = 'https://download.geonames.org/export/dump';
export const GEONAMES_FILES = ['allCountries.zip', 'alternateNamesV2.zip', 'countryInfo.txt', 'admin1CodesASCII.txt'] as const;
export const geonamesUrl = (file: string) => `${GEONAMES}/${file}`;
export const geonamesPath = (file: string) => join(CACHE, 'geonames', file);

const PLEIADES = 'https://atlantides.org/downloads/pleiades/dumps';
export const PLEIADES_FILES = ['pleiades-places-latest.csv.gz', 'pleiades-names-latest.csv.gz'] as const;
export const pleiadesUrl = (file: string) => `${PLEIADES}/${file}`;
export const pleiadesPath = (file: string) => join(CACHE, 'pleiades', file);

/** QLever's Wikidata mirror streams millions of rows; query.wikidata.org rate-limits this IP. */
export const QLEVER = 'https://qlever.dev/api/wikidata';
const WDT = 'PREFIX wdt: <http://www.wikidata.org/prop/direct/> PREFIX wd: <http://www.wikidata.org/entity/>';

/** Root classes → the coarse kind an item of any subclass gets; earlier roots win when an item has several. */
export const KIND_ROOTS: [kind: string, roots: string[]][] = [
  ['fort', ['Q57821', 'Q23413']],
  ['site', ['Q839954', 'Q852190']],
  ['settlement', ['Q486972', 'Q123705']],
  ['pass', ['Q133056']],
  ['cape', ['Q185113']],
  ['bay', ['Q37901', 'Q39594']],
  ['mountain', ['Q8502', 'Q54050', 'Q46831']],
  ['island', ['Q23442', 'Q33837']],
  ['lake', ['Q23397']],
  ['river', ['Q4022', 'Q47521']],
  ['terrain', ['Q39816', 'Q160091', 'Q4421', 'Q8514', 'Q34763']],
  ['sea', ['Q165']],
  ['country', ['Q6256', 'Q3024240', 'Q3624078']],
  ['admin', ['Q56061']],
  ['event', ['Q178561', 'Q1190554']],
  ['building', ['Q41176']],
  ['region', ['Q82794']],
  ['structure', ['Q811979']],
];
export const QLEVER_QUERIES = {
  coords: `${WDT} SELECT ?item ?coord WHERE { ?item wdt:P625 ?coord }`,
  countries: `${WDT} SELECT ?item ?country WHERE { ?item wdt:P625 ?c . ?item wdt:P17 ?country }`,
  classes: `${WDT} SELECT ?item ?class WHERE { ?item wdt:P625 ?c . ?item wdt:P31 ?class }`,
  iso: `${WDT} SELECT ?country ?iso WHERE { ?country wdt:P297 ?iso }`,
  kinds: `${WDT} SELECT ?class ?root WHERE { VALUES ?root { ${KIND_ROOTS.flatMap(([, r]) => r).map(q => `wd:${q}`).join(' ')} } ?class wdt:P279* ?root }`,
} as const;
export const qleverPath = (name: keyof typeof QLEVER_QUERIES) => join(CACHE, 'wikidata', `${name}.tsv`);
