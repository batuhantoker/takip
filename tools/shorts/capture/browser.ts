// Headless Chrome over the DevTools protocol, set up to film the app: a phone-shaped viewport, the virtual
// clock injected before any page script, the UI language cookie, and account and usage calls answered locally
// so a render spends no one's map time and leaves nothing in the analytics.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CLOCK = readFileSync(new URL('./virtual-clock.js', import.meta.url), 'utf8');
const MAP_TIME = JSON.stringify({ limit: 0, used: 0, remaining: 0, blocked: false, resetsAt: new Date(Date.now() + 86_400_000).toISOString() });
/** Calls that would count usage or record a visit; everything else reaches the dev server. */
const STUBBED = ['*/api/v1/me/time*', '*/api/v1/me/actions*', '*/api/v1/page-view*', '*/api/v1/reports*'];

export interface Viewport {
  /** CSS pixels; the video is width × scale by height × scale. */
  width: number;
  height: number;
  scale: number;
}

export interface PageOptions {
  viewport: Viewport;
  locale: string;
  /** Run before any page script on every load, after the clock (e.g. localStorage for the layout). */
  beforeLoad?: string;
}

type Message = { id?: number; method?: string; params?: Record<string, unknown>; result?: Record<string, unknown>; error?: { message: string } };

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// A stopped run must not leave its browsers behind.
const browsers = new Set<ChildProcess>();
process.on('exit', () => browsers.forEach(c => c.kill()));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => process.exit(130));

/** A free local port: tools/screenshot.mjs and tools/site/shots.ts hold fixed ones that other sessions use. */
function freePort() {
  return new Promise<number>(resolve => {
    const server = createServer().listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

export class Page {
  private id = 0;
  private pending = new Map<number, (m: Message) => void>();

  private constructor(private chrome: ChildProcess, private ws: WebSocket, private profile: string) {
    ws.on('close', () => {
      for (const reject of this.pending.values()) reject({ error: { message: 'the browser went away' } });
      this.pending.clear();
    });
    ws.on('message', raw => {
      const m: Message = JSON.parse(String(raw));
      if (m.id) this.pending.get(m.id)?.(m);
      else if (m.method === 'Fetch.requestPaused') this.answer(m.params as { requestId: string; request: { url: string; method: string } });
    });
  }

  static async open({ viewport, locale, beforeLoad }: PageOptions) {
    const port = await freePort();
    const profile = mkdtempSync(join(tmpdir(), 'shorts-'));
    const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
      '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
    browsers.add(chrome);
    chrome.once('exit', () => browsers.delete(chrome));
    let target: { webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 60 && !target; i++) {
      await sleep(250);
      target = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())
        .then((list: { type: string; webSocketDebuggerUrl: string }[]) => list.find(t => t.type === 'page')).catch(() => undefined);
    }
    if (!target) {
      chrome.kill();
      throw new Error('Chrome did not start');
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 512 * 1024 * 1024 });
    await new Promise(resolve => ws.once('open', resolve));
    const page = new Page(chrome, ws, profile);
    await page.send('Page.enable');
    await page.send('Network.enable');
    await page.send('Fetch.enable', { patterns: STUBBED.map(urlPattern => ({ urlPattern })) });
    await page.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.scale, mobile: true });
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await page.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', acceptLanguage: locale });
    await page.send('Network.setCookie', { name: 'takip-lang', value: locale, domain: 'localhost', path: '/' });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
    if (beforeLoad) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: beforeLoad });
    return page;
  }

  send(method: string, params: object = {}) {
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      this.pending.set(++this.id, m => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result ?? {})));
      this.ws.send(JSON.stringify({ id: this.id, method, params }));
    });
  }

  private answer({ requestId, request }: { requestId: string; request: { url: string; method: string } }) {
    const time = request.method === 'GET' && request.url.includes('/api/v1/me/time');
    void this.send('Fetch.fulfillRequest', {
      requestId,
      responseCode: time ? 200 : 204,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      ...(time ? { body: Buffer.from(MAP_TIME).toString('base64') } : {}),
    }).catch(() => {});
  }

  async goto(url: string) {
    await this.send('Page.navigate', { url });
  }

  /** Runs an expression in the page (awaiting a promise) and returns its JSON value. */
  async evaluate<T = unknown>(expression: string): Promise<T> {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }) as {
      result?: { value?: T }; exceptionDetails?: { text: string; exception?: { description?: string } };
    };
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result?.value as T;
  }

  /** Runs an expression for its effect; its value (often a map or a DOM node) is not sent back. */
  async run(expression: string) {
    await this.evaluate(`(async () => { await (${expression}); })()`);
  }

  /** Polls an expression in real time until it is truthy. */
  async waitFor(expression: string, timeoutMs = 30_000, everyMs = 100) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      if (await this.evaluate<boolean>(`!!(${expression})`).catch(() => false)) return true;
      await sleep(everyMs);
    }
    return false;
  }

  async screenshot(format: 'png' | 'jpeg' = 'jpeg', quality = 95) {
    const r = await this.send('Page.captureScreenshot', { format, ...(format === 'jpeg' ? { quality } : {}), optimizeForSpeed: true });
    return Buffer.from(r.data as string, 'base64');
  }

  async close() {
    this.ws.close();
    this.chrome.kill();
    await sleep(300);
    // Chrome may still be flushing its profile as it exits
    try { rmSync(this.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* left in the temp dir */ }
  }
}
