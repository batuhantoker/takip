/**
 * The model providers AI can run on, with the visitor's own key.
 *
 * Each provider is a fixed origin. There is deliberately no "custom base URL":
 * the server makes these requests, and a caller-chosen URL would turn the
 * engine into a relay into anything the server can reach. Local models are the
 * one configurable origin, and only the server's owner sets it (AI_LOCAL_BASE_URL).
 *
 * Keys are used for the request in hand and never stored, logged or echoed.
 * Every message that leaves this module has been through `scrub`.
 */

export type ProviderId =
  | 'openai' | 'anthropic' | 'google' | 'openrouter' | 'groq' | 'deepseek' | 'xai' | 'mistral' | 'qwen' | 'local' | 'demo';

type Wire = 'openai' | 'anthropic' | 'google' | 'demo';

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  /** Where a visitor gets a key. */
  keyUrl: string;
  /** What a key looks like, for the placeholder. */
  keyHint: string;
  defaultModel: string;
  /** Shown before the key is checked, and used when a provider cannot list its models. */
  suggested: string[];
  /** Calls in flight at once for one run. Free tiers are tight on some. */
  concurrency: number;
  /** False for local models and the scripted demo. */
  needsKey: boolean;
}

export interface ProviderDef extends ProviderInfo {
  wire: Wire;
  base: string;
}

const DEFS: ProviderDef[] = ([
  {
    id: 'openai', name: 'OpenAI', wire: 'openai', base: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-…',
    defaultModel: 'gpt-5-mini', suggested: ['gpt-5-mini', 'gpt-5', 'gpt-4.1-mini', 'gpt-4o-mini'], concurrency: 5,
  },
  {
    id: 'anthropic', name: 'Anthropic', wire: 'anthropic', base: 'https://api.anthropic.com/v1',
    keyUrl: 'https://console.anthropic.com/settings/keys', keyHint: 'sk-ant-…',
    defaultModel: 'claude-haiku-4-5-20251001',
    suggested: ['claude-haiku-4-5-20251001', 'claude-sonnet-5-5', 'claude-opus-5-5'], concurrency: 4,
  },
  {
    id: 'google', name: 'Google Gemini', wire: 'google', base: 'https://generativelanguage.googleapis.com/v1beta',
    keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza…',
    defaultModel: 'gemini-2.5-flash', suggested: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'], concurrency: 4,
  },
  {
    id: 'openrouter', name: 'OpenRouter', wire: 'openai', base: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/keys', keyHint: 'sk-or-…',
    defaultModel: 'google/gemini-2.5-flash',
    suggested: ['google/gemini-2.5-flash', 'anthropic/claude-haiku-4.5', 'openai/gpt-5-mini', 'deepseek/deepseek-chat'], concurrency: 4,
  },
  {
    id: 'groq', name: 'Groq', wire: 'openai', base: 'https://api.groq.com/openai/v1',
    keyUrl: 'https://console.groq.com/keys', keyHint: 'gsk_…',
    defaultModel: 'llama-3.3-70b-versatile', suggested: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b'], concurrency: 2,
  },
  {
    id: 'deepseek', name: 'DeepSeek', wire: 'openai', base: 'https://api.deepseek.com',
    keyUrl: 'https://platform.deepseek.com/api_keys', keyHint: 'sk-…',
    defaultModel: 'deepseek-chat', suggested: ['deepseek-chat', 'deepseek-reasoner'], concurrency: 4,
  },
  {
    id: 'xai', name: 'xAI Grok', wire: 'openai', base: 'https://api.x.ai/v1',
    keyUrl: 'https://console.x.ai', keyHint: 'xai-…',
    defaultModel: 'grok-3-mini', suggested: ['grok-3-mini', 'grok-4'], concurrency: 4,
  },
  {
    id: 'mistral', name: 'Mistral', wire: 'openai', base: 'https://api.mistral.ai/v1',
    keyUrl: 'https://console.mistral.ai/api-keys', keyHint: '32 characters',
    defaultModel: 'mistral-small-latest', suggested: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'], concurrency: 3,
  },
  {
    // Alibaba Cloud's international endpoint: the Qwen models MiroFish recommends.
    id: 'qwen', name: 'Qwen (Alibaba Cloud)', wire: 'openai', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    keyUrl: 'https://modelstudio.console.alibabacloud.com/', keyHint: 'sk-…',
    defaultModel: 'qwen-plus', suggested: ['qwen-plus', 'qwen-max', 'qwen-turbo'], concurrency: 4,
  },
  {
    // Any OpenAI-compatible server on the TAKIP server's own machine or network: Ollama, LM Studio, llama.cpp, vLLM.
    id: 'local', name: 'Local models', wire: 'openai', base: '',
    keyUrl: '', keyHint: 'no key needed', defaultModel: (process.env.AI_LOCAL_MODEL || process.env.OI_LOCAL_MODEL)?.trim() ?? '',
    suggested: [], concurrency: Math.max(1, Math.min(8, Number(process.env.AI_LOCAL_CONCURRENCY || process.env.OI_LOCAL_CONCURRENCY) || 2)),
  },
  {
    // Scripted answers for development and tests: the whole pipeline, no key, no cost. Never offered in production.
    id: 'demo', name: 'Demo (scripted, dev only)', wire: 'demo', base: '',
    keyUrl: '', keyHint: 'no key needed', defaultModel: 'scripted', suggested: ['scripted'], concurrency: 4,
  },
] as Omit<ProviderDef, 'needsKey'>[])
  .filter(d => d.id !== 'demo' || process.env.NODE_ENV !== 'production')
  .map(d => ({ ...d, needsKey: d.id !== 'demo' && d.id !== 'local' }));

