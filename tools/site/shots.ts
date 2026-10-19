// Takes the picture of the map each public page leads with: opens the page's own "Open on the map" link in
// headless Chrome with the interface hidden, waits for the data, and saves a JPEG to .cache/site-shots.
//
//   nice npx tsx tools/site/shots.ts [--base http://localhost:3000] [--only slug,slug] [--force] [--wait 16000]
//
// Needs the app running. Map-time and usage calls are answered locally, so the run spends no one's minutes
// and leaves nothing in the analytics.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import WebSocket from 'ws';
import { CONTROL_IDS, OVERLAY_IDS, RAIL_IDS, STATUS_IDS } from '../../src/components/shell/layout/lib/model';
import { LAYER_PAGES, openPath } from '../../src/lib/platform/site/layer-pages';
import type { LayerPage } from '../../src/lib/platform/site/catalog/types';
import { SHOTS_DIR } from '../../src/lib/platform/site/shots';

const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:3000' },
    only: { type: 'string' },
    force: { type: 'boolean' },
    wait: { type: 'string', default: '16000' },
    size: { type: 'string', default: '1600x900' },
  },
});

// Its own port: tools/screenshot.mjs uses 9333, and two sessions' runs would capture each other's tab.
const PORT = 9341;
/** The rail's column, which can't be hidden; the picture starts right of it. */
const RAIL = 72;
const [WIDTH, HEIGHT] = values.size!.split('x').map(Number);
const HIDE_ALL = [
  ...[...RAIL_IDS, 'ai'].map(id => `rail:${id}`), 'statusbar',
  ...STATUS_IDS.map(id => `status:${id}`), ...OVERLAY_IDS.map(id => `overlay:${id}`), ...CONTROL_IDS.map(id => `control:${id}`),
];
// Pictures without words read the same in every language; a panel a page is about stays open.
const BEFORE_LOAD = `try { localStorage.setItem('takip.layout', ${JSON.stringify(JSON.stringify({ v: 1, desktop: { hidden: HIDE_ALL }, phone: { hidden: [] } }))}); } catch {}`;
const MAP_TIME = JSON.stringify({ limit: 0, used: 0, remaining: 0, blocked: false, resetsAt: new Date(Date.now() + 86_400_000).toISOString() });

/** Whole-globe views are framed for a big window; in a 16:9 picture the globe would sit small, so come in a little. */
function shotView(page: LayerPage) {
  const v = page.view;
  return v && v.zoom < 2.6 ? { ...v, zoom: v.zoom + 0.9 } : v;
}

const only = values.only ? new Set(values.only.split(',')) : null;
const pages = LAYER_PAGES.filter(p => !only || only.has(p.slug));
mkdirSync(SHOTS_DIR, { recursive: true });

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const chromePath = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
async function main() {
  const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'site-shots-'))}`, 'about:blank'], { stdio: 'ignore' });

  try {
    let target: { webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(250);
      target = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json()).then((list: { type: string; webSocketDebuggerUrl: string }[]) => list.find(t => t.type === 'page')).catch(() => undefined);
    }
    if (!target) throw new Error('Chrome did not start');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve => ws.once('open', resolve));
    let id = 0;
    const pending = new Map<number, (m: { result?: { data?: string } }) => void>();
    const send = (method: string, params: object = {}) => new Promise<{ result?: { data?: string } }>(resolve => {
      pending.set(++id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
    ws.on('message', raw => {
      const m = JSON.parse(String(raw));
      if (m.id) return pending.get(m.id)?.(m);
      if (m.method !== 'Fetch.requestPaused') return;
      const { requestId, request } = m.params as { requestId: string; request: { url: string; method: string } };
      const time = request.method === 'GET' && /\/api\/v1\/me\/time/.test(request.url);
      void send('Fetch.fulfillRequest', {
        requestId,
        responseCode: time ? 200 : 204,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        ...(time ? { body: Buffer.from(MAP_TIME).toString('base64') } : {}),
      });
    });

    await send('Page.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/me/*' }] });
    await send('Emulation.setDeviceMetricsOverride', { width: WIDTH + RAIL, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: BEFORE_LOAD });

    for (const page of pages) {
      const out = join(SHOTS_DIR, `${page.slug}.jpg`);
      if (existsSync(out) && !values.force) { console.log(`skip ${page.slug}`); continue; }
      const url = `${values.base}${openPath(page, shotView(page))}`;
      await send('Page.navigate', { url });
      // The other views (History, Space) open after the splash and then load their own data.
      await sleep(Number(values.wait) + (page.mode ? 6000 : 0));
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82, clip: { x: RAIL, y: 0, width: WIDTH, height: HEIGHT, scale: 1 } });
      if (!shot.result?.data) { console.log(`fail ${page.slug}`); continue; }
      writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
      console.log(`saved ${page.slug}  ${url}`);
    }
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
