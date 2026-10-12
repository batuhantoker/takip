import { httpJson } from '@takip/connectors/http-json';
import { cachedSource } from '@takip/connectors/source-cache';

/*
 * The country facts come from Wikidata, read through its REST API rather than
 * query.wikidata.org.
 *
 * The SPARQL endpoint refuses or times out far more often than it answers — on
 * 21 Sep 2026 it did not respond at all within 25s — and when it failed it took
 * the whole country block of this panel down with it, so a right-click showed
 * nothing but a place name. An item's own statements answer the same questions
 * in one request, and a country's facts change slowly, so each is kept for a day.
 */

const WD_REST = 'https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items';
const WD_TTL_MS = 24 * 60 * 60 * 1000;
const WD_TIMEOUT_MS = 8000;
/** Qualifier: the date a statement stopped being true. */
const ENDED = 'P582';

export interface WdStatement {
  rank?: string;
  qualifiers?: { property: { id: string } }[];
  value?: { content?: unknown };
}
type WdStatements = Record<string, WdStatement[]>;

/** The statements that still hold — a president who left office is not the president. */
export const stillHolding = (list: WdStatement[] = []) =>
  list.filter(s => !s.qualifiers?.some(q => q.property.id === ENDED));

/** The one that holds now: Wikidata's own preferred rank, else one that has not ended. */
export const current = (list?: WdStatement[]): WdStatement | undefined =>
  list?.find(s => s.rank === 'preferred') ?? stillHolding(list)[0] ?? list?.[0];

/** A statement points at another item by id, or carries a quantity. */
export const itemId = (s?: WdStatement): string => (typeof s?.value?.content === 'string' ? s.value.content : '');
export const amountOf = (s?: WdStatement): number | undefined => {
  const raw = (s?.value?.content as { amount?: string } | undefined)?.amount;
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

const statementsOf = (id: string, property?: string) =>
  httpJson<WdStatements>(`${WD_REST}/${id}/statements${property ? `?property=${property}` : ''}`, { timeoutMs: WD_TIMEOUT_MS });

/** English names for a batch of item ids, in one request. */
async function labelsFor(ids: string[]): Promise<Record<string, string>> {
  const wanted = [...new Set(ids.filter(Boolean))];
  if (!wanted.length) return {};
  const json = await httpJson<{ entities?: Record<string, { labels?: { en?: { value?: string } } }> }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels&languages=en&format=json&ids=${wanted.join('|')}`,
    { timeoutMs: WD_TIMEOUT_MS },
  );
  const out: Record<string, string> = {};
  for (const [id, entity] of Object.entries(json.entities ?? {})) {
    if (entity.labels?.en?.value) out[id] = entity.labels.en.value;
  }
  return out;
}

export interface CountryFacts {
  country: {
    name: string;
    official_name: string;
    capital?: string;
    population?: number;
    area?: number;
    region?: string;
    subregion?: string;
    languages: string[];
    currencies: string[];
    flag_url?: string;
    timezones: string[];
  };
  head_of_state: { name: string; position: string } | null;
}

/** What Wikidata knows about a country, as the panel wants it. */
async function readCountry(countryName: string): Promise<CountryFacts[]> {
  // The English Wikipedia article for a place names the Wikidata item for it.
  const pages = await httpJson<{ query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> } }>(
    `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&titles=${encodeURIComponent(countryName)}`,
    { timeoutMs: WD_TIMEOUT_MS },
  );
  const qid = Object.values(pages.query?.pages ?? {})[0]?.pageprops?.wikibase_item;
  if (!qid) return [];

  const s = await statementsOf(qid);
  const capital = itemId(current(s.P36));
  const continent = itemId(current(s.P30));
  const languages = stillHolding(s.P37).map(itemId).filter(Boolean).slice(0, 4);
  const currencies = stillHolding(s.P38).map(itemId).filter(Boolean).slice(0, 3);
  const leader = itemId(current(s.P35));
  /* The office is read from the country, not from the person. Charles III holds
     several crowns at once, and his own item lists the British one first, which
     would caption a dossier about Australia "monarch of the United Kingdom". */
  const position = itemId(current(s.P1906));
  const flagFile = itemId(current(s.P41));

  const name = await labelsFor([capital, continent, leader, position, ...languages, ...currencies]);

  return [{
    country: {
      name: countryName,
      official_name: countryName,
      capital: name[capital],
      population: amountOf(current(s.P1082)),
      area: amountOf(current(s.P2046)),
      region: name[continent],
      subregion: name[continent],
      languages: languages.map(id => name[id]).filter(Boolean),
      currencies: currencies.map(id => name[id]).filter(Boolean),
      flag_url: flagFile ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(flagFile)}` : undefined,
      timezones: [],
    },
    head_of_state: leader && name[leader]
      ? { name: name[leader], position: name[position] || 'Head of State' }
      : null,
  }];
}

/** Country facts and head of state. Cached for a day per country, which also keeps a burst of right-clicks off Wikidata. */
export const countryFacts = (countryName: string): Promise<CountryFacts | null> =>
  cachedSource<CountryFacts>(`dossier:wd:${countryName}`, () => readCountry(countryName), WD_TTL_MS)()
    .then(rows => rows[0] ?? null);
