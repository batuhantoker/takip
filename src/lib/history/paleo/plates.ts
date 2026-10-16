/*
 * The plate model deep time turns the continents with (public/data/paleo/plates.json, built by
 * tools/build-paleo-plates.mjs). Each plate's total poles give its rotation against another plate at
 * listed ages; between ages the rotation is interpolated, and chained up to plate 0 it places the plate
 * on today's globe frame. That is how GPlates reconstructs, so the motion here matches its snapshots.
 */

/** A ring as flat lon,lat pairs, not closed. */
type FlatRing = number[];

export type PlatesFile = {
  model: { name: string; attribution: string; doi: string; maxMa: number };
  /** Per moving plate, runs against one fixed plate each: [fixed, Ma, pole lat, pole lon, angle°, Ma, …]. */
  rotations: Record<string, number[][]>;
  /** [plate, appears Ma, gone Ma, outer ring, …holes]. */
  coast: (number | FlatRing)[][];
  crust: (number | FlatRing)[][];
};

/** w, x, y, z. */
export type Quat = [number, number, number, number];
export type Vec = [number, number, number];

const RAD = Math.PI / 180;
const IDENTITY: Quat = [1, 0, 0, 0];

export function toVec(lon: number, lat: number): Vec {
  const c = Math.cos(lat * RAD);
  return [c * Math.cos(lon * RAD), c * Math.sin(lon * RAD), Math.sin(lat * RAD)];
}

export function toLonLat([x, y, z]: Vec): [number, number] {
  return [Math.atan2(y, x) / RAD, Math.asin(Math.max(-1, Math.min(1, z))) / RAD];
}

export function poleQuat(lat: number, lon: number, angle: number): Quat {
  const [x, y, z] = toVec(lon, lat);
  const s = Math.sin((angle * RAD) / 2);
  return [Math.cos((angle * RAD) / 2), x * s, y * s, z * s];
}

/** `a` after `b`. */
export function mul(a: Quat, b: Quat): Quat {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}

export function slerp(a: Quat, b: Quat, f: number): Quat {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  // q and −q are the same rotation; take the short way round.
  const s = dot < 0 ? -1 : 1;
  dot *= s;
  let wa = 1 - f;
  let wb = f * s;
  if (dot < 0.9999) {
    const theta = Math.acos(dot);
    const sin = Math.sin(theta);
    wa = Math.sin((1 - f) * theta) / sin;
    wb = (Math.sin(f * theta) / sin) * s;
  }
  const q: Quat = [wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2], wa * a[3] + wb * b[3]];
  const n = Math.hypot(...q);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** Row-major 3×3. */
export function matrix([w, x, y, z]: Quat): number[] {
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
}

type Run = { fixed: number; ages: number[]; poles: Quat[] };

/** A plate whose chain to plate 0 is longer than this is a loop in the file. */
const MAX_DEPTH = 64;

export type Rotations = {
  /** The plate's rotation from today to `ma`, or null where the model has no pole for it or a plate it hangs from. */
  at(plate: number, ma: number): Quat | null;
};

export function createRotations(file: PlatesFile['rotations']): Rotations {
  const runs = new Map<number, Run[]>();
  for (const [plate, list] of Object.entries(file)) {
    runs.set(Number(plate), list.map(([fixed, ...rest]) => {
      const ages: number[] = [];
      const poles: Quat[] = [];
      for (let i = 0; i + 3 < rest.length; i += 4) {
        ages.push(rest[i]);
        poles.push(poleQuat(rest[i + 1], rest[i + 2], rest[i + 3]));
      }
      return { fixed, ages, poles };
    }));
  }

  const relative = (plate: number, ma: number): { fixed: number; q: Quat } | null => {
    // At a crossover two runs share the age; both place the plate alike, so the first is as good as the second.
    const run = runs.get(plate)?.find(r => r.ages[0] <= ma && ma <= r.ages[r.ages.length - 1]);
    if (!run) return null;
    let i = 0;
    while (i < run.ages.length - 2 && run.ages[i + 1] < ma) i++;
    const a = run.ages[i];
    const b = run.ages[i + 1] ?? a;
    const q = b > a ? slerp(run.poles[i], run.poles[i + 1], (ma - a) / (b - a)) : run.poles[i];
    return { fixed: run.fixed, q };
  };

  let cachedMa = NaN;
  let cache = new Map<number, Quat | null>();
  const absolute = (plate: number, ma: number, depth: number): Quat | null => {
    if (plate === 0) return IDENTITY;
    if (cache.has(plate)) return cache.get(plate)!;
    let q: Quat | null = null;
    const rel = depth < MAX_DEPTH ? relative(plate, ma) : null;
    if (rel) {
      const up = absolute(rel.fixed, ma, depth + 1);
      q = up && mul(up, rel.q);
    }
    cache.set(plate, q);
    return q;
  };

  return {
    at(plate, ma) {
      if (ma !== cachedMa) {
        cachedMa = ma;
        cache = new Map();
      }
      return absolute(plate, ma, 0);
    },
  };
}
