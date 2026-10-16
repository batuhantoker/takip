/*
 * Earth's global mean surface temperature and CO₂ over the last 485 million years, from PhanDA
 * (public/data/paleo/climate.json, built by tools/build-deep-time.mjs). One row per geological stage.
 */

export type ClimateFile = {
  source: { name: string; attribution: string; doi: string };
  /** [Ma, GMST °C 16th, 50th, 84th percentile, CO₂ ppm 16th, 50th, 84th], youngest first. */
  rows: number[][];
};

export type Range = { lo: number; mid: number; hi: number };
export type ClimateReading = { gmst: Range; co2: Range };

/** Between two stages the values are drawn straight across; the youngest stage holds to today, and before the oldest there is no reading. */
export function climateAt(rows: readonly number[][], ma: number): ClimateReading | null {
  if (!rows.length || ma > rows[rows.length - 1][0]) return null;
  ma = Math.max(ma, rows[0][0]);
  let i = 0;
  while (i < rows.length - 2 && rows[i + 1][0] < ma) i++;
  const a = rows[i];
  const b = rows[i + 1] ?? a;
  const f = b[0] > a[0] ? (ma - a[0]) / (b[0] - a[0]) : 0;
  const v = (k: number) => a[k] + (b[k] - a[k]) * f;
  return { gmst: { lo: v(1), mid: v(2), hi: v(3) }, co2: { lo: v(4), mid: v(5), hi: v(6) } };
}

let loading: Promise<ClimateFile> | null = null;

export function loadClimate(): Promise<ClimateFile> {
  loading ??= fetch('/data/paleo/climate.json')
    .then(r => {
      if (!r.ok) throw new Error(`Climate: HTTP ${r.status}`);
      return r.json() as Promise<ClimateFile>;
    })
    .catch(e => {
      loading = null;
      throw e;
    });
  return loading;
}
