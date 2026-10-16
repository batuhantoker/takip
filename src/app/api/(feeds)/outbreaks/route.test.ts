import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutbreakNotice } from './types';

vi.mock('./who-don', () => ({ fetchWhoDon: vi.fn() }));
vi.mock('./cdc-notices', () => ({ fetchCdcNotices: vi.fn() }));
vi.mock('./ecdc', async importOriginal => ({ ...(await importOriginal<typeof import('./ecdc')>()), fetchEcdcFeed: vi.fn() }));

const fresh = (over: Partial<OutbreakNotice>): OutbreakNotice => ({
  source: 'WHO', title: 't', url: 'https://example.test', published: '2026-10-08T15:16:26.000Z', disease: 'Ebola',
  countries: [{ iso2: 'CD', name: 'Democratic Republic of the Congo' }], unmatched: [], level: null, ...over,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T20:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('GET /api/outbreaks', () => {
  it('merges the sources and lists a failed one as not ok', async () => {
    vi.resetModules();
    const who = await import('./who-don');
    const cdc = await import('./cdc-notices');
    const ecdc = await import('./ecdc');
    vi.mocked(who.fetchWhoDon).mockResolvedValue([fresh({ title: 'DON619' })]);
    vi.mocked(cdc.fetchCdcNotices).mockRejectedValue(new Error('HTTP 503'));
    vi.mocked(ecdc.fetchEcdcFeed).mockImplementation(async term =>
      (term === 1310 ? [fresh({ source: 'ECDC', title: 'ECDC', unmatched: ['Narnia'] })] : []));

    const { GET } = await import('./route');
    const body = await (await GET()).json();

    expect(body.outbreaks.map((o: { id: string }) => o.id)).toEqual(['ecdc-ebola-cd', 'who-ebola-cd']);
    expect(body.unmatched).toEqual(['Narnia']);
    expect(body.sources).toEqual([
      { name: 'WHO Disease Outbreak News', ok: true },
      { name: 'CDC Travel Health Notices', ok: false, error: 'HTTP 503' },
      { name: 'ECDC epidemiological updates', ok: true },
      { name: 'ECDC risk assessments', ok: true },
    ]);
    expect(vi.mocked(ecdc.fetchEcdcFeed).mock.calls.map(c => c[0])).toEqual([1310, 1295]);
  });
});
