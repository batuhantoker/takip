/**
 * How every short sounds, added to each writer's own rules. The user's brief (2026-10-21): "we aim fun no boring",
 * "it is not for phd it is for shit time entertainment". Each writer keeps its accuracy rules; this is only the voice.
 */
export const STYLE = `The audience is scrolling for fun, not studying. Write like a friend telling the most surprising thing they
just saw: lead with the striking part, short punchy sentences, plain everyday words, and every line has to earn its place.
No how-it-works explanations, no lists of fields or specs, no refresh rates, no data sources (the screen credits them).
Never invent anything: every name, number and date comes from the facts given, and nothing gets added to sound exciting.
No questions, no exclamation marks.`;

/**
 * How every short opens and closes, so it loops: the outro is the first half of a sentence the hook's hype line finishes.
 * Each hype line has to work as a cold-open hook on its own (curiosity, not a slogan); the bridge names TAKIP where it
 * can. The user's "Takip has everything and more" (2026-10-21) was a direction, not copy: said word for word it was
 * "so cringe" (2026-10-22). Fixed text, so no claim gets invented.
 */
export const LOOPS: { bridge: string; hype: string }[] = [
  { bridge: "It's called TAKIP, and", hype: 'nobody believes this map is free.' },
  { bridge: "Save it, it's called TAKIP:", hype: 'the map that shows the world as it happens.' },
  { bridge: "That's TAKIP, and honestly,", hype: "you've never seen a map like this." },
  { bridge: 'No joke,', hype: 'this might be the most addictive map on the internet.' },
  { bridge: 'Try it on TAKIP, because', hype: 'this one map lets you rewind the whole planet.' },
  { bridge: 'Look it up: TAKIP. Because', hype: "most people don't know this map exists." },
  { bridge: 'Fair warning:', hype: 'I found a map that shows way too much.' },
  { bridge: 'Seriously, every time', hype: 'I lose an hour on this map.' },
];

/** A hype line as the hook says it: it starts the video, so it starts with a capital. */
export const opening = (hype: string) => hype[0].toUpperCase() + hype.slice(1);

/** The loops whose hype sits right over a grave story (wars, weapons, disasters, disease): not "addictive", not "I lose an hour". */
export const PLAIN = [0, 1, 2, 4, 5];

/** The loop for a short, picked by its folder name, so the same short always gets the same pair; a grave one from PLAIN. */
export function loopFor(seed: string, variant?: number, grave = false) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pool = grave ? PLAIN.map(i => LOOPS[i]) : LOOPS;
  return pool[(variant ?? h) % pool.length];
}

/** The hook's second half, for the writers: what today's short looks at, in the first person. */
export const TODAY = `"today": at most 6 words in the first person saying what this short looks at, like "Today: earthquakes."
or "Today, who's over New York." or "Let's watch Africa redrawn."; vary the wording, and on fires, quakes, storms, wars or disease
keep it plain ("Today: great fires through history."), never an idiom like "watch the world burn"`;

/**
 * Idioms that make light of a disaster ("Let's watch the world burn"), and game talk over stories where people died (Scott's
 * party never came back from the Pole): tragedies stay plain (takip-98, 2026-10-21).
 */
const GLIB = /\b(watch (the |it )?(world|planet|earth|globe|city|it|everything) (burn|shake|drown|explode|crumble|fall)|burn (it|the world) (all )?down|let it burn|world on fire|on fire tonight|carnage|apocalyp\w*|doomsday|mayhem|wreak\w* havoc|chaos|final score|scoreboard|game over)\b/i;

/** Why a line makes light of a disaster, or null. */
export function glibIn(lines: (string | undefined)[]) {
  const said = lines.map(l => l?.match(GLIB)?.[0]).find(Boolean);
  return said ? `"${said}" makes light of a disaster: keep it plain, like "Today: great fires through history."` : null;
}
