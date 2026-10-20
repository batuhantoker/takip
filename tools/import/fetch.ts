/*
 * Downloads the keyless sources the second batch of importers reads into RAW_MORE (gitignored).
 *   npx tsx tools/import/fetch.ts <noaa|wikidata|attacks|conflicts|wpp|war-battles|sitelinks|articles|test-series|usgs-articles|wdi|owid|nuclear|covid|cliopatria|gdis|cckp|wup|idb|gep|imf|oecd-lt|deflock|us-counties|us-places|sipri-milex|cow-nmc|events|recover|gvp|plague|cline-coups|pax|ibtracs|gcat|fireballs|epica|oxrep|mass-mobilization|slave-voyages|years|all>
 * years fetches ten Wikipedias' year pages for an hour or more, resumably (YEARS_LANGS=en,tr limits it; see fetch-years.ts).
 * Files are replaced whole; importers hash them, so an unchanged download is skipped on import.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { zipEntry } from '../../src/lib/core/net/remote-zip';
import { RAW_MORE, REPO } from './context';
import { deflock, usCounties, usPlaces } from './fetch-places';
import { cowNmc, sipriMilex } from './fetch-military';
import { events } from './fetch-events';
import { massMobilization, slaveVoyages } from './fetch-geocoded';
import { get, out } from './fetch-net';
import { gvp, plague } from './fetch-hazards';
import { clineCoups, ibtracs, pax } from './fetch-politics';
import { recover } from './fetch-recover';
import { epica, fireballs, gcat, oxrep } from './fetch-records';
import { attacks, type Binding, conflicts, sitelinks, sparql, TIME, warBattles, wikidata } from './fetch-wikidata';
import { years } from './fetch-years';

/** NCEI Natural Hazards (public domain): significant earthquakes, tsunami events and runups, and volcanic eruptions. */
async function noaa() {
  const base = 'https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1';
  const sets = [['earthquakes', 'earthquakes.json'], ['tsunamis/events', 'tsunamis.json'], ['tsunamis/runups', 'runups.json'], ['volcanoes', 'volcanoes.json']];
  for (const [path, file] of sets) {
    const items: unknown[] = [];
    for (let page = 1, pages = 1; page <= pages; page++) {
      const d = (await (await get(`${base}/${path}?itemsPerPage=200&page=${page}`)).json()) as { items: unknown[]; totalPages: number };
      items.push(...d.items);
      pages = d.totalPages;
    }
    writeFileSync(out('noaa', file), JSON.stringify(items));
    console.log(`noaa ${file}: ${items.length}`);
  }
}

/** Event classes whose Wikidata items, with an English article, the hazard and nuclear importers match by day and place. */
export const ARTICLE_CLASSES: [qid: string, cls: string][] = [
  ['Q7944', 'earthquake'],
  ['Q8070', 'tsunami'],
  ['Q7692360', 'eruption'],
  ['Q210112', 'nuclear test'],
  ['Q98391050', 'nuclear test series'],
];

const ENWIKI = '?a schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title .';

