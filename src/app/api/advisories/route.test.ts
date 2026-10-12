import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FcdoAdvisory } from './fcdo';
import type { Advisory } from './types';

vi.mock('./us-state', () => ({ fetchUsAdvisories: vi.fn() }));
vi.mock('./smartraveller', () => ({ fetchSmartraveller: vi.fn() }));
vi.mock('./fcdo', () => ({ fetchFcdoAdvisory: vi.fn() }));

const row = (issuer: Advisory['issuer'], iso2: string, country: string, level: Advisory['level']): Advisory => ({
  issuer, iso2, country, level, label: 'x', statuses: [], change: null, updated_at: '2026-08-26', url: 'https://example.test',
});

const US = [row('US State Department', 'PS', 'Gaza', 4), row('US State Department', 'PS', 'West Bank', 2), row('US State Department', 'FR', 'France', 1)];
const AU = [row('Australia Smartraveller', 'PS', 'Palestine', 4)];
const FCDO_UA: FcdoAdvisory = { ...row('UK FCDO', 'UA', 'Ukraine', 3), issuer: 'UK FCDO' };

async function setup(opts: { au?: 'fail'; fcdo?: 'fail' | null | FcdoAdvisory }) {
  vi.resetModules();
  const us = await import('./us-state');
  const au = await import('./smartraveller');
  const fcdo = await import('./fcdo');
  vi.mocked(us.fetchUsAdvisories).mockResolvedValue({ advisories: US, unmatched: ['French West Indies'] });
  if (opts.au === 'fail') vi.mocked(au.fetchSmartraveller).mockRejectedValue(new Error('Upstream timed out'));
  else vi.mocked(au.fetchSmartraveller).mockResolvedValue({ advisories: AU, unmatched: [] });
  if (opts.fcdo === 'fail') vi.mocked(fcdo.fetchFcdoAdvisory).mockRejectedValue(new Error('FCDO HTTP 503'));
  else vi.mocked(fcdo.fetchFcdoAdvisory).mockResolvedValue(opts.fcdo ?? null);
  return (await import('./route')).GET;
}

const call = async (GET: (r: Request) => Promise<Response>, query = '') =>
  GET(new Request(`http://localhost/api/advisories${query}`));

beforeEach(() => vi.clearAllMocks());

describe('GET /api/advisories', () => {
  it('lists every country and reports a failed issuer instead of hiding it', async () => {
    const GET = await setup({ au: 'fail' });
    const body = await (await call(GET)).json();
    expect(body.advisories.map((a: Advisory) => `${a.iso2} ${a.country}`)).toEqual(['FR France', 'PS Gaza', 'PS West Bank']);
    expect(body.unmatched).toEqual(['French West Indies']);
    expect(body.sources).toEqual([
      { issuer: 'US State Department', ok: true },
      { issuer: 'Australia Smartraveller', ok: false, error: 'Upstream timed out' },
    ]);
  });

  it('answers one country from all three issuers', async () => {
    const GET = await setup({ fcdo: FCDO_UA });
    const body = await (await call(GET, '?iso2=ua')).json();
    expect(body.iso2).toBe('UA');
    expect(body.advisories).toEqual([FCDO_UA]);
    expect(body.sources.map((s: { issuer: string; ok: boolean }) => [s.issuer, s.ok]))
      .toEqual([['US State Department', true], ['Australia Smartraveller', true], ['UK FCDO', true]]);
  });

  it('never turns a failed FCDO lookup into a no-warning row', async () => {
    const GET = await setup({ fcdo: 'fail' });
    const body = await (await call(GET, '?iso2=PS')).json();
    expect(body.advisories.map((a: Advisory) => [a.issuer, a.country])).toEqual([
      ['Australia Smartraveller', 'Palestine'],
      ['US State Department', 'Gaza'],
      ['US State Department', 'West Bank'],
    ]);
    expect(body.sources[2]).toEqual({ issuer: 'UK FCDO', ok: false, error: 'FCDO HTTP 503' });
  });

  it('treats "FCDO has no page" as an answer, not a failure', async () => {
    const GET = await setup({ fcdo: null });
    const body = await (await call(GET, '?iso2=GB')).json();
    expect(body.advisories).toEqual([]);
    expect(body.sources[2]).toEqual({ issuer: 'UK FCDO', ok: true });
  });

  it('rejects a malformed code', async () => {
    const GET = await setup({});
    expect((await call(GET, '?iso2=GBR')).status).toBe(400);
  });
});
