/**
 * The first and last line of every short, written from the cut's own lines: the hook tells its most striking fact, the
 * outro is one whole sentence naming TAKIP. The fixed pool praising the map before it was "stupid" (the user, 2026-11-02).
 */
import { basename } from 'node:path';
import type { Context } from '../stories/context';
import { askJson } from './llm';
import { glibIn, STYLE, tollIn } from './style';

export interface Ends { hook: string; outro: string }

/** How a hook opens, rotated by the short's variant so neighbouring posts don't open alike. */
const SHAPES = [
  'one extreme: the biggest, strongest, first or last thing in the facts',
  'a contrast: then against now, or the one against all the rest',
  'a count that sounds too big or too small to be true',
  'a place, and the surprising thing that happened there',
];
const OUTROS = [
  'say how much of this is on TAKIP (all of them, since when)',
  'invite the viewer to find this subject themselves on TAKIP',
  'say this is free to explore on TAKIP',
];

/** Hooks about the map instead of the story, stock hype and bait: what made the old ones sound like a bot. */
const STALE = new RegExp([
  String.raw`\b(this|our|my) (map|app|website|site|video)\b`, String.raw`\b(a|the) (map|app|website) (that|where)\b`,
  String.raw`\b(today|tonight|right now)\b`, String.raw`\blet'?s\b`, String.raw`\bI'(m|ve|ll|d)\b`,
  String.raw`\bI (found|lose|spent|can|just|love|keep|think|bet)\b`,
  String.raw`\b(insane|crazy|wild|mind[- ]?blowing|addictive|unbelievable|incredible|epic|jaw[- ]?dropping)\b`,
  String.raw`\b(nobody|no one) (knows|talks|believes|noticed)\b`, String.raw`\bmost people\b`, String.raw`\byou won'?t believe\b`,
  String.raw`\bwait (for|till|until)\b`, String.raw`\bwatch (this|what)\b`, String.raw`\bcheck (this|it) out\b`,
].join('|'), 'i');
const CTA = /\b(follow|subscribe|comment below|like (and|this)|smash|link in (the )?bio)\b/i;

/** What makes a story grave: its hook and outro stay plain. */
const GRAVE = /\b(wars?|warfare|battles?|military|missiles?|nuclear|atomic|bombs?|bombing|weapons?|explosions?|earthquakes?|quakes?|tsunamis?|eruptions?|volcan\w*|hurricanes?|typhoons?|cyclones?|storms?|tornado\w*|floods?|droughts?|disasters?|hazards?|epidemics?|pandemics?|plagues?|diseases?|outbreaks?|fires?|wildfires?|deaths?|mortality|genocides?|massacres?|conflicts?|coups?|invasions?|sieges?|terror\w*|crusades?|revolutions?|conquests?)\b/i;

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const numbers = (s: string) => s.replace(/(\d),(?=\d{3}\b)/g, '$1').match(/\d+(\.\d+)?/g) ?? [];

/** Why a hook or outro doesn't do its job, or null. `told` is everything the video says, where the hook's numbers must come from. */
export function endsProblem(v: Partial<Ends>, told: string): string | null {
  if (!v.hook?.trim() || !v.outro?.trim()) return 'need "hook" and "outro"';
  const hw = words(v.hook), ow = words(v.outro);
  if (hw < 5 || hw > 13) return `"hook" has ${hw} words; write 6–12`;
  if (ow < 4 || ow > 12) return `"outro" has ${ow} words; write 5–10`;
  const stale = v.hook.match(STALE)?.[0];
  if (stale) return `the hook says "${stale}": tell the video's most striking fact, not the map, the day or hype`;
  if (v.hook.includes('?')) return 'no question in the hook: state the fact';
  if (/takip/i.test(v.hook)) return 'leave TAKIP out of the hook; the outro names it';
  if ((v.outro.match(/takip/gi) ?? []).length !== 1) return 'the outro names TAKIP exactly once';
  // a loop runs the outro straight into the hook; a half sentence left hanging ("Fair warning:") sounded broken
  if (!/[.!]$/.test(v.outro.trim())) return 'the outro is one whole sentence, ending with a full stop';
  const cta = v.outro.match(CTA)?.[0];
  if (cta) return `no "${cta}" in the outro`;
  const have = new Set(numbers(told));
  const made = numbers(v.hook).find(n => !have.has(n));
  if (made) return `the hook says ${made}, which the video never says: use only its own numbers, never one worked out`;
  return tollIn([v.hook, v.outro]) ?? glibIn([v.hook, v.outro]);
}

