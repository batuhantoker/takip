/**
 * A long line cut to a heading at a clause break: a comma, semicolon or colon before a space, a dash between spaces,
 * or their Chinese, Japanese and Arabic forms. Shared by the importers that title events and the pages that show them.
 */

const OPEN = '([{（「『【《«';
const CLOSE = ')]}）」』】》»';
const BREAK = /\s*[,;:](?=\s)|\s[–—-]\s|[，、；：،؛]/gu;

/** The text up to its last break between `min` and `max` characters, outside brackets; null where none falls there. */
export function clauseCut(text: string, max: number, min = Math.ceil(max * 0.4)): string | null {
  const depth: number[] = [];
  let d = 0;
  for (const ch of text) {
    for (let i = 0; i < ch.length; i++) depth.push(d);
    if (OPEN.includes(ch)) d++;
    else if (CLOSE.includes(ch)) d = Math.max(0, d - 1);
  }
  let cut: string | null = null;
  for (const m of text.matchAll(BREAK)) {
    if (m.index > max) break;
    if (m.index >= min && depth[m.index] === 0) cut = text.slice(0, m.index).trimEnd();
  }
  return cut;
}

/** Whether `rest` opens with a break: what follows a heading clauseCut took from the start of a line. */
export const opensWithBreak = (rest: string) => /^(?:\s*[,;:](?=\s)|\s[–—-]\s|[，、；：،؛])/u.test(rest);
