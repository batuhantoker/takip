import { describe, it, expect } from 'vitest';
import { PAD, PADDED, REF_HEIGHT, REF_WIDTH, TILE, frameTime, isCloudTile, referenceUrl, tileBbox, tileUrl } from './tiles';

const HALF = 20037508.342789244;
const TIME = '2026-09-22T12:00:00Z'; // equinox noon: the sun is over 0°, 0°

describe('tileBbox', () => {
  it('covers the whole world at zoom 0', () => {
    expect(tileBbox(0, 0, 0)).toEqual([-HALF, -HALF, HALF, HALF]);
  });

  // y counts down from the north edge, as in every XYZ scheme.
  it('puts tile 1/0/0 in the north-west quarter', () => {
    expect(tileBbox(1, 0, 0)).toEqual([-HALF, 0, 0, HALF]);
    expect(tileBbox(1, 1, 1)).toEqual([0, -HALF, HALF, 0]);
  });

  it('grows by whole pixels of padding', () => {
    const pixel = (2 * HALF) / TILE;
    expect(tileBbox(0, 0, 0, 2)).toEqual([-HALF - 2 * pixel, -HALF - 2 * pixel, HALF + 2 * pixel, HALF + 2 * pixel]);
  });
});

describe('frameTime', () => {
  it('asks for the current hour once NOAA has had time to publish it', () => {
    expect(frameTime(Date.parse('2026-09-30T23:25:10Z'))).toBe('2026-09-30T23:00:00Z');
  });

  /* Just after the hour the new frame isn't up yet. Asking for it would snap
     to last hour's picture and cache it under this hour's URL. */
  it('stays on the previous hour just after the turn', () => {
    expect(frameTime(Date.parse('2026-10-01T00:05:00Z'))).toBe('2026-09-30T23:00:00Z');
  });
});

describe('isCloudTile', () => {
  const frame = '2026-09-30T23:00:00Z';

  it('accepts a real tile of an hourly frame', () => {
    expect(isCloudTile({ z: 3, x: 4, y: 2, time: frame })).toBe(true);
  });

  it('rejects a tile outside its zoom level', () => {
    expect(isCloudTile({ z: 2, x: 4, y: 0, time: frame })).toBe(false);
  });

  it('rejects zooms past the imagery', () => {
    expect(isCloudTile({ z: 9, x: 0, y: 0, time: frame })).toBe(false);
  });

  it('rejects a time that is not on the hour', () => {
    expect(isCloudTile({ z: 1, x: 0, y: 0, time: '2026-09-30T23:15:00Z' })).toBe(false);
    expect(isCloudTile({ z: 1, x: 0, y: 0, time: 'now' })).toBe(false);
  });
});

describe('NOAA requests', () => {
  it('asks for a tile with its padding, in the band wanted', () => {
    const u = new URL(tileUrl('vis', { z: 1, x: 0, y: 0, time: TIME }));
    expect(u.hostname).toBe('nowcoast.noaa.gov');
    expect(u.searchParams.get('LAYERS')).toBe('global_visible_imagery_mosaic');
    expect(u.searchParams.get('BBOX')).toBe(tileBbox(1, 0, 0, PAD).join(','));
    expect(u.searchParams.get('WIDTH')).toBe(String(PADDED));
    expect(u.searchParams.get('TIME')).toBe(TIME);
  });

  it('asks for the reference as one image of the whole world', () => {
    const u = new URL(referenceUrl('ir', TIME));
    expect(u.searchParams.get('LAYERS')).toBe('global_longwave_imagery_mosaic');
    expect(u.searchParams.get('WIDTH')).toBe(String(REF_WIDTH));
    expect(u.searchParams.get('HEIGHT')).toBe(String(REF_HEIGHT));
    const [minx, , maxx] = u.searchParams.get('BBOX')!.split(',').map(Number);
    expect([minx, maxx]).toEqual([-HALF, HALF]);
  });
});
