import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { POST } from './route';

const MODEL_KEY = 'sk-model-key-0123456789';
const OUR_KEY = 'tk_live_0123456789abcdef';

let n = 0;
async function call(name: string, args: Record<string, unknown>, headers: Record<string, string>) {
  const res = await POST(new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'x-forwarded-for': `198.51.100.${++n}`, 'x-oi-provider': 'openai', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }));
  expect(res.status).toBe(200);
  return (await res.json()).result as { content: { text: string }[]; isError?: boolean; structuredContent?: { connection?: { key_configured: boolean } } };
}

let fetch: MockInstance<typeof globalThis.fetch>;
let warn: MockInstance<typeof console.warn>;

beforeEach(() => {
  fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in tests'));
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('the model key on /api/mcp', () => {
  it('is read from X-OI-Key', async () => {
    const result = await call('oi_info', {}, { 'x-oi-key': MODEL_KEY });
    expect(result.structuredContent?.connection?.key_configured).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('is still read from Authorization: Bearer for now, with a warning that carries no key', async () => {
    const result = await call('oi_info', {}, { authorization: `Bearer ${MODEL_KEY}` });
    expect(result.structuredContent?.connection?.key_configured).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls.flat().join(' ')).not.toContain(MODEL_KEY);
  });

  it('is never one of our own tk_ API keys, so a forecast is refused before anything is sent', async () => {
    const result = await call('oi_predict', { question: 'Will the envoys sign a deal by year end?', wait_seconds: 0 }, { authorization: `Bearer ${OUR_KEY}` });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^This connection has no model key\..*X-OI-Key, optionally X-OI-Model\./);
    expect(result.content[0].text).not.toContain('Authorization');
    expect(fetch).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
