import { km, nearestPlaces } from '../gazetteer';
import { placePages, type PlacePageRef } from '../pages';
import type { Place } from '../place';
import type { AttractionEntry, AttractionsData } from './attractions';

/** Places a day out from a city with things to do of their own: far enough to be another place, near enough to go and come back. */

const MIN_KM = 15;
const MAX_KM = 150;

export interface DayTrip {
  place: Place;
  km: number;
  /** Its best-known thing to do. */
  best: AttractionEntry;
  things: PlacePageRef;
  /** Its own one-day plan, where it has one. */
  plan?: PlacePageRef;
}

const held = new WeakMap<Place, DayTrip[]>();

/** The best-known few, by their best-known place. */
export function dayTrips(place: Place, limit = 4): DayTrip[] {
  if (place.kind !== 'city') return [];
  let trips = held.get(place);
  if (!trips) {
    const indexed = (p: Place) => placePages(p).find(x => x.topic.id === 'attractions' && x.page.index);
    trips = nearestPlaces(place, p => km(place.at, p.at) >= MIN_KM && !!indexed(p), 24, MAX_KM).map(p => {
      const things = indexed(p)!;
      const plan = placePages(p).find(x => x.topic.id === 'plans' && x.page.listed !== false && x.page.index);
      return { place: p, km: Math.round(km(place.at, p.at)), best: (things.page.data as AttractionsData).entries[0], things, ...(plan ? { plan } : {}) };
    }).sort((a, b) => b.best.item.l - a.best.item.l);
    held.set(place, trips);
  }
  return trips.slice(0, limit);
}