const SYSTEM = `You write the first and the last line of a short vertical video (YouTube Shorts, Reels, TikTok) narrated over
TAKIP, a free map of the world live and in the past. In the first second a viewer decides whether to keep watching. ${STYLE}`;

/** The variant a short's lines rotate on: `--variant`, else a hash of its folder name, so a re-film opens the same way. */
function variantOf(ctx: Context) {
  if (ctx.args.variant !== undefined && ctx.args.variant !== '') return Number(ctx.args.variant);
  let h = 0;
  for (const c of basename(ctx.dir)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * The hook and outro for a short whose body says `lines`, kept in the folder (`cache.ends.json`) beside the lines they were
 * written from: lines rewritten, or a count retold, writes them anew. `check` adds a story's own rules (measure's projections).
 */
export async function endsFor(ctx: Context, about: {
  topic: string; lines: string[]; facts?: string; grave?: boolean; rules?: string; check?: (v: Ends) => string | null;
}): Promise<Ends> {
  const kept = ctx.peek<Ends & { from: string[] }>('ends');
  if (kept && kept.from.join('\n') === about.lines.join('\n')) return { hook: kept.hook, outro: kept.outro };
  const v = variantOf(ctx);
  const grave = about.grave ?? GRAVE.test([about.topic, ...about.lines].join(' '));
  const told = [about.topic, about.facts ?? '', ...about.lines].join('\n');
  const ends = await askJson<Ends>(SYSTEM,
    `The video: ${about.topic}.\nWhat the narrator says between your two lines, in order:\n${about.lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n` +
    (about.facts ? `Also on screen: ${about.facts}\n` : '') +
    `\nWrite:\n- "hook": the opening line, 6–12 words, said out loud by a person who just saw something surprising. Pick the fact ` +
    `above that makes a stranger think "wait, what?", and set it up so the lines after it pay it off; angle, where the facts allow: ` +
    `${SHAPES[v % SHAPES.length]}. One plain spoken sentence with a verb: no stacked commas, no compass directions, at most one number, ` +
    `rounded as people say it where the lines round it. Don't restate line 1: the hook makes the promise, line 1 keeps it. ` +
    `Only facts and numbers from above, with every qualifier a fact needs to stay true (in a day, on record, projected). Never about the map, the app, the video or the day ("this map", "today", "let's", ` +
    `"I found"), no hype words (insane, crazy, mind-blowing, addictive), no bait ("you won't believe", "nobody knows", "wait for it").\n` +
    `The kind of line meant, from other videos (never reuse their words): "In 1914, three empires ruled Eastern Europe." / ` +
    `"Over 9,000 planes are in the air above Europe." / "One Florida launch pad sent up more rockets than Russia."\n` +
    `- "outro": one whole sentence of 5–10 words in natural spoken English that closes the video and names TAKIP once: ${OUTROS[v % OUTROS.length]}. ` +
    `A loop plays it right before the hook, so don't repeat the hook's fact.\n` +
    (about.rules ? `${about.rules}\n` : '') +
    (grave ? 'People suffered in this story: keep both lines plain, with no wordplay and nothing that sounds thrilled by it.\n' : '') +
    `Return {"hook": "...", "outro": "..."}.`,
    { check: e => endsProblem(e, told) ?? about.check?.(e) ?? null });
  ctx.keep('ends', { ...ends, from: about.lines });
  return ends;
}
