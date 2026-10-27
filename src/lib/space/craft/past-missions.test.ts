import { describe, expect, it } from 'vitest';
import { craftByHorizons } from '@/lib/platform/site/space/roster';
import { LAUNCHES } from './launches';
import { PAST_MISSIONS, pastMission } from './past-missions';

describe('past missions', () => {
  it('lists each Horizons craft once, with what it did and when', () => {
    const ids = PAST_MISSIONS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of PAST_MISSIONS) {
      expect(m.id).toBeLessThan(0);
      expect(m.launched).toBeLessThanOrEqual(m.ended);
      expect(m.note.length).toBeGreaterThan(20);
      expect(m.wiki).toBeTruthy();
      expect(pastMission(m.id)).toBe(m);
    }
  });

  // A live craft has a launch row for its ascent; a past one with a row would belong in the fleet instead.
  it('keeps clear of the live fleet’s launch table', () => {
    for (const m of PAST_MISSIONS) expect(LAUNCHES[m.id], m.name).toBeUndefined();
  });

  it('gives each one a spacecraft page, or a landing-site page for landers', () => {
    const landers = new Set([-84, -530]);
    for (const m of PAST_MISSIONS.filter(x => !landers.has(x.id))) expect(craftByHorizons(m.id)?.gone, m.name).toBe(true);
  });
});
