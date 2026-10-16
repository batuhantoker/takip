import { PADDED } from './tiles';

/** A padded tile, every pixel the given grey, opaque. */
export function tileOf(grey: (i: number, j: number) => number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(PADDED * PADDED * 4);
  for (let j = 0; j < PADDED; j++) {
    for (let i = 0; i < PADDED; i++) {
      const k = (j * PADDED + i) * 4;
      rgba[k] = rgba[k + 1] = rgba[k + 2] = grey(i, j);
      rgba[k + 3] = 255;
    }
  }
  return rgba;
}
