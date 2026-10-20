import { describe, expect, it } from 'vitest';
import { archiveCovers, archiveRange, indexArchive, type QuakeArchive, type QuakeArchiveRow } from './quake-archive';

const at = (day: string) => Date.parse(day);
const row = (id: string, day: string, mag: number, lon = 30, lat = 39): QuakeArchiveRow => [id, at(day), lon, lat, 10, mag, `${id} place`, 'us'];

const archive: QuakeArchive = {
  generated: '2026-10-19',
  until: '2026-10-19',
  tiers: [{ floor: 6, since: '1900-01-01' }, { floor: 4.5, since: '2017-01-01' }],
  rows: [
    row('old6', '1939-12-26', 7.8),
    row('a', '2018-05-01', 4.6),
    row('b', '2020-01-24', 6.7),
    row('c', '2023-02-06', 7.8),
    row('east', '2021-03-04', 7.4, 179.5, -30),
    row('west', '2021-03-05', 6.1, -179.5, -30),
  ],
};
const ix = indexArchive(archive);

describe('archiveCovers', () => {
  it('holds M6+ back to 1900 and M4.5+ back to 2017, up to the day it stops', () => {
    expect(archiveCovers(ix, at('1900-01-01'), at('2026-10-19'), 6)).toBe(true);
    expect(archiveCovers(ix, at('2017-01-01'), at('2026-10-19'), 4.5)).toBe(true);
  });

  it('refuses what it would under-report: a lower floor, an earlier start, a later end', () => {
    expect(archiveCovers(ix, at('1950-01-01'), at('2026-10-19'), 5.9)).toBe(false);
    expect(archiveCovers(ix, at('2016-12-31'), at('2026-10-19'), 4.5)).toBe(false);
    expect(archiveCovers(ix, at('2017-01-01'), at('2026-10-19'), 4.4)).toBe(false);
    expect(archiveCovers(ix, at('1899-12-31'), at('2026-10-19'), 6)).toBe(false);
    expect(archiveCovers(ix, at('2017-01-01'), at('2026-10-20'), 6)).toBe(false);
  });
});

describe('archiveRange', () => {
  it('gives the largest first and counts them all', () => {
    const got = archiveRange(ix, at('1927-01-01'), at('2026-10-19'), 6, [25.67, 35.83, 44.82, 42.09], 2)!;
    expect(got.rows.map(r => r[0])).toEqual(['c', 'old6']);
    expect(got.total).toBe(3);
  });

  it('keeps to the window and the floor', () => {
    const got = archiveRange(ix, at('2017-01-01'), at('2023-01-01'), 4.5, [25.67, 35.83, 44.82, 42.09], 10)!;
    expect(got.rows.map(r => r[0])).toEqual(['b', 'a']);
  });

  it('reads a box across the antimeridian as USGS does', () => {
    const got = archiveRange(ix, at('2017-01-01'), at('2026-10-19'), 6, [170, -40, -170, -20], 10)!;
    expect(got.rows.map(r => r[0])).toEqual(['east', 'west']);
  });

  it('is null for a window it does not cover', () => {
    expect(archiveRange(ix, at('1950-01-01'), at('2026-10-19'), 5, undefined, 10)).toBeNull();
  });
});
