/**
 * TAKIP — the universe past the Local Group, built by tools/build-cosmos.mjs:
 * every 2MASS Redshift Survey galaxy (out to ~1 billion light-years), a sample
 * of SDSS galaxies and quasars out to redshift 6, and the edge of what can be
 * seen, the last-scattering surface of the cosmic microwave background.
 * Distances are comoving, flat ΛCDM (Planck 2018).
 */

import { LY_KM } from './astro';

export const MLY_KM = 1e6 * LY_KM;

export interface CosmosMeta {
  generated: string;
  cosmology: string;
  local: { file: string; count: number; source: string; credit: string };
  deep: { file: string; count: number; galaxies: number; quasars: number; source: string; credit: string };
  structures: { name: string; ra: number; dec: number; z: number; mly: number }[];
  horizon: { cmbMly: number; particleMly: number };
}

/** Each record is four little-endian floats: x, y, z (Mly, J2000 equatorial), then a value per catalogue. */
export const RECORD_FLOATS = 4;

export function parseRecords(buf: ArrayBuffer): Float32Array {
  return new Float32Array(buf, 0, Math.floor(buf.byteLength / 4 / RECORD_FLOATS) * RECORD_FLOATS);
}

/** The structures worth a label: two sharing one position (the CfA2 Great Wall is anchored on Coma) keep the first. */
export function distinctStructures(s: CosmosMeta['structures']): CosmosMeta['structures'] {
  return s.filter((x, i) => !s.slice(0, i).some(y => Math.abs(y.ra - x.ra) < 0.01 && Math.abs(y.dec - x.dec) < 0.01 && Math.abs(y.mly - x.mly) < 1));
}
