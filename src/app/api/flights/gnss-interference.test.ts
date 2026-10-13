import { describe, expect, it } from 'vitest';
import { interferenceCells, navSamplesFrom, type NavSample } from './gnss-interference';

const at = (lat: number, lng: number, nac_p: number, n: number): NavSample[] => Array.from({ length: n }, () => ({ lat, lng, nac_p }));

describe('interferenceCells', () => {
  it('flags a cell where a large enough share of aircraft report bad accuracy', () => {
    const cells = interferenceCells([...at(55.3, 15.4, 0, 6), ...at(55.6, 15.9, 9, 14)]);
    expect(cells).toEqual([{ lat: 55, lng: 15, size: 2, bad: 6, total: 20, ratio: 0.3, severity: 30, count: 6 }]);
  });

  it('ignores a few bad transponders in busy, healthy airspace', () => {
    expect(interferenceCells([...at(37.5, -89.5, 0, 4), ...at(37.5, -89.5, 10, 96)])).toEqual([]);
  });

  it('needs at least three bad aircraft, so one faulty transponder in a quiet cell is not a finding', () => {
    expect(interferenceCells([...at(-21.5, -45.5, 0, 2), ...at(-21.5, -45.5, 9, 8)])).toEqual([]);
  });

  it('needs enough aircraft before a share means anything', () => {
    expect(interferenceCells(at(49.1, -123.1, 0, 4))).toEqual([]);
  });

  it('skips samples without a position or accuracy', () => {
    expect(interferenceCells([{ lat: NaN, lng: 1, nac_p: 0 }, { lat: 1, lng: 1, nac_p: NaN }])).toEqual([]);
  });
});

describe('navSamplesFrom', () => {
  it('takes airborne tar1090 rows once per aircraft, and skips rows without accuracy', () => {
    expect(navSamplesFrom([
      { hex: 'ABC123', lat: 55.1, lon: 15.2, nac_p: 0, alt_baro: 35000 },
      { hex: 'abc123', lat: 55.2, lon: 15.3, nac_p: 9, alt_baro: 35000 },
      { hex: 'def456', lat: 55.1, lon: 15.2, nac_p: 9, alt_baro: 'ground' },
      { hex: 'aaa111', lat: 55.1, lon: 15.2, alt_baro: 30000 },
    ])).toEqual([{ lat: 55.1, lng: 15.2, nac_p: 0 }]);
  });
});
