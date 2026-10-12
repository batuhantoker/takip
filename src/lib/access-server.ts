import type { Access, BoolEntitlement } from '@takip/core/entitlements';

const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4100';

/** The caller's access, asked of the api with the caller's cookies; null when the api can't be reached. */
export async function getAccess(request: Request): Promise<Access | null> {
  try {
    const res = await fetch(`${API}/api/v1/me/access`, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
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
