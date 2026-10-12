import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireEntitlement } from './access-server';

const request = new Request('http://localhost:3000/api/ai/briefing', { headers: { cookie: 'takip.session_token=abc' } });

function apiAnswers(entitlements: Record<string, unknown>) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ plan: { id: 'free', name: 'Free' }, entitlements, subscription: null }));
}

afterEach(() => vi.restoreAllMocks());

describe('requireEntitlement', () => {
  it('lets the request through when the plan allows it, asking with the caller’s cookies', async () => {
    const fetch = apiAnswers({ 'ai.hosted': true });
    expect(await requireEntitlement(request, 'ai.hosted')).toBeNull();
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/v1\/me\/access$/);
    expect((fetch.mock.calls[0][1]?.headers as Record<string, string>).cookie).toBe('takip.session_token=abc');
  });

  it('answers 403 with the upgrade hint when it does not', async () => {
    apiAnswers({ 'ai.hosted': false });
    const res = await requireEntitlement(request, 'ai.hosted');
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ error: 'entitlement_required', entitlement: 'ai.hosted', upgrade_url: '/pricing' });
  });

  it('refuses rather than allows when the api is down', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    expect((await requireEntitlement(request, 'ai.hosted'))?.status).toBe(503);
  });
});
