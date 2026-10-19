/** Header lookup, as both `Headers` and `ReadonlyHeaders` from next/headers provide it. */
export type HeaderGetter = { get(name: string): string | null };

const HOST = /^[a-z0-9.-]+(?::\d{1,5})?$/i;
const ORIGIN = /^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?$/i;

/** The configured public address (`SITE_URL`), without a trailing slash, when it is a bare origin. */
export function configuredOrigin(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.SITE_URL?.trim().replace(/\/+$/, '');
  return raw && ORIGIN.test(raw) ? raw : null;
}

/**
 * This site's public origin. `SITE_URL` once the domain exists; until then the address the request
 * came in on, because the NUC's quick-tunnel link changes on every restart.
 */
export function publicOrigin(headers: HeaderGetter | null, env: Record<string, string | undefined> = process.env): string {
  const configured = configuredOrigin(env);
  if (configured) return configured;
  const host = (headers?.get('x-forwarded-host') || headers?.get('host') || '').split(',')[0].trim();
  if (!HOST.test(host)) return 'http://localhost:3000';
  const local = /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host);
  const proto = headers?.get('x-forwarded-proto')?.split(',')[0].trim() || (local ? 'http' : 'https');
  return `${proto === 'http' ? 'http' : 'https'}://${host}`;
}
