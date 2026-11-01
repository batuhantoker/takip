import { SEARCH_OVERVIEWS, SEARCH_TOPICS } from '../search-scope';
import { allPlaces, DERIVED_TTL_MS, nearestPlaces, type Place, type PlaceKind } from './gazetteer';
import type { PlaceTopic, TopicPage } from './topic';
import { TOPICS } from './topics/registry';

/** One page of a place: the topic it belongs to and what it holds. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each topic has its own data type
export interface PlacePageRef { topic: PlaceTopic<any, any>; page: TopicPage }

// Keyed by the place object, which a rebuilt gazetteer replaces. Sitemaps, index pages and nearby lists ask for every place.
const held = new WeakMap<Place, { at: number; pages: PlacePageRef[] }>();

/** Every topic page a place has, in the overview's order. Shared between callers: don't change it. */
export function placePages(place: Place): PlacePageRef[] {
  const kept = held.get(place);
  if (kept && Date.now() - kept.at < DERIVED_TTL_MS) return kept.pages;
  const pages = TOPICS.filter(topic => topic.kinds.includes(place.kind)).flatMap(topic => topic.pages(place).map(page => ({ topic, page })));
  held.set(place, { at: Date.now(), pages });
  return pages;
}

export const findPlacePage = (place: Place, slug: string) => placePages(place).find(p => p.page.slug === slug);

/** An overview with only one topic worth indexing would say what that topic says; it needs two. Faith pages don't count. */
export const overviewIndexed = (pages: PlacePageRef[]) =>
  new Set(pages.filter(p => p.page.index && !p.topic.faith).map(p => p.topic.id)).size >= 2;

/** A topic page put forward for search: its data passes the topic's bar, and the topic is in search's scope. */
export const searchedPage = (topicId: string, page: TopicPage) => page.index && SEARCH_TOPICS.has(topicId);
export const searched = (ref: PlacePageRef) => searchedPage(ref.topic.id, ref.page);

/** Whether a place's page (its overview without a slug) is put forward for search: what its metadata says. */
export function placeIndexed(place: Place, slug?: string): boolean {
  if (slug !== undefined) {
    const ref = findPlacePage(place, slug);
    return !!ref && searched(ref);
  }
  if (!SEARCH_OVERVIEWS.has(place.kind)) return false;
  const pages = placePages(place);
  if (place.kind === 'city') return overviewIndexed(pages) && pages.some(searched);
  return overviewIndexed(pages) || childPlaces(place, 1).length > 0;
}

/** Nearby places of the same kind with an indexed page of this topic (or any but a faith page, for an overview). */
export function nearbyWith(place: Place, topicId: string | undefined, limit = 8): Place[] {
  return nearestPlaces(place, p => placePages(p).some(x => x.page.index && (topicId ? x.topic.id === topicId : !x.topic.faith)), limit);
}

let listed: { at: number; pages: { place: Place; slug?: string }[] } | null = null;

/**
 * Every indexed page, as [place, page slug or undefined for the overview], for the sitemap and the index pages. Kept a
 * while: an overview that stands on its child places takes a pass over every place.
 */
export function indexedPages(kind?: PlaceKind): { place: Place; slug?: string }[] {
  if (!listed || Date.now() - listed.at >= DERIVED_TTL_MS) {
    listed = { at: Date.now(), pages: allPlaces().flatMap(place => {
      const pages = placePages(place).filter(searched).map(p => ({ place, slug: p.page.slug as string | undefined }));
      return placeIndexed(place) ? [{ place }, ...pages] : pages;
    }) };
  }
  return kind ? listed.pages.filter(p => p.place.kind === kind) : listed.pages;
}

const hasIndexed = (p: Place) => placePages(p).some(x => x.page.index);

/** Each topic a place has indexed pages of, once: its first listed page, which stands for the rest. Not faith pages. */
export function topicPages(place: Place): PlacePageRef[] {
  const out = new Map<string, PlacePageRef>();
  for (const x of placePages(place)) {
    if (x.page.index && !x.topic.faith && (!out.has(x.topic.id) || out.get(x.topic.id)!.page.listed === false)) out.set(x.topic.id, x);
  }
  return [...out.values()];
}

const byTopic = new Map<string, { at: number; refs: { place: Place; slug: string }[] }>();

/** The most populous places with an indexed page of this topic, for the layer page it is the close-up of. */
export function topicPlaces(topicId: string, limit = 24): { place: Place; slug: string }[] {
  const kept = byTopic.get(topicId);
  if (kept && Date.now() - kept.at < DERIVED_TTL_MS && kept.refs.length >= limit) return kept.refs.slice(0, limit);
  const refs = allPlaces().flatMap(place => {
    const ref = topicPages(place).find(x => x.topic.id === topicId);
    return ref ? [{ place, slug: ref.page.slug }] : [];
  }).sort((a, b) => b.place.pop - a.place.pop).slice(0, limit);
  byTopic.set(topicId, { at: Date.now(), refs });
  return refs;
}

/** What an overview leads to, most populous first: a country's states and cities, a state's counties and cities, a county's cities and towns. */
export function childPlaces(place: Place, limit = 400): Place[] {
  if (place.kind === 'city') return [];
  const inside = (kind: PlaceKind) => allPlaces().filter(p => p.kind === kind && p.cc === place.cc
    && (place.kind === 'country' || p.parents?.includes(place.id))).sort((a, b) => b.pop - a.pop).filter(hasIndexed);
  if (place.kind === 'town') return [];
  if (place.kind === 'county') return [...inside('city'), ...inside('town')].slice(0, limit);
  return [...(place.kind === 'country' ? inside('state') : inside('county')), ...inside('city')].slice(0, limit);
}

/** A country leads with what people look a country up for; plate readers, a US-only niche, go last. Other places keep the registry's order. */
const COUNTRY_ORDER: Record<string, number> = { holidays: -3, indicators: -2, hazards: -1, alpr: 1 };

export function inNavOrder<P extends PlacePageRef>(place: Place, pages: P[]): P[] {
  if (place.kind !== 'country') return pages;
  return pages.map((p, i) => ({ p, i })).sort((a, b) => (COUNTRY_ORDER[a.p.topic.id] ?? 0) - (COUNTRY_ORDER[b.p.topic.id] ?? 0) || a.i - b.i).map(x => x.p);
}
