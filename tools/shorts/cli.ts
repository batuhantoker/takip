/*
 * Shorts: 9:16 videos for YouTube Shorts, Reels and TikTok, filmed from the running app with a voiceover in each language.
 *   npm run shorts -- list
 *   npm run shorts -- ideas                       today's situations first, then stories and features not yet made
 *   npm run shorts -- make <id> [--lang en,tr | all] [--seconds 8] [--script-only] [--day 2026-10-20] [--<option> value]…
 *   npm run shorts -- auto [--count 3] [--lang …]   makes the top ideas
 *   npm run shorts -- library [--film --lang en,tr]   every story's script in data/shorts/library (and, with --film, its videos)
 *   npm run shorts -- gallery                     data/shorts/gallery.html: every filmed short, ready to post
 *   npm run shorts -- remix <day>/<id> [--lang tr] [--no-music]   new soundtrack under videos already filmed
 * Needs the app (npm run dev) and the AI-models panel (chat model for words, Speech for the voice). docs/architecture/shorts.md
 */
import { LOCALES } from '../../src/lib/core/i18n/locales';
import { ideas } from './ideas';
import { LIBRARY_DAY, libraryRuns, writeIndex } from './library';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { writeGallery } from './gallery';
import { make, remix, ROOT, slugFor } from './make';
import { MAKERS } from './stories/registry';

const OWN = new Set(['lang', 'seconds', 'script-only', 'day', 'base', 'count', 'no-music', 'film']);

function parse(argv: string[]) {
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) positional.push(a);
    else if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) flags[a.slice(2)] = 'true';
    else flags[a.slice(2)] = argv[++i];
  }
  return { flags, positional };
}

async function main() {
  const { flags, positional: [command, id] } = parse(process.argv.slice(2));
  if (command === 'list' || !command) {
    for (const m of MAKERS) console.log(`${m.id.padEnd(16)} ${m.kind.padEnd(6)} ${m.about}`);
    return;
  }
  const base = flags.base ?? 'http://localhost:3000';
  const langs = !flags.lang ? ['en'] : flags.lang === 'all' ? [...LOCALES] : flags.lang.split(',');
  const unknown = langs.filter(l => !(LOCALES as readonly string[]).includes(l));
  if (unknown.length) throw new Error(`unknown language ${unknown.join(', ')}; TAKIP speaks ${LOCALES.join(', ')}`);
  const run = (makerId: string, args: Record<string, string>) => {
    const maker = MAKERS.find(m => m.id === makerId);
    if (!maker) throw new Error(`unknown short "${makerId}"; see \`npm run shorts -- list\``);
    return make(maker, {
      langs, base, args,
      day: flags.day ?? new Date().toISOString().slice(0, 10),
      limitMs: flags.seconds ? Number(flags.seconds) * 1000 : undefined,
      scriptOnly: flags['script-only'] === 'true',
      noMusic: flags['no-music'] === 'true',
    });
  };
  if (command === 'make') return run(id, Object.fromEntries(Object.entries(flags).filter(([k]) => !OWN.has(k))));
  if (command === 'remix') {
    if (!id) throw new Error('remix needs a short\'s folder, e.g. library/chronicle-preset-cold-war');
    return remix(join(ROOT, 'data/shorts', id), { langs: flags.lang ? langs : undefined, noMusic: flags['no-music'] === 'true' });
  }
  if (command === 'gallery') return console.log(writeGallery(join(ROOT, 'data/shorts')));
  if (command === 'library') {
    const runs = libraryRuns(MAKERS);
    const failed: string[] = [];
    const film = flags.film === 'true';
    if (film) console.log(`${new Date().toISOString()} filming ${runs.length} stories in ${langs.join(', ')}.\n` +
      'If it stops (AWS session expired: run `aws login`; app or Speech down), run the same command again: it resumes.');
    for (const [i, { maker, args }] of runs.entries()) {
      // a batch picks up where it stopped: languages already filmed are skipped
      const dir = join(ROOT, 'data/shorts', LIBRARY_DAY, slugFor(maker, args));
      const missing = film ? langs.filter(l => !existsSync(join(dir, `${l}.mp4`))) : ['en'];
      if (!missing.length) continue;
      if (film) console.log(`\n[${i + 1}/${runs.length}] ${slugFor(maker, args)}: ${missing.join(', ')}`);
      try {
        await make(maker, { langs: missing, base, args, day: LIBRARY_DAY, scriptOnly: !film, noMusic: flags['no-music'] === 'true' });
        if (film) writeGallery(join(ROOT, 'data/shorts'));
      } catch (err) {
        failed.push(`${maker.id} ${args.preset ?? ''}: ${err instanceof Error ? err.message : err}`);
        console.error(`  ✗ ${failed[failed.length - 1]}`);
      }
    }
    const n = writeIndex(join(ROOT, 'data/shorts', LIBRARY_DAY));
    if (film) console.log(`gallery: ${writeGallery(join(ROOT, 'data/shorts'))}`);
    console.log(`\n${n} stories in data/shorts/${LIBRARY_DAY}/README.md${failed.length ? `; ${failed.length} failed:\n  ${failed.join('\n  ')}` : ''}`);
    return;
  }
  if (command === 'ideas' || command === 'auto') {
    const list = await ideas(base, ROOT);
    if (command === 'ideas') {
      for (const i of list.slice(0, Number(flags.count ?? 15))) {
        const args = Object.entries(i.args).map(([k, v]) => `--${k} ${/\s/.test(v) ? JSON.stringify(v) : v}`).join(' ');
        console.log(`${i.score.toFixed(0).padStart(3)}  ${i.why}\n     npm run shorts -- make ${i.maker} ${args}`);
      }
      return;
    }
    for (const i of list.slice(0, Number(flags.count ?? 3))) {
      try {
        await run(i.maker, i.args);
      } catch (err) {
        console.error(`  ✗ ${i.why}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return;
  }
  throw new Error(`unknown command "${command}"; try list, ideas, make, auto, library, remix or gallery`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
