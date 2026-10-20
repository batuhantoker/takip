/*
 * Wikidata (CC0) downloads into RAW_MORE/wikidata: battles, treaties and coups, attacks, wars, revolutions, massacres,
 * expulsions, the battles under WAC and COW wars, and other Wikipedias' articles. fetch.ts lists them.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAW_MORE } from './context';
import { readCsv } from './csv';
import { get, out } from './fetch-net';
import { WIKI_DIR } from './wiki';

export type Binding = Record<string, { value: string }>;

export async function sparql(query: string): Promise<Binding[]> {
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
export const TIME = (p: string, v: string) =>
  `OPTIONAL { ?item p:${p}/psv:${p} [ wikibase:timeValue ?${v}v; wikibase:timePrecision ?${v}p ] . BIND(CONCAT(STR(?${v}v), "/", STR(?${v}p)) AS ?${v}_) }`;

/**
 * Detail rows for a chunk of items. A full query over 20k battles times out at the endpoint's 60 s,
 * so items are listed first and fetched 1,500 at a time. One row per item: the first value of each field.
 */
export async function details(ids: string[], extra: string, extraVars: string[]) {
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

export async function items(classes: string[]) {
  const b = await sparql(`SELECT DISTINCT ?item WHERE { VALUES ?cls { ${classes.map(c => `wd:${c}`).join(' ')} } ?item wdt:P31 ?cls . }`);
  return b.map(x => x.item.value.replace('http://www.wikidata.org/entity/', ''));
}

/** Battle, naval battle, skirmish, engagement, siege. Legendary and mythical battles are left out. */
export const BATTLE_CLASSES = ['Q178561', 'Q1261499', 'Q997267', 'Q48767773', 'Q188055'];
/** Treaty and the subclasses that carry a signing date and place; coups d'état. */
export const TREATY_CLASSES = ['Q131569', 'Q625298', 'Q1143371', 'Q9557810', 'Q6934728', 'Q1691434', 'Q107706', 'Q217901', 'Q1412901', 'Q1498487', 'Q864737', 'Q252550', 'Q2300991'];
export const COUP_CLASSES = ['Q45382'];
export const ATTACK_CLASS = 'Q2223653';

/** Wikidata (CC0): battles and sieges; treaties and coups with the place they were signed or the capital they hit. */
export async function wikidata() {
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

/** Terrorist attacks and their subclasses (Wikidata, CC0), with deaths and injured. */
export async function attacks() {
  const ids = (await sparql(`SELECT DISTINCT ?item WHERE { ?item wdt:P31/wdt:P279* wd:${ATTACK_CLASS} . }`)).map(b => b.item.value.split('/').pop()!);
  console.log(`wikidata attacks: ${ids.length} items`);
  const extra = `OPTIONAL { ?item wdt:P1120 ?deaths_ } OPTIONAL { ?item wdt:P1339 ?injured_ }`;
  writeFileSync(out('wikidata', 'attacks.json'), JSON.stringify(await details(ids, extra, ['deaths', 'injured'])));
}

/**
 * Picked from the direct subclasses of war, rebellion, revolution and massacre on 2026-10-16 (instances in brackets).
 * Left out: armed conflict (531; UCDP's conflicts, with no id to join on), sack (118), and the abstract ones
 * (technological revolution, total war). Wars: war, civil, world, independence, national liberation, colonial,
 * religious, proxy, revolutionary (1,767 / 382 / 5 / 28 / 26 / 25 / 57 / 10 / 2).
 */
export const WAR_CLASSES = ['Q198', 'Q8465', 'Q103495', 'Q21994376', 'Q1006311', 'Q2659056', 'Q1827102', 'Q864113', 'Q3119121'];
/** Rebellion, insurgency, slave rebellion, mutiny, agrarian uprising (1,734 / 137 / 62 / 131 / 1). */
export const REBELLION_CLASSES = ['Q124734', 'Q1323212', 'Q1155622', 'Q511866', 'Q114363090'];
/** Revolution, nonviolent, communist, democratic (201 / 3 / 2 / 1); assassination (239). */
export const REVOLUTION_CLASSES = ['Q10931', 'Q3827292', 'Q2415843', 'Q5255897'];
export const ASSASSINATION_CLASSES = ['Q3882219'];
/** Massacre, genocidal massacre, massacre of civilians (3,584 / 8 / 7). */
export const MASSACRE_CLASSES = ['Q3199915', 'Q5533440', 'Q124612203'];
/**
 * Genocide, The Holocaust, autogenocide (124 / 9 / 1; 2026-10-20). Left out of genocide's other subclasses: mass
 * killings under communist regimes, ethnocide and religious cleansing (5 / 4 / 1), which would turn Katyn and five
 * other imported massacres into genocides; cultural genocide (9), which kills no one; genocide of indigenous peoples
 * (3, all undated).
 */
export const GENOCIDE_CLASSES = ['Q41397', 'Q2763', 'Q786766'];
/**
 * Mass murder (655 on 2026-10-20), massacre's parent. Half its unheld items are private crimes (shootings, family
 * murders, poisonings), so one that is only this needs a tie to a conflict: datasets/wikidata-conflict.ts
 * `massMurderReject`. Its subclasses spree killing, amok and family annihilation (14 / 6 / 5) stay out.
 */
export const MASS_MURDER_CLASSES = ['Q750215'];
/** Pogrom (143). Its parent ethnic riot (117) stays out: race riots and unrest such as Detroit 1967 or Cronulla 2005. */
export const POGROM_CLASSES = ['Q177716'];
/**
 * Picked from the direct subclasses of forced displacement and deportation on 2026-10-20: ethnic cleansing,
 * deportation, forced displacement, population transfer (64 / 101 / 114 / 20), forced march and death march, both
 * of its classes (2 / 11 / 2), expulsions and exoduses of Jews, expulsion of Jews, deportation of Jews, expulsion of
 * Muslims, expulsion of the Jesuits, Holocaust train transport (4 / 3 / 1 / 1 / 1 / 1). Left out: exile (17) and
 * penal transportation (2), which banish one person; Q285701 "deportation" (4), an immigration-law removal;
 * remigration (2), a political slogan; forced adoption (1).
 *
 * Also surveyed and left out, for every item alike: religious persecution and persecution (25 / 36, mostly undated
 * or centuries long, e.g. the Spanish Inquisition), political repression (69), war crime, Nazi crime, crime against
 * humanity (396 / 282 / 30: legal categories that mix killings with looting, arrests, trials and experiments, e.g.
 * Abu Ghraib, MKUltra), ethnic, communal and sectarian violence (28 / 10 / 7: long conflicts such as the Troubles).
 */
export const EXPULSION_CLASSES = [
  'Q154278', 'Q379693', 'Q837556', 'Q15589476', 'Q3289720', 'Q326259', 'Q5023193',
  'Q878794', 'Q112651297', 'Q136674984', 'Q136678169', 'Q13548138', 'Q5883983',
];

// Deaths as "amount/lower/upper" from one statement, so SAMPLE can't pair one estimate with another's bounds.
const CONFLICT_EXTRA = `OPTIONAL { ?item p:P1120/psv:P1120 ?dv . ?dv wikibase:quantityAmount ?da .
      OPTIONAL { ?dv wikibase:quantityLowerBound ?dlo } OPTIONAL { ?dv wikibase:quantityUpperBound ?dhi }
      BIND(CONCAT(STR(?da), "/", COALESCE(STR(?dlo), ""), "/", COALESCE(STR(?dhi), "")) AS ?deaths_) }
    OPTIONAL { ?item wdt:P17/wdt:P625 ?countryCoord_ }`;
// A perpetrator that is an item but not a person: a state, army or group. Unknown values are blank-node IRIs.
const ORG_PERP = `OPTIONAL { ?item wdt:P8031 ?perp . FILTER(STRSTARTS(STR(?perp), "http://www.wikidata.org/entity/Q"))
      FILTER NOT EXISTS { ?perp wdt:P31 wd:Q5 } BIND("1" AS ?orgPerp_) }`;
// Where a deportation or march set out from (P1427 start point); 31 of them say, 25 give a destination (P1444).
const ORIGIN = `OPTIONAL { ?item wdt:P1427/wdt:P625 ?fromCoord_ }`;

/**
 * Wikidata (CC0): wars and rebellions, revolutions and assassinations, massacres, genocides and pogroms, expulsions
 * and deportations, one file each, with deaths and the country's point for items placed nowhere closer. The
 * importers drop items the battle, politics and attack files already hold. `only` limits it to some of the files.
 */
export async function conflicts(only?: string[]) {
  const files: [file: string, classes: string[], extra: string, vars: string[]][] = [
    ['wars.json', [...WAR_CLASSES, ...REBELLION_CLASSES], '', []],
    ['revolutions.json', [...REVOLUTION_CLASSES, ...ASSASSINATION_CLASSES], '', []],
    ['massacres.json', [...MASSACRE_CLASSES, ...GENOCIDE_CLASSES, ...MASS_MURDER_CLASSES, ...POGROM_CLASSES], ORG_PERP, ['orgPerp']],
    ['displacements.json', EXPULSION_CLASSES, ORIGIN, ['fromCoord']],
  ];
  for (const [file, classes, extra, vars] of files) {
    if (only && !only.includes(file)) continue;
    const ids = await items(classes);
    console.log(`wikidata ${file}: ${ids.length} items`);
    writeFileSync(out('wikidata', file), JSON.stringify(await details(ids, `${CONFLICT_EXTRA} ${extra}`, ['deaths', 'countryCoord', ...vars])));
  }
}

/**
 * WAC and COW wars as their wiki tables' articles: each article's Wikidata item, then every battle Wikidata puts
 * under it (P361 or P607, through campaigns and fronts). The import links them part_of.
 */
export async function warBattles() {
  const wars: { key: string; qid: string }[] = [];
  for (const table of ['wac1914', 'cow']) {
    const rows = await readCsv(join(WIKI_DIR, `${table}.csv`));
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      const params = { action: 'query', format: 'json', formatversion: '2', redirects: '1', prop: 'pageprops', ppprop: 'wikibase_item', titles: chunk.map(r => r.title).join('|') };
      const { query } = (await (await get(`https://en.wikipedia.org/w/api.php?${new URLSearchParams(params)}`)).json()) as {
        query: { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[]; pages: { title: string; pageprops?: { wikibase_item?: string } }[] };
      };
      const moved = new Map([...(query.normalized ?? []), ...(query.redirects ?? [])].map(r => [r.from, r.to]));
      const qid = new Map(query.pages.map(p => [p.title, p.pageprops?.wikibase_item]));
      for (const r of chunk) {
        const normal = moved.get(r.title) ?? r.title;
        const q = qid.get(moved.get(normal) ?? normal);
        if (q) wars.push({ key: `${table}:${r.record}`, qid: q });
        else console.log(`  no Wikidata item for ${table} ${r.record} (${r.title})`);
      }
    }
  }
  const qids = [...new Set(wars.map(w => w.qid))];
  const battles: { war: string; item: string }[] = [];
  // 25 wars a query: the transitive path times out on all of them at once.
  for (let i = 0; i < qids.length; i += 25) {
    const rows = await sparql(`
      SELECT DISTINCT ?item ?war WHERE {
        VALUES ?war { ${qids.slice(i, i + 25).map(q => `wd:${q}`).join(' ')} }
        VALUES ?cls { ${BATTLE_CLASSES.map(c => `wd:${c}`).join(' ')} }
        ?item wdt:P31 ?cls . ?item (wdt:P361|wdt:P607)/wdt:P361* ?war .
      }`);
    for (const b of rows) battles.push({ war: b.war.value.split('/').pop()!, item: b.item.value.split('/').pop()! });
  }
  writeFileSync(out('wikidata', 'war-battles.json'), JSON.stringify({ wars, battles }));
  console.log(`war battles: ${battles.length} links from ${new Set(battles.map(b => b.item)).size} battles to ${new Set(battles.map(b => b.war)).size} of ${qids.length} wars`);
}

/** Sitelinks that aren't Wikipedias: commonswiki, specieswiki and the like. */
const NOT_WIKIPEDIA = new Set(['commons', 'species', 'meta', 'mediawiki', 'wikidata', 'sources', 'outreach', 'wikimania', 'incubator', 'foundation', 'wikifunctions', 'abstract']);

/**
 * Every Wikipedia's article for the wars, battles, revolutions, treaties, coups, massacres and attacks with no English
 * one, from the entity API: SPARQL over sitelinks times out. Needs `wikidata`, `attacks` and `conflicts` first. Writes
 * { item: { wiki code: title } }.
 */
export async function sitelinks() {
  const files = ['battles.json', 'politics.json', 'attacks.json', 'wars.json', 'revolutions.json', 'massacres.json', 'displacements.json'];
  const rows = files.flatMap(f => (existsSync(join(RAW_MORE, 'wikidata', f)) ? (JSON.parse(readFileSync(join(RAW_MORE, 'wikidata', f), 'utf8')) as { item: string; article?: string }[]) : []));
  const ids = [...new Set(rows.filter(r => !r.article).map(r => r.item))];
  const links: Record<string, Record<string, string>> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const body = (await (await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks&ids=${ids.slice(i, i + 50).join('|')}`)).json()) as {
      entities?: Record<string, { sitelinks?: Record<string, { title: string }> }>;
    };
    for (const [id, entity] of Object.entries(body.entities ?? {}))
      for (const [site, link] of Object.entries(entity.sitelinks ?? {})) {
        const code = site.match(/^([a-z_]+)wiki$/)?.[1];
        if (code && !NOT_WIKIPEDIA.has(code)) (links[id] ??= {})[code.replace(/_/g, '-')] = link.title;
      }
    if (i % 1000 === 0) console.log(`  ${i}/${ids.length}`);
    await new Promise(r => setTimeout(r, 1000));
  }
  writeFileSync(out('wikidata', 'sitelinks.json'), JSON.stringify(links));
  console.log(`sitelinks: ${Object.keys(links).length} of ${ids.length} items have an article in another language`);
}
