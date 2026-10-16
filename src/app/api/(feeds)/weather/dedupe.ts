import type { LatLng } from './geometry';

const EARTH_KM = 6371;

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/** Drops each `weaker` event that has a `stronger` one within `km`; everything else passes through. */
export function dropNearDuplicates<T extends LatLng>(events: T[], weaker: (e: T) => boolean, stronger: (e: T) => boolean, km: number): T[] {
  const anchors = events.filter(stronger);
  return events.filter(e => !weaker(e) || !anchors.some(a => distanceKm(a, e) <= km));
}
