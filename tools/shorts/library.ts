/**
 * The story library: every story and preset written as a script, ready to film later, under data/shorts/library,
 * with a README that lists each story's hook and lines. Film one with `make <id> --preset <p> --day library`.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Scene, Script } from './scene';
import type { Maker } from './stories/context';

export const LIBRARY_DAY = 'library';

/** Tours are made from live pages by `ideas`; the library is for stories. */
export const libraryRuns = (makers: Maker[]): { maker: Maker; args: Record<string, string> }[] =>
  makers.filter(m => m.kind === 'story').flatMap(m => (m.presets?.length ? m.presets.map(p => ({ maker: m, args: { preset: p } })) : [{ maker: m, args: {} }]));

export function writeIndex(dir: string) {
  const entries = readdirSync(dir).filter(s => existsSync(join(dir, s, 'scene.json')) && existsSync(join(dir, s, 'script.en.json'))).sort();
  const parts = [
    '# Story library',
    '',
    `${entries.length} stories written as scripts, ready to film. Edit \`script.en.json\` in a story's folder before filming if a line needs it.`,
    'Film one in any language with the command under it (`--lang all` for all ten).',
    '',
  ];
  for (const slug of entries) {
    const scene = JSON.parse(readFileSync(join(dir, slug, 'scene.json'), 'utf8')) as Scene;
    const script = JSON.parse(readFileSync(join(dir, slug, 'script.en.json'), 'utf8')) as Script;
    const preset = slug.match(/-preset-(.+)$/)?.[1];
    const maker = preset ? slug.slice(0, slug.indexOf('-preset-')) : slug;
    parts.push(`## ${script.post.title}`, '', `*${script.kicker}* · \`${basename(slug)}\``, '');
    for (const b of script.beats) parts.push(`- ${b.title ? `**${b.title}:** ` : ''}${b.say}`);
    const factsFile = join(dir, slug, 'cache.facts.json');
    const facts = existsSync(factsFile) ? (JSON.parse(readFileSync(factsFile, 'utf8')) as Record<string, { dateChecked?: boolean }>) : {};
    const unchecked = Object.entries(facts).filter(([, f]) => f && f.dateChecked === false).map(([id]) => id);
    if (unchecked.length) parts.push('', `Dates to check (their Wikipedia lead doesn't give the year): ${unchecked.join(', ')}`);
    parts.push('', `Sources: ${scene.sources.join(' · ')}`, '', '```', `npm run shorts -- make ${maker}${preset ? ` --preset ${preset}` : ''} --day ${LIBRARY_DAY} --lang tr`, '```', '');
  }
  writeFileSync(join(dir, 'README.md'), parts.join('\n'));
  return entries.length;
}
