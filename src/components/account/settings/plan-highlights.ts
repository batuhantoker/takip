import type { Entitlements } from '@takip/core/entitlements';

const span = (days: number) =>
  days >= 365 && days % 365 === 0 ? `${days / 365} year${days === 365 ? '' : 's'}` : `${days} day${days === 1 ? '' : 's'}`;
const hours = (h: number) => (h % 24 === 0 ? span(h / 24) : `${h} hour${h === 1 ? '' : 's'}`);

/** Only features that exist today are offered; a feature's entitlements join this list when it ships. */
const BUILT: (keyof Entitlements)[] = [
  'api.enabled', 'api.requests_per_day', 'api.rps', 'api.keys.max',
  'replay.lookback_days', 'replay.window_hours',
  'web.rps',
  'ai.hosted',
];

/** The entitlements worth naming to a person, in words; null when the plan lacks it. */
const HIGHLIGHTS: ((e: Entitlements) => string | null)[] = [
  e => (e['api.enabled']
    ? `API access: ${e['api.requests_per_day'].toLocaleString('en')} requests a day, ${e['api.rps']} a second per key, ${e['api.keys.max']} key${e['api.keys.max'] === 1 ? '' : 's'}`
    : null),
  e => `Replay up to ${span(e['replay.lookback_days'])} back`,
  e => `Replay up to ${hours(e['replay.window_hours'])} at a time`,
  e => `Up to ${e['web.rps']} requests a second in the app`,
  e => (e['workspaces.max'] ? `${e['workspaces.max']} saved workspaces` : null),
  e => (e['workspaces.share'] ? 'Share workspaces by link' : null),
  e => (e['export.enabled'] ? 'Data export' : null),
  e => (e['ai.hosted'] ? 'Hosted AI, no key of your own needed' : null),
];

/** What moving from one plan to another adds, as short lines. */
export function planGains(current: Entitlements, next: Entitlements): string[] {
  // Entitlements of unbuilt features keep the current plan's values, so they never read as gains.
  const offered: Entitlements = { ...current, ...Object.fromEntries(BUILT.map(key => [key, next[key]])) };
  return HIGHLIGHTS.map(line => [line(current), line(offered)] as const)
    .filter(([now, then]) => then !== null && then !== now)
    .map(([, then]) => then!);
}