/** English Wikipedia articles for events, World Heritage sites and volcanoes (Wikidata, CC0), so importers store references. */
async function articles() {
  // One class at a time: all five in one query time out at the endpoint's 60 s.
  const events: Binding[] = [];
  for (const [qid, cls] of ARTICLE_CLASSES) {
    events.push(...await sparql(`
      SELECT ?item ?title ?cls (SAMPLE(?t_) AS ?t) (SAMPLE(?t0_) AS ?t0) (SAMPLE(?t1_) AS ?t1) (SAMPLE(?coord_) AS ?coord)
        (SAMPLE(?locCoord_) AS ?locCoord) (SAMPLE(?volcano_) AS ?volcano)
      WHERE {
        BIND("${cls}" AS ?cls)
        ?item wdt:P31/wdt:P279* wd:${qid} .
        ${ENWIKI}
        ${TIME('P585', 't')} ${TIME('P580', 't0')} ${TIME('P582', 't1')}
        OPTIONAL { ?item wdt:P625 ?coord_ }
        OPTIONAL { ?item wdt:P276/wdt:P625 ?locCoord_ }
        OPTIONAL { ?item (wdt:P706|wdt:P276) ?v . ?v wdt:P1886 ?volcano_ }
      } GROUP BY ?item ?title ?cls`));
  }
  const heritage = await sparql(`SELECT ?whs ?title (SAMPLE(?coord_) AS ?coord) WHERE { ?item wdt:P757 ?whs . ${ENWIKI} OPTIONAL { ?item wdt:P625 ?coord_ } } GROUP BY ?whs ?title`);
  const volcanoes = await sparql(`SELECT ?gvp ?title WHERE { ?item wdt:P1886 ?gvp . ${ENWIKI} }`);
  const flat = (bs: Binding[]) => bs.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value.replace('http://www.wikidata.org/entity/', '')])));
  writeFileSync(out('wikidata', 'articles.json'), JSON.stringify({ events: flat(events), heritage: flat(heritage), volcanoes: flat(volcanoes) }));
  console.log(`articles: ${events.length} events, ${heritage.length} heritage sites, ${volcanoes.length} volcanoes`);
}

/** Tests Wikidata lists under a nuclear test series with an English article (P527 one way, P361 the other), dated to the day. */
async function testSeries() {
  const rows = await sparql(`
    SELECT DISTINCT ?title ?label ?t WHERE {
      ?series wdt:P31/wdt:P279* wd:Q98391050 .
      ?a schema:about ?series; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title .
      { ?series wdt:P527 ?member } UNION { ?member wdt:P361 ?series }
      ?member rdfs:label ?label FILTER(LANG(?label) = "en")
      ?member p:P585/psv:P585 [ wikibase:timeValue ?t; wikibase:timePrecision 11 ] .
    }`);
  const tests = rows.map(b => ({ title: b.title.value, label: b.label.value, day: b.t.value.slice(0, 10) }));
  writeFileSync(out('wikidata', 'test-series.json'), JSON.stringify(tests));
  console.log(`test series: ${tests.length} tests in ${new Set(tests.map(t => t.title)).size} series`);
}

/** Ingest stores USGS quakes, so their English articles (Wikidata P3196, CC0) go into its source as a checked-in table. */
export const USGS_ARTICLES = join(REPO, 'apps/ingest/src/connectors/usgs-articles.generated.ts');

async function usgsArticles() {
  const rows = await sparql(`SELECT ?id ?title WHERE { ?item wdt:P3196 ?id . ?a schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?title }`);
  const pairs = rows.map(b => [b.id.value, b.title.value] as const).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const body = pairs.map(([id, title]) => `  ${JSON.stringify(id)}: ${JSON.stringify(title)},`).join('\n');
  writeFileSync(USGS_ARTICLES, `// Generated by \`npx tsx tools/import/fetch.ts usgs-articles\` from Wikidata (CC0); don't edit.\n/** USGS event id → its English Wikipedia article (Wikidata P3196). */\nexport const USGS_ARTICLES: Record<string, string> = {\n${body}\n};\n`);
  console.log(`usgs articles: ${pairs.length}`);
}

