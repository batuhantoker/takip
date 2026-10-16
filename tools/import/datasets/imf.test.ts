import { describe, expect, it } from 'vitest';
import { SOURCES } from '../seed';
import { IMF_METRICS, lastActual, projectionOf, seriesOf } from './imf';

describe('imf', () => {
  it('reads the last actual year, a fiscal year under its first calendar year', () => {
    expect(lastActual('2025')).toBe(2025);
    expect(lastActual('2025/26')).toBe(2025);
    expect(lastActual('FY2024/25')).toBe(2024);
    expect(lastActual('')).toBeNull();
    expect(lastActual(undefined)).toBeNull();
  });

  it('reads the portal’s wide rows and the API’s long ones', () => {
    expect(seriesOf({ SERIES_CODE: 'TUR.LP.A', SCALE: 'Millions', LATEST_ACTUAL_ANNUAL_DATA: '2025', 2025: '86.1', 2026: '86.5', 2027: '' })).toEqual({
      country: 'TUR', indicator: 'LP', frequency: 'A', scale: 6, last: 2025, points: [[2025, 86.1], [2026, 86.5]],
    });
    expect(seriesOf({ COUNTRY: 'TUR', INDICATOR: 'NGDP_RPCH', FREQUENCY: 'A', SCALE: '0', TIME_PERIOD: '2026', OBS_VALUE: '2.65', LATEST_ACTUAL_ANNUAL_DATA: '2025' }))
      .toEqual({ country: 'TUR', indicator: 'NGDP_RPCH', frequency: 'A', scale: 0, last: 2025, points: [[2026, 2.65]] });
  });

  it('keeps projections under their own codes', () => {
    for (const m of IMF_METRICS) expect(projectionOf(m).code).toBe(`${m.code}.proj`);
    expect(projectionOf(IMF_METRICS[0]).name).toBe('Real GDP growth (IMF projection, October 2026)');
  });

  it('is seeded with the IMF’s terms, not an open licence', () => {
    expect(SOURCES.find(s => s.code === 'imf-weo')?.licence).toBe('imf-terms');
  });
});
