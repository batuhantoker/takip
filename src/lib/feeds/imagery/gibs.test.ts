import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DAILY_FIRST, GOES_EAST, MODIS_TERRA, VIIRS_NOAA20,
  dailyDay, dailyProduct, domainEnd, domainsUrl, latestFrame, replayFrame, tenMinutes, tileUrl, utcDay,
} from './gibs';

const NOW = Date.parse('2026-10-15T20:43:12Z');

describe('time snapping', () => {
  it('floors to the UTC day and to ten minutes', () => {
    expect(utcDay(Date.parse('2005-08-29T23:59:59Z'))).toBe('2005-08-29');
    expect(tenMinutes(Date.parse('2026-10-15T18:03:59Z'))).toBe('2026-10-15T18:00:00Z');
  });

  it('draws yesterday when live, since today is still being imaged', () => {
    expect(dailyDay(null, NOW)).toBe('2026-10-14');
    expect(dailyDay(Date.parse('2026-10-15T01:00:00Z'), NOW)).toBe('2026-10-15');
  });

  it('draws nothing before the first daily picture', () => {
    expect(dailyDay(Date.parse('2000-02-23T12:00:00Z'), NOW)).toBeNull();
    expect(dailyDay(Date.parse(`${DAILY_FIRST}T00:00:00Z`), NOW)).toBe(DAILY_FIRST);
  });

  it('keeps a replayed frame behind what GIBS can have published', () => {
    expect(replayFrame(NOW, NOW)).toBe('2026-10-15T19:50:00Z');
    expect(replayFrame(Date.parse('2026-10-14T06:17:00Z'), NOW)).toBe('2026-10-14T06:10:00Z');
  });
});

describe('products and urls', () => {
  it('uses MODIS Terra until NOAA-20 VIIRS begins', () => {
    expect(dailyProduct('2017-12-31')).toBe(MODIS_TERRA);
    expect(dailyProduct('2018-01-05')).toBe(VIIRS_NOAA20);
  });

  it('builds the 3857 tile template with the row before the column', () => {
    expect(tileUrl(VIIRS_NOAA20, '2026-10-14')).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/2026-10-14/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg');
    expect(tileUrl(GOES_EAST, '2026-10-15T20:00:00Z')).toMatch(/GOES-East_ABI_GeoColor\/default\/2026-10-15T20:00:00Z\/GoogleMapsCompatible_Level7\/\{z\}\/\{y\}\/\{x\}\.png$/);
  });

  it('asks DescribeDomains over a window', () => {
    expect(domainsUrl(GOES_EAST, NOW - 3 * 3_600_000, NOW)).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/GOES-East_ABI_GeoColor/default/GoogleMapsCompatible_Level7/all/2026-10-15T17:40:00Z--2026-10-15T20:40:00Z.xml');
  });
});

describe('domainEnd', () => {
  it('reads the end of a run', () => {
    expect(domainEnd('<Domain>2026-10-15T17:40:00Z/2026-10-15T20:00:00Z/PT10M</Domain>')).toBe('2026-10-15T20:00:00Z');
  });

  it('takes the newest of several runs and instants, in any order', () => {
    const xml = '<Size>3</Size><Domain>2026-10-15T19:10:00Z,2026-10-15T17:40:00Z/2026-10-15T18:50:00Z/PT10M,2026-10-15T19:30:00Z</Domain>';
    expect(domainEnd(xml)).toBe('2026-10-15T19:30:00Z');
  });

  it('gives null for an empty or daily domain', () => {
    expect(domainEnd('<Domain></Domain>')).toBeNull();
    expect(domainEnd('<Domain>2026-10-01/2026-10-15/P1D</Domain>')).toBeNull();
    expect(domainEnd('not xml')).toBeNull();
  });
});

describe('latestFrame', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the frame before the newest GIBS lists, which may still be half published', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<Domain>2026-10-15T17:40:00Z/2026-10-15T20:00:00Z/PT10M</Domain>')));
    expect(await latestFrame(GOES_EAST, new AbortController().signal, NOW)).toBe('2026-10-15T19:50:00Z');
  });

  it('falls back to a guess when GIBS cannot be asked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await latestFrame(GOES_EAST, new AbortController().signal, NOW)).toBe('2026-10-15T19:50:00Z');
  });
});
