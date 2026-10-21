import { describe, expect, it } from 'vitest';
import { degreeBox, hitFrom, mercatorTile, nearestDrawn, throttle, tileAt, type Pixels } from './pixels';

function blank(width: number, height: number): Pixels {
  return { data: new Uint8Array(width * height * 4), width, height };
}
const draw = (px: Pixels, x: number, y: number) => { px.data[(y * px.width + x) * 4 + 3] = 255; };

describe('hitFrom', () => {
  it('measures kilometres and the compass bearing', () => {
    expect(hitFrom([0, 0], [0, 1])).toEqual({ km: 111.32, bearing: 0 });
    const east = hitFrom([29, 41], [29.5, 41]);
    expect(east.km).toBeCloseTo(42, 0);
    expect(east.bearing).toBeCloseTo(90, 5);
    expect(hitFrom([0, 0], [-0.1, -0.1]).bearing).toBeCloseTo(225, 3);
  });
});

describe('nearestDrawn', () => {
  const box: [number, number, number, number] = [28, 40, 30, 42];
  const lngLat = degreeBox(box, 200, 200);

  it('finds the closest drawn pixel within the radius', () => {
    const px = blank(200, 200);
    draw(px, 150, 100); // 0.5° east of the middle
    draw(px, 100, 130); // 0.3° south
    // The middle pixel's centre.
    const hit = nearestDrawn(px, [29.005, 40.995], 50, lngLat);
    expect(hit?.km).toBe(33);
    expect(hit?.bearing).toBe(180);
  });

  it('is null when nothing is drawn within the radius', () => {
    const px = blank(200, 200);
    draw(px, 199, 0);
    expect(nearestDrawn(px, [29, 41], 50, lngLat)).toBeNull();
    expect(nearestDrawn(blank(10, 10), [29, 41], 50, lngLat)).toBeNull();
  });
});

describe('tiles', () => {
  it('places a point in its Web Mercator tile and back', () => {
    const [fx, fy] = tileAt([-0.13, 51.5], 7);
    expect([Math.floor(fx), Math.floor(fy)]).toEqual([63, 42]);
    const [lng, lat] = mercatorTile(7, 63, 42, 256)((fx % 1) * 256, (fy % 1) * 256);
    expect(lng).toBeCloseTo(-0.13, 6);
    expect(lat).toBeCloseTo(51.5, 6);
  });
});

describe('throttle', () => {
  it('spaces requests and refuses one whose turn is too far off', async () => {
    const wait = throttle(1000, 2);
    await wait();
    await wait();
    await wait();
    const far = throttle(1, 500);
    await far();
    await expect(far()).rejects.toThrow('busy');
  });
});
