import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { appSignInUrl, SIGN_IN_STATE_KEY } from './handoff';
import { isPhoneApp, type AppShell } from './shell';

// Browser-only. The phone apps' native plugins (apps/mobile); only the calls the site makes.
interface BrowserPlugin {
  open(options: { url: string }): Promise<void>;
  close(): Promise<void>;
}
interface AppPlugin {
  addListener(event: 'appUrlOpen', listener: (event: { url: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'backButton', listener: (event: { canGoBack: boolean }) => void): Promise<PluginListenerHandle>;
  getLaunchUrl(): Promise<{ url: string } | undefined>;
  minimizeApp(): Promise<void>;
}
interface SplashScreenPlugin {
  hide(): Promise<void>;
}
interface FilesystemPlugin {
  writeFile(options: { path: string; data: string; directory: 'CACHE' }): Promise<{ uri: string }>;
}
interface SharePlugin {
  share(options: { title?: string; url?: string; files?: string[]; dialogTitle?: string }): Promise<void>;
}

const Browser = registerPlugin<BrowserPlugin>('Browser');
const App = registerPlugin<AppPlugin>('App');
const SplashScreen = registerPlugin<SplashScreenPlugin>('SplashScreen');
const Filesystem = registerPlugin<FilesystemPlugin>('Filesystem');
const Share = registerPlugin<SharePlugin>('Share');

/** An in-app browser on phones; the desktop app sends every new window to the system browser (apps/desktop). */
export async function openSystemBrowser(shell: AppShell, url: string): Promise<void> {
  if (isPhoneApp(shell)) await Browser.open({ url });
  else window.open(url, '_blank', 'noopener');
}

/** Starts a provider's sign-in in the system browser; the app comes back to /app/verify when it is done. */
export async function startAppSignIn(shell: AppShell, provider: string): Promise<void> {
  const state = crypto.randomUUID();
  sessionStorage.setItem(SIGN_IN_STATE_KEY, state);
  await openSystemBrowser(shell, appSignInUrl(location.origin, provider, `${location.pathname}${location.search}`, state));
}

/** Calls `open` with each link the system hands the app: its sign-in coming back, or a takip.dev link. */
export function onAppLink(open: (link: string) => void): () => void {
  const handle = App.addListener('appUrlOpen', ({ url }) => open(url));
  return () => void handle.then(h => h.remove());
}

/** The link that started the app from cold, which fired before any listener was there. */
export const launchLink = () => App.getLaunchUrl().then(r => r?.url ?? null, () => null);

/** Android's back button; listening replaces Capacitor's own handling (back a page, else quit). */
export function onBackButton(handle: (canGoBack: boolean) => void): () => void {
  const listener = App.addListener('backButton', ({ canGoBack }) => handle(canGoBack));
  return () => void listener.then(h => h.remove());
}

/** Back at the start leaves the app as Android's own apps do, without ending it. */
export const minimizeApp = () => App.minimizeApp().catch(() => {});

const base64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(',') + 1));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/** Hands a file to the share sheet (Save to Files, Drive, Mail…) by way of the app's cache. */
export async function shareFile(blob: Blob, name: string): Promise<void> {
  // A name is a file in the cache folder, never a path: an area called "A/B" would otherwise make a folder.
  const file = name.replace(/[\u0000-\u001f/\\:*?"<>|]+/g, '-').replace(/^\.+/, '') || 'takip-file';
  const { uri } = await Filesystem.writeFile({ path: file, data: await base64(blob), directory: 'CACHE' });
  // Closing the sheet without choosing anything rejects; that isn't a failure.
  await Share.share({ title: name, files: [uri] }).catch(() => {});
}

/** The system share sheet for a link; closing it without choosing rejects, which isn't a failure. */
export const shareLink = (url: string, title: string) => Share.share({ url, title, dialogTitle: title }).catch(() => {});

export const closeSystemBrowser = () => Browser.close().catch(() => {});

export const hideSplash = () => SplashScreen.hide().catch(() => {});
