import { describe, expect, it } from 'vitest';
import type { Entitlements } from '@takip/core/entitlements';
import { planGains } from './plan-highlights';

// As seeded (apps/api/src/db/migrations.ts, with the 2026-10-12 updates).
const free: Entitlements = {
  'map.live': true, 'api.enabled': true, 'api.keys.max': 1, 'api.requests_per_day': 1000, 'api.rps': 2, 'web.rps': 20,
  'replay.lookback_days': 7, 'replay.window_hours': 24, 'workspaces.max': 5, 'workspaces.share': true,
  'export.enabled': false, 'ai.hosted': false, 'data.licence_tier': 'free', 'ads.off': false,
};
const pro: Entitlements = {
  ...free, 'api.keys.max': 5, 'api.requests_per_day': 100000, 'api.rps': 20, 'web.rps': 50,
  'replay.lookback_days': 3650, 'replay.window_hours': 720, 'workspaces.max': 100, 'export.enabled': true, 'ai.hosted': true,
  'data.licence_tier': 'paid', 'ads.off': true,
};

describe('planGains', () => {
  it('names what the next plan adds or raises, among features that exist', () => {
    expect(planGains(free, pro)).toEqual([
      'API access: 100,000 requests a day, 20 a second per key, 5 keys',
      'Replay up to 10 years back',
      'Replay up to 30 days at a time',
      'Up to 50 requests a second in the app',
      'Hosted AI, no key of your own needed',
    ]);
  });

  it('leaves out saved workspaces and data export, which are not built', () => {
    const more = { ...free, 'workspaces.max': 100, 'workspaces.share': true, 'export.enabled': true };
    expect(planGains({ ...free, 'workspaces.share': false }, more)).toEqual([]);
  });

  it('names API access when the next plan turns it on', () => {
    expect(planGains({ ...free, 'api.enabled': false }, free)).toEqual(['API access: 1,000 requests a day, 2 a second per key, 1 key']);
  });

  it('is empty between identical plans', () => {
    expect(planGains(pro, pro)).toEqual([]);
  });
});
