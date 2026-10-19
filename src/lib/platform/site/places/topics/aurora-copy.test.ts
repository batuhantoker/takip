import { describe, expect, it } from 'vitest';
import { spokenUtc } from '../../clock';
import { EN } from '../copy/format';
import { auroraLines, kpToReach, nowcastLine } from './aurora-copy';
import { auroraReport, type OvationGrid } from './aurora-now';

const grid = (cells: [number, number, number][], max = Math.max(0, ...cells.map(c => c[2]))): OvationGrid => ({
  observed_at: '2026-10-19T21:50:00Z', forecast_at: '2026-10-19T22:25:00Z', cells, max_pct: max,
});
const TROMSO = { lat: 69.65, lng: 18.96, tz: 'Europe/Oslo' };
const NIGHT = Date.parse('2026-10-19T22:00:00Z');
const lines = (g: OvationGrid | null, now = NIGHT) => auroraLines(auroraReport(g, TROMSO, now), 'Tromsø', EN);

describe('auroraLines', () => {
  it('gives the chance overhead and how long the dark lasts', () => {
    expect(lines(grid([[18, 69, 30], [19, 69, 30], [18, 70, 30], [19, 70, 30]]))).toEqual([
      'NOAA’s model gives a 30% chance of aurora overhead in Tromsø right now.',
      // Midnight in Tromsø, so the dark ends the same day.
      expect.stringMatching(/^It is dark until 0\d:\d\d\.$/),
      'With a clear sky it is worth going out, away from street lights.',
    ]);
  });

  it('points to the low sky where it is likelier nearby', () => {
    expect(lines(grid([[19, 73, 25]]))[0]).toBe('NOAA’s model gives under 5% overhead in Tromsø right now, but 25% about 373 km to the north.');
  });

  it('says a quiet night is quiet, everywhere when it is', () => {
    expect(lines(grid([[19, 71, 6]], 11)).slice(0, 2)).toEqual([
      'NOAA’s model gives under 5% overhead in Tromsø right now, and no more than 6% within 500 km: little chance of seeing it.',
      'It is quiet everywhere: the highest chance anywhere on Earth is 11%.',
    ]);
  });

  it('says when it gets dark, or that it doesn’t', () => {
    expect(lines(grid([]), Date.parse('2026-10-19T12:00:00Z'))[0]).toMatch(/^It is too light in Tromsø to see the aurora; it gets dark at 1\d:\d\d\.$/);
    expect(lines(grid([]), Date.parse('2026-06-21T22:00:00Z'))).toEqual([expect.stringMatching(/^The sky over Tromsø doesn’t get dark enough for the aurora again until about \w+day, (August|September) \d+\.$/)]);
  });

  it('leaves the chance out when the nowcast is missing or old', () => {
    expect(lines(null)[0]).toBe('NOAA’s aurora nowcast isn’t available right now, so there is no chance to give for Tromsø.');
    expect(lines(grid([[19, 70, 50]]), NIGHT + 3 * 3_600_000)[0]).toMatch(/^NOAA’s aurora nowcast isn’t available/);
  });

  it('names the nowcast it used', () => {
    expect(spokenUtc(nowcastLine(auroraReport(grid([]), TROMSO, NIGHT), EN)!, 'en')).toBe('NOAA SWPC’s OVATION nowcast for 22:25 UTC. It ignores cloud and moonlight.');
  });
});

describe('kpToReach', () => {
  it('follows the rule of thumb, and gives up past Kp 9', () => {
    expect(kpToReach(67.1)).toBe(0);
    expect(kpToReach(63.9)).toBe(2);
    expect(kpToReach(-53.4)).toBe(7);
    expect(kpToReach(47)).toBeNull();
  });
});
