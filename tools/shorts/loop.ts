/**
 * The two shapes of a short. The short cut loops: the platform replays it, so the outro returns the picture to where the
 * hook began and its line is the first half of a sentence the hook finishes (narrate/style.ts LOOPS). film.ts records the
 * opening camera as `window.__loopStart` once the scene is set up. The long cut ends closed, since X has no replay (the
 * user, 2026-10-22): the tagline over the last shot, wherever it is, then the end card.
 */
import { loopFor, opening } from './narrate/style';
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

/** The hook and outro of a short, from its folder name (or `--variant`): the hype line opens, the bridge closes into it. */
export function loopBeats(seed: string, today: string, { variant, back = backToStart(), hookMs = 2500 }: {
  variant?: string; back?: string; hookMs?: number;
} = {}): { hook: Beat; outro: Beat } {
  const loop = loopFor(seed, variant !== undefined && variant !== '' ? Number(variant) : undefined);
  return {
    hook: { id: 'hook', say: `${opening(loop.hype)} ${today}`, minMs: hookMs },
    outro: { id: 'outro', say: loop.bridge, enter: back, minMs: RETURN_MS + 400, credits: true },
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
const MS_PER_WORD = 360;
export const estimateMs = (b: Beat) =>
  Math.max(b.minMs ?? 0, 450 + b.say.split(/\s+/).filter(Boolean).length * MS_PER_WORD) + (b.card === 'end' ? END_CARD_MS : 0);

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

/** Words that make a story grave, read in its kicker, post title and "today" (a description lists a page's layers too). */
const GRAVE = /\b(wars?|warfare|wartime|battles?|military|missiles?|nuclear|atomic|bombs?|bombing|weapons?|explosions?|earthquakes?|quakes?|tsunamis?|eruptions?|volcan\w*|hurricanes?|typhoons?|cyclones?|storms?|tornado\w*|floods?|droughts?|disasters?|hazards?|epidemics?|pandemics?|plagues?|diseases?|outbreaks?|fires?|wildfires?|deaths?|mortality|genocides?|massacres?|conflicts?|coups?|invasions?|sieges?|terror\w*|crusades?|revolutions?|conquests?)\b/i;

/** Whether a story is grave: its maker says so, or its words do. */
export const isGrave = (scene: Scene) =>
  scene.grave ?? GRAVE.test([scene.kicker, scene.post.title, scene.beats[0]?.say.split(/(?<=[.!?…])\s+/).at(-1)].join(' '));

/**
 * A grave story's hook and bridge from the plain loops (narrate/style.ts PLAIN), the variant taken among them: "I lose an
 * hour on this map" over every nuclear explosion on record sits wrong (takip-98, 2026-10-22).
 */
export function plainIfGrave(scene: Scene, seed: string, variant?: string): Scene {
  const v = variant !== undefined && variant !== '' ? Number(variant) : undefined;
  const was = loopFor(seed, v), now = loopFor(seed, v, true);
  if (!isGrave(scene) || was === now) return scene;
  const hype = opening(was.hype);
  return {
    ...scene,
    beats: scene.beats.map(b => (b.id === 'hook' && b.say.startsWith(hype) ? { ...b, say: opening(now.hype) + b.say.slice(hype.length) }
      : b.id === 'outro' && b.say === was.bridge ? { ...b, say: now.bridge } : b)),
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
