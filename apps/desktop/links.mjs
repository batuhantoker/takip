export const SCHEME = 'dev.takip.app';

export const PLATFORMS = { darwin: 'macos', win32: 'windows', linux: 'linux' };

/** The token src/lib/platform/native/shell.ts reads; the site turns its ads off on it. */
export const appUserAgent = (base, version, platform) => `${base} TAKIPApp/${version} (${platform})`;

/** Only sign-in comes back on the scheme: dev.takip.app://auth?… opens /app/verify with the same query. */
export function linkPath(link) {
  let url;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  return url.protocol === `${SCHEME}:` && url.host === 'auth' ? `/app/verify${url.search}` : null;
}

/** Windows and Linux pass the link as a command-line argument. */
export const linkIn = argv => argv.find(arg => arg.startsWith(`${SCHEME}:`)) ?? null;

export function sameSite(url, site) {
  try {
    return new URL(url).origin === site.origin;
  } catch {
    return false;
  }
}

/** What may leave for the system browser or mail client. */
export const openable = url => /^(https?|mailto):/i.test(url);
