import { describe, expect, it } from 'vitest';
import { emergencyOf } from './emergency';

describe('emergencyOf', () => {
  it('reads the distress squawks first, then the ADS-B status', () => {
    expect(emergencyOf({ squawk: '7700', emergency: 'minfuel' })).toBe('Emergency');
    expect(emergencyOf({ squawk: '7600' })).toBe('Radio failure');
    expect(emergencyOf({ squawk: '7500' })).toBe('Hijack code');
    expect(emergencyOf({ squawk: '2000', emergency: 'minfuel' })).toBe('Minimum fuel');
  });

  it('leaves ordinary and medical-priority flights alone', () => {
    expect(emergencyOf({ squawk: '7000', emergency: 'none' })).toBeNull();
    expect(emergencyOf({ emergency: 'lifeguard' })).toBeNull();
    expect(emergencyOf(null)).toBeNull();
  });
});
