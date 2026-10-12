/*
 * Downloads the keyless sources the second batch of importers reads into RAW_MORE (gitignored).
 *   npx tsx tools/import/fetch.ts <noaa|wikidata|owid|nuclear|covid|all>
 * Files are replaced whole; importers hash them, so an unchanged download is skipped on import.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAW_MORE } from './context';

const UA = 'TAKIP-history-import/0.1 (https://takip.example; hello@takip.dev)';

async function get(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...init.headers } });
    if (res.ok) return res;
    if (attempt >= 4 || (res.status !== 429 && res.status < 500)) throw new Error(`${res.status} ${url}`);
    await new Promise(r => setTimeout(r, 5000 * attempt));
  }
}

const out = (dir: string, file: string) => {
  mkdirSync(join(RAW_MORE, dir), { recursive: true });
  return join(RAW_MORE, dir, file);
};

/** NCEI Natural Hazards (public domain): significant earthquakes, tsunami events and volcanic eruptions. */
async function noaa() {
  const base = 'https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1';
  for (const [path, file] of [['earthquakes', 'earthquakes.json'], ['tsunamis/events', 'tsunamis.json'], ['volcanoes', 'volcanoes.json']]) {
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

type Binding = Record<string, { value: string }>;

async function sparql(query: string): Promise<Binding[]> {
  const res = await get('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ query }),
  });
  return ((await res.json()) as { results: { bindings: Binding[] } }).results.bindings;
}

/** Labels used, in this order, when an item has no English one. */
const FALLBACK_LANGS = ['mul', 'fr', 'de', 'es', 'it', 'pt', 'pl', 'ru'];

/** "<time>/<precision>" in one value, so SAMPLE can't pair one statement's time with another's precision. */
const TIME = (p: string, v: string) =>
  `OPTIONAL { ?item p:${p}/psv:${p} [ wikibase:timeValue ?${v}v; wikibase:timePrecision ?${v}p ] . BIND(CONCAT(STR(?${v}v), "/", STR(?${v}p)) AS ?${v}_) }`;

/**
 * Detail rows for a chunk of items. A full query over 20k battles times out at the endpoint's 60 s,
 * so items are listed first and fetched 1,500 at a time. One row per item: the first value of each field.
 */
async function details(ids: string[], extra: string, extraVars: string[]) {
  const vars = ['label', 'otherLabel', 'desc', 'coord', 'locCoord', 't', 't0', 't1', 'article', ...extraVars];
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < ids.length; i += 1500) {
    const chunk = ids.slice(i, i + 1500);
    const bindings = await sparql(`
      SELECT ?item ${vars.map(v => `(SAMPLE(?${v}_) AS ?${v})`).join(' ')}
        (GROUP_CONCAT(DISTINCT STRAFTER(STR(?cls), "entity/"); separator="|") AS ?classes)
        (GROUP_CONCAT(DISTINCT STRAFTER(STR(?war), "entity/"); separator="|") AS ?wars)
      WHERE {
        VALUES ?item { ${chunk.map(id => `wd:${id}`).join(' ')} }
        ?item wdt:P31 ?cls .
        OPTIONAL { ?item rdfs:label ?label_ FILTER(LANG(?label_) = "en") }
        ${FALLBACK_LANGS.map(l => `OPTIONAL { ?item rdfs:label ?l_${l} FILTER(LANG(?l_${l}) = "${l}") }`).join(' ')}
        BIND(COALESCE(${FALLBACK_LANGS.map(l => `?l_${l}`).join(', ')}) AS ?otherLabel_)
        OPTIONAL { ?item schema:description ?desc_ FILTER(LANG(?desc_) = "en") }
        OPTIONAL { ?item wdt:P625 ?coord_ }
        OPTIONAL { ?item wdt:P276/wdt:P625 ?locCoord_ }
        ${TIME('P585', 't')} ${TIME('P580', 't0')} ${TIME('P582', 't1')}
        OPTIONAL { ?article_ schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }
        OPTIONAL { ?item wdt:P361|wdt:P607 ?war }
        ${extra}
      } GROUP BY ?item`);
    for (const b of bindings) rows.push(Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value.replace('http://www.wikidata.org/entity/', '')])));
    console.log(`  ${Math.min(i + chunk.length, ids.length)}/${ids.length}`);
  }
  return rows;
}

async function items(classes: string[]) {
  const b = await sparql(`SELECT DISTINCT ?item WHERE { VALUES ?cls { ${classes.map(c => `wd:${c}`).join(' ')} } ?item wdt:P31 ?cls . }`);
  return b.map(x => x.item.value.replace('http://www.wikidata.org/entity/', ''));
}

/** Battle, naval battle, skirmish, engagement, siege. Legendary and mythical battles are left out. */
export const BATTLE_CLASSES = ['Q178561', 'Q1261499', 'Q997267', 'Q48767773', 'Q188055'];
/** Treaty and the subclasses that carry a signing date and place; coups d'état. */
export const TREATY_CLASSES = ['Q131569', 'Q625298', 'Q1143371', 'Q9557810', 'Q6934728', 'Q1691434', 'Q107706', 'Q217901', 'Q1412901', 'Q1498487', 'Q864737', 'Q252550', 'Q2300991'];
export const COUP_CLASSES = ['Q45382'];

/** Wikidata (CC0): battles and sieges; treaties and coups with the place they were signed or the capital they hit. */
async function wikidata() {
  const battles = await items(BATTLE_CLASSES);
  console.log(`wikidata battles: ${battles.length} items`);
  writeFileSync(out('wikidata', 'battles.json'), JSON.stringify(await details(battles, '', [])));
  // Most world-war battles sit under a front or campaign, not under the war itself.
  const worldWars = await sparql(`
    SELECT DISTINCT ?item ?war WHERE {
      VALUES ?cls { ${BATTLE_CLASSES.map(c => `wd:${c}`).join(' ')} } VALUES ?war { wd:Q361 wd:Q362 }
      ?item wdt:P31 ?cls . ?item (wdt:P361|wdt:P607)/wdt:P361* ?war .
    }`);
  writeFileSync(out('wikidata', 'world-wars.json'), JSON.stringify(worldWars.map(b => ({ item: b.item.value.split('/').pop(), war: b.war.value.split('/').pop() }))));

  const politics = [...new Set([...(await items(TREATY_CLASSES)), ...(await items(COUP_CLASSES))])];
  console.log(`wikidata treaties and coups: ${politics.length} items`);
  const extra = `
    OPTIONAL { ?item wdt:P1071/wdt:P625 ?signCoord_ }
    ${TIME('P571', 'inception')}
    OPTIONAL { ?item wdt:P17 ?country . ?country wdt:P36/wdt:P625 ?cap . BIND(CONCAT(STRAFTER(STR(?country), "entity/"), " ", STR(?cap)) AS ?capital_) }`;
  writeFileSync(out('wikidata', 'politics.json'), JSON.stringify(await details(politics, extra, ['signCoord', 'inception', 'capital'])));
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

const FETCHERS: Record<string, () => Promise<void>> = { noaa, wikidata, owid, nuclear, covid };

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
