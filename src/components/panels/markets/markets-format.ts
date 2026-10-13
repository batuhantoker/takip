import { FUNCTIONS, type FunctionCode } from '@/lib/markets/markets';

/** Green or red only for change; no reading and no move stay neutral. */
export const moveTone = (pct: number | null | undefined) =>
  pct == null || !Number.isFinite(pct) || pct === 0 ? 'text-ink-2' : pct > 0 ? 'text-green' : 'text-red';

/** The day's move as a tint, from the status tokens, for heatmap tiles. */
export function heatTint(pct: number, cap = 3): { background: string; borderColor: string } {
  const strength = Number.isFinite(pct) ? Math.min(Math.abs(pct) / cap, 1) : 0;
  const c = pct >= 0 ? 'var(--green)' : 'var(--red)';
  return {
    background: `color-mix(in srgb, ${c} ${Math.round(6 + strength * 26)}%, transparent)`,
    borderColor: `color-mix(in srgb, ${c} ${Math.round(14 + strength * 36)}%, transparent)`,
  };
}

const TITLES: Partial<Record<FunctionCode, string>> = { DON: 'DonBot token scan' };

/** "World Equity Indices" → "World equity indices". */
export function sectionTitle(code: FunctionCode): string {
  const f = FUNCTIONS.find(x => x.code === code);
  if (!f) return code;
  return TITLES[code] ?? f.title.charAt(0) + f.title.slice(1).toLowerCase();
}

const PULSE_LABELS: Record<string, string> = { NASDAQ: 'Nasdaq', DOLLAR: 'Dollar', GOLD: 'Gold', BITCOIN: 'Bitcoin' };
export const pulseLabel = (label: string) => PULSE_LABELS[label] ?? label;

const REGION_LABELS: Record<string, string> = {
  AMERICAS: 'Americas',
  EMEA: 'Europe, Middle East and Africa',
  'ASIA / PACIFIC': 'Asia and Pacific',
  'RATES · VOLATILITY · DOLLAR': 'Rates, volatility and the dollar',
};
export const regionLabel = (label: string) => REGION_LABELS[label] ?? label;
