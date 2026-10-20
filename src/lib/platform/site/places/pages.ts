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

/** An overview with only one topic worth indexing would say what that topic says; it needs two. */
export const overviewIndexed = (pages: PlacePageRef[]) => new Set(pages.filter(p => p.page.index).map(p => p.topic.id)).size >= 2;

/** Nearby places of the same kind with an indexed page of this topic (or any, for an overview). */
export function nearbyWith(place: Place, topicId: string | undefined, limit = 8): Place[] {
  return nearestPlaces(place, p => placePages(p).some(x => x.page.index && (!topicId || x.topic.id === topicId)), limit);
}

/** Every indexed page, as [place, page slug or undefined for the overview], for the sitemap and the index pages. */
export function indexedPages(kind?: PlaceKind): { place: Place; slug?: string }[] {
  return allPlaces().filter(p => !kind || p.kind === kind).flatMap(place => {
    const all = placePages(place);
    const pages = all.filter(p => p.page.index).map(p => ({ place, slug: p.page.slug as string | undefined }));
    return overviewIndexed(all) ? [{ place }, ...pages] : pages;
  });
}

const hasIndexed = (p: Place) => placePages(p).some(x => x.page.index);

/** What an overview leads to, most populous first: a country's states and cities, a state's counties and cities, a county's cities and towns. */
export function childPlaces(place: Place, limit = 400): Place[] {
  if (place.kind === 'city') return [];
  const inside = (kind: PlaceKind) => allPlaces().filter(p => p.kind === kind && p.cc === place.cc
    && (place.kind === 'country' || p.parents?.includes(place.id))).sort((a, b) => b.pop - a.pop).filter(hasIndexed);
  if (place.kind === 'town') return [];
  if (place.kind === 'county') return [...inside('city'), ...inside('town')].slice(0, limit);
  return [...(place.kind === 'country' ? inside('state') : inside('county')), ...inside('city')].slice(0, limit);
}
