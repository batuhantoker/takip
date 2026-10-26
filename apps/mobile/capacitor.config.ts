import { readFileSync } from 'node:fs';
import type { CapacitorConfig } from '@capacitor/cli';

// The CLI loads this file as CommonJS from this folder.
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

// A dev build can point at a laptop (TAKIP_APP_URL=http://192.168.1.20:3000); store builds load takip.dev.
const url = process.env.TAKIP_APP_URL ?? 'https://takip.dev';
const BACKGROUND = '#0A0C0F';

const config: CapacitorConfig = {
  appId: 'dev.takip.app',
  appName: 'TAKIP',
  // Only the offline page: the app is the live site, so it changes with every web deploy and never needs a store update for it.
  webDir: 'www',
  backgroundColor: BACKGROUND,
  server: {
    url,
    errorPath: 'offline.html',
    cleartext: url.startsWith('http:'),
  },
  ios: {
    appendUserAgent: `TAKIPApp/${version} (ios)`,
    contentInset: 'never',
    backgroundColor: BACKGROUND,
  },
  android: {
    appendUserAgent: `TAKIPApp/${version} (android)`,
    backgroundColor: BACKGROUND,
    webContentsDebuggingEnabled: url.startsWith('http:'),
  },
  plugins: {
    SystemBars: { insetsHandling: 'native', style: 'DARK' },
    // The web hides it once the map shell mounts (components/shell/native/app-links.tsx); the timeout covers the offline page.
    SplashScreen: { launchShowDuration: 4000, launchAutoHide: true, backgroundColor: BACKGROUND, showSpinner: false },
  },
};

export default config;
