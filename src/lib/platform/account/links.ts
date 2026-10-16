/** Where emailed links and provider redirects land: back on the map, which opens the account dialog in the right state. */
export const VERIFIED_CALLBACK = '/?account=verified';
export const RESET_CALLBACK = '/?account=reset-password';
export const SIGN_IN_FAILED_CALLBACK = '/?account=sign-in-failed';
export const SETTINGS_CALLBACK = '/?account=settings';
export const DELETED_CALLBACK = '/?account=deleted';
export const SIGN_IN_LINK = '/?account=sign-in';

export type AccountLink =
  | { kind: 'verified' }
  | { kind: 'verify-failed' }
  | { kind: 'reset'; token: string }
  | { kind: 'reset-failed' }
  | { kind: 'sign-in-failed'; error: string }
  | { kind: 'settings'; error?: string }
  | { kind: 'deleted' }
  // A deletion link that didn't work (apps/api/src/auth/routes.ts).
  | { kind: 'delete-failed'; error: string }
  | { kind: 'sign-in' }
  | { kind: 'sign-up' };

/** The state a link landed with, and the same URL without it. */
export function readAccountLink(href: string): { link: AccountLink; cleanUrl: string } | null {
  const url = new URL(href);
  const account = url.searchParams.get('account');
  const error = url.searchParams.get('error') ?? undefined;
  const token = url.searchParams.get('token');

  let link: AccountLink;
  switch (account) {
    case 'verified': link = { kind: error ? 'verify-failed' : 'verified' }; break;
    case 'reset-password': link = !error && token ? { kind: 'reset', token } : { kind: 'reset-failed' }; break;
    case 'sign-in-failed': link = { kind: 'sign-in-failed', error: error ?? '' }; break;
    case 'settings': link = error ? { kind: 'settings', error } : { kind: 'settings' }; break;
    case 'deleted': link = { kind: 'deleted' }; break;
    case 'delete-failed': link = { kind: 'delete-failed', error: error ?? '' }; break;
    case 'sign-in': link = { kind: 'sign-in' }; break;
    case 'sign-up': link = { kind: 'sign-up' }; break;
    default: return null;
  }

  for (const key of ['account', 'error', 'error_description', 'token']) url.searchParams.delete(key);
  return { link, cleanUrl: `${url.pathname}${url.search}${url.hash}` };
}
