import { allPlaces, nearestPlaces, type Place, type PlaceKind } from './gazetteer';
import type { PlaceTopic, TopicPage } from './topic';
import { TOPICS } from './topics/registry';

/** One page of a place: the topic it belongs to and what it holds. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each topic has its own data type
export interface PlacePageRef { topic: PlaceTopic<any, any>; page: TopicPage }

/** Every topic page a place has, in the overview's order. */
export function placePages(place: Place): PlacePageRef[] {
  return TOPICS.filter(topic => topic.kinds.includes(place.kind)).flatMap(topic => topic.pages(place).map(page => ({ topic, page })));
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

/** A country's places with an indexed page, most populous first. */
export function indexedPlacesIn(cc: string, limit = 400): Place[] {
  return allPlaces().filter(p => p.kind === 'city' && p.cc === cc).sort((a, b) => b.pop - a.pop)
    .filter(p => placePages(p).some(x => x.page.index)).slice(0, limit);
}
