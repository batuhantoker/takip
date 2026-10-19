import { describe, expect, it } from 'vitest';
import { EN } from '../copy/format';
import { elementsLine, issLines, passRow } from './iss-copy';
import { issReport, tleEpoch, type IssElements } from './iss-passes';
import { skyWhen } from './sky-copy';

const LINE1 = '1 25544U 98067A   26288.82192346  .00005580  00000+0  10980-3 0  9999';
const LINE2 = '2 25544  51.6317  63.1136 0006755 265.8514  94.1703 15.48879905590452';
const ISS: IssElements = { line1: LINE1, line2: LINE2, epoch: tleEpoch(LINE1)! };
const FROM = Date.parse('2026-10-16T00:00:00Z');

describe('skyWhen', () => {
  const tz = 'Europe/Berlin';
  const at = (local: string) => Date.parse(`${local}+02:00`);
  const afternoon = at('2026-10-19T15:00:00');

  it('says tonight, this morning, tomorrow, then the day', () => {
    expect(skyWhen(at('2026-10-19T21:10:00'), afternoon, tz, EN)).toBe('tonight at 21:10');
    expect(skyWhen(at('2026-10-20T00:40:00'), afternoon, tz, EN)).toBe('tonight at 00:40');
    expect(skyWhen(at('2026-10-20T05:42:00'), afternoon, tz, EN)).toBe('tomorrow morning at 05:42');
    expect(skyWhen(at('2026-10-20T19:00:00'), afternoon, tz, EN)).toBe('tomorrow evening at 19:00');
    expect(skyWhen(at('2026-10-20T05:42:00'), at('2026-10-20T02:00:00'), tz, EN)).toBe('this morning at 05:42');
    expect(skyWhen(at('2026-10-22T05:44:00'), afternoon, tz, EN)).toBe('on Thursday, October 22 at 05:44');
  });
});

describe('issLines', () => {
  it('leads with the next visible pass, how it crosses, and how many there are', () => {
    const r = issReport(ISS, { lat: 51.5, lng: -0.13, tz: 'Europe/London' }, FROM);
    const lines = issLines(r, 'London', EN);
    expect(lines[0]).toMatch(/^Next visible pass: (tonight|this morning|tomorrow (morning|evening)|on \w+day, October \d+) at \d\d:\d\d\.$/);
    expect(lines[1]).toMatch(/^(It rises in the|It stays low: it rises in the) [a-z-]+, (climbs|reaches)/);
    expect(lines[2]).toBe(`There are ${r.visible.length} visible passes over London in the next three days.`);
  });

  it('says when the passes in the window can’t be seen, and when one next can', () => {
    const sydney = issLines(issReport(ISS, { lat: -33.87, lng: 151.21, tz: 'Australia/Sydney' }, FROM), 'Sydney', EN);
    expect(sydney[0]).toMatch(/^The station crosses the sky over Sydney \d+ times in the next three days, but each time in daylight or in Earth’s shadow/);
    expect(sydney[1]).toMatch(/^The next visible pass is expected on \w+day, October \d+ at \d\d:\d\d, up to \d+°/);
    const singapore = issLines(issReport(ISS, { lat: 1.29, lng: 103.85, tz: 'Asia/Singapore' }, FROM), 'Singapore', EN);
    expect(singapore[1]).toBe('None is expected to be visible in the next 10 days either.');
  });

  it('says nothing where it gives no times', () => {
    expect(issLines(issReport(ISS, { lat: 69.65, lng: 18.96, tz: 'Europe/Oslo' }, FROM), 'Tromsø', EN)).toEqual([]);
  });
});

describe('a pass row and the source line', () => {
  it('reads in the place’s time', () => {
    const r = issReport(ISS, { lat: 51.5, lng: -0.13, tz: 'Europe/London' }, FROM);
    const row = passRow(r.visible[0], r.tz, EN);
    expect(row.time).toMatch(/^\d\d:\d\d–\d\d:\d\d$/);
    expect(row.path).toMatch(/^[a-z-]+ to [a-z-]+, up to \d+°$/);
    expect(elementsLine(r, EN)).toBe('Predicted from the orbital elements of Oct 15, 19:43 UTC. A pass needs a clear sky, and the times move when the station boosts its orbit.');
  });
});
