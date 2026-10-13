import type { Access, BoolEntitlement } from '@takip/core/entitlements';
import { getClientIp } from '@/lib/ssrf-guard';

const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4100';

/** The account a caller's limits are kept against: an API key's owner, or the signed-in user. */
export type Subject = { type: 'user'; id: string };
export type CallerAccess = Access & { subject: Subject | null };
export type AccountAccess = Access & { subject: Subject };

const unavailable = () => Response.json({ error: 'access_unavailable' }, { status: 503 });

/** `/api/v1/me/access` asked with the caller's cookies, address and TAKIP key; null when the api can't be reached. */
async function askApi(request: Request): Promise<Response | null> {
  const headers: Record<string, string> = { cookie: request.headers.get('cookie') ?? '' };
  // Without it the api sees every visitor as this server and limits them all as one client.
  const ip = getClientIp(request);
  if (ip !== 'unknown') headers['x-forwarded-for'] = ip;
  // The same header may carry a model key (lib/oi/service.ts), which must never reach the api.
  const authorization = request.headers.get('authorization')?.trim();
  if (authorization && /^Bearer\s+tk_/i.test(authorization)) headers.authorization = authorization;
  try {
    return await fetch(`${API}/api/v1/me/access`, { headers, signal: AbortSignal.timeout(2000), cache: 'no-store' });
  } catch {
    return null;
  }
}

/** The caller's access, or the response refusing them: the api's own 4xx (a bad key, a ban, a rate limit), else 503. */
async function resolve(request: Request): Promise<CallerAccess | Response> {
  const res = await askApi(request);
  if (!res) return unavailable();
  if (res.status >= 400 && res.status < 500) {
    const retryAfter = res.headers.get('retry-after');
    const body: unknown = await res.json().catch(() => ({ error: 'access_refused' }));
    return Response.json(body, { status: res.status, headers: retryAfter ? { 'Retry-After': retryAfter } : {} });
  }
  if (!res.ok) return unavailable();
  return ((await res.json().catch(() => null)) as CallerAccess | null) ?? unavailable();
}

/** The caller's access, asked of the api with the caller's cookies and address; null when the api can't be reached. */
export async function getAccess(request: Request): Promise<CallerAccess | null> {
  const access = await resolve(request);
  return access instanceof Response ? null : access;
}

/**
 * For a route handler that still lives in the web app: a response to return when the caller's plan
 * doesn't allow `key`, or null to carry on. Fails closed when the api is down.
 */
export async function requireEntitlement(request: Request, key: BoolEntitlement): Promise<Response | null> {
  const access = await resolve(request);
  if (access instanceof Response) return access;
  if (access.entitlements[key]) return null;
  return Response.json({ error: 'entitlement_required', entitlement: key, upgrade_url: '/pricing' }, { status: 403 });
}

/** A signed-in user or an API key, or the response refusing the caller: 401 `sign_in_required` for visitors. Fails closed. */
export async function requireAccount(request: Request): Promise<AccountAccess | Response> {
  const access = await resolve(request);
  if (access instanceof Response) return access;
  if (!access.subject) return Response.json({ error: 'sign_in_required' }, { status: 401 });
  return access as AccountAccess;
}
