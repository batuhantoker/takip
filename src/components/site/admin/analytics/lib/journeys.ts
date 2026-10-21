import type { Channel, NextStep, PageJourneys } from '../analytics-types';
import { DIRECT_ARRIVAL } from './features';
import { ink, OTHER } from './series';

export const MAP_PATH = '/';

/** The map and pages keep these two everywhere a visit's steps are drawn, Live included; leaving is the absence of either. */
export const STEP_INK: Record<NextStep, string> = { map: ink(0), page: ink(1), left: OTHER };
export const NEXT_LABEL: Record<NextStep, string> = { map: 'Opened the map', page: 'Read another page', left: 'Left' };
export const NEXT_ORDER: NextStep[] = ['map', 'page', 'left'];

export const CHANNEL_LABEL: Record<Channel, string> = {
  search: 'Search engines', ai: 'AI assistants', social: 'Social sites', site: 'Other sites', direct: 'Direct or hidden',
};

export const pathLabel = (path: string) => (path === MAP_PATH ? 'The map' : path);
export const originLabel = (origin: string | null) => origin ?? DIRECT_ARRIVAL;

export type Outcomes = Record<NextStep, number>;
export type OutcomeRow = { key: string; visits: number; outcomes: Outcomes };

const none = (): Outcomes => ({ map: 0, page: 0, left: 0 });

/** The flow summed by origin (or landing page), biggest first, each with what its visits did next. */
export function outcomesBy(flow: PageJourneys['flow'], by: 'origin' | 'landing'): OutcomeRow[] {
  const rows = new Map<string, OutcomeRow>();
  for (const f of flow) {
    const key = by === 'origin' ? f.origin ?? '' : f.landing;
    const row = rows.get(key) ?? { key, visits: 0, outcomes: none() };
    row.visits += f.visits;
    row.outcomes[f.next] += f.visits;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.visits - a.visits || a.key.localeCompare(b.key));
}

/** "4 min ago" style, for a list that refreshes. */
export function since(at: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** 'mobile' → 'Phone'. */
export const deviceLabel = (device: string) => ({ mobile: 'Phone', tablet: 'Tablet', desktop: 'Desktop' })[device] ?? device;
