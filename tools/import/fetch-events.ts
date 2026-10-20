/*
 * Wikidata (CC0) history beyond war, into RAW_MORE/wikidata: famines, epidemics and fires (disasters.json); riots,
 * protests, strikes and revolts (unrest.json); air, rail, road, mining, explosion, crowd and industrial accidents
 * (accidents.json); military operations, raids and air strikes (operations.json); shootings and murders
 * (crimes.json); and other Wikipedias' articles for them (events-sitelinks.json). Read through QLever's Wikidata
 * endpoint: WDQS rate-limits this IP under parallel load.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { get, out, UA } from './fetch-net';
import type { Binding } from './fetch-wikidata';

const QLEVER = 'https://qlever.dev/api/wikidata';
const PREFIXES = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
`;

/*
 * Classes picked 2026-10-20 from the trees under famine, disease outbreak, fire, riot, protest, demonstration and
 * strike (direct instances in brackets). Explicit lists, not P279*: riot's and protest's trees reach Holocaust
 * train journeys (1,258) and favelas through pogrom and occupation.
 */
/** Famine (122). */
export const FAMINE_CLASSES = ['Q168247'];
/**
 * Disease outbreak, epidemic, pandemic, influenza pandemic, and plague, cholera, smallpox, dengue, foodborne and
 * chikungunya outbreaks (1,324 besides COVID-19's local items / 151 / 28 / 11 / 66 / 37 / 21 / 19 / 4 / 3).
 * Left out: flu seasons (36).
 */
export const EPIDEMIC_CLASSES = ['Q3241045', 'Q44512', 'Q12184', 'Q2723958', 'Q1516910', 'Q959265', 'Q30103545', 'Q5256962', 'Q141436288', 'Q89252833'];
/**
 * City fire, conflagration, fires of Edo, structure, skyscraper, industrial and church fires, library fires,
 * multiple-alarm fires (293 / 793 / 7 / 285 / 2 / 26 / 5 / 5 / 7). Left out: arson (attacks), gas explosions,
 * train, tunnel and vehicle fires.
 */
export const FIRE_CLASSES = ['Q838718', 'Q168983', 'Q3149858', 'Q7625093', 'Q7538017', 'Q17094485', 'Q113572691', 'Q116498219', 'Q6934865'];
/** Wildfire, forest fire, megafire, bushfires in Australia, bushfire, wildfires in Catalonia (897 / 47 / 11 / 36 / 2 / 17). */
export const WILDFIRE_CLASSES = ['Q169950', 'Q107434304', 'Q83645467', 'Q1017324', 'Q63770148', 'Q107637456'];
/**
 * Riot, ethnic, prison, food, sports, tax, student, police and rice riots, anti-missionary riots in China,
 * asonada, civil disorder (1,071 / 117 / 54 / 38 / 17 / 11 / 4 / 3 / 3 / 16 / 3 / 72).
 */
export const RIOT_CLASSES = ['Q124757', 'Q3588250', 'Q2920604', 'Q5465517', 'Q7579940', 'Q6024855', 'Q7627882', 'Q7209603', 'Q11604427', 'Q11079230', 'Q16533779', 'Q686984'];
/**
 * Protest, demonstration, student protest, protest march, rally (×2), LGBT+, anti-nuclear, climate and housing
 * protests, sit-in (×2), civil disobedience, direct action, protest camp, human chain,
 * street blockade, counter-protest, counter-demonstration, occupation, day of action, candlelight vigil, mineriad.
 * Left out: nonviolent resistance (8, mostly campaigns).
 */
export const PROTEST_CLASSES = [
  'Q273120', 'Q175331', 'Q1679887', 'Q15631336', 'Q60716473', 'Q19609158', 'Q125506609', 'Q15466187', 'Q116004037', 'Q141681591',
  'Q1147337', 'Q14523556', 'Q47217', 'Q506259', 'Q7251589', 'Q1562095', 'Q72850604', 'Q5176895', 'Q58815974', 'Q528892',
  'Q63993400', 'Q903900', 'Q853284',
];
/**
 * Strike, general strike, revolutionary general strike, teacher, school, coal, rent, police, wildcat, prison,
 * climate and hunger strikes, labour dispute, lockout (805 / 132 / 5 / 21 / 20 / 19 / 11 / 7 / 6 / 6 / 5 / 33 / 23 / 5).
 */
