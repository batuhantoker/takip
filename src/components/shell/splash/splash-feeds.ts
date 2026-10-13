import type { SplashFeed } from './feed-counters';

const FEEDS: { label: string; keys: string[] }[] = [
  { label: 'Aircraft', keys: ['commercial_flights', 'private_flights', 'private_jets', 'military_flights'] },
  { label: 'Vessels', keys: ['maritime_ships'] },
  { label: 'Satellites', keys: ['satellites'] },
  { label: 'Cameras', keys: ['cameras'] },
  { label: 'Earthquakes', keys: ['earthquakes'] },
];

/** What has reported so far, for the splash's counters. */
export function splashFeeds(data: Record<string, unknown>): SplashFeed[] {
  return FEEDS.map(({ label, keys }) => ({
    label,
    count: keys.reduce((sum, key) => sum + (Array.isArray(data[key]) ? (data[key] as unknown[]).length : 0), 0),
  }));
}
