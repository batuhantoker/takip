import { HISTORY_START } from '@/lib/replay/time-input';
import type { ChoiceGroup } from '@/components/map/replay/timeline-controls';
import type { GoToExample } from '@/components/map/replay/go-to-popover';

const DAY_S = 86_400;

/** Simulated seconds per second. */
export const SPEEDS = [
  { value: DAY_S, label: '1 day / s' },
  { value: 7 * DAY_S, label: '1 week / s' },
  { value: 30 * DAY_S, label: '1 month / s' },
  { value: 365 * DAY_S, label: '1 year / s' },
  { value: 3650 * DAY_S, label: '10 years / s' },
];

/** Deep time's clock counts years, so its speeds are years per millisecond: 1000 is a million years a second. */
export const DEEP_SPEEDS = [
  { value: 500, label: '500,000 years / s' },
  { value: 1000, label: '1 million years / s' },
  { value: 5000, label: '5 million years / s' },
  { value: 20_000, label: '20 million years / s' },
  { value: 50_000, label: '50 million years / s' },
];

/** A speed the menu doesn't list, such as one a country view picked. */
export function speedLabel(speed: number, deep: boolean) {
  const listed = (deep ? DEEP_SPEEDS : SPEEDS).find(s => s.value === speed);
  if (listed) return listed.label;
  if (deep) return speed < 1000 ? `${(speed * 1000).toLocaleString('en')} years / s` : `${(speed / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} million years / s`;
  const days = speed / DAY_S;
  return days >= 365 ? `${(days / 365).toLocaleString('en', { maximumFractionDigits: 1 })} years / s` : `${Math.round(days).toLocaleString('en')} days / s`;
}

/** Years at or below 0 count astronomically: -999 is 1000 BCE. */
function yearStart(year: number) {
  const d = new Date(0);
  d.setUTCFullYear(year, 0, 1);
  return d.getTime();
}

/** How far back the track reaches, ending now. */
export const RANGES = [
  { id: '2000', label: 'Since 2000', from: yearStart(2000) },
  { id: '1900', label: 'Since 1900', from: yearStart(1900) },
  { id: '1800', label: 'Since 1800', from: yearStart(1800) },
  { id: '1500', label: 'Since 1500', from: yearStart(1500) },
  { id: '1000', label: 'Since 1000', from: yearStart(1000) },
  { id: 'bce1000', label: 'Since 1000 BCE', from: yearStart(-999) },
  { id: 'all', label: 'Since 10,000 BCE', from: HISTORY_START },
] as const;
export type RangeId = (typeof RANGES)[number]['id'];

export const DEEP_RANGES = [
  { id: 'ma66', label: '66 million years', ma: 66 },
  { id: 'ma250', label: '250 million years', ma: 250 },
  { id: 'ma540', label: '540 million years', ma: 540 },
  { id: 'ma1800', label: '1.8 billion years', ma: 1800 },
] as const;
export type DeepRangeId = (typeof DEEP_RANGES)[number]['id'];
export const isDeepRange = (id: string): id is DeepRangeId => DEEP_RANGES.some(r => r.id === id);

export const RANGE_GROUPS: ChoiceGroup<string>[] = [
  { label: 'Calendar', options: RANGES.map(r => ({ value: r.id, label: r.label })) },
  { label: 'Deep time', options: DEEP_RANGES.map(r => ({ value: r.id, label: r.label })) },
];

export const GO_TO_EXAMPLES: GoToExample[] = [
  { label: 'Germany invades Poland', value: '1939-09-01' },
  { label: 'Caesar is assassinated', value: '44 BCE' },
  { label: 'Pangaea is whole', value: '250 Ma' },
];
