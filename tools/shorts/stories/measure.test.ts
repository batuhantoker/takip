import { describe, expect, it } from 'vitest';
import { contestedIn, crossings, namedCountry, smoothed, undated } from './measure';

describe('smoothed', () => {
  it('averages each year with the ones before it, over the window it has', () => {
    expect(smoothed({ SWE: [[2000, 4], [2001, 6], [2002, 2], [2003, 8]] }, 3).SWE).toEqual([[2000, 4], [2001, 5], [2002, 4], [2003, 16 / 3]]);
  });
});

describe('crossings', () => {
  it('gives the year one of the top three passed another inside the stretch', () => {
    const values = { CHN: [[2016, 1400], [2022, 1420], [2023, 1415], [2040, 1300]], IND: [[2016, 1300], [2022, 1410], [2023, 1428], [2040, 1600]] } as Record<string, [number, number][]>;
    expect(crossings(values, 2016, 2040)).toEqual([{ ahead: 'IND', behind: 'CHN', year: 2023 }]);
  });
  it('gives nothing when the order holds', () => {
    expect(crossings({ A: [[2000, 2], [2010, 3]], B: [[2000, 1], [2010, 1]] }, 2000, 2010)).toEqual([]);
  });
});

describe('namedCountry', () => {
  const names = { CHN: { name: "People's Republic of China" }, IND: { name: 'India' }, NER: { name: 'Niger' }, NGA: { name: 'Nigeria' },
    GIN: { name: 'Guinea' }, GNB: { name: 'Guinea-Bissau' }, USA: { name: 'United States of America' }, HKG: { name: 'Hong Kong' } };
  const keys = Object.keys(names);
  it('takes the first country the line names, by a short form too', () => {
    expect(namedCountry('In 2022, India passes China.', keys, names)).toBe('IND');
    expect(namedCountry('China is projected to shrink.', keys, names)).toBe('CHN');
    expect(namedCountry('The US more than doubled.', keys, names)).toBe('USA');
  });
  it('tells Niger from Nigeria, and the longer name where two start together', () => {
    expect(namedCountry('Even Nigeria, still worst on the map.', keys, names)).toBe('NGA');
    expect(namedCountry('Guinea-Bissau climbs.', keys, names)).toBe('GNB');
  });
  it('names nothing in a line about countries in general', () => {
    expect(namedCountry('Now 81 countries have as many girls as boys.', keys, names)).toBeNull();
  });
});

describe('undated', () => {
  const legs = [{ from: 1870, year: 1900 }, { from: 1930, year: 1960 }];
  it('refuses a line with no year in its stretch', () => {
    expect(undated(legs, { y1900: 'By 1900, the United States overtakes the United Kingdom.', y1960: 'Suddenly Qatar tops the whole map at 52,299 dollars a person.' })).toMatch(/y1960/);
  });
  it("doesn't count a price base as the year", () => {
    expect(undated([{ from: 1990, year: 2022 }], { y2022: 'Qatar is back on top at 149,170 dollars a person, in 2011 dollars.' })).toMatch(/y2022/);
  });
  it('passes a stretch end, a crossing year inside it, or its decade', () => {
    expect(undated(legs, { y1900: 'In 1895, the United States passes the United Kingdom.', y1960: 'In the 1950s, Qatar tops the map.' })).toBeNull();
  });
});

describe('contestedIn', () => {
  const names = { TWN: { name: 'Taiwan' }, SAH: { name: 'Western Sahara' }, MAC: { name: 'Macau' } };
  it('refuses a line that singles out a contested place', () => {
    expect(contestedIn(['By 2000, Taiwan crashes to 1.5 births per woman.'], names)).toMatch(/Taiwan/);
    expect(contestedIn(['By 1990, Western Sahara climbs to 85 percent in cities.'], names)).toMatch(/Western Sahara/);
  });
  it('passes other countries and counts', () => {
    expect(contestedIn(['By 2000, Macau women average just 0.9 children.', 'By 1990, most people live in cities in 95 countries.'], names)).toBeNull();
  });
});
