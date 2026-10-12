import { describe, expect, it } from 'vitest';
import { referenceDataset } from './catalog';
import { popupHtml, snapBox } from './view';

describe('snapBox', () => {
  it('pushes the view out to whole tiles, so small pans ask for the same box', () => {
    const a = snapBox({ west: -74.3, south: 40.5, east: -73.6, north: 40.9 }, 8);
    const b = snapBox({ west: -74.2, south: 40.55, east: -73.65, north: 40.85 }, 8);
    expect(a).toEqual(b);
    const step = 360 / 256;
    expect(a[0]).toBeLessThanOrEqual(-74.3);
    expect(a[2]).toBeGreaterThanOrEqual(-73.6);
    expect(a.every(n => Math.abs(n / step - Math.round(n / step)) < 1e-9)).toBe(true);
  });

  it('keeps latitude on the globe', () => {
    const [, south, , north] = snapBox({ west: -10, south: -89, east: 10, north: 89 }, 1);
    expect(south).toBe(-90);
    expect(north).toBe(90);
  });

  it('asks for the whole world once the view spans it', () => {
    expect(snapBox({ west: -250, south: -60, east: 250, north: 60 }, 1)).toEqual([-180, -90, 180, 90]);
  });
});

describe('popupHtml', () => {
  const airports = referenceDataset('airports')!;

  it('escapes every value, so a hostile name cannot inject markup', () => {
    const html = popupHtml(airports, { name: '<img src=x onerror=alert(1)>', municipality: '"><script>' });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img');
  });

  it('turns only http(s) values into links', () => {
    const html = popupHtml(airports, { name: 'JFK', wikipedia_link: 'https://en.wikipedia.org/wiki/JFK', home: 'javascript:alert(1)' });
    expect(html).toContain('href="https://en.wikipedia.org/wiki/JFK"');
    expect(html).not.toContain('href="javascript');
  });

  it('spells field names out as words', () => {
    const html = popupHtml(referenceDataset('military-bases')!, { siteName: 'Fort X', siteOperationalStatus: 'act', COUNTRY_CODE: 'US' });
    expect(html).toContain('SITE OPERATIONAL STATUS');
    expect(html).toContain('COUNTRY CODE');
  });

  it('falls back to the dataset label when the feature has no title', () => {
    expect(popupHtml(airports, { ident: 'X1' })).toContain('Airports');
  });
});
