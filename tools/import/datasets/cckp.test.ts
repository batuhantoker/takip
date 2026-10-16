import { describe, expect, it } from 'vitest';
import { LICENCES, SOURCES } from '../seed';
import { CCKP_METRICS, projectionCode, SSPS } from './cckp';
import { CCKP_VARS } from '../fetch';

describe('cckp', () => {
  it('names a metric for every variable fetched', () => {
    expect(CCKP_METRICS.map(m => m.v)).toEqual(CCKP_VARS);
  });

  it('keeps SSP2-4.5 as the main projection and the rest as scenarios, each with its range', () => {
    expect(SSPS[0]).toBe('ssp245');
    expect(projectionCode('hd35', 'ssp245')).toBe('cckp:hd35.proj');
    expect(projectionCode('hd35', 'ssp585')).toBe('cckp:hd35.proj.ssp585');
    expect(projectionCode('hd35', 'ssp245', 'lo')).toBe('cckp:hd35.proj.lo');
    expect(projectionCode('hd35', 'ssp126', 'hi')).toBe('cckp:hd35.proj.ssp126.hi');
  });

  it('is seeded under the World Bank with CC BY 4.0', () => {
    const source = SOURCES.find(s => s.code === 'wb-cckp');
    expect(source?.owner).toBe('World Bank Group');
    expect(LICENCES.find(l => l.code === source?.licence)?.code).toBe('cc-by-4.0');
  });
});
