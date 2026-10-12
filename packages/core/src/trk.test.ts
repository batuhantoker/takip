import { describe, expect, it } from 'vitest';
import { lonLatToTile, tileBbox, tilesForBbox } from './tiles';
import { TrkFlag } from './tracks';
import { decodeChunk, decodeTrk1, encodeChunk, encodeTrk1, isGap, type TrackPoint } from './trk';

const T0 = 1_760_270_400; // 2025-10-12T12:00:00Z

describe('TRK1', () => {
  it('round-trips positions to 1e-5 degrees and times to the second', () => {
    const points: TrackPoint[] = [
      { t: T0, lon: 29.01234, lat: 41.04321, alt: 10_675, speed: 452.3, heading: 271 },
      { t: T0 + 90, lon: 28.91, lat: 41.1, alt: 10_690, speed: 451.9, heading: 270 },
      { t: T0 + 181, lon: -179.99999, lat: -89.5 },
    ];
    const track = decodeTrk1(encodeTrk1(points));
    expect(track.n).toBe(3);
    expect(track.flags & (TrkFlag.hasAlt | TrkFlag.hasSpeed | TrkFlag.hasHeading)).toBe(7);
    expect([...track.t]).toEqual([T0, T0 + 90, T0 + 181]);
    expect([...track.lon]).toEqual([29.01234, 28.91, -179.99999]);
    expect([...track.lat]).toEqual([41.04321, 41.1, -89.5]);
    // Missing optional values carry the previous one forward.
    expect([...track.alt!]).toEqual([10_680, 10_690, 10_690]);
    expect([...track.speed!].map(v => +v.toFixed(1))).toEqual([452.3, 451.9, 451.9]);
    expect(track.heading![0]).toBeCloseTo(271, 0);
  });

  it('omits columns no point has and stays small', () => {
    const points = Array.from({ length: 100 }, (_, i) => ({ t: T0 + i * 10, lon: 4.5 + i * 1e-4, lat: 51.9 + i * 5e-5 }));
    const blob = encodeTrk1(points, { extraFlags: TrkFlag.tIsReceive });
    const track = decodeTrk1(blob);
    expect(track.alt).toBeUndefined();
    expect(track.flags & TrkFlag.tIsReceive).toBeTruthy();
    expect(blob.length / points.length).toBeLessThan(4);
  });

  it('stores coarse coordinates and gap bits', () => {
    const track = decodeTrk1(encodeTrk1([{ t: T0, lon: 10.12345, lat: 1 }, { t: T0 + 600, lon: 11, lat: 2, gap: true }], { scale: 1e4 }));
    expect(track.lon[0]).toBe(10.1235);
    expect(isGap(track, 0)).toBe(false);
    expect(isGap(track, 1)).toBe(true);
  });

  it('refuses points out of time order', () => {
    expect(() => encodeTrk1([{ t: T0 + 5, lon: 0, lat: 0 }, { t: T0, lon: 0, lat: 0 }])).toThrow(/time order/);
  });
});

describe('TRKC', () => {
  it('round-trips records, including ids past 2^31 and non-ASCII labels', () => {
    const blob = encodeTrk1([{ t: T0, lon: 1, lat: 2 }]);
    const chunk = decodeChunk(encodeChunk({
      bucket: T0,
      lod: 0,
      records: [
        { entity: 5_000_000_000, part: 1, cls: 1, category: 2, label: 'İSTANBUL ÇEŞME', blob },
        { entity: 7, part: 0, cls: 2, category: 3, label: '', blob },
      ],
    }));
    expect(chunk.bucket).toBe(T0);
    expect(chunk.records.map(r => [r.entity, r.part, r.cls, r.category, r.label])).toEqual([
      [5_000_000_000, 1, 1, 2, 'İSTANBUL ÇEŞME'],
      [7, 0, 2, 3, ''],
    ]);
    expect(decodeTrk1(chunk.records[1].blob).lat[0]).toBe(2);
  });

  it('rejects other payloads', () => {
    expect(() => decodeChunk(new TextEncoder().encode('{"error":1}'))).toThrow(/TRKC/);
  });
});

describe('tiles', () => {
  it('covers the whole world at z0 and reaches the poles', () => {
    expect(tileBbox(0, 0, 0)).toEqual({ w: -180, e: 180, n: 90, s: -90 });
  });

  it('places a point in the tile whose bbox contains it', () => {
    const { x, y } = lonLatToTile(29.0, 41.0, 7);
    const b = tileBbox(7, x, y);
    expect(29.0).toBeGreaterThanOrEqual(b.w);
    expect(29.0).toBeLessThan(b.e);
    expect(41.0).toBeLessThanOrEqual(b.n);
    expect(41.0).toBeGreaterThan(b.s);
  });

  it('lists the tiles a bbox touches', () => {
    expect(tilesForBbox({ w: -1, s: -1, e: 1, n: 1 }, 1)).toHaveLength(4);
  });
});