export const STRIKE_CLASSES = ['Q49776', 'Q49775', 'Q5555532', 'Q116885608', 'Q780417', 'Q130704399', 'Q7313519', 'Q7209607', 'Q1198713', 'Q7245793', 'Q122955400', 'Q191355', 'Q5782934', 'Q159377'];
/** Peasant revolt, revolt, and Japan's ikki (88 / 277 / 17 + 17): uprisings outside fetch-wikidata's REBELLION_CLASSES. */
export const UPRISING_CLASSES = ['Q13427116', 'Q6107280', 'Q8191556', 'Q947533', 'Q9683607', 'Q20045350', 'Q11490312'];

/**
 * Accidents, picked 2026-10-20 from the trees under aviation accident, railway accident, traffic collision, mining
 * accident, explosion, stampede and industrial disaster. Air: aviation accident and incident, mid-air and ground
 * collisions, helicopter crash, hull loss, runway overrun and excursion, hard landing, air show accident, pilot
 * suicide, shootdowns (3,151 / 131 / 108 / 9 / 28 / 10 / 8 / 8 / 6 / 5 / 11 / 62 + 5). Airliner bombings are attacks.
 */
export const AIR_CLASSES = ['Q744913', 'Q3149875', 'Q1863435', 'Q116673853', 'Q106466398', 'Q15931405', 'Q134822853', 'Q17363717', 'Q1527693', 'Q17355126', 'Q19689353', 'Q6539177', 'Q8228287'];
/** Railway accident, derailment, train collision, level crossing collision, collision, tram accident, runaway train, train fire (1,576 / 176 / 119 / 68 / 51 / 40 / 13 / 24). */
export const RAIL_CLASSES = ['Q1078765', 'Q1331380', 'Q11396408', 'Q19710423', 'Q19403959', 'Q7833114', 'Q17005145', 'Q11396401'];
/** Traffic collision, bus accident, car collision, multiple-vehicle collision (192 / 240 / 162 / 10). */
export const ROAD_CLASSES = ['Q9687', 'Q24871403', 'Q61037771', 'Q1339582'];
/** Mining accident, mine and firedamp explosions, tailings dam failure (255 / 20 / 7 / 28). */
export const MINING_CLASSES = ['Q1550225', 'Q23007305', 'Q12089136', 'Q54643580'];
/** Explosion, gas, dust, boiler and vehicle explosions (406 / 84 / 7 / 6 / 15); bombings and nuclear tests are other sources'. */
export const EXPLOSION_CLASSES = ['Q179057', 'Q1362483', 'Q2296331', 'Q1417169', 'Q7918434'];
/** Stampede, crowd crush (95 / 18). */
export const CROWD_CLASSES = ['Q2165983', 'Q106673346'];
/** Industrial disaster, chemical accident, nuclear accident (84 / 17 / 50). */
export const INDUSTRIAL_CLASSES = ['Q68800046', 'Q977367', 'Q1620824'];
/**
 * Military operation, offensive, counter-offensive, invasion, landing operation, storming, military strike, air
 * strike, aerial bombing (of a city), carpet and strategic bombing, missile strike, bombardment, naval bombing of a
 * city, military raid (3,093 / 511 / 10 / 462 / 44 / 20 / 16 / 443 / 17 / 296 / 6 / 6 / 167 / 241 / 38 / 392).
 * Battles, sieges and campaigns are wikidata-battles' and -wars'; Nazi roundups and slave raids are persecution.
 */
