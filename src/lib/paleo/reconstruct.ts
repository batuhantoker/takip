import { createRotations, matrix, toVec, type PlatesFile, type Rotations, type Vec } from './plates';

/*
 * Today's coastlines and continental crust carried back on their plates. Each ring's points are kept as
 * unit vectors, so moving to a new age is one 3×3 rotation per plate and a pass over the points.
 */

type Shape = { plate: number; from: number; to: number; rings: Float64Array[]; cap: { c: Vec; min: number } };
export type PaleoKind = 'crust' | 'land';
/** A place on today's map, fixed to the plate under it. */
export type Pin = { plate: number; from: number; v: Vec };

export type PlateModel = {
  meta: PlatesFile['model'];
  rotations: Rotations;
  /** Crust and land `ma` million years ago, one collection told apart by `k`. */
  at(ma: number): GeoJSON.FeatureCollection;
  /** The plate under a place today, by the oldest coastline (else crust) there; null at sea. */
  pin(lon: number, lat: number): Pin | null;
  /** Where the pinned place was; null before its ground existed. */
  where(pin: Pin, ma: number): [number, number] | null;
};

const RAD = Math.PI / 180;
const wrap = (d: number) => d - 360 * Math.round(d / 360);

function shapes(rows: PlatesFile['coast']): Shape[] {
  return rows.map(([plate, from, to, ...flats]) => {
    const rings = (flats as number[][]).map(flat => {
      const xyz = new Float64Array((flat.length / 2) * 3);
      for (let i = 0; i < flat.length / 2; i++) xyz.set(toVec(flat[2 * i], flat[2 * i + 1]), 3 * i);
      return xyz;
    });
    return { plate: plate as number, from: from as number, to: to as number, rings, cap: capOf(rings[0]) };
  });
}

/** A cap round the ring's points, so most rings are ruled out of a point test with one dot product. */
function capOf(xyz: Float64Array) {
  const c: Vec = [0, 0, 0];
  for (let i = 0; i < xyz.length; i += 3) for (let k = 0; k < 3; k++) c[k] += xyz[i + k];
  const n = Math.hypot(...c) || 1;
  for (let k = 0; k < 3; k++) c[k] /= n;
  let min = 1;
  for (let i = 0; i < xyz.length; i += 3) min = Math.min(min, c[0] * xyz[i] + c[1] * xyz[i + 1] + c[2] * xyz[i + 2]);
  return { c, min };
}

/** Whether the ring winds round `p`, by the turn of its points' bearings seen from `p`. */
export function ringContains(xyz: Float64Array, p: Vec) {
  const h = Math.hypot(p[0], p[1]);
  const east: Vec = h > 1e-9 ? [-p[1] / h, p[0] / h, 0] : [0, 1, 0];
  const north: Vec = [p[1] * east[2] - p[2] * east[1], p[2] * east[0] - p[0] * east[2], p[0] * east[1] - p[1] * east[0]];
  const bearing = (i: number) => Math.atan2(
    xyz[i] * east[0] + xyz[i + 1] * east[1] + xyz[i + 2] * east[2],
    xyz[i] * north[0] + xyz[i + 1] * north[1] + xyz[i + 2] * north[2],
  ) / RAD;
  let turn = 0;
  let prev = bearing(xyz.length - 3);
  for (let i = 0; i < xyz.length; i += 3) {
    const b = bearing(i);
    turn += wrap(b - prev);
    prev = b;
  }
  return Math.abs(turn) > 180;
}


function signedArea(ring: number[][]) {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return s;
}

/** Nearer a pole than this, a point's longitude says nothing. */
const POLAR = 89.95;

/**
 * A rotated ring as a closed lon/lat ring the map can fill: longitudes run on past ±180 rather than jump,
 * a point on a pole becomes a stretch along it, and a ring that goes round a pole is closed over it.
 * Empty when every point is on a pole.
 */
