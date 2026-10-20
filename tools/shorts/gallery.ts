/** data/shorts/gallery.html: every filmed short on one page, each with its post text ready to copy. Open it locally. */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Scene, Script } from './scene';

type Entry = { day: string; slug: string; lang: string; video: string; poster: string | null; title: string; kicker: string; post: string; seconds: number; at: number };

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function entries(root: string): Entry[] {
  const out: Entry[] = [];
  for (const day of readdirSync(root).filter(d => statSync(join(root, d)).isDirectory())) {
    for (const slug of readdirSync(join(root, day)).filter(s => statSync(join(root, day, s)).isDirectory())) {
      const dir = join(root, day, slug);
      if (!existsSync(join(dir, 'scene.json'))) continue;
      const scene = JSON.parse(readFileSync(join(dir, 'scene.json'), 'utf8')) as Scene;
      for (const file of readdirSync(dir).filter(f => /^[a-z]{2}\.mp4$/.test(f))) {
        const lang = file.slice(0, 2);
        const scriptFile = join(dir, `script.${lang}.json`);
        const timelineFile = join(dir, `timeline.${lang}.json`);
        if (!existsSync(scriptFile)) continue;
        const script = JSON.parse(readFileSync(scriptFile, 'utf8')) as Script;
        const postFile = join(dir, `${lang}.post.txt`);
        out.push({
          day, slug, lang,
          video: relative(root, join(dir, file)),
          poster: existsSync(join(dir, `${lang}.jpg`)) ? relative(root, join(dir, `${lang}.jpg`)) : null,
          title: script.post.title,
          kicker: script.kicker || scene.kicker,
          post: existsSync(postFile) ? readFileSync(postFile, 'utf8').trim() : script.post.title,
          seconds: existsSync(timelineFile) ? Math.round((JSON.parse(readFileSync(timelineFile, 'utf8')) as { totalMs: number }).totalMs / 1000) : 0,
          at: statSync(join(dir, file)).mtimeMs,
        });
      }
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

const CSS = `
:root { --bg: #0A0C0F; --card: #111317; --line: #1E2228; --ink: #ECEEF0; --ink2: #A4AAB2; --ink3: #6D737B; --accent: #52C1D6; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 Geist, -apple-system, system-ui, sans-serif; }
header { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 16px 24px;
  background: rgba(10,12,15,.92); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
h1 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
h1 b { color: var(--accent); font-weight: 600; }
.count { color: var(--ink3); }
.langs { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
.langs button { background: none; color: var(--ink2); border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; font: inherit; cursor: pointer; }
.langs button.on { color: var(--bg); background: var(--accent); border-color: var(--accent); }
main { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 20px; padding: 24px; }
article { background: var(--card); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; }
video { width: 100%; aspect-ratio: 9 / 16; background: #000; display: block; }
.meta { padding: 12px 14px 4px; display: flex; flex-direction: column; gap: 4px; }
.kicker { font: 500 12px/1 'Geist Mono', ui-monospace, monospace; color: var(--accent); display: flex; justify-content: space-between; }
.kicker span { color: var(--ink3); }
h2 { margin: 2px 0 0; font-size: 15px; line-height: 1.3; font-weight: 600; }
.slug { font: 11px/1.3 ui-monospace, monospace; color: var(--ink3); word-break: break-all; }
textarea { margin: 8px 14px 0; height: 110px; resize: vertical; background: var(--bg); color: var(--ink2); border: 1px solid var(--line);
  border-radius: 8px; padding: 8px; font: 12px/1.4 inherit; }
.actions { display: flex; gap: 8px; padding: 10px 14px 14px; }
.actions button, .actions a { flex: 1; text-align: center; background: none; color: var(--ink); border: 1px solid var(--line); border-radius: 8px;
  padding: 7px; font: inherit; cursor: pointer; text-decoration: none; }
.actions button:hover, .actions a:hover { border-color: var(--accent); color: var(--accent); }
[hidden] { display: none !important; }
`;

const JS = `
const buttons = [...document.querySelectorAll('.langs button')];
const show = lang => {
  buttons.forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
  document.querySelectorAll('article').forEach(a => { a.hidden = lang !== 'all' && a.dataset.lang !== lang; });
};
buttons.forEach(b => b.onclick = () => show(b.dataset.lang));
document.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
  await navigator.clipboard.writeText(b.closest('article').querySelector('textarea').value);
  b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy post text'), 1500);
});
`;

/** Writes the page and returns where it is. */
export function writeGallery(root: string) {
  const all = entries(root);
  const langs = [...new Set(all.map(e => e.lang))].sort();
  const cards = all.map(e => `
<article data-lang="${e.lang}">
  <video controls preload="none" playsinline src="${esc(e.video)}"${e.poster ? ` poster="${esc(e.poster)}"` : ''}></video>
  <div class="meta">
    <div class="kicker">${esc(e.kicker)}<span>${e.lang.toUpperCase()} · ${e.seconds} s</span></div>
    <h2>${esc(e.title)}</h2>
    <div class="slug">${esc(e.day)}/${esc(e.slug)}</div>
  </div>
  <textarea readonly>${esc(e.post)}</textarea>
  <div class="actions"><button data-copy>Copy post text</button><a href="${esc(e.video)}" download>Download</a></div>
</article>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>TAKIP shorts</title><style>${CSS}</style></head><body>
<header><h1><b>TAKIP</b> shorts</h1><span class="count">${all.length} videos, ${new Set(all.map(e => e.slug)).size} stories</span>
<div class="langs"><button class="on" data-lang="all">All</button>${langs.map(l => `<button data-lang="${l}">${l.toUpperCase()}</button>`).join('')}</div></header>
<main>${cards || '<p>No shorts filmed yet.</p>'}</main><script>${JS}</script></body></html>`;
  const file = join(root, 'gallery.html');
  writeFileSync(file, html);
  return file;
}
