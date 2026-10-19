/**
 * AI as a service: request parsing and the operations the REST API
 * and the MCP server both expose, so the two cannot drift apart.
 *
 * Model keys arrive in the X-AI-Key header only, never in a URL or a tool
 * argument, where they would end up in logs and transcripts. Authorization is
 * reserved for TAKIP's own API keys and sessions.
 */
import { NextResponse } from 'next/server';
import { getClientIp, isRateLimited } from '@/lib/core/net/ssrf-guard';
import { publicOrigin } from '@/lib/platform/site/origin';
import { DEPTHS, estimateCalls, SEED_MAX, type SeedScope } from './depths';
import { askRun } from './engine/ask';
import { replyLocale } from './prompts/language';
import { PROVIDERS, isPlausibleKey, isPlausibleModel, isProviderId, providerInfo, type ProviderId } from './providers/catalog';
import { ProviderError } from './providers/errors';
import { readerLocal } from './providers/local';
import { createChat, type ChatFn } from './providers/chat';
import { LIMITS, startRun, type Run, type StartDeps } from './runs';
import { oneOf, text } from './parse/values';
import type { Depth } from './types';
import type { Locale } from '@/lib/core/i18n/locales';

export const AI_VERSION = '1.0.0';

export const CREDIT = 'Method after MiroFish (github.com/666ghj/MiroFish), rebuilt natively for TAKIP.';

export function disabled(): boolean {
  return (process.env.AI_DISABLED || process.env.OI_DISABLED) === '1';
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return json({ error, ...extra }, status);
}

export function disabledResponse() {
  return fail(503, 'TI is switched off on this server.');
}

/** This site's public origin, for watch links. */
export function siteOrigin(req: Request): string {
  const configured = process.env.AI_PUBLIC_ORIGIN || process.env.OI_PUBLIC_ORIGIN;
  if (configured && /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(configured)) return configured;
  return publicOrigin(req.headers);
}

/** A JSON body, capped in size. Null when it is missing, too big or not an object. */
export async function readBody(req: Request, max = 64_000): Promise<Record<string, unknown> | null> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > max) return null;
  const raw = await req.text().catch(() => '');
  if (raw.length > max) return null;
  if (!raw.trim()) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export interface Credentials {
  provider?: ProviderId;
  key?: string;
  model?: string;
  /** A local model address the reader chose (X-AI-Base), where the server allows one. */
  base?: string;
  /** The language the reader reads (X-AI-Lang), for what TI writes to them. */
  lang?: Locale;
}

/** Deprecated for one release: a model key in Authorization: Bearer. Never a TAKIP API key (`tk_`), which shares the header. */
function legacyBearerKey(auth: string): string {
  const token = /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, '').trim() : '';
  if (!token || token.startsWith('tk_')) return '';
  console.warn('[TAKIP] AI: model key sent in Authorization: Bearer, which is deprecated; clients should send X-AI-Key.');
  return token;
}

/** An X-AI-* header, or the X-OI-* name it had before 2026-10-16, which older clients still send. */
export const aiHeader = (req: Request, name: string) => req.headers.get(`x-ai-${name}`) ?? req.headers.get(`x-oi-${name}`);

/** Provider, key and model from the headers, the provider and model also from the body. */
export function credentials(req: Request, body: Record<string, unknown> = {}): Credentials | { error: string } {
  const h = (name: string) => aiHeader(req, name)?.trim() || '';
  const key = h('key') || legacyBearerKey(req.headers.get('authorization')?.trim() || '');
  const providerRaw = h('provider') || (typeof body.provider === 'string' ? body.provider : '');
  const modelRaw = h('model') || (typeof body.model === 'string' ? body.model : '');
  if (providerRaw && !isProviderId(providerRaw.toLowerCase())) {
    return { error: `Unknown provider. Use one of: ${PROVIDERS.map(p => p.id).join(', ')}.` };
  }
  if (key && !isPlausibleKey(key)) return { error: 'That does not look like an API key.' };
  if (modelRaw && !isPlausibleModel(modelRaw)) return { error: 'That does not look like a model id.' };
  const provider = providerRaw ? (providerRaw.toLowerCase() as ProviderId) : undefined;
  const local = provider === 'local' ? readerLocal(h('base')) : null;
  if (local && 'error' in local) return { error: local.error };
  return {
    provider,
    key: key || undefined,
    model: modelRaw || undefined,
    ...(local ? { base: local.url } : {}),
    lang: replyLocale(h('lang')),
  };
}

