import type { Bbox } from '@/lib/map/embed/spec';

const YEAR_MS = 365.25 * 86_400_000;

/**
 * Without `minmag` in the link, a floor that keeps the ask to a few thousand quakes: the wider the
 * area and the longer the window, the higher it starts. A place over a century stays at 2.5; the
 * whole world over a century starts at 6, about 13,000 quakes.
 */
export function defaultMinMag(bbox: Bbox | undefined, from: number, to: number): number {
  const share = bbox ? (((bbox[2] - bbox[0] + 360) % 360 || 360) * (bbox[3] - bbox[1])) / (360 * 180) : 1;
  const load = (share * (to - from)) / YEAR_MS;
  return load <= 0.5 ? 2.5 : load <= 5 ? 4.5 : load <= 50 ? 5.5 : 6;
}
