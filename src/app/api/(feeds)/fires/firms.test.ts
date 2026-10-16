import { describe, it, expect } from 'vitest';
import { mergeDetections, parseFirmsCsv, type FireRow } from './firms';

const HEADER = 'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight';
const csv = (...rows: string[]) => [HEADER, ...rows].join('\n');
const row = (lat: number, lng: number, frp: number, sat = 'N20') => `${lat},${lng},311.11,0.61,0.54,2026-10-15,0001,${sat},nominal,2.0NRT,298.89,${frp},N`;

describe('parseFirmsCsv', () => {
  it('reads a VIIRS row and skips a broken one', () => {
    const rows = parseFirmsCsv(csv(row(17.93643, 34.04263, 1.78), 'x,y'));
    expect(rows).toEqual([{ lat: 17.936, lng: 34.043, brightness: 311.11, confidence: 'nominal', date: '2026-10-15', time: '0001', frp: 1.78, type: 'fire', satellites: 1 }]);
  });
});

describe('mergeDetections', () => {
  const at = (lat: number, lng: number, frp: number): FireRow => parseFirmsCsv(csv(row(lat, lng, frp)))[0];

  it('keeps one row per cell, the strongest, counting the satellites that saw it', () => {
    const merged = mergeDetections([[at(45.839, -73.258, 2)], [at(45.8392, -73.2529, 3), at(45.8382, -73.2533, 1)], [at(10, 10, 5)]]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ frp: 3, satellites: 2 });
    expect(merged[1]).toMatchObject({ frp: 5, satellites: 1 });
  });

  it('over the cap keeps the strongest half and spreads the rest', () => {
    const many = Array.from({ length: 100 }, (_, i) => at(i, i, i));
    const merged = mergeDetections([many], 10);
    expect(merged).toHaveLength(10);
    expect(merged.slice(0, 5).map(r => r.frp)).toEqual([99, 98, 97, 96, 95]);
    expect(new Set(merged).size).toBe(10);
    expect(Math.min(...merged.map(r => r.frp))).toBe(0);
  });
});
