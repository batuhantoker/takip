import { describe, expect, it } from 'vitest';
import { SOURCES } from '../seed';
import { GEP_FORECAST, GEP_METRIC, LAST_ESTIMATE } from './gep';

describe('gep', () => {
  it('counts 2025 as the estimate and later years as forecasts, as the June 2026 tables mark them', () => {
    expect(LAST_ESTIMATE).toBe(2025);
    expect(GEP_FORECAST.code).toBe(`${GEP_METRIC.code}.proj`);
  });

  it('is seeded under the World Bank with CC BY 4.0', () => {
    expect(SOURCES.find(s => s.code === 'wb-gep')).toMatchObject({ licence: 'cc-by-4.0' });
  });
});
