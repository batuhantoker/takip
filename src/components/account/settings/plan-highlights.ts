import type { Entitlements } from '@takip/core/entitlements';

const span = (days: number) =>
  days >= 365 && days % 365 === 0 ? `${days / 365} year${days === 365 ? '' : 's'}` : `${days} day${days === 1 ? '' : 's'}`;

/** The entitlements worth naming to a person, in words; null when the plan lacks it. */
const HIGHLIGHTS: ((e: Entitlements) => string | null)[] = [
  e => (e['api.enabled'] ? `API access, ${e['api.requests_per_day'].toLocaleString('en')} requests a day` : null),
  e => `Replay up to ${span(e['replay.lookback_days'])} back`,
  e => (e['workspaces.max'] ? `${e['workspaces.max']} saved workspaces` : null),
  e => (e['workspaces.share'] ? 'Share workspaces by link' : null),
  e => (e['export.enabled'] ? 'Data export' : null),
  e => (e['ai.hosted'] ? 'Hosted AI, no key of your own needed' : null),
];

/** What moving from one plan to another adds, as short lines. */
export function planGains(current: Entitlements, next: Entitlements): string[] {
  return HIGHLIGHTS.map(line => [line(current), line(next)] as const)
    .filter(([now, then]) => then !== null && then !== now)
    .map(([, then]) => then!);
}
