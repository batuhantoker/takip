// Writes what the native projects take from elsewhere: the offline page (site URL, mark, the web's own
// translations) and the version from package.json. `npm run sync` runs it before `cap sync`.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { offlinePage, versionCode } from './native-files.mjs';

const root = new URL('../', import.meta.url);
const repo = new URL('../../', root);
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const url = process.env.TAKIP_APP_URL ?? 'https://takip.dev';

const KEYS = ['Offline', "Couldn't reach TAKIP. Check your connection and try again.", 'Try again'];
const LANGS = ['tr', 'es', 'pt', 'fr', 'de', 'ru', 'ar', 'zh', 'ja'];
const strings = { en: KEYS };
for (const lang of LANGS) {
  const catalog = JSON.parse(readFileSync(new URL(`src/lib/core/i18n/catalogs/${lang}.json`, repo), 'utf8'));
  strings[lang] = KEYS.map(k => catalog[k] ?? k);
}
const mark = readFileSync(new URL('public/brand/takip-mark.svg', repo), 'utf8');

mkdirSync(new URL('www/', root), { recursive: true });
writeFileSync(new URL('www/offline.html', root), offlinePage({ url, strings, mark }));
// cap sync wants an index.html in webDir; the app never shows it because server.url wins.
writeFileSync(new URL('www/index.html', root), `<!doctype html><meta charset="utf-8"><script>location.replace(${JSON.stringify(url)})</script>\n`);

const edit = (path, change) => {
  const file = new URL(path, root);
  if (!existsSync(file)) return;
  const before = readFileSync(file, 'utf8');
  const after = change(before);
  if (after !== before) writeFileSync(file, after);
};
edit('android/app/build.gradle', s => s
  .replace(/versionCode \d+/, `versionCode ${versionCode(version)}`)
  .replace(/versionName "[^"]*"/, `versionName "${version}"`));
// The widget fetches from the same site the app shows.
edit('ios/App/TAKIPWidget/Info.plist', s => s.replace(/(<key>TAKIPSiteURL<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${url}$2`));
edit('ios/App/App.xcodeproj/project.pbxproj', s => s
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${versionCode(version)};`));

console.log(`TAKIP ${version} (${versionCode(version)}) → ${url}`);