export const OPERATION_CLASSES = [
  'Q645883', 'Q2001676', 'Q5176896', 'Q467011', 'Q646740', 'Q104708121', 'Q6857862', 'Q2380335', 'Q17912683', 'Q4688003', 'Q838364',
  'Q841418', 'Q111034471', 'Q678146', 'Q27653727', 'Q476807',
];
/** Shooting, mass, school, university, workplace, spree, hospital and drive-by shootings, shooting attack, shootout (152 / 779 / 104 / 42 / 8 / 6 / 5 / 10 / 128 / 84). */
export const SHOOTING_CLASSES = ['Q2252077', 'Q21480300', 'Q473853', 'Q136281265', 'Q117600085', 'Q118188839', 'Q140350211', 'Q1259359', 'Q109217482', 'Q2406205'];
/**
 * Homicide, murder, deliberate and political murder, mass, serial and double murder, murder–suicide, familicide,
 * femicide, pedicide, robbery-murder, Feme murders, Japan's penal-code homicide, school massacre, lynching, stabbing,
 * mass stabbing, spree killing (1,419 / 2,727 / 357 / 320 / 655 / 62 / 41 / 57 / 25 / 28 / 30 / 28 / 50 / 37 / 19 /
 * 209 / 46 / 30 / 14). Left out: executions; assassinations are wikidata-revolutions'.
 */
export const MURDER_CLASSES = [
  'Q149086', 'Q132821', 'Q4676786', 'Q1139665', 'Q750215', 'Q16266378', 'Q5300066', 'Q3307578', 'Q5400895', 'Q1342425', 'Q13587273',
  'Q11487748', 'Q1404483', 'Q11547135', 'Q21175615', 'Q486775', 'Q464643', 'Q64149164', 'Q66975460',
];

export const DISASTER_CLASSES = [...FAMINE_CLASSES, ...EPIDEMIC_CLASSES, ...FIRE_CLASSES, ...WILDFIRE_CLASSES];
export const UNREST_CLASSES = [...RIOT_CLASSES, ...PROTEST_CLASSES, ...STRIKE_CLASSES, ...UPRISING_CLASSES];
export const ACCIDENT_CLASSES = [...AIR_CLASSES, ...RAIL_CLASSES, ...ROAD_CLASSES, ...MINING_CLASSES, ...EXPLOSION_CLASSES, ...CROWD_CLASSES, ...INDUSTRIAL_CLASSES];
export const CRIME_CLASSES = [...SHOOTING_CLASSES, ...MURDER_CLASSES];

/** The files fetch.ts `events` writes, in the order the importers drop each other's items. */
export const EVENT_FILES: [file: string, classes: string[]][] = [
  ['disasters.json', DISASTER_CLASSES],
  ['unrest.json', UNREST_CLASSES],
  ['accidents.json', ACCIDENT_CLASSES],
  ['operations.json', OPERATION_CLASSES],
  ['crimes.json', CRIME_CLASSES],
];

/** Country-like and continent-like location items, flagged so the importer doesn't call their centroid an area. */
export const COUNTRY_TYPES = ['Q6256', 'Q3624078', 'Q3024240', 'Q7275'];
export const CONTINENT_TYPES = ['Q5107', 'Q855697'];

const COVID_PANDEMIC = 'Q81068910';
const LABEL_LANGS = ['mul', 'fr', 'de', 'es', 'it', 'pt', 'pl', 'ru', 'nl', 'ja', 'zh'];
const NOT_WIKIPEDIA = new Set(['commons', 'species', 'meta', 'mediawiki', 'wikidata', 'sources', 'outreach', 'wikimania', 'incubator', 'foundation', 'wikifunctions', 'abstract']);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const qid = (v: string) => v.replace('http://www.wikidata.org/entity/', '');

/** A query QLever gave up on (its 30 s limit); it answers these with 429 too, so get() would resend it unchanged. */
class TooSlow extends Error {}

/** Rides out the minute-long network drops sweeps cause here; a query that is too slow is the caller's to split. */
async function patiently<T>(what: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof TooSlow || attempt >= 8) throw e;
      console.log(`  ${what}: ${(e as Error).message}; retrying in ${15 * attempt} s`);
      await sleep(15_000 * attempt);
    }
  }
}

