// Screenshot a page of the running dev app in headless Chrome, optionally signed in and after a few clicks.
//
//   node tools/screenshot.mjs <url> <out.png> [--size 1280x900] [--phone] [--cookies jar.txt] [--script steps.js]
//
// --cookies takes a curl cookie jar (curl -c jar.txt …); its takip.* cookies are set before loading.
// --phone emulates a 390-wide iPhone viewport (plain --window-size can't go below Chrome's 500 px minimum).
// --script runs in the page after it settles; it may return a promise.
// `ws` comes from the root dependencies, so a fresh worktree needs `npm ci` first.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import WebSocket from 'ws';

const { values, positionals: [url, out] } = parseArgs({
  allowPositionals: true,
  options: { size: { type: 'string', default: '1280x900' }, phone: { type: 'boolean' }, cookies: { type: 'string' }, script: { type: 'string' }, wait: { type: 'string', default: '14000' } },
});
if (!url || !out) throw new Error('usage: node tools/screenshot.mjs <url> <out.png> [--size WxH] [--phone] [--cookies jar.txt] [--script steps.js]');

const chromePath = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9333;
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'shot-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    target = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json()).then(list => list.find(t => t.type === 'page')).catch(() => undefined);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.once('open', resolve));
  let id = 0;
  const pending = new Map();
  ws.on('message', raw => {
    const message = JSON.parse(raw);
    pending.get(message.id)?.(message);
  });
  const send = (method, params = {}) => new Promise(resolve => {
    pending.set(++id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Network.enable');
  if (values.cookies) {
    for (const line of readFileSync(values.cookies, 'utf8').split('\n')) {
      const field = line.replace(/^#HttpOnly_/, '').split('\t');
      if (field.length === 7 && field[5].startsWith('takip.')) {
        await send('Network.setCookie', { name: field[5], value: field[6], domain: 'localhost', path: '/', httpOnly: true });
      }
    }
  }
  const [width, height] = values.phone ? [390, 844] : values.size.split('x').map(Number);
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: Boolean(values.phone) });
  if (values.phone) {
    await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  }
  await send('Page.navigate', { url });
  await sleep(Number(values.wait));
  if (values.script) {
    await send('Runtime.evaluate', { expression: readFileSync(values.script, 'utf8'), awaitPromise: true });
    await sleep(1500);
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  ws.close();
  console.log(`saved ${out}`);
} finally {
  chrome.kill();
}
