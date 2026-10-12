/** The signed-in user's API keys (apps/api/src/keys/routes.ts). Times are epoch ms. */

/** Mirrors apps/api/src/keys/scopes.ts. */
export const API_KEY_SCOPES = ['read:tracks', 'read:events', 'read:series', 'export'] as const;

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: number;
  expiresAt: number | null;
  lastUsedAt: number | null;
};

export type NewApiKey = ApiKey & { key: string };

/** The api's error code, plus the plan's limit when it refused a key over `api.keys.max`. */
export type ApiKeyFailure = { error: string; limit?: number };

type Result<T> = { data: T; failure?: undefined } | { data?: undefined; failure: ApiKeyFailure };

async function send<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(`/api/v1/keys${path}`, { cache: 'no-store', ...init });
    const body = (await res.json().catch(() => ({}))) as T & Partial<ApiKeyFailure>;
    return res.ok ? { data: body } : { failure: { error: body.error ?? `http_${res.status}`, limit: body.limit } };
  } catch {
    return { failure: { error: 'network' } };
  }
}

export const listApiKeys = () => send<{ keys: ApiKey[] }>('');

/** `expiresAt` is a "YYYY-MM-DD" day: the key works until the end of it (UTC). */
export const createApiKey = (input: { name: string; scopes: string[]; expiresAt: string | null }) =>
  send<NewApiKey>('', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });

export const revokeApiKey = (id: string) => send<{ ok: true }>(`/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const isExpired = (key: ApiKey, now = Date.now()) => key.expiresAt !== null && key.expiresAt <= now;

/** The "YYYY-MM-DD" (UTC) `days` from now, for an expiry picked as a duration. */
export const daysFromNow = (days: number, now = Date.now()) => new Date(now + days * 86_400_000).toISOString().slice(0, 10);
