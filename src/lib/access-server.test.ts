import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccess, requireAccount, requireEntitlement } from './access-server';

const request = new Request('http://localhost:3000/api/ai/briefing', { headers: { cookie: 'takip.session_token=abc' } });

function apiAnswers(entitlements: Record<string, unknown>, subject: { type: 'user'; id: string } | null = null) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ plan: { id: 'free', name: 'Free' }, entitlements, subscription: null, subject }));
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

  it('passes a TAKIP API key on, so the api answers for the key’s owner', async () => {
    const fetch = apiAnswers({});
    await getAccess(new Request('http://localhost:3000/api/osint/dns', { headers: { authorization: 'Bearer tk_abc' } }));
    expect(sentHeaders(fetch).authorization).toBe('Bearer tk_abc');
  });

  it('never passes a model key on, which shares the header', async () => {
    const fetch = apiAnswers({});
    await getAccess(new Request('http://localhost:3000/api/ai/briefing', { headers: { authorization: 'Bearer sk-model-key' } }));
    expect(sentHeaders(fetch)).not.toHaveProperty('authorization');
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

describe('requireAccount', () => {
  const ada = { type: 'user', id: 'u1' } as const;

  it('answers 401 sign_in_required to a visitor', async () => {
    apiAnswers({}, null);
    const res = await requireAccount(request);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
    expect(await (res as Response).json()).toEqual({ error: 'sign_in_required' });
  });

  it('treats an answer without a subject as a visitor', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ plan: { id: 'free', name: 'Free' }, entitlements: {}, subscription: null }));
    expect(((await requireAccount(request)) as Response).status).toBe(401);
  });

  it('refuses rather than allows when the api is down or failing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(Response.json({ error: 'internal_error' }, { status: 500 }));
    for (let i = 0; i < 2; i++) {
      const res = (await requireAccount(request)) as Response;
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'access_unavailable' });
    }
  });

  it('lets a signed-in user through with their access', async () => {
    apiAnswers({ 'web.rps': 20 }, ada);
    expect(await requireAccount(request)).toMatchObject({ subject: ada, entitlements: { 'web.rps': 20 } });
  });

  it('lets an API key through as its owner', async () => {
    const fetch = apiAnswers({}, ada);
    const res = await requireAccount(new Request('http://localhost:3000/api/osint/dns', { headers: { authorization: 'Bearer tk_abc' } }));
    expect(res).toMatchObject({ subject: ada });
    expect(sentHeaders(fetch).authorization).toBe('Bearer tk_abc');
  });

  it('passes on the api’s own refusal of a key, and its wait', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ error: 'invalid_api_key' }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ error: 'rate_limited', retry_after: 7 }, { status: 429, headers: { 'Retry-After': '7' } }));
    const bad = (await requireAccount(request)) as Response;
    expect([bad.status, await bad.json()]).toEqual([401, { error: 'invalid_api_key' }]);
    const busy = (await requireAccount(request)) as Response;
    expect([busy.status, busy.headers.get('retry-after'), await busy.json()]).toEqual([429, '7', { error: 'rate_limited', retry_after: 7 }]);
  });
});