export async function qlever(query: string): Promise<Binding[]> {
  const res = await fetch(QLEVER, {
    method: 'POST',
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ query: PREFIXES + query }),
  });
  const body = (await res.json().catch(() => ({}))) as { results?: { bindings: Binding[] }; exception?: string };
  if (res.ok && body.results) return body.results.bindings;
  if (/timed out/i.test(body.exception ?? '')) throw new TooSlow(body.exception);
  throw new Error(`qlever ${res.status}: ${body.exception?.slice(0, 200) ?? res.statusText}`);
}

/** Items of the classes, sorted so the item chunks (and the resume cache's keys) stay put between runs. */
export async function itemsOf(classes: string[]) {
  const rows = await qlever(`SELECT DISTINCT ?item WHERE {
    VALUES ?cls { ${classes.map(c => `wd:${c}`).join(' ')} } ?item wdt:P31 ?cls .
    FILTER NOT EXISTS { ?item wdt:P361+ wd:${COVID_PANDEMIC} } }`);
  return rows.map(b => qid(b.item.value)).sort();
}

const id = (v: string) => `STRAFTER(STR(${v}), "entity/")`;
const sample = (v: string) => `(SAMPLE(?${v}_) AS ?${v})`;
const joined = (v: string) => `(GROUP_CONCAT(DISTINCT ?${v}_; separator="|") AS ?${v})`;
const time = (prop: string, v: string): [string, string] =>
  [sample(v), `?item p:${prop}/psv:${prop} [ wikibase:timeValue ?tv; wikibase:timePrecision ?tp ] . BIND(CONCAT(STR(?tv), "/", STR(?tp)) AS ?${v}_)`];

/**
 * One field a query, inner joins only: QLever answers each in seconds over a whole file's classes, where OPTIONALs
 * (or several fields at once, which multiply) run past its 30 s limit on eight items. assemble() joins them.
 */
export const PARTS: Record<string, [select: string, where: string]> = {
  classes: [joined('classes'), `?item wdt:P31 ?c . BIND(${id('?c')} AS ?classes_)`],
  label: [sample('label'), '?item rdfs:label ?label_ FILTER(LANG(?label_) = "en")'],
  otherLabels: [joined('otherLabels'), `?item rdfs:label ?ol . FILTER(LANG(?ol) IN (${LABEL_LANGS.map(l => `"${l}"`).join(', ')})) BIND(CONCAT(LANG(?ol), ":", STR(?ol)) AS ?otherLabels_)`],
  // Any language at all, for items labelled only in one LABEL_LANGS leaves out (Czech rail accidents, Japanese ikki).
  anyLabel: [sample('anyLabel'), '?item rdfs:label ?anyLabel_'],
  desc: [sample('desc'), '?item schema:description ?desc_ FILTER(LANG(?desc_) = "en")'],
  coord: [sample('coord'), '?item wdt:P625 ?coord_'],
  t: time('P585', 't'),
  t0: time('P580', 't0'),
  t1: time('P582', 't1'),
  inception: time('P571', 'inception'),
  article: [sample('article'), '?article_ schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>'],
  locs: [joined('locs'), `?item wdt:P276 ?l . ?l wdt:P625 ?lc . BIND(CONCAT(${id('?l')}, " ", STR(?lc)) AS ?locs_)`],
  locTypes: [joined('locTypes'), `?item wdt:P276 ?l . ?l wdt:P31 ?lk . VALUES ?lk { ${[...COUNTRY_TYPES, ...CONTINENT_TYPES].map(c => `wd:${c}`).join(' ')} } BIND(CONCAT(${id('?l')}, " ", ${id('?lk')}) AS ?locTypes_)`],
  admins: [joined('admins'), `?item wdt:P131 ?a . ?a wdt:P625 ?ac . BIND(CONCAT(${id('?a')}, " ", STR(?ac)) AS ?admins_)`],
  countries: [joined('countries'), `?item wdt:P17 ?k . ?k wdt:P625 ?kc . BIND(CONCAT(${id('?k')}, " ", STR(?kc)) AS ?countries_)`],
  // By statement, so assemble() pairs one estimate with its own bounds.
  deaths: [joined('deaths'), '?item p:P1120 ?st . ?st psv:P1120/wikibase:quantityAmount ?da . BIND(CONCAT(STR(?st), " ", STR(?da)) AS ?deaths_)'],
  deathBounds: [joined('deathBounds'), '?item p:P1120 ?st . ?st psv:P1120 ?dv . ?dv wikibase:quantityLowerBound ?lo ; wikibase:quantityUpperBound ?hi . BIND(CONCAT(STR(?st), " ", STR(?lo), " ", STR(?hi)) AS ?deathBounds_)'],
  injured: [sample('injured'), '?item wdt:P1339 ?injured_'],
  participants: [sample('participants'), '?item wdt:P1132 ?participants_'],
  cause: [joined('cause'), '?item wdt:P828|wdt:P1478 ?why . ?why rdfs:label ?cause_ FILTER(LANG(?cause_) = "en")'],
  wikis: ['(COUNT(DISTINCT ?site) AS ?wikis)', '?wp schema:about ?item; schema:isPartOf ?site . ?site wikibase:wikiGroup "wikipedia"'],
};

