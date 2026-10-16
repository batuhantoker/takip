import { afterEach, describe, it, expect, vi } from 'vitest';
import { PROVIDERS, isPlausibleKey, isPlausibleModel } from './catalog';
import { ProviderError, scrub } from './errors';
import { createChat } from './chat';
import { listModels, pickModel } from './listing';
import { forgetLocalOrigin, localOrigin, readerLocal, whyNoLocal } from './local';

const KEY = 'sk-test-0123456789abcdef';

type Body = Record<string, unknown> & { generationConfig?: Record<string, unknown> };
type Call = { url: string; init: RequestInit; body: Body };

function fakeFetch(...responses: (Response | (() => Response))[]) {
  const calls: Call[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init!, body: init?.body ? JSON.parse(String(init.body)) : null });
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    return typeof next === 'function' ? next() : next;
  });
  return { f: f as unknown as typeof fetch, calls };
}

const jsonRes = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const openaiReply = (text: string) => jsonRes({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });

const REQ = { system: 'sys', user: 'hello', json: true, maxTokens: 500, temperature: 0.7 };

describe('keys and models', () => {
  it('accepts keys that look like keys', () => {
    expect(isPlausibleKey(KEY)).toBe(true);
    expect(isPlausibleKey('short')).toBe(false);
    expect(isPlausibleKey('has space in it 12345')).toBe(false);
    expect(isPlausibleKey('line\nbreak12345')).toBe(false);
  });

  it('accepts model ids, and nothing that could leave the path', () => {
    expect(isPlausibleModel('openai/gpt-5-mini')).toBe(true);
    expect(isPlausibleModel('claude-haiku-4-5-20251001')).toBe(true);
    expect(isPlausibleModel('../../v1/files')).toBe(false);
    expect(isPlausibleModel('gemini?key=x')).toBe(false);
  });

  it('scrubs the key, and anything shaped like one', () => {
    expect(scrub(`bad key ${KEY} here`, KEY)).toBe('bad key [key] here');
    expect(scrub('leaked AIzaSyA1234567890abcdefghijklmn')).toBe('leaked [key]');
  });

  it('lists the providers, the demo only outside production', () => {
    expect(PROVIDERS.map(p => p.id)).toEqual(expect.arrayContaining(['openai', 'anthropic', 'google', 'openrouter']));
    expect(PROVIDERS.every(p => p.needsKey === (p.id !== 'demo' && p.id !== 'local'))).toBe(true);
  });
});

