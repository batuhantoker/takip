import { describe, expect, it } from 'vitest';
import { shownSatellites } from './satellite-filter';

const sats = [{ category: 'comms' }, { category: 'military' }, { category: 'science' }];

describe('shownSatellites', () => {
  it('shows none with every satellite layer off', () => {
    expect(shownSatellites(sats, { satellites: false })).toEqual([]);
  });

  it('shows all under the satellites layer', () => {
    expect(shownSatellites(sats, { satellites: true })).toHaveLength(3);
  });

  it('shows only the categories switched on', () => {
    expect(shownSatellites(sats, { sat_comms: true, sat_science: true })).toEqual([{ category: 'comms' }, { category: 'science' }]);
  });
});
