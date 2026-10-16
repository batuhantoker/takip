import { describe, it, expect } from 'vitest';
import { SECTORS, cloudiness, composeGeoColor, daylightWeight, sectorColumns, visibleCloudiness, wmsLatestTime } from './geostationary';

describe('SECTORS', () => {
  it('cover the world once, west to east, without gaps', () => {
    expect(SECTORS[0].from).toBe(-180);
    expect(SECTORS.at(-1)!.to).toBe(180);
    for (let i = 1; i < SECTORS.length; i++) expect(SECTORS[i].from).toBe(SECTORS[i - 1].to);
  });
});

describe('sectorColumns', () => {
  it('gives the whole tile when the band contains it, and null when it misses', () => {
    expect(sectorColumns(0, 0, -180, 180)).toEqual([0, 256]);
    expect(sectorColumns(2, 3, -180, -106.2)).toBeNull();
  });

  it('splits a tile at a boundary so neighbouring bands share no column and leave none out', () => {
    for (const z of [0, 1, 2, 5, 7]) {
      for (let x = 0; x < 2 ** z; x++) {
        let covered = 0;
        let end = -1;
        for (const s of SECTORS) {
          const cols = sectorColumns(z, x, s.from, s.to);
          if (!cols) continue;
          if (end >= 0) expect(cols[0]).toBe(end);
          end = cols[1];
          covered += cols[1] - cols[0];
        }
        expect(covered).toBe(256);
      }
    }
  });

  it('cuts near the boundary longitude', () => {
    // At zoom 0 a column is 360/256 degrees; -37.6° falls in column 101.
    expect(sectorColumns(0, 0, -37.6, 70.35)![0]).toBe(101);
  });
});

describe('cloudiness', () => {
  it('reads warm ground as clear, high grey cloud as cloud, and the coloured cold tops as full cloud', () => {
    expect(cloudiness(100, 100, 100)).toBe(0);
    expect(cloudiness(200, 200, 200)).toBe(1);
    expect(cloudiness(125, 125, 125)).toBe(0);
    expect(cloudiness(160, 160, 160)).toBeCloseTo(0.5, 5);
    expect(cloudiness(0, 191, 220)).toBe(1);
  });
});

describe('daylightWeight', () => {
  it('is dark after civil dusk, light well above the horizon, and even at the horizon', () => {
    expect(daylightWeight(Math.sin(-10 * Math.PI / 180))).toBe(0);
    expect(daylightWeight(Math.sin(10 * Math.PI / 180))).toBe(1);
    expect(daylightWeight(0)).toBeCloseTo(0.5, 2);
  });
});

describe('visibleCloudiness', () => {
  it('sees cloud where the corrected reflectance beats the ground, and nothing at night', () => {
    expect(visibleCloudiness(230, 40, 1)).toBe(1);
    expect(visibleCloudiness(45, 40, 1)).toBe(0);
    expect(visibleCloudiness(230, 40, -0.2)).toBe(0);
  });

  it('divides out a low sun, so dawn cloud reads as cloud', () => {
    expect(visibleCloudiness(52, 10, 1)).toBeLessThan(0.5);
    expect(visibleCloudiness(52, 10, 0.2)).toBe(1);
  });
});

describe('composeGeoColor', () => {
  const px = (...rgba: number[]) => new Uint8ClampedArray(rgba);
  const day = px(10, 120, 20, 255);
  const night = px(5, 5, 30, 255);
  const dark = px(0, 0, 0, 0);
  const SUN = new Float32Array([1]);
  const MOON = new Float32Array([-1]);

  it('shows the ground where it is clear: day colours by day, city lights by night', () => {
    const clear = px(100, 100, 100, 255);
    expect([...composeGeoColor(clear, dark, day, night, SUN)]).toEqual([10, 120, 20, 255]);
    expect([...composeGeoColor(clear, dark, day, night, MOON)]).toEqual([5, 5, 30, 255]);
  });

  it('paints cloud over the ground, bright by day and dimmer by night', () => {
    const cloud = px(0, 191, 220, 255);
    const [r] = composeGeoColor(cloud, dark, day, night, SUN);
    const [rn] = composeGeoColor(cloud, dark, day, night, MOON);
    expect(r).toBeGreaterThan(230);
    expect(rn).toBeLessThan(r);
  });

  it('treats a transparent infrared pixel as clear', () => {
    expect([...composeGeoColor(px(255, 255, 255, 0), dark, day, night, SUN)]).toEqual([10, 120, 20, 255]);
  });

  it('adds the low cloud the visible band sees by day', () => {
    const [r] = composeGeoColor(px(100, 100, 100, 255), px(240, 240, 240, 255), day, night, SUN);
    expect(r).toBeGreaterThan(230);
  });
});

describe('wmsLatestTime', () => {
  it('takes the dimension default', () => {
    const xml = '<Dimension name="time" default="2026-10-15T20:30:00Z" units="ISO8601" nearestValue="1">2024-09-23T00:00:00.000Z/2026-10-15T20:30:00.000Z/PT10M</Dimension>';
    expect(wmsLatestTime(xml)).toBe('2026-10-15T20:30:00Z');
  });

  it('falls back to the end of the range, and to null without a time dimension', () => {
    expect(wmsLatestTime('<Dimension name="time" units="ISO8601">2024-09-23T00:00:00.000Z/2026-10-15T20:20:00.000Z/PT10M</Dimension>')).toBe('2026-10-15T20:20:00Z');
    expect(wmsLatestTime('<Layer></Layer>')).toBeNull();
  });
});
