import { createInflateRaw } from 'node:zlib';
import type { LngLat } from '../placement/snap';

/** A file as the zip stores it: Prague's shapes.txt is 37 MB this way and 153 MB inflated. */
export interface Zipped {
  data: Buffer;
  method: number;
}

function splitCsv(line: string): string[] {
  if (!line.includes('"')) return line.split(',');
  const out: string[] = [];
  let cell = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cell); cell = ''; }
    else cell += c;
  }
  out.push(cell);
  return out;
}

/**
 * Each row of a zipped CSV, inflated as it streams so a large file never sits in memory whole.
 * `row` returns true to stop there.
 */
export async function scanCsv(file: Zipped, row: (cell: (column: string) => string) => boolean | void): Promise<void> {
  const decoder = new TextDecoder();
  let head: Map<string, number> | null = null;
  let rest = '';
  let stopped = false;
  const lines = (text: string, last: boolean) => {
    const parts = (rest + text).split('\n');
    rest = last ? '' : parts.pop() ?? '';
    for (const raw of parts) {
      const line = raw.replace(/\r$/, '');
      if (!line) continue;
      const cols = splitCsv(line);
      if (!head) {
        head = new Map(cols.map((c, i) => [c.replace(/^﻿/, '').trim(), i]));
        continue;
      }
      const h = head;
      if (row(name => (cols[h.get(name) ?? -1] ?? '').trim())) { stopped = true; return; }
    }
  };
  if (file.method === 0) {
    lines(decoder.decode(file.data), true);
    return;
  }
  if (file.method !== 8) throw new Error(`compression method ${file.method}`);
  const inflate = createInflateRaw();
  inflate.end(file.data);
  for await (const chunk of inflate) {
    lines(decoder.decode(chunk as Buffer, { stream: true }), false);
    if (stopped) { inflate.destroy(); return; }
  }
  lines(decoder.decode(), true);
}

export async function tripShapeId(trips: Zipped, tripId: string): Promise<string | null> {
  let shape: string | null = null;
  await scanCsv(trips, cell => {
    if (cell('trip_id') !== tripId) return false;
    shape = cell('shape_id') || null;
    return true;
  });
  return shape;
}

/** One shape's points in order. Feeds keep a shape's rows together, so the scan stops once past them. */
export async function shapePoints(shapes: Zipped, shapeId: string): Promise<LngLat[]> {
  const pts: { seq: number; p: LngLat }[] = [];
  await scanCsv(shapes, cell => {
    if (cell('shape_id') !== shapeId) return pts.length > 0;
    const lat = Number(cell('shape_pt_lat')), lng = Number(cell('shape_pt_lon'));
    if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push({ seq: Number(cell('shape_pt_sequence')), p: [lng, lat] });
    return false;
  });
  return pts.sort((a, b) => a.seq - b.seq).map(x => x.p);
}
