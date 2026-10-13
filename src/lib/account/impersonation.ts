/** An admin's "view as" session (apps/api/src/admin/impersonation.ts). */

/** A full load rather than a router push: the session cookie just changed, and no state of the old one may survive. */
const loadFresh = (path: string) => window.location.assign(path);

/** Ends it and loads the user's console page with the admin's own session back, or the map signed out when that session ended meanwhile. */
export async function stopImpersonating() {
  const res = await fetch('/api/admin/impersonation/stop', { method: 'POST', cache: 'no-store' }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { userId?: string; restored?: boolean } | null;
  loadFresh(res?.ok && body?.restored && body.userId ? `/admin/users/${encodeURIComponent(body.userId)}` : '/');
}

/** Starts one from the console; the browser is then signed in as the user, so the map is where to go. */
export async function startImpersonating(userId: string, reason: string) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/impersonate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (res.ok) return loadFresh('/');
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(IMPERSONATION_ERRORS[body.error ?? ''] ?? body.error ?? `Request failed (${res.status})`);
}

const IMPERSONATION_ERRORS: Record<string, string> = {
  cannot_impersonate_admin: "Admins can't be viewed as.",
  cannot_impersonate_banned: "Banned users can't be viewed as. Unban them first.",
  invalid_request: 'Give a reason.',
};