/** The key for a local server: the reader's, else the one its owner set (vLLM and LM Studio can require one). */
export const localKey = (key: string, env: Record<string, string | undefined> = process.env) => key || (env.AI_LOCAL_API_KEY || env.OI_LOCAL_API_KEY)?.trim() || '';

/** Local hardware is slower than a provider's: every call gets this many times as long. */
export const LOCAL_TIME_SCALE = 4;

export const BY_ID = new Map(DEFS.map(d => [d.id, d]));

const publicInfo = (d: ProviderDef): ProviderInfo => ({
  id: d.id, name: d.name, keyUrl: d.keyUrl, keyHint: d.keyHint, defaultModel: d.defaultModel,
  suggested: d.suggested, concurrency: d.concurrency, needsKey: d.needsKey,
});

/** Public descriptions, without the wire details. */
export const PROVIDERS: ProviderInfo[] = DEFS.map(publicInfo);

export function isProviderId(v: unknown): v is ProviderId {
  return typeof v === 'string' && BY_ID.has(v as ProviderId);
}

export function providerInfo(id: ProviderId): ProviderInfo {
  return publicInfo(BY_ID.get(id)!);
}

/** A key we are willing to forward: printable, no whitespace, a sane length. */
export function isPlausibleKey(key: unknown): key is string {
  return typeof key === 'string' && key.length >= 8 && key.length <= 400 && /^[\x21-\x7e]+$/.test(key);
}

/** A model id we are willing to put in a request (and, for Gemini, a path). */
export function isPlausibleModel(model: unknown): model is string {
  return typeof model === 'string' && model.length >= 1 && model.length <= 120 && /^[A-Za-z0-9._:/@+-]+$/.test(model)
    && !model.includes('..');
}

/** OpenAI's reasoning families take no temperature and count tokens as completion tokens. */
export function openaiReasoning(model: string): boolean {
  return /^(?:o\d|gpt-5)/i.test(model.replace(/^openai\//, ''));
}

/**
 * Whether a model is likely to read pictures, so a camera's frame is worth
 * sending. A guess from the name: a model that turns out not to is asked again
 * with words alone (see relaxFor), so a wrong guess costs one refused call.
 */
export function canSeeImages(provider: ProviderId, model: string): boolean {
  const m = model.toLowerCase();
  switch (provider) {
    case 'anthropic': case 'google': return true;
    case 'openai': return /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-5|^o[134]/.test(m);
    case 'openrouter': return /gemini|claude|gpt-4o|gpt-4\.1|gpt-5|llama-4|pixtral|qwen.*vl|grok-4|vision|\/o[34]/.test(m);
    case 'groq': return /llama-4|vision/.test(m);
    case 'xai': return /grok-4|vision/.test(m);
    case 'mistral': return /pixtral|mistral-(small|medium)|magistral/.test(m);
    case 'qwen': return /vl|omni|qvq/.test(m);
    case 'local': return /llava|vision|[-.]vl\b|vl:|qwen2\.5vl|gemma3|minicpm-v|moondream|pixtral|mistral-small3|granite3\.2-vision|internvl/.test(m);
    default: return false;
  }
}
