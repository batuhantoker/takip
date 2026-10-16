import { describe, it, expect } from 'vitest';
import { applyLut, clearSky, clearSkyAt, matchLut, referenceFootprint, referenceHistogram, tileClearSky, tileHistogram } from './calibrate';
import { tileOf } from './testing';
import { PAD, PADDED, REF_HEIGHT, REF_WIDTH, TILE } from './tiles';

describe('referenceFootprint', () => {
  it('spans the whole reference at zoom 0', () => {
    expect(referenceFootprint(0, 0, 0)).toEqual({ x0: 0, x1: REF_WIDTH, y0: 0, y1: REF_HEIGHT });
  });

  it('puts tile 1/1/0 on the right half, above the equator', () => {
    expect(referenceFootprint(1, 1, 0)).toEqual({ x0: REF_WIDTH / 2, x1: REF_WIDTH, y0: 0, y1: REF_HEIGHT / 2 });
  });
});

describe('matching a tile to the reference', () => {
  const histogram = (values: number[]) => { const h = new Uint32Array(256); for (const v of values) h[v]++; return h; };
  const spread = (from: number, to: number, n = 2000) => Array.from({ length: n }, (_, i) => Math.round(from + ((to - from) * i) / (n - 1)));

  it('leaves a tile already on the reference scale as it is', () => {
    const h = histogram(spread(40, 200));
    const lut = matchLut(h, h)!;
    for (const v of [40, 100, 160, 200]) expect(Math.abs(lut[v] - v)).toBeLessThanOrEqual(1);
  });

  /* What NOAA does: the same patch, stretched to fill 0–255 in a tile of its own. */
  it('undoes a stretch', () => {
    const ref = spread(60, 180);
    const stretched = ref.map(v => Math.round(((v - 60) / 120) * 255));
    const lut = matchLut(histogram(stretched), histogram(ref))!;
    expect(Math.abs(lut[0] - 60)).toBeLessThanOrEqual(2);
    expect(Math.abs(lut[128] - 120)).toBeLessThanOrEqual(2);
    expect(Math.abs(lut[255] - 180)).toBeLessThanOrEqual(2);
  });

  it('never reverses the order of two greys', () => {
    const lut = matchLut(histogram(spread(0, 255)), histogram(spread(30, 90)))!;
    for (let v = 1; v < 256; v++) expect(lut[v]).toBeGreaterThanOrEqual(lut[v - 1]);
  });

  it('gives up on too few samples', () => {
    expect(matchLut(histogram([10, 20, 30]), histogram(spread(0, 255)))).toBeNull();
  });

  it('counts only the unpadded, covered part of a tile', () => {
    const rgba = tileOf((i, j) => (i < PAD || j < PAD || i >= PAD + TILE || j >= PAD + TILE ? 9 : 100));
    rgba[((PAD * PADDED) + PAD) * 4 + 3] = 0; // one pixel outside the satellites' view
    const h = tileHistogram(rgba);
    expect(h[100]).toBe(TILE * TILE - 1);
    expect(h[9]).toBe(0);
  });

  it('skips the black outside the satellites’ view in the reference', () => {
    const grey = new Uint8Array(REF_WIDTH * REF_HEIGHT).fill(120);
    grey[0] = 0;
    const h = referenceHistogram(grey, { x0: 0, x1: 4, y0: 0, y1: 1 });
    expect(h[120]).toBe(3);
    expect(h[0]).toBe(0);
  });

  it('remaps every channel of a tile', () => {
    const rgba = new Uint8ClampedArray([10, 10, 10, 255]);
    const lut = new Uint8Array(256); lut[10] = 77;
    applyLut(rgba, lut);
    expect([...rgba]).toEqual([77, 77, 77, 255]);
  });
});

describe('clear sky', () => {
  /** A reference whose greys run lo..hi across each row, one range north of the equator and another south. */
  const reference = (north: [number, number], south: [number, number]) => {
    const grey = new Uint8Array(REF_WIDTH * REF_HEIGHT);
    for (let j = 0; j < REF_HEIGHT; j++) {
      const [lo, hi] = j < REF_HEIGHT / 2 ? north : south;
      for (let i = 0; i < REF_WIDTH; i++) grey[j * REF_WIDTH + i] = lo + ((hi - lo) * (i % 128)) / 127;
    }
    return grey;
  };

  it('takes the warm end of each cell as clear ground', () => {
    const sky = clearSky(reference([60, 200], [130, 230]));
    expect(clearSkyAt(sky, 1000, 100)).toBeCloseTo(60 + 0.1 * 140, -1);
    expect(clearSkyAt(sky, 1000, REF_HEIGHT - 100)).toBeCloseTo(130 + 0.1 * 100, -1);
  });

  it('lends bands outside the satellites\u2019 view the nearest one with data', () => {
    const grey = reference([60, 200], [60, 200]);
    grey.fill(0, 0, REF_WIDTH * 100); // the top hundred rows: nothing seen
    const sky = clearSky(grey);
    expect(clearSkyAt(sky, 1000, 0)).toBeCloseTo(clearSkyAt(sky, 1000, 200), 0);
  });

  /* A sector the satellites see as falsely cold — the Arctic edge-on — may read
     colder than the rest of its latitude, but only so far, or a sector under
     one great storm would count the storm as clear. */
  it('lets one region read colder than its latitude, within limits', () => {
    const grey = reference([60, 200], [60, 200]);
    for (let j = 0; j < REF_HEIGHT; j++) for (let i = 0; i < 128; i++) grey[j * REF_WIDTH + i] = 200;
    const sky = clearSky(grey);
    const band = clearSkyAt(sky, 1000, 300);
    expect(clearSkyAt(sky, 64, 300)).toBeGreaterThan(band + 20);
    expect(clearSkyAt(sky, 64, 300)).toBeLessThanOrEqual(band + 30.5);
  });

  it('wraps around in longitude, so the date line has no seam', () => {
    const sky = clearSky(reference([60, 200], [60, 200]));
    expect(clearSkyAt(sky, 0, 300)).toBeCloseTo(clearSkyAt(sky, REF_WIDTH, 300), 5);
  });

  it('gives every pixel of a tile its own clear sky', () => {
    const sky = clearSky(reference([60, 200], [130, 230]));
    const tile = tileClearSky(0, 0, 0, sky);
    expect(tile.length).toBe(PADDED * PADDED);
    expect(tile[(PADDED - 1) * PADDED + 100]).toBeGreaterThan(tile[100]);
  });
});
