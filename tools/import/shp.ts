import { readFileSync } from 'node:fs';
import type { Geometry, Position, Ring } from '@takip/db';

/*
 * Just enough of the ESRI shapefile format for polygon layers: .shp polygons (type 5) and the .dbf table.
 * Coordinates come back as stored; the caller reprojects.
 */

export type ShpRecord = { geometry: Geometry | null; props: Record<string, string> };

/** Shoelace area; in a shapefile a clockwise ring (negative here) is an outer ring, anything else a hole. */
function signedArea(ring: Ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return a / 2;
}

function inside([x, y]: Position, ring: Ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Outer rings with the holes that fall inside them. */
function polygonFrom(rings: Ring[]): Geometry | null {
  const outers: Ring[][] = [];
  const holes: Ring[] = [];
  for (const r of rings) (signedArea(r) < 0 ? outers.push([r]) : holes.push(r));
  if (!outers.length) return null;
  for (const h of holes) (outers.find(o => inside(h[0], o[0])) ?? outers[0]).push(h);
  return outers.length === 1 ? { type: 'Polygon', coordinates: outers[0] } : { type: 'MultiPolygon', coordinates: outers };
}

function readShp(path: string): (Geometry | null)[] {
  const buf = readFileSync(path);
  if (buf.readInt32BE(0) !== 9994) throw new Error(`${path}: not a shapefile`);
  const end = buf.readInt32BE(24) * 2;
  const out: (Geometry | null)[] = [];
  for (let off = 100; off < end;) {
    const len = buf.readInt32BE(off + 4) * 2;
    const at = off + 8;
    const type = buf.readInt32LE(at);
    if (type === 0) out.push(null);
    else if (type === 5) {
      const parts = buf.readInt32LE(at + 36);
      const points = buf.readInt32LE(at + 40);
      const starts = Array.from({ length: parts }, (_, i) => buf.readInt32LE(at + 44 + i * 4));
      const base = at + 44 + parts * 4;
      const rings: Ring[] = starts.map((s, i) => {
        const e = i + 1 < parts ? starts[i + 1] : points;
        return Array.from({ length: e - s }, (_, k) => [buf.readDoubleLE(base + (s + k) * 16), buf.readDoubleLE(base + (s + k) * 16 + 8)] as Position);
      });
      out.push(polygonFrom(rings));
    } else throw new Error(`${path}: shape type ${type} is not supported`);
    off = at + len;
  }
  return out;
}

/** dBASE III table; text is decoded as Windows-1252, which these ESRI exports use. */
function readDbf(path: string): Record<string, string>[] {
  const buf = readFileSync(path);
  const n = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  const fields: { name: string; size: number }[] = [];
  for (let off = 32; buf[off] !== 0x0d; off += 32) {
    fields.push({ name: buf.toString('latin1', off, off + 11).replace(/\0.*$/, ''), size: buf[off + 16] });
  }
  const text = new TextDecoder('windows-1252');
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < n; i++) {
    const at = headerLen + i * recordLen;
    if (buf[at] === 0x2a) continue;
    let pos = at + 1;
    const row: Record<string, string> = {};
    for (const f of fields) {
      row[f.name] = text.decode(buf.subarray(pos, pos + f.size)).trim();
      pos += f.size;
    }
    rows.push(row);
  }
  return rows;
}

/** `base` is the path without extension. Deleted rows are skipped in both files, which keeps them aligned. */
export function readShapefile(base: string): ShpRecord[] {
  const shapes = readShp(`${base}.shp`);
  const rows = readDbf(`${base}.dbf`);
  if (shapes.length !== rows.length) throw new Error(`${base}: ${shapes.length} shapes but ${rows.length} rows`);
  return shapes.map((geometry, i) => ({ geometry, props: rows[i] }));
}
