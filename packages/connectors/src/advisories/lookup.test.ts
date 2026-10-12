import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Advisory } from './types';

vi.mock('./us-state', () => ({ fetchUsAdvisories: vi.fn() }));
vi.mock('./smartraveller', () => ({ fetchSmartraveller: vi.fn() }));
vi.mock('./fcdo', () => ({ fetchFcdoAdvisory: vi.fn() }));

const UA_US: Advisory = {
  issuer: 'US State Department', iso2: 'UA', country: 'Ukraine', level: 4, label: 'Level 4: Do Not Travel',
  statuses: [], change: null, updated_at: '2026-08-26', url: 'https://example.test',
};

afterEach(() => vi.useRealTimers());

describe('advisoriesFor', () => {
  it('does not let a hanging issuer hold up a time-budgeted lookup', async () => {
    vi.resetModules();
    const us = await import('./us-state');
    const au = await import('./smartraveller');
    const fcdo = await import('./fcdo');
    vi.mocked(us.fetchUsAdvisories).mockResolvedValue({ advisories: [UA_US], unmatched: [] });
    vi.mocked(au.fetchSmartraveller).mockReturnValue(new Promise(() => {}));
    vi.mocked(fcdo.fetchFcdoAdvisory).mockResolvedValue(null);
    const { advisoriesFor } = await import('./lookup');

    const { advisories, sources } = await advisoriesFor('UA', 50);
    expect(advisories.map(a => a.issuer)).toEqual(['US State Department']);
    expect(sources).toEqual([
      { issuer: 'US State Department', ok: true },
      { issuer: 'Australia Smartraveller', ok: false, error: 'no answer within the time budget' },
      { issuer: 'UK FCDO', ok: true },
    ]);
  });

  it('serves the last good copy, marked stale, when a refresh overruns the budget', async () => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    const us = await import('./us-state');
    const au = await import('./smartraveller');
    const fcdo = await import('./fcdo');
    vi.mocked(us.fetchUsAdvisories).mockResolvedValueOnce({ advisories: [UA_US], unmatched: [] }).mockReturnValue(new Promise(() => {}));
    vi.mocked(au.fetchSmartraveller).mockReturnValue(new Promise(() => {}));
    vi.mocked(fcdo.fetchFcdoAdvisory).mockResolvedValue(null);
    const { advisoriesFor } = await import('./lookup');

    await advisoriesFor('UA', 50);
    vi.setSystemTime(Date.now() + 2 * 60 * 60_000);
    const { advisories, sources } = await advisoriesFor('UA', 50);
    expect(advisories.map(a => a.issuer)).toEqual(['US State Department']);
    expect(sources[0]).toEqual({ issuer: 'US State Department', ok: true, stale: true, error: 'no answer within the time budget' });
  });
});
