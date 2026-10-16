/**
 * Where local models are served: the server owner's AI_LOCAL_BASE_URL, else, in development only,
 * the first of the usual local servers that answers. Never an address a reader sends (see catalog.ts).
 */
import type { FetchLike } from './chat';

/** 127.0.0.1, not localhost: Node tries ::1 first, and llama.cpp listens on IPv4 only. */
export const LOCAL_CANDIDATES = [
  { name: 'Ollama', url: 'http://127.0.0.1:11434/v1' },
  { name: 'llama.cpp', url: 'http://127.0.0.1:8080/v1' },
  { name: 'LM Studio', url: 'http://127.0.0.1:1234/v1' },
  { name: 'vLLM', url: 'http://127.0.0.1:8000/v1' },
];

export const LOCAL_OFF = 'Local models are off on this server: set AI_LOCAL_BASE_URL to an OpenAI-compatible endpoint, such as http://127.0.0.1:11434/v1 for Ollama or http://127.0.0.1:8080/v1 for llama.cpp.';
export const LOCAL_NONE = `No local model server answered. Start one (${LOCAL_CANDIDATES.map(c => `${c.name} on port ${new URL(c.url).port}`).join(', ')}) or set AI_LOCAL_BASE_URL.`;

type Env = Record<string, string | undefined>;

/** The owner's setting, if it is a web address. */
export function configuredLocal(env: Env = process.env): string {
  const set = (env.AI_LOCAL_BASE_URL || env.OI_LOCAL_BASE_URL)?.trim() ?? '';
  return /^https?:\/\/[^\s]+$/i.test(set) ? set.replace(/\/+$/, '') : '';
}

let found: { url: string; at: number } | null = null;
const FOUND_FOR_MS = 60_000;

/** The origin to call, or '' when local models are off (production without a setting) or none answered. A reader's checked address comes first. */
export async function localOrigin(f: FetchLike = fetch, env: Env = process.env, now = Date.now(), chosen?: string): Promise<string> {
  if (chosen) return chosen;
  const set = configuredLocal(env);
  if (set) return set;
  if (env.NODE_ENV === 'production') return '';
  if (found && now - found.at < FOUND_FOR_MS) return found.url;
  for (const c of LOCAL_CANDIDATES) {
    try {
      const res = await f(`${c.url}/models`, { signal: AbortSignal.timeout(1500), cache: 'no-store' });
      const body = res.ok ? await res.json().catch(() => null) as { data?: unknown } | null : null;
      if (Array.isArray(body?.data)) {
        found = { url: c.url, at: now };
        return c.url;
      }
    } catch { /* nothing on that port */ }
  }
  found = null;
  return '';
}

/** Why there is no origin, in words for the reader. */
export const whyNoLocal = (env: Env = process.env) => (env.NODE_ENV === 'production' && !configuredLocal(env) ? LOCAL_OFF : LOCAL_NONE);

/**
 * A local address the reader typed: honoured only where readers may choose one (development, or a server
 * whose owner set AI_LOCAL_ALLOW_CUSTOM=1), since the server is the one that calls it.
 * "127.0.0.1:8080" reads as http://127.0.0.1:8080/v1.
 */
export function readerLocal(raw: string | undefined, env: Env = process.env): { url: string } | { error: string } | null {
  const text = raw?.trim() ?? '';
  if (!text) return null;
  if (env.NODE_ENV === 'production' && (env.AI_LOCAL_ALLOW_CUSTOM || env.OI_LOCAL_ALLOW_CUSTOM) !== '1') {
    return { error: 'This server does not take a local model address from readers: its owner sets AI_LOCAL_BASE_URL.' };
  }
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(text) ? text : `http://${text}`);
  } catch {
    return { error: `"${text.slice(0, 60)}" is not an address: write host:port, such as 127.0.0.1:8080.` };
  }
  if (u.username || u.password || !u.hostname || text.length > 200) return { error: 'Write the local model address as host:port, such as 127.0.0.1:8080.' };
  const path = u.pathname.replace(/\/+$/, '');
  // Node tries ::1 for "localhost" first, where llama.cpp is not listening.
  const host = u.hostname === 'localhost' ? `127.0.0.1${u.port ? `:${u.port}` : ''}` : u.host;
  return { url: `${u.protocol}//${host}${path || '/v1'}` };
}

/** For tests. */
export function forgetLocalOrigin() { found = null; }
