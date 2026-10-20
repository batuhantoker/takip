/* The year an item's English description or its label states ("1918 armed conflict", "Siege of X (1683)"), for items with no date statement. */
import { Prec } from '@takip/core/time';

/** Astronomical years (0 is 1 BCE), as utc() takes them; `to` only for a stated range. */
export type TextYear = { from: number; to?: number; prec: Prec };

const BC = String.raw`BCE|BC|B\.\s?C\.(?:\s?E\.)?|a\.\s?C\.|av\.\s?J\.?-C\.|v\.\s?Chr\.|p\.\s?n\.\s?e\.|до\s?н\.\s?э\.|п\.\s?н\.\s?е\.`;
const AD = String.raw`CE|AD|A\.\s?D\.|d\.\s?C\.|n\.\s?Chr\.|н\.\s?э\.`;
const IS_BC = new RegExp(`^(?:${BC})$`, 'iu');
const DASH = '[-–—‐‑/]';
/** A year or a range with an optional era, not part of a longer number or word ("1920s", "101st", "12,000"). */
const SPAN = String.raw`(?<![\d\p{L}.,])(\d{1,4})(?:\s*${DASH}\s*(\d{1,4}))?(?:\s*(${BC}|${AD}))?(?![\d\p{L}%'’])`;
/** English, French, Spanish, German and Russian month names: labels with no English one come in those most. */
const MONTHS = [
  'January|February|March|April|May|June|July|August|September|October|November|December',
  'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre',
  'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre',
  'Januar|Februar|März|Juni|Juli|Oktober|Dezember',
  'январ[ья]|феврал[ья]|марта?|апрел[ья]|ма[йя]|июн[ья]|июл[ья]|августа?|сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья]',
].join('|');
/** Words after "in 1918" that keep it a date: "massacre of 1200 Jews" is a count. */
const NEXT = String.raw`(?=\s*(?:$|[,.;:)])|\s+(?:in|during|between|against|and|at|on|by|to|under|for|with|when|near|after|before|as|which|that|where|of|from|led|fought|while|amid|following)\b)`;

/** Numbered places and things that end a name the way a year does: "Battle for Hill 3234". */
const NOT_AFTER = String.raw`(?<!(?:Hill|Heights?|Point|Route|Road|Highway|Operation|No\.|Number|Kilometre|Kilometer|km|Höhe|Cota|Quota|colline|wzgórze|высоты|высота|висоти)\s)`;
/** A 4-digit year closing the text: "Treaty between Tunis and Sweden 1736"; a closing range is often a term in force. */
const LAST = String.raw`(?<=\s)(?<!(?:and|to|until|till|since|after|before|by|from|around|about|c\.|ca\.|circa|[-–—‐‑])\s*)${NOT_AFTER}(\d{4})()()\s*$`;
const BETWEEN = String.raw`(?<!\p{L})between\s+(\d{3,4})\s+and\s+(\d{3,4})()(?!\d)`;
const MONTH = String.raw`(?<!\p{L})(?:${MONTHS})\s+(?:\d{1,2},?\s+)?(?:de\s+)?${SPAN}`;

/** Counts that open a description the way a year does: "1200 soldiers killed". */
const COUNT = String.raw`(?!\s+(?:people|persons|men|women|children|soldiers|troops|civilians|victims|dead|killed|deaths|casualties|prisoners|Jews|ships|aircraft|tanks)\b)`;

