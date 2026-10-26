import { appShell, isPhoneApp } from './shell';

/** Saves a file the page made: a download in browsers and the desktop app; the phone apps' web views drop downloads, so there it goes to the share sheet. */
export async function saveFile(blob: Blob, name: string): Promise<void> {
  if (isPhoneApp(appShell(navigator.userAgent))) {
    const { shareFile } = await import('./bridge');
    return shareFile(blob, name);
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
