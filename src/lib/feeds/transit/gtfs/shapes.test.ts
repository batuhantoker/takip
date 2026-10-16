import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { shapePoints, tripShapeId, type Zipped } from './shapes';

const zipped = (text: string): Zipped => ({ data: deflateRawSync(Buffer.from(text)), method: 8 });

const SHAPES = [
  '﻿shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence',
  'A,39.1,-84.52,1',
  'B,39.2,-84.6,2',
  'B,39.1,-84.6,1',
  'B,39.3,-84.6,3',
  'C,40,-80,1',
].join('\r\n');

describe('gtfs shapes', () => {
  it("finds a trip's shape, quoted or not", async () => {
    const trips = zipped('route_id,service_id,trip_id,trip_headsign,shape_id\n21,wk,"T-1","Downtown, via Vine",B\n21,wk,T-2,Uptown,C\n');
    expect(await tripShapeId(trips, 'T-1')).toBe('B');
    expect(await tripShapeId(trips, 'T-2')).toBe('C');
    expect(await tripShapeId(trips, 'T-9')).toBeNull();
  });

  it('reads one shape in sequence order', async () => {
    expect(await shapePoints(zipped(SHAPES), 'B')).toEqual([[-84.6, 39.1], [-84.6, 39.2], [-84.6, 39.3]]);
    expect(await shapePoints(zipped(SHAPES), 'Z')).toEqual([]);
  });

  it('reads stored (uncompressed) files too', async () => {
    expect(await shapePoints({ data: Buffer.from(SHAPES), method: 0 }, 'A')).toEqual([[-84.52, 39.1]]);
  });

  it('streams a file larger than one inflate chunk', async () => {
    const rows = Array.from({ length: 40_000 }, (_, i) => `S${Math.floor(i / 4)},${(i % 4) / 10},1,${i % 4}`);
    const big = zipped(['shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence', ...rows].join('\n'));
    expect(await shapePoints(big, 'S9999')).toEqual([[1, 0], [1, 0.1], [1, 0.2], [1, 0.3]]);
  });
});
