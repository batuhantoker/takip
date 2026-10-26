import { app } from 'electron';
import { writeFileSync } from 'node:fs';

const SETTLE_MS = Number(process.env.TAKIP_SMOKE_WAIT ?? 15000);
const TOKEN = /\bTAKIPApp\/\d+\.\d+\.\d+ \((macos|windows|linux)\)/;

/** TAKIP_SMOKE=<out.png>: open the site, wait for it to settle, save a picture and what the page saw, then quit. */
export function smoke(win, out) {
  const wc = win.webContents;
  const visited = [];
  wc.on('did-navigate', (_event, url) => visited.push(url));
  const fail = setTimeout(() => {
    console.error('smoke: the page never finished loading');
    app.exit(1);
  }, 60_000);
  wc.once('did-finish-load', () => {
    setTimeout(async () => {
      clearTimeout(fail);
      try {
        writeFileSync(out, (await wc.capturePage()).toPNG());
        const seen = await wc.executeJavaScript(
          `({ url: location.href, title: document.title, userAgent: navigator.userAgent, adScript: !!document.querySelector('script#adsbygoogle'), map: !!document.querySelector('.maplibregl-canvas'), webgl: !!document.createElement('canvas').getContext('webgl2') })`);
        console.log(JSON.stringify({ ...seen, visited }, null, 2));
        app.exit(TOKEN.test(seen.userAgent) ? 0 : 1);
      } catch (error) {
        console.error('smoke:', error);
        app.exit(1);
      }
    }, SETTLE_MS);
  });
}
