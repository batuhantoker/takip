// The Wikidata queries behind tools/site/build-mountains.ts. Which items are mountains, their articles and their
// coordinates are asked of QLever over the whole class set, one property a query with inner joins only: OPTIONALs, or
// several properties at once, run past its time limit over half a million items. The rest is asked of
// query.wikidata.org for those with an article, a few hundred at a time (fetch.ts).

export const PREFIXES = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
PREFIX pqv: <http://www.wikidata.org/prop/qualifier/value/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
`;

/** What gets a page: mountains, hills, summits, massifs and volcanoes, with every subclass. */
export const PEAK_ROOTS: Record<string, string> = {
  mountain: 'Q8502', hill: 'Q54050', summit: 'Q207326', massif: 'Q1061151', volcano: 'Q8072',
};

/** Classes under those roots that aren't a summit on land: ranges, the sea floor, other worlds' mountains. */
export const NOT_PEAK_ROOTS: Record<string, string> = {
  range: 'Q46831', seamount: 'Q503269', guyot: 'Q151957', submarine: 'Q674775', seamounts: 'Q47781032', mons: 'Q429088',
};

/**
 * Bot-written Wikipedias: Lsjbot's Cebuano, Swedish and Waray stubs from GeoNames, and the Ladin, Egyptian Arabic and
 * Acehnese runs like them. An article there says no more than the gazetteer it was made from.
 */
export const BOT_WIKIS = ['ceb', 'sv', 'war', 'lld', 'arz', 'ace'];

const ENTITY = 'http://www.wikidata.org/entity/';
const values = (v: string, qids: Iterable<string>) => `VALUES ?${v} { ${[...qids].map(q => `wd:${q}`).join(' ')} }`;
const ofClasses = (classes: Iterable<string>) => `${values('cls', classes)} ?item wdt:P31 ?cls .`;

export const classesQuery = () => `${PREFIXES} SELECT ?cls ?root WHERE {
  ${values('root', [...Object.values(PEAK_ROOTS), ...Object.values(NOT_PEAK_ROOTS)])} ?cls wdt:P279* ?root }`;

/** Each query's columns after ?item, in order. */
export const PROPERTY_QUERIES: Record<string, (classes: string[]) => string> = {
  items: c => `${PREFIXES} SELECT ?item ?cls WHERE { ${ofClasses(c)} }`,
  articles: c => `${PREFIXES} SELECT ?item ?wiki ?title WHERE { ${ofClasses(c)}
    ?article schema:about ?item ; schema:isPartOf ?wiki ; schema:name ?title .
    FILTER(CONTAINS(STR(?wiki), ".wikipedia.org/") && ${BOT_WIKIS.map(w => `?wiki != <https://${w}.wikipedia.org/>`).join(' && ')}) }`,
  coords: c => `${PREFIXES} SELECT ?item ?coord WHERE { ${ofClasses(c)} ?item wdt:P625 ?coord }`,
};

/**
 * Everything else about a list of mountains, a row per value as (item, property, value, extra, unit): heights with
 * their rank and unit, so the builder can take the preferred statement and convert feet; parent peak, range,
 * countries, picture, volcano number, first ascent (P793 = Q1194369, dated by P585, its precision in `extra`), and
 * the places it is the highest point of (P610, read from the other end). UNIONs, so no value multiplies another.
 */
export const detailsQuery = (qids: string[]) => {
  const quantity = (prop: string, name: string) =>
    `{ ?item p:${prop} ?s_${name} . ?s_${name} wikibase:rank ?extra ; psv:${prop} ?v_${name} . ?v_${name} wikibase:quantityAmount ?value ; wikibase:quantityUnit ?unit . BIND("${name}" AS ?prop) }`;
  return `${PREFIXES} SELECT ?item ?prop ?value ?extra ?unit WHERE { ${values('item', qids)}
  ${quantity('P2044', 'elevation')} UNION ${quantity('P2660', 'prominence')} UNION ${quantity('P2659', 'isolation')}
  UNION { ?item wdt:P3137 ?value . BIND("parent" AS ?prop) }
  UNION { ?item wdt:P4552 ?value . BIND("range" AS ?prop) }
  UNION { ?item wdt:P17 ?country . ?country wdt:P297 ?value . BIND("country" AS ?prop) }
  UNION { ?item wdt:P18 ?value . BIND("image" AS ?prop) }
  UNION { ?item wdt:P1886 ?value . BIND("gvp" AS ?prop) }
  UNION { ?item p:P793 ?event . ?event ps:P793 wd:Q1194369 ; pqv:P585 ?when . ?when wikibase:timeValue ?value ; wikibase:timePrecision ?extra . BIND("ascent" AS ?prop) }
  UNION { ?value wdt:P610 ?item . BIND("highest" AS ?prop) } }`;
};

/** Labels in the page languages, plus "mul" (the label shared by every language). */
export const labelsQuery = (qids: string[], langs: readonly string[]) => `${PREFIXES} SELECT ?item ?label WHERE {
  ${values('item', qids)} ?item rdfs:label ?label . FILTER(LANG(?label) IN (${[...langs, 'mul'].map(l => `"${l}"`).join(', ')})) }`;

/** What kind of place each is: a country by its ISO code, a range by its class. */
export const placeIsoQuery = (qids: string[]) => `${PREFIXES} SELECT ?item ?iso WHERE { ${values('item', qids)} ?item wdt:P297 ?iso }`;
export const placeClassQuery = (qids: string[]) => `${PREFIXES} SELECT ?item ?cls WHERE { ${values('item', qids)} ?item wdt:P31 ?cls }`;


/** "Q513" from an entity IRI, or null. */
export function qidOf(iri: string): string | null {
  const s = iri.startsWith('<') ? iri.slice(1, -1) : iri;
  return s.startsWith(ENTITY) && /^Q\d+$/.test(s.slice(ENTITY.length)) ? s.slice(ENTITY.length) : null;
}
