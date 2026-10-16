import { describe, it, expect } from 'vitest';
import { TROPICAL_CLEAR } from './calibrate';
import { renderClouds } from './render';
import { tileOf } from './testing';
import { PAD, PADDED } from './tiles';

const TIME = '2026-09-22T12:00:00Z'; // equinox noon: the sun is over 0°, 0°
const NOON = Date.parse(TIME);

describe('renderClouds', () => {
  // Tile 4/3 at zoom 3 is in full daylight at NOON; tile 0/3 is in darkness.
  const day = { z: 3, x: 4, y: 3, time: NOON };
  const night = { z: 3, x: 0, y: 3, time: NOON };
  /** A pixel of the output by its position inside the tile, past the margin. */
  const at = (i: number, j: number) => ((j + PAD) * PADDED + i + PAD);
  const px = (rgba: Uint8ClampedArray, i: number, j: number) => Array.from(rgba.subarray(at(i, j) * 4, at(i, j) * 4 + 4));

  it('sends the margin out with the tile', () => {
    const { rgba, height } = renderClouds({ ir: tileOf(() => 230), vis: null, ...night });
    expect(rgba.length).toBe(PADDED * PADDED * 4);
    expect(height.length).toBe(PADDED * PADDED);
  });

  it('draws clear, warm ground as nothing at all', () => {
    const { rgba } = renderClouds({ ir: tileOf(() => 70), vis: null, ...night });
    expect(rgba.every((v, k) => k % 4 !== 3 || v === 0)).toBe(true);
  });

  it('draws a deck of cold cloud opaque, and evenly lit when its top is flat', () => {
    const { rgba } = renderClouds({ ir: tileOf(() => 230), vis: null, ...night });
    const [r, g, b, a] = px(rgba, 128, 128);
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(200);
    expect(px(rgba, 10, 10)).toEqual([r, g, b, a]);
  });

  it('lifts cold, high cloud above warm, low cloud', () => {
    const high = renderClouds({ ir: tileOf(() => 240), vis: null, ...night }).height[at(128, 128)];
    const low = renderClouds({ ir: tileOf(() => 120), vis: null, ...night }).height[at(128, 128)];
    expect(high).toBeGreaterThan(200);
    expect(low).toBeLessThan(40);
  });

  /* One cold pixel used to lift one vertex into a spike; the lift is smoothed. */
  it('raises a lone cold pixel as a low dome, not a spike', () => {
    const centre = PAD + 128;
    const { height } = renderClouds({ ir: tileOf((i, j) => (i === centre && j === centre ? 250 : 70)), vis: null, ...night });
    expect(height[at(128, 128)]).toBeLessThan(40);
  });

  /* A ridge whose crest runs north-east to south-west through the middle of the
     tile. Rows count southward, so its north-west flank is up and to the left. */
  it('lights the slope facing north-west and shades the one facing away', () => {
    const crest = 2 * (PAD + 128);
    const ridge = (i: number, j: number) => 255 - Math.min(150, Math.abs(i + j - crest) * 3);
    const { rgba } = renderClouds({ ir: tileOf(ridge), vis: null, ...night });
    expect(px(rgba, 118, 118)[0]).toBeGreaterThan(px(rgba, 138, 138)[0] + 20);
  });

  /* The sea off Greenland reads as cold as tropical cloud; against its own
     latitude's clear sky it is clear. This is what veiled the far north. */
  it('judges cloud against the clear sky of its own latitude', () => {
    const ir = tileOf(() => 140);
    const polar = new Float32Array(PADDED * PADDED).fill(130);
    expect(px(renderClouds({ ir, clear: polar, vis: null, ...night }).rgba, 128, 128)[3]).toBe(0);
    expect(px(renderClouds({ ir, clear: new Float32Array(PADDED * PADDED).fill(TROPICAL_CLEAR), vis: null, ...night }).rgba, 128, 128)[3]).toBeGreaterThan(40);
  });

  /* Past about 73° the satellites see the Arctic edge-on, and it came out as a flat white sheet. */
  it('fades cloud out toward the edge of the satellites’ view', () => {
    // Tile 4/1 at zoom 3 runs from about 79° down to 66.5° north.
    const { rgba } = renderClouds({ ir: tileOf(() => 240), vis: null, z: 3, x: 4, y: 1, time: NOON });
    expect(px(rgba, 128, 5)[3]).toBe(0);
    expect(px(rgba, 128, 250)[3]).toBeGreaterThan(200);
  });

  /* The Sahara is as bright as cloud in visible light, but far too hot to be cloud. */
  it('leaves hot, bright desert clear by day', () => {
    const { rgba } = renderClouds({ ir: tileOf(() => 30), vis: tileOf(() => 200), ...day });
    expect(px(rgba, 128, 128)[3]).toBe(0);
  });

  /* Low marine cloud is barely colder than the sea, so infrared misses it; daylight shows it. */
  it('shows low cloud that only visible light can see, but only by day', () => {
    const lowCloud = { ir: tileOf(() => 85), vis: tileOf(() => 190) };
    expect(px(renderClouds({ ...lowCloud, ...day }).rgba, 128, 128)[3]).toBeGreaterThan(200);
    expect(px(renderClouds({ ...lowCloud, vis: null, ...night }).rgba, 128, 128)[3]).toBe(0);
  });
});
