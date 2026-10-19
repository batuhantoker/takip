import { SERIES_INK } from '@/lib/map/style/tokens';

/** Categorical series take SERIES_INK in this order (validated for CVD on surface-1); past six, fold into OTHER. */
export const ink = (slot: number) => SERIES_INK[slot] ?? OTHER;

export const OTHER = 'var(--ink-4)';
/** One measure on its own: neutral, like the Usage page's bars. */
export const NEUTRAL = 'var(--ink-2)';
export const REFUSED = 'var(--red)';

/** Keeps the `max` biggest keys of `totals` and the order they came in; the rest is summed under 'other'. */
export function topKeys(totals: Record<string, number>, max = SERIES_INK.length - 1) {
  const ranked = Object.entries(totals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const keep = ranked.length > max + 1 ? ranked.slice(0, max).map(([k]) => k) : ranked.map(([k]) => k);
  return { keep, folded: ranked.length > keep.length };
}
