import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Every way these routes reach Gemini goes through createGeminiClient, so it is what must not be called.
vi.mock('@/lib/intel/ai/gemini', () => ({
  createGeminiClient: vi.fn(() => ({
    getGenerativeModel: () => ({ generateContent: async () => ({ response: { text: () => 'Model read-out.' } }) }),
  })),
  rotateApiKey: (keys: string[]) => keys[0],
  analyzeIntelligence: vi.fn(async () => 'Analysis.'),
  generateBriefing: vi.fn(async () => 'Briefing.'),
}));

import { createGeminiClient } from '@/lib/intel/ai/gemini';
import { POST as analyze } from './analyze/route';
import { POST as briefing } from './briefing/route';
import { POST as overview } from './overview/route';

const SERVER_KEY = 'server-gemini-key-1';
const ACCESS = /\/api\/v1\/me\/access$/;

let n = 0;
const nextIp = () => `198.51.100.${++n}`;

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp(), ...headers },
    body: JSON.stringify(body),
  });

const plan = (hosted: boolean) => Response.json({ plan: { id: hosted ? 'pro' : 'anon', name: '' }, entitlements: { 'ai.hosted': hosted }, subscription: null });

function apiAnswers(res: Response | Error) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    if (!ACCESS.test(String(input))) throw new Error(`unexpected fetch: ${String(input)}`);
    if (res instanceof Error) throw res;
    return res.clone();
  });
}

const accessCalls = (fetch: ReturnType<typeof apiAnswers>) => fetch.mock.calls.filter(([url]) => ACCESS.test(String(url)));

beforeEach(() => {
  vi.clearAllMocks();
  for (let i = 1; i <= 8; i++) vi.stubEnv(`GEMINI_API_KEY_${i}`, '');
  vi.stubEnv('GEMINI_API_KEY_1', SERVER_KEY);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const context = { earthquakes: [], news: [], threats: [], cyberAlerts: [], timestamp: '2026-10-12T12:00:00Z' };

describe.each([
  { name: 'analyze', handler: analyze, path: '/api/ai/analyze', body: { query: 'What is moving?', context } },
  { name: 'briefing', handler: briefing, path: '/api/ai/briefing', body: { context } },
])('/api/ai/$name', ({ handler, path, body }) => {
  it('runs on the caller’s own key with no account and never asks about a plan', async () => {
    const fetch = apiAnswers(new Error('the api should not be asked'));
    const res = await handler(post(path, body, { 'x-gemini-key': 'AIza-callers-own-key' }));
    expect(res.status).toBe(200);
    expect(accessCalls(fetch)).toHaveLength(0);
    expect(createGeminiClient).toHaveBeenCalledWith('AIza-callers-own-key');
  });

  it('refuses the server’s key to a plan without ai.hosted', async () => {
    apiAnswers(plan(false));
    const res = await handler(post(path, body));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'entitlement_required', entitlement: 'ai.hosted', upgrade_url: '/pricing' });
    expect(createGeminiClient).not.toHaveBeenCalled();
  });

  it('refuses the server’s key when the plan cannot be checked', async () => {
    apiAnswers(new TypeError('fetch failed'));
    const res = await handler(post(path, body));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'access_unavailable' });
    expect(createGeminiClient).not.toHaveBeenCalled();
  });

  it('spends the server’s key for a plan with ai.hosted, asking about the caller’s own address', async () => {
    const fetch = apiAnswers(plan(true));
    const res = await handler(post(path, body, { 'x-forwarded-for': '203.0.113.77' }));
    expect(res.status).toBe(200);
    expect((accessCalls(fetch)[0][1]?.headers as Record<string, string>)['x-forwarded-for']).toBe('203.0.113.77');
    expect(createGeminiClient).toHaveBeenCalledWith(SERVER_KEY);
  });

  it('says the server has no key, not that Pro is needed, when it has none', async () => {
    vi.stubEnv('GEMINI_API_KEY_1', '');
    const fetch = apiAnswers(plan(false));
    const res = await handler(post(path, body));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: 'NO_API_KEY' });
    expect(accessCalls(fetch)).toHaveLength(0);
  });
});

describe('/api/ai/overview', () => {
  const body = { mode: 'markets', payload: { markets: { equities: { SPX: { price: 5000, change_percent: 1.2 } } } } };

  it('gives the analyst read-out, never Gemini, to a plan without ai.hosted', async () => {
    apiAnswers(plan(false));
    const res = await overview(post('/api/ai/overview', body));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ generatedBy: 'analyst', hostedAi: 'entitlement_required', overview: expect.stringContaining('SPX') });
    expect(createGeminiClient).not.toHaveBeenCalled();
  });

  it('gives the analyst read-out, never Gemini, when the api answers 503', async () => {
    apiAnswers(Response.json({ error: 'unavailable' }, { status: 503 }));
    const res = await overview(post('/api/ai/overview', body));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ generatedBy: 'analyst', hostedAi: 'access_unavailable' });
    expect(createGeminiClient).not.toHaveBeenCalled();
  });

  it('gives the analyst read-out, never Gemini, when the api cannot be reached', async () => {
    apiAnswers(new TypeError('fetch failed'));
    const res = await overview(post('/api/ai/overview', body));
    expect(await res.json()).toMatchObject({ generatedBy: 'analyst', hostedAi: 'access_unavailable' });
    expect(createGeminiClient).not.toHaveBeenCalled();
  });

  it('uses Gemini for a plan with ai.hosted', async () => {
    apiAnswers(plan(true));
    const json = await (await overview(post('/api/ai/overview', body))).json();
    expect(json).toMatchObject({ generatedBy: 'gemini', overview: 'Model read-out.' });
    expect(json).not.toHaveProperty('hostedAi');
    expect(createGeminiClient).toHaveBeenCalledWith(SERVER_KEY);
  });

  it('does not ask about a plan when the server has no key to spend', async () => {
    vi.stubEnv('GEMINI_API_KEY_1', '');
    const fetch = apiAnswers(plan(false));
    const json = await (await overview(post('/api/ai/overview', body))).json();
    expect(json).toMatchObject({ generatedBy: 'analyst' });
    expect(json).not.toHaveProperty('hostedAi');
    expect(accessCalls(fetch)).toHaveLength(0);
  });
});