/** World Development Indicators, the World Bank's bulk CSV (CC BY 4.0): about 283 MB zipped. */
async function wdi() {
  const zip = out('wdi', 'WDI_CSV.zip');
  writeFileSync(zip, Buffer.from(await (await get('https://databank.worldbank.org/data/download/WDI_CSV.zip')).arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', zip, '-d', join(RAW_MORE, 'wdi')]);
  console.log('wdi: done');
}

const WPP = 'https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)';

/**
 * UN World Population Prospects 2024 (CC BY 3.0 IGO): the medium variant, with the January 2026 rows that re-estimate
 * Togo, and the other variants and prediction intervals (75 MB, kept gzipped).
 */
async function wpp() {
  const indicators = await get(`${WPP}/CSV_FILES/WPP2024_Demographic_Indicators_Medium.csv.gz`);
  writeFileSync(out('wpp', 'WPP2024_Demographic_Indicators_Medium.csv'), gunzipSync(Buffer.from(await indicators.arrayBuffer())));
  const variants = await get(`${WPP}/CSV_FILES/WPP2024_Demographic_Indicators_OtherVariants.csv.gz`);
  writeFileSync(out('wpp', 'WPP2024_Demographic_Indicators_OtherVariants.csv.gz'), Buffer.from(await variants.arrayBuffer()));
  const ages = await get(`${WPP}/CSV_FILES/WPP2024_PopulationByAge5GroupSex_Medium.csv.gz`);
  writeFileSync(out('wpp', 'WPP2024_PopulationByAge5GroupSex_Medium.csv.gz'), Buffer.from(await ages.arrayBuffer()));
  const agesUpdate = await zipEntry(`${WPP}/WPP2024_CSV_files_update.zip`, 'WPP2024_PopulationByAge5GroupSex_Medium_Update.csv');
  if (!agesUpdate) throw new Error('wpp: the update zip has no age groups');
  writeFileSync(out('wpp', 'WPP2024_PopulationByAge5GroupSex_Medium_Update.csv'), agesUpdate);
  writeFileSync(out('wpp', 'WPP2024_Locations_notes.csv'), Buffer.from(await (await get(`${WPP}/CSV_FILES/WPP2024_Locations_notes.csv`)).arrayBuffer()));
  const update = await zipEntry(`${WPP}/WPP2024_CSV_files_update.zip`, 'WPP2024_Demographic_Indicators_Medium_Update.csv');
  if (!update) throw new Error('wpp: the update zip has no demographic indicators');
  writeFileSync(out('wpp', 'WPP2024_Demographic_Indicators_Medium_Update.csv'), update);
  console.log('wpp: done');
}

/** Our World in Data grapher CSVs with long country coverage before 1960 (CC BY 4.0). */
export const OWID_CHARTS = [
  'gdp-per-capita-maddison-project-database',
  'electoral-democracy-index',
  'human-rights-index-vdem',
  'child-mortality',
  'cross-country-literacy-rates',
  'mean-years-of-schooling-long-run',
  'co-emissions-per-capita',
  'children-born-per-woman',
  'population',
];

async function owid() {
  for (const slug of OWID_CHARTS) {
    const q = 'v=1&csvType=full&useColumnShortNames=true';
    writeFileSync(out('owid', `${slug}.csv`), await (await get(`https://ourworldindata.org/grapher/${slug}.csv?${q}`)).text());
    writeFileSync(out('owid', `${slug}.metadata.json`), await (await get(`https://ourworldindata.org/grapher/${slug}.metadata.json?${q}`)).text());
    console.log(`owid ${slug}`);
  }
}

/** SIPRI's list of nuclear explosions 1945–1998, as republished by TidyTuesday (2019-08-20). */
async function nuclear() {
  const url = 'https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2019/2019-08-20/nuclear_explosions.csv';
  writeFileSync(out('nuclear', 'nuclear_explosions.csv'), await (await get(url)).text());
  console.log('nuclear: done');
}

/** Weekly COVID-19 series from OWID (WHO COVID-19 Dashboard and OWID vaccinations, CC BY 4.0). About 40 MB. */
export const OWID_COVID_CHARTS = ['weekly-covid-deaths-per-million-people', 'weekly-covid-cases-per-million-people', 'share-people-vaccinated-covid'];

async function covid() {
  for (const slug of OWID_COVID_CHARTS) {
    const q = 'v=1&csvType=full&useColumnShortNames=true';
    writeFileSync(out('owid', `${slug}.csv`), await (await get(`https://ourworldindata.org/grapher/${slug}.csv?${q}`)).text());
    writeFileSync(out('owid', `${slug}.metadata.json`), await (await get(`https://ourworldindata.org/grapher/${slug}.metadata.json?${q}`)).text());
    console.log(`covid ${slug}`);
  }
}

/** Seshat's Cliopatria (CC BY 4.0), pinned to v0.2.1: bump both and re-run, and the importer sees a new hash. */
const CLIOPATRIA_COMMIT = '5f433377139a6eeaeacbdc894b70f8805b72c8b5';
export const CLIOPATRIA_VERSION = '0.2.1';
export const CLIOPATRIA_DIR = join(RAW_MORE, 'cliopatria');

/** One GeoJSON of world polities, 3400 BCE to 2024: 46 MB zipped, 173 MB unzipped. */
async function cliopatria() {
  const zip = out('cliopatria', 'cliopatria.geojson.zip');
  const url = `https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/${CLIOPATRIA_COMMIT}/cliopatria.geojson.zip`;
  writeFileSync(zip, Buffer.from(await (await get(url)).arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', zip, '-d', CLIOPATRIA_DIR]);
  console.log('cliopatria: done');
}

/** GDIS 1960–2018 locations, from PRIO's copy: Earthdata's needs a login (401) and SEDAC's old host times out. */
async function gdis() {
  const zip = out('gdis', 'gdis-1960-2018-disasterlocations-csv.zip');
  const url = 'https://cdn.cloud.prio.org/files/cffb60dc-5978-4eec-a1d2-14551067d84d/gdis-1960-2018-disasterlocations-csv.zip';
  writeFileSync(zip, Buffer.from(await (await get(url)).arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', zip, '-d', join(RAW_MORE, 'gdis')]);
  console.log('gdis: done');
}

/** UN World Urbanization Prospects 2025 (CC BY 3.0 IGO): national definitions, and the degree of urbanisation; 12 MB, kept gzipped. */
async function wup() {
  const base = 'https://population.un.org/wup/assets/Download/Countries%20and%20Aggregates';
  for (const file of ['WUP2025-DB-National-Definitions-Population-Data.csv.gz', 'WUP2025-DB-DEGURBA-Level1-Population-Surface-Data.csv.gz']) {
    writeFileSync(out('wup', file), Buffer.from(await (await get(`${base}/${file}`)).arrayBuffer()));
  }
  console.log('wup: done');
}

/** US Census Bureau International Database (CC0, per its API metadata): the five-year-group file from the keyless zip (80 MB), and each country's last revision. */
async function idb() {
  const zip = out('idb', 'idbzip.zip');
  writeFileSync(zip, Buffer.from(await (await get('https://www.census.gov/data-tools/demo/data/idb/dataset/idbzip.zip')).arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', '-j', zip, 'idb5yr.txt', '-d', join(RAW_MORE, 'idb')]);
  const table = await get('https://www.census.gov/programs-surveys/international-programs/about/idb/countries-and-areas.html');
  writeFileSync(out('idb', 'countries-and-areas.html'), await table.text());
  console.log('idb: done');
}

/** World Bank Global Economic Prospects (CC BY 4.0): real GDP growth estimates and forecasts, 36 KB. */
async function gep() {
  const zip = out('gep', 'GEP_CSV.zip');
  writeFileSync(zip, Buffer.from(await (await get('https://databankfiles.worldbank.org/public/ddpext_download/GEP_CSV.zip')).arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', '-j', zip, 'GEPCSV.csv', '-d', join(RAW_MORE, 'gep')]);
  console.log('gep: done');
}

/** OECD Economic Outlook 117 long-term scenarios: GDP per person and CO₂ for every area and scenario, about 3.5 MB each. */
async function oecdLt() {
  for (const measure of ['GDPVD_CAP', 'CO2']) {
    const url = `https://sdmx.oecd.org/public/rest/data/OECD.ECO.MAD,DSD_EO_LTB@DF_EO_LTB,1.0/.${measure}..A?dimensionAtObservation=AllDimensions&format=csvfile`;
    writeFileSync(out('oecd-lt', `${measure}.csv`), await (await get(url)).text());
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('oecd-lt: done');
}

/** The IMF forbids automated bulk download, so this only says where a person gets the WEO file (datasets/imf.ts reads it). */
async function imf() {
  mkdirSync(join(RAW_MORE, 'imf'), { recursive: true });
  console.log([
    'imf: download it by hand, then run `npm run import -- seed imf-weo`:',
    '  1. Open https://data.imf.org/en/datasets/IMF.RES:WEO (World Economic Outlook, October 2026).',
    '  2. Download, choosing the full dataset as CSV.',
    `  3. Put that one .csv file in ${join(RAW_MORE, 'imf')}.`,
  ].join('\n'));
}

const CCKP = 'https://cckpapi.worldbank.org/cckp/v1';
/** The variables History maps from the World Bank's Climate Change Knowledge Portal; tools/import/datasets/cckp.ts names them. */
export const CCKP_VARS = ['tas', 'txx', 'hd35', 'hd40', 'tr', 'pr', 'r20mm', 'cdd'];
export const CCKP_ERA5 = '1950-2025';

/**
 * CCKP country means (CC BY 4.0): ERA5 observed, and the bias-adjusted CMIP6 ensemble's 10th, 50th and 90th
 * percentiles, its historical run 1950–2014 and five SSPs 2015–2100. About 50 MB, one variable at a time; a wrong
 * code answers 200 with no data.
 */
async function cckp() {
  const fetchData = async (code: string, file: string) => {
    const body = (await (await get(`${CCKP}/${code}/all_countries?_format=json`)).json()) as { data?: Record<string, unknown> };
    if (!body.data || !Object.keys(body.data).length) throw new Error(`cckp: no data for ${code}`);
    writeFileSync(out('cckp', file), JSON.stringify(body.data));
    await new Promise(r => setTimeout(r, 2000));
  };
  for (const v of CCKP_VARS) {
    await fetchData(`era5-x0.25_timeseries_${v}_timeseries_annual_${CCKP_ERA5}_mean_historical_era5_x0.25_mean`, `era5-${v}.json`);
    await fetchData(`cmip6-x0.25_timeseries_${v}_timeseries_annual_1950-2014_p10,median,p90_historical_ensemble_all_mean`, `cmip6-historical-${v}.json`);
    await fetchData(`cmip6-x0.25_timeseries_${v}_timeseries_annual_2015-2100_p10,median,p90_ssp119,ssp126,ssp245,ssp370,ssp585_ensemble_all_mean`, `cmip6-${v}.json`);
    console.log(`cckp ${v}`);
  }
}

const FETCHERS: Record<string, () => Promise<void>> = { noaa, wikidata, attacks, conflicts, wpp, 'war-battles': warBattles, sitelinks, articles, 'test-series': testSeries, 'usgs-articles': usgsArticles, wdi, owid, nuclear, covid, cliopatria, gdis, cckp, wup, idb, gep, imf, 'oecd-lt': oecdLt, deflock, 'us-counties': usCounties, 'us-places': usPlaces, 'sipri-milex': sipriMilex, 'cow-nmc': cowNmc, events, recover, gvp, plague, 'cline-coups': clineCoups, pax, ibtracs, gcat, fireballs, epica, oxrep, 'mass-mobilization': massMobilization, 'slave-voyages': slaveVoyages, years };

async function main() {
  const names = process.argv.slice(2);
  const run = names.includes('all') ? Object.keys(FETCHERS) : names;
  if (!run.length || run.some(n => !FETCHERS[n])) {
    console.log(`usage: fetch <${Object.keys(FETCHERS).join('|')}|all>…`);
    process.exit(1);
  }
  for (const n of run) await FETCHERS[n]();
}

if (process.argv[1]?.endsWith('fetch.ts')) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
