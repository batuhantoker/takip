import { describe, expect, it, vi } from 'vitest';
import type { Advisory } from './types';

vi.mock('./us-state', () => ({ fetchUsAdvisories: vi.fn() }));
vi.mock('./smartraveller', () => ({ fetchSmartraveller: vi.fn() }));
vi.mock('./fcdo', () => ({ fetchFcdoAdvisory: vi.fn() }));

const UA_US: Advisory = {
  issuer: 'US State Department', iso2: 'UA', country: 'Ukraine', level: 4, label: 'Level 4: Do Not Travel',
  statuses: [], change: null, updated_at: '2026-08-26', url: 'https://example.test',
};

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
});
