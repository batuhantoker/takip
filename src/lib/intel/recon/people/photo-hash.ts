/**
 * A 64-bit difference hash of a profile picture. The same photo re-encoded
 * and resized by two platforms lands within a few bits; different photos sit
 * around 32 apart.
 */

/** dHash over a 9×8 greyscale grid: each bit says whether a pixel is brighter than its right neighbour. */
export function dhashFromPixels(px: Uint8Array | Buffer, width = 9, height = 8): string | null {
  if (px.length < width * height) return null;
  let sum = 0;
  for (let i = 0; i < width * height; i++) sum += px[i];
  const mean = sum / (width * height);
  let variance = 0;
  for (let i = 0; i < width * height; i++) variance += (px[i] - mean) ** 2;
  // A flat image (a blank or single-colour placeholder) would match every other flat image.
  if (Math.sqrt(variance / (width * height)) < 6) return null;

  let hex = '';
  for (let y = 0; y < height; y++) {
    let byte = 0;
    for (let x = 0; x < width - 1; x++) byte = (byte << 1) | (px[y * width + x] > px[y * width + x + 1] ? 1 : 0);
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i += 2) {
    let x = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

/** Bits apart at or under which two pictures count as the same photo. */
export const SAME_PHOTO = 6;
