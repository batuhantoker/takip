import type { Downloads } from './downloads';
import type { AppPlatform, AppShell } from './shell';

const order = (v: string) => v.split('.').reduce((n, part) => n * 1000 + Number(part), 0);

/**
 * The newest build on /download for this app's system when the running shell is older. A system with a store
 * listing is left to the store: Play signs with its own key, so its copy can't be updated from our APK.
 */
export function appUpdate(shell: AppShell | null, downloads: Downloads | null, stores: Partial<Record<AppPlatform, string>> = {}): string | null {
  if (!shell || !downloads || stores[shell.platform]) return null;
  const versions = downloads.files.filter(f => f.platform === shell.platform).map(f => f.version);
  const latest = versions.sort((a, b) => order(a) - order(b)).at(-1);
  return latest && order(latest) > order(shell.version) ? latest : null;
}
