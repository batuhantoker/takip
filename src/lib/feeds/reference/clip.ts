import type { Box } from './bbox';

type Point = number[];

const round = (n: number) => Math.round(n * 1e5) / 1e5;

/** Liang–Barsky: the part of segment p→q inside the box, or null. */
function clipSegment(p: Point, q: Point, box: Box): [Point, Point] | null {
  const dx = q[0] - p[0], dy = q[1] - p[1];
  let t0 = 0, t1 = 1;
  const edges: [number, number][] = [[-dx, p[0] - box[0]], [dx, box[2] - p[0]], [-dy, p[1] - box[1]], [dy, box[3] - p[1]]];
  for (const [step, room] of edges) {
    if (step === 0) {
      if (room < 0) return null;
      continue;
    }
    const t = room / step;
    if (step < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }
  const at = (t: number): Point => [round(p[0] + t * dx), round(p[1] + t * dy)];
  return [t0 === 0 ? p : at(t0), t1 === 1 ? q : at(t1)];
}

/** The pieces of a polyline that lie inside the box, in order. */
export function clipLine(line: Point[], box: Box): Point[][] {
  const parts: Point[][] = [];
  let current: Point[] | null = null;
  for (let i = 0; i + 1 < line.length; i++) {
    const seg = clipSegment(line[i], line[i + 1], box);
    if (!seg) {
      current = null;
      continue;
    }
    const last = current?.[current.length - 1];
    if (current && last && last[0] === seg[0][0] && last[1] === seg[0][1]) {
      current.push(seg[1]);
    } else {
      current = [seg[0], seg[1]];
      parts.push(current);
    }
    if (seg[1] !== line[i + 1]) current = null;
  }
  return parts;
}

interface LineFeature {
  geometry: { type: string; coordinates: unknown };
}

/** Clips a LineString or MultiLineString feature to the boxes in place; false if nothing is left. */
export function clipLineFeature(feature: LineFeature, boxes: readonly Box[]): boolean {
  const g = feature.geometry;
  const lines = g.type === 'LineString' ? [g.coordinates as Point[]] : g.type === 'MultiLineString' ? (g.coordinates as Point[][]) : null;
  if (!lines) return true;
  const parts = boxes.flatMap(box => lines.flatMap(line => clipLine(line, box)));
  if (!parts.length) return false;
  feature.geometry = parts.length === 1 ? { type: 'LineString', coordinates: parts[0] } : { type: 'MultiLineString', coordinates: parts };
  return true;
}
