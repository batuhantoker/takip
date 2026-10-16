/**
 * The English Wikipedia article for a dated, placed event, found through Wikidata: an item whose point in
 * time (or start) falls on that day, with coordinates within RADIUS_KM, an article, and an event-like type.
 * Most small attacks have none, and that is the usual answer.
 */

import type { WikiSummary } from '@/lib/core/wikipedia/summary';

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const SPARQL = 'https://query.wikidata.org/sparql';

export const RADIUS_KM = 50;

/** Date + distance alone would also find an election or a match held nearby that day. */
const EVENT_TYPE = /attack|bomb|massacre|hijack|shooting|assassinat|hostage|kidnap|siege|terror|explosion|murder|killing|ambush|stabbing|arson|ramming|crash|riot|insurgen|raid/i;

export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** What /api/history/wiki answers: the summary, the ref it was asked for, and the article's other languages. */
export type ArticleSummary = WikiSummary & { ref: string; lang: string; languages: { lang: string; title: string }[] };

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
