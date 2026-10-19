import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { FunctionCode } from '@/lib/intel/markets/markets';

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

const TITLES: Record<FunctionCode, string> = {
  WEI: msg('World equity indices'),
  DEF: msg('Defense equities'),
  NRG: msg('Energy'),
  CMDTY: msg('Commodities'),
  FX: msg('Currencies'),
  CRYPTO: msg('Digital assets'),
  WATCH: msg('Watchlist'),
  DON: msg('DonBot token scan'),
};

/** A section's name in sentence case: "World equity indices". */
export function sectionTitle(code: FunctionCode, t: Translate): string {
  return TITLES[code] ? t(TITLES[code]) : code;
}

const PULSE_NAMES: Record<string, string> = { NASDAQ: 'Nasdaq', BITCOIN: 'Bitcoin' };
const PULSE_WORDS: Record<string, string> = { DOLLAR: msg('Dollar'), GOLD: msg('Gold') };
export const pulseLabel = (label: string, t: Translate) => (PULSE_WORDS[label] ? t(PULSE_WORDS[label]) : PULSE_NAMES[label] ?? label);

const REGION_LABELS: Record<string, string> = {
  AMERICAS: msg('Americas'),
  EMEA: msg('Europe, Middle East and Africa'),
  'ASIA / PACIFIC': msg('Asia and Pacific'),
  'RATES · VOLATILITY · DOLLAR': msg('Rates, volatility and the dollar'),
};
export const regionLabel = (label: string, t: Translate) => (REGION_LABELS[label] ? t(REGION_LABELS[label]) : label);
