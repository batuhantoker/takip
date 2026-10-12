import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccess, requireEntitlement } from './access-server';

const request = new Request('http://localhost:3000/api/ai/briefing', { headers: { cookie: 'takip.session_token=abc' } });

function apiAnswers(entitlements: Record<string, unknown>) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ plan: { id: 'free', name: 'Free' }, entitlements, subscription: null }));
}

const sentHeaders = (fetch: ReturnType<typeof apiAnswers>) => fetch.mock.calls[0][1]?.headers as Record<string, string>;

afterEach(() => vi.restoreAllMocks());

describe('getAccess', () => {
  it('passes the caller’s address on, so the api limits each visitor on their own', async () => {
    const fetch = apiAnswers({});
    await getAccess(new Request('http://localhost:3000/api/ai/briefing', { headers: { 'x-forwarded-for': '203.0.113.5' } }));
    expect(sentHeaders(fetch)['x-forwarded-for']).toBe('203.0.113.5');
  });

  it('forwards only the address the proxy observed, not what the client wrote', async () => {
    const fetch = apiAnswers({});
    await getAccess(new Request('http://localhost:3000/api/ai/briefing', { headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.5' } }));
    expect(sentHeaders(fetch)['x-forwarded-for']).toBe('203.0.113.5');
  });

  it('sends no address when there is none to send', async () => {
    const fetch = apiAnswers({});
    await getAccess(request);
    expect(sentHeaders(fetch)).not.toHaveProperty('x-forwarded-for');
  });

  it('is null when the api answers with an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'internal' }, { status: 500 }));
    expect(await getAccess(request)).toBeNull();
  });
});

describe('requireEntitlement', () => {
  it('lets the request through when the plan allows it, asking with the caller’s cookies', async () => {
    const fetch = apiAnswers({ 'ai.hosted': true });
    expect(await requireEntitlement(request, 'ai.hosted')).toBeNull();
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/v1\/me\/access$/);
    expect(sentHeaders(fetch).cookie).toBe('takip.session_token=abc');
  });

  it('answers 403 with the upgrade hint when it does not', async () => {
    apiAnswers({ 'ai.hosted': false });
    const res = await requireEntitlement(request, 'ai.hosted');
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ error: 'entitlement_required', entitlement: 'ai.hosted', upgrade_url: '/pricing' });
  });

  it('refuses rather than allows when the api is down', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const res = await requireEntitlement(request, 'ai.hosted');
    expect(res?.status).toBe(503);
    expect(await res?.json()).toEqual({ error: 'access_unavailable' });
  });
});
