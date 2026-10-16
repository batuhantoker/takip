import { createDemoChat } from './demo';
import { type ProviderId, type ProviderDef, BY_ID, LOCAL_TIME_SCALE, localKey, openaiReasoning } from './catalog';
import { localOrigin, whyNoLocal } from './local';
import { ProviderError, classify } from './errors';

export interface ChatRequest {
  system: string;
  user: string;
  /** Ask for a JSON object, where the provider can enforce it. */
  json: boolean;
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
  /** Per-call ceiling. */
  timeoutMs?: number;
  /** Pictures for the model to look at with the prompt, base64 without the data: prefix. Dropped by a model that cannot read them. */
  images?: { mime: string; data: string }[];
  /** Streams the answer as it is written: the model's reasoning, where it shows any, and its text. */
  onDelta?: (d: Delta) => void;
}

/** `reset`: the call is being asked again, so what streamed so far is void. */
export interface Delta { kind: 'reasoning' | 'text' | 'reset'; text: string }

export interface ChatResult {
  text: string;
  input: number;
  output: number;
}

export type ChatFn = (req: ChatRequest) => Promise<ChatResult>;

export type FetchLike = typeof fetch;

/**
 * Optional request fields a model may refuse. Reasoning models reject
 * `temperature`; some OpenAI-compatible hosts reject `response_format`; OpenAI's
 * newer models want `max_completion_tokens`. On a 400 naming one of these, the
 * call is repeated without it rather than failing the run.
 */
interface Relax { temperature: boolean; json: boolean; completionTokens: boolean; effort: boolean; images: boolean; stream: boolean }

function relaxFor(message: string, r: Relax, sentImages = false): Relax | null {
  // A text-only model refusing a picture: ask again with words alone. Checked first, since such errors often mention the content's type or mime too.
  if (sentImages && !r.images && /image|vision|multimodal|multi-modal|image_url|inline_?data|content.{0,30}(array|list|type|part)|does not support|not supported|unsupported/i.test(message)) return { ...r, images: true };
  if (!r.stream && /stream/i.test(message)) return { ...r, stream: true };
  if (!r.effort && /reasoning_effort|reasoning effort/i.test(message)) return { ...r, effort: true };
  if (!r.temperature && /temperature/i.test(message)) return { ...r, temperature: true };
  if (!r.completionTokens && /max_tokens|max_completion_tokens/i.test(message)) return { ...r, completionTokens: true };
  if (!r.json && /response_format|json|responseMimeType|mime/i.test(message)) return { ...r, json: true };
  return null;
}

