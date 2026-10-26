import type { Highlight } from '@/lib/ai/assist/tools';
import type { MarkSet } from './messages';

export interface ViewBounds { west: number; south: number; east: number; north: number }

/** Of the view's width and height, the margin a mark must clear to count as in view. */
const INSET = 0.1;

/**
 * A page's marks as the map draws them, without pulses. On a route only the named stop gets a dot, and no line: the
 * map's own plan draws the day along the streets, numbered, and its stops lie under the others.
 */
export function markHighlight({ points, route }: MarkSet): Highlight {
  return {
    points: (route ? points.filter(p => p.label) : points).map(p => ({ lat: p.lat, lng: p.lon, label: p.label })),
    area: null,
    quiet: true,
  };
}

/** Where the camera goes so every point is in view, never closer than `zoom`; null when they already are. */
export function easeFor(points: MarkSet['points'], b: ViewBounds, zoom: number): { lat: number; lng: number; zoom: number } | null {
  // A view across the antimeridian is left alone.
  if (!points.length || b.west >= b.east || b.south >= b.north) return null;
  const w = b.east - b.west;
  const h = b.north - b.south;
  const lons = points.map(p => p.lon);
  const lats = points.map(p => p.lat);
  const [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  if (x0 >= b.west + w * INSET && x1 <= b.east - w * INSET && y0 >= b.south + h * INSET && y1 <= b.north - h * INSET) return null;
  const k = Math.max(1, (x1 - x0) / (w * (1 - 2 * INSET)), (y1 - y0) / (h * (1 - 2 * INSET)));
  return { lat: (y0 + y1) / 2, lng: (x0 + x1) / 2, zoom: Math.max(1.5, zoom - Math.log2(k)) };
}
