/*
 * UI translations (src/lib/core/i18n, docs/design/README.md "Language").
 *   npm run i18n -- check [--path <prefix>]…        what each language is missing, unused or gets wrong
 *   npm run i18n -- missing <locale> [--path <prefix>]…   the untranslated strings as a JSON object to fill in
 *   npm run i18n -- merge <locale> <file.json> [--dry-run]   adds translations, refusing ones whose {variables} differ
 *   npm run i18n -- prune                             drops translations no code uses any more
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LOCALES } from '../../src/lib/core/i18n/locales';
import { bareSource } from '../../src/lib/core/i18n/translator';
import { readCatalog, translationProblem, writeCatalog } from './catalogs';
import { extract } from './extract';

const ROOT = resolve(import.meta.dirname, '../..');
const TRANSLATED = LOCALES.filter(l => l !== 'en');
// A context key ('rail|Layers') without its own entry uses the plain key's.
const translated = (catalog: Record<string, string>, s: string) => !!(catalog[s] || catalog[bareSource(s)]);

function main() {
  const [command, ...args] = process.argv.slice(2);
  const paths = args.flatMap((a, i) => (args[i - 1] === '--path' ? [a] : []));
  const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--path');
  const under = (files: string[]) => !paths.length || files.some(f => paths.some(p => f.startsWith(p)));

  if (command === 'check') {
    const sources = extract(ROOT);
    const wanted = [...sources].filter(([, files]) => under(files)).map(([s]) => s);
    console.log(`${wanted.length} strings${paths.length ? ` under ${paths.join(', ')}` : ''}`);
    let bad = 0;
    for (const locale of TRANSLATED) {
      const catalog = readCatalog(ROOT, locale);
      const missing = wanted.filter(s => !translated(catalog, s));
      const unused = paths.length ? [] : Object.keys(catalog).filter(s => !sources.has(s));
      const problems = Object.entries(catalog).flatMap(([s, tr]) => {
        const why = translationProblem(s, tr);
        return why ? [`  ${locale}: "${s}" ${why}`] : [];
      });
      bad += problems.length;
      console.log(`${locale}: ${missing.length} missing${paths.length ? '' : `, ${unused.length} unused`}${problems.length ? `, ${problems.length} broken` : ''}`);
      problems.forEach(p => console.log(p));
    }
    process.exitCode = bad ? 1 : 0;
    return;
  }

  if (command === 'missing') {
    const [locale] = positional;
    if (!TRANSLATED.includes(locale as never)) throw new Error(`missing <${TRANSLATED.join('|')}>`);
    const catalog = readCatalog(ROOT, locale);
    const out = Object.fromEntries([...extract(ROOT)].filter(([s, files]) => under(files) && !translated(catalog, s)).map(([s]) => [s, '']));
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (command === 'merge') {
    const [locale, file] = positional;
    if (!TRANSLATED.includes(locale as never) || !file) throw new Error('merge <locale> <file.json>');
    const incoming = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    const catalog = readCatalog(ROOT, locale);
    let added = 0;
    for (const [source, translation] of Object.entries(incoming)) {
      const why = translationProblem(source, translation);
      if (why) { console.log(`skipped "${source}": ${why}`); continue; }
      catalog[source] = translation as string;
      added++;
    }
    if (!args.includes('--dry-run')) writeCatalog(ROOT, locale, catalog);
    console.log(`${locale}: ${args.includes('--dry-run') ? 'would merge' : 'merged'} ${added}`);
    return;
  }

  if (command === 'prune') {
    const sources = extract(ROOT);
    for (const locale of TRANSLATED) {
      const catalog = readCatalog(ROOT, locale);
      const kept = Object.fromEntries(Object.entries(catalog).filter(([s]) => sources.has(s)));
      writeCatalog(ROOT, locale, kept);
      console.log(`${locale}: dropped ${Object.keys(catalog).length - Object.keys(kept).length}`);
    }
    return;
  }

  console.log('usage: i18n <check|missing|merge|prune> (see tools/i18n/cli.ts)');
  process.exitCode = 1;
}

main();
