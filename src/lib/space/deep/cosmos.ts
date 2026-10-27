/**
 * TAKIP — the universe past the Local Group, built by tools/build-cosmos.mjs:
 * every 2MASS Redshift Survey galaxy (out to ~1 billion light-years), a sample
 * of SDSS galaxies and quasars out to redshift 6, and the edge of what can be
 * seen, the last-scattering surface of the cosmic microwave background.
 * Distances are comoving, flat ΛCDM (Planck 2018).
 */

import { LY_KM } from '../astro';
import { EQUATORIAL_TO_GALACTIC, mul, transpose } from '../frames';

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

/** 2MRS leaves out |b| < 5°, and |b| < 8° within 30° of the galactic centre (Huchra et al. 2012). */
export function zoneOfAvoidance(l: number): number {
  return l <= 30 || l >= 330 ? 8 : 5;
}

const TO_EQUATORIAL = transpose(EQUATORIAL_TO_GALACTIC);

/**
 * The Zone of Avoidance filled as Erdoğdu et al. (2006) filled it for 2MRS: each galaxy in the strip just past
 * the zone's edge is copied, at its own longitude and distance, to its mirror image across that edge, inside
 * the zone. Records as parseRecords gives them; an illustration of what is hidden, not real galaxies.
 */
export function fillZoneOfAvoidance(records: Float32Array): Float32Array {
  const out: number[] = [];
  for (let i = 0; i < records.length; i += RECORD_FLOATS) {
    const v: [number, number, number] = [records[i], records[i + 1], records[i + 2]];
    const r = Math.hypot(...v);
    if (!r) continue;
    const [gx, gy, gz] = mul(EQUATORIAL_TO_GALACTIC, v);
    const b = Math.asin(gz / r) * 180 / Math.PI;
    const l = ((Math.atan2(gy, gx) * 180 / Math.PI) + 360) % 360;
    const edge = zoneOfAvoidance(l);
    if (Math.abs(b) <= edge || Math.abs(b) >= 2 * edge) continue;
    const b2 = Math.sign(b) * (2 * edge - Math.abs(b)) * Math.PI / 180, l2 = l * Math.PI / 180;
    out.push(...mul(TO_EQUATORIAL, [r * Math.cos(b2) * Math.cos(l2), r * Math.cos(b2) * Math.sin(l2), r * Math.sin(b2)]), records[i + 3]);
  }
  return new Float32Array(out);
}

/** The structures worth a label: two sharing one position (the CfA2 Great Wall is anchored on Coma) keep the first. */
export function distinctStructures(s: CosmosMeta['structures']): CosmosMeta['structures'] {
  return s.filter((x, i) => !s.slice(0, i).some(y => Math.abs(y.ra - x.ra) < 0.01 && Math.abs(y.dec - x.dec) < 0.01 && Math.abs(y.mly - x.mly) < 1));
}