const re = (s: string) => new RegExp(s, 'giu');
const DESCRIPTION = [
  re(String.raw`^\s*${SPAN}${COUNT}(?=\s+\p{L}|\s*$)`),
  re(String.raw`\(\s*${SPAN}\s*\)`),
  re(String.raw`(?<!\p{L})(?:in|of|on|from|during|year)\s+${SPAN}${NEXT}`),
  re(MONTH),
  re(BETWEEN),
  re(String.raw`,\s*${SPAN}\s*$`),
  re(LAST),
  re(String.raw`(?<![\d\p{L}.,])(\d{1,4})(?:\s*${DASH}\s*(\d{1,4}))?\s*(${BC}|${AD})(?![\p{L}])`),
];
const LABEL = [
  re(String.raw`\(\s*${SPAN}\s*\)`),
  re(MONTH),
  re(LAST),
  re(String.raw`^\s*(\d{4})(?:\s*${DASH}\s*(\d{1,4}))?()(?=\s+\p{L})`),
  re(String.raw`(?<![\d\p{L}.,])(\d{3,4})(?:\s*${DASH}\s*(\d{1,4}))?()\s*(?:год(?:а|у|ов)?|гг?\.|року|років|рік|roku|r\.|年|년|yılı)`),
  re(String.raw`(?<!\p{L})(?:of|in|de|del|della|di|du|des|von|vom|van|em|en|na|w|z|ze|в|во|у|під|от|из)\s+${SPAN}(?=\s*(?:$|[,;:)])|\s+(?:in|en|im|w|в|during|de|à|a|au)(?!\p{L}))`),
  re(String.raw`(?<![\d\p{L}.,])(\d{1,4})(?:\s*${DASH}\s*(\d{1,4}))?\s*(${BC}|${AD})(?![\p{L}])`),
];
const CENTURY = re(String.raw`(?<![\d\p{L}])(\d{1,2})(?:st|nd|rd|th)[\s-]+century(?:\s*(${BC}))?`);
const DECADE = re(String.raw`(?<![\d\p{L}])(\d{3})0s(?!\p{L})`);

function toYears(a: string, b: string | undefined, era: string | undefined, maxYear: number): { from: number; to?: number } | null {
  if (a.length < 3 && !era) return null;
  let from = Number(a);
  // "1843–44" is 1843 to 1844.
  let to = b === undefined ? undefined : Number(b.length < a.length ? a.slice(0, a.length - b.length) + b : b);
  if (era && IS_BC.test(era.replace(/\s+/g, ' '))) {
    from = 1 - from;
    if (to !== undefined) to = 1 - to;
  }
  if (to !== undefined && to < from) return null;
  if (from < -5000 || (to ?? from) > maxYear) return null;
  return to === undefined || to === from ? { from } : { from, to };
}

/**
 * The first stated year or range: leading ("1858 treaty"), in brackets, after "in"/"of" when nothing like a count
 * follows, after a month, or with an era; else an "nth century" or "1920s". A battle's range longer than a year is
 * more likely its war's, so it is skipped.
 */
export function textYear(text: string | undefined, as: 'description' | 'label', battle = false, maxYear = new Date().getUTCFullYear()): TextYear | null {
  if (!text) return null;
  const hits: { at: number; y: { from: number; to?: number } }[] = [];
  for (const pattern of as === 'description' ? DESCRIPTION : LABEL) {
    for (const m of text.matchAll(pattern)) {
      const y = toYears(m[1], m[2], m[3] || undefined, maxYear);
      if (!y || (battle && y.to !== undefined && y.to - y.from > 1)) continue;
      hits.push({ at: m.index, y });
    }
  }
  if (hits.length) {
    const first = hits.reduce((a, b) => (b.at < a.at ? b : a));
    return { ...first.y, prec: Prec.year };
  }
  if (as === 'label') return null;
  const c = [...text.matchAll(CENTURY)][0];
  if (c) {
    const n = Number(c[1]);
    if (n < 1 || n > 21) return null;
    // A year inside the century: expand() floors it to the century's start.
    const from = c[2] ? 1 - (n * 100 - 50) : (n - 1) * 100 + 50;
    return from <= maxYear ? { from, prec: Prec.century } : null;
  }
  const d = [...text.matchAll(DECADE)][0];
  if (d) {
    const from = Number(d[1]) * 10;
    return from <= maxYear ? { from, prec: Prec.decade } : null;
  }
  return null;
}
