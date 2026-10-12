import { describe, expect, it } from 'vitest';
import { streetCrimeNear, summariseCrimes } from './police-uk';

// Verbatim row shape from crimes-street/all-crime, 2026-08 (Cambridge).
const row = (category: string) => ({
  category, location_type: 'Force',
  location: { latitude: '52.206447', street: { id: 2039539, name: 'On or near Sidney Street' }, longitude: '0.120517' },
  context: '', outcome_status: null, persistent_id: '', id: 137034540, location_subtype: '', month: '2026-08',
});

describe('summariseCrimes', () => {
  it('counts crimes by category, largest first', () => {
    const rows = [row('violent-crime'), row('violent-crime'), row('anti-social-behaviour'), row('bicycle-theft')];
    expect(summariseCrimes(rows)).toEqual({
      month: '2026-08',
      total: 4,
      top: [
        { category: 'violent-crime', label: 'Violent crime', count: 2 },
        { category: 'anti-social-behaviour', label: 'Anti social behaviour', count: 1 },
        { category: 'bicycle-theft', label: 'Bicycle theft', count: 1 },
      ],
      radius_miles: 1,
      source: 'data.police.uk',
      url: 'https://data.police.uk/',
    });
  });

  it('reads an empty answer as no data, not as no crime', () => {
    expect(summariseCrimes([])).toBeNull();
    expect(() => summariseCrimes({ error: 1 })).toThrow();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads live street crime for Cambridge, and nothing for Edinburgh', async () => {
  expect((await streetCrimeNear(52.2053, 0.1218))?.total).toBeGreaterThan(100);
  expect(await streetCrimeNear(55.9533, -3.1883)).toBeNull();
}, 60_000);
