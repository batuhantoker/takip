/** The apps (apps/mobile, apps/desktop) load takip.dev and add `TAKIPApp/<version> (<platform>)` to their web view's user agent. */
export type AppPlatform = 'ios' | 'android' | 'macos' | 'windows' | 'linux';
export type AppShell = { platform: AppPlatform; version: string };

const TOKEN = /\bTAKIPApp\/(\d+\.\d+\.\d+) \((ios|android|macos|windows|linux)\)/;

export function appShell(userAgent: string | null | undefined): AppShell | null {
  const match = userAgent ? TOKEN.exec(userAgent) : null;
  return match ? { version: match[1], platform: match[2] as AppPlatform } : null;
}

export const isPhoneApp = (shell: AppShell | null) => shell?.platform === 'ios' || shell?.platform === 'android';

/** Every app registers it, so a sign-in finished in the system browser comes back as dev.takip.app://auth?… */
export const APP_SCHEME = 'dev.takip.app';
