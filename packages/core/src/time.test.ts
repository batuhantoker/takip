import { describe, expect, it } from 'vitest';
import { expand, floorTo, Prec } from './time';

const ms = (iso: string) => Date.parse(iso);

describe('expand', () => {
  it('spans the stated month', () => {
    expect(expand(ms('1917-05-01T00:00:00Z'), Prec.month)).toEqual({ lo: ms('1917-05-01T00:00:00Z'), hi: ms('1917-06-01T00:00:00Z') });
  });

  it('rolls December into the next year', () => {
    expect(expand(ms('1999-12-15T00:00:00Z'), Prec.month).hi).toBe(ms('2000-01-01T00:00:00Z'));
  });

  it('spans decades and centuries from their first year', () => {
    expect(expand(ms('1914-07-28T00:00:00Z'), Prec.decade)).toEqual({ lo: ms('1910-01-01T00:00:00Z'), hi: ms('1920-01-01T00:00:00Z') });
    expect(expand(ms('1914-07-28T00:00:00Z'), Prec.century).lo).toBe(ms('1900-01-01T00:00:00Z'));
  });

  it('handles BCE years, which Date.parse cannot spell as 4-digit years', () => {
    const d = new Date(0);
    d.setUTCFullYear(-499, 3, 1);
    const { lo, hi } = expand(d.getTime(), Prec.year);
    expect(new Date(lo).getUTCFullYear()).toBe(-499);
    expect(new Date(hi).getUTCFullYear()).toBe(-498);
    expect(lo).toBeLessThan(d.getTime());
  });

  it('keeps an unknown precision as an instant', () => {
    expect(expand(123, Prec.unknown)).toEqual({ lo: 123, hi: 123 });
  });
});

describe('floorTo', () => {
  it('floors negative times toward minus infinity', () => {
    expect(floorTo(-1, 1000)).toBe(-1000);
    expect(floorTo(1999, 1000)).toBe(1000);
  });
});