describe('createChat', () => {
  it('speaks OpenAI: JSON mode, completion tokens, no temperature for reasoning models', async () => {
    const { f, calls } = fakeFetch(openaiReply('{"a":1}'));
    const out = await createChat('openai', KEY, 'gpt-5-mini', f)(REQ);
    expect(out).toEqual({ text: '{"a":1}', input: 10, output: 5 });
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`);
    expect(calls[0].body).toMatchObject({ model: 'gpt-5-mini', response_format: { type: 'json_object' } });
    expect(calls[0].body.temperature).toBeUndefined();
    expect(calls[0].body.reasoning_effort).toBe('low');
    expect(calls[0].body.max_completion_tokens as number).toBeGreaterThanOrEqual(500);
  });

  it('speaks Anthropic', async () => {
    const { f, calls } = fakeFetch(jsonRes({ content: [{ type: 'text', text: 'hi' }], usage: { input_tokens: 3, output_tokens: 1 } }));
    const out = await createChat('anthropic', KEY, 'claude-haiku-4-5-20251001', f)(REQ);
    expect(out.text).toBe('hi');
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    const h = calls[0].init.headers as Record<string, string>;
    expect(h['x-api-key']).toBe(KEY);
    expect(h['anthropic-version']).toBeTruthy();
    expect(calls[0].body).toMatchObject({ system: 'sys', max_tokens: 500, temperature: 0.7, messages: [{ role: 'user', content: 'hello' }] });
  });

  it('speaks Gemini, with the key in a header and never in the URL', async () => {
    const { f, calls } = fakeFetch(jsonRes({ candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: '{}' }] } }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 } }));
    const out = await createChat('google', KEY, 'gemini-2.5-flash', f)(REQ);
    expect(out.text).toBe('{}');
    expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(calls[0].url).not.toContain(KEY);
    expect((calls[0].init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
    expect(calls[0].body.generationConfig?.responseMimeType).toBe('application/json');
  });

  it('drops a field the model refuses and tries again', async () => {
    const { f, calls } = fakeFetch(
      jsonRes({ error: { message: "Unsupported parameter: 'temperature' is not supported with this model." } }, 400),
      openaiReply('ok'),
    );
    const chat = createChat('groq', KEY, 'some-model', f);
    expect((await chat(REQ)).text).toBe('ok');
    expect(calls[0].body.temperature).toBe(0.7);
    expect(calls[1].body.temperature).toBeUndefined();
  });

  it('drops reasoning effort for a model that will not take it', async () => {
    const { f, calls } = fakeFetch(
      jsonRes({ error: { message: "Unrecognized request argument supplied: reasoning_effort" } }, 400),
      openaiReply('ok'),
    );
    expect((await createChat('openai', KEY, 'gpt-5-chat-latest', f)(REQ)).text).toBe('ok');
    expect(calls[0].body.reasoning_effort).toBe('low');
    expect(calls[1].body.reasoning_effort).toBeUndefined();
  });

  it('retries once when the provider is busy', async () => {
    const { f, calls } = fakeFetch(jsonRes({ error: { message: 'slow down' } }, 429, { 'retry-after': '0' }), openaiReply('ok'));
    expect((await createChat('deepseek', KEY, 'deepseek-chat', f)(REQ)).text).toBe('ok');
    expect(calls).toHaveLength(2);
  }, 10_000);

  it('fails at once on a rejected key, without the key in the message', async () => {
    const { f, calls } = fakeFetch(jsonRes({ error: { message: `Incorrect API key provided: ${KEY}` } }, 401));
    const err = await createChat('openai', KEY, 'gpt-5-mini', f)(REQ).catch(e => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.code).toBe('auth');
    expect(err.message).not.toContain(KEY);
    expect(calls).toHaveLength(1);
  });

  it('tells quota from rate limits', async () => {
    const { f } = fakeFetch(jsonRes({ error: { message: 'You exceeded your current quota' } }, 429));
    const err = await createChat('openai', KEY, 'gpt-5-mini', f)(REQ).catch(e => e);
    expect(err.code).toBe('quota');
  });
});

describe('listModels', () => {
  it('keeps chat models and puts the suggested ones first', async () => {
    const { f } = fakeFetch(jsonRes({ data: [{ id: 'whisper-1' }, { id: 'text-embedding-3-small' }, { id: 'gpt-4o-mini' }, { id: 'gpt-5-mini' }, { id: 'aaa-chat' }] }));
    const { models } = await listModels('openai', KEY, f);
    expect(models.map(m => m.id)).toEqual(['gpt-5-mini', 'gpt-4o-mini', 'aaa-chat']);
    expect(pickModel('openai', models)).toBe('gpt-5-mini');
  });

  it('leaves out the OpenAI models only its Responses API serves', async () => {
    const { f } = fakeFetch(jsonRes({ data: ['gpt-5', 'gpt-5-pro', 'o3-pro-2025-06-10', 'gpt-5-codex', 'codex-mini-latest', 'o3-deep-research', 'sora-2', 'o3'].map(id => ({ id })) }));
    const { models } = await listModels('openai', KEY, f);
    expect(models.map(m => m.id).sort()).toEqual(['gpt-5', 'o3']);
  });

  it('checks an OpenRouter key on its own endpoint', async () => {
    const { f, calls } = fakeFetch(jsonRes({ error: { message: 'No auth credentials found' } }, 401));
    await expect(listModels('openrouter', KEY, f)).rejects.toMatchObject({ code: 'auth' });
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/key');
  });

  it('falls back to the known names when a provider cannot list', async () => {
    const { f } = fakeFetch(jsonRes({}, 404));
    const out = await listModels('qwen', KEY, f);
    expect(out.listed).toBe(false);
    expect(out.models[0].id).toBe('qwen-plus');
  });
});

describe('local models', () => {
  const routes = (map: Record<string, unknown>) => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const hit = Object.entries(map).find(([k]) => String(url).startsWith(k));
      if (!hit) throw new TypeError('fetch failed');
      return jsonRes(hit[1]);
    });
    return { f: f as unknown as typeof fetch, calls };
  };
  afterEach(() => { forgetLocalOrigin(); vi.unstubAllEnvs(); });

  it('uses the owner\'s address, finds the usual servers in development, and is off in production', async () => {
    expect(await localOrigin(routes({}).f, { AI_LOCAL_BASE_URL: 'http://gpu-box:8000/v1/', NODE_ENV: 'production' })).toBe('http://gpu-box:8000/v1');
    expect(await localOrigin(routes({}).f, { NODE_ENV: 'production' })).toBe('');
    expect(whyNoLocal({ NODE_ENV: 'production' })).toMatch(/AI_LOCAL_BASE_URL/);
    const { f, calls } = routes({ 'http://127.0.0.1:8080/v1/models': { data: [{ id: 'glm-4.7-flash' }] } });
    expect(await localOrigin(f, { NODE_ENV: 'development' })).toBe('http://127.0.0.1:8080/v1');
    expect(calls.map(c => c.url)).toEqual(['http://127.0.0.1:11434/v1/models', 'http://127.0.0.1:8080/v1/models']);
    await localOrigin(f, { NODE_ENV: 'development' });
    expect(calls).toHaveLength(2);
  });

  it('lists what the server has, keeping instruct models, with no key unless one is set', async () => {
    vi.stubEnv('AI_LOCAL_BASE_URL', 'http://127.0.0.1:8080/v1');
    const { f, calls } = routes({ 'http://127.0.0.1:8080/v1/models': { data: [{ id: 'qwen3-8b-instruct' }, { id: 'nomic-embed-text' }, { id: 'glm-4.7-flash' }] } });
    const { models } = await listModels('local', '', f);
    expect(models.map(m => m.id)).toEqual(['glm-4.7-flash', 'qwen3-8b-instruct']);
    expect((calls[0].init?.headers as Record<string, string>).authorization).toBeUndefined();
    expect(pickModel('local', models)).toBe('glm-4.7-flash');
    expect(PROVIDERS.find(p => p.id === 'local')).toMatchObject({ needsKey: false });
  });

  it('chats with the first model when none is named, at the local address', async () => {
    vi.stubEnv('AI_LOCAL_BASE_URL', 'http://127.0.0.1:8080/v1');
    vi.stubEnv('AI_LOCAL_API_KEY', 'local-secret-123');
    const { f, calls } = routes({
      'http://127.0.0.1:8080/v1/models': { data: [{ id: 'glm-4.7-flash' }] },
      'http://127.0.0.1:8080/v1/chat/completions': { choices: [{ message: { content: '{"say":"hi"}' } }], usage: { prompt_tokens: 3, completion_tokens: 2 } },
    });
    const out = await createChat('local', '', '', f)(REQ);
    expect(out.text).toBe('{"say":"hi"}');
    const chat = calls.find(c => c.url.endsWith('/chat/completions'))!;
    expect(JSON.parse(String(chat.init?.body)).model).toBe('glm-4.7-flash');
    expect((chat.init?.headers as Record<string, string>).authorization).toBe('Bearer local-secret-123');
  });

  it('says plainly when nothing is running', async () => {
    vi.stubEnv('AI_LOCAL_BASE_URL', '');
    await expect(listModels('local', '', routes({}).f)).rejects.toThrow(/No local model server answered|off on this server/);
  });
});

describe('streaming', () => {
  const sse = (events: unknown[]) => new Response(events.map(e => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
  const collect = () => {
    const got: { kind: string; text: string }[] = [];
    return { got, onDelta: (d: { kind: string; text: string }) => { got.push(d); } };
  };
  const joined = (got: { kind: string; text: string }[], kind: string) => got.filter(d => d.kind === kind).map(d => d.text).join('');

  it('streams OpenAI-compatible reasoning and text, and returns the whole answer', async () => {
    const { f, calls } = fakeFetch(sse([
      { choices: [{ delta: { reasoning_content: 'The user wants ' } }] },
      { choices: [{ delta: { reasoning_content: 'Frankfurt.' } }] },
      { choices: [{ delta: { content: '{"say":"Fly' } }] },
      { choices: [{ delta: { content: 'ing."}' } }] },
      { choices: [], usage: { prompt_tokens: 40, completion_tokens: 9 } },
      '[DONE]',
    ]));
    const { got, onDelta } = collect();
    const out = await createChat('openai', KEY, 'gpt-4o-mini', f)({ ...REQ, onDelta });
    expect(calls[0].body).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    expect(out).toEqual({ text: '{"say":"Flying."}', input: 40, output: 9 });
    expect(joined(got, 'reasoning')).toBe('The user wants Frankfurt.');
    expect(joined(got, 'text')).toBe('{"say":"Flying."}');
  });

  it('turns inline <think> into reasoning, and keeps it out of the answer', async () => {
    vi.stubEnv('AI_LOCAL_BASE_URL', 'http://127.0.0.1:8080/v1');
    const { f } = fakeFetch(sse([
      { choices: [{ delta: { content: '<thi' } }] },
      { choices: [{ delta: { content: 'nk>plan: go_to</th' } }] },
      { choices: [{ delta: { content: 'ink>\n{"say":"ok"}' } }] },
    ]));
    const { got, onDelta } = collect();
    const out = await createChat('local', '', 'qwen3', f)({ ...REQ, onDelta });
    expect(out.text).toBe('{"say":"ok"}');
    expect(joined(got, 'reasoning')).toBe('plan: go_to');
    expect(joined(got, 'text')).toBe('{"say":"ok"}');
    vi.unstubAllEnvs();
  });

  it('streams Anthropic and Gemini thinking and text', async () => {
    const a = fakeFetch(sse([
      { type: 'message_start', message: { usage: { input_tokens: 12 } } },
      { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Hmm.' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } },
      { type: 'message_delta', usage: { output_tokens: 3 } },
    ]));
    const ga = collect();
    expect(await createChat('anthropic', KEY, 'claude-haiku-4-5-20251001', a.f)({ ...REQ, onDelta: ga.onDelta })).toEqual({ text: 'Hi', input: 12, output: 3 });
    expect(a.calls[0].body).toMatchObject({ stream: true });
    expect(joined(ga.got, 'reasoning')).toBe('Hmm.');
    const g = fakeFetch(sse([
      { candidates: [{ content: { parts: [{ text: 'Weighing it.', thought: true }] } }] },
      { candidates: [{ content: { parts: [{ text: 'Answer' }] } }], usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 2 } },
    ]));
    const gg = collect();
    expect(await createChat('google', KEY, 'gemini-2.5-flash', g.f)({ ...REQ, onDelta: gg.onDelta })).toEqual({ text: 'Answer', input: 7, output: 2 });
    expect(g.calls[0].url).toMatch(/:streamGenerateContent\?alt=sse$/);
    expect(joined(gg.got, 'reasoning')).toBe('Weighing it.');
  });

  it('takes a one-piece answer from a host that ignores stream, and stops asking for it when refused', async () => {
    const plain = fakeFetch(openaiReply('{"a":1}'));
    const p = collect();
    expect((await createChat('openai', KEY, 'gpt-4o-mini', plain.f)({ ...REQ, onDelta: p.onDelta })).text).toBe('{"a":1}');
    expect(joined(p.got, 'text')).toBe('{"a":1}');
    const refused = fakeFetch(jsonRes({ error: { message: 'stream is not supported' } }, 400), openaiReply('{"b":2}'));
    const r = collect();
    expect((await createChat('openai', KEY, 'gpt-4o-mini', refused.f)({ ...REQ, onDelta: r.onDelta })).text).toBe('{"b":2}');
    expect(refused.calls[1].body.stream).toBeUndefined();
    expect(r.got[0]).toEqual({ kind: 'reset', text: '' });
  });
});

describe('a local address the reader types', () => {
  it('reads host:port, keeps localhost on IPv4, refuses the malformed, and is refused in production', () => {
    expect(readerLocal('127.0.0.1:8080', { NODE_ENV: 'development' })).toEqual({ url: 'http://127.0.0.1:8080/v1' });
    expect(readerLocal('localhost:11434', { NODE_ENV: 'development' })).toEqual({ url: 'http://127.0.0.1:11434/v1' });
    expect(readerLocal('https://gpu.lan:8443/openai/v1/', { NODE_ENV: 'development' })).toEqual({ url: 'https://gpu.lan:8443/openai/v1' });
    expect(readerLocal('', { NODE_ENV: 'development' })).toBeNull();
    expect(readerLocal('user:pw@host', { NODE_ENV: 'development' })).toHaveProperty('error');
    expect(readerLocal('127.0.0.1:8080', { NODE_ENV: 'production' })).toHaveProperty('error');
    expect(readerLocal('127.0.0.1:8080', { NODE_ENV: 'production', AI_LOCAL_ALLOW_CUSTOM: '1' })).toEqual({ url: 'http://127.0.0.1:8080/v1' });
  });
});
