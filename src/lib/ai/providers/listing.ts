import { type ProviderId, BY_ID, isPlausibleModel, localKey } from './catalog';
import { ProviderError } from './errors';
import { type ChatRequest, type FetchLike, type ModelListing, send } from './chat';
import { localOrigin, whyNoLocal } from './local';

export interface ModelEntry {
  id: string;
  name: string;
}

/** Ids that are not chat models: embeddings, speech, images, moderation. */
const NOT_CHAT = /embed|whisper|tts|audio|realtime|transcribe|dall-e|image|moderation|guard|rerank|davinci|babbage|search|computer-use|-instruct$|veo|imagen|aqa|learnlm|gemma-?3n/i;
/** On a local server every name is the owner's choice: only embedding, speech and ranking models are left out ("-instruct" is a chat model here). */
const LOCAL_NOT_CHAT = /embed|whisper|tts|rerank|moderation|guard|bge-|minilm/i;
/** OpenAI models served only by its Responses API, which AI does not use: the pro, codex and deep-research models, and video. */
const OPENAI_RESPONSES_ONLY = /-pro(?:-|$)|codex|deep-research|^sora/i;

/**
 * The models this key can use, from the provider itself. A rejected key fails
 * here, which is why the panel calls this to check a key before a run.
 */
export async function listModels(provider: ProviderId, key: string, f: FetchLike = fetch, localAddress?: string): Promise<{ models: ModelEntry[]; listed: boolean; base?: string }> {
  const def = BY_ID.get(provider);
  if (!def) throw new ProviderError('bad_request', 'Unknown provider');
  if (def.wire === 'demo') return { models: [{ id: 'scripted', name: 'Scripted demo' }], listed: true };
  const base = def.id === 'local' ? await localOrigin(f, undefined, undefined, localAddress) : def.base;
  if (!base) throw new ProviderError('bad_request', whyNoLocal());
  if (def.id === 'local') key = localKey(key);
  const get = async (url: string, headers: Record<string, string>): Promise<ModelListing> => {
    const req: ChatRequest = { system: '', user: '', json: false, maxTokens: 0, timeoutMs: 15_000 };
    return (await send(def, key, url, { method: 'GET', headers }, req, f)) as ModelListing;
  };

  let models: ModelEntry[] = [];
  try {
    if (def.wire === 'anthropic') {
      const j = await get(`${base}/models?limit=100`, { 'x-api-key': key, 'anthropic-version': '2023-06-01' });
      models = (j?.data ?? []).map(m => ({ id: String(m.id), name: String(m.display_name || m.id) }));
    } else if (def.wire === 'google') {
      const j = await get(`${base}/models?pageSize=200`, { 'x-goog-api-key': key });
      models = (j?.models ?? [])
        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => ({ id: String(m.name).replace(/^models\//, ''), name: String(m.displayName || m.name) }));
    } else if (def.id === 'openrouter') {
      // OpenRouter lists models without a key, so check the key on its own.
      await get(`${base}/key`, { authorization: `Bearer ${key}` });
      const j = await get(`${base}/models`, {});
      models = (j?.data ?? []).map(m => ({ id: String(m.id), name: String(m.name || m.id) }));
    } else {
      const j = await get(`${base}/models`, key ? { authorization: `Bearer ${key}` } : {});
      models = (j?.data ?? []).map(m => ({ id: String(m.id), name: String(m.id) }));
    }
  } catch (err) {
    // A provider without a listing endpoint: offer the known names. The key is checked on the first call.
    if (err instanceof ProviderError && (err.status === 404 || err.status === 405)) {
      return { models: def.suggested.map(id => ({ id, name: id })), listed: false };
    }
    throw err;
  }

  const seen = new Set<string>();
  const chat = models
    .filter(m => isPlausibleModel(m.id) && !(def.id === 'local' ? LOCAL_NOT_CHAT : NOT_CHAT).test(m.id) && !(def.id === 'openai' && OPENAI_RESPONSES_ONLY.test(m.id)) && !seen.has(m.id) && seen.add(m.id))
    .slice(0, 500);
  // Suggested models first, in their order, then the rest A–Z.
  const rank = (id: string) => { const i = def.suggested.indexOf(id); return i < 0 ? 1e3 : i; };
  chat.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
  return { models: chat, listed: true, ...(def.id === 'local' ? { base } : {}) };
}

/** The model to preselect: the provider default when the key can use it, else the first suggested one listed, else the first. */
export function pickModel(provider: ProviderId, models: ModelEntry[]): string {
  const def = BY_ID.get(provider)!;
  const ids = new Set(models.map(m => m.id));
  if (ids.has(def.defaultModel)) return def.defaultModel;
  return def.suggested.find(id => ids.has(id)) ?? models[0]?.id ?? def.defaultModel;
}
