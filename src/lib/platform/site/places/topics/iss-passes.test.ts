import { describe, expect, it } from 'vitest';
import { issReport, tleEpoch, type IssElements } from './iss-passes';

// As CelesTrak gave them on 2026-10-15, the same set as feeds/satellites/pass.test.ts.
const LINE1 = '1 25544U 98067A   26288.82192346  .00005580  00000+0  10980-3 0  9999';
const LINE2 = '2 25544  51.6317  63.1136 0006755 265.8514  94.1703 15.48879905590452';
const ISS: IssElements = { line1: LINE1, line2: LINE2, epoch: tleEpoch(LINE1)! };
const FROM = Date.parse('2026-10-16T00:00:00Z');
const LONDON = { lat: 51.5, lng: -0.13, tz: 'Europe/London' };

describe('tleEpoch', () => {
  it('reads the year and fractional day of line 1', () => {
    expect(new Date(ISS.epoch).toISOString().slice(0, 19)).toBe('2026-10-15T19:43:34');
    expect(tleEpoch('1 25544U 98067A   99001.50000000  .00000000  00000+0  00000+0 0  9999')).toBe(Date.UTC(1999, 0, 1, 12));
    expect(tleEpoch('garbage')).toBeNull();
  });
});

describe('issReport', () => {
  const london = issReport(ISS, LONDON, FROM);

  it('lists every pass above 10° in three days, and the visible ones, in local time', () => {
    expect(london.case).toBe('visible');
    expect(london.passes.length).toBeGreaterThanOrEqual(10);
    expect(london.visible.length).toBeGreaterThan(0);
    expect(london.visible.every(p => london.passes.includes(p))).toBe(true);
    for (const p of london.passes) {
      expect(p.rise).toBeGreaterThanOrEqual(FROM);
      expect(p.rise).toBeLessThan(FROM + 72 * 3_600_000);
      expect(p.maxElevation).toBeGreaterThanOrEqual(10);
      expect(p.start.time).toBe(new Date(p.rise + 3_600_000).toISOString().slice(11, 16));
    }
    expect(london.next).toBe(london.visible[0]);
    expect(london.highest!.maxElevation).toBe(Math.max(...london.visible.map(p => p.maxElevation)));
    expect(london.later).toBeNull();
    expect(london.ageDays).toBe(0.2);
  });

  it('numbers the nights from the one the page is read in', () => {
    expect(london.passes[0].night).toBe(0);
    expect(Math.max(...london.passes.map(p => p.night))).toBeLessThanOrEqual(3);
  });

  it('looks further ahead when nothing in three days can be seen', () => {
    const sydney = issReport(ISS, { lat: -33.87, lng: 151.21, tz: 'Australia/Sydney' }, FROM);
    expect(sydney.case).toBe('unseen');
    expect(sydney.passes.length).toBeGreaterThan(0);
    expect(sydney.next).toBeNull();
    expect(sydney.later!.visible).toBe(true);
    expect(sydney.later!.rise).toBeGreaterThan(FROM + 72 * 3_600_000);
    expect(sydney.later!.night).toBeGreaterThanOrEqual(3);
  });

  it('says never where the orbit keeps it under 10°, without searching', () => {
    const r = issReport(ISS, { lat: 69.65, lng: 18.96, tz: 'Europe/Oslo' }, FROM);
    expect(r.case).toBe('never');
    expect(r.best).toBeLessThan(4);
    expect(r.passes).toEqual([]);
  });

  it('gives no times from missing or week-old elements', () => {
    expect(issReport(null, LONDON, FROM).case).toBe('unavailable');
    expect(issReport(ISS, LONDON, ISS.epoch + 8 * 86_400_000).case).toBe('stale');
  });
});
