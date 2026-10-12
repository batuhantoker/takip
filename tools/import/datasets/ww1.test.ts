import { describe, expect, it } from 'vitest';
import { belligerents, monthOnly, parseCoords, pyDict, scanNames } from './ww1';

describe('ww1 parsing', () => {
  it('reads the decimal pair, signs from S/W, and falls back to DMS', () => {
    expect(parseCoords('Champagne-Ardenne, France49°11′04″N 04°32′39″E﻿ / ﻿49.18444°N 4.54417°E﻿ / 49.18444; 4.54417')).toEqual({ lat: 49.18444, lon: 4.54417 });
    expect(parseCoords('Off Coronel, Chile36°59′1″S 73°48′49″W﻿ / ﻿36.98361°S 73.81361°W')).toEqual({ lat: -36.98361, lon: -73.81361 });
    expect(parseCoords('Atlantic Ocean0°N 25°W﻿ / ﻿0°N 25°W﻿ / 0; -25')).toEqual({ lat: 0, lon: -25 });
    const dms = parseCoords('Somewhere 49°30′N 3°15′30″E')!;
    expect(dms.lat).toBeCloseTo(49.5);
    expect(dms.lon).toBeCloseTo(3.258333, 5);
    expect(parseCoords('Crna Loop')).toBeNull();
  });

  it('parses Python dict reprs without eval', () => {
    expect(pyDict("{'killed': [360.0], 'wounded': [487.0, 12.0], 'odd': [nan]}")).toEqual({ killed: [360], wounded: [487, 12], odd: [] });
    expect(pyDict('{}')).toEqual({});
  });

  it('spots raw dates that carry no day', () => {
    expect(['Oct-14', 'June, 1915', 'June 1915 (the siege continued)'].map(monthOnly)).toEqual([true, true, true]);
    expect(['27-May', 'March, 1', 'July 18, 1918', '5'].map(monthOnly)).toEqual([false, false, false, false]);
  });

  it('splits belligerent fields into names and supporters', () => {
    expect(belligerents('Central Powers: Germany  Austria-Hungary')).toEqual([{ text: 'Germany  Austria-Hungary', supporter: false }]);
    expect(belligerents('Ottoman EmpireSupported by: German Empire')).toEqual([
      { text: 'Ottoman Empire', supporter: false },
      { text: 'German Empire', supporter: true },
    ]);
    expect(belligerents('German Empire (military commanders)[1]\nBrazilOther Allied navies').map(b => b.text)).toEqual(['German Empire', 'Brazil', 'Other Allied navies']);
  });

  it('finds run-together names longest first and reports the rest', () => {
    const known: Record<string, number> = { 'German Empire': 1, Germany: 2, 'Austria-Hungary': 3, 'Ottoman Empire': 4, Russia: 5, 'Russian Empire': 6 };
    const lookup = (n: string) => known[n];
    expect(scanNames('Ottoman Empire German Empire Austria-Hungary', 0, lookup)).toEqual({ ids: [4, 1, 3], misses: [] });
    expect(scanNames('Finnish Reds Russia', 0, lookup)).toEqual({ ids: [5], misses: ['Finnish Reds'] });
    expect(scanNames('Russian Empire', 0, lookup).ids).toEqual([6]);
  });
});
