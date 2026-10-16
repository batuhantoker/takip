import { describe, expect, it } from 'vitest';
import { SOURCES } from '../seed';
import { LAST_ESTIMATE, projectionOf, WUP_METRICS } from './wup';

describe('wup', () => {
  it('treats 1950–2025 as estimates and later years as projections, as the WUP FAQ says', () => {
    expect(LAST_ESTIMATE).toBe(2025);
  });

  it('keeps each projection under its own code', () => {
    for (const m of WUP_METRICS) {
      expect(projectionOf(m).code).toBe(`${m.code}.proj`);
      expect(projectionOf(m).name).toBe(`${m.name} (UN projection)`);
    }
    expect(new Set(WUP_METRICS.map(m => m.code)).size).toBe(WUP_METRICS.length);
  });

  it('is seeded under the UN with CC BY 3.0 IGO', () => {
    expect(SOURCES.find(s => s.code === 'wup-2025')).toMatchObject({ owner: 'UN DESA, Population Division', licence: 'cc-by-3.0-igo' });
  });
});
