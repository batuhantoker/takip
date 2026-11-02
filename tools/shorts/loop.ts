/**
 * The two shapes of a short. The short cut loops: the platform replays it, so the outro returns the picture to where the
 * hook began, and its line (narrate/hook.ts) leads back into the hook. film.ts records the
 * opening camera as `window.__loopStart` once the scene is set up. The long cut ends closed, since X has no replay (the
 * user, 2026-10-22): the tagline over the last shot, wherever it is, then the end card.
 */
import { endsFor } from './narrate/hook';
import { numberWords } from './narrate/numbers';
import type { Context } from './stories/context';
import type { Beat, Scene } from './scene';

/** How long the camera takes to get back to the opening view. */
export const RETURN_MS = 1800;

/** Page code that closes any open popup, window or phone sheet. */
export const closeCards = `document.querySelectorAll('.maplibregl-popup').forEach(p => p.remove()); ` +
  `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.__takipInspect?.closeAll()`;

/**
 * Page code that closes any open popup or card and flies back to the opening camera, after `extra` (a clock seek, a layer).
 * `raw` tells a scene's own flyTo wrapper (deep time's zoom-in) to leave this flight as it is.
 */
export const backToStart = (extra = '') =>
  `(() => { ${closeCards}; ${extra}; ` +
  `const s = window.__loopStart; if (s) __takipMap.flyTo({ ...s, duration: ${RETURN_MS}, essential: true, raw: true }); })()`;

/** The hook and outro of a short, written from its body's lines (narrate/hook.ts): the hook opens, the outro leads back into it. */
export async function loopBeats(ctx: Context, about: Parameters<typeof endsFor>[1], { back = backToStart(), hookMs = 2500 }: {
  back?: string; hookMs?: number;
} = {}): Promise<{ hook: Beat; outro: Beat }> {
  const ends = await endsFor(ctx, about);
  return {
    hook: { id: 'hook', say: ends.hook, minMs: hookMs },
    outro: { id: 'outro', say: ends.outro, enter: back, minMs: RETURN_MS + 400, credits: true },
  };
}

/** `--length long`: the richer cut, 40–60 s and closed, alternating with the short loop. */
export const isLong = (args: Record<string, string>) => args.length === 'long';
/** Whether beats hold for a short: a short, or a short cut from the long's beats (`pace`, set by make.ts). */
export const shortPace = (args: Record<string, string>) => !isLong(args) || args.pace === 'short';

/** A short lasts 20–25 s (the user, 2026-10-22): its beats between hook and outro fill about this long. */
export const SHORT_BODY_MS = 16_000;
const SHORT_MAX_MS = 25_000;
/** A short beat's hold: its share of the body, and never under `floor`. */
export const shortHold = (beats: number, floor: number) => Math.max(floor, Math.round(SHORT_BODY_MS / Math.max(1, beats)));

/** The long cut's last line: brandSpoken says the name. */
export const TAGLINE = 'See the world live or in the past on TAKIP.';
/** The end card stays up after the last word; timeline.ts holds it. */
const END_CARD_MS = 1800;

/** About how long a beat runs: its hold, or its line at the narrator's pace with the quiet around it. */
// the narrator at TEMPO 1.15, measured over 40 cuts on 2026-11-02: 2.8 words a second
const MS_PER_WORD = 360;
const QUIET_MS = 450;
export const estimateMs = (b: Beat) =>
  Math.max(b.minMs ?? 0, QUIET_MS + spokenWords(b.say) * MS_PER_WORD) + (b.card === 'end' ? END_CARD_MS : 0);

/** A line's words as the narrator says them: a year is two, "2,051" three, "5.3" three. */
export function spokenWords(line: string) {
  return line.split(/\s+/).filter(Boolean).reduce((n, w) => {
    const num = w.replace(/[^\d.,]/g, '').replace(/,(?=\d{3})/g, '').replace(/[.,]+$/, '');
    if (!/\d/.test(num)) return n + 1;
    const [whole, frac = ''] = num.split('.');
    const i = Number(whole);
    const said = /^\d{4}$/.test(whole) && !/\d,\d/.test(w) && i >= 1100 && i < 2100 && !frac ? 2 : i < 1_000_000 ? numberWords(i).split(' ').length : 3;
    return n + said + (frac ? 1 + frac.length : 0);
  }, 0);
}

/**
 * The words a line needs to fill `ms` of picture. A beat ends with its line or its hold, whichever is later, so a line much
 * shorter than its hold is silence: the old ≤10-word detail sat under 13 s of picture.
 */
export function wordsFor(ms: number) {
  const hi = Math.max(6, Math.round((ms - QUIET_MS) / MS_PER_WORD));
  return { lo: Math.round(hi * 0.75), hi };
}

/** How a writer is told the range: counted as said, since a line full of numbers runs long (a story at 31 s, 2026-11-02). */
export const saidAs = ({ lo, hi }: { lo: number; hi: number }) => `${lo}–${hi} words as spoken (a number counts as the words it is said in: 1954 is two, 2,051 is three)`;

/** Why a line is too short for its picture or too long for the cut, or null; the writer is asked again. */
export function lengthProblem(lines: Record<string, string>, { lo, hi }: { lo: number; hi: number }) {
  for (const [id, line] of Object.entries(lines)) {
    const n = spokenWords(line);
    if (n < lo - 1) return `"${id}" says ${n} words; write ${saidAs({ lo, hi })}, or the picture runs on in silence`;
    if (n > hi + 2) return `"${id}" says ${n} words; keep it to ${saidAs({ lo, hi })}`;
  }
  return null;
}

/** The long cut, closed: its outro gives way to the tagline over the last shot and the end card; nothing flies back. */
export function closed(scene: Scene): Scene {
  const outro = scene.beats[scene.beats.length - 1];
  return {
    ...scene,
    loop: false,
    beats: [...scene.beats.slice(0, -1), {
      id: 'outro', say: TAGLINE, card: 'end', enter: `(() => { ${closeCards}; })()`,
      ...(outro.counterWithTitle ? { counterWithTitle: true } : {}),
    }],
  };
}

/** A short cut from the long's beats: the hook, as many of its beats as fit in 25 s (two at least), and the loop's outro. */
export function trimmed(scene: Scene): Scene {
  const [hook, ...rest] = scene.beats;
  const outro = rest.pop()!;
  let total = estimateMs(hook) + estimateMs(outro);
  const body: Beat[] = [];
  for (const b of rest) {
    if (body.length >= 2 && total + estimateMs(b) > SHORT_MAX_MS) break;
    body.push(b);
    total += estimateMs(b);
  }
  return { ...scene, beats: [hook, ...body, outro] };
}
