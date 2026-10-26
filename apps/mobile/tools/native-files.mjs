/** Store build numbers must only grow: 1.2.3 → 10203. */
export function versionCode(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`package.json version must be x.y.z, got ${version}`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (minor > 99 || patch > 99) throw new Error(`minor and patch must stay under 100 (${version})`);
  return major * 10000 + minor * 100 + patch;
}

const escape = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Shown by Capacitor (server.errorPath) when the site doesn't load. */
export function offlinePage({ url, strings, mark }) {
  const [title, body, retry] = strings.en.map(escape);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>TAKIP</title>
<style>
  html, body { margin: 0; height: 100%; background: #0A0C0F; color: #F2F5FA; font: 15px/1.5 -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif; }
  main { box-sizing: border-box; min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center;
    padding: calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom)); }
  svg { width: 96px; height: auto; }
  h1 { margin: 8px 0 0; font-size: 20px; font-weight: 600; }
  p { margin: 0; max-width: 22rem; color: #9AA3B2; }
  button { margin-top: 8px; min-height: 44px; padding: 0 20px; border: 0; border-radius: 8px; background: #2F80FF; color: #fff; font: inherit; font-weight: 600; }
  button:active { opacity: .8; }
</style>
</head>
<body>
<main>
  ${mark.replace(/<\?xml[^>]*>/, '').trim()}
  <h1 id="title">${title}</h1>
  <p id="body">${body}</p>
  <button id="retry" type="button">${retry}</button>
</main>
<script>
  const STRINGS = ${JSON.stringify(strings)};
  const lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  const text = STRINGS[lang];
  if (text) {
    document.documentElement.lang = lang;
    if (lang === 'ar') document.documentElement.dir = 'rtl';
    ['title', 'body', 'retry'].forEach((id, i) => { document.getElementById(id).textContent = text[i]; });
  }
  try { window.Capacitor && window.Capacitor.nativePromise('SplashScreen', 'hide', {}); } catch (e) {}
  const go = () => location.replace(${JSON.stringify(url)});
  document.getElementById('retry').addEventListener('click', go);
  window.addEventListener('online', go);
</script>
</body>
</html>
`;
}
