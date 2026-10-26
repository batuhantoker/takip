// The page the window shows when takip.dev can't be reached, in the site's languages, from its own catalogs.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(app, '../..');
const catalogs = join(root, 'src/lib/core/i18n/catalogs');

const KEYS = { title: 'Offline', body: "Couldn't reach TAKIP. Check your connection and try again.", retry: 'Try again' };

export function offlineStrings() {
  const strings = { en: { ...KEYS } };
  for (const file of readdirSync(catalogs).filter(f => f.endsWith('.json'))) {
    const catalog = JSON.parse(readFileSync(join(catalogs, file), 'utf8'));
    const entry = Object.fromEntries(Object.entries(KEYS).map(([k, en]) => [k, catalog[en]]));
    if (Object.values(entry).every(Boolean)) strings[file.slice(0, -5)] = entry;
  }
  return strings;
}

export function offlinePage(strings, mark) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
<title>TAKIP</title>
<style>
  :root { color-scheme: dark; }
  html, body { height: 100%; margin: 0; }
  body { display: grid; place-items: center; background: #0A0C0F; color: #F2F5FA; font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", sans-serif; }
  main { display: flex; flex-direction: column; align-items: center; gap: 14px; max-width: 360px; padding: 24px; text-align: center; }
  svg { width: 96px; height: auto; opacity: .9; }
  h1 { margin: 8px 0 0; font-size: 20px; font-weight: 600; }
  p { margin: 0; color: #A3ACBA; }
  button { margin-top: 10px; padding: 9px 18px; border: 1px solid #2F80FF; border-radius: 8px; background: #2F80FF; color: #fff; font: inherit; font-weight: 500; cursor: pointer; }
  button:focus-visible { outline: 2px solid #F2F5FA; outline-offset: 2px; }
</style>
</head>
<body>
<main>
${mark.trim()}
<h1 id="title"></h1>
<p id="body"></p>
<button id="retry" type="button"></button>
</main>
<script>
const STRINGS = ${JSON.stringify(strings)};
const lang = (navigator.languages || [navigator.language]).map(l => String(l).slice(0, 2).toLowerCase()).find(l => STRINGS[l]) || 'en';
const s = STRINGS[lang];
document.documentElement.lang = lang;
if (lang === 'ar') document.documentElement.dir = 'rtl';
for (const id of ['title', 'body', 'retry']) document.getElementById(id).textContent = s[id];
const asked = new URLSearchParams(location.search).get('url');
const target = asked && /^https?:\\/\\//.test(asked) ? asked : 'https://takip.dev/';
const retry = () => { location.href = target; };
document.getElementById('retry').addEventListener('click', retry);
addEventListener('online', retry);
</script>
</body>
</html>
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mark = readFileSync(join(root, 'public/brand/takip-mark.svg'), 'utf8').replace(/ width="[^"]*" height="[^"]*"/, ' aria-hidden="true"');
  const strings = offlineStrings();
  mkdirSync(join(app, 'offline'), { recursive: true });
  writeFileSync(join(app, 'offline/index.html'), offlinePage(strings, mark));
  console.log(`offline/index.html in ${Object.keys(strings).length} languages`);
}