export function placeRing(xyz: Float64Array, m: number[]): number[][] {
  const n = xyz.length / 3;
  const lons = new Float64Array(n);
  const lats = new Float64Array(n);
  let start = -1;
  for (let i = 0; i < n; i++) {
    const x = xyz[3 * i];
    const y = xyz[3 * i + 1];
    const z = xyz[3 * i + 2];
    lons[i] = Math.atan2(m[3] * x + m[4] * y + m[5] * z, m[0] * x + m[1] * y + m[2] * z) / RAD;
    lats[i] = Math.asin(Math.max(-1, Math.min(1, m[6] * x + m[7] * y + m[8] * z))) / RAD;
    if (start < 0 && Math.abs(lats[i]) < POLAR) start = i;
  }
  if (start < 0) return [];

  const out: number[][] = [];
  let prev = lons[start];
  let polar: number | null = null;
  let latSum = 0;
  let end = prev;
  for (let k = 0; k <= n; k++) {
    const i = (start + k) % n;
    if (k < n && Math.abs(lats[i]) >= POLAR) {
      polar ??= lats[i];
      continue;
    }
    const lon = k === 0 ? prev : prev + wrap(lons[i] - prev);
    if (polar !== null) out.push([prev, polar], [lon, polar]);
    polar = null;
    if (k === n) {
      end = lon;
      break;
    }
    out.push([lon, lats[i]]);
    latSum += lats[i];
    prev = lon;
  }
  const [lon0, lat0] = out[0];
  if (Math.abs(end - lon0) > 180) {
    // The pole on the ring's side is the one inside: no continent here is bigger than a hemisphere.
    const pole = latSum < 0 ? -90 : 90;
    out.push([end, lat0], [end, pole], [lon0, pole]);
  }
  out.push([lon0, lat0]);
  return out;
}

/** Shifted a whole turn so it starts within the first world: the map copies one world either side, no further. */
function shiftIntoWorld(rings: number[][][]) {
  let min = Infinity;
  for (const p of rings[0]) min = Math.min(min, p[0]);
  const shift = -360 * Math.floor((min + 180) / 360);
  if (shift) for (const ring of rings) for (const p of ring) p[0] += shift;
}

export function createPlateModel(file: PlatesFile): PlateModel {
  const rotations = createRotations(file.rotations);
  const coast = shapes(file.coast);
  const crust = shapes(file.crust);
  const layers: [PaleoKind, Shape[]][] = [['crust', crust], ['land', coast]];

  return {
    meta: file.model,
    rotations,
    at(ma) {
      const features: GeoJSON.Feature[] = [];
      for (const [k, list] of layers) {
        for (const s of list) {
          if (ma > s.from || ma < s.to) continue;
          const q = rotations.at(s.plate, ma);
          if (!q) continue;
          const m = matrix(q);
          const rings = s.rings.map(r => placeRing(r, m)).filter(r => r.length >= 4);
          if (!rings.length) continue;
          shiftIntoWorld(rings);
          // Holes wind against their ring, or the fill reads them as more land.
          const outer = Math.sign(signedArea(rings[0]));
          for (const hole of rings.slice(1)) if (Math.sign(signedArea(hole)) === outer) hole.reverse();
          features.push({ type: 'Feature', properties: { k }, geometry: { type: 'Polygon', coordinates: rings } });
        }
      }
      return { type: 'FeatureCollection', features };
    },
    pin(lon, lat) {
      const v = toVec(lon, lat);
      for (const list of [coast, crust]) {
        let best: Shape | null = null;
        for (const s of list) {
          if (s.to > 0 || (best && s.from <= best.from)) continue;
          const { c, min } = s.cap;
          if (c[0] * v[0] + c[1] * v[1] + c[2] * v[2] < min - 1e-9 || !ringContains(s.rings[0], v)) continue;
          best = s;
        }
        if (best) return { plate: best.plate, from: best.from, v };
      }
      return null;
    },
    where(pin, ma) {
      if (ma > pin.from) return null;
      const q = rotations.at(pin.plate, ma);
      if (!q) return null;
      const m = matrix(q);
      const [x, y, z] = pin.v;
      return [
        Math.atan2(m[3] * x + m[4] * y + m[5] * z, m[0] * x + m[1] * y + m[2] * z) / RAD,
        Math.asin(Math.max(-1, Math.min(1, m[6] * x + m[7] * y + m[8] * z))) / RAD,
      ];
    },
  };
}

let loading: Promise<PlateModel> | null = null;

/** Fetched once, the first time deep time opens. */
export function loadPlateModel(): Promise<PlateModel> {
  loading ??= fetch('/data/paleo/plates.json')
    .then(r => {
      if (!r.ok) throw new Error(`Plate model: HTTP ${r.status}`);
      return r.json() as Promise<PlatesFile>;
    })
    .then(createPlateModel)
    .catch(e => {
      loading = null;
      throw e;
    });
  return loading;
}
