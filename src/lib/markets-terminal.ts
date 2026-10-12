import type { FunctionCode } from './markets';

/** The theme's own colours, so Ghost and every other theme recolour this too. */
export const T = {
  accent: 'var(--gold-primary)',
  text: 'var(--text-primary)',
  dim: 'var(--text-secondary)',
  faint: 'var(--text-muted)',
  line: 'var(--border-primary)',
  up: 'var(--alert-green)',
  down: 'var(--alert-red)',
  alert: 'var(--alert-orange)',
} as const;

export const SECTION_OF: Record<string, FunctionCode> = { indices: 'WEI', stocks: 'DEF', oil: 'NRG', commodities: 'CMDTY', fx: 'FX', crypto: 'CRYPTO' };
export const FEED_SECTIONS = ['indices', 'stocks', 'oil', 'commodities', 'crypto', 'fx'] as const;

export const moveColor = (pct: number | null | undefined) =>
  pct == null || !Number.isFinite(pct) ? T.faint : pct > 0 ? T.up : pct < 0 ? T.down : T.text;