/** Free text for a seed: newlines kept, control characters out, capped. */
export function seedText(v: unknown, max = SEED_MAX): string {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

export interface PredictArgs {
  question?: unknown;
  seed?: unknown;
  seed_scope?: unknown;
  depth?: unknown;
  use_feeds?: unknown;
}

export type Started = { ok: true; run: Run } | { ok: false; status: number; error: string };

/** Validates a prediction request and starts the run. */
export function startPrediction(args: PredictArgs, creds: Credentials, ip: string, deps: StartDeps = {}): Started {
  const question = text(args.question, 500);
  if (question.length < 8) return { ok: false, status: 400, error: 'Ask a question of at least a few words (8–500 characters).' };
  if (!creds.provider) return { ok: false, status: 400, error: 'Choose a provider (X-AI-Provider).' };
  const info = providerInfo(creds.provider);
  if (!creds.key && info.needsKey) return { ok: false, status: 401, error: `An API key for ${info.name} is required in the X-AI-Key header.` };
  const depth = oneOf(args.depth, ['quick', 'standard', 'deep'] as const, 'standard') as Depth;
  return startRun({
    question,
    seed: seedText(args.seed),
    seedScope: oneOf(args.seed_scope, ['brief', 'panel'] as const, 'brief') as SeedScope,
    depth,
    useFeeds: args.use_feeds !== false && args.use_feeds !== 'false',
    provider: creds.provider,
    model: creds.model || info.defaultModel,
    key: creds.key ?? '',
    base: creds.base,
    lang: creds.lang,
    ip,
  }, deps);
}

export type Asked = { ok: true; reply: string; target: string } | { ok: false; status: number; error: string };

/** One question to the report agent or an actor that played, on the caller's key. */
export async function askPrediction(run: Run, targetRaw: unknown, messageRaw: unknown, creds: Credentials, signal?: AbortSignal, chat?: ChatFn): Promise<Asked> {
  const message = text(messageRaw, 1000);
  if (message.length < 2) return { ok: false, status: 400, error: 'Ask something.' };
  const target = typeof targetRaw === 'string' && targetRaw.trim() ? targetRaw.trim().toLowerCase().slice(0, 40) : 'report';
  const provider = creds.provider ?? (isProviderId(run.state.provider) ? run.state.provider : undefined);
  if (!provider) return { ok: false, status: 400, error: 'Choose a provider (X-AI-Provider).' };
  if (!creds.key && providerInfo(provider).needsKey) return { ok: false, status: 401, error: 'Asking uses your own key again, in the X-AI-Key header.' };
  const model = creds.model || (provider === run.state.provider ? run.state.model : providerInfo(provider).defaultModel);
  try {
    const { reply } = await askRun(run.state, target, message, chat ?? createChat(provider, creds.key ?? '', model, undefined, creds.base), signal, creds.lang);
    return { ok: true, reply, target };
  } catch (err) {
    if (err instanceof ProviderError) {
      const status = err.code === 'auth' ? 401 : err.code === 'quota' ? 402 : err.code === 'rate' ? 429 : err.code === 'model' ? 400 : 502;
      return { ok: false, status, error: err.message };
    }
    return { ok: false, status: 400, error: err instanceof Error ? err.message : 'Could not ask.' };
  }
}

/** True when this caller has made more than `limit` calls of `bucket` in the window. */
export function limited(req: Request, bucket: string, limit: number, windowMs = 60_000): boolean {
  return isRateLimited(`ai:${bucket}:${getClientIp(req)}`, limit, windowMs);
}

/** What the service offers, for GET /api/ai and the MCP providers tool. */
export function describe(origin: string) {
  return {
    name: 'Takip AI',
    version: AI_VERSION,
    about: 'A prediction engine on live TAKIP intelligence: the actors who decide a question, simulated against each other in parallel worlds. Bring your own model key.',
    credit: CREDIT,
    providers: PROVIDERS.map(p => ({ id: p.id, name: p.name, default_model: p.defaultModel, suggested_models: p.suggested, key_url: p.keyUrl })),
    depths: (Object.keys(DEPTHS) as Depth[]).map(d => ({ id: d, ...DEPTHS[d], model_calls: estimateCalls(d) })),
    limits: {
      runs_at_once_per_address: LIMITS.perIpActive,
      runs_per_10_minutes_per_address: LIMITS.perIpStarts,
      run_kept_for_hours: LIMITS.ttlMs / 3_600_000,
    },
    auth: 'Send X-AI-Provider and X-AI-Key, optionally X-AI-Model. Keys are used for your run and never stored. Authorization is reserved for TAKIP API keys.',
    endpoints: {
      start: `POST ${origin}/api/ai/runs`,
      run: `GET ${origin}/api/ai/runs/{id}?wait=30`,
      events: `GET ${origin}/api/ai/runs/{id}/events (Server-Sent Events)`,
      ask: `POST ${origin}/api/ai/runs/{id}/ask`,
      inject: `POST ${origin}/api/ai/runs/{id}/inject (X-AI-Run-Token)`,
      cancel: `DELETE ${origin}/api/ai/runs/{id} (X-AI-Run-Token)`,
      models: `POST ${origin}/api/ai/models`,
      mcp: `${origin}/api/mcp`,
      docs: `${origin}/docs`,
    },
  };
}