const partQuery = (name: string, scope: string) => `SELECT ?item ${PARTS[name][0]} WHERE { ${scope} ${PARTS[name][1]} } GROUP BY ?item`;

/**
 * The parts as one row per item, in the shape the importers read: otherLabel in LABEL_LANGS order, else any, locations as
 * "Qid type point" (type "-" unless a country or continent), deaths as "amount/lower/upper" from one statement.
 */
export function assemble(raw: Record<string, string>): Record<string, string> {
  const { otherLabels, anyLabel, locTypes, deathBounds, deaths, locs, ...row } = raw;
  const byLang = new Map((otherLabels?.split('|') ?? []).map(s => [s.slice(0, s.indexOf(':')), s.slice(s.indexOf(':') + 1)]));
  const other = LABEL_LANGS.map(l => byLang.get(l)).find(Boolean) ?? anyLabel;
  if (other) row.otherLabel = other;
  if (locs) {
    const types = new Map((locTypes?.split('|') ?? []).map(s => s.split(' ') as [string, string]));
    row.locs = locs.split('|').map(s => {
      const [loc, ...point] = s.split(' ');
      return [loc, types.get(loc) ?? '-', ...point].join(' ');
    }).join('|');
  }
  if (deaths) {
    const [st, amount] = deaths.split('|').sort()[0].split(' ');
    const bounds = deathBounds?.split('|').map(b => b.split(' ')).find(b => b[0] === st);
    row.deaths = `${amount}/${bounds?.[1] ?? ''}/${bounds?.[2] ?? ''}`;
  }
  return row;
}

type Partial = { chunks: Record<string, Record<string, string>[]>; sitelinks?: { done: string[]; links: Record<string, Record<string, string>> } };
const PARTIAL = () => out('wikidata', 'events.partial.json');
const loadPartial = (): Partial => (existsSync(PARTIAL()) ? (JSON.parse(readFileSync(PARTIAL(), 'utf8')) as Partial) : { chunks: {} });
const savePartial = (p: Partial) => writeFileSync(PARTIAL(), JSON.stringify(p));

type Scope = { key: string; where: string; split: () => Promise<Scope[]> };
const hash = (ids: string[]) => createHash('sha1').update(ids.join(',')).digest('hex');
const itemScope = (ids: string[]): Scope => ({
  key: hash(ids),
  where: `VALUES ?item { ${ids.map(i => `wd:${i}`).join(' ')} }`,
  split: async () => (ids.length < 2 ? [] : [itemScope(ids.slice(0, ids.length / 2)), itemScope(ids.slice(ids.length / 2))]),
});
/** A file's classes in one query; one QLever can't finish in time goes class by class, then 200 items at a time. */
const classScope = (classes: string[]): Scope => ({
  key: hash(classes),
  where: `VALUES ?cls { ${classes.map(c => `wd:${c}`).join(' ')} } ?item wdt:P31 ?cls .`,
  split: async () => {
    if (classes.length > 1) return classes.map(c => classScope([c]));
    const ids = await patiently(classes[0], () => itemsOf(classes));
    return Array.from({ length: Math.ceil(ids.length / 200) }, (_, i) => itemScope(ids.slice(i * 200, i * 200 + 200)));
  },
});

