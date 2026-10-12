import type { Bbox } from '@takip/core/tiles';

/* GeoJSON-shaped geometries and their WKB form, the storage format of geo/*.db and ev_event.geom (§1). */

export type Position = [number, number];
export type Ring = Position[];
export type Geometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'LineString'; coordinates: Position[] }
  | { type: 'MultiLineString'; coordinates: Position[][] }
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] };

const WKB_TYPE = { Point: 1, LineString: 2, Polygon: 3, MultiLineString: 5, MultiPolygon: 6 } as const;

export function bboxOf(g: Geometry): Bbox {
  const b = { w: Infinity, s: Infinity, e: -Infinity, n: -Infinity };
  const visit = (p: Position) => {
    if (p[0] < b.w) b.w = p[0];
    if (p[0] > b.e) b.e = p[0];
    if (p[1] < b.s) b.s = p[1];
    if (p[1] > b.n) b.n = p[1];
  };
  switch (g.type) {
    case 'Point':
      visit(g.coordinates);
      break;
    case 'LineString':
      g.coordinates.forEach(visit);
      break;
    case 'MultiLineString':
    case 'Polygon':
      g.coordinates.forEach(r => r.forEach(visit));
      break;
    case 'MultiPolygon':
      g.coordinates.forEach(p => p.forEach(r => r.forEach(visit)));
  }
  return b;
}

export function vertexCount(g: Geometry): number {
  switch (g.type) {
    case 'Point':
      return 1;
    case 'LineString':
      return g.coordinates.length;
    case 'MultiLineString':
    case 'Polygon':
      return g.coordinates.reduce((s, r) => s + r.length, 0);
    case 'MultiPolygon':
      return g.coordinates.reduce((s, p) => s + p.reduce((t, r) => t + r.length, 0), 0);
  }
}

/** Little-endian WKB, 2-D. */
export function toWkb(g: Geometry): Buffer {
  const parts = g.type === 'MultiPolygon' ? g.coordinates.reduce((s, p) => s + 1 + p.length, 0) : g.type === 'Point' ? 0 : g.coordinates.length;
  // Each part costs at most a 5-byte header plus two counts; trimmed to the bytes written.
  const buf = Buffer.alloc(16 + 13 * parts + 16 * vertexCount(g));
  let o = 0;
  const header = (type: number) => {
    buf.writeUInt8(1, o);
    buf.writeUInt32LE(type, o + 1);
    o += 5;
  };
  const u32 = (v: number) => {
    buf.writeUInt32LE(v, o);
    o += 4;
  };
  const pt = (p: Position) => {
    buf.writeDoubleLE(p[0], o);
    buf.writeDoubleLE(p[1], o + 8);
    o += 16;
  };
  const ring = (r: Position[]) => {
    u32(r.length);
    r.forEach(pt);
  };
  header(WKB_TYPE[g.type]);
  switch (g.type) {
    case 'Point':
      pt(g.coordinates);
      break;
    case 'LineString':
      ring(g.coordinates);
      break;
    case 'Polygon':
      u32(g.coordinates.length);
      g.coordinates.forEach(ring);
      break;
    case 'MultiLineString':
      u32(g.coordinates.length);
      for (const l of g.coordinates) {
        header(WKB_TYPE.LineString);
        ring(l);
      }
      break;
    case 'MultiPolygon':
      u32(g.coordinates.length);
      for (const p of g.coordinates) {
        header(WKB_TYPE.Polygon);
        u32(p.length);
        p.forEach(ring);
      }
  }
  return buf.subarray(0, o);
}

export function fromWkb(bytes: Uint8Array): Geometry {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 0;
  let le = true;
  const u32 = () => {
    const v = view.getUint32(o, le);
    o += 4;
    return v;
  };
  const pt = (): Position => {
    const p: Position = [view.getFloat64(o, le), view.getFloat64(o + 8, le)];
    o += 16;
    return p;
  };
  const ring = () => Array.from({ length: u32() }, pt);
  const read = (): Geometry => {
    le = view.getUint8(o) === 1;
    o += 1;
    const type = u32();
    switch (type) {
      case 1:
        return { type: 'Point', coordinates: pt() };
      case 2:
        return { type: 'LineString', coordinates: ring() };
      case 3:
        return { type: 'Polygon', coordinates: Array.from({ length: u32() }, ring) };
      case 5:
        return { type: 'MultiLineString', coordinates: Array.from({ length: u32() }, () => (read() as { coordinates: Position[] }).coordinates) };
      case 6:
        return { type: 'MultiPolygon', coordinates: Array.from({ length: u32() }, () => (read() as { coordinates: Ring[] }).coordinates) };
      default:
        throw new Error(`unsupported WKB type ${type}`);
    }
  };
  return read();
}

/** POINT, LINESTRING, POLYGON, MULTILINESTRING and MULTIPOLYGON in 2-D WKT. */
export function fromWkt(wkt: string): Geometry {
  const m = wkt.trim().match(/^(\w+)\s*(.*)$/s);
  if (!m) throw new Error('bad WKT');
  const type = m[1].toUpperCase();
  let i = 0;
  const s = m[2];
  const skip = () => {
    while (s[i] === ' ' || s[i] === '\n' || s[i] === '\t') i++;
  };
  const expect = (c: string) => {
    skip();
    if (s[i] !== c) throw new Error(`WKT: expected ${c} at ${i}`);
    i++;
  };
  // A list of comma-separated items in parentheses.
  const list = <T>(item: () => T): T[] => {
    expect('(');
    const out = [item()];
    skip();
    while (s[i] === ',') {
      i++;
      out.push(item());
      skip();
    }
    expect(')');
    return out;
  };
  const num = () => {
    skip();
    const start = i;
    while (i < s.length && /[-+0-9.eE]/.test(s[i])) i++;
    return Number(s.slice(start, i));
  };
  const pos = (): Position => [num(), num()];
  switch (type) {
    case 'POINT':
      return { type: 'Point', coordinates: list(pos)[0] };
    case 'LINESTRING':
      return { type: 'LineString', coordinates: list(pos) };
    case 'POLYGON':
      return { type: 'Polygon', coordinates: list(() => list(pos)) };
    case 'MULTILINESTRING':
      return { type: 'MultiLineString', coordinates: list(() => list(pos)) };
    case 'MULTIPOLYGON':
      return { type: 'MultiPolygon', coordinates: list(() => list(() => list(pos))) };
    default:
      throw new Error(`unsupported WKT type ${type}`);
  }
}
