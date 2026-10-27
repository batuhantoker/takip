/**
 * TAKIP — the Milky Way around the Sun as Gaia DR3 points (public/data/sky/galactic-stars.bin, built by
 * tools/build-galactic-stars.mjs): a random sample of well-measured stars out to a few thousand light-years and
 * the luminous stars that trace the disc to about 22,000. They fill the space between the nearby stars and the
 * galaxy's disc.
 */

export interface GalacticStars {
  count: number;
  /** x, y, z light-years from the Sun per star, J2000 equatorial. */
  positions: Float64Array;
  /** Absolute V magnitude, from Gaia G and BP−RP, without extinction. */
  absMag: Float32Array;
  bv: Float32Array;
}

const MAGIC = 'GSTR';
const RECORD_BYTES = 8;

/** B−V from Gaia BP−RP: near enough for a colour on a point, clamped where reddened giants run off the scale. */
export function bvFromBpRp(c: number): number {
  return Math.max(-0.3, Math.min(1.8, 0.85 * c - 0.05));
}

export function parseGalacticStars(buf: ArrayBuffer): GalacticStars {
  const view = new DataView(buf);
  const magic = String.fromCharCode(...new Uint8Array(buf, 0, 4));
  if (magic !== MAGIC) throw new Error(`galactic stars: bad magic ${magic}`);
  const sections = view.getUint32(4, true);
  const parts: { at: number; count: number; lyPerUnit: number }[] = [];
  let at = 8, count = 0;
  for (let s = 0; s < sections; s++) {
    const n = view.getUint32(at, true);
    parts.push({ at: at + 8, count: n, lyPerUnit: view.getFloat32(at + 4, true) });
    at += 8 + n * RECORD_BYTES;
    count += n;
  }
  if (at !== buf.byteLength) throw new Error(`galactic stars: ${buf.byteLength} bytes, expected ${at}`);
  const positions = new Float64Array(count * 3), absMag = new Float32Array(count), bv = new Float32Array(count);
  let i = 0;
  for (const p of parts) {
    for (let k = 0; k < p.count; k++, i++) {
      const r = p.at + k * RECORD_BYTES;
      positions[i * 3] = view.getInt16(r, true) * p.lyPerUnit;
      positions[i * 3 + 1] = view.getInt16(r + 2, true) * p.lyPerUnit;
      positions[i * 3 + 2] = view.getInt16(r + 4, true) * p.lyPerUnit;
      absMag[i] = view.getUint8(r + 6) / 8 - 8;
      bv[i] = bvFromBpRp(view.getUint8(r + 7) / 50 - 0.5);
    }
  }
  return { count, positions, absMag, bv };
}
