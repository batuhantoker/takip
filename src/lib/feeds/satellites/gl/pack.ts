import { MercatorCoordinate } from 'maplibre-gl';
import { displayElevation, type SatPoint } from '../points';

/**
 * Builds the interleaved vertex buffer for a set of satellites.
 *
 * Exported so the packing is testable without a GL context: this is where an
 * off-by-one silently puts every satellite at the wrong altitude.
 */
export function packVertices(points: SatPoint[], exaggeration = 1): Float32Array<ArrayBuffer> {
  const STRIDE = 7; // x, y, z, r, g, b, size
  const out = new Float32Array(points.length * STRIDE);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const m = MercatorCoordinate.fromLngLat({ lng: p.lng, lat: p.lat }, 0);
    const o = i * STRIDE;
    out[o] = m.x;
    out[o + 1] = m.y;
    out[o + 2] = displayElevation(p.altKm, exaggeration);
    out[o + 3] = ((p.color >> 16) & 0xff) / 255;
    out[o + 4] = ((p.color >> 8) & 0xff) / 255;
    out[o + 5] = (p.color & 0xff) / 255;
    out[o + 6] = p.size;
  }
  return out;
}

/**
 * Moves packed satellites to new positions (mercator x, y and altitude km, three floats each),
 * leaving colour alone. A NaN hides a satellite: its size goes negative, which the shaders skip.
 */
export function movePacked(vertices: Float32Array, positions: Float32Array, exaggeration = 1) {
  const STRIDE = 7;
  const n = Math.min(vertices.length / STRIDE, positions.length / 3);
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3];
    const o = i * STRIDE;
    vertices[o + 6] = Number.isNaN(x) ? -Math.abs(vertices[o + 6]) : Math.abs(vertices[o + 6]);
    if (Number.isNaN(x)) continue;
    vertices[o] = x;
    vertices[o + 1] = positions[i * 3 + 1];
    vertices[o + 2] = displayElevation(positions[i * 3 + 2], exaggeration);
  }
}

/**
 * Packs one orbit segment. Same mercator + metres-of-elevation contract as
 * packVertices, so the track and the marker land in the same space.
 */
export function packOrbit(segment: { lng: number; lat: number; altKm: number }[], exaggeration = 1): Float32Array<ArrayBuffer> {
  const out = new Float32Array(segment.length * 3);
  for (let i = 0; i < segment.length; i++) {
    const p = segment[i];
    const m = MercatorCoordinate.fromLngLat({ lng: p.lng, lat: p.lat }, 0);
    out[i * 3] = m.x;
    out[i * 3 + 1] = m.y;
    out[i * 3 + 2] = displayElevation(p.altKm, exaggeration);
  }
  return out;
}

/**
 * A packed orbit segment (packOrbit) as a ribbon of triangles, which the shader widens: GL draws a line strip
 * one device pixel wide, a hairline on a high-density screen. Per vertex: its point, the neighbour its segment
 * runs to, and which side of the line it goes.
 */
export function packOrbitRibbon(points: Float32Array): Float32Array<ArrayBuffer> {
  const n = points.length / 3;
  const out = new Float32Array(Math.max(0, n - 1) * 6 * 7);
  let o = 0;
  const put = (at: number, to: number, side: number) => {
    out.set(points.subarray(at * 3, at * 3 + 3), o);
    out.set(points.subarray(to * 3, to * 3 + 3), o + 3);
    out[o + 6] = side;
    o += 7;
  };
  for (let i = 0; i + 1 < n; i++) {
    // From the far end the segment runs the other way, so the same side is the opposite sign.
    put(i, i + 1, 1); put(i, i + 1, -1); put(i + 1, i, -1);
    put(i, i + 1, -1); put(i + 1, i, 1); put(i + 1, i, -1);
  }
  return out;
}