/** One part over a scope, split while QLever runs out of time; each answer lands in the resume file. */
async function part(name: string, scope: Scope, partial: Partial): Promise<Record<string, string>[]> {
  const key = `${name}:${scope.key}`;
  if (partial.chunks[key]) return partial.chunks[key];
  try {
    const bindings = await patiently(`${name} ${scope.key.slice(0, 8)}`, () => qlever(partQuery(name, scope.where)));
    partial.chunks[key] = bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, qid(v.value)])));
  } catch (e) {
    if (!(e instanceof TooSlow)) throw e;
    const pieces = await scope.split();
    if (!pieces.length) console.log(`  ${name}: ${scope.key} times out alone; left without it`);
    const rows: Record<string, string>[] = [];
    for (const piece of pieces) rows.push(...(await part(name, piece, partial)));
    return rows;
  }
  savePartial(partial);
  await sleep(500);
  return partial.chunks[key];
}

/** One row per item of `ids`. */
async function details(file: string, classes: string[], ids: string[], partial: Partial) {
  const wanted = new Set(ids);
  const raw = new Map<string, Record<string, string>>();
  for (const name of Object.keys(PARTS)) {
    for (const r of await part(name, classScope(classes), partial)) if (wanted.has(r.item)) raw.set(r.item, Object.assign(raw.get(r.item) ?? {}, r));
    console.log(`  ${file}: ${name}`);
  }
  return [...raw.values()].filter(r => r.classes).map(assemble);
}

/**
 * Other Wikipedias' titles from the entity API, 50 items a call a second apart, for items with no English article.
 * Items the last run's file has are kept from it; delete the file to sweep them all again.
 */
async function sitelinks(ids: string[], partial: Partial) {
  const last = out('wikidata', 'events-sitelinks.json');
  const kept: Record<string, Record<string, string>> = existsSync(last) ? JSON.parse(readFileSync(last, 'utf8')) : {};
  const state = (partial.sitelinks ??= { done: Object.keys(kept), links: kept });
  const done = new Set(state.done);
  const todo = ids.filter(id => !done.has(id));
  for (let i = 0; i < todo.length; i += 50) {
    const chunk = todo.slice(i, i + 50);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks&ids=${chunk.join('|')}`;
    const body = await patiently('sitelinks', async () => (await (await get(url)).json()) as { entities?: Record<string, { sitelinks?: Record<string, { title: string }> }> });
    for (const [id, entity] of Object.entries(body.entities ?? {}))
      for (const [site, link] of Object.entries(entity.sitelinks ?? {})) {
        const code = site.match(/^([a-z_]+)wiki$/)?.[1];
        if (code && !NOT_WIKIPEDIA.has(code)) (state.links[id] ??= {})[code.replace(/_/g, '-')] = link.title;
      }
    state.done.push(...chunk);
    savePartial(partial);
    if (i % 1000 === 0) console.log(`  sitelinks: ${i}/${todo.length}`);
    await sleep(1000);
  }
  return state.links;
}

/** fetch.ts `events`. Re-running after a failure picks up from events.partial.json; a finished run deletes it. */
export async function events() {
  const partial = loadPartial();
  const all: Record<string, string>[] = [];
  for (const [file, classes] of EVENT_FILES) {
    const ids = await patiently(file, () => itemsOf(classes));
    console.log(`wikidata ${file}: ${ids.length} items`);
    const rows = await details(file, classes, ids, partial);
    writeFileSync(out('wikidata', file), JSON.stringify(rows));
    all.push(...rows);
  }
  const ids = [...new Set(all.filter(r => !r.article && Number(r.wikis) > 0).map(r => r.item))].sort();
  const found = await sitelinks(ids, partial);
  const links = Object.fromEntries(ids.filter(i => found[i]).map(i => [i, found[i]]));
  writeFileSync(out('wikidata', 'events-sitelinks.json'), JSON.stringify(links));
  rmSync(PARTIAL(), { force: true });
  console.log(`events sitelinks: ${Object.keys(links).length} of ${ids.length} items without an English article have another`);
}
