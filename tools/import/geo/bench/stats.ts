/* Error statistics for the benchmark tables. */

export type Trial = { set: string; id?: string; method: string; hit: boolean; err?: number; geoPrec?: number; kind?: string; evidence?: string[]; features?: Record<string, unknown>; detail?: string };

const quantile = (xs: number[], q: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

export type Row = { key: string; tried: number; hits: number; median: number; p90: number; within25: number; within100: number };

/** One row per group: hit rate over the events tried, error over the hits. */
export function summarise(trials: Trial[], keyOf: (t: Trial) => string | null, triedOf: (key: string) => number): Row[] {
  const groups = new Map<string, number[]>();
  for (const t of trials) {
    if (!t.hit || t.err === undefined) continue;
    const k = keyOf(t);
    if (k === null) continue;
    groups.set(k, [...(groups.get(k) ?? []), t.err]);
  }
  return [...groups].map(([key, errs]) => ({
    key,
    tried: triedOf(key),
    hits: errs.length,
    median: quantile(errs, 0.5),
    p90: quantile(errs, 0.9),
    within25: errs.filter(e => e <= 25).length / errs.length,
    within100: errs.filter(e => e <= 100).length / errs.length,
  })).sort((a, b) => a.key.localeCompare(b.key));
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const kmf = (x: number) => (Number.isNaN(x) ? '–' : x < 10 ? x.toFixed(1) : x.toFixed(0));

export function markdown(rows: Row[], label: string): string {
  const head = `| ${label} | tried | placed | hit rate | median km | p90 km | ≤25 km | ≤100 km |\n|---|--:|--:|--:|--:|--:|--:|--:|`;
  return [head, ...rows.map(r => `| ${r.key} | ${r.tried} | ${r.hits} | ${r.tried ? pct(r.hits / r.tried) : '–'} | ${kmf(r.median)} | ${kmf(r.p90)} | ${pct(r.within25)} | ${pct(r.within100)} |`)].join('\n');
}
