import { describe, expect, it } from 'vitest';
import { middleEvent } from './ucdp-ged';

describe('middleEvent', () => {
  it('lands on a recorded event, not the empty median between two theatres', () => {
    const kabul = { lon: 69.2, lat: 34.5 };
    const baghdad = { lon: 44.4, lat: 33.3 };
    const basra = { lon: 47.8, lat: 30.5 };
    // The coordinate-wise median (47.8, 33.3) is in Iran, where nothing was recorded.
    expect(middleEvent([kabul, kabul, baghdad, basra, basra])).toEqual(basra);
  });

  it('has no middle without events', () => {
    expect(middleEvent([])).toBeUndefined();
  });
});