function buildRequest(def: ProviderDef, base: string, key: string, model: string, req: ChatRequest, r: Relax): { url: string; init: RequestInit } {
  const images = !r.images && req.images?.length ? req.images : [];
  const stream = Boolean(req.onDelta) && !r.stream;
  if (def.wire === 'anthropic') {
    return {
      url: `${base}/messages`,
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{
            role: 'user',
            content: images.length
              ? [...images.map(i => ({ type: 'image', source: { type: 'base64', media_type: i.mime, data: i.data } })), { type: 'text', text: req.user }]
              : req.user,
          }],
          ...(req.temperature !== undefined && !r.temperature ? { temperature: req.temperature } : {}),
          ...(stream ? { stream: true } : {}),
        }),
      },
    };
  }
  if (def.wire === 'google') {
    return {
      url: `${base}/models/${encodeURIComponent(model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`,
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: 'user', parts: [...images.map(i => ({ inlineData: { mimeType: i.mime, data: i.data } })), { text: req.user }] }],
          generationConfig: {
            // Thinking models spend from the same budget; leave them room to answer.
            maxOutputTokens: Math.max(req.maxTokens, 8192),
            ...(req.temperature !== undefined && !r.temperature ? { temperature: req.temperature } : {}),
            ...(req.json && !r.json ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      },
    };
  }
  const reasoning = def.id === 'openai' && openaiReasoning(model);
  const completion = r.completionTokens || def.id === 'openai';
  // A local server usually takes no key; one started with --api-key gets it.
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) };
  if (def.id === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/batuhantoker/takip';
    headers['X-Title'] = 'Takip AI';
  }
  return {
    url: `${base}/chat/completions`,
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: req.system },
          {
            role: 'user',
            content: images.length
              ? [{ type: 'text', text: req.user }, ...images.map(i => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.data}` } }))]
              : req.user,
          },
        ],
        // Reasoning models spend completion tokens thinking before they answer.
        ...(completion ? { max_completion_tokens: reasoning ? Math.max(req.maxTokens, 8000) : req.maxTokens } : { max_tokens: req.maxTokens }),
        ...(req.temperature !== undefined && !r.temperature && !reasoning ? { temperature: req.temperature } : {}),
        // A panel turn needs a considered answer, not a long deliberation: low effort keeps a run to minutes.
        ...(reasoning && !r.effort ? { reasoning_effort: 'low' } : {}),
        ...(req.json && !r.json ? { response_format: { type: 'json_object' } } : {}),
        ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
      }),
    },
  };
}

/* What each wire answers with, as far as this module reads it. Every field is optional: providers drift. */
interface AnthropicReply { content?: { type?: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } }
interface GeminiReply {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}
interface OpenAIReply {
  choices?: { message?: { content?: string | (string | { text?: string })[] | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export interface ModelListing {
  data?: { id?: string; name?: string; display_name?: string }[];
  models?: { name?: string; displayName?: string; supportedGenerationMethods?: string[] }[];
}

/** Reasoning some models write inline before the answer, e.g. a local Qwen or DeepSeek without a reasoning parser. */
const THINK = /^\s*<think>[\s\S]*?(?:<\/think>|$)/;
const withoutThink = (text: string) => text.replace(THINK, '').trimStart();

function readResponse(def: ProviderDef, body: unknown): ChatResult {
  const out = readBody(def, body);
  return { ...out, text: withoutThink(out.text) };
}

function readBody(def: ProviderDef, body: unknown): ChatResult {
  if (def.wire === 'anthropic') {
    const j = body as AnthropicReply;
    const text = Array.isArray(j?.content) ? j.content.filter(c => c?.type === 'text').map(c => String(c.text ?? '')).join('') : '';
    return { text, input: num(j?.usage?.input_tokens), output: num(j?.usage?.output_tokens) };
  }
  if (def.wire === 'google') {
    const j = body as GeminiReply;
    const cand = j?.candidates?.[0];
    const parts = Array.isArray(cand?.content?.parts) ? cand.content.parts : [];
    const text = parts.filter(p => !p?.thought).map(p => String(p?.text ?? '')).join('');
    if (!text && (cand?.finishReason === 'SAFETY' || j?.promptFeedback?.blockReason)) {
      throw new ProviderError('bad_request', 'Gemini declined to answer (safety filter)');
    }
    return { text, input: num(j?.usageMetadata?.promptTokenCount), output: num(j?.usageMetadata?.candidatesTokenCount) };
  }
  const j = body as OpenAIReply;
  const content = j?.choices?.[0]?.message?.content;
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content) ? content.map(c => (typeof c === 'string' ? c : String(c?.text ?? ''))).join('') : '';
  return { text, input: num(j?.usage?.prompt_tokens), output: num(j?.usage?.completion_tokens) };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/* ───────────── Streaming ───────────── */

/** The deltas in one server-sent event, by wire, and any usage it reports. */
function eventDeltas(def: ProviderDef, j: Record<string, unknown>): { deltas: Delta[]; input?: number; output?: number } {
  const deltas: Delta[] = [];
  if (def.wire === 'anthropic') {
    const d = j.delta as { type?: string; text?: string; thinking?: string; } | undefined;
    if (j.type === 'content_block_delta' && d?.type === 'text_delta' && d.text) deltas.push({ kind: 'text', text: d.text });
    if (j.type === 'content_block_delta' && d?.type === 'thinking_delta' && d.thinking) deltas.push({ kind: 'reasoning', text: d.thinking });
    const usage = (j.type === 'message_start' ? (j.message as { usage?: Record<string, number> })?.usage : (j.usage as Record<string, number> | undefined));
    return { deltas, input: usage?.input_tokens, output: usage?.output_tokens };
  }
  if (def.wire === 'google') {
    const parts = ((j.candidates as GeminiReply['candidates'])?.[0]?.content?.parts) ?? [];
    for (const p of parts) if (p?.text) deltas.push({ kind: p.thought ? 'reasoning' : 'text', text: p.text });
    const u = j.usageMetadata as GeminiReply['usageMetadata'];
    return { deltas, input: u?.promptTokenCount, output: u?.candidatesTokenCount };
  }
  const d = (j.choices as { delta?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null } }[] | undefined)?.[0]?.delta;
  const thought = d?.reasoning_content ?? d?.reasoning;
  if (thought) deltas.push({ kind: 'reasoning', text: thought });
  if (d?.content) deltas.push({ kind: 'text', text: d.content });
  const u = j.usage as OpenAIReply['usage'] | undefined;
  return { deltas, input: u?.prompt_tokens, output: u?.completion_tokens };
}

/**
 * A streamed answer, read event by event: each piece goes to `onDelta` as it arrives, and the whole
 * comes back like a plain reply. Inline <think> reasoning is passed on as reasoning, not text.
 */
async function sendStream(def: ProviderDef, key: string, url: string, init: RequestInit, req: ChatRequest, f: FetchLike): Promise<ChatResult> {
  const local = def.id === 'local';
  const timeout = AbortSignal.timeout((req.timeoutMs ?? 90_000) * (local ? LOCAL_TIME_SCALE : 1));
  const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await f(url, { ...init, signal, cache: 'no-store' });
  } catch (err) {
    if (req.signal?.aborted) throw req.signal.reason ?? err;
    if (timeout.aborted) throw new ProviderError('timeout', local ? 'The local model did not answer in time: try a smaller model' : `${def.name} did not answer in time`);
    throw new ProviderError('network', local ? `Could not reach the local model server at ${new URL(url).origin}. Is it still running?` : `Could not reach ${def.name}`);
  }
  if (!res.ok) throw classify(res.status, await res.text().catch(() => ''), def.name, key, res.headers.get('retry-after'));
  if (!res.body || !/event-stream/i.test(res.headers.get('content-type') ?? '')) {
    // A host that ignored `stream` answered in one piece.
    const body = await res.json().catch(() => { throw new ProviderError('upstream', `${def.name} sent a reply that was not JSON`); });
    const out = readResponse(def, body);
    if (out.text) req.onDelta?.({ kind: 'text', text: out.text });
    return out;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', text = '', input = 0, output = 0;
  // Inline <think>: undecided until the first characters show whether the answer opens with it.
  let think: 'maybe' | 'in' | 'out' = 'maybe', held = '';
  const emitText = (piece: string) => {
    if (think === 'out') { text += piece; req.onDelta?.({ kind: 'text', text: piece }); return; }
    held += piece;
    if (think === 'maybe') {
      const t = held.trimStart();
      if (!t || '<think>'.startsWith(t)) return;
      if (!t.startsWith('<think>')) { think = 'out'; const all = held; held = ''; emitText(all); return; }
      think = 'in';
      held = t.slice('<think>'.length);
    }
    const end = held.indexOf('</think>');
    if (end < 0) {
      // Keep a possible half-written closing tag back.
      const safe = held.length - 8;
      if (safe > 0) { req.onDelta?.({ kind: 'reasoning', text: held.slice(0, safe) }); held = held.slice(safe); }
      return;
    }
    if (end > 0) req.onDelta?.({ kind: 'reasoning', text: held.slice(0, end) });
    const rest = held.slice(end + '</think>'.length).trimStart();
    think = 'out';
    held = '';
    if (rest) emitText(rest);
  };
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (err) {
      if (req.signal?.aborted) throw req.signal.reason ?? err;
      if (timeout.aborted) throw new ProviderError('timeout', `${def.name} did not finish its answer in time`);
      throw new ProviderError('network', `${def.name} broke off its answer`);
    }
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, '');
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let j: Record<string, unknown>;
      try { j = JSON.parse(data); } catch { continue; }
      if (j.error) throw classify(400, data, def.name, key, null);
      const got = eventDeltas(def, j);
      for (const d of got.deltas) {
        if (d.kind === 'reasoning') req.onDelta?.(d);
        else emitText(d.text);
      }
      if (got.input) input = got.input;
      if (got.output) output = got.output;
    }
  }
  if (think === 'maybe' && held) { think = 'out'; text += held; }
  return { text: withoutThink(text), input, output };
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
});

export async function send(def: ProviderDef, key: string, url: string, init: RequestInit, req: ChatRequest, f: FetchLike): Promise<unknown> {
  const local = def.id === 'local';
  const timeout = AbortSignal.timeout((req.timeoutMs ?? 90_000) * (local ? LOCAL_TIME_SCALE : 1));
  const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await f(url, { ...init, signal, cache: 'no-store' });
  } catch (err) {
    if (req.signal?.aborted) throw req.signal.reason ?? err;
    if (timeout.aborted) throw new ProviderError('timeout', local ? 'The local model did not answer in time: try a smaller model' : `${def.name} did not answer in time`);
    throw new ProviderError('network', local ? `Could not reach the local model server at ${new URL(url).origin}. Is it still running?` : `Could not reach ${def.name}`);
  }
  const body = await res.text().catch(() => '');
  if (!res.ok) throw classify(res.status, body, def.name, key, res.headers.get('retry-after'));
  try {
    return JSON.parse(body);
  } catch {
    throw new ProviderError('upstream', `${def.name} sent a reply that was not JSON`);
  }
}

async function firstLocalModel(key: string, f: FetchLike, address?: string): Promise<string> {
  const { listModels } = await import('./listing');
  const { models } = await listModels('local', key, f, address);
  if (!models[0]) throw new ProviderError('model', 'The local model server has no chat models: pull one first (for example `ollama pull llama3.1`).');
  return models[0].id;
}

/**
 * A chat function bound to one provider, key and model. It retries once on a
 * busy or slow provider, and adapts to the request fields a model refuses.
 */
export function createChat(provider: ProviderId, key: string, model: string, f: FetchLike = fetch, localAddress?: string): ChatFn {
  const def = BY_ID.get(provider);
  if (!def) throw new ProviderError('bad_request', 'Unknown provider');
  if (def.wire === 'demo') return createDemoChat([300, 1400]);
  if (def.id === 'local') key = localKey(key);
  let relax: Relax = { temperature: false, json: false, completionTokens: false, effort: false, images: false, stream: false };
  // No local model named: the first one the server has, asked for once.
  let chosen: Promise<string> | null = def.id === 'local' && !model ? firstLocalModel(key, f, localAddress) : null;

  return async function chat(req: ChatRequest): Promise<ChatResult> {
    const base = def.id === 'local' ? await localOrigin(f, undefined, undefined, localAddress) : def.base;
    if (!base) throw new ProviderError('bad_request', whyNoLocal());
    if (chosen) {
      model = await chosen.catch(err => { chosen = null; throw err; });
      chosen = null;
    }
    let retried = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) req.onDelta?.({ kind: 'reset', text: '' });
      const { url, init } = buildRequest(def, base, key, model, req, relax);
      try {
        const out = req.onDelta && !relax.stream
          ? await sendStream(def, key, url, init, req, f)
          : readResponse(def, await send(def, key, url, init, req, f));
        if (!out.text.trim()) throw new ProviderError('empty', `${def.name} returned an empty answer`);
        return out;
      } catch (err) {
        if (!(err instanceof ProviderError)) throw err;
        if (err.code === 'bad_request') {
          const next = relaxFor(err.message, relax, Boolean(req.images?.length));
          if (next) { relax = next; continue; }
        }
        if ((err.transient || err.code === 'empty') && !retried) {
          retried = true;
          await sleep(err.retryAfterMs || 1500 + Math.random() * 2000, req.signal);
          continue;
        }
        throw err;
      }
    }
    throw new ProviderError('bad_request', `${def.name} refused every form of the request`);
  };
}
