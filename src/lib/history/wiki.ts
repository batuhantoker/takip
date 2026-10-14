/**
 * The English Wikipedia article for a dated, placed event, found through Wikidata: an item whose point in
 * time (or start) falls on that day, with coordinates within RADIUS_KM, an article, and an event-like type.
 * Most small attacks have none, and that is the usual answer.
 */

import type { WikiSummary } from '@/lib/space/wiki-topic';

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const SPARQL = 'https://query.wikidata.org/sparql';

export const RADIUS_KM = 50;

/** Date + distance alone would also find an election or a match held nearby that day. */
const EVENT_TYPE = /attack|bomb|massacre|hijack|shooting|assassinat|hostage|kidnap|siege|terror|explosion|murder|killing|ambush|stabbing|arson|ramming|crash|riot|insurgen|raid/i;

export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** A title an importer stored: no characters Wikipedia forbids in titles, and not a path or a query. */
export const isArticleTitle = (s: string) => s.length > 0 && s.length <= 255 && !/[#<>[\]{}|\u0000-\u001f\u007f]/.test(s) && !/^[./]/.test(s);

/**
 * attrs.wiki is an English title, or "fr:Titre" for an article in another Wikipedia. Wiki codes are lowercase
 * and titles start uppercase, so the prefix can't be mistaken for part of an English title.
 */
export function articleRef(stored: string): { lang: string; title: string } {
  const m = stored.match(/^([a-z][a-z0-9-]{1,15}):(.+)$/);
  return m ? { lang: m[1], title: m[2] } : { lang: 'en', title: stored };
}

/** The other way round; tools/import/wiki.ts writes the same form. */
export const wikiRef = (lang: string, title: string) => (lang === 'en' ? title : `${lang}:${title}`);

/** What /api/history/wiki answers: the summary, the ref it was asked for, and the article's other languages. */
export type ArticleSummary = WikiSummary & { ref: string; lang: string; languages: { lang: string; title: string }[] };

export const articleUrl = (stored: string) => {
  const { lang, title } = articleRef(stored);
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
};

/** "French" for fr; the code itself where the browser has no name for it. */
export function languageName(lang: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(lang) ?? lang;
  } catch {
    return lang;
  }
}

export function eventQuery(day: string, lon: number, lat: number): string {
  const next = new Date(Date.parse(day) + 86_400_000).toISOString().slice(0, 10);
  return `SELECT ?title ?dist (GROUP_CONCAT(DISTINCT ?typeLabel; separator="|") AS ?types) WHERE {
  VALUES ?p { wdt:P585 wdt:P580 }
  ?item ?p ?t .
  FILTER(?t >= "${day}T00:00:00Z"^^xsd:dateTime && ?t < "${next}T00:00:00Z"^^xsd:dateTime)
  SERVICE wikibase:around { ?item wdt:P625 ?c . bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${RADIUS_KM}" . bd:serviceParam wikibase:distance ?dist . }
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
  OPTIONAL { ?item wdt:P31 ?type . ?type rdfs:label ?typeLabel . FILTER(lang(?typeLabel) = "en") }
} GROUP BY ?title ?dist ORDER BY ?dist LIMIT 12`;
}

export type EventHit = { title: string; dist: number; types: string[] };

/** The nearest hit whose type reads as an event of violence. */
export function pickArticle(hits: EventHit[]): string | null {
  const ok = hits.filter(h => h.types.some(t => EVENT_TYPE.test(t))).sort((a, b) => a.dist - b.dist);
  return ok[0]?.title ?? null;
}

type Binding = { title: { value: string }; dist: { value: string }; types?: { value: string } };

export async function eventArticle(day: string, lon: number, lat: number): Promise<string | null> {
  const res = await fetch(`${SPARQL}?${new URLSearchParams({ query: eventQuery(day, lon, lat) })}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  const body = await res.json() as { results?: { bindings?: Binding[] } };
  return pickArticle((body.results?.bindings ?? []).map(b => ({
    title: b.title.value,
    dist: Number(b.dist.value),
    types: b.types?.value ? b.types.value.split('|') : [],
  })));
}
