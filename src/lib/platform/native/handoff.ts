import { APP_SCHEME, type AppShell } from './shell';

/*
 * Google refuses sign-in inside an app's web view, so an app opens the provider in the system browser:
 * /app/sign-in starts it there, the provider returns to /app/handoff, which mints a one-time token and
 * hands it back on the app's scheme, and the app opens /app/verify, which trades it for a session.
 */
export const APP_SIGN_IN_PATH = '/app/sign-in';
export const APP_HANDOFF_PATH = '/app/handoff';
export const APP_VERIFY_PATH = '/app/verify';

/** sessionStorage key for the nonce an app sign-in must come back with; a link it didn't start is refused. */
export const SIGN_IN_STATE_KEY = 'takip.app.signInState';

/** The same nonce in the system browser's tab, set by /app/sign-in: /app/handoff mints nothing for a visit that didn't start there. */
export const HANDOFF_STATE_KEY = 'takip.app.handoffState';

/** Same-site paths only; anything else goes back to the map. URLs drop tabs and newlines, so "/\t/evil" would become "//evil". */
export function safeReturn(raw: string | null | undefined): string {
  return raw && /^\/(?![/\\])/.test(raw) && !/[\u0000-\u001f\\]/.test(raw) ? raw : '/';
}

const query = (params: Record<string, string>) => new URLSearchParams(params).toString();

export function appSignInUrl(origin: string, provider: string, returnTo: string, state: string): string {
  return `${origin}${APP_SIGN_IN_PATH}?${query({ provider, return: safeReturn(returnTo), state })}`;
}

export function handoffPath(returnTo: string, state: string): string {
  return `${APP_HANDOFF_PATH}?${query({ return: safeReturn(returnTo), state })}`;
}

/** What the system browser opens to give the app its sign-in back: a token, or the provider's error. */
export function appAuthLink(result: { ott: string } | { error: string }, returnTo: string, state: string): string {
  return `${APP_SCHEME}://auth?${query({ ...result, return: safeReturn(returnTo), state })}`;
}

/** Where the app's web view goes for a link the system handed it: its sign-in, a page the widget opens, or a page of this site. */
export function appLinkPath(link: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol === `${APP_SCHEME}:`) {
    if (url.host === 'auth') return `${APP_VERIFY_PATH}${url.search}`;
    // dev.takip.app://open?path=/… from the widget (apps/mobile/ios/App/TAKIPWidget).
    return url.host === 'open' ? safeReturn(url.searchParams.get('path')) : null;
  }
  return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : null;
}

/** App Store rule 4.8: an iPhone app that offers Google or GitHub must offer Sign in with Apple too, so it offers email alone until then. */
export function appProviders<T extends string>(shell: AppShell | null, providers: T[]): T[] {
  return shell?.platform === 'ios' && !providers.includes('apple' as T) ? [] : providers;
}
