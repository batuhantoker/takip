import { app, BrowserWindow, nativeTheme, session, shell } from 'electron';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLATFORMS, SCHEME, appUserAgent, linkIn, linkPath, openable, sameSite } from './links.mjs';
import { setMenu } from './menu.mjs';
import { keepBounds, loadBounds } from './window-state.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const SITE = new URL(process.env.TAKIP_APP_URL ?? 'https://takip.dev');
const SMOKE = process.env.TAKIP_SMOKE;
const OFFLINE = join(here, 'offline', 'index.html');
const SITE_ONLY = new Set(['geolocation', 'media', 'clipboard-read', 'clipboard-sanitized-write', 'notifications']);
// A YouTube or camera frame asks for full screen from its own origin.
const ANY_ORIGIN = new Set(['fullscreen']);

let win = null;
let pending = linkIn(process.argv);

const allowed = (permission, url) => ANY_ORIGIN.has(permission) || (SITE_ONLY.has(permission) && sameSite(url, SITE));

function focus() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function openLink(link) {
  const path = link && linkPath(link);
  if (!path) return;
  if (!win) {
    pending = link;
    return;
  }
  focus();
  // Same web contents, so the sign-in nonce in sessionStorage is still there.
  void win.loadURL(new URL(path, SITE).href);
}

function showOffline(url) {
  void win.loadFile(OFFLINE, { query: { url: sameSite(url, SITE) ? url : SITE.href } });
}

function createWindow() {
  const file = join(app.getPath('userData'), 'window.json');
  const bounds = loadBounds(file);
  win = new BrowserWindow({
    ...bounds,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'TAKIP',
    backgroundColor: '#0A0C0F',
    autoHideMenuBar: process.platform !== 'darwin',
    // Smoke runs draw offscreen, so they work with the display asleep or locked.
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, offscreen: Boolean(SMOKE) },
  });
  if (bounds.maximized) win.maximize();
  keepBounds(win, file);
  win.on('closed', () => {
    win = null;
  });

  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (openable(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  const stayOnSite = event => {
    if (event.isMainFrame === false || sameSite(event.url, SITE)) return;
    event.preventDefault();
    if (openable(event.url)) void shell.openExternal(event.url);
  };
  wc.on('will-navigate', stayOnSite);
  wc.on('will-redirect', stayOnSite);
  wc.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
    // -3 is a load the page itself cancelled.
    if (isMainFrame && code !== -3 && !url.startsWith('file:')) showOffline(url);
  });
  // Cloudflare answers 502/530 while the server is down.
  wc.on('did-navigate', (_event, url, status) => {
    if (status >= 500 && sameSite(url, SITE)) showOffline(url);
  });

  if (SMOKE) {
    void import('./smoke.mjs').then(({ smoke }) => smoke(win, SMOKE));
  } else {
    win.once('ready-to-show', () => win.show());
    setTimeout(() => win && !win.isVisible() && win.show(), 2000);
  }

  const path = pending && linkPath(pending);
  pending = null;
  void win.loadURL(path ? new URL(path, SITE).href : SITE.href);
}

app.on('open-url', (event, link) => {
  event.preventDefault();
  openLink(link);
});

if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    focus();
    openLink(linkIn(argv));
  });

  app.whenReady().then(() => {
    if (app.isPackaged) app.setAsDefaultProtocolClient(SCHEME);
    nativeTheme.themeSource = 'dark';
    const ses = session.defaultSession;
    ses.setUserAgent(appUserAgent(ses.getUserAgent(), version, PLATFORMS[process.platform] ?? 'linux'));
    ses.setPermissionRequestHandler((_wc, permission, callback, details) => callback(allowed(permission, details.requestingUrl)));
    ses.setPermissionCheckHandler((_wc, permission, origin) => allowed(permission, origin));
    setMenu(SITE);
    createWindow();
    app.on('activate', () => {
      if (!win) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' || SMOKE) app.quit();
  });
}
