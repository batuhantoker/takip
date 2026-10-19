import { describe, expect, it, vi } from 'vitest';
import { layerEntitlement, MAP_LAYER_SECTIONS, type Entitlements } from '@takip/core/entitlements';
import { planGains } from './plan-highlights';

const everyLayer = Object.fromEntries(MAP_LAYER_SECTIONS.map(s => [layerEntitlement(s), true])) as Pick<Entitlements, `map.layers.${(typeof MAP_LAYER_SECTIONS)[number]}`>;

// As seeded (apps/api/src/db/migrations.ts, with the 2026-10-12 and 2026-10-16 updates).
const free: Entitlements = {
  ...everyLayer, 'map.minutes_per_day': 60, 'ai.assistant': true,
  'map.live': true, 'api.enabled': true, 'api.keys.max': 1, 'api.requests_per_day': 1000, 'api.rps': 2, 'web.rps': 20,
  'replay.lookback_days': 7, 'replay.window_hours': 24, 'workspaces.max': 5, 'workspaces.share': true,
  'export.enabled': false, 'ai.hosted': false, 'recon.scan': false, 'data.licence_tier': 'free', 'ads.off': false,
};
const pro: Entitlements = {
  ...free, 'api.keys.max': 5, 'api.requests_per_day': 100000, 'api.rps': 20, 'web.rps': 50,
  'replay.lookback_days': 3650, 'replay.window_hours': 720, 'workspaces.max': 100, 'export.enabled': true, 'ai.hosted': true,
  'data.licence_tier': 'paid', 'recon.scan': true, 'ads.off': true, 'map.minutes_per_day': 0,
};
const anon: Entitlements = { ...free, 'map.minutes_per_day': 15, 'ai.assistant': false, 'api.enabled': false, 'data.licence_tier': 'anon' };

describe('planGains', () => {
  it('names what the next plan adds or raises, among features that exist', () => {
    expect(planGains(free, pro)).toEqual([
      'No time limit on the map',
      'API access: 100,000 requests a day, 20 a second per key, 5 keys',
      'Replay up to 10 years back',
      'Replay up to 30 days at a time',
      'Up to 50 requests a second in the app',
      'Hosted AI, no key of your own needed',
      'Port scans, TLS checks and sweeps in Recon',
    ]);
  });

  it('leaves out saved workspaces and data export, which are not built', () => {
    const more = { ...free, 'workspaces.max': 100, 'workspaces.share': true, 'export.enabled': true };
    expect(planGains({ ...free, 'workspaces.share': false }, more)).toEqual([]);
  });

  it('names API access when the next plan turns it on', () => {
    expect(planGains({ ...free, 'api.enabled': false }, free)).toEqual(['API access: 1,000 requests a day, 2 a second per key, 1 key']);
  });

  it('names no ads only on a deployment that serves ads', async () => {
    expect(planGains(free, pro)).not.toContain('No ads');
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-1234567890123456');
    const { planGains: withAds } = await import('./plan-highlights');
    expect(withAds(free, pro)).toContain('No ads');
    vi.unstubAllEnvs();
  });

  it('names more map time, TI and closed layer sections from a visitor to a free account', () => {
    expect(planGains({ ...anon, 'map.layers.air': false }, free)).toEqual([
      '60 minutes of map a day',
      'Every map layer',
      'The TI assistant',
      'API access: 1,000 requests a day, 2 a second per key, 1 key',
    ]);
  });

  it('is empty between identical plans', () => {
    expect(planGains(pro, pro)).toEqual([]);
  });
});
