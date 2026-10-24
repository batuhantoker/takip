/** Event kinds no short draws: genocides and massacres are on the list of topics kept out of promotion (GUIDELINES § Topics). */
import { KIND_FAMILY } from '../../../src/lib/history/kinds';

export const KEPT_OUT = new Set(['conflict.massacre', 'conflict.genocide', 'conflict.pogrom', 'conflict.expulsion']);
/** History's families when a link names none (session.ts DEFAULT_FAMILIES). */
const DEFAULT_FAMILIES = ['conflict'];

/** Page JavaScript that draws these kinds, or every kind of these families, without the kept-out ones, when they'd show any. */
export function keepOutKinds({ kinds, families = DEFAULT_FAMILIES }: { kinds?: string[]; families?: string[] } = {}) {
  const drawn = kinds?.length ? kinds : Object.keys(KIND_FAMILY).filter(k => families.includes(KIND_FAMILY[k]));
  return drawn.some(k => KEPT_OUT.has(k)) ? `__takipHistory.setKinds(${JSON.stringify(drawn.filter(k => !KEPT_OUT.has(k)))});` : '';
}
