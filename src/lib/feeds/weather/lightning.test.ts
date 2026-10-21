import { describe, expect, it } from 'vitest';
import { LIGHTNING_SOURCES, lightningCovers, lightningFrameAt, lightningImage, lightningTiles, parseLightningTimes } from './lightning';

const [NOWCOAST, MTG] = LIGHTNING_SOURCES;

// Trimmed from nowCOAST's lightning_detection GetCapabilities, 2026-10-16.
const XML = `<Layer><Name>WMS</Name><Layer queryable="1"><Name>ldn_lightning_strike_density</Name>
<Dimension name="time" default="2026-10-16T05:15:00Z" units="ISO8601" nearestValue="1">2026-10-16T04:45:00.000Z,2026-10-16T05:00:00.000Z,2026-10-16T05:15:00.000Z</Dimension>
<Style><Name>lightning_density</Name></Style></Layer></Layer>`;

// Trimmed from EUMETView's mtg_fd/li_afa GetCapabilities, 2026-10-21.
const MTG_XML = `<Layer queryable="1" opaque="0"><Name>li_afa</Name>
<Dimension name="time" default="2026-10-21T19:35:00Z" units="ISO8601" nearestValue="1">2025-05-30T15:00:00.000Z/2026-10-21T19:35:00.000Z/PT5M</Dimension></Layer>`;

describe('parseLightningTimes', () => {
  it('reads a listed time dimension oldest first', () => {
    expect(parseLightningTimes(XML, NOWCOAST.layer).map(t => new Date(t).toISOString())).toEqual([
      '2026-10-16T04:45:00.000Z', '2026-10-16T05:00:00.000Z', '2026-10-16T05:15:00.000Z',
    ]);
    expect(parseLightningTimes('<Layer/>', NOWCOAST.layer)).toEqual([]);
  });

  it('keeps the last six hours of a period', () => {
    const times = parseLightningTimes(MTG_XML, MTG.layer);
    expect(times).toHaveLength(73);
    expect(new Date(times[0]).toISOString()).toBe('2026-10-21T13:35:00.000Z');
    expect(new Date(times.at(-1)!).toISOString()).toBe('2026-10-21T19:35:00.000Z');
  });
});

describe('lightningFrameAt', () => {
  const times = parseLightningTimes(XML, NOWCOAST.layer);
  it('picks the newest frame at or before the time, within its span', () => {
    expect(lightningFrameAt(times, Date.parse('2026-10-16T05:07:00Z'), NOWCOAST.spanMs)).toBe(Date.parse('2026-10-16T05:00:00Z'));
    expect(lightningFrameAt(times, Date.parse('2026-10-16T05:29:00Z'), NOWCOAST.spanMs)).toBe(Date.parse('2026-10-16T05:15:00Z'));
    expect(lightningFrameAt(times, Date.parse('2026-10-16T05:45:00Z'), NOWCOAST.spanMs)).toBeNull();
    expect(lightningFrameAt(times, Date.parse('2026-10-16T05:29:00Z'), MTG.spanMs)).toBeNull();
    expect(lightningFrameAt(times, Date.parse('2026-10-16T04:00:00Z'), NOWCOAST.spanMs)).toBeNull();
  });
});

describe('lightningTiles', () => {
  it('asks the WMS for one frame in Web Mercator, leaving the box to MapLibre', () => {
    const url = lightningTiles(NOWCOAST, Date.parse('2026-10-16T05:15:00Z'));
    expect(url).toContain('layers=ldn_lightning_strike_density');
    expect(url).toContain('time=2026-10-16T05%3A15%3A00.000Z');
    expect(url.endsWith('&bbox={bbox-epsg-3857}')).toBe(true);
  });

  it('asks for a box in degrees when the pixels are read', () => {
    const url = lightningImage(MTG, Date.parse('2026-10-21T19:35:00Z'), [28, 40, 30, 42], 200, 200);
    expect(url).toContain('layers=li_afa');
    expect(url).toContain('crs=CRS%3A84');
    expect(url.endsWith('&bbox=28,40,30,42')).toBe(true);
  });
});

describe('lightningCovers', () => {
  it('meets at the prime meridian and leaves 70° E to 110° E out', () => {
    expect(lightningCovers([-95.4, 29.8])).toBe(true); // Houston
    expect(lightningCovers([-3.7, 40.4])).toBe(true); // Madrid, NOAA's side
    expect(lightningCovers([29, 41])).toBe(true); // Istanbul
    expect(lightningCovers([37.6, 55.8])).toBe(true); // Moscow
    expect(lightningCovers([15.3, -4.3])).toBe(true); // Kinshasa
    expect(MTG.covers([-58.4, -34.6])).toBe(true); // Buenos Aires, south of NOAA's reach
    expect(lightningCovers([151.2, -33.9])).toBe(false); // Sydney
    expect(lightningCovers([139.7, 35.7])).toBe(true); // Tokyo
    expect(lightningCovers([77.2, 28.6])).toBe(false); // Delhi
    expect(lightningCovers([100.5, 13.8])).toBe(false); // Bangkok
    expect(NOWCOAST.covers([29, 41]) || MTG.covers([-3.7, 40.4])).toBe(false);
  });
});
