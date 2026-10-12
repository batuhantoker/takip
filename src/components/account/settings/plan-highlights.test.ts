import { describe, expect, it } from 'vitest';
import type { Entitlements } from '@takip/core/entitlements';
import { planGains } from './plan-highlights';

const free = {
  'api.enabled': false, 'api.requests_per_day': 0, 'replay.lookback_days': 7,
  'workspaces.max': 5, 'workspaces.share': true, 'export.enabled': false, 'ai.hosted': false,
} as Entitlements;
const pro = {
  ...free, 'api.enabled': true, 'api.requests_per_day': 100000, 'replay.lookback_days': 3650, 'workspaces.max': 100, 'export.enabled': true,
} as Entitlements;

describe('planGains', () => {
  it('names only what the next plan adds or raises', () => {
    expect(planGains(free, pro)).toEqual([
      'API access, 100,000 requests a day',
      'Replay up to 10 years back',
      '100 saved workspaces',
      'Data export',
    ]);
  });

  it('is empty between identical plans', () => {
    expect(planGains(pro, pro)).toEqual([]);
  });
});
