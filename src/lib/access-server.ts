import type { Access, BoolEntitlement } from '@takip/core/entitlements';
import { getClientIp } from './ssrf-guard';

const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4100';

/** The caller's access, asked of the api with the caller's cookies and address; null when the api can't be reached. */
export async function getAccess(request: Request): Promise<Access | null> {
  const headers: Record<string, string> = { cookie: request.headers.get('cookie') ?? '' };
  // Without it the api sees every visitor as this server and limits them all as one client.
  const ip = getClientIp(request);
  if (ip !== 'unknown') headers['x-forwarded-for'] = ip;
  try {
    const res = await fetch(`${API}/api/v1/me/access`, {
      headers,
      signal: AbortSignal.timeout(2000),
      cache: 'no-store',
    });
    return res.ok ? ((await res.json()) as Access) : null;
  } catch {
    return null;
  }
}

/**
 * For a route handler that still lives in the web app: a response to return when the caller's plan
 * doesn't allow `key`, or null to carry on. Fails closed when the api is down.
 */
export async function requireEntitlement(request: Request, key: BoolEntitlement): Promise<Response | null> {
  const access = await getAccess(request);
  if (!access) return Response.json({ error: 'access_unavailable' }, { status: 503 });
  if (access.entitlements[key]) return null;
  return Response.json({ error: 'entitlement_required', entitlement: key, upgrade_url: '/pricing' }, { status: 403 });
}
