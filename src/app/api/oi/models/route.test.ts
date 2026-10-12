import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { POST } from './route';

const MODEL_KEY = 'sk-model-key-0123456789';
const OUR_KEY = 'tk_live_0123456789abcdef';

let n = 0;
const check = (headers: Record<string, string>) =>
  POST(new Request('http://localhost/api/oi/models', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${++n}`, ...headers },
    body: JSON.stringify({ provider: 'openai' }),
  }));

let fetch: MockInstance<typeof globalThis.fetch>;
let warn: MockInstance<typeof console.warn>;
const sentAuth = () => fetch.mock.calls.map(([, init]) => (init?.headers as Record<string, string>)?.authorization);

beforeEach(() => {
  fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ data: [{ id: 'gpt-5-mini' }] }));
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('the model key on /api/oi/models', () => {
  it('is read from X-OI-Key', async () => {
    const res = await check({ 'x-oi-key': MODEL_KEY });
    expect(res.status).toBe(200);
    expect(sentAuth()).toEqual([`Bearer ${MODEL_KEY}`]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('is still read from Authorization: Bearer for now, with a warning that carries no key', async () => {
    const res = await check({ authorization: `Bearer ${MODEL_KEY}` });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, provider: 'openai' });
    expect(sentAuth()).toEqual([`Bearer ${MODEL_KEY}`]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/^\[TAKIP\] .*X-OI-Key/);
    expect(warn.mock.calls.flat().join(' ')).not.toContain(MODEL_KEY);
  });

  it('is never one of our own tk_ API keys', async () => {
    const res = await check({ authorization: `Bearer ${OUR_KEY}` });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Send the key in X-OI-Key.' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('comes from X-OI-Key when a tk_ API key rides along in Authorization', async () => {
    const res = await check({ 'x-oi-key': MODEL_KEY, authorization: `Bearer ${OUR_KEY}` });
    expect(res.status).toBe(200);
    expect(sentAuth()).toEqual([`Bearer ${MODEL_KEY}`]);
    expect(JSON.stringify(fetch.mock.calls)).not.toContain(OUR_KEY);
  });
});
