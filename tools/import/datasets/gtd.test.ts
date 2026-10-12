import { describe, expect, it } from 'vitest';
import { compact, excelDamaged, parseResolution, rowHash, severity } from './gtd';

describe('gtd helpers', () => {
  it('hashes the identifying fields only', () => {
    const a = { iyear: '1970', imonth: '7', iday: '2', country: '58', city: 'Santo Domingo', gname: 'MANO-D', eventid: '1.97E+11' };
    expect(rowHash(a)).toBe(rowHash({ ...a, eventid: 'other' }));
    expect(rowHash(a)).not.toBe(rowHash({ ...a, city: 'Santiago' }));
    expect(rowHash(a)).toMatch(/^[0-9a-f]{40}$/);
  });

  it('parses m/d/yyyy resolutions and refuses the rest', () => {
    expect(parseResolution('3/14/1985')).toBe(Date.UTC(1985, 2, 14));
    expect(parseResolution('12/01/2001')).toBe(Date.UTC(2001, 11, 1));
    expect(parseResolution('14-03-1985')).toBeNull();
    expect(parseResolution('2/30/1990')).toBeNull();
    expect(parseResolution('13/1/1990')).toBeNull();
  });

  it('spots group names Excel turned into dates', () => {
    for (const s of ['09-Feb', '01-May', 'Sep-11', 'Oct-80']) expect(excelDamaged(s)).toBe(true);
    for (const s of ['May 19 Communist Organization', '15 May Organization', 'Taliban']) expect(excelDamaged(s)).toBe(false);
  });

  it('derives severity on a log scale', () => {
    expect(severity(null, null)).toBeNull();
    expect(severity(0, 0)).toBe(0);
    expect(severity(9, 0)).toBe(1);
    expect(severity(0, 90)).toBe(1);
  });

  it('keeps zeros but drops empties, preserving key order', () => {
    expect(compact({ a: 0, b: null, c: '', d: [null, 'x'], e: { f: null }, g: [] })).toEqual({ a: 0, d: ['x'] });
  });
});
