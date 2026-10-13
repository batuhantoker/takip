/** What a step asks of the driver, coarse enough for one icon. */
export type ManeuverKind =
  | 'depart' | 'arrive' | 'straight' | 'left' | 'right' | 'slight-left' | 'slight-right'
  | 'uturn' | 'roundabout' | 'merge' | 'ferry';

const side = (dir: string): 'left' | 'right' => (dir === 'left' ? 'left' : 'right');

/**
 * Read from the instruction first: the router's coarse `type` is not reliable
 * (Valhalla left turns arrive as "roundabout", roundabouts as "merge"), while
 * the sentence it writes is.
 */
export function maneuverKind(step: { type: string; instruction?: string }): ManeuverKind {
  if (step.type === 'depart') return 'depart';
  if (step.type === 'arrive') return 'arrive';
  const t = (step.instruction ?? '').trim().toLowerCase();
  let m: RegExpMatchArray | null;
  if (/^you (have|will) arrive/.test(t)) return 'arrive';
  if (/\bu-?turn\b/.test(t)) return 'uturn';
  // A leading verb decides first, so "Turn right onto Ferry Road" stays a right turn.
  if ((m = t.match(/^(?:bear|keep|stay|slight)\s+(left|right)\b/)) || (m = t.match(/^take (?:the )?exit\b[^.]*?\bon the (left|right)\b/))) {
    return `slight-${side(m[1])}`;
  }
  if ((m = t.match(/^(?:turn|make a)\s+(?:sharp\s+|slight\s+)?(left|right)\b/))) return side(m[1]);
  if (/^merge\b/.test(t)) return 'merge';
  if (/^(continue|head|drive|walk|cycle|go|take exit)\b/.test(t)) return 'straight';
  if (/\broundabout\b|\brotary\b|traffic circle|\btake the \d+(st|nd|rd|th) exit\b/.test(t)) return 'roundabout';
  if (/^(take|board) the ferry|\bferry\b/.test(t)) return 'ferry';
  if (step.type === 'left' || step.type === 'right') return step.type;
  if (step.type === 'roundabout' || step.type === 'merge') return step.type;
  return 'straight';
}
