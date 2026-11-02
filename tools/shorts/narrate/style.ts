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
 * Idioms that make light of a disaster ("Let's watch the world burn"), and game talk over stories where people died (Scott's
 * party never came back from the Pole): tragedies stay plain (takip-98, 2026-10-21).
 */
const GLIB = /\b(watch (the |it )?(world|planet|earth|globe|city|it|everything) (burn|shake|drown|explode|crumble|fall)|burn (it|the world) (all )?down|let it burn|world on fire|on fire tonight|carnage|apocalyp\w*|doomsday|mayhem|wreak\w* havoc|chaos|final score|scoreboard|game over)\b/i;

/** Why a line makes light of a disaster, or null. */
export function glibIn(lines: (string | undefined)[]) {
  const said = lines.map(l => l?.match(GLIB)?.[0]).find(Boolean);
  return said ? `"${said}" makes light of a disaster: keep it plain` : null;
}

/** Words that tell a toll, which no line says (GUIDELINES § Topics: tragedies stay plain, with no death tolls). */
export const TOLL = /\b(deaths?|died|dies|dying|killed|killing|kills|dead|lives|victims?|casualt\w*|toll|wounded|injur\w*)\b/i;

/** Why a script tells a toll, or null. */
export function tollIn(lines: string[]) {
  const said = lines.map(l => l.match(TOLL)?.[0]).find(Boolean);
  return said ? `no death tolls, tragedies stay plain: a line says "${said}"; tell the event by its physical size` : null;
}
