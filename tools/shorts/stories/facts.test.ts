import { describe, expect, it } from 'vitest';
import { arc, centre, countBy, densest, focus, movers, namedIn, rankOf, sampleYears, spokenNumber, valuesAt } from './facts';

describe('centre', () => {
  it('averages longitude on the circle, across the antimeridian', () => {
    const [lat, lon] = centre([{ t: 0, lat: 10, lon: 170 }, { t: 0, lat: 20, lon: -170 }])!;
    expect(lat).toBe(15);
    expect(Math.abs(lon)).toBeCloseTo(180, 5);
  });
  it('is null for nothing', () => expect(centre([])).toBeNull());
});

describe('densest', () => {
  it('looks where most points are, not between clusters', () => {
    const pts = [...Array(5)].map(() => ({ t: 0, lat: 37, lon: -116 })).concat([{ t: 0, lat: 50, lon: 78 }]);
    expect(densest(pts)).toEqual([37, -116]);
  });
});

describe('arc', () => {
  it('measures great-circle degrees', () => {
    expect(arc([0, 0], [0, 90])).toBeCloseTo(90, 6);
    expect(arc([10, 179], [10, -179])).toBeLessThan(2.1);
  });
});

describe('focus', () => {
  const at = (y: number, lat: number, lon: number, who: string) => ({ t: Date.UTC(y, 5), lat, lon, who });
  // Nevada leads every stretch by count, as in SIPRI's records
  const rows = [...[...Array(6)].map(() => at(1971, 37, -116, 'United States')),
    at(1973, 73, 54, 'Soviet Union'), at(1974, 50, 78, 'Soviet Union'), at(1975, 50, 78, 'Soviet Union')];
  const place = (e: { who: string }) => e.who;
  it('follows the biggest event whose year the line says', () => {
    const [lat, lon] = focus(rows, 'A Soviet test in 1973 of about 10,000 kilotons.', { bounds: [1970, 1984], biggest: [rows[6]], place })!;
    expect(arc([lat, lon], [73, 54])).toBeLessThan(1);
  });
  it("follows the stretch's end year said alone: it is an event's year", () => {
    const [lat, lon] = focus(rows, 'In 1984 a Soviet test hit 10,000 kilotons.', { bounds: [1970, 1984], biggest: [at(1984, 73, 54, 'Soviet Union')], place })!;
    expect(arc([lat, lon], [73, 54])).toBeLessThan(1);
  });
  it('follows a big event by a name its description holds', () => {
    const lopNor = at(1980, 41, 89, 'China');
    const [lat, lon] = focus([...rows, lopNor], 'Then it nearly stops, the biggest at Lop Nor.', { bounds: [1970, 1984], biggest: [rows[0], lopNor], place,
      describe: e => (e === lopNor ? 'China test, 1980, at Lop Nor' : 'United States test, at the Nevada Test Site') })!;
    // centred among the tests around it, Semipalatinsk's included
    expect(arc([lat, lon], [41, 89])).toBeLessThan(10);
  });
  it("ignores the stretch's own years and numbers like 10,000", () => {
    const [lat, lon] = focus(rows, 'From 1970 to 1984, 10,000 kilotons.', { bounds: [1970, 1984], biggest: [at(1970, 37, -116, 'United States')], place })!;
    expect([lat, lon]).toEqual([37, -116]);
  });
  it('else looks at the first place it names', () => {
    const [lat, lon] = focus(rows, 'The Soviet Union leads, the United States next.', { bounds: [1970, 1984], biggest: [], place })!;
    expect(arc([lat, lon], [50, 78])).toBeLessThan(1);
  });
  it('else around the biggest, which its chip shows', () => {
    const [lat, lon] = focus(rows, 'Many explosions.', { bounds: [], biggest: [rows[6]], place })!;
    expect(arc([lat, lon], [73, 54])).toBeLessThan(1);
  });
  it('else at the densest part', () => {
    expect(focus(rows, 'Many explosions.', { bounds: [], biggest: [], place })).toEqual([37, -116]);
  });
  it('reads a year that ends the sentence', () => {
    const [lat, lon] = focus(rows, 'A Soviet blast in 1973.', { bounds: [1970, 1984], biggest: [rows[0], rows[6]], place })!;
    expect(arc([lat, lon], [73, 54])).toBeLessThan(1);
  });
});

describe('namedIn', () => {
  const at = (y: number, title: string, height: number) => ({ t: Date.UTC(y, 11), lat: 0, lon: 0, title, height });
  // the tallest water of 2000–2025 came from landslides, so 2004 is not among the stretch's biggest
  const rows = [at(2025, 'Tsunami — Tracy Arm, Ak', 481), at(2004, 'Tsunami — Dead Sea', 1), at(2004, 'Tsunami — Off W. Coast Of Sumatra', 50.9),
    at(2004, 'Tsunami — Kepulauan Alor', 2)];
  const size = (e: { height: number }) => e.height;
  it('finds an event of a year the line says by a word of its title, not the word every title shares', () => {
    expect(namedIn("26 December 2004: Sumatra's tsunami ran up to 50.9 metres.", [2000, 2025], [rows[0]], { rows, size })?.title).toContain('Sumatra');
  });
  it('names nothing for a year alone', () => {
    expect(namedIn('In 2004, the tsunami struck.', [2000, 2025], [rows[0]], { rows, size })).toBeUndefined();
  });
});

describe('countBy', () => {
  it('counts, most first, skipping nulls', () => {
    expect(countBy(['a', 'b', 'a', null], x => x)).toEqual([['a', 2], ['b', 1]]);
  });
});

describe('sampleYears', () => {
  it('keeps the ends and rounds the middle', () => {
    expect(sampleYears(1950, 2100, 4)).toEqual([1950, 2000, 2050, 2100]);
    expect(sampleYears(1945, 1998, 3)).toEqual([1945, 1970, 1998]);
  });
});

describe('rankings', () => {
  const series = { A: [[2000, 5], [2050, 6]], B: [[2000, 3], [2050, 9]], C: [[2000, 4]] } as Record<string, [number, number][]>;
  it('ranks a year, top first', () => {
    expect(valuesAt(series, 2000).map(r => r.key)).toEqual(['A', 'C', 'B']);
    expect(rankOf(valuesAt(series, 2050), 'B')).toBe(1);
    expect(rankOf(valuesAt(series, 2050), 'C')).toBeNull();
  });
  it('finds the biggest risers by ratio', () => {
    expect(movers(valuesAt(series, 2000), valuesAt(series, 2050), 1, 'up')[0]).toEqual({ key: 'B', from: 3, to: 9 });
  });
});

describe('spokenNumber', () => {
  it('says big numbers in words and small ones plainly', () => {
    expect(spokenNumber(1_412_000_000)).toBe('1.4 billion');
    expect(spokenNumber(72.46)).toBe('72.5');
    expect(spokenNumber(3200)).toBe('3,200');
  });
});
