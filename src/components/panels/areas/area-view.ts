import type { DrawMode, DrawnShape } from '@/lib/places/areas/draw';
import { formatArea, formatDistance } from '@/lib/core/geodesic';

export const SHAPE_NAME: Record<DrawMode, string> = {
  polygon: 'Area', rectangle: 'Box', circle: 'Radius', line: 'Path', region: 'Region',
};

function positions(shape: DrawnShape): number[][] {
  const g = shape.geojson.geometry;
  if (g.type === 'LineString') return g.coordinates;
  if (g.type === 'Polygon') return g.coordinates.flat();
  return g.coordinates.flat(2);
}

/** Where to point the map so the whole shape is in view, give or take. */
export function framing(shape: DrawnShape): { lat: number; lng: number; zoom: number } | null {
  const pts = positions(shape);
  if (!pts.length) return null;
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const [lng, lat] of pts) {
    west = Math.min(west, lng); east = Math.max(east, lng);
    south = Math.min(south, lat); north = Math.max(north, lat);
  }
  // Latitude spans count for more on a Mercator map, and the panel covers part of the view.
  const span = Math.max(east - west, (north - south) * 1.6, 0.002);
  const zoom = Math.min(15, Math.max(2, Math.log2(420 / span)));
  return { lat: (south + north) / 2, lng: (west + east) / 2, zoom };
}

/** The measurements that matter for the shape, as text: area and perimeter, or a path's length. */
export function measures(shape: DrawnShape): { primary: string; secondary: string | null } {
  if (shape.kind === 'line') return { primary: formatDistance(shape.perimeterKm), secondary: null };
  return { primary: formatArea(shape.areaKm2), secondary: formatDistance(shape.perimeterKm) };
}
