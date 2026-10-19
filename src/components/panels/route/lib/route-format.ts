import type { Translate } from '@/lib/core/i18n/translator';

/** A number with exactly `digits` decimals and the reader's decimal mark. */
export const fixed = (value: number, digits: number, t: Translate) =>
  new Intl.NumberFormat(t.intl, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

/** "850 m", "4.2 km", "37 km". */
export function routeDistance(m: number, t: Translate): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${fixed(m / 1000, m < 10000 ? 1 : 0, t)} km`;
}
