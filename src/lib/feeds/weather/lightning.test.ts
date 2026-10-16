import { describe, expect, it } from 'vitest';
import { lightningFrameAt, lightningTiles, parseLightningTimes } from './lightning';

// Trimmed from nowCOAST's lightning_detection GetCapabilities, 2026-10-16.
const XML = `<Layer><Name>WMS</Name><Layer queryable="1"><Name>ldn_lightning_strike_density</Name>
<Dimension name="time" default="2026-10-16T05:15:00Z" units="ISO8601" nearestValue="1">2026-10-16T04:45:00.000Z,2026-10-16T05:00:00.000Z,2026-10-16T05:15:00.000Z</Dimension>
<Style><Name>lightning_density</Name></Style></Layer></Layer>`;

describe('parseLightningTimes', () => {
  it('reads the time dimension oldest first', () => {
    expect(parseLightningTimes(XML).map(t => new Date(t).toISOString())).toEqual([
      '2026-10-16T04:45:00.000Z', '2026-10-16T05:00:00.000Z', '2026-10-16T05:15:00.000Z',
    ]);
    expect(parseLightningTimes('<Layer/>')).toEqual([]);
  });
});

describe('lightningFrameAt', () => {
  const times = parseLightningTimes(XML);
  it('picks the newest frame at or before the time, within its 15 minutes', () => {
    expect(lightningFrameAt(times, Date.parse('2026-10-16T05:07:00Z'))).toBe(Date.parse('2026-10-16T05:00:00Z'));
    expect(lightningFrameAt(times, Date.parse('2026-10-16T05:29:00Z'))).toBe(Date.parse('2026-10-16T05:15:00Z'));
    expect(lightningFrameAt(times, Date.parse('2026-10-16T05:45:00Z'))).toBeNull();
    expect(lightningFrameAt(times, Date.parse('2026-10-16T04:00:00Z'))).toBeNull();
  });
});

describe('lightningTiles', () => {
  it('asks the WMS for one frame in Web Mercator, leaving the box to MapLibre', () => {
    const url = lightningTiles(Date.parse('2026-10-16T05:15:00Z'));
    expect(url).toContain('layers=ldn_lightning_strike_density');
    expect(url).toContain('time=2026-10-16T05%3A15%3A00.000Z');
    expect(url.endsWith('&bbox={bbox-epsg-3857}')).toBe(true);
  });
});
